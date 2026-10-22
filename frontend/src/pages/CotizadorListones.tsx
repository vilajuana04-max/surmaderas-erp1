import { useMemo, useRef, useState } from 'react'
import { Trash2, Copy, Printer, MessageCircle, Plus } from 'lucide-react'

const NAVY  = '#070614'
const CORAL = '#C8603A'
const WA_LURO = '5492234383262'

const LARGO_VARILLA_CM = 300
const MIN_SOBRANTE_CM = 0.001

/* Datos de listones (lista Sur Maderas) */
export const LISTONES = [
  { codigo: '30105', nombre: 'LISTON 1/2 X 1/2', precioMetro: 443, seccion: '13 x 13 mm' },
  { codigo: '30106', nombre: 'LISTON 1/2 X 3/4', precioMetro: 650, seccion: '19 x 13 mm' },
  { codigo: '30107', nombre: 'LISTON 1/2 X 1', precioMetro: 734, seccion: '25 x 13 mm' },
  { codigo: '30108', nombre: 'LISTON 1/2 X 1 1/2', precioMetro: 1115, seccion: '38 x 13 mm' },
  { codigo: '30109', nombre: 'LISTON 1/2 X 2', precioMetro: 1416, seccion: '51 x 13 mm' },
  { codigo: '30110', nombre: 'LISTON 1/2 X 3', precioMetro: 2115, seccion: '76 x 13 mm' },
  { codigo: '30111', nombre: 'LISTON 1/2 X 4', precioMetro: 2812, seccion: '102 x 13 mm' },
  { codigo: '30112', nombre: 'LISTON 1/2 X 5', precioMetro: 3519, seccion: '127 x 13 mm' },
  { codigo: '30113', nombre: 'LISTON 1/2 X 6', precioMetro: 4214, seccion: '152 x 13 mm' },
  { codigo: '30122', nombre: 'LISTON 3/4 X 3/4', precioMetro: 857, seccion: '19 x 19 mm' },
  { codigo: '30123', nombre: 'LISTON 3/4 X 1', precioMetro: 1027, seccion: '25 x 19 mm' },
  { codigo: '30124', nombre: 'LISTON 3/4 X 1 1/2', precioMetro: 1591, seccion: '38 x 19 mm' },
  { codigo: '30125', nombre: 'LISTON 3/4 X 2', precioMetro: 2121, seccion: '51 x 19 mm' },
  { codigo: '30126', nombre: 'LISTON 3/4 X 3', precioMetro: 3164, seccion: '76 x 19 mm' },
  { codigo: '30127', nombre: 'LISTON 3/4 X 4', precioMetro: 4219, seccion: '102 x 19 mm' },
  { codigo: '30128', nombre: 'LISTON 3/4 X 5', precioMetro: 5299, seccion: '127 x 19 mm' },
  { codigo: '30129', nombre: 'LISTON 3/4 X 6', precioMetro: 5154, seccion: '152 x 19 mm' },
  { codigo: '30138', nombre: 'LISTON 1 X 1', precioMetro: 1296, seccion: '25 x 25 mm' },
  { codigo: '30139', nombre: 'LISTON 1 X 1 1/2', precioMetro: 1903, seccion: '38 x 25 mm' },
  { codigo: '30140', nombre: 'LISTON 1 X 2', precioMetro: 2539, seccion: '51 x 25 mm' },
  { codigo: '30141', nombre: 'LISTON 1 X 3', precioMetro: 3826, seccion: '76 x 25 mm' },
  { codigo: '30142', nombre: 'LISTON 1 X 4', precioMetro: 5088, seccion: '102 x 25 mm' },
  { codigo: '30143', nombre: 'LISTON 1 X 5', precioMetro: 6354, seccion: '127 x 25 mm' },
  { codigo: '30144', nombre: 'LISTON 1 X 6', precioMetro: 7651, seccion: '152 x 25 mm' },
  { codigo: '30153', nombre: 'LISTON 1 1/2 X 1 1/2', precioMetro: 3165, seccion: '38 x 38 mm' },
  { codigo: '30154', nombre: 'LISTON 1 1/2 X 2', precioMetro: 4226, seccion: '51 x 38 mm' },
  { codigo: '30155', nombre: 'LISTON 1 1/2 X 3', precioMetro: 6332, seccion: '76 x 38 mm' },
  { codigo: '30170', nombre: 'LISTON 2 X 2', precioMetro: 5765, seccion: '51 x 51 mm' },
  { codigo: '30171', nombre: 'LISTON 2 X 3', precioMetro: 8709, seccion: '76 x 51 mm' },
  { codigo: '30172', nombre: 'LISTON 2 X 4', precioMetro: 11532, seccion: '102 x 51 mm' },
]

/* ── Lógica de cálculo (portada tal cual del proyecto original) ── */
function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)
}
function parseNumero(value: any) {
  const parsed = parseFloat(String(value || '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}
function formatCm(value: number) { return formatARS(value).replace(',00', '') }
function getSobranteCm(sobrante: any) {
  if (typeof sobrante === 'number') return sobrante
  return Number(sobrante?.cm || 0)
}
function normalizarSobrantes(sobrantes: any[]) {
  return sobrantes
    .map((s, i) => (typeof s === 'number' ? { id: i + 1, cm: s } : { id: Number(s?.id || i + 1), cm: getSobranteCm(s) }))
    .filter((s) => s.cm > MIN_SOBRANTE_CM)
    .sort((a, b) => a.cm - b.cm)
}
function sumarSobrantes(sobrantes: any[]) { return sobrantes.reduce((acc, s) => acc + getSobranteCm(s), 0) }
function formatearSobrantes(sobrantes: any[]) {
  const activos = normalizarSobrantes(sobrantes || []).sort((a, b) => a.id - b.id)
  if (activos.length === 0) return '0 cm'
  return activos.map((s) => `V${s.id}: ${formatCm(s.cm)} cm`).join(' | ')
}
function recalcular(items: any[]) {
  const sobrantesPorListon = new Map<string, any[]>()
  const nextVarillaIdPorListon = new Map<string, number>()
  return items.map((item) => {
    const largoCm = Math.max(0, parseNumero(item.largo))
    const cantidadCortes = Math.max(0, Math.floor(parseNumero(item.cantidad)))
    const pedidoCm = largoCm * cantidadCortes
    let sobrantes = [...(sobrantesPorListon.get(item.codigo) || [])]
    let sobranteUsadoCm = 0
    let varillas = 0
    for (let i = 0; i < cantidadCortes; i += 1) {
      sobrantes = normalizarSobrantes(sobrantes)
      const idx = sobrantes.findIndex((s) => s.cm + MIN_SOBRANTE_CM >= largoCm)
      if (idx >= 0) {
        sobrantes[idx] = { ...sobrantes[idx], cm: Math.max(0, sobrantes[idx].cm - largoCm) }
        sobranteUsadoCm += largoCm
      } else {
        const nextId = nextVarillaIdPorListon.get(item.codigo) || 1
        varillas += 1
        sobrantes.push({ id: nextId, cm: Math.max(0, LARGO_VARILLA_CM - largoCm) })
        nextVarillaIdPorListon.set(item.codigo, nextId + 1)
      }
    }
    const sobrantesFinalesCm = normalizarSobrantes(sobrantes)
    const sobranteFinalCm = sumarSobrantes(sobrantesFinalesCm)
    const metrosCobrados = (varillas * LARGO_VARILLA_CM) / 100
    const subtotal = metrosCobrados * Number(item.precioMetro || 0)
    sobrantesPorListon.set(item.codigo, sobrantesFinalesCm)
    return { ...item, metrosPedidos: pedidoCm / 100, varillas, metrosCobrados, sobranteUsadoCm, sobranteCm: sobranteFinalCm, sobranteFinalCm, sobrantesFinalesCm, subtotal }
  })
}

let nextId = 1

export default function CotizadorListones() {
  const [listonCode, setListonCode] = useState('')
  const [largo, setLargo] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [editId, setEditId] = useState<number | null>(null)
  const [editado, setEditado] = useState({ listonCode: '', largo: '', cantidad: '' })
  const tableRef = useRef<HTMLTableElement>(null)

  const listonSel = useMemo(() => LISTONES.find((l) => l.codigo === listonCode) || null, [listonCode])
  const calc = useMemo(() => recalcular(items), [items])
  const total = useMemo(() => calc.reduce((a, i) => a + i.subtotal, 0), [calc])
  const totalCortes = useMemo(() => calc.reduce((a, i) => a + Number(i.cantidad || 0), 0), [calc])
  const totalVarillas = useMemo(() => calc.reduce((a, i) => a + Number(i.varillas || 0), 0), [calc])

  const agregar = () => {
    const largoCm = parseNumero(largo); const cant = parseNumero(cantidad)
    if (!listonSel || largoCm <= 0 || cant <= 0) { alert('Seleccioná un listón e ingresá largo y cantidad.'); return }
    if (!Number.isInteger(cant)) { alert('La cantidad de cortes tiene que ser un número entero.'); return }
    if (largoCm > LARGO_VARILLA_CM) { alert(`El corte no puede superar la varilla completa (${LARGO_VARILLA_CM} cm).`); return }
    setItems((prev) => [...prev, { id: nextId++, codigo: listonSel.codigo, nombre: listonSel.nombre, seccion: listonSel.seccion, precioMetro: listonSel.precioMetro, largo: largoCm, cantidad: cant }])
    setLargo(''); setCantidad('')
  }
  const toggleSel = (id: number) => setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const iniciarEd = (item: any) => { setEditId(item.id); setEditado({ listonCode: item.codigo, largo: String(item.largo), cantidad: String(item.cantidad) }) }
  const cancelarEd = () => { setEditId(null); setEditado({ listonCode: '', largo: '', cantidad: '' }) }
  const guardarEd = () => {
    const l = LISTONES.find((x) => x.codigo === editado.listonCode)
    const largoCm = parseNumero(editado.largo); const cant = parseNumero(editado.cantidad)
    if (!l || largoCm <= 0 || cant <= 0) { alert('Revisá listón, largo y cantidad.'); return }
    if (!Number.isInteger(cant)) { alert('La cantidad tiene que ser un entero.'); return }
    if (largoCm > LARGO_VARILLA_CM) { alert(`El corte no puede superar ${LARGO_VARILLA_CM} cm.`); return }
    setItems((prev) => prev.map((it) => it.id === editId ? { ...it, codigo: l.codigo, nombre: l.nombre, seccion: l.seccion, precioMetro: l.precioMetro, largo: largoCm, cantidad: cant } : it))
    cancelarEd()
  }
  const eliminarSel = () => {
    if (sel.size === 0) { alert('Seleccioná al menos una fila.'); return }
    setItems((prev) => prev.filter((it) => !sel.has(it.id)))
    if (editId != null && sel.has(editId)) cancelarEd()
    setSel(new Set())
  }

  const construirTexto = () => [
    'Cotización de listones - Sur Maderas', '',
    ...calc.flatMap((item, i) => [
      `Item ${i + 1}`,
      `Listón: ${item.codigo} - ${item.nombre}`,
      `Cortes: ${item.cantidad} de ${item.largo} cm`,
      `Pedido real: ${formatARS(item.metrosPedidos)} m`,
      `Sobrante usado: ${formatCm(item.sobranteUsadoCm)} cm`,
      `Se cobra: ${item.varillas} varilla(s) / ${formatARS(item.metrosCobrados)} m`,
      `Sobrantes por varilla: ${formatearSobrantes(item.sobrantesFinalesCm)}`,
      `Subtotal: $ ${formatARS(item.subtotal)}`, '',
    ]),
    `Total cortes: ${formatCm(totalCortes)}`,
    `Total varillas: ${formatCm(totalVarillas)}`,
    `Total: $ ${formatARS(total)}`,
  ].join('\n')

  const copiar = async () => {
    if (items.length === 0) { alert('No hay listones para copiar.'); return }
    try { await navigator.clipboard.writeText(construirTexto()); alert('Cotización copiada.') } catch { alert('No se pudo copiar.') }
  }
  const imprimir = () => {
    if (items.length === 0) { alert('No hay listones para imprimir.'); return }
    const contenido = tableRef.current?.outerHTML ?? ''
    const v = window.open('', '_blank')
    if (!v) return
    v.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cotización de listones</title><style>
      body{font-family:'Segoe UI',Arial,sans-serif;padding:20px;color:#1a1a1a}
      h2{color:${NAVY}} table{border-collapse:collapse;width:100%;font-size:12px}
      th,td{border:1px solid #ddd;padding:8px;text-align:center}
      thead th{background:${CORAL};color:#fff} tfoot{background:#faf7f5;font-weight:bold}
      .cc-noprint{display:none}</style></head><body>
      <h2>Cotización de listones · Sur Maderas</h2>
      <p style="color:#666;font-size:12px">Se cobra por varilla completa de 3 m. Los sobrantes se consideran piezas separadas.</p>
      ${contenido}
      <script>window.onload=function(){window.print()}<\/script></body></html>`)
    v.document.close()
  }
  const whatsapp = () => {
    if (items.length === 0) { alert('No hay listones para enviar.'); return }
    window.open(`https://wa.me/${WA_LURO}?text=${encodeURIComponent(construirTexto())}`, '_blank')
  }

  const previewArr = listonSel && parseNumero(largo) > 0 && parseNumero(largo) <= LARGO_VARILLA_CM && parseNumero(cantidad) > 0 && Number.isInteger(parseNumero(cantidad))
    ? recalcular([...items, { id: 'preview', codigo: listonSel.codigo, nombre: listonSel.nombre, seccion: listonSel.seccion, precioMetro: listonSel.precioMetro, largo: parseNumero(largo), cantidad: parseNumero(cantidad) }])
    : null
  const preview = previewArr ? previewArr[previewArr.length - 1] : null

  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-400'
  const step = (n: string, label: string) => (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[10px] font-bold tracking-widest" style={{ color: CORAL }}>{n}</span>
      <span className="text-sm font-bold" style={{ color: NAVY }}>{label}</span>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="rounded-2xl p-6 mb-4" style={{ background: NAVY }}>
        <p className="text-[11px] font-bold tracking-[3px] uppercase mb-1" style={{ color: CORAL }}>Sur Maderas · ERP</p>
        <h1 className="text-3xl font-bold text-white">Cotizador de listones</h1>
        <p className="text-white/50 text-sm">Se cobra por varilla completa de 3 m; se aprovechan sobrantes del mismo listón si el corte entra completo.</p>
      </div>

      <div className="space-y-4">
        {/* 1. Listón */}
        <section className="bg-white rounded-2xl border border-gray-100 p-5">
          {step('01', 'Seleccioná el listón')}
          <select className={inp} value={listonCode} onChange={(e) => setListonCode(e.target.value)}>
            <option value="">Ver opciones de listón</option>
            {LISTONES.map((l) => <option key={l.codigo} value={l.codigo}>{l.codigo} - {l.nombre} ({l.seccion})</option>)}
          </select>
          {listonSel && (
            <div className="mt-3 bg-gray-50 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-800">{listonSel.codigo} - {listonSel.nombre}</p>
                <p className="text-xs text-gray-400">Sección {listonSel.seccion} · Varilla {LARGO_VARILLA_CM} cm</p>
              </div>
              <p className="text-sm font-bold" style={{ color: CORAL }}>$ {formatARS(listonSel.precioMetro)}/m</p>
            </div>
          )}
        </section>

        {/* 2. Cortes */}
        <section className="bg-white rounded-2xl border border-gray-100 p-5">
          {step('02', 'Ingresá los cortes')}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className="text-[11px] font-semibold text-gray-500">Largo corte (cm)</label><input type="number" inputMode="decimal" className={inp} placeholder="ej: 50" value={largo} onChange={(e) => setLargo(e.target.value)} /></div>
            <div><label className="text-[11px] font-semibold text-gray-500">Cantidad</label><input type="number" inputMode="numeric" className={inp} placeholder="ej: 6" value={cantidad} onChange={(e) => setCantidad(e.target.value)} /></div>
            <div><label className="text-[11px] font-semibold text-gray-500">Precio/metro</label><input className={`${inp} bg-gray-50`} readOnly value={listonSel ? `$ ${formatARS(listonSel.precioMetro)}` : ''} /></div>
            <div><label className="text-[11px] font-semibold text-gray-500">Vista previa</label><input className={`${inp} bg-gray-50`} readOnly value={preview ? `${preview.varillas} var. / usa ${formatCm(preview.sobranteUsadoCm)}cm / $${formatARS(preview.subtotal)}` : ''} placeholder="Calcula al completar" /></div>
          </div>
          <button onClick={agregar} className="mt-3 w-full md:w-auto flex items-center justify-center gap-2 text-white px-5 py-2.5 rounded-xl text-sm font-bold" style={{ background: CORAL }}><Plus size={16} /> Agregar listón</button>
        </section>

        {/* 3. Tabla */}
        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 pt-4">{step('03', 'Mis listones')}</div>
          <div className="overflow-x-auto px-2 pb-2">
            <table ref={tableRef} className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-gray-400">
                  <th className="cc-noprint px-2 py-2">Sel.</th>
                  <th className="px-2 py-2 text-left">Cant.</th><th className="px-2 py-2 text-left">Listón</th>
                  <th className="px-2 py-2">Corte</th><th className="px-2 py-2">Pedido</th><th className="px-2 py-2">Usa sobrante</th>
                  <th className="px-2 py-2">Varillas</th><th className="px-2 py-2">Sobrantes/varilla</th><th className="px-2 py-2 text-right">Subtotal</th>
                  <th className="cc-noprint px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.length === 0 && <tr><td colSpan={10} className="text-center py-8 text-gray-300">Todavía no agregaste listones</td></tr>}
                {calc.map((item) => {
                  const isEd = editId === item.id
                  return (
                    <tr key={item.id} className={sel.has(item.id) ? 'bg-amber-50/40' : ''}>
                      <td className="cc-noprint px-2 py-2 text-center"><input type="checkbox" checked={sel.has(item.id)} onChange={() => toggleSel(item.id)} /></td>
                      {isEd ? (
                        <>
                          <td className="px-2 py-1"><input type="number" className="w-16 border border-gray-200 rounded px-2 py-1 text-xs" value={editado.cantidad} onChange={(e) => setEditado((a) => ({ ...a, cantidad: e.target.value }))} /></td>
                          <td className="px-2 py-1"><select className="border border-gray-200 rounded px-2 py-1 text-xs" value={editado.listonCode} onChange={(e) => setEditado((a) => ({ ...a, listonCode: e.target.value }))}>{LISTONES.map((l) => <option key={l.codigo} value={l.codigo}>{l.codigo} - {l.nombre}</option>)}</select></td>
                          <td className="px-2 py-1"><input type="number" className="w-16 border border-gray-200 rounded px-2 py-1 text-xs" value={editado.largo} onChange={(e) => setEditado((a) => ({ ...a, largo: e.target.value }))} /></td>
                          <td colSpan={5} className="px-2 py-1 text-xs text-gray-400 text-center">editando…</td>
                          <td className="cc-noprint px-2 py-1"><div className="flex gap-1"><button onClick={guardarEd} className="text-[10px] font-bold text-green-700 border border-green-200 rounded px-2 py-1">Guardar</button><button onClick={cancelarEd} className="text-[10px] text-gray-400 border border-gray-200 rounded px-2 py-1">Cancelar</button></div></td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-2 text-center">{item.cantidad}</td>
                          <td className="px-2 py-2 font-semibold text-gray-700">{item.codigo} - {item.nombre}</td>
                          <td className="px-2 py-2 text-center">{item.largo} cm</td>
                          <td className="px-2 py-2 text-center text-gray-500">{formatARS(item.metrosPedidos)} m</td>
                          <td className="px-2 py-2 text-center text-gray-500">{formatCm(item.sobranteUsadoCm)} cm</td>
                          <td className="px-2 py-2 text-center">{item.varillas} / {formatARS(item.metrosCobrados)} m</td>
                          <td className="px-2 py-2 text-center text-xs text-gray-500">{formatearSobrantes(item.sobrantesFinalesCm)}</td>
                          <td className="px-2 py-2 text-right font-bold tabular-nums">$ {formatARS(item.subtotal)}</td>
                          <td className="cc-noprint px-2 py-2"><button onClick={() => iniciarEd(item)} className="text-[10px] text-gray-400 border border-gray-200 rounded px-2 py-1 hover:bg-gray-50">Editar</button></td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="font-bold text-xs border-t-2 border-gray-100" style={{ color: NAVY }}>
                  <td className="cc-noprint" colSpan={6}></td>
                  <td className="px-2 py-2.5 text-center">{formatCm(totalVarillas)} var.</td>
                  <td className="px-2 py-2.5 text-right">Total</td>
                  <td className="px-2 py-2.5 text-right">$ {formatARS(total)}</td>
                  <td className="cc-noprint"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex flex-wrap gap-2 px-5 py-4 border-t border-gray-50">
            <button onClick={eliminarSel} className="flex items-center gap-1.5 text-xs font-semibold border border-red-200 text-red-500 px-3 py-2 rounded-lg hover:bg-red-50"><Trash2 size={14} /> Eliminar</button>
            <button onClick={copiar} className="flex items-center gap-1.5 text-xs font-semibold border border-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50"><Copy size={14} /> Copiar</button>
            <button onClick={imprimir} className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-2 rounded-lg" style={{ background: NAVY }}><Printer size={14} /> PDF / Imprimir</button>
            <button onClick={whatsapp} className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-2 rounded-lg ml-auto" style={{ background: '#25D366' }}><MessageCircle size={14} /> WhatsApp</button>
          </div>
        </section>

        <div className="rounded-2xl p-4 flex items-center justify-between" style={{ background: NAVY }}>
          <span className="text-white/60 text-sm font-semibold">{formatCm(totalCortes)} cortes · {formatCm(totalVarillas)} varillas</span>
          <span className="text-white text-xl font-bold">$ {formatARS(total)}</span>
        </div>
      </div>
    </div>
  )
}
