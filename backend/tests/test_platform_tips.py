def signup(client, email, business_category=None):
    payload = {"name": "Test", "email": email, "password": "testpass123"}
    res = client.post("/auth/signup", json=payload)
    assert res.status_code == 200
    if business_category:
        res = client.patch("/me", json={"business_category": business_category})
        assert res.status_code == 200
    return res


def as_admin(client):
    client.cookies.clear()
    res = client.post("/auth/login", json={"email": "admin@test.local", "password": "testpass123"})
    assert res.status_code == 200


def test_get_platform_tip_returns_seeded_default(client):
    signup(client, "user@test.local")
    res = client.get("/platform-tips", params={"platform": "facebook"})
    assert res.status_code == 200
    body = res.json()
    assert body is not None
    assert body["business_category"] is None
    assert body["caption_tip"]


def test_get_platform_tip_requires_auth(client):
    res = client.get("/platform-tips", params={"platform": "facebook"})
    assert res.status_code == 401


def test_get_platform_tip_rejects_unknown_platform(client):
    signup(client, "user@test.local")
    res = client.get("/platform-tips", params={"platform": "not-a-real-platform"})
    assert res.status_code == 400


def test_get_platform_tip_prefers_category_specific_override(client):
    signup(client, "admin@test.local")
    client.cookies.clear()
    signup(client, "user@test.local", business_category="streamer")

    as_admin(client)
    res = client.post(
        "/admin/platform-tips",
        json={
            "business_category": "streamer",
            "platform": "facebook",
            "caption_tip": "เคล็ดลับเฉพาะสตรีมเมอร์",
        },
    )
    assert res.status_code == 200

    client.cookies.clear()
    client.post("/auth/login", json={"email": "user@test.local", "password": "testpass123"})
    res = client.get("/platform-tips", params={"platform": "facebook"})
    assert res.status_code == 200
    assert res.json()["caption_tip"] == "เคล็ดลับเฉพาะสตรีมเมอร์"


def test_admin_platform_tips_crud(client):
    signup(client, "admin@test.local")
    seeded_count = client.get("/admin/platform-tips").json()["tips"]
    seeded_count = len(seeded_count)

    res = client.post(
        "/admin/platform-tips",
        json={"platform": "facebook", "caption_tip": "ทดสอบ"},
    )
    assert res.status_code == 200
    tip_id = res.json()["id"]

    res = client.get("/admin/platform-tips")
    assert len(res.json()["tips"]) == seeded_count + 1

    res = client.put(
        f"/admin/platform-tips/{tip_id}",
        json={"platform": "facebook", "caption_tip": "แก้ไขแล้ว"},
    )
    assert res.status_code == 200
    assert res.json()["caption_tip"] == "แก้ไขแล้ว"

    res = client.delete(f"/admin/platform-tips/{tip_id}")
    assert res.status_code == 200

    res = client.get("/admin/platform-tips")
    assert len(res.json()["tips"]) == seeded_count


def test_admin_platform_tips_requires_admin(client):
    signup(client, "user@test.local")
    res = client.get("/admin/platform-tips")
    assert res.status_code == 403
    res = client.post("/admin/platform-tips", json={"platform": "facebook"})
    assert res.status_code == 403
