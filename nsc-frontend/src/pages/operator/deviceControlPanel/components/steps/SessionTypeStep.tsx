import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, User } from "lucide-react";
import type { SessionType } from "@/lib/sessions";

interface Props {
  onSelect: (type: SessionType) => void;
}

export default function SessionTypeStep({ onSelect }: Props) {
  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-xl">Choose Session Type</CardTitle>
          <p className="text-slate-400 text-sm mt-2">Select how you want to manage your devices</p>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <button
              type="button"
              onClick={() => onSelect("individual")}
              className="group relative overflow-hidden p-8 rounded-2xl border-2 border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 hover:border-cyan-500 hover:shadow-xl hover:shadow-cyan-500/10 transition-all text-left"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl group-hover:bg-cyan-500/10 transition-colors" />
              <div className="relative">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-4">
                  <User className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Individual Session</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Pair one VR headset with one chair. Perfect for single-user experiences with full control over journey playback.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onSelect("group")}
              className="group relative overflow-hidden p-8 rounded-2xl border-2 border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 hover:border-purple-500 hover:shadow-xl hover:shadow-purple-500/10 transition-all text-left"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl group-hover:bg-purple-500/10 transition-colors" />
              <div className="relative">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mb-4">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Group Session</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Pair multiple VR-chair sets for synchronized group experiences. Control all devices together or individually.
                </p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
