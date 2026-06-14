import pyotp
import qrcode
import io
from base64 import b64encode

def get_qr_code_image(user):
    totp = pyotp.TOTP(user.totp_secret)

    provisioning_uri = totp.provisioning_uri(
        name=user.email,
        issuer_name='Cozy Cafe'
    )

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(provisioning_uri)
    qr.make(fit=True)

    img = qr.make_image(fill_color='black', back_color='white')

    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)

    return f"data:image/png;base64,{b64encode(buffer.getvalue()).decode()}"