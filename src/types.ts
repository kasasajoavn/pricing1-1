export type Feature = {
  id: string;
  name: string;
  description: string;
  audience: string;
  priceCents: number;
  type: 'recurring' | 'one_time' | 'quantity';
  category: string;
  required: boolean;
  active: boolean;
  maxQuantity: number;
};
export type Project = {
  id: string;
  name: string;
  description: string;
  categories: string[];
  checkoutUrl: string;
  features: Feature[];
};
export type User = { id: string; email: string };
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}
