"""
src/models/payment_setting.py
Stores UPI / payment configuration for the cafe.
One row per cafe (singleton pattern — always use PaymentSetting.get()).
"""
from src.extensions import db
from datetime import datetime, timezone


class PaymentSetting(db.Model):
    __tablename__ = "payment_settings"

    id              = db.Column(db.Integer, primary_key=True)
    upi_id          = db.Column(db.String(256), nullable=True, default="")
    account_name    = db.Column(db.String(256), nullable=True, default="")
    instructions    = db.Column(db.Text,        nullable=True, default="")
    qr_image_base64 = db.Column(db.Text,        nullable=True, default=None)
    updated_at      = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ── Singleton helpers ──────────────────────────────────────────────────

    @classmethod
    def get(cls) -> "PaymentSetting":
        """Return the single settings row, creating it if it doesn't exist."""
        row = cls.query.first()
        if row is None:
            row = cls()
            db.session.add(row)
            db.session.commit()
        return row

    def to_dict(self) -> dict:
        return {
            "upi_id":          self.upi_id or "",
            "account_name":    self.account_name or "",
            "instructions":    self.instructions or "",
            "has_qr":          bool(self.qr_image_base64),
            "qr_image_base64": self.qr_image_base64 or None,
            "updated_at":      self.updated_at.strftime("%d %b %Y") if self.updated_at else "—",
        }

    def __repr__(self):
        return f"<PaymentSetting upi_id={self.upi_id!r}>"
    