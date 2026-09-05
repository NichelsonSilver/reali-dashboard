/* Comportamientos compartidos de las páginas estáticas de realidata.cl
   (nav móvil, animaciones de scroll, FAQ). Cada bloque se protege con
   existencia de elementos: no todas las páginas tienen todos los bloques. */

lucide.createIcons();

// Menú móvil: alterna el panel de links y mantiene aria-expanded sincronizado
const burger = document.getElementById('nav-burger');
const navLinksPanel = document.getElementById('nav-links');
if (burger && navLinksPanel) {
  burger.addEventListener('click', () => {
    const abierto = navLinksPanel.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(abierto));
    burger.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
  });
  navLinksPanel.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    navLinksPanel.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  }));
}

// Animación de entrada al hacer scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

// Resaltado del link activo según sección visible (solo home, links con #)
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
if (sections.length && navLinks.length) {
  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(s => { if (window.scrollY >= s.offsetTop - 100) current = s.id; });
    navLinks.forEach(a => {
      a.style.color = a.getAttribute('href') === '#' + current ? 'var(--bone)' : '';
    });
  }, { passive: true });
}

// Acordeón FAQ
document.querySelectorAll('.faq-q').forEach(btn => {
  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
    document.querySelectorAll('.faq-q').forEach(b => b.setAttribute('aria-expanded', 'false'));
    if (!isOpen) { item.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
    lucide.createIcons();
  });
});
