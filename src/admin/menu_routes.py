from flask import redirect, url_for, flash
from src.services.menu_service import (
    create_menu_items,
    delete_menu_item,
    update_menu_item,
)
from src.wtforms import MenuItemForm, MenuEditForm

from . import admin_bp


@admin_bp.route("/menu/add", methods=["POST"])
def add_menu_item():
    form = MenuItemForm()

    if form.validate_on_submit():
        create_menu_items({
            "item_name": form.item_name.data,
            "category": form.category.data,
            "item_price": form.item_price.data,
            "description": form.description.data
        })
        flash("Item added successfully!", "success")
    else:
        flash("Invalid form data", "danger")

    return redirect(url_for("admin.admin_dashboard") + "#menu")


@admin_bp.route("/menu/delete/<int:item_id>", methods=["POST"])
def delete_menu(item_id):
    success, msg = delete_menu_item(item_id)
    flash(msg, "success" if success else "danger")
    return redirect(url_for("admin.admin_dashboard") + "#menu")


@admin_bp.route("/menu/edit/<int:item_id>", methods=["POST"])
def edit_menu(item_id):
    form = MenuEditForm()

    if not form.validate_on_submit():
        flash("Invalid data", "danger")
        return redirect(url_for("admin.admin_dashboard") + "#menu")

    success, msg = update_menu_item(item_id, {
        "item_name": form.item_name.data,
        "category": form.category.data,
        "item_price": form.item_price.data,
        "description": form.description.data
    })

    flash(msg, "success" if success else "danger")
    return redirect(url_for("admin.admin_dashboard") + "#menu")

from flask import render_template, session, redirect, url_for
from src.models.menu import MenuItem
from . import admin_bp  # the blueprint

@admin_bp.route('/menu', methods=['GET','POST'])
def menu():
    if 'user_id' not in session:
        return redirect(url_for('login.login'))

    # fetch all menu items (active or inactive)
    menu_items = MenuItem.query.all()
    return render_template('menu.html', menu_items=menu_items)
