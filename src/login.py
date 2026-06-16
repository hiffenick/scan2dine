"""
User authentication/login module
Handles user login and 2FA verification
"""
from flask import Blueprint, redirect, url_for, render_template, request, session, flash
from flask_login import login_user
from src.models.admin import User
from src.wtforms import VerifyForm
from src.wtforms import LoginForm
from src.auth import UserService, SessionManager
from src.auth.decorators import no_cache
import pyotp

login_route = Blueprint('login', __name__)


@login_route.route('/login', methods=['GET', 'POST'])
def login():

    form = LoginForm()

    if form.validate_on_submit():

        user = User.query.filter_by(
            name=form.username.data.strip()
        ).first()

        if not user:
            flash("Invalid username or password")
            return render_template("index.html", form=form)

        if not UserService.verify_password(user, form.password.data):
            flash("Invalid username or password")
            return render_template("index.html", form=form)

        # Store temporary user for 2FA
        session["pending_user_id"] = user.id

        return redirect(url_for("login.verify_2fa"))

    return render_template("index.html", form=form)


# def handle_login_submission(form):
#     """
#     Handle login form submission
#     Validate credentials and setup session
#     """
#     username = form.username.data.strip()
#     password = form.password.data

#     # Get user from database
#     user = UserService.get_user_by_username(username)

#     if not user:
#         flash('Invalid username or password', 'error')
#         return render_template('index.html', form=form)

#     # Verify password
#     if not UserService.verify_password(user, password):
#         flash('Invalid username or password', 'error')
#         return render_template('index.html', form=form)

#     # Credentials are correct - setup pre-2FA session
#     SessionManager.create_pre_2fa_session(session, user.id)

#     # Check if 2FA is enabled
#     if not user.totp_enable:
#         # 2FA not set up - redirect to setup page
#         return redirect(url_for('setup.setup'))
#     else:
#         # 2FA is enabled - redirect to 2FA verification page
#         return redirect(url_for('login.verify_2fa'))


@login_route.route('/verify-2fa', methods=['GET', 'POST'])
def verify_2fa():

    form = VerifyForm()

    user = User.query.get(session.get("pending_user_id"))
    if not user:
        return redirect(url_for("login.login"))

    if form.validate_on_submit():

        code = form.verify_code.data
        totp = pyotp.TOTP(user.totp_secret)

        if totp.verify(code):
            login_user(user)
            session.pop("pending_user_id", None)

            print("VERIFY SESSION:")
            print(dict(session))

            return redirect(url_for("admin.admin_dashboard"))

        flash("Invalid Code")

    return render_template("verify_2fa.html", form=form)

def handle_2fa_verification(user, form):
    """
    Handle 2FA verification code submission
    """
    verify_code = form.verify_code.data.strip()

    if not verify_code or len(verify_code) != 6:
        flash('Please enter a valid 6-digit code', 'error')
        return render_template('verify_2fa.html', form=form)
    

    # Verify the TOTP code
    totp = pyotp.TOTP(user.totp_secret)

    if totp.verify(verify_code, valid_window=1):

        # SessionManager.create_user_session(session, user)

        print("LOGIN SUCCESS")
        print(dict(session))

        return redirect(url_for("admin.admin_dashboard"))

    # Allow for time drift (±30 seconds)
    if totp.verify(verify_code, valid_window=1):
        # Code is valid - complete login
        # SessionManager.create_user_session(session, user)
        flash('Successfully logged in!', 'success')
        return redirect(url_for('admin.admin_dashboard'))
    else:
        # Code is invalid
        flash('Invalid verification code. Please try again.', 'error')
        return render_template('verify_2fa.html', form=form)
