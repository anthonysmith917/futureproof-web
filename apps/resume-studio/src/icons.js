// Consistent, local SVG icons: no icon font, emoji, or network dependency.
const shapes={
 search:'<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
 bookmark:'<path d="M6 3h12v18l-6-4-6 4V3Z"/>',
 dashboard:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
 resume:'<path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6M13 3v5h5M13 3l5 5v3"/><path d="m14 18 5.5-5.5a1.4 1.4 0 0 1 2 2L16 20l-3 1 1-3ZM18 14l2 2M8 12h4M8 16h2"/>',
 templates:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M10 9v12M7 6h.01M10 6h.01"/>',
 checks:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6ZM14 3v6h6M8 15l3 3 5-6"/>',
 sparkles:'<path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3ZM20 2v4M18 4h4M4 19v3M2.5 20.5h3"/>',
 applications:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a20 20 0 0 0 18 0M12 12v3"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
 privacy:'<path d="M12 3 4 6v6c0 4.5 8 9 8 9s8-4.5 8-9V6l-8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
 external:'<path d="M14 3h7v7M21 3 11 13M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>'
};
export const icon=(name,size=20)=>`<svg class="ui-icon" data-icon="${name}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes[name]||shapes.resume}</svg>`;
