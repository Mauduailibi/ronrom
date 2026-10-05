import { createHmac, timingSafeEqual } from 'node:crypto';
import { and, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import { db, schema } from './db/index.js';

export const INVITE_COOKIE = 'ronrom_invite';
const TTL_SECONDS = 30 * 60;

const secret = () => {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error('BETTER_AUTH_SECRET não definida.');
  return s;
};

/** Deixa o código no formato canônico: maiúsculas, sem espaços. */
export const normalizeCode = (raw: unknown) => String(raw ?? '').toUpperCase().replace(/\s+/g, '').slice(0, 64);

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

/** Cookie assinado que prova "esta pessoa digitou um código válido há pouco". */
export function makeInviteToken(code: string) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const payload = `${Buffer.from(code).toString('base64url')}.${exp}`;
  return { value: `${payload}.${sign(payload)}`, maxAge: TTL_SECONDS };
}

export function readInviteToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [codeB64, exp, sig] = parts;
  const expected = sign(`${codeB64}.${exp}`);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return Buffer.from(codeB64, 'base64url').toString();
}

const usable = (code: string) => and(
  eq(schema.activationCode.code, code),
  lt(schema.activationCode.uses, schema.activationCode.maxUses),
  or(isNull(schema.activationCode.expiresAt), gt(schema.activationCode.expiresAt, new Date())),
);

/** Confere sem gastar o código. */
export async function isCodeUsable(code: string) {
  if (!code) return false;
  const rows = await db.select({ code: schema.activationCode.code }).from(schema.activationCode).where(usable(code)).limit(1);
  return rows.length > 0;
}

/** Gasta um uso de forma atômica. Retorna false se o código esgotou ou expirou. */
export async function consumeCode(code: string) {
  const rows = await db.update(schema.activationCode)
    .set({ uses: sql`${schema.activationCode.uses} + 1` })
    .where(usable(code))
    .returning({ code: schema.activationCode.code });
  return rows.length > 0;
}

export async function recordRedemption(code: string, userId: string) {
  await db.insert(schema.activationRedemption).values({ code, userId });
}
