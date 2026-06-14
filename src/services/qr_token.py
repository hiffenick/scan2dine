from flask import current_app
import json

LOCK_TTL = 30 * 60

def _redis():
    return current_app.config["REDIS_CLIENT"]

def generate_token(table_number):
    """Generate a token — DB is the source of truth, not Redis."""
    import secrets
    return secrets.token_urlsafe(32)

def validate_token(token, table_number):
    """Validate token against database — survives Redis restarts forever."""
    if not token:
        return False, "No token — please scan the QR code"

    from src.models.qr_code import QRCode
    qr = QRCode.query.filter_by(
        table_no=table_number,
        is_active=True,
        deleted_at=None
    ).order_by(QRCode.id.desc()).first()

    if not qr:
        return False, "No QR found for this table — please ask staff for help"

    if token not in (qr.qr_url or ""):
        return False, "Invalid QR code — please ask staff for help"

    return True, None

def is_table_free(table_number):
    return _redis().get(f"table_lock:{table_number}") is None

def lock_table(table_number, session_id, token=None, user_agent=None, fingerprint=None):
    lock_data = {
        "session_id": session_id,
        "token": token or "",
        "user_agent": user_agent or "",
        "fingerprint": fingerprint or ""
    }
    _redis().setex(f"table_lock:{table_number}", LOCK_TTL, json.dumps(lock_data))
    
def get_table_lock(table_number):
    raw = _redis().get(f"table_lock:{table_number}")
    if not raw:
        return None
    try:
        return json.loads(raw.decode('utf-8'))
    except Exception:
        _redis().delete(f"table_lock:{table_number}")
        return None

def release_table(table_number):
    """Called when admin marks order completed/cancelled."""
    locked = get_table_lock(table_number)
    if locked:
        old_session = locked.get("session_id")
        if old_session:
            _redis().delete(f"customer_session:{old_session}")
    _redis().delete(f"table_lock:{table_number}")