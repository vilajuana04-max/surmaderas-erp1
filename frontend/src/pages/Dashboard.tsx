import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { api, fmt$, CURRENT_YEAR } from '../api'

const NAVY  = '#070614'
const CORAL = '#C8603A'
const CORAL_DARK = '#A84E2C'
const CHART_COLORS = [NAVY, CORAL, CORAL_DARK, '#464545', '#888580', '#2A1410']

const MONTH_ABBR: Record<string, string> = {
  ENERO:'Ene', FEBRERO:'Feb', MARZO:'Mar', ABRIL:'Abr',
  MAYO:'May', JUNIO:'Jun', JULIO:'Jul', AGOSTO:'Ago',
  SEPTIEMBRE:'Sep', OCTUBRE:'Oct', NOVIEMBRE:'Nov', DICIEMBRE:'Dic',
}

export default function Dashboard() {
  const [kpis, setKpis]     = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/dashboard/kpis?year=${CURRENT_YEAR}`)
      .then(d => { setKpis(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <Skeleton />

  const monthly = kpis?.monthly_stats?.filter((m: any) => m.total_sales > 0) ?? []
  const pie     = kpis?.expense_breakdown ?? []
  const monthlyChart = monthly.map((m: any) => ({
    ...m,
    name: MONTH_ABBR[m.month] ?? m.month?.slice(0, 3),
  }))

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <p className="eyebrow mb-1">Sur Maderas · ERP</p>
        <h1 className="text-3xl font-bold font-head" style={{ color: NAVY }}>Dashboard</h1>
        <p className="text-brand-muted text-sm font-body mt-0.5">
          {kpis?.current_month} {kpis?.current_year} · Flujo de caja e indicadores
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Ingresos YTD"
          value={fmt$(kpis?.ytd_revenue)}
          sub={`Luro: ${fmt$(kpis?.luro_ytd)}`}
          accent={NAVY}
        />
        <KpiCard
          label="Gastos YTD"
          value={fmt$(kpis?.ytd_expenses)}
          sub="Incl. sueldos"
          accent={CORAL}
          negative
        />
        <KpiCard
          label="Margen Bruto"
          value={fmt$(kpis?.gross_margin)}
          sub={`${kpis?.gross_margin_pct?.toFixed(1) ?? '—'}% del ingreso`}
          accent={kpis?.gross_margin >= 0 ? '#16a34a' : '#dc2626'}
        />
        <KpiCard
          label="Sueldos / Ventas"
          value={`${kpis?.payroll_to_revenue?.toFixed(1) ?? '—'}%`}
          sub="Ratio RRHH"
          accent={NAVY}
        />
      </div>

      {/* Ingresos vs Gastos */}
      {monthlyChart.length > 0 && (
        <div className="card">
          <p className="eyebrow mb-1">Comparativa mensual</p>
          <h2 className="font-bold font-head text-lg mb-4" style={{ color: NAVY }}>
            Ingresos vs Gastos — {CURRENT_YEAR}
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyChart} barCategoryGap="30%" margin={{ left: 0, right: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888580', fontFamily: 'Montserrat' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#888580' }} tickFormatter={v => `$${(v/1e6).toFixed(1)}M`} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number, name: string) => [fmt$(v), name]}
                contentStyle={{ fontFamily: 'Montserrat', fontSize: 12, borderRadius: 8, border: '1px solid #e8e5e0' }}
              />
              <Bar dataKey="total_sales"    name="Ventas"  fill={NAVY}  radius={[4,4,0,0]} />
              <Bar dataKey="total_expenses" name="Gastos"  fill={CORAL} radius={[4,4,0,0]} />
              <Legend wrapperStyle={{ fontFamily: 'Montserrat', fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Tendencia ventas */}
        {monthlyChart.length > 0 && (
          <div className="card">
            <p className="eyebrow mb-1">Por sucursal</p>
            <h2 className="font-bold font-head text-base mb-4" style={{ color: NAVY }}>
              Tendencia de Ventas
            </h2>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={monthlyChart}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888580' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#888580' }} tickFormatter={v => `$${(v/1e6).toFixed(0)}M`} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => fmt$(v)}
                  contentStyle={{ fontFamily: 'Montserrat', fontSize: 12, borderRadius: 8, border: '1px solid #e8e5e0' }}
                />
                <Line dataKey="luro_sales"  name="Luro"         stroke={NAVY}  strokeWidth={2.5} dot={false} />
                <Line dataKey="indep_sales" name="Independencia" stroke={CORAL} strokeWidth={2.5} dot={false} />
                <Legend wrapperStyle={{ fontFamily: 'Montserrat', fontSize: 12 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Gastos por categoría */}
        {pie.length > 0 && (
          <div className="card">
            <p className="eyebrow mb-1">Distribución</p>
            <h2 className="font-bold font-head text-base mb-4" style={{ color: NAVY }}>
              Gastos por Categoría
            </h2>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pie} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={70} strokeWidth={0}>
                  {pie.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  formatter={(v: number) => fmt$(v)}
                  contentStyle={{ fontFamily: 'Montserrat', fontSize: 12, borderRadius: 8, border: '1px solid #e8e5e0' }}
                />
                <Legend
                  formatter={(v, e: any) => `${v} (${e.payload?.percentage}%)`}
                  wrapperStyle={{ fontFamily: 'Montserrat', fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Ventas por día de semana */}
      {kpis?.weekday_sales?.length > 0 && (
        <div className="card">
          <p className="eyebrow mb-1">Patrones de venta</p>
          <h2 className="font-bold font-head text-base mb-4" style={{ color: NAVY }}>
            Ventas por Día — {kpis.current_month}
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={kpis.weekday_sales} barCategoryGap="30%">
              <XAxis dataKey="weekday" tick={{ fontSize: 11, fill: '#888580' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#888580' }} tickFormatter={v => `$${(v/1e3).toFixed(0)}K`} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => fmt$(v)}
                contentStyle={{ fontFamily: 'Montserrat', fontSize: 12, borderRadius: 8, border: '1px solid #e8e5e0' }}
              />
              <Bar dataKey="luro_total"  name="Luro"         fill={NAVY}  radius={[4,4,0,0]} />
              <Bar dataKey="indep_total" name="Independencia" fill={CORAL} radius={[4,4,0,0]} />
              <Legend wrapperStyle={{ fontFamily: 'Montserrat', fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Empty state */}
      {!kpis && (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl mb-4 flex items-center justify-center"
            style={{ background: NAVY }}>
            <span style={{ color: CORAL }} className="text-xl font-bold font-head">S</span>
          </div>
          <p className="font-bold font-head text-lg mb-1" style={{ color: NAVY }}>
            Bienvenido al ERP de Sur Maderas
          </p>
          <p className="text-brand-muted text-sm font-body">
            Comenzá cargando las ventas diarias en el módulo Ventas.
          </p>
        </div>
      )}
    </div>
  )
}

/* ── KPI Card ─────────────────────────────────────────────────── */
function KpiCard({
  label, value, sub, accent, negative = false,
}: {
  label: string; value: string; sub?: string; accent: string; negative?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-card" style={{ borderTop: `3px solid ${accent}` }}>
      <p className="text-[11px] font-bold uppercase tracking-[2px] font-body mb-2"
        style={{ color: '#888580' }}>
        {label}
      </p>
      <p className={`text-xl font-bold font-head mb-1 ${negative ? 'text-coral' : ''}`}
        style={!negative ? { color: accent } : {}}>
        {value}
      </p>
      {sub && <p className="text-xs font-body" style={{ color: '#888580' }}>{sub}</p>}
    </div>
  )
}

/* ── Skeleton ─────────────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-3 rounded w-32 mb-2" style={{ background: '#e8e5e0' }} />
        <div className="h-8 rounded w-48 mb-1" style={{ background: '#e8e5e0' }} />
        <div className="h-3 rounded w-40" style={{ background: '#e8e5e0' }} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl" style={{ background: '#e8e5e0' }} />
        ))}
      </div>
      <div className="h-64 rounded-2xl" style={{ background: '#e8e5e0' }} />
    </div>
  )
}
