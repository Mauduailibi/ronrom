/** Servidor local da API (pnpm dev). O Vite encaminha /api para cá. */
import { serve } from '@hono/node-server';
import { app } from './app.js';

const port = Number(process.env.API_PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => console.log(`API do Ronrom em http://localhost:${port}/api`));
