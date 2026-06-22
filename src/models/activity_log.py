from src.extensions import db
from datetime import datetime


class ActivityLog(db.Model):
    __tablename__ = "activity_logs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("User.id"), nullable=False, index=True)

    # 'login', 'order', 'menu', 'qr', 'security'
    type = db.Column(db.String(20), nullable=False, index=True)
    text = db.Column(db.String(255), nullable=False)

    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    user = db.relationship("User")

    def time_ago(self):
        delta = datetime.utcnow() - self.created_at
        secs = int(delta.total_seconds())
        if secs < 60:
            return "Just now"
        mins = secs // 60
        if mins < 60:
            return f"{mins} min ago"
        hours = mins // 60
        if hours < 24:
            return f"{hours} hr ago"
        days = hours // 24
        if days < 30:
            return f"{days} day{'s' if days != 1 else ''} ago"
        return self.created_at.strftime("%d %b %Y")

    def to_dict(self):
        return {"type": self.type, "text": self.text, "time": self.time_ago()}

    def __repr__(self):
        return f"<ActivityLog {self.type}:{self.text!r} user={self.user_id}>"