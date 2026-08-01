def signup(client, email):
    return client.post(
        "/auth/signup", json={"name": "Test", "email": email, "password": "testpass123"}
    )


def create_posted_content(client):
    res = client.post(
        "/content",
        json={"platform": "facebook", "preview": "test post", "status": "posted"},
    )
    assert res.status_code == 200
    return res.json()["id"]


def test_created_content_appears_in_list(client):
    signup(client, "owner@test.local")
    content_id = create_posted_content(client)
    res = client.get("/content")
    assert res.status_code == 200
    items = res.json()["items"]
    assert any(it["id"] == content_id for it in items)


def test_owner_can_set_feedback(client):
    signup(client, "owner@test.local")
    content_id = create_posted_content(client)
    res = client.patch(f"/content/{content_id}/feedback", json={"feedback": "good"})
    assert res.status_code == 200
    assert res.json()["feedback"] == "good"

    res = client.get("/content")
    items = res.json()["items"]
    matched = next(it for it in items if it["id"] == content_id)
    assert matched["feedback"] == "good"


def test_other_user_cannot_set_feedback(client):
    signup(client, "owner@test.local")
    content_id = create_posted_content(client)

    client.cookies.clear()
    signup(client, "intruder@test.local")
    res = client.patch(f"/content/{content_id}/feedback", json={"feedback": "bad"})
    assert res.status_code == 404


def test_invalid_feedback_value_rejected(client):
    signup(client, "owner@test.local")
    content_id = create_posted_content(client)
    res = client.patch(f"/content/{content_id}/feedback", json={"feedback": "amazing"})
    assert res.status_code == 422
