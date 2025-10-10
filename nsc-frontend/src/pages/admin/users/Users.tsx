import { usePaginatedList } from '@/hooks/usePaginatedList'
import api from '@/lib/axios'
import type { ApiEnvelope } from '@/types/pagination'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { customCss } from '@/lib/customCss'
import { useState } from 'react'
import { Edit } from 'lucide-react'
import { CreateUserModal } from '@/components/modals/CreateUserModal'
import { EditUserModal } from '@/components/modals/EditUserModal'

type UserItem = {
    id: number
    uuid: string
    first_name: string
    last_name: string
    email: string
    role: string
    status: number
    email_verified: number
    address?: string | null
    phone_number?: string | null
    createdAt?: string
    updatedAt?: string
}

export default function Users() {
    const fetcher = async (filters: Record<string, unknown>): Promise<ApiEnvelope<{ total?: number; page?: number; limit?: number; data?: UserItem[] }>> => {
        const page = (filters?.page as number) ?? 1
        const limit = (filters?.limit as number) ?? 10
        const search = (filters?.search as string) ?? ''
        return api.get('/users', { page, limit, search })
    }

    const { items, page, totalPages, loading, search, setSearch, setPage, refresh } = usePaginatedList<UserItem>(
        'users',
        fetcher,
        { page: 1, limit: 10, search: '' }
    )

    const canPrev = page > 1
    const canNext = page < totalPages

    const [createOpen, setCreateOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [selected, setSelected] = useState<UserItem | null>(null)

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
                <Input
                    placeholder="Search name or email"
                    className={`!w-[400px] ${customCss.input}`}
                    onChange={(e) => setSearch(e.target.value)}
                    value={search}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') void refresh()
                    }}
                />
                <div className="flex items-center gap-2">
                    <Button variant="default" className={customCss.button} onClick={() => setCreateOpen(true)}>
                        Add User
                    </Button>
                </div>
            </div>

            <div className="rounded-md border border-border overflow-hidden">
                <div className="w-full overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-900/50">
                            <tr className="border-b border-border">
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                                    #
                                </th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                                    Name
                                </th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                                    Email
                                </th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                                    Role
                                </th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                                    Status
                                </th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {!items.length && !loading ? (
                                <tr>
                                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                                        No users found.
                                    </td>
                                </tr>
                            ) : (
                                items.map((u, i) => (
                                    <tr key={u.id} className="border-b border-border hover:bg-zinc-900/20 transition-colors">
                                        <td className="p-4 align-middle">{i + 1}</td>
                                        <td className="p-4 align-middle">{u.first_name} {u.last_name}</td>
                                        <td className="p-4 align-middle">{u.email}</td>
                                        <td className="p-4 align-middle">
                                            <Badge variant="secondary" className="capitalize">
                                                {u.role}
                                            </Badge>
                                        </td>
                                        <td className="p-4 align-middle">
                                            {u.status ? (
                                                <Badge className="bg-emerald-600 hover:bg-emerald-600/90">
                                                    Active
                                                </Badge>
                                            ) : (
                                                <Badge variant="destructive">
                                                    Inactive
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="p-4 align-middle">
                                            <div className="flex items-center justify-end">
                                                <Button
                                                    type="button"
                                                    className={customCss.button + " h-8 w-8"}
                                                    onClick={() => { 
                                                        setSelected(u)
                                                        setEditOpen(true) 
                                                    }}
                                                >
                                                    <Edit className="" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex items-center justify-between text-sm">
                <div className="text-muted-foreground">
                    Page {page} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        className={customCss.buttonOutline}
                        onClick={() => canPrev && setPage(page - 1)}
                        disabled={!canPrev || !!loading}
                    >
                        Prev
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        className={customCss.buttonOutline}
                        onClick={() => canNext && setPage(page + 1)}
                        disabled={!canNext || !!loading}
                    >
                        Next
                    </Button>
                </div>
            </div>

            <CreateUserModal
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                onCreated={() => void refresh()}
            />
            {selected && (
                <EditUserModal
                    open={editOpen}
                    onClose={() => setEditOpen(false)}
                    onUpdated={() => void refresh()}
                    user={selected}
                />
            )}
        </div>
    )
}