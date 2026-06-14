from flask import redirect, url_for, session
from . import home_bp

@home_bp.route("/")
def home():
    if "user_id" in session:
        return redirect(url_for("admin.admin_dashboard"))
    return redirect(url_for("login.login"))
