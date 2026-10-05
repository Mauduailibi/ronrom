/** Landing e login usam o último tema escolhido no planner. */
export function applySavedPalette(){
  try { const p = localStorage.getItem('ronrom-palette'); if (p) document.documentElement.setAttribute('data-palette', p); } catch(e){}
}
