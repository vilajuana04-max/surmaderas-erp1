import { useEffect, useState, useCallback } from 'react'
import { FileDown, RefreshCw, CheckCircle, Clock } from 'lucide-react'
import clsx from 'clsx'
import { api, CURRENT_YEAR } from '../api'

type VacRecord = {
  id: number; year: number; employee_id: number; employee_name: string; branch_name: string
  days_entitled: number; days_taken: number; pending_prev_year: number
  total_available: number; pending_current: number; description: string | null
}

export default function Vacaciones() {
  const [year, setYear]     = useState(CURRENT_YEAR)
  const [records, setRecords] = useState<VacRecord[]>([])
  const [editing, setEditing] = useState<Record<number, { taken: string; desc: string }>>({})
  const [saving, setSaving]   = useState<number | null>(null)

  const load = useCallback(() => {
    api.get<VacRecord[]>(`/vacations/?year=${year}`).then(setRecords)
  }, [year])

  useEffect(() => { load() }, [load])

  const initYear = async () => {
    await api.post(`/vacations/init-year/${year}`, {})
    load()
  }

  const saveRecord = async (id: number, rec: VacRecord) => {
    const edit = editing[id]
    if (!edit) return
    setSaving(id)
    try {
      await api.put(`/vacations/${id}?days_taken=${edit.taken}&description=${encodeURIComponent(edit.desc)}`, {})
      load()
      setEditing(prev => { const n = { ...prev }; delete n[id]; return n })
    } finally { setSaving(null) }
  }

  const luro  = records.filter(r => r.branch_name === 'LURO')
  const indep = records.filter(r => r.branch_name === 'INDEPENDENCIA')

  const SucursalTable = ({ title, rows }: { title: string; rows: VacRecord[] }) => (
    <div className="card p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-wood-100 bg-wood-50">
        <h2 className="font-semibold text-wood-800">📍 {title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-wood-50 border-b border-wood-100">
            <tr>
              <th className="table-th">Empleado</th>
              <th className="table-th text-center">Corr.</th>
              <th className="table-th text-center">Tomadas</th>
              <th className="table-th text-center">Pend. Ant.</th>
              <th className="table-th text-center font-bold">Total Disp.</th>
              <th className="table-th text-center">Pendientes</th>
              <th className="table-th">Descripción</th>
              <th className="table-th" />
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const edit    = editing[r.id]
              const isDirty = !!edit
              const pct     = r.total_available > 0
                ? Math.round((r.days_taken / r.total_available) * 100)
                : 0

              return (
                <tr key={r.id} className="table-tr">
                  <td className="table-td text-xs font-medium">
                    <div className="flex items-center gap-2">
                      {r.pending_current === 0
                        ? <CheckCircle size={13} className="text-green-500 shrink-0" />
                        : <Clock size={13} className="text-amber-500 shrink-0" />}
                      {r.employee_name}
                    </div>
                  </td>
                  <td className="table-td text-xs text-center">{r.days_entitled}</td>
                  <td className="table-td text-xs text-center p-1">
                    <input type="number" min={0}
                      className="input py-1 px-1.5 text-xs text-center w-14"
                      value={edit?.taken ?? r.days_taken}
                      onChange={e => setEditing(prev => ({ ...prev, [r.id]: { taken: e.target.value, desc: edit?.desc ?? r.description ?? '' } }))}
                    />
                  </td>
                  <td className="table-td text-xs text-center">{r.pending_prev_year}</td>
                  <td className="table-td text-xs text-center font-bold">{r.total_available}</td>
                  <td className="table-td text-xs text-center">
                    <span className={clsx('badge', r.pending_current > 0 ? 'badge-amber' : 'badge-green')}>
                      {r.pending_current}d
                    </span>
                  </td>
                  <td className="table-td text-xs p-1">
                    <input type="text" placeholder="Fechas tomadas…"
                      className="input py-1 px-2 text-xs w-full"
                      value={edit?.desc ?? r.description ?? ''}
                      onChange={e => setEditing(prev => ({ ...prev, [r.id]: { taken: edit?.taken ?? String(r.days_taken), desc: e.target.value } }))}
                    />
                  </td>
                  <td className="table-td p-1">
                    {isDirty && (
                      <button disabled={saving === r.id} onClick={() => saveRecord(r.id, r)}
                        className="btn-primary text-xs py-1.5">
                        {saving === r.id ? '…' : 'OK'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Vacaciones</h1>
          <p className="text-wood-500 text-sm">Días · Antigüedad · Saldos — Cálculo automático por convenio</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="input w-28 text-sm">
            {[2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
          </select>
          <button onClick={initYear} className="btn-ghost">
            <RefreshCw size={15} /> Inicializar Año
          </button>
          <button onClick={() => api.pdf(`/vacations/pdf/${year}`, `vacaciones_${year}.pdf`)}
            className="btn-ghost">
            <FileDown size={15} /> PDF
          </button>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-wood-400 text-sm mb-4">No hay registros para {year}.</p>
          <button onClick={initYear} className="btn-primary mx-auto">
            <RefreshCw size={15} /> Inicializar {year}
          </button>
        </div>
      ) : (
        <>
          {luro.length  > 0 && <SucursalTable title="LURO"           rows={luro}  />}
          {indep.length > 0 && <SucursalTable title="INDEPENDENCIA"  rows={indep} />}
        </>
      )}
    </div>
  )
}
