import { useEffect, useState } from "react";
import GroupSessionController from "./GroupSessionController";
import IndividualSessionController from "./IndividualSessionController";
import type { ActivePair, Pair, Device, BaseControllerProps } from "./types";

// Re-export types for backward compatibility
export type { ActivePair, Pair, Device };

interface Props extends BaseControllerProps {
  sessionType?: "individual" | "group" | null;
}

export default function ControllerStep(props: Props) {
  const { sessionType } = props;
  const [sessionOfflineDevices, setSessionOfflineDevice] = useState<string[]>([]);

  useEffect(() => {
    if (props?.vrDevices && props?.chairDevices) {
      if (props?.pairs) {
        const vrDevice: Record<string, string> = {};
        const chairDevice: Record<string, string> = {};

        const AllPairDevices: Record<string, boolean> = {};

        // Build lookup maps for online devices, checking both id and deviceId
        props.vrDevices.map((d: Device) => {
          if (d.online) {
            vrDevice[d.id] = d.id;
            // Also map by deviceId if it exists and is different from id
            if (d.deviceId && d.deviceId !== d.id) {
              vrDevice[d.deviceId] = d.deviceId;
            }
          }
        });
        props.chairDevices.map((d: Device) => {
          if (d.online) {
            chairDevice[d.id] = d.id;
            // Also map by deviceId if it exists and is different from id
            if (d.deviceId && d.deviceId !== d.id) {
              chairDevice[d.deviceId] = d.deviceId;
            }
          }
        });

        // Check if pair devices are online (match by either id or deviceId)
        props.pairs.map((p: Pair) => {
          AllPairDevices[p.vrId] = vrDevice[p.vrId] ? true : false;
          AllPairDevices[p.chairId] = chairDevice[p.chairId] ? true : false;
        });

        if (AllPairDevices) {
          const offlineDevices = Object.keys(AllPairDevices).filter((id) => AllPairDevices[id] === false);

          // Debug logging to help identify ID mismatches
          if (offlineDevices.length > 0) {
            console.log('[ControllerStep] Offline devices detected:', offlineDevices);
            console.log('[ControllerStep] Available VR device IDs:', Object.keys(vrDevice));
            console.log('[ControllerStep] Available Chair device IDs:', Object.keys(chairDevice));
            console.log('[ControllerStep] Pair device IDs:', props.pairs.map((p: Pair) => ({ vr: p.vrId, chair: p.chairId })));
          }

          setSessionOfflineDevice(offlineDevices);
        }
      }
    }
  }, [props]);

  if (sessionType === "group") {
    return <GroupSessionController {...props} sessionOfflineDevices={sessionOfflineDevices} />;
  }

  if (sessionType === "individual") {
    return <IndividualSessionController {...props} sessionOfflineDevices={sessionOfflineDevices} />;
  }

  // Fallback for null or undefined sessionType
  return (
    <div className="flex items-center justify-center p-8 text-slate-400">
      <p>Please select a session type to continue.</p>
    </div>
  );
}
