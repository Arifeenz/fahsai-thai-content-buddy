def signup(client, email="user@test.local", password="testpass123", name="Test User"):
    return client.post(
        "/auth/signup", json={"name": name, "email": email, "password": password}
    )


def test_signup_creates_user_and_sets_cookie(client):
    res = signup(client)
    assert res.status_code == 200
    body = res.json()["user"]
    assert body["email"] == "user@test.local"
    assert body["role"] == "user"
    assert "fahsai_session" in res.cookies


def test_signup_duplicate_email_rejected(client):
    signup(client)
    res = signup(client)
    assert res.status_code == 409


def test_login_wrong_password_rejected(client):
    signup(client)
    res = client.post(
        "/auth/login", json={"email": "user@test.local", "password": "wrongpass"}
    )
    assert res.status_code == 401


def test_login_unknown_email_rejected(client):
    res = client.post(
        "/auth/login", json={"email": "nobody@test.local", "password": "testpass123"}
    )
    assert res.status_code == 401


def test_me_requires_auth(client):
    res = client.get("/auth/me")
    assert res.status_code == 401


def test_me_returns_current_user(client):
    signup(client)
    res = client.get("/auth/me")
    assert res.status_code == 200
    assert res.json()["user"]["email"] == "user@test.local"
