import './styles/tokens.css';
import './convite/convite.css';
import { catSVG } from './shared/cats.js';
import { I } from './shared/icons.js';

/* =========================================================
   ✏️  A CARTA. Edite à vontade: cada item do array é um parágrafo.
   O link fica assim:  /convite?para=Julia&de=Maurício#CODIGO
   (o código vai depois do #, então não aparece em logs de servidor)
   ========================================================= */
const CARTA = {
  para: 'Julia',
  de: 'Mauricio',
  paragrafos: [
    'Fiz um cantinho só seu para organizar a vida. Ele se chama Ronrom, porque tudo fica mais leve com um ronronar por perto. Tem tema da Phoebe, do Peleguinho e um em homenagem ao Manteguinha, do jeitinho que ele merecia.',
    'Espero que ele te ajude nos dias corridos e te lembre de comemorar cada passo, até os pequenininhos.',
  ],
  ps: 'P.S.: a Phoebe e o Peleguinho revisaram tudo. A Phoebe pediu para avisar que deitou em cima do teclado duas vezes.',
};

const q = new URLSearchParams(location.search);
const para = q.get('para') || CARTA.para;
const de = q.get('de') || CARTA.de;
const code = decodeURIComponent(location.hash.slice(1)).trim().toUpperCase();

const BRAND = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5.5 14 6.6 4.5l6.9 5.5h5l6.9-5.5L26.5 14c.7 1.6 1 3.2 1 5 0 6-5.4 10.5-11.5 10.5S4.5 25 4.5 19c0-1.8.3-3.4 1-5z" fill="currentColor"/><ellipse cx="12" cy="18.5" rx="1.6" ry="2.1" fill="#7E3B33"/><ellipse cx="20" cy="18.5" rx="1.6" ry="2.1" fill="#7E3B33"/></svg>';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

document.querySelectorAll('[data-para]').forEach(el => el.textContent = para);
document.querySelectorAll('[data-de]').forEach(el => el.textContent = de);
document.querySelectorAll('[data-brand]').forEach(el => el.innerHTML = BRAND);
document.querySelectorAll('[data-paw]').forEach(el => el.innerHTML = I.paw);
document.querySelectorAll('[data-cat]').forEach(el => el.innerHTML = catSVG(el.dataset.cat, ''));
document.querySelector('[data-hoje]').textContent = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
document.getElementById('letter-body').innerHTML = `<p>${esc(para)},</p>` + CARTA.paragrafos.map(p => `<p>${esc(p)}</p>`).join('');
document.getElementById('ps').textContent = CARTA.ps;
document.title = `${para}, tem uma cartinha para você 💌`;

/* patinhas espalhadas no fundo */
document.querySelector('.paws-bg').innerHTML = Array.from({ length: 14 }, (_, i) =>
  `<span style="left:${(i * 37) % 100}%;top:${(i * 53) % 100}%;transform:rotate(${(i * 47) % 360}deg)">${I.paw}</span>`).join('');

/* vale-presente */
const codeEl = document.getElementById('code'), use = document.getElementById('use'), copy = document.getElementById('copy');
if (code){
  codeEl.textContent = code;
  use.href = `/entrar?convite=${encodeURIComponent(code)}`;
} else {
  codeEl.textContent = 'peça o código';
  copy.hidden = true;
}
copy.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(code); }
  catch(e){ const r = document.createRange(); r.selectNodeContents(codeEl); getSelection().removeAllRanges(); getSelection().addRange(r); document.execCommand('copy'); }
  copy.textContent = 'Copiado!'; setTimeout(() => copy.textContent = 'Copiar', 1600);
});

/* abrir o envelope */
const env = document.getElementById('envelope');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
env.addEventListener('click', () => {
  if (env.classList.contains('open')) return;
  env.classList.add('open');
  setTimeout(() => {
    document.getElementById('stage').classList.add('gone');
    const r = document.getElementById('reading');
    r.hidden = false;
    requestAnimationFrame(() => r.classList.add('in'));
    window.scrollTo({ top: 0 });
  }, reduce ? 50 : 1500);
});
