/* login.js — minimal, no deps */

(function () {
  'use strict';

  // ── Password toggle ──────────────────────────────────────────────────────
  const toggleBtn = document.querySelector('.toggle-pw');
  const pwField   = document.getElementById('password');

  if (toggleBtn && pwField) {
    const eyeOn  = toggleBtn.querySelector('.eye-icon');
    const eyeOff = toggleBtn.querySelector('.eye-off-icon');

    toggleBtn.addEventListener('click', function () {
      const isHidden = pwField.type === 'password';
      pwField.type = isHidden ? 'text' : 'password';
      eyeOn.classList.toggle('hidden', isHidden);
      eyeOff.classList.toggle('hidden', !isHidden);
      toggleBtn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    });
  }

  // ── Auto-dismiss flash messages after 4s ─────────────────────────────────
  const flashes = document.querySelectorAll('.alert');
  flashes.forEach(function (el) {
    setTimeout(function () {
      el.style.transition = 'opacity 0.4s';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 400);
    }, 4000);
  });

  // ── Focus first empty field on load ──────────────────────────────────────
  const username = document.getElementById('username');
  const password = document.getElementById('password');
  if (username && !username.value) {
    username.focus();
  } else if (password) {
    password.focus();
  }

})();