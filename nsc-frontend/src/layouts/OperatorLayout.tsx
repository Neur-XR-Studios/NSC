import AppShell from '@/components/layout/AppShell'
import type { NavItem } from '@/components/layout/SidebarNav'
import { Headset, LayoutDashboard } from 'lucide-react'
import { Outlet } from 'react-router-dom'

const nav: NavItem[] = [
  { label: 'Dashboard', to: '/operator', icon: <LayoutDashboard /> },
  { label: 'Device Control Panel', to: '/operator/device-control-panel', icon:<Headset /> },
]

export default function OperatorLayout() {
  return (
    <AppShell nav={nav}>
      <Outlet />
    </AppShell>
  )
}
