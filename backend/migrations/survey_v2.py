"""Survey v2 (25 items, 5 dimensions) alongside the existing v1 rows.

Additive and idempotent -- safe to run on every startup (init_db() calls
apply()) and safe to re-run by hand. Existing v1 rows are never updated or
deleted: they keep survey_version = 1 via the column default.

Changes:
  1. survey_version SMALLINT NOT NULL DEFAULT 1
  2. q1..q10 (v1 answers) become nullable -- a v2 row has no v1 answers
  3. a1_1..a5_5 (v2 answers) SMALLINT, CHECK 1-5, nullable
  4. a CHECK that each row carries exactly its own version's answers
  5. one-response-per-account becomes one per (account, version), still
     excluding shared demo accounts

Why 25 columns rather than one jsonb `answers` column: the database itself
enforces 1-5 per item (as it already does for q1..q10), the CSV export and
statistics map 1:1 to the questionnaire's item numbers, and SPSS/Excel users
get the same "one column per item" layout as v1.

Run by hand (TEST database only):  python -m migrations.survey_v2
"""

V1_COLUMNS = [f"q{i}" for i in range(1, 11)]
V2_COLUMNS = [f"a{d}_{i}" for d in range(1, 6) for i in range(1, 6)]


def apply(conn) -> None:
    conn.execute(
        "ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS survey_version SMALLINT NOT NULL DEFAULT 1"
    )
    for col in V1_COLUMNS:
        conn.execute(f"ALTER TABLE survey_responses ALTER COLUMN {col} DROP NOT NULL")
    for col in V2_COLUMNS:
        conn.execute(
            f"ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS {col} SMALLINT"
            f" CHECK ({col} BETWEEN 1 AND 5)"
        )
    v1_complete = " AND ".join(f"{c} IS NOT NULL" for c in V1_COLUMNS)
    v2_complete = " AND ".join(f"{c} IS NOT NULL" for c in V2_COLUMNS)
    conn.execute(
        f"""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'survey_answers_match_version'
            ) THEN
                ALTER TABLE survey_responses ADD CONSTRAINT survey_answers_match_version CHECK (
                    (survey_version = 1 AND {v1_complete})
                    OR (survey_version = 2 AND {v2_complete})
                );
            END IF;
        END $$;
        """
    )
    conn.execute("DROP INDEX IF EXISTS survey_responses_one_per_user")
    conn.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS survey_responses_one_per_user_version
        ON survey_responses (user_id, survey_version) WHERE NOT is_demo
        """
    )


if __name__ == "__main__":
    import os
    import re
    import sys

    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from dotenv import dotenv_values
    import psycopg

    env = dotenv_values(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
    url = env["TEST_DATABASE_URL"]
    if url == env.get("DATABASE_URL"):
        sys.exit("TEST_DATABASE_URL equals DATABASE_URL -- refusing to run")
    print("Applying to TEST database host:", re.sub(r".*@([^:/]+).*", r"\1", url))
    with psycopg.connect(url, prepare_threshold=None) as conn:
        apply(conn)
        conn.commit()
    print("done")
