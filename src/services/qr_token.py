from datetime import datetime, timedelta
import json
import threading

# In-memory storage for table locks (key: table_number, value: {"data": {...}, "expires_at": timestamp})
TABLE_LOCKS = {}
LOCK_MUTEX = threading.Lock()  # Thread safety for concurrent requests

LOCK_TTL = 30 * 60  # 30 minutes in seconds


def _cleanup_expired_locks():
    """Remove expired locks from memory."""
    with LOCK_MUTEX:
        now = datetime.now()
        expired_tables = [
            table_no for table_no, lock_info in TABLE_LOCKS.items()
            if lock_info.get("expires_at") and lock_info["expires_at"] < now
        ]
        for table_no in expired_tables:
            del TABLE_LOCKS[table_no]


def generate_token(table_number):
    """Generate a token — DB is the source of truth, not Redis."""
    import secrets
    return secrets.token_urlsafe(32)


def validate_token(token, table_number):
    """Validate token against database — survives restarts."""
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
    """Check if a table is currently locked."""
    _cleanup_expired_locks()
    with LOCK_MUTEX:
        return table_number not in TABLE_LOCKS


def lock_table(table_number, session_id, token=None, user_agent=None, fingerprint=None):
    """Lock a table with session info and TTL."""
    lock_data = {
        "session_id": session_id,
        "token": token or "",
        "user_agent": user_agent or "",
        "fingerprint": fingerprint or ""
    }
    expires_at = datetime.now() + timedelta(seconds=LOCK_TTL)
    
    with LOCK_MUTEX:
        TABLE_LOCKS[table_number] = {
            "data": lock_data,
            "expires_at": expires_at
        }
    
    print(f"🔒 Table {table_number} locked for session {session_id} (expires at {expires_at})")


def get_table_lock(table_number):
    """Get lock info for a table, returns None if not locked or expired."""
    _cleanup_expired_locks()
    
    with LOCK_MUTEX:
        if table_number not in TABLE_LOCKS:
            return None
        
        lock_info = TABLE_LOCKS[table_number]
        expires_at = lock_info.get("expires_at")
        
        # Check if lock has expired
        if expires_at and expires_at < datetime.now():
            del TABLE_LOCKS[table_number]
            return None
        
        return lock_info.get("data")


def release_table(table_number):
    """Called when admin marks order completed/cancelled."""
    try:
        with LOCK_MUTEX:
            if table_number in TABLE_LOCKS:
                del TABLE_LOCKS[table_number]
                print(f"🔓 Table {table_number} released")
            else:
                print(f"ℹ️ Table {table_number} was not locked")
    
    except Exception as e:
        print(f"⚠️ Warning: release_table failed for table {table_number}: {e}")


def get_all_locked_tables():
    """Get list of all currently locked tables (useful for admin dashboard)."""
    _cleanup_expired_locks()
    with LOCK_MUTEX:
        return list(TABLE_LOCKS.keys())


def clear_all_locks():
    """Clear all table locks (useful for testing/reset)."""
    with LOCK_MUTEX:
        TABLE_LOCKS.clear()
    print("🗑️ All table locks cleared")