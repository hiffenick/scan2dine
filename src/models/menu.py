from src.extensions import db
from datetime import datetime
from sqlalchemy import Numeric

class MenuItem(db.Model):
    __tablename__ = "menu_items"

    id = db.Column(db.Integer, primary_key=True)
    item_name = db.Column(db.String(100), nullable=False, unique=True)
    item_price = db.Column(Numeric(10, 2), nullable=False)
    category = db.Column(db.String(50), nullable=False, default="General")
    description = db.Column(db.String(255), nullable=True)

    is_veg = db.Column(db.Boolean, default=True)
    image_url = db.Column(db.String(255), nullable=True)
    
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.item_name,
            "price": float(self.item_price),  # VERY IMPORTANT (Decimal → JSON)
            "category": self.category,
            "description": self.description
        }

    def __repr__(self):
        return f"<MenuItem {self.item_name} - ₹{self.item_price}>"
