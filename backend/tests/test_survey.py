import db


def signup(client, email):
    return client.post(
        "/auth/signup", json={"name": "Test", "email": email, "password": "testpass123"}
    )


def survey_v2_body(answers=None, **overrides):
    body = {
        "business_category": "food_beverage",
        "used_ai_before": True,
        "minutes_before": 30,
        "minutes_after": 10,
        "answers": answers if answers is not None else [4] * 25,
        "comment": "ใช้ง่ายดีค่ะ",
    }
    body.update(overrides)
    return body


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

    # "submitted" tracks the questionnaire currently open (v2).
    res = client.post("/survey/v2", json=survey_v2_body())
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


def test_admin_summary_v1_tab_computes_mean_sd_and_level(client):
    signup(client, "a@test.local")
    client.post("/survey", json=survey_body(scores=[5] * 10, minutes_before=40, minutes_after=10))
    client.cookies.clear()
    signup(client, "b@test.local")
    client.post(
        "/survey",
        json=survey_body(
            scores=[3] * 10, business_category="streamer", used_ai_before=False,
            minutes_before=20, minutes_after=10,
        ),
    )
    client.cookies.clear()

    signup(client, "admin@test.local")
    res = client.get("/admin/survey/summary")
    assert res.status_code == 200
    v1 = res.json()["v1"]
    assert v1["total"] == 2
    assert v1["used_ai_before_count"] == 1
    assert v1["by_category"] == {"food_beverage": 1, "streamer": 1}
    # Scores 5 and 3 -> mean 4.00, sample S.D. 1.41, "มาก" (3.51-4.50).
    assert v1["items"][0] == {"item": "1", "mean": 4.0, "sd": 1.41, "level": "มาก"}
    ease = next(d for d in v1["dimensions"] if d["key"] == "ease")
    assert ease["items"] == ["1", "2", "3"]
    assert ease["mean"] == 4.0
    assert v1["overall"]["level"] == "มาก"


def test_admin_summary_hides_respondent_identity(client):
    signup(client, "user@test.local")
    client.post("/survey", json=survey_body())
    client.cookies.clear()
    signup(client, "admin@test.local")
    response = client.get("/admin/survey/summary").json()["responses"][0]
    assert "user_id" not in response
    assert "respondent" not in response
    assert "user@test.local" not in str(response)


def test_admin_summary_always_excludes_demo_responses(client):
    client.post("/auth/demo-login", json={"business_category": "food_beverage"})
    client.post("/survey", json=survey_body())
    client.post("/survey/v2", json=survey_v2_body())
    client.cookies.clear()
    signup(client, "admin@test.local")
    data = client.get("/admin/survey/summary").json()
    assert data["v1"]["total"] == 0
    assert data["v2"]["total"] == 0
    assert data["time"]["n"] == 0
    assert data["responses"] == []


def test_admin_cannot_submit_survey(client):
    signup(client, "admin@test.local")
    assert client.post("/survey", json=survey_body()).status_code == 403


# ------------------------------------------------------------- survey v2 --

def test_v1_respondent_is_invited_to_v2_and_can_answer_it_once(client):
    signup(client, "user@test.local")
    assert client.post("/survey", json=survey_body()).status_code == 200
    status = client.get("/survey/me").json()
    assert status["survey_version"] == 2
    assert status["submitted"] is False  # answered v1 only

    assert client.post("/survey/v2", json=survey_v2_body()).status_code == 200
    assert client.get("/survey/me").json()["submitted"] is True
    again = client.post("/survey/v2", json=survey_v2_body())
    assert again.status_code == 409
    assert again.json()["detail"] == "ขอบคุณ ท่านได้ตอบแบบประเมินแล้ว"


def test_v2_validates_answers_and_minutes(client):
    signup(client, "user@test.local")
    assert client.post("/survey/v2", json=survey_v2_body(answers=[4] * 24)).status_code == 422
    assert client.post("/survey/v2", json=survey_v2_body(answers=[6] * 25)).status_code == 422
    assert client.post("/survey/v2", json=survey_v2_body(answers=[0] * 25)).status_code == 422
    assert client.post("/survey/v2", json=survey_v2_body(answers=[4.5] * 25)).status_code == 422
    assert client.post("/survey/v2", json=survey_v2_body(minutes_before=0)).status_code == 422
    assert client.post("/survey/v2", json=survey_v2_body(minutes_after=-5)).status_code == 422
    assert client.post("/survey/v2", json=survey_v2_body()).status_code == 200


def test_demo_account_can_answer_v2_repeatedly_and_is_flagged(client):
    client.post("/auth/demo-login", json={"business_category": "streamer"})
    assert client.post("/survey/v2", json=survey_v2_body()).status_code == 200
    assert client.post("/survey/v2", json=survey_v2_body()).status_code == 200
    rows = db.list_survey_responses(include_demo=True)
    assert len(rows) == 2 and all(r["is_demo"] and r["survey_version"] == 2 for r in rows)


def test_admin_cannot_submit_v2(client):
    signup(client, "admin@test.local")
    assert client.post("/survey/v2", json=survey_v2_body()).status_code == 403


def test_v2_summary_by_item_dimension_and_overall(client):
    signup(client, "a@test.local")
    client.post("/survey/v2", json=survey_v2_body(answers=[5] * 25))
    client.cookies.clear()
    signup(client, "b@test.local")
    client.post("/survey/v2", json=survey_v2_body(answers=[3] * 20 + [4] * 5))
    client.cookies.clear()
    signup(client, "admin@test.local")
    v2 = client.get("/admin/survey/summary").json()["v2"]

    assert v2["total"] == 2
    assert [i["item"] for i in v2["items"][:6]] == ["1.1", "1.2", "1.3", "1.4", "1.5", "2.1"]
    assert v2["items"][0] == {"item": "1.1", "mean": 4.0, "sd": 1.41, "level": "มาก"}
    assert v2["items"][-1] == {"item": "5.5", "mean": 4.5, "sd": 0.71, "level": "มาก"}
    assert v2["dimensions"][0]["label"] == "ด้านที่ 1 การออกแบบหน้าจอ"
    assert v2["dimensions"][4]["items"] == ["5.1", "5.2", "5.3", "5.4", "5.5"]
    assert v2["dimensions"][4]["mean"] == 4.5
    # (25 x 5 + 20 x 3 + 5 x 4) / 50 answers = 4.1
    assert v2["overall"]["mean"] == 4.1


def test_time_summary_pools_both_rounds_counting_each_person_once(client):
    # A answered v1 (40 -> 10) and v2 (30 -> 10): only the v2 answer counts.
    signup(client, "a@test.local")
    client.post("/survey", json=survey_body(minutes_before=40, minutes_after=10))
    client.post("/survey/v2", json=survey_v2_body(minutes_before=30, minutes_after=10))
    client.cookies.clear()
    # B answered v1 only (20 -> 10).
    signup(client, "b@test.local")
    client.post(
        "/survey",
        json=survey_body(business_category="streamer", used_ai_before=False,
                         minutes_before=20, minutes_after=10),
    )
    client.cookies.clear()
    # A demo answer never counts.
    client.post("/auth/demo-login", json={"business_category": "food_beverage"})
    client.post("/survey/v2", json=survey_v2_body(minutes_before=500, minutes_after=1))
    client.cookies.clear()

    signup(client, "admin@test.local")
    time = client.get("/admin/survey/summary").json()["time"]
    assert time["n"] == 2
    assert (time["from_v1"], time["from_v2"]) == (1, 1)
    assert time["minutes_before"] == {"mean": 25.0, "sd": 7.1}
    assert time["minutes_after"] == {"mean": 10.0, "sd": 0.0}
    assert time["reduction_percent"] == 60.0  # (25 - 10) / 25
    assert time["by_category"]["food_beverage"]["n"] == 1
    assert time["by_category"]["food_beverage"]["minutes_before"]["mean"] == 30.0
    assert time["by_category"]["streamer"]["reduction_percent"] == 50.0
    assert time["used_ai_before_count"] == 1


def test_existing_v1_rows_are_version_1_and_keep_their_answers(client):
    signup(client, "user@test.local")
    client.post("/survey", json=survey_body(scores=[2] * 10))
    row = db.list_survey_responses()[0]
    assert row["survey_version"] == 1
    assert [row[f"q{i}"] for i in range(1, 11)] == [2] * 10
    assert row["a1_1"] is None
