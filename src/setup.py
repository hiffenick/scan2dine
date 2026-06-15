from flask import Blueprint, redirect, render_template, url_for, session, request
from src.auth.qr import get_qr_code_image
from src.auth.decorators import no_cache
from src.auth.session_manager import SessionManager
from src.wtforms import VerifyForm
from src.auth.user_service import UserService
from src.extensions import db
import pyotp


setuproute = Blueprint('setup', __name__)

@setuproute.route('/setup', methods=['GET','POST'])
@no_cache
def setup():
    user_id = SessionManager.get_pre_2fa_user_id(session)
    if not user_id:
        return redirect(url_for('login.login'))

    user = UserService.get_user_by_id(user_id)
    if not user:
        SessionManager.clear_session(session)
        return redirect(url_for('login.login'))

    # Ensure TOTP secret exists
    if not user.totp_secret:
        user.totp_secret = pyotp.random_base32()
        db.session.commit()

    form = VerifyForm()

    if form.validate_on_submit():
        code = form.verify_code.data.strip()
        totp = pyotp.TOTP(user.totp_secret)
        if totp.verify(code, valid_window=1):
            # Enable 2FA
            user.totp_enable = True
            db.session.commit()
            # Create proper session
            # SessionManager.create_user_session(session, user)
            session.permanent = False
            return redirect(url_for('admin.admin_dashboard'))
        else:
            error = "Invalid verification code. Please try again."
            return render_template(
                'setup.html',
                form=form,
                qr_code_url=get_qr_code_image(user),
                secret_key=user.totp_secret,
                error=error
            )

    return render_template(
        'setup.html',
        form=form,
        qr_code_url=get_qr_code_image(user),
        secret_key=user.totp_secret,
        error=None
    )
