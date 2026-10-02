// Sistema de permisos por módulo (espejo del backend app/permissions.py)
export type Level = 'none' | 'view' | 'edit' | 'admin'
export type Permissions = Record<string, Level>

export const LEVEL_RANK: Record<Level, number> = { none: 0, view: 1, edit: 2, admin: 3 }

export const MODULES = [
  'dashboard', 'caja_diaria', 'finanzas', 'rrhh', 'vencimientos',
  'gastos_personales', 'clientes', 'marketing', 'contenido',
  'venta_online', 'usuarios',
] as const

export const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  caja_diaria: 'Caja Diaria',
  finanzas: 'Finanzas',
  rrhh: 'Recursos Humanos',
  vencimientos: 'Vencimientos',
  gastos_personales: 'Gastos Personales',
  clientes: 'Clientes',
  marketing: 'Marketing',
  contenido: 'Contenido',
  venta_online: 'Venta Online',
  usuarios: 'Usuarios (Configuración)',
}

export const MODULE_HOME: Record<string, string> = {
  dashboard: '/',
  caja_diaria: '/caja-diaria',
  finanzas: '/ventas',
  rrhh: '/rrhh',
  vencimientos: '/vencimientos',
  gastos_personales: '/gastos-personales',
  clientes: '/clientes',
  marketing: '/marketing',
  contenido: '/contenido',
  venta_online: '/venta-online',
  usuarios: '/usuarios',
}

export function can(perms: Permissions | undefined | null, module: string, level: Level = 'view'): boolean {
  if (!perms) return false
  return (LEVEL_RANK[perms[module] || 'none'] ?? 0) >= LEVEL_RANK[level]
}

/** Primera ruta accesible del usuario (para redirecciones) */
export function firstAllowedPath(perms: Permissions | undefined | null): string {
  for (const m of MODULES) {
    if (can(perms, m, 'view')) return MODULE_HOME[m]
  }
  return '/mi-cuenta'
}
