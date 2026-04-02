"""
Set a user's password in the KPI Mgmt PostgreSQL DB (bcrypt, 10 rounds — same as bcryptjs in the app).

Prerequisites (once):
  pip install bcrypt psycopg2-binary python-dotenv

Usage (from project root, with .env containing DATABASE_URL):
  python scripts/set_user_password.py --email user001@kpcqa.or.kr --password 2026000001

Or pass the connection string:
  set DATABASE_URL=postgresql://...
  python scripts/set_user_password.py --email user001@kpcqa.or.kr
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


def load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    load_env_file(root / ".env")

    try:
        import bcrypt
        import psycopg2
    except ImportError:
        print(
            "Missing packages. Run: pip install bcrypt psycopg2-binary python-dotenv",
            file=sys.stderr,
        )
        return 1

    parser = argparse.ArgumentParser(description="Reset User.passwordHash in KPI Mgmt DB")
    parser.add_argument(
        "--email",
        default="user001@kpcqa.or.kr",
        help="User email (case-insensitive match)",
    )
    parser.add_argument(
        "--password",
        default="2026000001",
        help="New plain password (default: 2026000001, matches seed employeeNo for user 001)",
    )
    parser.add_argument(
        "--no-must-change",
        action="store_true",
        help="Do not set mustChangePassword=true (default: force change on next login)",
    )
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        print("DATABASE_URL is not set (.env or environment).", file=sys.stderr)
        return 1

    if len(args.password) < 6:
        print("Password must be at least 6 characters (same rule as admin API).", file=sys.stderr)
        return 1

    password_hash = bcrypt.hashpw(args.password.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode(
        "ascii"
    )
    must_change = not args.no_must_change

    conn = psycopg2.connect(database_url)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE "User"
                SET "passwordHash" = %s,
                    "mustChangePassword" = %s,
                    "updatedAt" = NOW()
                WHERE LOWER("email") = LOWER(%s)
                """,
                (password_hash, must_change, args.email.strip()),
            )
            if cur.rowcount == 0:
                print(f"No user found with email: {args.email}", file=sys.stderr)
                return 2
        conn.commit()
    finally:
        conn.close()

    print(f"Updated password for {args.email} (mustChangePassword={must_change}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
