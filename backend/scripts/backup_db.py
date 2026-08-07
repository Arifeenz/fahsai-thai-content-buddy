"""Dumps every application table to a timestamped, restorable SQL file.

Run before any risky direct-database work (manual migrations, one-off
scripts, ad-hoc SQL) so a local snapshot exists no matter what happens to
the live database. Output goes to backend/backups/, which is gitignored --
these files contain real user emails and must never be committed.

Usage: python scripts/backup_db.py
"""

import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

import db

TABLES = [
    "users",
    "brand_dna",
    "content_items",
    "prompt_templates",
    "example_posts",
    "events",
    "quotes",
    "generation_log",
    "security_events",
    "social_links",
    "follower_snapshots",
    "support_tickets",
]


def escape(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def main() -> None:
    conn = db.get_connection()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backups_dir = os.path.join(os.path.dirname(__file__), "..", "backups")
    os.makedirs(backups_dir, exist_ok=True)
    out_path = os.path.join(backups_dir, f"backup_{timestamp}.sql")

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(f"-- FAHSAI database backup, {timestamp} UTC\n")
        f.write("-- Restore: run this file's INSERT statements against an empty copy\n")
        f.write("-- of the schema (init_db() creates the tables/columns first).\n\n")
        total_rows = 0
        for table in TABLES:
            rows = conn.execute(f"SELECT * FROM {table}").fetchall()
            if not rows:
                f.write(f"-- {table}: 0 rows\n\n")
                continue
            total_rows += len(rows)
            columns = list(rows[0].keys())
            col_list = ", ".join(columns)
            f.write(f"-- {table}: {len(rows)} rows\n")
            for row in rows:
                values = ", ".join(escape(row[c]) for c in columns)
                f.write(f"INSERT INTO {table} ({col_list}) VALUES ({values});\n")
            f.write("\n")

    conn.close()
    print(f"Backed up {total_rows} rows across {len(TABLES)} tables to {out_path}")


if __name__ == "__main__":
    main()
