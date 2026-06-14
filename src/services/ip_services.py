import os
import socket
import logging

logger = logging.getLogger(__name__)


def get_local_ip():
    """Get the local network IP address of this machine.

    Order of resolution:
    1. Environment variable 'QR_HOST' (explicit override)
    2. UDP socket connect to a public IP (doesn't send data)
    3. UDP socket connect to a private/reserved address (works offline)
    4. socket.gethostbyname(hostname) and getaddrinfo fallbacks
    5. Environment variable 'QR_HOST_FALLBACK'
    6. Final fallback '172.20.10.7' (per user's preference)

    Returns an IPv4 string.
    """
    # 1) Allow explicit override from environment/config
    env_ip = os.getenv('QR_HOST') or os.getenv('EXTERNAL_HOST')
    if env_ip:
        return env_ip

    # Helper to test candidate IPs
    def _valid_ip(ip_str):
        return ip_str and not ip_str.startswith('127.') and not ip_str.startswith('0.')

    # 2) Primary detection: UDP connect to a public IP (no data sent)
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if _valid_ip(ip):
            return ip
    except Exception:
        logger.debug("Primary UDP method failed when detecting local IP", exc_info=True)

    # 3) Try an alternative reserved address (works without external connectivity)
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # This address does not need to be reachable; it's used to determine the outbound interface
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        s.close()
        if _valid_ip(ip):
            return ip
    except Exception:
        logger.debug("Fallback UDP method failed when detecting local IP", exc_info=True)

    # 4) Hostname-based lookup and addrinfo
    try:
        hostname = socket.gethostname()
        ip = socket.gethostbyname(hostname)
        if _valid_ip(ip):
            return ip
    except Exception:
        logger.debug("gethostbyname failed", exc_info=True)

    try:
        for res in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET, socket.SOCK_STREAM):
            candidate = res[4][0]
            if _valid_ip(candidate):
                return candidate
    except Exception:
        logger.debug("getaddrinfo fallback failed", exc_info=True)

    # 5) Optional explicit fallback env variable
    env_fb = os.getenv('QR_HOST_FALLBACK')
    if env_fb:
        return env_fb

    # 6) Final fallback per user's request
    return '172.20.10.7'