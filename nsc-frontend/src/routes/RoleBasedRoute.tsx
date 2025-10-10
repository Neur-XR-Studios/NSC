import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Role } from '@/store/auth'
import { useAuthStore } from '@/store/auth'

interface Props {
  roles: Role[]
}

export function RoleBasedRoute({ roles }: Props) {
  const hasRole = useAuthStore((s) => s.hasRole)
  const location = useLocation()

  if (!hasRole(roles)) {
    // If user is authenticated but lacks role, redirect to home or a 403 page
    return <Navigate to="/" replace state={{ from: location, reason: 'forbidden' }} />
  }

  return <Outlet />
}

export default RoleBasedRoute
