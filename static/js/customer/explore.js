/**
 * explore.js
 * Kans Resto — Customer Menu Page
 * Handles: cart, counters, search, TOC active states,
 *          theme toggle, mobile sidebar, countdown timer.
 */

'use strict';

/* ─────────────────────────────────────────────
   CART STATE
   Stored in sessionStorage so it survives page refreshes
   but clears when the tab is closed.
───────────────────────────────────────────── */

const CART_KEY = `kans_cart_t${typeof TABLE_NUMBER !== 'undefined' ? TABLE_NUMBER : 0}`;

function loadCart() {
  try {
    return JSON.parse(sessionStorage.getItem(CART_KEY)) || {};
  } catch {
    return {};
  }
}

function saveCart(cart) {
  sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
}

// cart = { [itemId]: { name, qty, price? } }
let cart = loadCart();


/* ─────────────────────────────────────────────
   CART UI HELPERS
───────────────────────────────────────────── */

function totalItems() {
  return Object.values(cart).reduce((sum, v) => sum + v.qty, 0);
}

function updateCartUI() {
  const total = totalItems();

  // Rail count label
  const railCount = document.getElementById('cartCountRail');
  if (railCount) railCount.textContent = total === 1 ? '1 item' : `${total} items`;

  // Rail CTA badge + visibility
  const railCta   = document.getElementById('orderRailCta');
  const railEmpty = document.getElementById('orderRailEmpty');
  const cartCount = document.getElementById('cartCount');
  if (cartCount) cartCount.textContent = total;
  if (railCta)   railCta.hidden   = total === 0;
  if (railEmpty) railEmpty.style.display = total > 0 ? 'none' : '';

  // Mobile floating bar
  const floatingCart      = document.getElementById('floatingCart');
  const cartCountMobile   = document.getElementById('cartCountMobile');
  if (cartCountMobile) cartCountMobile.textContent = total;
  if (floatingCart)    floatingCart.hidden = total === 0;
}

function syncItemUI(itemId) {
  const entry        = cart[itemId];
  const qty          = entry ? entry.qty : 0;

  const addBtn       = document.getElementById(`add-btn-${itemId}`);
  const controls     = addBtn?.closest('.action-container')?.querySelector('.item-quantity-controls');
  const qtyDisplay   = controls?.querySelector('.qty');

  if (!addBtn || !controls) return;

  if (qty === 0) {
    addBtn.style.display      = '';
    controls.style.display    = 'none';
  } else {
    addBtn.style.display      = 'none';
    controls.style.display    = 'flex';
    if (qtyDisplay) qtyDisplay.textContent = qty;
  }
}


/* ─────────────────────────────────────────────
   CART ACTIONS  (also called inline from HTML)
───────────────────────────────────────────── */

/**
 * addItemToCart — triggered by "Add" button on dish rows.
 */
function addItemToCart(itemId, name) {
  if (!cart[itemId]) {
    cart[itemId] = { name, qty: 0 };
  }
  cart[itemId].qty += 1;
  saveCart(cart);
  syncItemUI(itemId);
  updateCartUI();
  flashAdd(itemId);
}

/**
 * increaseQuantity — triggered by "+" counter button.
 */
function increaseQuantity(itemId, name) {
  if (!cart[itemId]) cart[itemId] = { name, qty: 0 };
  cart[itemId].qty += 1;
  saveCart(cart);
  syncItemUI(itemId);
  updateCartUI();
}

/**
 * decreaseQuantity — triggered by "−" counter button.
 */
function decreaseQuantity(itemId) {
  if (!cart[itemId]) return;
  cart[itemId].qty -= 1;
  if (cart[itemId].qty <= 0) delete cart[itemId];
  saveCart(cart);
  syncItemUI(itemId);
  updateCartUI();
}

/**
 * addToCart — triggered by deal card "Add" buttons (no item id).
 * These are specials without a DB id, just tracked by name.
 */
function addToCart(name, price, id) {
  const key = id || `deal_${name.replace(/\s+/g, '_')}`;
  if (!cart[key]) cart[key] = { name, qty: 0, price };
  cart[key].qty += 1;
  saveCart(cart);
  updateCartUI();
  // Brief visual feedback on the button
  const btns = document.querySelectorAll('.deal-order');
  btns.forEach(btn => {
    if (btn.closest('.deal-card')?.querySelector('.deal-name')?.textContent === name) {
      btn.textContent = '✓ Added';
      btn.style.background = 'var(--moss-bright)';
      setTimeout(() => {
        btn.textContent = 'Add';
        btn.style.background = '';
      }, 1200);
    }
  });
}

/**
 * Brief scale pulse on the add button to confirm tap.
 */
function flashAdd(itemId) {
  const controls = document.getElementById(`add-btn-${itemId}`)
    ?.closest('.action-container')
    ?.querySelector('.item-quantity-controls');
  if (!controls) return;
  controls.style.transition = 'transform 0.15s ease';
  controls.style.transform  = 'scale(1.08)';
  setTimeout(() => { controls.style.transform = ''; }, 150);
}

/* Restore all counter UIs from saved cart on page load */
function restoreCartUI() {
  Object.keys(cart).forEach(key => {
    const numKey = parseInt(key, 10);
    if (!isNaN(numKey)) syncItemUI(numKey);
  });
  updateCartUI();
}


/* ─────────────────────────────────────────────
   SEARCH
───────────────────────────────────────────── */

const searchInput   = document.getElementById('searchInput');
const searchClear   = document.getElementById('searchClear');
const filteredEmpty = document.getElementById('filteredEmpty');

function runSearch(query) {
  const q = query.trim().toLowerCase();
  searchClear.hidden = q.length === 0;

  const allSections = document.querySelectorAll('.menu-section[data-category]');
  let anyVisible = false;

  allSections.forEach(section => {
    const rows = section.querySelectorAll('.dish-row');
    let sectionHasMatch = false;

    rows.forEach(row => {
      const name = row.querySelector('.dish-name')?.textContent.toLowerCase() ?? '';
      const desc = row.querySelector('.dish-desc')?.textContent.toLowerCase() ?? '';
      const match = !q || name.includes(q) || desc.includes(q);
      row.style.display = match ? '' : 'none';
      if (match) sectionHasMatch = true;
    });

    section.style.display = sectionHasMatch ? '' : 'none';
    if (sectionHasMatch) anyVisible = true;
  });

  // Specials section always shows unless no query matches at all
  const specialsSection = document.getElementById('section-deals');
  if (specialsSection) {
    specialsSection.style.display = !q ? '' : 'none';
  }

  if (filteredEmpty) filteredEmpty.hidden = anyVisible || !q;
}

if (searchInput) {
  searchInput.addEventListener('input', (e) => runSearch(e.target.value));
}

if (searchClear) {
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    runSearch('');
    searchInput.focus();
  });
}


/* ─────────────────────────────────────────────
   ACTIVE TOC LINK (intersection observer)
───────────────────────────────────────────── */

const tocLinks = document.querySelectorAll('.toc-link[data-target]');

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        tocLinks.forEach(link => {
          link.classList.toggle('is-active', link.dataset.target === id);
        });
      }
    });
  },
  {
    rootMargin: '-20% 0px -70% 0px',
    threshold: 0,
  }
);

document.querySelectorAll('.menu-section[id]').forEach(section => {
  sectionObserver.observe(section);
});

// Smooth scroll on TOC link click
tocLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.getElementById(link.dataset.target);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Close sidebar on mobile after navigation
    closeSidebar();
  });
});


/* ─────────────────────────────────────────────
   MOBILE SIDEBAR
───────────────────────────────────────────── */

const tocSidebar = document.getElementById('tocSidebar');
const tocScrim   = document.getElementById('tocScrim');
const mobileToggle = document.getElementById('mobileNavToggle');

function openSidebar() {
  tocSidebar?.classList.add('is-open');
  tocScrim?.classList.add('is-visible');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  tocSidebar?.classList.remove('is-open');
  tocScrim?.classList.remove('is-visible');
  document.body.style.overflow = '';
}

mobileToggle?.addEventListener('click', openSidebar);
tocScrim?.addEventListener('click', closeSidebar);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && tocSidebar?.classList.contains('is-open')) closeSidebar();
});


/* ─────────────────────────────────────────────
   THEME TOGGLE  (light / dark)
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

// Restore saved preference
const savedTheme = localStorage.getItem(THEME_KEY);
if (savedTheme) applyTheme(savedTheme);

document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
document.getElementById('themeToggleDesktop')?.addEventListener('click', toggleTheme);


/* ─────────────────────────────────────────────
   COUNTDOWN TIMER (specials section)
   Counts down to midnight — resets each day.
───────────────────────────────────────────── */

const countdownEl = document.getElementById('countdownTimer');

function updateCountdown() {
  if (!countdownEl) return;
  const now      = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff = Math.max(0, Math.floor((midnight - now) / 1000));

  const h  = String(Math.floor(diff / 3600)).padStart(2, '0');
  const m  = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
  const s  = String(diff % 60).padStart(2, '0');
  countdownEl.textContent = `${h}:${m}:${s}`;
}

updateCountdown();
setInterval(updateCountdown, 1000);


/* ─────────────────────────────────────────────
   GSAP ENTRANCE ANIMATIONS (optional — only if GSAP loaded)
───────────────────────────────────────────── */

function runEntranceAnimations() {
  if (typeof gsap === 'undefined') return;

  // Page header
  gsap.from('.menu-doc-head', {
    y: 20, opacity: 0, duration: 0.55, ease: 'power2.out', delay: 0.05
  });

  // Deal cards staggered
  gsap.from('.deal-card', {
    y: 16, opacity: 0, duration: 0.45, ease: 'power2.out',
    stagger: 0.08, delay: 0.15
  });

  // Dish rows staggered (first visible section only)
  gsap.from('.dish-row', {
    y: 10, opacity: 0, duration: 0.35, ease: 'power2.out',
    stagger: 0.03, delay: 0.2
  });
}

/* ─────────────────────────────────────────────
   HOVER PREVIEW CARD (desktop)
───────────────────────────────────────────── */

const hoverPreview     = document.getElementById('hoverPreview');
const hoverPreviewImg   = document.getElementById('hoverPreviewImg');
const hoverPreviewName  = document.getElementById('hoverPreviewName');
const hoverPreviewPrice = document.getElementById('hoverPreviewPrice');

function attachHoverPreviewListeners() {
  if (!hoverPreview) return;

  document.querySelectorAll('.dish-row').forEach(row => {
    const thumb = row.querySelector('.dish-thumb');
    if (!thumb) return; // only show preview for items that actually have an image

    row.addEventListener('mouseenter', () => {
      const name  = row.querySelector('.dish-name')?.textContent ?? '';
      const price = row.querySelector('.dish-price')?.textContent ?? '';

      hoverPreviewImg.src = thumb.src;
      hoverPreviewImg.alt = name;
      hoverPreviewName.textContent = name;
      hoverPreviewPrice.textContent = price;

      positionHoverPreview(row);
      hoverPreview.classList.add('is-visible');
    });

    row.addEventListener('mouseleave', () => {
      hoverPreview.classList.remove('is-visible');
    });
  });
}

function positionHoverPreview(row) {
  const rect = row.getBoundingClientRect();
  const previewWidth = 180;
  const gap = 16;

  let left = rect.right + gap;
  // flip to the left side if it would overflow the viewport
  if (left + previewWidth > window.innerWidth) {
    left = rect.left - previewWidth - gap;
  }

  let top = rect.top;
  const previewHeight = 160;
  if (top + previewHeight > window.innerHeight) {
    top = window.innerHeight - previewHeight - 12;
  }

  hoverPreview.style.left = `${left}px`;
  hoverPreview.style.top  = `${top}px`;
}


/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  restoreCartUI();
  runEntranceAnimations();
  attachHoverPreviewListeners();
});