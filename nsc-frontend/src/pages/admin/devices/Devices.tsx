import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { customCss } from "@/lib/customCss";
import { CreatePairingCodeModal } from "@/components/modals/CreatePairingCodeModal";
import { Eye } from "lucide-react";

type DeviceItem = {
  id: string;
  code: string;
  deviceId: string;
  name: string;
  registeredAt: string;
  metadata?: string | null;
  lastSeenAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type DevicesResponse = {
  status: boolean;
  data: {
    vr: DeviceItem[];
    chairs: DeviceItem[];
  };
};

type MetadataModalProps = {
  open: boolean;
  onClose: () => void;
  metadata: string | null | undefined;
  deviceName: string;
};

function MetadataModal({ open, onClose, metadata, deviceName }: MetadataModalProps) {
  const parsedMetadata = useMemo(() => {
    if (!metadata) return null;
    try {
      return metadata;
    } catch {
      return null;
    }
  }, [metadata]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Metadata - {deviceName}</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {!parsedMetadata ? (
            <p className="text-muted-foreground text-center py-8">No metadata available</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(parsedMetadata).map(([key, value]) => (
                <div key={key} className="rounded-lg border border-border p-4 bg-zinc-900/20">
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{key}</span>
                    <span className="text-base break-all font-mono">
                      {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Devices() {
  const [search, setSearch] = useState("");
  const [metadataModal, setMetadataModal] = useState<{
    open: boolean;
    metadata?: string | null;
    deviceName: string;
  }>({
    open: false,
    metadata: null,
    deviceName: "",
  });

  const { data, isFetching, refetch } = useQuery<DevicesResponse, Error>({
    queryKey: ["devices"],
    queryFn: async () => api.get("/devices"),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const vr = data?.data?.vr ?? [];
  const chairs = data?.data?.chairs ?? [];

  const vrFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vr;
    return vr.filter((d) => [d.name, d.deviceId, d.code].some((v) => (v || "").toLowerCase().includes(q)));
  }, [vr, search]);

  const chairFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return chairs;
    return chairs.filter((d) => [d.name, d.deviceId, d.code].some((v) => (v || "").toLowerCase().includes(q)));
  }, [chairs, search]);

  const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString() : "—");

  const [pairOpen, setPairOpen] = useState(false);

  const openMetadataModal = (metadata: string | null | undefined, deviceName: string) => {
    setMetadataModal({ open: true, metadata, deviceName });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <Input
          placeholder="Search by name / deviceId / code"
          className={`!w-[400px] ${customCss.input}`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void refetch();
          }}
        />
        <div className="flex items-center gap-2">
          <Button className={customCss.buttonOutline} onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing…" : "Refresh"}
          </Button>
          <Button className={customCss.button} onClick={() => setPairOpen(true)} disabled={isFetching}>
            Generate Code
          </Button>
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">VR Devices</h3>
          <Badge variant="secondary">{vrFiltered.length}</Badge>
        </div>
        <div className="rounded-md border border-border overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/50">
                <tr className="border-b border-border">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">ID</th>

                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Registered</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Last Seen</th>
                  <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {!vrFiltered.length ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No VR devices found.
                    </td>
                  </tr>
                ) : (
                  vrFiltered.map((d) => (
                    <tr key={d.id} className="border-b border-border hover:bg-zinc-900/20 transition-colors">
                      <td className="p-4 align-middle">{d.id}</td>

                      <td className="p-4 align-middle">{fmt(d.registeredAt)}</td>
                      <td className="p-4 align-middle">{fmt(d.lastSeenAt)}</td>
                      <td className="p-4 align-middle text-center">
                        <Button
                          className={customCss.button + " h-8 w-8"}
                          onClick={() => openMetadataModal(d.metadata, d.name)}
                        >
                          <Eye />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Chairs</h3>
          <Badge variant="secondary">{chairFiltered.length}</Badge>
        </div>
        <div className="rounded-md border border-border overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/50">
              <tr className="border-b border-border">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">ID</th>

                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Registered</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Last Seen</th>
                  <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {!chairFiltered.length ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No chairs found.
                    </td>
                  </tr>
                ) : (
                  chairFiltered.map((d) => (
                    <tr key={d.id} className="border-b border-border hover:bg-zinc-900/20 transition-colors">
                      <td className="p-4 align-middle">{d.id}</td>
                      <td className="p-4 align-middle">{fmt(d.registeredAt)}</td>
                      <td className="p-4 align-middle">{fmt(d.lastSeenAt)}</td>
                      <td className="p-4 align-middle text-center">
                        <Button
                          onClick={() => openMetadataModal(d.metadata, d.name)}
                          className={customCss.button + " h-8 w-8"}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <CreatePairingCodeModal open={pairOpen} onClose={() => setPairOpen(false)} />
      <MetadataModal
        open={metadataModal.open}
        onClose={() => setMetadataModal({ open: false, metadata: null, deviceName: "" })}
        metadata={metadataModal.metadata}
        deviceName={metadataModal.deviceName}
      />
    </div>
  );
}
