const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');

if (menuButton && nav) {
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('open', !open);
    document.body.classList.toggle('menu-open', !open);
  });

  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    menuButton.setAttribute('aria-expanded', 'false');
    nav.classList.remove('open');
    document.body.classList.remove('menu-open');
  }));
}

document.querySelectorAll('[data-year]').forEach((item) => {
  item.textContent = new Date().getFullYear();
});

const observed = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  observed.forEach((item) => observer.observe(item));
} else {
  observed.forEach((item) => item.classList.add('visible'));
}

const contactForm = document.querySelector('[data-contact-form]');
if (contactForm) {
  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(contactForm);
    const name = form.get('name') || '';
    const organization = form.get('organization') || '';
    const email = form.get('email') || '';
    const phone = form.get('phone') || '';
    const interest = form.get('interest') || 'General inquiry';
    const message = form.get('message') || '';
    const subject = encodeURIComponent(`FutureProof inquiry: ${interest}`);
    const body = encodeURIComponent(
      `Name: ${name}\nOrganization: ${organization}\nEmail: ${email}\nPhone: ${phone}\nInterest: ${interest}\n\nHow can FutureProof help?\n${message}`
    );
    const status = contactForm.querySelector('.form-status');
    if (status) status.textContent = 'Opening your email app with the request details…';
    window.location.href = `mailto:askfutureproof@outlook.com?subject=${subject}&body=${body}`;
  });
}

