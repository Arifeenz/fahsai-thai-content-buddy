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


def test_admin_get_user_detail_includes_content(client):
    signup(client, "admin@test.local")
    client.cookies.clear()

    signup(client, "user@test.local")
    res = client.post(
        "/content",
        json={"platform": "facebook", "preview": "hi", "status": "draft", "mode": "idea"},
    )
    assert res.status_code == 200

    as_admin(client)
    users_res = client.get("/admin/users", params={"search": "user@test.local"})
    target_id = users_res.json()["users"][0]["id"]

    res = client.get(f"/admin/users/{target_id}")
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["email"] == "user@test.local"
    assert body["user"]["is_active"] is True
    assert body["content_count"] == 1
    assert len(body["recent_content"]) == 1
    assert body["recent_content"][0]["preview"] == "hi"


def test_admin_get_user_requires_admin(client):
    signup(client, "user@test.local")
    res = client.get("/admin/users/1")
    assert res.status_code == 403


def test_admin_get_user_404_for_missing_user(client):
    signup(client, "admin@test.local")
    res = client.get("/admin/users/999999")
    assert res.status_code == 404


def test_admin_can_change_role(client):
    signup(client, "admin@test.local")
    client.cookies.clear()
    signup(client, "user@test.local")
    client.cookies.clear()

    as_admin(client)
    users_res = client.get("/admin/users", params={"search": "user@test.local"})
    target_id = users_res.json()["users"][0]["id"]

    res = client.patch(f"/admin/users/{target_id}/role", json={"role": "admin"})
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "admin"

    res = client.patch(f"/admin/users/{target_id}/role", json={"role": "user"})
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "user"


def test_admin_cannot_demote_self(client):
    signup(client, "admin@test.local")
    client.cookies.clear()
    as_admin(client)
    users_res = client.get("/admin/users", params={"search": "admin@test.local"})
    self_id = users_res.json()["users"][0]["id"]

    res = client.patch(f"/admin/users/{self_id}/role", json={"role": "user"})
    assert res.status_code == 400


def test_admin_cannot_suspend_self(client):
    signup(client, "admin@test.local")
    client.cookies.clear()
    as_admin(client)
    users_res = client.get("/admin/users", params={"search": "admin@test.local"})
    self_id = users_res.json()["users"][0]["id"]

    res = client.patch(f"/admin/users/{self_id}/active", json={"is_active": False})
    assert res.status_code == 400


def test_suspended_user_is_blocked_immediately_and_cannot_relogin(client):
    signup(client, "admin@test.local")
    client.cookies.clear()

    signup(client, "user@test.local")
    # capture the still-logged-in target user's own session cookie so we can
    # confirm suspension takes effect mid-session, not just on next login
    target_session = client.cookies.get("fahsai_session")
    res = client.get("/auth/me")
    assert res.status_code == 200

    as_admin(client)
    users_res = client.get("/admin/users", params={"search": "user@test.local"})
    target_id = users_res.json()["users"][0]["id"]
    res = client.patch(f"/admin/users/{target_id}/active", json={"is_active": False})
    assert res.status_code == 200
    assert res.json()["user"]["is_active"] is False

    # the target's original session cookie should now be rejected even though
    # the JWT itself hasn't expired
    client.cookies.clear()
    client.cookies.set("fahsai_session", target_session)
    res = client.get("/auth/me")
    assert res.status_code == 403

    # a fresh login attempt should also be rejected, not just mid-session calls
    client.cookies.clear()
    res = client.post(
        "/auth/login", json={"email": "user@test.local", "password": "testpass123"}
    )
    assert res.status_code == 403

    # re-activating restores access
    as_admin(client)
    res = client.patch(f"/admin/users/{target_id}/active", json={"is_active": True})
    assert res.status_code == 200
    client.cookies.clear()
    res = client.post(
        "/auth/login", json={"email": "user@test.local", "password": "testpass123"}
    )
    assert res.status_code == 200
