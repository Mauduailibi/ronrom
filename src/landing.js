import './styles/tokens.css';
import './landing/landing.css';
import { catSVG } from './shared/cats.js';
import { I } from './shared/icons.js';
import { applySavedPalette } from './lib/palette.js';
import { authClient } from './lib/auth-client.js';

applySavedPalette();

const BRAND = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5.5 14 6.6 4.5l6.9 5.5h5l6.9-5.5L26.5 14c.7 1.6 1 3.2 1 5 0 6-5.4 10.5-11.5 10.5S4.5 25 4.5 19c0-1.8.3-3.4 1-5z" fill="currentColor"/><ellipse cx="12" cy="18.5" rx="1.6" ry="2.1" fill="var(--bg)"/><ellipse cx="20" cy="18.5" rx="1.6" ry="2.1" fill="var(--bg)"/></svg>';
document.querySelectorAll('[data-brand]').forEach(el => el.innerHTML = BRAND);
document.querySelectorAll('[data-cat]').forEach(el => el.innerHTML = catSVG(el.dataset.cat, ''));
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = I[el.dataset.icon] || '');
document.querySelectorAll('[data-paw]').forEach(el => el.innerHTML = I.paw);
const paws = document.querySelector('.paws');
if (paws) paws.innerHTML = Array.from({ length: 7 }, (_, i) => `<span style="--i:${i}">${I.paw}</span>`).join('');

/* Quem já está logada vai direto para o planner. */
authClient.getSession().then(({ data }) => {
  if (!data?.user) return;
  document.querySelectorAll('[data-cta]').forEach(a => { a.href = '/app'; a.textContent = 'Abrir meu planner'; });
}).catch(() => {});
