import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/auth'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Globe, Users, Eye, EyeOff } from 'lucide-react'
import { customCss } from '@/lib/customCss'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
  role: z.enum(['super_admin', 'admin', 'operator']),
})
export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', role: 'admin' },
  })
  const [showPassword, setShowPassword] = useState<boolean>(false)

  const onSubmit = async (values: z.infer<typeof schema>) => {
    try {
      await login(values)
      toast.success('Logged in')
      // Read the latest user from the store to avoid stale closure
      const currentUser = useAuthStore.getState().user
      const roles = currentUser?.roles ?? []
      
      const dest = roles.includes('super_admin')
        ? '/super-admin'
        : roles.includes('admin')
        ? '/admin'
        : '/operator'
      navigate(dest, { replace: true })
    } catch (e: unknown) {
      interface ApiError { response?: { data?: { message?: unknown } } }
      const apiMessageUnknown = (e as ApiError).response?.data?.message
      const apiMessage: string | undefined = typeof apiMessageUnknown === 'string' ? apiMessageUnknown : undefined
      if (apiMessage === 'Wrong Password!') {
        form.setError('password', { type: 'server', message: apiMessage })
        form.setFocus('password')
        toast.error(apiMessage)
        return
      }
      if (apiMessage === 'Invalid Email Address!') {
        form.setError('email', { type: 'server', message: apiMessage })
        form.setFocus('email')
        toast.error(apiMessage)
        return
      }
      if (apiMessage === 'Wrong Credentials!') {
        form.setError('email', { type: 'server', message: apiMessage })
        form.setError('password', { type: 'server', message: apiMessage })
        form.setFocus('email')
        toast.error(apiMessage)
        return
      }
      const message = apiMessage || (e instanceof Error ? e.message : 'Login failed')
      toast.error(message)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-tl from-slate-900 via-cyan-800 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-[80vw] bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl shadow-2xl overflow-hidden border border-slate-700/50">
        <div className="grid grid-cols-1 lg:grid-cols-3 min-h-[80vh]">
          {/* Left Side - Branding */}
          <div className="flex flex-col items-center justify-center bg-gradient-to-br from-slate-800/50 to-transparent lg:col-span-2">
            <div className="text-center space-y-6 p-12">
              {/* Logo */}
              <div className="flex justify-center mb-8">
                {/* <div className="w-32 h-32 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/50"> */}
                <Globe className="w-40 h-40 text-cyan-400" strokeWidth={1.5} />
                {/* </div> */}
              </div>

              {/* Brand Text */}
              <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">
                VR Control Suite
              </h1>
              <p className="text-xl text-slate-300 max-w-md mx-auto">
                Control immersive journeys with precision.
              </p>
              <p className="text-sm text-slate-400">
                Secure, role-based access • Real-time orchestration
              </p>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="flex items-center justify-center px-4 py-12 bg-black lg:col-span-1">
            <div className="w-full max-w-md">
              {/* Header */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-cyan-600 rounded-none flex items-center justify-center">
                    <span className="text-white font-bold text-lg">VR</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-white">Welcome back</h2>
                    <p className="text-sm text-slate-400">Sign in to continue</p>
                  </div>
                </div>
              </div>

              {/* Form */}
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Email */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300 text-sm">Email</FormLabel>
                        <FormControl>
                          <div className="relative mt-1">
                            <Input
                              type="email"
                              placeholder="you@example.com"
                              {...field}
                              className={customCss.input}
                              required
                              autoComplete="email"
                            />
                            <Users className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-100" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Password */}
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300 text-sm">Password</FormLabel>
                        <FormControl>
                          <div className="relative mt-1">
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Enter password"
                              {...field}
                              className={customCss.input}
                              required
                              autoComplete="current-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((v: boolean) => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-100 hover:text-zinc-300"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Role */}
                  {/* <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300 text-sm">Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="mt-1 bg-slate-800/50 border border-slate-600 text-white rounded-lg focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all">
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-slate-800 border border-slate-600">
                            <SelectItem value="super_admin" className="text-white focus:bg-cyan-600">
                              <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4" />
                                Super Admin
                              </div>
                            </SelectItem>
                            <SelectItem value="admin" className="text-white focus:bg-cyan-600">
                              <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4" />
                                Admin
                              </div>
                            </SelectItem>
                            <SelectItem value="operator" className="text-white focus:bg-cyan-600">
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                Operator
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
 */}
                  {/* Additional Links */}
                  {/* <div className="flex items-center justify-between text-sm gap-4">
                    <button type="button" className="text-cyan-400 hover:text-cyan-300 transition-colors">
                      Forgot password?
                    </button>
                    <button type="button" className="text-cyan-400 hover:text-cyan-300 transition-colors">
                      Enable MFA
                    </button>
                    <button type="button" className="text-cyan-400 hover:text-cyan-300 transition-colors whitespace-nowrap">
                      Use Backup Code
                    </button>
                  </div> */}

                  {/* Sign In Buttons */}
                  <div className="space-y-3 pt-2">
                    <Button type="submit" className={customCss.button}>
                      Sign In
                    </Button>
                    
                  </div>

                  {/* Terms */}
                  <p className="text-center text-xs text-slate-500 pt-2">By continuing you agree to our terms.</p>
                </form>
              </Form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
