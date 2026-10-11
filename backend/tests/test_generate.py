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


def angle_of(call_kwargs):
    system = call_kwargs["messages"][0]["content"]
    keys = [key for key, _, instruction in main.CAPTION_ANGLES if instruction in system]
    assert len(keys) == 1, "each call must carry exactly one angle instruction"
    return keys[0]


def reply_per_angle(replies):
    """Mock side_effect answering by angle -- calls run in parallel, so
    call order can't be used to tell them apart."""

    def create(**kwargs):
        return SimpleNamespace(
            choices=[replies[angle_of(kwargs)]],
            usage=SimpleNamespace(prompt_tokens=100, completion_tokens=50),
        )

    return create


def test_generate_writes_one_variant_per_storytelling_angle(client, monkeypatch):
    signup(client, "user@test.local")
    fake_client = MagicMock()
    fake_client.chat.completions.create.side_effect = reply_per_angle(
        {
            "story": fake_json_choice("แบบเล่าเรื่อง", "prompt story"),
            "direct": fake_json_choice("แบบตรงประเด็น", "prompt direct"),
            "conversation": fake_json_choice("แบบชวนคุย", "prompt conversation"),
        }
    )
    monkeypatch.setattr(main, "openai_client", fake_client)

    res = client.post(
        "/generate", json={"prompt": "เมนูใหม่", "platform": "facebook", "tone": "friendly"}
    )
    assert res.status_code == 200
    body = res.json()
    # Variants come back in CAPTION_ANGLES order, labelled for the tabs.
    assert [v["caption"] for v in body["variants"]] == ["แบบเล่าเรื่อง", "แบบตรงประเด็น", "แบบชวนคุย"]
    assert [v["angle_label"] for v in body["variants"]] == ["เล่าเรื่อง", "ตรงประเด็น", "ชวนคุย"]
    assert [v["image_prompt"] for v in body["variants"]] == [
        "prompt story",
        "prompt direct",
        "prompt conversation",
    ]
    assert body["caption"] == "แบบเล่าเรื่อง"

    # One call per angle, each with a different angle instruction.
    calls = fake_client.chat.completions.create.call_args_list
    assert sorted(angle_of(c.kwargs) for c in calls) == ["conversation", "direct", "story"]
    assert all("n" not in c.kwargs for c in calls)

    # Still one log row per request, with token usage summed over the calls.
    logs = [log for log in main.list_generation_logs() if log["mode"] == "idea"]
    assert len(logs) == 1
    assert "--- ชวนคุย ---" in logs[0]["caption"]
    assert logs[0]["prompt_tokens"] == 300
    assert logs[0]["completion_tokens"] == 150

    items = client.get("/content").json()["items"]
    assert any(it["id"] == body["content_id"] and it["preview"] == "แบบเล่าเรื่อง" for it in items)


def test_generate_drops_an_angle_that_fails_or_cannot_be_parsed(client, monkeypatch):
    signup(client, "user@test.local")
    fake_client = MagicMock()
    broken = SimpleNamespace(message=SimpleNamespace(content='{"caption": "ถูกตัดกลาง'))

    def create(**kwargs):
        angle = angle_of(kwargs)
        if angle == "conversation":
            raise TimeoutError("one angle timed out")
        return SimpleNamespace(
            choices=[fake_json_choice("ใช้ได้") if angle == "direct" else broken],
            usage=SimpleNamespace(prompt_tokens=100, completion_tokens=50),
        )

    fake_client.chat.completions.create.side_effect = create
    monkeypatch.setattr(main, "openai_client", fake_client)

    res = client.post(
        "/generate", json={"prompt": "เมนูใหม่", "platform": "facebook", "tone": "friendly"}
    )
    assert res.status_code == 200
    assert [v["caption"] for v in res.json()["variants"]] == ["ใช้ได้"]


def test_generate_fails_only_when_every_angle_fails(client, monkeypatch):
    signup(client, "user@test.local")
    fake_client = MagicMock()
    fake_client.chat.completions.create.side_effect = TimeoutError("OpenAI down")
    monkeypatch.setattr(main, "openai_client", fake_client)

    res = client.post(
        "/generate", json={"prompt": "เมนูใหม่", "platform": "facebook", "tone": "friendly"}
    )
    assert res.status_code == 502


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
