from src.extensions import db
from datetime import datetime

class Category(db.Model):
    __tablename__ = "categories"
    id         = db.Column(db.Integer, primary_key=True)
    name       = db.Column(db.String(50), nullable=False, unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    items = db.relationship('MenuItem', backref='category', lazy=True)

    def to_dict(self):
        return {'id': self.id, 'name': self.name}

    def __repr__(self):
        return f"<Category {self.name}>"