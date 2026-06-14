"""
Redis-based session management for customer table assignments
"""
from flask import current_app
import json
import uuid
from datetime import datetime

SESSION_TTL = 1800  


def get_redis():
    """Get Redis client"""
    return current_app.config["REDIS_CLIENT"]


def create_customer_session(table_no, customer_name=None, guest_count=None, single_use=False):
    """
    Create a new customer session in Redis
    
    Args:
        table_no: Table number from QR scan
        customer_name: Optional customer name
        guest_count: Optional number of guests
        
    Returns:
        session_id: UUID for the customer session
    """
    session_id = str(uuid.uuid4())
    redis = get_redis()
    
    session_data = {
        "session_id": session_id,
        "table_no": table_no,
        "customer_name": customer_name or "Walk-in",
        "guest_count": guest_count or 1,
        "created_at": datetime.utcnow().isoformat(),
        "single_use": bool(single_use)
    }
    
    # Store in Redis with TTL
    key = f"customer_session:{session_id}"
    redis.setex(key, SESSION_TTL, json.dumps(session_data))
    
    return session_id


def get_customer_session(session_id):
    """
    Get customer session data from Redis
    
    Args:
        session_id: Session UUID
        
    Returns:
        dict: Session data or None if not found
    """
    if not session_id:
        return None
    
    redis = get_redis()
    key = f"customer_session:{session_id}"
    
    data = redis.get(key)
    if not data:
        return None
    
    try:
        return json.loads(data)
    except json.JSONDecodeError:
        return None


def claim_customer_session(session_id):
    """
    Claim a customer session. If the session was created as single-use,
    this will delete it from Redis so it cannot be reused. Returns the
    session data dict or None if not found.
    """
    if not session_id:
        return None

    redis = get_redis()
    key = f"customer_session:{session_id}"
    data = redis.get(key)
    if not data:
        return None

    try:
        payload = json.loads(data)
    except json.JSONDecodeError:
        return None

    # If marked single_use, delete the key to prevent reuse
    if payload.get("single_use"):
        try:
            redis.delete(key)
        except Exception:
            pass

    return payload


def delete_customer_session(session_id):
    """Delete a customer session key from Redis."""
    if not session_id:
        return False
    try:
        redis = get_redis()
        key = f"customer_session:{session_id}"
        return redis.delete(key) == 1
    except Exception:
        return False


def get_table_number(session_id):
    """
    Get table number for a session from Redis
    
    Args:
        session_id: Session UUID
        
    Returns:
        int: Table number or None
    """
    session_data = get_customer_session(session_id)
    if session_data:
        return session_data.get("table_no")
    return None


def update_customer_session(session_id, **updates):
    """
    Update customer session data in Redis
    
    Args:
        session_id: Session UUID
        **updates: Fields to update (e.g., customer_name="John", guest_count=4)
        
    Returns:
        bool: Success status
    """
    session_data = get_customer_session(session_id)
    if not session_data:
        return False
    
    # Update fields
    session_data.update(updates)
    
    # Save back to Redis
    redis = get_redis()
    key = f"customer_session:{session_id}"
    redis.setex(key, SESSION_TTL, json.dumps(session_data))
    
    return True


def extend_session(session_id):
    """
    Extend session TTL (refresh timeout)
    
    Args:
        session_id: Session UUID
        
    Returns:
        bool: Success status
    """
    redis = get_redis()
    key = f"customer_session:{session_id}"
    
    # Check if session exists
    if not redis.exists(key):
        return False
    
    # Extend TTL
    redis.expire(key, SESSION_TTL)
    return True