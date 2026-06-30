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