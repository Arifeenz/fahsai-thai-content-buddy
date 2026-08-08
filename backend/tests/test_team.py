import db


def signup(client, email):
    return client.post(
        "/auth/signup", json={"name": "Test", "email": email, "password": "testpass123"}
    )


def as_admin(client):
    client.cookies.clear()
    res = client.post("/auth/login", json={"email": "admin@test.local", "password": "testpass123"})
    assert res.status_code == 200


def get_invite_token(email: str) -> str:
    conn = db.get_connection()
    row = conn.execute(
        "SELECT token FROM team_invites WHERE invited_email = %s ORDER BY id DESC LIMIT 1",
        (email,),
    ).fetchone()
    conn.close()
    return row["token"]


def expire_invite(email: str) -> None:
    conn = db.get_connection()
    conn.execute(
        "UPDATE team_invites SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 day' WHERE invited_email = %s",
        (email,),
    )
    conn.commit()
    conn.close()


def add_team_member(owner_id: int, member_id: int, allowed_pages: str = "") -> None:
    conn = db.get_connection()
    conn.execute(
        "INSERT INTO team_members (owner_user_id, member_user_id, allowed_pages) VALUES (%s, %s, %s)",
        (owner_id, member_id, allowed_pages),
    )
    conn.commit()
    conn.close()


def test_owner_can_invite_new_email(client):
    signup(client, "owner@test.local")
    res = client.post(
        "/team/invite",
        json={"email": "newperson@test.local", "allowed_pages": ["create", "examples"]},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["invited_email"] == "newperson@test.local"
    assert body["status"] == "pending"
    assert set(body["allowed_pages"]) == {"create", "examples"}


def test_invite_strips_invalid_page_keys(client):
    signup(client, "owner@test.local")
    res = client.post(
        "/team/invite",
        json={"email": "newperson@test.local", "allowed_pages": ["create", "not-a-real-page"]},
    )
    assert res.status_code == 200
    assert res.json()["allowed_pages"] == ["create"]


def test_cannot_invite_self(client):
    signup(client, "owner@test.local")
    res = client.post("/team/invite", json={"email": "owner@test.local", "allowed_pages": []})
    assert res.status_code == 400


def test_cannot_invite_admin_account(client):
    signup(client, "admin@test.local")
    client.cookies.clear()
    signup(client, "owner@test.local")

    res = client.post("/team/invite", json={"email": "admin@test.local", "allowed_pages": []})
    assert res.status_code == 400


def test_can_invite_existing_empty_account(client):
    signup(client, "empty@test.local")
    client.cookies.clear()
    signup(client, "owner@test.local")

    res = client.post("/team/invite", json={"email": "empty@test.local", "allowed_pages": []})
    assert res.status_code == 200


def test_cannot_invite_account_with_own_content(client):
    signup(client, "busy@test.local")
    res = client.post(
        "/content", json={"platform": "facebook", "preview": "my own post", "status": "draft"}
    )
    assert res.status_code == 200
    client.cookies.clear()

    signup(client, "owner@test.local")
    res = client.post("/team/invite", json={"email": "busy@test.local", "allowed_pages": []})
    assert res.status_code == 400


def test_cannot_double_invite_same_pending_email(client):
    signup(client, "owner@test.local")
    res = client.post(
        "/team/invite", json={"email": "newperson@test.local", "allowed_pages": []}
    )
    assert res.status_code == 200

    res = client.post(
        "/team/invite", json={"email": "newperson@test.local", "allowed_pages": []}
    )
    assert res.status_code == 400


def test_cannot_invite_someone_already_on_another_team(client):
    signup(client, "otherowner@test.local")
    client.cookies.clear()

    signup(client, "taken@test.local")
    client.cookies.clear()

    # seed taken@test.local as already belonging to otherowner's team
    owner_row = db.get_user_by_email("otherowner@test.local")
    member_row = db.get_user_by_email("taken@test.local")
    add_team_member(owner_row["id"], member_row["id"])

    signup(client, "owner@test.local")
    res = client.post("/team/invite", json={"email": "taken@test.local", "allowed_pages": []})
    assert res.status_code == 400


def test_team_size_cap_enforced(client):
    signup(client, "owner@test.local")
    owner_row = db.get_user_by_email("owner@test.local")
    client.cookies.clear()

    signup(client, "member1@test.local")
    member1 = db.get_user_by_email("member1@test.local")
    client.cookies.clear()
    signup(client, "member2@test.local")
    member2 = db.get_user_by_email("member2@test.local")
    client.cookies.clear()

    add_team_member(owner_row["id"], member1["id"])
    add_team_member(owner_row["id"], member2["id"])

    res = client.post(
        "/auth/login", json={"email": "owner@test.local", "password": "testpass123"}
    )
    assert res.status_code == 200

    res = client.post("/team/invite", json={"email": "onemore@test.local", "allowed_pages": []})
    assert res.status_code == 400


def test_team_member_cannot_sub_invite(client):
    signup(client, "owner@test.local")
    owner_row = db.get_user_by_email("owner@test.local")
    client.cookies.clear()

    signup(client, "member@test.local")
    member_row = db.get_user_by_email("member@test.local")
    add_team_member(owner_row["id"], member_row["id"])

    # member@test.local is still logged in from signup
    res = client.post("/team/invite", json={"email": "someone@test.local", "allowed_pages": []})
    assert res.status_code == 400


def test_owner_can_view_team_and_pending_invites(client):
    signup(client, "owner@test.local")
    owner_row = db.get_user_by_email("owner@test.local")
    client.cookies.clear()
    signup(client, "member@test.local")
    member_row = db.get_user_by_email("member@test.local")
    add_team_member(owner_row["id"], member_row["id"], "create,examples")
    client.cookies.clear()

    client.post("/auth/login", json={"email": "owner@test.local", "password": "testpass123"})
    client.post("/team/invite", json={"email": "pending@test.local", "allowed_pages": ["create"]})

    res = client.get("/team")
    assert res.status_code == 200
    body = res.json()
    assert len(body["members"]) == 1
    assert body["members"][0]["member_email"] == "member@test.local"
    assert body["members"][0]["allowed_pages"] == ["create", "examples"]
    assert len(body["invites"]) == 1
    assert body["invites"][0]["invited_email"] == "pending@test.local"


def test_owner_can_revoke_pending_invite(client):
    signup(client, "owner@test.local")
    res = client.post("/team/invite", json={"email": "pending@test.local", "allowed_pages": []})
    invite_id = res.json()["id"]

    res = client.delete(f"/team/invite/{invite_id}")
    assert res.status_code == 200

    res = client.get("/team")
    assert res.json()["invites"] == []


def test_cannot_revoke_someone_elses_invite(client):
    signup(client, "owner@test.local")
    res = client.post("/team/invite", json={"email": "pending@test.local", "allowed_pages": []})
    invite_id = res.json()["id"]
    client.cookies.clear()

    signup(client, "intruder@test.local")
    res = client.delete(f"/team/invite/{invite_id}")
    assert res.status_code == 404


def test_accept_creates_new_account_and_logs_in(client):
    signup(client, "owner@test.local")
    client.post(
        "/team/invite",
        json={"email": "newperson@test.local", "allowed_pages": ["create", "examples"]},
    )
    token = get_invite_token("newperson@test.local")
    client.cookies.clear()

    res = client.post(
        "/team/accept",
        json={"token": token, "name": "New Person", "password": "testpass123"},
    )
    assert res.status_code == 200
    assert res.json()["user"]["email"] == "newperson@test.local"
    assert res.json()["owner_name"] == "Test"

    # accept should have logged the new member straight in
    res = client.get("/auth/me")
    assert res.status_code == 200
    assert res.json()["user"]["email"] == "newperson@test.local"

    # the newly-created member can't manage the team (not the owner) --
    # confirm from the owner's side instead
    client.cookies.clear()
    client.post("/auth/login", json={"email": "owner@test.local", "password": "testpass123"})
    res = client.get("/team")
    assert len(res.json()["members"]) == 1
    assert res.json()["members"][0]["member_email"] == "newperson@test.local"
    assert res.json()["invites"] == []


def test_accept_new_account_requires_name_and_password(client):
    signup(client, "owner@test.local")
    client.post("/team/invite", json={"email": "newperson@test.local", "allowed_pages": []})
    token = get_invite_token("newperson@test.local")
    client.cookies.clear()

    res = client.post("/team/accept", json={"token": token})
    assert res.status_code == 400


def test_accept_existing_empty_account(client):
    signup(client, "empty@test.local")
    client.cookies.clear()
    signup(client, "owner@test.local")
    client.post("/team/invite", json={"email": "empty@test.local", "allowed_pages": []})
    token = get_invite_token("empty@test.local")
    client.cookies.clear()

    res = client.post("/team/accept", json={"token": token})
    assert res.status_code == 200
    assert res.json()["user"]["email"] == "empty@test.local"


def test_accept_invalid_token(client):
    signup(client, "owner@test.local")
    res = client.post("/team/accept", json={"token": "not-a-real-token"})
    assert res.status_code == 400


def test_accept_expired_token(client):
    signup(client, "owner@test.local")
    client.post("/team/invite", json={"email": "newperson@test.local", "allowed_pages": []})
    token = get_invite_token("newperson@test.local")
    expire_invite("newperson@test.local")
    client.cookies.clear()

    res = client.post(
        "/team/accept", json={"token": token, "name": "New Person", "password": "testpass123"}
    )
    assert res.status_code == 400


def test_accept_token_is_single_use(client):
    signup(client, "owner@test.local")
    client.post("/team/invite", json={"email": "newperson@test.local", "allowed_pages": []})
    token = get_invite_token("newperson@test.local")
    client.cookies.clear()

    res = client.post(
        "/team/accept", json={"token": token, "name": "New Person", "password": "testpass123"}
    )
    assert res.status_code == 200
    client.cookies.clear()

    res = client.post(
        "/team/accept", json={"token": token, "name": "New Person", "password": "testpass123"}
    )
    assert res.status_code == 400


def test_accept_fails_when_team_already_full(client):
    signup(client, "owner@test.local")
    owner_row = db.get_user_by_email("owner@test.local")
    client.post("/team/invite", json={"email": "newperson@test.local", "allowed_pages": []})
    token = get_invite_token("newperson@test.local")
    client.cookies.clear()

    # fill the team via two members added directly, simulating the team
    # filling up in the days between the invite being sent and accepted
    signup(client, "member1@test.local")
    member1 = db.get_user_by_email("member1@test.local")
    client.cookies.clear()
    signup(client, "member2@test.local")
    member2 = db.get_user_by_email("member2@test.local")
    client.cookies.clear()
    add_team_member(owner_row["id"], member1["id"])
    add_team_member(owner_row["id"], member2["id"])

    res = client.post(
        "/team/accept", json={"token": token, "name": "New Person", "password": "testpass123"}
    )
    assert res.status_code == 400


def test_invite_info_for_new_email_needs_signup(client):
    signup(client, "owner@test.local")
    client.post("/team/invite", json={"email": "newperson@test.local", "allowed_pages": []})
    token = get_invite_token("newperson@test.local")
    client.cookies.clear()

    res = client.get(f"/team/invite/{token}")
    assert res.status_code == 200
    body = res.json()
    assert body["invited_email"] == "newperson@test.local"
    assert body["owner_name"] == "Test"
    assert body["needs_signup"] is True


def test_invite_info_for_existing_empty_account_does_not_need_signup(client):
    signup(client, "empty@test.local")
    client.cookies.clear()
    signup(client, "owner@test.local")
    client.post("/team/invite", json={"email": "empty@test.local", "allowed_pages": []})
    token = get_invite_token("empty@test.local")
    client.cookies.clear()

    res = client.get(f"/team/invite/{token}")
    assert res.status_code == 200
    assert res.json()["needs_signup"] is False


def test_invite_info_404_for_invalid_token(client):
    res = client.get("/team/invite/not-a-real-token")
    assert res.status_code == 400


def test_auth_me_allowed_pages_null_for_non_member(client):
    signup(client, "owner@test.local")
    res = client.get("/auth/me")
    body = res.json()["user"]
    assert body["allowed_pages"] is None
    assert body["team_owner_name"] is None


def test_auth_me_allowed_pages_for_member(client):
    signup(client, "owner@test.local")
    owner = db.get_user_by_email("owner@test.local")
    client.cookies.clear()
    signup(client, "member@test.local")
    member = db.get_user_by_email("member@test.local")
    add_team_member(owner["id"], member["id"], "create,examples")

    res = client.get("/auth/me")
    body = res.json()["user"]
    assert set(body["allowed_pages"]) == {"create", "examples"}
    assert body["team_owner_name"] == "Test"
