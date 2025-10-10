import React, { useEffect, useMemo, useState } from 'react'
import { Copy } from 'lucide-react'

interface JsonViewerProps {
  url: string
  className?: string
  height?: number | string
  title?: string
  extra?: React.ReactNode
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ url, className, height = 320, title = 'Telemetry.json', extra }) => {
  const [data, setData] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let mounted = true
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (mounted) setData(json)
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Failed to load JSON')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => {
      mounted = false
    }
  }, [url])

  const pretty = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return ''
    }
  }, [data])

  const lines = useMemo(() => (pretty ? pretty.split('\n') : []), [pretty])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pretty)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // ignore
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between px-2 py-1 text-xs border border-border border-b-0 rounded-t-md bg-zinc-900/60">
        <div className="text-muted-foreground">{title}</div>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200">
          <Copy size={12} /> {copied ? 'Copied' : 'Copy'}
        </button>
        {extra}
      </div>
      <div style={{ height, overflow: 'auto' }} className="rounded-b-md border border-border bg-zinc-950">
        {loading && <div className="p-3 text-xs text-muted-foreground">Loading JSON…</div>}
        {error && <div className="p-3 text-xs text-red-400">Error: {error}</div>}
        {!loading && !error && (
          <pre className="p-3 text-xs leading-relaxed text-zinc-200 grid" style={{ gridTemplateColumns: 'auto 1fr' }}>
            <code className="pr-3 text-zinc-500 select-none">
              {lines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </code>
            <code>
              {lines.map((ln, i) => (
                <div key={i}>{ln}</div>
              ))}
            </code>
          </pre>
        )}
      </div>
    </div>
  )
}
