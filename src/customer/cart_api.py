"""
Cart API endpoints for managing shopping cart
Uses Redis for cart storage
"""
from flask import Blueprint, request, jsonify, session, current_app
from decimal import Decimal
import uuid

from src.models.menu import MenuItem
from src.extensions import csrf
from src.services.cart_service import (
    get_cart,
    save_cart,
    clear_cart,
    calculate_totals,
    CartError,
    CartValidationError,
    MAX_QUANTITY_PER_ITEM
)

cart_api_bp = Blueprint(
    "cart_api",
    __name__,
    url_prefix="/api/cart"
)


def _get_session_id():
    """Get or create session ID"""
    session_id = session.get("session_id")
    if not session_id:
        session_id = str(uuid.uuid4())
        session["session_id"] = session_id
    return session_id


from src.models.setting import Setting
from flask import jsonify

@cart_api_bp.route("/payment-methods", methods=["GET"])
def get_payment_methods():
    """
    Temporary hardcoded payment methods.
    """

    return jsonify({
        "success": True,
        "methods": [
            {
                "id": "cash",
                "name": "Pay at Counter",
                "description": "Pay by cash when your order is served.",
                "icon": "cash"
            },
            {
                "id": "online",
                "name": "UPI",
                "description": "Pay using any UPI app",
                "icon": "upi",
                "merchant": "Kans Resto",
                "vpa": "kansresto@okaxis"
            }
        ]
    })

@cart_api_bp.route("/current", methods=["GET"])
@csrf.exempt  # ← CSRF exemption for API endpoint
def get_current_cart():
    """
    Get current cart contents from Redis
    
    Returns:
        JSON with cart items and totals
    """
    try:
        session_id = _get_session_id()
        cart_ctx = get_cart(session_id)  # ← Fetches from Redis
        
        items = cart_ctx.get("cart", [])
        totals = cart_ctx.get("totals", {})
        
        # Enrich items with current database info
        enriched_items = []
        for item in items:
            menu_id = item.get("id")
            menu = MenuItem.query.get(menu_id)
            
            if menu and menu.is_active:
                enriched_items.append({
                    "id": menu.id,
                    "name": menu.item_name,
                    "price": float(menu.item_price),
                    "quantity": item.get("quantity", 1),
                    "image": menu.image_url if hasattr(menu, 'image_url') else None
                })
        
        # Recalculate totals with current prices
        if enriched_items:
            totals = calculate_totals(enriched_items)
        else:
            totals = {
                "subtotal": 0.0,
                "discount": 0.0,
                "tax": 0.0,
                "grand_total": 0.0
            }
        
        return jsonify({
            "success": True,
            "items": enriched_items,
            "totals": totals
        })
        
    except CartError as e:
        current_app.logger.error(f"Cart fetch error: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to fetch cart"
        }), 500
    except Exception as e:
        current_app.logger.error(f"Unexpected error in get_current_cart: {e}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "An error occurred"
        }), 500


@cart_api_bp.route("", methods=["POST"])
@csrf.exempt  # ← CSRF exemption for API endpoint
def update_cart():
    """
    Update cart: add, remove, or delete items
    Saves to Redis
    
    Expected JSON:
        {
            "item_id": 123,
            "action": "ADD" | "REMOVE" | "DELETE" | "SET",
            "quantity": 5  # only for SET action
        }
    
    Returns:
        JSON with updated cart
    """
    try:
        session_id = _get_session_id()
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "error": "No data provided"
            }), 400
        
        item_id = data.get("item_id")
        action = data.get("action", "").upper()
        
        # Validate inputs
        if not item_id:
            return jsonify({
                "success": False,
                "error": "item_id is required"
            }), 400
        
        if action not in ["ADD", "REMOVE", "DELETE", "SET"]:
            return jsonify({
                "success": False,
                "error": "Invalid action. Must be ADD, REMOVE, DELETE, or SET"
            }), 400
        
        # Verify menu item exists and is active
        menu = MenuItem.query.get(item_id)
        if not menu:
            return jsonify({
                "success": False,
                "error": "Menu item not found"
            }), 404
        
        if not menu.is_active:
            return jsonify({
                "success": False,
                "error": "This item is no longer available"
            }), 400
        
        # Get current cart from Redis
        cart_ctx = get_cart(session_id)  # ← Fetches from Redis
        items = cart_ctx.get("cart", [])
        
        # Find existing item in cart
        existing_item = None
        for i, cart_item in enumerate(items):
            if cart_item.get("id") == item_id:
                existing_item = cart_item
                break
        
        # Perform action
        if action == "ADD":
            if existing_item:
                # Increment quantity
                new_qty = existing_item.get("quantity", 0) + 1
                if new_qty > MAX_QUANTITY_PER_ITEM:
                    return jsonify({
                        "success": False,
                        "error": f"Maximum quantity is {MAX_QUANTITY_PER_ITEM}"
                    }), 400
                existing_item["quantity"] = new_qty
            else:
                # Add new item
                items.append({
                    "id": item_id,
                    "name": menu.item_name,
                    "price": float(menu.item_price),
                    "quantity": 1
                })
        
        elif action == "REMOVE":
            if existing_item:
                existing_item["quantity"] = existing_item.get("quantity", 1) - 1
                if existing_item["quantity"] <= 0:
                    items.remove(existing_item)
            else:
                return jsonify({
                    "success": False,
                    "error": "Item not in cart"
                }), 400
        
        elif action == "DELETE":
            if existing_item:
                items.remove(existing_item)
            else:
                return jsonify({
                    "success": False,
                    "error": "Item not in cart"
                }), 400
        
        elif action == "SET":
            quantity = data.get("quantity")
            if quantity is None:
                return jsonify({
                    "success": False,
                    "error": "quantity is required for SET action"
                }), 400
            
            try:
                quantity = int(quantity)
                if quantity < 0:
                    return jsonify({
                        "success": False,
                        "error": "Quantity must be positive"
                    }), 400
                
                if quantity > MAX_QUANTITY_PER_ITEM:
                    return jsonify({
                        "success": False,
                        "error": f"Maximum quantity is {MAX_QUANTITY_PER_ITEM}"
                    }), 400
            except (ValueError, TypeError):
                return jsonify({
                    "success": False,
                    "error": "Invalid quantity"
                }), 400
            
            if quantity == 0:
                # Remove item
                if existing_item:
                    items.remove(existing_item)
            else:
                if existing_item:
                    existing_item["quantity"] = quantity
                else:
                    items.append({
                        "id": item_id,
                        "name": menu.item_name,
                        "price": float(menu.item_price),
                        "quantity": quantity
                    })
        
        # Calculate totals
        totals = calculate_totals(items) if items else {
            "subtotal": 0.0,
            "discount": 0.0,
            "tax": 0.0,
            "grand_total": 0.0
        }
        
        # Save updated cart to Redis
        cart_ctx["cart"] = items
        cart_ctx["totals"] = totals
        
        try:
            save_cart(session_id, cart_ctx)  # ← Saves to Redis
        except CartValidationError as e:
            return jsonify({
                "success": False,
                "error": str(e)
            }), 400
        except CartError as e:
            current_app.logger.error(f"Cart save error: {e}")
            return jsonify({
                "success": False,
                "error": "Failed to update cart"
            }), 500
        
        return jsonify({
            "success": True,
            "cart": items,
            "totals": totals
        })
        
    except Exception as e:
        current_app.logger.error(f"Unexpected error in update_cart: {e}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "An error occurred"
        }), 500


@cart_api_bp.route("/clear", methods=["POST"])
@csrf.exempt  # ← CSRF exemption for API endpoint
def clear_cart_endpoint():
    """
    Clear entire cart from Redis
    
    Returns:
        JSON success response
    """
    try:
        session_id = _get_session_id()
        clear_cart(session_id)  # ← Deletes from Redis
        
        return jsonify({
            "success": True,
            "message": "Cart cleared"
        })
        
    except Exception as e:
        current_app.logger.error(f"Error clearing cart: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to clear cart"
        }), 500


@cart_api_bp.route("/add", methods=["POST"])
@csrf.exempt  # ← CSRF exemption for API endpoint
def add_to_cart():
    """
    Quick add item to cart (alternative endpoint)
    
    Expected JSON:
        {
            "menu_item_id": 123,
            "quantity": 2  # optional, default 1
        }
    
    Returns:
        JSON with updated cart
    """
    try:
        session_id = _get_session_id()
        data = request.get_json()
        
        if not data or "menu_item_id" not in data:
            return jsonify({
                "success": False,
                "error": "menu_item_id is required"
            }), 400
        
        menu_item_id = data["menu_item_id"]
        quantity = data.get("quantity", 1)
        
        # Create request data for update_cart
        update_data = {
            "item_id": menu_item_id,
            "action": "SET" if quantity > 1 else "ADD",
            "quantity": quantity
        }
        
        # Simulate the request for update_cart
        # We'll call the logic directly
        menu = MenuItem.query.get(menu_item_id)
        if not menu:
            return jsonify({
                "success": False,
                "error": "Menu item not found"
            }), 404
        
        if not menu.is_active:
            return jsonify({
                "success": False,
                "error": "This item is no longer available"
            }), 400
        
        # Get current cart
        cart_ctx = get_cart(session_id)
        items = cart_ctx.get("cart", [])
        
        # Find or add item
        existing_item = None
        for cart_item in items:
            if cart_item.get("id") == menu_item_id:
                existing_item = cart_item
                break
        
        if existing_item:
            existing_item["quantity"] = quantity
        else:
            items.append({
                "id": menu_item_id,
                "name": menu.item_name,
                "price": float(menu.item_price),
                "quantity": quantity
            })
        
        # Calculate totals
        totals = calculate_totals(items) if items else {
            "subtotal": 0.0,
            "discount": 0.0,
            "tax": 0.0,
            "grand_total": 0.0
        }
        
        # Save to Redis
        cart_ctx["cart"] = items
        cart_ctx["totals"] = totals
        save_cart(session_id, cart_ctx)
        
        return jsonify({
            "success": True,
            "cart": items,
            "totals": totals
        })
        
    except Exception as e:
        current_app.logger.error(f"Error in add_to_cart: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to add item"
        }), 500