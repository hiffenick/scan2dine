from flask import Blueprint

admin_bp = Blueprint("admin", __name__)

from .dashboard_routes import *
from .menu_routes import *
from .orders_routes import *
from .qr_routes import *
from .settings_routes import *
from .payment import *
from .profile import *