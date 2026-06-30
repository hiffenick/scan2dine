import uuid
from flask import Blueprint, jsonify, render_template, request, session, redirect, url_for
from src.models.menu import MenuItem
from src.models.order import Order
from src.extensions import db, csrf
from datetime import datetime
import json
from src.services.menu_service import get_menu_items, get_active_menu_items
from src.services.cart_service import get_cart, save_cart

MAX_ITEM_QTY = 10
MAX_CART_ITEMS = 25

customer_menu = Blueprint("customer_menu", __name__)


def is_verified_customer():
    return (
        session.get('token_verified') and
        session.get('session_id') and
        session.get('table_no')
    )

def forbidden():
    return render_template(
        'customer/forbidden.html',
        reason="Please scan the QR code to access this page."
    ), 403


@customer_menu.route("/menu/explore")
def explore_menu():
    if not is_verified_customer():
        return forbidden()

    if "order_ctx" not in session:
        session["order_ctx"] = {
            "state": "IDENTIFIED",
            "customer": {"name": "", "guests": 0}
        }

    order_ctx = session.get("order_ctx")
    if "customer" not in order_ctx:
        order_ctx["customer"] = {"name": "", "guests": 0}
        session["order_ctx"] = order_ctx

    items = get_active_menu_items()
    return render_template("customer/explore.html", items=items, order_ctx=order_ctx)


@customer_menu.route("/menu/cart")
def view_cart():
    if not is_verified_customer():
        return forbidden()

    session_id = session.get("session_id")
    if not session_id:
        session_id = str(uuid.uuid4())
        session["session_id"] = session_id
    ctx = get_cart(session_id)

    return render_template(
        "customer/cart.html",
        cart_items=ctx.get("cart", []),
        totals=ctx.get("totals", {}),
        session_id=session.get("session_id", ""),
        table_number=session.get("table_no", "?")
    )


@customer_menu.route("/api/menu", methods=["GET"])
def menu_api():
    if not is_verified_customer():
        return jsonify({"success": False, "error": "Unauthorized"}), 403

    try:
        category = request.args.get('category')
        search = request.args.get('search')
        items = get_menu_items()

        if category:
            items = [item for item in items if item.get('category') == category]

        if search:
            search_lower = search.lower()
            items = [
                item for item in items
                if search_lower in item.get('name', '').lower()
                or search_lower in item.get('description', '').lower()
            ]

        return jsonify({'success': True, 'items': items, 'count': len(items)})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e), 'items': []}), 500


@customer_menu.route("/api/menu/<int:item_id>", methods=["GET"])
def get_menu_item_detail(item_id):
    if not is_verified_customer():
        return jsonify({"success": False, "error": "Unauthorized"}), 403

    try:
        item = MenuItem.query.get(item_id)
        if not item:
            return jsonify({'success': False, 'error': 'Item not found'}), 404
        return jsonify({'success': True, 'item': item.to_dict()})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# @customer_menu.route("/api/cart", methods=["POST"])
# @csrf.exempt
# def cart_action():
#     if not is_verified_customer():
#         return jsonify({"success": False, "error": "Unauthorized"}), 403

#     try:
#         data = request.get_json(force=True)
#         item_id = int(data.get("item_id"))
#         action = data.get("action")
#     except Exception:
#         return jsonify({"success": False, "error": "Invalid request"}), 400

#     if action not in {"ADD", "REMOVE", "DELETE"}:
#         return jsonify({"success": False, "error": "Invalid action"}), 400

#     session_id = session.get("session_id")
#     if not session_id:
#         session_id = str(uuid.uuid4())
#         session["session_id"] = session_id

#     ctx = get_cart(session_id)
#     cart = ctx.get("cart", [])

#     item = MenuItem.query.get(item_id)
#     if not item or not item.is_active:
#         return jsonify({"success": False, "error": "Item unavailable"}), 404

#     cart_item = next((i for i in cart if int(i["id"]) == int(item_id)), None)

#     if action == "ADD":
#         if cart_item:
#             if cart_item["quantity"] >= MAX_ITEM_QTY:
#                 return jsonify({"success": False, "error": "Max quantity reached"}), 400
#             cart_item["quantity"] += 1
#         else:
#             if len(cart) >= MAX_CART_ITEMS:
#                 return jsonify({"success": False, "error": "Cart limit reached"}), 400
#             cart.append({
#                 "id": item.id,
#                 "name": item.item_name,
#                 "price": float(item.item_price),
#                 "quantity": 1
#             })

#     elif action == "REMOVE":
#         if cart_item:
#             cart_item["quantity"] -= 1
#             if cart_item["quantity"] <= 0:
#                 cart.remove(cart_item)

#     elif action == "DELETE":
#         if cart_item:
#             cart.remove(cart_item)

#     subtotal = sum(i["price"] * i["quantity"] for i in cart)
#     discount = round(subtotal * 0.10, 2)
#     tax = round((subtotal - discount) * 0.10, 2)

#     ctx.update({
#         "cart": cart,
#         "totals": {
#             "subtotal": round(subtotal, 2),
#             "discount": discount,
#             "tax": tax,
#             "grand_total": round(subtotal - discount + tax, 2)
#         },
#         "version": ctx.get("version", 1) + 1
#     })

#     save_cart(session_id, ctx)

#     return jsonify({
#         "success": True,
#         "cart": cart,
#         "totals": ctx["totals"],
#         "version": ctx["version"]
#     })


# @customer_menu.route("/api/cart/current", methods=["GET"])
# def current_cart():
#     if not is_verified_customer():
#         return jsonify({"success": False, "error": "Unauthorized"}), 403

#     if "cart_id" not in session:
#         session["cart_id"] = str(uuid.uuid4())

#     session_id = session["cart_id"]
#     ctx = get_cart(session_id)

#     return jsonify({
#         "success": True,
#         "items": ctx.get("cart", []),
#         "totals": ctx.get("totals", {}),
#         "version": ctx.get("version", 1)
#     })
