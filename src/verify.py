from flask import Blueprint, render_template, redirect, url_for, session, request, flash
from src.auth import SessionManager, UserService
from src.auth.decorators import no_cache
from src.auth.qr import get_qr_code_image
import pyotp

verifyroute = Blueprint('verify', __name__)

@verifyroute.route('/setup/verify', methods=['POST'])
@no_cache
def verify_2fa():
    user_id = SessionManager.get_pre_2fa_user_id(session)
    if not user_id:
        return redirect(url_for('login.login'))

    user = UserService.get_user_by_id(user_id)
    if not user:
        SessionManager.clear_session(session)
        return redirect(url_for('login.login'))

    verify_code = request.form.get('verify_code', '').strip()

    if not verify_code or len(verify_code) != 6:
        return render_template(
            'setup.html',
            qr_code_url=get_qr_code_image(user),
            secret_key=user.totp_secret,
            error='Please enter a valid 6-digit code'
        )

    totp = pyotp.TOTP(user.totp_secret)

    if totp.verify(verify_code, valid_window=1):
        UserService.update_user_2fa(user.id, True)

        session.pop(SessionManager.PRE_2FA_KEY, None)
        SessionManager.create_user_session(session, user)

        flash('Two-Factor Authentication enabled successfully!', 'success')
        return redirect(url_for('admin.adminhome'))

    return render_template(
        'setup.html',
        qr_code_url=get_qr_code_image(user),
        secret_key=user.totp_secret,
        error='Invalid verification code. Please rescan the QR code and try again.'
    )
