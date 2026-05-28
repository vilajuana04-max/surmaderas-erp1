"""
Crea la tabla `users` y siembra los usuarios iniciales.
Uso:
    DATABASE_URL="postgresql://..." python3 migrate_users.py
"""
import os
import sys
import psycopg2
from passlib.context import CryptContext

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: definí la variable DATABASE_URL antes de correr este script.")
    sys.exit(1)

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

conn = psycopg2.connect(DATABASE_URL)
cur  = conn.cursor()

# ── Crear tabla ──────────────────────────────────────────────────
cur.execute("""
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50)  UNIQUE NOT NULL,
    password_hash VARCHAR(200) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'caja',
    active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
""")

# ── Seed ─────────────────────────────────────────────────────────
users = [
    ("Gustavo", "Gust1401", "admin"),
    ("Caja",    "1111",     "caja"),
]

for username, password, role in users:
    hashed = pwd.hash(password)
    cur.execute("""
        INSERT INTO users (username, password_hash, role)
        VALUES (%s, %s, %s)
        ON CONFLICT (username) DO NOTHING;
    """, (username, hashed, role))
    print(f"  ✓ Usuario '{username}' ({role}) insertado (o ya existía).")

conn.commit()
cur.close()
conn.close()
print("\n✅ Migración de usuarios completada.")
