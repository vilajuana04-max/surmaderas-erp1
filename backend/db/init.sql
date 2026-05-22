-- ═══════════════════════════════════════════════════════════════
-- SUR MADERAS ERP — Esquema PostgreSQL
-- Migrado desde SurMaderas_ERP.xlsm
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- CORE
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS branches (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50) UNIQUE NOT NULL,
    address     VARCHAR(200),
    union_type  VARCHAR(50)
);

INSERT INTO branches (name, address, union_type) VALUES
    ('LURO',           'Luro, Mar del Plata',           'MADEREROS'),
    ('INDEPENDENCIA',  'Independencia, Mar del Plata',   'SEC12')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS app_config (
    key     VARCHAR(50) PRIMARY KEY,
    value   VARCHAR(100) NOT NULL
);

INSERT INTO app_config (key, value) VALUES
    ('active_year',          '2026'),
    ('active_month',         'ABRIL'),
    ('empresa',              'Sur Maderas'),
    ('version',              '1.0'),
    ('ultima_actualizacion', '2026-04-29')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────
-- MÓDULO RRHH — Empleados
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS employees (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    branch_id   INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    hire_date   DATE NOT NULL,
    is_active   BOOLEAN DEFAULT true,
    CONSTRAINT uq_employee_branch UNIQUE (name, branch_id)
);

INSERT INTO employees (name, branch_id, hire_date) VALUES
    ('Vazquez, Martin',    1, '2015-04-01'),
    ('Vila, Cecilia',      1, '2015-01-01'),
    ('Scatizzi, Patricia', 1, '2009-09-11'),
    ('Vila, Guillermo',    1, '2009-03-05'),
    ('Viejo, Marcelo',     1, '2021-02-01'),
    ('Lalli, Facundo',     1, '2022-09-19'),
    ('Viejo, Ariel',       1, '2022-03-01'),
    ('Salinas, Adrian',    2, '2010-01-01'),
    ('Ponasso, Martin',    2, '2012-01-01'),
    ('Avila, Alejandro',   2, '2013-01-01'),
    ('Vivas, Ivan',        2, '2018-01-01')
ON CONFLICT (name, branch_id) DO NOTHING;

-- ─────────────────────────────────────────
-- MÓDULO VENTAS
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_sales (
    id              SERIAL PRIMARY KEY,
    sale_date       DATE NOT NULL,
    branch_id       INTEGER REFERENCES branches(id),
    total_amount    NUMERIC(15,2),
    card_payments   NUMERIC(15,2),
    ticket_count    INTEGER,
    month_label     VARCHAR(20),
    year            INTEGER,
    closed          BOOLEAN DEFAULT false,
    CONSTRAINT uq_daily_sales UNIQUE (sale_date, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_sales_date   ON daily_sales(sale_date, branch_id);
CREATE INDEX IF NOT EXISTS idx_daily_sales_period ON daily_sales(year, month_label);

-- ─────────────────────────────────────────
-- MÓDULO COMPRAS
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS providers (
    id      SERIAL PRIMARY KEY,
    name    VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS purchases (
    id              SERIAL PRIMARY KEY,
    purchase_date   DATE,
    invoice_number  VARCHAR(50),
    provider_id     INTEGER REFERENCES providers(id),
    total_amount    NUMERIC(15,2) NOT NULL,
    flag            VARCHAR(20),
    month_label     VARCHAR(20),
    year            INTEGER,
    closed          BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_purchases_period   ON purchases(year, month_label);
CREATE INDEX IF NOT EXISTS idx_purchases_provider ON purchases(provider_id);

-- ─────────────────────────────────────────
-- MÓDULO SUELDOS
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payroll_periods (
    id          SERIAL PRIMARY KEY,
    month       VARCHAR(20) NOT NULL,
    year        INTEGER NOT NULL,
    branch_id   INTEGER REFERENCES branches(id),
    status      VARCHAR(20) DEFAULT 'OPEN',
    CONSTRAINT uq_period UNIQUE (month, year, branch_id)
);

CREATE TABLE IF NOT EXISTS payroll_items (
    id              SERIAL PRIMARY KEY,
    period_id       INTEGER REFERENCES payroll_periods(id) ON DELETE CASCADE,
    employee_id     INTEGER REFERENCES employees(id),
    absences        INTEGER DEFAULT 0,
    base_salary     NUMERIC(15,2),
    bank_deposit    NUMERIC(15,2) DEFAULT 0,
    advance         NUMERIC(15,2) DEFAULT 0,
    plus_pct        NUMERIC(5,4)  DEFAULT 0,
    plus_amount     NUMERIC(15,2) GENERATED ALWAYS AS
                        (ROUND(base_salary * plus_pct, 2)) STORED,
    incentive       NUMERIC(15,2) DEFAULT 0,
    gross_total     NUMERIC(15,2) GENERATED ALWAYS AS
                        (ROUND(base_salary + (base_salary * plus_pct) + incentive, 2)) STORED,
    net_total       NUMERIC(15,2) GENERATED ALWAYS AS
                        (ROUND(base_salary + (base_salary * plus_pct) + incentive - bank_deposit - advance, 2)) STORED,
    CONSTRAINT uq_payroll_item UNIQUE (period_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_period ON payroll_items(period_id);

-- ─────────────────────────────────────────
-- MÓDULO VACACIONES
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vacation_records (
    id                  SERIAL PRIMARY KEY,
    year                INTEGER NOT NULL,
    employee_id         INTEGER REFERENCES employees(id),
    days_entitled       INTEGER,
    days_taken          INTEGER DEFAULT 0,
    pending_prev_year   INTEGER DEFAULT 0,
    description         TEXT,
    -- Calculados:
    -- total_available = days_entitled + pending_prev_year
    -- pending_current = total_available - days_taken
    CONSTRAINT uq_vacation_year UNIQUE (year, employee_id)
);

CREATE TABLE IF NOT EXISTS vacation_log (
    id              SERIAL PRIMARY KEY,
    registered_date DATE DEFAULT CURRENT_DATE,
    year            INTEGER,
    employee_id     INTEGER REFERENCES employees(id),
    date_from       DATE,
    date_to         DATE,
    days            INTEGER,
    status          VARCHAR(30) DEFAULT 'Pendiente',
    approved_by     VARCHAR(100),
    notes           TEXT
);

-- ─────────────────────────────────────────
-- MÓDULO GASTOS
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shared_expense_items (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) UNIQUE NOT NULL,
    category    VARCHAR(100),
    is_active   BOOLEAN DEFAULT true
);

INSERT INTO shared_expense_items (name, category) VALUES
    ('Formulario 931 compartido',    'Cargas sociales'),
    ('I.V.A',                        'Impuestos'),
    ('Autonomo',                     'Impuestos'),
    ('Ingresos brutos',              'Impuestos'),
    ('SEC Compartido',               'Cargas sociales'),
    ('FAECYS Compartido',            'Cargas sociales'),
    ('OSECAC Compartido',            'Cargas sociales'),
    ('USIMRA compartido',            'Cargas sociales'),
    ('Tasa de seguridad e higiene',  'Impuestos'),
    ('INACAP',                       'Cargas sociales'),
    ('Claro',                        'Servicio'),
    ('Contador',                     'Gastos administrativos'),
    ('Seguro de comercio integral',  'Seguro'),
    ('POSNET (2 terminales)',        'Gastos administrativos'),
    ('Hosting en la web',            'Marketing Digital'),
    ('Sistema de precios',           'Software'),
    ('Avila, Alejandro.',            'Proveedor'),
    ('Salinas, Adrian',              'Proveedor'),
    ('Ponasso, Martin.',             'Proveedor'),
    ('Avila, Alejandro. - BONO',     'Proveedor'),
    ('Juana',                        'Sueldos')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS shared_expenses (
    id              SERIAL PRIMARY KEY,
    item_id         INTEGER REFERENCES shared_expense_items(id),
    month           VARCHAR(20) NOT NULL,
    year            INTEGER NOT NULL,
    total_amount    NUMERIC(15,2),
    luro_amount     NUMERIC(15,2),
    due_date        DATE,
    detail          TEXT,
    paid_status     VARCHAR(20) DEFAULT 'NO',
    CONSTRAINT uq_shared_expense UNIQUE (item_id, month, year)
);

CREATE TABLE IF NOT EXISTS expense_categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,
    parent_id   INTEGER REFERENCES expense_categories(id)
);

INSERT INTO expense_categories (name) VALUES
    ('Varios'), ('Gastos_Fijos'), ('Sueldos'), ('Proveedores'),
    ('Transporte'), ('Impuestos'), ('Insumos'), ('Aguinaldo'), ('Marketing_Digital')
ON CONFLICT (name) DO NOTHING;

-- Subcategorías
INSERT INTO expense_categories (name, parent_id) VALUES
    ('Almacén',                 (SELECT id FROM expense_categories WHERE name='Varios')),
    ('Artículos Limpieza',      (SELECT id FROM expense_categories WHERE name='Varios')),
    ('S - Otros',               (SELECT id FROM expense_categories WHERE name='Varios')),
    ('Adriana',                 (SELECT id FROM expense_categories WHERE name='Varios')),
    ('Edea',                    (SELECT id FROM expense_categories WHERE name='Gastos_Fijos')),
    ('Alquiler',                (SELECT id FROM expense_categories WHERE name='Gastos_Fijos')),
    ('Obras sanitarias',        (SELECT id FROM expense_categories WHERE name='Gastos_Fijos')),
    ('Internet',                (SELECT id FROM expense_categories WHERE name='Gastos_Fijos')),
    ('G - Otros',               (SELECT id FROM expense_categories WHERE name='Gastos_Fijos')),
    ('FAECYS',                  (SELECT id FROM expense_categories WHERE name='Gastos_Fijos')),
    ('U.S.I.M.R.A',            (SELECT id FROM expense_categories WHERE name='Gastos_Fijos')),
    ('SEGURO COMERCIO INTEGRAL',(SELECT id FROM expense_categories WHERE name='Gastos_Fijos')),
    ('SEC',                     (SELECT id FROM expense_categories WHERE name='Gastos_Fijos')),
    ('FORMULARIO 931',          (SELECT id FROM expense_categories WHERE name='Gastos_Fijos')),
    ('POSNET',                  (SELECT id FROM expense_categories WHERE name='Gastos_Fijos')),
    ('CLARO',                   (SELECT id FROM expense_categories WHERE name='Gastos_Fijos')),
    ('INACAP',                  (SELECT id FROM expense_categories WHERE name='Gastos_Fijos')),
    ('MATAFUEGOS',              (SELECT id FROM expense_categories WHERE name='Gastos_Fijos')),
    ('CONTADOR',                (SELECT id FROM expense_categories WHERE name='Gastos_Fijos')),
    ('I.V.A',                   (SELECT id FROM expense_categories WHERE name='Impuestos')),
    ('Ingresos Brutos',         (SELECT id FROM expense_categories WHERE name='Impuestos')),
    ('IIGG',                    (SELECT id FROM expense_categories WHERE name='Impuestos')),
    ('Bienes Personales',       (SELECT id FROM expense_categories WHERE name='Impuestos')),
    ('I - Otros',               (SELECT id FROM expense_categories WHERE name='Impuestos')),
    ('Tasa Seguridad e Higiene',(SELECT id FROM expense_categories WHERE name='Impuestos')),
    ('Autonomo',                (SELECT id FROM expense_categories WHERE name='Impuestos')),
    ('Bolsas',                  (SELECT id FROM expense_categories WHERE name='Insumos')),
    ('Film Stretch',            (SELECT id FROM expense_categories WHERE name='Insumos')),
    ('Ferreteria',              (SELECT id FROM expense_categories WHERE name='Insumos')),
    ('Ropa de Trabajo',         (SELECT id FROM expense_categories WHERE name='Insumos')),
    ('Valentin Flete',          (SELECT id FROM expense_categories WHERE name='Transporte')),
    ('Gabi Flete',              (SELECT id FROM expense_categories WHERE name='Transporte')),
    ('Transporte Miramar',      (SELECT id FROM expense_categories WHERE name='Transporte')),
    ('Hosting',                 (SELECT id FROM expense_categories WHERE name='Marketing_Digital')),
    ('Sitio WEB',               (SELECT id FROM expense_categories WHERE name='Marketing_Digital')),
    ('Publicidad PAGA',         (SELECT id FROM expense_categories WHERE name='Marketing_Digital')),
    ('Canva',                   (SELECT id FROM expense_categories WHERE name='Marketing_Digital'))
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS luro_expenses (
    id              SERIAL PRIMARY KEY,
    month           VARCHAR(20),
    year            INTEGER,
    expense_date    DATE,
    category_id     INTEGER REFERENCES expense_categories(id),
    subcategory_id  INTEGER REFERENCES expense_categories(id),
    detail          VARCHAR(300),
    amount          NUMERIC(15,2),
    payment_method  VARCHAR(50),
    paid_status     BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_luro_expenses_period ON luro_expenses(year, month);
CREATE INDEX IF NOT EXISTS idx_shared_expenses_period ON shared_expenses(year, month);
