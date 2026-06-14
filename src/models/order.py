from src.extensions import db
from datetime import datetime
from sqlalchemy import CheckConstraint

class Order(db.Model):
    __tablename__ = "orders"

    __table_args__ = (
    CheckConstraint(
        "status IN ('Pending', 'Completed', 'Cancelled')",
        name="check_order_status"
    ),
    )


    id = db.Column(db.Integer, primary_key=True)

    customer_name = db.Column(db.String(100), nullable=False)

    total_amount = db.Column(db.Numeric(10, 2), nullable=False)

    table_no = db.Column(db.Integer, nullable=False)


    status = db.Column(
        db.String(20),
        nullable=False,
        default="Pending"
    )

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    items = db.relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan"
    )
