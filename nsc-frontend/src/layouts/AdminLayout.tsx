import AppShell from '@/components/layout/AppShell'
import type { NavItem } from '@/components/layout/SidebarNav'
import { LayoutDashboard, LibraryBig, RadioReceiver, ScrollText, UserRoundCog, BarChart3 } from 'lucide-react'
import { Outlet } from 'react-router-dom'

const nav: NavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: <LayoutDashboard /> },
  { label: 'Analytics', to: '/admin/analytics', icon: <BarChart3 /> },
  { label: 'Devices & Chairs', to: '/admin/devices', icon: <RadioReceiver /> },
  { label: 'Assets', to: '/admin/assets', icon: <LibraryBig /> },
  { label: 'Users', to: '/admin/users', icon: <UserRoundCog /> },
  { label: 'Session Logs', to: '/admin/sessions', icon: <ScrollText /> }
]

export default function AdminLayout() {
  return (
    <AppShell nav={nav}>
      <Outlet />
    </AppShell>
  )
}
