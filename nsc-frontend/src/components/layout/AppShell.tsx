import type { ReactNode } from 'react'
import { SidebarNav, type NavItem } from '@/components/layout/SidebarNav'
import { useLocation } from 'react-router-dom'
export function Topbar({
  title,
  icon,
  actions,
}: {
  title?: string
  icon?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center gap-3 px-4">
        <div className="font-medium text-muted-foreground flex items-center gap-2">
          {icon}
          {title || ''}</div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          {actions}
        </div>
      </div>
    </header>
  )
}

export default function AppShell({
  nav,
  children,
  actions,
}: {
  nav: NavItem[]
  children: ReactNode
  actions?: ReactNode
}) {
  const location = useLocation()
  const activeMenu = nav.find((f) => f.to === location.pathname)

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <SidebarNav items={nav} />
      <div className="flex-1 flex flex-col">
        <Topbar title={activeMenu?.label} actions={actions} icon={activeMenu?.icon} />
        <main className="flex-1 p-4 md:p-6 max-h-[calc(100vh-64px)] overflow-y-auto">
          <div className="mx-auto max-w-[1400px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
