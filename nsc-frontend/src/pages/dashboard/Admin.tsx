import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth";
import api from "@/lib/axios";
import { Users, Video, Headset, Activity, TrendingUp, Clock, Calendar } from "lucide-react";

type Envelope<T> = { status?: boolean; data?: { total?: number; page?: number; limit?: number; data?: T[] } } | any;
type UserItem = { id: number; first_name?: string; last_name?: string; email?: string; createdAt?: string };
type SessionLogItem = {
  id: string;
  session_id: string;
  event: string;
  journey_id?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  duration_ms?: string | number | null;
  vr_device_id?: string | null;
  createdAt?: string;
};

function fmtDate(iso?: string | null) {
  return iso ? new Date(iso).toLocaleString() : "-";
}

function Sparkline({ values, color = "rgb(34, 211, 238)" }: { values: number[]; color?: string }) {
  const width = 120;
  const height = 32;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * width;
    const y = height - (v / max) * height;
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts.join(" ")}
      />
    </svg>
  );
}

export default function Admin() {
  const user = useAuthStore((s) => s.user);

  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState<{ 
    users: number; 
    journeys: number; 
    vr: number; 
    chairs: number; 
    sessions: number;
    activeSessions: number;
  }>({
    users: 0,
    journeys: 0,
    vr: 0,
    chairs: 0,
    sessions: 0,
    activeSessions: 0,
  });
  const [recentUsers, setRecentUsers] = useState<UserItem[]>([]);
  const [recentSessions, setRecentSessions] = useState<SessionLogItem[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [usersRes, assetsRes, devicesRes, sessRes] = await Promise.all([
          api.get("/users", { page: 1, limit: 5 }),
          api.get("/journeys", { page: 1, limit: 1 }),
          api.get("/devices", { page: 1, limit: 1 }),
          api.get("/session-logs", { page: 1, limit: 5 }),
        ]);

        // Users
        const uEnv: Envelope<UserItem> = usersRes as any;
        const uList: UserItem[] = Array.isArray(uEnv?.data?.data) ? (uEnv.data!.data as UserItem[]) : [];
        const usersTotal: number = Number(uEnv?.data?.total ?? 0);

        // Journeys
        const aEnv: Envelope<any> = assetsRes as any;
        const journeysTotal: number = Number(aEnv?.data?.total ?? 0);

        // Devices
        const dEnv: Envelope<any> = devicesRes as any;
        const vrLen = Array.isArray(dEnv?.data?.vr) ? dEnv.data.vr.length : 0;
        const chairsLen = Array.isArray(dEnv?.data?.chairs) ? dEnv.data.chairs.length : 0;

        // Session logs
        const sEnv: Envelope<SessionLogItem> = sessRes as any;
        const sList: SessionLogItem[] = Array.isArray(sEnv?.data?.data) ? (sEnv.data!.data as SessionLogItem[]) : [];
        const sessTotal: number = Number(sEnv?.data?.total ?? 0);
        const activeSess = sList.filter(s => s.event === 'PLAYBACK_STARTED').length;

        setTotals({ 
          users: usersTotal, 
          journeys: journeysTotal, 
          vr: vrLen, 
          chairs: chairsLen, 
          sessions: sessTotal,
          activeSessions: activeSess
        });
        setRecentUsers(uList);
        setRecentSessions(sList);
      } catch {
        // ignore and keep defaults
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const spark = useMemo(() => [3, 5, 4, 6, 8, 7, 9, 10], []);

  return (
    <div className="p-6 space-y-6">
      {/* Header with gradient */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Admin Dashboard
          </h1>
          <p className="text-slate-400 mt-1 flex items-center gap-2">
            <span>Welcome back, <span className="font-semibold text-white">{user?.name}</span></span>
            <Badge variant="secondary" className="ml-2">
              <Activity className="w-3 h-3 mr-1" />
              Live
            </Badge>
          </p>
        </div>
      </div>

      {/* Primary Metric Cards with Icons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-900/40 to-slate-900/40 border-slate-700 hover:border-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-500/10">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm text-slate-400">Total Users</CardTitle>
            <Users className="w-5 h-5 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold text-white">{totals.users}</div>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Active accounts
                </p>
              </div>
              <Sparkline values={spark} color="rgb(96, 165, 250)" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-900/40 to-slate-900/40 border-slate-700 hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/10">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm text-slate-400">Journeys</CardTitle>
            <Video className="w-5 h-5 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold text-white">{totals.journeys}</div>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <Video className="w-3 h-3" />
                  Available experiences
                </p>
              </div>
              <Sparkline values={spark.slice().reverse()} color="rgb(192, 132, 252)" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-emerald-900/40 to-slate-900/40 border-slate-700 hover:border-emerald-500/50 transition-all hover:shadow-lg hover:shadow-emerald-500/10">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm text-slate-400">Devices</CardTitle>
            <Headset className="w-5 h-5 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold text-white">{totals.vr + totals.chairs}</div>
                <p className="text-xs text-slate-500 mt-1">
                  <span className="text-emerald-400">{totals.vr} VR</span> · <span className="text-cyan-400">{totals.chairs} Chairs</span>
                </p>
              </div>
              <Sparkline values={spark.map((v) => v - 1)} color="rgb(52, 211, 153)" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-orange-900/40 to-slate-900/40 border-slate-700 hover:border-orange-500/50 transition-all hover:shadow-lg hover:shadow-orange-500/10">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm text-slate-400">Session Logs</CardTitle>
            <Activity className="w-5 h-5 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold text-white">{totals.sessions}</div>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {totals.activeSessions} active
                </p>
              </div>
              <Sparkline values={spark.map((v) => (v % 2 === 0 ? v : v - 2))} color="rgb(251, 146, 60)" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-slate-900/40 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2 rounded bg-slate-800/40">
              <span className="text-sm text-slate-400">VR Headsets</span>
              <Badge variant="secondary" className="bg-emerald-900/40 text-emerald-400 border-emerald-700">
                {totals.vr} online
              </Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-800/40">
              <span className="text-sm text-slate-400">Motion Chairs</span>
              <Badge variant="secondary" className="bg-cyan-900/40 text-cyan-400 border-cyan-700">
                {totals.chairs} online
              </Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-800/40">
              <span className="text-sm text-slate-400">Active Sessions</span>
              <Badge variant="secondary" className="bg-orange-900/40 text-orange-400 border-orange-700">
                {totals.activeSessions}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-800/40">
              <span className="text-sm text-slate-400">Total Journeys</span>
              <Badge variant="secondary" className="bg-purple-900/40 text-purple-400 border-purple-700">
                {totals.journeys}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 bg-slate-900/40 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Device Connectivity</span>
                <span className="text-emerald-400 font-semibold">100%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: '100%' }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Session Activity</span>
                <span className="text-orange-400 font-semibold">{totals.sessions > 0 ? Math.round((totals.activeSessions / totals.sessions) * 100) : 0}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-500 to-red-500" style={{ width: `${totals.sessions > 0 ? (totals.activeSessions / totals.sessions) * 100 : 0}%` }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Content Library</span>
                <span className="text-purple-400 font-semibold">{totals.journeys} items</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: '85%' }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-slate-900/40 border-slate-800 hover:border-slate-700 transition-colors">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-400" />
              Recent Sessions
              <Badge variant="secondary" className="ml-auto">{recentSessions.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-800/60">
                  <tr className="border-b border-slate-800">
                    <th className="h-9 px-2 text-left text-slate-400 font-medium">Event</th>
                    <th className="h-9 px-2 text-left text-slate-400 font-medium">Journey</th>
                    <th className="h-9 px-2 text-left text-slate-400 font-medium">Device</th>
                    <th className="h-9 px-2 text-left text-slate-400 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentSessions || []).slice(0, 5).map((s) => (
                    <tr key={s.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors">
                      <td className="px-2 py-2.5 align-middle">
                        <Badge variant="secondary" className="text-xs">
                          {s.event.replace('PLAYBACK_', '')}
                        </Badge>
                      </td>
                      <td className="px-2 py-2.5 align-middle text-slate-300">#{s.journey_id ?? "-"}</td>
                      <td className="px-2 py-2.5 align-middle text-slate-400 text-xs">{s.vr_device_id ?? "-"}</td>
                      <td className="px-2 py-2.5 align-middle text-slate-500 text-xs">{fmtDate(s.start_time)}</td>
                    </tr>
                  ))}
                  {!recentSessions.length && (
                    <tr>
                      <td className="px-2 py-4 text-center text-slate-500" colSpan={4}>
                        {loading ? "Loading..." : "No sessions"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/40 border-slate-800 hover:border-slate-700 transition-colors">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Recent Users
              <Badge variant="secondary" className="ml-auto">{recentUsers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-800/60">
                  <tr className="border-b border-slate-800">
                    <th className="h-9 px-2 text-left text-slate-400 font-medium">Name</th>
                    <th className="h-9 px-2 text-left text-slate-400 font-medium">Email</th>
                    <th className="h-9 px-2 text-left text-slate-400 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentUsers || []).slice(0, 5).map((u) => (
                    <tr key={u.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors">
                      <td className="px-2 py-2.5 align-middle text-slate-200 font-medium">
                        {[u.first_name, u.last_name].filter(Boolean).join(" ")}
                      </td>
                      <td className="px-2 py-2.5 align-middle text-slate-400">{u.email}</td>
                      <td className="px-2 py-2.5 align-middle text-slate-500 text-xs">{fmtDate(u.createdAt)}</td>
                    </tr>
                  ))}
                  {!recentUsers.length && (
                    <tr>
                      <td className="px-2 py-4 text-center text-slate-500" colSpan={3}>
                        {loading ? "Loading..." : "No users"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
 
