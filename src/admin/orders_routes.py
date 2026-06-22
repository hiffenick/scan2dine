from flask import jsonify, render_template, request
from flask_login import login_required,current_user
from src import db
from src.auth.decorators import no_cache
from src.models.order import Order
from src.models.order_item import OrderItem
from src.models.menu import MenuItem
from src.extensions import csrf
from datetime import datetime
from src.services.activity import log_activity

from . import admin_bp

# @login_required
# @no_cache
# @admin_bp.route("/api/orders")
# def get_orders():
#     orders = Order.query.all()
#     return jsonify([
#         {
#             "id": o.id,
#             "customer": o.customer_name,
#             "table_no": int(o.table_no),
#             "total": float(o.total_amount),
#             "status": o.status,
#             "created_at": o.created_at.strftime("%Y-%m-%d")
#         }
#         for o in orders
#     ])

@admin_bp.route("/api/orders")
@login_required
@no_cache
def get_orders():
    orders = Order.query.order_by(Order.created_at.desc()).all()
    return jsonify([
        {
            "id": f"ORD-{o.id}",
            "table": int(o.table_no),
            "customer": o.customer_name,
            "status": o.status,
            "payment_status": o.payment_status,
            "payment_method": o.payment_method,
            "payment_reference": o.payment_reference,
            "total": float(o.total_amount),
            "paid_at": o.paid_at.isoformat() if o.paid_at else None,
            "created_at": o.created_at.isoformat(),
            "items": [
                {
                    "name": i.menu_item.item_name,
                    "qty": i.quantity,
                    "price": float(i.price_at_time)
                }
                for i in o.items
            ]
        }
        for o in orders
    ])


@admin_bp.route("/orders")
@login_required
@no_cache
def get_orders_page():
    return render_template("admin/orders.html", active_page="orders")

@admin_bp.route("/api/orders/<int:order_id>/status", methods=["PATCH"])
@login_required
@csrf.exempt
def update_order_status(order_id):
    order = Order.query.get_or_404(order_id)
    data = request.get_json()
    new_status = data.get("status")

    VALID = ['Pending', 'Preparing', 'Served', 'Closed', 'Cancelled']
    if new_status not in VALID:
        return jsonify({"error": "Invalid status"}), 400

    if new_status == 'Closed' and order.payment_status != 'paid':
        return jsonify({"error": "Cannot close an unpaid order"}), 400

    order.status = new_status

    # Release table only when fully closed + paid
    if new_status == 'Closed':
        from src.services.qr_token import release_table
        release_table(order.table_no)

    db.session.commit()
    log_activity(current_user.id, "order", f"Updated order #ORD-{order.id} → {order.status}")
    return jsonify({"success": True, "status": order.status})


@admin_bp.route("/api/orders/<int:order_id>/payment", methods=["PATCH"])
@login_required
@csrf.exempt
def update_payment_status(order_id):
    order = Order.query.get_or_404(order_id)
    data = request.get_json()

    order.payment_status    = data.get("payment_status",    order.payment_status)
    order.payment_method    = data.get("payment_method",    order.payment_method)
    order.payment_reference = data.get("payment_reference", order.payment_reference)

    if order.payment_status == 'paid' and not order.paid_at:
        order.paid_at = datetime.utcnow()
    if order.payment_status == 'unpaid':
        order.paid_at = None

    db.session.commit()
    log_activity(current_user.id, "order", f"Marked order #ORD-{order.id} as {order.payment_status}")
    return jsonify({"success": True, "payment_status": order.payment_status})


@login_required
@no_cache
@admin_bp.route("/api/orders/<int:order_id>/items", methods=["GET"])
def get_order_items(order_id):
    items = OrderItem.query.filter_by(order_id=order_id).all()
    return jsonify([
        {
            "menu_item_id": i.menu_item_id,
            "name": i.menu_item.item_name,
            "qty": i.quantity,
            "price": float(i.price_at_time)
        }
        for i in items
    ])

@login_required
@admin_bp.route("/api/menu")
def get_menu():
    menu_items = MenuItem.query.filter_by(is_active=True).all()
    return jsonify([
        {
            "id": m.id,
            "name": m.item_name,
            "price": float(m.item_price)
        }
        for m in menu_items
    ])

@login_required
@no_cache
@admin_bp.route("/orders/<int:order_id>")
def order_details(order_id):
    return render_template("admin/order_details.html", order_id=order_id)

@login_required
@no_cache
@admin_bp.route("/orders/new")
def new_order():
    """Render the create new order page"""
    return render_template("admin/order_create.html")

@login_required
@no_cache
@admin_bp.route("/api/orders/<int:order_id>", methods=["GET"])
def get_order(order_id):
    o = Order.query.get_or_404(order_id)
    return jsonify({
        "id": o.id,
        "customer": o.customer_name,
        "table_no": int(o.table_no),
        "total": float(o.total_amount),
        "status": o.status,
        "created_at": o.created_at.strftime("%Y-%m-%d")
    })

# 🔥🔥🔥 CREATE NEW ORDER ENDPOINT 🔥🔥🔥
@login_required
@no_cache
@admin_bp.route("/api/orders/create", methods=["POST"])
@csrf.exempt
def create_order():
    """Create a new order with items"""
    print(f"\n{'='*60}")
    print(f"CREATE ORDER REQUEST")
    print(f"{'='*60}")
    
    try:
        data = request.get_json(force=True)
        print(f"Received data: {data}")
    except Exception as e:
        print(f"ERROR parsing JSON: {e}")
        return jsonify({"success": False, "message": "Invalid JSON"}), 400
    
    if not data:
        return jsonify({"success": False, "message": "No data"}), 400
    
    customer_name = data.get("customer_name", "").strip()
    table_no = data.get("table_no")
    items = data.get("items", [])
    status = data.get("status", "pending").lower().strip()
    
    print(f"Customer: '{customer_name}'")
    print(f"Table: {table_no}")
    print(f"Items: {len(items)}")
    print(f"Status: '{status}'")
    
    # Validation
    if not customer_name:
        return jsonify({"success": False, "message": "Customer name is required"}), 400
    
    if not table_no or table_no < 1:
        return jsonify({"success": False, "message": "Valid table number is required"}), 400
    
    if not items or len(items) == 0:
        return jsonify({"success": False, "message": "At least one item is required"}), 400
    
    if status not in ["pending", "completed", "cancelled"]:
        return jsonify({"success": False, "message": "Invalid status"}), 400
    
    try:
        # Calculate total and validate items
        total = 0
        validated_items = []
        
        for idx, item in enumerate(items):
            mid = item.get("menu_item_id")
            qty = item.get("qty", 1)
            
            if not mid:
                continue
            
            menu = MenuItem.query.get(mid)
            if not menu:
                print(f"Warning: Menu item {mid} not found")
                continue
            
            qty = int(qty)
            price = float(menu.item_price)
            total += qty * price
            
            validated_items.append({
                "menu_item_id": menu.id,
                "quantity": qty,
                "price": price,
                "name": menu.item_name
            })
            print(f"  Item {idx}: {menu.item_name} x{qty} = ₹{qty*price}")
        
        if len(validated_items) == 0:
            return jsonify({"success": False, "message": "No valid items found"}), 400
        
        # Create order
        new_order = Order(
            customer_name=customer_name,
            table_no=table_no,
            total_amount=total,
            status=status,
            created_at=datetime.utcnow()
        )
        db.session.add(new_order)
        db.session.flush()  # Get the order ID
        
        print(f"Created order ID: {new_order.id}")
        
        # Add order items
        for item in validated_items:
            order_item = OrderItem(
                order_id=new_order.id,
                menu_item_id=item["menu_item_id"],
                quantity=item["quantity"],
                price_at_time=item["price"]
            )
            db.session.add(order_item)
        
        db.session.commit()
        print(f"✅ SUCCESS: Order #{new_order.id} created - Total=₹{total}, Items={len(validated_items)}")
        print(f"{'='*60}\n")
        log_activity(current_user.id, "order", f"Created order #ORD-{new_order.id} for {customer_name} (Table {table_no})")
        return jsonify({
            "success": True,
            "message": "Order created successfully",
            "order_id": new_order.id,
            "total": float(total),
            "status": new_order.status
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500


# 🔥🔥🔥 UPDATE ORDER ENDPOINT - CSRF EXEMPT 🔥🔥🔥
@login_required
@no_cache
@admin_bp.route("/api/orders/<int:order_id>/update", methods=["POST"])
@csrf.exempt
def update_order_post(order_id):
    print(f"\n{'='*60}")
    print(f"UPDATE REQUEST for order {order_id}")
    print(f"{'='*60}")

    order = Order.query.get_or_404(order_id)
    print(f"Order found: {order.id} - {order.customer_name}")

    try:
        data = request.get_json(force=True)
        print(f"Received data: {data}")
    except Exception as e:
        print(f"ERROR parsing JSON: {e}")
        return jsonify({"success": False, "message": "Invalid JSON"}), 400

    if not data:
        return jsonify({"success": False, "message": "No data"}), 400

    items = data.get("items", [])
    status = data.get("status", "").lower().strip()

    print(f"Items: {len(items)}")
    print(f"Status: '{status}'")

    if status and status not in ["pending", "completed", "cancelled"]:
        return jsonify({"success": False, "message": "Invalid status"}), 400

    try:
        deleted = OrderItem.query.filter_by(order_id=order_id).delete()
        print(f"Deleted {deleted} existing items")

        total = 0
        for idx, item in enumerate(items):
            mid = item.get("menu_item_id")
            qty = item.get("qty", 1)

            if not mid:
                continue

            menu = MenuItem.query.get(mid)
            if not menu:
                print(f"Warning: Menu item {mid} not found")
                continue

            qty = int(qty)
            price = float(menu.item_price)
            total += qty * price

            db.session.add(OrderItem(
                order_id=order_id,
                menu_item_id=menu.id,
                quantity=qty,
                price_at_time=price
            ))
            print(f"  Item {idx}: {menu.item_name} x{qty} = ₹{qty*price}")

        order.total_amount = total

        if status:
            order.status = status
            if status in ["completed", "cancelled"]:
                # Check no other pending orders for this table
                pending_orders = Order.query.filter_by(
                    table_no=order.table_no,
                    status="pending"
                ).filter(Order.id != order_id).count()

                if pending_orders == 0:
                    from src.services.qr_token import release_table
                    release_table(order.table_no)
                    print(f"✅ Table {order.table_no} released")
                else:
                    print(f"⏳ Table {order.table_no} still has {pending_orders} pending orders")

        db.session.commit()
        print(f"✅ SUCCESS: Total=₹{total}, Status={order.status}")
        print(f"{'='*60}\n")

        return jsonify({
            "success": True,
            "message": "Order updated successfully",
            "total": float(total),
            "status": order.status
        })

    except Exception as e:
        db.session.rollback()
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500
    
    
@login_required
@no_cache
@admin_bp.route("/orders/<int:id>/edit")
def edit_order(id):
    return render_template(
        "admin/order_details.html",
        order_id=id,
        mode="edit"
    )

@login_required
@no_cache
@admin_bp.route("/create", methods=["GET"])
def show_create_order():
    return render_template("admin/order_create.html")

from flask import request, jsonify
from flask_login import login_required
from src import db
from src.admin import admin_bp
from src.models.order import Order
from src.models.order_item import OrderItem
from flask_wtf.csrf import validate_csrf
from wtforms.validators import ValidationError

@login_required
@no_cache
@admin_bp.route("/orders", methods=["POST"])
@login_required
def create_order_form():
    """
    Create a new order and save it to DB
    """

    try:
        data = request.get_json()

        # ---------------------------
        # CSRF VALIDATION
        # ---------------------------
        csrf_token = data.get("csrf_token")
        validate_csrf(csrf_token)

        # ---------------------------
        # CREATE ORDER
        # ---------------------------
        order = Order(
            customer_name=data.get("customer_name"),
            customer_phone=data.get("customer_phone"),
            table_no=data.get("table_no"),
            status="pending"
        )

        db.session.add(order)
        db.session.flush()  # VERY IMPORTANT (gets order.id)

        # ---------------------------
        # CREATE ORDER ITEMS
        # ---------------------------
        items = data.get("items", [])

        for item in items:
            order_item = OrderItem(
                order_id=order.id,
                menu_item_id=item["menu_item_id"],
                quantity=item["quantity"],
                price=item["price"]
            )
            db.session.add(order_item)

        # ---------------------------
        # COMMIT
        # ---------------------------
        db.session.commit()

        return jsonify({
            "success": True,
            "order_id": order.id
        }), 201

    except ValidationError:
        return jsonify({"error": "Invalid CSRF token"}), 400

    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": "Failed to create order",
            "details": str(e)
        }), 500


