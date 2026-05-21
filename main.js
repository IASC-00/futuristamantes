/* FUTURISTAMANTES — main.js */
(function () {
  'use strict';

  /* ─── Nav visibility after first scroll ─── */
  const nav = document.getElementById('nav');
  const landing = document.getElementById('landing');

  const navObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          nav.classList.add('visible');
        } else {
          nav.classList.remove('visible');
        }
      });
    },
    { threshold: 0.1 }
  );

  if (landing) navObserver.observe(landing);

  /* ─── Scroll reveal — generic .reveal-fade and section-specific ─── */
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
  );

  /* Observe all animatable elements */
  const animatables = document.querySelectorAll(
    '.reveal-fade, .manifesto-line, .field-card, .process-step, .archive-card'
  );
  animatables.forEach((el) => revealObserver.observe(el));

  /* ─── Enter transmission button smooth scroll ─── */
  const enterBtn = document.getElementById('enter-btn');
  if (enterBtn) {
    enterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById('manifesto');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  }

  /* ─── Formspree submission ─── */
  const form = document.getElementById('transmission-form');
  const successMsg = document.getElementById('form-success');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = form.querySelector('.btn-transmit');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'TRANSMITTING...';
      submitBtn.disabled = true;

      try {
        const data = new FormData(form);
        const response = await fetch(form.action, {
          method: 'POST',
          body: data,
          headers: { Accept: 'application/json' },
        });

        if (response.ok) {
          form.style.display = 'none';
          if (successMsg) {
            successMsg.style.display = 'block';
          }
        } else {
          submitBtn.textContent = 'ERROR — TRY AGAIN';
          submitBtn.disabled = false;
        }
      } catch {
        submitBtn.textContent = 'ERROR — TRY AGAIN';
        submitBtn.disabled = false;
      }
    });
  }

  /* ─── VHS flicker on wordmark (subtle, rare) ─── */
  const wordmark = document.querySelector('.landing-wordmark');
  if (wordmark) {
    function occasionalFlicker() {
      const delay = 6000 + Math.random() * 14000; // 6–20s between flickers
      setTimeout(() => {
        wordmark.style.opacity = '0.85';
        wordmark.style.transform = 'translateX(1px)';
        setTimeout(() => {
          wordmark.style.opacity = '1';
          wordmark.style.transform = 'translateX(0)';
          setTimeout(() => {
            wordmark.style.opacity = '0.9';
            setTimeout(() => {
              wordmark.style.opacity = '1';
              wordmark.style.transform = '';
              occasionalFlicker(); // schedule next
            }, 60);
          }, 80);
        }, 40);
      }, delay);
    }
    occasionalFlicker();
  }

  /* ─── Active nav link on scroll ─── */
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a');

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach((link) => {
            link.style.color =
              link.getAttribute('href') === `#${id}`
                ? 'var(--off-white)'
                : 'var(--dim)';
          });
        }
      });
    },
    { threshold: 0.4 }
  );

  sections.forEach((s) => sectionObserver.observe(s));
})();
