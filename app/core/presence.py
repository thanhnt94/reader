import time
from typing import Dict

class PresenceTracker:
    _last_seen: Dict[int, float] = {}
    _timeout: float = 300.0  # 5 minutes

    @classmethod
    def touch(cls, user_id: int):
        if user_id:
            cls._last_seen[user_id] = time.time()

    @classmethod
    def is_online(cls, user_id: int) -> bool:
        ts = cls._last_seen.get(user_id)
        if not ts:
            return False
        return (time.time() - ts) < cls._timeout

    @classmethod
    def get_online_user_ids(cls):
        now = time.time()
        return [uid for uid, ts in cls._last_seen.items() if (now - ts) < cls._timeout]
