import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { customCss } from "@/lib/customCss";
import { useState } from "react";
import api from "@/lib/axios";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import type { ApiEnvelope } from "@/types/pagination";
import type { JourneyItem } from "@/types/journey";
import { ViewJourneyModal } from "@/components/modals/ViewJourneyModal";
import { Edit, Eye, Trash2 } from "lucide-react";
import { CreateAssetModal } from "@/components/modals/CreateAssetModal";
import { EditAssetModal } from "@/components/modals/EditAssetModal";
import { useUIStore } from "@/store/ui";
import { deleteJourney } from "@/lib/journeys";
import { toast } from "sonner";

export default function Assets() {
    const [open, setOpen] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [selected, setSelected] = useState<JourneyItem | null>(null)
    const [editOpen, setEditOpen] = useState(false)
    const { resetPage, clearAll } = useUIStore()

    // Generic fetcher aligned to API envelope
    const fetcher = async (filters: Record<string, unknown>): Promise<ApiEnvelope<{ total?: number; page?: number; limit?: number; data?: JourneyItem[] }>> => {
        return api.get('/journeys', filters)
    }

    const { items, page, totalPages, loading, search, setSearch, setPage, refresh } = usePaginatedList<JourneyItem>(
        'assets',
        fetcher,
        { page: 1, limit: 10, search: '' }
    )
    const canPrev = page > 1
    const canNext = page < totalPages

    const handleDelete = async (item: JourneyItem) => {
        const journeyId = item.journey?.id;
        if (!journeyId) {
            toast.error("Journey ID not found");
            return;
        }

        const title = item.journey?.title || "this journey";
        const confirmed = window.confirm(
            `⚠️ Delete "${title}"?\n\nThis will permanently delete:\n• Journey record\n• Video file and thumbnail\n• All audio tracks\n• Telemetry file\n\nThis action cannot be undone!`
        );

        if (!confirmed) return;

        try {
            await deleteJourney(journeyId);
            toast.success("Journey deleted successfully");
            void refresh();
        } catch (error: unknown) {
            console.error("Delete error:", error);
            const errorMessage = error && typeof error === 'object' && 'message' in error 
                ? String(error.message) 
                : "Failed to delete journey";
            toast.error(errorMessage);
        }
    };

    return (

        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
                <Input
                    placeholder="Search Asset name, video name, etc."
                    className={`!w-[400px] ${customCss.input}`}
                    onChange={(e) => setSearch(e.target.value)}
                    value={search}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') void refresh()
                    }}
                />
                <div className="flex items-center gap-2">
                    <Button variant="default" className={customCss.button} onClick={() => setCreateOpen(true)}>Add Asset</Button>
                </div>
            </div>

            {/* Cards grid */}
            {(() => {
                if (!items.length) {
                    return (
                        <div className="text-sm text-muted-foreground">No results found.</div>
                    )
                }
                return (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 h-[calc(100vh-15rem)] overflow-y-auto">
                        {items.map((it, idx) => {
                            const thumb = it.video?.thumbnail_url
                            const title = it.journey?.title || it.video?.title
                            const desc = it.journey?.description || it.video?.description || '—'
                            const duration = it.video?.duration_ms ? Math.round((it.video.duration_ms || 0) / 1000) : null
                            return (
                                <div
                                    key={idx}
                                    className="group h-fit relative rounded-lg border border-border bg-[hsl(var(--background))] shadow-sm hover:shadow-lg transition-shadow"
                                >
                                    <div className="relative h-40 w-full bg-muted overflow-hidden rounded-[10px]">
                                        {thumb ? (
                                            <img src={thumb} alt={title ?? 'thumbnail'} className="h-full w-full object-cover rounded-t-[10px]" />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center text-muted-foreground">No Image</div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-90" />
                                        {duration !== null && (
                                            <span className="absolute bottom-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-black/70 text-white">
                                                {duration}s
                                            </span>
                                        )}
                                    </div>
                                    <div className="p-3 flex flex-col gap-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="font-semibold line-clamp-1">{title}</div>
                                            {it.languages?.length ? (
                                                <div className="flex gap-1">
                                                    {it.languages.slice(0, 2).map((lng) => (
                                                        <span key={lng} className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-500">{lng}</span>
                                                    ))}
                                                    {it.languages.length > 2 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">+{it.languages.length - 2}</span>
                                                    )}
                                                </div>
                                            ) : null}
                                        </div>
                                        <div className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">{desc}</div>
                                        <div className="flex items-center justify-end gap-2 pt-1">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className={customCss.buttonOutline + ' h-8 w-8'}
                                                onClick={() => { setSelected(it); setOpen(true) }}
                                            >
                                                <Eye />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className={customCss.buttonOutline + ' h-8 w-8'}
                                                onClick={() => { setSelected(it); setEditOpen(true) }}
                                            >
                                                <Edit />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className={customCss.buttonOutline + ' h-8 w-8 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500'}
                                                onClick={() => handleDelete(it)}
                                            >
                                                <Trash2 />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )
            })()}

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
            <ViewJourneyModal open={open} onClose={() => setOpen(false)} item={selected} />
            <CreateAssetModal
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                onCreated={() => {
                    void refresh()
                    resetPage('assets')
                    clearAll()
                }}
            />
            {selected?.journey?.id != null && (
                <EditAssetModal
                    open={editOpen}
                    onClose={() => setEditOpen(false)}
                    onUpdated={() => void refresh()}
                    id={selected.journey.id}
                    item={selected}
                />
            )}
        </div>
    )
}