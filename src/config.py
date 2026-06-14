import os
from redis import Redis
from urllib.parse import quote_plus
from dotenv import load_dotenv
from datetime import timedelta

load_dotenv()


class Config:
    # ==============================
    # DATABASE CONFIGURATION
    # ==============================
    USER = os.getenv("USER")
    SERVER = os.getenv("SERVER")
    PASSWORD_RAW = os.getenv("PASSWORD")
    PASSWORD = quote_plus(PASSWORD_RAW) if PASSWORD_RAW else ""
    DB_NAME = os.getenv("DB_NAME")

    SQLALCHEMY_DATABASE_URI = (
        f"mssql+pyodbc://{USER}:{PASSWORD}@{SERVER}/{DB_NAME}"
        "?driver=ODBC+Driver+17+for+SQL+Server"
    )

    SQLALCHEMY_TRACK_MODIFICATIONS = False


    # ==============================
    # SECURITY
    # ==============================
    SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-fixed-key")

    SESSION_COOKIE_SECURE = False        # True in production with HTTPS
    SESSION_COOKIE_HTTPONLY = True       # Prevent JS access
    SESSION_COOKIE_SAMESITE = "Lax"      # CSRF protection


    # ==============================
    # REDIS CONFIGURATION
    # ==============================
    REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
    REDIS_DB = 0

    REDIS_CLIENT = Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=REDIS_DB,
        decode_responses=False  # IMPORTANT: Keep False for Flask-Session
    )


    # ==============================
    # SESSION CONFIGURATION (Flask-Session)
    # ==============================
    SESSION_TYPE = "redis"
    SESSION_REDIS = REDIS_CLIENT
    SESSION_PERMANENT = False
    PERMANENT_SESSION_LIFETIME = timedelta(hours=1)
    SESSION_REFRESH_EACH_REQUEST = True

    # UPI / Payment configuration (used for generating UPI QR for online payments)
    UPI_VPA = os.getenv("UPI_VPA", "merchant@upi")
    UPI_MERCHANT_NAME = os.getenv("UPI_MERCHANT_NAME", "Cafe")
    UPI_CURRENCY = os.getenv("UPI_CURRENCY", "INR")

