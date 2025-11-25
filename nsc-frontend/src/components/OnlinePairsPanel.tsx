import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  getOnlineDevicePairs,
  startSessionFromPair,
  type DevicePair,
} from '@/lib/devicePairs';
import { Play, Wifi, Monitor, Armchair, RefreshCw } from 'lucide-react';

interface OnlinePairsPanelProps {
  onSessionStarted?: (sessionId: string, pairId: string) => void;
  selectedJourneyIds?: number[];
}

export default function OnlinePairsPanel({ onSessionStarted, selectedJourneyIds }: OnlinePairsPanelProps) {
  const { toast } = useToast();
  const [pairs, setPairs] = useState<DevicePair[]>([]);
  const [loading, setLoading] = useState(false);
  const [startingPairId, setStartingPairId] = useState<string | null>(null);

  const loadOnlinePairs = async () => {
    setLoading(true);
    try {
      const result = await getOnlineDevicePairs();
      if (result.status && result.data) {
        setPairs(result.data);
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to load online pairs',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load online pairs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOnlinePairs();
    // Refresh every 10 seconds
    const interval = setInterval(() => {
      void loadOnlinePairs();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleStartSession = async (pairId: string) => {
    if (!selectedJourneyIds || selectedJourneyIds.length === 0) {
      toast({
        title: 'No Journey Selected',
        description: 'Please select at least one journey before starting a session',
        variant: 'destructive',
      });
      return;
    }

    setStartingPairId(pairId);
    try {
      const result = await startSessionFromPair(pairId, selectedJourneyIds);
      if (result.status && result.data) {
        toast({
          title: 'Session Started',
          description: 'Session has been created successfully',
        });
        if (onSessionStarted) {
          onSessionStarted(result.data.id, pairId);
        }
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to start session',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to start session',
        variant: 'destructive',
      });
    } finally {
      setStartingPairId(null);
    }
  };

  const getOnlineStatus = (pair: DevicePair) => {
    if (pair.bothOnline) return { text: 'Both Online', color: 'text-green-600 dark:text-green-400' };
    if (pair.vrOnline && !pair.chairOnline) return { text: 'VR Online', color: 'text-yellow-600 dark:text-yellow-400' };
    if (!pair.vrOnline && pair.chairOnline) return { text: 'Chair Online', color: 'text-yellow-600 dark:text-yellow-400' };
    return { text: 'Offline', color: 'text-gray-400' };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wifi className="w-5 h-5 text-green-500" />
          <h2 className="text-xl font-semibold">Online Pairs</h2>
          <span className="text-sm text-muted-foreground">({pairs.length})</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void loadOnlinePairs()}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading && pairs.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : pairs.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-muted-foreground">
            <Wifi className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No online device pairs available</p>
            <p className="text-sm mt-1">Waiting for devices to connect...</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {pairs.map((pair) => {
            const status = getOnlineStatus(pair);
            const canStart = pair.bothOnline;

            return (
              <Card key={pair.id} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{pair.pair_name}</h3>
                      <div className={`text-xs ${status.color} flex items-center gap-1 mt-1`}>
                        <Wifi className="w-3 h-3" />
                        {status.text}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => void handleStartSession(pair.id)}
                      disabled={!canStart || startingPairId === pair.id || !selectedJourneyIds || selectedJourneyIds.length === 0}
                      className="gap-2"
                    >
                      {startingPairId === pair.id ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                          Starting...
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3" />
                          Start
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      <Monitor className={`w-3.5 h-3.5 ${pair.vrOnline ? 'text-green-500' : 'text-gray-400'}`} />
                      <span className="text-muted-foreground">VR:</span>
                      <span className="font-mono text-xs">{pair.vr?.id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Armchair className={`w-3.5 h-3.5 ${pair.chairOnline ? 'text-green-500' : 'text-gray-400'}`} />
                      <span className="text-muted-foreground">Chair:</span>
                      <span className="font-mono text-xs">{pair.chair?.id}</span>
                    </div>
                  </div>

                  {!canStart && (
                    <div className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 p-2 rounded">
                      ⚠ Waiting for {!pair.vrOnline ? 'VR' : 'Chair'} to come online
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
