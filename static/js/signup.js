/* signup.js */

(function () {
  'use strict';

  // ── Password toggles (handles both fields) ───────────────────────────────
  document.querySelectorAll('.toggle-pw').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var targetId = btn.getAttribute('data-target');
      var field    = document.getElementById(targetId);
      if (!field) return;

      var isHidden = field.type === 'password';
      field.type   = isHidden ? 'text' : 'password';

      btn.querySelector('.eye-icon').classList.toggle('hidden', isHidden);
      btn.querySelector('.eye-off-icon').classList.toggle('hidden', !isHidden);
      btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    });
  });

  // ── Password strength meter ──────────────────────────────────────────────
  var pwField      = document.getElementById('password');
  var strengthFill = document.getElementById('strength-fill');
  var strengthLabel = document.getElementById('strength-label');

  function scorePassword(pw) {
    if (!pw) return 0;
    var score = 0;
    if (pw.length >= 8)  score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score; // 0–5
  }

  var levels = [
    { label: '',       color: 'transparent', pct: '0%'   },
    { label: 'Weak',   color: '#9b4d4d',     pct: '20%'  },
    { label: 'Weak',   color: '#9b4d4d',     pct: '40%'  },
    { label: 'Fair',   color: '#b5965a',     pct: '60%'  },
    { label: 'Good',   color: '#7a9b6a',     pct: '80%'  },
    { label: 'Strong', color: '#4d7a5a',     pct: '100%' },
  ];

  if (pwField && strengthFill && strengthLabel) {
    pwField.addEventListener('input', function () {
      var score  = scorePassword(pwField.value);
      var level  = levels[score];
      strengthFill.style.width      = level.pct;
      strengthFill.style.background = level.color;
      strengthLabel.textContent     = level.label;
    });
  }

  // ── Confirm password match hint ──────────────────────────────────────────
  var confirmField = document.getElementById('confirm_password');

  if (confirmField && pwField) {
    confirmField.addEventListener('input', function () {
      var match = confirmField.value === pwField.value;
      confirmField.style.borderColor = confirmField.value
        ? (match ? '#4d7a5a' : '#9b4d4d')
        : '';
      confirmField.style.boxShadow = confirmField.value
        ? (match ? '0 0 0 3px rgba(77,122,90,0.15)' : '0 0 0 3px rgba(155,77,77,0.15)')
        : '';
    });
  }

  // ── Auto-dismiss flash messages ──────────────────────────────────────────
  document.querySelectorAll('.alert').forEach(function (el) {
    setTimeout(function () {
      el.style.transition = 'opacity 0.4s';
      el.style.opacity    = '0';
      setTimeout(function () { el.remove(); }, 400);
    }, 4000);
  });

  // ── Focus first empty field ──────────────────────────────────────────────
  var first = document.getElementById('username');
  if (first && !first.value) first.focus();

})();