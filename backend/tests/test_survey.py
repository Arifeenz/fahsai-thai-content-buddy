import db


def signup(client, email):
    return client.post(
        "/auth/signup", json={"name": "Test", "email": email, "password": "testpass123"}
    )


def survey_body(scores=None, **overrides):
    body = {
        "business_category": "food_beverage",
        "used_ai_before": True,
        "minutes_before": 30,
        "minutes_after": 10,
        "scores": scores if scores is not None else [5, 4, 5, 4, 4, 3, 5, 5, 4, 5],
        "comment": "ใช้ง่ายดีค่ะ",
    }
    body.update(overrides)
    return body


def test_survey_status_before_and_after_submitting(client):
    signup(client, "user@test.local")
    res = client.get("/survey/me")
    assert res.status_code == 200
    assert res.json()["submitted"] is False

    res = client.post("/survey", json=survey_body())
    assert res.status_code == 200

    assert client.get("/survey/me").json()["submitted"] is True


def test_survey_requires_login(client):
    assert client.get("/survey/me").status_code == 401
    assert client.post("/survey", json=survey_body()).status_code == 401


def test_real_user_cannot_submit_twice(client):
    signup(client, "user@test.local")
    assert client.post("/survey", json=survey_body()).status_code == 200
    res = client.post("/survey", json=survey_body())
    assert res.status_code == 409


def test_demo_account_can_be_submitted_by_several_visitors(client):
    res = client.post("/auth/demo-login", json={"business_category": "food_beverage"})
    assert res.status_code == 200
    assert client.post("/survey", json=survey_body()).status_code == 200
    assert client.post("/survey", json=survey_body()).status_code == 200
    assert client.get("/survey/me").json()["submitted"] is False


def test_survey_rejects_out_of_range_scores(client):
    signup(client, "user@test.local")
    assert client.post("/survey", json=survey_body(scores=[6] * 10)).status_code == 422
    assert client.post("/survey", json=survey_body(scores=[0] * 10)).status_code == 422
    assert client.post("/survey", json=survey_body(scores=[5] * 9)).status_code == 422


def test_other_category_requires_description(client):
    signup(client, "user@test.local")
    res = client.post("/survey", json=survey_body(business_category="other"))
    assert res.status_code == 400
    res = client.post(
        "/survey",
        json=survey_body(business_category="other", business_category_other="ร้านดอกไม้"),
    )
    assert res.status_code == 200


def test_generation_count_reflects_generation_log(client):
    signup(client, "user@test.local")
    user = db.get_user_by_email("user@test.local")
    for _ in range(3):
        db.create_generation_log(user["id"], "facebook", None, "prompt", "caption")
    assert client.get("/survey/me").json()["generation_count"] == 3


def test_non_admin_cannot_read_summary(client):
    signup(client, "user@test.local")
    assert client.get("/admin/survey/summary").status_code == 403


def test_admin_summary_computes_mean_sd_and_level(client):
    signup(client, "a@test.local")
    client.post(
        "/survey", json=survey_body(scores=[5] * 10, minutes_before=40, minutes_after=10)
    )
    client.cookies.clear()
    signup(client, "b@test.local")
    client.post(
        "/survey",
        json=survey_body(
            scores=[3] * 10,
            business_category="streamer",
            used_ai_before=False,
            minutes_before=20,
            minutes_after=10,
        ),
    )
    client.cookies.clear()

    signup(client, "admin@test.local")
    res = client.get("/admin/survey/summary")
    assert res.status_code == 200
    data = res.json()

    assert data["total"] == 2
    assert data["used_ai_before_count"] == 1
    assert data["by_category"] == {"food_beverage": 1, "streamer": 1}
    assert data["time"] == {
        "mean_minutes_before": 30.0,
        "mean_minutes_after": 10.0,
        "reduction_percent": 66.7,
    }
    # Scores 5 and 3 -> mean 4.00, sample S.D. 1.41, "มาก" (3.51-4.50).
    assert data["items"][0] == {"item": 1, "mean": 4.0, "sd": 1.41, "level": "มาก"}
    ease = next(d for d in data["dimensions"] if d["key"] == "ease")
    assert ease["items"] == [1, 2, 3]
    assert ease["mean"] == 4.0
    assert data["overall"]["mean"] == 4.0
    assert data["overall"]["level"] == "มาก"


def test_admin_summary_hides_respondent_identity(client):
    signup(client, "user@test.local")
    client.post("/survey", json=survey_body())
    client.cookies.clear()
    signup(client, "admin@test.local")
    response = client.get("/admin/survey/summary").json()["responses"][0]
    assert "user_id" not in response
    assert "user@test.local" not in str(response)


def test_admin_summary_can_exclude_demo_responses(client):
    client.post("/auth/demo-login", json={"business_category": "food_beverage"})
    client.post("/survey", json=survey_body())
    client.cookies.clear()
    signup(client, "admin@test.local")
    assert client.get("/admin/survey/summary").json()["demo_count"] == 1
    res = client.get("/admin/survey/summary?include_demo=false").json()
    assert res["total"] == 0
    assert res["overall"]["mean"] is None


def test_admin_cannot_submit_survey(client):
    signup(client, "admin@test.local")
    assert client.post("/survey", json=survey_body()).status_code == 403
