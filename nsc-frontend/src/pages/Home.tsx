import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center p-6">
      <h1 className="text-3xl font-bold">Welcome</h1>
      <p className="text-muted-foreground max-w-prose">
        This is the public home page. Use the login page to authenticate and access role-based dashboards.
      </p>
      <Button asChild>
        <Link to="/login">Go to Login</Link>
      </Button>
    </div>
  )
}
