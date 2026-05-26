import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  FileDown, RefreshCw, Plus, Lock, Trash2,
  Upload, CheckCircle, Clock, X, ChevronLeft, ChevronRight,
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
type Tab = 'vacaciones' | 'sueldos' | 'recibos' | 'calendario'

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
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') ?? 'vacaciones') as Tab

  const setTab = (t: Tab) => setSearchParams({ tab: t }, { replace: true })

  const TABS: { id: Tab; label: string; subtitle: string }[] = [
    { id: 'vacaciones', label: '🌴 Vacaciones', subtitle: 'Días tomados y disponibles' },
    { id: 'calendario', label: '📅 Calendario', subtitle: 'Superposición visual'       },
    { id: 'sueldos',    label: '💰 Sueldos',    subtitle: 'Liquidación mensual'        },
    { id: 'recibos',    label: '📎 Recibos',    subtitle: 'PDFs por empleado'          },
  ]
  const current = TABS.find(t => t.id === tab) ?? TABS[0]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div style={{ background: NAVY }} className="rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p style={{ color: CORAL }} className="text-xs font-semibold tracking-widest uppercase mb-1 font-body">
            Sur Maderas · ERP
          </p>
          <h1 className="text-2xl font-bold text-white font-head">Recursos Humanos</h1>
          <p className="text-white/50 text-sm font-body">{current.subtitle}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-brand-border">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold font-body transition-all"
            style={tab === t.id
              ? { background: NAVY, color: 'white' }
              : { color: '#888580' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'vacaciones' && <VacacionesTab />}
      {tab === 'calendario' && <CalendarioTab />}
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

  // Totales — usan valores en vivo (edit state si hay cambios pendientes)
  const totals = records.reduce((acc, r) => {
    const edit      = editing[r.id]
    const entitled  = edit ? (parseInt(edit.entitled) || 0) : (r.days_entitled    ?? 0)
    const taken     = edit ? (parseInt(edit.taken)    || 0) : (r.days_taken       ?? 0)
    const prev      = r.pending_prev_year ?? 0
    const available = entitled + prev
    const pending   = available - taken
    return {
      entitled:  acc.entitled  + entitled,
      taken:     acc.taken     + taken,
      prev:      acc.prev      + prev,
      available: acc.available + available,
      pending:   acc.pending   + pending,
    }
  }, { entitled: 0, taken: 0, prev: 0, available: 0, pending: 0 })

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

                    // ── Cálculo en vivo — igual que fórmulas Excel ──────────
                    // Col C: Vac. Corresponde (editable)
                    const liveEntitled  = edit ? (parseInt(edit.entitled) || 0) : (r.days_entitled  ?? 0)
                    // Col D: Vac. Tomadas (editable)
                    const liveTaken     = edit ? (parseInt(edit.taken)    || 0) : (r.days_taken     ?? 0)
                    // Col E: Pendientes año ant. (automático — VLOOKUP año anterior)
                    const livePrev      = r.pending_prev_year ?? 0
                    // Col F: Total Disponible = C + E  (fórmula Excel: =C+E)
                    const liveAvailable = liveEntitled + livePrev
                    // Col G: Pendientes año actual = F - D  (fórmula Excel: =F-D)
                    const livePending   = liveAvailable - liveTaken

                    const isBranchIndep = r.branch_name === 'INDEPENDENCIA'
                    return (
                      <tr key={r.id}
                        className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}
                        style={{ borderLeft: `3px solid ${isBranchIndep ? CORAL : NAVY}` }}>
                        <td className="px-3 py-2 text-[10px] font-bold text-center font-body"
                          style={{ color: CORAL }}>{i + 1}</td>
                        <td className="px-4 py-2 text-xs font-semibold text-gray-800 font-body">
                          <div className="flex items-center gap-1.5">
                            {livePending === 0
                              ? <CheckCircle size={12} className="text-green-500 shrink-0" />
                              : <Clock size={12} className="text-amber-500 shrink-0" />}
                            {r.employee_name}
                          </div>
                        </td>
                        {/* Col C — Vac. Corresponde editable */}
                        <td className="px-2 py-1.5 text-center">
                          <input type="number" min={0}
                            className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-center w-14 focus:outline-none focus:border-coral font-body"
                            value={edit?.entitled ?? r.days_entitled}
                            onChange={e => setEdit(r, 'entitled', e.target.value)} />
                        </td>
                        {/* Col D — Vac. Tomadas editable */}
                        <td className="px-2 py-1.5 text-center">
                          <input type="number" min={0}
                            className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-center w-14 focus:outline-none focus:border-coral font-body"
                            value={edit?.taken ?? r.days_taken}
                            onChange={e => setEdit(r, 'taken', e.target.value)} />
                        </td>
                        {/* Col E — Pendientes año ant. (solo lectura, VLOOKUP año anterior) */}
                        <td className="px-4 py-2 text-xs text-center text-brand-muted font-body">{livePrev}</td>
                        {/* Col F — Total Disponible = C+E  (recalcula en vivo) */}
                        <td className="px-4 py-2 text-xs text-center font-bold font-body"
                          style={{ background: '#fef9c3' }}>
                          <span className="text-amber-800 font-bold">{liveAvailable}</span>
                        </td>
                        {/* Col G — Pendientes = F-D  (recalcula en vivo) */}
                        <td className="px-4 py-2 text-xs text-center font-body"
                          style={{ background: livePending > 0 ? '#fef3c7' : '#dcfce7' }}>
                          <span className={`font-bold ${livePending > 0 ? 'text-amber-800' : 'text-green-800'}`}>
                            {livePending}
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
   TAB 2: CALENDARIO — Gantt de vacaciones
───────────────────────────────────────────────────────────── */
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAY_NAMES   = ['D','L','M','X','J','V','S']

// Paleta determinista por empleado (misma lógica que proveedores en Compras)
function empColor(name: string): string {
  const PALETTE = [
    '#C8603A','#070614','#3b82f6','#10b981','#8b5cf6',
    '#f59e0b','#ef4444','#06b6d4','#84cc16','#ec4899','#6366f1',
  ]
  let h = 0
  for (let i = 0; i < name.length; i++) h = Math.imul(31, h) + name.charCodeAt(i) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}

function CalendarioTab() {
  const [year,      setYear]      = useState(CURRENT_YEAR)
  const [monthIdx,  setMonthIdx]  = useState(CURRENT_MONTH_IDX)
  const [logs,      setLogs]      = useState<VacLog[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  useEffect(() => {
    api.get<VacLog[]>(`/vacations/log?year=${year}`).then(setLogs).catch(() => setLogs([]))
  }, [year])
  useEffect(() => {
    api.get<Employee[]>('/employees/').then(setEmployees).catch(() => setEmployees([]))
  }, [])

  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()

  // Verifica si un empleado tiene vacación aprobada en un día puntual
  const getLog = (empId: number, day: number): VacLog | undefined => {
    const d = new Date(year, monthIdx, day)
    return logs.find(l => {
      if (l.employee_id !== empId || !l.date_from || !l.date_to) return false
      const from = new Date(String(l.date_from).slice(0, 10))
      const to   = new Date(String(l.date_to).slice(0, 10))
      return d >= from && d <= to
    })
  }

  // Días que tienen AL MENOS 2 empleados en vacación (superposición)
  const overlapDays = new Set(
    Array.from({ length: daysInMonth }, (_, i) => i + 1).filter(day =>
      employees.filter(e => getLog(e.id, day)).length >= 2
    )
  )

  const prevMonth = () => {
    if (monthIdx === 0) { setMonthIdx(11); setYear(y => y - 1) }
    else setMonthIdx(m => m - 1)
  }
  const nextMonth = () => {
    if (monthIdx === 11) { setMonthIdx(0); setYear(y => y + 1) }
    else setMonthIdx(m => m + 1)
  }

  // Empleados que tienen algún log en el mes visible
  const activeEmps = employees.filter(emp =>
    Array.from({ length: daysInMonth }, (_, i) => i + 1).some(d => getLog(emp.id, d))
  )
  // Resto de empleados (sin log en este mes)
  const inactiveEmps = employees.filter(emp => !activeEmps.includes(emp))

  const renderGrid = (emps: Employee[], dimmed = false) => (
    emps.map(emp => {
      const color = empColor(emp.name)
      const isIndep = emp.branch_name === 'INDEPENDENCIA'
      return (
        <tr key={emp.id} className="hover:bg-gray-50/60 transition-colors">
          {/* Empleado */}
          <td className="px-3 py-1.5 text-xs font-semibold font-body whitespace-nowrap sticky left-0 bg-white z-10 border-r border-brand-border"
            style={{ borderLeft: `3px solid ${isIndep ? CORAL : NAVY}`, opacity: dimmed ? 0.35 : 1 }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-gray-700">{emp.name}</span>
              <span className="text-[10px] font-normal" style={{ color: isIndep ? CORAL : NAVY }}>
                {isIndep ? 'Indep.' : 'Luro'}
              </span>
            </div>
          </td>
          {/* Días */}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1
            const log = getLog(emp.id, day)
            const dow = new Date(year, monthIdx, day).getDay() // 0=Dom, 6=Sáb
            const isWeekend = dow === 0 || dow === 6
            const isOverlap = overlapDays.has(day) && !!log
            return (
              <td key={day}
                title={log ? `${emp.name}: ${String(log.date_from).slice(0,10)} → ${String(log.date_to).slice(0,10)} (${log.days} días)` : undefined}
                className="p-0 text-center"
                style={{
                  minWidth: '26px',
                  background: log
                    ? isOverlap ? '#fde68a' : color   // amarillo si hay superposición
                    : isWeekend ? '#f8f7f5' : 'white',
                  opacity: dimmed && !log ? 0.25 : 1,
                }}>
                {log && (
                  <div className="w-full h-6 flex items-center justify-center">
                    {isOverlap && <span className="text-[8px] font-bold text-amber-700">!</span>}
                  </div>
                )}
                {!log && <div className="w-full h-6" />}
              </td>
            )
          })}
        </tr>
      )
    })
  )

  return (
    <div className="space-y-5">
      {/* Controles de mes */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-white border border-brand-border rounded-xl shadow-sm px-1 py-1">
          <button onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-brand-muted transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="px-3 text-sm font-bold font-head min-w-36 text-center" style={{ color: NAVY }}>
            {MONTH_NAMES[monthIdx]} {year}
          </span>
          <button onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-brand-muted transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
        {/* Leyenda */}
        <div className="flex items-center gap-4 bg-white border border-brand-border rounded-xl px-4 py-2 shadow-sm text-xs font-body">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded" style={{ background: CORAL }} />
            <span className="text-brand-muted">En vacaciones</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-amber-200" />
            <span className="text-brand-muted">Superposición !</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-gray-100" />
            <span className="text-brand-muted">Fin de semana</span>
          </div>
        </div>
      </div>

      {/* Grid Gantt */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div style={{ background: NAVY }} className="px-5 py-3 flex items-center justify-between">
          <p className="text-white text-sm font-bold font-head">
            📅 CALENDARIO — {MONTH_NAMES[monthIdx].toUpperCase()} {year}
          </p>
          {overlapDays.size > 0 && (
            <span className="text-xs font-semibold font-body bg-amber-400 text-amber-900 px-2.5 py-1 rounded-full">
              ⚠️ {overlapDays.size} día{overlapDays.size > 1 ? 's' : ''} con superposición
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="text-xs border-collapse" style={{ minWidth: `${180 + daysInMonth * 26}px` }}>
            <thead>
              <tr style={{ background: '#f5ede9' }}>
                <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest border-b border-r border-brand-border sticky left-0 z-10 min-w-44"
                  style={{ color: NAVY, background: '#f5ede9' }}>
                  Empleado
                </th>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1
                  const dow = new Date(year, monthIdx, day).getDay()
                  const isWeekend = dow === 0 || dow === 6
                  const isOverlap = overlapDays.has(day)
                  return (
                    <th key={day}
                      className="py-1 text-center border-b border-brand-border font-body"
                      style={{
                        minWidth: '26px',
                        color: isOverlap ? '#b45309' : isWeekend ? '#aaa' : NAVY,
                        background: isOverlap ? '#fef9c3' : '#f5ede9',
                        fontWeight: isOverlap ? 800 : 600,
                      }}>
                      <div className="text-[10px]">{day}</div>
                      <div style={{ color: isWeekend ? '#ccc' : CORAL, fontSize: '8px' }}>
                        {DAY_NAMES[dow]}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {activeEmps.length > 0
                ? renderGrid(activeEmps)
                : (
                  <tr>
                    <td colSpan={daysInMonth + 1}
                      className="px-5 py-10 text-center text-brand-muted font-body text-sm">
                      No hay vacaciones registradas en {MONTH_NAMES[monthIdx]} {year}.
                      <br />
                      <span className="text-xs">Agregá solicitudes desde la pestaña Vacaciones.</span>
                    </td>
                  </tr>
                )
              }
              {/* Separador si hay empleados sin vacaciones */}
              {activeEmps.length > 0 && inactiveEmps.length > 0 && (
                <tr>
                  <td colSpan={daysInMonth + 1}
                    className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-muted border-t border-b border-brand-border font-body"
                    style={{ background: '#f8f7f5' }}>
                    Sin vacaciones este mes
                  </td>
                </tr>
              )}
              {inactiveEmps.length > 0 && renderGrid(inactiveEmps, true)}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumen del mes */}
      {activeEmps.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {activeEmps.map(emp => {
            const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
              .filter(d => getLog(emp.id, d)).length
            const color = empColor(emp.name)
            return (
              <div key={emp.id} className="bg-white rounded-xl border border-brand-border px-4 py-3 shadow-sm"
                style={{ borderLeft: `4px solid ${color}` }}>
                <p className="text-xs font-semibold font-body text-gray-700 truncate">{emp.name}</p>
                <p className="text-2xl font-bold font-head mt-0.5" style={{ color }}>
                  {days}
                </p>
                <p className="text-[10px] text-brand-muted font-body">días en {MONTH_NAMES[monthIdx]}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   TAB 3: SUELDOS
───────────────────────────────────────────────────────────── */
type SueldosVista = 'luro' | 'independencia' | 'ambas'

function SueldosTab() {
  const [month,    setMonth]    = useState(MONTHS[CURRENT_MONTH_IDX])
  const [year]                  = useState(CURRENT_YEAR)
  const [periods,  setPeriods]  = useState<any[]>([])
  const [creating, setCreating] = useState(false)
  const [vista,    setVista]    = useState<SueldosVista>('luro')

  const load = useCallback(() => {
    api.get<any[]>(`/payroll/periods?year=${year}`).then(setPeriods)
  }, [year])

  useEffect(() => { load() }, [load])

  const getPeriod = (branchId: number) =>
    periods.find(p => p.branch_id === branchId && p.month === month && p.year === year)

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

  const VISTA_BTNS: { id: SueldosVista; label: string }[] = [
    { id: 'luro',          label: 'Luro'          },
    { id: 'independencia', label: 'Independencia' },
    { id: 'ambas',         label: 'Ambas'         },
  ]

  /* ── Render single-branch full table ── */
  const renderBranchTable = (branchId: number, branchName: string, showIncentivo: boolean) => {
    const period   = getPeriod(branchId)
    const items    = period?.items ?? []
    const isClosed = period?.status === 'CLOSED'
    const totBruto = items.reduce((a: number, i: any) => a + (i.gross_total ?? 0), 0)
    const totNet   = items.reduce((a: number, i: any) => a + (i.net_total   ?? 0), 0)

    return (
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Branch header */}
        <div style={{ background: branchId === 1 ? NAVY : CORAL }}
          className="px-5 py-3 flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-white text-sm font-bold font-head tracking-wide">{branchName}</p>
            <p className="text-white/55 text-[11px] font-body">
              Convenio {branchId === 1 ? 'Madereros' : 'SEC 12'} · {month} {year}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!period && (
              <button onClick={() => createPeriod(branchId)} disabled={creating}
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
            {period && (
              <>
                <button onClick={() => handlePdf(`/payroll/periods/${period.id}/pdf`, `sueldos_${branchName}_${month}_${year}.pdf`)}
                  className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-semibold font-body flex items-center gap-1">
                  <FileDown size={12} /> Planilla
                </button>
                <button onClick={() => handlePdf(`/payroll/periods/${period.id}/payslips`, `recibos_${branchName}_${month}_${year}.pdf`)}
                  className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-semibold font-body flex items-center gap-1">
                  <FileDown size={12} /> Todos Recibos
                </button>
              </>
            )}
          </div>
        </div>

        {period ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm border-collapse">
              <thead>
                <tr style={{ background: '#f0eeeb' }}>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-center border-b border-gray-200 w-8" style={{ color: NAVY }}>N°</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-left border-b border-gray-200" style={{ color: NAVY }}>Empleado</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-center border-b border-gray-200" style={{ color: NAVY }}>Inas.</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-right border-b border-gray-200" style={{ color: NAVY }}>Base $</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-right border-b border-gray-200" style={{ color: NAVY }}>Dep. Banco</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-right border-b border-gray-200" style={{ color: NAVY }}>Adelanto</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-center border-b border-gray-200" style={{ color: NAVY }}>Plus%</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-right border-b border-gray-200" style={{ color: NAVY }}>Plus $</th>
                  {showIncentivo && (
                    <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-right border-b border-gray-200" style={{ color: NAVY }}>Incentivo</th>
                  )}
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-right border-b border-gray-200" style={{ background: '#FFF3CD', color: '#92400E' }}>Total Bruto</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-right border-b border-gray-200" style={{ background: '#D1FAE5', color: '#065F46' }}>Percibido</th>
                  <th className="px-2 py-2.5 border-b border-gray-200 w-8" />
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, i: number) => (
                  <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : ''} style={i % 2 !== 0 ? { background: '#fafaf8' } : {}}>
                    <td className="px-3 py-2 text-center text-[11px] font-bold font-body" style={{ color: CORAL }}>{i + 1}</td>
                    <td className="px-3 py-2 text-xs font-semibold font-body text-gray-800 whitespace-nowrap">{item.employee_name}</td>
                    {/* Inas. */}
                    <td className="px-2 py-1.5 text-center">
                      <NumInput disabled={isClosed} value={item.absences} integer
                        onBlur={v => updateItem(item.id, 'absences', v, item)} />
                    </td>
                    {/* Base $ */}
                    <td className="px-2 py-1.5">
                      <NumInput disabled={isClosed} value={item.base_salary}
                        onBlur={v => updateItem(item.id, 'base_salary', v, item)} />
                    </td>
                    {/* Dep. Banco */}
                    <td className="px-2 py-1.5">
                      <NumInput disabled={isClosed} value={item.bank_deposit}
                        onBlur={v => updateItem(item.id, 'bank_deposit', v, item)} />
                    </td>
                    {/* Adelanto */}
                    <td className="px-2 py-1.5">
                      <NumInput disabled={isClosed} value={item.advance}
                        onBlur={v => updateItem(item.id, 'advance', v, item)} />
                    </td>
                    {/* Plus% */}
                    <td className="px-2 py-1.5 text-center">
                      <NumInput disabled={isClosed} value={item.plus_pct} step={0.01}
                        onBlur={v => updateItem(item.id, 'plus_pct', v, item)} />
                    </td>
                    {/* Plus$ — auto */}
                    <td className="px-3 py-2 text-xs text-right font-body text-gray-600 whitespace-nowrap">
                      {item.plus_amount ? fmt$(item.plus_amount) : '—'}
                    </td>
                    {/* Incentivo (Luro only) */}
                    {showIncentivo && (
                      <td className="px-2 py-1.5">
                        <NumInput disabled={isClosed} value={item.incentive}
                          onBlur={v => updateItem(item.id, 'incentive', v, item)} />
                      </td>
                    )}
                    {/* Total Bruto — auto, amber bg */}
                    <td className="px-3 py-2 text-xs text-right font-bold font-body whitespace-nowrap"
                      style={{ background: '#FFFBEB', color: '#92400E' }}>
                      {fmt$(item.gross_total)}
                    </td>
                    {/* Percibido — auto, green bg */}
                    <td className="px-3 py-2 text-xs text-right font-bold font-body whitespace-nowrap"
                      style={{ background: '#ECFDF5', color: '#065F46' }}>
                      {fmt$(item.net_total)}
                    </td>
                    {/* PDF export icon */}
                    <td className="px-2 py-1.5 text-center">
                      <button
                        title="Exportar recibo"
                        onClick={() => handlePdf(`/payroll/items/${item.id}/payslip`,
                          `recibo_${(item.employee_name || 'emp').replace(/[, ]+/g,'_')}_${month}_${year}.pdf`)}
                        className="text-gray-400 hover:text-coral transition-colors"
                        style={{ color: undefined }}
                        onMouseOver={e => (e.currentTarget.style.color = CORAL)}
                        onMouseOut={e => (e.currentTarget.style.color = '')}>
                        <FileDown size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr style={{ background: NAVY }}>
                  <td colSpan={showIncentivo ? 9 : 8}
                    className="px-3 py-2.5 text-white text-[11px] font-bold uppercase tracking-widest">
                    TOTALES
                  </td>
                  <td className="px-3 py-2.5 text-xs text-right font-bold" style={{ color: '#FCD34D' }}>
                    {fmt$(totBruto)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-right font-bold text-green-300">
                    {fmt$(totNet)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
            <p className="px-4 py-2 text-[10px] text-gray-400 font-body border-t border-gray-100">
              Convenio Madereros · Plus% = editable · Plus$ = Base × Plus% · Total Bruto = Base + Plus$ {showIncentivo ? '+ Incentivo' : ''} · Percibido = Bruto − Banco − Adelanto
            </p>
          </div>
        ) : (
          <div className="px-5 py-12 text-center text-gray-400 text-sm font-body">
            No hay liquidación para {month} {year}.{' '}
            <button onClick={() => createPeriod(branchId)} className="font-semibold hover:underline" style={{ color: CORAL }}>
              Abrir mes
            </button>
          </div>
        )}
      </div>
    )
  }

  /* ── "Ambas" consolidated view ── */
  const renderAmbasView = () => {
    const periodLuro  = getPeriod(1)
    const periodIndep = getPeriod(2)
    const allItems    = [
      ...(periodLuro?.items  ?? []).map((i: any) => ({ ...i, _branch: 'LURO'          })),
      ...(periodIndep?.items ?? []).map((i: any) => ({ ...i, _branch: 'INDEPENDENCIA' })),
    ]
    const totBruto = allItems.reduce((a, i) => a + (i.gross_total ?? 0), 0)
    const totNet   = allItems.reduce((a, i) => a + (i.net_total   ?? 0), 0)

    return (
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div style={{ background: NAVY }} className="px-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-bold font-head tracking-wide">PLANILLA SUELDOS — AMBAS SUCURSALES</p>
            <p className="text-white/50 text-[11px] font-body">{month} {year}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm border-collapse">
            <thead>
              <tr style={{ background: '#f0eeeb' }}>
                <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-center border-b border-gray-200 w-8" style={{ color: NAVY }}>N°</th>
                <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-left border-b border-gray-200" style={{ color: NAVY }}>Empleado</th>
                <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-left border-b border-gray-200" style={{ color: NAVY }}>Sucursal</th>
                <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-right border-b border-gray-200" style={{ color: NAVY }}>Base $</th>
                <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-right border-b border-gray-200" style={{ color: NAVY }}>Plus $</th>
                <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-right border-b border-gray-200" style={{ background: '#FFF3CD', color: '#92400E' }}>Total Bruto</th>
                <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-right border-b border-gray-200" style={{ background: '#D1FAE5', color: '#065F46' }}>Percibido</th>
                <th className="px-2 py-2.5 border-b border-gray-200 w-8" />
              </tr>
            </thead>
            <tbody>
              {allItems.map((item, i) => (
                <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : ''} style={i % 2 !== 0 ? { background: '#fafaf8' } : {}}>
                  <td className="px-3 py-2 text-center text-[11px] font-bold font-body" style={{ color: CORAL }}>{i + 1}</td>
                  <td className="px-3 py-2 text-xs font-semibold font-body text-gray-800 whitespace-nowrap">{item.employee_name}</td>
                  <td className="px-3 py-2 text-[11px] font-body">
                    <span className="px-2 py-0.5 rounded-full text-white text-[10px] font-bold"
                      style={{ background: item._branch === 'LURO' ? NAVY : CORAL }}>
                      {item._branch}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-right font-body text-gray-700 whitespace-nowrap">
                    {item.base_salary ? fmt$(item.base_salary) : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-right font-body text-gray-600 whitespace-nowrap">
                    {item.plus_amount ? fmt$(item.plus_amount) : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-right font-bold font-body whitespace-nowrap"
                    style={{ background: '#FFFBEB', color: '#92400E' }}>
                    {fmt$(item.gross_total)}
                  </td>
                  <td className="px-3 py-2 text-xs text-right font-bold font-body whitespace-nowrap"
                    style={{ background: '#ECFDF5', color: '#065F46' }}>
                    {fmt$(item.net_total)}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      title="Exportar recibo"
                      onClick={() => handlePdf(`/payroll/items/${item.id}/payslip`,
                        `recibo_${(item.employee_name || 'emp').replace(/[, ]+/g,'_')}_${month}_${year}.pdf`)}
                      className="text-gray-400 transition-colors"
                      onMouseOver={e => (e.currentTarget.style.color = CORAL)}
                      onMouseOut={e => (e.currentTarget.style.color = '')}>
                      <FileDown size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {allItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm font-body">
                    No hay liquidaciones abiertas para {month} {year}.
                  </td>
                </tr>
              )}
              {allItems.length > 0 && (
                <tr style={{ background: NAVY }}>
                  <td colSpan={5} className="px-3 py-2.5 text-white text-[11px] font-bold uppercase tracking-widest">
                    TOTAL GENERAL
                  </td>
                  <td className="px-3 py-2.5 text-xs text-right font-bold" style={{ color: '#FCD34D' }}>
                    {fmt$(totBruto)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-right font-bold text-green-300">
                    {fmt$(totNet)}
                  </td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Controls: month selector + vista switcher */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={month} onChange={e => setMonth(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-body focus:outline-none bg-white shadow-sm">
          {MONTHS.map(m => <option key={m}>{m}</option>)}
        </select>
        <span className="text-sm text-gray-500 font-body">{year}</span>

        {/* Vista selector */}
        <div className="flex rounded-lg overflow-hidden border border-gray-200 shadow-sm ml-auto">
          {VISTA_BTNS.map(({ id, label }) => (
            <button key={id} onClick={() => setVista(id)}
              className="px-4 py-2 text-xs font-semibold font-body transition-all"
              style={vista === id
                ? { background: NAVY, color: 'white' }
                : { background: 'white', color: '#666' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {vista === 'luro'          && renderBranchTable(1, 'LURO', true)}
      {vista === 'independencia' && renderBranchTable(2, 'INDEPENDENCIA', false)}
      {vista === 'ambas'         && renderAmbasView()}
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
