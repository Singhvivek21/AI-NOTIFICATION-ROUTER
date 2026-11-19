import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

const api: AxiosInstance = axios.create({
  baseURL: (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL || '/api',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => config,
  (error: AxiosError) => Promise.reject(error)
);

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Only retry transient GET network/503 errors; never silently retry POST Gemini calls
    if (
      originalRequest &&
      !originalRequest._retry &&
      originalRequest.method?.toLowerCase() === 'get' &&
      (!error.response || error.response.status === 503)
    ) {
      originalRequest._retry = true;
      await new Promise((resolve) => setTimeout(resolve, 800));
      return api(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default api;
