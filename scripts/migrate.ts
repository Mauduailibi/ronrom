import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from '../server/db/index.js';

await migrate(db, { migrationsFolder: './drizzle' });
console.log('Banco atualizado.');
await pool.end();
