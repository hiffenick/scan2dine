import os
# from redis import Redis
from urllib.parse import quote_plus
from dotenv import load_dotenv
from datetime import timedelta

load_dotenv()


class Config:
    # ==============================
    # DATABASE CONFIGURATION
    # ==============================
    DATABASE_URL = os.getenv("DATABASE_URL")

    if DATABASE_URL:
        SQLALCHEMY_DATABASE_URI = DATABASE_URL
    else:
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
    SESSION_TYPE = "filesystem"
    SESSION_COOKIE_SECURE = False        # True in production with HTTPS
    SESSION_COOKIE_HTTPONLY = True       # Prevent JS access
    SESSION_COOKIE_SAMESITE = "Lax"      # CSRF protection

   
    # UPI / Payment configuration (used for generating UPI QR for online payments)
    UPI_VPA = os.getenv("UPI_VPA", "merchant@upi")
    UPI_MERCHANT_NAME = os.getenv("UPI_MERCHANT_NAME", "Cafe")
    UPI_CURRENCY = os.getenv("UPI_CURRENCY", "INR")

