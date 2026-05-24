import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  FileDown, RefreshCw, Plus, Lock, Trash2,
  Upload, CheckCircle, Clock, X, ChevronDown, ChevronUp,
} from 'lucide-react'
import { api, fmt$, MONTHS, CURRENT_YEAR, CURRENT_MONTH_IDX } from '../api'

const NAVY  = '#070614'
const CORAL = '#C8603A'
const ALL_YEARS = [2024, 2025, 2026, 2027]
const BRANCHES  = [
  { id: 1, name: 'LURO',         union: 'Madereros' },
  { id: 2, name: 'INDEPENDENCIA', union: 'SEC 12'   },
]

/* ── Tipos ──────────────────────────────────────────────────── */
type Tab = 'vacaciones' | 'sueldos' | 'recibos'

type VacRecord = {
  id: number; year: number; employee_id: number; employee_name: string
  branch_name: string; days_entitled: number; days_taken: number
  pending_prev_year: number; total_available: number; pending_current: number
  description: string | null
}
type Employee = {
  id: number; name: string; branch_id: number; branch_name: string
  hire_date: string
  months_of_service: number        // ROUNDDOWN(YEARFRAC*12, 0) — col C Excel
  years_of_service: number         // months/12              — col D Excel
  vacation_days_entitled: number   // IF(años<5,14,…)        — col E Excel
}
type VacLog = {
  id: number; registered_date: string | null; year: number; employee_id: number
  employee_name: string | null; date_from: string; date_to: string
  days: number; status: string; approved_by: string | null; notes: string | null
}
type Receipt = {
  id: number; employee_id: number; employee_name: string; branch_name: string
  year: number; month: string; filename: string; uploaded_at: string | null
}


/* ─────────────────────────────────────────────────────────────
   PÁGINA PRINCIPAL
───────────────────────────────────────────────────────────── */
export default function RRHH() {
  const [tab, setTab] = useState<Tab>('vacaciones')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div style={{ background: NAVY }} className="rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p style={{ color: CORAL }} className="text-xs font-semibold tracking-widest uppercase mb-1 font-body">
            Sur Maderas · ERP
          </p>
          <h1 className="text-2xl font-bold text-white font-head">Recursos Humanos</h1>
          <p className="text-white/50 text-sm font-body">Vacaciones · Sueldos · Recibos</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-brand-border">
        {([
          { id: 'vacaciones', label: '🌴 Vacaciones' },
          { id: 'sueldos',    label: '💰 Sueldos'    },
          { id: 'recibos',    label: '📎 Recibos'    },
        ] as { id: Tab; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold font-body transition-all"
            style={tab === t.id
              ? { background: NAVY, color: 'white' }
              : { color: '#888580' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'vacaciones' && <VacacionesTab />}
      {tab === 'sueldos'    && <SueldosTab />}
      {tab === 'recibos'    && <RecibosTab />}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   TAB 1: VACACIONES
───────────────────────────────────────────────────────────── */
function VacacionesTab() {
  const [year,      setYear]      = useState(CURRENT_YEAR)
  const [records,   setRecords]   = useState<VacRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [logs,      setLogs]      = useState<VacLog[]>([])
  const [editing,   setEditing]   = useState<Record<number, { taken: string; entitled: string; desc: string }>>({})
  const [saving,    setSaving]    = useState<number | null>(null)
  const [showLogForm, setShowLogForm] = useState(false)

  const emptyLog = { employee_id: '', date_from: '', date_to: '', days: '', notes: '', approved_by: '' }
  const [logForm, setLogForm] = useState(emptyLog)

  const load = useCallback(() => {
    api.get<VacRecord[]>(`/vacations/?year=${year}`).then(setRecords).catch(() => setRecords([]))
    api.get<VacLog[]>(`/vacations/log?year=${year}`).then(setLogs).catch(() => setLogs([]))
  }, [year])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.get<Employee[]>('/employees/').then(setEmployees).catch(() => setEmployees([]))
  }, [])

  const initYear = async () => {
    await api.post(`/vacations/init-year/${year}`, {})
    load()
  }

  const saveRecord = async (id: number) => {
    const edit = editing[id]
    if (!edit) return
    setSaving(id)
    try {
      // PUT body matches VacationRecordUpdate schema del backend
      // (espejo de la hoja Excel: celdas editables C=entitled, D=taken, H=description)
      await api.put(`/vacations/${id}`, {
        days_taken:    parseInt(edit.taken)    || 0,
        days_entitled: parseInt(edit.entitled) || 0,
        description:   edit.desc || null,
      })
      load()
      setEditing(prev => { const n = { ...prev }; delete n[id]; return n })
    } finally { setSaving(null) }
  }

  const addLog = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!logForm.employee_id || !logForm.date_from || !logForm.date_to) return
    try {
      await api.post('/vacations/log', {
        year, employee_id: parseInt(logForm.employee_id),
        date_from: logForm.date_from, date_to: logForm.date_to,
        days: parseInt(logForm.days) || 0,
        notes: logForm.notes || null, approved_by: logForm.approved_by || null,
      })
      setLogForm(emptyLog); setShowLogForm(false); load()
    } catch (err: any) { alert('Error: ' + err.message) }
  }

  const approveLog = async (id: number) => {
    const by = prompt('¿Quién aprueba?', 'Administración')
    if (!by) return
    await api.put(`/vacations/log/${id}/approve?approved_by=${encodeURIComponent(by)}`, {})
    load()
  }

  const handlePdf = async () => {
    try { await api.pdf(`/vacations/pdf/${year}`, `vacaciones_${year}.pdf`) }
    catch (err: any) { alert('Error PDF: ' + err.message) }
  }

  // Totales
  const totals = {
    entitled:    records.reduce((a, r) => a + (r.days_entitled    ?? 0), 0),
    taken:       records.reduce((a, r) => a + (r.days_taken       ?? 0), 0),
    prev:        records.reduce((a, r) => a + (r.pending_prev_year ?? 0), 0),
    available:   records.reduce((a, r) => a + (r.total_available  ?? 0), 0),
    pending:     records.reduce((a, r) => a + (r.pending_current  ?? 0), 0),
  }

  const setEdit = (r: VacRecord, field: 'taken' | 'entitled' | 'desc', val: string) =>
    setEditing(prev => ({
      ...prev,
      [r.id]: {
        taken:    field === 'taken'    ? val : (prev[r.id]?.taken    ?? String(r.days_taken)),
        entitled: field === 'entitled' ? val : (prev[r.id]?.entitled ?? String(r.days_entitled ?? 0)),
        desc:     field === 'desc'     ? val : (prev[r.id]?.desc     ?? r.description ?? ''),
      }
    }))

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-brand-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none">
            {ALL_YEARS.map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={initYear}
            className="flex items-center gap-2 border border-brand-border text-brand-muted hover:bg-brand-off-white px-3 py-2 rounded-lg text-sm font-body">
            <RefreshCw size={14} /> Inicializar {year}
          </button>
          <button onClick={handlePdf}
            className="flex items-center gap-2 border border-brand-border text-brand-muted hover:bg-brand-off-white px-3 py-2 rounded-lg text-sm font-body">
            <FileDown size={14} /> PDF
          </button>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-brand-muted text-sm font-body mb-4">No hay registros para {year}.</p>
          <button onClick={initYear}
            style={{ background: CORAL }}
            className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-semibold mx-auto hover:opacity-90">
            <RefreshCw size={14} /> Inicializar {year}
          </button>
        </div>
      ) : (
        <>
          {/* ── SECCIÓN 1: Situación Actual ── */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div style={{ background: CORAL }} className="px-5 py-3">
              <p className="text-white text-sm font-bold tracking-wide font-head">
                📅 SITUACIÓN ACTUAL — {year}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead style={{ background: '#f5ede9' }}>
                  <tr>
                    <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest border-b border-brand-border w-8"
                      style={{ color: CORAL }}>N°</th>
                    {['Empleado','Vac. Corresponde','Vac. Tomadas','Pend. Año Ant.','Total Disponible',`Pendientes ${year}`,'Sucursal','Descripción',''].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest border-b border-brand-border"
                        style={{ color: NAVY }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => {
                    const edit    = editing[r.id]
                    const isDirty = !!edit
                    const isBranchIndep = r.branch_name === 'INDEPENDENCIA'
                    return (
                      <tr key={r.id}
                        className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}
                        style={{ borderLeft: `3px solid ${isBranchIndep ? CORAL : NAVY}` }}>
                        <td className="px-3 py-2 text-[10px] font-bold text-center font-body"
                          style={{ color: CORAL }}>{i + 1}</td>
                        <td className="px-4 py-2 text-xs font-semibold text-gray-800 font-body">
                          <div className="flex items-center gap-1.5">
                            {r.pending_current === 0
                              ? <CheckCircle size={12} className="text-green-500 shrink-0" />
                              : <Clock size={12} className="text-amber-500 shrink-0" />}
                            {r.employee_name}
                          </div>
                        </td>
                        {/* Vac. Corresponde — editable (col C Excel) */}
                        <td className="px-2 py-1.5 text-center">
                          <input type="number" min={0}
                            className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-center w-14 focus:outline-none focus:border-coral font-body"
                            value={edit?.entitled ?? r.days_entitled}
                            onChange={e => setEdit(r, 'entitled', e.target.value)} />
                        </td>
                        {/* Vac. Tomadas — editable (col D Excel) */}
                        <td className="px-2 py-1.5 text-center">
                          <input type="number" min={0}
                            className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-center w-14 focus:outline-none focus:border-coral font-body"
                            value={edit?.taken ?? r.days_taken}
                            onChange={e => setEdit(r, 'taken', e.target.value)} />
                        </td>
                        {/* Pendientes año ant. — calculado automático (col E Excel: VLOOKUP año anterior) */}
                        <td className="px-4 py-2 text-xs text-center text-brand-muted font-body">{r.pending_prev_year}</td>
                        {/* Total Disponible — fórmula: C+E (col F Excel) */}
                        <td className="px-4 py-2 text-xs text-center font-bold font-body"
                          style={{ background: '#fef9c3' }}>
                          <span className="text-amber-800 font-bold">{r.total_available}</span>
                        </td>
                        {/* Pendientes año actual — fórmula: F-D (col G Excel) */}
                        <td className="px-4 py-2 text-xs text-center font-body"
                          style={{ background: r.pending_current > 0 ? '#fef3c7' : '#dcfce7' }}>
                          <span className={`font-bold ${r.pending_current > 0 ? 'text-amber-800' : 'text-green-800'}`}>
                            {r.pending_current}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs font-semibold font-body"
                          style={{ color: isBranchIndep ? CORAL : NAVY }}>
                          {isBranchIndep ? 'Indep.' : 'Luro'}
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="text" placeholder="Fechas tomadas…"
                            className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-full min-w-36 focus:outline-none focus:border-coral font-body"
                            value={edit?.desc ?? r.description ?? ''}
                            onChange={e => setEdit(r, 'desc', e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {isDirty && (
                            <button disabled={saving === r.id} onClick={() => saveRecord(r.id)}
                              style={{ background: CORAL }}
                              className="text-white text-xs px-3 py-1.5 rounded-lg font-semibold hover:opacity-90">
                              {saving === r.id ? '…' : 'OK'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: NAVY }}>
                    <td className="px-3 py-2.5 text-white/40 text-[10px] text-center font-body">—</td>
                    <td className="px-4 py-2.5 text-white text-xs font-bold uppercase tracking-widest">TOTALES {year}</td>
                    <td className="px-4 py-2.5 text-center text-xs font-bold" style={{ color: CORAL }}>{totals.entitled}</td>
                    <td className="px-4 py-2.5 text-center text-xs font-bold text-white">{totals.taken}</td>
                    <td className="px-4 py-2.5 text-center text-xs font-bold text-white">{totals.prev}</td>
                    <td className="px-4 py-2.5 text-center text-xs font-bold" style={{ color: '#fde68a' }}>{totals.available}</td>
                    <td className="px-4 py-2.5 text-center text-xs font-bold" style={{ color: totals.pending > 0 ? '#fde68a' : '#86efac' }}>{totals.pending}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ── SECCIÓN 2: Datos Empleados ── */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div style={{ background: CORAL }} className="px-5 py-3">
              <p className="text-white text-sm font-bold tracking-wide font-head">
                👥 DATOS EMPLEADOS — ANTIGÜEDAD Y VACACIONES POR CONVENIO
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead style={{ background: '#f5ede9' }}>
                  <tr>
                    <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest border-b border-brand-border w-8"
                      style={{ color: CORAL }}>N°</th>
                    {['Empleado','Fecha Ingreso','Meses','Años','Vac/Año (días)','Sucursal'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest border-b border-brand-border"
                        style={{ color: CORAL }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp, i) => {
                    // Equivalentes a fórmulas de hoja EMPLEADOS del Excel:
                    // Col C = ROUNDDOWN(YEARFRAC(B,TODAY())*12,0) → months_of_service (API)
                    // Col D = C/12                                 → years_of_service  (API)
                    // Col E = IF(D<5,14,IF(D<10,21,28))           → vacation_days_entitled (API)
                    const meses   = emp.months_of_service ?? 0
                    const anos    = (meses / 12).toFixed(2)
                    const isIndep = emp.branch_name === 'INDEPENDENCIA'
                    return (
                      <tr key={emp.id}
                        className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}
                        style={{ borderLeft: `3px solid ${isIndep ? CORAL : NAVY}` }}>
                        <td className="px-3 py-2.5 text-[10px] font-bold text-center font-body"
                          style={{ color: CORAL }}>{i + 1}</td>
                        <td className="px-4 py-2.5 text-xs font-semibold text-gray-800 font-body">{emp.name}</td>
                        <td className="px-4 py-2.5 text-xs text-brand-muted font-body">
                          {new Date(emp.hire_date).toLocaleDateString('es-AR')}
                        </td>
                        {/* Col C — Meses (ROUNDDOWN YEARFRAC*12) */}
                        <td className="px-4 py-2.5 text-xs text-center font-body">{meses}</td>
                        {/* Col D — Años (C/12) */}
                        <td className="px-4 py-2.5 text-xs text-center font-body">{anos}</td>
                        {/* Col E — Vac/Año IF(años<5,14,IF(años<10,21,28)) */}
                        <td className="px-4 py-2.5 text-xs text-center font-body"
                          style={{ background: '#fef9c3' }}>
                          <span className="text-amber-800 font-bold">{emp.vacation_days_entitled} días</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-semibold font-body" style={{ color: isIndep ? CORAL : NAVY }}>
                          {isIndep ? 'Indep.' : 'Luro'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-brand-border" style={{ background: '#fef9c3' }}>
              <p className="text-[11px] text-amber-800 font-body font-semibold">
                ⚖️ Fórmula convenio: &lt; 5 años = 14 días &nbsp;·&nbsp; 5 a 10 años = 21 días &nbsp;·&nbsp; ≥ 10 años = 28 días
              </p>
            </div>
          </div>

          {/* ── SECCIÓN 3: Solicitudes ── */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div style={{ background: NAVY }} className="px-5 py-3.5 flex items-center justify-between">
              <p className="text-white text-sm font-bold tracking-wide font-head">
                📋 DETALLE DE SOLICITUDES Y VACACIONES APROBADAS — {year}
              </p>
              <button onClick={() => setShowLogForm(!showLogForm)}
                style={{ background: CORAL }}
                className="flex items-center gap-2 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90">
                <Plus size={13} /> Nueva solicitud
              </button>
            </div>

            {showLogForm && (
              <form onSubmit={addLog}
                className="px-5 py-4 border-b border-brand-border grid grid-cols-2 md:grid-cols-6 gap-3"
                style={{ background: '#f5ede9' }}>
                <div className="col-span-2 md:col-span-1">
                  <label className="text-[10px] font-bold uppercase text-brand-muted block mb-1 font-body">Empleado *</label>
                  <select required
                    className="w-full border border-brand-border rounded-lg px-2 py-1.5 text-xs font-body focus:outline-none"
                    value={logForm.employee_id}
                    onChange={e => setLogForm(f => ({ ...f, employee_id: e.target.value }))}>
                    <option value="">— Seleccionar —</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-brand-muted block mb-1 font-body">Desde *</label>
                  <input type="date" required
                    className="w-full border border-brand-border rounded-lg px-2 py-1.5 text-xs font-body focus:outline-none"
                    value={logForm.date_from}
                    onChange={e => setLogForm(f => ({ ...f, date_from: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-brand-muted block mb-1 font-body">Hasta *</label>
                  <input type="date" required
                    className="w-full border border-brand-border rounded-lg px-2 py-1.5 text-xs font-body focus:outline-none"
                    value={logForm.date_to}
                    onChange={e => setLogForm(f => ({ ...f, date_to: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-brand-muted block mb-1 font-body">Días</label>
                  <input type="number" min={1}
                    className="w-full border border-brand-border rounded-lg px-2 py-1.5 text-xs font-body focus:outline-none"
                    value={logForm.days}
                    onChange={e => setLogForm(f => ({ ...f, days: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-brand-muted block mb-1 font-body">Notas</label>
                  <input type="text" placeholder="Opcional"
                    className="w-full border border-brand-border rounded-lg px-2 py-1.5 text-xs font-body focus:outline-none"
                    value={logForm.notes}
                    onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div className="flex items-end gap-2">
                  <button type="submit"
                    style={{ background: CORAL }}
                    className="text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 h-fit">
                    Guardar
                  </button>
                  <button type="button" onClick={() => setShowLogForm(false)}
                    className="text-brand-muted px-3 py-1.5 rounded-lg text-xs border border-brand-border hover:bg-gray-50 h-fit">
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead style={{ background: '#f8f7f5' }}>
                  <tr>
                    <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest border-b border-brand-border w-8"
                      style={{ color: NAVY }}>N°</th>
                    {['Fecha Registro','Empleado','Desde','Hasta','Días','Estado','Aprobado Por','Notas',''].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest border-b border-brand-border"
                        style={{ color: NAVY }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l, i) => (
                    <tr key={l.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                      <td className="px-3 py-2 text-[10px] font-bold text-center text-brand-muted font-body">{i + 1}</td>
                      <td className="px-4 py-2 text-xs text-brand-muted font-body">
                        {l.registered_date
                          ? new Date(l.registered_date).toLocaleDateString('es-AR')
                          : '—'}
                      </td>
                      <td className="px-4 py-2 text-xs font-semibold font-body text-gray-800">{l.employee_name ?? '—'}</td>
                      <td className="px-4 py-2 text-xs font-body text-gray-600">{l.date_from?.slice(0, 10) ?? '—'}</td>
                      <td className="px-4 py-2 text-xs font-body text-gray-600">{l.date_to?.slice(0, 10) ?? '—'}</td>
                      <td className="px-4 py-2 text-xs text-center font-body font-bold">{l.days}</td>
                      <td className="px-4 py-2 text-xs"
                        style={{ background: l.status === 'Aprobado' ? '#dcfce7' : '#fef3c7' }}>
                        <span className={`text-[10px] font-bold font-body ${
                          l.status === 'Aprobado' ? 'text-green-800' : 'text-amber-800'
                        }`}>{l.status}</span>
                      </td>
                      <td className="px-4 py-2 text-xs text-brand-muted font-body">{l.approved_by ?? '—'}</td>
                      <td className="px-4 py-2 text-xs text-brand-muted font-body">{l.notes ?? '—'}</td>
                      <td className="px-2 py-2 text-right">
                        {l.status !== 'Aprobado' && (
                          <button onClick={() => approveLog(l.id)}
                            className="text-green-600 hover:text-green-800 text-[10px] font-semibold font-body px-2 py-1 rounded border border-green-200 hover:bg-green-50">
                            Aprobar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {/* Empty rows to always show at least 8 rows */}
                  {Array.from({ length: Math.max(0, 8 - logs.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} className={(logs.length + i) % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                      <td className="px-3 py-2.5 text-[10px] text-center text-gray-200 font-body">{logs.length + i + 1}</td>
                      <td colSpan={9} className="px-4 py-2.5 border-b border-gray-50" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   TAB 2: SUELDOS
───────────────────────────────────────────────────────────── */
function SueldosTab() {
  const [month,   setMonth]   = useState(MONTHS[CURRENT_MONTH_IDX])
  const [year]                = useState(CURRENT_YEAR)
  const [periods, setPeriods] = useState<any[]>([])
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => {
    api.get<any[]>(`/payroll/periods?year=${year}`).then(setPeriods)
  }, [year])

  useEffect(() => { load() }, [load])

  const createPeriod = async (branchId: number) => {
    setCreating(true)
    try {
      await api.post(`/payroll/periods?month=${month}&year=${year}&branch_id=${branchId}`, {})
      load()
    } finally { setCreating(false) }
  }

  const updateItem = async (itemId: number, field: string, val: string, item: any) => {
    const updated = { ...item, [field]: val === '' ? null : parseFloat(val) }
    await api.put(`/payroll/items/${itemId}`, {
      employee_id:  updated.employee_id,
      absences:     updated.absences     ?? 0,
      base_salary:  updated.base_salary  ?? null,
      bank_deposit: updated.bank_deposit ?? 0,
      advance:      updated.advance      ?? 0,
      plus_pct:     updated.plus_pct     ?? 0,
      incentive:    updated.incentive    ?? 0,
    })
    load()
  }

  const closePeriod = async (periodId: number) => {
    if (!confirm('¿Cerrar esta liquidación? No se podrán hacer cambios.')) return
    await api.post(`/payroll/periods/${periodId}/close`, {})
    load()
  }

  const handlePdf = async (path: string, filename: string) => {
    try { await api.pdf(path, filename) }
    catch (err: any) { alert('Error PDF: ' + err.message) }
  }

  const branchPeriods = (branchId: number) =>
    periods.filter(p => p.branch_id === branchId && p.month === month && p.year === year)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <select value={month} onChange={e => setMonth(e.target.value)}
          className="border border-brand-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none">
          {MONTHS.map(m => <option key={m}>{m}</option>)}
        </select>
        <span className="text-sm text-brand-muted font-body">{year}</span>
      </div>

      {BRANCHES.map(branch => {
        const period   = branchPeriods(branch.id)[0]
        const items    = period?.items ?? []
        const isClosed = period?.status === 'CLOSED'
        const totBruto = items.reduce((a: number, i: any) => a + (i.gross_total ?? 0), 0)
        const totNet   = items.reduce((a: number, i: any) => a + (i.net_total   ?? 0), 0)

        return (
          <div key={branch.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div style={{ background: branch.id === 1 ? NAVY : CORAL }}
              className="px-5 py-3 flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-white text-sm font-bold font-head">{branch.name}</p>
                <p className="text-white/60 text-xs font-body">Convenio {branch.union} · {month} {year}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {!period && (
                  <button onClick={() => createPeriod(branch.id)} disabled={creating}
                    className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-semibold font-body flex items-center gap-1">
                    <Plus size={12} /> Abrir Mes
                  </button>
                )}
                {period && !isClosed && (
                  <button onClick={() => closePeriod(period.id)}
                    className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-semibold font-body flex items-center gap-1">
                    <Lock size={12} /> Cerrar
                  </button>
                )}
                {period && (<>
                  <button onClick={() => handlePdf(`/payroll/periods/${period.id}/pdf`, `sueldos_${branch.name}_${month}_${year}.pdf`)}
                    className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-semibold font-body flex items-center gap-1">
                    <FileDown size={12} /> Planilla
                  </button>
                  <button onClick={() => handlePdf(`/payroll/periods/${period.id}/payslips`, `recibos_${branch.name}_${month}_${year}.pdf`)}
                    className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-semibold font-body flex items-center gap-1">
                    <FileDown size={12} /> Recibos
                  </button>
                </>)}
              </div>
            </div>

            {period ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead style={{ background: '#f8f7f5' }}>
                    <tr>
                      {['Empleado','Inas.','Base $','Plus %','Plus $','Incentivo','Bruto $','Depósito','Adelanto','Percibido $'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-left border-b border-brand-border"
                          style={{ color: NAVY }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item: any, i: number) => (
                      <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                        <td className="px-3 py-2 text-xs font-semibold font-body text-gray-800">{item.employee_name}</td>
                        <td className="px-2 py-1.5">
                          <NumInput disabled={isClosed} value={item.absences} integer
                            onBlur={v => updateItem(item.id, 'absences', v, item)} />
                        </td>
                        {['base_salary','plus_pct','bank_deposit','advance','incentive'].map(f => (
                          <td key={f} className="px-2 py-1.5">
                            <NumInput disabled={isClosed} value={item[f]}
                              step={f === 'plus_pct' ? 0.01 : 1}
                              onBlur={v => updateItem(item.id, f, v, item)} />
                          </td>
                        ))}
                        <td className="px-3 py-2 text-xs text-right font-body text-gray-600">{fmt$(item.plus_amount)}</td>
                        <td className="px-3 py-2 text-xs text-right font-bold font-body text-gray-800">{fmt$(item.gross_total)}</td>
                        <td className="px-3 py-2 text-xs text-right font-bold font-body text-green-700">{fmt$(item.net_total)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: NAVY }}>
                      <td colSpan={6} className="px-3 py-2.5 text-white text-xs font-bold uppercase tracking-widest">TOTALES</td>
                      <td className="px-3 py-2.5 text-xs text-right font-bold" style={{ color: CORAL }}>{fmt$(totBruto)}</td>
                      <td colSpan={2} />
                      <td className="px-3 py-2.5 text-xs text-right font-bold text-green-400">{fmt$(totNet)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 py-10 text-center text-brand-muted text-sm font-body">
                No hay liquidación para {month} {year}.{' '}
                <button onClick={() => createPeriod(branch.id)} className="text-coral font-semibold hover:underline" style={{ color: CORAL }}>
                  Abrir mes
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   TAB 3: RECIBOS DE SUELDO
───────────────────────────────────────────────────────────── */
function RecibosTab() {
  const [year,      setYear]      = useState(CURRENT_YEAR)
  const [month,     setMonth]     = useState(MONTHS[CURRENT_MONTH_IDX])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [receipts,  setReceipts]  = useState<Receipt[]>([])
  const [uploading, setUploading] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTarget = useRef<number | null>(null)

  const load = useCallback(() => {
    api.get<Receipt[]>(`/receipts/?year=${year}&month=${month}`)
      .then(setReceipts).catch(() => setReceipts([]))
  }, [year, month])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.get<Employee[]>('/employees/').then(setEmployees).catch(() => setEmployees([]))
  }, [])

  const triggerUpload = (employeeId: number) => {
    uploadTarget.current = employeeId
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const empId = uploadTarget.current
    if (!file || !empId) return

    setUploading(empId)
    try {
      const fd = new FormData()
      fd.append('employee_id', String(empId))
      fd.append('year',        String(year))
      fd.append('month',       month)
      fd.append('file',        file)
      await api.upload('/receipts/upload', fd)
      load()
    } catch (err: any) {
      alert('Error al subir: ' + err.message)
    } finally {
      setUploading(null)
      uploadTarget.current = null
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const deleteReceipt = async (id: number) => {
    if (!confirm('¿Eliminar este recibo?')) return
    await api.delete(`/receipts/${id}`)
    load()
  }

  const downloadReceipt = async (id: number, filename: string) => {
    try {
      await api.pdf(`/receipts/${id}/download`, filename)
    } catch (err: any) {
      alert('Error al descargar: ' + err.message)
    }
  }

  const getReceipt = (empId: number) =>
    receipts.find(r => r.employee_id === empId)

  const luro  = employees.filter(e => e.branch_name === 'LURO')
  const indep = employees.filter(e => e.branch_name === 'INDEPENDENCIA')

  const EmployeeRow = ({ emp }: { emp: Employee }) => {
    const receipt = getReceipt(emp.id)
    return (
      <tr className="bg-white border-t border-brand-border hover:bg-gray-50/60 transition-colors">
        <td className="px-5 py-3 text-sm font-semibold font-body text-gray-800">{emp.name}</td>
        <td className="px-4 py-3">
          {receipt ? (
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-green-500 shrink-0" />
              <span className="text-xs text-green-700 font-semibold font-body truncate max-w-40">
                {receipt.filename}
              </span>
            </div>
          ) : (
            <span className="text-xs text-brand-muted font-body flex items-center gap-1.5">
              <Clock size={12} className="text-amber-400" />
              Sin recibo
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-brand-muted font-body">
          {receipt?.uploaded_at
            ? new Date(receipt.uploaded_at).toLocaleDateString('es-AR')
            : '—'}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            {receipt ? (
              <>
                <button
                  onClick={() => downloadReceipt(receipt.id, receipt.filename)}
                  className="flex items-center gap-1 text-xs font-semibold font-body px-2.5 py-1.5 rounded-lg border border-brand-border hover:bg-gray-50 text-gray-600">
                  <FileDown size={12} /> Ver PDF
                </button>
                <button
                  onClick={() => triggerUpload(emp.id)}
                  disabled={uploading === emp.id}
                  className="flex items-center gap-1 text-xs font-semibold font-body px-2.5 py-1.5 rounded-lg border hover:bg-blue-50 text-blue-600 border-blue-200">
                  <Upload size={12} /> Reemplazar
                </button>
                <button
                  onClick={() => deleteReceipt(receipt.id)}
                  className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                  <Trash2 size={13} />
                </button>
              </>
            ) : (
              <button
                onClick={() => triggerUpload(emp.id)}
                disabled={uploading === emp.id}
                style={{ background: uploading === emp.id ? '#ccc' : CORAL }}
                className="flex items-center gap-1.5 text-white text-xs font-semibold font-body px-3 py-1.5 rounded-lg hover:opacity-90">
                {uploading === emp.id
                  ? <><span className="animate-pulse">Subiendo…</span></>
                  : <><Upload size={12} /> Subir recibo</>}
              </button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  const pct = employees.length > 0
    ? Math.round((receipts.length / employees.length) * 100)
    : 0

  return (
    <div className="space-y-5">
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="application/pdf"
        className="hidden" onChange={handleFileChange} />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="border border-brand-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none">
          {ALL_YEARS.map(y => <option key={y}>{y}</option>)}
        </select>
        <select value={month} onChange={e => setMonth(e.target.value)}
          className="border border-brand-border rounded-lg px-3 py-2 text-sm font-body focus:outline-none">
          {MONTHS.map(m => <option key={m}>{m}</option>)}
        </select>

        {/* Progress badge */}
        <div className="flex items-center gap-2 bg-white rounded-lg px-4 py-2 shadow-sm border border-brand-border">
          <div className="w-20 bg-gray-100 rounded-full h-1.5">
            <div className="h-1.5 rounded-full transition-all" style={{ background: CORAL, width: `${pct}%` }} />
          </div>
          <span className="text-xs font-semibold font-body" style={{ color: CORAL }}>
            {receipts.length}/{employees.length} recibos
          </span>
        </div>
      </div>

      {/* LURO */}
      {luro.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div style={{ background: NAVY }} className="px-5 py-3">
            <p className="text-white text-xs font-bold uppercase tracking-widest font-body">
              Luro · {month} {year}
            </p>
          </div>
          <table className="w-full text-sm">
            <thead style={{ background: '#f8f7f5' }}>
              <tr>
                {['Empleado', 'Estado', 'Subido el', ''].map(h => (
                  <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest border-b border-brand-border font-body"
                    style={{ color: NAVY }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {luro.map(emp => <EmployeeRow key={emp.id} emp={emp} />)}
            </tbody>
          </table>
        </div>
      )}

      {/* INDEPENDENCIA */}
      {indep.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div style={{ background: CORAL }} className="px-5 py-3">
            <p className="text-white text-xs font-bold uppercase tracking-widest font-body">
              Independencia · {month} {year}
            </p>
          </div>
          <table className="w-full text-sm">
            <thead style={{ background: '#f8f7f5' }}>
              <tr>
                {['Empleado', 'Estado', 'Subido el', ''].map(h => (
                  <th key={h} className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest border-b border-brand-border font-body"
                    style={{ color: CORAL }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {indep.map(emp => <EmployeeRow key={emp.id} emp={emp} />)}
            </tbody>
          </table>
        </div>
      )}

      {employees.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-brand-muted font-body text-sm">
          No hay empleados activos en el sistema.
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Helpers compartidos
───────────────────────────────────────────────────────────── */
function NumInput({ value, onBlur, disabled, integer = false, step = 1 }: {
  value: any; onBlur: (v: string) => void; disabled?: boolean; integer?: boolean; step?: number
}) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => { setV(value ?? '') }, [value])
  return (
    <input type="number" step={step}
      className="border border-gray-200 rounded-lg py-1 px-1.5 text-xs text-right w-20 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed font-body"
      disabled={disabled} value={v}
      onChange={e => setV(e.target.value)}
      onBlur={() => onBlur(v)}
    />
  )
}
