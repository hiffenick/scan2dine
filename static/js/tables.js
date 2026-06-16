/* ─── Cozy Cafe · tables.js ─────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ══ STATE ══ */
  let allQRs      = [];   // raw from /api/all-table-qrs
  let activeFilter = 'all';
  let activeSearch = '';
  let openQR       = null; // currently open in modal

  /* ══ INIT ══ */
  document.addEventListener('DOMContentLoaded', function () {
    loadTables();

    /* Stop modal from closing when clicking inside it */
    ['tableModal', 'genModal'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', function (e) { e.stopPropagation(); });
    });
  });

  /* ══ DATA ══ */
  function loadTables() {
    return fetch('/admin/api/all-table-qrs')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        allQRs = data;
        updateStats();
        renderGrid();
      })
      .catch(function (err) { console.error('Tables fetch failed:', err); });
  }

  window.refreshTables = function () {
    var btn = document.getElementById('refreshBtn');
    if (btn) {
      var svg = btn.querySelector('svg');
      if (svg) svg.classList.add('spinning');
      setTimeout(function () { if (svg) svg.classList.remove('spinning'); }, 600);
    }
    loadTables();
  };

  /* ══ STATS ══ */
  function updateStats() {
    /* Build unique table numbers from existing QRs */
    var tableNums  = new Set(allQRs.map(function (q) { return q.table_number; }));
    var activeQRs  = allQRs.filter(function (q) { return q.is_active; });
    var inactiveQRs = allQRs.filter(function (q) { return !q.is_active; });

    setText('statTotal',      tableNums.size);
    setText('statActive',     activeQRs.length);
    setText('statInactive',   inactiveQRs.length);
    /* "No QR" doesn't make sense from this API (only returns tables that HAVE QRs)
       so we show it as a prompt count — tables with only inactive QRs */
    var noActiveTable = 0;
    tableNums.forEach(function (t) {
      var hasActive = allQRs.some(function (q) { return q.table_number === t && q.is_active; });
      if (!hasActive) noActiveTable++;
    });
    setText('statUnassigned', noActiveTable);
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /* ══ FILTERING ══ */
  function getFiltered() {
    /* Group by table_number first, pick the latest QR per table */
    var tableMap = {};
    allQRs.forEach(function (q) {
      var t = q.table_number;
      if (!tableMap[t]) {
        tableMap[t] = { table_number: t, qrs: [] };
      }
      tableMap[t].qrs.push(q);
    });

    var rows = Object.values(tableMap).map(function (row) {
      /* Sort qrs by id desc to get latest first */
      row.qrs.sort(function (a, b) { return b.qr_id - a.qr_id; });
      row.latest  = row.qrs[0];
      row.hasActive = row.qrs.some(function (q) { return q.is_active; });
      row.statusKey = row.hasActive ? 'active' : (row.qrs.length ? 'inactive' : 'none');
      return row;
    });

    /* Sort by table_number */
    rows.sort(function (a, b) { return a.table_number - b.table_number; });

    return rows.filter(function (row) {
      if (activeFilter !== 'all' && row.statusKey !== activeFilter) return false;
      if (activeSearch && !String(row.table_number).includes(activeSearch)) return false;
      return true;
    });
  }

  window.setFilter = function (btn) {
    document.querySelectorAll('.tbl-tab').forEach(function (t) { t.classList.remove('tbl-tab--active'); });
    btn.classList.add('tbl-tab--active');
    activeFilter = btn.dataset.filter;
    renderGrid();
  };

  window.filterTables = function () {
    activeSearch = document.getElementById('searchInput').value.trim();
    renderGrid();
  };

  /* ══ RENDER GRID ══ */
  function renderGrid() {
    var grid  = document.getElementById('tableGrid');
    var empty = document.getElementById('tableEmpty');
    var rows  = getFiltered();
    grid.innerHTML = '';

    if (rows.length === 0) {
      empty.style.display = 'flex';
      return;
    }
    empty.style.display = 'none';
    rows.forEach(function (row, i) { grid.appendChild(buildCard(row, i)); });
  }

  function buildCard(row, index) {
    var card = document.createElement('div');
    card.className = 'tbl-card tbl-card--' + row.statusKey;
    card.style.animationDelay = (index * 0.04) + 's';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    var latestQR   = row.latest;
    var statusLabel = row.hasActive ? 'Active' : (row.qrs.length ? 'Inactive' : 'No QR');
    var qrIdLabel   = latestQR ? '#' + latestQR.qr_id : '–';

    var qrThumb = latestQR
      ? '<img src="data:image/png;base64,' + latestQR.qr_image_base64 + '" alt="QR Table ' + row.table_number + '">'
      : '<div class="tbl-card__qr-placeholder">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" width="28" height="28">' +
          '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>' +
          '<rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>' +
          '</svg><span>No QR</span>' +
        '</div>';

    card.innerHTML =
      '<div class="tbl-card__head">' +
        '<div class="tbl-card__num">Table ' + row.table_number +
          '<span>QR ' + qrIdLabel + '</span>' +
        '</div>' +
        '<span class="tbl-status-badge tbl-status-badge--' + row.statusKey + '">' + statusLabel + '</span>' +
      '</div>' +
      '<div class="tbl-card__qr">' + qrThumb + '</div>' +
      '<div class="tbl-card__foot">' +
        '<span class="tbl-card__qr-id">' + row.qrs.length + ' QR' + (row.qrs.length !== 1 ? 's' : '') + ' total</span>' +
        '<div class="tbl-card__actions">' +
          '<button class="tbl-icon-btn" title="View details" data-table="' + row.table_number + '" onclick="event.stopPropagation();openModal(' + row.table_number + ')">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
          '</button>' +
          '<button class="tbl-icon-btn" title="Generate new QR" onclick="event.stopPropagation();openGenerateModal(' + row.table_number + ')">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
          '</button>' +
          (latestQR
            ? '<button class="tbl-icon-btn tbl-icon-btn--danger" title="Delete latest QR" onclick="event.stopPropagation();confirmDelete(' + latestQR.qr_id + ', ' + row.table_number + ')">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>' +
              '</button>'
            : '') +
        '</div>' +
      '</div>';

    card.onclick = function () { openModal(row.table_number); };
    card.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') openModal(row.table_number); };

    return card;
  }

  /* ══ DETAIL MODAL ══ */
  window.openModal = function (tableNumber) {
    var tableMap = buildTableMap();
    var row = tableMap[tableNumber];
    if (!row) return;
    openQR = row;

    document.getElementById('modalEyebrow').textContent = 'TABLE · ' + tableNumber;
    document.getElementById('modalTitle').textContent   = 'Table ' + tableNumber;

    var latestQR = row.latest;
    var body = document.getElementById('modalBody');
    var footer = document.getElementById('modalFooter');
    body.innerHTML = '';
    footer.innerHTML = '';

    if (latestQR) {
      /* QR image */
      var qrDiv = document.createElement('div');
      qrDiv.className = 'tbl-modal-qr';
      var img = document.createElement('img');
      img.src = 'data:image/png;base64,' + latestQR.qr_image_base64;
      img.alt = 'QR Code Table ' + tableNumber;
      qrDiv.appendChild(img);
      body.appendChild(qrDiv);

      /* Detail grid */
      var grid = document.createElement('div');
      grid.className = 'tbl-detail-grid';
      grid.innerHTML =
        detailCell('Table Number', tableNumber) +
        detailCell('QR ID', '#' + latestQR.qr_id) +
        detailCell('Status', row.hasActive ? 'Active' : 'Inactive') +
        detailCell('Total QRs', row.qrs.length);
      body.appendChild(grid);

      /* All QRs list if more than 1 */
      if (row.qrs.length > 1) {
        var label = document.createElement('p');
        label.style.cssText = 'font-size:.62rem;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:var(--cinder);margin-bottom:.5rem';
        label.textContent = 'All QR Codes';
        body.appendChild(label);

        row.qrs.forEach(function (q) {
          var r = document.createElement('div');
          r.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:.5rem .75rem;background:var(--graphite);border:1px solid var(--stone);border-radius:var(--radius);margin-bottom:.4rem';
          r.innerHTML =
            '<span style="font-family:\'JetBrains Mono\',monospace;font-size:.72rem;color:var(--linen)">#' + q.qr_id + '</span>' +
            '<span class="tbl-status-badge tbl-status-badge--' + (q.is_active ? 'active' : 'inactive') + '">' + (q.is_active ? 'Active' : 'Inactive') + '</span>' +
            '<button class="tbl-icon-btn tbl-icon-btn--danger" title="Delete" onclick="confirmDelete(' + q.qr_id + ', ' + tableNumber + ')">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>' +
            '</button>';
          body.appendChild(r);
        });
      }

      /* Footer: download + regenerate + delete */
      var dlLink = document.createElement('a');
      dlLink.className = 'tbl-btn tbl-btn--download';
      dlLink.href = 'data:image/png;base64,' + latestQR.qr_image_base64;
      dlLink.download = 'table-' + tableNumber + '-qr.png';
      dlLink.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
        'Download';
      footer.appendChild(dlLink);

      var regenBtn = makeBtn('ghost', 'New QR', function () {
        closeModal();
        openGenerateModal(tableNumber);
      });
      footer.appendChild(regenBtn);

      var delBtn = makeBtn('danger', 'Delete Latest', function () {
        confirmDelete(latestQR.qr_id, tableNumber);
      });
      footer.appendChild(delBtn);

    } else {
      /* No QR exists */
      var msg = document.createElement('div');
      msg.style.cssText = 'text-align:center;padding:2rem 0;color:var(--dust);font-size:.83rem';
      msg.textContent = 'No QR code generated for this table yet.';
      body.appendChild(msg);

      var genBtn = makeBtn('primary', 'Generate QR', function () {
        closeModal();
        openGenerateModal(tableNumber);
      });
      footer.appendChild(genBtn);
    }

    footer.appendChild(makeBtn('ghost', 'Close', closeModal));

    document.getElementById('modalBackdrop').classList.add('visible');
    document.getElementById('tableModal').classList.add('visible');
    document.body.style.overflow = 'hidden';
  };

  window.closeModal = function () {
    document.getElementById('modalBackdrop').classList.remove('visible');
    document.getElementById('tableModal').classList.remove('visible');
    document.body.style.overflow = '';
    openQR = null;
  };

  /* ══ GENERATE MODAL ══ */
  window.openGenerateModal = function (prefillTable) {
    var input = document.getElementById('genTableInput');
    if (prefillTable) input.value = prefillTable;
    else input.value = '';

    document.getElementById('genBackdrop').classList.add('visible');
    document.getElementById('genModal').classList.add('visible');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { input.focus(); }, 120);
  };

  window.closeGenerateModal = function () {
    document.getElementById('genBackdrop').classList.remove('visible');
    document.getElementById('genModal').classList.remove('visible');
    document.body.style.overflow = '';
  };

  window.generateQR = function () {
    var tableNum = parseInt(document.getElementById('genTableInput').value, 10);
    if (!tableNum || tableNum < 1) {
      showToast('Enter a valid table number', 'error');
      return;
    }

    var btn = document.querySelector('#genModal .tbl-btn--primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }

    fetch('/admin/api/generate-table-qr/' + tableNum)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        closeGenerateModal();
        showToast('QR generated for Table ' + tableNum, 'success');
        loadTables();
      })
      .catch(function (err) {
        showToast('Failed: ' + err.message, 'error');
      })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = 'Generate'; }
      });
  };

  /* ══ DELETE ══ */
  window.confirmDelete = function (qrId, tableNumber) {
    /* Simple confirm — could be upgraded to a modal */
    if (!confirm('Delete QR #' + qrId + ' for Table ' + tableNumber + '? This cannot be undone.')) return;
    deleteQR(qrId, tableNumber);
  };

  function deleteQR(qrId, tableNumber) {
    fetch('/admin/api/delete-qr/' + qrId, {
      method: 'DELETE',
      headers: { 'X-CSRFToken': getCsrf() }
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.error) throw new Error(data.error);
      closeModal();
      showToast('QR #' + qrId + ' deleted', 'success');
      loadTables();
    })
    .catch(function (err) {
      showToast('Delete failed: ' + err.message, 'error');
    });
  }

  /* ══ HELPERS ══ */
  function buildTableMap() {
    var map = {};
    allQRs.forEach(function (q) {
      var t = q.table_number;
      if (!map[t]) map[t] = { table_number: t, qrs: [] };
      map[t].qrs.push(q);
    });
    Object.values(map).forEach(function (row) {
      row.qrs.sort(function (a, b) { return b.qr_id - a.qr_id; });
      row.latest    = row.qrs[0];
      row.hasActive = row.qrs.some(function (q) { return q.is_active; });
      row.statusKey = row.hasActive ? 'active' : 'inactive';
    });
    return map;
  }

  function detailCell(label, val) {
    return '<div class="tbl-detail-cell">' +
      '<p class="tbl-detail-cell__label">' + esc(label) + '</p>' +
      '<p class="tbl-detail-cell__val">' + esc(String(val)) + '</p>' +
      '</div>';
  }

  function makeBtn(type, label, handler) {
    var btn = document.createElement('button');
    btn.className = 'tbl-btn tbl-btn--' + type;
    btn.textContent = label;
    if (handler) btn.addEventListener('click', handler);
    return btn;
  }

  function getCsrf() {
    var meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.content : '';
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var toastTimer;
  function showToast(msg, type) {
    var toast = document.getElementById('tblToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'tblToast';
      toast.className = 'tbl-toast';
      document.body.appendChild(toast);
    }
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.className = 'tbl-toast tbl-toast--' + (type || 'success');
    void toast.offsetWidth;
    toast.classList.add('visible');
    toastTimer = setTimeout(function () { toast.classList.remove('visible'); }, 3000);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeModal(); closeGenerateModal(); }
  });

})();