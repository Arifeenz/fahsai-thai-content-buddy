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
