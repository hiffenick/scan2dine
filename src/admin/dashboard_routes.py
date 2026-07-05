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

@admin_bp.route('/')
@login_required
def admin_dashboard():
    # ── User & Forms ──
    user = current_user
    form = MenuItemForm()
    edit_form = MenuEditForm()
    csrf_form = CSRForm() # Required by your template

    # ── Menu Items ──
    menu_items = MenuItem.query.filter_by(is_active=True).all()

    # ── Recent orders (top 8) for the table ──
    recent_orders = (
        Order.query
        .order_by(Order.created_at.desc())
        .limit(8)
        .all()
    )

    # ── Dashboard stats for the top cards ──
    total_orders = Order.query.count()

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Calculate real revenue instead of hardcoding 1000
    revenue_today = (
        db.session.query(func.coalesce(func.sum(Order.total_amount), 0))
        .filter(Order.created_at >= today_start, Order.payment_status == 'paid')
        .scalar()
    )

    total_customers = (
        db.session.query(func.count(func.distinct(Order.customer_session_id)))
        .scalar()
    )

    pending_count = Order.query.filter(
        Order.status.in_(['Pending', 'Preparing'])
    ).count()

    # Pass everything to the template so your Jinja tags have data
    return render_template(
        'admin.html',
        user=user,
        menu_items=menu_items,
        form=form,
        edit_form=edit_form,
        csrf_form=csrf_form,
        recent_orders=recent_orders,
        total_orders=total_orders,
        revenue_today=float(revenue_today or 0),
        total_customers=total_customers,
        pending_count=pending_count
    )
