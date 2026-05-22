import { useEffect, useState, useCallback } from 'react'
import { FileDown, Plus, Lock } from 'lucide-react'
import { api, fmt$, MONTHS, CURRENT_YEAR } from '../api'

const BRANCHES = [{ id: 1, name: 'LURO', union: 'Madereros' }, { id: 2, name: 'INDEPENDENCIA', union: 'SEC 12' }]

export default function Sueldos() {
  const [month, setMonth]     = useState('ABRIL')
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

  const branchPeriods = (branchId: number) =>
    periods.filter(p => p.branch_id === branchId && p.month === month && p.year === year)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Liquidación de Sueldos</h1>
          <p className="text-wood-500 text-sm">Luro (Madereros) · Independencia (SEC 12)</p>
        </div>
        <select value={month} onChange={e => setMonth(e.target.value)} className="input w-36 text-sm">
          {MONTHS.map(m => <option key={m}>{m}</option>)}
        </select>
      </div>

      {BRANCHES.map(branch => {
        const bPeriods = branchPeriods(branch.id)
        const period   = bPeriods[0]
        const items    = period?.items ?? []
        const isClosed = period?.status === 'CLOSED'

        const totBruto  = items.reduce((a: number, i: any) => a + (i.gross_total ?? 0), 0)
        const totNet    = items.reduce((a: number, i: any) => a + (i.net_total   ?? 0), 0)

        return (
          <div key={branch.id} className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-wood-100 bg-wood-50">
              <div>
                <h2 className="font-semibold text-wood-800">📍 {branch.name}</h2>
                <p className="text-xs text-wood-500">Convenio {branch.union} · {month} {year}</p>
              </div>
              <div className="flex gap-2">
                {!period && (
                  <button onClick={() => createPeriod(branch.id)} disabled={creating}
                    className="btn-primary text-xs py-1.5">
                    <Plus size={13} /> Abrir Mes
                  </button>
                )}
                {period && !isClosed && (
                  <button onClick={() => closePeriod(period.id)} className="btn-ghost text-xs py-1.5 text-amber-700">
                    <Lock size={13} /> Cerrar
                  </button>
                )}
                {period && (
                  <>
                    <button onClick={() => api.pdf(`/payroll/periods/${period.id}/pdf`, `sueldos_${branch.name}_${month}_${year}.pdf`)}
                      className="btn-ghost text-xs py-1.5">
                      <FileDown size={13} /> Planilla
                    </button>
                    <button onClick={() => api.pdf(`/payroll/periods/${period.id}/payslips`, `recibos_${branch.name}_${month}_${year}.pdf`)}
                      className="btn-ghost text-xs py-1.5">
                      <FileDown size={13} /> Recibos
                    </button>
                  </>
                )}
              </div>
            </div>

            {period ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-wood-50 border-b border-wood-100">
                    <tr>
                      <th className="table-th">Empleado</th>
                      <th className="table-th text-center">Inas.</th>
                      <th className="table-th text-right">Base $</th>
                      <th className="table-th text-center">Plus %</th>
                      <th className="table-th text-right">Plus $</th>
                      <th className="table-th text-right">Incentivo</th>
                      <th className="table-th text-right">Bruto $</th>
                      <th className="table-th text-right">Depósito</th>
                      <th className="table-th text-right">Adelanto</th>
                      <th className="table-th text-right font-bold">Percibido $</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item: any) => (
                      <tr key={item.id} className="table-tr">
                        <td className="table-td text-xs font-medium">{item.employee_name}</td>
                        <td className="table-td p-1 text-center">
                          <NumInput disabled={isClosed} value={item.absences} integer
                            onBlur={v => updateItem(item.id, 'absences', v, item)} />
                        </td>
                        {['base_salary','plus_pct','bank_deposit','advance','incentive'].map(f => (
                          <td key={f} className="table-td p-1 text-right">
                            <NumInput disabled={isClosed} value={item[f]}
                              step={f === 'plus_pct' ? 0.01 : 1}
                              onBlur={v => updateItem(item.id, f, v, item)} />
                          </td>
                        ))}
                        <td className="table-td text-xs text-right text-wood-600">{fmt$(item.plus_amount)}</td>
                        <td className="table-td text-xs text-right font-bold">{fmt$(item.gross_total)}</td>
                        <td className="table-td text-xs text-right font-bold text-green-700">{fmt$(item.net_total)}</td>
                      </tr>
                    ))}
                    <tr className="bg-wood-50 border-t-2 border-wood-200">
                      <td colSpan={6} className="table-td font-bold text-xs">TOTALES</td>
                      <td className="table-td text-xs text-right font-bold">{fmt$(totBruto)}</td>
                      <td colSpan={2} />
                      <td className="table-td text-xs text-right font-bold text-green-700">{fmt$(totNet)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-wood-400 py-10 text-sm">
                No hay liquidación para {month} {year}. Presioná "Abrir Mes" para comenzar.
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function NumInput({ value, onBlur, disabled, integer = false, step = 1 }: {
  value: any; onBlur: (v: string) => void; disabled?: boolean; integer?: boolean; step?: number
}) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => { setV(value ?? '') }, [value])
  return (
    <input type="number" step={step}
      className="input py-1 px-1.5 text-xs text-right w-20 disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={disabled} value={v}
      onChange={e => setV(e.target.value)}
      onBlur={() => onBlur(v)}
    />
  )
}
