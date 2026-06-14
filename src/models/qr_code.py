from src.extensions import db
from datetime import datetime


class QRCode(db.Model):
    __tablename__ = "qr_codes"

    id = db.Column(db.Integer, primary_key=True)
    
    # Reference to table number
    table_no = db.Column(db.Integer, nullable=False, index=True)
    
    # The URL embedded in the QR code
    qr_url = db.Column(db.Text, nullable=False)
    
    # QR code image as base64 PNG (stored as Text, should be large enough)
    qr_image_base64 = db.Column(db.Text, nullable=False)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    deleted_at = db.Column(db.DateTime, nullable=True)  # Soft delete
    
    # Whether this QR is currently active
    is_active = db.Column(db.Boolean, default=True, nullable=False, index=True)
    
    def __repr__(self):
        return f"<QRCode table={self.table_no} created={self.created_at}>"
    
    @classmethod
    def get_active_for_table(cls, table_no):
        """Get all active QR codes for a table"""
        return cls.query.filter_by(
            table_no=table_no,
            is_active=True,
            deleted_at=None
        ).order_by(cls.created_at.desc()).all()
    
    @classmethod
    def get_latest_active_for_table(cls, table_no):
        """Get the most recent active QR code for a table"""
        return cls.query.filter_by(
            table_no=table_no,
            is_active=True,
            deleted_at=None
        ).order_by(cls.created_at.desc()).first()
    
    def soft_delete(self):
        """Soft delete by marking deleted_at and setting is_active to False"""
        self.is_active = False
        self.deleted_at = datetime.utcnow()
        db.session.commit()
