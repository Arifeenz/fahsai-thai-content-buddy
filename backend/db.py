import os

import psycopg
from psycopg.rows import dict_row


def get_connection() -> psycopg.Connection:
    # prepare_threshold=None disables psycopg's server-side statement
    # caching. Supabase's connection string here is the transaction-mode
    # pooler (port 6543), which recycles the underlying backend connection
    # between clients — a cached prepared statement name from one psycopg
    # connection can collide with another's, raising
    # `DuplicatePreparedStatement`. Since every call here opens and closes
    # its own connection anyway, the caching this disables was never
    # providing real benefit.
    return psycopg.connect(
        os.environ["DATABASE_URL"], row_factory=dict_row, prepare_threshold=None
    )


def _add_column_if_missing(conn: psycopg.Connection, table: str, column_ddl: str) -> None:
    conn.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column_ddl}")


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
    _add_column_if_missing(
        conn, "users", "example_selection_mode TEXT NOT NULL DEFAULT 'latest'"
    )
    _add_column_if_missing(conn, "users", "is_demo BOOLEAN NOT NULL DEFAULT FALSE")

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
        CREATE TABLE IF NOT EXISTS social_links (
            user_id INTEGER NOT NULL REFERENCES users(id),
            platform TEXT NOT NULL,
            url TEXT NOT NULL DEFAULT '',
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, platform)
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

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS generation_log (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            platform TEXT NOT NULL,
            tone TEXT,
            prompt TEXT NOT NULL,
            caption TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    _add_column_if_missing(conn, "generation_log", "prompt_tokens INTEGER")
    _add_column_if_missing(conn, "generation_log", "completion_tokens INTEGER")
    _add_column_if_missing(conn, "generation_log", "estimated_cost_usd DOUBLE PRECISION")
    _add_column_if_missing(conn, "generation_log", "system_prompt TEXT")
    _add_column_if_missing(conn, "generation_log", "mode TEXT")
    _add_column_if_missing(conn, "content_items", "feedback TEXT")
    _add_column_if_missing(conn, "content_items", "mode TEXT")

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS example_posts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            business_category TEXT,
            platform TEXT NOT NULL,
            caption TEXT NOT NULL,
            image_url TEXT,
            created_by INTEGER NOT NULL REFERENCES users(id),
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    _add_column_if_missing(conn, "example_posts", "rating INTEGER")
    _add_column_if_missing(conn, "example_posts", "like_count INTEGER")

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS follower_snapshots (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            platform TEXT NOT NULL,
            follower_count INTEGER NOT NULL,
            recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS support_tickets (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            message TEXT NOT NULL,
            user_agent TEXT,
            resolved BOOLEAN NOT NULL DEFAULT FALSE,
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


def update_example_selection_mode(user_id: int, mode: str) -> dict | None:
    conn = get_connection()
    row = conn.execute(
        "UPDATE users SET example_selection_mode = %s WHERE id = %s RETURNING *",
        (mode, user_id),
    ).fetchone()
    conn.commit()
    conn.close()
    return row


def list_all_users(page: int = 1, page_size: int = 20) -> tuple[list[dict], int]:
    conn = get_connection()
    total = conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]
    rows = conn.execute(
        "SELECT * FROM users ORDER BY created_at DESC LIMIT %s OFFSET %s",
        (page_size, (page - 1) * page_size),
    ).fetchall()
    conn.close()
    return rows, total


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
    openai_spend_this_month = conn.execute(
        """
        SELECT COALESCE(SUM(estimated_cost_usd), 0) AS spend
        FROM generation_log
        WHERE created_at >= date_trunc('month', NOW())
        """
    ).fetchone()["spend"]
    conn.close()
    return {
        "total_users": total_users,
        "total_content": total_content,
        "new_users_week": new_users_week,
        "new_content_week": new_content_week,
        "security_events_week": security_events_week,
        "openai_spend_this_month": float(openai_spend_this_month),
    }


def get_approval_rate_by_mode() -> list[dict]:
    # "approved" = a content_item was ever saved for that generation mode
    # (create.tsx only calls saveContent on approve/copy, not on every
    # generate) -- generation_log and content_items aren't linked by a
    # foreign key, so this compares aggregate counts per mode, not a true
    # per-generation conversion rate.
    conn = get_connection()
    rows = conn.execute(
        """
        WITH generations AS (
            SELECT mode, COUNT(*) AS generations
            FROM generation_log
            WHERE mode IS NOT NULL
            GROUP BY mode
        ),
        approved AS (
            SELECT mode, COUNT(*) AS approved
            FROM content_items
            WHERE mode IS NOT NULL
            GROUP BY mode
        )
        SELECT
            COALESCE(g.mode, a.mode) AS mode,
            COALESCE(g.generations, 0) AS generations,
            COALESCE(a.approved, 0) AS approved
        FROM generations g
        FULL OUTER JOIN approved a ON a.mode = g.mode
        ORDER BY mode
        """
    ).fetchall()
    conn.close()
    return rows


def get_feedback_ratio_by_mode() -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT
            mode,
            COUNT(*) FILTER (WHERE feedback = 'good') AS good,
            COUNT(*) FILTER (WHERE feedback IS NOT NULL) AS total_rated
        FROM content_items
        WHERE mode IS NOT NULL
        GROUP BY mode
        ORDER BY mode
        """
    ).fetchall()
    conn.close()
    return rows


def get_dna_completeness_correlation() -> list[dict]:
    # Buckets users by how many of their 4 brand_dna fields are non-empty,
    # then compares generation/approval volume per bucket -- pre-aggregate
    # each metric per user_id in its own CTE before joining, so joining
    # users to both generation_log and content_items doesn't fan out and
    # inflate counts.
    conn = get_connection()
    rows = conn.execute(
        """
        WITH dna_completeness AS (
            SELECT user_id, COUNT(*) FILTER (WHERE content <> '') AS filled_count
            FROM brand_dna
            GROUP BY user_id
        ),
        gen_counts AS (
            SELECT user_id, COUNT(*) AS generations
            FROM generation_log
            GROUP BY user_id
        ),
        approved_counts AS (
            SELECT user_id, COUNT(*) AS approved
            FROM content_items
            GROUP BY user_id
        )
        SELECT
            COALESCE(d.filled_count, 0) AS filled_count,
            COUNT(DISTINCT u.id) AS user_count,
            COALESCE(SUM(g.generations), 0) AS total_generations,
            COALESCE(SUM(a.approved), 0) AS total_approved
        FROM users u
        LEFT JOIN dna_completeness d ON d.user_id = u.id
        LEFT JOIN gen_counts g ON g.user_id = u.id
        LEFT JOIN approved_counts a ON a.user_id = u.id
        GROUP BY COALESCE(d.filled_count, 0)
        ORDER BY filled_count
        """
    ).fetchall()
    conn.close()
    return rows


def get_retention_stats() -> dict:
    conn = get_connection()
    row = conn.execute(
        """
        WITH weeks_active AS (
            SELECT user_id, COUNT(DISTINCT date_trunc('week', created_at)) AS distinct_weeks
            FROM content_items
            GROUP BY user_id
        )
        SELECT
            COUNT(*) FILTER (WHERE distinct_weeks > 1) AS retained_users,
            COUNT(*) AS active_users
        FROM weeks_active
        """
    ).fetchone()
    conn.close()
    return row


def get_avg_days_to_first_content() -> float | None:
    conn = get_connection()
    row = conn.execute(
        """
        WITH first_content AS (
            SELECT user_id, MIN(created_at) AS first_content_at
            FROM content_items
            GROUP BY user_id
        )
        SELECT AVG(EXTRACT(EPOCH FROM (fc.first_content_at - u.created_at)) / 86400) AS avg_days
        FROM users u
        JOIN first_content fc ON fc.user_id = u.id
        """
    ).fetchone()
    conn.close()
    return float(row["avg_days"]) if row["avg_days"] is not None else None


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


def create_generation_log(
    user_id: int,
    platform: str,
    tone: str | None,
    prompt: str,
    caption: str,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
    estimated_cost_usd: float = 0,
    system_prompt: str | None = None,
    mode: str | None = None,
) -> None:
    conn = get_connection()
    conn.execute(
        """
        INSERT INTO generation_log
            (user_id, platform, tone, prompt, caption, prompt_tokens, completion_tokens, estimated_cost_usd, system_prompt, mode)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            user_id,
            platform,
            tone,
            prompt,
            caption,
            prompt_tokens,
            completion_tokens,
            estimated_cost_usd,
            system_prompt,
            mode,
        ),
    )
    conn.commit()
    conn.close()


def get_monthly_openai_spend() -> float:
    conn = get_connection()
    row = conn.execute(
        """
        SELECT COALESCE(SUM(estimated_cost_usd), 0) AS spend
        FROM generation_log
        WHERE created_at >= date_trunc('month', NOW())
        """
    ).fetchone()
    conn.close()
    return float(row["spend"])


def list_generation_logs(limit: int = 100) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT
            generation_log.*,
            users.name AS user_name,
            users.email AS user_email
        FROM generation_log
        LEFT JOIN users ON users.id = generation_log.user_id
        ORDER BY generation_log.created_at DESC
        LIMIT %s
        """,
        (limit,),
    ).fetchall()
    conn.close()
    return rows


def create_content_item(
    user_id: int, platform: str, preview: str, status: str, mode: str | None = None
) -> dict:
    conn = get_connection()
    row = conn.execute(
        "INSERT INTO content_items (user_id, platform, preview, status, mode) VALUES (%s, %s, %s, %s, %s) RETURNING *",
        (user_id, platform, preview, status, mode),
    ).fetchone()
    conn.commit()
    conn.close()
    return row


def set_content_feedback(content_id: int, user_id: int, feedback: str) -> dict | None:
    conn = get_connection()
    row = conn.execute(
        "UPDATE content_items SET feedback = %s WHERE id = %s AND user_id = %s RETURNING *",
        (feedback, content_id, user_id),
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


def list_all_content(page: int = 1, page_size: int = 20) -> tuple[list[dict], int]:
    conn = get_connection()
    total = conn.execute("SELECT COUNT(*) AS n FROM content_items").fetchone()["n"]
    rows = conn.execute(
        """
        SELECT content_items.*, users.name AS owner_name, users.email AS owner_email
        FROM content_items
        JOIN users ON users.id = content_items.user_id
        ORDER BY content_items.created_at DESC
        LIMIT %s OFFSET %s
        """,
        (page_size, (page - 1) * page_size),
    ).fetchall()
    conn.close()
    return rows, total


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


def create_example_post(
    user_id: int | None,
    business_category: str | None,
    platform: str,
    caption: str,
    image_url: str | None,
    created_by: int,
    like_count: int | None = None,
) -> dict:
    conn = get_connection()
    row = conn.execute(
        """
        INSERT INTO example_posts (user_id, business_category, platform, caption, image_url, created_by, like_count)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (user_id, business_category, platform, caption, image_url, created_by, like_count),
    ).fetchone()
    conn.commit()
    conn.close()
    return row


_EXAMPLE_SELECTION_ORDER_BY = {
    "latest": "created_at DESC",
    "rating": "rating DESC NULLS LAST, created_at DESC",
    "likes": "like_count DESC NULLS LAST, created_at DESC",
    "random": "RANDOM()",
}


def list_example_posts_for_generation(
    user_id: int,
    business_category: str | None,
    platform: str,
    mode: str = "latest",
    personal_limit: int = 2,
    global_limit: int = 2,
) -> list[dict]:
    order_by = _EXAMPLE_SELECTION_ORDER_BY.get(mode, _EXAMPLE_SELECTION_ORDER_BY["latest"])
    conn = get_connection()
    personal = conn.execute(
        f"""
        SELECT * FROM example_posts
        WHERE user_id = %s AND platform = %s
        ORDER BY {order_by}
        LIMIT %s
        """,
        (user_id, platform, personal_limit),
    ).fetchall()
    global_rows = conn.execute(
        f"""
        SELECT * FROM example_posts
        WHERE user_id IS NULL AND platform = %s
            AND (business_category = %s OR business_category IS NULL)
        ORDER BY {order_by}
        LIMIT %s
        """,
        (platform, business_category, global_limit),
    ).fetchall()
    conn.close()
    return [*personal, *global_rows]


def list_example_posts_for_user(user_id: int) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM example_posts WHERE user_id = %s ORDER BY created_at DESC", (user_id,)
    ).fetchall()
    conn.close()
    return rows


def list_all_example_posts(
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    platform: str | None = None,
    business_category: str | None = None,
    ownership: str | None = None,
) -> tuple[list[dict], int]:
    conn = get_connection()
    where_sql = "WHERE 1=1"
    params: list = []
    if search:
        where_sql += " AND example_posts.caption ILIKE %s"
        params.append(f"%{search}%")
    if platform:
        where_sql += " AND example_posts.platform = %s"
        params.append(platform)
    if business_category:
        where_sql += " AND example_posts.business_category = %s"
        params.append(business_category)
    if ownership == "global":
        where_sql += " AND example_posts.user_id IS NULL"
    elif ownership == "personal":
        where_sql += " AND example_posts.user_id IS NOT NULL"
    total = conn.execute(
        f"SELECT COUNT(*) AS n FROM example_posts {where_sql}", params
    ).fetchone()["n"]
    rows = conn.execute(
        f"""
        SELECT example_posts.*, users.name AS owner_name, users.email AS owner_email
        FROM example_posts
        LEFT JOIN users ON users.id = example_posts.user_id
        {where_sql}
        ORDER BY example_posts.created_at DESC
        LIMIT %s OFFSET %s
        """,
        params + [page_size, (page - 1) * page_size],
    ).fetchall()
    conn.close()
    return rows, total


def list_example_post_categories() -> list[str]:
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT DISTINCT business_category FROM example_posts
        WHERE business_category IS NOT NULL
        ORDER BY business_category
        """
    ).fetchall()
    conn.close()
    return [row["business_category"] for row in rows]


def delete_example_post(post_id: int, owner_user_id: int | None) -> bool:
    conn = get_connection()
    if owner_user_id is None:
        cur = conn.execute(
            "DELETE FROM example_posts WHERE id = %s AND user_id IS NULL", (post_id,)
        )
    else:
        cur = conn.execute(
            "DELETE FROM example_posts WHERE id = %s AND user_id = %s", (post_id, owner_user_id)
        )
    conn.commit()
    deleted = cur.rowcount > 0
    conn.close()
    return deleted


def get_example_post(post_id: int) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM example_posts WHERE id = %s", (post_id,)).fetchone()
    conn.close()
    return row


def update_example_post(
    post_id: int,
    owner_user_id: int | None,
    business_category: str | None,
    platform: str,
    caption: str,
    image_url: str | None,
    like_count: int | None = None,
) -> dict | None:
    conn = get_connection()
    if owner_user_id is None:
        row = conn.execute(
            """
            UPDATE example_posts
            SET business_category = %s, platform = %s, caption = %s, image_url = %s, like_count = %s
            WHERE id = %s AND user_id IS NULL
            RETURNING *
            """,
            (business_category, platform, caption, image_url, like_count, post_id),
        ).fetchone()
    else:
        row = conn.execute(
            """
            UPDATE example_posts
            SET business_category = %s, platform = %s, caption = %s, image_url = %s, like_count = %s
            WHERE id = %s AND user_id = %s
            RETURNING *
            """,
            (business_category, platform, caption, image_url, like_count, post_id, owner_user_id),
        ).fetchone()
    conn.commit()
    conn.close()
    return row


def set_example_post_rating(post_id: int, owner_user_id: int | None, rating: int) -> dict | None:
    conn = get_connection()
    if owner_user_id is None:
        row = conn.execute(
            "UPDATE example_posts SET rating = %s WHERE id = %s AND user_id IS NULL RETURNING *",
            (rating, post_id),
        ).fetchone()
    else:
        row = conn.execute(
            "UPDATE example_posts SET rating = %s WHERE id = %s AND user_id = %s RETURNING *",
            (rating, post_id, owner_user_id),
        ).fetchone()
    conn.commit()
    conn.close()
    return row


def promote_example_post_to_global(post_id: int) -> dict | None:
    conn = get_connection()
    source = conn.execute(
        "SELECT * FROM example_posts WHERE id = %s AND user_id IS NOT NULL", (post_id,)
    ).fetchone()
    if source is None:
        conn.close()
        return None
    row = conn.execute(
        """
        INSERT INTO example_posts (user_id, business_category, platform, caption, image_url, created_by)
        VALUES (NULL, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            source["business_category"],
            source["platform"],
            source["caption"],
            source["image_url"],
            source["created_by"],
        ),
    ).fetchone()
    conn.commit()
    conn.close()
    return row


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


# One shared, public login per business category so a visitor can try the
# product before signing up. Seeded with realistic brand_dna content so the
# demo isn't an empty shell on first login. No password_hash is set, so
# these can never be logged into through the normal /auth/login form —
# only through the dedicated /auth/demo-login endpoint.
DEMO_ACCOUNTS: dict[str, dict] = {
    "food_beverage": {
        "email": "demo-food_beverage@fahsai.demo",
        "name": "บัญชีทดลอง - ร้านอาหาร/เครื่องดื่ม",
        "dna": {
            "history": "ร้านกาแฟเปิดที่ยะลาปี 2565 เริ่มจากคั่วเมล็ดในบ้านเล็กๆ ก่อนขยายเป็นคาเฟ่ริมถนน",
            "menu": "กาแฟดริป ลาเต้ อเมริกาโน่ กาแฟส้ม เค้กมะพร้าว ชาชักใต้",
            "usp": "เมล็ดคั่วสดใหม่ทุกวัน บรรยากาศอบอุ่นแบบชายแดนใต้ พนักงานพูดได้สามภาษา",
            "tone": "อบอุ่น เป็นกันเอง ใช้คำว่า 'ค่ะ/ครับ' พูดเหมือนเพื่อนบ้านทักทาย ไม่เป็นทางการ",
        },
    },
    "online_shop": {
        "email": "demo-online_shop@fahsai.demo",
        "name": "บัญชีทดลอง - ขายของออนไลน์",
        "dna": {
            "history": "เปิดร้านขายออนไลน์ปี 2566 เริ่มจากขายในเฟซบุ๊ก ก่อนขยายมาขายใน Shopee/Lazada",
            "menu": "เสื้อยืดคอกลมพิมพ์ลาย กระเป๋าหนังแท้ ครีมบำรุงผิวหน้าสูตรอ่อนโยน",
            "usp": "ส่งไวภายใน 24 ชม. การันตีของแท้ 100% แพ็คสินค้าอย่างดี",
            "tone": "อบอุ่น เป็นกันเอง ใช้คำว่า 'ค่ะ/ครับ' พูดเหมือนเพื่อนบ้านทักทาย ไม่เป็นทางการ",
        },
    },
    "fortune_telling": {
        "email": "demo-fortune_telling@fahsai.demo",
        "name": "บัญชีทดลอง - ดูดวง",
        "dna": {
            "history": "ดูดวงมากว่า 10 ปี เรียนโหราศาสตร์ไทยจากอาจารย์ต้นตำรับ เปิดดูที่ยะลาตั้งแต่ปี 2560",
            "menu": "ไพ่ยิปซี โหราศาสตร์ไทย ดูดวงเบอร์โทร เสริมดวงฮวงจุ้ย",
            "usp": "ทำนายแม่นตรงจุด ให้คำปรึกษาแบบเข้าใจง่าย นัดดูผ่านออนไลน์ได้ทุกที่",
            "tone": "อบอุ่น เป็นกันเอง ใช้คำว่า 'ค่ะ/ครับ' พูดเหมือนเพื่อนบ้านทักทาย ไม่เป็นทางการ",
        },
    },
    "streamer": {
        "email": "demo-streamer@fahsai.demo",
        "name": "บัญชีทดลอง - สตรีมเมอร์/เกมเมอร์",
        "dna": {
            "history": "เริ่มสตรีมปี 2564 จากความชอบเล่นเกม FPS ตอนนี้ไลฟ์ประจำ 4 วันต่อสัปดาห์",
            "menu": "Valorant ไต่แรงค์ทุกคืน, Free Fire คู่หูสองคน, เล่นเกมสยองขวัญวันศุกร์",
            "usp": "มุกตลกเฉพาะตัว พูดคุยกับแชทตลอดเวลา เล่นเกมแนวสยองขวัญเป็นประจำ",
            "tone": "อบอุ่น เป็นกันเอง ใช้คำว่า 'ค่ะ/ครับ' พูดเหมือนเพื่อนบ้านทักทาย ไม่เป็นทางการ",
        },
    },
}


def ensure_demo_users() -> None:
    conn = get_connection()
    for category, info in DEMO_ACCOUNTS.items():
        existing = conn.execute(
            "SELECT id FROM users WHERE email = %s", (info["email"],)
        ).fetchone()
        if existing is not None:
            continue
        row = conn.execute(
            """
            INSERT INTO users (email, name, role, business_category, is_demo, email_verified)
            VALUES (%s, %s, 'user', %s, TRUE, TRUE)
            RETURNING id
            """,
            (info["email"], info["name"], category),
        ).fetchone()
        for doc_type, content in info["dna"].items():
            conn.execute(
                """
                INSERT INTO brand_dna (user_id, doc_type, content)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id, doc_type) DO NOTHING
                """,
                (row["id"], doc_type, content),
            )
    conn.commit()
    conn.close()


def get_demo_user_by_category(business_category: str) -> dict | None:
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM users WHERE is_demo = TRUE AND business_category = %s LIMIT 1",
        (business_category,),
    ).fetchone()
    conn.close()
    return row


SOCIAL_LINK_PLATFORMS = ["facebook", "instagram", "line", "tiktok", "youtube", "twitch"]


def get_social_links(user_id: int) -> dict[str, str]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT platform, url FROM social_links WHERE user_id = %s", (user_id,)
    ).fetchall()
    conn.close()
    links = {p: "" for p in SOCIAL_LINK_PLATFORMS}
    for row in rows:
        if row["platform"] in links:
            links[row["platform"]] = row["url"]
    return links


def upsert_social_links(user_id: int, links: dict[str, str]) -> dict[str, str]:
    conn = get_connection()
    for platform in SOCIAL_LINK_PLATFORMS:
        conn.execute(
            """
            INSERT INTO social_links (user_id, platform, url, updated_at)
            VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, platform) DO UPDATE SET
                url = excluded.url,
                updated_at = CURRENT_TIMESTAMP
            """,
            (user_id, platform, links.get(platform, "")),
        )
    conn.commit()
    conn.close()
    return get_social_links(user_id)


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


def create_follower_snapshot(user_id: int, platform: str, follower_count: int) -> dict:
    conn = get_connection()
    row = conn.execute(
        """
        INSERT INTO follower_snapshots (user_id, platform, follower_count)
        VALUES (%s, %s, %s)
        RETURNING *
        """,
        (user_id, platform, follower_count),
    ).fetchone()
    conn.commit()
    conn.close()
    return row


def list_follower_snapshots_for_user(user_id: int) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM follower_snapshots WHERE user_id = %s ORDER BY recorded_at ASC",
        (user_id,),
    ).fetchall()
    conn.close()
    return rows


def create_support_ticket(user_id: int, message: str, user_agent: str | None) -> dict:
    conn = get_connection()
    row = conn.execute(
        """
        INSERT INTO support_tickets (user_id, message, user_agent)
        VALUES (%s, %s, %s)
        RETURNING *
        """,
        (user_id, message, user_agent),
    ).fetchone()
    conn.commit()
    conn.close()
    return row


def list_support_tickets(page: int = 1, page_size: int = 20) -> tuple[list[dict], int]:
    conn = get_connection()
    total = conn.execute("SELECT COUNT(*) AS n FROM support_tickets").fetchone()["n"]
    rows = conn.execute(
        """
        SELECT support_tickets.*, users.name AS user_name, users.email AS user_email
        FROM support_tickets
        JOIN users ON users.id = support_tickets.user_id
        ORDER BY support_tickets.resolved ASC, support_tickets.created_at DESC
        LIMIT %s OFFSET %s
        """,
        (page_size, (page - 1) * page_size),
    ).fetchall()
    conn.close()
    return rows, total


def set_support_ticket_resolved(ticket_id: int, resolved: bool) -> dict | None:
    conn = get_connection()
    row = conn.execute(
        "UPDATE support_tickets SET resolved = %s WHERE id = %s RETURNING *",
        (resolved, ticket_id),
    ).fetchone()
    conn.commit()
    conn.close()
    return row
