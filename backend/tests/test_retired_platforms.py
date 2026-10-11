import io

import db
import main

LINE_REJECTED = "LINE OA ไม่รองรับการสร้างคอนเทนต์ใหม่แล้ว"


def signup(client, email):
    return client.post(
        "/auth/signup", json={"name": "Test", "email": email, "password": "testpass123"}
    )


def user_id(email):
    return db.get_user_by_email(email)["id"]


def assert_line_rejected(res):
    assert res.status_code == 400, res.text
    assert LINE_REJECTED in res.json()["detail"]


def test_generation_endpoints_reject_line(client):
    signup(client, "user@test.local")
    assert_line_rejected(
        client.post("/generate", json={"prompt": "โปรใหม่", "platform": "line", "tone": "friendly"})
    )
    assert_line_rejected(
        client.post(
            "/generate-from-image",
            data={"platform": "line", "tone": "friendly"},
            files={"images": ("p.jpg", io.BytesIO(b"x"), "image/jpeg")},
        )
    )
    assert_line_rejected(
        client.post(
            "/generate-video-script",
            json={"caption": "แคปชัน", "platform": "line", "tone": "friendly"},
        )
    )
    assert_line_rejected(
        client.post("/content", json={"platform": "line", "preview": "x", "status": "draft"})
    )
    assert_line_rejected(
        client.post(
            "/example-posts",
            data={"business_category": "food_beverage", "platform": "line", "caption": "x"},
        )
    )


def test_old_line_content_still_listed_with_its_platform(client):
    signup(client, "user@test.local")
    old = db.create_content_item(user_id("user@test.local"), "line", "โพสต์เก่า LINE", "posted")
    items = client.get("/content").json()["items"]
    assert any(it["id"] == old["id"] and it["platform"] == "line" for it in items)

    client.cookies.clear()
    signup(client, "admin@test.local")
    admin_items = client.get("/admin/content?platform=line").json()["items"]
    assert any(it["id"] == old["id"] for it in admin_items)


def test_user_can_edit_old_line_example_but_not_switch_to_line(client):
    signup(client, "user@test.local")
    uid = user_id("user@test.local")
    old = db.create_example_post(uid, "food_beverage", "line", "ตัวอย่างเก่า", None, uid)

    res = client.put(
        f"/example-posts/{old['id']}",
        data={"business_category": "food_beverage", "platform": "line", "caption": "แก้ข้อความ"},
    )
    assert res.status_code == 200
    assert res.json()["platform"] == "line"

    fb = db.create_example_post(uid, "food_beverage", "facebook", "ตัวอย่าง FB", None, uid)
    assert_line_rejected(
        client.put(
            f"/example-posts/{fb['id']}",
            data={"business_category": "food_beverage", "platform": "line", "caption": "x"},
        )
    )


def test_admin_tools_reject_new_line_rows_but_allow_editing_old_ones(client):
    signup(client, "admin@test.local")
    admin_id = user_id("admin@test.local")

    assert_line_rejected(
        client.post(
            "/admin/prompt-templates",
            json={"business_category": "food_beverage", "platform": "line", "template_text": "x"},
        )
    )
    assert_line_rejected(
        client.post("/admin/platform-tips", json={"platform": "line", "caption_tip": "x"})
    )
    assert_line_rejected(
        client.post(
            "/admin/example-posts",
            data={"business_category": "food_beverage", "platform": "line", "caption": "x"},
        )
    )

    old = db.create_prompt_template("food_beverage", "line", None, "เทมเพลตเก่า", admin_id)
    res = client.put(
        f"/admin/prompt-templates/{old['id']}",
        json={"business_category": "food_beverage", "platform": "line", "template_text": "แก้แล้ว"},
    )
    assert res.status_code == 200

    fb = db.create_prompt_template("food_beverage", "facebook", None, "เทมเพลต FB", admin_id)
    assert_line_rejected(
        client.put(
            f"/admin/prompt-templates/{fb['id']}",
            json={"business_category": "food_beverage", "platform": "line", "template_text": "x"},
        )
    )


def test_fallback_widening_never_picks_a_line_template(client, monkeypatch):
    monkeypatch.setattr(main, "openai_client", None)  # forces the template fallback
    signup(client, "user@test.local")
    client.patch("/me", json={"business_category": "fortune_telling"})

    # Leave fortune_telling with only a LINE template, nothing for TikTok.
    conn = db.get_connection()
    conn.execute("DELETE FROM prompt_templates WHERE business_category = 'fortune_telling'")
    conn.commit()
    conn.close()
    db.create_prompt_template("fortune_telling", "line", None, "พิมพ์ 'จองคิว' เพื่อนัดเวลา", None)

    res = client.post(
        "/generate", json={"prompt": "ดวงสัปดาห์นี้", "platform": "tiktok", "tone": "friendly"}
    )
    assert res.status_code == 404  # nothing usable -- not the LINE template

    db.create_prompt_template("fortune_telling", "facebook", None, "เทมเพลต FB ดูดวง", None)
    res = client.post(
        "/generate", json={"prompt": "ดวงสัปดาห์นี้", "platform": "tiktok", "tone": "friendly"}
    )
    assert res.status_code == 200
    assert res.json()["caption"] == "เทมเพลต FB ดูดวง"


def test_fresh_seed_has_no_line_and_covers_tiktok_youtube_for_every_category(client):
    conn = db.get_connection()
    rows = conn.execute(
        "SELECT business_category, platform, COUNT(*) AS n FROM prompt_templates"
        " GROUP BY business_category, platform"
    ).fetchall()
    tips = conn.execute("SELECT platform FROM platform_tips").fetchall()
    conn.close()
    pairs = {(r["business_category"], r["platform"]): r["n"] for r in rows}

    assert not any(platform == "line" for _, platform in pairs)
    assert not any(t["platform"] == "line" for t in tips)
    for category in ("food_beverage", "online_shop", "fortune_telling", "streamer"):
        for platform in ("facebook", "instagram", "tiktok", "youtube"):
            assert pairs.get((category, platform), 0) >= 3, (category, platform)
