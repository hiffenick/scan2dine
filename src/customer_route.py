from flask import Blueprint, render_template, request, redirect, url_for, jsonify, session
from src.extensions import db
from src.services.menu_service import get_active_menu_items
from src.models.menu import MenuItem

customer_route = Blueprint(
    'customer',
    __name__,
    url_prefix='/customer'
)

# =========================
# CUSTOMER MENU PAGE (QR)
# =========================
#Shiftedt to other route 

# =========================
# MENU API (AJAX → DATABASE)
# =========================
@customer_route.route('/api/menu', methods=['GET'])
def api_menu():
    items = MenuItem.query.filter_by(is_active=True).all()

    return jsonify([
        {
            "id": item.id,
            "name": item.name,
            "price": float(item.price),
            "image": item.image_url if hasattr(item, "image_url") else None,
            "available": item.stock > 0   # ONLY true / false
        }
        for item in items
    ])

# =========================
# ADD TO CART (AJAX)
# =========================
@customer_route.route('/cart/add', methods=['POST'])
def add_to_cart():
    data = request.get_json()
    item_id = data.get('item_id')

    if not item_id:
        return jsonify({"success": False, "message": "Invalid item"}), 400

    item = MenuItem.query.get(item_id)
    if not item or item.stock <= 0:
        return jsonify({"success": False, "message": "Item not available"}), 400

    cart = session.get('cart', {})

    item_id = str(item_id)
    cart[item_id] = cart.get(item_id, 0) + 1

    session['cart'] = cart
    session.modified = True

    return jsonify({
        "success": True,
        "cart_count": sum(cart.values())
    })

# =========================
# VIEW CART PAGE
# =========================
@customer_route.route('/cart', methods=['GET'])
def view_cart():
    cart = session.get('cart', {})
    if not cart:
        return render_template('customer/cart.html', cart_items=[], total=0)

    items = MenuItem.query.filter(MenuItem.id.in_(cart.keys())).all()

    cart_items = []
    total = 0

    for item in items:
        qty = cart.get(str(item.id), 0)
        subtotal = item.price * qty
        total += subtotal

        cart_items.append({
            "id": item.id,
            "name": item.name,
            "price": float(item.price),
            "quantity": qty,
            "subtotal": float(subtotal)
        })

    return render_template(
        'customer/cart.html',
        cart_items=cart_items,
        total=float(total)
    )

# =========================
# CHECKOUT (AJAX)
# =========================
@customer_route.route('/checkout', methods=['POST'])
def checkout():
    data = request.get_json()

    customer_name = data.get('customer_name', '').strip()
    payment_mode = data.get('payment_mode', '').strip()

    if not customer_name:
        return jsonify({"success": False, "message": "Name required"}), 400

    if payment_mode not in ['Cash', 'UPI', 'Card']:
        return jsonify({"success": False, "message": "Invalid payment mode"}), 400

    # (Order save logic comes later — this is fine for now)
    session.pop('cart', None)

    return jsonify({
        "success": True,
        "message": "Order placed successfully"
    })

# =========================
# ORDER CONFIRMATION
# =========================
@customer_route.route('/order-confirmation', methods=['GET'])
def order_confirmation():
    return render_template('customer/confirmation.html')

@customer_route.route('/api/table-status/<int:table_number>')
def table_status(table_number):
    from src.services.qr_token import _redis
    locked = _redis().get(f"table_lock:{table_number}")
    return jsonify({"occupied": locked is not None})

