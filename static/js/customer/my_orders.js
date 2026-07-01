/**
 * orders.js
 * Kans Resto — My Orders page
 *
 * Order data is rendered server-side in my-orders.html (Jinja loop) AND
 * mirrored into window.ORDERS_DATA for the bill overlay + filter chips,
 * so we don't need a second round-trip to the server just to show a
 * line-item breakdown. If you'd rather fetch live status updates,
 * swap loadInitial() below for a fetch('/api/my-orders') call — the
 * render functions already expect the same shape.
 */

'use strict';

/* ─────────────────────────────────────────────
   STATE
   orders = [{ id, status, created_at, total_amount, items: [{name, quantity, price}] }]
───────────────────────────────────────────── */

let orders = [];
let activeFilter = 'all';

/* ─────────────────────────────────────────────
   DOM REFS
───────────────────────────────────────────── */

const ordersList      = document.getElementById('ordersList');
const ordersEmpty      = document.getElementById('ordersEmpty');
const ordersNoResults  = document.getElementById('ordersNoResults');
const ordersFilters    = document.getElementById('ordersFilters');

const billOverlay   = document.getElementById('billOverlay');
const billClose      = document.getElementById('billClose');
const billOrderId    = document.getElementById('billOrderId');
const billOrderTime  = document.getElementById('billOrderTime');
const billStatus      = document.getElementById('billStatus');
const billBody        = document.getElementById('billBody');
const billTotal        = document.getElementById('billTotal');

const formatCurrency = (n) => `₹${Number(n ?? 0).toFixed(2)}`;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

/* ─────────────────────────────────────────────
   LOAD — pull whatever the server rendered inline.
───────────────────────────────────────────── */

function loadInitial() {
  orders = Array.isArray(window.ORDERS_DATA) ? window.ORDERS_DATA : [];
  applyFilter(activeFilter, { skipServerRows: true });
  renderPaymentSlots();
}

/* ─────────────────────────────────────────────
   FILTERING
   The list itself is already in the DOM (server-rendered), so
   filtering just toggles visibility per data-status — no re-render,
   no flash of unstyled content.
───────────────────────────────────────────── */

function applyFilter(filter) {
  activeFilter = filter;

  const cards = ordersList.querySelectorAll('.order-ticket');
  let visibleCount = 0;

  cards.forEach((card) => {
    const matches = filter === 'all' || card.dataset.status === filter;
    card.hidden = !matches;
    if (matches) visibleCount += 1;
  });

  const hasAnyOrders = cards.length > 0;
  ordersNoResults.hidden = !(hasAnyOrders && visibleCount === 0);
  ordersList.hidden = !hasAnyOrders || visibleCount === 0;
}

ordersFilters?.addEventListener('click', (e) => {
  const chip = e.target.closest('.filter-chip');
  if (!chip) return;

  ordersFilters.querySelectorAll('.filter-chip').forEach((c) => {
    c.classList.toggle('is-active', c === chip);
    c.setAttribute('aria-selected', c === chip ? 'true' : 'false');
  });

  applyFilter(chip.dataset.filter);
});

/* ─────────────────────────────────────────────
   BILL OVERLAY
───────────────────────────────────────────── */

function findOrder(orderId) {
  return orders.find((o) => String(o.id) === String(orderId));
}

function renderBillRows(order) {
  const items = order.items || [];

  if (items.length === 0) {
    return `<p class="bill-row" style="justify-content:center; color: var(--text-dim);">No item breakdown available.</p>`;
  }

  const rows = items.map((item) => {
    const qty = item.quantity ?? 0;
    const price = item.price ?? 0;
    const lineTotal = qty * price;
    return `
      <div class="bill-row">
        <span class="bill-row-name">${escapeHtml(item.name)} <span class="bill-row-qty">×${qty}</span></span>
        <span class="bill-row-price">${formatCurrency(lineTotal)}</span>
      </div>
    `;
  }).join('');

  const subtotal = items.reduce((sum, i) => sum + (i.quantity ?? 0) * (i.price ?? 0), 0);
  const discount = order.discount_amount ?? null;
  const tax = order.tax_amount ?? null;

  let summaryRows = `<div class="bill-divider"></div>`;
  summaryRows += `<div class="bill-summary-row"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>`;
  if (discount) {
    summaryRows += `<div class="bill-summary-row"><span>Discount</span><span>−${formatCurrency(discount)}</span></div>`;
  }
  if (tax) {
    summaryRows += `<div class="bill-summary-row"><span>Tax</span><span>${formatCurrency(tax)}</span></div>`;
  }

  return rows + summaryRows;
}

function openBill(orderId) {
  const order = findOrder(orderId);
  if (!order) return;

  billOrderId.textContent = `Order #${String(orderId).padStart(4, '0')}`;
  billOrderTime.textContent = order.created_at_display || order.created_at || '—';

  billStatus.textContent = order.status;
  billStatus.className = `order-status status-${(order.status || '').toLowerCase()}`;

  billBody.innerHTML = renderBillRows(order);
  billTotal.textContent = formatCurrency(order.total_amount);

  billOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeBill() {
  billOverlay.hidden = true;
  document.body.style.overflow = '';
}

ordersList?.addEventListener('click', (e) => {
  const btn = e.target.closest('.view-bill-btn');
  if (!btn) return;
  openBill(btn.dataset.orderId);
});

billClose?.addEventListener('click', closeBill);
billOverlay?.addEventListener('click', (e) => {
  if (e.target === billOverlay) closeBill();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !billOverlay.hidden) closeBill();
});

/* ─────────────────────────────────────────────
   THEME TOGGLE (shared key with explore.js / cart.js)
───────────────────────────────────────────── */

const THEME_KEY = 'kans_theme';

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const current = document.body.getAttribute('data-theme') ?? 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

const savedTheme = localStorage.getItem(THEME_KEY);
if (savedTheme) applyTheme(savedTheme);

document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', loadInitial);

/* ─────────────────────────────────────────────
   PAYMENT CARD (Served-stage only)
   State kept in-memory per order id; UPI QR cached
   once fetched so re-render doesn't refetch.
───────────────────────────────────────────── */

const PAYMENT_TEMPLATE = document.getElementById('paymentCardTemplate');
const paymentStateByOrder = {}; // { [orderId]: 'choice' | 'upi' | 'counter' | 'awaiting' | 'paid' }
const upiQrCache = {};

function renderPaymentSlots() {
  document.querySelectorAll('.order-ticket').forEach((card) => {
    const orderId = card.dataset.orderId;
    const order = findOrder(orderId);
    const slot = card.querySelector('[data-payment-slot]');
    if (!order || !slot) return;

    const isServed = (order.status || '').toLowerCase() === 'served';

    if (!isServed) {
      slot.innerHTML = '';
      return;
    }

    // Already built for this card — just sync state, don't rebuild the DOM
    if (!slot.querySelector('.payment-card')) {
      const node = PAYMENT_TEMPLATE.content.cloneNode(true);
      slot.appendChild(node);
      wirePaymentCard(slot, order);
    }

    syncPaymentCardState(slot, order);
  });
}

function initialPaymentState(order) {
  if (order.payment_status === 'paid') return 'paid';
  if (order.payment_status === 'awaiting_verification') return 'upi';
  if (order.payment_method === 'cash') return 'counter';
  return paymentStateByOrder[order.id] || 'choice';
}

function wirePaymentCard(slot, order) {
  const card = slot.querySelector('.payment-card');

  card.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'pay-upi') {
      const ok = await recordPaymentSelection(order.id, 'upi');
      if (!ok) return;
      paymentStateByOrder[order.id] = 'upi';
      await ensureUpiQr(order.id);
      syncPaymentCardState(slot, order);
    }

    if (action === 'pay-counter') {
      const ok = await recordPaymentSelection(order.id, 'cash');
      if (!ok) return;
      paymentStateByOrder[order.id] = 'counter';
      syncPaymentCardState(slot, order);
    }

    if (action === 'back-to-choice') {
      paymentStateByOrder[order.id] = 'choice';
      syncPaymentCardState(slot, order);
    }

    if (action === 'confirm-paid') {
      btn.disabled = true;
      try {
        const res = await fetch(`/customer/api/orders/${order.id}/mark-awaiting`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          order.payment_status = data.payment_status;
          paymentStateByOrder[order.id] = 'awaiting';
          syncPaymentCardState(slot, order);
        }
      } catch (err) {
        console.error('❌ Failed to mark awaiting verification:', err);
        btn.disabled = false;
      }
    }
  });
}

async function recordPaymentSelection(orderId, method) {
  try {
    const res = await fetch(`/customer/api/orders/${orderId}/select-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method })
    });
    const data = await res.json();
    if (!data.success) {
      console.error('Payment selection failed:', data.error);
      return false;
    }
    const order = findOrder(orderId);
    if (order) {
      order.payment_method = data.payment_method;
      order.payment_status = data.payment_status;
    }
    return true;
  } catch (err) {
    console.error('❌ Failed to record payment selection:', err);
    return false;
  }
}

async function ensureUpiQr(orderId) {
  if (upiQrCache[orderId]) return upiQrCache[orderId];
  try {
    const res = await fetch(`/customer/api/orders/${orderId}/upi-qr`);
    const data = await res.json();
    if (data.success) {
      upiQrCache[orderId] = data.upi_qr_base64;
      return data.upi_qr_base64;
    }
  } catch (err) {
    console.error('❌ Failed to fetch UPI QR:', err);
  }
  return null;
}

function syncPaymentCardState(slot, order) {
  const state = initialPaymentState(order);

  const badge = slot.querySelector('[data-payment-status-badge]');
  const choice = slot.querySelector('[data-payment-choice]');
  const upiPanel = slot.querySelector('[data-payment-upi]');
  const counterPanel = slot.querySelector('[data-payment-counter]');
  const awaitingPanel = slot.querySelector('[data-payment-awaiting]');
  const successPanel = slot.querySelector('[data-payment-success]');
  const qrImg = slot.querySelector('[data-payment-qr-img]');

  choice.hidden = true;
  upiPanel.hidden = true;
  counterPanel.hidden = true;
  awaitingPanel.hidden = true;
  successPanel.hidden = true;

  if (state === 'paid') {
    badge.textContent = 'Paid';
    badge.dataset.state = 'paid';
    successPanel.hidden = false;
    return;
  }

  if (state === 'awaiting') {
    badge.textContent = 'Awaiting Verification';
    badge.dataset.state = 'awaiting';
    awaitingPanel.hidden = false;
    return;
  }

  badge.textContent = 'Pending';
  badge.dataset.state = 'pending';

  if (state === 'upi') {
    upiPanel.hidden = false;
    if (qrImg && upiQrCache[order.id]) qrImg.src = upiQrCache[order.id];
    return;
  }

  if (state === 'counter') {
    counterPanel.hidden = false;
    return;
  }

  choice.hidden = false;
}

/* ─────────────────────────────────────────────
   POLL — pick up admin verification + status changes
   without a full page reload. Every 12s, only while
   at least one order is in a pollable state.
───────────────────────────────────────────── */

function getPollableIds() {
  return orders
    .filter(o => {
      const s = (o.status || '').toLowerCase();
      return s !== 'closed' && s !== 'cancelled';
    })
    .map(o => o.id);
}

async function pollOrderUpdates() {
  const ids = getPollableIds();
  if (ids.length === 0) return;

  try {
    const res = await fetch(`/customer/api/my-orders/status-poll?ids=${ids.join(',')}`);
    const data = await res.json();
    if (!data.success) return;

    let changed = false;
    data.orders.forEach((update) => {
      const order = findOrder(update.id);
      if (!order) return;
      if (order.status !== update.status || order.payment_status !== update.payment_status) {
        order.status = update.status;
        order.payment_status = update.payment_status;
        changed = true;
      }
    });

    if (changed) {
      // Reflect status changes on the visible card chip + re-sync payment card
      document.querySelectorAll('.order-ticket').forEach((card) => {
        const order = findOrder(card.dataset.orderId);
        if (!order) return;
        card.dataset.status = (order.status || '').toLowerCase();
        const statusEl = card.querySelector('.order-status');
        if (statusEl) {
          statusEl.textContent = order.status;
          statusEl.className = `order-status status-${(order.status || '').toLowerCase()}`;
        }
      });
      applyFilter(activeFilter);
      renderPaymentSlots();
    }
  } catch (err) {
    console.error('❌ Poll failed:', err);
  }
}

setInterval(pollOrderUpdates, 12000);