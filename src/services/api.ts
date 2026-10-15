import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

// Create Axios instance with default config
const api: AxiosInstance = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_BASE_URL || '/api', // Fallback to local /api proxy
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add auth tokens here if needed
    // const token = localStorage.getItem('token');
    // if (token && config.headers) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response Interceptor for generic error handling and retry logic
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Simple Retry Logic for 5xx errors or network errors
    if (
      originalRequest && 
      !originalRequest._retry && 
      (!error.response || (error.response.status >= 500 && error.response.status <= 599))
    ) {
      originalRequest._retry = true;
      try {
        // Wait 1 second before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        return api(originalRequest);
      } catch (retryError) {
        return Promise.reject(retryError);
      }
    }

    // Handle standard errors
    if (error.response) {
      console.error(`API Error: ${error.response.status} - ${error.response.statusText}`);
      // Handle specific status codes
      if (error.response.status === 401) {
        // Handle unauthorized (e.g., redirect to login)
      }
    } else if (error.request) {
      console.error('Network Error: No response received from server.');
    } else {
      console.error(`Request Error: ${error.message}`);
    }

    return Promise.reject(error);
  }
);

export default api;
