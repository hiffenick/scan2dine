"""
Customer Session Management - No Redis Required

Stores customer data in-memory with thread safety, AND persists it to a
local JSON file on every write. This means active sessions survive:
  - Flask's debug-mode auto-reloader restarting the process on file save
  - Accidental crashes / manual restarts during development

On import, sessions are loaded back from disk so they pick up exactly
where they left off. No Redis, no external service — just a dict guarded
by a lock, backed by a flat file.
"""

import os
import uuid
import json
import threading
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

SESSION_MUTEX = threading.Lock()

SESSION_TTL = 24 * 60 * 60  # 24 hours in seconds

# Where the persisted sessions live. Same folder as this file, hidden-ish name.
SESSION_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_customer_sessions.json")


# ─────────────────────────────────────────────
# PERSISTENCE: load on import, save on every write
# ─────────────────────────────────────────────

def _load_sessions() -> Dict[str, Dict[str, Any]]:
    """Load persisted sessions from disk. Returns {} if file is missing/corrupt."""
    if not os.path.exists(SESSION_FILE):
        return {}

    try:
        with open(SESSION_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        print(f"⚠️ Could not read session file ({e}), starting fresh.")
        return {}

    sessions: Dict[str, Dict[str, Any]] = {}
    for session_id, info in raw.items():
        try:
            expires_at = datetime.fromisoformat(info["expires_at"])
        except (KeyError, ValueError, TypeError):
            # Corrupt entry — skip it rather than failing the whole load
            continue
        sessions[session_id] = {
            "data": info.get("data", {}),
            "expires_at": expires_at
        }
    return sessions


def _save_sessions_locked():
    """
    Write the current in-memory sessions to disk.
    MUST be called while already holding SESSION_MUTEX.
    """
    try:
        serializable = {
            session_id: {
                "data": info["data"],
                "expires_at": info["expires_at"].isoformat()
            }
            for session_id, info in CUSTOMER_SESSIONS.items()
        }
        tmp_path = SESSION_FILE + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(serializable, f)
        os.replace(tmp_path, SESSION_FILE)  # atomic on POSIX and Windows
    except OSError as e:
        print(f"⚠️ Failed to persist sessions to disk: {e}")


# In-memory storage for customer sessions, hydrated from disk at import time.
# Structure: { session_id: { "data": {...}, "expires_at": datetime } }
CUSTOMER_SESSIONS: Dict[str, Dict[str, Any]] = _load_sessions()


def _cleanup_expired_sessions():
    """Remove expired sessions from memory and persist the cleanup."""
    with SESSION_MUTEX:
        now = datetime.now()
        expired_sessions = [
            session_id for session_id, session_info in CUSTOMER_SESSIONS.items()
            if session_info.get("expires_at") and session_info["expires_at"] < now
        ]
        if not expired_sessions:
            return
        for session_id in expired_sessions:
            del CUSTOMER_SESSIONS[session_id]
            print(f"🗑️ Expired session cleaned up: {session_id}")
        _save_sessions_locked()


def create_customer_session(table_no: int) -> str:
    """
    Create a new customer session.

    Args:
        table_no: The table number

    Returns:
        str: The session ID
    """
    _cleanup_expired_sessions()

    session_id = str(uuid.uuid4())
    expires_at = datetime.now() + timedelta(seconds=SESSION_TTL)

    session_data = {
        "session_id": session_id,
        "table_no": table_no,
        "customer_name": "Walk-in",
        "guest_count": 1,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }

    with SESSION_MUTEX:
        CUSTOMER_SESSIONS[session_id] = {
            "data": session_data,
            "expires_at": expires_at
        }
        _save_sessions_locked()

    print(f"✅ Customer session created: {session_id} for table {table_no}")
    return session_id


def get_customer_session(session_id: str) -> Optional[Dict[str, Any]]:
    """
    Get customer session data.

    Args:
        session_id: The session ID

    Returns:
        dict: Session data or None if not found/expired
    """
    _cleanup_expired_sessions()

    with SESSION_MUTEX:
        if session_id not in CUSTOMER_SESSIONS:
            return None

        session_info = CUSTOMER_SESSIONS[session_id]
        expires_at = session_info.get("expires_at")

        # Check if session has expired
        if expires_at and expires_at < datetime.now():
            del CUSTOMER_SESSIONS[session_id]
            _save_sessions_locked()
            print(f"⏰ Session expired: {session_id}")
            return None

        return session_info.get("data")


def update_customer_session(session_id: str, **kwargs) -> bool:
    """
    Update customer session data.

    Args:
        session_id: The session ID
        **kwargs: Fields to update (customer_name, guest_count, etc.)

    Returns:
        bool: True if updated, False if session not found
    """
    _cleanup_expired_sessions()

    with SESSION_MUTEX:
        if session_id not in CUSTOMER_SESSIONS:
            return False

        session_info = CUSTOMER_SESSIONS[session_id]
        expires_at = session_info.get("expires_at")

        # Check if session has expired
        if expires_at and expires_at < datetime.now():
            del CUSTOMER_SESSIONS[session_id]
            _save_sessions_locked()
            return False

        # Update data
        session_data = session_info.get("data", {})
        session_data.update(kwargs)
        session_data["updated_at"] = datetime.now().isoformat()
        session_info["data"] = session_data  # explicit write-back, no ambiguity

        _save_sessions_locked()

        print(f"✏️ Session updated: {session_id} — {kwargs}")
        return True


def delete_customer_session(session_id: str) -> bool:
    """
    Delete a customer session (e.g., when order is completed).

    Args:
        session_id: The session ID

    Returns:
        bool: True if deleted, False if not found
    """
    with SESSION_MUTEX:
        if session_id in CUSTOMER_SESSIONS:
            del CUSTOMER_SESSIONS[session_id]
            _save_sessions_locked()
            print(f"🗑️ Session deleted: {session_id}")
            return True
        return False


def get_all_sessions() -> Dict[str, Dict[str, Any]]:
    """
    Get all active customer sessions (useful for admin dashboard).

    Returns:
        dict: Dictionary of all sessions
    """
    _cleanup_expired_sessions()

    with SESSION_MUTEX:
        # Return only the data part, not the expires_at metadata
        return {
            session_id: session_info.get("data", {})
            for session_id, session_info in CUSTOMER_SESSIONS.items()
        }


def get_sessions_for_table(table_no: int) -> Optional[Dict[str, Any]]:
    """
    Get session data for a specific table.

    Args:
        table_no: The table number

    Returns:
        dict: Session data or None if not found
    """
    _cleanup_expired_sessions()

    with SESSION_MUTEX:
        for session_id, session_info in CUSTOMER_SESSIONS.items():
            session_data = session_info.get("data", {})
            if session_data.get("table_no") == table_no:
                return session_data
        return None


def clear_all_sessions():
    """Clear all customer sessions (useful for testing/reset)."""
    with SESSION_MUTEX:
        CUSTOMER_SESSIONS.clear()
        _save_sessions_locked()
    print("🗑️ All customer sessions cleared")


# Legacy/compatibility functions (in case code uses these)
def set_customer_session_data(session_id: str, data: Dict[str, Any]) -> bool:
    """Legacy function - use update_customer_session instead."""
    return update_customer_session(session_id, **data)


def session_exists(session_id: str) -> bool:
    """Check if a session exists and is not expired."""
    return get_customer_session(session_id) is not None


def get_table_number(session_id):
    session_data = get_customer_session(session_id)

    if not session_data:
        return None

    return session_data.get("table_no")