import api from "./axios";

export interface DevicePair {
  id: string;
  pair_name: string;
  vr_device_id: string;
  chair_device_id: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  vr?: {
    id: string;
    deviceId: string;
    display_name?: string;
    metadata?: any;
    lastSeenAt?: string;
  };
  chair?: {
    id: string;
    deviceId: string;
    display_name?: string;
    metadata?: any;
    lastSeenAt?: string;
  };
  vrOnline?: boolean;
  chairOnline?: boolean;
  bothOnline?: boolean;
}

export interface CreateDevicePairData {
  pair_name: string;
  vr_device_id: string;
  chair_device_id: string;
  notes?: string;
}

export interface UpdateDevicePairData {
  pair_name?: string;
  vr_device_id?: string;
  chair_device_id?: string;
  notes?: string;
  is_active?: boolean;
}

/**
 * Create a new device pair
 */
export async function createDevicePair(
  data: CreateDevicePairData,
): Promise<{ status: boolean; data?: DevicePair; message?: string }> {
  try {
    const response = (await api.post("/device-pairs", data)) as {
      data: { status: boolean; data?: DevicePair; message?: string };
    };
    return response.data;
  } catch (error) {
    const message = (error as unknown as { response: { data: { message: string } } })?.response?.data?.message || (error as Error).message;
    return { status: false, message };
  }
}

/**
 * Get all device pairs
 */
export async function getDevicePairs(
  includeInactive = false,
): Promise<{ data: { status: boolean; data?: DevicePair[]; message?: string } }> {
  try {
    const response = (await api.get("/device-pairs", { params: { includeInactive: includeInactive.toString() } })) as {
      data: { status: boolean; data?: DevicePair[]; message?: string };
    };
    return response;
  } catch (error) {
    const message = (error as unknown as { response: { data: { message: string } } })?.response?.data?.message || (error as Error).message;
    return { data: { status: false, message } };
  }
}

/**
 * Get online device pairs
 */
export async function getOnlineDevicePairs(): Promise<{ status: boolean; data?: DevicePair[]; message?: string }> {
  try {
    const response = (await api.get("/device-pairs/online")) as {
      data: { status: boolean; data?: DevicePair[]; message?: string };
    };
    return response.data;
  } catch (error) {
    const message = (error as unknown as { response: { data: { message: string } } })?.response?.data?.message || (error as Error).message;
    return { status: false, message };
  }
}

/**
 * Get a single device pair by ID
 */
export async function getDevicePairById(id: string): Promise<{ status: boolean; data?: DevicePair; message?: string }> {
  try {
    const response = (await api.get(`/device-pairs/${id}`)) as {
      data: { status: boolean; data?: DevicePair; message?: string };
    };
    return response.data;
  } catch (error) {
    const message = (error as unknown as { response: { data: { message: string } } })?.response?.data?.message || (error as Error).message;
    return { status: false, message };
  }
}

/**
 * Update a device pair
 */
export async function updateDevicePair(
  id: string,
  data: UpdateDevicePairData,
): Promise<{ status: boolean; data?: DevicePair; message?: string }> {
  try {
    const response = (await api.patch(`/device-pairs/${id}`, data)) as {
      data: { status: boolean; data?: DevicePair; message?: string };
    };
    return response.data;
  } catch (error: any) {
    return { status: false, message: error.response?.data?.message || error.message };
  }
}

/**
 * Delete a device pair
 */
export async function deleteDevicePair(id: string): Promise<{ status: boolean; message?: string }> {
  try {
    const response = (await api.delete(`/device-pairs/${id}`)) as { data: { status: boolean; message?: string } };
    return response.data;
  } catch (error) {
    const message = (error as unknown as { response: { data: { message: string } } })?.response?.data?.message || (error as Error).message;
    return { status: false, message };
  }
}

/**
 * Get available (unpaired) devices
 */
export async function getAvailableDevices(): Promise<{
  status: boolean;
  data?: { vrDevices: any[]; chairDevices: any[] };
  message?: string;
}> {
  try {
    const response = (await api.get("/device-pairs/available/devices")) as {
      data: { status: boolean; data?: { vrDevices: any[]; chairDevices: any[] }; message?: string };
    };
    return response.data;
  } catch (error) {
    const message = (error as unknown as { response: { data: { message: string } } })?.response?.data?.message || (error as Error).message;
    return { status: false, message };
  }
}

/**
 * Start a session from a device pair
 */
export async function startSessionFromPair(
  pairId: string,
  journeyIds?: number[],
): Promise<{ status: boolean; data?: any; message?: string }> {
  try {
    const response = (await api.post("/sessions/from-pair", {
      pairId,
      journeyIds,
      session_type: "individual",
    })) as { data: { status: boolean; data?: any; message?: string } };
    return response.data;
  } catch (error) {
    const message = (error as unknown as { response: { data: { message: string } } })?.response?.data?.message || (error as Error).message;
    return { status: false, message };
  }
}

/**
 * Create group session from device pairs
 */
export async function createGroupSessionFromPairs(
  pairIds: string[],
  journeyIds?: number[],
): Promise<{ status: boolean; data?: any; message?: string }> {
  try {
    const response = (await api.post("/sessions/group/from-pairs", {
      pairIds,
      journeyIds,
      session_type: "group",
    })) as { data: { status: boolean; data?: any; message?: string } };
    return response.data;
  } catch (error) {
    const message = (error as unknown as { response: { data: { message: string } } })?.response?.data?.message || (error as Error).message;
    return { status: false, message };
  }
}
