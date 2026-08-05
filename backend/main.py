import json
import os
import random
import secrets
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from io import BytesIO
from typing import Literal

import bcrypt
import jwt
import resend
import sentry_sdk
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from openai import OpenAI
from PIL import Image, ImageOps
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from supabase import create_client

from db import (
    create_content_item,
    create_email_user,
    create_event,
    create_example_post,
    create_follower_snapshot,
    create_generation_log,
    create_prompt_template,
    create_support_ticket,
    delete_event,
    delete_example_post,
    delete_prompt_template,
    ensure_demo_users,
    get_admin_stats,
    get_all_events,
    get_approval_rate_by_mode,
    get_avg_days_to_first_content,
    get_brand_dna,
    get_dna_completeness_correlation,
    get_example_post,
    get_feedback_ratio_by_mode,
    get_monthly_openai_spend,
    get_demo_user_by_category,
    get_retention_stats,
    get_social_links,
    get_user_by_email,
    get_user_by_id,
    get_user_by_reset_token,
    init_db,
    list_all_content,
    list_all_example_posts,
    list_all_users,
    list_content_for_user,
    list_events_for_user,
    list_example_post_categories,
    list_example_posts_for_generation,
    list_example_posts_for_user,
    list_follower_snapshots_for_user,
    list_generation_logs,
    list_prompt_templates,
    list_security_events,
    list_support_tickets,
    log_security_event,
    promote_example_post_to_global,
    reset_password as db_reset_password,
    set_content_feedback,
    set_example_post_rating,
    set_reset_token,
    set_support_ticket_resolved,
    set_verification_token,
    touch_last_login,
    update_business_category,
    update_event,
    update_example_post,
    update_example_selection_mode,
    update_hide_global_events,
    update_prompt_template,
    upsert_brand_dna,
    upsert_google_user,
    upsert_social_links,
    verify_email_by_token,
)

load_dotenv()

# Windows terminals default to cp1252, which can't print the Thai text in
# the mock email fallback below — force UTF-8 so console logging never crashes.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

GOOGLE_CLIENT_ID = os.environ["GOOGLE_CLIENT_ID"]
JWT_SECRET = os.environ["JWT_SECRET"]
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")
ADMIN_EMAILS = {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
# If unset, /generate falls back to randomly picking an admin-authored template
# instead of calling the OpenAI API — lets the app run before a key is configured.
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
OPENAI_MONTHLY_BUDGET_USD = float(os.environ.get("OPENAI_MONTHLY_BUDGET_USD", "5"))
# gpt-4o-mini pricing per 1M tokens — update if the model or OpenAI's pricing changes.
OPENAI_INPUT_PRICE_PER_1M = 0.15
OPENAI_OUTPUT_PRICE_PER_1M = 0.60

RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", "onboarding@resend.dev")
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

SENTRY_DSN = os.environ.get("SENTRY_DSN")
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        traces_sample_rate=0,
        environment="production" if FRONTEND_ORIGIN.startswith("https://") else "development",
    )

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase_client = (
    create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
    else None
)
EXAMPLE_POSTS_BUCKET = "example-posts"
MAX_IMAGE_BYTES = 5 * 1024 * 1024
IMAGE_MAX_DIMENSION = 1920
IMAGE_JPEG_QUALITY = 85
MAX_GENERATE_IMAGES = 3

SESSION_COOKIE = "fahsai_session"
SESSION_TTL = timedelta(days=7)
VERIFICATION_TOKEN_TTL = timedelta(hours=24)
RESET_TOKEN_TTL = timedelta(hours=1)


def resize_and_compress_image(contents: bytes) -> bytes | None:
    # Downscales to a display-friendly cap and re-encodes as JPEG. The
    # OpenAI vision calls that read these images already run at
    # detail="low" (a fixed ~512px internal downsample), so this only
    # affects storage size and how sharp the image looks in the UI.
    try:
        image = Image.open(BytesIO(contents))
        image = ImageOps.exif_transpose(image) or image
    except Exception:
        return None
    if image.mode in ("RGBA", "LA", "P"):
        rgba = image.convert("RGBA")
        flattened = Image.new("RGB", rgba.size, (255, 255, 255))
        flattened.paste(rgba, mask=rgba.split()[-1])
        image = flattened
    else:
        image = image.convert("RGB")
    image.thumbnail((IMAGE_MAX_DIMENSION, IMAGE_MAX_DIMENSION), Image.LANCZOS)
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=IMAGE_JPEG_QUALITY, optimize=True)
    return buffer.getvalue()


def upload_example_image(file: UploadFile | None, owner_id: int) -> str | None:
    if file is None or not file.filename:
        return None
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="ไฟล์ต้องเป็นรูปภาพเท่านั้นนะคะ")
    if supabase_client is None:
        raise HTTPException(
            status_code=503, detail="ระบบเก็บรูปภาพยังไม่ได้ตั้งค่า ลองแนบแค่ข้อความไปก่อนนะคะ"
        )
    contents = file.file.read()
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="ไฟล์รูปภาพใหญ่เกินไป (จำกัด 5MB นะคะ)")
    resized = resize_and_compress_image(contents)
    if resized is not None:
        contents, ext, content_type = resized, "jpg", "image/jpeg"
    else:
        ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg").lower()
        content_type = file.content_type
    path = f"{owner_id}/{uuid.uuid4()}.{ext}"
    supabase_client.storage.from_(EXAMPLE_POSTS_BUCKET).upload(
        path, contents, {"content-type": content_type}
    )
    return supabase_client.storage.from_(EXAMPLE_POSTS_BUCKET).get_public_url(path)


def send_email(to: str, subject: str, html: str) -> None:
    # No Resend key configured yet — print the link so the feature is
    # testable immediately, same fallback pattern as OPENAI_API_KEY above.
    if not RESEND_API_KEY:
        print(f"[email:mock] to={to} subject={subject}\n{html}")
        return
    try:
        resend.Emails.send(
            {"from": RESEND_FROM_EMAIL, "to": [to], "subject": subject, "html": html}
        )
    except Exception as exc:
        # Verification/reset email is a soft gate, not a hard requirement —
        # a delivery failure (e.g. Resend's sandbox domain only allows
        # sending to the account owner until a real domain is verified)
        # must never break signup/login. Fall back to the console link.
        print(f"[email:failed] to={to} subject={subject} error={exc}\n{html}")


def send_verification_email(user_id: int, email: str) -> None:
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now(timezone.utc) + VERIFICATION_TOKEN_TTL).strftime("%Y-%m-%d %H:%M:%S")
    set_verification_token(user_id, token, expires_at)
    link = f"{FRONTEND_ORIGIN}/verify-email?token={token}"
    send_email(
        email,
        "ยืนยันอีเมลของคุณ — FAHSAI",
        f'<p>กดลิงก์นี้เพื่อยืนยันอีเมลของคุณ (หมดอายุใน 24 ชั่วโมง):</p><p><a href="{link}">{link}</a></p>',
    )


def rate_limit_key(request: Request) -> str:
    # Keys by logged-in user when possible (e.g. /generate, which has a real
    # cost per call), falling back to IP for endpoints with no session yet
    # (login/signup, where brute-force/spam protection is the concern).
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            return f"user:{payload['sub']}"
        except jwt.PyJWTError:
            pass
    return f"ip:{get_remote_address(request)}"


limiter = Limiter(key_func=rate_limit_key)

app = FastAPI()
app.state.limiter = limiter
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    log_security_event("rate_limit_exceeded", rate_limit_key(request), request.url.path)
    return JSONResponse(
        status_code=429, content={"detail": "ทำรายการถี่เกินไป กรุณาลองใหม่ภายหลังนะคะ"}
    )


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    ensure_demo_users()


class GoogleLoginRequest(BaseModel):
    credential: str


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class DemoLoginRequest(BaseModel):
    business_category: str


class VerifyEmailRequest(BaseModel):
    token: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str | None = None
    new_password: str


class UpdateMeRequest(BaseModel):
    business_category: str


class CalendarPreferenceWrite(BaseModel):
    hide_global_events: bool


class ExampleSelectionModeWrite(BaseModel):
    example_selection_mode: Literal["latest", "rating", "likes", "random"]


class ExamplePostRatingWrite(BaseModel):
    rating: int = Field(ge=1, le=5)


class GenerateRequest(BaseModel):
    prompt: str
    platform: str
    tone: str | None = None


class ContentItemCreate(BaseModel):
    platform: str
    preview: str
    status: str
    mode: str | None = None


class ContentFeedbackUpdate(BaseModel):
    feedback: Literal["good", "neutral", "bad"]


class PromptTemplateWrite(BaseModel):
    business_category: str | None = None
    platform: str
    tone: str | None = None
    template_text: str


class BrandDnaWrite(BaseModel):
    history: str = ""
    menu: str = ""
    usp: str = ""
    tone: str = ""


class SocialLinksWrite(BaseModel):
    facebook: str = ""
    instagram: str = ""
    line: str = ""
    tiktok: str = ""
    youtube: str = ""
    twitch: str = ""


class BrandDnaDraftRequest(BaseModel):
    text: str


class FollowerSnapshotCreate(BaseModel):
    platform: str
    follower_count: int


class EventCreate(BaseModel):
    name: str
    month: int
    day: int


class EventWrite(BaseModel):
    name: str
    month: int
    day: int
    suggestion_text: str = ""


class SupportTicketCreate(BaseModel):
    message: str
    user_agent: str | None = None


class SupportTicketResolveUpdate(BaseModel):
    resolved: bool


def days_until_next(month: int, day: int, today: date) -> int:
    this_year = date(today.year, month, day)
    if this_year >= today:
        return (this_year - today).days
    next_year = date(today.year + 1, month, day)
    return (next_year - today).days


def create_session_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + SESSION_TTL,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def read_session_user(request: Request):
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    return get_user_by_id(int(payload["sub"]))


def require_user(request: Request):
    user = read_session_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def require_admin(request: Request):
    user = require_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def to_utc_iso(timestamp: datetime | None) -> str | None:
    # Postgres TIMESTAMP columns have no timezone marker; they're always UTC,
    # so mark it explicitly for correct parsing by JS Date on the frontend.
    return timestamp.isoformat() + "Z" if timestamp else None


def user_to_dict(row) -> dict:
    return {
        "name": row["name"],
        "email": row["email"],
        "picture": row["picture"],
        "role": row["role"],
        "business_category": row["business_category"],
        "last_login_at": to_utc_iso(row["last_login_at"]),
        "hide_global_events": bool(row["hide_global_events"]),
        "email_verified": bool(row["email_verified"]),
        "example_selection_mode": row["example_selection_mode"],
        "has_password": row["password_hash"] is not None,
        "is_demo": bool(row["is_demo"]),
    }


def admin_user_to_dict(row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "role": row["role"],
        "business_category": row["business_category"],
        "created_at": to_utc_iso(row["created_at"]),
        "last_login_at": to_utc_iso(row["last_login_at"]),
        "is_demo": bool(row["is_demo"]),
    }


def content_to_dict(row) -> dict:
    return {
        "id": row["id"],
        "platform": row["platform"],
        "preview": row["preview"],
        "status": row["status"],
        "feedback": row["feedback"],
        "createdAt": row["created_at"].date().isoformat() if row["created_at"] else None,
    }


def admin_content_to_dict(row) -> dict:
    d = content_to_dict(row)
    d["owner_name"] = row["owner_name"]
    d["owner_email"] = row["owner_email"]
    return d


def example_post_to_dict(row) -> dict:
    return {
        "id": row["id"],
        "is_personal": row["user_id"] is not None,
        "business_category": row["business_category"],
        "platform": row["platform"],
        "caption": row["caption"],
        "image_url": row["image_url"],
        "rating": row["rating"],
        "like_count": row["like_count"],
        "created_at": to_utc_iso(row["created_at"]),
    }


def follower_snapshot_to_dict(row) -> dict:
    return {
        "id": row["id"],
        "platform": row["platform"],
        "follower_count": row["follower_count"],
        "recorded_at": to_utc_iso(row["recorded_at"]),
    }


def support_ticket_to_dict(row) -> dict:
    return {
        "id": row["id"],
        "message": row["message"],
        "user_agent": row["user_agent"],
        "resolved": bool(row["resolved"]),
        "created_at": to_utc_iso(row["created_at"]),
        "user_name": row["user_name"] if "user_name" in row else None,
        "user_email": row["user_email"] if "user_email" in row else None,
    }


def admin_example_post_to_dict(row) -> dict:
    d = example_post_to_dict(row)
    d["owner_name"] = row["owner_name"]
    d["owner_email"] = row["owner_email"]
    return d


def template_to_dict(row) -> dict:
    return {
        "id": row["id"],
        "business_category": row["business_category"],
        "platform": row["platform"],
        "tone": row["tone"],
        "template_text": row["template_text"],
        "updated_at": to_utc_iso(row["updated_at"]),
    }


def event_to_dict(row, today: date) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "month": row["month"],
        "day": row["day"],
        "suggestion_text": row["suggestion_text"],
        "is_personal": row["user_id"] is not None,
        "days_until": days_until_next(row["month"], row["day"], today),
    }


def issue_session_cookie(response: Response, user_id: int) -> None:
    token = create_session_token(user_id)
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        secure=FRONTEND_ORIGIN.startswith("https://"),
        max_age=int(SESSION_TTL.total_seconds()),
        path="/",
    )


@app.post("/auth/google")
def google_login(body: GoogleLoginRequest, response: Response):
    try:
        claims = id_token.verify_oauth2_token(
            body.credential, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    role = "admin" if claims["email"].lower() in ADMIN_EMAILS else "user"
    user = upsert_google_user(
        google_sub=claims["sub"],
        email=claims["email"],
        name=claims.get("name"),
        picture=claims.get("picture"),
        role=role,
    )

    issue_session_cookie(response, user["id"])
    return {"user": user_to_dict(user)}


@app.post("/auth/signup")
@limiter.limit("5/minute")
def signup(body: SignupRequest, response: Response, request: Request):
    email = body.email.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="อีเมลไม่ถูกต้อง")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
    if get_user_by_email(email) is not None:
        raise HTTPException(
            status_code=409,
            detail="อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบด้วย Google หรืออีเมลนี้แทนนะคะ",
        )

    password_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    role = "admin" if email in ADMIN_EMAILS else "user"
    user = create_email_user(email, password_hash, body.name.strip(), role)
    send_verification_email(user["id"], user["email"])

    issue_session_cookie(response, user["id"])
    return {"user": user_to_dict(user)}


@app.post("/auth/login")
@limiter.limit("5/minute")
def login(body: LoginRequest, response: Response, request: Request):
    email = body.email.strip().lower()
    user = get_user_by_email(email)
    if user is None or user["password_hash"] is None:
        raise HTTPException(status_code=401, detail="อีเมลหรือรหัสผ่านไม่ถูกต้อง")
    if not bcrypt.checkpw(body.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="อีเมลหรือรหัสผ่านไม่ถูกต้อง")

    user = touch_last_login(user["id"])
    issue_session_cookie(response, user["id"])
    return {"user": user_to_dict(user)}


@app.post("/auth/demo-login")
@limiter.limit("10/minute")
def demo_login(body: DemoLoginRequest, response: Response, request: Request):
    user = get_demo_user_by_category(body.business_category)
    if user is None:
        raise HTTPException(status_code=404, detail="ไม่พบบัญชีทดลองสำหรับหมวดนี้ค่ะ")
    user = touch_last_login(user["id"])
    issue_session_cookie(response, user["id"])
    return {"user": user_to_dict(user)}


@app.get("/auth/me")
def me(request: Request):
    user = require_user(request)
    return {"user": user_to_dict(user)}


@app.patch("/me")
def update_me(body: UpdateMeRequest, request: Request):
    user = require_user(request)
    updated = update_business_category(user["id"], body.business_category)
    return {"user": user_to_dict(updated)}


@app.patch("/me/calendar-preference")
def update_calendar_preference(body: CalendarPreferenceWrite, request: Request):
    user = require_user(request)
    updated = update_hide_global_events(user["id"], body.hide_global_events)
    return {"user": user_to_dict(updated)}


@app.patch("/me/example-selection-mode")
def update_example_selection_mode_route(body: ExampleSelectionModeWrite, request: Request):
    user = require_user(request)
    updated = update_example_selection_mode(user["id"], body.example_selection_mode)
    return {"user": user_to_dict(updated)}


@app.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@app.post("/auth/verify-email")
@limiter.limit("10/minute")
def verify_email(body: VerifyEmailRequest, request: Request):
    user = verify_email_by_token(body.token)
    if user is None:
        raise HTTPException(status_code=400, detail="ลิงก์ยืนยันไม่ถูกต้องหรือหมดอายุแล้วนะคะ")
    return {"ok": True}


@app.post("/auth/resend-verification")
@limiter.limit("5/minute")
def resend_verification(request: Request):
    user = require_user(request)
    if user["email_verified"]:
        return {"ok": True}
    send_verification_email(user["id"], user["email"])
    return {"ok": True}


@app.post("/auth/forgot-password")
@limiter.limit("5/minute")
def forgot_password(body: ForgotPasswordRequest, request: Request):
    email = body.email.strip().lower()
    user = get_user_by_email(email)
    if user is not None and user["password_hash"] is not None:
        token = secrets.token_urlsafe(32)
        expires_at = (datetime.now(timezone.utc) + RESET_TOKEN_TTL).strftime("%Y-%m-%d %H:%M:%S")
        set_reset_token(user["id"], token, expires_at)
        link = f"{FRONTEND_ORIGIN}/reset-password?token={token}"
        send_email(
            user["email"],
            "ตั้งรหัสผ่านใหม่ — FAHSAI",
            f'<p>กดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่ (หมดอายุใน 1 ชั่วโมง):</p><p><a href="{link}">{link}</a></p>',
        )
    # Always the same response, whether or not the account exists — avoids
    # leaking which emails are registered (same reasoning as the login error).
    return {"ok": True}


@app.post("/auth/reset-password")
@limiter.limit("5/minute")
def reset_password_endpoint(body: ResetPasswordRequest, request: Request):
    user = get_user_by_reset_token(body.token)
    if user is None:
        raise HTTPException(status_code=400, detail="ลิงก์รีเซ็ตไม่ถูกต้องหรือหมดอายุแล้วนะคะ")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
    password_hash = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
    db_reset_password(user["id"], password_hash)
    return {"ok": True}


@app.post("/auth/change-password")
@limiter.limit("5/minute")
def change_password(body: ChangePasswordRequest, request: Request):
    user = require_user(request)
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
    if user["password_hash"] is not None:
        if not body.current_password or not bcrypt.checkpw(
            body.current_password.encode(), user["password_hash"].encode()
        ):
            raise HTTPException(status_code=401, detail="รหัสผ่านปัจจุบันไม่ถูกต้อง")
    password_hash = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
    db_reset_password(user["id"], password_hash)
    return {"ok": True}


@app.get("/content")
def get_my_content(request: Request):
    user = require_user(request)
    return {"items": [content_to_dict(row) for row in list_content_for_user(user["id"])]}


@app.post("/content")
def post_my_content(body: ContentItemCreate, request: Request):
    user = require_user(request)
    row = create_content_item(user["id"], body.platform, body.preview, body.status, body.mode)
    return content_to_dict(row)


@app.patch("/content/{content_id}/feedback")
def update_content_feedback(content_id: int, body: ContentFeedbackUpdate, request: Request):
    user = require_user(request)
    row = set_content_feedback(content_id, user["id"], body.feedback)
    if row is None:
        raise HTTPException(status_code=404, detail="Content not found")
    return content_to_dict(row)


@app.get("/stats")
def get_my_stats(request: Request):
    user = require_user(request)
    items = list_content_for_user(user["id"])
    now = datetime.now(timezone.utc)
    new_posts = sum(
        1
        for row in items
        if row["created_at"]
        and (now - row["created_at"].replace(tzinfo=timezone.utc)).days < 7
    )
    approved = sum(1 for row in items if row["status"] == "approved")
    posted = sum(1 for row in items if row["status"] == "posted")
    pending_review = sum(1 for row in items if row["status"] == "draft")
    total = len(items)
    success_rate = round((posted / total) * 100, 1) if total else 0.0

    posted_at = [
        row["created_at"].replace(tzinfo=timezone.utc)
        for row in items
        if row["status"] == "posted" and row["created_at"]
    ]
    days_since_last_post = (now - max(posted_at)).days if posted_at else None

    return {
        "newPosts": new_posts,
        "approved": approved,
        "posted": posted,
        "successRate": success_rate,
        "pendingReview": pending_review,
        "daysSinceLastPost": days_since_last_post,
    }


@app.get("/brand-dna")
def get_brand_dna_endpoint(request: Request):
    user = require_user(request)
    return get_brand_dna(user["id"])


@app.put("/brand-dna")
def put_brand_dna_endpoint(body: BrandDnaWrite, request: Request):
    user = require_user(request)
    return upsert_brand_dna(user["id"], body.model_dump())


@app.get("/social-links")
def get_social_links_endpoint(request: Request):
    user = require_user(request)
    return get_social_links(user["id"])


@app.put("/social-links")
def put_social_links_endpoint(body: SocialLinksWrite, request: Request):
    user = require_user(request)
    return upsert_social_links(user["id"], body.model_dump())


@app.post("/follower-snapshot")
def create_my_follower_snapshot(body: FollowerSnapshotCreate, request: Request):
    user = require_user(request)
    row = create_follower_snapshot(user["id"], body.platform, body.follower_count)
    return follower_snapshot_to_dict(row)


@app.get("/follower-snapshot")
def list_my_follower_snapshots(request: Request):
    user = require_user(request)
    return {
        "snapshots": [
            follower_snapshot_to_dict(row) for row in list_follower_snapshots_for_user(user["id"])
        ]
    }


@app.post("/support-tickets")
@limiter.limit("10/hour")
def create_my_support_ticket(body: SupportTicketCreate, request: Request):
    user = require_user(request)
    message = body.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="กรุณาอธิบายปัญหาก่อนนะคะ")
    row = create_support_ticket(user["id"], message, body.user_agent)
    return support_ticket_to_dict(row)


@app.post("/brand-dna/draft")
@limiter.limit("15/hour")
def draft_brand_dna(body: BrandDnaDraftRequest, request: Request):
    user = require_user(request)
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="กรุณาเล่าเรื่องร้านก่อนนะคะ")

    budget_exceeded = openai_client is not None and get_monthly_openai_spend() >= OPENAI_MONTHLY_BUDGET_USD
    if openai_client is None or budget_exceeded:
        if budget_exceeded:
            log_security_event("openai_budget_exceeded", f"user:{user['id']}", "/brand-dna/draft")
        raise HTTPException(
            status_code=503,
            detail="ระบบช่วยจัดข้อมูลไม่พร้อมใช้งานตอนนี้ กรอกทีละช่องแทนได้ค่ะ",
        )

    menu_draft_hint = DNA_MENU_DRAFT_HINTS.get(
        user["business_category"], DNA_MENU_DRAFT_HINTS["food_beverage"]
    )
    system_prompt = f"""คุณคือ FAHSAI ผู้ช่วยจัดระเบียบข้อมูลร้านให้เจ้าของร้าน SME ไทย
อ่านข้อความที่ร้านเล่ามาให้ฟัง แล้วแยกใส่ 4 หมวดนี้ เขียนเป็นภาษาไทยเท่านั้น:
- history: ประวัติร้าน ที่มาที่ไป
- menu: {menu_draft_hint}
- usp: จุดขายที่ไม่เหมือนใคร (USP)
- tone: บุคลิกแบรนด์ น้ำเสียงตอนเขียนโพสต์

ถ้าข้อความที่ร้านเล่ามาไม่มีข้อมูลพอสำหรับหมวดไหน ให้ปล่อยหมวดนั้นเป็นข้อความว่าง "" แล้วใส่ชื่อหมวด (history/menu/usp/tone) ไว้ใน missing_fields ห้ามเดาหรือแต่งข้อมูลขึ้นเองเด็ดขาด

ตอบกลับเป็น JSON เท่านั้น รูปแบบ: {{"history": "...", "menu": "...", "usp": "...", "tone": "...", "missing_fields": ["menu"]}}"""

    try:
        response = openai_client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text},
            ],
            max_tokens=600,
            timeout=20,
            response_format={"type": "json_object"},
        )
        parsed = json.loads(response.choices[0].message.content)
    except Exception as exc:
        print(f"[brand_dna_draft:openai_error] {type(exc).__name__}: {exc}")
        sentry_sdk.capture_exception(exc)
        raise HTTPException(status_code=502, detail="จัดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้งนะคะ")

    return {
        "history": parsed.get("history") or "",
        "menu": parsed.get("menu") or "",
        "usp": parsed.get("usp") or "",
        "tone": parsed.get("tone") or "",
        "missing_fields": parsed.get("missing_fields") or [],
    }


@app.get("/events/upcoming")
def upcoming_event(request: Request):
    require_user(request)
    today = datetime.now(timezone.utc).date()
    nearest = None
    nearest_days = None
    for row in get_all_events():
        d = days_until_next(row["month"], row["day"], today)
        if nearest_days is None or d < nearest_days:
            nearest_days = d
            nearest = row
    if nearest is None or nearest_days > 14:
        return {"event": None}
    return {
        "event": {
            "name": nearest["name"],
            "days_until": nearest_days,
            "suggestion_text": nearest["suggestion_text"],
        }
    }


@app.get("/events")
def list_my_events(request: Request):
    user = require_user(request)
    today = datetime.now(timezone.utc).date()
    hide_global = bool(user["hide_global_events"])
    events = [
        event_to_dict(row, today) for row in list_events_for_user(user["id"], hide_global)
    ]
    events.sort(key=lambda e: e["days_until"])
    return {"events": events[:7]}


@app.post("/events")
def create_my_event(body: EventCreate, request: Request):
    user = require_user(request)
    row = create_event(user["id"], body.name, body.month, body.day)
    return event_to_dict(row, datetime.now(timezone.utc).date())


@app.delete("/events/{event_id}")
def delete_my_event(event_id: int, request: Request):
    user = require_user(request)
    deleted = delete_event(event_id, user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"ok": True}


@app.get("/example-posts")
def list_my_example_posts(request: Request):
    user = require_user(request)
    return {"posts": [example_post_to_dict(row) for row in list_example_posts_for_user(user["id"])]}


@app.post("/example-posts")
def create_my_example_post(
    request: Request,
    business_category: str = Form(...),
    platform: str = Form(...),
    caption: str = Form(...),
    image: UploadFile | None = File(None),
    like_count: int | None = Form(None),
):
    user = require_user(request)
    image_url = upload_example_image(image, user["id"])
    row = create_example_post(
        user["id"], business_category, platform, caption, image_url, user["id"], like_count
    )
    return example_post_to_dict(row)


@app.delete("/example-posts/{post_id}")
def delete_my_example_post(post_id: int, request: Request):
    user = require_user(request)
    deleted = delete_example_post(post_id, user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Example post not found")
    return {"ok": True}


@app.put("/example-posts/{post_id}")
def update_my_example_post(
    post_id: int,
    request: Request,
    business_category: str = Form(...),
    platform: str = Form(...),
    caption: str = Form(...),
    image: UploadFile | None = File(None),
    like_count: int | None = Form(None),
):
    user = require_user(request)
    existing = get_example_post(post_id)
    if existing is None or existing["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Example post not found")
    image_url = (
        upload_example_image(image, user["id"])
        if image is not None and image.filename
        else existing["image_url"]
    )
    row = update_example_post(
        post_id, user["id"], business_category, platform, caption, image_url, like_count
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Example post not found")
    return example_post_to_dict(row)


@app.patch("/example-posts/{post_id}/rating")
def rate_my_example_post(post_id: int, body: ExamplePostRatingWrite, request: Request):
    user = require_user(request)
    row = set_example_post_rating(post_id, user["id"], body.rating)
    if row is None:
        raise HTTPException(status_code=404, detail="Example post not found")
    return example_post_to_dict(row)


PLATFORM_LABELS = {"facebook": "Facebook", "line": "LINE OA", "instagram": "Instagram"}
TONE_LABELS = {
    "friendly": "เป็นกันเอง",
    "professional": "ทางการ",
    "playful": "สนุกสนาน",
    "promo": "โปรโมชั่น",
}
BUSINESS_CATEGORY_LABELS = {
    "food_beverage": "ร้านอาหาร/เครื่องดื่ม",
    "online_shop": "ขายของออนไลน์",
    "fortune_telling": "ดูดวง",
    "streamer": "สตรีมเมอร์/เกมเมอร์",
}
# The brand_dna "menu" field means something different per business category
# (a food menu isn't a thing for a streamer) — these labels/hints keep the
# AI prompts (and the frontend form) speaking about the right kind of content.
DNA_MENU_LABELS = {
    "food_beverage": "เมนู/สินค้าเด่น",
    "online_shop": "สินค้าขายดี/สินค้าเด่น",
    "fortune_telling": "ศาสตร์ที่ถนัด/บริการเด่น",
    "streamer": "เกม/คอนเทนต์ที่เล่นประจำ",
}
DNA_MENU_DRAFT_HINTS = {
    "food_beverage": "เมนู/สินค้าเด่นที่อยากให้พูดถึงบ่อยๆ",
    "online_shop": "สินค้าขายดีหรือสินค้าเด่นที่อยากให้พูดถึงบ่อยๆ",
    "fortune_telling": "ศาสตร์การดูดวงหรือบริการเด่นที่อยากให้พูดถึงบ่อยๆ",
    "streamer": "เกมหรือคอนเทนต์ที่เล่น/ไลฟ์เป็นประจำ",
}


@app.post("/generate")
@limiter.limit("15/hour")
def generate_content(body: GenerateRequest, request: Request):
    user = require_user(request)
    templates = list_prompt_templates(business_category=user["business_category"], platform=body.platform)

    budget_exceeded = openai_client is not None and get_monthly_openai_spend() >= OPENAI_MONTHLY_BUDGET_USD
    if openai_client is None or budget_exceeded:
        # No API key configured, or this month's estimated OpenAI spend hit
        # the budget cap — keep the app usable with the old
        # random-pick-from-templates behavior instead of a real LLM.
        if budget_exceeded:
            log_security_event("openai_budget_exceeded", f"user:{user['id']}", "/generate")
        if not templates:
            raise HTTPException(
                status_code=404,
                detail="ยังไม่มี prompt template สำหรับแพลตฟอร์มนี้ — ให้แอดมินเพิ่มก่อนนะคะ",
            )
        chosen = random.choice(templates)
        create_generation_log(
            user["id"], body.platform, body.tone, body.prompt, chosen["template_text"], mode="idea"
        )
        return {"caption": chosen["template_text"], "image_prompt": None, "image_prompt_th": None}

    dna = get_brand_dna(user["id"])
    style_examples = "\n---\n".join(t["template_text"] for t in templates[:3])
    example_post_rows = list_example_posts_for_generation(
        user["id"], user["business_category"], body.platform, user["example_selection_mode"]
    )
    if example_post_rows:
        post_captions = "\n---\n".join(p["caption"] for p in example_post_rows)
        style_examples = (
            f"{style_examples}\n---\n{post_captions}" if style_examples else post_captions
        )
    platform_label = PLATFORM_LABELS.get(body.platform, body.platform)
    tone_label = TONE_LABELS.get(body.tone or "", body.tone or "เป็นกันเอง")
    category_label = BUSINESS_CATEGORY_LABELS.get(
        user["business_category"], user["business_category"] or "ไม่ระบุ"
    )
    menu_label = DNA_MENU_LABELS.get(user["business_category"], DNA_MENU_LABELS["food_beverage"])
    examples_section = (
        f"ตัวอย่างโพสต์ที่ร้านเคยเขียน ใช้เป็นแนวทางโทนเสียงเท่านั้น ห้ามก็อปมาตรงๆ:\n{style_examples}"
        if style_examples
        else ""
    )

    system_prompt = f"""คุณคือ FAHSAI ผู้ช่วยเขียนโพสต์โซเชียลมีเดียให้ร้าน SME ไทย เขียนเป็นภาษาไทยเท่านั้น

ข้อมูลร้าน:
- ประเภทร้าน: {category_label}
- ประวัติร้าน: {dna["history"] or "ไม่ระบุ"}
- {menu_label}: {dna["menu"] or "ไม่ระบุ"}
- จุดขาย (USP): {dna["usp"] or "ไม่ระบุ"}
- บุคลิกแบรนด์: {dna["tone"] or "ไม่ระบุ"}

โพสต์นี้จะลงแพลตฟอร์ม {platform_label} ด้วยโทน "{tone_label}" ให้ความยาวและสไตล์เหมาะกับแพลตฟอร์มนั้น (Facebook เขียนได้ยาวหน่อย, LINE OA กระชับเป็นกันเอง, Instagram ใช้แฮชแท็กได้)

{examples_section}

{"มีรูปตัวอย่างโพสต์แนบมาด้วย ลองดูสไตล์ภาพ สี และบรรยากาศ ใช้เป็นแนวทางทั้งแต่งข้อความและคิด prompt สำหรับสร้างภาพให้เข้ากับสไตล์ภาพตัวอย่างเหล่านี้ด้วย" if any(p["image_url"] for p in example_post_rows) else ""}

นอกจากข้อความโพสต์ ให้คิด prompt สั้นๆ เป็นภาษาอังกฤษสำหรับเอาไปใช้กับ AI สร้างภาพ (เช่น DALL-E, Midjourney) ที่เหมาะกับโพสต์นี้ด้วย พร้อมแปล prompt นั้นเป็นภาษาไทยสั้นๆ ให้ร้านค้าอ่านเข้าใจง่ายว่าจะได้ภาพแบบไหน

ตอบกลับเป็น JSON เท่านั้น รูปแบบ: {{"caption": "ข้อความโพสต์ภาษาไทย", "image_prompt": "English prompt for AI image generation", "image_prompt_th": "คำแปลไทยสั้นๆ ของ image_prompt"}}"""

    user_content: list[dict] = [{"type": "text", "text": body.prompt}]
    for p in example_post_rows:
        if p["image_url"] and sum(1 for c in user_content if c["type"] == "image_url") < 3:
            user_content.append(
                {"type": "image_url", "image_url": {"url": p["image_url"], "detail": "low"}}
            )

    try:
        response = openai_client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            max_tokens=500,
            timeout=20,
            response_format={"type": "json_object"},
        )
        parsed = json.loads(response.choices[0].message.content)
        caption = parsed["caption"]
        image_prompt = parsed.get("image_prompt")
        image_prompt_th = parsed.get("image_prompt_th")
        prompt_tokens = response.usage.prompt_tokens if response.usage else None
        completion_tokens = response.usage.completion_tokens if response.usage else None
    except Exception as exc:
        print(f"[generate:openai_error] {type(exc).__name__}: {exc}")
        sentry_sdk.capture_exception(exc)
        raise HTTPException(
            status_code=502, detail="สร้างคอนเทนต์ไม่สำเร็จ ลองใหม่อีกครั้งนะคะ"
        )

    estimated_cost_usd = 0.0
    if prompt_tokens is not None and completion_tokens is not None:
        estimated_cost_usd = (prompt_tokens / 1_000_000) * OPENAI_INPUT_PRICE_PER_1M + (
            completion_tokens / 1_000_000
        ) * OPENAI_OUTPUT_PRICE_PER_1M

    create_generation_log(
        user["id"],
        body.platform,
        body.tone,
        body.prompt,
        caption,
        prompt_tokens,
        completion_tokens,
        estimated_cost_usd,
        system_prompt,
        mode="idea",
    )
    return {"caption": caption, "image_prompt": image_prompt, "image_prompt_th": image_prompt_th}


@app.post("/generate-from-image")
@limiter.limit("15/hour")
def generate_from_image(
    request: Request,
    platform: str = Form(...),
    tone: str | None = Form(None),
    context: str = Form(""),
    images: list[UploadFile] = File(...),
):
    user = require_user(request)
    if len(images) > MAX_GENERATE_IMAGES:
        raise HTTPException(
            status_code=400, detail=f"แนบได้สูงสุด {MAX_GENERATE_IMAGES} รูปนะคะ"
        )
    image_urls = [url for img in images if (url := upload_example_image(img, user["id"]))]

    budget_exceeded = openai_client is not None and get_monthly_openai_spend() >= OPENAI_MONTHLY_BUDGET_USD
    if openai_client is None or budget_exceeded:
        # Unlike /generate, there's no sensible template fallback here — a
        # caption has to describe the actual uploaded photo, so a random
        # generic template would be misleading rather than merely bland.
        if budget_exceeded:
            log_security_event("openai_budget_exceeded", f"user:{user['id']}", "/generate-from-image")
        raise HTTPException(
            status_code=503,
            detail="ฟีเจอร์เขียนจากรูปภาพต้องใช้ AI ช่วย ตอนนี้ยังไม่พร้อมใช้งาน ลองใหม่ภายหลังนะคะ",
        )

    dna = get_brand_dna(user["id"])
    platform_label = PLATFORM_LABELS.get(platform, platform)
    tone_label = TONE_LABELS.get(tone or "", tone or "เป็นกันเอง")
    category_label = BUSINESS_CATEGORY_LABELS.get(
        user["business_category"], user["business_category"] or "ไม่ระบุ"
    )
    menu_label = DNA_MENU_LABELS.get(user["business_category"], DNA_MENU_LABELS["food_beverage"])
    context_line = f"\nบริบทเพิ่มเติมจากร้าน: {context}" if context.strip() else ""

    system_prompt = f"""คุณคือ FAHSAI ผู้ช่วยเขียนโพสต์โซเชียลมีเดียให้ร้าน SME ไทย เขียนเป็นภาษาไทยเท่านั้น

ข้อมูลร้าน:
- ประเภทร้าน: {category_label}
- ประวัติร้าน: {dna["history"] or "ไม่ระบุ"}
- {menu_label}: {dna["menu"] or "ไม่ระบุ"}
- จุดขาย (USP): {dna["usp"] or "ไม่ระบุ"}
- บุคลิกแบรนด์: {dna["tone"] or "ไม่ระบุ"}

ร้านแนบรูปภาพมาให้ {len(image_urls)} รูป ดูรูปเหล่านี้แล้วเขียนแคปชั่นโปรโมตสิ่งที่เห็น ให้เหมาะกับร้าน{context_line}

โพสต์นี้จะลงแพลตฟอร์ม {platform_label} ด้วยโทน "{tone_label}" ให้ความยาวและสไตล์เหมาะกับแพลตฟอร์มนั้น (Facebook เขียนได้ยาวหน่อย, LINE OA กระชับเป็นกันเอง, Instagram ใช้แฮชแท็กได้)

ตอบกลับด้วยข้อความโพสต์เท่านั้น ไม่ต้องมีคำอธิบายอื่น"""

    user_content: list[dict] = [
        {"type": "text", "text": context or "เขียนแคปชั่นให้เหมาะกับรูปที่แนบมา"}
    ]
    for url in image_urls:
        user_content.append({"type": "image_url", "image_url": {"url": url, "detail": "low"}})

    try:
        response = openai_client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            max_tokens=500,
            timeout=20,
        )
        caption = response.choices[0].message.content
        prompt_tokens = response.usage.prompt_tokens if response.usage else None
        completion_tokens = response.usage.completion_tokens if response.usage else None
    except Exception as exc:
        print(f"[generate_from_image:openai_error] {type(exc).__name__}: {exc}")
        sentry_sdk.capture_exception(exc)
        raise HTTPException(
            status_code=502, detail="สร้างคอนเทนต์ไม่สำเร็จ ลองใหม่อีกครั้งนะคะ"
        )

    estimated_cost_usd = 0.0
    if prompt_tokens is not None and completion_tokens is not None:
        estimated_cost_usd = (prompt_tokens / 1_000_000) * OPENAI_INPUT_PRICE_PER_1M + (
            completion_tokens / 1_000_000
        ) * OPENAI_OUTPUT_PRICE_PER_1M

    create_generation_log(
        user["id"],
        platform,
        tone,
        context,
        caption,
        prompt_tokens,
        completion_tokens,
        estimated_cost_usd,
        system_prompt,
        mode="photo",
    )
    return {"caption": caption, "image_urls": image_urls}


@app.get("/admin/stats")
@limiter.limit("60/minute")
def admin_stats(request: Request):
    require_admin(request)
    return {**get_admin_stats(), "openai_monthly_budget_usd": OPENAI_MONTHLY_BUDGET_USD}


@app.get("/admin/kpi")
@limiter.limit("60/minute")
def admin_kpi(request: Request):
    require_admin(request)
    retention = get_retention_stats()
    return {
        "approval_by_mode": get_approval_rate_by_mode(),
        "feedback_by_mode": get_feedback_ratio_by_mode(),
        "dna_completeness": get_dna_completeness_correlation(),
        "retained_users": retention["retained_users"],
        "active_users": retention["active_users"],
        "avg_days_to_first_content": get_avg_days_to_first_content(),
    }


@app.get("/admin/security-events")
@limiter.limit("60/minute")
def admin_security_events(request: Request):
    require_admin(request)
    events = []
    for row in list_security_events():
        events.append(
            {
                "id": row["id"],
                "event_type": row["event_type"],
                "identifier": row["identifier"],
                "endpoint": row["endpoint"],
                "user_name": row["user_name"],
                "user_email": row["user_email"],
                "created_at": to_utc_iso(row["created_at"]),
            }
        )
    return {"events": events}


@app.get("/admin/generation-log")
@limiter.limit("60/minute")
def admin_generation_log(request: Request):
    require_admin(request)
    logs = []
    for row in list_generation_logs():
        logs.append(
            {
                "id": row["id"],
                "user_name": row["user_name"],
                "user_email": row["user_email"],
                "platform": row["platform"],
                "tone": row["tone"],
                "prompt": row["prompt"],
                "caption": row["caption"],
                "system_prompt": row["system_prompt"],
                "created_at": to_utc_iso(row["created_at"]),
            }
        )
    return {"logs": logs}


@app.get("/admin/users")
@limiter.limit("60/minute")
def admin_list_users(request: Request, page: int = 1, page_size: int = 20):
    require_admin(request)
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    rows, total = list_all_users(page, page_size)
    return {
        "users": [admin_user_to_dict(row) for row in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@app.get("/admin/content")
@limiter.limit("60/minute")
def admin_get_all_content(request: Request, page: int = 1, page_size: int = 20):
    require_admin(request)
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    rows, total = list_all_content(page, page_size)
    return {
        "items": [admin_content_to_dict(row) for row in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@app.get("/admin/prompt-templates")
@limiter.limit("60/minute")
def admin_list_prompt_templates(request: Request):
    require_admin(request)
    return {"templates": [template_to_dict(row) for row in list_prompt_templates()]}


@app.post("/admin/prompt-templates")
@limiter.limit("60/minute")
def admin_create_prompt_template(body: PromptTemplateWrite, request: Request):
    admin = require_admin(request)
    row = create_prompt_template(
        body.business_category, body.platform, body.tone, body.template_text, admin["id"]
    )
    return template_to_dict(row)


@app.put("/admin/prompt-templates/{template_id}")
@limiter.limit("60/minute")
def admin_update_prompt_template(template_id: int, body: PromptTemplateWrite, request: Request):
    require_admin(request)
    row = update_prompt_template(
        template_id, body.business_category, body.platform, body.tone, body.template_text
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return template_to_dict(row)


@app.delete("/admin/prompt-templates/{template_id}")
@limiter.limit("60/minute")
def admin_delete_prompt_template(template_id: int, request: Request):
    require_admin(request)
    delete_prompt_template(template_id)
    return {"ok": True}


@app.get("/admin/example-posts")
@limiter.limit("60/minute")
def admin_list_example_posts(
    request: Request,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    platform: str | None = None,
    business_category: str | None = None,
    ownership: str | None = None,
):
    require_admin(request)
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    rows, total = list_all_example_posts(
        page, page_size, search, platform, business_category, ownership
    )
    return {
        "posts": [admin_example_post_to_dict(row) for row in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@app.get("/admin/example-posts/categories")
@limiter.limit("60/minute")
def admin_list_example_post_categories(request: Request):
    require_admin(request)
    return {"categories": list_example_post_categories()}


@app.get("/admin/support-tickets")
@limiter.limit("60/minute")
def admin_list_support_tickets(request: Request, page: int = 1, page_size: int = 20):
    require_admin(request)
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    rows, total = list_support_tickets(page, page_size)
    return {
        "tickets": [support_ticket_to_dict(row) for row in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@app.patch("/admin/support-tickets/{ticket_id}/resolve")
@limiter.limit("60/minute")
def admin_resolve_support_ticket(
    ticket_id: int, body: SupportTicketResolveUpdate, request: Request
):
    require_admin(request)
    row = set_support_ticket_resolved(ticket_id, body.resolved)
    if row is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return support_ticket_to_dict(row)


@app.post("/admin/example-posts")
@limiter.limit("60/minute")
def admin_create_example_post(
    request: Request,
    business_category: str = Form(...),
    platform: str = Form(...),
    caption: str = Form(...),
    image: UploadFile | None = File(None),
    like_count: int | None = Form(None),
):
    admin = require_admin(request)
    image_url = upload_example_image(image, admin["id"])
    row = create_example_post(
        None, business_category, platform, caption, image_url, admin["id"], like_count
    )
    return example_post_to_dict(row)


@app.put("/admin/example-posts/{post_id}")
@limiter.limit("60/minute")
def admin_update_example_post(
    post_id: int,
    request: Request,
    business_category: str = Form(...),
    platform: str = Form(...),
    caption: str = Form(...),
    image: UploadFile | None = File(None),
    like_count: int | None = Form(None),
):
    admin = require_admin(request)
    existing = get_example_post(post_id)
    if existing is None or existing["user_id"] is not None:
        raise HTTPException(status_code=404, detail="Example post not found")
    image_url = (
        upload_example_image(image, admin["id"])
        if image is not None and image.filename
        else existing["image_url"]
    )
    row = update_example_post(
        post_id, None, business_category, platform, caption, image_url, like_count
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Example post not found")
    return example_post_to_dict(row)


@app.patch("/admin/example-posts/{post_id}/rating")
@limiter.limit("60/minute")
def admin_rate_example_post(post_id: int, body: ExamplePostRatingWrite, request: Request):
    require_admin(request)
    row = set_example_post_rating(post_id, None, body.rating)
    if row is None:
        raise HTTPException(status_code=404, detail="Example post not found")
    return example_post_to_dict(row)


@app.delete("/admin/example-posts/{post_id}")
@limiter.limit("60/minute")
def admin_delete_example_post(post_id: int, request: Request):
    require_admin(request)
    deleted = delete_example_post(post_id, None)
    if not deleted:
        raise HTTPException(status_code=404, detail="Example post not found")
    return {"ok": True}


@app.post("/admin/example-posts/{post_id}/promote")
@limiter.limit("60/minute")
def admin_promote_example_post(post_id: int, request: Request):
    require_admin(request)
    row = promote_example_post_to_global(post_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Example post not found or already global")
    return example_post_to_dict(row)


@app.get("/admin/events")
@limiter.limit("60/minute")
def admin_list_events(request: Request):
    require_admin(request)
    today = datetime.now(timezone.utc).date()
    return {"events": [event_to_dict(row, today) for row in get_all_events()]}


@app.post("/admin/events")
@limiter.limit("60/minute")
def admin_create_event(body: EventWrite, request: Request):
    require_admin(request)
    row = create_event(None, body.name, body.month, body.day, body.suggestion_text)
    return event_to_dict(row, datetime.now(timezone.utc).date())


@app.put("/admin/events/{event_id}")
@limiter.limit("60/minute")
def admin_update_event(event_id: int, body: EventWrite, request: Request):
    require_admin(request)
    row = update_event(event_id, body.name, body.month, body.day, body.suggestion_text)
    if row is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return event_to_dict(row, datetime.now(timezone.utc).date())


@app.delete("/admin/events/{event_id}")
@limiter.limit("60/minute")
def admin_delete_event(event_id: int, request: Request):
    require_admin(request)
    deleted = delete_event(event_id, None)
    if not deleted:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"ok": True}
