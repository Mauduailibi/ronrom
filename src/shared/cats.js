/* Gatos desenhados em SVG, coloridos pela pelagem. Usados no planner e na landing. */
export const LOOKS = {
  siames:   {label:'Siamês', body:'#F2E6D2', point:'#5B4033', eye:'#7DB3E6'},
  cinza:    {label:'Cinza rajado', body:'#A9ADB1', stripes:'#6B7075', eye:'#C3C76A'},
  manteiga: {label:'Cor de manteiga', body:'#F1D79A', stripes:'#DDB66A', eye:'closed'},
  laranja:  {label:'Laranja rajado', body:'#E8A45C', stripes:'#C27D38', eye:'#A5C35C'},
  caramelo: {label:'Caramelo', body:'#D6A66A', eye:'#C9A13E'},
  preto:    {label:'Preto', body:'#3A3A3C', eye:'#E6C24E'},
  branco:   {label:'Branco', body:'#F7F4EE', eye:'#8DBAE2'},
};

/* Ilustração original de gato, colorida pela pelagem */
export function catSVG(look, cls='cat-art'){
  const L = LOOKS[look] || LOOKS.manteiga, B = L.body, P = L.point || B, st = L.stripes;
  const ol = look === 'branco' ? ' stroke="#D9D3C7" stroke-width="1.5"' : '';
  const eyes = L.eye === 'closed'
    ? '<path d="M47.5 49q4.5 3.5 9 0M63.5 49q4.5 3.5 9 0" stroke="#6A563F" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
    : `<ellipse cx="52" cy="48" rx="3.8" ry="4.4" fill="${L.eye}"/><ellipse cx="68" cy="48" rx="3.8" ry="4.4" fill="${L.eye}"/><ellipse cx="52" cy="48.6" rx="1.3" ry="3.1" fill="#26201C"/><ellipse cx="68" cy="48.6" rx="1.3" ry="3.1" fill="#26201C"/>`;
  return `<svg class="${cls}" viewBox="0 0 120 120" aria-hidden="true">
    <path d="M86 101c18-2 25-18 14-31" stroke="${P}" stroke-width="9" fill="none" stroke-linecap="round"/>
    <ellipse cx="60" cy="88" rx="29" ry="24" fill="${B}"${ol}/>
    ${st ? `<path d="M37 82q6 2.5 9.5-2M35.5 92.5q7 2.5 10.5-2M83 82q-6 2.5-9.5-2M84.5 92.5q-7 2.5-10.5-2" stroke="${st}" stroke-width="3" fill="none" stroke-linecap="round"/>` : ''}
    <path d="M38 40 41 14 57 30z" fill="${P}"${ol}/><path d="M82 40 79 14 63 30z" fill="${P}"${ol}/>
    <path d="M42.5 32.5 43.5 21 51 28.5z" fill="#EFB3AB" opacity=".75"/><path d="M77.5 32.5 76.5 21 69 28.5z" fill="#EFB3AB" opacity=".75"/>
    <circle cx="60" cy="48" r="23" fill="${B}"${ol}/>
    ${L.point ? `<ellipse cx="60" cy="54.5" rx="14.5" ry="12.5" fill="${P}" opacity=".88"/>` : ''}
    ${st ? `<path d="M54 28v6.5M60 26.8v7.5M66 28v6.5" stroke="${st}" stroke-width="2.6" stroke-linecap="round"/>` : ''}
    ${eyes}
    <path d="M57.4 55.2h5.2L60 58.2z" fill="#E39696"/>
    <path d="M60 58.2q-3 4-6.2 2M60 58.2q3 4 6.2 2" stroke="${look === 'preto' ? '#8A8A8A' : '#7A665A'}" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <ellipse cx="49.5" cy="108.5" rx="7.5" ry="4.6" fill="${P}"${ol}/><ellipse cx="70.5" cy="108.5" rx="7.5" ry="4.6" fill="${P}"${ol}/>
  </svg>`;
}
