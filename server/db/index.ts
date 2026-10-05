import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL não definida. Copie .env.example para .env e preencha.');

/**
 * Pool pequeno: cada instância serverless da Vercel abre poucas conexões.
 * Use a connection string "pooled" do Neon (host com -pooler).
 */
const globalForPool = globalThis as unknown as { __ronromPool?: pg.Pool };
export const pool = globalForPool.__ronromPool ?? new pg.Pool({
  connectionString: url,
  max: 3,
  idleTimeoutMillis: 10_000,
  ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: true },
});
globalForPool.__ronromPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
