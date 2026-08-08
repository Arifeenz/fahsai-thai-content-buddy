import json
from types import SimpleNamespace
from unittest.mock import MagicMock

import db
import main


def signup(client, email):
    res = client.post(
        "/auth/signup", json={"name": "Test", "email": email, "password": "testpass123"}
    )
    assert res.status_code == 200
    return res


def login(client, email):
    client.cookies.clear()
    res = client.post("/auth/login", json={"email": email, "password": "testpass123"})
    assert res.status_code == 200
    return res


def add_team_member(owner_id: int, member_id: int, allowed_pages: str = "") -> None:
    conn = db.get_connection()
    conn.execute(
        "INSERT INTO team_members (owner_user_id, member_user_id, allowed_pages) VALUES (%s, %s, %s)",
        (owner_id, member_id, allowed_pages),
    )
    conn.commit()
    conn.close()


def make_owner_and_member(client, allowed_pages: str = ""):
    """Creates owner@test.local + member@test.local, links them as a team,
    and leaves the member logged in. Returns (owner_row, member_row)."""
    signup(client, "owner@test.local")
    owner = db.get_user_by_email("owner@test.local")
    client.cookies.clear()

    signup(client, "member@test.local")
    member = db.get_user_by_email("member@test.local")
    add_team_member(owner["id"], member["id"], allowed_pages)
    # member@test.local is already logged in from signup
    return owner, member


def fake_openai(content: dict | str):
    payload = content if isinstance(content, str) else json.dumps(content)
    fake_response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=payload))],
        usage=SimpleNamespace(prompt_tokens=100, completion_tokens=50),
    )
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = fake_response
    return fake_client


# ---------------------------------------------------------------------------
# /generate uses the owner's shop data, not the member's own blank account
# ---------------------------------------------------------------------------


def test_member_without_create_access_is_blocked_from_generate(client):
    make_owner_and_member(client, allowed_pages="examples")
    res = client.post(
        "/generate", json={"prompt": "โปรลด 20%", "platform": "facebook", "tone": "friendly"}
    )
    assert res.status_code == 403


def test_member_with_create_access_can_generate(client, monkeypatch):
    owner, member = make_owner_and_member(client, allowed_pages="create")
    monkeypatch.setattr(
        main, "openai_client", fake_openai({"caption": "แคปชั่นทดสอบ", "image_prompt": "test"})
    )

    res = client.post(
        "/generate", json={"prompt": "โปรลด 20%", "platform": "facebook", "tone": "friendly"}
    )
    assert res.status_code == 200


def test_generate_by_member_uses_owners_brand_dna_and_category(client, monkeypatch):
    owner, member = make_owner_and_member(client, allowed_pages="create")

    login(client, "owner@test.local")
    client.patch("/me", json={"business_category": "streamer"})
    client.put(
        "/brand-dna",
        json={
            "history": "",
            "menu": "",
            "usp": "จุดขายเฉพาะร้าน owner",
            "tone": "",
            "audience": "",
        },
    )
    login(client, "member@test.local")

    fake_client = fake_openai({"caption": "แคปชั่นทดสอบ", "image_prompt": "test"})
    monkeypatch.setattr(main, "openai_client", fake_client)

    res = client.post(
        "/generate", json={"prompt": "โปรลด 20%", "platform": "facebook", "tone": "friendly"}
    )
    assert res.status_code == 200
    system_prompt = fake_client.chat.completions.create.call_args.kwargs["messages"][0]["content"]
    assert "จุดขายเฉพาะร้าน owner" in system_prompt
    assert "สตรีมเมอร์" in system_prompt


def test_generate_by_member_saves_content_under_owner(client, monkeypatch):
    owner, member = make_owner_and_member(client, allowed_pages="create")
    monkeypatch.setattr(
        main, "openai_client", fake_openai({"caption": "แคปชั่นทดสอบ", "image_prompt": "test"})
    )

    res = client.post(
        "/generate", json={"prompt": "โปรลด 20%", "platform": "facebook", "tone": "friendly"}
    )
    assert res.status_code == 200

    conn = db.get_connection()
    row = conn.execute(
        "SELECT user_id FROM content_items WHERE preview = %s", ("แคปชั่นทดสอบ",)
    ).fetchone()
    conn.close()
    assert row["user_id"] == owner["id"]


# ---------------------------------------------------------------------------
# /content (library/schedule) is gated and owner-scoped
# ---------------------------------------------------------------------------


def test_member_without_content_pages_blocked_from_content_list(client):
    make_owner_and_member(client, allowed_pages="brand-dna")
    res = client.get("/content")
    assert res.status_code == 403


def test_member_with_library_access_sees_owners_content(client):
    owner, member = make_owner_and_member(client, allowed_pages="library")

    login(client, "owner@test.local")
    res = client.post(
        "/content", json={"platform": "facebook", "preview": "owner's post", "status": "draft"}
    )
    assert res.status_code == 200
    login(client, "member@test.local")

    res = client.get("/content")
    assert res.status_code == 200
    items = res.json()["items"]
    assert any(it["preview"] == "owner's post" for it in items)


def test_member_with_schedule_access_can_use_content_endpoints(client):
    make_owner_and_member(client, allowed_pages="schedule")
    res = client.get("/content")
    assert res.status_code == 200


# ---------------------------------------------------------------------------
# /example-posts is gated and owner-scoped
# ---------------------------------------------------------------------------


def test_member_without_examples_access_blocked(client):
    make_owner_and_member(client, allowed_pages="create")
    res = client.get("/example-posts")
    assert res.status_code == 403


def test_member_with_examples_access_creates_under_owner(client):
    owner, member = make_owner_and_member(client, allowed_pages="examples")

    res = client.post(
        "/example-posts",
        data={
            "business_category": "food_beverage",
            "platform": "facebook",
            "caption": "ตัวอย่างจากทีมงาน",
        },
    )
    assert res.status_code == 200

    conn = db.get_connection()
    row = conn.execute(
        "SELECT user_id FROM example_posts WHERE caption = %s", ("ตัวอย่างจากทีมงาน",)
    ).fetchone()
    conn.close()
    assert row["user_id"] == owner["id"]

    login(client, "owner@test.local")
    res = client.get("/example-posts")
    assert any(p["caption"] == "ตัวอย่างจากทีมงาน" for p in res.json()["posts"])


# ---------------------------------------------------------------------------
# /brand-dna and /social-links are gated and owner-scoped
# ---------------------------------------------------------------------------


def test_member_without_branddna_access_blocked(client):
    make_owner_and_member(client, allowed_pages="create")
    res = client.get("/brand-dna")
    assert res.status_code == 403
    res = client.put(
        "/brand-dna",
        json={"history": "x", "menu": "", "usp": "", "tone": "", "audience": ""},
    )
    assert res.status_code == 403


def test_member_with_branddna_access_edits_owners_dna(client):
    owner, member = make_owner_and_member(client, allowed_pages="brand-dna")

    res = client.put(
        "/brand-dna",
        json={
            "history": "เขียนโดยทีมงาน",
            "menu": "",
            "usp": "",
            "tone": "",
            "audience": "",
        },
    )
    assert res.status_code == 200

    login(client, "owner@test.local")
    res = client.get("/brand-dna")
    assert res.json()["history"] == "เขียนโดยทีมงาน"


# ---------------------------------------------------------------------------
# /auth/me blends owner's shop-level fields into a member's own profile
# ---------------------------------------------------------------------------


def test_auth_me_shows_owners_business_category_to_member(client):
    owner, member = make_owner_and_member(client, allowed_pages="create")

    login(client, "owner@test.local")
    client.patch("/me", json={"business_category": "online_shop"})
    login(client, "member@test.local")

    res = client.get("/auth/me")
    assert res.status_code == 200
    body = res.json()["user"]
    assert body["business_category"] == "online_shop"
    assert body["email"] == "member@test.local"
    assert body["name"] == "Test"


def test_example_selection_mode_change_by_member_affects_owners_generation(client):
    owner, member = make_owner_and_member(client, allowed_pages="create")

    res = client.patch("/me/example-selection-mode", json={"example_selection_mode": "rating"})
    assert res.status_code == 200
    assert res.json()["user"]["example_selection_mode"] == "rating"

    login(client, "owner@test.local")
    res = client.get("/auth/me")
    assert res.json()["user"]["example_selection_mode"] == "rating"


# ---------------------------------------------------------------------------
# Owners themselves are never restricted (they're not anyone's team member)
# ---------------------------------------------------------------------------


def test_owner_unaffected_by_page_restrictions(client):
    signup(client, "owner@test.local")
    res = client.get("/content")
    assert res.status_code == 200
    res = client.get("/example-posts")
    assert res.status_code == 200
    res = client.get("/brand-dna")
    assert res.status_code == 200
