// Native details keeps the tools accessible even when scripts are unavailable.
document.querySelectorAll('.nav-tools').forEach((menu) => {
  const close = () => { menu.open = false; };
  document.addEventListener('click', (event) => { if (!menu.contains(event.target)) close(); });
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { close(); menu.querySelector('summary').focus(); }
  });
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', close));
  document.querySelector('.menu-toggle')?.addEventListener('click', close);
});
