import type { JourneyItem } from "@/types/journey";

export type ActivePair = { sessionId: string; vrId: string; chairId: string; journeyId?: number[] } | null;
export type Pair = { sessionId: string; vrId: string; chairId: string; journeyId?: number[] };
export type Device = { 
  id: string; 
  name: string; 
  online: boolean; 
  type?: string; 
  deviceId?: string; // Hardware device ID for MQTT communication
};

export interface BaseControllerProps {
  activePair: ActivePair;
  journeys: JourneyItem[];
  seekValues: Record<string, number>;
  setSeekValues: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
  sendCmd: (
    sessionId: string,
    type: "play" | "pause" | "seek" | "stop",
    positionMs?: number,
    journeyId?: number,
  ) => void;
  onNewSession: () => void;
  onResendSession?: () => void;
  pairs?: Pair[];
  setPairs?: (updater: (prev: Pair[]) => Pair[]) => void;
  onlineById?: Record<string, boolean>;
  deviceInfoById?: Record<
    string,
    {
      status?: string;
      positionMs?: number;
      sessionId?: string;
      currentJourneyId?: number;
      lastEvent?: string;
      language?: string;
      playing?: boolean;
    }
  >;
  vrDevices?: Device[];
  chairDevices?: Device[];
  sendParticipantCmd?: (
    pair: { vrId: string; chairId: string },
    type: "play" | "pause" | "seek" | "stop",
    positionMs?: number,
  ) => void;
  sessionOfflineDevices?: string[];
}
