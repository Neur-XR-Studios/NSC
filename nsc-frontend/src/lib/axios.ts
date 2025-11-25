import axios, {
  type AxiosRequestConfig,
  type AxiosRequestHeaders,
  type AxiosResponse,
} from "axios";
import { useAuthStore } from "@/store/auth";

// Helper to check JWT expiration safely
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const exp = payload?.exp;
    if (!exp) return false;
    const nowSec = Math.floor(Date.now() / 1000);
    return exp <= nowSec;
  } catch {
    // If token can't be parsed, treat as expired to force refresh/logout
    return true;
  }
}

// Helper to set Authorization header with proper typing
function setAuthHeader(config: AxiosRequestConfig, token: string) {
  config.headers = config.headers ?? {};
  const headers = config.headers as AxiosRequestHeaders;
  headers["Authorization"] = `Bearer ${token}`;
}

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8001/api",
  timeout: 300000, // 5 minutes - allow time for large file uploads
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  withCredentials: true,
});
let isRefreshing = false;
type QueueItem = {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
};

let failedQueue: QueueItem[] = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

instance.interceptors.request.use(
  async (config) => {
    // Always ensure headers object exists
    config.headers = config.headers || {};

    // Check if this is a multipart/form-data request
    // We need to check if data is FormData BEFORE axios sets the Content-Type
    const isMultipart = config.data instanceof FormData;

    const token =
      sessionStorage.getItem("token") ||
      useAuthStore.getState().accessToken ||
      "";
    const refreshToken = sessionStorage.getItem("refreshToken") || "";

    console.log('[Axios Interceptor] Request to:', config.url);
    console.log('[Axios Interceptor] Is FormData:', isMultipart);
    console.log('[Axios Interceptor] Has token:', !!token);
    console.log('[Axios Interceptor] Token expired:', token ? isTokenExpired(token) : 'N/A');

    // If token is expired and we have a refresh token, DON'T send the request yet
    // Wait for refresh to complete first
    if (token && refreshToken && isTokenExpired(token)) {
      if (!isRefreshing) {
        isRefreshing = true;
        console.log('[Axios Interceptor] Token expired, refreshing...');
        console.log('[Axios Interceptor] Refresh token:', refreshToken.substring(0, 20) + '...');
        try {
          const res = await axios.post(
            `${import.meta.env.VITE_API_URL || "http://localhost:8001/api"
            }/auth/refresh-token`,
            { refresh_token: refreshToken },
            { withCredentials: true }
          );

          console.log('[Axios Interceptor] Refresh response:', res.data);

          const newAccessToken: string = res.data?.access?.token;
          const newRefreshToken: string = res.data?.refresh?.token;

          console.log('[Axios Interceptor] New access token exists:', !!newAccessToken);
          console.log('[Axios Interceptor] New refresh token exists:', !!newRefreshToken);

          if (!newAccessToken || !newRefreshToken)
            throw new Error("Invalid refresh response");

          // Persist
          sessionStorage.setItem("token", newAccessToken);
          sessionStorage.setItem("refreshToken", newRefreshToken);

          // Update current request header with NEW token
          setAuthHeader(config, newAccessToken);
          processQueue(null, newAccessToken);

          // If multipart, let browser set Content-Type with boundary
          if (isMultipart) {
            delete config.headers['Content-Type'];
          }

          console.log('[Axios Interceptor] Token refreshed successfully');
          return config;
        } catch (err) {
          console.error('[Axios Interceptor] Token refresh failed:', err);
          const errorDetails = (err as any)?.response?.data || (err as Error)?.message || 'Unknown error';
          console.error('[Axios Interceptor] Error details:', errorDetails);
          // On refresh failure, logout and reject queued
          try {
            useAuthStore.getState().logout();
          } catch (e) {
            console.warn("Logout failed after token refresh error", e);
          }
          processQueue(err, null);
          return Promise.reject(err);
        } finally {
          isRefreshing = false;
        }
      }

      // If a refresh is already in progress, queue this request
      // DON'T attach the expired token - wait for the new one
      console.log('[Axios Interceptor] Refresh in progress, queueing request');
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (newToken: string) => {
            setAuthHeader(config, newToken);
            // If multipart, let browser set Content-Type with boundary
            if (isMultipart) {
              delete config.headers['Content-Type'];
            }
            resolve(config);
          },
          reject,
        });
      });
    }

    // Only attach token if it's NOT expired
    if (token && !isTokenExpired(token)) {
      setAuthHeader(config, token);
    } else if (!token) {
      console.warn('[Axios Interceptor] No token available for request');
    }

    // If multipart/form-data, let browser set Content-Type with boundary
    // This is critical for file uploads to work correctly
    if (isMultipart) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => Promise.reject(error)
);

instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest: AxiosRequestConfig & { _retry?: boolean } =
      error?.config || {};

    if (
      error?.response &&
      error.response.status === 401 &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      // If refresh in progress, wait
      if (isRefreshing) {
        try {
          const token = await new Promise<string>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          });
          setAuthHeader(originalRequest, token);
          return instance(originalRequest);
        } catch (err) {
          return Promise.reject(err);
        }
      }

      // If not refreshing, allow request interceptor to handle on retry
      const token = sessionStorage.getItem("token") || "";
      const refreshToken = sessionStorage.getItem("refreshToken") || "";
      if (token && refreshToken && isTokenExpired(token)) {
        return instance(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);

const responseBody = <T>(res: AxiosResponse<T>) => res.data;

const api = {
  get: <T = unknown>(url: string, params?: Record<string, unknown>) =>
    instance.get<T>(url, { params }).then(responseBody),
  post: <T = unknown>(
    url: string,
    body?: unknown,
    config?: AxiosRequestConfig
  ) => instance.post<T>(url, body, config).then(responseBody),
  put: <T = unknown>(url: string, body?: unknown) =>
    instance.put<T>(url, body).then(responseBody),
  patch: <T = unknown>(url: string, body?: unknown) =>
    instance.patch<T>(url, body).then(responseBody),
  delete: <T = unknown>(url: string) =>
    instance.delete<T>(url).then(responseBody),
};

export default api;
