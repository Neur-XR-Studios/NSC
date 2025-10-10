export type PaginatedResult<T = unknown> = {
  items: T[]
  total: number
  page: number
  limit: number
}

export type ApiEnvelope<D = unknown> = {
  status: boolean
  code: number
  message?: string
  data?: D
}
