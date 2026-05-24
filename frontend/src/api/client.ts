// En producción, VITE_API_URL apunta a https://surmaderas-api.onrender.com
// En desarrollo, usa el proxy de Vite (/api → localhost:8000)
const BASE = import.meta.env.VITE_API_URL ?? ''

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status}: ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  get:    <T>(path: string)                => req<T>(path),
  post:   <T>(path: string, body: unknown) => req<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown) => req<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: <T>(path: string)               => req<T>(path, { method: 'DELETE' }),

  pdf: async (path: string, filename: string) => {
    const url = `${BASE}${path}`
    let res: Response
    try {
      res = await fetch(url)
    } catch {
      throw new Error('No se pudo conectar con el servidor. Verificá tu conexión.')
    }
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`Error del servidor (${res.status}): ${text.slice(0, 200)}`)
    }
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('pdf')) {
      const text = await res.text().catch(() => '')
      throw new Error(`El servidor no devolvió un PDF. Respuesta: ${text.slice(0, 200)}`)
    }
    const blob = await res.blob()
    const link = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = link; a.download = filename; a.click()
    URL.revokeObjectURL(link)
  },
}
