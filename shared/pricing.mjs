/** @typedef {{id:string,name:string,description:string,audience:string,priceCents:number,type:'recurring'|'one_time'|'quantity',category:string,required:boolean,active:boolean,maxQuantity:number}} Feature */
/** Calculate from the current catalog, never from customer-supplied prices. */
export function calculatePackage(
  /** @type {Feature[]} */ features,
  /** @type {Record<string,number>} */ selections,
) {
  const items = features
    .filter((f) => f.active)
    .flatMap((f) => {
      const requested = selections[f.id];
      const quantity = f.required ? (requested ?? 1) : (requested ?? 0);
      if (
        !Number.isSafeInteger(quantity) ||
        quantity < 0 ||
        quantity > (f.type === 'quantity' ? f.maxQuantity : 1)
      )
        throw new Error(`Invalid quantity for ${f.name}`);
      if (f.required && quantity < 1) throw new Error(`${f.name} is required`);
      if (!quantity) return [];
      return [
        {
          featureId: f.id,
          name: f.name,
          type: f.type,
          quantity,
          unitPriceCents: f.priceCents,
          totalCents: f.priceCents * quantity,
        },
      ];
    });
  const monthlyCents = items
    .filter((i) => i.type !== 'one_time')
    .reduce((n, i) => n + i.totalCents, 0);
  const oneTimeCents = items
    .filter((i) => i.type === 'one_time')
    .reduce((n, i) => n + i.totalCents, 0);
  return {
    items,
    monthlyCents,
    oneTimeCents,
    dueNowCents: monthlyCents + oneTimeCents,
    currency: 'USD',
  };
}
export function formatMoney(/** @type {number} */ cents) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
