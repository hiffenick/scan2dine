import os
from src.config import Config
from src.extensions import db,migrate,csrf
from src.signup import signup_route
from src.login import login_route
from src.logout import logout_route
from src.setup import setuproute
from src.verify import verifyroute
from src.home import home_bp
from src.menu import menuroute
from src.customer_route import customer_route
from src.models.admin import User
from src.models.menu import MenuItem
from src.models.order import Order
from src.models.order_item import OrderItem
from src.customer.menu_services import customer_menu
from src.setup import setuproute
from src.test import test_route
from flask import Flask
from src.admin import admin_bp
from src.customer.order import customer_order_bp
from src.customer.greating import greeting

basedir = os.path.abspath(os.path.dirname(__file__))
templatefolder = os.path.join(os.path.dirname(basedir),'templates')
staticfolder = os.path.join(os.path.dirname(basedir),'static')

def createapp():
    app = Flask(__name__,template_folder=templatefolder,static_folder=staticfolder)
    app.config.from_object(Config)
    # Enable development debug mode and verbose errors so UI/server errors are visible
    app.env = 'development'
    app.debug = True
    app.config['DEBUG'] = True
    app.config['NGROK_URL'] = 'untugged-supervisory-edwin.ngrok-free.dev'

    # Install debug toolbar in development for better in-browser diagnostics
    try:
        from flask_debugtoolbar import DebugToolbarExtension
        toolbar = DebugToolbarExtension()
        app.config.setdefault('DEBUG_TB_INTERCEPT_REDIRECTS', False)
        toolbar.init_app(app)
    except Exception:
        # If the debug toolbar package isn't installed, continue without it
        pass

    # --- Logging configuration: output requests and exceptions to the terminal
    import logging
    from logging import StreamHandler

    # Clear default handlers and set our stream handler
    root_logger = logging.getLogger()
    if not root_logger.handlers:
        handler = StreamHandler()
        handler.setLevel(logging.DEBUG)
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s"))
        root_logger.addHandler(handler)
    # Ensure root logger will emit debug messages
    root_logger.setLevel(logging.DEBUG)

    # Configure Flask and Werkzeug loggers to DEBUG in development
    app.logger.setLevel(logging.DEBUG)
    logging.getLogger('werkzeug').setLevel(logging.DEBUG)

    # Optionally log incoming requests (method, path, remote addr). Enabled in dev.
    # @app.before_request
    # def log_request_info():
    #     try:
    #         from flask import request, session, g
    #         import time
    #         # record start time for duration logging
    #         g.start_time = time.time()
    #         # Don't log large bodies; only log for JSON or small form posts
    #         body = None
    #         if request.content_length and request.content_length < 4096:
    #             # Try to safely read json/form
    #             try:
    #                 body = request.get_json(silent=True)
    #             except Exception:
    #                 body = request.get_data(as_text=True)[:1024]

    #         # include user/session info when available
    #         user_id = None
    #         try:
    #             user_id = session.get('user_id')
    #         except Exception:
    #             user_id = None
                           
    #     except Exception:
    #         app.logger.exception('Failed to log request info')

    # @app.after_request
    # def log_response_info(response):
    #     try:
    #         from flask import request, session, g
    #         import time
    #         start = getattr(g, 'start_time', None)
    #         duration_ms = None
    #         if start:
    #             duration_ms = int((time.time() - start) * 1000)

    #         # Log method, path, status, duration, user/session id
    #         app.logger.debug(
    #             "Response: %s %s %s %sms user_id=%s session_id=%s",
    #             request.method,
    #             request.path,
    #             response.status,
    #             duration_ms if duration_ms is not None else '-',
    #             session.get('user_id'),
    #             session.get('session_id'),
    #         )
    #     except Exception:
    #         app.logger.exception('Failed to log response info')
    #     return response

    # @app.teardown_request
    # def log_teardown(exception=None):
    #     if exception:
    #         # This will log exception details and stack trace to the terminal
    #         app.logger.exception('Request raised exception: %s', exception)

    # Additional security configurations (override for production)
    app.config.setdefault('SESSION_COOKIE_SECURE', False)  # Change to True in production with HTTPS
    app.config.setdefault('SESSION_COOKIE_HTTPONLY', True)
    app.config.setdefault('SESSION_COOKIE_SAMESITE', 'Lax')

    # Ensure verbose exception propagation when debugging
    app.config.setdefault('PROPAGATE_EXCEPTIONS', True)

    db.init_app(app)
    migrate.init_app(app,db)
    csrf.init_app(app)
    # sess.init_app(app)

    # Verify server-side session token on each request when a user_id is present.
    # If verification fails, clear session and force login. This prevents
    # sessions from being reused if the server-side token was revoked/expired.
    from src.auth.session_manager import SessionManager
    from flask import session, redirect, url_for, request
    from src.services.redis_session import get_customer_session

    # @app.before_request
    # def _verify_session_token():
    #     # Helper: Flask removed `request.is_xhr`. Detect AJAX/JSON requests
    #     def _is_ajax_or_json(req):
    #         xrw = req.headers.get('X-Requested-With', '')
    #         accept = req.headers.get('Accept', '')
    #         return (str(xrw).lower() == 'xmlhttprequest') or ('application/json' in str(accept).lower())
    #     # If there's no logged-in user, nothing to verify
    #     user_id = session.get(SessionManager.USER_KEY)
    #     token = session.get(SessionManager.SESSION_TOKEN_KEY)
    #     if not user_id:
    #         return None

    #     # If token missing or invalid, clear session and redirect to login
    #     valid_user = SessionManager.verify_session_token(token)
    #     if valid_user != user_id:
    #         SessionManager.clear_session(session)
    #         # Allow AJAX/fetch clients to get a 401 instead of HTML redirect
    #         if _is_ajax_or_json(request):
    #             return ("", 401)
    #         return redirect(url_for('login.login'))

    #     # Enforce customer session for customer API endpoints (cart/order API)
    #     # Only enforce server-side Redis-backed customer sessions for API calls
    #     # Client-facing customer pages (QR landing) remain accessible so users
    #     # can create a session by scanning a QR.
    #     if request.path.startswith('/customer/api'):
    #         session_id = session.get('session_id')
    #         if not session_id or not get_customer_session(session_id):
    #             # For API clients always return 401 (JSON) when customer session is missing.
    #             # Returning HTML redirects for API endpoints breaks fetch/XHR clients
    #             # so respond with 401 and let the frontend handle the redirect to QR flow.
    #             return ("", 401)

    
    app.register_blueprint(admin_bp, url_prefix="/admin")
    app.register_blueprint(customer_menu)
    app.register_blueprint(customer_route)
    app.register_blueprint(home_bp)
    app.register_blueprint(signup_route)
    app.register_blueprint(login_route)
    app.register_blueprint(logout_route)
    app.register_blueprint(test_route)
    app.register_blueprint(setuproute)
    app.register_blueprint(verifyroute)
    app.register_blueprint(menuroute)
    app.register_blueprint(customer_order_bp)
    app.register_blueprint(greeting)
    # app.register_blueprint(customer_route)

    # for rule in app.url_map.iter_rules():
    #     print(rule.endpoint, "=>", rule)
    
    return app
