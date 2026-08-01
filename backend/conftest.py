import os

from dotenv import load_dotenv

# Load real secrets (JWT_SECRET, GOOGLE_CLIENT_ID, etc.) first, then override
# the handful that must point at test infrastructure or be forced off so
# tests never touch production data, real email, real OpenAI, or real Sentry.
load_dotenv()

os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]
os.environ["OPENAI_API_KEY"] = ""
os.environ["RESEND_API_KEY"] = ""
os.environ["SENTRY_DSN"] = ""
os.environ["ADMIN_EMAILS"] = "admin@test.local"

import pytest
from fastapi.testclient import TestClient

import db
import main

TABLES = [
    "generation_log",
    "example_posts",
    "security_events",
    "events",
    "prompt_templates",
    "content_items",
    "brand_dna",
    "users",
]


@pytest.fixture()
def client():
    with TestClient(main.app) as c:
        yield c
    conn = db.get_connection()
    conn.execute(f"TRUNCATE TABLE {', '.join(TABLES)} RESTART IDENTITY CASCADE")
    conn.commit()
    conn.close()


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    main.limiter.reset()
    yield
