/* ─────────────────────────────────────────────────────────────
   Cozy Cafe · profile.js
   Handles: theme, density, nav scroll-spy, modals,
            audit log, session info, form submissions.
   No dependencies — vanilla ES5-compatible IIFE pattern.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════
     THEME
  ══════════════════════════════════════════════════ */
  function applyTheme(mode) {
    if (mode === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
    var btnDark  = document.getElementById('btnDark');
    var btnLight = document.getElementById('btnLight');
    if (btnDark && btnLight) {
      btnDark.classList.toggle('prof-theme-btn--active',  mode !== 'light');
      btnLight.classList.toggle('prof-theme-btn--active', mode === 'light');
      btnDark.setAttribute('aria-pressed',  mode !== 'light' ? 'true' : 'false');
      btnLight.setAttribute('aria-pressed', mode === 'light'  ? 'true' : 'false');
    }
  }

  window.setTheme = function (mode) {
    localStorage.setItem('cozy_theme', mode);
    applyTheme(mode);
  };

  /* ══════════════════════════════════════════════════
     DENSITY
  ══════════════════════════════════════════════════ */
  function applyDensity(density) {
    document.body.classList.toggle('density-compact', density === 'compact');
    var btnStd  = document.getElementById('btnStandard');
    var btnCmp  = document.getElementById('btnCompact');
    if (btnStd && btnCmp) {
      btnStd.classList.toggle('prof-theme-btn--active', density !== 'compact');
      btnCmp.classList.toggle('prof-theme-btn--active', density === 'compact');
      btnStd.setAttribute('aria-pressed', density !== 'compact' ? 'true' : 'false');
      btnCmp.setAttribute('aria-pressed', density === 'compact'  ? 'true' : 'false');
    }
  }

  window.setDensity = function (density) {
    localStorage.setItem('cozy_density', density);
    applyDensity(density);
  };

  /* ══════════════════════════════════════════════════
     PREFERENCES (notification toggles)
  ══════════════════════════════════════════════════ */
  window.savePref = function (key, value) {
    localStorage.setItem('cozy_pref_' + key, value ? '1' : '0');
  };

  function loadPrefs() {
    ['notifOrders', 'notifStock', 'notifSecurity'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var stored = localStorage.getItem('cozy_pref_' + id);
      if (stored !== null) el.checked = stored === '1';
    });
  }

  /* ══════════════════════════════════════════════════
     MOBILE PROF NAV TOGGLE
  ══════════════════════════════════════════════════ */
  window.toggleProfNav = function () {
    var list   = document.getElementById('profNavList');
    var toggle = document.getElementById('profNavToggle');
    if (!list || !toggle) return;
    var open = list.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  /* ══════════════════════════════════════════════════
     SCROLL SPY
  ══════════════════════════════════════════════════ */
  function initScrollSpy() {
    var sections = document.querySelectorAll('.prof-section');
    var navItems = document.querySelectorAll('.prof-nav__item');
    var navLabel = document.getElementById('profNavLabel');
    if (!sections.length || !navItems.length) return;

    function onScroll() {
      var scrollY = window.scrollY;
      var topbarH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 58;
      var offset  = topbarH + 24;
      var current = '';

      sections.forEach(function (section) {
        if (scrollY + offset >= section.offsetTop) {
          current = section.id;
        }
      });

      navItems.forEach(function (item) {
        var active = item.dataset.section === current;
        item.classList.toggle('prof-nav__item--active', active);
        if (active && navLabel) navLabel.textContent = item.textContent.trim();
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* Smooth scroll intercept on nav links */
  function initNavScroll() {
    document.querySelectorAll('.prof-nav__item[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var target = document.querySelector(link.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
        // Close mobile nav
        var list = document.getElementById('profNavList');
        var toggle = document.getElementById('profNavToggle');
        if (list && list.classList.contains('open')) {
          list.classList.remove('open');
          if (toggle) toggle.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  /* ══════════════════════════════════════════════════
     MODALS
  ══════════════════════════════════════════════════ */
  window.openModal = function (id) {
    var modal    = document.getElementById(id);
    var backdrop = document.getElementById('modalBackdrop');
    if (!modal || !backdrop) return;
    modal.classList.add('open');
    backdrop.classList.add('visible');
    document.body.style.overflow = 'hidden';

    // Focus first input
    var first = modal.querySelector('input, button:not(.prof-modal__close)');
    if (first) setTimeout(function () { first.focus(); }, 60);
  };

  window.closeModal = function (id) {
    var modal    = document.getElementById(id);
    var backdrop = document.getElementById('modalBackdrop');
    if (!modal || !backdrop) return;
    modal.classList.remove('open');
    // Only remove backdrop if no other modals are open
    var openModals = document.querySelectorAll('.prof-modal.open');
    if (!openModals.length) {
      backdrop.classList.remove('visible');
      document.body.style.overflow = '';
    }
  };

  window.closeAllModals = function () {
    document.querySelectorAll('.prof-modal.open').forEach(function (m) {
      m.classList.remove('open');
    });
    var backdrop = document.getElementById('modalBackdrop');
    if (backdrop) backdrop.classList.remove('visible');
    document.body.style.overflow = '';
  };

  // Escape closes modals
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') window.closeAllModals();
  });

  /* ══════════════════════════════════════════════════
     IDENTITY FORM
  ══════════════════════════════════════════════════ */
  window.saveIdentity = function (e) {
    e.preventDefault();
    var feedback = document.getElementById('identityFeedback');
    if (!feedback) return;

    var form = e.target;
    var data = {
      name:            form.name.value.trim(),
      email:           form.email.value.trim(),
      restaurant_name: form.restaurant_name.value.trim()
    };

    var csrf = document.querySelector('meta[name="csrf-token"]');

    fetch('/admin/profile/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrf ? csrf.content : ''
      },
      body: JSON.stringify(data)
    })
    .then(function (res) { return res.json(); })
    .then(function (json) {
      feedback.classList.remove('error');
      if (json.success) {
        feedback.textContent = '✓ Changes saved.';
        feedback.classList.add('visible');
        // Update avatar display
        var avatar = document.getElementById('avatarDisplay');
        if (avatar && data.name) avatar.textContent = data.name[0].toUpperCase();
        var metaName = document.querySelector('.prof-avatar-meta__name');
        if (metaName && data.name) metaName.textContent = data.name;
      } else {
        feedback.textContent = json.message || 'Something went wrong.';
        feedback.classList.add('visible', 'error');
      }
      setTimeout(function () { feedback.classList.remove('visible'); }, 3000);
    })
    .catch(function () {
      feedback.textContent = 'Network error. Try again.';
      feedback.classList.add('visible', 'error');
      setTimeout(function () { feedback.classList.remove('visible'); }, 3000);
    });
  };

  /* ══════════════════════════════════════════════════
     CHANGE PASSWORD MODAL
  ══════════════════════════════════════════════════ */
  window.submitChangePassword = function (e) {
    e.preventDefault();
    var newPwd     = document.getElementById('newPwd').value;
    var confirmPwd = document.getElementById('confirmPwd').value;
    if (newPwd !== confirmPwd) {
      alert('New passwords do not match.');
      return;
    }
    var csrf = document.querySelector('meta[name="csrf-token"]');
    fetch('/admin/profile/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf ? csrf.content : '' },
      body: JSON.stringify({
        current_password: document.getElementById('currentPwd').value,
        new_password:     newPwd,
        totp_code:        document.getElementById('pwdTotp').value
      })
    })
    .then(function (r) { return r.json(); })
    .then(function (json) {
      if (json.success) {
        window.closeModal('modalChangePassword');
        showToast('Password updated successfully. Logging you out...');

        e.target.reset();

        // small delay so toast is visible
        setTimeout(() => {
          window.location.href = json.redirect_url;
        }, 600);
      } else {
        alert(json.message || 'Could not change password. Check your credentials and 2FA code.');
      }
    })
    .catch(function () { alert('Network error. Try again.'); });
  };

  /* ══════════════════════════════════════════════════
     2FA RECONFIG MODAL
  ══════════════════════════════════════════════════ */
  window.submit2faReconfig = function () {
    var csrf = document.querySelector('meta[name="csrf-token"]');
    fetch('/admin/profile/reset-2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf ? csrf.content : '' },
      body: JSON.stringify({
        password:  document.getElementById('reconfigPwd').value,
        totp_code: document.getElementById('reconfigTotp').value
      })
    })
    .then(function (r) { return r.json(); })
    .then(function (json) {
      if (json.success) {
        window.location.href = json.redirect || json.redirect_url;
      } else {
        alert(json.message || 'Invalid credentials or 2FA code.');
      }
    })
    .catch(function () { alert('Network error. Try again.'); });
  };

  /* ══════════════════════════════════════════════════
     SIGN OUT ALL
  ══════════════════════════════════════════════════ */
  window.submitSignOutAll = function () {
    var csrf = document.querySelector('meta[name="csrf-token"]');
    fetch('/admin/profile/sign-out-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf ? csrf.content : '' },
      body: JSON.stringify({ totp_code: document.getElementById('signOutAllTotp').value })
    })
    .then(function (r) { return r.json(); })
    .then(function (json) {
      if (json.success) {
        window.location.href = '/login';
      } else {
        alert(json.message || 'Invalid 2FA code.');
      }
    })
    .catch(function () { alert('Network error. Try again.'); });
  };

  /* ══════════════════════════════════════════════════
     DELETE ACCOUNT MODAL — gating
  ══════════════════════════════════════════════════ */
  function initDeleteGate() {
    var input  = document.getElementById('deleteConfirmText');
    var btnDel = document.getElementById('btnDeleteConfirm');
    if (!input || !btnDel) return;
    input.addEventListener('input', function () {
      btnDel.disabled = input.value !== 'DELETE MY ACCOUNT';
    });
  }

  window.submitDeleteAccount = function () {
    var confirmText = document.getElementById('deleteConfirmText').value;
    if (confirmText !== 'DELETE MY ACCOUNT') return;

    var csrf = document.querySelector('meta[name="csrf-token"]');
    fetch('/admin/profile/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf ? csrf.content : '' },
      body: JSON.stringify({
        password:      document.getElementById('deletePwd').value,
        totp_code:     document.getElementById('deleteTotp').value,
        confirm_text:  confirmText
      })
    })
    .then(function (r) { return r.json(); })
    .then(function (json) {
      if (json.success) {
        window.location.href = json.redirect || '/';
      } else {
        alert(json.message || 'Could not delete account. Check credentials and 2FA code.');
      }
    })
    .catch(function () { alert('Network error. Try again.'); });
  };

  /* ══════════════════════════════════════════════════
     ACTIVITY — SESSION INFO
  ══════════════════════════════════════════════════ */
function populateSessionInfo() {
  // Last login and device are now server-rendered directly in the HTML — nothing to do.

  // Session duration: server gives us elapsed seconds at page-load time; we just keep ticking.
  var durationEl = document.getElementById('sessionDuration');
  if (durationEl) {
    var startSeconds = parseInt(durationEl.getAttribute('data-start-seconds'), 10) || 0;
    var pageLoadTime = Date.now();

    function updateDuration() {
      var elapsedSinceLoad = Math.floor((Date.now() - pageLoadTime) / 1000);
      var totalSecs = startSeconds + elapsedSinceLoad;
      var m = Math.floor(totalSecs / 60);
      var s = totalSecs % 60;
      durationEl.textContent = m + 'm ' + s + 's';
    }
    updateDuration();
    setInterval(updateDuration, 1000);
  }

  // IP is now server-rendered directly in the HTML — nothing to do.
}

  /* ══════════════════════════════════════════════════
     ACTIVITY — AUDIT LOG
  ══════════════════════════════════════════════════ */
  function populateAuditLog() {
    var list = document.getElementById('auditLog');
    if (!list) return;

    // Fetch from backend; fall back to static mock entries
    fetch('/admin/profile/activity')
      .then(function (r) { return r.json(); })
      .then(function (json) {
        renderAuditLog(list, json.events || []);
      })
      .catch(function () {
        // Mock events — shown when endpoint doesn't exist yet
        renderAuditLog(list, [
          { type: 'login',    text: 'Signed in',                              time: 'Just now' },
          { type: 'order',    text: 'Updated order #ORD-1895 → Completed',    time: '2 min ago' },
          { type: 'menu',     text: 'Added dish "Mango Lassi" to Beverages',  time: '18 min ago' },
          { type: 'qr',       text: 'Generated QR for Table 3',               time: '1 hr ago' },
          { type: 'security', text: 'Password changed',                       time: '2 days ago' },
          { type: 'login',    text: 'Signed in from Chrome · Windows',        time: '3 days ago' }
        ]);
      });
  }

  function renderAuditLog(list, events) {
    if (!events.length) {
      list.innerHTML = '<li class="prof-audit__item"><span class="prof-audit__text" style="color:var(--cinder)">No recent activity found.</span></li>';
      return;
    }
    list.innerHTML = events.map(function (ev) {
      return '<li class="prof-audit__item">' +
        '<span class="prof-audit__dot prof-audit__dot--' + (ev.type || '') + '"></span>' +
        '<span class="prof-audit__text">' + escapeHtml(ev.text) + '</span>' +
        '<span class="prof-audit__time">' + escapeHtml(ev.time) + '</span>' +
        '</li>';
    }).join('');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ══════════════════════════════════════════════════
     TOAST HELPER
  ══════════════════════════════════════════════════ */
  function showToast(message) {
    var toast = document.createElement('div');
    toast.style.cssText = [
      'position:fixed', 'bottom:1.5rem', 'right:1.5rem',
      'background:var(--amber)', 'color:var(--obsidian)',
      'font-family:"DM Sans",system-ui,sans-serif',
      'font-size:0.82rem', 'font-weight:600',
      'padding:0.65rem 1.1rem', 'border-radius:var(--radius)',
      'box-shadow:0 4px 20px rgba(0,0,0,0.4)',
      'z-index:9999', 'opacity:1',
      'transition:opacity 0.4s ease'
    ].join(';');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () { toast.remove(); }, 400);
    }, 2800);
  }

  /* ══════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════ */
  function init() {
    // Theme
    var savedTheme = localStorage.getItem('cozy_theme') || 'dark';
    applyTheme(savedTheme);

    // Density
    var savedDensity = localStorage.getItem('cozy_density') || 'standard';
    applyDensity(savedDensity);

    // Prefs
    loadPrefs();

    // Nav
    initScrollSpy();
    initNavScroll();

    // Delete gate
    initDeleteGate();

    // Activity
    populateSessionInfo();
    populateAuditLog();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();