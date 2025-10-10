import React from 'react'
import { CustomDialog } from '@/components/ui/CustomDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { customCss } from '@/lib/customCss'
import api from '@/lib/axios'
import { useToast } from '@/hooks/use-toast'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'

const FormSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.union([
    z.literal(''),
    z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/^[a-zA-Z0-9_]*$/, 'Only letters, numbers, and underscores are allowed'),
  ]),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  role: z.string().min(1, 'Role is required'),
  status: z.union([z.literal(0), z.literal(1)]),
  address: z.string().min(1, 'Address is required'),
  phone_number: z
    .string()
    .min(1, 'Phone is required')
    .regex(/^\d+$/, 'Only digits are allowed'),
})

type FormValues = z.infer<typeof FormSchema>

export type UserForEdit = {
  id: number
  uuid: string
  first_name: string
  last_name: string
  email: string
  role: string
  status: number
  address?: string | null
  phone_number?: string | null
}

interface EditUserModalProps {
  open: boolean
  onClose: () => void
  onUpdated?: () => void
  user: UserForEdit
}

export const EditUserModal: React.FC<EditUserModalProps> = ({ open, onClose, onUpdated, user }) => {
  const { toast } = useToast()
  const [isFormReady, setIsFormReady] = React.useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
  })

  React.useEffect(() => {
    if (!open) return

    form.reset({
      email: user.email,
      password: '',
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      status: user.status ? 1 : 0,
      address: user.address ?? '',
      phone_number: user.phone_number ?? '',
    })
    setIsFormReady(true)
    console.log(open, JSON.stringify(form.getValues()))
  }, [open, form, user])

  const onSubmit = async (values: FormValues) => {
    try {
      await api.patch(`/users/${user.id}`, {...values, password: values.password || undefined})
      toast({ title: 'User updated' })
      onClose()
      onUpdated?.()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string }
      toast({ title: 'Error', description: e.response?.data?.message || e.message || 'Failed to update user', variant: 'destructive' })
    }
  }

  if (!open || !isFormReady) return null

  return (
    <CustomDialog
      open={open}
      onClose={() => (!form.formState.isSubmitting ? onClose() : undefined)}
      title={<div className="font-semibold text-lg">Edit User</div>}
      headerRight={
        <button type="button" onClick={onClose} className={`${customCss.buttonOutline} !h-8 !w-8 inline-flex items-center justify-center`}>
          <X />
        </button>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="email@example.com"
                      {...field}
                      className={customCss.input}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      {...field}
                      className={customCss.input}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="first_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="John"
                      {...field}
                      className={customCss.input}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="last_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Doe"
                      {...field}
                      className={customCss.input}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className={customCss.input + ' !text-sm'}>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    value={field.value?.toString()}
                    onValueChange={(val) => field.onChange(parseInt(val))}
                  >
                    <FormControl>
                      <SelectTrigger className={customCss.input + ' !text-sm'}>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">Active</SelectItem>
                      <SelectItem value="0">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="123 Main Street"
                      {...field}
                      className={customCss.input}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone_number"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="1234567890"
                      {...field}
                      className={customCss.input}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className={customCss.buttonOutline}
              onClick={onClose}
              disabled={form.formState.isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              className={customCss.button}
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Updating...' : 'Update User'}
            </Button>
          </div>
        </form>
      </Form>
    </CustomDialog>
  )
}