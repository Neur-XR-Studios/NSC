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

        props.vrDevices.map((d: Device) => {
          if (d.online) {
            vrDevice[d.id] = d.id;
          }
        });
        props.chairDevices.map((d: Device) => {
          if (d.online) {
            chairDevice[d.id] = d.id;
          }
        });

        props.pairs.map((p: Pair) => {
          AllPairDevices[p.vrId] = vrDevice[p.vrId] ? true : false;
          AllPairDevices[p.chairId] = chairDevice[p.chairId] ? true : false;
        });

        if (AllPairDevices) {
          const offlineDevices = Object.keys(AllPairDevices).filter((id) => AllPairDevices[id] === false);
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
