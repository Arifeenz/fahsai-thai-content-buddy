import io
import json
from types import SimpleNamespace
from unittest.mock import MagicMock

from PIL import Image

import main


def signup(client, email):
    return client.post(
        "/auth/signup", json={"name": "Test", "email": email, "password": "testpass123"}
    )


def fake_image_file():
    # A real, PIL-decodable JPEG -- unlike other tests in this suite, the
    # extract endpoint validates by actually trying to decode the bytes
    # (see resize_and_compress_image), so plain placeholder bytes won't do.
    buf = io.BytesIO()
    Image.new("RGB", (20, 20), color="blue").save(buf, format="JPEG")
    buf.seek(0)
    return {"image": ("screenshot.jpg", buf, "image/jpeg")}


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


def test_owner_can_rate_own_example_post(client):
    signup(client, "owner@test.local")
    post_id = create_personal_example(client)

    res = client.patch(f"/example-posts/{post_id}/rating", json={"rating": 4})
    assert res.status_code == 200
    assert res.json()["rating"] == 4


def test_other_user_cannot_rate_someone_elses_example_post(client):
    signup(client, "owner@test.local")
    post_id = create_personal_example(client)

    client.cookies.clear()
    signup(client, "intruder@test.local")
    res = client.patch(f"/example-posts/{post_id}/rating", json={"rating": 5})
    assert res.status_code == 404


def test_admin_can_rate_global_example_post(client):
    signup(client, "admin@test.local")
    res = client.post(
        "/admin/example-posts",
        data={"business_category": "food_beverage", "platform": "facebook", "caption": "global"},
    )
    post_id = res.json()["id"]

    res = client.patch(f"/admin/example-posts/{post_id}/rating", json={"rating": 5})
    assert res.status_code == 200
    assert res.json()["rating"] == 5


def test_admin_cannot_rate_someones_personal_example_post(client):
    signup(client, "owner@test.local")
    post_id = create_personal_example(client)

    client.cookies.clear()
    signup(client, "admin@test.local")
    res = client.patch(f"/admin/example-posts/{post_id}/rating", json={"rating": 3})
    assert res.status_code == 404


def test_rating_out_of_range_rejected(client):
    signup(client, "owner@test.local")
    post_id = create_personal_example(client)

    res = client.patch(f"/example-posts/{post_id}/rating", json={"rating": 6})
    assert res.status_code == 422


def test_like_count_round_trips_through_create_and_update(client):
    signup(client, "owner@test.local")
    res = client.post(
        "/example-posts",
        data={
            "business_category": "food_beverage",
            "platform": "facebook",
            "caption": "original",
            "like_count": "42",
        },
    )
    assert res.status_code == 200
    post_id = res.json()["id"]
    assert res.json()["like_count"] == 42

    res = client.put(
        f"/example-posts/{post_id}",
        data={
            "business_category": "food_beverage",
            "platform": "facebook",
            "caption": "edited",
            "like_count": "100",
        },
    )
    assert res.status_code == 200
    assert res.json()["like_count"] == 100


def test_like_count_omitted_defaults_to_null(client):
    signup(client, "owner@test.local")
    post_id = create_personal_example(client)
    res = client.get("/example-posts")
    assert res.status_code == 200
    matched = next(p for p in res.json()["posts"] if p["id"] == post_id)
    assert matched["like_count"] is None


def test_example_posts_selection_mode_accepts_likes(client):
    signup(client, "owner@test.local")
    res = client.patch("/me/example-selection-mode", json={"example_selection_mode": "likes"})
    assert res.status_code == 200
    assert res.json()["user"]["example_selection_mode"] == "likes"


def test_extract_example_post_returns_parsed_fields(client, monkeypatch):
    signup(client, "user@test.local")

    fake_response = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(
                    content=json.dumps(
                        {"caption": "แคปชั่นทดสอบ", "like_count": 1234, "platform": "instagram"}
                    )
                )
            )
        ],
        usage=SimpleNamespace(prompt_tokens=100, completion_tokens=50),
    )
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = fake_response
    monkeypatch.setattr(main, "openai_client", fake_client)

    res = client.post("/example-posts/extract", files=fake_image_file())
    assert res.status_code == 200
    body = res.json()
    assert body["caption"] == "แคปชั่นทดสอบ"
    assert body["like_count"] == 1234
    assert body["platform"] == "instagram"


def test_extract_example_post_ignores_invalid_platform(client, monkeypatch):
    signup(client, "user@test.local")

    fake_response = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(
                    content=json.dumps(
                        {"caption": "test", "like_count": None, "platform": "not-a-real-platform"}
                    )
                )
            )
        ],
        usage=SimpleNamespace(prompt_tokens=10, completion_tokens=5),
    )
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = fake_response
    monkeypatch.setattr(main, "openai_client", fake_client)

    res = client.post("/example-posts/extract", files=fake_image_file())
    assert res.status_code == 200
    assert res.json()["platform"] is None


def test_extract_example_post_rejects_non_image(client, monkeypatch):
    signup(client, "user@test.local")
    monkeypatch.setattr(main, "openai_client", MagicMock())

    res = client.post(
        "/example-posts/extract",
        files={"image": ("not-a-photo.txt", io.BytesIO(b"just some text"), "text/plain")},
    )
    assert res.status_code == 400


def test_extract_example_post_requires_auth(client):
    res = client.post("/example-posts/extract", files=fake_image_file())
    assert res.status_code == 401


def test_extract_example_post_503_when_no_api_key(client):
    signup(client, "user@test.local")
    # conftest.py forces OPENAI_API_KEY="" for tests, so openai_client is
    # already None here without any monkeypatch.
    res = client.post("/example-posts/extract", files=fake_image_file())
    assert res.status_code == 503
