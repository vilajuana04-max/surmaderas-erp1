import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'

import Dashboard        from './pages/Dashboard'
import Ventas           from './pages/Ventas'
import Compras          from './pages/Compras'
import RRHH             from './pages/RRHH'
import Gastos           from './pages/Gastos'
import FlujoCaja        from './pages/FlujoCaja'
import Vencimientos     from './pages/Vencimientos'
import GastosPersonales from './pages/GastosPersonales'
import CajaDiaria       from './pages/CajaDiaria'
import Comisiones        from './pages/Comisiones'
import PuntoEquilibrio  from './pages/PuntoEquilibrio'
import Cupones          from './pages/Cupones'
import Clientes         from './pages/Clientes'
import Marketing        from './pages/Marketing'
import Contenido        from './pages/Contenido'
import ListaPrecios     from './pages/ListaPrecios'
import VentaOnline      from './pages/VentaOnline'
import Usuarios         from './pages/Usuarios'
import MiCuenta         from './pages/MiCuenta'
import Presupuestos     from './pages/Presupuestos'

const page = (module: string | undefined, el: React.ReactNode) => (
  <ProtectedRoute module={module}>
    <Layout>{el}</Layout>
  </ProtectedRoute>
)

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/"                  element={page('dashboard', <Dashboard />)} />
        <Route path="/ventas"            element={page('finanzas', <Ventas />)} />
        <Route path="/compras"           element={page('finanzas', <Compras />)} />
        <Route path="/gastos"            element={page('finanzas', <Gastos />)} />
        <Route path="/flujocaja"         element={page('finanzas', <FlujoCaja />)} />
        <Route path="/lista-precios"     element={page('finanzas', <ListaPrecios />)} />
        <Route path="/punto-equilibrio"  element={page('finanzas', <PuntoEquilibrio />)} />
        <Route path="/caja-diaria"       element={page('caja_diaria', <CajaDiaria />)} />
        <Route path="/venta-online"      element={page('venta_online', <VentaOnline />)} />
        <Route path="/presupuestos"      element={page('presupuestos', <Presupuestos />)} />
        <Route path="/rrhh"              element={page('rrhh', <RRHH />)} />
        <Route path="/comisiones"        element={page('rrhh', <Comisiones />)} />
        <Route path="/vencimientos"      element={page('vencimientos', <Vencimientos />)} />
        <Route path="/gastos-personales" element={page('gastos_personales', <GastosPersonales />)} />
        <Route path="/cupones"           element={page('clientes', <Cupones />)} />
        <Route path="/clientes"          element={page('clientes', <Clientes />)} />
        <Route path="/marketing"         element={page('marketing', <Marketing />)} />
        <Route path="/contenido"         element={page('contenido', <Contenido />)} />
        <Route path="/usuarios"          element={page('usuarios', <Usuarios />)} />
        <Route path="/mi-cuenta"         element={page(undefined, <MiCuenta />)} />

        {/* Legacy redirects */}
        <Route path="/sueldos"    element={<Navigate to="/rrhh" replace />} />
        <Route path="/vacaciones" element={<Navigate to="/rrhh" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
