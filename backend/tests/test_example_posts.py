def signup(client, email):
    return client.post(
        "/auth/signup", json={"name": "Test", "email": email, "password": "testpass123"}
    )


def create_personal_example(client):
    res = client.post(
        "/example-posts",
        data={"business_category": "food_beverage", "platform": "facebook", "caption": "original"},
    )
    assert res.status_code == 200
    return res.json()["id"]


def test_owner_can_edit_own_example_post(client):
    signup(client, "owner@test.local")
    post_id = create_personal_example(client)

    res = client.put(
        f"/example-posts/{post_id}",
        data={"business_category": "online_shop", "platform": "instagram", "caption": "edited"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["caption"] == "edited"
    assert body["platform"] == "instagram"


def test_other_user_cannot_edit_personal_example_post(client):
    signup(client, "owner@test.local")
    post_id = create_personal_example(client)

    client.cookies.clear()
    signup(client, "intruder@test.local")
    res = client.put(
        f"/example-posts/{post_id}",
        data={"business_category": "online_shop", "platform": "instagram", "caption": "hacked"},
    )
    assert res.status_code == 404


def test_admin_can_edit_global_example_post(client):
    signup(client, "admin@test.local")
    res = client.post(
        "/admin/example-posts",
        data={"business_category": "food_beverage", "platform": "facebook", "caption": "global original"},
    )
    assert res.status_code == 200
    post_id = res.json()["id"]

    res = client.put(
        f"/admin/example-posts/{post_id}",
        data={"business_category": "online_shop", "platform": "line", "caption": "global edited"},
    )
    assert res.status_code == 200
    assert res.json()["caption"] == "global edited"


def test_admin_cannot_edit_others_personal_example_post(client):
    signup(client, "owner@test.local")
    post_id = create_personal_example(client)

    client.cookies.clear()
    signup(client, "admin@test.local")
    res = client.put(
        f"/admin/example-posts/{post_id}",
        data={"business_category": "online_shop", "platform": "line", "caption": "should not work"},
    )
    assert res.status_code == 404
