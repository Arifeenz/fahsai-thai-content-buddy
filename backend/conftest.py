import os

from dotenv import load_dotenv

# Load real secrets (JWT_SECRET, GOOGLE_CLIENT_ID, etc.) first, then override
# the handful that must point at test infrastructure or be forced off so
# tests never touch production data, real email, real OpenAI, or real Sentry.
load_dotenv()

# Hard guard against the exact mistake that once wiped the real database:
# a throwaway debug script set TEST_DATABASE_URL to the real DATABASE_URL's
# value, so this override below became a no-op and the test suite's
# TRUNCATE ... RESTART IDENTITY CASCADE teardown ran against production
# instead of the test project. If the two URLs ever match again -- however
# that happens -- refuse to proceed rather than silently truncating
# whatever DATABASE_URL happens to point at.
if os.environ["TEST_DATABASE_URL"] == os.environ["DATABASE_URL"]:
    raise RuntimeError(
        "TEST_DATABASE_URL is identical to DATABASE_URL. Refusing to run tests: "
        "this fixture TRUNCATEs its target database after every test, and running "
        "it against the real database destroys real data. Fix the environment "
        "before running tests again."
    )

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
    "platform_tips",
    "content_items",
    "brand_dna",
    "quotes",
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
