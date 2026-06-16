/* ─── Cozy Cafe · orders.js ─────────────────────────────────────────────── */
(function () {
  'use strict';

  const CHART_HOURS     = ['6am','7am','8am','9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm','6pm','7pm','8pm','9pm','10pm'];
  const CHART_COMPLETED = [0,1,2,4,6,5,8,9,7,5,6,8,10,12,9,7,4];
  const CHART_PENDING   = [0,0,1,2,1,3,2,1,3,2,1,2,3,2,1,1,0];
  const CHART_PREPARING = [0,0,0,1,2,1,3,2,2,1,2,1,2,3,2,1,0];

  const PAGE_SIZE = 20;   // cards per page

  /* ══ STATE ══ */
  let orders       = [];
  let activeStatus = 'all';
  let activeSearch = '';
  let activeSort   = 'newest';
  let activeDate   = 'today';
  let customDate   = '';
  let openOrderId  = null;
  let visibleCount = PAGE_SIZE;   // how many cards are currently shown

  /* ══ INIT ══ */
  document.addEventListener('DOMContentLoaded', function () {
    setTodayDate();
    loadOrders();
    drawChart();
    setInterval(function () { loadOrders(); }, 30000);

    const modal = document.getElementById('orderModal');
    if (modal) modal.addEventListener('click', function (e) { e.stopPropagation(); });
  });

  function setTodayDate() {
    const el = document.getElementById('todayDate');
    if (el) el.textContent = new Date().toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  /* ══ DATA LOADING ══ */
  function loadOrders() {
    return fetch('/admin/api/orders')
      .then(function (r) { return r.json(); })
      .then(function (data) { orders = data; renderAll(); })
      .catch(function (err) { console.error('Orders fetch failed:', err); });
  }

  window.refreshOrders = function () {
    const btn = document.getElementById('refreshBtn');
    if (btn) {
      const svg = btn.querySelector('svg');
      if (svg) svg.classList.add('spinning');
      setTimeout(function () { if (svg) svg.classList.remove('spinning'); }, 600);
    }
    loadOrders();
  };

  /* ══ STATS ══ */
  function updateStats() {
    const filtered = getDateFiltered();
    const total    = filtered.length;
    const served   = filtered.filter(function (o) { return o.status === 'Served' || o.status === 'Closed'; }).length;
    const pending  = filtered.filter(function (o) { return o.status === 'Pending' || o.status === 'Preparing'; }).length;
    const revenue  = filtered
      .filter(function (o) { return o.payment_status === 'paid'; })
      .reduce(function (sum, o) { return sum + (o.total || 0); }, 0);

    setText('statTotal',     total);
    setText('statCompleted', served);
    setText('statPending',   pending);
    setText('statRevenue',   '₹' + revenue.toLocaleString('en-IN'));
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /* ══ DATE FILTERING ══ */
  function getDateFiltered() {
    if (activeDate === 'all') return orders;

    const now      = new Date();
    const todayStr = toLocalDateStr(now);
    const yest     = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const yestStr  = toLocalDateStr(yest);

    return orders.filter(function (o) {
      const s = toLocalDateStr(new Date(o.created_at));
      if (activeDate === 'today')     return s === todayStr;
      if (activeDate === 'yesterday') return s === yestStr;
      if (activeDate === 'custom')    return s === customDate;
      return true;
    });
  }

  function toLocalDateStr(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  window.setDateFilter = function (btn, dateKey) {
    if (dateKey !== 'custom') {
      customDate = '';
      const picker = document.getElementById('datePicker');
      if (picker) picker.value = '';
    }
    document.querySelectorAll('.ord-date-btn').forEach(function (b) { b.classList.remove('ord-date-btn--active'); });
    if (btn) btn.classList.add('ord-date-btn--active');
    activeDate = dateKey;
    resetAndRender();
  };

  window.onDatePickerChange = function (input) {
    customDate = input.value;
    if (!customDate) return;
    document.querySelectorAll('.ord-date-btn').forEach(function (b) { b.classList.remove('ord-date-btn--active'); });
    activeDate = 'custom';
    resetAndRender();
  };

  /* ══ FILTERING & SORTING ══ */
  function getFiltered() {
    return getDateFiltered()
      .filter(function (o) {
        if (activeStatus !== 'all') {
          const s = o.status.toLowerCase();
          switch (activeStatus) {
            case 'pending':   if (s !== 'pending')   return false; break;
            case 'preparing': if (s !== 'preparing') return false; break;
            case 'served':    if (s !== 'served')    return false; break;
            case 'closed':    if (s !== 'closed')    return false; break;
            case 'cancelled': if (s !== 'cancelled') return false; break;
          }
        }
        if (activeSearch) {
          const q = activeSearch.toLowerCase();
          if (!o.id.toLowerCase().includes(q) &&
              !String(o.table).includes(q) &&
              !o.items.some(function (i) { return i.name.toLowerCase().includes(q); })) return false;
        }
        return true;
      })
      .sort(function (a, b) {
        switch (activeSort) {
          case 'oldest':      return new Date(a.created_at) - new Date(b.created_at);
          case 'amount-high': return orderTotal(b) - orderTotal(a);
          case 'amount-low':  return orderTotal(a) - orderTotal(b);
          case 'table':       return a.table - b.table;
          default:            return new Date(b.created_at) - new Date(a.created_at);
        }
      });
  }

  window.setStatusFilter = function (tabBtn) {
    document.querySelectorAll('.ord-tab').forEach(function (t) { t.classList.remove('ord-tab--active'); });
    tabBtn.classList.add('ord-tab--active');
    activeStatus = tabBtn.dataset.status;
    resetAndRender();
  };

  window.filterOrders = function () {
    activeSearch = document.getElementById('searchInput').value.trim();
    activeSort   = document.getElementById('sortSelect').value;
    resetAndRender();
  };

  /* Reset visible count whenever filters change, then render */
  function resetAndRender() {
    visibleCount = PAGE_SIZE;
    renderAll();
  }

  /* ══ RENDER ══ */
  function renderAll() {
    updateStats();
    renderGrid();
  }

  function renderGrid() {
    const grid  = document.getElementById('ordersGrid');
    const empty = document.getElementById('ordEmpty');
    const list  = getFiltered();

    grid.innerHTML = '';

    if (list.length === 0) {
      empty.style.display = 'flex';
      renderLoadMore(0, 0);
      return;
    }

    empty.style.display = 'none';

    /* Only render up to visibleCount */
    const slice = list.slice(0, visibleCount);
    slice.forEach(function (order, i) { grid.appendChild(buildCard(order, i)); });

    renderLoadMore(slice.length, list.length);
  }

  /* Render / update the Load More bar below the grid */
  function renderLoadMore(shown, total) {
    let bar = document.getElementById('loadMoreBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'loadMoreBar';
      bar.className = 'ord-load-more-bar';
      document.getElementById('ordersGrid').insertAdjacentElement('afterend', bar);
    }

    bar.innerHTML = '';

    if (shown >= total) {
      /* All shown — just a count pill */
      if (total > 0) {
        const pill = document.createElement('span');
        pill.className = 'ord-count-pill';
        pill.textContent = 'Showing all ' + total + ' order' + (total !== 1 ? 's' : '');
        bar.appendChild(pill);
      }
      return;
    }

    const remaining = total - shown;

    const pill = document.createElement('span');
    pill.className = 'ord-count-pill';
    pill.textContent = 'Showing ' + shown + ' of ' + total + ' orders';
    bar.appendChild(pill);

    const btn = document.createElement('button');
    btn.className = 'ord-load-more-btn';
    btn.textContent = 'Load ' + Math.min(remaining, PAGE_SIZE) + ' more';
    btn.addEventListener('click', function () {
      visibleCount += PAGE_SIZE;
      renderGrid();
    });
    bar.appendChild(btn);

    const skipBtn = document.createElement('button');
    skipBtn.className = 'ord-load-more-btn ord-load-more-btn--ghost';
    skipBtn.textContent = 'Show all ' + total;
    skipBtn.addEventListener('click', function () {
      visibleCount = total;
      renderGrid();
    });
    bar.appendChild(skipBtn);
  }

  /* ══ CARD ══ */
  function buildCard(order, index) {
    const total          = orderTotal(order);
    const timeAgo        = relativeTime(order.created_at);
    const showItems      = order.items.slice(0, 3);
    const extra          = order.items.length - 3;
    const isPaid         = order.payment_status === 'paid';
    const isServedUnpaid = order.status === 'Served' && !isPaid;

    const card = document.createElement('div');
    card.className = 'ord-card' + (isServedUnpaid ? ' ord-card--urgent' : '');
    card.dataset.status = order.status;
    card.style.animationDelay = (index * 0.04) + 's';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.onclick   = function () { openModal(order.id); };
    card.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') openModal(order.id); };

    let itemsHTML = showItems.map(function (item) {
      return '<div class="ord-card__item-row">' +
        '<span class="ord-card__item-name">' + esc(item.name) + '</span>' +
        '<span class="ord-card__item-qty">×' + item.qty + '</span>' +
        '</div>';
    }).join('');
    if (extra > 0) itemsHTML += '<div class="ord-card__more">+' + extra + ' more item' + (extra > 1 ? 's' : '') + '</div>';

    const payBadge = (order.status === 'Served' || order.status === 'Closed')
      ? '<span class="ord-pay-badge ord-pay-badge--' + (isPaid ? 'paid' : 'unpaid') + '">' +
        (isPaid ? '✓ Paid' : '⚠ Unpaid') + '</span>'
      : '';

    card.innerHTML =
      '<div class="ord-card__head">' +
        '<div class="ord-card__table">Table ' + order.table +
          '<span>#' + order.id + '</span>' +
        '</div>' +
        '<div style="display:flex;gap:.4rem;align-items:center">' +
          '<span class="ord-status-badge ord-status-badge--' + order.status.toLowerCase() + '">' + order.status + '</span>' +
          payBadge +
        '</div>' +
      '</div>' +
      '<div class="ord-card__items">' + itemsHTML + '</div>' +
      '<div class="ord-card__foot">' +
        '<div class="ord-card__time">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="11" height="11"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
          timeAgo +
        '</div>' +
        '<div class="ord-card__total">₹' + total.toLocaleString('en-IN') + '</div>' +
      '</div>';

    return card;
  }

  /* ══ MODAL ══ */
  window.openModal = function (orderId) {
    const order = orders.find(function (o) { return o.id === orderId; });
    if (!order) return;
    openOrderId = orderId;
    renderModal(order);
    document.getElementById('modalBackdrop').classList.add('visible');
    document.getElementById('orderModal').classList.add('visible');
    document.body.style.overflow = 'hidden';
  };

  function renderModal(order) {
    const total      = orderTotal(order);
    const timeStr    = new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const dateStr    = new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const payMethod  = order.payment_method ? capitalize(order.payment_method.replace('_', ' ')) : '–';
    const payRefStr  = order.payment_reference || '–';

    document.getElementById('modalEyebrow').textContent = 'ORDER · ' + order.id;
    document.getElementById('modalTitle').textContent   = 'Table ' + order.table;

    document.getElementById('modalBody').innerHTML =
      '<div class="modal-info-row">' +
        infoCell('Order ID', order.id) +
        infoCell('Status',   order.status) +
        infoCell('Time',     timeStr + ' · ' + dateStr) +
        infoCell('Payment',  capitalize(order.payment_status) + ' · ' + payMethod) +
      '</div>' +
      (order.payment_reference
        ? '<p class="modal-items-label" style="margin-bottom:.4rem">UPI Reference</p>' +
          '<div style="font-family:\'JetBrains Mono\',monospace;font-size:.78rem;color:var(--amber);background:var(--graphite);border:1px solid var(--stone);border-radius:var(--radius);padding:.5rem .75rem;margin-bottom:1rem">' +
          esc(payRefStr) + '</div>'
        : '') +
      '<p class="modal-items-label">Order Items</p>' +
      order.items.map(function (item) {
        return '<div class="modal-item-row">' +
          '<span class="modal-item-name">' + esc(item.name) + '</span>' +
          '<span class="modal-item-qty">×' + item.qty + '</span>' +
          '<span class="modal-item-price">₹' + (item.qty * item.price).toLocaleString('en-IN') + '</span>' +
          '</div>';
      }).join('') +
      '<div class="modal-total-row">' +
        '<span class="modal-total-label">Total Amount</span>' +
        '<span class="modal-total-val">₹' + total.toLocaleString('en-IN') + '</span>' +
      '</div>';

    renderModalFooter(order);
  }

  function renderModalFooter(order) {
    const footer = document.getElementById('modalFooter');
    const isPaid = order.payment_status === 'paid';
    footer.innerHTML = '';

    if (order.status === 'Pending') {
      footer.appendChild(makeBtn('primary', 'Mark as Preparing', function () { updateStatus('Preparing'); }));
      footer.appendChild(makeBtn('danger',  'Cancel Order',       function () { updateStatus('Cancelled'); }));

    } else if (order.status === 'Preparing') {
      footer.appendChild(makeBtn('primary', 'Mark as Served',  function () { updateStatus('Served'); }));
      footer.appendChild(makeBtn('ghost',   'Back to Pending', function () { updateStatus('Pending'); }));

    } else if (order.status === 'Served') {
      if (isPaid) {
        const msg = document.createElement('div');
        msg.className = 'modal-paid-confirm';
        msg.textContent = '✓ Payment confirmed — ready to close';
        footer.appendChild(msg);
        footer.appendChild(makeBtn('ghost', 'Close Order', function () { updateStatus('Closed'); }));
      } else {
        const warn = document.createElement('div');
        warn.className = 'modal-urgent';
        warn.textContent = '⚠ Payment pending — collect before closing';
        footer.appendChild(warn);
        footer.appendChild(makeBtn('primary', '💵 Cash Paid', function () { openPayModal('cash'); }));
        footer.appendChild(makeBtn('primary', '📱 UPI Paid',  function () { openPayModal('upi_manual'); }));
        const dis = makeBtn('ghost', 'Close Order', null);
        dis.disabled = true;
        dis.title = 'Collect payment first';
        footer.appendChild(dis);
      }

    } else if (order.status === 'Closed') {
      const msg = document.createElement('div');
      msg.className = 'modal-paid-confirm';
      msg.textContent = '✓ Order closed and paid';
      footer.appendChild(msg);
      footer.appendChild(makeBtn('ghost', 'Dismiss', function () { closeModal(); }));

    } else if (order.status === 'Cancelled') {
      footer.appendChild(makeBtn('ghost', 'Dismiss', function () { closeModal(); }));

    } else {
      footer.appendChild(makeBtn('ghost', 'Close', function () { closeModal(); }));
    }
  }

  function makeBtn(type, label, handler) {
    const btn = document.createElement('button');
    btn.className = 'modal-btn modal-btn--' + type;
    btn.textContent = label;
    if (handler) btn.addEventListener('click', handler);
    return btn;
  }

  function infoCell(label, val) {
    return '<div class="modal-info-cell">' +
      '<p class="modal-info-cell__label">' + esc(label) + '</p>' +
      '<p class="modal-info-cell__val">' + esc(String(val)) + '</p>' +
      '</div>';
  }

  window.closeModal = function () {
    document.getElementById('modalBackdrop').classList.remove('visible');
    document.getElementById('orderModal').classList.remove('visible');
    document.body.style.overflow = '';
    openOrderId = null;
  };

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') window.closeModal(); });

  /* ══ STATUS UPDATE ══ */
  window.updateStatus = function (newStatus) {
    if (!openOrderId) return;
    const numericId = openOrderId.replace('ORD-', '');

    fetch('/admin/api/orders/' + numericId + '/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
      body: JSON.stringify({ status: newStatus })
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.error) { alert(data.error); return; }
      const order = orders.find(function (o) { return o.id === openOrderId; });
      if (order) order.status = newStatus;
      closeModal();
      loadOrders();
    })
    .catch(function (err) { console.error('Status update failed:', err); });
  };

  /* ══ PAYMENT MODAL ══ */
  window.openPayModal = function (method) {
    const order  = orders.find(function (o) { return o.id === openOrderId; });
    if (!order) return;
    const isCash = method === 'cash';
    const total  = orderTotal(order).toLocaleString('en-IN');
    const footer = document.getElementById('modalFooter');
    footer.innerHTML = '';

    if (isCash) {
      const msg = document.createElement('div');
      msg.className = 'modal-urgent';
      msg.style.color = 'var(--linen)';
      msg.textContent = 'Confirm ₹' + total + ' received in cash?';
      footer.appendChild(msg);
      footer.appendChild(makeBtn('primary', 'Confirm Cash', function () { confirmPayment('cash', ''); }));
      footer.appendChild(makeBtn('ghost',   'Back',         function () { renderModalFooter(order); }));
    } else {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'padding:0 0 0.75rem;width:100%';
      wrap.innerHTML = '<p style="font-size:.78rem;color:var(--dust);margin-bottom:.5rem">Enter UPI Transaction ID</p>' +
        '<input id="upiRef" class="ord-search" style="width:100%" placeholder="e.g. 426831920394"/>';
      footer.appendChild(wrap);
      footer.appendChild(makeBtn('primary', 'Confirm UPI', function () {
        confirmPayment('upi_manual', document.getElementById('upiRef').value);
      }));
      footer.appendChild(makeBtn('ghost', 'Back', function () { renderModalFooter(order); }));
    }
  };

  window.confirmPayment = function (method, reference) {
    if (method === 'upi_manual' && !reference.trim()) {
      alert('Please enter the UPI transaction ID');
      return;
    }
    const numericId = openOrderId.replace('ORD-', '');

    fetch('/admin/api/orders/' + numericId + '/payment', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
      body: JSON.stringify({
        payment_status:    'paid',
        payment_method:    method,
        payment_reference: reference.trim()
      })
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.error) { alert(data.error); return; }
      const order = orders.find(function (o) { return o.id === openOrderId; });
      if (order) {
        order.payment_status    = 'paid';
        order.payment_method    = method;
        order.payment_reference = reference;
      }
      if (order) renderModal(order);
      renderAll();
    })
    .catch(function (err) { console.error('Payment update failed:', err); });
  };

  /* ══ CHART ══ */
  function drawChart() {
    const canvas = document.getElementById('ordersChart');
    if (!canvas) return;
    const ctx  = canvas.getContext('2d');
    const dpr  = window.devicePixelRatio || 1;
    const wrap = canvas.parentElement;
    const W    = wrap.clientWidth;
    const H    = wrap.clientHeight;
    canvas.width  = W * dpr; canvas.height  = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    const PAD_L = 10, PAD_R = 10, PAD_T = 14, PAD_B = 24;
    const cW = W - PAD_L - PAD_R, cH = H - PAD_T - PAD_B;
    const hours = CHART_HOURS.length, step = cW / (hours - 1);
    const maxVal = Math.max.apply(null, CHART_COMPLETED.map(function (c, i) { return c + CHART_PENDING[i] + CHART_PREPARING[i]; }));
    const yScale = cH / (maxVal || 1);
    const LIME = '#CCFF00', AMBER = '#F59E0B', BLUE = '#3B82F6';
    const nowH = new Date().getHours();
    const curIdx = Math.min(Math.max(nowH - 6, 0), hours - 1);

    ctx.strokeStyle = 'rgba(46,46,51,0.7)'; ctx.lineWidth = 1;
    for (var g = 0; g <= 4; g++) {
      var gy = PAD_T + (cH / 4) * g;
      ctx.beginPath(); ctx.moveTo(PAD_L, gy); ctx.lineTo(PAD_L + cW, gy); ctx.stroke();
    }
    var cx = PAD_L + curIdx * step;
    ctx.strokeStyle = 'rgba(204,255,0,0.18)'; ctx.lineWidth = 1; ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.moveTo(cx, PAD_T); ctx.lineTo(cx, PAD_T + cH); ctx.stroke();
    ctx.setLineDash([]);

    function drawArea(data, color, base) {
      var pts    = data.map(function (v, i) { return { x: PAD_L + i*step, y: PAD_T + cH - (base[i]+v)*yScale }; });
      var botPts = data.map(function (v, i) { return { x: PAD_L + i*step, y: PAD_T + cH - base[i]*yScale }; });
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (var i = 1; i < pts.length; i++) ctx.bezierCurveTo(pts[i-1].x+step/2, pts[i-1].y, pts[i].x-step/2, pts[i].y, pts[i].x, pts[i].y);
      for (var j = botPts.length-1; j >= 0; j--) ctx.lineTo(botPts[j].x, botPts[j].y);
      ctx.closePath();
      var grad = ctx.createLinearGradient(0, PAD_T, 0, PAD_T+cH);
      grad.addColorStop(0, hexAlpha(color, 0.35)); grad.addColorStop(1, hexAlpha(color, 0.04));
      ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (var k = 1; k < pts.length; k++) ctx.bezierCurveTo(pts[k-1].x+step/2, pts[k-1].y, pts[k].x-step/2, pts[k].y, pts[k].x, pts[k].y);
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    }

    drawArea(CHART_COMPLETED, LIME,  new Array(hours).fill(0));
    drawArea(CHART_PENDING,   AMBER, CHART_COMPLETED.slice());
    drawArea(CHART_PREPARING, BLUE,  CHART_COMPLETED.map(function (v, i) { return v + CHART_PENDING[i]; }));

    var topVal = CHART_COMPLETED[curIdx] + CHART_PENDING[curIdx] + CHART_PREPARING[curIdx];
    ctx.beginPath(); ctx.arc(cx, PAD_T + cH - topVal*yScale, 5, 0, Math.PI*2);
    ctx.fillStyle = LIME; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();

    var xAxis = document.getElementById('xAxis');
    if (xAxis) {
      xAxis.innerHTML = ''; xAxis.style.position = 'relative';
      CHART_HOURS.forEach(function (h, i) {
        if (i % 3 !== 0 && i !== hours-1) return;
        var span = document.createElement('span');
        span.textContent = h;
        span.style.cssText = 'position:absolute;left:' + ((PAD_L + i*step)/W*100) + '%;transform:translateX(-50%)';
        xAxis.appendChild(span);
      });
    }
  }

  var resizeTimer;
  window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(drawChart, 180); });

  window.printOrders = function () { window.print(); };

  /* ══ HELPERS ══ */
  function getCsrf() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.content : '';
  }
  function orderTotal(o) {
    return o.total || o.items.reduce(function (s, i) { return s + i.qty * i.price; }, 0);
  }
  function relativeTime(iso) {
    var d = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (d < 60) return d + 's ago';
    if (d < 3600) return Math.floor(d/60) + 'm ago';
    return Math.floor(d/3600) + 'h ago';
  }
  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function hexAlpha(hex, alpha) {
    return 'rgba(' + parseInt(hex.slice(1,3),16) + ',' + parseInt(hex.slice(3,5),16) + ',' + parseInt(hex.slice(5,7),16) + ',' + alpha + ')';
  }

})();