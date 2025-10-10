import { useEffect, useMemo } from 'react'
import { useUIStore } from '@/store/ui'
import type { ApiEnvelope, PaginatedResult } from '@/types/pagination'
import type { PagePrefs } from '@/store/ui'
import { useQuery } from '@tanstack/react-query'

export type FetcherResult<T> = ApiEnvelope<{
  total?: number
  page?: number
  limit?: number
  data?: T[]
}>

export type Fetcher<T> = (filters: Record<string, unknown>) => Promise<FetcherResult<T>>

export function usePaginatedList<T>(
  pageKey: string,
  fetcher: Fetcher<T>,
  defaults: { page?: number; limit?: number; search?: string } = { page: 1, limit: 10, search: '' }
) {
  const setFilters = useUIStore((s) => s.setFilters)
  const updateFilters = useUIStore((s) => s.updateFilters)

  // Subscribe to reactive slice so changes rerender the hook's consumer
  const pageSlice = useUIStore((s) => (s.pages?.[pageKey] as PagePrefs | undefined))
  const filters = (pageSlice?.filters ?? {}) as Record<string, unknown>
  const search = (filters?.search as string) ?? ''
  // React Query: fetch list based on current filters
  const { data: rqData, isFetching, refetch } = useQuery<PaginatedResult<T>, Error, PaginatedResult<T>, [string, string, Record<string, unknown>]>({
    queryKey: ['list', pageKey, filters],
    queryFn: async () => {
      const res = await fetcher(filters)
      const body = res?.data ?? { total: 0, page: 1, limit: 10, data: [] }
      const mapped: PaginatedResult<T> = {
        total: typeof body.total === 'number' ? body.total : 0,
        page: typeof body.page === 'number' ? body.page : page,
        limit: typeof body.limit === 'number' ? body.limit : limit,
        items: Array.isArray(body.data) ? (body.data as T[]) : [],
      }
      return mapped
    },
    placeholderData: (prev) => prev, // keep previous between filter changes
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  // Initialize defaults once
  useEffect(() => {
    if (!filters || Object.keys(filters).length === 0) {
      setFilters(pageKey, { page: defaults.page ?? 1, limit: defaults.limit ?? 10, search: defaults.search ?? '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const page = (filters?.page as number) ?? defaults.page ?? 1
  const limit = (filters?.limit as number) ?? defaults.limit ?? 10

  const total: number = useMemo(() => rqData?.total ?? 0, [rqData])

  const items = useMemo(() => (rqData?.items ?? []) as T[], [rqData])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  async function refresh() {
    await refetch()
  }

  // Convenience setters
  const setSearch = (search: string) => updateFilters(pageKey, { search, page: 1 })
  const setPage = (next: number) => updateFilters(pageKey, { page: next })
  const setLimit = (next: number) => updateFilters(pageKey, { limit: next, page: 1 })

  return {
    filters,
    search,
    items,
    total,
    page,
    limit,
    totalPages,
    loading: isFetching,
    refresh,
    setSearch,
    setPage,
    setLimit,
  }
}
