def signup(client, email):
    return client.post(
        "/auth/signup", json={"name": "Test", "email": email, "password": "testpass123"}
    )


# "tiktok" is never seeded by init_db()'s default templates, so it's a safe
# platform for deterministic template-fallback generations (see test_generate.py).
def seed_template(client):
    signup(client, "admin@test.local")
    res = client.post(
        "/admin/prompt-templates",
        json={
            "business_category": None,
            "platform": "tiktok",
            "tone": "friendly",
            "template_text": "เทมเพลตทดสอบ",
        },
    )
    assert res.status_code == 200
    client.cookies.clear()


def as_admin(client):
    client.cookies.clear()
    res = client.post(
        "/auth/login", json={"email": "admin@test.local", "password": "testpass123"}
    )
    assert res.status_code == 200


def test_admin_kpi_reflects_generations_approvals_feedback_and_dna(client):
    seed_template(client)

    # user_a: fills brand DNA completely, generates once, approves it, rates it good
    client.cookies.clear()
    signup(client, "user_a@test.local")
    res = client.put(
        "/brand-dna",
        json={"history": "h", "menu": "m", "usp": "u", "tone": "t"},
    )
    assert res.status_code == 200
    res = client.post(
        "/generate", json={"prompt": "test", "platform": "tiktok", "tone": "friendly"}
    )
    assert res.status_code == 200
    res = client.post(
        "/content",
        json={"platform": "tiktok", "preview": "approved post", "status": "approved", "mode": "idea"},
    )
    assert res.status_code == 200
    content_id = res.json()["id"]
    res = client.patch(f"/content/{content_id}/feedback", json={"feedback": "good"})
    assert res.status_code == 200

    # user_b: leaves brand DNA empty, generates twice, never approves anything
    client.cookies.clear()
    signup(client, "user_b@test.local")
    for _ in range(2):
        res = client.post(
            "/generate", json={"prompt": "test", "platform": "tiktok", "tone": "friendly"}
        )
        assert res.status_code == 200

    as_admin(client)
    res = client.get("/admin/kpi")
    assert res.status_code == 200
    body = res.json()

    idea_row = next(r for r in body["approval_by_mode"] if r["mode"] == "idea")
    assert idea_row["generations"] == 3  # 1 from user_a + 2 from user_b
    assert idea_row["approved"] == 1  # only user_a approved

    feedback_idea = next(r for r in body["feedback_by_mode"] if r["mode"] == "idea")
    assert feedback_idea["good"] == 1
    assert feedback_idea["total_rated"] == 1

    dna_buckets = {r["filled_count"]: r for r in body["dna_completeness"]}
    assert dna_buckets[4]["user_count"] >= 1  # user_a
    assert dna_buckets[4]["total_generations"] >= 1
    assert dna_buckets[4]["total_approved"] >= 1
    assert dna_buckets[0]["user_count"] >= 1  # user_b (and the admin/seed user)

    assert isinstance(body["retained_users"], int)
    assert isinstance(body["active_users"], int)
    assert body["active_users"] >= 1


def test_admin_kpi_requires_admin(client):
    signup(client, "user@test.local")
    res = client.get("/admin/kpi")
    assert res.status_code == 403
