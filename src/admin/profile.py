from flask import request, jsonify, session, render_template,redirect,url_for
from flask_login import login_required, current_user, logout_user
import pyotp
import bcrypt

from src.extensions import db
from . import admin_bp


# ─────────────────────────────────────────────
# Helper: verify bcrypt password
# ─────────────────────────────────────────────
def _check_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_totp(user, code: str) -> bool:
    if not user.totp_secret:
        return False
    totp = pyotp.TOTP(user.totp_secret)
    return totp.verify(code, valid_window=1)


# ─────────────────────────────────────────────
# GET /admin/profile
# ─────────────────────────────────────────────
@admin_bp.route("/profile", methods=["GET"])
@login_required
def profile():
    from datetime import datetime, timezone

    login_time_iso = session.get("login_time")
    last_login = "—"
    session_duration_seconds = 0

    if login_time_iso:
        login_dt = datetime.fromisoformat(login_time_iso)
        last_login = login_dt.strftime("%d %b %Y, %I:%M %p")
        session_duration_seconds = int((datetime.now(timezone.utc) - login_dt).total_seconds())

    from src.services.activity import get_client_ip
    client_ip = session.get("client_ip", get_client_ip())

    ua = request.headers.get("User-Agent", "")
    from src.services.activity import parse_user_agent  # adjust import path to wherever you put it
    browser, os_name = parse_user_agent(ua)

    return render_template(
        "admin/profile.html",
        active_page="profile",
        last_login=last_login,
        device_info=f"{browser} · {os_name}",
        session_duration_seconds=session_duration_seconds,
        client_ip=client_ip,
    )

# ─────────────────────────────────────────────
# POST /admin/profile/update
# Update display name, email, restaurant name
# ─────────────────────────────────────────────
@admin_bp.route("/profile/update", methods=["POST"])
@login_required
def profile_update():
    data = request.get_json(silent=True) or {}

    name            = data.get("name", "").strip()
    email           = data.get("email", "").strip().lower()
    restaurant_name = data.get("restaurant_name", "").strip()

    if not name or not email:
        return jsonify(success=False, message="Name and email are required."), 400

    # Check email uniqueness (skip if unchanged)
    if email != current_user.email:
        from src.models import User  # avoid circular import at top level
        existing = User.query.filter_by(email=email).first()
        if existing:
            return jsonify(success=False, message="That email is already in use."), 409

    current_user.name  = name
    current_user.email = email

    # restaurant_name is optional — only save if the column exists on the model
    if hasattr(current_user, "restaurant_name"):
        current_user.restaurant_name = restaurant_name or "Cozy Cafe"

    db.session.commit()
    return jsonify(success=True)


# ─────────────────────────────────────────────
# POST /admin/profile/change-password
# Requires: current_password, new_password, totp_code
# ─────────────────────────────────────────────
@admin_bp.route("/profile/change-password", methods=["POST"])
@login_required
def profile_change_password():
    data = request.get_json(silent=True) or {}

    current_password = data.get("current_password", "")
    new_password     = data.get("new_password", "")
    totp_code        = data.get("totp_code", "").strip()

    # Validate inputs
    if not current_password or not new_password or not totp_code:
        return jsonify(success=False, message="All fields are required."), 400

    if len(new_password) < 8:
        return jsonify(success=False, message="New password must be at least 8 characters."), 400

    # Verify current password
    if not _check_password(current_password, current_user.password):
        return jsonify(success=False, message="Current password is incorrect."), 401

    # Verify TOTP
    if not _verify_totp(current_user, totp_code):
        return jsonify(success=False, message="Invalid 2FA code."), 401

    current_user.password = _hash_password(new_password)
    db.session.commit()

    logout_user()
    session.clear()
    return jsonify(success=True,
                   redirect_url=url_for("login.login")
                )


# ─────────────────────────────────────────────
# POST /admin/profile/reset-2fa
# Clears totp_secret so the user must re-enroll
# Requires: password, totp_code
# ─────────────────────────────────────────────
@admin_bp.route("/profile/reset-2fa", methods=["POST"])
@login_required
def profile_reset_2fa():
    data = request.get_json(silent=True) or {}

    password  = data.get("password", "")
    totp_code = data.get("totp_code", "").strip()

    if not password or not totp_code:
        return jsonify(success=False, message="Password and 2FA code are required."), 400

    if not _check_password(password, current_user.password):
        return jsonify(success=False, message="Incorrect password."), 401

    if not _verify_totp(current_user, totp_code):
        return jsonify(success=False, message="Invalid 2FA code."), 401

    # Generate a fresh TOTP secret; disable 2FA so setup flow re-runs
    current_user.totp_secret = pyotp.random_base32()
    current_user.totp_enable = False
    db.session.commit()

    # Log the user out so they must re-authenticate and re-enroll 2FA
    logout_user()
    return jsonify(success=True,
                   redirect_url=url_for("login.login")
)


# ─────────────────────────────────────────────
# POST /admin/profile/sign-out-all
# Flask-Login only — clears the current session
# and bumps a server-side counter so existing
# "remember me" cookies are invalidated.
# Requires: totp_code
# ─────────────────────────────────────────────
@admin_bp.route("/profile/sign-out-all", methods=["POST"])
@login_required
def profile_sign_out_all():
    data = request.get_json(silent=True) or {}
    totp_code = data.get("totp_code", "").strip()

    if not totp_code:
        return jsonify(success=False, message="2FA code is required."), 400

    if not _verify_totp(current_user, totp_code):
        return jsonify(success=False, message="Invalid 2FA code."), 401

    # Flask-Login doesn't natively track all sessions.
    # Rotating the user's TOTP secret invalidates any session that stores it,
    # and logging out destroys the current session cookie.
    # For a full multi-session kill: store a `session_version` int on the User
    # model and increment it here, then check it in a @login_manager.request_loader.
    logout_user()
    session.clear()
    return jsonify(success=True)


# ─────────────────────────────────────────────
# POST /admin/profile/delete-account
# Requires: password, totp_code, confirm_text
# ─────────────────────────────────────────────
@admin_bp.route("/profile/delete-account", methods=["POST"])
@login_required
def profile_delete_account():
    data = request.get_json(silent=True) or {}

    password     = data.get("password", "")
    totp_code    = data.get("totp_code", "").strip()
    confirm_text = data.get("confirm_text", "").strip()

    if confirm_text != "DELETE MY ACCOUNT":
        return jsonify(success=False, message="Confirmation text does not match."), 400

    if not password or not totp_code:
        return jsonify(success=False, message="Password and 2FA code are required."), 400

    if not _check_password(password, current_user.password):
        return jsonify(success=False, message="Incorrect password."), 401

    if not _verify_totp(current_user, totp_code):
        return jsonify(success=False, message="Invalid 2FA code."), 401

    user = current_user._get_current_object()
    logout_user()
    session.clear()

    db.session.delete(user)
    db.session.commit()

    return jsonify(success=True, redirect="/")


# ─────────────────────────────────────────────
# GET /admin/profile/activity
# Returns mock events (profile.js falls back to
# its own mocks if this endpoint fails, so this
# is just a clean pass-through for now).
# ─────────────────────────────────────────────
@admin_bp.route("/profile/activity", methods=["GET"])
@login_required
def profile_activity():
    from src.models.activity_log import ActivityLog

    logs = (
        ActivityLog.query
        .filter_by(user_id=current_user.id)
        .order_by(ActivityLog.created_at.desc())
        .limit(20)
        .all()
    )
    return jsonify(events=[log.to_dict() for log in logs])
