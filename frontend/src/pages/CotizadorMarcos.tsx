import { useMemo, useState } from 'react'
import { Copy, Printer, MessageCircle, Plus, Trash2 } from 'lucide-react'

const NAVY  = '#070614'
const CORAL = '#C8603A'

/* ── Constantes de precio (del proyecto original) ── */
const BAR_LENGTH_METERS = 3
const HALF_BAR_LENGTH_METERS = BAR_LENGTH_METERS / 2
const PASPARTU_PRICE_M2 = 19640
const GLASS_PRICE_M2 = 33582
const LISTON_REBAJE_PRICE_PER_METER = 1147
const MIRROR_PRICE_M2 = 59166

const PRESET_SIZE_OPTIONS = [
  { id: 'personalizada', nombre: 'Personalizada', anchoMm: null as number | null, altoMm: null as number | null },
  { id: 'a3', nombre: 'A3', anchoMm: 297, altoMm: 420 },
  { id: 'a4', nombre: 'A4', anchoMm: 210, altoMm: 297 },
  { id: '20x30', nombre: '20 x 30', anchoMm: 200, altoMm: 300 },
  { id: '30x40', nombre: '30 x 40', anchoMm: 300, altoMm: 400 },
  { id: '50x70', nombre: '50 x 70', anchoMm: 500, altoMm: 700 },
]
const FONDO_OPTIONS = [
  { id: 'sin-fondo', nombre: 'Sin fondo', precioM2: 0 },
  { id: 'vidrio', nombre: 'Vidrio', precioM2: GLASS_PRICE_M2 },
  { id: 'fibrofacil', nombre: 'Fibro fácil', precioM2: 9800 },
  { id: 'fibroplus-blanco', nombre: 'Fibro plus blanco', precioM2: 13200 },
  { id: 'fibroplus-negro', nombre: 'Fibro plus negro', precioM2: 13800 },
]
const PINTADO_OPTIONS = [
  { id: 'sin-pintar', nombre: 'Sin pintar', extra: 0 },
  { id: 'negro-mate', nombre: 'Negro mate', extra: 9500 },
  { id: 'blanco-mate', nombre: 'Blanco mate', extra: 9200 },
  { id: 'roble-claro', nombre: 'Roble claro', extra: 11800 },
  { id: 'nogal', nombre: 'Nogal', extra: 11800 },
  { id: 'dorado', nombre: 'Dorado', extra: 14200 },
]
const PASPARTU_COLOR_OPTIONS = [
  { id: 'blanco', nombre: 'Blanco' }, { id: 'natural', nombre: 'Natural' },
  { id: 'negro', nombre: 'Negro' }, { id: 'gris', nombre: 'Gris' }, { id: 'marfil', nombre: 'Marfil' },
]

/* ── Perfiles (varillas/molduras) ── */
function inferProfileMeasures(nombre: string) {
  const n = String(nombre || '').toUpperCase().replace(',', '.')
  const pair = n.match(/(\d+(?:\.\d+)?)\s*X\s*(\d+(?:\.\d+)?)/)
  if (pair) { const a = Number(pair[1]), b = Number(pair[2]); return { frenteMm: Math.max(a, b), profundidadMm: Math.min(a, b) } }
  const cm = n.match(/(\d+(?:\.\d+)?)\s*CM\b/)
  if (cm) { const f = Number(cm[1]) * 10; return { frenteMm: f, profundidadMm: Math.max(Math.round(f * 0.45), 12) } }
  const g = n.match(/(\d+(?:\.\d+)?)/)
  if (g) { const f = Number(g[1]) * 10; return { frenteMm: f, profundidadMm: Math.max(Math.round(f * 0.45), 12) } }
  return { frenteMm: 30, profundidadMm: 18 }
}
function createProfileId(codigo: string, nombre: string) {
  return String(codigo || nombre || 'varilla').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
function P(codigo: string, nombre: string, precioMetro: number, frenteMm?: number, profundidadMm?: number, liston = false) {
  const m = Number.isFinite(frenteMm) && Number.isFinite(profundidadMm) ? { frenteMm: frenteMm!, profundidadMm: profundidadMm! } : inferProfileMeasures(nombre)
  return { id: createProfileId(codigo, nombre), codigo, nombre, precioMetro, frenteMm: m.frenteMm, profundidadMm: m.profundidadMm, liston }
}
const INITIAL_PROFILES = [
  P('2101', 'BATEA 20 X 27', 1858), P('MC910', 'BATEA 21 X 45', 2948), P('2814', 'BATEA AMERICANA 21 X 45', 6724),
  P('1410', 'BOMBE 1 CM.', 3589), P('1531', 'BOMBE 1,5 CM. KIRI', 4723), P('MC909', 'BOMBE 1.5', 929),
  P('2532', 'BOMBE 2', 1148), P('2533', 'BOMBE 3', 2161), P('2567', 'BOMBE 4', 2796),
  P('2229', 'BOMBE C/GARGANTA 16 X 20', 1152), P('MC934', 'CHANFLE 3.5', 1504), P('2564', 'CHANFLE 4.5', 2240),
  P('2565', 'CHANFLE 5.5', 2382), P('MC903', 'CHANFLE 7', 3333), P('2331', 'CHATA 10 X 30', 1209),
  P('MC927', 'CHATA 15 X 30', 1639), P('2350', 'CHATA 15 X 45', 2122), P('MC02', 'CHATA 6 EN FF12', 3034),
  P('MC01', 'CHATA 9 EN FF12', 3699), P('2237', 'CHATA P/ CAJON 2 REBAJES 20X42 PINO', 8636),
  P('2811', 'ITALIANA 2 CM.', 1146), P('2547', 'ITALIANA 3 CM.', 2240), P('2548', 'ITALIANA 4 CM.', 2896),
  P('2549', 'ITALIANA 6 CM.', 6886), P('MC919', 'MOLDURON 21 X 69 ESPECIAL', 5397), P('MC918', 'MOLDURON ESPECIAL 32 X 58', 5795),
  P('MC914', 'ONDULADA 14 X 32', 1639), P('MC922', 'ONDULADA 14 X 45', 2241),
  P('30105', 'LISTON 1/2 X 1/2', 403, 13, 13, true), P('30106', 'LISTON 1/2 X 3/4', 591, 19, 13, true),
  P('30107', 'LISTON 1/2 X 1', 667, 25, 13, true), P('30108', 'LISTON 1/2 X 1 1/2', 1014, 38, 13, true),
  P('30109', 'LISTON 1/2 X 2', 1287, 51, 13, true), P('30110', 'LISTON 1/2 X 3', 1923, 76, 13, true),
  P('30111', 'LISTON 1/2 X 4', 2556, 102, 13, true), P('30112', 'LISTON 1/2 X 5', 3199, 127, 13, true),
  P('30113', 'LISTON 1/2 X 6', 3831, 152, 13, true), P('30122', 'LISTON 3/4 X 3/4', 779, 19, 19, true),
  P('30123', 'LISTON 3/4 X 1', 934, 25, 19, true), P('30124', 'LISTON 3/4 X 1 1/2', 1446, 38, 19, true),
  P('30125', 'LISTON 3/4 X 2', 1928, 51, 19, true), P('30126', 'LISTON 3/4 X 3', 2876, 76, 19, true),
  P('30127', 'LISTON 3/4 X 4', 3835, 102, 19, true), P('30128', 'LISTON 3/4 X 5', 4817, 127, 19, true),
  P('30129', 'LISTON 3/4 X 6', 4685, 152, 19, true), P('30138', 'LISTON 1 X 1', 1178, 25, 25, true),
  P('30139', 'LISTON 1 X 1 1/2', 1730, 38, 25, true), P('30140', 'LISTON 1 X 2', 2308, 51, 25, true),
  P('30141', 'LISTON 1 X 3', 3478, 76, 25, true), P('30142', 'LISTON 1 X 4', 4625, 102, 25, true),
  P('30143', 'LISTON 1 X 5', 5776, 127, 25, true), P('30144', 'LISTON 1 X 6', 6955, 152, 25, true),
  P('30153', 'LISTON 1 1/2 X 1 1/2', 2877, 38, 38, true), P('30154', 'LISTON 1 1/2 X 2', 3842, 51, 38, true),
  P('30155', 'LISTON 11/2 X 3', 5756, 76, 38, true), P('30170', 'LISTON 2 X2', 5241, 51, 51, true),
  P('30171', 'LISTON 2 X 3', 7917, 76, 51, true), P('30172', 'LISTON 2 X 4', 10484, 102, 51, true),
  P('30111C', 'LISTON 1/2 X 4', 2172, 102, 13, true), P('30112C', 'LISTON 1/2 X 5', 2716, 127, 13, true),
  P('30113C', 'LISTON 1/2 X 6', 3251, 152, 13, true), P('30127C', 'LISTON 3/4 X 4', 3253, 102, 19, true),
  P('30128C', 'LISTON 3/4 X 5', 4085, 127, 19, true), P('30129C', 'LISTON 3/4 X 6', 3975, 152, 19, true),
  P('30140C', 'LISTON 1 X 2', 1961, 51, 25, true), P('30142C', 'LISTON 1 X 4', 3921, 102, 25, true),
  P('30143C', 'LISTON 1 X 5', 4905, 127, 25, true), P('30170C', 'LISTON 2 X 2', 4451, 51, 51, true),
  P('30172C', 'LISTON 2 X 4', 8896, 102, 51, true),
]
const EMPTY_PROFILE = { id: '', codigo: '', nombre: 'Sin seleccionar', precioMetro: 0, frenteMm: 30, profundidadMm: 18, liston: false }

/* ── Helpers de cálculo (del proyecto original) ── */
const clamp = (v: any, fb = 0) => { const n = Number(v); return !Number.isFinite(n) || n < 0 ? fb : n }
const fmtCur = (v: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(v || 0))
const fmtNum = (v: number, d = 2) => Number(v || 0).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtDimCm = (mm: any, d = 1) => `${fmtNum(clamp(mm, 0) / 10, d)} cm`
const fmtDimPair = (a: any, b: any, d = 1) => `${fmtDimCm(a, d)} x ${fmtDimCm(b, d)}`
function getProfileMeasures(profile: any, listonUso = 'plano') {
  const p = profile || EMPTY_PROFILE
  const f = clamp(p.frenteMm, 0), pr = clamp(p.profundidadMm, 0)
  if (p.liston && listonUso === 'canto') return { frenteMm: pr, profundidadMm: f }
  return { frenteMm: f, profundidadMm: pr }
}
function normByOrient(a: any, b: any, orient: string) {
  const first = clamp(a, 0), second = clamp(b, 0)
  const short = Math.min(first, second), long = Math.max(first, second)
  return orient === 'horizontal' ? { ancho: long, alto: short } : { ancho: short, alto: long }
}
function getArmado(anchoMm: number, altoMm: number) {
  const area = (clamp(anchoMm) * clamp(altoMm)) / 1000000
  const r = Math.round(area * 100) / 100
  if (r <= 0.03) return { etiqueta: 'Hasta 0.03 m²', precio: 4900 }
  if (r <= 0.12) return { etiqueta: 'Hasta 0.12 m²', precio: 5600 }
  if (r <= 0.35) return { etiqueta: 'Hasta 0.35 m²', precio: 6950 }
  return { etiqueta: 'Más de 0.35 m²', precio: 8400 }
}
function calcBars(meters: number) {
  const m = clamp(meters, 0)
  if (m <= 0) return { chargedHalfBars: 0, chargedBars: 0, chargedMeters: 0 }
  const h = Math.ceil(m / HALF_BAR_LENGTH_METERS)
  return { chargedHalfBars: h, chargedBars: h / 2, chargedMeters: h * HALF_BAR_LENGTH_METERS }
}

const INITIAL_FORM = {
  profileId: '', listonUso: 'plano', listonRebaje: 'si', anchoMm: 700, altoMm: 1000,
  cantidad: 1, orientacion: 'vertical', tipoMedida: 'interior', frente: 'no',
  fondoId: 'sin-fondo', paspartuMm: 0, paspartuColorId: 'blanco', pintadoId: 'sin-pintar', observaciones: '',
}

/* ═══════════════════════════════════════════════════════════════ */
export default function CotizadorMarcos() {
  const [form, setForm] = useState<any>(INITIAL_FORM)
  const [varillaSearch, setVarillaSearch] = useState('')
  const [presetSizeId, setPresetSizeId] = useState('personalizada')
  const [unidad, setUnidad] = useState('cm')
  const [anchoDisplay, setAnchoDisplay] = useState('70')
  const [altoDisplay, setAltoDisplay] = useState('100')
  const [lista, setLista] = useState<any[]>([])

  const setField = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }))

  const normDims = useMemo(() => normByOrient(form.anchoMm, form.altoMm, form.orientacion), [form.anchoMm, form.altoMm, form.orientacion])
  const selectedProfile = useMemo(() => INITIAL_PROFILES.find((p) => p.id === form.profileId) || null, [form.profileId])
  const effProfile: any = selectedProfile || EMPTY_PROFILE
  const effMeasures = useMemo(() => getProfileMeasures(effProfile, form.listonUso), [effProfile, form.listonUso])
  const filteredProfiles = useMemo(() => {
    const q = varillaSearch.trim().toLowerCase()
    if (!q) return INITIAL_PROFILES
    return INITIAL_PROFILES.filter((p) => String(p.codigo).toLowerCase().includes(q) || String(p.nombre).toLowerCase().includes(q))
  }, [varillaSearch])
  const selectedFondo = useMemo(() => FONDO_OPTIONS.find((o) => o.id === form.fondoId) || FONDO_OPTIONS[0], [form.fondoId])
  const selectedPintado = useMemo(() => PINTADO_OPTIONS.find((o) => o.id === form.pintadoId) || PINTADO_OPTIONS[0], [form.pintadoId])
  const selectedPaspartuColor = useMemo(() => PASPARTU_COLOR_OPTIONS.find((o) => o.id === form.paspartuColorId) || PASPARTU_COLOR_OPTIONS[0], [form.paspartuColorId])
  const normFaceMm = clamp(effMeasures.frenteMm, 0)
  const espejoSinFondo = form.frente === 'espejo' && normDims.ancho <= 1200 && normDims.alto <= 1200

  const quote = useMemo(() => {
    const pricingEnabled = Boolean(selectedProfile)
    const inAncho = normDims.ancho, inAlto = normDims.alto
    const cantidad = Math.max(clamp(form.cantidad, 1), 1)
    const paspartuMm = clamp(form.paspartuMm, 0)
    const anchoMm = form.tipoMedida === 'interior' ? inAncho + paspartuMm * 2 + normFaceMm * 2 : inAncho
    const altoMm = form.tipoMedida === 'interior' ? inAlto + paspartuMm * 2 + normFaceMm * 2 : inAlto
    const areaM2 = (anchoMm / 1000) * (altoMm / 1000)
    const frenteAreaM2 = form.frente !== 'no' ? areaM2 : 0
    const fondoDisabled = form.frente === 'espejo' && anchoMm <= 1200 && altoMm <= 1200
    const fondoAreaM2 = selectedFondo.precioM2 > 0 && !fondoDisabled ? areaM2 : 0
    const paspartuAreaM2 = paspartuMm > 0 ? areaM2 : 0
    const metrosMarcoTotales = ((2 * (anchoMm + altoMm)) / 1000) * cantidad
    const bars = calcBars(metrosMarcoTotales)
    const subtotalVarilla = pricingEnabled ? bars.chargedMeters * clamp(effProfile.precioMetro, 0) : 0
    const metrosRebaje = effProfile.liston && form.listonRebaje === 'si' ? bars.chargedMeters : 0
    const subtotalRebaje = pricingEnabled ? metrosRebaje * LISTON_REBAJE_PRICE_PER_METER : 0
    const frentePrecioM2 = form.frente === 'espejo' ? MIRROR_PRICE_M2 : form.frente === 'vidrio' ? GLASS_PRICE_M2 : 0
    const subtotalVidrio = pricingEnabled ? frenteAreaM2 * cantidad * frentePrecioM2 : 0
    const subtotalFondo = pricingEnabled ? fondoAreaM2 * cantidad * selectedFondo.precioM2 : 0
    const subtotalPaspartu = pricingEnabled ? paspartuAreaM2 * cantidad * PASPARTU_PRICE_M2 : 0
    const subtotalPintado = pricingEnabled ? selectedPintado.extra * cantidad : 0
    const armado = getArmado(anchoMm, altoMm)
    const subtotalArmado = pricingEnabled ? armado.precio * cantidad : 0
    const total = subtotalVarilla + subtotalRebaje + subtotalVidrio + subtotalFondo + subtotalPaspartu + subtotalPintado + subtotalArmado
    return {
      areaM2, metrosMarcoTotales, varillasCobradas: bars.chargedBars, metrosFacturados: bars.chargedMeters,
      metrosRebaje, subtotalVarilla, subtotalRebaje, subtotalVidrio, subtotalFondo, subtotalPaspartu,
      subtotalPintado, armado, subtotalArmado, total, pricingEnabled, inputAnchoMm: inAncho, inputAltoMm: inAlto,
      anchoFinalMm: anchoMm, altoFinalMm: altoMm,
    }
  }, [effProfile, form, normDims, normFaceMm, selectedFondo, selectedPintado, selectedProfile])

  /* Handlers */
  const syncDisplay = (a: number, b: number, u: string) => { if (u === 'cm') { setAnchoDisplay(String(a / 10)); setAltoDisplay(String(b / 10)) } else { setAnchoDisplay(String(a)); setAltoDisplay(String(b)) } }
  const onVarilla = (val: string) => {
    setVarillaSearch(val)
    const v = val.trim().toLowerCase()
    if (!v) { setField('profileId', ''); return }
    const m = INITIAL_PROFILES.find((p) => String(p.codigo).toLowerCase() === v || String(p.nombre).toLowerCase() === v || `${p.codigo} - ${p.nombre}`.toLowerCase() === v)
    if (m) { setField('profileId', m.id); if (!m.liston) { setField('listonUso', 'plano'); setField('listonRebaje', 'si') } }
  }
  const onOrient = (o: string) => setForm((p: any) => { const n = normByOrient(p.anchoMm, p.altoMm, o); syncDisplay(n.ancho, n.alto, unidad); return { ...p, orientacion: o, anchoMm: n.ancho, altoMm: n.alto } })
  const onPreset = (id: string) => {
    setPresetSizeId(id)
    const pr = PRESET_SIZE_OPTIONS.find((o) => o.id === id)
    if (!pr || !pr.anchoMm || !pr.altoMm) return
    const n = normByOrient(pr.anchoMm, pr.altoMm, form.orientacion)
    setForm((p: any) => ({ ...p, anchoMm: n.ancho, altoMm: n.alto })); syncDisplay(n.ancho, n.alto, unidad)
  }

  const summaryLines = (): [string, string, boolean?][] => {
    const frenteLabel = form.frente === 'espejo' ? 'Espejo' : form.frente === 'vidrio' ? 'Vidrio' : 'No'
    const fondoLabel = selectedFondo.precioM2 > 0 && !espejoSinFondo ? selectedFondo.nombre : 'No'
    const pas = clamp(form.paspartuMm, 0)
    const cant = Math.max(clamp(form.cantidad, 1), 1)
    return [
      ['Varilla', selectedProfile ? `${effProfile.codigo} - ${effProfile.nombre}` : 'Sin seleccionar'],
      ['Ancho de varilla', selectedProfile ? fmtDimCm(effProfile.frenteMm) : '-'],
      ['Orientación', form.orientacion === 'horizontal' ? 'Horizontal' : 'Vertical'],
      ['Tipo de medida', form.tipoMedida === 'interior' ? 'Interior' : 'Exterior'],
      ['Medida cargada', fmtDimPair(quote.inputAnchoMm, quote.inputAltoMm)],
      ...(selectedProfile?.liston ? [['Colocación', form.listonUso === 'canto' ? 'De canto' : 'De plano'] as [string, string]] : []),
      ['Cantidad', String(cant)],
      ...(selectedProfile?.liston ? [['Rebaje listón', form.listonRebaje === 'si' && quote.pricingEnabled ? `${fmtNum(quote.metrosRebaje)} m - ${fmtCur(quote.subtotalRebaje)}` : 'No'] as [string, string]] : []),
      ['Fondo', fondoLabel],
      ['Frente', frenteLabel],
      ['Paspartú', pas > 0 ? `${fmtDimCm(pas)} · ${selectedPaspartuColor.nombre}` : 'No'],
      ['Pintado', selectedPintado.nombre],
      ['Total estimado', quote.pricingEnabled ? fmtCur(quote.total) : 'Pendiente', true],
    ]
  }

  const printSummary = (title: string, lines: [string, string, boolean?][]) => {
    const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
      *{margin:0;padding:0;box-sizing:border-box} html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      @page{size:A4 portrait;margin:12mm} body{font-family:'Segoe UI',Arial,sans-serif;color:#2c2c2c}
      .card{border:1px solid #e8e5e0;border-radius:8px;overflow:hidden;margin:0 auto;max-width:170mm}
      .header{background:${NAVY};color:#fff;padding:18px 22px;border-top:4px solid ${CORAL}}
      .eyebrow{font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:${CORAL}}
      h1{font-size:20px;font-weight:900;margin-top:4px} .sub{font-size:11px;color:#d7d5d0}
      .body{padding:18px 22px} table{width:100%;border-collapse:separate;border-spacing:0 5px}
      td{padding:7px 10px;font-size:12px;background:#f8f7f5}
      td:first-child{color:#888;font-weight:700;width:55%;border-radius:4px 0 0 4px;border-left:3px solid #e8e5e0}
      td:last-child{font-weight:800;text-align:right;border-radius:0 4px 4px 0}
      tr.total td{background:${NAVY};color:#fff;font-size:14px;font-weight:900;border-left-color:${CORAL}}
    </style></head><body><div class="card">
      <div class="header"><div class="eyebrow">Sur Maderas</div><h1>${title}</h1><div class="sub">${fecha}</div></div>
      <div class="body"><table>${lines.map(([l, v, s]) => `<tr class="${s ? 'total' : ''}"><td>${l}</td><td>${v}</td></tr>`).join('')}</table></div>
    </div><script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`
    const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close() }
  }

  const handlePrint = () => { if (!quote.pricingEnabled) { alert('Elegí una varilla primero.'); return } printSummary('Presupuesto de Marco', summaryLines()) }
  const handleWhatsApp = () => {
    const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
    const text = ['*Presupuesto de Marco - Sur Maderas*', `_${fecha}_`, '', ...summaryLines().map(([l, v]) => `*${l}:* ${v}`)].join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }
  const copiar = async () => { try { await navigator.clipboard.writeText(summaryLines().map(([l, v]) => `${l}: ${v}`).join('\n')); alert('Copiado.') } catch { alert('No se pudo copiar.') } }

  /* Lista de marcos */
  const buildPayload = () => {
    const cant = Math.max(clamp(form.cantidad, 1), 1)
    const unit = cant > 0 ? quote.total / cant : quote.total
    return { descripcion: `${effProfile.codigo} - ${effProfile.nombre}`, cantidad: cant, precio: Math.round(unit), lines: summaryLines().filter(([, , s]) => !s) }
  }
  const agregarLista = () => { if (!quote.pricingEnabled) { alert('Elegí una varilla primero.'); return } setLista((p) => [...p, buildPayload()]) }
  const totalLista = lista.reduce((a, m) => a + Number(m.precio || 0) * Number(m.cantidad || 1), 0)
  const listaTexto = () => {
    const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
    return ['Lista de Marcos - Sur Maderas', fecha, '', ...lista.flatMap((m, i) => [`Marco ${i + 1} (x${m.cantidad})`, ...m.lines.map(([l, v]: any) => `  ${l}: ${v}`), `  Precio unitario: ${fmtCur(m.precio)}`, '']), `Total: ${fmtCur(totalLista)}`].join('\n')
  }
  const copiarLista = async () => { if (!lista.length) return; try { await navigator.clipboard.writeText(listaTexto()); alert('Lista copiada.') } catch { alert('No se pudo copiar.') } }
  const waLista = () => { if (!lista.length) return; window.open(`https://wa.me/?text=${encodeURIComponent(listaTexto())}`, '_blank') }
  const printLista = () => {
    if (!lista.length) return
    const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
    const cards = lista.map((m, i) => `<div style="border:1px solid #e8e5e0;border-radius:6px;margin-bottom:10px;overflow:hidden">
      <div style="background:#faf7f5;padding:6px 12px;font-weight:800;color:${NAVY}">Marco ${i + 1} (x${m.cantidad})</div>
      <table style="width:100%;border-collapse:collapse">${m.lines.map(([l, v]: any) => `<tr><td style="padding:5px 12px;color:#888;font-size:11px">${l}</td><td style="padding:5px 12px;text-align:right;font-weight:700;font-size:11px">${v}</td></tr>`).join('')}
      <tr><td style="padding:6px 12px;font-weight:800">Subtotal</td><td style="padding:6px 12px;text-align:right;font-weight:800">${fmtCur(Number(m.precio) * Number(m.cantidad))}</td></tr></table></div>`).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Lista de Marcos</title><style>@page{margin:12mm}body{font-family:'Segoe UI',Arial,sans-serif;color:#2c2c2c;padding:0}h1{color:${NAVY}}</style></head><body>
      <h1>Lista de Marcos · Sur Maderas</h1><p style="color:#888;font-size:12px">${fecha}</p><br>${cards}
      <div style="background:${NAVY};color:#fff;padding:10px 14px;border-radius:6px;font-weight:900;display:flex;justify-content:space-between"><span>Total</span><span>${fmtCur(totalLista)}</span></div>
      <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`
    const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close() }
  }

  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-400 bg-white'
  const lbl = 'text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1'
  const seg = (active: boolean) => `px-3 py-1.5 text-xs font-bold rounded-lg ${active ? 'text-white' : 'bg-gray-100 text-gray-500'}`

  const breakdown: [string, number, boolean?][] = [
    ['Varilla (' + fmtNum(quote.varillasCobradas, 1) + ' varillas)', quote.subtotalVarilla],
    ...(quote.subtotalRebaje > 0 ? [['Rebaje listón', quote.subtotalRebaje] as [string, number]] : []),
    ...(quote.subtotalVidrio > 0 ? [[form.frente === 'espejo' ? 'Espejo' : 'Vidrio', quote.subtotalVidrio] as [string, number]] : []),
    ...(quote.subtotalFondo > 0 ? [['Fondo (' + selectedFondo.nombre + ')', quote.subtotalFondo] as [string, number]] : []),
    ...(quote.subtotalPaspartu > 0 ? [['Paspartú', quote.subtotalPaspartu] as [string, number]] : []),
    ...(quote.subtotalPintado > 0 ? [['Pintado (' + selectedPintado.nombre + ')', quote.subtotalPintado] as [string, number]] : []),
    ['Armado (' + quote.armado.etiqueta + ')', quote.subtotalArmado],
  ]

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <div className="rounded-2xl p-6 mb-4 flex items-end justify-between flex-wrap gap-3" style={{ background: NAVY }}>
        <div>
          <p className="text-[11px] font-bold tracking-[3px] uppercase mb-1" style={{ color: CORAL }}>Sur Maderas · ERP</p>
          <h1 className="text-3xl font-bold text-white">Cotizador de marcos</h1>
          <p className="text-white/50 text-sm">Varillas de 3 m, vidrio/espejo, fondo, paspartú, pintado y armado.</p>
        </div>
        <div className="text-right">
          <p className="text-white/50 text-[11px] uppercase">Total estimado</p>
          <p className="text-3xl font-bold text-white">{quote.pricingEnabled ? fmtCur(quote.total) : 'Elegí varilla'}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Config */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <p className="text-sm font-bold" style={{ color: NAVY }}>Configuración del marco</p>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={lbl}>Medidas</label>
              <div className="flex gap-1">
                {['mm', 'cm'].map((u) => <button key={u} onClick={() => { setUnidad(u); syncDisplay(form.anchoMm, form.altoMm, u) }} className={`text-[10px] font-bold px-2 py-0.5 rounded ${unidad === u ? 'text-white' : 'bg-gray-100 text-gray-500'}`} style={unidad === u ? { background: NAVY } : {}}>{u.toUpperCase()}</button>)}
              </div>
            </div>
            <select className={`${inp} mb-2`} value={presetSizeId} onChange={(e) => onPreset(e.target.value)}>
              {PRESET_SIZE_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" inputMode="decimal" className={inp} placeholder="Medida 1" value={anchoDisplay} onChange={(e) => { setPresetSizeId('personalizada'); setAnchoDisplay(e.target.value); const p = parseFloat(e.target.value); if (Number.isFinite(p) && p > 0) setField('anchoMm', unidad === 'cm' ? p * 10 : p) }} />
              <input type="number" inputMode="decimal" className={inp} placeholder="Medida 2" value={altoDisplay} onChange={(e) => { setPresetSizeId('personalizada'); setAltoDisplay(e.target.value); const p = parseFloat(e.target.value); if (Number.isFinite(p) && p > 0) setField('altoMm', unidad === 'cm' ? p * 10 : p) }} />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">{form.orientacion === 'horizontal' ? 'Horizontal' : 'Vertical'}: {fmtDimPair(normDims.ancho, normDims.alto)}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Orientación</label>
              <div className="flex gap-1">
                <button onClick={() => onOrient('vertical')} className={seg(form.orientacion === 'vertical')} style={form.orientacion === 'vertical' ? { background: CORAL } : {}}>Vertical</button>
                <button onClick={() => onOrient('horizontal')} className={seg(form.orientacion === 'horizontal')} style={form.orientacion === 'horizontal' ? { background: CORAL } : {}}>Horizontal</button>
              </div>
            </div>
            <div><label className={lbl}>Tipo de medida</label>
              <select className={inp} value={form.tipoMedida} onChange={(e) => setField('tipoMedida', e.target.value)}>
                <option value="exterior">Exterior</option><option value="interior">Interior</option>
              </select>
            </div>
          </div>

          <div>
            <label className={lbl}>Varilla</label>
            <input type="text" list="varillas-opts" className={inp} value={varillaSearch} onChange={(e) => onVarilla(e.target.value)} placeholder="Buscar por código o nombre" />
            <datalist id="varillas-opts">{filteredProfiles.map((p) => <option key={p.id} value={`${p.codigo} - ${p.nombre}`} />)}</datalist>
          </div>

          {selectedProfile?.liston && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Uso del listón</label>
                <select className={inp} value={form.listonUso} onChange={(e) => setField('listonUso', e.target.value)}><option value="plano">De plano</option><option value="canto">De canto</option></select>
              </div>
              <div><label className={lbl}>Rebaje listón</label>
                <select className={inp} value={form.listonRebaje} onChange={(e) => setField('listonRebaje', e.target.value)}><option value="si">Sí</option><option value="no">No</option></select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Cantidad</label><input type="number" inputMode="numeric" className={inp} value={form.cantidad} onChange={(e) => setField('cantidad', e.target.value)} /></div>
            <div><label className={lbl}>Frente</label>
              <select className={inp} value={form.frente} onChange={(e) => setField('frente', e.target.value)}><option value="no">Sin frente</option><option value="vidrio">Vidrio</option><option value="espejo">Espejo</option></select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Fondo</label>
              <select className={inp} value={form.fondoId} onChange={(e) => setField('fondoId', e.target.value)}>{FONDO_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>
            </div>
            <div><label className={lbl}>Pintado</label>
              <select className={inp} value={form.pintadoId} onChange={(e) => setField('pintadoId', e.target.value)}>{PINTADO_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Paspartú (mm)</label><input type="number" inputMode="numeric" className={inp} value={form.paspartuMm} onChange={(e) => setField('paspartuMm', e.target.value)} /></div>
            <div><label className={lbl}>Color paspartú</label>
              <select className={inp} value={form.paspartuColorId} onChange={(e) => setField('paspartuColorId', e.target.value)}>{PASPARTU_COLOR_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>
            </div>
          </div>

          <div><label className={lbl}>Observaciones</label><textarea className={inp} rows={2} value={form.observaciones} onChange={(e) => setField('observaciones', e.target.value)} /></div>
        </div>

        {/* Resultado */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-sm font-bold mb-3" style={{ color: NAVY }}>Detalle del presupuesto</p>
            {!quote.pricingEnabled ? <p className="text-sm text-gray-400 py-6 text-center">Elegí una varilla para calcular.</p> : (
              <div className="space-y-1.5">
                {breakdown.map(([l, v]) => <div key={l} className="flex justify-between text-sm"><span className="text-gray-500">{l}</span><span className="font-semibold tabular-nums">{fmtCur(v)}</span></div>)}
                <div className="flex justify-between pt-2 mt-2 border-t border-gray-100"><span className="font-bold" style={{ color: NAVY }}>Total</span><span className="text-xl font-bold" style={{ color: CORAL }}>{fmtCur(quote.total)}</span></div>
                <p className="text-[11px] text-gray-400 pt-1">Medida final: {fmtDimPair(quote.anchoFinalMm, quote.altoFinalMm)} · {fmtNum(quote.areaM2, 2)} m²</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={copiar} className="flex items-center gap-1.5 text-xs font-semibold border border-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50"><Copy size={14} /> Copiar</button>
              <button onClick={handlePrint} className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-2 rounded-lg" style={{ background: NAVY }}><Printer size={14} /> PDF</button>
              <button onClick={handleWhatsApp} className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-2 rounded-lg" style={{ background: '#25D366' }}><MessageCircle size={14} /> WhatsApp</button>
              <button onClick={agregarLista} className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-2 rounded-lg ml-auto" style={{ background: CORAL }}><Plus size={14} /> A la lista</button>
            </div>
          </div>

          {lista.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold" style={{ color: NAVY }}>Lista de marcos ({lista.length})</p>
                <p className="font-bold" style={{ color: CORAL }}>{fmtCur(totalLista)}</p>
              </div>
              <div className="divide-y divide-gray-50">
                {lista.map((m, i) => (
                  <div key={i} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-gray-600">Marco {i + 1} · {m.descripcion} <span className="text-gray-400">x{m.cantidad}</span></span>
                    <span className="flex items-center gap-2"><b className="tabular-nums">{fmtCur(Number(m.precio) * Number(m.cantidad))}</b>
                      <button onClick={() => setLista((p) => p.filter((_, idx) => idx !== i))} className="text-red-300 hover:text-red-600"><Trash2 size={14} /></button></span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={copiarLista} className="flex items-center gap-1.5 text-xs font-semibold border border-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50"><Copy size={14} /> Copiar</button>
                <button onClick={printLista} className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-2 rounded-lg" style={{ background: NAVY }}><Printer size={14} /> PDF</button>
                <button onClick={waLista} className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-2 rounded-lg" style={{ background: '#25D366' }}><MessageCircle size={14} /> WhatsApp</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
