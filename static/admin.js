/* ==================== SECTION NAVIGATION ==================== */
function showSection(sectionId, event) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.remove('active');
    });

    // Remove active class from all menu items
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });

    // Show selected section
    const section = document.getElementById(sectionId);
    if (section) section.classList.add('active');

    // Add active class to clicked menu item
    if (event) {
        const menuItem = event.target.closest('.menu-item');
        if (menuItem) menuItem.classList.add('active');
    }

    // Close sidebar on mobile
    const sidebar = document.querySelector('.admin-sidebar');
    if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
    }
}

function toggleSidebar() {
    document.querySelector('.admin-sidebar')?.classList.toggle('open');
}

/* ==================== HASH NAV SUPPORT ==================== */
document.addEventListener("DOMContentLoaded", () => {
    const hash = window.location.hash.replace('#', '');
    if (!hash) return;

    const section = document.getElementById(hash);
    if (!section) return;

    document.querySelectorAll('.admin-section').forEach(sec =>
        sec.classList.remove('active')
    );

    document.querySelectorAll('.menu-item').forEach(item =>
        item.classList.remove('active')
    );

    section.classList.add('active');

    const link = document.querySelector(`.menu-item[href="#${hash}"]`);
    if (link) link.classList.add('active');
});

/* ==================== ORDERS + PAGINATION ==================== */
let allOrders = [];          // full fetched list (sorted)
let currentFilter = '';      // '' | 'pending' | 'completed'
let currentPage = 1;
const ROWS_PER_PAGE = 10;

document.addEventListener("DOMContentLoaded", loadOrders);

function loadOrders() {
    fetch("/admin/api/orders")
        .then(res => res.json())
        .then(orders => {
            // 🔥 SORT: newest orders first, store globally
            allOrders = orders.sort((a, b) => b.id - a.id);
            currentPage = 1;
            renderPage();
        })
        .catch(err => console.error("Failed to load orders", err));
}

// called by the <select onchange>
function filterOrders(status) {
    currentFilter = status;
    currentPage = 1;       // reset to page 1 whenever filter changes
    renderPage();
}

// returns the slice of allOrders that matches currentFilter
function getFilteredOrders() {
    if (!currentFilter) return allOrders;
    return allOrders.filter(o => o.status === currentFilter);
}

// renders the current page of rows + the pagination bar
function renderPage() {
    const filtered  = getFilteredOrders();
    const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE) || 1;

    // clamp currentPage just in case
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const pageOrders = filtered.slice(start, start + ROWS_PER_PAGE);

    // ── render rows ──
    const tbody = document.getElementById("orders-body");
    tbody.innerHTML = "";

    if (!pageOrders.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center;">
                    No orders yet 💤
                </td>
            </tr>`;
    } else {
        pageOrders.forEach(order => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>#${order.id}</td>
                <td>${order.customer}</td>
                <td>${order.table_no}</td>
                <td>
                    <button type="button" class="btn-small" onclick="viewItems(${order.id})">
                        View Items
                    </button>
                </td>
                <td>₹${order.total.toFixed(2)}</td>
                <td>
                    <span class="status ${order.status}">
                        ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                </td>
                <td>
                    <button class="btn-small" onclick="goToOrderPage(${order.id})">
                        Actions
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // ── render pagination buttons ──
    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const container = document.getElementById("pagination");
    container.innerHTML = "";

    if (totalPages <= 1) return; // nothing to paginate

    // ── Prev button ──
    const prev = document.createElement("button");
    prev.className = "btn-small pagination-btn";
    prev.textContent = "← Prev";
    prev.disabled = (currentPage === 1);
    prev.onclick = () => { currentPage--; renderPage(); };
    container.appendChild(prev);

    // ── numbered buttons ──
    // show max 5 numbers around currentPage to avoid a huge row
    const range = 2; // how many numbers on each side of current
    let start = Math.max(1, currentPage - range);
    let end   = Math.min(totalPages, currentPage + range);

    // always show "1" if start > 1
    if (start > 1) {
        container.appendChild(pageBtn(1));
        if (start > 2) container.appendChild(dotSpan()); // "..."
    }

    for (let i = start; i <= end; i++) {
        container.appendChild(pageBtn(i));
    }

    // always show last page if end < totalPages
    if (end < totalPages) {
        if (end < totalPages - 1) container.appendChild(dotSpan()); // "..."
        container.appendChild(pageBtn(totalPages));
    }

    // ── Next button ──
    const next = document.createElement("button");
    next.className = "btn-small pagination-btn";
    next.textContent = "Next →";
    next.disabled = (currentPage === totalPages);
    next.onclick = () => { currentPage++; renderPage(); };
    container.appendChild(next);
}

// helper: one numbered page button
function pageBtn(n) {
    const btn = document.createElement("button");
    btn.className = "btn-small pagination-btn" + (n === currentPage ? " active" : "");
    btn.textContent = n;
    btn.onclick = () => { currentPage = n; renderPage(); };
    return btn;
}

// helper: the "..." span between page numbers
function dotSpan() {
    const span = document.createElement("span");
    span.textContent = "...";
    span.style.cssText = "padding:0 4px; color:#888; user-select:none;";
    return span;
}

function goToOrderPage(orderId) {
    window.location.href = `/admin/orders/${orderId}`;
}

function viewItems(orderId) {
    fetch(`/admin/api/orders/${orderId}/items`)
        .then(res => res.json())
        .then(data => {
            // Set order ID
            document.getElementById('modal-order-id').textContent = orderId;
            
            // Clear previous items
            const itemsList = document.getElementById('modal-items-list');
            itemsList.innerHTML = '';
            
            let total = 0;
            
            // Add each item
        data.forEach(item => {
            // ✅ Ensure numeric values
            const qty = Number(item.qty || item.quantity || 0);
            const price = Number(item.price || 0);
            const itemPrice = qty * price;
            total += itemPrice;

            const itemRow = document.createElement('div');
            itemRow.className = 'modal-item-row';
            itemRow.innerHTML = `
                <div class="modal-item-info">
                    <div class="modal-item-name">${item.name}</div>
                    ${item.category ? `<span class="modal-item-category">${item.category}</span>` : ''}
                </div>
                <div class="modal-item-qty">×${qty}</div>
                <div class="modal-item-price">₹${itemPrice.toFixed(2)}</div>
            `;
            itemsList.appendChild(itemRow);
        });

            
            // Set total
            document.getElementById('modal-total').textContent = `₹${total.toFixed(2)}`;
            
            // Show modal
            document.getElementById('viewItemsModal').style.display = 'flex';
        })
        .catch(err => {
            console.error(err);
            alert("Failed to load order items 💔");
        });
}

function closeViewItemsModal() {
    document.getElementById('viewItemsModal').style.display = 'none';
}

function viewQRImage(base64, tableNumber) {
    const win = window.open('');
    win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Table ${tableNumber} QR Code</title>
            <style>
                body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
                .qr-card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); text-align: center; }
                h2 { margin-bottom: 8px; color: #2c3e50; }
                p { color: #888; margin-bottom: 20px; }
                img { width: 250px; height: 250px; }
                .print-btn { margin-top: 20px; padding: 10px 24px; background: #3498db; color: white; border: none; border-radius: 8px; font-size: 15px; cursor: pointer; }
            </style>
        </head>
        <body>
            <div class="qr-card">
                <h2>☕ Table ${tableNumber} QR Code</h2>
                <p>Scan to place your order</p>
                <img src="data:image/png;base64,${base64}" />
                <br>
                <button class="print-btn" onclick="window.print()">🖨️ Print QR</button>
            </div>
        </body>
        </html>
    `);
}

function createQRCard(qr) {
    const imgData = qr.qr_image_base64 || (qr.qr_code ? qr.qr_code.replace('data:image/png;base64,', '') : '');
    const qrContainer = document.getElementById("qrContainer");
    qrContainer.style.display = "block";

    if (document.getElementById(`qr-${qr.qr_id}`)) return;

    const qrCard = document.createElement("div");
    qrCard.id = `qr-${qr.qr_id}`;
    qrCard.style.background = "#f9f9f9";
    qrCard.style.padding = "15px";
    qrCard.style.marginBottom = "15px";
    qrCard.style.borderRadius = "8px";
    qrCard.style.textAlign = "center";
    qrCard.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)";

    qrCard.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:600;">Table ${qr.table_number}</span>
            <div>
                <button onclick="viewQRImage('${imgData}', ${qr.table_number})"
                style="padding:6px 12px; background:#3498db; color:#fff; border:none; border-radius:6px; font-size:14px; cursor:pointer; margin-right:6px;">
                View QR
                </button>
                <button onclick="deleteQR(${qr.qr_id})"
                        style="padding:6px 12px; background:#e74c3c; color:#fff; border:none; border-radius:6px; font-size:14px; cursor:pointer;">
                Delete
                </button>
            </div>
        </div>
    `;

    qrContainer.prepend(qrCard);
}


/* ==================== MENU EDIT MODAL ==================== */
function openEditModal(id, name, price, category, description) {
    const form = document.getElementById('editForm');
    form.action = `/admin/menu/edit/${id}`;

    form.querySelector("[name='item_name']").value = name;
    form.querySelector("[name='item_price']").value = price;
    form.querySelector("[name='category']").value = category;
    form.querySelector("[name='description']").value = description;

    document.getElementById('editModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('editModal').style.display = 'none';
}

/* ==================== PROFILE ==================== */
function handleProfileUpdate(event) {
    event.preventDefault();
    alert('Profile updated successfully! 💅');
}

/* ==================== QR CODE GENERATION ==================== */
function generateTableQR() {
    const tableNumber = document.getElementById("tableNumberInput").value;
    if (!tableNumber || tableNumber <= 0) {
        alert("Enter valid table number");
        return;
    }

    fetch(`/admin/api/generate-table-qr/${tableNumber}`)
        .then(response => response.json())
        .then(data => {
            // ✅ Use data.qr_id directly (no reference to undefined qrCard/qr)
            if (document.getElementById(`qr-${data.qr_id}`)) return;
            createQRCard(data);
        })
        .catch(error => console.error("QR Error:", error));
}

function deleteQR(qrId) {
    if (!confirm("Are you sure you want to delete this QR?")) return;

    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    const headers = { 'Content-Type': 'application/json' };
    if (csrfMeta) headers['X-CSRFToken'] = csrfMeta.getAttribute('content');

    fetch(`/admin/api/delete-qr/${qrId}`, {
        method: 'DELETE',
        headers: headers
    })
    .then(res => res.json())          // ✅ parse JSON to see real error
    .then(data => {
        if (data.success) {
            document.getElementById(`qr-${qrId}`)?.remove();
        } else {
            alert("Delete failed: " + data.error);  // ✅ show actual error
        }
    })
    .catch(err => {
        console.error("Delete error:", err);
        alert("Network or server error: " + err.message);
    });
}

// Call this on page load
// Call this on page load
function loadAllQRCodes() {
    fetch('/admin/api/all-table-qrs')
        .then(res => res.json())
        .then(data => {
            const qrContainer = document.getElementById("qrContainer");
            qrContainer.style.display = "block";

            data.forEach(qr => createQRCard(qr));
        })
        .catch(err => console.error("Failed to load QR codes:", err));
}

// Run on page load
window.addEventListener("DOMContentLoaded", loadAllQRCodes);

