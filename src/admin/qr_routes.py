from flask import render_template, jsonify, session, redirect, url_for, current_app
from flask_login import login_required
from src.auth.decorators import no_cache
import qrcode
from io import BytesIO
import base64
from src.extensions import csrf, db
import os
from src.services.ip_services import get_local_ip
from src.models.qr_code import QRCode
from src.services.qr_token import generate_token

from . import admin_bp


@admin_bp.route("/generate-table-qr/<int:table_number>")
@login_required
def generate_qr(table_number):
    port = current_app.config.get('PORT') or os.getenv('PORT', '5000')
    token = generate_token(table_number)
    static_qr_url = f"http://127.0.0.1:{port}/customer/table/{table_number}?token={token}"
    current_app.logger.info(f"Generating QR for table {table_number} -> {static_qr_url}")

    qr = qrcode.make(static_qr_url)
    buffer = BytesIO()
    qr.save(buffer, format="PNG")
    img_str = base64.b64encode(buffer.getvalue()).decode()

    try:
        qr_code = QRCode(
            table_no=table_number,
            qr_url=static_qr_url,
            qr_image_base64=img_str
        )
        db.session.add(qr_code)
        db.session.commit()
        current_app.logger.info(f"Stored QR code {qr_code.id} for table {table_number}")
    except Exception as e:
        current_app.logger.error(f"Failed to store QR code: {e}")

    return render_template(
        "admin/table-qr.html",
        table_number=table_number,
        qr_code=f"data:image/png;base64,{img_str}",
        qr_url=static_qr_url
    )


@admin_bp.route("/api/generate-table-qr/<int:table_number>")
@login_required
def generate_qr_api(table_number):
    port = current_app.config.get('PORT') or os.getenv('PORT', '5000')
    token = generate_token(table_number)
    static_qr_url = f"http://127.0.0.1:{port}/customer/table/{table_number}?token={token}"
    current_app.logger.info(f"Generating QR (API) for table {table_number} -> {static_qr_url}")

    qr = qrcode.make(static_qr_url)
    buffer = BytesIO()
    qr.save(buffer, format="PNG")
    img_str = base64.b64encode(buffer.getvalue()).decode()

    try:
        qr_code = QRCode(
            table_no=table_number,
            qr_url=static_qr_url,
            qr_image_base64=img_str
        )
        db.session.add(qr_code)
        db.session.commit()
        current_app.logger.info(f"Stored QR code {qr_code.id} for table {table_number}")
    except Exception as e:
        current_app.logger.error(f"Failed to store QR code: {e}")
        return jsonify({"error": "Failed to store QR code"}), 500

    return jsonify({
        "qr_id": qr_code.id,
        "qr_code": f"data:image/png;base64,{img_str}",
        "table_number": table_number,
        "url": static_qr_url
    })


@admin_bp.route("/api/list-qr/<int:table_number>")
@login_required
def list_qr_for_table(table_number):
    try:
        qr_codes = QRCode.get_active_for_table(table_number)
        return jsonify({
            "success": True,
            "qr_codes": [
                {
                    "id": qr.id,
                    "table_no": qr.table_no,
                    "qr_url": qr.qr_url,
                    "created_at": qr.created_at.isoformat(),
                    "qr_image_base64": qr.qr_image_base64
                }
                for qr in qr_codes
            ]
        })
    except Exception as e:
        current_app.logger.error(f"Failed to list QR codes: {e}")
        return jsonify({"error": "Failed to list QR codes"}), 500


@admin_bp.route("/api/all-table-qrs", methods=["GET"])
@login_required
def all_table_qrs():
    try:
        all_qrs = QRCode.query.order_by(QRCode.table_no).all()
        return jsonify([
            {
                "table_number": qr.table_no,
                "qr_image_base64": qr.qr_image_base64,
                "qr_id": qr.id,
                "is_active": qr.is_active
            }
            for qr in all_qrs
        ])
    except Exception as e:
        current_app.logger.error(f"Failed to fetch all QRs: {e}")
        return jsonify({"error": "Failed to fetch QR codes"}), 500


@admin_bp.route("/tables")
@login_required
@no_cache
def tables_page():
    return render_template("admin/tables.html", active_page="tables")


@admin_bp.route("/api/delete-qr/<int:qr_id>", methods=["DELETE"])
@login_required
@csrf.exempt
def delete_qr(qr_id):
    qr_code = db.session.get(QRCode, qr_id)
    if not qr_code:
        return jsonify({"error": "QR code not found"}), 404

    try:
        table_number = qr_code.table_no
        qr_url = qr_code.qr_url or ""

        from src.services.qr_token import _redis
        try:
            if "token=" in qr_url:
                token = qr_url.split("token=")[-1].strip()
                _redis().delete(f"qr_token:{token}")
                current_app.logger.info(f"Deleted Redis token for table {table_number}")
        except Exception as e:
            current_app.logger.warning(f"Could not delete Redis token: {e}")

        try:
            _redis().delete(f"table_lock:{table_number}")
            current_app.logger.info(f"Cleared table lock for table {table_number}")
        except Exception as e:
            current_app.logger.warning(f"Could not clear table lock: {e}")

        db.session.delete(qr_code)
        db.session.commit()
        current_app.logger.info(f"Deleted QR {qr_id} for table {table_number}")

        return jsonify({"success": True})

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Failed to delete QR: {e}")
        return jsonify({"error": "Failed to delete QR"}), 500