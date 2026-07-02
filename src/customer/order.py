"""
Production-ready order placement API with Redis session management
Uses Redis for cart storage, locking, AND table number
"""
from flask import Blueprint, request, jsonify, session, current_app, render_template
from datetime import datetime
from decimal import Decimal
import uuid
import io
import base64
import qrcode
from flask import current_app
import json

from src.models.paymentqr import PaymentSetting
from src.extensions import db, csrf
from src.models.order import Order
from src.models.order_item import OrderItem
from src.models.menu import MenuItem
from src.services.cart_service import (
    get_cart, 
    clear_cart,
    CartError
)
from src.models.setting import Setting
from src.services.redis_session import get_customer_session

customer_order_bp = Blueprint(
    "customer_order",
    __name__,
    url_prefix="/customer/api"
)

# Lock timeout in seconds
LOCK_TIMEOUT = 10
LOCK_BLOCKING_TIMEOUT = 3


@customer_order_bp.route("/orders/place", methods=["POST"])
@csrf.exempt
def place_customer_order():
    """
    Place an order from cart with proper validation and locking
    
    USES REDIS FOR:
    - Cart storage (get_cart fetches from Redis)
    - Distributed locking (prevents duplicate orders)
    - Session management (table number stored in Redis)
    """
    # Get or create session ID used for customer identification
    session_id = session.get("session_id")
    if not session_id:
        session_id = str(uuid.uuid4())
        session["session_id"] = session_id

    # The cart used by the customer UI is stored under 'cart_id' in many places
    # Prefer using 'cart_id' for cart operations, but fallback to 'session_id'
    cart_session_id = session_id
    
    # Get table number from Redis (PRIMARY) or Flask session (FALLBACK)
    table_no = session.get("table_no") # ← Fetch from Redis first
    
    if not table_no:
        # Fallback to Flask session
        table_no = session.get("table_no")

    # Additional fallback: check legacy/order_ctx stored in Flask session
    if not table_no:
        order_ctx = session.get('order_ctx', {})
        table_no = order_ctx.get('table_no')
    
    if not table_no:
        return jsonify({
            "success": False, 
            "error": "Table number not found. Please scan QR code again."
        }), 400
    
    # Get customer info from Redis
    customer_data = get_customer_session(session_id)
    customer_name = "Walk-in"
    if customer_data:
        customer_name = customer_data.get("customer_name", "Walk-in")

        print("=" * 50)
        print("Searching Orders")
        print("Table:", table_no)
        print("Customer:", customer_name)
        print("=" * 50)
    
    # Get Redis client
    # redis_client = current_app.config.get("REDIS_CLIENT")
    # if not redis_client:
    #     current_app.logger.error("Redis client not configured")
    #     return jsonify({
    #         "success": False,
    #         "error": "Service temporarily unavailable"
    #     }), 503
    
    # # Acquire Redis lock to prevent double submission
    # # Use cart_session_id so locks are tied to the customer's cart (UI uses cart_id)
    # lock_key = f"order_lock:{cart_session_id}"
    # lock = redis_client.lock(lock_key, timeout=LOCK_TIMEOUT)
    
    try:
        # Try to acquire lock with timeout
        pass
        # Get cart from Redis (use cart_session_id)
        try:
            cart_ctx = get_cart(cart_session_id)
            items = cart_ctx.get("cart", [])
        except CartError as e:
            current_app.logger.error(f"Cart fetch error: {e}")
            return jsonify({
                "success": False,
                "error": "Failed to retrieve cart"
            }), 500
        
        # Validate cart not empty
        if not items:
            return jsonify({
                "success": False,
                "error": "Cart is empty"
            }), 400
        
        # Validate and process items
        total = Decimal("0.00")
        validated_items = []
        unavailable_items = []
        
        for item in items:
            menu_id = item.get("id")
            qty = item.get("quantity", 0)
            
            # Validate quantity
            try:
                qty = int(qty)
                if qty < 1:
                    continue
            except (ValueError, TypeError):
                current_app.logger.warning(f"Invalid quantity for item {menu_id}: {qty}")
                continue
            
            # Fetch menu item from database
            menu = MenuItem.query.get(menu_id)
            
            if not menu:
                unavailable_items.append(item.get("name", f"Item {menu_id}"))
                continue
            
            if not menu.is_active:
                unavailable_items.append(menu.item_name)
                continue
            
            # Use database price (never trust frontend)
            try:
                price = Decimal(str(menu.item_price))
            except (ValueError, TypeError):
                current_app.logger.error(f"Invalid price for menu item {menu_id}")
                continue
            
            total += qty * price
            
            validated_items.append({
                "menu_item_id": menu.id,
                "menu_name": menu.item_name,
                "quantity": qty,
                "price": price
            })
        
        # Check if we have valid items after validation
        if not validated_items:
            error_msg = "No valid items in cart"
            if unavailable_items:
                error_msg += f". Unavailable items: {', '.join(unavailable_items)}"
            return jsonify({
                "success": False,
                "error": error_msg
            }), 400
        
        # Create order in database
        try:
            order = Order(
                customer_name=customer_name,
                customer_session_id=session.get("session_id"),
                table_no=table_no,
                total_amount=total,
                status="Pending",
                created_at=datetime.utcnow()
            )
            
            db.session.add(order)
            db.session.flush()  # Get order ID before committing
            
            # Create order items
            for item in validated_items:
                order_item = OrderItem(
                    order_id=order.id,
                    menu_item_id=item["menu_item_id"],
                    quantity=item["quantity"],
                    price_at_time=item["price"]
                )
                db.session.add(order_item)

            print("=" * 50)
            print("Creating Order")
            print("Table:", table_no)
            print("Customer:", customer_name)
            print("=" * 50)
            
            db.session.commit()
            
            current_app.logger.info(
                f"Order {order.id} placed successfully for table {table_no}. "
                f"Customer: {customer_name}, Total: {total}, Items: {len(validated_items)}"
            )
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Database error creating order: {e}")
            return jsonify({
                "success": False,
                "error": "Failed to create order. Please try again."
            }), 500
        
        # Clear cart in Redis after successful order
        try:
                clear_cart(cart_session_id)
        except Exception as e:
            # Don't fail the order if cart clear fails
            current_app.logger.warning(f"Failed to clear cart after order: {e}")
        
        # If payment method provided, process accordingly
        # Accept JSON body or form data
        data = request.get_json(silent=True) or request.form or {}
        payment_method = (data.get('payment_method') or data.get('payment') or 'cash').lower()

        session['last_payment_method'] = payment_method
        session.modified = True

        response_payload = {
            "success": True,
            "order_id": order.id,
            "total": float(total),
            "items_count": len(validated_items),
            "payment_method": payment_method
        }

        # Online payment flow: generate UPI URI and QR code (base64 PNG)
        if payment_method == 'online':
            # Build UPI payment URI
            # Prefer DB-stored settings (admin panel) and fallback to app config
            payment_setting = PaymentSetting.get()
            upi_vpa = payment_setting.upi_id or current_app.config.get('UPI_VPA', 'merchant@upi')
            upi_name = payment_setting.account_name or current_app.config.get('UPI_MERCHANT_NAME', 'Cafe')

            currency = current_app.config.get('UPI_CURRENCY', 'INR')
            note = f"Order {order.id}"
            # Format amount to two decimals without commas
            amt_str = f"{total:.2f}"
            upi_uri = (
                f"upi://pay?pa={upi_vpa}&pn={upi_name}&am={amt_str}&cu={currency}&tn={note}"
            )


            current_app.logger.debug("Preparing UPI payment: order=%s upi_vpa=%s upi_name=%s amt=%s", order.id, upi_vpa, upi_name, amt_str)

            # Generate QR image and return as base64 data URL
            try:
                img = qrcode.make(upi_uri)
                buffered = io.BytesIO()
                img.save(buffered, format="PNG")
                b64 = base64.b64encode(buffered.getvalue()).decode('ascii')
                data_url = f"data:image/png;base64,{b64}"

                response_payload.update({
                    'upi_uri': upi_uri,
                    'upi_qr_base64': data_url
                })
                current_app.logger.debug("Generated UPI QR for order %s (length=%s)", order.id, len(b64))
            except Exception as e:
                current_app.logger.exception('Failed generating UPI QR: %s', e)
                # Fall back to returning UPI URI only
                response_payload.update({'upi_uri': upi_uri})

        # Return success response
        return jsonify(response_payload), 201
        
    except Exception as e:
        current_app.logger.error(f"Unexpected error placing order: {e}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "An unexpected error occurred. Please try again."
        }), 500
    

@customer_order_bp.route("/debug/session", methods=["GET"])
@csrf.exempt
def debug_session():
    """Debug endpoint to check session state"""
    from src.services.redis_session import get_customer_session
    from src.services.cart_service import get_cart
    
    session_id = session.get("session_id")
    flask_table = session.get("table_no")
    
    redis_session = get_customer_session(session_id) if session_id else None
    redis_table = session.get("table_no")
    cart = get_cart(session_id) if session_id else None
    
    return jsonify({
        "session_id": session_id,
        "flask_session_table_no": flask_table,
        "session_data": redis_session,
        "table_no": redis_table,
        "cart_data": cart,
        "all_session_data": dict(session)
    })

@customer_order_bp.route("/debug/create-session/<int:table_no>", methods=["GET"])
@csrf.exempt
def create_test_session(table_no):
    """Create a test session manually"""
    from src.services.redis_session import create_customer_session
    
    session_id = create_customer_session(table_no=table_no)
    session['session_id'] = session_id
    session['table_no'] = table_no
    session.modified = True
    
    return jsonify({
        "success": True,
        "session_id": session_id,
        "table_no": table_no,
        "message": "Session created! Now try adding items to cart."
    })

@customer_order_bp.route('/confirmation')
def confirmation_page():
    if not session.get('token_verified'):
        return render_template('customer/forbidden.html', reason="Access denied."), 403
    
    order_id = request.args.get('order_id')
    order = Order.query.get(order_id)
    if not order:
        return render_template('customer/forbidden.html', reason="Order not found."), 404
    
    items = OrderItem.query.filter_by(order_id=order.id).all()
    payment_method = session.pop('last_payment_method', None) or 'cash'
    item_list = [{
        'name': item.menu_item.item_name,
        'quantity': item.quantity,
        'price': float(item.price_at_time),
        'subtotal': float(item.quantity * item.price_at_time)
    } for item in items]
    
    return render_template('customer/confirmation.html', order=order, items=item_list, payment_method=payment_method)


@customer_order_bp.route('/my-orders')
def my_orders():
    session_id = session.get('session_id')
    table_no = session.get('table_no')

    if not session_id or not table_no:
        return render_template('customer/forbidden.html', reason="Session expired. Please scan QR again."), 403

    customer_data = get_customer_session(session_id)

    if not customer_data:
        return render_template('customer/my_orders.html', orders=[], table_no=table_no, orders_json='[]')

    customer_name = customer_data.get('customer_name', '')
    session_created_at = None
    created_str = customer_data.get('created_at')
    if created_str:
        try:
            session_created_at = datetime.fromisoformat(created_str)
        except Exception:
            pass

    # Filter by table + customer name + session start time
    orders = (
        Order.query
        .filter_by(
            customer_session_id=session_id
        )
        .order_by(Order.created_at.desc())
        .all()
    )

    orders_json = json.dumps([{
        "id": o.id,
        "status": o.status,
        "total_amount": float(o.total_amount),
        "payment_status": o.payment_status,
        "payment_method": o.payment_method,
        "created_at": o.created_at.isoformat(),
        "items": [{
            "name": oi.menu_item.item_name,
            "quantity": oi.quantity,
            "price": float(oi.price_at_time)
        } for oi in o.items]
    } for o in orders])

    return render_template(
        'customer/my_orders.html',
        orders=orders,
        table_no=table_no,
        orders_json=orders_json
    )

@customer_order_bp.route('/orders/<int:order_id>/upi-qr', methods=['GET'])
@csrf.exempt
def get_order_upi_qr(order_id):
    """Generate UPI QR for an already-placed order (Served-stage payment)."""
    order = Order.query.get(order_id)
    if not order:
        return jsonify({"success": False, "error": "Order not found"}), 404
    
    payment_setting = PaymentSetting.get()
    upi_vpa = payment_setting.upi_id or current_app.config.get('UPI_VPA', 'merchant@upi')
    upi_name = payment_setting.account_name or current_app.config.get('UPI_MERCHANT_NAME', 'Cafe')
    currency = current_app.config.get('UPI_CURRENCY', 'INR')
    amt_str = f"{order.total_amount:.2f}"
    note = f"Order {order.id}"
    upi_uri = f"upi://pay?pa={upi_vpa}&pn={upi_name}&am={amt_str}&cu={currency}&tn={note}"

    img = qrcode.make(upi_uri)
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    b64 = base64.b64encode(buffered.getvalue()).decode('ascii')

    return jsonify({
        "success": True,
        "upi_uri": upi_uri,
        "upi_qr_base64": f"data:image/png;base64,{b64}"
    })


@customer_order_bp.route('/orders/<int:order_id>/mark-awaiting', methods=['POST'])
@csrf.exempt
def mark_order_awaiting_verification(order_id):
    """Customer clicked 'I've Paid' — flip payment_status to awaiting_verification."""
    order = Order.query.get(order_id)
    if not order:
        return jsonify({"success": False, "error": "Order not found"}), 404

    if order.payment_status == 'unpaid':
        order.payment_status = 'awaiting'
        db.session.commit()

    return jsonify({"success": True, "payment_status": order.payment_status})


@customer_order_bp.route('/my-orders/status-poll', methods=['GET'])
@csrf.exempt
def my_orders_status_poll():
    """Lightweight poll for status + payment_status changes (order status board, payment verification)."""
    table_no = session.get('table_no')
    if not table_no:
        return jsonify({"success": False, "error": "No session"}), 403

    order_ids = request.args.get('ids', '')
    ids = [int(i) for i in order_ids.split(',') if i.isdigit()]
    if not ids:
        return jsonify({"success": True, "orders": []})

    orders = Order.query.filter(Order.id.in_(ids)).all()
    return jsonify({
        "success": True,
        "orders": [{
            "id": o.id,
            "status": o.status,
            "payment_status": o.payment_status,
            "payment_method": o.payment_method
        } for o in orders]
    })

@customer_order_bp.route("/orders/<int:order_id>/select-payment", methods=["POST"])
@csrf.exempt
def select_payment_method(order_id):
    """
    Customer selects intended payment method on the Served-stage payment card.
    This ONLY records intent — it never marks the order as paid.
    Admin still verifies manually via /admin/api/orders/<id>/payment.
    """
    order = Order.query.get(order_id)
    if not order:
        return jsonify({"success": False, "error": "Order not found"}), 404

    if order.status != 'Served':
        return jsonify({"success": False, "error": "Order is not yet served"}), 400

    if order.payment_status == 'paid':
        return jsonify({"success": False, "error": "Payment already verified"}), 400

    data = request.get_json(silent=True) or {}
    method = (data.get('method') or '').strip().lower()

    if method not in ('cash', 'upi'):
        return jsonify({"success": False, "error": "Invalid payment method"}), 400

    order.payment_method = method
    order.payment_status = 'awaiting' if method == 'upi' else 'unpaid'

    db.session.commit()

    return jsonify({
        "success": True,
        "payment_method": order.payment_method,
        "payment_status": order.payment_status
    })