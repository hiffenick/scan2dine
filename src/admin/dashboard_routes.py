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


@admin_bp.route("/", methods=["GET"])
@no_cache
def admin_dashboard():
    # ── AUTH CHECK ──────────────────────────────────────────────
    if "user_id" not in session:
        return redirect(url_for("login.login"))

    user = User.query.get(session["user_id"])
    if not user:
        return redirect(url_for("login.login"))

    # ── DATE BOUNDARY (TODAY) ───────────────────────────────────
    today_start = datetime.now().replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    # ── DASHBOARD STATS ─────────────────────────────────────────
    total_orders = (
        db.session.query(func.count(Order.id))
        .filter(Order.created_at >= today_start)
        .scalar()
        or 0
    )

    revenue_today = (
        db.session.query(func.coalesce(func.sum(Order.total_amount), 0))
        .filter(
            Order.created_at >= today_start,
            Order.status == "completed"
        )
        .scalar()
        or 0
    )

    total_customers = (
        db.session.query(func.count(func.distinct(Order.customer_name)))
        .filter(Order.created_at >= today_start)
        .scalar()
        or 0
    )

    recent_orders = (
        Order.query.order_by(Order.created_at.desc())
        .limit(4)
        .all()
    )

    # ── MENU DATA ───────────────────────────────────────────────
    menu_items = (
        MenuItem.query
        .filter_by(is_active=True)
        .order_by(MenuItem.created_at.desc())
        .all()
    )

    # ── FORMS ───────────────────────────────────────────────────
    csrf_form = CSRForm()

    # ── RENDER ──────────────────────────────────────────────────
    return render_template(
        "admin.html",
        user=user,
        menu_items=menu_items,
        total_orders=total_orders,
        revenue_today=revenue_today,
        total_customers=total_customers,
        recent_orders=recent_orders,
        form=MenuItemForm(),
        edit_form=MenuEditForm(),
        csrf_form=csrf_form,
    )
