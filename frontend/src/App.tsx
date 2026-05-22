import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard   from './pages/Dashboard'
import Ventas      from './pages/Ventas'
import Compras     from './pages/Compras'
import Sueldos     from './pages/Sueldos'
import Vacaciones  from './pages/Vacaciones'
import Gastos      from './pages/Gastos'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/"           element={<Dashboard />}  />
        <Route path="/ventas"     element={<Ventas />}     />
        <Route path="/compras"    element={<Compras />}    />
        <Route path="/sueldos"    element={<Sueldos />}    />
        <Route path="/vacaciones" element={<Vacaciones />} />
        <Route path="/gastos"     element={<Gastos />}     />
      </Routes>
    </Layout>
  )
}
