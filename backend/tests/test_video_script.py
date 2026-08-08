import json
from types import SimpleNamespace
from unittest.mock import MagicMock

import main


def signup(client, email):
    return client.post(
        "/auth/signup", json={"name": "Test", "email": email, "password": "testpass123"}
    )


def fake_openai_client(script_text="ฉาก 1: ทดสอบ"):
    fake_response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=script_text))],
        usage=SimpleNamespace(prompt_tokens=100, completion_tokens=50),
    )
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = fake_response
    return fake_client


def test_video_script_requires_caption(client):
    signup(client, "user@test.local")
    res = client.post(
        "/generate-video-script", json={"caption": "", "platform": "facebook", "tone": "friendly"}
    )
    assert res.status_code == 400


def test_video_script_works_without_character(client, monkeypatch):
    signup(client, "user@test.local")
    fake_client = fake_openai_client()
    monkeypatch.setattr(main, "openai_client", fake_client)

    res = client.post(
        "/generate-video-script",
        json={"caption": "โปรลด 20%", "platform": "facebook", "tone": "friendly"},
    )
    assert res.status_code == 200
    assert res.json()["video_script"] == "ฉาก 1: ทดสอบ"

    system_prompt = fake_client.chat.completions.create.call_args.kwargs["messages"][0]["content"]
    # the "-" prefixed field only appears when body.character was actually
    # provided -- the bare phrase alone also shows up in the static
    # instruction line, so that's not a safe thing to assert absence of
    assert "- ตัวละคร/สไตล์การพูดหน้ากล้อง:" not in system_prompt


def test_video_script_includes_character_when_provided(client, monkeypatch):
    signup(client, "user@test.local")
    fake_client = fake_openai_client()
    monkeypatch.setattr(main, "openai_client", fake_client)

    res = client.post(
        "/generate-video-script",
        json={
            "caption": "โปรลด 20%",
            "platform": "facebook",
            "tone": "friendly",
            "character": "พี่มายด์ พูดเร็ว ชอบพูดคำว่า 'จัดไปครับพี่น้อง' ติดปาก",
        },
    )
    assert res.status_code == 200

    system_prompt = fake_client.chat.completions.create.call_args.kwargs["messages"][0]["content"]
    assert "ตัวละคร/สไตล์การพูดหน้ากล้อง: พี่มายด์ พูดเร็ว ชอบพูดคำว่า 'จัดไปครับพี่น้อง' ติดปาก" in system_prompt


def test_video_script_ignores_blank_character(client, monkeypatch):
    signup(client, "user@test.local")
    fake_client = fake_openai_client()
    monkeypatch.setattr(main, "openai_client", fake_client)

    res = client.post(
        "/generate-video-script",
        json={"caption": "โปรลด 20%", "platform": "facebook", "tone": "friendly", "character": "   "},
    )
    assert res.status_code == 200

    system_prompt = fake_client.chat.completions.create.call_args.kwargs["messages"][0]["content"]
    # the "-" prefixed field only appears when body.character was actually
    # provided -- the bare phrase alone also shows up in the static
    # instruction line, so that's not a safe thing to assert absence of
    assert "- ตัวละคร/สไตล์การพูดหน้ากล้อง:" not in system_prompt
