import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';

test('owner lifecycle, authorization, public pricing, captured packages, and analytics', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pricing-api-'));
  const server = spawn(process.execPath, ['server/index.mjs'], {
    env: { ...process.env, PORT: '0', DATABASE_PATH: join(directory, 'test.sqlite') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let port;
  try {
    port = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
      server.stdout.on('data', (chunk) => {
        output += chunk;
        const m = output.match(/ready on port (\d+)/);
        if (m) {
          clearTimeout(timeout);
          resolve(m[1]);
        }
      });
      server.on('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`Server exited ${code}`));
      });
    });
    const base = `http://127.0.0.1:${port}`;
    async function call(path, method = 'GET', body, cookie, origin) {
      const response = await fetch(base + path, {
        method,
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
          ...(origin ? { Origin: origin } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return {
        status: response.status,
        data: await response.json(),
        cookie: response.headers.get('set-cookie')?.split(';')[0],
      };
    }
    const auth = await call('/api/auth/register', 'POST', {
      email: 'owner@example.com',
      password: 'correct horse battery staple',
    });
    assert.equal(auth.status, 201);
    const cookie = auth.cookie;
    assert.equal(
      (await call('/api/auth/me', 'GET', undefined, cookie)).data.user.email,
      'owner@example.com',
    );
    assert.equal(
      (
        await call('/api/auth/login', 'POST', {
          email: 'owner@example.com',
          password: 'incorrect password',
        })
      ).status,
      401,
    );
    assert.equal((await call('/api/projects')).status, 401);
    const created = await call(
      '/api/projects',
      'POST',
      { name: 'Acme', description: 'Build your package', sample: true },
      cookie,
    );
    assert.equal(created.status, 201);
    const project = created.data.project;
    const other = await call('/api/auth/register', 'POST', {
      email: 'other@example.com',
      password: 'another strong password',
    });
    assert.equal(
      (await call(`/api/projects/${project.id}/analytics`, 'GET', undefined, other.cookie)).status,
      404,
    );
    assert.equal(
      (await call('/api/projects', 'POST', { name: 'Blocked' }, cookie, 'https://evil.example'))
        .status,
      403,
    );
    const publicCatalog = await call(`/api/public/projects/${project.id}`);
    assert.equal(publicCatalog.status, 200);
    assert.equal(publicCatalog.data.owner_id, undefined);
    const f = (name) => project.features.find((f) => f.name === name);
    const selections = {
      [f('Analytics').id]: 1,
      [f('AI Assistant').id]: 1,
      [f('Team Members').id]: 3,
      [f('Onboarding').id]: 1,
    };
    const session = await call(`/api/public/projects/${project.id}/sessions`, 'POST', {});
    assert.equal(session.status, 201);
    const endpoint = `/api/public/projects/${project.id}/configuration`;
    assert.equal(
      (
        await call(endpoint, 'POST', {
          sessionId: session.data.sessionId,
          selections: { [f('Core Platform').id]: 0 },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call(endpoint, 'POST', {
          sessionId: session.data.sessionId,
          selections: { [f('Team Members').id]: 10001 },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call(endpoint, 'POST', {
          sessionId: session.data.sessionId,
          selections: { unknown: 1 },
        })
      ).status,
      409,
    );
    const update = await call(endpoint, 'POST', {
      sessionId: session.data.sessionId,
      selections,
      monthlyCents: 1,
    });
    assert.equal(update.status, 200);
    assert.equal(update.data.summary.monthlyCents, 3200);
    assert.equal(update.data.summary.oneTimeCents, 2500);
    assert.equal(
      (
        await call(endpoint, 'POST', {
          sessionId: session.data.sessionId,
          selections,
          finalize: true,
          expectedMonthlyCents: 1,
          expectedOneTimeCents: 2500,
        })
      ).status,
      409,
    );
    const final = await call(endpoint, 'POST', {
      sessionId: session.data.sessionId,
      selections,
      finalize: true,
    });
    assert.ok(final.data.configurationId);
    const reduced = { ...selections, [f('AI Assistant').id]: 0 };
    await call(endpoint, 'POST', { sessionId: session.data.sessionId, selections: reduced });
    const analytics = await call(`/api/projects/${project.id}/analytics`, 'GET', undefined, cookie);
    assert.equal(analytics.data.sessions, 1);
    assert.equal(analytics.data.captured, 1);
    assert.equal(analytics.data.averageMonthlyCents, 2400);
    assert.ok(
      analytics.data.events.some(
        (e) => e.name === 'AI Assistant' && e.action === 'removed' && e.count === 1,
      ),
    );
    assert.ok(analytics.data.events.every((e) => e.name !== 'Core Platform'));
    const suggestions = await call(`/api/public/projects/${project.id}/suggestions`, 'POST', {
      selections: reduced,
      goal: 'writing and brainstorming',
    });
    assert.equal(suggestions.data.provider, 'rules');
    assert.ok(suggestions.data.suggestions.some((s) => s.name === 'AI Assistant'));
    const before = JSON.stringify(reduced);
    await call(`/api/public/projects/${project.id}/suggestions`, 'POST', {
      selections: reduced,
      goal: 'AI',
    });
    assert.equal(JSON.stringify(reduced), before);
    assert.equal(
      (
        await call(
          `/api/projects/${project.id}`,
          'PATCH',
          { ...project, checkoutUrl: 'javascript:alert(1)' },
          cookie,
        )
      ).status,
      400,
    );
    const edited = await call(
      `/api/projects/${project.id}/features/${f('AI Assistant').id}`,
      'PUT',
      { ...f('AI Assistant'), active: false, priceCents: 900 },
      cookie,
    );
    assert.equal(edited.status, 200);
    assert.ok(
      !(await call(`/api/public/projects/${project.id}`)).data.features.some(
        (item) => item.id === f('AI Assistant').id,
      ),
    );
    assert.equal(
      (await call(endpoint, 'POST', { sessionId: session.data.sessionId, selections })).status,
      409,
    );
    assert.equal(
      (
        await call(
          `/api/projects/${project.id}/features/${f('AI Assistant').id}`,
          'DELETE',
          {},
          cookie,
        )
      ).status,
      200,
    );
    const snapshots = await call(
      `/api/projects/${project.id}/configurations`,
      'GET',
      undefined,
      cookie,
    );
    assert.equal(snapshots.data.configurations[0].summary.monthlyCents, 3200);
    assert.ok(
      snapshots.data.configurations[0].summary.items.some((i) => i.name === 'AI Assistant'),
    );
    assert.equal((await call('/api/auth/logout', 'POST', {}, cookie)).status, 200);
    assert.equal((await call('/api/auth/me', 'GET', undefined, cookie)).status, 401);
  } finally {
    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    await exited;
    await rm(directory, { recursive: true, force: true });
  }
});
