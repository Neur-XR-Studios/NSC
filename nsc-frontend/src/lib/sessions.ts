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
  options?: { positionMs?: number; durationMs?: number; videoId?: string; journeyId?: number; language?: string }
) {
  const body: { cmd: SessionCommand; positionMs?: number; durationMs?: number; videoId?: string; journeyId?: number; language?: string } = { cmd };
  if (typeof options?.positionMs === "number") body.positionMs = options.positionMs;
  if (typeof options?.durationMs === "number") body.durationMs = options.durationMs;
  if (options?.videoId) body.videoId = options.videoId;
  if (typeof options?.journeyId === "number") body.journeyId = options.journeyId;
  if (typeof options?.language === "string") body.language = options.language;
  return api.post(`sessions/${sessionId}/commands`, body);
}

// Participants (Individual flow)
export type ParticipantRecord = {
  id: string;
  session_id: string;
  vr_device_id: string;
  chair_device_id: string;
  language?: string | null;
  journey_id?: number | null;
  current_journey_id?: number | null;
  created_at?: string;
  updated_at?: string;
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
  options?: { positionMs?: number; durationMs?: number; journeyId?: number; language?: string }
) {
  const body: { cmd: ParticipantCommand; positionMs?: number; durationMs?: number; journeyId?: number; language?: string } = { cmd };
  if (typeof options?.positionMs === "number") body.positionMs = options.positionMs;
  if (typeof options?.durationMs === "number") body.durationMs = options.durationMs;
  if (typeof options?.journeyId === "number") body.journeyId = options.journeyId;
  if (options?.language) body.language = options.language;
  return api.post(`sessions/${sessionId}/participants/${participantId}/commands`, body);
}

// Fetch a session with details (participants, journeys)
export interface SessionDetailsParticipant {
  id: string;
  vr_device_id?: string | null;
  chair_device_id?: string | null;
  journey_id?: number | null;
  current_journey_id?: number | null;
  language?: string | null;
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
  const res = await api.get<any>(`sessions/${sessionId}`);
  const body = res?.data;
  // Handle both shapes:
  // 1) { status: boolean, data: { ...session... } }
  // 2) { id: string, status: 'ready' | 'running' | ..., participants: [...] }
  if (body && typeof body === 'object' && 'data' in body && typeof (body as any).status === 'boolean') {
    return { status: (body as any).status, data: (body as any).data } as SessionDetailsEnvelope;
  }
  // Fallback: treat body as the raw session object
  return { status: true, data: body as SessionDetailsEnvelope['data'] } as SessionDetailsEnvelope;
}

// Session Feedback APIs
export interface SessionFeedback {
  id: string;
  session_id: string;
  rating: number;
  feedback_text?: string | null;
  created_at: string;
  updated_at: string;
}

export async function submitSessionFeedback(
  sessionId: string,
  rating: number,
  feedbackText?: string
): Promise<SessionFeedback> {
  const body = {
    session_id: sessionId,
    rating,
    feedback_text: feedbackText || null,
  };
  const res = await api.post<{ status: boolean; data: SessionFeedback }>("session-feedbacks", body);
  const responseData = res.data as any;
  return responseData?.data || responseData;
}

export async function getSessionFeedbacks(params: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<{
  data: SessionFeedback[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const res = await api.get<{ status: boolean; data: any }>("session-feedbacks", params);
  return res.data?.data || res.data as any;
}

export async function getFeedbackStats(): Promise<{
  total_count: number;
  average_rating: string;
  min_rating: number;
  max_rating: number;
  distribution: Record<number, number>;
}> {
  const res = await api.get<{ status: boolean; data: any }>("session-feedbacks/stats/all");
  return res.data?.data || res.data as any;
}

export async function cleanupSessions(): Promise<{ status: boolean; message: string }> {
  const res = await api.post<{ status: boolean; message: string; data?: any }>("sessions/cleanup");
  return res.data as { status: boolean; message: string };
}

