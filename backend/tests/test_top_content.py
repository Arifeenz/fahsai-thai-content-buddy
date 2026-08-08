def signup(client, email, business_category=None):
    res = client.post(
        "/auth/signup", json={"name": "Test", "email": email, "password": "testpass123"}
    )
    assert res.status_code == 200
    if business_category:
        res = client.patch("/me", json={"business_category": business_category})
        assert res.status_code == 200
    return res


def as_admin(client):
    client.cookies.clear()
    res = client.post("/auth/login", json={"email": "admin@test.local", "password": "testpass123"})
    assert res.status_code == 200


def create_posted_content(client):
    res = client.post(
        "/content",
        json={"platform": "facebook", "preview": "test post", "status": "posted"},
    )
    assert res.status_code == 200
    return res.json()["id"]


def test_owner_can_set_post_url(client):
    signup(client, "owner@test.local")
    content_id = create_posted_content(client)
    res = client.patch(
        f"/content/{content_id}/post-url", json={"post_url": "https://facebook.com/post/123"}
    )
    assert res.status_code == 200
    assert res.json()["postUrl"] == "https://facebook.com/post/123"


def test_other_user_cannot_set_post_url(client):
    signup(client, "owner@test.local")
    content_id = create_posted_content(client)
    client.cookies.clear()
    signup(client, "intruder@test.local")
    res = client.patch(
        f"/content/{content_id}/post-url", json={"post_url": "https://evil.example"}
    )
    assert res.status_code == 404


def test_non_admin_cannot_verify_likes(client):
    signup(client, "user@test.local")
    content_id = create_posted_content(client)
    res = client.patch(f"/admin/content/{content_id}/verify", json={"like_count": 5})
    assert res.status_code == 403


def test_admin_can_verify_likes(client):
    signup(client, "admin@test.local")
    client.cookies.clear()
    signup(client, "creator@test.local")
    content_id = create_posted_content(client)

    as_admin(client)
    res = client.patch(f"/admin/content/{content_id}/verify", json={"like_count": 42})
    assert res.status_code == 200
    assert res.json()["verifiedLikeCount"] == 42
    assert res.json()["verifiedAt"] is not None


def test_top_content_for_user_only_includes_verified(client):
    signup(client, "admin@test.local")
    client.cookies.clear()
    signup(client, "creator@test.local")
    content_id = create_posted_content(client)

    res = client.get("/content/top")
    assert res.status_code == 200
    assert res.json()["items"] == []

    as_admin(client)
    res = client.patch(f"/admin/content/{content_id}/verify", json={"like_count": 10})
    assert res.status_code == 200

    client.cookies.clear()
    client.post("/auth/login", json={"email": "creator@test.local", "password": "testpass123"})
    res = client.get("/content/top")
    items = res.json()["items"]
    assert len(items) == 1
    assert items[0]["verifiedLikeCount"] == 10


def test_admin_top_content_by_category(client):
    signup(client, "admin@test.local")
    client.cookies.clear()
    signup(client, "creator@test.local", business_category="streamer")
    content_id = create_posted_content(client)

    as_admin(client)
    res = client.patch(f"/admin/content/{content_id}/verify", json={"like_count": 42})
    assert res.status_code == 200

    res = client.get("/admin/content/top-by-category")
    assert res.status_code == 200
    items = res.json()["items"]
    matched = next(it for it in items if it["id"] == content_id)
    assert matched["owner_category"] == "streamer"
    assert matched["verifiedLikeCount"] == 42


def test_admin_top_growth_by_category_orders_by_growth(client):
    signup(client, "admin@test.local")
    client.cookies.clear()
    signup(client, "grower@test.local", business_category="streamer")
    res = client.post("/follower-snapshot", json={"platform": "facebook", "follower_count": 100})
    assert res.status_code == 200
    res = client.post("/follower-snapshot", json={"platform": "facebook", "follower_count": 150})
    assert res.status_code == 200

    as_admin(client)
    res = client.get("/admin/users/top-growth-by-category")
    assert res.status_code == 200
    items = res.json()["items"]
    matched = next(it for it in items if it["email"] == "grower@test.local")
    assert matched["total_growth"] == 50
    assert matched["business_category"] == "streamer"


def test_top_growth_excludes_single_snapshot_users(client):
    signup(client, "admin@test.local")
    client.cookies.clear()
    signup(client, "onesnap@test.local", business_category="streamer")
    res = client.post("/follower-snapshot", json={"platform": "facebook", "follower_count": 100})
    assert res.status_code == 200

    as_admin(client)
    res = client.get("/admin/users/top-growth-by-category")
    assert res.status_code == 200
    items = res.json()["items"]
    assert not any(it["email"] == "onesnap@test.local" for it in items)
