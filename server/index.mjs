import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { calculatePackage } from '../shared/pricing.mjs';

const hashPassword = promisify(scrypt);
const databasePath = process.env.DATABASE_PATH || resolve('data/pricing.sqlite');
mkdirSync(dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS auth_sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,description TEXT NOT NULL,categories TEXT NOT NULL,checkout_url TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS features(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS pricing_sessions(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,created INTEGER NOT NULL,selections TEXT NOT NULL DEFAULT '{}',monthly INTEGER NOT NULL DEFAULT 0,one_time INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES pricing_sessions(id),feature_id TEXT NOT NULL,action TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS configurations(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),session_id TEXT NOT NULL REFERENCES pricing_sessions(id),created INTEGER NOT NULL,data TEXT NOT NULL);
`);
const run = (sql, ...values) => db.prepare(sql).run(...values);
const get = (sql, ...values) => db.prepare(sql).get(...values);
const all = (sql, ...values) => db.prepare(sql).all(...values);
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const text = (value, label, max = 200, optional = false) => {
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim()))
    fail(400, `Invalid ${label}`);
  return value.trim();
};
const catalog = (id) =>
  all('SELECT data FROM features WHERE project_id=? ORDER BY rowid', id).map((row) =>
    JSON.parse(row.data),
  );
const projectData = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  categories: JSON.parse(row.categories),
  checkoutUrl: row.checkout_url,
  features: catalog(row.id),
});
const ownerProject = (id, owner) => {
  const row = get('SELECT * FROM projects WHERE id=? AND owner_id=?', id, owner.id);
  if (!row) fail(404, 'Project not found');
  return row;
};
function authenticated(req) {
  const token = req.headers.cookie
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('pricing_session='))
    ?.slice(16);
  const user =
    token &&
    get(
      'SELECT users.id,users.email FROM users JOIN auth_sessions ON users.id=auth_sessions.user_id WHERE auth_sessions.id=? AND expires>?',
      token,
      Date.now(),
    );
  if (!user) fail(401, 'Sign in to continue');
  return user;
}
function validateFeature(body, categories, id = randomUUID()) {
  const type = body.type;
  if (!['recurring', 'one_time', 'quantity'].includes(type))
    fail(400, 'Choose a supported billing type');
  if (!Number.isSafeInteger(body.priceCents) || body.priceCents < 0 || body.priceCents > 100000000)
    fail(400, 'Price must be between $0 and $1,000,000');
  const category = text(body.category, 'category', 60);
  if (!categories.includes(category)) fail(400, 'Choose an existing category');
  if (typeof body.required !== 'boolean' || typeof body.active !== 'boolean')
    fail(400, 'Invalid feature status');
  const maxQuantity = type === 'quantity' ? body.maxQuantity : 1;
  if (!Number.isSafeInteger(maxQuantity) || maxQuantity < 1 || maxQuantity > 10000)
    fail(400, 'Maximum quantity must be 1–10,000');
  return {
    id,
    name: text(body.name, 'feature name', 100),
    description: text(body.description, 'description', 500, true),
    audience: text(body.audience ?? '', 'recommendation guidance', 500, true),
    priceCents: body.priceCents,
    type,
    category,
    required: body.required,
    active: body.active,
    maxQuantity,
  };
}
function validateSelections(body, features) {
  const values = body.selections;
  if (!values || typeof values !== 'object' || Array.isArray(values))
    fail(400, 'Selections must be an object');
  for (const [id, quantity] of Object.entries(values)) {
    const f = features.find((f) => f.id === id && f.active);
    if (!f) fail(409, 'The feature catalog changed. Reload the pricing block.');
    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 0 ||
      quantity > (f.type === 'quantity' ? f.maxQuantity : 1)
    )
      fail(400, 'Invalid quantity');
  }
  try {
    return calculatePackage(features, values);
  } catch (error) {
    fail(400, error.message);
  }
}
async function bodyOf(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 65536) fail(413, 'Request too large');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString() || '{}');
  } catch {
    fail(400, 'Invalid JSON');
  }
}
const limits = new Map();
function limit(req, scope, max) {
  const key = `${req.socket.remoteAddress}:${scope}`;
  const now = Date.now();
  if (limits.size > 10000) for (const [k, v] of limits) if (v.until < now) limits.delete(k);
  const entry = limits.get(key);
  if (!entry || entry.until < now) limits.set(key, { count: 1, until: now + 60000 });
  else if (++entry.count > max) fail(429, 'Too many requests. Please try again in a minute.');
}
function sessionCookie(token, expires = 604800) {
  return `pricing_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${expires}${process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''}`;
}
async function api(req, res, url) {
  const path = url.pathname;
  const method = req.method;
  if (!['GET', 'HEAD'].includes(method)) {
    if (req.headers.origin) {
      const allowed = process.env.APP_ORIGIN || `http://${req.headers.host}`;
      if (req.headers.origin !== allowed) fail(403, 'Request origin is not allowed');
    }
    if (!req.headers['content-type']?.startsWith('application/json'))
      fail(415, 'Use application/json');
  }
  const send = (data, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };
  if (path === '/api/health') return send({ ok: true });
  if (path === '/api/auth/me' && method === 'GET') return send({ user: authenticated(req) });
  if (['/api/auth/register', '/api/auth/login'].includes(path) && method === 'POST') {
    limit(req, 'auth', 15);
    const body = await bodyOf(req);
    const email = text(body.email, 'email', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email address');
    const password = body.password;
    if (typeof password !== 'string' || password.length < 10 || password.length > 128)
      fail(400, 'Password must be 10–128 characters');
    let user;
    if (path.endsWith('register')) {
      if (get('SELECT id FROM users WHERE email=?', email))
        fail(409, 'An account with this email already exists');
      const salt = randomBytes(16).toString('hex');
      const hash = await hashPassword(password, salt, 64);
      user = { id: randomUUID(), email };
      try {
        run('INSERT INTO users VALUES(?,?,?)', user.id, email, `${salt}:${hash.toString('hex')}`);
      } catch {
        fail(409, 'An account with this email already exists');
      }
    } else {
      const row = get('SELECT * FROM users WHERE email=?', email);
      const [salt, expected] = (row?.password || `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
      const actual = await hashPassword(password, salt, 64);
      if (!row || !timingSafeEqual(actual, Buffer.from(expected, 'hex')))
        fail(401, 'Incorrect email or password');
      user = { id: row.id, email: row.email };
    }
    run('DELETE FROM auth_sessions WHERE expires<?', Date.now());
    const token = randomBytes(32).toString('hex');
    run('INSERT INTO auth_sessions VALUES(?,?,?)', token, user.id, Date.now() + 604800000);
    res.setHeader('Set-Cookie', sessionCookie(token));
    return send({ user }, path.endsWith('register') ? 201 : 200);
  }
  if (path === '/api/auth/logout' && method === 'POST') {
    const token = req.headers.cookie
      ?.split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith('pricing_session='))
      ?.slice(16);
    if (token) run('DELETE FROM auth_sessions WHERE id=?', token);
    res.setHeader('Set-Cookie', sessionCookie('', 0));
    return send({ ok: true });
  }
  const publicMatch = path.match(
    /^\/api\/public\/projects\/([^/]+)(?:\/(sessions|suggestions|configuration))?$/,
  );
  if (publicMatch) {
    const [, id, action] = publicMatch;
    const row = get('SELECT * FROM projects WHERE id=?', id);
    if (!row) fail(404, 'Pricing block not found');
    const features = catalog(id).filter((f) => f.active);
    if (!action && method === 'GET') return send({ ...projectData(row), features });
    if (method !== 'POST') fail(405, 'Method not allowed');
    limit(req, 'public', 300);
    const body = await bodyOf(req);
    if (action === 'sessions') {
      const sessionId = randomUUID();
      const summary = calculatePackage(features, {});
      const selections = Object.fromEntries(summary.items.map((i) => [i.featureId, i.quantity]));
      run(
        'INSERT INTO pricing_sessions(id,project_id,created,selections,monthly,one_time) VALUES(?,?,?,?,?,?)',
        sessionId,
        id,
        Date.now(),
        JSON.stringify(selections),
        summary.monthlyCents,
        summary.oneTimeCents,
      );
      return send({ sessionId }, 201);
    }
    if (action === 'suggestions') {
      const summary = validateSelections(body, features);
      const categories = new Set(
        features
          .filter((f) => summary.items.some((i) => i.featureId === f.id))
          .map((f) => f.category),
      );
      const words = new Set(
        text(body.goal ?? '', 'goal', 500, true)
          .toLowerCase()
          .split(/\W+/)
          .filter((w) => w.length > 3),
      );
      const suggestions = features
        .filter((f) => !f.required && !summary.items.some((i) => i.featureId === f.id))
        .map((f) => {
          const guidance = `${f.name} ${f.description} ${f.audience}`.toLowerCase();
          const matched = [...words].filter((w) => guidance.includes(w));
          return {
            featureId: f.id,
            name: f.name,
            score: matched.length * 3 + (categories.has(f.category) ? 1 : 0),
            reason: matched.length
              ? `Matches your interest in ${matched.slice(0, 3).join(', ')}.`
              : `Pairs with your selected ${f.category.toLowerCase()} features.`,
          };
        })
        .filter((f) => f.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      return send({ provider: 'rules', suggestions });
    }
    if (action === 'configuration') {
      const session = get(
        'SELECT * FROM pricing_sessions WHERE id=? AND project_id=?',
        body.sessionId,
        id,
      );
      if (!session) fail(400, 'Start a pricing session first');
      const summary = validateSelections(body, features);
      if (
        body.finalize === true &&
        ((body.expectedMonthlyCents !== undefined &&
          body.expectedMonthlyCents !== summary.monthlyCents) ||
          (body.expectedOneTimeCents !== undefined &&
            body.expectedOneTimeCents !== summary.oneTimeCents))
      )
        fail(
          409,
          'Prices changed. Reload the pricing block to review the current price before continuing.',
        );
      const previous = JSON.parse(session.selections);
      const current = Object.fromEntries(summary.items.map((i) => [i.featureId, i.quantity]));
      db.exec('BEGIN');
      try {
        for (const f of features) {
          const before = previous[f.id] || 0;
          const after = current[f.id] || 0;
          if ((!before && after) || (before && !after))
            run(
              'INSERT INTO events VALUES(?,?,?,?)',
              randomUUID(),
              session.id,
              f.id,
              after ? 'selected' : 'removed',
            );
        }
        run(
          'UPDATE pricing_sessions SET selections=?,monthly=?,one_time=? WHERE id=?',
          JSON.stringify(current),
          summary.monthlyCents,
          summary.oneTimeCents,
          session.id,
        );
        let configurationId;
        if (body.finalize === true) {
          configurationId = randomUUID();
          run(
            'INSERT INTO configurations VALUES(?,?,?,?,?)',
            configurationId,
            id,
            session.id,
            Date.now(),
            JSON.stringify(summary),
          );
        }
        db.exec('COMMIT');
        return send({
          summary,
          configurationId,
          checkoutUrl: body.finalize === true ? row.checkout_url : undefined,
        });
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
    fail(405, 'Method not allowed');
  }
  const user = authenticated(req);
  if (path === '/api/projects') {
    if (method === 'GET')
      return send({
        projects: all('SELECT * FROM projects WHERE owner_id=? ORDER BY rowid DESC', user.id).map(
          projectData,
        ),
      });
    if (method === 'POST') {
      const body = await bodyOf(req);
      const id = randomUUID();
      const categories = ['Platform', 'AI', 'Collaboration', 'Analytics', 'Support'];
      run(
        'INSERT INTO projects(id,owner_id,name,description,categories) VALUES(?,?,?,?,?)',
        id,
        user.id,
        text(body.name, 'project name', 100),
        text(body.description ?? '', 'description', 500, true),
        JSON.stringify(categories),
      );
      if (body.sample === true) {
        const samples = [
          ['Core Platform', 'Your essential workspace.', 'Platform', 'recurring', 1000, true],
          [
            'AI Assistant',
            'Get help writing, planning, and brainstorming.',
            'AI',
            'recurring',
            800,
            false,
          ],
          [
            'Analytics',
            'Understand projects and track performance.',
            'Analytics',
            'recurring',
            500,
            false,
          ],
          [
            'Team Members',
            'Bring your team into one workspace.',
            'Collaboration',
            'quantity',
            300,
            false,
          ],
          [
            'PDF Export',
            'Export polished reports and documents.',
            'Platform',
            'recurring',
            500,
            false,
          ],
          [
            'Priority Support',
            'A faster response when you need a hand.',
            'Support',
            'recurring',
            500,
            false,
          ],
          [
            'Onboarding',
            'One-time help setting up your workspace.',
            'Support',
            'one_time',
            2500,
            false,
          ],
        ];
        for (const [name, description, category, type, priceCents, required] of samples) {
          const f = validateFeature(
            {
              name,
              description,
              audience: description,
              category,
              type,
              priceCents,
              required,
              active: true,
              maxQuantity: 100,
            },
            categories,
          );
          run('INSERT INTO features VALUES(?,?,?)', f.id, id, JSON.stringify(f));
        }
      }
      return send({ project: projectData(ownerProject(id, user)) }, 201);
    }
  }
  const match = path.match(
    /^\/api\/projects\/([^/]+)(?:\/(features|analytics|configurations)(?:\/([^/]+))?)?$/,
  );
  if (match) {
    const [, id, section, featureId] = match;
    const row = ownerProject(id, user);
    if (!section && method === 'PATCH') {
      const body = await bodyOf(req);
      const categories = body.categories;
      if (!Array.isArray(categories) || !categories.length || categories.length > 30)
        fail(400, 'Add 1–30 categories');
      const clean = [...new Set(categories.map((c) => text(c, 'category', 60)))];
      if (catalog(id).some((f) => !clean.includes(f.category)))
        fail(400, 'Move features out of a category before removing it');
      const checkoutUrl = text(body.checkoutUrl ?? '', 'checkout URL', 1000, true);
      if (checkoutUrl) {
        try {
          const target = new URL(checkoutUrl);
          if (target.protocol !== 'https:' || target.username || target.password)
            fail(400, 'Checkout URL must use HTTPS without credentials');
        } catch {
          fail(400, 'Enter a valid HTTPS checkout URL');
        }
      }
      run(
        'UPDATE projects SET name=?,description=?,categories=?,checkout_url=? WHERE id=?',
        text(body.name, 'project name', 100),
        text(body.description ?? '', 'description', 500, true),
        JSON.stringify(clean),
        checkoutUrl,
        id,
      );
      return send({ project: projectData(ownerProject(id, user)) });
    }
    if (section === 'features') {
      if (method === 'POST' && !featureId) {
        if (catalog(id).length >= 500) fail(400, 'A project supports up to 500 features');
        const f = validateFeature(await bodyOf(req), JSON.parse(row.categories));
        run('INSERT INTO features VALUES(?,?,?)', f.id, id, JSON.stringify(f));
        return send({ feature: f }, 201);
      }
      if (featureId) {
        if (!get('SELECT id FROM features WHERE id=? AND project_id=?', featureId, id))
          fail(404, 'Feature not found');
        if (method === 'PUT') {
          const f = validateFeature(await bodyOf(req), JSON.parse(row.categories), featureId);
          run('UPDATE features SET data=? WHERE id=?', JSON.stringify(f), featureId);
          return send({ feature: f });
        }
        if (method === 'DELETE') {
          run('DELETE FROM features WHERE id=? AND project_id=?', featureId, id);
          return send({ ok: true });
        }
      }
    }
    if (section === 'analytics' && method === 'GET') {
      const totals = get(
        'SELECT COUNT(*) sessions,AVG(monthly) averageMonthlyCents,AVG(one_time) averageOneTimeCents FROM pricing_sessions WHERE project_id=?',
        id,
      );
      const selected = all(
        'SELECT feature_id featureId,action,COUNT(*) count FROM events JOIN pricing_sessions ON events.session_id=pricing_sessions.id WHERE project_id=? GROUP BY feature_id,action ORDER BY count DESC',
        id,
      ).map((e) => ({
        ...e,
        name: catalog(id).find((f) => f.id === e.featureId)?.name || 'Deleted feature',
      }));
      const captured = get(
        'SELECT COUNT(*) count FROM configurations WHERE project_id=?',
        id,
      ).count;
      return send({ ...totals, captured, events: selected });
    }
    if (section === 'configurations' && method === 'GET')
      return send({
        configurations: all(
          'SELECT id,created,data FROM configurations WHERE project_id=? ORDER BY created DESC LIMIT 100',
          id,
        ).map((c) => ({ ...c, summary: JSON.parse(c.data), data: undefined })),
      });
  }
  fail(404, 'Endpoint not found');
}
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (!['GET', 'HEAD'].includes(req.method)) fail(405, 'Method not allowed');
    const root = resolve('dist');
    let path = resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (path !== root && !path.startsWith(root + '/')) fail(404, 'Not found');
    if (!extname(path)) path = resolve(root, 'index.html');
    else if (!existsSync(path)) fail(404, 'Not found');
    if (!existsSync(path)) fail(503, 'Build the application with npm run build first');
    res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream');
    res.end(req.method === 'HEAD' ? undefined : readFileSync(path));
  } catch (error) {
    res.writeHead(error.status || 500, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify({ error: error.status ? error.message : 'Unexpected server error' }));
    if (!error.status) console.error(error);
  }
});
server.listen(Number(process.env.PORT || 3001), '0.0.0.0', () =>
  console.log(`Pricing server ready on port ${server.address().port}`),
);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
