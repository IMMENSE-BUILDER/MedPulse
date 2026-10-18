from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException

from ..config import Settings, get_settings


@dataclass
class Services:
    settings: Settings
    tf: Any = None  # TinyFishService | fake
    gemini: Any = None  # GeminiService | fake

    @property
    def live(self) -> bool:
        return self.settings.live and self.tf is not None and self.gemini is not None


_services: Services | None = None


def get_services() -> Services:
    global _services
    if _services is None:
        s = get_settings()
        tf = gem = None
        if s.live:
            missing = [n for n, ok in (("TINYFISH_API_KEY", s.has_tinyfish), ("GEMINI_API_KEY", s.has_gemini)) if not ok]
            if missing:
                raise HTTPException(503, detail={
                    "error": "config_error",
                    "message": f"MEDPULSE_MODE=live but {', '.join(missing)} is empty or was not read from .env. "
                               "Save .env next to main.py, start uvicorn from that folder, or set MEDPULSE_MODE=auto.",
                })
            try:
                from .gemini import GeminiService
                from .tinyfish_client import TinyFishService

                tf, gem = TinyFishService(s.tinyfish_api_key), GeminiService(s.gemini_api_key, s.gemini_model, s.gemini_fallback_model)
            except Exception as e:
                raise HTTPException(503, detail={
                    "error": "client_init_failed",
                    "message": f"Could not start TinyFish/Gemini clients: {type(e).__name__}: {e}",
                })
        _services = Services(s, tf, gem)
    return _services


def reset_services():
    global _services
    _services = None
