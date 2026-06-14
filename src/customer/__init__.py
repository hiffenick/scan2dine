from flask import Blueprint,render_template

customer_menu = Blueprint('customer_menu',__name__)

from .menu_services import *
from .order import *
from .greating import *
from .cart_api import *
from .summary import *