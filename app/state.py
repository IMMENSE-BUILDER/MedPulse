"""In-memory agent log bus + TTL cache. Swap for Redis if you run >1 worker."""
from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque
from datetime import datetime
from typing import Any

from .config import get_settings


class AgentLogBus:
    """Per-session ring buffer; SSE subscribers read it by offset."""

    def __init__(self, maxlen: int = 200):
        self._logs: dict[str, deque] = defaultdict(lambda: deque(maxlen=maxlen))
        self._counters: dict[str, int] = defaultdict(int)
        self._cond: dict[str, asyncio.Condition] = {}

    def _c(self, sid: str) -> asyncio.Condition:
        if sid not in self._cond:
            self._cond[sid] = asyncio.Condition()
        return self._cond[sid]

    async def emit(self, sid: str, message: str, level: str = "info") -> None:
        self._counters[sid] += 1
        entry = {
            "seq": self._counters[sid],
            "ts": datetime.now().strftime("%H:%M:%S"),
            "level": level,
            "message": message,
        }
        self._logs[sid].append(entry)
        c = self._c(sid)
        async with c:
            c.notify_all()

    def history(self, sid: str, after: int = 0) -> list[dict]:
        return [e for e in self._logs[sid] if e["seq"] > after]

    async def wait(self, sid: str, timeout: float = 15.0) -> None:
        c = self._c(sid)
        async with c:
            try:
                await asyncio.wait_for(c.wait(), timeout)
            except asyncio.TimeoutError:
                pass


bus = AgentLogBus()


class TTLCache:
    def __init__(self):
        self._d: dict[str, tuple[float, Any]] = {}

    def get(self, key: str):
        item = self._d.get(key)
        if not item:
            return None
        exp, val = item
        if exp < time.time():
            self._d.pop(key, None)
            return None
        return val

    def set(self, key: str, val: Any, ttl: int | None = None):
        ttl = ttl if ttl is not None else get_settings().cache_ttl_seconds
        self._d[key] = (time.time() + ttl, val)
        if len(self._d) > 500:  # crude bound
            for k in sorted(self._d, key=lambda k: self._d[k][0])[:100]:
                self._d.pop(k, None)

    def clear(self):
        self._d.clear()


cache = TTLCache()
