import { createDb } from '../tests/helpers/pg';

const db = await createDb();
const q = async (label: string, sql: string) => {
  const r = await db.query(sql);
  console.log(label, JSON.stringify(r.rows).slice(0, 300));
};

await q('plans:', 'select code, price_irr, listing_limit from public.subscription_plans order by code');
await q('cards:', 'select count(*) from public.listing_cards');
await q('public visible:', `select count(*) from public.listing_cards c where public.is_listing_public(c.id)`);
await q('search all:', `select slug from public.search_listings('{}'::jsonb)`);
await q('search kish:', `select slug from public.search_listings('{"kishOnly":true}'::jsonb)`);
await db.close();
