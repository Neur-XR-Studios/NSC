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
  timeout: 5000,
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

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else if (token) prom.resolve(token);
    else prom.reject(new Error("No token available"));
  });
  failedQueue = [];
};

instance.interceptors.request.use(
  async (config) => {
    // Always ensure headers object exists
    config.headers = config.headers || {};

    const token =
      sessionStorage.getItem("token") ||
      useAuthStore.getState().accessToken ||
      "";
    // const refreshToken = sessionStorage.getItem("refreshToken") || "";

    // If token is expired and we have a refresh token, try to get a new access token
    // if (token && refreshToken && isTokenExpired(token)) {
    //   if (!isRefreshing) {
    //     isRefreshing = true;
    //     try {
    //       const res = await axios.post(
    //         `${
    //           import.meta.env.VITE_API_URL || "http://localhost:8001/api"
    //         }/auth/refresh-tokens`,
    //         { refreshToken },
    //         { withCredentials: true }
    //       );

    //       const newAccessToken: string = res.data?.access?.token;
    //       const newRefreshToken: string = res.data?.refresh?.token;

    //       if (!newAccessToken || !newRefreshToken)
    //         throw new Error("Invalid refresh response");

    //       // Persist
    //       sessionStorage.setItem("token", newAccessToken);
    //       sessionStorage.setItem("refreshToken", newRefreshToken);

    //       // Update current request header and flush queue
    //       setAuthHeader(config, newAccessToken);
    //       processQueue(null, newAccessToken);

    //       return config;
    //     } catch (err) {
    //       // On refresh failure, logout and reject queued
    //       try {
    //         useAuthStore.getState().logout();
    //       } catch (e) {
    //         console.warn("Logout failed after token refresh error", e);
    //       }
    //       processQueue(err, null);
    //       return Promise.reject(err);
    //     } finally {
    //       isRefreshing = false;
    //     }
    //   }

    //   // If a refresh is already in progress, queue this request
    //   return new Promise((resolve, reject) => {
    //     failedQueue.push({
    //       resolve: (newToken: string) => {
    //         setAuthHeader(config, newToken);
    //         resolve(config);
    //       },
    //       reject,
    //     });
    //   });
    // }

    // If we have a valid token, attach it
    if (token) {
      setAuthHeader(config, token);
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
