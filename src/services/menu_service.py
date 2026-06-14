"""
Menu Service - Business logic for menu management
Works with existing MenuItem model (no image_url, no stock fields)
"""
import logging

from src.extensions import db
from src.models.menu import MenuItem
from datetime import datetime

logger = logging.getLogger(__name__)


def create_menu_items(data):
    """
    Create a new menu item
    
    Args:
        data (dict): Menu item data with keys:
            - item_name: str
            - category: str
            - item_price: float
            - description: str (optional)
    
    Returns:
        MenuItem or None: Created menu item or None if error
    """
    try:
        item = MenuItem(
            item_name=data.get("item_name"),
            category=data.get("category", "General"),
            item_price=float(data.get("item_price", 0)),
            description=data.get("description", ""),
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.session.add(item)
        db.session.commit()
        logger.info("Created menu item: %s (ID: %s)", item.item_name, item.id)
        return item
    except Exception as e:
        logger.exception("Error creating menu item: %s", e)
        db.session.rollback()
        return None


def delete_menu_item(item_id):
    """
    Soft delete a menu item (sets is_active to False)
    
    Args:
        item_id (int): ID of menu item to delete
    
    Returns:
        tuple: (success: bool, message: str)
    """
    try:
        item = MenuItem.query.get(item_id)
        if not item:
            return False, "Item not found"

        # Soft delete
        item.is_active = False
        item.updated_at = datetime.utcnow()
        db.session.commit()

        logger.info("Soft deleted item: %s (ID: %s)", item.item_name, item_id)
        return True, "Item deleted successfully"

    except Exception as e:
        logger.exception("Error deleting menu item: %s", e)
        db.session.rollback()
        return False, str(e)


def update_menu_item(item_id, data):
    """
    Update an existing menu item
    
    Args:
        item_id (int): ID of menu item to update
        data (dict): Updated menu item data
    
    Returns:
        tuple: (success: bool, message: str)
    """
    try:
        item = MenuItem.query.get(item_id)
        if not item:
            return False, "Item not found"

        # Update fields
        item.item_name = data.get("item_name", item.item_name)
        item.category = data.get("category", item.category)
        item.item_price = float(data.get("item_price", item.item_price))
        item.description = data.get("description", item.description)
        item.updated_at = datetime.utcnow()

        db.session.commit()
        logger.info("Updated menu item: %s (ID: %s)", item.item_name, item_id)
        return True, "Item updated successfully"

    except Exception as e:
        logger.exception("Error updating menu item: %s", e)
        db.session.rollback()
        return False, str(e)


def get_menu_items():
    """
    Get all menu items (including inactive ones) as dictionaries
    
    Returns:
        list: List of menu item dictionaries
    """
    try:
        items = MenuItem.query.all()
        return [item.to_dict() for item in items]
    except Exception as e:
        logger.exception("Error getting menu items: %s", e)
        return []


def get_active_menu_items():
    """
    Get only active menu items (is_active=True) as model objects
    
    Returns:
        list: List of MenuItem model objects
    """
    try:
        items = MenuItem.query.filter_by(is_active=True).all()
        logger.debug("Retrieved %d active menu items", len(items))
        return items
    except Exception as e:
        logger.exception("Error getting active menu items: %s", e)
        return []


def get_menu_item_by_id(item_id):
    """
    Get a specific menu item by ID
    
    Args:
        item_id (int): Menu item ID
    
    Returns:
        MenuItem or None: Menu item object or None if not found
    """
    try:
        item = MenuItem.query.get(item_id)
        return item
    except Exception as e:
        logger.exception("Error getting menu item %s: %s", item_id, e)
        return None


def search_menu_items(query, category=None):
    """
    Search menu items by name or description
    
    Args:
        query (str): Search query
        category (str, optional): Filter by category
    
    Returns:
        list: List of matching MenuItem objects
    """
    try:
        search_filter = db.or_(
            MenuItem.item_name.ilike(f'%{query}%'),
            MenuItem.description.ilike(f'%{query}%')
        )
        
        if category:
            items = MenuItem.query.filter(
                search_filter,
                MenuItem.category == category,
                MenuItem.is_active == True
            ).all()
        else:
            items = MenuItem.query.filter(
                search_filter,
                MenuItem.is_active == True
            ).all()
        
        logger.debug("Found %d items matching '%s'", len(items), query)
        return items
    except Exception as e:
        logger.exception("Error searching menu items: %s", e)
        return []


def get_menu_by_category(category):
    """
    Get all active menu items in a specific category
    
    Args:
        category (str): Category name
    
    Returns:
        list: List of MenuItem objects in that category
    """
    try:
        items = MenuItem.query.filter_by(
            category=category,
            is_active=True
        ).all()
        logger.debug("Retrieved %d items in category '%s'", len(items), category)
        return items
    except Exception as e:
        logger.exception("Error getting menu by category: %s", e)
        return []


def get_all_categories():
    """
    Get list of all unique categories from active items
    
    Returns:
        list: List of category names
    """
    try:
        categories = db.session.query(MenuItem.category).filter(
            MenuItem.is_active == True
        ).distinct().all()
        category_list = [cat[0] for cat in categories if cat[0]]
        logger.debug("Found %d categories", len(category_list))
        return category_list
    except Exception as e:
        logger.exception("Error getting categories: %s", e)
        return []


def toggle_item_status(item_id):
    """
    Toggle the is_active status of a menu item
    
    Args:
        item_id (int): Menu item ID
    
    Returns:
        tuple: (success: bool, message: str, new_status: bool)
    """
    try:
        item = MenuItem.query.get(item_id)
        if not item:
            return False, "Item not found", False

        item.is_active = not item.is_active
        item.updated_at = datetime.utcnow()
        db.session.commit()
        
        status_text = "activated" if item.is_active else "deactivated"
        logger.info("%s item: %s", status_text.title(), item.item_name)
        return True, f"Item {status_text} successfully", item.is_active

    except Exception as e:
        logger.exception("Error toggling item status: %s", e)
        db.session.rollback()
        return False, str(e), False


def get_menu_stats():
    """
    Get statistics about menu items
    
    Returns:
        dict: Statistics including total items, active items, categories
    """
    try:
        total_items = MenuItem.query.count()
        active_items = MenuItem.query.filter_by(is_active=True).count()
        inactive_items = total_items - active_items
        categories = get_all_categories()
        
        return {
            'total_items': total_items,
            'active_items': active_items,
            'inactive_items': inactive_items,
            'total_categories': len(categories),
            'categories': categories
        }
    except Exception as e:
        logger.exception("Error getting menu stats: %s", e)
        return {
            'total_items': 0,
            'active_items': 0,
            'inactive_items': 0,
            'total_categories': 0,
            'categories': []
        }