export { api } from './client'

export const fmt$ = (n: number | null | undefined) =>
  n == null ? '—' : `$ ${Math.round(n).toLocaleString('es-AR')}`

export const fmtNum = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('es-AR')

export const MONTHS = [
  'ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
  'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE',
]

export const CURRENT_YEAR  = 2026
export const CURRENT_MONTH = 'MAYO'
