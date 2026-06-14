from flask import request, redirect, url_for, render_template, flash
from flask import current_app
from . import admin_bp
from src.models.setting import Setting
from src.extensions import csrf


@admin_bp.route('/settings', methods=['GET'])
def show_settings():
    upi_vpa = Setting.get('UPI_VPA', current_app.config.get('UPI_VPA', 'merchant@upi'))
    upi_name = Setting.get('UPI_MERCHANT_NAME', current_app.config.get('UPI_MERCHANT_NAME', 'Cafe'))
    return render_template('admin_settings.html', upi_vpa=upi_vpa, upi_name=upi_name)


@admin_bp.route('/settings/upi', methods=['POST'])
@csrf.exempt
def update_upi_settings():
    upi_vpa = request.form.get('upi_vpa', '').strip()
    upi_name = request.form.get('upi_name', '').strip()

    if not upi_vpa:
        flash('Please provide a UPI VPA (e.g. merchant@bank)', 'error')
        return redirect(url_for('admin.show_settings'))

    Setting.set('UPI_VPA', upi_vpa)
    Setting.set('UPI_MERCHANT_NAME', upi_name)

    flash('UPI settings updated', 'success')
    return redirect(url_for('admin.show_settings'))
