"""
Migración: crea tabla gastos_personales.
Ejecutar UNA SOLA VEZ:  python3 migrate_gastos_personales.py
"""
import os, psycopg2

DSN = os.environ.get(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_7qL6jWFXoGZY@ep-calm-firefly-aqe3vw4o-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
)

SQL = """
CREATE TABLE IF NOT EXISTS gastos_personales (
    id             SERIAL PRIMARY KEY,
    year           INTEGER       NOT NULL,
    month          VARCHAR(20)   NOT NULL,
    day            INTEGER       NOT NULL,
    description    VARCHAR(200)  NOT NULL,
    amount         NUMERIC(15,2) NOT NULL,
    category       VARCHAR(50)   DEFAULT 'Otros',
    payment_method VARCHAR(30)   NOT NULL,
    bank           VARCHAR(60),
    notes          VARCHAR(300),
    created_at     TIMESTAMPTZ   DEFAULT NOW()
);
"""

if __name__ == "__main__":
    conn = psycopg2.connect(DSN)
    cur  = conn.cursor()
    cur.execute(SQL)
    conn.commit()
    cur.close()
    conn.close()
    print("✅ Tabla gastos_personales creada correctamente.")
