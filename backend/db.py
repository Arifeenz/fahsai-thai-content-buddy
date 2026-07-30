import os

import psycopg
from psycopg.rows import dict_row


def get_connection() -> psycopg.Connection:
    return psycopg.connect(os.environ["DATABASE_URL"], row_factory=dict_row)


def init_db() -> None:
    conn = get_connection()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            google_sub TEXT UNIQUE,
            password_hash TEXT,
            email TEXT NOT NULL UNIQUE,
            name TEXT,
            picture TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_login_at TIMESTAMP,
            role TEXT NOT NULL DEFAULT 'user',
            business_category TEXT,
            hide_global_events BOOLEAN NOT NULL DEFAULT FALSE,
            email_verified BOOLEAN NOT NULL DEFAULT FALSE,
            verification_token TEXT,
            verification_token_expires TIMESTAMP,
            reset_token TEXT,
            reset_token_expires TIMESTAMP
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS content_items (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            platform TEXT NOT NULL,
            preview TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS prompt_templates (
            id SERIAL PRIMARY KEY,
            business_category TEXT,
            platform TEXT NOT NULL,
            tone TEXT,
            template_text TEXT NOT NULL,
            created_by INTEGER REFERENCES users(id),
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS brand_dna (
            user_id INTEGER NOT NULL REFERENCES users(id),
            doc_type TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, doc_type)
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS events (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            name TEXT NOT NULL,
            month INTEGER NOT NULL,
            day INTEGER NOT NULL,
            suggestion_text TEXT NOT NULL DEFAULT ''
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS security_events (
            id SERIAL PRIMARY KEY,
            event_type TEXT NOT NULL,
            identifier TEXT NOT NULL,
            endpoint TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    event_count = conn.execute("SELECT COUNT(*) AS n FROM events").fetchone()["n"]
    if event_count == 0:
        conn.cursor().executemany(
            "INSERT INTO events (name, month, day, suggestion_text) VALUES (%s, %s, %s, %s)",
            [
                ("ปีใหม่", 1, 1, "ลองโพสต์อวยพรปีใหม่พร้อมโปรโมชั่นต้อนรับปีใหม่ดูไหมคะ"),
                ("วันเด็กแห่งชาติ", 1, 13, "ร้านมีโปรสำหรับครอบครัว/เด็กๆ ไหมคะ ลองโพสต์ชวนเลย"),
                ("วาเลนไทน์", 2, 14, "ลองทำเซ็ตคู่รักหรือโปรโมชั่นวาเลนไทน์ดูไหมคะ"),
                ("สงกรานต์", 4, 13, "ช่วงสงกรานต์คนเดินทางกลับบ้านเยอะ ลองโพสต์เมนูคลายร้อนดูไหมคะ"),
                ("วันแม่แห่งชาติ", 8, 12, "ลองโพสต์โปรโมชั่นชวนลูกๆ พาแม่มาร้านดูไหมคะ"),
                ("วันลอยกระทง", 11, 15, "บรรยากาศงานลอยกระทง ลองโพสต์ชวนลูกค้ามาถ่ายรูปที่ร้านดูไหมคะ"),
                ("Black Friday", 11, 29, "ลองทำโปรโมชั่นลดราคาพิเศษช่วง Black Friday ดูไหมคะ"),
                ("วันพ่อแห่งชาติ", 12, 5, "ลองโพสต์โปรโมชั่นชวนลูกๆ พาพ่อมาร้านดูไหมคะ"),
                ("คริสต์มาส", 12, 25, "ลองแต่งร้าน/ทำเมนูธีมคริสต์มาสแล้วโพสต์อวดลูกค้าดูไหมคะ"),
                ("ส่งท้ายปีเก่า", 12, 31, "ลองโพสต์ขอบคุณลูกค้าที่อุดหนุนกันมาตลอดปีดูไหมคะ"),
            ],
        )

    # Seed a few generic (no business_category) templates so /generate has
    # something to pick from before an admin has curated anything.
    template_count = conn.execute("SELECT COUNT(*) AS n FROM prompt_templates").fetchone()["n"]
    if template_count == 0:
        conn.cursor().executemany(
            "INSERT INTO prompt_templates (business_category, platform, tone, template_text) VALUES (NULL, %s, NULL, %s)",
            [
                (
                    "facebook",
                    "☕ ตื่นเช้ามาที่ยะลาวันนี้ กลิ่นกาแฟหอมกรุ่นรอคุณอยู่นะคะ ✨\nร้านเราคั่วเมล็ดใหม่ทุกวัน หวานนิดขมกำลังดี ดื่มแล้วสดชื่นทั้งวัน 🌤️\nแวะมาทักทายกันได้เลยค่ะ เปิดตั้งแต่ 7 โมงเช้า ถึง 5 โมงเย็น\n#กาแฟยะลา #ร้านกาแฟใต้ #FAHSAI",
                ),
                (
                    "facebook",
                    "พิเศษวันนี้! ☀️ เมนูกาแฟส้มสูตรฟ้าใส หวานเปรี้ยวลงตัว เย็นชื่นใจ\nสั่ง 2 แก้วลด 20 บาท เฉพาะช่วงบ่ายเท่านั้นนะคะ\nแวะมาลองกันได้ที่ร้านค่ะ 💛",
                ),
                (
                    "line",
                    "สวัสดีค่ะลูกค้าคนเก่ง 💛\nวันนี้ร้านเรามีเมนูใหม่ 'ลาเต้มะพร้าวยะลา' หวานมันกลมกล่อม สั่งผ่าน LINE รับส่วนลด 10% เลยค่ะ\nพิมพ์ 'สั่ง' เพื่อสั่งเลยนะคะ ☕✨",
                ),
                (
                    "instagram",
                    "sun-kissed mornings in Yala ☀️☕\nลาเต้แก้วโปรดของคุณ พร้อมเสิร์ฟที่ FAHSAI Coffee\nเปิดทุกวัน 7:00–17:00\n·\n·\n#yalacoffee #southernthailand #specialtycoffee #ฟ้าใส",
                ),
            ],
        )

    conn.commit()
    conn.close()


def upsert_google_user(
    google_sub: str, email: str, name: str | None, picture: str | None, role: str
) -> dict:
    conn = get_connection()
    row = conn.execute(
        """
        INSERT INTO users (google_sub, email, name, picture, last_login_at, role, email_verified)
        VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP, %s, TRUE)
        ON CONFLICT(google_sub) DO UPDATE SET
            email = excluded.email,
            name = excluded.name,
            picture = excluded.picture,
            last_login_at = CURRENT_TIMESTAMP,
            role = excluded.role,
            email_verified = TRUE
        RETURNING *
        """,
        (google_sub, email, name, picture, role),
    ).fetchone()
    conn.commit()
    conn.close()
    return row


def get_user_by_id(user_id: int) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone()
    conn.close()
    return row


def get_user_by_email(email: str) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM users WHERE email = %s", (email,)).fetchone()
    conn.close()
    return row


def create_email_user(email: str, password_hash: str, name: str, role: str) -> dict:
    conn = get_connection()
    row = conn.execute(
        """
        INSERT INTO users (email, password_hash, name, role, last_login_at)
        VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
        RETURNING *
        """,
        (email, password_hash, name, role),
    ).fetchone()
    conn.commit()
    conn.close()
    return row


def set_verification_token(user_id: int, token: str, expires_at: str) -> None:
    conn = get_connection()
    conn.execute(
        "UPDATE users SET verification_token = %s, verification_token_expires = %s WHERE id = %s",
        (token, expires_at, user_id),
    )
    conn.commit()
    conn.close()


def verify_email_by_token(token: str) -> dict | None:
    conn = get_connection()
    row = conn.execute(
        """
        SELECT * FROM users
        WHERE verification_token = %s AND verification_token_expires >= CURRENT_TIMESTAMP
        """,
        (token,),
    ).fetchone()
    if row is None:
        conn.close()
        return None
    row = conn.execute(
        """
        UPDATE users
        SET email_verified = TRUE, verification_token = NULL, verification_token_expires = NULL
        WHERE id = %s
        RETURNING *
        """,
        (row["id"],),
    ).fetchone()
    conn.commit()
    conn.close()
    return row


def set_reset_token(user_id: int, token: str, expires_at: str) -> None:
    conn = get_connection()
    conn.execute(
        "UPDATE users SET reset_token = %s, reset_token_expires = %s WHERE id = %s",
        (token, expires_at, user_id),
    )
    conn.commit()
    conn.close()


def get_user_by_reset_token(token: str) -> dict | None:
    conn = get_connection()
    row = conn.execute(
        """
        SELECT * FROM users
        WHERE reset_token = %s AND reset_token_expires >= CURRENT_TIMESTAMP
        """,
        (token,),
    ).fetchone()
    conn.close()
    return row


def reset_password(user_id: int, password_hash: str) -> None:
    conn = get_connection()
    conn.execute(
        """
        UPDATE users
        SET password_hash = %s, reset_token = NULL, reset_token_expires = NULL
        WHERE id = %s
        """,
        (password_hash, user_id),
    )
    conn.commit()
    conn.close()


def touch_last_login(user_id: int) -> dict | None:
    conn = get_connection()
    row = conn.execute(
        "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = %s RETURNING *",
        (user_id,),
    ).fetchone()
    conn.commit()
    conn.close()
    return row


def update_business_category(user_id: int, business_category: str) -> dict | None:
    conn = get_connection()
    row = conn.execute(
        "UPDATE users SET business_category = %s WHERE id = %s RETURNING *",
        (business_category, user_id),
    ).fetchone()
    conn.commit()
    conn.close()
    return row


def update_hide_global_events(user_id: int, hide: bool) -> dict | None:
    conn = get_connection()
    row = conn.execute(
        "UPDATE users SET hide_global_events = %s WHERE id = %s RETURNING *",
        (hide, user_id),
    ).fetchone()
    conn.commit()
    conn.close()
    return row


def list_all_users() -> list[dict]:
    conn = get_connection()
    rows = conn.execute("SELECT * FROM users ORDER BY created_at DESC").fetchall()
    conn.close()
    return rows


def get_admin_stats() -> dict:
    conn = get_connection()
    total_users = conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]
    total_content = conn.execute("SELECT COUNT(*) AS n FROM content_items").fetchone()["n"]
    new_users_week = conn.execute(
        "SELECT COUNT(*) AS n FROM users WHERE created_at >= NOW() - INTERVAL '7 days'"
    ).fetchone()["n"]
    new_content_week = conn.execute(
        "SELECT COUNT(*) AS n FROM content_items WHERE created_at >= NOW() - INTERVAL '7 days'"
    ).fetchone()["n"]
    security_events_week = conn.execute(
        "SELECT COUNT(*) AS n FROM security_events WHERE created_at >= NOW() - INTERVAL '7 days'"
    ).fetchone()["n"]
    conn.close()
    return {
        "total_users": total_users,
        "total_content": total_content,
        "new_users_week": new_users_week,
        "new_content_week": new_content_week,
        "security_events_week": security_events_week,
    }


def log_security_event(event_type: str, identifier: str, endpoint: str) -> None:
    conn = get_connection()
    conn.execute(
        "INSERT INTO security_events (event_type, identifier, endpoint) VALUES (%s, %s, %s)",
        (event_type, identifier, endpoint),
    )
    conn.commit()
    conn.close()


def list_security_events(limit: int = 50) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT
            security_events.*,
            users.name AS user_name,
            users.email AS user_email
        FROM security_events
        LEFT JOIN users
            ON security_events.identifier = 'user:' || users.id::text
        ORDER BY security_events.created_at DESC
        LIMIT %s
        """,
        (limit,),
    ).fetchall()
    conn.close()
    return rows


def create_content_item(user_id: int, platform: str, preview: str, status: str) -> dict:
    conn = get_connection()
    row = conn.execute(
        "INSERT INTO content_items (user_id, platform, preview, status) VALUES (%s, %s, %s, %s) RETURNING *",
        (user_id, platform, preview, status),
    ).fetchone()
    conn.commit()
    conn.close()
    return row


def list_content_for_user(user_id: int) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM content_items WHERE user_id = %s ORDER BY created_at DESC", (user_id,)
    ).fetchall()
    conn.close()
    return rows


def list_all_content() -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT content_items.*, users.name AS owner_name, users.email AS owner_email
        FROM content_items
        JOIN users ON users.id = content_items.user_id
        ORDER BY content_items.created_at DESC
        """
    ).fetchall()
    conn.close()
    return rows


def list_prompt_templates(
    business_category: str | None = None, platform: str | None = None
) -> list[dict]:
    conn = get_connection()
    query = "SELECT * FROM prompt_templates WHERE 1=1"
    params: list[str] = []
    if business_category:
        query += " AND (business_category = %s OR business_category IS NULL)"
        params.append(business_category)
    if platform:
        query += " AND platform = %s"
        params.append(platform)
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return rows


def create_prompt_template(
    business_category: str | None, platform: str, tone: str | None, template_text: str, created_by: int
) -> dict:
    conn = get_connection()
    row = conn.execute(
        """
        INSERT INTO prompt_templates (business_category, platform, tone, template_text, created_by)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING *
        """,
        (business_category, platform, tone, template_text, created_by),
    ).fetchone()
    conn.commit()
    conn.close()
    return row


def update_prompt_template(
    template_id: int,
    business_category: str | None,
    platform: str,
    tone: str | None,
    template_text: str,
) -> dict | None:
    conn = get_connection()
    row = conn.execute(
        """
        UPDATE prompt_templates
        SET business_category = %s, platform = %s, tone = %s, template_text = %s, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        RETURNING *
        """,
        (business_category, platform, tone, template_text, template_id),
    ).fetchone()
    conn.commit()
    conn.close()
    return row


def delete_prompt_template(template_id: int) -> None:
    conn = get_connection()
    conn.execute("DELETE FROM prompt_templates WHERE id = %s", (template_id,))
    conn.commit()
    conn.close()


DNA_DOC_TYPES = ["history", "menu", "usp", "tone"]


def get_brand_dna(user_id: int) -> dict[str, str]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT doc_type, content FROM brand_dna WHERE user_id = %s", (user_id,)
    ).fetchall()
    conn.close()
    docs = {t: "" for t in DNA_DOC_TYPES}
    for row in rows:
        docs[row["doc_type"]] = row["content"]
    return docs


def upsert_brand_dna(user_id: int, docs: dict[str, str]) -> dict[str, str]:
    conn = get_connection()
    for doc_type in DNA_DOC_TYPES:
        conn.execute(
            """
            INSERT INTO brand_dna (user_id, doc_type, content, updated_at)
            VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, doc_type) DO UPDATE SET
                content = excluded.content,
                updated_at = CURRENT_TIMESTAMP
            """,
            (user_id, doc_type, docs.get(doc_type, "")),
        )
    conn.commit()
    conn.close()
    return get_brand_dna(user_id)


def get_all_events() -> list[dict]:
    conn = get_connection()
    rows = conn.execute("SELECT * FROM events WHERE user_id IS NULL").fetchall()
    conn.close()
    return rows


def list_events_for_user(user_id: int, hide_global: bool = False) -> list[dict]:
    conn = get_connection()
    if hide_global:
        rows = conn.execute("SELECT * FROM events WHERE user_id = %s", (user_id,)).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM events WHERE user_id IS NULL OR user_id = %s", (user_id,)
        ).fetchall()
    conn.close()
    return rows


def create_event(
    user_id: int | None, name: str, month: int, day: int, suggestion_text: str = ""
) -> dict:
    conn = get_connection()
    row = conn.execute(
        "INSERT INTO events (user_id, name, month, day, suggestion_text) VALUES (%s, %s, %s, %s, %s) RETURNING *",
        (user_id, name, month, day, suggestion_text),
    ).fetchone()
    conn.commit()
    conn.close()
    return row


def update_event(
    event_id: int, name: str, month: int, day: int, suggestion_text: str
) -> dict | None:
    conn = get_connection()
    row = conn.execute(
        "UPDATE events SET name = %s, month = %s, day = %s, suggestion_text = %s WHERE id = %s AND user_id IS NULL RETURNING *",
        (name, month, day, suggestion_text, event_id),
    ).fetchone()
    conn.commit()
    conn.close()
    return row


def delete_event(event_id: int, owner_user_id: int | None) -> bool:
    conn = get_connection()
    if owner_user_id is None:
        cur = conn.execute("DELETE FROM events WHERE id = %s AND user_id IS NULL", (event_id,))
    else:
        cur = conn.execute(
            "DELETE FROM events WHERE id = %s AND user_id = %s", (event_id, owner_user_id)
        )
    conn.commit()
    deleted = cur.rowcount > 0
    conn.close()
    return deleted
