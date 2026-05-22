import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Users, ShoppingBag } from 'lucide-react'
import { api, fmt$, CURRENT_YEAR } from '../api'

const COLORS = ['#3D2B1F','#C8964C','#7A5040','#5C3D2E','#D4AA72','#9E7B55']

export default function Dashboard() {
  const [kpis, setKpis] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/dashboard/kpis?year=${CURRENT_YEAR}`)
      .then(d => { setKpis(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <Skeleton />

  const monthly = kpis?.monthly_stats?.filter((m: any) => m.total_sales > 0) ?? []
  const pie     = kpis?.expense_breakdown ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-wood-900">Dashboard</h1>
        <p className="text-wood-500 text-sm">{kpis?.current_month} {kpis?.current_year} · Flujo de caja e indicadores</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="kpi-card">
          <span className="kpi-label">Ingresos YTD</span>
          <span className="kpi-value text-xl">{fmt$(kpis?.ytd_revenue)}</span>
          <div className="flex gap-2">
            <span className="kpi-sub text-[10px]">Luro {fmt$(kpis?.luro_ytd)}</span>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Gastos YTD</span>
          <span className="kpi-value text-xl text-red-600">{fmt$(kpis?.ytd_expenses)}</span>
          <span className="kpi-sub">incl. sueldos</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Margen Bruto</span>
          <span className={`kpi-value text-xl ${kpis?.gross_margin >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {fmt$(kpis?.gross_margin)}
          </span>
          <span className="kpi-sub">{kpis?.gross_margin_pct?.toFixed(1)}% del ingreso</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Sueldos / Ventas</span>
          <span className="kpi-value text-xl">{kpis?.payroll_to_revenue?.toFixed(1)}%</span>
          <span className="kpi-sub">ratio RRHH</span>
        </div>
      </div>

      {/* Ingresos vs Gastos */}
      {monthly.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-wood-700 mb-4">Ingresos vs Gastos Mensual</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly} margin={{ left: 0, right: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={m => m.slice(0,3)} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(v/1e6).toFixed(1)}M`} />
              <Tooltip formatter={(v: number) => fmt$(v)} />
              <Bar dataKey="total_sales"    name="Ventas"  fill="#3D2B1F" radius={[4,4,0,0]} />
              <Bar dataKey="total_expenses" name="Gastos"  fill="#C8964C" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Tendencia ventas */}
        {monthly.length > 0 && (
          <div className="card">
            <h2 className="text-sm font-semibold text-wood-700 mb-4">Tendencia de Ventas</h2>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={monthly}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={m => m.slice(0,3)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(v/1e6).toFixed(0)}M`} />
                <Tooltip formatter={(v: number) => fmt$(v)} />
                <Line dataKey="luro_sales"  name="Luro"  stroke="#3D2B1F" strokeWidth={2} dot={false} />
                <Line dataKey="indep_sales" name="Indep" stroke="#C8964C" strokeWidth={2} dot={false} />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Gastos por categoría */}
        {pie.length > 0 && (
          <div className="card">
            <h2 className="text-sm font-semibold text-wood-700 mb-4">Gastos por Categoría</h2>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pie} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={70}>
                  {pie.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt$(v)} />
                <Legend formatter={(v, e: any) => `${v} (${e.payload?.percentage}%)`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Ventas por día de semana */}
      {kpis?.weekday_sales?.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-wood-700 mb-4">Ventas por Día — {kpis.current_month}</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={kpis.weekday_sales}>
              <XAxis dataKey="weekday" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(v/1e3).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => fmt$(v)} />
              <Bar dataKey="luro_total"  name="Luro"  fill="#3D2B1F" radius={[4,4,0,0]} />
              <Bar dataKey="indep_total" name="Indep" fill="#C8964C" radius={[4,4,0,0]} />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-wood-100 rounded w-48" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-wood-100 rounded-2xl" />)}
      </div>
      <div className="h-64 bg-wood-100 rounded-2xl" />
    </div>
  )
}
