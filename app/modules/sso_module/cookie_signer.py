import hmac
import hashlib
from typing import Optional

def sign_cookie(value: str, secret_key: str) -> str:
    """Signs a cookie value using HMAC-SHA256."""
    if not value:
        return ""
    signature = hmac.new(
        secret_key.encode("utf-8"),
        value.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    return f"{value}.{signature}"

def verify_cookie(signed_value: str, secret_key: str) -> Optional[str]:
    """Verifies a signed cookie and returns original value if valid."""
    if not signed_value or "." not in signed_value:
        return None
    try:
        value, signature = signed_value.rsplit(".", 1)
        expected_sig = hmac.new(
            secret_key.encode("utf-8"),
            value.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()
        if hmac.compare_digest(signature, expected_sig):
            return value
    except Exception:
        pass
    return None
