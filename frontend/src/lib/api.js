import axios from "axios";

// Helper to retrieve the current backend URL
export const getBackendUrl = () => {
  const customUrl = localStorage.getItem("pos_backend_url");
  if (customUrl) return customUrl;
  return process.env.REACT_APP_BACKEND_URL || "";
};

// Object that converts to the dynamic API string when used in template strings
export const API = {
  toString: () => `${getBackendUrl()}/api`
};

const api = axios.create({
  withCredentials: true,
});

// Interceptor to dynamically set baseURL and attach authentication token
api.interceptors.request.use((cfg) => {
  cfg.baseURL = `${getBackendUrl()}/api`;
  const t = localStorage.getItem("pos_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export default api;
