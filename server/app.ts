import { Hono, type MiddlewareHandler } from 'hono';
import { setCookie } from 'hono/cookie';
import { and, eq } from 'drizzle-orm';
import { auth, googleEnabled } from './auth.js';
import { db, schema } from './db/index.js';
import { INVITE_COOKIE, isCodeUsable, makeInviteToken, normalizeCode } from './invite.js';

type Env = { Variables: { userId: string } };
const MAX_STATE_BYTES = 4_000_000;

export const app = new Hono<Env>().basePath('/api');

app.get('/health', c => c.json({ ok: true }));

/* O front pergunta se o botão do Google deve aparecer. */
app.get('/config', c => c.json({ google: googleEnabled }));

/* Better Auth cuida de /api/auth/* (e-mail, senha, Google, sessão, sair). */
app.on(['GET', 'POST'], '/auth/*', c => auth.handler(c.req.raw));

/* Passo 1 do cadastro: conferir o código e guardar a prova num cookie assinado. */
app.post('/invite', async c => {
  const body = await c.req.json().catch(() => ({})) as { code?: string };
  const code = normalizeCode(body.code);
  await new Promise(r => setTimeout(r, 300)); // desacelera tentativas em série
  if (!(await isCodeUsable(code))) return c.json({ ok: false, error: 'Código inválido, esgotado ou expirado.' }, 400);
  const { value, maxAge } = makeInviteToken(code);
  setCookie(c, INVITE_COOKIE, value, {
    httpOnly: true, sameSite: 'Lax', path: '/', maxAge,
    secure: new URL(c.req.url).protocol === 'https:' || c.req.header('x-forwarded-proto') === 'https',
  });
  return c.json({ ok: true });
});

/* Tudo daqui para baixo exige sessão. */
const requireUser: MiddlewareHandler<Env> = async (c, next) => {
  const s = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!s) return c.json({ error: 'unauthorized' }, 401);
  c.set('userId', s.user.id);
  await next();
};

app.get('/state', requireUser, async c => {
  const [row] = await db.select().from(schema.plannerState).where(eq(schema.plannerState.userId, c.get('userId'))).limit(1);
  c.header('Cache-Control', 'no-store');
  return c.json(row ? { data: row.data, version: row.version } : { data: null, version: 0 });
});

/**
 * Grava o planner inteiro. O cliente manda a versão em que se baseou;
 * se outro aparelho gravou antes, devolvemos 409 com a versão atual.
 */
app.put('/state', requireUser, async c => {
  const raw = await c.req.text();
  if (raw.length > MAX_STATE_BYTES) return c.json({ error: 'Dados grandes demais.' }, 413);
  let body: { data?: unknown; baseVersion?: number };
  try { body = JSON.parse(raw); } catch { return c.json({ error: 'JSON inválido.' }, 400); }
  const data = body.data, base = Number(body.baseVersion ?? 0);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return c.json({ error: 'Formato inválido.' }, 400);
  const userId = c.get('userId'), t = schema.plannerState;

  const rows = base === 0
    ? await db.insert(t).values({ userId, data, version: 1 }).onConflictDoNothing().returning({ version: t.version })
    : await db.update(t).set({ data, version: base + 1, updatedAt: new Date() })
        .where(and(eq(t.userId, userId), eq(t.version, base))).returning({ version: t.version });

  if (rows.length) return c.json({ ok: true, version: rows[0].version });
  const [cur] = await db.select().from(t).where(eq(t.userId, userId)).limit(1);
  return c.json({ error: 'conflict', data: cur?.data ?? null, version: cur?.version ?? 0 }, 409);
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Erro interno.' }, 500);
});

export default app;
