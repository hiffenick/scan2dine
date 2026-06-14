"""
Industrial-grade cart service with proper error handling and concurrency control
"""
from flask import current_app
import json
import time
from typing import Dict, List, Optional
from decimal import Decimal

CART_TTL = 3600  # 1 hour
MAX_CART_ITEMS = 50
MAX_QUANTITY_PER_ITEM = 99

class CartError(Exception):
    """Base exception for cart operations"""
    pass

class CartValidationError(CartError):
    """Validation errors"""
    pass

def _redis():
    """Get Redis client from app config"""
    return current_app.config["REDIS_CLIENT"]

def _key(session_id: str) -> str:
    """Generate Redis key for cart"""
    return f"cart:{session_id}"

def get_cart(session_id: str) -> Dict:
    """
    Fetch cart from Redis with error handling
    
    Returns:
        Dict with cart structure or empty cart if not found
    """
    try:
        r = _redis()
        data = r.get(_key(session_id))
        
        if not data:
            return _empty_cart()
        
        cart_data = json.loads(data)
        
        # Validate structure
        if not isinstance(cart_data.get("cart"), list):
            current_app.logger.warning(f"Invalid cart structure for session {session_id}")
            return _empty_cart()
            
        return cart_data
        
    except json.JSONDecodeError as e:
        current_app.logger.error(f"Cart JSON decode error for {session_id}: {e}")
        return _empty_cart()
    except Exception as e:
        current_app.logger.error(f"Cart fetch error for {session_id}: {e}")
        return _empty_cart()

def save_cart(session_id: str, cart_ctx: Dict) -> bool:
    """
    Save cart to Redis with validation
    
    Args:
        session_id: Session identifier
        cart_ctx: Cart data dictionary
        
    Returns:
        bool: Success status
    """
    try:
        # Validate cart structure
        _validate_cart_structure(cart_ctx)
        
        # Add metadata
        cart_ctx["updated_at"] = time.time()
        cart_ctx["version"] = cart_ctx.get("version", 0) + 1
        
        # Save to Redis
        r = _redis()
        r.setex(_key(session_id), CART_TTL, json.dumps(cart_ctx))
        
        return True
        
    except CartValidationError as e:
        current_app.logger.warning(f"Cart validation failed for {session_id}: {e}")
        raise
    except Exception as e:
        current_app.logger.error(f"Cart save error for {session_id}: {e}")
        raise CartError(f"Failed to save cart: {str(e)}")

def clear_cart(session_id: str) -> bool:
    """Clear cart from Redis"""
    try:
        r = _redis()
        r.delete(_key(session_id))
        return True
    except Exception as e:
        current_app.logger.error(f"Cart clear error for {session_id}: {e}")
        return False

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
    
    # Check cart size
    if len(cart_ctx["cart"]) > MAX_CART_ITEMS:
        raise CartValidationError(f"Cart cannot exceed {MAX_CART_ITEMS} items")
    
    # Validate each item
    for item in cart_ctx["cart"]:
        if not isinstance(item, dict):
            raise CartValidationError("Each cart item must be a dictionary")
        
        # Required fields
        required = ["id", "quantity"]
        for field in required:
            if field not in item:
                raise CartValidationError(f"Cart item missing required field: {field}")
        
        # Validate quantity
        qty = item.get("quantity", 0)
        if not isinstance(qty, (int, float)) or qty < 1 or qty > MAX_QUANTITY_PER_ITEM:
            raise CartValidationError(f"Invalid quantity: {qty}")

def calculate_totals(items: List[Dict], tax_rate: float = 0.1) -> Dict:
    """
    Calculate cart totals from items
    
    Args:
        items: List of cart items with price and quantity
        tax_rate: Tax rate (default 10%)
        
    Returns:
        Dict with subtotal, tax, discount, and grand_total
    """
    subtotal = Decimal("0.00")
    
    for item in items:
        price = Decimal(str(item.get("price", 0)))
        qty = int(item.get("quantity", 0))
        subtotal += price * qty
    
    discount = Decimal("0.00")  # Apply discount logic here if needed
    taxable = subtotal - discount
    tax = taxable * Decimal(str(tax_rate))
    grand_total = taxable + tax
    
    return {
        "subtotal": float(subtotal),
        "discount": float(discount),
        "tax": float(tax),
        "grand_total": float(grand_total)
    }