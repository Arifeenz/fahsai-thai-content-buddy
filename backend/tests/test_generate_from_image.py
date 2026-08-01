import io
from types import SimpleNamespace
from unittest.mock import MagicMock

import main


def signup(client, email="user@test.local"):
    return client.post(
        "/auth/signup", json={"name": "Test", "email": email, "password": "testpass123"}
    )


def fake_image_file():
    return {"image": ("photo.jpg", io.BytesIO(b"fake-bytes"), "image/jpeg")}


def test_missing_image_rejected(client):
    signup(client)
    res = client.post("/generate-from-image", data={"platform": "facebook", "tone": "friendly"})
    assert res.status_code == 422


def test_returns_503_without_openai_configured(client, monkeypatch):
    signup(client)
    monkeypatch.setattr(main, "upload_example_image", lambda file, owner_id: "https://fake/photo.jpg")

    res = client.post(
        "/generate-from-image",
        data={"platform": "facebook", "tone": "friendly"},
        files=fake_image_file(),
    )
    assert res.status_code == 503


def test_returns_caption_and_image_url_when_openai_available(client, monkeypatch):
    signup(client)
    monkeypatch.setattr(main, "upload_example_image", lambda file, owner_id: "https://fake/photo.jpg")

    fake_response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content="แคปชั่นทดสอบจากรูปภาพ"))],
        usage=SimpleNamespace(prompt_tokens=100, completion_tokens=50),
    )
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = fake_response
    monkeypatch.setattr(main, "openai_client", fake_client)

    res = client.post(
        "/generate-from-image",
        data={"platform": "facebook", "tone": "friendly", "context": "โปรโมชั่นลด 20%"},
        files=fake_image_file(),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["caption"] == "แคปชั่นทดสอบจากรูปภาพ"
    assert body["image_url"] == "https://fake/photo.jpg"

    logs = main.list_generation_logs()
    assert any(log["caption"] == "แคปชั่นทดสอบจากรูปภาพ" for log in logs)
