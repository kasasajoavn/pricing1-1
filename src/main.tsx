import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const plans = [
  { name: 'Starter', description: 'For a new idea finding its feet.', monthly: 12, yearly: 9, features: ['3 projects', '1 team member', 'Basic analytics', 'Community support'] },
  { name: 'Pro', description: 'For teams ready to build momentum.', monthly: 29, yearly: 23, features: ['Unlimited projects', '10 team members', 'Advanced analytics', 'Priority support'], featured: true },
  { name: 'Business', description: 'For bigger ambitions and growing teams.', monthly: 79, yearly: 63, features: ['Everything in Pro', 'Unlimited team members', 'Custom reporting', 'Dedicated support'] },
];

function App() {
  const [annual, setAnnual] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  return <>
    <header className="nav"><a className="brand" href="#">✳ forma</a><a href="#plans">Explore plans <span aria-hidden="true">↗</span></a></header>
    <main>
      <section className="intro" aria-labelledby="title">
        <p className="eyebrow">ROOM TO GROW</p>
        <h1 id="title">Big ideas.<br /><span>Simple pricing.</span></h1>
        <p className="subtitle">Start small, make something great, and grow at your own pace.<br />A plan for every chapter of your journey.</p>
        <div className="billing" aria-label="Billing period">
          <button aria-pressed={!annual} className={!annual ? 'active' : ''} onClick={() => setAnnual(false)}>Monthly</button>
          <button aria-pressed={annual} className={annual ? 'active' : ''} onClick={() => setAnnual(true)}>Yearly <span>Save up to 25%</span></button>
        </div>
      </section>
      <section id="plans" className="plans" aria-label="Pricing plans">
        {plans.map(plan => <article className={`card ${plan.featured ? 'featured' : ''}`} key={plan.name}>
          {plan.featured && <div className="badge">THE CROWD FAVORITE</div>}
          <h2>{plan.name}</h2><p className="description">{plan.description}</p>
          <p className="price">${annual ? plan.yearly : plan.monthly}<span> / month</span></p>
          <p className="billing-note">{annual ? `Billed yearly at $${plan.yearly * 12}` : 'Billed monthly'}</p>
          <button className="choose" onClick={() => setSelected(plan.name)}>Choose {plan.name} <span aria-hidden="true">↗</span></button>
          <div className="divider" /><p className="includes">WHAT’S INCLUDED</p>
          <ul>{plan.features.map(feature => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul>
        </article>)}
      </section>
      <p className="reassurance">Clear pricing. No hidden fees. Change plans whenever you need.</p>
      <section className="faq" aria-labelledby="faq-title"><h2 id="faq-title">A few things you might be wondering.</h2>
        <details><summary>Can I change my plan later?</summary><p>Yes. This starter is designed to support flexible plans. Connect your billing provider to implement upgrades and downgrades.</p></details>
        <details><summary>Is this connected to a payment service?</summary><p>This is a demo pricing page. No payment is collected and no account is created when you select a plan.</p></details>
      </section>
      {selected && <div className="selection" role="status"><strong>{selected} selected.</strong> This is a demo; checkout is not connected.<button onClick={() => setSelected(null)} aria-label="Dismiss selection">×</button></div>}
    </main>
    <footer><span className="brand">✳ forma</span><span>A little structure for your next big idea.</span><span>Demo pricing · USD</span></footer>
  </>;
}

createRoot(document.getElementById('root')!).render(<App />);
