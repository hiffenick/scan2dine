"""
Cart service — Flask-session-backed (no Redis).
Cart is stored directly in the Flask session, keyed by session_id
for API-shape compatibility with callers (menu_services.py).
"""
from flask import session
import time
from typing import Dict, List, Optional
from decimal import Decimal

MAX_CART_ITEMS = 50
MAX_QUANTITY_PER_ITEM = 99


class CartError(Exception):
    """Base exception for cart operations"""
    pass


class CartValidationError(CartError):
    """Validation errors"""
    pass


def _store_key(session_id: str) -> str:
    """Key used inside flask.session to namespace this cart"""
    return f"cart_store:{session_id}"


def get_cart(session_id: str) -> Dict:
    """
    Fetch cart from the Flask session.

    Returns:
        Dict with cart structure or empty cart if not found
    """
    try:
        cart_data = session.get(_store_key(session_id))

        if not cart_data or not isinstance(cart_data.get("cart"), list):
            return _empty_cart()

        return cart_data

    except Exception:
        return _empty_cart()


def save_cart(session_id: str, cart_ctx: Dict) -> bool:
    """
    Save cart into the Flask session with validation.

    Args:
        session_id: Session identifier
        cart_ctx: Cart data dictionary

    Returns:
        bool: Success status
    """
    _validate_cart_structure(cart_ctx)

    cart_ctx["updated_at"] = time.time()
    cart_ctx["version"] = cart_ctx.get("version", 0) + 1

    session[_store_key(session_id)] = cart_ctx
    session.modified = True

    return True


def clear_cart(session_id: str) -> bool:
    """Clear cart from the Flask session"""
    session.pop(_store_key(session_id), None)
    session.modified = True
    return True


def _empty_cart() -> Dict:
    """Return empty cart structure"""
    return {
        "cart": [],
        "totals": {
            "subtotal": 0.0,
            "discount": 0.0,
            "tax": 0.0,
            "grand_total": 0.0
        },
        "version": 0,
        "updated_at": None
    }


def _validate_cart_structure(cart_ctx: Dict) -> None:
    """
    Validate cart structure

    Raises:
        CartValidationError: If validation fails
    """
    if not isinstance(cart_ctx, dict):
        raise CartValidationError("Cart must be a dictionary")

    if "cart" not in cart_ctx or not isinstance(cart_ctx["cart"], list):
        raise CartValidationError("Cart must contain a 'cart' list")

    if len(cart_ctx["cart"]) > MAX_CART_ITEMS:
        raise CartValidationError(f"Cart cannot exceed {MAX_CART_ITEMS} items")

    for item in cart_ctx["cart"]:
        if not isinstance(item, dict):
            raise CartValidationError("Each cart item must be a dictionary")

        for field in ("id", "quantity"):
            if field not in item:
                raise CartValidationError(f"Cart item missing required field: {field}")

        qty = item.get("quantity", 0)
        if not isinstance(qty, (int, float)) or qty < 1 or qty > MAX_QUANTITY_PER_ITEM:
            raise CartValidationError(f"Invalid quantity: {qty}")


def calculate_totals(items: List[Dict], tax_rate: float = 0.1) -> Dict:
    """
    Calculate cart totals from items (unchanged math)
    """
    subtotal = Decimal("0.00")

    for item in items:
        price = Decimal(str(item.get("price", 0)))
        qty = int(item.get("quantity", 0))
        subtotal += price * qty

    discount = Decimal("0.00")
    taxable = subtotal - discount
    tax = taxable * Decimal(str(tax_rate))
    grand_total = taxable + tax

    return {
        "subtotal": float(subtotal),
        "discount": float(discount),
        "tax": float(tax),
        "grand_total": float(grand_total)
    }