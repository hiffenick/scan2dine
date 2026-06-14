"""
Logout module
Handles user logout and session clearing
"""
from flask import Blueprint, redirect, url_for, session, flash
from src.auth.session_manager import SessionManager
from src.auth.decorators import no_cache

logout_route = Blueprint('logout', __name__)


@logout_route.route('/logout', methods=['GET', 'POST'])
@no_cache
def logout():
    """
    Logout route - clears user session and redirects to login
    Supports both GET and POST requests
    
    Flow:
    1. Get current user ID (if logged in)
    2. Clear all session data
    3. Flash success message
    4. Redirect to login page
    """
    # Get user info before clearing (optional, for logging)
    user_id = session.get('user_id')
    pre_2fa_user = session.get('pre2fa_userid')
    
    # Clear all session data
    SessionManager.clear_session(session)
    
    # Flash success message
    flash('You have been logged out successfully', 'info')
    
    # Redirect to login page
    return redirect(url_for('login.login'))
