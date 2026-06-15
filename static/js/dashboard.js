/* ─── Cozy Cafe · dashboard.js ─────────────────────────────────────────────
   Dashboard-only interactions.
   Depends on: base.js (already loaded)
──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ══════════════════════════════════════════
     1. ANIMATED STAT COUNTERS
     Counts up integer stat values on load.
     Skips decimals (revenue) — those render server-side.
  ══════════════════════════════════════════ */
  function animateCounter(el) {
    const raw = el.getAttribute('data-count');
    if (!raw) return;

    const target   = parseInt(raw, 10);
    if (isNaN(target) || target === 0) return;

    const duration = 900;   // ms
    const fps      = 60;
    const steps    = Math.round(duration / (1000 / fps));
    let   current  = 0;
    let   step     = 0;

    const tick = function () {
      step++;
      // ease-out: faster start, gentle finish
      const progress = 1 - Math.pow(1 - step / steps, 3);
      current = Math.round(target * progress);
      el.textContent = current.toLocaleString('en-IN');

      if (step < steps) requestAnimationFrame(tick);
      else el.textContent = target.toLocaleString('en-IN');
    };

    requestAnimationFrame(tick);
  }

  /* Run counters when page is ready */
  const motionOk = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

  if (motionOk) {
    document.querySelectorAll('.db-stat__value[data-count]').forEach(function (el) {
      animateCounter(el);
    });
  }

  /* ══════════════════════════════════════════
     2. NOTIFICATION DISMISS
  ══════════════════════════════════════════ */
  window.dismissNotif = function (btn) {
    const notif     = btn.closest('.db-notif');
    const list      = document.getElementById('notifList');
    const countEl   = document.getElementById('notifCount');
    const emptyEl   = document.getElementById('notifsEmpty');

    if (!notif) return;

    // Animate out
    notif.classList.add('removing');
    notif.addEventListener('animationend', function () {
      notif.remove();

      // Update badge count
      const remaining = list ? list.querySelectorAll('.db-notif').length : 0;
      if (countEl) {
        if (remaining > 0) {
          countEl.textContent = remaining;
        } else {
          countEl.style.display = 'none';
        }
      }

      // Show all-clear message
      if (remaining === 0 && emptyEl) {
        emptyEl.style.display = 'block';
      }
    }, { once: true });
  };

  /* ══════════════════════════════════════════
     3. ORDER ROWS — keyboard accessibility
     Orders are div[role=button] — make Enter/Space navigate.
  ══════════════════════════════════════════ */
  document.querySelectorAll('.db-order[role="button"]').forEach(function (row) {
    row.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        row.click();
      }
    });
  });

})();