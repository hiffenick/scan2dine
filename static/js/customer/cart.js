/**
 * cart.js
 * Kans Resto — Order Review / Cart Page
 *
 * Reads/writes the SAME server-side cart that explore.js uses,
 * via /api/cart/current and /api/cart. No sessionStorage involved —
 * the Flask session (via get_cart/save_cart) is the single source
 * of truth for both pages.
 */

'use strict';

const DISCOUNT_RATE = 0.10;
const TAX_RATE = 0.10;

/* ─────────────────────────────────────────────
   CART STATE
   cart = array of { id, name, price, quantity }  (matches /api/cart shape)
───────────────────────────────────────────── */

let cart = [];

async function loadCartFromServer() {
  try {
    const res = await fetch('/api/cart/current');
    if (!res.ok) {
      console.error('Failed to load cart:', res.status);
      cart = [];
      renderCart();
      return;
    }
    const data = await res.json();
    if (data.success) {
      cart = data.items || [];
    } else {
      cart = [];
    }
  } catch (err) {
    console.error('❌ Failed to load cart:', err);
    cart = [];
  }
  renderCart();
}

async function updateCartOnServer(itemId, action, itemName = '') {
  try {
    const res = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: Number(itemId),
        action: action === 'increase' ? 'ADD' : 'REMOVE'
      })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      console.error(data.error || 'Cart update failed');
      return;
    }

    cart = data.cart || [];
    renderCart();
  } catch (err) {
    console.error(err);
  }
}


/* ─────────────────────────────────────────────
   DOM REFS
───────────────────────────────────────────── */

const ticketList   = document.getElementById('ticketList');
const cartEmpty     = document.getElementById('cartEmpty');
const noteBlock     = document.getElementById('noteBlock');
const cartHeading   = document.getElementById('cartHeading');
const cartSub       = document.getElementById('cartSub');
const summaryRail   = document.getElementById('summaryRail');
const mobileSummary = document.getElementById('mobileSummary');

const formatCurrency = (n) => `₹${n.toFixed(2)}`;

/* ─────────────────────────────────────────────
   RENDER: build the ticket rows from cart state
───────────────────────────────────────────── */

function renderCart() {
  if (!cart || cart.length === 0) {
    ticketList.hidden = true;
    ticketList.innerHTML = '';
    noteBlock.hidden = true;
    summaryRail.hidden = true;
    mobileSummary.hidden = true;
    cartEmpty.hidden = false;
    cartHeading.textContent = 'Your order is empty';
    cartSub.textContent = 'Add a few dishes from the menu and they will show up here.';
    updateTotals();
    return;
  }

  cartEmpty.hidden = true;
  noteBlock.hidden = false;
  summaryRail.hidden = false;
  mobileSummary.hidden = false;
  ticketList.hidden = false;
  cartHeading.textContent = 'Review your order';
  cartSub.textContent = 'Check the dishes and quantities below, then send it to the kitchen.';

  ticketList.innerHTML = cart.map((entry) => {
    const price = entry.price ?? 0;
    const qty = entry.quantity ?? 0;
    const lineTotal = price * qty;
    const thumbContent = entry.image
      ? `<img src="${entry.image}" alt="${escapeHtml(entry.name)}">`
      : '🍽️';

    return `
      <article class="ticket-row" data-item-id="${entry.id}">
        <div class="ticket-thumb">${thumbContent}</div>
        <div class="ticket-info">
          <span class="ticket-name">${escapeHtml(entry.name)}</span>
          <span class="ticket-unit-price">${formatCurrency(price)} each</span>
        </div>
        <div class="ticket-counter">
          <button class="ticket-counter-btn is-remove" data-action="decrease" data-id="${entry.id}" aria-label="Decrease quantity">−</button>
          <span class="ticket-counter-qty">${qty}</span>
          <button class="ticket-counter-btn" data-action="increase" data-id="${entry.id}" data-name="${escapeHtml(entry.name)}" aria-label="Increase quantity">+</button>
        </div>
        <div class="ticket-line-total">${formatCurrency(lineTotal)}</div>
      </article>
    `;
  }).join('');

  updateTotals();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

/* ─────────────────────────────────────────────
   TOTALS
   Mirrors the same math as cart_routes.py so the
   on-screen total matches what the server recorded.
───────────────────────────────────────────── */

function computeTotals() {
  const subtotal = cart.reduce((sum, e) => sum + (e.price ?? 0) * (e.quantity ?? 0), 0);
  const discount = subtotal * DISCOUNT_RATE;
  const tax = (subtotal - discount) * TAX_RATE;
  const grandTotal = subtotal - discount + tax;
  const count = cart.reduce((sum, e) => sum + (e.quantity ?? 0), 0);
  return { subtotal, discount, tax, grandTotal, count };
}

function updateTotals() {
  const { subtotal, discount, tax, grandTotal, count } = computeTotals();

  setText('sumSubtotal', formatCurrency(subtotal));
  setText('sumSubtotalMobile', formatCurrency(subtotal));
  setText('sumTax', formatCurrency(tax));
  setText('sumTaxMobile', formatCurrency(tax));
  setText('sumTotal', formatCurrency(grandTotal));
  setText('mobileSummaryTotal', formatCurrency(grandTotal));
  setText('mobileSummaryCount', count === 1 ? '1 item' : `${count} items`);

  const showDiscount = discount > 0;
  toggleHidden('sumDiscountRow', !showDiscount);
  toggleHidden('sumDiscountRowMobile', !showDiscount);
  setText('sumDiscount', `−${formatCurrency(discount)}`);
  setText('sumDiscountMobile', `−${formatCurrency(discount)}`);

  const placeBtns = [document.getElementById('placeOrderBtn'), document.getElementById('placeOrderBtnMobile')];
  placeBtns.forEach(btn => { if (btn) btn.disabled = count === 0; });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function toggleHidden(id, hidden) {
  const el = document.getElementById(id);
  if (el) el.hidden = hidden;
}

/* ─────────────────────────────────────────────
   QUANTITY ACTIONS — now hit the real API
───────────────────────────────────────────── */

function increaseQty(itemId, itemName) {
  updateCartOnServer(itemId, 'increase', itemName);
}

function decreaseQty(itemId) {
  const row = ticketList.querySelector(`.ticket-row[data-item-id="${itemId}"]`);
  const entry = cart.find(i => String(i.id) === String(itemId));

  // If this decrement will remove the last unit, animate the row out first
  if (entry && entry.quantity <= 1 && row) {
    row.classList.add('is-removing');
    row.addEventListener('animationend', () => updateCartOnServer(itemId, 'decrease'), { once: true });
    setTimeout(() => updateCartOnServer(itemId, 'decrease'), 260);
    return;
  }

  updateCartOnServer(itemId, 'decrease');
}

ticketList.addEventListener('click', (e) => {
  const btn = e.target.closest('.ticket-counter-btn');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === 'increase') increaseQty(id, btn.dataset.name);
  if (btn.dataset.action === 'decrease') decreaseQty(id);
});


/* ─────────────────────────────────────────────
   THEME TOGGLE  (shared key with explore.js)
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
   MOBILE SUMMARY EXPAND/COLLAPSE
───────────────────────────────────────────── */

const mobileSummaryExpand = document.getElementById('mobileSummaryExpand');

mobileSummaryExpand?.addEventListener('click', () => {
  const expanded = mobileSummary.classList.toggle('is-expanded');
  mobileSummaryExpand.setAttribute('aria-expanded', expanded ? 'true' : 'false');
});


/* ─────────────────────────────────────────────
   PLACE ORDER
   NOTE: this still only shows the confirmation UI — it does not yet
   call a "submit order" endpoint, because none exists in
   cart_routes.py. It re-checks the real cart state (count === 0 guard)
   so it can no longer fire on an empty/unloaded cart. Wire this up to
   a real POST /api/order (or similar) once that endpoint exists.
───────────────────────────────────────────── */

const confirmOverlay = document.getElementById('confirmOverlay');
const confirmTable = document.getElementById('confirmTable');

function placeOrder() {
  const { count } = computeTotals();
  if (count === 0) return;

  confirmTable.textContent = typeof TABLE_NUMBER !== 'undefined' ? TABLE_NUMBER : '—';
  confirmOverlay.hidden = false;

  // TODO: once a real "submit order" endpoint exists, call it here
  // and only clear the cart / show the overlay on a successful response.
}

document.getElementById('placeOrderBtn')?.addEventListener('click', placeOrder);
document.getElementById('placeOrderBtnMobile')?.addEventListener('click', placeOrder);

document.getElementById('confirmKeepBrowsing')?.addEventListener('click', () => {
  confirmOverlay.hidden = true;
});


/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  loadCartFromServer();
});