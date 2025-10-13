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

export type SessionCommand = "start" | "pause" | "seek" | "stop" | "sync" | "select_journey";

export async function commandSession(
  sessionId: string,
  cmd: SessionCommand,
  options?: { positionMs?: number; durationMs?: number; videoId?: string; journeyId?: number }
) {
  const body: { cmd: SessionCommand; positionMs?: number; durationMs?: number; videoId?: string; journeyId?: number } = { cmd };
  if (typeof options?.positionMs === "number") body.positionMs = options.positionMs;
  if (typeof options?.durationMs === "number") body.durationMs = options.durationMs;
  if (options?.videoId) body.videoId = options.videoId;
  if (typeof options?.journeyId === "number") body.journeyId = options.journeyId;
  return api.post(`sessions/${sessionId}/commands`, body);
}

// Participants (Individual flow)
export type ParticipantRecord = {
  id: string;
  session_id: string;
  vr_device_id: string;
  chair_device_id: string;
  language?: string | null;
  joined_at?: string;
};

export async function addParticipant(
  sessionId: string,
  payload: { vrDeviceId: string; chairDeviceId: string; language?: string | null }
): Promise<ParticipantRecord> {
  const res = await api.post<{ status: boolean; data: ParticipantRecord }>(`sessions/${sessionId}/participants`, payload);
  const data = (res?.data as { status: boolean; data: ParticipantRecord } | ParticipantRecord);
  return ("data" in data ? data.data : data);
}

export async function removeParticipant(sessionId: string, participantId: string): Promise<void> {
  await api.delete(`sessions/${sessionId}/participants/${participantId}`);
}

export type ParticipantCommand = SessionCommand;

export async function commandParticipant(
  sessionId: string,
  participantId: string,
  cmd: ParticipantCommand,
  options?: { positionMs?: number; durationMs?: number; journeyId?: number }
) {
  const body: { cmd: ParticipantCommand; positionMs?: number; durationMs?: number; journeyId?: number } = { cmd };
  if (typeof options?.positionMs === "number") body.positionMs = options.positionMs;
  if (typeof options?.durationMs === "number") body.durationMs = options.durationMs;
  if (typeof options?.journeyId === "number") body.journeyId = options.journeyId;
  return api.post(`sessions/${sessionId}/participants/${participantId}/commands`, body);
}

// Fetch a session with details (participants, journeys)
export interface SessionDetailsParticipant {
  id: string;
  vr_device_id?: string | null;
  chair_device_id?: string | null;
}
export interface SessionDetailsEnvelope {
  status?: boolean;
  data?: {
    id: string;
    session_type?: string;
    journey_ids?: number[];
    participants?: SessionDetailsParticipant[];
    journeys?: unknown[];
  };
}

export async function getSessionById(sessionId: string): Promise<SessionDetailsEnvelope> {
  const res = await api.get<SessionDetailsEnvelope>(`sessions/${sessionId}`);
  return res?.data as SessionDetailsEnvelope;
}
