import api from "./axios";

export type SessionType = "individual" | "group";

export type CreateIndividualSessionPayload = {
  session_type: SessionType; // "individual"
  vrDeviceId: string; // deviceId
  chairDeviceId: string; // deviceId
  journeyId?: number[]; // optional
  videoId?: string; // optional fallback
  groupId?: string; // unused for individual
};

export type GroupMember = {
  vrDeviceId: string; // deviceId
  chairDeviceId: string; // deviceId
  language?: string | null;
};

export type CreateGroupSessionPayload = {
  session_type: SessionType; // "group"
  groupId?: string;
  journeyId?: number[];
  journeyIds?: Array<string | number>;
  videoId?: string;
  members: GroupMember[];
};

export type SessionRecord = {
  id: string;
  status: string;
  group_id?: string | null;
  journey_id?: string | null;
  video_id?: string | null;
  session_type: SessionType;
};

export async function createIndividualSession(payload: CreateIndividualSessionPayload): Promise<SessionRecord> {
  const body: {
    session_type: SessionType;
    vrDeviceId: string;
    chairDeviceId: string;
    journeyId?: number[];
    videoId?: string;
  } = {
    session_type: payload.session_type,
    vrDeviceId: payload.vrDeviceId,
    chairDeviceId: payload.chairDeviceId,
    journeyId: payload.journeyId,
    videoId: payload.videoId,
  };
  const res = await api.post<{ status: boolean; data: SessionRecord }>("sessions", body);
  const data = (res?.data as { status: boolean; data: SessionRecord } | SessionRecord);
  return ("data" in data ? data.data : data);
}

export async function createGroupSession(payload: CreateGroupSessionPayload): Promise<{ session: SessionRecord; groupId: string; participants?: unknown[] }> {
  const body: {
    members: GroupMember[];
    groupId?: string;
    journeyId?: number[];
    journeyIds?: Array<string | number>;
    videoId?: string;
  } = {
    members: payload.members,
    groupId: payload.groupId,
    journeyId: payload.journeyId,
    journeyIds: payload.journeyIds,
    videoId: payload.videoId,
  };
  const res = await api.post<{ status: boolean; data: { session: SessionRecord; groupId: string; participants?: unknown[] } }>(
    "sessions/group",
    body
  );
  return res.data;
}

export type SessionCommand = "start" | "pause" | "seek" | "stop" | "sync";

export async function commandSession(
  sessionId: string,
  cmd: SessionCommand,
  options?: { positionMs?: number; durationMs?: number; videoId?: string }
) {
  const body: { cmd: SessionCommand; positionMs?: number; durationMs?: number; videoId?: string } = { cmd };
  if (typeof options?.positionMs === "number") body.positionMs = options.positionMs;
  if (typeof options?.durationMs === "number") body.durationMs = options.durationMs;
  if (options?.videoId) body.videoId = options.videoId;
  return api.post(`sessions/${sessionId}/commands`, body);
}
