/* Datas, escapes e pequenos utilitários. */
export const $ = s => document.querySelector(s);
export const uid = () => Math.random().toString(36).slice(2, 10);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const parse = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
export const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate()+n); return x; };
export const startOfWeek = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(x, -((x.getDay()+6)%7)); };
export const monthKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
export const quarterKey = d => `${d.getFullYear()}-T${Math.floor(d.getMonth()/3)+1}`;
export const daysInMonth = d => new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const pctOf = (done, total) => total ? Math.round(done / total * 100) : 0;

export const startDay = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
