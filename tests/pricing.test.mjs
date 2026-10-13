import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePackage } from '../shared/pricing.mjs';
const feature = (id, type, priceCents, extra = {}) => ({
  id,
  name: id,
  description: '',
  audience: '',
  category: 'Core',
  active: true,
  required: false,
  maxQuantity: 10,
  type,
  priceCents,
  ...extra,
});
const catalog = [
  feature('core', 'recurring', 1000, { required: true }),
  feature('analytics', 'recurring', 500),
  feature('ai', 'recurring', 800),
  feature('seats', 'quantity', 300),
  feature('setup', 'one_time', 2500),
  feature('hidden', 'recurring', 9999, { active: false }),
];
test('vision example: core + analytics + AI + three seats costs $32 monthly', () => {
  const result = calculatePackage(catalog, { analytics: 1, ai: 1, seats: 3 });
  assert.equal(result.monthlyCents, 3200);
  assert.equal(result.oneTimeCents, 0);
  assert.equal(result.items.length, 4);
});
test('one-time prices stay separate from monthly totals', () => {
  const result = calculatePackage(catalog, { analytics: 1, seats: 3, setup: 1, hidden: 1 });
  assert.equal(result.monthlyCents, 2400);
  assert.equal(result.oneTimeCents, 2500);
  assert.equal(result.dueNowCents, 4900);
  assert.ok(!result.items.some((i) => i.featureId === 'hidden'));
});
test('required features are included and cannot be removed', () => {
  assert.equal(calculatePackage(catalog, {}).monthlyCents, 1000);
  assert.throws(() => calculatePackage(catalog, { core: 0 }), /required/);
});
test('quantity bounds and fixed feature quantities are enforced', () => {
  for (const seats of [-1, 1.5, 11, NaN, Infinity])
    assert.throws(() => calculatePackage(catalog, { seats }));
  assert.throws(() => calculatePackage(catalog, { analytics: 2 }));
  assert.equal(calculatePackage(catalog, { seats: 10 }).monthlyCents, 4000);
});
test('cent-based calculation avoids fractional currency drift', () => {
  const result = calculatePackage([feature('tiny', 'quantity', 10)], { tiny: 3 });
  assert.equal(result.monthlyCents, 30);
});
