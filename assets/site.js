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
  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = contactForm.querySelector('.form-status');
    const submitButton = contactForm.querySelector('button[type="submit"]');
    const originalLabel = submitButton ? submitButton.textContent : '';

    if (status) {
      status.classList.remove('error');
      status.textContent = 'Sending your request…';
    }
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Sending…';
    }

    try {
      const response = await fetch(contactForm.action, {
        method: 'POST',
        body: new FormData(contactForm),
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) throw new Error('Form submission failed');

      contactForm.reset();
      if (status) status.textContent = 'Thank you. Your request has been sent to FutureProof.';
    } catch (error) {
      if (status) {
        status.classList.add('error');
        status.textContent = 'We could not send your request. Please try again or email askfutureproof@outlook.com.';
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalLabel;
      }
    }
  });
}
