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

/* ══════════════════════════════════════════
   4. NEW ORDER MODAL
══════════════════════════════════════════ */
(function () {
  const overlay    = document.getElementById('newOrderOverlay');
  const openBtn     = document.getElementById('newOrderBtn');
  const closeBtn    = document.getElementById('newOrderClose');
  const cancelBtn   = document.getElementById('newOrderCancel');
  const submitBtn   = document.getElementById('newOrderSubmit');
  const itemsList   = document.getElementById('noItemsList');
  const totalVal    = document.getElementById('noTotalVal');
  const errorEl     = document.getElementById('noError');
  const nameInput   = document.getElementById('noCustomerName');
  const tableInput  = document.getElementById('noTableNo');

  if (!overlay || !openBtn) return;

  const endpoints = window.NEW_ORDER_ENDPOINTS || {};
  let menuCache = null;
  const qtyMap  = {};

  function money(n) { return '₹' + Number(n).toFixed(2); }

  function computeTotal() {
    let total = 0;
    if (!menuCache) return total;
    menuCache.forEach(function (m) {
      total += (qtyMap[m.id] || 0) * m.price;
    });
    return total;
  }

  function renderTotal() { totalVal.textContent = money(computeTotal()); }

  function renderItems() {
    if (!menuCache || menuCache.length === 0) {
      itemsList.innerHTML = '<div class="no-items-empty">No active menu items found.</div>';
      return;
    }
    itemsList.innerHTML = menuCache.map(function (m) {
      const q = qtyMap[m.id] || 0;
      return (
        '<div class="no-item-row" data-id="' + m.id + '">' +
          '<div class="no-item-info">' +
            '<span class="no-item-name">' + m.name + '</span>' +
            '<span class="no-item-price">' + money(m.price) + '</span>' +
          '</div>' +
          '<div class="no-item-qty">' +
            '<button type="button" class="no-qty-btn" data-action="dec">−</button>' +
            '<span class="no-qty-val">' + q + '</span>' +
            '<button type="button" class="no-qty-btn" data-action="inc">+</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function showError(msg) { errorEl.textContent = msg; errorEl.style.display = 'block'; }
  function clearError() { errorEl.style.display = 'none'; errorEl.textContent = ''; }

  function resetForm() {
    nameInput.value = '';
    tableInput.value = '';
    Object.keys(qtyMap).forEach(function (k) { delete qtyMap[k]; });
    clearError();
    renderTotal();
  }

  function openModal() {
    overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
    resetForm();

    if (menuCache) { renderItems(); return; }

    itemsList.innerHTML = '<div class="no-items-loading">Loading menu…</div>';
    fetch(endpoints.menu)
      .then(function (r) { return r.json(); })
      .then(function (data) { menuCache = data; renderItems(); })
      .catch(function () {
        itemsList.innerHTML = '<div class="no-items-empty">Could not load menu. Try again.</div>';
      });
  }

  function closeModal() {
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
  }

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('visible')) closeModal();
  });

  itemsList.addEventListener('click', function (e) {
    const btn = e.target.closest('.no-qty-btn');
    if (!btn) return;
    const row = btn.closest('.no-item-row');
    const id  = row.getAttribute('data-id');
    const cur = qtyMap[id] || 0;
    const next = btn.getAttribute('data-action') === 'inc' ? cur + 1 : Math.max(0, cur - 1);
    qtyMap[id] = next;
    row.querySelector('.no-qty-val').textContent = next;
    renderTotal();
  });

  submitBtn.addEventListener('click', function () {
    clearError();

    const customerName = nameInput.value.trim();
    const tableNo = parseInt(tableInput.value, 10);
    const items = Object.keys(qtyMap)
      .filter(function (id) { return qtyMap[id] > 0; })
      .map(function (id) { return { menu_item_id: parseInt(id, 10), qty: qtyMap[id] }; });

    if (!customerName) return showError('Please enter a customer name.');
    if (!tableNo || tableNo < 1) return showError('Please enter a valid table number.');
    if (items.length === 0) return showError('Select at least one item.');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating…';

    fetch(endpoints.create, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: customerName,
        table_no: tableNo,
        items: items,
        status: 'Pending'
      })
    })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (res) {
        if (!res.ok || !res.data.success) throw new Error(res.data.message || 'Failed to create order.');
        closeModal();
        window.location.reload();
      })
      .catch(function (err) { showError(err.message || 'Something went wrong.'); })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Order';
      });
  });
})();