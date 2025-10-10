import { useAuthStore } from '@/store/auth'
import { Badge } from '../ui/badge'

export default function SidebarProfile() {
  const user = useAuthStore((s) => s.user)

  if (!user) return null

  const primaryRole = user.roles[0] || 'operator'
  const roleLabel =
    primaryRole === 'super_admin' ? 'Super Admin' : primaryRole === 'admin' ? 'Admin' : 'Operator'

  return (
    <div className="mt-auto p-4">
      <div className="flex items-center gap-3 rounded-none bg-cyan-500/20 p-3">
        <div className="h-12 w-12 shrink-0 rounded-none bg-cyan-500 border border-accent/40 flex items-center justify-center text-white font-semibold text-xl capitalize">
          {user.name.charAt(0)}
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-md font-semibold text-cyan-500 capitalize line-clamp-1">{user.name}</div>
          <Badge className="bg-cyan-500 text-white m-0 rounded-none hover:bg-cyan-500">{roleLabel}</Badge>
        </div>
      </div>
    </div>
  )
}
