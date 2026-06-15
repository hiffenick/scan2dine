from src.extensions import db
from flask_login import UserMixin
import pyotp

class User(db.Model,UserMixin):
    __tablename__ = 'User'
    id = db.Column(db.Integer, nullable=False, unique=True, primary_key=True, autoincrement=True)
    name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255),unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    totp_secret = db.Column(db.String(64), default=lambda: pyotp.random_base32())
    totp_enable = db.Column(db.Boolean, default=False)
    
    def __repr__(self):
        return f'<User {self.name}>'