import { usePaginatedList } from "@/hooks/usePaginatedList";
import api from "@/lib/axios";
import type { ApiEnvelope } from "@/types/pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { customCss } from "@/lib/customCss";
import { useState } from "react";
import { EyeIcon } from "lucide-react";

type SessionLogItem = {
  id: string;
  session_id: string;
  event: string;
  journey_id?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  duration_ms?: string | number | null;
  vr_device_id?: string | null;
  position_ms?: string | number | null;
  error_code?: string | null;
  error_message?: string | null;
  createdAt?: string;
  updatedAt?: string;
  details?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export default function Sessions() {
  const fetcher = async (
    filters: Record<string, unknown>,
  ): Promise<ApiEnvelope<{ total?: number; page?: number; limit?: number; data?: SessionLogItem[] }>> => {
    const page = (filters?.page as number) ?? 1;
    const limit = (filters?.limit as number) ?? 10;
    const search = (filters?.search as string) ?? "";
    return api.get("/session-logs", { page, limit, search });
  };

  const { items, page, totalPages, loading, search, setSearch, setPage, refresh } = usePaginatedList<SessionLogItem>(
    "session-logs",
    fetcher,
    { page: 1, limit: 10, search: "" },
  );

  const canPrev = page > 1;
  const canNext = page < totalPages;

  const fmtDateTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : "-");
  const fmtMs = (ms?: string | number | null) => {
    const n = Number(ms ?? 0);
    if (!isFinite(n) || n <= 0) return "0:00";
    const s = Math.floor(n / 1000);
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${mm}:${String(ss).padStart(2, "0")}`;
  };

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SessionLogItem | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Input
          placeholder="Search session or event"
          className={`!w-[400px] ${customCss.input}`}
          onChange={(e) => setSearch(e.target.value)}
          value={search}
          onKeyDown={(e) => {
            if (e.key === "Enter") void refresh();
          }}
        />
        <div className="flex items-center gap-2" />
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/50">
              <tr className="border-b border-border">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">#</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Session ID</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Journey ID</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">VR Device ID</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Start Time</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">End Time</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Duration (ms)</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!items.length && !loading ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    No session logs found.
                  </td>
                </tr>
              ) : (
                items.map((it, i) => (
                  <tr key={it.id}>
                    <td className="p-4 align-middle">{i + 1}</td>
                    <td className="p-4 align-middle">{it.session_id}</td>
                    <td className="p-4 align-middle">{it.journey_id ?? "-"}</td>
                    <td className="p-4 align-middle">{it.vr_device_id ?? "-"}</td>
                    <td className="p-4 align-middle">{fmtDateTime(it.start_time)}</td>
                    <td className="p-4 align-middle">{fmtDateTime(it.end_time)}</td>
                    <td className="p-4 align-middle">{fmtMs(it.duration_ms)}</td>
                    <td className="p-4 align-middle">
                      <Button
                        type="button"
                        className={customCss.button + " p-2 !h-8"}
                        onClick={() => {
                          setSelected(it);
                          setOpen(true);
                        }}
                        title="View details"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </Button>
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

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setSelected(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Session Log</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground">ID</div>
              <div className="font-medium break-all">{selected?.id}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Session ID</div>
              <div className="font-medium break-all">{selected?.session_id}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Event</div>
              <div className="font-medium">{selected?.event}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Journey ID</div>
              <div className="font-medium">{selected?.journey_id ?? "-"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">VR Device ID</div>
              <div className="font-medium break-all">{selected?.vr_device_id ?? "-"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Position</div>
              <div className="font-medium">{fmtMs(selected?.position_ms)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Start Time</div>
              <div className="font-medium">{fmtDateTime(selected?.start_time)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">End Time</div>
              <div className="font-medium">{fmtDateTime(selected?.end_time)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Duration</div>
              <div className="font-medium">{fmtMs(selected?.duration_ms)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Error</div>
              <div className="font-medium">
                {selected?.error_code && selected?.error_code !== "NONE" ? selected?.error_code : "-"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Created</div>
              <div className="font-medium">{fmtDateTime(selected?.createdAt)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Updated</div>
              <div className="font-medium">{fmtDateTime(selected?.updatedAt)}</div>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-muted-foreground text-xs mb-1">Details</div>
            <pre className="bg-zinc-900/40 border border-border rounded p-2 text-xs whitespace-pre-wrap break-all">
              {selected?.details ? JSON.stringify(selected.details, null, 2) : "-"}
            </pre>
          </div>
          <div className="mt-3">
            <div className="text-muted-foreground text-xs mb-1">Metadata</div>
            <pre className="bg-zinc-900/40 border border-border rounded p-2 text-xs whitespace-pre-wrap break-all">
              {selected?.metadata ? JSON.stringify(selected.metadata, null, 2) : "-"}
            </pre>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" className={customCss.buttonOutline} onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
