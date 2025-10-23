import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, PlayCircle, RefreshCw } from "lucide-react";
import type { JourneyItem } from "@/types/journey";
import type { SessionType } from "@/lib/sessions";

interface Props {
  journeys: JourneyItem[];
  journeysLoading: boolean;
  onRefresh: () => void;
  onBack: () => void;
  sessionType: SessionType | null;
  selectedJourneyIds: string[];
  setSelectedJourneyIds: (updater: (prev: string[]) => string[]) => void;
  selectedJourneyLangs: Record<string, string>;
  setSelectedJourneyLangs: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  onCreateIndividual: () => void;
  onCreateGroup: () => void;
}

export default function JourneySelectionStep({
  journeys,
  journeysLoading,
  onRefresh,
  onBack,
  sessionType,
  selectedJourneyIds,
  setSelectedJourneyIds,
  selectedJourneyLangs,
  setSelectedJourneyLangs,
  onCreateIndividual,
  onCreateGroup,
}: Props) {
  const isSelected = (jid: string) => selectedJourneyIds.includes(jid);

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader className="border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white text-xl mb-1">Choose Journey</CardTitle>
              <p className="text-slate-400 text-sm">Select a journey experience for your session</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={journeysLoading}
                className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <RefreshCw className={`w-4 h-4 ${journeysLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
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
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {journeys.length === 0 && !journeysLoading ? (
            <div className="text-center py-20">
              <AlertCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-300 text-lg font-medium mb-2">No Journeys Available</p>
              <p className="text-slate-500 text-sm">Try refreshing or check back later</p>
            </div>
          ) : journeysLoading ? (
            <div className="text-center py-20">
              <RefreshCw className="w-12 h-12 text-cyan-500 mx-auto mb-4 animate-spin" />
              <p className="text-slate-400">Loading journeys...</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {journeys.map((it, idx) => {
                const thumb = it.video?.thumbnail_url;
                const title = it.journey?.title || it.video?.title || "Untitled Journey";
                const desc = it.journey?.description || it.video?.description || "No description available";
                const duration = it.video?.duration_ms ? Math.round((it.video.duration_ms || 0) / 1000) : null;
                const jid = String(it.journey?.id ?? it.video?.id ?? "");

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (sessionType === "group") {
                        setSelectedJourneyIds((prev) => (prev.includes(jid) ? prev.filter((x) => x !== jid) : [...prev, jid]));
                      } else {
                        setSelectedJourneyIds(() => (jid ? [jid] : []));
                      }
                    }}
                    className={`group relative rounded-2xl overflow-hidden transition-all ${
                      isSelected(jid) ? "ring-2 ring-cyan-500 shadow-xl shadow-cyan-500/20" : "border border-slate-700 hover:border-cyan-500/50 hover:shadow-lg"
                    } bg-slate-800/30`}
                  >
                    <div className="relative h-44 w-full bg-slate-800 overflow-hidden">
                      {thumb ? (
                        <img src={thumb} alt={title} className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <PlayCircle className="w-12 h-12 text-slate-700" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      {duration !== null && (
                        <div className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-black/70 backdrop-blur-sm text-white text-xs font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {duration}s
                        </div>
                      )}
                      {isSelected(jid) && (
                        <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h4 className="font-semibold text-white mb-1 line-clamp-1">{title}</h4>
                      <p className="text-xs text-slate-400 line-clamp-2">{desc}</p>
                      {/* Language Selector (visible when selected and languages available) */}
                      {isSelected(jid) && Array.isArray(it.audio_tracks) && it.audio_tracks.length > 0 && (
                        <div
                          className="mt-3"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <label className="block text-xs text-slate-400 mb-1">Audio Language</label>
                          <select
                            value={selectedJourneyLangs[jid] || it.audio_tracks[0]?.language_code || ''}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSelectedJourneyLangs((prev) => ({ ...prev, [jid]: val }));
                            }}
                            className="w-full bg-slate-800/80 border border-slate-700 text-slate-200 text-sm rounded px-2 py-1"
                          >
                            {it.audio_tracks
                              .filter((t) => !!t.language_code)
                              .map((t) => (
                                <option key={`${jid}-${t.id}-${t.language_code}`} value={t.language_code!}>
                                  {t.language_code}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Session Button */}
      {selectedJourneyIds.length > 0 && (
        <div className="flex justify-center">
          <Button
            onClick={() => {
              if (sessionType === "individual") onCreateIndividual();
              else onCreateGroup();
            }}
            className="gap-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white px-10 py-4 rounded-xl font-semibold shadow-lg text-lg"
          >
            <PlayCircle className="w-6 h-6" />
            {sessionType === "individual" ? "Create Session & Start" : "Create Group Session & Start"}
          </Button>
        </div>
      )}
    </div>
  );
}
