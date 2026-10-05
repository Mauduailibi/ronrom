import { createAuthClient } from 'better-auth/client';

/** Cliente do Better Auth. A API fica no mesmo domínio, em /api/auth. */
export const authClient = createAuthClient({ baseURL: window.location.origin, basePath: '/api/auth' });

/** Traduz os códigos de erro mais comuns. */
export function authMessage(error){
  const map = {
    INVALID_EMAIL_OR_PASSWORD: 'E-mail ou senha incorretos.',
    USER_ALREADY_EXISTS: 'Já existe uma conta com esse e-mail. Use a aba Entrar.',
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Já existe uma conta com esse e-mail. Use a aba Entrar.',
    PASSWORD_TOO_SHORT: 'A senha precisa ter pelo menos 8 caracteres.',
    INVALID_EMAIL: 'Esse e-mail não parece válido.',
    invite_required: 'Para criar uma conta é preciso um código de convite.',
    invite_invalid: 'Esse código de convite não é mais válido.',
  };
  return map[error?.code] || error?.message || 'Algo deu errado. Tente de novo.';
}
