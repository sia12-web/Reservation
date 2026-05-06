import { httpPost, httpGet } from "./httpClient";

export async function adminLogin(pin: string): Promise<{ message: string }> {
    return httpPost<{ message: string }>("/admin/login", { pin });
}

export async function adminLogout(): Promise<{ message: string }> {
    return httpPost<{ message: string }>("/admin/logout", {});
}

export async function verifySession(): Promise<{ authenticated: boolean }> {
    return httpGet<{ authenticated: boolean }>("/admin/me");
}
