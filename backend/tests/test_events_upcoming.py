from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from types import SimpleNamespace

import main


def signup(client, email):
    return client.post(
        "/auth/signup", json={"name": "Test", "email": email, "password": "testpass123"}
    )


def seed_global_event(client, name="วันทดสอบ"):
    signup(client, "admin@test.local")
    tomorrow = datetime.now(timezone.utc).date() + timedelta(days=1)
    res = client.post(
        "/admin/events",
        json={
            "name": name,
            "month": tomorrow.month,
            "day": tomorrow.day,
            "suggestion_text": "ข้อความสำรองจากแอดมิน",
        },
    )
    assert res.status_code == 200
    client.cookies.clear()


def test_upcoming_event_headline_none_without_business_category(client):
    seed_global_event(client)
    signup(client, "user@test.local")

    res = client.get("/events/upcoming")
    assert res.status_code == 200
    body = res.json()["event"]
    assert body["headline"] is None
    assert body["suggestion_text"] == "ข้อความสำรองจากแอดมิน"


def test_upcoming_event_headline_none_without_openai_key(client):
    seed_global_event(client)
    signup(client, "user@test.local")
    client.patch("/me", json={"business_category": "food_beverage"})

    res = client.get("/events/upcoming")
    assert res.status_code == 200
    assert res.json()["event"]["headline"] is None


def test_upcoming_event_headline_generated_and_cached(client, monkeypatch):
    seed_global_event(client)
    signup(client, "user@test.local")
    client.patch("/me", json={"business_category": "food_beverage"})

    fake_response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content="โปรโมชั่นเมนูพิเศษวันทดสอบ"))]
    )
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = fake_response
    monkeypatch.setattr(main, "openai_client", fake_client)

    res = client.get("/events/upcoming")
    assert res.status_code == 200
    assert res.json()["event"]["headline"] == "โปรโมชั่นเมนูพิเศษวันทดสอบ"
    assert fake_client.chat.completions.create.call_count == 1

    # Second request should reuse the cached headline instead of calling
    # OpenAI again, since the (event, business_category) pair is unchanged.
    res2 = client.get("/events/upcoming")
    assert res2.json()["event"]["headline"] == "โปรโมชั่นเมนูพิเศษวันทดสอบ"
    assert fake_client.chat.completions.create.call_count == 1


def test_upcoming_event_headline_different_per_category(client, monkeypatch):
    seed_global_event(client)

    signup(client, "user_food@test.local")
    client.patch("/me", json={"business_category": "food_beverage"})

    fake_client = MagicMock()
    fake_client.chat.completions.create.side_effect = [
        SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="ไอเดียร้านอาหาร"))]
        ),
        SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="ไอเดียสตรีมเมอร์"))]
        ),
    ]
    monkeypatch.setattr(main, "openai_client", fake_client)

    res_food = client.get("/events/upcoming")
    assert res_food.json()["event"]["headline"] == "ไอเดียร้านอาหาร"
    client.cookies.clear()

    signup(client, "user_streamer@test.local")
    client.patch("/me", json={"business_category": "streamer"})
    res_streamer = client.get("/events/upcoming")
    assert res_streamer.json()["event"]["headline"] == "ไอเดียสตรีมเมอร์"

    assert fake_client.chat.completions.create.call_count == 2
