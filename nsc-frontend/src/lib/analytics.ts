import api from "./axios";

// Analytics API Client Functions

export interface AnalyticsOverview {
  sessions: SessionMetrics;
  seats: SeatMetrics;
  modules: ModuleMetrics;
  time: TimeMetrics;
}

export interface SessionMetrics {
  total: number;
  byStatus: Array<{ overall_status: string; count: number }>;
  byType: Array<{ session_type: string; count: number }>;
  overTime: Array<{ date: string; count: number }>;
}

export interface SeatMetrics {
  totalSeats: number;
  filledSeats: number;
  utilizationRate: number;
  averageParticipantsPerSession: number;
}

export interface ModuleMetrics {
  total: number;
  mostPopular: {
    journeyId: string;
    journeyName: string;
    count: number;
    percentage: number;
  } | null;
  usage: Array<{
    journeyId: string;
    journeyName: string;
    count: number;
    percentage: number;
  }>;
}

export interface TimeMetrics {
  totalSessions: number;
  totalTimeMinutes: number;
  totalTimeHours: number;
  averageSessionMinutes: number;
  averageSessionHours: number;
}

/**
 * Get comprehensive analytics overview
 */
export async function getAnalyticsOverview(
  startDate?: string,
  endDate?: string
): Promise<AnalyticsOverview> {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);

  const res = await api.get<{ status: boolean; data: AnalyticsOverview }>(
    `analytics/overview?${params.toString()}`
  );
  const responseData = res.data as any;
  return responseData.data || responseData;
}

/**
 * Get session count metrics
 */
export async function getSessionMetrics(
  startDate?: string,
  endDate?: string
): Promise<SessionMetrics> {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);

  const res = await api.get<{ status: boolean; data: SessionMetrics }>(
    `analytics/sessions?${params.toString()}`
  );
  const responseData = res.data as any;
  return responseData.data || responseData;
}

/**
 * Get seat utilization metrics
 */
export async function getSeatUtilization(
  startDate?: string,
  endDate?: string
): Promise<SeatMetrics> {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);

  const res = await api.get<{ status: boolean; data: SeatMetrics }>(
    `analytics/seats?${params.toString()}`
  );
  const responseData = res.data as any;
  return responseData.data || responseData;
}

/**
 * Get VR module usage statistics
 */
export async function getModuleUsage(
  startDate?: string,
  endDate?: string
): Promise<ModuleMetrics> {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);

  const res = await api.get<{ status: boolean; data: ModuleMetrics }>(
    `analytics/modules?${params.toString()}`
  );
  const responseData = res.data as any;
  return responseData.data || responseData;
}

/**
 * Get time tracking metrics
 */
export async function getTimeMetrics(
  startDate?: string,
  endDate?: string
): Promise<TimeMetrics> {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);

  const res = await api.get<{ status: boolean; data: TimeMetrics }>(
    `analytics/time?${params.toString()}`
  );
  const responseData = res.data as any;
  return responseData.data || responseData;
}
