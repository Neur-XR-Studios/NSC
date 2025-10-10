import AppShell from '@/components/layout/AppShell'
import type { NavItem } from '@/components/layout/SidebarNav'
import { Outlet } from 'react-router-dom'

const nav: NavItem[] = [
  { label: 'Dashboard', to: '/super-admin' },
  { label: 'Devices & Chairs', to: '/super-admin/devices' },
  { label: 'Assets', to: '/super-admin/assets' },
  { label: 'Users', to: '/super-admin/users' },
  { label: 'Session Logs', to: '/super-admin/sessions' },
  { label: 'Individual Mode', to: '/super-admin/individual' },
  { label: 'Group Sync', to: '/super-admin/group-sync' },
]

export default function SuperAdminLayout() {
  return (
    <AppShell nav={nav}>
      <Outlet />
    </AppShell>
  )
}
