import db


def signup(client, email):
    return client.post(
        "/auth/signup", json={"name": "Test", "email": email, "password": "testpass123"}
    )


def as_admin(client):
    client.cookies.clear()
    res = client.post(
        "/auth/login", json={"email": "admin@test.local", "password": "testpass123"}
    )
    assert res.status_code == 200


def create_posted_content(client, days_ago: int = 0):
    res = client.post(
        "/content",
        json={"platform": "facebook", "preview": "test post", "status": "posted"},
    )
    assert res.status_code == 200
    content_id = res.json()["id"]
    if days_ago:
        conn = db.get_connection()
        conn.execute(
            "UPDATE content_items SET created_at = created_at - make_interval(days => %s) WHERE id = %s",
            (days_ago, content_id),
        )
        conn.commit()
        conn.close()
    return content_id


def test_admin_can_crud_quotes(client):
    signup(client, "admin@test.local")

    res = client.post("/admin/quotes", json={"text": "สู้ๆนะคะ", "mood": "general"})
    assert res.status_code == 200
    quote_id = res.json()["id"]
    assert res.json()["mood"] == "general"

    res = client.get("/admin/quotes")
    assert res.status_code == 200
    assert any(q["id"] == quote_id for q in res.json()["quotes"])

    res = client.put(
        f"/admin/quotes/{quote_id}", json={"text": "สู้ๆนะคะ แก้ไขแล้ว", "mood": "celebration"}
    )
    assert res.status_code == 200
    assert res.json()["text"] == "สู้ๆนะคะ แก้ไขแล้ว"
    assert res.json()["mood"] == "celebration"

    res = client.delete(f"/admin/quotes/{quote_id}")
    assert res.status_code == 200
    res = client.get("/admin/quotes")
    assert not any(q["id"] == quote_id for q in res.json()["quotes"])


def test_non_admin_cannot_access_quotes(client):
    signup(client, "user@test.local")
    res = client.get("/admin/quotes")
    assert res.status_code == 403
    res = client.post("/admin/quotes", json={"text": "x", "mood": "general"})
    assert res.status_code == 403


def test_daily_quote_null_when_no_quotes_exist(client):
    signup(client, "user@test.local")
    res = client.get("/quotes/daily")
    assert res.status_code == 200
    assert res.json()["text"] is None


def test_daily_quote_general_for_neutral_user(client):
    signup(client, "admin@test.local")
    client.post("/admin/quotes", json={"text": "ทั่วไป-ok", "mood": "general"})
    client.cookies.clear()

    signup(client, "user@test.local")
    res = client.get("/quotes/daily")
    assert res.status_code == 200
    assert res.json()["text"] == "ทั่วไป-ok"


def test_daily_quote_discouraged_when_no_recent_post(client):
    signup(client, "admin@test.local")
    client.post("/admin/quotes", json={"text": "ไม่เป็นไรค่ะ", "mood": "discouraged"})
    client.post("/admin/quotes", json={"text": "ทั่วไป-ok", "mood": "general"})
    client.cookies.clear()

    signup(client, "user@test.local")
    create_posted_content(client, days_ago=10)
    res = client.get("/quotes/daily")
    assert res.status_code == 200
    assert res.json()["text"] == "ไม่เป็นไรค่ะ"


def test_daily_quote_celebration_when_good_feedback(client):
    signup(client, "admin@test.local")
    client.post("/admin/quotes", json={"text": "เก่งมากค่ะ", "mood": "celebration"})
    client.cookies.clear()

    signup(client, "user@test.local")
    for _ in range(3):
        content_id = create_posted_content(client)
        client.patch(f"/content/{content_id}/feedback", json={"feedback": "good"})
    res = client.get("/quotes/daily")
    assert res.status_code == 200
    assert res.json()["text"] == "เก่งมากค่ะ"


def test_daily_quote_falls_back_to_general_when_mood_untagged(client):
    signup(client, "admin@test.local")
    client.post("/admin/quotes", json={"text": "ทั่วไปเท่านั้น", "mood": "general"})
    client.cookies.clear()

    signup(client, "user@test.local")
    create_posted_content(client, days_ago=10)
    res = client.get("/quotes/daily")
    assert res.status_code == 200
    assert res.json()["text"] == "ทั่วไปเท่านั้น"
