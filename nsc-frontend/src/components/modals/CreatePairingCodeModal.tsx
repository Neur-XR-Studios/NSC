import React from "react";
import { CustomDialog } from "@/components/ui/CustomDialog";
import { Button } from "@/components/ui/button";
import api from "@/lib/axios";
import { useToast } from "@/hooks/use-toast";
import { Clock, CheckCircle2, XCircle, X } from "lucide-react";
import { customCss } from "@/lib/customCss";
import { realtime } from "@/lib/realtime";

type PairType = "vr" | "chair";

interface CreatePairingCodeModalProps {
  open: boolean;
  onClose: () => void;
  targetPairId?: string | null;
  onCompleted?: (pair: any) => void;
}

export const CreatePairingCodeModal: React.FC<CreatePairingCodeModalProps> = ({
  open,
  onClose,
  targetPairId = null,
  onCompleted,
}) => {
  const { toast } = useToast();
  const [type, setType] = React.useState<PairType>("vr");
  const [pairBoth, setPairBoth] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [code, setCode] = React.useState<string | null>(null);
  const [expiresAt, setExpiresAt] = React.useState<string | null>(null);
  const [expired, setExpired] = React.useState(false);
  const [now, setNow] = React.useState<number>(Date.now());
  const [progress, setProgress] = React.useState<{ vr?: string; chair?: string } | null>(null);
  const [completedPair, setCompletedPair] = React.useState<any | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setType("vr");
    setPairBoth(true);
    setLoading(false);
    setCode(null);
    setExpiresAt(null);
    setExpired(false);
    setNow(Date.now());
    setProgress(null);
    setCompletedPair(null);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open]);

  const remainingMs = React.useMemo(() => {
    if (!expiresAt) return 0;
    const end = new Date(expiresAt).getTime();
    return Math.max(0, end - now);
  }, [expiresAt, now]);

  React.useEffect(() => {
    if (expiresAt && remainingMs === 0 && code) {
      setExpired(true);
    }
  }, [expiresAt, remainingMs, code]);

  const mmss = (ms: number) => {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(m)}:${pad(s)}`;
  };

  type PairingCodeResponse = {
    code?: string;
    expiresAt?: string;
  };

  async function generate() {
    setLoading(true);
    try {
      let data: PairingCodeResponse = {};
      const res = (await api.post("/devices/pairing-bundle", { target_pair_id: targetPairId || null })) as unknown as {
        data?: PairingCodeResponse;
      };
      data = res?.data || {};
      setCode(data.code ?? null);
      setExpiresAt(data.expiresAt ?? null);
      setExpired(false);
      if (!data.code || !data.expiresAt) {
        toast({ title: "Invalid response", description: "Missing code or expiresAt", variant: "destructive" });
      }
      // Reset live states
      setProgress(null);
      setCompletedPair(null);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      toast({
        title: "Error",
        description: e.response?.data?.message || e.message || "Failed to generate code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  // Listen for realtime pairing progress and completion when a bundle code is active
  React.useEffect(() => {
    if (!open || !code) return;
    // Attach bridge listeners
    const offProgress = realtime.onBridge("pairing:progress", (payload: any) => {
      if (!payload || (payload as any).code !== code) return;
      const p = payload as { vr_device_id?: string; chair_device_id?: string };
      setProgress({ vr: p.vr_device_id, chair: p.chair_device_id });
    });
    const offComplete = realtime.onBridge("pairing:complete", (payload: any) => {
      if (!payload || (payload as any).code !== code) return;
      const d = payload as { pair?: any };
      setCompletedPair(d?.pair || null);
      // Hide code upon completion
      setCode(null);
      setExpiresAt(null);
    });
    return () => {
      offProgress?.();
      offComplete?.();
    };
  }, [open, pairBoth, code]);

  // Polling fallback for bundle pairing status (in case realtime events are missed)
  React.useEffect(() => {
    if (!open || !pairBoth || !code) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = (await api.get(`/devices/pairing-bundle/${code}`)) as unknown as {
          data?: { bundle?: any; pair?: any };
        };
        const data = res?.data || {};
        if (data?.bundle) {
          setProgress({ vr: data.bundle.vr_device_id, chair: data.bundle.chair_device_id });
          if (data.bundle.completed && data.pair) {
            setCompletedPair(data.pair);
            setCode(null);
            setExpiresAt(null);
            return;
          }
        }
      } catch {
        // ignore
      }
      if (!stop) setTimeout(tick, 2000);
    };
    const id = setTimeout(tick, 1500);
    return () => {
      stop = true;
      clearTimeout(id);
    };
  }, [open, code]);

  const getProgressPercentage = () => {
    if (!expiresAt || expired) return 0;
    const start = new Date(expiresAt).getTime() - 5 * 60 * 1000; // Assuming 5 min validity
    const end = new Date(expiresAt).getTime();
    const total = end - start;
    const remaining = end - now;
    return Math.max(0, Math.min(100, (remaining / total) * 100));
  };

  if (!open) return null;

  return (
    <CustomDialog
      open={open}
      onClose={() => (!loading ? onClose() : undefined)}
      title={
        <div>
          <div className="font-semibold text-lg">Device Pairing</div>
          <div className="text-xs text-muted-foreground font-normal">Generate a secure pairing code</div>
        </div>
      }
      headerRight={
        <button
          type="button"
          onClick={onClose}
          className={`${customCss.buttonOutline} !h-8 !w-8 inline-flex items-center justify-center`}
        >
          <X />
        </button>
      }
    >
      <div className="space-y-6 py-2">
        {/* Type Selection */}
        {!code && (
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Bundle pairing code for VR + Chair
              {targetPairId ? " (Re-pair existing station)" : ""}
            </label>
          </div>
        )}

        {/* Generate Button */}
        {!code && (
          <div className="flex justify-end pt-2">
            <Button onClick={() => void generate()} disabled={loading} className={customCss.button}>
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </div>
              ) : (
                "Generate Code"
              )}
            </Button>
          </div>
        )}

        {/* Code Display */}
        {code && (
          <div className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center justify-center">
              <div
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                  expired
                    ? "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400"
                    : "bg-cyan-100 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-400"
                }`}
              >
                {expired ? (
                  <>
                    <XCircle className="w-4 h-4" />
                    Code Expired
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Active Code
                  </>
                )}
              </div>
            </div>

            {/* Code Display */}
            <div
              className={`relative p-8 rounded-2xl border-2 ${
                expired
                  ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20"
                  : "border-cyan-200 dark:border-cyan-900 bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-950/20 dark:to-teal-950/20"
              }`}
            >
              {!expired && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 rounded-t-2xl overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-teal-600 transition-all duration-1000 ease-linear"
                    style={{ width: `${getProgressPercentage()}%` }}
                  />
                </div>
              )}

              <div className="text-center space-y-3">
                <div
                  className={`text-sm font-medium ${
                    expired ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {expired ? "This code has expired" : "Enter this code on your VR and Chair devices"}
                </div>
                <div
                  className={`text-5xl font-bold tracking-[0.5em] font-mono ${
                    expired
                      ? "text-red-400 dark:text-red-500 line-through opacity-50"
                      : "text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-teal-600 dark:from-cyan-400 dark:to-teal-400"
                  }`}
                >
                  {code}
                </div>
              </div>
            </div>

            {/* Live bundle progress */}
            {pairBoth && progress && (
              <div className="rounded-xl border p-3 text-sm">
                <div className="font-medium mb-1">Pairing Progress</div>
                <div className="flex items-center justify-between">
                  <div>
                    VR:{" "}
                    <span className={`font-mono ${progress.vr ? "text-green-600" : "text-gray-400"}`}>
                      {progress.vr || "waiting..."}
                    </span>
                  </div>
                  <div>
                    Chair:{" "}
                    <span className={`font-mono ${progress.chair ? "text-green-600" : "text-gray-400"}`}>
                      {progress.chair || "waiting..."}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Timer */}
            <div
              className={`flex items-center justify-center gap-3 p-4 rounded-xl ${
                expired ? "bg-red-50 dark:bg-red-950/20" : "bg-cyan-50 dark:bg-cyan-950/20"
              }`}
            >
              <Clock className={`w-5 h-5 ${expired ? "text-red-500" : "text-cyan-500"}`} />
              <span
                className={`text-lg font-semibold font-mono ${
                  expired ? "text-red-600 dark:text-red-400" : "text-cyan-700 dark:text-cyan-400"
                }`}
              >
                {expired ? "00:00" : mmss(remainingMs)}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{expired ? "remaining" : "remaining"}</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCode(null);
                  setExpiresAt(null);
                  setExpired(false);
                  setProgress(null);
                  setCompletedPair(null);
                }}
                disabled={loading}
                className={customCss.buttonDestructive}
              >
                Clear
              </Button>
              <Button type="button" onClick={() => void generate()} disabled={loading} className={customCss.button}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </div>
                ) : (
                  "Generate New Code"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Completed Pair Summary */}
        {!code && completedPair && (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> Pairing Completed
              </div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-sm text-muted-foreground mb-2">Created Pair</div>
              <div className="text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span> {completedPair.pair_name}
                </div>
                <div>
                  <span className="text-muted-foreground">VR:</span>{" "}
                  <span className="font-mono">{completedPair.vr_device_id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Chair:</span>{" "}
                  <span className="font-mono">{completedPair.chair_device_id}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  onCompleted?.(completedPair);
                  onClose();
                }}
                className={customCss.button}
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </CustomDialog>
  );
};
