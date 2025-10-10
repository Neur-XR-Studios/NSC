import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import SidebarProfile from '@/components/layout/SidebarProfile'
import { Button } from '../ui/button'
import { LogOut } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { ReactNode } from 'react'

export type NavItem = {
  label: string
  to: string
  icon?: ReactNode
}
export function SidebarNav({ items }: { items: NavItem[] }) {
  const logout = useAuthStore((s) => s.logout)
  const location = useLocation()

  return (
    <aside className="h-screen w-64 shrink-0 border-r border-border bg-[hsl(var(--background))] flex flex-col">
      <div className="">
        <div className="bg-cyan-500/20 p-2 flex items-center gap-2">
          <div className="w-12 h-12 bg-cyan-500 text-white flex items-center justify-center">
            <p className="text-lg font-semibold">VR</p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-sm text-cyan-500 font-bold">Control Suite</div>
            <div className="text-xs font-bold">Orchestrate journeys</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={() => cn(
                'rounded px-3 py-2 text-sm hover:bg-cyan-500/20 hover:text-cyan-500 transition-colors',
                location.pathname === it.to && 'bg-cyan-500/20 text-cyan-500'
              )
              }
            >
              <div className='flex gap-2 items-center'>
                {it.icon}{it.label}
              </div>
            </NavLink>
          ))}
        </nav>
      </div>
      <SidebarProfile />
      <div className=" text-sm text-muted-foreground">
        <div className="py-4 border-t border-border">
          <Button type="button" variant="link" onClick={logout} > <LogOut className="mr-2" /> Sign Out</Button>
        </div>
      </div>
    </aside>
  )
}

export default SidebarNav
