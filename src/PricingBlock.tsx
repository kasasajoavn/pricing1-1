import { useEffect, useRef, useState } from 'react';
import { calculatePackage, formatMoney } from '../shared/pricing.mjs';
import { api, type Project } from './types';

type Suggestion = { featureId: string; name: string; reason: string };
export function PricingBlock({
  project,
  preview = false,
}: {
  project: Project;
  preview?: boolean;
}) {
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [goal, setGoal] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [captured, setCaptured] = useState<{ id: string; checkoutUrl: string } | null>(null);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const sessionPromise = useRef<Promise<{ sessionId: string }> | null>(null);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const features = project.features.filter((f) => f.active);
  const summary = calculatePackage(features, selections);
  const key = JSON.stringify(summary);
  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    const promise = api<{ sessionId: string }>(
      `/api/public/projects/${project.id}/sessions`,
      'POST',
      {},
    );
    sessionPromise.current = promise;
    promise
      .then(({ sessionId }) => {
        if (!cancelled) {
          setSessionId(sessionId);
          setError('');
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [project.id, preview, sessionAttempt]);
  useEffect(() => {
    if (preview || !sessionId) return;
    const snapshot = Object.fromEntries(summary.items.map((i) => [i.featureId, i.quantity]));
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(() =>
        api(`/api/public/projects/${project.id}/configuration`, 'POST', {
          sessionId,
          selections: snapshot,
        }),
      )
      .catch((e) => setError(e.message));
  }, [key, sessionId, project.id, preview]);
  function select(id: string, quantity: number) {
    setCaptured(null);
    setError('');
    setSelections((s) => ({ ...s, [id]: quantity }));
  }
  async function suggest() {
    setBusy(true);
    setError('');
    try {
      const result = await api<{ suggestions: Suggestion[] }>(
        `/api/public/projects/${project.id}/suggestions`,
        'POST',
        { selections, goal },
      );
      setSuggestions(result.suggestions);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function proceed() {
    if (preview) {
      setError('This is an owner preview. Open the live pricing block to capture a package.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const sid = sessionId || (await sessionPromise.current)?.sessionId;
      if (!sid) throw new Error('The session could not start. Please retry.');
      await saveQueue.current;
      const result = await api<{
        configurationId: string;
        summary: typeof summary;
        checkoutUrl: string;
      }>(`/api/public/projects/${project.id}/configuration`, 'POST', {
        sessionId: sid,
        selections,
        finalize: true,
        expectedMonthlyCents: summary.monthlyCents,
        expectedOneTimeCents: summary.oneTimeCents,
      });
      setCaptured({ id: result.configurationId, checkoutUrl: result.checkoutUrl });
      const parentOrigin = new URLSearchParams(location.search).get('parentOrigin');
      if (window.parent !== window && parentOrigin) {
        try {
          const origin = new URL(parentOrigin).origin;
          if (origin !== 'null')
            window.parent.postMessage(
              {
                type: 'smart-pricing:configuration',
                projectId: project.id,
                configurationId: result.configurationId,
                summary: result.summary,
              },
              origin,
            );
        } catch {
          /* Invalid embedding origin: no message is sent. */
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const visible = features.filter(
    (f) =>
      (category === 'All' || f.category === category) &&
      `${f.name} ${f.description} ${f.category}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="pricing-block" aria-label="Customize your package">
      <div className="block-heading">
        <div>
          <p className="eyebrow">YOUR PACKAGE, YOUR WAY</p>
          <h2>{project.name}</h2>
          <p className="muted">
            {project.description || 'Choose what you need. Leave out what you don’t.'}
          </p>
        </div>
        <span className="pill">USD pricing</span>
      </div>
      {preview && (
        <div className="notice">Owner preview · selections here don’t count toward analytics.</div>
      )}
      <div className="builder-layout">
        <div className="feature-browser">
          <label className="search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Search features"
              placeholder="Search features, tools, or capabilities…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="category-tabs" aria-label="Filter features by category">
            {['All', ...project.categories].map((c) => (
              <button
                key={c}
                aria-pressed={category === c}
                className={category === c ? 'selected' : ''}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="feature-list">
            {visible.length === 0 ? (
              <div className="empty">No matching features. Try another search or category.</div>
            ) : (
              visible.map((f) => {
                const quantity = f.required ? (selections[f.id] ?? 1) : (selections[f.id] ?? 0);
                return (
                  <article className={`feature-row ${quantity ? 'chosen' : ''}`} key={f.id}>
                    <label className="feature-toggle">
                      <input
                        type="checkbox"
                        checked={quantity > 0}
                        disabled={f.required}
                        onChange={(e) => select(f.id, e.target.checked ? 1 : 0)}
                      />
                      <div>
                        <div className="feature-title">
                          {f.name}
                          {f.required && <span className="tiny-tag">Required</span>}
                        </div>
                        <p>{f.description}</p>
                        <span className="feature-category">{f.category}</span>
                      </div>
                    </label>
                    <div className="feature-cost">
                      <strong>{formatMoney(f.priceCents)}</strong>
                      <span>
                        {f.type === 'one_time'
                          ? 'one time'
                          : f.type === 'quantity'
                            ? 'per unit / month'
                            : '/ month'}
                      </span>
                      {f.type === 'quantity' && quantity > 0 && (
                        <div className="quantity">
                          <button
                            aria-label={`Decrease ${f.name}`}
                            disabled={quantity <= 1}
                            onClick={() => select(f.id, quantity - 1)}
                          >
                            −
                          </button>
                          <input
                            aria-label={`${f.name} quantity`}
                            type="number"
                            min="1"
                            max={f.maxQuantity}
                            value={quantity}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              if (Number.isInteger(n) && n >= 1 && n <= f.maxQuantity)
                                select(f.id, n);
                            }}
                          />
                          <button
                            aria-label={`Increase ${f.name}`}
                            disabled={quantity >= f.maxQuantity}
                            onClick={() => select(f.id, quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
          <div className="suggest-panel">
            <div>
              <h3>A little help choosing?</h3>
              <p>Tell us what you’re trying to accomplish.</p>
            </div>
            <label className="sr-only" htmlFor="goal">
              Your goals
            </label>
            <input
              id="goal"
              placeholder="e.g. Manage a team and track project performance"
              maxLength={500}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
            <button className="button secondary" onClick={suggest} disabled={busy}>
              ✧ Suggest Features
            </button>
            <small>
              Rule-based suggestions · AI connection planned · nothing added automatically
            </small>
            {suggestions && (
              <div className="suggestions" aria-live="polite">
                {suggestions.length === 0 ? (
                  <p>No matching suggestions yet. Try describing a different goal.</p>
                ) : (
                  suggestions.map((s) => (
                    <div key={s.featureId}>
                      <strong>{s.name}</strong>
                      <p>{s.reason}</p>
                      <button
                        className="text-button"
                        disabled={(selections[s.featureId] ?? 0) > 0}
                        onClick={() => select(s.featureId, 1)}
                      >
                        {selections[s.featureId] ? 'Added' : 'Add to my package +'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
        <aside className="package-summary">
          <span className="summary-icon" aria-hidden="true">
            ▧
          </span>
          <h3>Your package</h3>
          <p className="muted">Exactly what you need. Nothing extra.</p>
          <ul className="summary-items">
            {summary.items.map((i) => (
              <li key={i.featureId}>
                <span>
                  {i.quantity > 1 ? `${i.quantity} × ` : ''}
                  {i.name}
                  <small>{i.type === 'one_time' ? 'One time' : 'Monthly'}</small>
                </span>
                <strong>{formatMoney(i.totalCents)}</strong>
              </li>
            ))}
          </ul>
          {!summary.items.length && (
            <p className="muted">Select a feature to start your package.</p>
          )}
          <div className="total">
            <span>Monthly total</span>
            <strong>
              {formatMoney(summary.monthlyCents)}
              <small>/ month</small>
            </strong>
          </div>
          <div className="once-total">
            <span>One-time total</span>
            <strong>{formatMoney(summary.oneTimeCents)}</strong>
          </div>
          <p className="due-now">
            First payment <strong>{formatMoney(summary.dueNowCents)}</strong>
          </p>
          <button
            className="button primary full"
            disabled={busy || !features.length || !!captured}
            onClick={proceed}
          >
            {busy ? 'Working…' : captured ? 'Package saved ✓' : 'Continue'}{' '}
            <span aria-hidden="true">→</span>
          </button>
          <p className="fine-print">
            Your package is saved before checkout. No payment is taken here.
          </p>
          {error && (
            <div className="error" role="alert">
              {error}
              {!sessionId && !preview && (
                <button className="text-button" onClick={() => setSessionAttempt((n) => n + 1)}>
                  Retry session
                </button>
              )}
            </div>
          )}
          {captured && (
            <div className="success" role="status">
              <strong>Package captured.</strong>
              <p>Reference: {captured.id}</p>
              <button
                className="text-button"
                onClick={() => {
                  const blob = new Blob(
                    [
                      JSON.stringify(
                        { configurationId: captured.id, projectId: project.id, ...summary },
                        null,
                        2,
                      ),
                    ],
                    { type: 'application/json' },
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'my-package.json';
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                Download package JSON
              </button>
              {captured.checkoutUrl && (
                <a
                  className="button primary full"
                  href={(() => {
                    const url = new URL(captured.checkoutUrl);
                    url.searchParams.set('configurationId', captured.id);
                    url.searchParams.set('projectId', project.id);
                    return url.href;
                  })()}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Continue to checkout ↗
                </a>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
