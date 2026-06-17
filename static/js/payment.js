/**
 * payment.js — Cozy Cafe Admin · Payments & UPI
 *
 * Wires the 2-step auth modal to real Flask endpoints:
 *   POST /admin/api/payment-verify-password
 *   POST /admin/api/payment-verify-totp
 *   POST /admin/api/payment-save
 *   POST /admin/api/payment-qr-upload
 *   POST /admin/api/payment-qr-remove
 *   GET  /admin/api/payment-settings
 */

'use strict';

/* ─────────────────────────────────────────────
   CSRF helper — reads the meta tag in base.html
───────────────────────────────────────────── */
function getCsrf() {
  return document.querySelector('meta[name="csrf-token"]')?.content ?? '';
}

function jsonHeaders() {
  return { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() };
}


/* ─────────────────────────────────────────────
   STATE
───────────────────────────────────────────── */
let pendingAction = null;   // 'edit' | 'qr' | 'remove-qr'
let pendingFile   = null;   // File object waiting for auth before upload
let isEditMode    = false;
let originalValues = {};


/* ─────────────────────────────────────────────
   INIT — load settings on page load
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();

  /* Close modal when clicking the dark backdrop */
  document.getElementById('auth-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('auth-modal')) closeAuthModal();
  });

  /* Escape key closes modal */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAuthModal();
  });

  /* Enter key in password field advances to next step */
  document.getElementById('modal-password')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') verifyPassword();
  });

  /* OTP paste support */
  document.querySelectorAll('.pay-otp-input').forEach((input, idx) => {
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      const boxes  = document.querySelectorAll('.pay-otp-input');
      pasted.split('').forEach((char, i) => { if (boxes[i]) boxes[i].value = char; });
      const next = Math.min(pasted.length, boxes.length - 1);
      boxes[next]?.focus();
    });
  });
});


/* ─────────────────────────────────────────────
   LOAD SETTINGS FROM SERVER
───────────────────────────────────────────── */
function loadSettings() {
  fetch('/admin/api/payment-settings')
    .then(r => r.json())
    .then(({ data, error }) => {
      if (error) { showToast(error, 'error'); return; }

      setField('upi-id',           data.upi_id);
      setField('account-name',     data.account_name);
      setField('pay-instructions', data.instructions);

      /* Sync stat card */
      const statUpi = document.getElementById('stat-upi-id');
      if (statUpi) statUpi.textContent = data.upi_id || '—';

      /* Sync QR label */
      const qrLabel = document.getElementById('qr-upi-label');
      if (qrLabel) qrLabel.textContent = data.upi_id || '—';

      /* QR image */
      if (data.qr_image_base64) {
        displayQrImage(data.qr_image_base64);
      }
    })
    .catch(err => { console.error('loadSettings:', err); });
}

function setField(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value !== undefined ? (el.value = val ?? '') : (el.textContent = val ?? '');
}


/* ─────────────────────────────────────────────
   EDIT MODE
───────────────────────────────────────────── */
function enterEditMode() {
  isEditMode = true;
  const fields = document.querySelectorAll('#upi-id, #account-name, #pay-instructions');

  originalValues = {};
  fields.forEach(f => {
    originalValues[f.id] = f.value;
    f.removeAttribute('readonly');
    f.classList.add('field--editable');
  });

  document.getElementById('btn-edit').style.display   = 'none';
  document.getElementById('btn-save').style.display   = '';
  document.getElementById('btn-cancel').style.display = '';
  document.getElementById('upi-id')?.focus();
}

function exitEditMode(save = false) {
  isEditMode = false;
  const fields = document.querySelectorAll('#upi-id, #account-name, #pay-instructions');

  fields.forEach(f => {
    if (!save) f.value = originalValues[f.id] ?? f.value;
    f.setAttribute('readonly', '');
    f.classList.remove('field--editable');
  });

  document.getElementById('btn-edit').style.display   = '';
  document.getElementById('btn-save').style.display   = 'none';
  document.getElementById('btn-cancel').style.display = 'none';
}

/* Called by Cancel button */
function cancelEdit() {
  exitEditMode(false);
  showToast('Edit cancelled.', 'info');
}

/* Called by Save Changes button */
function savePaymentDetails() {
  const upiId      = document.getElementById('upi-id')?.value.trim()           ?? '';
  const accName    = document.getElementById('account-name')?.value.trim()     ?? '';
  const instrText  = document.getElementById('pay-instructions')?.value.trim() ?? '';

  const upiRegex = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;
  if (upiId && !upiRegex.test(upiId)) {
    showToast('Invalid UPI ID format (e.g. name@upi)', 'error');
    document.getElementById('upi-id')?.focus();
    return;
  }

  const saveBtn = document.getElementById('btn-save');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

  fetch('/admin/api/payment-save', {
    method:  'POST',
    headers: jsonHeaders(),
    body:    JSON.stringify({ upi_id: upiId, account_name: accName, instructions: instrText }),
  })
    .then(r => r.json())
    .then(({ success, data, error }) => {
      if (!success) throw new Error(error || 'Save failed.');

      exitEditMode(true);

      /* Sync live displays */
      const statUpi = document.getElementById('stat-upi-id');
      if (statUpi) statUpi.textContent = data.upi_id || '—';
      const qrLabel = document.getElementById('qr-upi-label');
      if (qrLabel) qrLabel.textContent = data.upi_id || '—';

      showToast('Payment details saved.', 'success');
    })
    .catch(err => showToast(err.message, 'error'))
    .finally(() => {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Changes'; }
    });
}


/* ─────────────────────────────────────────────
   QR CODE
───────────────────────────────────────────── */
function displayQrImage(dataUrl) {
  const img         = document.getElementById('qr-img');
  const placeholder = document.getElementById('qr-placeholder');
  const statusTag   = document.getElementById('qr-status-tag');

  if (img)         { img.src = dataUrl; img.style.display = ''; }
  if (placeholder) placeholder.style.display = 'none';
  if (statusTag)   { statusTag.textContent = 'Active'; statusTag.className = 'tag tag--green pay-card__status-tag'; }
}

function clearQrImage() {
  const img         = document.getElementById('qr-img');
  const placeholder = document.getElementById('qr-placeholder');
  const statusTag   = document.getElementById('qr-status-tag');

  if (img)         { img.src = ''; img.style.display = 'none'; }
  if (placeholder) placeholder.style.display = '';
  if (statusTag)   { statusTag.textContent = 'Not Set'; statusTag.className = 'tag tag--amber pay-card__status-tag'; }
}

/* Trigger hidden file input (called after auth OK for 'qr') */
function triggerQrFilePicker() {
  document.getElementById('qr-upload-input')?.click();
}

/* File selected from picker */
function handleQrUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Please select a valid image file.', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('Image must be under 5 MB.', 'error');
    return;
  }

  /* Store the file then auth */
  pendingFile = file;
  openAuthModal('qr');

  /* Reset input so the same file can be re-selected later */
  e.target.value = '';
}

function uploadQrToServer(file) {
  const formData = new FormData();
  formData.append('qr_image', file);

  fetch('/admin/api/payment-qr-upload', {
    method:  'POST',
    headers: { 'X-CSRFToken': getCsrf() },   // no Content-Type — let browser set boundary
    body:    formData,
  })
    .then(r => r.json())
    .then(({ success, qr_image_base64, error }) => {
      if (!success) throw new Error(error || 'Upload failed.');
      displayQrImage(qr_image_base64);
      showToast('QR Code uploaded successfully.', 'success');
    })
    .catch(err => showToast(err.message, 'error'));
}

function removeQrFromServer() {
  fetch('/admin/api/payment-qr-remove', {
    method:  'POST',
    headers: jsonHeaders(),
    body:    JSON.stringify({}),
  })
    .then(r => r.json())
    .then(({ success, error }) => {
      if (!success) throw new Error(error || 'Remove failed.');
      clearQrImage();
      showToast('QR Code removed.', 'info');
    })
    .catch(err => showToast(err.message, 'error'));
}

/* Download button */
function downloadQr() {
  const img = document.getElementById('qr-img');
  if (!img || !img.src || img.style.display === 'none') {
    showToast('No QR Code to download.', 'error');
    return;
  }
  const link = document.createElement('a');
  link.href = img.src;
  link.download = 'cozy-cafe-upi-qr.png';
  link.click();
}

/* Copy UPI ID */
function copyUpiId() {
  const val = document.getElementById('upi-id')?.value;
  if (!val) return;
  navigator.clipboard.writeText(val)
    .then(() => showToast('UPI ID copied.', 'success'))
    .catch(()  => showToast('Copy failed.', 'error'));
}


/* ─────────────────────────────────────────────
   AUTH MODAL — open / close / reset
───────────────────────────────────────────── */

/**
 * Open the 2-step verification modal.
 * action: 'edit' | 'qr' | 'remove-qr'
 */
function openAuthModal(action) {
  pendingAction = action;
  resetAuthModal();

  const titleMap = {
    'edit':      'Verify to Edit Details',
    'qr':        'Verify to Upload QR',
    'remove-qr': 'Verify to Remove QR',
  };
  const el = document.getElementById('modal-title');
  if (el) el.textContent = titleMap[action] ?? 'Identity Verification';

  document.getElementById('auth-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('modal-password')?.focus(), 80);
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.remove('open');
  document.body.style.overflow = '';
  /* Keep pendingFile: user may re-open without re-selecting */
  resetAuthModal();
}

function resetAuthModal() {
  goToStep(1);

  const passInput = document.getElementById('modal-password');
  if (passInput) { passInput.value = ''; passInput.type = 'password'; }

  setError('password-error', '');
  setError('totp-error', '');
  document.querySelectorAll('.pay-otp-input').forEach(i => { i.value = ''; });
}


/* ─────────────────────────────────────────────
   AUTH MODAL — step navigation
───────────────────────────────────────────── */
function goToStep(n) {
  const s1 = document.getElementById('modal-step-1');
  const s2 = document.getElementById('modal-step-2');
  const i1 = document.getElementById('step-indicator-1');
  const i2 = document.getElementById('step-indicator-2');

  if (n === 1) {
    if (s1) s1.style.display = '';
    if (s2) s2.style.display = 'none';
    i1?.classList.add('pay-modal__step--active');
    i2?.classList.remove('pay-modal__step--active');
  } else {
    if (s1) s1.style.display = 'none';
    if (s2) s2.style.display = '';
    i1?.classList.remove('pay-modal__step--active');
    i2?.classList.add('pay-modal__step--active');
  }
}

function goBackToStep1() {
  setError('totp-error', '');
  goToStep(1);
  document.getElementById('modal-password')?.focus();
}


/* ─────────────────────────────────────────────
   AUTH MODAL — Step 1: Password
───────────────────────────────────────────── */
function verifyPassword() {
  const passInput = document.getElementById('modal-password');
  const pass = passInput?.value ?? '';

  if (!pass) {
    setError('password-error', 'Please enter your password.');
    passInput?.focus();
    return;
  }

  const btn = document.querySelector('#modal-step-1 .pay-btn--primary');
  setLoading(btn, true, 'Checking…');

  fetch('/admin/api/payment-verify-password', {
    method:  'POST',
    headers: jsonHeaders(),
    body:    JSON.stringify({ password: pass }),
  })
    .then(r => r.json())
    .then(({ success, error }) => {
      if (!success) {
        setError('password-error', error || 'Incorrect password.');
        passInput?.focus();
        return;
      }
      setError('password-error', '');
      goToStep(2);
      document.querySelectorAll('.pay-otp-input')[0]?.focus();
    })
    .catch(() => setError('password-error', 'Network error. Please try again.'))
    .finally(() => setLoading(btn, false, 'Continue'));
}


/* ─────────────────────────────────────────────
   AUTH MODAL — Step 2: TOTP
───────────────────────────────────────────── */
function verifyTotp() {
  const boxes = document.querySelectorAll('.pay-otp-input');
  const code  = Array.from(boxes).map(b => b.value).join('');

  if (code.length < 6) {
    setError('totp-error', 'Please enter all 6 digits.');
    return;
  }

  const btn = document.querySelector('#modal-step-2 .pay-btn--primary');
  setLoading(btn, true, 'Verifying…');

  fetch('/admin/api/payment-verify-totp', {
    method:  'POST',
    headers: jsonHeaders(),
    body:    JSON.stringify({ code }),
  })
    .then(r => r.json())
    .then(({ success, error }) => {
      if (!success) {
        setError('totp-error', error || 'Invalid code. Please try again.');
        boxes.forEach(b => b.value = '');
        boxes[0]?.focus();
        return;
      }
      /* ✅ Fully authorised — execute the pending action */
      executeAction();
      closeAuthModal();
    })
    .catch(() => setError('totp-error', 'Network error. Please try again.'))
    .finally(() => setLoading(btn, false, 'Verify & Proceed'));
}

/* Dispatch to the correct action after auth success */
function executeAction() {
  console.log("Executing action:", pendingAction);

  switch (pendingAction) {
    case 'edit':
      enterEditMode();
      break;

    case 'qr':
      if (pendingFile) {
        uploadQrToServer(pendingFile);
        pendingFile = null;
      } else {
        triggerQrFilePicker();
      }
      break;

    case 'remove-qr':
      removeQrFromServer();
      break;

    default:
      console.warn("No pending action found.");
      break;
  }

  // Clear action AFTER it has been executed
  pendingAction = null;
}

/* ─────────────────────────────────────────────
   OTP INPUT HELPERS (called via inline HTML attrs)
───────────────────────────────────────────── */
function otpInput(el, idx) {
  el.value = el.value.replace(/\D/g, '').slice(0, 1);
  const boxes = document.querySelectorAll('.pay-otp-input');
  if (el.value && idx < boxes.length - 1) boxes[idx + 1].focus();
}

function otpKeydown(e, idx) {
  const boxes = document.querySelectorAll('.pay-otp-input');
  if (e.key === 'Backspace' && !e.target.value && idx > 0) boxes[idx - 1].focus();
  if (e.key === 'Enter') verifyTotp();
}


/* ─────────────────────────────────────────────
   PASSWORD VISIBILITY TOGGLE
───────────────────────────────────────────── */
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const hidden = input.type === 'password';
  input.type = hidden ? 'text' : 'password';

  const eyeOpen   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const eyeClosed = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
  btn.innerHTML = hidden ? eyeClosed : eyeOpen;
}


/* ─────────────────────────────────────────────
   TOAST
───────────────────────────────────────────── */
let _toastTimer;
function showToast(msg, type = 'success') {
  const toast = document.getElementById('pay-toast');
  if (!toast) return;
  clearTimeout(_toastTimer);
  toast.textContent = msg;
  toast.className   = `pay-toast pay-toast--${type} show`;
  _toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}


/* ─────────────────────────────────────────────
   MICRO-HELPERS
───────────────────────────────────────────── */
function setError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function setLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled     = loading;
  btn.textContent  = label;
}