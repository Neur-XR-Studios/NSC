import api from "./axios";

export type Journey = {
  id: number;
  title: string;
  description?: string;
  video_id?: number;
  telemetry_id?: number;
  created_at?: string;
  updated_at?: string;
};

export type JourneyListResponse = {
  status: boolean;
  data: {
    data: Journey[];
    total: number;
    page: number;
    limit: number;
  };
};

export type JourneyResponse = {
  status: boolean;
  data: Journey;
};

/**
 * Fetch list of journeys
 */
export async function listJourneys(params?: { page?: number; limit?: number }): Promise<JourneyListResponse> {
  return api.get<JourneyListResponse>("journeys", params);
}

/**
 * Get single journey by ID
 */
export async function getJourneyById(id: number | string): Promise<JourneyResponse> {
  return api.get<JourneyResponse>(`journeys/${id}`);
}

/**
 * Create a new journey
 */
export async function createJourney(payload: {
  title: string;
  description?: string;
  video_id?: number;
  telemetry_id?: number;
  audio_track_ids?: number[];
}): Promise<JourneyResponse> {
  return api.post<JourneyResponse>("journeys", payload);
}

/**
 * Update an existing journey
 */
export async function updateJourney(
  id: number | string,
  payload: {
    title?: string;
    description?: string;
    video_id?: number;
    telemetry_id?: number;
    audio_track_ids?: number[];
  }
): Promise<JourneyResponse> {
  return api.patch<JourneyResponse>(`journeys/${id}`, payload);
}

/**
 * Delete a journey (removes journey record AND associated files)
 * Backend will:
 * - Delete journey record from database
 * - Delete associated audio tracks
 * - Delete video file and thumbnail
 * - Delete telemetry file
 * All files are permanently removed from storage
 */
export async function deleteJourney(id: number | string): Promise<{ status: boolean; message: string }> {
  return api.delete<{ status: boolean; message: string }>(`journeys/${id}`);
}
