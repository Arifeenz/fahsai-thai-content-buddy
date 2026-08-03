def signup(client, email):
    return client.post(
        "/auth/signup", json={"name": "Test", "email": email, "password": "testpass123"}
    )


def test_create_and_list_follower_snapshot(client):
    signup(client, "owner@test.local")

    res = client.post(
        "/follower-snapshot", json={"platform": "facebook", "follower_count": 120}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["platform"] == "facebook"
    assert body["follower_count"] == 120

    res = client.get("/follower-snapshot")
    assert res.status_code == 200
    snapshots = res.json()["snapshots"]
    assert len(snapshots) == 1
    assert snapshots[0]["follower_count"] == 120


def test_snapshots_ordered_oldest_first_and_scoped_per_user(client):
    signup(client, "owner@test.local")
    client.post("/follower-snapshot", json={"platform": "facebook", "follower_count": 100})
    client.post("/follower-snapshot", json={"platform": "facebook", "follower_count": 150})

    res = client.get("/follower-snapshot")
    counts = [s["follower_count"] for s in res.json()["snapshots"]]
    assert counts == [100, 150]

    client.cookies.clear()
    signup(client, "other@test.local")
    res = client.get("/follower-snapshot")
    assert res.json()["snapshots"] == []


def test_follower_snapshot_requires_auth(client):
    res = client.post(
        "/follower-snapshot", json={"platform": "facebook", "follower_count": 10}
    )
    assert res.status_code == 401
