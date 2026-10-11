import db


def demo_login(client, category):
    return client.post("/auth/demo-login", json={"business_category": category})


def test_every_category_has_a_working_demo_login(client):
    for category, info in db.DEMO_ACCOUNTS.items():
        client.cookies.clear()
        res = demo_login(client, category)
        assert res.status_code == 200, category
        assert res.json()["user"]["email"] == info["email"]


def test_demo_account_cannot_change_business_category(client):
    demo_login(client, "streamer")
    res = client.patch("/me", json={"business_category": "online_shop"})
    assert res.status_code == 403
    assert client.get("/auth/me").json()["user"]["business_category"] == "streamer"


def test_regular_user_can_still_change_business_category(client):
    client.post(
        "/auth/signup", json={"name": "Test", "email": "u@test.local", "password": "testpass123"}
    )
    res = client.patch("/me", json={"business_category": "streamer"})
    assert res.status_code == 200
    assert res.json()["user"]["business_category"] == "streamer"


def test_startup_repairs_a_demo_whose_category_was_changed(client):
    # Reproduces production: the streamer demo got switched to online_shop,
    # so the streamer button 404'd and two demos shared online_shop.
    conn = db.get_connection()
    conn.execute(
        "UPDATE users SET business_category = 'online_shop' WHERE email = %s",
        (db.DEMO_ACCOUNTS["streamer"]["email"],),
    )
    conn.commit()
    conn.close()

    # Lookup by email means both buttons already land on the right account...
    assert demo_login(client, "streamer").json()["user"]["email"] == (
        db.DEMO_ACCOUNTS["streamer"]["email"]
    )
    client.cookies.clear()
    assert demo_login(client, "online_shop").json()["user"]["email"] == (
        db.DEMO_ACCOUNTS["online_shop"]["email"]
    )

    # ...and the next startup puts the category back.
    db.ensure_demo_users()
    client.cookies.clear()
    demo_login(client, "streamer")
    assert client.get("/auth/me").json()["user"]["business_category"] == "streamer"


def test_admin_reset_restores_demo_dna_without_deleting_content(client):
    info = db.DEMO_ACCOUNTS["online_shop"]
    demo_login(client, "online_shop")
    # A visitor rewrites the shop and creates some content on the shared account.
    client.put("/brand-dna", json={**info["dna"], "menu": "ผ้าตัดชุด", "audience": "คนหาชุดไปงานแต่ง"})
    created = client.post(
        "/content", json={"platform": "facebook", "preview": "โพสต์ของผู้ทดลอง", "status": "draft"}
    ).json()
    assert client.get("/brand-dna").json()["menu"] == "ผ้าตัดชุด"

    client.cookies.clear()
    client.post(
        "/auth/signup", json={"name": "A", "email": "admin@test.local", "password": "testpass123"}
    )
    res = client.post("/admin/demo-accounts/online_shop/reset")
    assert res.status_code == 200
    assert res.json()["user"]["business_category"] == "online_shop"

    client.cookies.clear()
    demo_login(client, "online_shop")
    assert client.get("/brand-dna").json() == info["dna"]
    items = client.get("/content").json()["items"]
    assert any(it["id"] == created["id"] for it in items)  # content kept


def test_demo_reset_is_admin_only_and_knows_categories(client):
    client.post(
        "/auth/signup", json={"name": "U", "email": "u@test.local", "password": "testpass123"}
    )
    assert client.post("/admin/demo-accounts/online_shop/reset").status_code == 403

    client.cookies.clear()
    client.post(
        "/auth/signup", json={"name": "A", "email": "admin@test.local", "password": "testpass123"}
    )
    assert client.post("/admin/demo-accounts/not_a_category/reset").status_code == 404
