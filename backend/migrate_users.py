"""
Crea la tabla `users` y siembra los usuarios iniciales.
Uso:
    DATABASE_URL="postgresql://..." python3 migrate_users.py
"""
import os
import sys
import psycopg2

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: definí la variable DATABASE_URL antes de correr este script.")
    sys.exit(1)

# Hashes bcrypt pre-generados (contraseñas: Gust1401 y 1111)
USERS = [
    ("Gustavo", "$2b$12$DM6fkHH4HVcp8sJ5X200MOt3bXu0UWZ8XqGBhc.kernSC8h/1mdM.", "admin"),
    ("Caja",    "$2b$12$hBgYB8esHs7zq0JT1mW7LuIWejLEOpEEZ1CPGs/eY4PppvKIvwPfG", "caja"),
]

conn = psycopg2.connect(DATABASE_URL)
cur  = conn.cursor()

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

for username, hashed, role in USERS:
    cur.execute("""
        INSERT INTO users (username, password_hash, role)
        VALUES (%s, %s, %s)
        ON CONFLICT (username) DO NOTHING;
    """, (username, hashed, role))
    print(f"  ✓ Usuario '{username}' ({role}) listo.")

conn.commit()
cur.close()
conn.close()
print("\n✅ Migración de usuarios completada.")
