import axios, { AxiosHeaders } from "axios";
import { clearSession, loadSession } from "./storage";

export const API_URL = (import.meta.env.VITE_API_URL as string) || "http://127.0.0.1:8080";

export const http = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

http.interceptors.request.use((config) => {
    const session = loadSession();

    const headers =
        config.headers instanceof AxiosHeaders
            ? config.headers
            : new AxiosHeaders(config.headers);

    if (session?.token) {
        headers.set("Authorization", `Bearer ${session.token}`);
    }

    config.headers = headers;
    return config;
});

http.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error?.response?.status === 401) {
            clearSession();
        }
        return Promise.reject(error);
    },
);