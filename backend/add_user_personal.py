"""
add_user_personal.py
Agrega el usuario Personal con clave Gust1401 (rol: caja).
Ejecutar una sola vez desde el shell de Render:
    DATABASE_URL="postgresql://..." python3 add_user_personal.py
"""
import os, sys, psycopg2

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: definí la variable DATABASE_URL antes de correr este script.")
    sys.exit(1)

# Hash bcrypt de "Gust1401" (rounds=12) — igual que usuario Gustavo
HASH_GUST1401 = "$2b$12$DM6fkHH4HVcp8sJ5X200MOt3bXu0UWZ8XqGBhc.kernSC8h/1mdM."

conn = psycopg2.connect(DATABASE_URL)
cur  = conn.cursor()

cur.execute("""
    INSERT INTO users (username, password_hash, role)
    VALUES (%s, %s, %s)
    ON CONFLICT (username) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          role          = EXCLUDED.role,
          active        = TRUE;
""", ("Personal", HASH_GUST1401, "caja"))

conn.commit()
cur.close()
conn.close()
print("✅ Usuario 'Personal' creado con rol 'caja' y clave Gust1401.")
