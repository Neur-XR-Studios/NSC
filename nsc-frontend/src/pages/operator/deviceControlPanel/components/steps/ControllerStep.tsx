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

  const { vrDevices, chairDevices, pairs } = props;

  // DEBUG: Track renders
  console.log("[ControllerStep] Render", { sessionType, offlineCount: sessionOfflineDevices.length });

  useEffect(() => {
    // DEBUG: Track effect execution
    console.log("[ControllerStep] Checking offline devices", {
      vrCount: vrDevices?.length,
      chairCount: chairDevices?.length,
      pairsCount: pairs?.length,
    });

    if (vrDevices && chairDevices && pairs) {
      const vrDevice: Record<string, string> = {};
      const chairDevice: Record<string, string> = {};

      const AllPairDevices: Record<string, boolean> = {};

      vrDevices.forEach((d: Device) => {
        if (d.online) {
          vrDevice[d.id] = d.id;
        }
      });
      chairDevices.forEach((d: Device) => {
        if (d.online) {
          chairDevice[d.id] = d.id;
        }
      });

      pairs.forEach((p: Pair) => {
        AllPairDevices[p.vrId] = !!vrDevice[p.vrId];
        AllPairDevices[p.chairId] = !!chairDevice[p.chairId];
      });

      const offlineDevices = Object.keys(AllPairDevices).filter((id) => AllPairDevices[id] === false);

      setSessionOfflineDevice((prev) => {
        // Only update if changed
        if (JSON.stringify(prev) !== JSON.stringify(offlineDevices)) {
          return offlineDevices;
        }
        return prev;
      });
    }
  }, [vrDevices, chairDevices, pairs]);

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
