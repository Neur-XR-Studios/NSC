import { CheckCircle2, Wifi, WifiOff, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  currentStepNumber: number;
  connected: boolean;
  mode: "mqtt" | "bridge";
  sessionType?: "individual" | "group" | null;
  onToggleLogger?: () => void;
}

export default function ProgressStepper({ currentStepNumber, connected, mode, sessionType, onToggleLogger }: Props) {
  const steps = [
    { key: "session-type", label: "Session Type" },
    { key: "device-selection", label: "Select Devices" },
    ...(sessionType === "individual" ? [] : [{ key: "journey-selection", label: "Choose Journey" }]),
    { key: "controller", label: "Control Session" },
  ] as const;

  const modeLabel = mode === "mqtt" ? "MQTT" : "Bridge";

  return (
    <div className="w-full border rounded-xl p-4 sm:p-6 mb-6">
      <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">
        {/* Stepper */}
        <nav aria-label="Session progress" className="flex-1 w-full">
          <ol role="list" className="flex items-start">
            {steps.map((s, idx) => {
              const isActive = currentStepNumber === idx;
              const isCompleted = currentStepNumber > idx;
              const isLast = idx === steps.length - 1;

              return (
                <li key={s.key} className="relative flex-1" aria-current={isActive ? "step" : undefined}>
                  <div className="flex flex-col items-center">
                    {/* Circle */}
                    <div className="relative z-10 flex items-center justify-center">
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                          isCompleted
                            ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                            : isActive
                            ? "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white ring-4 ring-cyan-500/20 shadow-lg shadow-cyan-500/30 scale-110"
                            : "bg-slate-800 text-slate-500 border-2 border-slate-700"
                        }`}
                        title={`${isCompleted ? "Completed" : isActive ? "Current" : "Pending"}: ${s.label}`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                        ) : (
                          <span className="text-sm">{idx + 1}</span>
                        )}
                      </div>
                    </div>

                    {/* Label */}
                    <span
                      className={`mt-3 text-xs sm:text-sm font-medium text-center px-2 transition-colors duration-300 ${
                        isActive ? "text-cyan-400" : isCompleted ? "text-emerald-400" : "text-slate-500"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>

                  {/* Connector Line */}
                  {!isLast && (
                    <div className="absolute top-5 left-1/2 w-full h-0.5 -z-0" aria-hidden="true">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isCompleted ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : "bg-slate-800"
                        }`}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Status Indicators */}
        <div className="flex flex-row lg:flex-col gap-3 w-full lg:w-auto shrink-0">
          {/* Connection Status */}
          <div
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all duration-300 flex-1 lg:flex-initial ${
              connected
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10"
                : "bg-red-500/10 text-red-400 border border-red-500/30 shadow-sm shadow-red-500/10"
            }`}
            role="status"
            aria-live="polite"
            title={connected ? "Device connection is active" : "Device connection is not active"}
          >
            {connected ? (
              <Wifi className="w-4 h-4 animate-pulse" aria-hidden="true" />
            ) : (
              <WifiOff className="w-4 h-4" aria-hidden="true" />
            )}
            <span className="text-sm font-semibold whitespace-nowrap">{connected ? "Connected" : "Disconnected"}</span>
          </div>

          {/* Mode Indicator */}
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800/70 border border-slate-700/50 flex-1 lg:flex-initial cursor-pointer"
            title={`Communication mode: ${modeLabel}`}
            onClick={onToggleLogger}
          >
            <span className="text-sm font-bold text-cyan-400">{modeLabel}</span>
            <span className="text-sm font-bold text-cyan-400">Log</span>
            <FileText className="w-4 h-4" aria-hidden="true" />
          </div>

          {/* Logger Toggle */}
        </div>
      </div>
    </div>
  );
}
