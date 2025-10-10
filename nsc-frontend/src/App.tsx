import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '@/routes/ProtectedRoute'
import RoleBasedRoute from '@/routes/RoleBasedRoute'
import Login from '@/pages/auth/Login'
import { useAuthStore } from '@/store/auth'
import Admin from '@/pages/dashboard/Admin'
import SuperAdmin from '@/pages/dashboard/SuperAdmin'
import Operator from '@/pages/dashboard/Operator'
import NotFound from '@/pages/NotFound'
import SuperAdminLayout from "@/layouts/SuperAdminLayout"
import AdminLayout from "@/layouts/AdminLayout"
import OperatorLayout from "@/layouts/OperatorLayout"
import Assets from './pages/admin/assets/Assets'
import Users from './pages/admin/users/Users'
import Devices from './pages/admin/devices/Devices'
import DeviceControlPanel from './pages/operator/deviceControlPanel/DeviceControlPanel'

function App() {
  useAuthStore((s) => s.isAuthenticated)

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<Login />} />

      {/* Protected, role-based routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RoleBasedRoute roles={["super_admin"]} />}>
          <Route path="/super-admin" element={<SuperAdminLayout />}>
            <Route index element={<SuperAdmin />} />
          </Route>
        </Route>
        <Route element={<RoleBasedRoute roles={["admin"]} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Admin />} />
          <Route path="/admin/assets" element={<Assets />} />
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/devices" element={<Devices />} />
          </Route>
        </Route>
        <Route element={<RoleBasedRoute roles={["operator"]} />}>
          <Route path="/operator" element={<OperatorLayout />}>
            <Route index element={<Operator />} />
          <Route path="/operator/device-control-panel" element={<DeviceControlPanel />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
