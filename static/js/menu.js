/* ─────────────────────────────────────────────────────────
   Cozy Cafe · menu.js
   ───────────────────────────────────────────────────────── */

/* ══════════════════════════════════
   STATE
══════════════════════════════════ */
const state = {
  activeCat   : 'all',
  activeAvail : 'all',
  searchQuery : '',
  sortBy      : 'default',
  viewMode    : 'grid',
  deleteTarget: { id: null, name: '' },
};

/* ══════════════════════════════════
   CSRF
══════════════════════════════════ */
const CSRF = document.querySelector('meta[name="csrf-token"]')?.content || '';

/* ══════════════════════════════════
   DOM REFS
══════════════════════════════════ */
const menuContainer    = document.getElementById('menuContainer');
const allCards         = () => menuContainer.querySelectorAll('.mn-card');
const emptyState       = document.getElementById('emptyState');
const searchInput      = document.getElementById('searchInput');
const searchClear      = document.getElementById('searchClear');
const sortSelect       = document.getElementById('sortSelect');
const availFilter      = document.getElementById('availFilter');
const viewGrid         = document.getElementById('viewGrid');
const viewList         = document.getElementById('viewList');
const categoryFilters  = document.getElementById('categoryFilters');

// Dish modal
const dishModal        = document.getElementById('dishModal');
const dishModalBack    = document.getElementById('dishModalBackdrop');
const modalClose       = document.getElementById('modalClose');
const modalCancel      = document.getElementById('modalCancel');
const dishForm         = document.getElementById('dishForm');
const modalTitle       = document.getElementById('modalTitle');
const modalSubmit      = document.getElementById('modalSubmit');
const dishId           = document.getElementById('dishId');
const btnAddDish       = document.getElementById('btnAddDish');

// Delete modal
const deleteModal      = document.getElementById('deleteModal');
const deleteModalBack  = document.getElementById('deleteModalBackdrop');
const deleteModalClose = document.getElementById('deleteModalClose');
const deleteCancelBtn  = document.getElementById('deleteCancelBtn');
const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');
const deleteName       = document.getElementById('deleteName');

// Categories modal
const catModal         = document.getElementById('catModal');
const catModalBack     = document.getElementById('catModalBackdrop');
const catModalClose    = document.getElementById('catModalClose');
const btnManageCats    = document.getElementById('btnManageCategories');
const newCatInput      = document.getElementById('newCatInput');
const addCatBtn        = document.getElementById('addCatBtn');

const toast            = document.getElementById('toast');

/* ══════════════════════════════════
   FILTERING & SORTING
══════════════════════════════════ */
function applyFilters() {
  const cards = allCards();
  let visible = 0;

  const sorted = Array.from(cards).sort((a, b) => {
    const s = state.sortBy;
    if (s === 'name_asc')   return a.dataset.name.localeCompare(b.dataset.name);
    if (s === 'name_desc')  return b.dataset.name.localeCompare(a.dataset.name);
    if (s === 'price_asc')  return parseFloat(a.dataset.price) - parseFloat(b.dataset.price);
    if (s === 'price_desc') return parseFloat(b.dataset.price) - parseFloat(a.dataset.price);
    return 0;
  });

  sorted.forEach(card => menuContainer.appendChild(card));

  sorted.forEach(card => {
    const catMatch   = state.activeCat   === 'all' || card.dataset.cat === state.activeCat;
    const availMatch = state.activeAvail === 'all' || card.dataset.avail === state.activeAvail;
    const nameMatch  = card.dataset.name.includes(state.searchQuery);
    const show = catMatch && availMatch && nameMatch;
    card.style.display = show ? '' : 'none';
    if (show) visible++;
  });

  if (emptyState) {
    emptyState.style.display = visible === 0 && cards.length > 0 ? 'flex' : 'none';
  }
}

categoryFilters.addEventListener('click', e => {
  const btn = e.target.closest('.mn-filter');
  if (!btn) return;
  categoryFilters.querySelectorAll('.mn-filter').forEach(b => b.classList.remove('mn-filter--active'));
  btn.classList.add('mn-filter--active');
  state.activeCat = btn.dataset.cat;
  applyFilters();
});

searchInput.addEventListener('input', () => {
  state.searchQuery = searchInput.value.trim().toLowerCase();
  searchClear.style.display = state.searchQuery ? '' : 'none';
  applyFilters();
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  state.searchQuery = '';
  searchClear.style.display = 'none';
  searchInput.focus();
  applyFilters();
});

sortSelect.addEventListener('change', () => {
  state.sortBy = sortSelect.value;
  applyFilters();
});

availFilter.addEventListener('change', () => {
  state.activeAvail = availFilter.value;
  applyFilters();
});

viewGrid.addEventListener('click', () => setView('grid'));
viewList.addEventListener('click', () => setView('list'));

function setView(mode) {
  state.viewMode = mode;
  menuContainer.classList.toggle('mn-grid--list', mode === 'list');
  viewGrid.classList.toggle('mn-view-btn--active', mode === 'grid');
  viewList.classList.toggle('mn-view-btn--active', mode === 'list');
}

function resetFilters() {
  categoryFilters.querySelectorAll('.mn-filter').forEach((b, i) => {
    b.classList.toggle('mn-filter--active', i === 0);
  });
  state.activeCat = 'all';
  searchInput.value = '';
  state.searchQuery = '';
  searchClear.style.display = 'none';
  availFilter.value = 'all';
  state.activeAvail = 'all';
  sortSelect.value = 'default';
  state.sortBy = 'default';
  applyFilters();
}

/* ══════════════════════════════════
   DISH MODAL
══════════════════════════════════ */
function openDishModal(editMode = false) {
  dishModal.classList.add('visible');
  dishModalBack.classList.add('visible');
  modalTitle.textContent = editMode ? 'Edit Dish' : 'Add Dish';
  modalSubmit.textContent = editMode ? 'Save Changes' : 'Add Dish';
  document.body.style.overflow = 'hidden';
}

function closeDishModal() {
  dishModal.classList.remove('visible');
  dishModalBack.classList.remove('visible');
  dishForm.reset();
  dishId.value = '';
  clearFormErrors();
  document.body.style.overflow = '';
}

btnAddDish.addEventListener('click', () => {
  dishId.value = '';
  openDishModal(false);
});
modalClose.addEventListener('click', closeDishModal);
modalCancel.addEventListener('click', closeDishModal);
dishModalBack.addEventListener('click', closeDishModal);

window.editDish = function(id) {
  fetch(`/admin/menu/item/${id}`)
    .then(r => r.json())
    .then(data => {
      if (!data.success) { showToast('Could not load dish', 'error'); return; }
      const item = data.item;
      dishId.value                  = item.id;
      dishForm.item_name.value      = item.item_name;
      dishForm.price.value          = item.item_price;
      dishForm.category_id.value    = item.category_id || '';
      dishForm.description.value    = item.description || '';
      dishForm.image_url.value      = item.image_url || '';
      dishForm.is_available.checked = item.is_available;
      const vegVal = item.is_veg === true ? 'true' : item.is_veg === false ? 'false' : null;
      if (vegVal) {
        const radio = dishForm.querySelector(`input[name="is_veg"][value="${vegVal}"]`);
        if (radio) radio.checked = true;
      }
      openDishModal(true);
    })
    .catch(() => showToast('Network error', 'error'));
};

dishForm.addEventListener('submit', e => {
  e.preventDefault();
  clearFormErrors();

  const name  = dishForm.item_name.value.trim();
  const price = parseFloat(dishForm.price.value);
  const cat   = dishForm.category_id.value;

  let valid = true;
  if (!name)                        { markError('fieldName',     'Required');            valid = false; }
  if (isNaN(price) || price < 0)    { markError('fieldPrice',    'Enter a valid price'); valid = false; }
  if (!cat)                         { markError('fieldCategory', 'Pick a category');     valid = false; }
  if (!valid) return;

  const body = {
    item_name   : name,
    price       : price,
    category_id : cat,
    description : dishForm.description.value.trim(),
    image_url   : dishForm.image_url.value.trim(),
    is_available: dishForm.is_available.checked,
    is_veg      : dishForm.querySelector('input[name="is_veg"]:checked')?.value ?? null,
  };

  const id     = dishId.value;
  const url    = id ? `/admin/menu/item/${id}` : '/admin/menu/item';
  const method = id ? 'PUT' : 'POST';

  modalSubmit.disabled = true;
  modalSubmit.textContent = 'Saving…';

  fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken' : CSRF,
    },
    body: JSON.stringify(body),
  })
  .then(r => r.json())
  .then(data => {
  if (data.success) {

    const item = data.item;

    const card = document.querySelector(
      `.mn-card[data-id="${item.id}"]`
    );

    if (card) {

      card.dataset.name = item.item_name.toLowerCase();
      card.dataset.price = item.item_price;
      card.dataset.cat = item.category_id;
      card.dataset.avail = item.is_available
        ? 'available'
        : 'hidden';

      const name = card.querySelector('.mn-card__name');
      if (name) name.textContent = item.item_name;

      const desc = card.querySelector('.mn-card__desc');
      if (desc) desc.textContent = item.description || '';

      const price = card.querySelector('.mn-card__price');
      if (price) price.textContent = `₹${item.item_price}`;

      const badge = card.querySelector('.mn-card__avail-badge');
      if (badge) {
        badge.textContent = item.is_available
          ? 'Available'
          : 'Hidden';

        badge.className =
          `mn-card__avail-badge mn-card__avail-badge--${
            item.is_available ? 'on' : 'off'
          }`;
      }

      const img = card.querySelector('img');
      if (img && item.image_url) {
        img.src = item.image_url;
      }
    }

    showToast('Dish updated', 'success');
    closeDishModal();
    applyFilters();
  }
})
  .catch(() => showToast('Network error', 'error'))
  .finally(() => {
    modalSubmit.disabled = false;
    modalSubmit.textContent = id ? 'Save Changes' : 'Add Dish';
  });
});

/* ══════════════════════════════════
   TOGGLE AVAILABILITY
══════════════════════════════════ */
window.toggleAvailability = function(id, currentlyAvailable) {
  fetch(`/admin/menu/item/${id}/toggle`, {
    method : 'POST',
    headers: { 'X-CSRFToken': CSRF },
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      const card  = menuContainer.querySelector(`.mn-card[data-id="${id}"]`);
      if (!card) return;
      const isNow = data.is_available;
      card.dataset.avail = isNow ? 'available' : 'hidden';
      const badge = card.querySelector('.mn-card__avail-badge');
      if (badge) {
        badge.textContent = isNow ? 'Available' : 'Hidden';
        badge.className   = `mn-card__avail-badge mn-card__avail-badge--${isNow ? 'on' : 'off'}`;
      }
      showToast(`Dish ${isNow ? 'made available' : 'hidden'}`, 'success');
      applyFilters();
    } else {
      showToast(data.error || 'Failed to toggle', 'error');
    }
  })
  .catch(() => showToast('Network error', 'error'));
};

/* ══════════════════════════════════
   DELETE MODAL
══════════════════════════════════ */
window.confirmDelete = function(id, name) {
  state.deleteTarget = { id, name };
  deleteName.textContent = name;
  deleteModal.classList.add('visible');
  deleteModalBack.classList.add('visible');
  document.body.style.overflow = 'hidden';
};

function closeDeleteModal() {
  deleteModal.classList.remove('visible');
  deleteModalBack.classList.remove('visible');
  document.body.style.overflow = '';
}

deleteModalClose.addEventListener('click', closeDeleteModal);
deleteCancelBtn.addEventListener('click', closeDeleteModal);
deleteModalBack.addEventListener('click', closeDeleteModal);

deleteConfirmBtn.addEventListener('click', () => {
  const { id, name } = state.deleteTarget;
  if (!id) return;

  deleteConfirmBtn.disabled = true;
  deleteConfirmBtn.textContent = 'Deleting…';

  fetch(`/admin/menu/item/${id}`, {
    method : 'DELETE',
    headers: { 'X-CSRFToken': CSRF },
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      const card = menuContainer.querySelector(`.mn-card[data-id="${id}"]`);
      if (card) {
        card.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        card.style.opacity    = '0';
        card.style.transform  = 'scale(0.95)';
        setTimeout(() => card.remove(), 220);
      }
      closeDeleteModal();
      showToast(`"${name}" removed`, 'success');
      updateStatCounts();
      applyFilters();
    } else {
      showToast(data.error || 'Delete failed', 'error');
    }
  })
  .catch(() => showToast('Network error', 'error'))
  .finally(() => {
    deleteConfirmBtn.disabled = false;
    deleteConfirmBtn.textContent = 'Delete Dish';
  });
});

/* ══════════════════════════════════
   CATEGORIES MODAL
══════════════════════════════════ */
btnManageCats.addEventListener('click', () => {
  catModal.classList.add('visible');
  catModalBack.classList.add('visible');
  document.body.style.overflow = 'hidden';
});

function closeCatModal() {
  catModal.classList.remove('visible');
  catModalBack.classList.remove('visible');
  document.body.style.overflow = '';
}

catModalClose.addEventListener('click', closeCatModal);
catModalBack.addEventListener('click', closeCatModal);

addCatBtn.addEventListener('click', addCategory);
newCatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); addCategory(); }
});

function addCategory() {
  const name = newCatInput.value.trim();
  if (!name) return;

  addCatBtn.disabled = true;

  fetch('/admin/menu/category', {
    method : 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken' : CSRF,
    },
    body: JSON.stringify({ name }),
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      newCatInput.value = '';
      const catList = document.getElementById('catList');
      const row = document.createElement('div');
      row.className  = 'mn-cat-row';
      row.dataset.id = data.category.id;
      row.innerHTML  = `
        <span class="mn-cat-row__name">${escHtml(data.category.name)}</span>
        <button class="mn-cat-row__del" onclick="deleteCategory(${data.category.id})" aria-label="Delete ${escHtml(data.category.name)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      `;
      catList.appendChild(row);

      const pill = document.createElement('button');
      pill.className   = 'mn-filter';
      pill.dataset.cat = data.category.id;
      pill.textContent = data.category.name;
      categoryFilters.appendChild(pill);

      const opt = new Option(data.category.name, data.category.id);
      document.getElementById('fieldCategory').add(opt);

      updateCatCount();
      showToast('Category added', 'success');
    } else {
      showToast(data.error || 'Failed', 'error');
    }
  })
  .catch(() => showToast('Network error', 'error'))
  .finally(() => { addCatBtn.disabled = false; });
}

window.deleteCategory = function(id) {
  if (!confirm('Delete this category?')) return;

  fetch(`/admin/menu/category/${id}`, {
    method : 'DELETE',
    headers: { 'X-CSRFToken': CSRF },
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      document.querySelector(`.mn-cat-row[data-id="${id}"]`)?.remove();
      document.querySelector(`.mn-filter[data-cat="${id}"]`)?.remove();
      document.querySelector(`#fieldCategory option[value="${id}"]`)?.remove();
      if (state.activeCat === String(id)) {
        state.activeCat = 'all';
        document.querySelector('.mn-filter[data-cat="all"]')?.classList.add('mn-filter--active');
        applyFilters();
      }
      updateCatCount();
      showToast('Category deleted', 'success');
    } else {
      showToast(data.error || 'Cannot delete — dishes use this category', 'error');
    }
  })
  .catch(() => showToast('Network error', 'error'));
};

/* ══════════════════════════════════
   STAT COUNT HELPERS
══════════════════════════════════ */
function updateStatCounts() {
  const cards = allCards();
  document.getElementById('statTotal').textContent     = cards.length;
  document.getElementById('statAvailable').textContent = Array.from(cards).filter(c => c.dataset.avail === 'available').length;
  document.getElementById('statHidden').textContent    = Array.from(cards).filter(c => c.dataset.avail === 'hidden').length;
}

function updateCatCount() {
  const count = document.querySelectorAll('.mn-filter:not([data-cat="all"])').length;
  document.getElementById('statCategories').textContent = count;
}

/* ══════════════════════════════════
   FORM VALIDATION HELPERS
══════════════════════════════════ */
function markError(fieldId, msg) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.classList.add('error');
  const hint = document.createElement('span');
  hint.className = 'mn-field-error';
  hint.style.cssText = 'font-size:0.7rem;color:var(--error);margin-top:0.15rem;display:block;';
  hint.textContent = msg;
  el.parentNode.appendChild(hint);
}

function clearFormErrors() {
  dishForm.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
  dishForm.querySelectorAll('.mn-field-error').forEach(el => el.remove());
}

/* ══════════════════════════════════
   TOAST
══════════════════════════════════ */
let toastTimer = null;

function showToast(msg, type = '') {
  toast.textContent = msg;
  toast.className   = `mn-toast${type ? ' mn-toast--' + type : ''}`;
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

/* ══════════════════════════════════
   KEYBOARD SHORTCUTS
══════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (dishModal.classList.contains('visible'))   { closeDishModal();   return; }
    if (deleteModal.classList.contains('visible')) { closeDeleteModal(); return; }
    if (catModal.classList.contains('visible'))    { closeCatModal();    return; }
  }
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    e.preventDefault();
    searchInput.focus();
  }
});

/* ══════════════════════════════════
   UTIL
══════════════════════════════════ */
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ══════════════════════════════════
   INIT
══════════════════════════════════ */
applyFilters();