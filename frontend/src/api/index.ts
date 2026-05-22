export { api } from './client'

export const fmt$ = (n: number | null | undefined) =>
  n == null ? '—' : `$ ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const fmtNum = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('es-AR')

export const MONTHS = [
  'ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
  'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE',
]

const _now = new Date()
export const CURRENT_YEAR       = _now.getFullYear()
export const CURRENT_MONTH_IDX  = _now.getMonth()          // 0-based
export const CURRENT_MONTH      = MONTHS[_now.getMonth()]
