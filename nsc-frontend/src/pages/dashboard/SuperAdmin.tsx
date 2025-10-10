import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth'

export default function SuperAdmin() {
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Super Admin Panel</h1>
      <p className="text-muted-foreground">Welcome, {user?.name}</p>
      <div className="flex gap-2">
        <Button onClick={logout}>Logout</Button>
      </div>
    </div>
  )
}
