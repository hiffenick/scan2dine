from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify
from src.models.menu import MenuItem
from src.extensions import db
from flask_login import current_user

menuroute = Blueprint('menu', __name__)

def login_required_session():
    return not current_user.is_authenticated

# ── Page ──────────────────────────────────────────────────
from src.models.category import Category

@menuroute.route('/menu', methods=['GET'])
def menu():
    if login_required_session():
        return redirect(url_for('login.login'))

    menu_items = MenuItem.query.all()
    categories = Category.query.order_by(Category.name).all()

    return render_template(
        'admin/menu.html',
        menu_items=menu_items,
        categories=categories,
        user=current_user
    )


# ── Get single item (for edit modal) ──────────────────────
@menuroute.route('/admin/menu/item/<int:id>', methods=['GET'])
def get_item(id):
    if login_required_session():
        return jsonify({'success': False}), 401
    item = MenuItem.query.get_or_404(id)
    return jsonify({'success': True, 'item': item.to_dict()})

# ── Create ────────────────────────────────────────────────
@menuroute.route('/admin/menu/item', methods=['POST'])
def create_item():
    if login_required_session():
        return jsonify({'success': False}), 401
    data = request.get_json()
    if not data.get('item_name') or data.get('price') is None:
        return jsonify({'success': False, 'error': 'Name and price required'}), 400
    if MenuItem.query.filter_by(item_name=data['item_name']).first():
        return jsonify({'success': False, 'error': 'Dish name already exists'}), 400
    item = MenuItem(
        item_name   = data['item_name'].strip(),
        item_price  = float(data['price']),
        category_id = data.get('category_id'),
        description = data.get('description', '').strip() or None,
        image_url   = data.get('image_url', '').strip() or None,
        is_active   = data.get('is_available', True),
        is_veg      = True if data.get('is_veg') == 'true' else (False if data.get('is_veg') == 'false' else None),
    )
    db.session.add(item)
    db.session.commit()
    return jsonify({'success': True, 'item': item.to_dict()})

# ── Update ────────────────────────────────────────────────
@menuroute.route('/admin/menu/item/<int:id>', methods=['PUT'])
def update_item(id):
    if login_required_session():
        return jsonify({'success': False}), 401
    item = MenuItem.query.get_or_404(id)
    data = request.get_json()
    if 'item_name' in data:
        existing = MenuItem.query.filter_by(item_name=data['item_name']).first()
        if existing and existing.id != id:
            return jsonify({'success': False, 'error': 'Dish name already exists'}), 400
        item.item_name = data['item_name'].strip()
    if 'price' in data:        item.item_price  = float(data['price'])
    if 'category_id' in data:  item.category_id   = data['category_id']
    if 'description' in data:  item.description = data['description'].strip() or None
    if 'image_url' in data:    item.image_url   = data['image_url'].strip() or None
    if 'is_available' in data: item.is_active   = data['is_available']
    if 'is_veg' in data:
        item.is_veg = True if data['is_veg'] == 'true' else (False if data['is_veg'] == 'false' else None)
    db.session.commit()
    return jsonify({'success': True, 'item': item.to_dict()})

# ── Delete ────────────────────────────────────────────────
from src.models.category import Category

@menuroute.route('/admin/menu/category/<int:cat_id>', methods=['DELETE'])
def delete_category(cat_id):

    count = MenuItem.query.filter_by(category_id=cat_id).count()

    if count:
        return jsonify({
            'success': False,
            'error': f'Cannot delete — {count} dish(es) use this category'
        }), 400

    category = Category.query.get_or_404(cat_id)

    db.session.delete(category)
    db.session.commit()

    return jsonify({'success': True})


# ── Toggle availability ───────────────────────────────────
@menuroute.route('/admin/menu/item/<int:id>/toggle', methods=['POST'])
def toggle_item(id):
    if login_required_session():
        return jsonify({'success': False}), 401
    item = MenuItem.query.get_or_404(id)
    item.is_active = not item.is_active
    db.session.commit()
    return jsonify({'success': True, 'is_available': item.is_active})

# ── Categories (derived from existing string values) ──────
@menuroute.route('/admin/menu/category', methods=['POST'])
def create_category():
    data = request.get_json()
    name = (data.get('name') or '').strip()

    if not name:
        return jsonify({
            'success': False,
            'error': 'Name required'
        }), 400

    existing = Category.query.filter_by(name=name).first()

    if existing:
        return jsonify({
            'success': False,
            'error': 'Category already exists'
        }), 400

    category = Category(name=name)

    db.session.add(category)
    db.session.commit()

    return jsonify({
        'success': True,
        'category': {
            'id': category.id,
            'name': category.name
        }
    })

@menuroute.route('/admin/menu/item/<int:id>', methods=['DELETE'])
def delete_item(id):
    if login_required_session():
        return jsonify({'success': False}), 401

    item = MenuItem.query.get_or_404(id)

    db.session.delete(item)
    db.session.commit()

    return jsonify({
        'success': True
    })