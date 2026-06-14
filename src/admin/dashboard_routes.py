from flask import render_template, session, redirect, url_for
from sqlalchemy import func
from datetime import datetime

from src.auth.decorators import no_cache
from src.models.menu import MenuItem
from src.models.admin import User
from src.models.order import Order
from src.extensions import db
from src.wtforms import CSRForm, MenuItemForm, MenuEditForm

from . import admin_bp


@admin_bp.route("/")
def admin_dashboard():

    form = MenuItemForm()
    edit_form = MenuEditForm()

    print("ADMIN SESSION:")
    print(dict(session))

    user_id = session.get("user_id")

    if not user_id:
        return redirect(url_for("login.login"))

    user = User.query.get(user_id)

    if user is None:
        session.clear()
        return redirect(url_for("login.login"))

    return render_template(
        "admin.html",
        user=user,
        revenue_today=1000,
        form=form,
        edit_form = edit_form
    )
