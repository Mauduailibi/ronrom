import './styles/tokens.css';
import './auth/auth.css';
import { catSVG } from './shared/cats.js';
import { applySavedPalette } from './lib/palette.js';
import { authClient, authMessage } from './lib/auth-client.js';

applySavedPalette();
document.querySelectorAll('[data-cat]').forEach(el => el.innerHTML = catSVG(el.dataset.cat, ''));

const $ = s => document.querySelector(s);
const msg = $('#msg');
const show = (text, kind = 'error') => { msg.textContent = text; msg.className = `msg ${kind}`; msg.hidden = !text; };
const busy = (form, on) => { const b = form.querySelector('button[type=submit]'); b.disabled = on; b.dataset.label ??= b.textContent; b.textContent = on ? 'Um instante…' : b.dataset.label; };

/* ---------- abas ---------- */
function tab(name){
  document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  document.querySelectorAll('[data-panel]').forEach(p => p.hidden = p.dataset.panel !== name);
  show('');
}
document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => tab(b.dataset.tab)));

/* ---------- parâmetros da URL (?aba=convite, ?convite=CODIGO, ?error=...) ---------- */
const params = new URLSearchParams(location.search);
if (params.get('aba') === 'convite' || params.get('convite')) tab('convite');
if (params.get('convite')) $('#f-code').code.value = params.get('convite');
const err = params.get('error');
if (err){
  const known = {
    invite_required: 'Essa conta do Google ainda não está cadastrada. Se você recebeu um convite, use a aba Tenho um convite.',
    invite_invalid: 'Esse convite não é mais válido. Peça um novo código.',
  };
  show(known[err] || 'Não foi possível entrar com o Google. Tente de novo.');
  history.replaceState(null, '', location.pathname);
}

/* ---------- já logada? vai direto ---------- */
authClient.getSession().then(({ data }) => { if (data?.user) location.replace('/app'); }).catch(() => {});

/* ---------- Google (só aparece se estiver configurado no servidor) ---------- */
const G = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>';
fetch('/api/config').then(r => r.json()).then(cfg => {
  if (!cfg.google) return;
  document.querySelectorAll('[data-google]').forEach(b => {
    b.hidden = false;
    b.innerHTML = `${G}<span>${b.closest('#signup') ? 'Criar conta com Google' : 'Entrar com Google'}</span>`;
    b.addEventListener('click', async () => {
      b.disabled = true;
      const { error } = await authClient.signIn.social({ provider: 'google', callbackURL: '/app', newUserCallbackURL: '/app', errorCallbackURL: '/entrar' });
      if (error){ b.disabled = false; show(authMessage(error)); }
    });
  });
  document.querySelectorAll('[data-google-or]').forEach(el => el.hidden = false);
}).catch(() => {});

/* ---------- entrar com e-mail ---------- */
$('#f-login').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.currentTarget; busy(f, true); show('');
  const { error } = await authClient.signIn.email({ email: f.email.value.trim(), password: f.password.value });
  if (error){ busy(f, false); show(authMessage(error)); return; }
  location.href = '/app';
});

/* ---------- convite: passo 1 ---------- */
$('#f-code').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.currentTarget; busy(f, true); show('');
  try {
    const r = await fetch('/api/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: f.code.value }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Código inválido.');
    f.hidden = true; $('#signup').hidden = false; $('#f-signup').name.focus();
  } catch(err){ show(err.message); }
  busy(f, false);
});

/* ---------- convite: passo 2, conta com e-mail ---------- */
$('#f-signup').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.currentTarget; busy(f, true); show('');
  const { error } = await authClient.signUp.email({ name: f.name.value.trim(), email: f.email.value.trim(), password: f.password.value });
  if (error){ busy(f, false); show(authMessage(error)); return; }
  location.href = '/app';
});
