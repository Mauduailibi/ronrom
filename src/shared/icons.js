/* Ícones em SVG (traço fino) e a marca do Ronrom. */
export const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
export const I = {
  home: svg('<path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1h-4.5v-6h-6v6H4.5a1 1 0 0 1-1-1z"/>'),
  week: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  goals: svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
  tasks: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'),
  quarter: svg('<rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.8"/>'),
  projects: svg('<path d="M3.5 7.5a2 2 0 0 1 2-2h3.8l2 2h7.2a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>'),
  habits: svg('<path d="M12 20.5c-4.5-1.6-7-5-7-9.3V5.5c3.4 0 5.6 1 7 3 1.4-2 3.6-3 7-3v5.7c0 4.3-2.5 7.7-7 9.3z"/><path d="M12 8.5v12"/>'),
  trip: svg('<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z"/>'),
  look: svg('<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1-.3-.3-.4-.7-.4-1 0-.8.7-1.5 1.5-1.5h1.8a4.5 4.5 0 0 0 4.5-4.5c0-4-3.8-7.5-8.5-7.5z"/><circle cx="7.5" cy="11" r=".9" fill="currentColor"/><circle cx="10" cy="7.3" r=".9" fill="currentColor"/><circle cx="14.5" cy="7.3" r=".9" fill="currentColor"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  edit: svg('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  trash: svg('<path d="M4.5 7h15M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4.5h6V7"/>'),
  left: svg('<path d="m14.5 6-6 6 6 6"/>'),
  right: svg('<path d="m9.5 6 6 6-6 6"/>'),
  chevDown: svg('<path d="m6 9.5 6 6 6-6"/>'),
  paw: svg('<circle cx="6.5" cy="10.5" r="1.9"/><circle cx="10" cy="6.3" r="1.9"/><circle cx="14" cy="6.3" r="1.9"/><circle cx="17.5" cy="10.5" r="1.9"/><path d="M12 12.2c-3 0-5.5 3-5.5 5.1 0 1.6 1.3 2.3 2.8 2.3 1 0 1.7-.5 2.7-.5s1.7.5 2.7.5c1.5 0 2.8-.7 2.8-2.3 0-2.1-2.5-5.1-5.5-5.1z"/>'),
  globe: svg('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.4 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.4-3.5-8.5s1.1-6.1 3.5-8.5z"/>'),
  star: svg('<path d="m12 3.8 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-3.9 5.6-.8z" fill="currentColor"/>'),
};
export const BRAND = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5.5 14 6.6 4.5l6.9 5.5h5l6.9-5.5L26.5 14c.7 1.6 1 3.2 1 5 0 6-5.4 10.5-11.5 10.5S4.5 25 4.5 19c0-1.8.3-3.4 1-5z" fill="currentColor"/><ellipse cx="12" cy="18.5" rx="1.6" ry="2.1" fill="var(--sidebar)"/><ellipse cx="20" cy="18.5" rx="1.6" ry="2.1" fill="var(--sidebar)"/></svg>`;
