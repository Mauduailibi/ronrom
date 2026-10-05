/**
 * Códigos de convite.
 *   pnpm code:new                                  um código de 1 uso
 *   pnpm code:new --uses 3 --note "família" --days 30
 *   pnpm code:list
 */
import { randomInt } from 'node:crypto';
import { desc } from 'drizzle-orm';
import { db, pool, schema } from '../server/db/index.js';

const [cmd, ...rest] = process.argv.slice(2);
const arg = (name: string) => { const i = rest.indexOf(`--${name}`); return i > -1 ? rest[i + 1] : undefined; };
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I
const block = () => Array.from({ length: 4 }, () => ALPHA[randomInt(ALPHA.length)]).join('');

if (cmd === 'new') {
  const code = (arg('code') ?? `MIAU-${block()}-${block()}`).toUpperCase();
  const days = arg('days');
  await db.insert(schema.activationCode).values({
    code, note: arg('note') ?? null, maxUses: Number(arg('uses') ?? 1),
    expiresAt: days ? new Date(Date.now() + Number(days) * 864e5) : null,
  });
  console.log(`\n  Código criado: ${code}\n`);
} else if (cmd === 'list') {
  const rows = await db.select().from(schema.activationCode).orderBy(desc(schema.activationCode.createdAt));
  console.table(rows.map(r => ({ código: r.code, usos: `${r.uses}/${r.maxUses}`, nota: r.note ?? '', expira: r.expiresAt?.toLocaleDateString('pt-BR') ?? 'nunca' })));
} else {
  console.log('Use: pnpm code:new [--uses N] [--note texto] [--days N]  |  pnpm code:list');
}
await pool.end();
