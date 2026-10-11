import json
from types import SimpleNamespace
from unittest.mock import MagicMock

import main


def signup(client, email):
    return client.post(
        "/auth/signup", json={"name": "Test", "email": email, "password": "testpass123"}
    )


# A platform string init_db()'s default templates never seed anything under,
# so it's safe for tests that need a fully controlled, deterministic set of
# matching templates. Real platform keys (facebook/line/instagram/tiktok/
# youtube) all have category-scoped seed rows now, so picking one of those
# would risk matching unrelated seed data instead of just this test's row.
def seed_template(client):
    signup(client, "admin@test.local")
    res = client.post(
        "/admin/prompt-templates",
        json={
            "business_category": None,
            "platform": "unseeded-platform",
            "tone": "friendly",
            "template_text": "เทมเพลตทดสอบสำหรับแพลตฟอร์มทดสอบ",
        },
    )
    assert res.status_code == 200
    client.cookies.clear()


def test_generate_falls_back_to_template_without_api_key(client):
    seed_template(client)
    signup(client, "user@test.local")

    res = client.post(
        "/generate",
        json={"prompt": "โปรโมชั่นหน้าร้อน", "platform": "unseeded-platform", "tone": "friendly"},
    )
    assert res.status_code == 200
    assert res.json()["caption"] == "เทมเพลตทดสอบสำหรับแพลตฟอร์มทดสอบ"


def test_generate_falls_back_when_budget_exceeded(client, monkeypatch):
    seed_template(client)
    signup(client, "user@test.local")

    # openai_client truthy but budget forced to 0 — must still avoid any
    # real API call and fall back to the template path, same as no-API-key.
    monkeypatch.setattr(main, "openai_client", object())
    monkeypatch.setattr(main, "OPENAI_MONTHLY_BUDGET_USD", 0.0)

    res = client.post(
        "/generate",
        json={"prompt": "โปรโมชั่นหน้าร้อน", "platform": "unseeded-platform", "tone": "friendly"},
    )
    assert res.status_code == 200
    assert res.json()["caption"] == "เทมเพลตทดสอบสำหรับแพลตฟอร์มทดสอบ"


def test_generate_without_matching_template_returns_404(client):
    # No business_category set, so the new category-widen fallback
    # deliberately does not kick in (see main.py's generate_content) --
    # confirms a categoryless user with no matching template still 404s
    # instead of silently widening to "every template in the table."
    signup(client, "user@test.local")
    res = client.post(
        "/generate",
        json={"prompt": "โปรโมชั่นหน้าร้อน", "platform": "unseeded-platform", "tone": "friendly"},
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


def test_generate_returns_only_own_examples_in_used_examples(client, monkeypatch):
    signup(client, "admin@test.local")
    res = client.post(
        "/admin/example-posts",
        data={
            "business_category": "food_beverage",
            "platform": "facebook",
            "caption": "ตัวอย่างกลางจาก admin",
        },
    )
    assert res.status_code == 200
    client.cookies.clear()

    signup(client, "user@test.local")
    res = client.patch("/me", json={"business_category": "food_beverage"})
    assert res.status_code == 200
    res = client.post(
        "/example-posts",
        data={
            "business_category": "food_beverage",
            "platform": "facebook",
            "caption": "ตัวอย่างของฉันเอง",
        },
    )
    assert res.status_code == 200
    own_id = res.json()["id"]

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
    used = res.json()["used_examples"]
    assert used == [{"id": own_id, "caption": "ตัวอย่างของฉันเอง", "platform": "facebook"}]

    # the admin-curated global example still informs the prompt itself --
    # it's just not echoed back as something *this* user can go edit
    system_prompt = fake_client.chat.completions.create.call_args.kwargs["messages"][0]["content"]
    assert "ตัวอย่างกลางจาก admin" in system_prompt


def test_generate_falls_back_to_any_platform_template_for_category_when_exact_platform_missing(
    client,
):
    # A category can be asked to generate for a platform with no
    # platform-specific fallback template authored yet (e.g. fortune_telling
    # has no "tiktok" templates seeded) -- generation should still work off
    # any template for that category rather than 404ing, since a human
    # reviewing an AI-outage fallback would consider it close enough.
    signup(client, "user@test.local")
    res = client.patch("/me", json={"business_category": "fortune_telling"})
    assert res.status_code == 200

    res = client.post(
        "/generate", json={"prompt": "ดวงวันนี้", "platform": "tiktok", "tone": "friendly"}
    )
    assert res.status_code == 200
    assert res.json()["caption"]


def fake_json_choice(caption, image_prompt=None):
    return SimpleNamespace(
        message=SimpleNamespace(
            content=json.dumps({"caption": caption, "image_prompt": image_prompt})
        )
    )


def test_generate_returns_one_variant_per_choice_in_a_single_call(client, monkeypatch):
    signup(client, "user@test.local")
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = SimpleNamespace(
        choices=[
            fake_json_choice("แบบหนึ่ง", "prompt one"),
            fake_json_choice("แบบสอง", "prompt two"),
            fake_json_choice("แบบสาม", "prompt three"),
        ],
        usage=SimpleNamespace(prompt_tokens=100, completion_tokens=150),
    )
    monkeypatch.setattr(main, "openai_client", fake_client)

    res = client.post(
        "/generate", json={"prompt": "เมนูใหม่", "platform": "facebook", "tone": "friendly"}
    )
    assert res.status_code == 200
    body = res.json()
    assert [v["caption"] for v in body["variants"]] == ["แบบหนึ่ง", "แบบสอง", "แบบสาม"]
    # Each variant keeps the image prompt written for it.
    assert [v["image_prompt"] for v in body["variants"]] == ["prompt one", "prompt two", "prompt three"]
    assert body["caption"] == "แบบหนึ่ง"

    # One request -> one OpenAI call asking for n choices, one log row.
    assert fake_client.chat.completions.create.call_count == 1
    assert fake_client.chat.completions.create.call_args.kwargs["n"] == main.CAPTION_VARIANTS
    logs = [log for log in main.list_generation_logs() if log["mode"] == "idea"]
    assert len(logs) == 1
    assert "แบบสาม" in logs[0]["caption"]

    # The draft saved is variant 1.
    items = client.get("/content").json()["items"]
    assert any(it["id"] == body["content_id"] and it["preview"] == "แบบหนึ่ง" for it in items)


def test_generate_skips_an_unparseable_choice(client, monkeypatch):
    signup(client, "user@test.local")
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = SimpleNamespace(
        choices=[
            fake_json_choice("ใช้ได้"),
            SimpleNamespace(message=SimpleNamespace(content='{"caption": "ถูกตัดกลาง')),
        ],
        usage=SimpleNamespace(prompt_tokens=100, completion_tokens=150),
    )
    monkeypatch.setattr(main, "openai_client", fake_client)

    res = client.post(
        "/generate", json={"prompt": "เมนูใหม่", "platform": "facebook", "tone": "friendly"}
    )
    assert res.status_code == 200
    assert [v["caption"] for v in res.json()["variants"]] == ["ใช้ได้"]


def test_template_fallback_also_returns_variants(client):
    seed_template(client)
    signup(client, "user@test.local")
    res = client.post(
        "/generate",
        json={"prompt": "โปรโมชั่นหน้าร้อน", "platform": "unseeded-platform", "tone": "friendly"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["variants"] == [
        {"caption": body["caption"], "image_prompt": None, "image_prompt_th": None}
    ]


def test_selected_variant_is_saved_on_content(client):
    signup(client, "user@test.local")
    created = client.post(
        "/content", json={"platform": "facebook", "preview": "draft", "status": "draft"}
    ).json()
    res = client.patch(
        f"/content/{created['id']}",
        json={"preview": "แบบสอง", "status": "approved", "selected_variant": 2},
    )
    assert res.status_code == 200
    assert res.json()["selectedVariant"] == 2
    assert client.patch(
        f"/content/{created['id']}", json={"selected_variant": 4}
    ).status_code == 422
