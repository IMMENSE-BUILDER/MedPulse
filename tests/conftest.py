import os

os.environ["MEDPULSE_MODE"] = "demo"
os.environ["TINYFISH_API_KEY"] = ""
os.environ["GEMINI_API_KEY"] = ""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.container import reset_services
from app.state import cache


@pytest.fixture()
def client():
    reset_services()
    cache.clear()
    return TestClient(app)
