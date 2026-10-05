/**
 * Função serverless da Vercel. O vercel.json reescreve /api/* para cá
 * e o Hono roteia pelo caminho original.
 */
import { app } from '../server/app.js';

const handler = (req: Request) => app.fetch(req);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
