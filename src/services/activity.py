from flask import request
from src.extensions import db
from src.models.activity_log import ActivityLog


def get_client_ip() -> str:
    """Real client IP, proxy-aware (Railway/nginx put it in X-Forwarded-For)."""
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "Unknown"


def log_activity(user_id: int, type: str, text: str) -> None:
    """
    Write one activity row. Call this anywhere a user-visible action happens.

    Example:
        log_activity(current_user.id, "menu", f'Added dish "{item.item_name}" to {category.name}')
    """
    entry = ActivityLog(
        user_id=user_id,
        type=type,
        text=text,
        ip_address=get_client_ip(),
        user_agent=request.headers.get("User-Agent", "")[:255],
    )
    db.session.add(entry)
    db.session.commit()

    
def parse_user_agent(ua: str) -> tuple[str, str]:
    browser = "Unknown"
    if "Edg" in ua:
        browser = "Microsoft Edge"
    elif "Chrome" in ua:
        browser = "Chrome"
    elif "Firefox" in ua:
        browser = "Firefox"
    elif "Safari" in ua:
        browser = "Safari"

    os_name = "Unknown OS"
    if "Windows" in ua:
        os_name = "Windows"
    elif "Macintosh" in ua:
        os_name = "macOS"
    elif "Android" in ua:
        os_name = "Android"
    elif "iPhone" in ua or "iPad" in ua:
        os_name = "iOS"
    elif "Linux" in ua:
        os_name = "Linux"

    return browser, os_name
