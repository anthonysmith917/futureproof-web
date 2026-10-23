document.querySelectorAll('.tools-menu').forEach(menu=>{if(!menu.querySelector('a[href="https://pdf.askfutureproof.com/"]')){const link=document.createElement('a');link.href='https://pdf.askfutureproof.com/';link.innerHTML='PDF Studio<small>Edit existing PDFs with AI</small>';menu.insertBefore(link,menu.querySelector('.tools-all'));}});
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
