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


from flask_login import current_user, login_required

@admin_bp.route("/")
@login_required
def admin_dashboard():

    form = MenuItemForm()
    edit_form = MenuEditForm()

    print("ADMIN USER:", current_user)

    user = current_user

    return render_template(
        "admin.html",
        user=user,
        revenue_today=1000,
        form=form,
        edit_form=edit_form
    )