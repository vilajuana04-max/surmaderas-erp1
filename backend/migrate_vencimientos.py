"""
Migración: crea tablas vencimientos y vencimiento_estados en Neon DB.
Ejecutar UNA SOLA VEZ:  python migrate_vencimientos.py
"""
import os
import psycopg2

DSN = os.environ.get(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_7qL6jWFXoGZY@ep-calm-firefly-aqe3vw4o-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
)

SQL = """
CREATE TABLE IF NOT EXISTS vencimientos (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    amount       NUMERIC(15,2) DEFAULT 0,
    day_of_month INTEGER NOT NULL,
    category     VARCHAR(50)  DEFAULT 'Servicios',
    color        VARCHAR(20)  DEFAULT '#3b82f6',
    active       BOOLEAN      DEFAULT TRUE,
    notes        VARCHAR(300),
    sort_order   INTEGER      DEFAULT 0,
    created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vencimiento_estados (
    id              SERIAL PRIMARY KEY,
    vencimiento_id  INTEGER NOT NULL REFERENCES vencimientos(id) ON DELETE CASCADE,
    year            INTEGER NOT NULL,
    month           VARCHAR(20) NOT NULL,
    day_override    INTEGER,
    amount_override NUMERIC(15,2),
    status          VARCHAR(20) DEFAULT 'pendiente',
    paid_at         TIMESTAMPTZ,
    notes           VARCHAR(300),
    CONSTRAINT uq_venc_estado UNIQUE (vencimiento_id, year, month)
);
"""

if __name__ == "__main__":
    conn = psycopg2.connect(DSN)
    cur  = conn.cursor()
    cur.execute(SQL)
    conn.commit()
    cur.close()
    conn.close()
    print("✅ Tablas vencimientos y vencimiento_estados creadas correctamente.")
