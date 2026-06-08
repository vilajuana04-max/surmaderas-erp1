// En producción, VITE_API_URL apunta a https://surmaderas-api.onrender.com
// En desarrollo, usa el proxy de Vite (/api → localhost:8000)
const BASE = import.meta.env.VITE_API_URL ?? ''

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('erp_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ── Ping de calentamiento para Render free tier ───────────────────
// Se llama una sola vez al cargar la app. Si el servidor está durmiendo,
// este fetch lo despierta silenciosamente antes de que el usuario haga algo.
let _pinged = false
export function warmupServer() {
  if (_pinged || !BASE) return
  _pinged = true
  fetch(`${BASE}/health`, { method: 'GET' }).catch(() => { /* silencioso */ })
}

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`
  let res: Response
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...authHeaders(), ...opts?.headers },
      ...opts,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`${msg} [URL: ${url}]`)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status}: ${text.slice(0, 300)}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// ── req con reintentos automáticos ────────────────────────────────
// Reintenta hasta `retries` veces con espera creciente.
// Útil para POST/PUT cuando Render está despertando.
export async function reqWithRetry<T>(
  path: string, opts: RequestInit, retries = 3, delayMs = 4000
): Promise<T> {
  let last: Error = new Error('timeout')
  for (let i = 0; i < retries; i++) {
    try {
      return await req<T>(path, opts)
    } catch (e: unknown) {
      last = e instanceof Error ? e : new Error(String(e))
      if (i < retries - 1) await new Promise(r => setTimeout(r, delayMs))
    }
  }
  throw last
}

export const api = {
  get:    <T>(path: string)                => req<T>(path),
  post:   <T>(path: string, body: unknown) => req<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown) => req<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: <T>(path: string)               => req<T>(path, { method: 'DELETE' }),

  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const url = `${BASE}${path}`
    const res = await fetch(url, { method: 'POST', body: formData })
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`${res.status}: ${text}`)
    }
    return res.json()
  },

  pdf: async (path: string, filename: string) => {
    const url = `${BASE}${path}`
    let res: Response
    try {
      res = await fetch(url, { headers: { ...authHeaders() } })
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : String(e)
      throw new Error(`No se pudo conectar con el servidor (${detail}). URL: ${url}`)
    }
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`Error del servidor (${res.status}): ${text.slice(0, 400)}`)
    }
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('pdf')) {
      const text = await res.text().catch(() => '')
      throw new Error(`El servidor no devolvió un PDF (${contentType}): ${text.slice(0, 300)}`)
    }
    const blob = await res.blob()
    const link = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = link; a.download = filename; a.click()
    URL.revokeObjectURL(link)
  },
}
