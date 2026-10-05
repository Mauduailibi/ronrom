import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db, schema } from './db/index.js';
import { INVITE_COOKIE, consumeCode, readInviteToken, recordRedemption } from './invite.js';

const google = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, prompt: 'select_account' as const } }
  : {};

export const googleEnabled = Boolean(google.google);

export const auth = betterAuth({
  appName: 'Ronrom',
  baseURL: process.env.BETTER_AUTH_URL,
  basePath: '/api/auth',
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: (process.env.TRUSTED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean),
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  emailAndPassword: { enabled: true, autoSignIn: true, minPasswordLength: 8 },
  socialProviders: google,
  account: { accountLinking: { enabled: true, trustedProviders: ['google'] } },
  session: { expiresIn: 60 * 60 * 24 * 60, updateAge: 60 * 60 * 24 },
  user: {
    /**
     * Portão do cadastro. Toda conta nova (e-mail ou Google) precisa ter
     * passado antes por POST /api/invite com um código válido, que deixa
     * um cookie assinado. Aqui o código é conferido e gasta um uso.
     * Logins de contas que já existem não passam por aqui.
     */
    validateUserInfo: async ({ source }, ctx) => {
      if (source.action !== 'create-user') return;
      const code = readInviteToken(ctx?.getCookie?.(INVITE_COOKIE));
      if (!code) return { error: 'invite_required', errorDescription: 'Para criar uma conta é preciso um código de convite.' };
      if (!(await consumeCode(code))) return { error: 'invite_invalid', errorDescription: 'Esse código de convite não é mais válido.' };
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (created, ctx) => {
          const code = readInviteToken(ctx?.getCookie?.(INVITE_COOKIE));
          if (code) await recordRedemption(code, created.id).catch(() => {});
        },
      },
    },
  },
});
