"""
src/blueprints/admin/payment_routes.py
Payments & UPI Management — full CRUD + 2-step auth (password + TOTP).

Endpoints
─────────
GET  /admin/payment-upi          → render page
GET  /admin/api/payment-settings → load current settings (JSON)
POST /admin/api/payment-verify-password → Step 1: verify admin password
POST /admin/api/payment-verify-totp     → Step 2: verify TOTP code
POST /admin/api/payment-save            → save UPI details (requires session token)
POST /admin/api/payment-qr-upload       → upload QR image   (requires session token)
POST /admin/api/payment-qr-remove       → remove QR image   (requires session token)

Security
────────
A short-lived session key `payment_auth_ok` is set to True only after both
password AND TOTP are verified.  Every mutating endpoint checks this key.
It is cleared after any successful mutation, forcing re-verification next time.
"""

import base64
import re
import pyotp

from flask import jsonify, request, render_template, session, current_app
from flask_login import login_required, current_user

from src.extensions import db, csrf
from src.models.paymentqr import PaymentSetting
from src.auth import UserService          # has .verify_password(user, raw_pw)

from . import admin_bp                   # your existing Blueprint


# ─── Auth session key ────────────────────────────────────────────────────────
_AUTH_KEY = "payment_auth_ok"


def _require_payment_auth():
    """Return (None, None) if authorised, else (error_response, status_code)."""
    if not session.get(_AUTH_KEY):
        return jsonify({"error": "Re-verification required. Please complete the 2-step check."}), 403
    return None, None


def _clear_payment_auth():
    session.pop(_AUTH_KEY, None)


# ─── Page ────────────────────────────────────────────────────────────────────

@admin_bp.route("/payment-upi", methods=["GET"])
@login_required
def payment():
    return render_template("admin/payment.html", active_page="settings")


# ─── Load settings ───────────────────────────────────────────────────────────

@admin_bp.route("/api/payment-settings", methods=["GET"])
@login_required
def payment_settings_get():
    """Return current payment settings as JSON (no QR binary — use has_qr flag)."""
    try:
        setting = PaymentSetting.get()
        return jsonify({"success": True, "data": setting.to_dict()})
    except Exception as e:
        current_app.logger.error(f"payment_settings_get error: {e}")
        return jsonify({"error": "Failed to load settings."}), 500


# ─── Step 1: Verify password ─────────────────────────────────────────────────

@admin_bp.route("/api/payment-verify-password", methods=["POST"])
@login_required
@csrf.exempt                    # JS fetch — CSRF token sent via header
def payment_verify_password():
    """
    Body JSON: { "password": "<raw password>" }
    Returns:   { "success": true } on match, 401 on mismatch.
    """
    data     = request.get_json(silent=True) or {}
    raw_pass = (data.get("password") or "").strip()

    if not raw_pass:
        return jsonify({"error": "Password is required."}), 400

    # current_user is the logged-in admin (Flask-Login)
    if not UserService.verify_password(current_user, raw_pass):
        current_app.logger.warning(
            f"payment: failed password attempt by user {current_user.id}"
        )
        return jsonify({"error": "Incorrect password."}), 401

    # Password OK — mark step-1 done in session (NOT fully authorised yet)
    session["payment_pw_ok"] = True
    return jsonify({"success": True})


# ─── Step 2: Verify TOTP ─────────────────────────────────────────────────────

@admin_bp.route("/api/payment-verify-totp", methods=["POST"])
@login_required
@csrf.exempt
def payment_verify_totp():
    """
    Body JSON: { "code": "123456" }
    Requires step-1 (password) to have been verified first.
    Returns:   { "success": true } on match, 401 on mismatch.
    """
    if not session.get("payment_pw_ok"):
        return jsonify({"error": "Complete password verification first."}), 403

    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip()

    if not code or not re.fullmatch(r"\d{6}", code):
        return jsonify({"error": "Enter a valid 6-digit code."}), 400

    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(code, valid_window=1):
        current_app.logger.warning(
            f"payment: failed TOTP attempt by user {current_user.id}"
        )
        return jsonify({"error": "Invalid code. Please try again."}), 401

    # Both steps passed — grant short-lived payment auth
    session.pop("payment_pw_ok", None)
    session[_AUTH_KEY] = True
    current_app.logger.info(f"payment: auth granted for user {current_user.id}")
    return jsonify({"success": True})


# ─── Save UPI details ────────────────────────────────────────────────────────

@admin_bp.route("/api/payment-save", methods=["POST"])
@login_required
@csrf.exempt
def payment_save():
    """
    Body JSON: { "upi_id": "...", "account_name": "...", "instructions": "..." }
    Requires full 2-step auth.
    """
    err, status = _require_payment_auth()
    if err:
        return err, status

    data = request.get_json(silent=True) or {}

    upi_id       = (data.get("upi_id")       or "").strip()
    account_name = (data.get("account_name") or "").strip()
    instructions = (data.get("instructions") or "").strip()

    # Basic UPI format check
    if upi_id and not re.fullmatch(r"[\w.\-]{2,256}@[a-zA-Z]{2,64}", upi_id):
        return jsonify({"error": "Invalid UPI ID format (e.g. name@upi)."}), 400

    try:
        setting              = PaymentSetting.get()
        setting.upi_id       = upi_id
        setting.account_name = account_name
        setting.instructions = instructions
        db.session.commit()

        _clear_payment_auth()          # force re-verify for next change
        current_app.logger.info(
            f"payment: UPI details updated by user {current_user.id} → {upi_id}"
        )
        return jsonify({"success": True, "data": setting.to_dict()})

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"payment_save error: {e}")
        return jsonify({"error": "Failed to save settings."}), 500


# ─── Upload QR image ─────────────────────────────────────────────────────────

@admin_bp.route("/api/payment-qr-upload", methods=["POST"])
@login_required
@csrf.exempt
def payment_qr_upload():
    """
    Accepts multipart/form-data with field `qr_image` (image file).
    Max 5 MB. Stores as base64 in DB.
    Requires full 2-step auth.
    """
    err, status = _require_payment_auth()
    if err:
        return err, status

    file = request.files.get("qr_image")
    if not file:
        return jsonify({"error": "No image file provided."}), 400

    if not file.content_type.startswith("image/"):
        return jsonify({"error": "File must be an image."}), 400

    raw = file.read()
    if len(raw) > 5 * 1024 * 1024:
        return jsonify({"error": "Image must be under 5 MB."}), 400

    try:
        b64 = base64.b64encode(raw).decode("utf-8")
        mime = file.content_type           # e.g. image/png

        setting = PaymentSetting.get()
        setting.qr_image_base64 = f"data:{mime};base64,{b64}"
        db.session.commit()

        _clear_payment_auth()
        current_app.logger.info(
            f"payment: QR uploaded by user {current_user.id}, size={len(raw)} bytes"
        )
        return jsonify({
            "success":         True,
            "qr_image_base64": setting.qr_image_base64,
        })

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"payment_qr_upload error: {e}")
        return jsonify({"error": "Failed to save QR image."}), 500


# ─── Remove QR image ─────────────────────────────────────────────────────────

@admin_bp.route("/api/payment-qr-remove", methods=["POST"])
@login_required
@csrf.exempt
def payment_qr_remove():
    """
    Clears the stored QR image.
    Requires full 2-step auth.
    """
    err, status = _require_payment_auth()
    if err:
        return err, status

    try:
        setting = PaymentSetting.get()
        setting.qr_image_base64 = None
        db.session.commit()

        _clear_payment_auth()
        current_app.logger.info(
            f"payment: QR removed by user {current_user.id}"
        )
        return jsonify({"success": True})

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"payment_qr_remove error: {e}")
        return jsonify({"error": "Failed to remove QR image."}), 500