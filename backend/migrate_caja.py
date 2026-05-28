"""
Crea las tablas caja_diaria y caja_movimientos.
Uso:
    DATABASE_URL="postgresql://..." python3 migrate_caja.py
"""
import os, sys
import psycopg2

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: definí DATABASE_URL antes de correr este script.")
    sys.exit(1)

conn = psycopg2.connect(DATABASE_URL)
cur  = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS caja_diaria (
    id                SERIAL PRIMARY KEY,
    fecha             DATE         NOT NULL,
    sucursal          VARCHAR(50)  NOT NULL,
    efectivo_del_dia  NUMERIC(15,2) NOT NULL DEFAULT 0,
    tarjeta_provincia NUMERIC(15,2) NOT NULL DEFAULT 0,
    tarjeta_nave      NUMERIC(15,2) NOT NULL DEFAULT 0,
    tarjeta_frances   NUMERIC(15,2) NOT NULL DEFAULT 0,
    tarjeta_comafi    NUMERIC(15,2) NOT NULL DEFAULT 0,
    observaciones     VARCHAR(500)  DEFAULT '',
    cerrada           BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE(fecha, sucursal)
);
""")

cur.execute("""
CREATE TABLE IF NOT EXISTS caja_movimientos (
    id          SERIAL PRIMARY KEY,
    caja_id     INTEGER      NOT NULL REFERENCES caja_diaria(id) ON DELETE CASCADE,
    tipo        VARCHAR(20)  NOT NULL,
    descripcion VARCHAR(200) DEFAULT '',
    monto       NUMERIC(15,2) NOT NULL DEFAULT 0
);
""")

conn.commit()
cur.close()
conn.close()
print("✅ Tablas caja_diaria y caja_movimientos creadas correctamente.")
