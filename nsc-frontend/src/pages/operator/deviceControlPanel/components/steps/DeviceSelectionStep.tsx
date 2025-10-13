import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Armchair, ChevronRight, Headset, Plus, X, ArrowLeft } from "lucide-react";

export type Device = { id: string; name: string; online: boolean; type?: string };
export type Pair = { sessionId: string; vrId: string; chairId: string; journeyId?: number[] };
type SessionType = "individual" | "group" | null;

interface Props {
  sessionType: SessionType;
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
}

export default function DeviceSelectionStep({
  sessionType,
  vrDevices,
  chairDevices,
  pairedVrIds,
  pairedChairIds,
  selectedVrId,
  selectedChairId,
  setSelectedVrId,
  setSelectedChairId,
  pairs,
  setPairs,
  onBack,
  onContinue,
}: Props) {
  const canAddPair =
    !!selectedVrId &&
    !!selectedChairId &&
    !pairedVrIds.has(selectedVrId) &&
    !pairedChairIds.has(selectedChairId);

  const canContinue = pairs.length >= 1;

  return (
    <div className="mx-auto">
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader className="border-b border-slate-800 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white text-xl mb-1">Device Pairing</CardTitle>
              <p className="text-slate-400 text-sm">
                {sessionType === "individual" 
                  ? "Create one or more VR–chair pairs. Journeys are chosen on devices."
                  : "Create multiple VR–chair pairs for your group session and pick journeys next."}
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onBack} 
              className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* VR Devices Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wide flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                    <Headset className="w-4 h-4 text-white" />
                  </div>
                  VR Headsets
                </h3>
                <span className="text-xs text-slate-500 font-medium">{vrDevices.length} Available</span>
              </div>

              {vrDevices.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-lg bg-slate-900/30">
                  <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No VR devices online</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto pr-1">
                  {vrDevices.map((d) => {
                    const selected = selectedVrId === d.id;
                    const isPaired = pairedVrIds.has(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => !isPaired && setSelectedVrId(d.id)}
                        disabled={isPaired}
                        className={`relative text-left border rounded-lg p-3 transition-all ${
                          isPaired
                            ? "border-slate-800 bg-slate-900/40 opacity-40 cursor-not-allowed"
                            : selected
                            ? "border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/20"
                            : "border-slate-700 bg-slate-800/40 hover:bg-slate-800 hover:border-slate-600"
                        }`}
                      >
                        <div className="flex flex-col gap-2">
                          <div className="font-medium text-white text-sm truncate" title={d.name}>
                            {d.name}
                          </div>
                          <div className="text-xs text-slate-500 truncate" title={d.id}>
                            {d.id}
                          </div>
                          <div className={`self-start px-2 py-0.5 rounded text-xs font-medium ${
                            isPaired 
                              ? "bg-slate-700/50 text-slate-400" 
                              : "bg-emerald-500/20 text-emerald-400"
                          }`}>
                            {isPaired ? "Paired" : "Available"}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Chair Devices Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wide flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                    <Armchair className="w-4 h-4 text-white" />
                  </div>
                  Chairs
                </h3>
                <span className="text-xs text-slate-500 font-medium">{chairDevices.length} Available</span>
              </div>

              {chairDevices.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-lg bg-slate-900/30">
                  <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No chair devices online</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto pr-1">
                  {chairDevices.map((d) => {
                    const selected = selectedChairId === d.id;
                    const isPaired = pairedChairIds.has(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => !isPaired && setSelectedChairId(d.id)}
                        disabled={isPaired}
                        className={`relative text-left border rounded-lg p-3 transition-all ${
                          isPaired
                            ? "border-slate-800 bg-slate-900/40 opacity-40 cursor-not-allowed"
                            : selected
                            ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/20"
                            : "border-slate-700 bg-slate-800/40 hover:bg-slate-800 hover:border-slate-600"
                        }`}
                      >
                        <div className="flex flex-col gap-2">
                          <div className="font-medium text-white text-sm truncate" title={d.name}>
                            {d.name}
                          </div>
                          <div className="text-xs text-slate-500 truncate" title={d.id}>
                            {d.id}
                          </div>
                          <div className={`self-start px-2 py-0.5 rounded text-xs font-medium ${
                            isPaired 
                              ? "bg-slate-700/50 text-slate-400" 
                              : "bg-emerald-500/20 text-emerald-400"
                          }`}>
                            {isPaired ? "Paired" : "Available"}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Pair Button - Centered */}
          <div className="flex justify-center py-4 border-y border-slate-800">
            <Button
              onClick={() => {
                if (!canAddPair) return;
                setPairs((prev) => [
                  ...prev,
                  { sessionId: "", vrId: selectedVrId, chairId: selectedChairId, journeyId: [] },
                ]);
                setSelectedVrId("");
                setSelectedChairId("");
              }}
              disabled={!canAddPair}
              className="gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white px-8 py-2.5 rounded-lg font-semibold shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
              Create Pair
            </Button>
          </div>

          {/* Paired Devices List */}
          {pairs.length > 0 && (
            <div className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wide">
                  Active Pairs <span className="text-cyan-400">({pairs.length})</span>
                </h3>
                {sessionType === "group" && (
                  <span className="text-xs text-slate-500">Add more or continue below</span>
                )}
              </div>
              
              <div className="grid grid-cols-4 gap-3 mb-6">
                {pairs.map((p, idx) => (
                  <div
                    key={idx}
                    className="relative p-4 rounded-lg bg-gradient-to-br from-slate-800/60 to-slate-800/30 border border-slate-700/50 hover:border-slate-600 transition-all"
                  >
                    <button
                      onClick={() => setPairs((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-2 right-2 p-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    
                    <div className="space-y-3 pr-6">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded bg-purple-500/10 border border-purple-500/30">
                          <Headset className="w-3.5 h-3.5 text-purple-400" />
                        </div>
                        <span className="text-xs font-medium text-white truncate" title={p.vrId}>
                          {p.vrId}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded bg-blue-500/10 border border-blue-500/30">
                          <Armchair className="w-3.5 h-3.5 text-blue-400" />
                        </div>
                        <span className="text-xs font-medium text-white truncate" title={p.chairId}>
                          {p.chairId}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-center">
                <Button
                  onClick={() => canContinue && onContinue()}
                  disabled={!canContinue}
                  className="gap-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white px-8 py-3 rounded-lg font-semibold shadow-lg text-base disabled:opacity-40"
                >
                  {sessionType === "individual" ? "Continue to Controller" : "Continue to Journey Selection"}
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}