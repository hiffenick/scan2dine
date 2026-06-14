"""
User signup/registration module
Handles user registration with modular routes
"""
from src.wtforms import Signup
from src.models.admin import User
from src.extensions import db, bcrypt
from src.auth import UserService, UserValidator, SessionManager
from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify

signup_route = Blueprint('signup', __name__)


@signup_route.route('/signup', methods=['GET', 'POST'])
def signup():
    """
    Main signup page route
    Displays signup form and handles form submission
    """
    form = Signup()

    if request.method == 'POST' and form.validate_on_submit():
        return handle_signup_submission(form)

    return render_template('signup.html', form=form)


def handle_signup_submission(form):
    """
    Handle signup form submission
    Process user registration
    """
    username = form.username.data.strip()
    email = form.email.data.strip().lower()
    password = form.password.data

    # Use UserService to create user
    success, result = UserService.create_user(username, email, password)

    if success:
        flash('Account created successfully! Please login.', 'success')
        return redirect(url_for('login.login'))
    else:
        # result contains error message
        flash(result, 'error')
        return render_template('signup.html', form=form)


@signup_route.route('/api/check-email', methods=['POST'])
def check_email_availability():
    """
    API endpoint to check if email is available (for real-time validation)
    """
    data = request.get_json()
    email = data.get('email', '').strip().lower()

    if not email:
        return jsonify({'available': False, 'message': 'Email is required'})

    if UserValidator.email_exists(email):
        return jsonify({'available': False, 'message': 'Email already registered'})

    if not UserValidator.validate_email_format(email):
        return jsonify({'available': False, 'message': 'Invalid email format'})

    return jsonify({'available': True, 'message': 'Email available'})


@signup_route.route('/api/check-username', methods=['POST'])
def check_username_availability():
    """
    API endpoint to check if username is available (for real-time validation)
    """
    data = request.get_json()
    username = data.get('username', '').strip()

    if not username:
        return jsonify({'available': False, 'message': 'Username is required'})

    if len(username) < 3:
        return jsonify({'available': False, 'message': 'Username must be at least 3 characters'})

    if len(username) > 50:
        return jsonify({'available': False, 'message': 'Username must be less than 50 characters'})

    if UserValidator.username_exists(username):
        return jsonify({'available': False, 'message': 'Username already taken'})

    return jsonify({'available': True, 'message': 'Username available'})


@signup_route.route('/api/validate-password', methods=['POST'])
def validate_password():
    """
    API endpoint to validate password strength
    """
    import re
    data = request.get_json()
    password = data.get('password', '')

    errors = []

    if len(password) < 8:
        errors.append('Password must be at least 8 characters')

    if not re.search(r'[A-Z]', password):
        errors.append('Password must contain at least one uppercase letter')

    if not re.search(r'\d', password):
        errors.append('Password must contain at least one number')

    if not re.search(r'[!@#$%^&*()_+?<>]', password):
        errors.append('Password must contain at least one special character')

    if re.search(r'\s', password):
        errors.append('Password must not contain spaces')

    if errors:
        return jsonify({'valid': False, 'errors': errors})

    return jsonify({'valid': True, 'message': 'Password is strong'})
