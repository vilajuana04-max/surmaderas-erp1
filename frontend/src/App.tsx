import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Ventas    from './pages/Ventas'
import Compras   from './pages/Compras'
import RRHH      from './pages/RRHH'
import Gastos    from './pages/Gastos'
import { Navigate } from 'react-router-dom'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/"           element={<Dashboard />} />
        <Route path="/ventas"     element={<Ventas />}    />
        <Route path="/compras"    element={<Compras />}   />
        <Route path="/rrhh"       element={<RRHH />}      />
        <Route path="/gastos"     element={<Gastos />}    />
        {/* Redirigir rutas antiguas al nuevo RRHH */}
        <Route path="/sueldos"    element={<Navigate to="/rrhh" replace />} />
        <Route path="/vacaciones" element={<Navigate to="/rrhh" replace />} />
      </Routes>
    </Layout>
  )
}
