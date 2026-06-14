from flask import Blueprint, render_template,session,redirect,url_for
from src.models.menu import MenuItem

menuroute = Blueprint('menu', __name__)

@menuroute.route('/menu', methods=['GET'])
def menu():
    """
    Menu page - displays all dishes with add to cart option
    """
    # Check if user is logged in
    if 'user_id' not in session:
        return redirect(url_for('login.login'))

    # Fetch all menu items (no filter)
    menu_items = MenuItem.query.all()

    # Pass items to template
    return render_template('menu.html', menu_items=menu_items)

