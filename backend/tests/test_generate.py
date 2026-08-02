import json
from types import SimpleNamespace
from unittest.mock import MagicMock

import main


def signup(client, email):
    return client.post(
        "/auth/signup", json={"name": "Test", "email": email, "password": "testpass123"}
    )


# "tiktok" is never seeded by init_db()'s default templates (only facebook/
# line/instagram are), so it's a safe platform to use for tests that need a
# fully controlled, deterministic set of matching templates.
def seed_template(client):
    signup(client, "admin@test.local")
    res = client.post(
        "/admin/prompt-templates",
        json={
            "business_category": None,
            "platform": "tiktok",
            "tone": "friendly",
            "template_text": "เทมเพลตทดสอบสำหรับ tiktok",
        },
    )
    assert res.status_code == 200
    client.cookies.clear()


def test_generate_falls_back_to_template_without_api_key(client):
    seed_template(client)
    signup(client, "user@test.local")

    res = client.post(
        "/generate", json={"prompt": "โปรโมชั่นหน้าร้อน", "platform": "tiktok", "tone": "friendly"}
    )
    assert res.status_code == 200
    assert res.json()["caption"] == "เทมเพลตทดสอบสำหรับ tiktok"


def test_generate_falls_back_when_budget_exceeded(client, monkeypatch):
    seed_template(client)
    signup(client, "user@test.local")

    # openai_client truthy but budget forced to 0 — must still avoid any
    # real API call and fall back to the template path, same as no-API-key.
    monkeypatch.setattr(main, "openai_client", object())
    monkeypatch.setattr(main, "OPENAI_MONTHLY_BUDGET_USD", 0.0)

    res = client.post(
        "/generate", json={"prompt": "โปรโมชั่นหน้าร้อน", "platform": "tiktok", "tone": "friendly"}
    )
    assert res.status_code == 200
    assert res.json()["caption"] == "เทมเพลตทดสอบสำหรับ tiktok"


def test_generate_without_matching_template_returns_404(client):
    signup(client, "user@test.local")
    res = client.post(
        "/generate", json={"prompt": "โปรโมชั่นหน้าร้อน", "platform": "tiktok", "tone": "friendly"}
    )
    assert res.status_code == 404


def test_generate_returns_caption_and_image_prompt_when_openai_available(client, monkeypatch):
    signup(client, "user@test.local")

    fake_response = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(
                    content=json.dumps(
                        {
                            "caption": "แคปชั่นทดสอบ",
                            "image_prompt": "a bright orange iced coffee on a wooden table",
                        }
                    )
                )
            )
        ],
        usage=SimpleNamespace(prompt_tokens=100, completion_tokens=50),
    )
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = fake_response
    monkeypatch.setattr(main, "openai_client", fake_client)

    res = client.post(
        "/generate", json={"prompt": "โปรโมชั่นหน้าร้อน", "platform": "facebook", "tone": "friendly"}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["caption"] == "แคปชั่นทดสอบ"
    assert body["image_prompt"] == "a bright orange iced coffee on a wooden table"


def test_generate_rating_mode_prefers_higher_rated_examples(client, monkeypatch):
    signup(client, "user@test.local")

    examples = {}
    for label, rating in [("low", 1), ("high", 5), ("mid", 3)]:
        res = client.post(
            "/example-posts",
            data={
                "business_category": "food_beverage",
                "platform": "facebook",
                "caption": f"ตัวอย่างเรตติ้ง {label}",
            },
        )
        post_id = res.json()["id"]
        client.patch(f"/example-posts/{post_id}/rating", json={"rating": rating})
        examples[label] = post_id

    res = client.patch("/me/example-selection-mode", json={"example_selection_mode": "rating"})
    assert res.status_code == 200

    fake_response = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(
                    content=json.dumps({"caption": "แคปชั่นทดสอบ", "image_prompt": "test"})
                )
            )
        ],
        usage=SimpleNamespace(prompt_tokens=100, completion_tokens=50),
    )
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = fake_response
    monkeypatch.setattr(main, "openai_client", fake_client)

    res = client.post(
        "/generate", json={"prompt": "โปรโมชั่นหน้าร้อน", "platform": "facebook", "tone": "friendly"}
    )
    assert res.status_code == 200

    system_prompt = fake_client.chat.completions.create.call_args.kwargs["messages"][0]["content"]
    assert "ตัวอย่างเรตติ้ง high" in system_prompt
    assert "ตัวอย่างเรตติ้ง mid" in system_prompt
    assert "ตัวอย่างเรตติ้ง low" not in system_prompt
