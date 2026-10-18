from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    tinyfish_api_key: str = ""
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    gemini_fallback_model: str = ""  # optional backup model used when the primary stays overloaded
    gemini_batch_size: int = 5  # pages read per Gemini request
    gemini_concurrency: int = 2  # parallel Gemini calls per search (lower = fewer 503/429)
    medpulse_mode: str = "auto"  # auto | demo | live
    default_pincode: str = "110053"
    cache_ttl_seconds: int = 900
    cors_origins: str = "*"

    @property
    def has_tinyfish(self) -> bool:
        return bool(self.tinyfish_api_key)

    @property
    def has_gemini(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def live(self) -> bool:
        if self.medpulse_mode == "demo":
            return False
        if self.medpulse_mode == "live":
            return True
        return self.has_tinyfish and self.has_gemini


@lru_cache
def get_settings() -> Settings:
    return Settings()
