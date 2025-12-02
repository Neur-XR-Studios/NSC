import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getDevicePairs, getOnlineDevicePairs, deleteDevicePair, type DevicePair } from "@/lib/devicePairs";
import { Plus, Trash2, Wifi, WifiOff, Monitor, Armchair, RefreshCw, PlugZap } from "lucide-react";
import { CreatePairingCodeModal } from "@/components/modals/CreatePairingCodeModal";
import { customCss } from "@/lib/customCss";
import { realtime } from "@/lib/realtime";

export default function DevicePairManagement() {
  const { toast } = useToast();
  const [pairs, setPairs] = useState<DevicePair[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [bundleModalOpen, setBundleModalOpen] = useState(false);
  const [bundleTargetPairId, setBundleTargetPairId] = useState<string | null>(null);
  
  // Real-time online status tracking via MQTT
  const [onlineDeviceIds, setOnlineDeviceIds] = useState<Set<string>>(new Set());
  
  // MQTT message handler for real-time online status
  const handleMqttMessage = useCallback((msg: { destinationName: string; payloadString?: string }) => {
    const topic = msg.destinationName;
    const payload = msg.payloadString || "";
    
    try {
      // Handle device status updates
      if (topic.match(/^devices\/[^/]+\/status$/)) {
        const deviceId = topic.split("/")[1];
        const data = JSON.parse(payload);
        const isOnline = data.status !== "offline" && data.status !== "disconnected";
        
        setOnlineDeviceIds(prev => {
          const next = new Set(prev);
          if (isOnline) {
            next.add(deviceId);
          } else {
            next.delete(deviceId);
          }
          return next;
        });
      }
      
      // Handle heartbeats - device is online if sending heartbeats
      if (topic.match(/^devices\/[^/]+\/heartbeat$/)) {
        const deviceId = topic.split("/")[1];
        setOnlineDeviceIds(prev => {
          const next = new Set(prev);
          next.add(deviceId);
          return next;
        });
      }
      
      // Handle LWT (Last Will Testament) - device went offline
      if (topic.match(/^devices\/[^/]+\/lwt$/)) {
        const deviceId = topic.split("/")[1];
        if (payload.toLowerCase() === "offline") {
          setOnlineDeviceIds(prev => {
            const next = new Set(prev);
            next.delete(deviceId);
            return next;
          });
        }
      }
      
      // Handle device snapshot
      if (topic === "admin/devices/snapshot") {
        const devices = JSON.parse(payload) as Array<{ deviceId: string; online?: boolean }>;
        setOnlineDeviceIds(prev => {
          const next = new Set(prev);
          devices.forEach(d => {
            if (d.online === true) {
              next.add(d.deviceId);
            }
          });
          return next;
        });
      }
    } catch (e) {
      // Ignore parse errors
    }
  }, []);
  
  // Connect to MQTT for real-time updates
  useEffect(() => {
    const connectMqtt = async () => {
      try {
        const wsHost = window.location.hostname || "localhost";
        await realtime.connect({ url: `ws://${wsHost}:9001`, clientId: `admin-devices-${Date.now()}` });
        
        // Subscribe to device topics
        realtime.subscribe("devices/+/status", 1);
        realtime.subscribe("devices/+/heartbeat", 1);
        realtime.subscribe("devices/+/lwt", 1);
        realtime.subscribe("admin/devices/snapshot", 1);
        
        // Request snapshot
        realtime.publish("admin/devices/snapshot/request", "{}", false);
      } catch (e) {
        console.error("[DevicePairManagement] MQTT connect error:", e);
      }
    };
    
    realtime.onMessage(handleMqttMessage);
    void connectMqtt();
    
    return () => {
      // Cleanup handled by realtime singleton
    };
  }, [handleMqttMessage]);

  const loadPairs = async () => {
    setLoading(true);
    try {
      const result = showOnlineOnly ? await getOnlineDevicePairs() : await getDevicePairs(false);
      const list = Array.isArray(result?.data) ? result.data : [];
      setPairs(list);
      if (list.length === 0) {
        toast({
          title: "No pairs",
          description: showOnlineOnly ? "No online device pairs found" : "No device pairs found",
        });
      }
    } catch (error) {
      console.log(error);
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
    void loadPairs();
  }, [showOnlineOnly]);

  const handleDeletePair = async (pairId: string) => {
    if (!confirm("Are you sure you want to delete this device pair?")) return;

    try {
      const result = await deleteDevicePair(pairId);
      if (result.status) {
        toast({
          title: "Success",
          description: "Device pair deleted successfully",
        });
        void loadPairs();
      } else {
        toast({
          title: "Error",
          description: "Failed to delete device pair",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.log(error);
      toast({
        title: "Error",
        description: "Failed to delete device pair",
        variant: "destructive",
      });
    }
  };

  const openNewPairBundle = () => {
    setBundleTargetPairId(null);
    setBundleModalOpen(true);
  };

  const openRepairBundle = (pair: DevicePair) => {
    setBundleTargetPairId(pair.id);
    setBundleModalOpen(true);
  };

  // Check if device is online - prefer real-time MQTT status, fallback to lastSeenAt
  const isDeviceOnline = (deviceId?: string, lastSeenAt?: string) => {
    // First check real-time MQTT status
    if (deviceId && onlineDeviceIds.has(deviceId)) {
      return true;
    }
    // Fallback to lastSeenAt from database
    if (!lastSeenAt) return false;
    const threshold = 30 * 1000; // 30 seconds
    return Date.now() - new Date(lastSeenAt).getTime() < threshold;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>

        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => void loadPairs()} disabled={loading} className={customCss.buttonOutline}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
          <Button
            variant={showOnlineOnly ? "default" : "outline"}
            onClick={() => setShowOnlineOnly(!showOnlineOnly)}
            className={customCss.buttonOutline}
          >
            {showOnlineOnly ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {showOnlineOnly ? "Online Only" : "Show All"}
          </Button>
          <Button onClick={openNewPairBundle} disabled={loading} className={customCss.button}>
            <Plus className="w-4 h-4" />
            Pair New Station
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : pairs.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground text-lg mb-4">
            {showOnlineOnly ? "No online device pairs found" : "No device pairs created yet"}
          </p>
          <Button onClick={openNewPairBundle} className={customCss.button}>
            Create Your First Pair
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pairs.map((pair) => {
            const vrOnline = isDeviceOnline(pair.vr?.deviceId || pair.vr_device_id, pair.vr?.lastSeenAt);
            const chairOnline = isDeviceOnline(pair.chair?.deviceId || pair.chair_device_id, pair.chair?.lastSeenAt);
            const bothOnline = vrOnline && chairOnline;

            return (
              <Card key={pair.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{pair.pair_name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {bothOnline ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <Wifi className="w-3 h-3" />
                          Both Online
                        </span>
                      ) : vrOnline || chairOnline ? (
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
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openRepairBundle(pair)}
                      className="h-8 w-8 p-0"
                      title="Re-pair (update devices)"
                    >
                      <PlugZap className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleDeletePair(pair.id)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Monitor className={`w-4 h-4 ${vrOnline ? "text-green-500" : "text-gray-400"}`} />
                    <div className="flex-1 text-sm">
                      <div className="font-medium">VR: {pair.vr?.display_name || pair.vr?.id || "N/A"}</div>
                      <div className="text-xs text-muted-foreground">{pair.vr?.deviceId}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Armchair className={`w-4 h-4 ${chairOnline ? "text-green-500" : "text-gray-400"}`} />
                    <div className="flex-1 text-sm">
                      <div className="font-medium">Chair: {pair.chair?.display_name || pair.chair?.id || "N/A"}</div>
                      <div className="text-xs text-muted-foreground">{pair.chair?.deviceId}</div>
                    </div>
                  </div>
                </div>

                {pair.notes && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">{pair.notes}</p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Bundle Pairing Modal (new pair or re-pair) */}
      <CreatePairingCodeModal
        open={bundleModalOpen}
        onClose={() => {
          setBundleModalOpen(false);
          setBundleTargetPairId(null);
        }}
        targetPairId={bundleTargetPairId}
        onCompleted={() => {
          setBundleModalOpen(false);
          setBundleTargetPairId(null);
          void loadPairs();
        }}
      />
    </div>
  );
}
