import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PagePrefs {
  tab?: string
  // Arbitrary filter bag per page. Keep values serializable.
  filters: Record<string, unknown>
  data: Record<string, unknown>
  loading: boolean
}

interface UIState {
  // Keyed by a stable page identifier (e.g., route path like "/admin/assets")
  pages: Record<string, PagePrefs>

  // Setters
  setTab: (page: string, tab: string | undefined) => void
  setFilters: (page: string, filters: Record<string, unknown>) => void
  updateFilters: (page: string, patch: Record<string, unknown>) => void
  setData: (page: string, data: Record<string, unknown>) => void
  setLoading: (page: string, loading: boolean) => void

  // Getters
  getTab: (page: string) => string | undefined
  getFilters: (page: string) => Record<string, unknown>
  getData: (page: string) => Record<string, unknown>
  getLoading: (page: string) => boolean

  // Resets
  resetPage: (page: string) => void
  clearAll: () => void
}

const emptyPrefs: PagePrefs = { filters: {}, data: {}, loading: false }

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      pages: {},

      setTab(page, tab) {
        set((state) => ({
          pages: {
            ...state.pages,
            [page]: { ...(state.pages[page] ?? emptyPrefs), tab },
          },
        }))
      },

      setFilters(page, filters) {
        set((state) => ({
          pages: {
            ...state.pages,
            [page]: { ...(state.pages[page] ?? emptyPrefs), filters },
          },
        }))
      },

      updateFilters(page, patch) {
        set((state) => {
          const prev = state.pages[page]?.filters ?? {}
          return {
            pages: {
              ...state.pages,
              [page]: { ...(state.pages[page] ?? emptyPrefs), filters: { ...prev, ...patch } },
            },
          }
        })
      },

      setData(page, data) {
        set((state) => ({
          pages: {
            ...state.pages,
            [page]: { ...(state.pages[page] ?? emptyPrefs), data },
          },
        }))
      },

      setLoading(page, loading) {
        set((state) => ({
          pages: {
            ...state.pages,
            [page]: { ...(state.pages[page] ?? emptyPrefs), loading },
          },
        }))
      },

      getTab(page) {
        return get().pages[page]?.tab
      },

      getFilters(page) {
        return (get().pages[page]?.filters ?? {}) as Record<string, unknown>
      },

      getData(page) {
        return (get().pages[page]?.data ?? {}) as Record<string, unknown>
      },

      getLoading(page) {
        return get().pages[page]?.loading
      },

      resetPage(page) {
        set((state) => {
          const next = { ...state.pages }
          delete next[page]
          return { pages: next }
        })
      },

      clearAll() {
        set({ pages: {} })
      },
    }),
    {
      name: 'ui-store',
      partialize: (state) => ({ pages: state.pages }),
    }
  )
)
