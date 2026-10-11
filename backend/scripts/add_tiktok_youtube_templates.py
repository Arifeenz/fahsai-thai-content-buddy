"""Adds the TikTok/YouTube fallback caption templates to an EXISTING database.

prompt_templates is only seeded when empty, so a database that already has
rows (production) never receives db.NEW_PLATFORM_TEMPLATES on its own. This
script inserts each of those templates whose exact text isn't already there
-- safe to re-run, never updates or deletes anything.

Dry run by default (prints what it would insert). To write:
    python scripts/add_tiktok_youtube_templates.py --apply
Run scripts/backup_db.py first, and check the printed target host.
"""

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

import db


def main() -> None:
    apply = "--apply" in sys.argv
    host = re.sub(r".*@([^:/]+).*", r"\1", os.environ["DATABASE_URL"])
    print(f"Target database host: {host}")
    print("Mode:", "APPLY (will insert)" if apply else "DRY RUN (no changes)")

    conn = db.get_connection()
    to_insert = []
    for category, platform, text in db.NEW_PLATFORM_TEMPLATES:
        exists = conn.execute(
            """
            SELECT 1 FROM prompt_templates
            WHERE business_category = %s AND platform = %s AND template_text = %s
            """,
            (category, platform, text),
        ).fetchone()
        status = "skip (already there)" if exists else "insert"
        print(f"  [{status}] {category} / {platform}: {text[:60]}")
        if not exists:
            to_insert.append((category, platform, text))

    if apply and to_insert:
        conn.cursor().executemany(
            "INSERT INTO prompt_templates (business_category, platform, tone, template_text)"
            " VALUES (%s, %s, NULL, %s)",
            to_insert,
        )
        conn.commit()
    conn.close()
    verb = "Inserted" if apply else "Would insert"
    print(f"{verb} {len(to_insert)} of {len(db.NEW_PLATFORM_TEMPLATES)} templates.")


if __name__ == "__main__":
    main()
