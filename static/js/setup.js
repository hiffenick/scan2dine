/* setup.js */

(function () {
  'use strict';

  // ── Tab switching ─────────────────────────────────────────────────────────
  var tabBtns     = document.querySelectorAll('.setup-tab-btn');
  var tabContents = document.querySelectorAll('.setup-tab-content');

  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = btn.getAttribute('data-tab');

      tabBtns.forEach(function (b) { b.classList.remove('active'); });
      tabContents.forEach(function (t) { t.classList.remove('active'); });

      btn.classList.add('active');
      var panel = document.getElementById(target);
      if (panel) panel.classList.add('active');
    });
  });

  // ── Copy key to clipboard ─────────────────────────────────────────────────
  window.copyToClipboard = function (text) {
    var btn = document.getElementById('copy-btn');

    navigator.clipboard.writeText(text)
      .then(function () {
        if (btn) {
          var original = btn.innerHTML;
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
          btn.classList.add('copied');
          setTimeout(function () {
            btn.innerHTML = original;
            btn.classList.remove('copied');
          }, 2000);
        }
      })
      .catch(function () {
        // Fallback for older browsers
        var el = document.createElement('textarea');
        el.value = text;
        el.style.position = 'fixed';
        el.style.opacity  = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        if (btn) {
          btn.textContent = 'Copied!';
          setTimeout(function () { btn.textContent = 'Copy Key'; }, 2000);
        }
      });
  };

  // ── OTP input: numbers only + auto-format with space in middle ────────────
  var codeInput = document.getElementById('verify-code');

  if (codeInput) {
    codeInput.addEventListener('input', function () {
      // Strip non-digits
      var digits = codeInput.value.replace(/\D/g, '').slice(0, 6);
      codeInput.value = digits;
    });

    codeInput.addEventListener('keydown', function (e) {
      // Allow: backspace, delete, tab, escape, enter, arrows
      var allowed = [8, 9, 13, 27, 37, 38, 39, 40, 46];
      if (allowed.indexOf(e.keyCode) !== -1) return;
      // Block non-numeric keys
      if ((e.keyCode < 48 || e.keyCode > 57) && (e.keyCode < 96 || e.keyCode > 105)) {
        e.preventDefault();
      }
    });

    // Auto-submit when 6 digits entered
    codeInput.addEventListener('input', function () {
      if (codeInput.value.length === 6) {
        var form = codeInput.closest('form');
        if (form) {
          // Small delay so user sees the complete code
          setTimeout(function () { form.requestSubmit ? form.requestSubmit() : form.submit(); }, 300);
        }
      }
    });

    // Focus on load if on auth tab
    codeInput.focus();
  }

})();