import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PricingBlock } from './PricingBlock';
import { api, type Feature, type Project, type User } from './types';
import { formatMoney } from '../shared/pricing.mjs';
import './style.css';

function Auth({ onLogin }: { onLogin: (user: User) => void }) {
  const [register, setRegister] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <a className="brand" href="/">
          ✳ pricing<span>block</span>
        </a>
        <p className="eyebrow">A BETTER WAY TO PRICE SOFTWARE</p>
        <h1>
          One pricing block.
          <br />
          <em>
            Every customer’s
            <br />
            own package.
          </em>
        </h1>
        <p>
          Let your customers choose what matters.
          <br />
          Make every feature count.
        </p>
        <div className="mini-package">
          <span>
            ☑ Core platform <strong>$10</strong>
          </span>
          <span>
            ☑ Analytics <strong>+$5</strong>
          </span>
          <span>
            ☑ 3 team members <strong>+$9</strong>
          </span>
          <div>
            Your package{' '}
            <strong>
              $24<span>/mo</span>
            </strong>
          </div>
        </div>
        <small>Built for products that don’t fit inside a plan.</small>
      </section>
      <section className="auth-form">
        <p className="eyebrow">THE OWNER WORKSPACE</p>
        <h2>{register ? 'Make room for choice.' : 'Welcome back.'}</h2>
        <p className="muted">
          {register
            ? 'Create your account to build your first pricing block.'
            : 'Sign in to manage your projects and features.'}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            const values = new FormData(e.currentTarget);
            try {
              const { user } = await api<{ user: User }>(
                `/api/auth/${register ? 'register' : 'login'}`,
                'POST',
                { email: values.get('email'), password: values.get('password') },
              );
              onLogin(user);
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Email address
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@yourcompany.com"
              required
              maxLength={254}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete={register ? 'new-password' : 'current-password'}
              minLength={10}
              maxLength={128}
              placeholder="At least 10 characters"
              required
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary full" disabled={busy}>
            {busy ? 'Please wait…' : register ? 'Create account →' : 'Sign in →'}
          </button>
        </form>
        <p className="auth-switch">
          {register ? 'Already have an account?' : 'New here?'}{' '}
          <button
            className="text-button"
            onClick={() => {
              setRegister(!register);
              setError('');
            }}
          >
            {register ? 'Sign in' : 'Create account'}
          </button>
        </p>
        <p className="fine-print">No payment provider needed. Set up features and pricing first.</p>
      </section>
    </div>
  );
}
const tabs = [
  'Features',
  'Categories',
  'Pricing block',
  'Integration',
  'Analytics',
  'Settings',
] as const;
type Tab = (typeof tabs)[number];
function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [tab, setTab] = useState<Tab>('Features');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'project' | 'feature' | null>(null);
  const [editing, setEditing] = useState<Feature | null>(null);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const project = projects.find((p) => p.id === projectId);
  async function refresh(id?: string) {
    const data = await api<{ projects: Project[] }>('/api/projects');
    setProjects(data.projects);
    setProjectId((old) => id || old || data.projects[0]?.id || '');
  }
  useEffect(() => {
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);
  async function patchProject(body: Partial<Project>) {
    if (!project) return;
    setError('');
    try {
      await api(`/api/projects/${project.id}`, 'PATCH', { ...project, ...body });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }
  useEffect(() => {
    if (!modal) return;
    const dialog = document.querySelector<HTMLElement>('[role=dialog]');
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModal(null);
        setError('');
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const controls = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]',
        ),
      ];
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modal]);
  const [categoryName, setCategoryName] = useState('');
  return (
    <div className="workspace">
      <aside className="sidebar">
        <a className="brand" href="/">
          ✳ pricing<span>block</span>
        </a>
        <span className="workspace-label">WORKSPACE</span>
        <label className="sr-only" htmlFor="project-select">
          Current project
        </label>
        <select
          id="project-select"
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            setError('');
            setFilter('');
          }}
        >
          <option value="" disabled>
            Select a project
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button className="new-project" onClick={() => setModal('project')}>
          + New project
        </button>
        <nav aria-label="Dashboard">
          {tabs.map((t, i) => (
            <button
              key={t}
              className={tab === t ? 'active' : ''}
              onClick={() => {
                setTab(t);
                setError('');
              }}
            >
              <span aria-hidden="true">{['▦', '◫', '◉', '⌘', '▥', '⚙'][i]}</span>
              {t}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span>✧</span>
          <strong>Let choice do the work.</strong>
          <p>One block. Unlimited ways to build a package.</p>
        </div>
        <div className="account">
          <span>{user.email}</span>
          <button
            className="text-button"
            onClick={async () => {
              try {
                await api('/api/auth/logout', 'POST', {});
                onLogout();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <span>
            Workspace <span className="muted">/ {project?.name || 'Your projects'}</span>
          </span>
          <span className="pill">MVP1</span>
        </header>
        <main className="dashboard-content">
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {!loaded ? (
            <p className="empty">Loading your workspace…</p>
          ) : !project ? (
            <div className="welcome">
              <p className="eyebrow">START WITH YOUR PRODUCT</p>
              <h1>
                Goodbye, rigid plans.
                <br />
                <em>Hello, possibilities.</em>
              </h1>
              <p className="muted">
                Create a project, add your features, and let customers build their own package.
              </p>
              <button className="button primary" onClick={() => setModal('project')}>
                Create your first project →
              </button>
            </div>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">{project.name.toUpperCase()}</p>
                  <h1>
                    {tab === 'Features'
                      ? 'Your product, feature by feature.'
                      : tab === 'Pricing block'
                        ? 'One block. Their perfect package.'
                        : tab === 'Integration'
                          ? 'A small embed. A big difference.'
                          : tab === 'Analytics'
                            ? 'See what customers choose.'
                            : tab === 'Categories'
                              ? 'A place for every feature.'
                              : 'Make it yours.'}
                  </h1>
                  <p className="muted">
                    {tab === 'Features'
                      ? 'Give every capability a name, a price, and a place.'
                      : tab === 'Pricing block'
                        ? 'Preview exactly what your customers will experience.'
                        : tab === 'Integration'
                          ? 'Drop your pricing block into any website.'
                          : tab === 'Analytics'
                            ? 'A simple view of real pricing sessions and package selections.'
                            : tab === 'Categories'
                              ? 'Help customers find what matters, faster.'
                              : 'Manage your project details and the next step after selection.'}
                  </p>
                </div>
                {tab === 'Features' && (
                  <button
                    className="button primary"
                    onClick={() => {
                      setEditing(null);
                      setModal('feature');
                    }}
                  >
                    + Add feature
                  </button>
                )}
              </div>
              {tab === 'Features' && (
                <>
                  <div className="stats-row">
                    <div>
                      <span>Total features</span>
                      <strong>{project.features.length}</strong>
                    </div>
                    <div>
                      <span>Active features</span>
                      <strong>{project.features.filter((f) => f.active).length}</strong>
                    </div>
                    <div>
                      <span>Required features</span>
                      <strong>
                        {project.features.filter((f) => f.required && f.active).length}
                      </strong>
                    </div>
                    <div>
                      <span>Categories</span>
                      <strong>{project.categories.length}</strong>
                    </div>
                  </div>
                  <div className="table-panel">
                    <div className="table-top">
                      <h2>Feature catalog</h2>
                      <input
                        aria-label="Search feature catalog"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Search features…"
                      />
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Feature</th>
                            <th>Category</th>
                            <th>Price</th>
                            <th>Status</th>
                            <th>
                              <span className="sr-only">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {project.features
                            .filter((f) =>
                              `${f.name} ${f.category}`
                                .toLowerCase()
                                .includes(filter.toLowerCase()),
                            )
                            .map((f) => (
                              <tr key={f.id}>
                                <td>
                                  <strong>{f.name}</strong>
                                  {f.required && <span className="tiny-tag">Required</span>}
                                  <small>{f.description}</small>
                                </td>
                                <td>
                                  <span className="category-tag">{f.category}</span>
                                </td>
                                <td>
                                  <strong>{formatMoney(f.priceCents)}</strong>
                                  <small>
                                    {f.type === 'one_time'
                                      ? 'One time'
                                      : f.type === 'quantity'
                                        ? 'Per unit / month'
                                        : 'Monthly'}
                                  </small>
                                </td>
                                <td>
                                  <button
                                    className={`status ${f.active ? 'on' : ''}`}
                                    aria-label={`${f.active ? 'Deactivate' : 'Activate'} ${f.name}`}
                                    onClick={async () => {
                                      setError('');
                                      try {
                                        await api(
                                          `/api/projects/${project.id}/features/${f.id}`,
                                          'PUT',
                                          { ...f, active: !f.active },
                                        );
                                        await refresh();
                                      } catch (e) {
                                        setError((e as Error).message);
                                      }
                                    }}
                                  >
                                    {f.active ? 'Active' : 'Inactive'}
                                  </button>
                                </td>
                                <td>
                                  <button
                                    className="text-button"
                                    onClick={() => {
                                      setEditing(f);
                                      setModal('feature');
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="text-button danger"
                                    onClick={async () => {
                                      if (
                                        !confirm(
                                          `Delete ${f.name}? Existing captured packages remain saved.`,
                                        )
                                      )
                                        return;
                                      try {
                                        await api(
                                          `/api/projects/${project.id}/features/${f.id}`,
                                          'DELETE',
                                          {},
                                        );
                                        await refresh();
                                      } catch (e) {
                                        setError((e as Error).message);
                                      }
                                    }}
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    {!project.features.length && (
                      <p className="empty">
                        Add your first feature to start building your pricing block.
                      </p>
                    )}
                  </div>
                  <div className="hint">
                    <span>↗</span>
                    <p>
                      <strong>Flexible by design.</strong> Several features can share a price. Use
                      quantity pricing for seats, storage units, or other customer-controlled
                      quantities.
                    </p>
                    <button className="text-button" onClick={() => setTab('Pricing block')}>
                      Preview block →
                    </button>
                  </div>
                </>
              )}
              {tab === 'Categories' && (
                <section className="panel narrow">
                  <h2>Feature categories</h2>
                  <form
                    className="inline-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        await patchProject({
                          categories: [...project.categories, categoryName.trim()],
                        });
                        setCategoryName('');
                      } catch {
                        /* Error is displayed above. */
                      }
                    }}
                  >
                    <label className="sr-only" htmlFor="new-category">
                      New category
                    </label>
                    <input
                      id="new-category"
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      placeholder="e.g. Integrations"
                      required
                      maxLength={60}
                    />
                    <button className="button primary">Add category</button>
                  </form>
                  {project.categories.map((c) => (
                    <div className="category-item" key={c}>
                      <div>
                        <strong>{c}</strong>
                        <small>
                          {project.features.filter((f) => f.category === c).length} features
                        </small>
                      </div>
                      <button
                        className="text-button danger"
                        disabled={
                          project.categories.length === 1 ||
                          project.features.some((f) => f.category === c)
                        }
                        onClick={() =>
                          patchProject({
                            categories: project.categories.filter((x) => x !== c),
                          }).catch(() => {})
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <p className="fine-print">
                    Move features to another category before removing their category.
                  </p>
                </section>
              )}
              {tab === 'Pricing block' && (
                <PricingBlock
                  key={project.id + JSON.stringify(project.features)}
                  project={project}
                  preview
                />
              )}
              {tab === 'Integration' && <Integration project={project} />}
              {tab === 'Analytics' && <Analytics key={project.id} project={project} />}
              {tab === 'Settings' && (
                <section className="panel narrow">
                  <h2>Project settings</h2>
                  <form
                    key={project.id}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setBusy(true);
                      const body = new FormData(e.currentTarget);
                      try {
                        await patchProject({
                          name: String(body.get('name')),
                          description: String(body.get('description')),
                          checkoutUrl: String(body.get('checkoutUrl')),
                        });
                      } catch {
                        /* Displayed above. */
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <label>
                      Project name
                      <input name="name" defaultValue={project.name} required maxLength={100} />
                    </label>
                    <label>
                      Customer-facing description
                      <textarea
                        name="description"
                        defaultValue={project.description}
                        maxLength={500}
                      />
                    </label>
                    <label>
                      Checkout or next-step URL <span className="muted">(optional)</span>
                      <input
                        name="checkoutUrl"
                        type="url"
                        placeholder="https://yourproduct.com/checkout"
                        defaultValue={project.checkoutUrl}
                      />
                    </label>
                    <p className="fine-print">
                      The Continue button first captures the package. Customers can then open this
                      HTTPS URL with configurationId and projectId query parameters. Prices must be
                      verified server-side by your checkout integration.
                    </p>
                    <button className="button primary" disabled={busy}>
                      {busy ? 'Saving…' : 'Save settings'}
                    </button>
                  </form>
                </section>
              )}
            </>
          )}
        </main>
        <footer>One pricing block. Every customer gets their own package.</footer>
      </div>
      {modal && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-title">
              <h2 id="modal-title">
                {modal === 'project'
                  ? 'Create a project'
                  : editing
                    ? 'Edit feature'
                    : 'Add a feature'}
              </h2>
              <button
                className="icon-button"
                aria-label="Close dialog"
                onClick={() => {
                  setModal(null);
                  setError('');
                }}
              >
                ×
              </button>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {modal === 'project' ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError('');
                  const values = new FormData(e.currentTarget);
                  try {
                    const { project } = await api<{ project: Project }>('/api/projects', 'POST', {
                      name: values.get('name'),
                      description: values.get('description'),
                      sample: values.get('sample') === 'on',
                    });
                    await refresh(project.id);
                    setTab('Features');
                    setModal(null);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  Project name
                  <input
                    name="name"
                    placeholder="e.g. Acme Workspace"
                    autoFocus
                    required
                    maxLength={100}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    name="description"
                    placeholder="What does your product help people do?"
                    maxLength={500}
                  />
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" name="sample" defaultChecked />
                  Start with sample features I can edit
                </label>
                <button className="button primary full" disabled={busy}>
                  {busy ? 'Creating…' : 'Create project →'}
                </button>
              </form>
            ) : (
              project && (
                <FeatureForm
                  project={project}
                  feature={editing}
                  onSave={async (body) => {
                    await api(
                      `/api/projects/${project.id}/features${editing ? '/' + editing.id : ''}`,
                      editing ? 'PUT' : 'POST',
                      body,
                    );
                    await refresh();
                    setModal(null);
                    setError('');
                  }}
                />
              )
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function FeatureForm({
  project,
  feature,
  onSave,
}: {
  project: Project;
  feature: Feature | null;
  onSave: (body: Omit<Feature, 'id'>) => Promise<void>;
}) {
  const [type, setType] = useState<Feature['type']>(feature?.type || 'recurring');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        const values = new FormData(e.currentTarget);
        try {
          await onSave({
            name: String(values.get('name')),
            description: String(values.get('description')),
            audience: String(values.get('audience')),
            category: String(values.get('category')),
            type,
            priceCents: Math.round(Number(values.get('price')) * 100),
            maxQuantity: type === 'quantity' ? Number(values.get('maxQuantity')) : 1,
            required: values.get('required') === 'on',
            active: values.get('active') === 'on',
          });
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Feature name
        <input name="name" defaultValue={feature?.name} required maxLength={100} autoFocus />
      </label>
      <label>
        Short description
        <textarea name="description" defaultValue={feature?.description} maxLength={500} />
      </label>
      <div className="form-grid">
        <label>
          Category
          <select
            name="category"
            aria-label="Category"
            defaultValue={feature?.category || project.categories[0]}
          >
            {project.categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Billing type
          <select value={type} onChange={(e) => setType(e.target.value as Feature['type'])}>
            <option value="recurring">Fixed monthly</option>
            <option value="one_time">One time</option>
            <option value="quantity">Per unit / month</option>
          </select>
        </label>
      </div>
      <div className="form-grid">
        <label>
          Price (USD)
          <input
            name="price"
            type="number"
            min="0"
            max="1000000"
            step="0.01"
            defaultValue={(feature?.priceCents || 0) / 100}
            required
          />
        </label>
        {type === 'quantity' && (
          <label>
            Maximum quantity
            <input
              name="maxQuantity"
              type="number"
              min="1"
              max="10000"
              step="1"
              defaultValue={feature?.maxQuantity || 100}
              required
            />
          </label>
        )}
      </div>
      <label>
        Who is this useful for? <span className="muted">(optional)</span>
        <textarea
          name="audience"
          placeholder="e.g. Teams tracking project progress and performance"
          defaultValue={feature?.audience}
          maxLength={500}
        />
      </label>
      <div className="form-grid">
        <label className="checkbox-label">
          <input name="required" type="checkbox" defaultChecked={feature?.required} />
          Required feature
        </label>
        <label className="checkbox-label">
          <input name="active" type="checkbox" defaultChecked={feature?.active ?? true} />
          Active and visible
        </label>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary full" disabled={busy}>
        {busy ? 'Saving…' : 'Save feature'}
      </button>
    </form>
  );
}
function Integration({ project }: { project: Project }) {
  const snippet = `<script src="${location.origin}/pricing.js" defer></script>\n<smart-pricing project="${project.id}"></smart-pricing>`;
  const [message, setMessage] = useState('');
  return (
    <div className="integration-layout">
      <section className="panel">
        <span className="step">01</span>
        <h2>Copy. Paste. Customize.</h2>
        <p className="muted">Add this snippet where you want your pricing experience to appear.</p>
        <pre>
          <code>{snippet}</code>
        </pre>
        <button
          className="button primary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(snippet);
              setMessage('Embed code copied.');
            } catch {
              setMessage('Select the embed code above and copy it manually.');
            }
          }}
        >
          Copy embed code
        </button>
        <p role="status">{message}</p>
        <div className="notice">
          For a live website, deploy this application to a public HTTPS address, then copy the
          snippet from that deployed dashboard.
        </div>
      </section>
      <section className="panel">
        <span className="step">02</span>
        <h2>Capture the customer’s choice.</h2>
        <p className="muted">
          The block saves a package and emits a configuration event. Use it to move the customer to
          your next step.
        </p>
        <pre>
          <code>{`document.querySelector('smart-pricing')\n  .addEventListener('configuration', (event) => {\n    const { configurationId, summary } = event.detail;\n    // Pass the reference to your own checkout flow.\n  });`}</code>
        </pre>
        <a
          className="button secondary"
          href={`/embed/${project.id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open live pricing block ↗
        </a>
        <p className="fine-print">
          The public block exposes only your active catalog. Owner tools require a signed-in
          account. Treat browser event data as untrusted in a payment integration.
        </p>
      </section>
    </div>
  );
}
type AnalyticsData = {
  sessions: number;
  averageMonthlyCents: number | null;
  averageOneTimeCents: number | null;
  captured: number;
  events: { featureId: string; name: string; action: string; count: number }[];
};
function Analytics({ project }: { project: Project }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [configs, setConfigs] = useState<
    {
      id: string;
      created: number;
      summary: {
        monthlyCents: number;
        oneTimeCents: number;
        items: { name: string; quantity: number }[];
      };
    }[]
  >([]);
  const [error, setError] = useState('');
  async function load() {
    try {
      const [stats, captured] = await Promise.all([
        api<AnalyticsData>(`/api/projects/${project.id}/analytics`),
        api<{ configurations: typeof configs }>(`/api/projects/${project.id}/configurations`),
      ]);
      setData(stats);
      setConfigs(captured.configurations);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, [project.id]);
  if (error)
    return (
      <div className="error" role="alert">
        {error}
        <button className="text-button" onClick={load}>
          Retry
        </button>
      </div>
    );
  if (!data) return <p>Loading analytics…</p>;
  return (
    <>
      <button className="button secondary" onClick={load}>
        Refresh analytics
      </button>
      <div className="stats-row">
        <div>
          <span>Pricing sessions</span>
          <strong>{data.sessions}</strong>
        </div>
        <div>
          <span>Captured packages</span>
          <strong>{data.captured}</strong>
        </div>
        <div>
          <span>Average monthly value</span>
          <strong>{formatMoney(Math.round(data.averageMonthlyCents || 0))}</strong>
        </div>
        <div>
          <span>Average one-time value</span>
          <strong>{formatMoney(Math.round(data.averageOneTimeCents || 0))}</strong>
        </div>
      </div>
      <p className="fine-print">
        Averages use the latest package in each live session. Owner previews are excluded. Initial
        required selections are not counted as selection events.
      </p>
      <div className="integration-layout">
        {['selected', 'removed'].map((action) => (
          <section className="panel" key={action}>
            <h2>Most {action} features</h2>
            {data.events.filter((e) => e.action === action).length ? (
              data.events
                .filter((e) => e.action === action)
                .slice(0, 10)
                .map((e) => (
                  <div className="category-item" key={e.featureId}>
                    <span>{e.name}</span>
                    <strong>{e.count}</strong>
                  </div>
                ))
            ) : (
              <p className="empty">No {action} events yet.</p>
            )}
          </section>
        ))}
      </div>
      <section className="panel captured">
        <h2>Captured packages</h2>
        <p className="muted">The latest 100 final configurations, stored with a price snapshot.</p>
        {!configs.length ? (
          <p className="empty">
            No packages captured yet. Open the live pricing block and continue with a selection.
          </p>
        ) : (
          configs.map((c) => (
            <details key={c.id}>
              <summary>
                {new Date(c.created).toLocaleString()} · {formatMoney(c.summary.monthlyCents)}/month
                + {formatMoney(c.summary.oneTimeCents)} once
              </summary>
              <p className="fine-print">Reference: {c.id}</p>
              <ul>
                {c.summary.items.map((i, n) => (
                  <li key={n}>
                    {i.quantity} × {i.name}
                  </li>
                ))}
              </ul>
              <pre>{JSON.stringify(c.summary, null, 2)}</pre>
            </details>
          ))
        )}
      </section>
    </>
  );
}
function App() {
  const embed = location.pathname.match(/^\/embed\/([^/]+)$/);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (embed) {
      api<Project>(`/api/public/projects/${embed[1]}`)
        .then(setProject)
        .catch((e) => setError(e.message))
        .finally(() => setReady(true));
    } else {
      api<{ user: User }>('/api/auth/me')
        .then((data) => setUser(data.user))
        .catch(() => {})
        .finally(() => setReady(true));
    }
  }, []);
  if (!ready) return <div className="loading">✳ Loading your pricing workspace…</div>;
  if (embed)
    return (
      <main className="embed-page">
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : (
          project && <PricingBlock project={project} />
        )}
        <p className="powered">
          Powered by <strong>pricingblock</strong>
        </p>
      </main>
    );
  return user ? (
    <Dashboard user={user} onLogout={() => setUser(null)} />
  ) : (
    <Auth onLogin={setUser} />
  );
}
createRoot(document.getElementById('root')!).render(<App />);
