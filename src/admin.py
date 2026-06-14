from flask import Flask, Blueprint, render_template, request, session, redirect, url_for, jsonify, flash
from src.auth.decorators import no_cache
from src.services.menu_service import create_menu_items, delete_menu_item, update_menu_item
from src.models.menu import MenuItem
from src.extensions import db
from src.models.qr_code import QRCode
from src.wtforms import CSRForm, MenuItemForm, MenuEditForm
from src.models.admin import User
from src.services.qr_token import generate_token  # ✅ new import
import qrcode
from io import BytesIO
import base64
import os
from src.services.ip_services import get_local_ip
from flask import current_app


admin_route = Blueprint('admin', __name__)


@admin_route.route('/', methods=['GET', 'POST'])
@no_cache
def adminhome():
    if 'user_id' not in session:
        return redirect(url_for('login.login'))

    user_id = session.get('user_id')
    user = User.query.filter_by(id=user_id).first()

    if not user:
        return redirect(url_for('login.login'))

    menu_items = MenuItem.query.filter_by(is_active=True).all()
    form = MenuItemForm()
    edit_form = MenuEditForm()
    csrf_form = CSRForm()

    return render_template('admin.html',
                           user=user,
                           menu_items=menu_items,
                           form=form,
                           edit_form=edit_form,
                           csrf_form=csrf_form)


@admin_route.route("/generate-table-qr/<int:table_number>", methods=["GET"])
def generate_table_qr(table_number):
    """Used by admin panel to generate a token-protected QR for a table."""
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    external_host = current_app.config.get('EXTERNAL_HOST') or os.getenv('QR_HOST') or get_local_ip()
    port = current_app.config.get('PORT') or os.getenv('PORT') or '5000'

    token = generate_token(table_number)  # ✅
    qr_url = f"http://{external_host}:{port}/customer/table/{table_number}?token={token}"

    qr_img = qrcode.QRCode(version=1, box_size=10, border=4)
    qr_img.add_data(qr_url)
    qr_img.make(fit=True)
    img = qr_img.make_image(fill="black", back_color="white")

    buffered = BytesIO()
    img.save(buffered, format="PNG")
    qr_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

    # Save to DB
    try:
        new_qr = QRCode(table_no=table_number, qr_url=qr_url, qr_image_base64=qr_base64)
        db.session.add(new_qr)
        db.session.commit()
    except Exception as e:
        current_app.logger.error(f"Failed to store QR: {e}")

    return jsonify({
        "table_number": table_number,
        "qr_image_base64": qr_base64
    })


@admin_route.route('/menu/add', methods=['GET', 'POST'])
def add_item():
    form = MenuItemForm()
    if form.validate_on_submit():
        item = create_menu_items({
            "item_name": form.item_name.data,
            "category": form.category.data,
            "item_price": form.item_price.data,
            "description": form.description.data
        })
        if item:
            flash("Item added successfully!", "success")
        else:
            flash("Database Error Please Try Later", "danger")
    else:
        print(form.errors)
    return redirect(url_for('admin.adminhome') + '#menu')


@admin_route.route('/menu/delete/<int:item_id>', methods=['POST'])
def delete_item(item_id):
    success, message = delete_menu_item(item_id)
    flash(message, "success" if success else "danger")
    return redirect(url_for('admin.adminhome') + '#menu')


@admin_route.route('/menu/edit/<int:item_id>', methods=['POST'])
def edit_item(item_id):
    form = MenuEditForm()
    if not form.validate_on_submit():
        flash("Invalid form data", "danger")
        return redirect(url_for('admin.adminhome') + '#menu')

    success, message = update_menu_item(item_id, {
        "item_name": form.item_name.data,
        "category": form.category.data,
        "item_price": form.item_price.data,
        "description": form.description.data
    })

    flash(message, "success" if success else "danger")
    return redirect(url_for('admin.adminhome') + '#menu')