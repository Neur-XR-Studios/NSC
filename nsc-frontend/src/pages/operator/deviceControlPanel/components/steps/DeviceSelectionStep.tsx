import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Monitor, Armchair, Plus, Wifi, WifiOff, RefreshCw, PlugZap } from "lucide-react";
import type { SessionType } from "@/lib/sessions";
import { getDevicePairs, type DevicePair } from "@/lib/devicePairs";
import { CreatePairingCodeModal } from "@/components/modals/CreatePairingCodeModal";
import { useToast } from "@/hooks/use-toast";
import { customCss } from "@/lib/customCss";

type Device = {
  id: string;
  type: "vr" | "chair" | "unknown";
  name: string;
  online: boolean;
  lastSeen?: number;
  status?: string;
};

// Local enriched type with required online flags
type EnrichedPair = DevicePair & {
  vrOnline: boolean;
  chairOnline: boolean;
  bothOnline: boolean;
};

type Pair = {
  sessionId: string;
  vrId: string;
  chairId: string;
  journeyId?: number[];
};

type Props = {
  sessionType: SessionType | null;
  vrDevices: Device[];
  chairDevices: Device[];
  pairedVrIds: Set<string>;
  pairedChairIds: Set<string>;
  selectedVrId: string;
  selectedChairId: string;
  setSelectedVrId: (id: string) => void;
  setSelectedChairId: (id: string) => void;
  pairs: Pair[];
  setPairs: (updater: (prev: Pair[]) => Pair[]) => void;
  onBack: () => void;
  onContinue: () => void;
};

export default function DeviceSelectionStep({
  sessionType,
  vrDevices,
  chairDevices,
  // pairedVrIds: _pairedVrIds,
  // pairedChairIds: _pairedChairIds,
  // selectedVrId: _selectedVrId,
  // selectedChairId: _selectedChairId,
  // setSelectedVrId: _setSelectedVrId,
  // setSelectedChairId: _setSelectedChairId,
  // pairs: _pairs,
  setPairs,
  onBack,
  onContinue,
}: Props) {
  const { toast } = useToast();
  const [showOnlineOnly] = useState(true);
  const [devicePairs, setDevicePairs] = useState<EnrichedPair[]>([]);
  const [selectedPairIds, setSelectedPairIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [pairingModalOpen, setPairingModalOpen] = useState(false);
  const [repairTargetId, setRepairTargetId] = useState<string | null>(null);

  // Helper to check if device is online from real-time device list
  const isDeviceOnlineRealtime = (deviceId: string, type: 'vr' | 'chair') => {
    const deviceList = type === 'vr' ? vrDevices : chairDevices;
    const device = deviceList.find(d => d.id === deviceId);
    return device?.online || false;
  };

  // Load device pairs from backend
  const loadDevicePairs = async () => {
    setLoading(true);
    try {
      const result = await getDevicePairs(false);
      const list: DevicePair[] = Array.isArray(result?.data)
        ? (result.data as DevicePair[])
        : [];

      console.log("Device pairs:", list);
      // Enrich pairs with online status from real-time device data
      const enrichedPairs: EnrichedPair[] = list.map((pair) => {
        // First try real-time status, fallback to lastSeenAt
        const vrOnline = isDeviceOnlineRealtime(pair.vr_device_id, 'vr') || isDeviceOnline(pair.vr?.lastSeenAt);
        const chairOnline = isDeviceOnlineRealtime(pair.chair_device_id, 'chair') || isDeviceOnline(pair.chair?.lastSeenAt);
        return {
          ...pair,
          vrOnline,
          chairOnline,
          bothOnline: vrOnline && chairOnline,
        };
      });

      setDevicePairs(enrichedPairs);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to load device pairs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDevicePairs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-enrich pairs when real-time device status changes
  useEffect(() => {
    if (devicePairs.length === 0) return;
    
    const enrichedPairs: EnrichedPair[] = devicePairs.map((pair) => {
      const vrOnline = isDeviceOnlineRealtime(pair.vr_device_id, 'vr') || isDeviceOnline(pair.vr?.lastSeenAt);
      const chairOnline = isDeviceOnlineRealtime(pair.chair_device_id, 'chair') || isDeviceOnline(pair.chair?.lastSeenAt);
      return {
        ...pair,
        vrOnline,
        chairOnline,
        bothOnline: vrOnline && chairOnline,
      };
    });

    setDevicePairs(enrichedPairs);
    
  }, [vrDevices, chairDevices]);

  // Filter pairs based on online status
  const filteredPairs = useMemo(() => {
    if (showOnlineOnly) {
      return devicePairs.filter((pair) => !!pair.bothOnline);
    }
    return devicePairs;
  }, [devicePairs, showOnlineOnly]);

  // Helper to check if device is online based on lastSeenAt
  const isDeviceOnline = (lastSeenAt?: string) => {
    if (!lastSeenAt) return false;
    const threshold = 60 * 1000; // 60 seconds - increased from 30s to prevent blinking (backend timeout is 45s)
    return Date.now() - new Date(lastSeenAt).getTime() < threshold;
  };

  // Toggle pair selection
  const togglePairSelection = (pairId: string, bothOnline: boolean) => {
    if (!bothOnline) {
      toast({
        title: "Cannot select pair",
        description: "Both VR and Chair must be online to select this pair",
        variant: "destructive",
      });
      return;
    }

    setSelectedPairIds((prev) => {
      const next = new Set(prev);
      if (next.has(pairId)) {
        next.delete(pairId);
      } else {
        next.add(pairId);
      }
      return next;
    });
  };

  // Sync selected pairs to parent component's pairs state
  useEffect(() => {
    const selectedPairs = devicePairs
      .filter((pair) => selectedPairIds.has(pair.id))
      .map((pair) => ({
        sessionId: "",
        vrId: pair.vr_device_id,
        chairId: pair.chair_device_id,
        journeyId: [],
      }));

    setPairs(() => selectedPairs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPairIds, devicePairs]);

  const canContinue = useMemo(() => {
    if (sessionType === "individual") {
      return selectedPairIds.size > 0;
    }
    // Allow proceeding to Journey Selection with at least one pair selected
    return selectedPairIds.size > 0;
  }, [sessionType, selectedPairIds]);

  const handleOpenNewPair = () => {
    setRepairTargetId(null);
    setPairingModalOpen(true);
  };

  const handleOpenRepair = (pairId: string) => {
    setRepairTargetId(pairId);
    setPairingModalOpen(true);
  };

  const handlePairingComplete = () => {
    void loadDevicePairs();
  };

  return (
    <>
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold">
            {sessionType === "individual"
              ? "Select Device Pairs (Individual Session)"
              : "Select Device Pairs (Group Session)"}
          </CardTitle>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => void loadDevicePairs()}
              disabled={loading}
              className={customCss.buttonOutline}
              size="sm"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
            <Button onClick={handleOpenNewPair} disabled={loading} className={customCss.button} size="sm">
              <Plus className="w-4 h-4" />
              Pair New Station
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Instructions */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-900 dark:text-blue-100">
            {sessionType === "individual"
              ? "Select one or more pre-configured device pairs. Each pair can choose their own journey. Only pairs with both devices online can be selected."
              : "Select multiple pre-configured device pairs. All pairs will play the same journey(s) in sync. Only pairs with both devices online can be selected."}
          </p>
        </div>

        {/* Device Pairs Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredPairs.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground text-lg mb-4">
              {showOnlineOnly ? "No online device pairs found" : "No device pairs created yet"}
            </p>
            <Button onClick={handleOpenNewPair} className={customCss.button}>
              Create Your First Pair
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPairs.map((pair) => {
              const isSelected = selectedPairIds.has(pair.id);
              const canSelect: boolean = !!pair.bothOnline;

              return (
                <Card
                  key={pair.id}
                  className={`p-4 cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-2 ring-primary"
                      : canSelect
                      ? "hover:border-primary/50"
                      : "opacity-50 cursor-not-allowed"
                  }`}
                  onClick={() => togglePairSelection(pair.id, canSelect)}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{pair.pair_name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {pair.bothOnline ? (
                            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                              <Wifi className="w-3 h-3" />
                              Both Online
                            </span>
                          ) : pair.vrOnline || pair.chairOnline ? (
                            <span className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                              <Wifi className="w-3 h-3" />
                              Partially Online
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <WifiOff className="w-3 h-3" />
                              Offline
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {isSelected && <Check className="w-5 h-5 text-primary" />}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenRepair(pair.id);
                          }}
                          className="h-8 w-8 p-0"
                          title="Re-pair (update devices)"
                        >
                          <PlugZap className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Monitor className={`w-4 h-4 ${pair.vrOnline ? "text-green-500" : "text-gray-400"}`} />
                        <div className="flex-1 text-sm">
                          <div className="font-medium">VR: {pair.vr?.display_name || pair.vr?.id || "N/A"}</div>
                          <div className="text-xs text-muted-foreground truncate">{pair.vr?.id}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Armchair className={`w-4 h-4 ${pair.chairOnline ? "text-green-500" : "text-gray-400"}`} />
                        <div className="flex-1 text-sm">
                          <div className="font-medium">Chair: {pair.chair?.display_name || pair.chair?.id || "N/A"}</div>
                          <div className="text-xs text-muted-foreground truncate">{pair.chair?.id}</div>
                        </div>
                      </div>
                    </div>

                    {pair.notes && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">{pair.notes}</p>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Selected Pairs Summary */}
        {selectedPairIds.size > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Selected Pairs ({selectedPairIds.size})</h3>
            <div className="text-sm text-muted-foreground">
              {Array.from(selectedPairIds)
                .map((pairId) => {
                  const pair = devicePairs.find((p) => p.id === pairId);
                  return pair ? pair.pair_name : pairId;
                })
                .join(", ")}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack} className={customCss.buttonOutline}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Button onClick={onContinue} disabled={!canContinue} className={customCss.button}>
            Continue
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>

    {/* Pairing Modal */}
    <CreatePairingCodeModal
      open={pairingModalOpen}
      onClose={() => {
        setPairingModalOpen(false);
        setRepairTargetId(null);
      }}
      targetPairId={repairTargetId}
      onCompleted={handlePairingComplete}
    />
    </>
  );
}
