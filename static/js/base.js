/* ─── Cozy Cafe · base.js ──────────────────────────────────────────────────
   Sidebar toggle — shared across every admin page.
   No dependencies.
──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sbOverlay');
  const hamBtn   = document.getElementById('hamBtn');

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('visible');
    hamBtn.classList.add('open');
    hamBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden'; // prevent bg scroll on mobile
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
    hamBtn.classList.remove('open');
    hamBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  window.toggleSidebar = function () {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  };

  window.closeSidebar = closeSidebar;

  /* Close with Escape key */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSidebar();
  });

  /* Close if viewport grows past mobile breakpoint */
  const mq = window.matchMedia('(min-width: 901px)');
  mq.addEventListener('change', function (e) {
    if (e.matches) closeSidebar();
  });

})();