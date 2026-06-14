import json
import secrets
from datetime import datetime
from flask import current_app


class SessionManager:

    PRE_2FA_KEY = 'pre_2fa_user_id'
    USER_KEY = 'user_id'
    SESSION_TOKEN_KEY = 'session_token'

    @staticmethod
    def _get_redis():
        """Get redis client from app config (if available)."""
        return current_app.config.get('REDIS_CLIENT')

    @staticmethod
    def get_pre_2fa_user_id(session):
        """Get user ID from pre-2FA session"""
        return session.get(SessionManager.PRE_2FA_KEY)

    @staticmethod
    def create_pre_2fa_session(session, user_id):
        """Create a pre-2FA session to track user during 2FA setup/verification

        Keeps this brief and non-permanent until 2FA completes. This avoids
        elevating privileges before 2FA completes.
        """
        session.clear()
        session[SessionManager.PRE_2FA_KEY] = user_id
        # Keep short-lived browser session until 2FA completes
        session.permanent = False

    @staticmethod
    def create_user_session(session, user):
        """Create a full user session after successful 2FA.

        This method rotates the session token to prevent session fixation,
        stores a server-side mapping (in Redis) from token -> user id and
        sets the session cookie attributes according to the app config.
        """
        # Clear any existing session data to avoid fixation
        session.clear()

        # Create a cryptographically secure session token
        token = secrets.token_urlsafe(32)

        # Store token and minimal user info in Flask session (cookie holds only a session id)
        session[SessionManager.USER_KEY] = user.id
        session[SessionManager.SESSION_TOKEN_KEY] = token

        # Make session persistent according to app config (PERMANENT_SESSION_LIFETIME)
        session.permanent = True

        # Also store the token mapping server-side in Redis with the same lifetime
        try:
            redis = SessionManager._get_redis()
            if redis:
                key = f"web_session:{token}"
                payload = {
                    "user_id": user.id,
                    "created_at": datetime.utcnow().isoformat()
                }
                # TTL should follow Flask's PERMANENT_SESSION_LIFETIME
                lifetime = getattr(current_app, 'permanent_session_lifetime', None)
                # If lifetime is a timedelta, convert to seconds, else fallback to 3600
                ttl = int(lifetime.total_seconds()) if hasattr(lifetime, 'total_seconds') else 3600
                redis.setex(key, ttl, json.dumps(payload))
        except Exception:
            # Avoid breaking login flow if Redis is unavailable; still keep local session
            current_app.logger.exception('Failed to store session token in Redis')

    @staticmethod
    def verify_session_token(token):
        """Verify a session token against Redis and return user_id if valid.

        Returns None if token is invalid or expired.
        """
        if not token:
            return None
        try:
            redis = SessionManager._get_redis()
            if not redis:
                return None
            key = f"web_session:{token}"
            data = redis.get(key)
            if not data:
                return None
            payload = json.loads(data)
            return payload.get('user_id')
        except Exception:
            current_app.logger.exception('Error verifying session token')
            return None

    @staticmethod
    def clear_session(session):
        """Clear all session data and remove server-side token mapping if present."""
        try:
            token = session.get(SessionManager.SESSION_TOKEN_KEY)
            if token:
                redis = SessionManager._get_redis()
                if redis:
                    redis.delete(f"web_session:{token}")
        except Exception:
            current_app.logger.exception('Failed removing session token from Redis')

        # Clear the Flask session cookie data
        session.clear()
        session.permanent = False

        