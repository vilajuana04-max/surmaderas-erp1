"""
Migración: crea tabla vencimientos_oneoff.
Ejecutar UNA SOLA VEZ:  python3 migrate_vencimientos_oneoff.py
"""
import os, psycopg2

DSN = os.environ.get(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_7qL6jWFXoGZY@ep-calm-firefly-aqe3vw4o-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
)

SQL = """
CREATE TABLE IF NOT EXISTS vencimientos_oneoff (
    id       SERIAL PRIMARY KEY,
    year     INTEGER      NOT NULL,
    month    VARCHAR(20)  NOT NULL,
    name     VARCHAR(100) NOT NULL,
    amount   NUMERIC(15,2) DEFAULT 0,
    day      INTEGER      NOT NULL,
    category VARCHAR(50)  DEFAULT 'Otros',
    color    VARCHAR(20)  DEFAULT '#64748b',
    status   VARCHAR(20)  DEFAULT 'pendiente',
    paid_at  TIMESTAMPTZ,
    notes    VARCHAR(300)
);
"""

if __name__ == "__main__":
    conn = psycopg2.connect(DSN)
    cur  = conn.cursor()
    cur.execute(SQL)
    conn.commit()
    cur.close()
    conn.close()
    print("✅ Tabla vencimientos_oneoff creada correctamente.")
