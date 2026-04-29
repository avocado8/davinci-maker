import type { PipelineParams, PipelineResponse, SvgPipelineParams, SvgPipelineResponse } from "./types";

const BASE = (import.meta.env.VITE_API_URL as string) ?? "http://localhost:8000";

function getToken(): string | null {
  return sessionStorage.getItem("auth_token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handleUnauthorized(): never {
  sessionStorage.removeItem("auth_token");
  window.location.reload();
  throw new Error("세션이 만료되었습니다. 다시 로그인해 주세요.");
}

export async function login(password: string): Promise<string> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error("비밀번호가 올바르지 않습니다.");
  const data = await res.json();
  return data.token as string;
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/auth/logout`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
  sessionStorage.removeItem("auth_token");
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`);
    const data = await res.json();
    return data.status === "ok";
  } catch {
    return false;
  }
}

export async function runImagePipeline(
  file: File,
  params: PipelineParams
): Promise<PipelineResponse> {
  const fd = new FormData();
  fd.append("image", file);
  fd.append("remove_bg", String(params.remove_bg));
  fd.append("extract_internal", String(params.extract_internal));
  fd.append("alpha_threshold", String(params.alpha_threshold));
  fd.append("canny_low", String(params.canny_low));
  fd.append("canny_high", String(params.canny_high));
  fd.append("min_contour_area", String(params.min_contour_area));
  fd.append("simplify", String(params.simplify));
  fd.append("simplify_epsilon", String(params.simplify_epsilon));
  fd.append("max_stroke_count", String(params.max_stroke_count));
  fd.append("min_stroke_length", String(params.min_stroke_length));

  const res = await fetch(`${BASE}/pipeline/image`, {
    method: "POST",
    body: fd,
    headers: { ...authHeaders() },
  });
  if (res.status === 401) handleUnauthorized();
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`파이프라인 오류: ${text}`);
  }
  return res.json();
}

export async function runSvgPipeline(
  params: SvgPipelineParams
): Promise<SvgPipelineResponse> {
  const res = await fetch(`${BASE}/pipeline/svg`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(params),
  });
  if (res.status === 401) handleUnauthorized();
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SVG 파이프라인 오류: ${text}`);
  }
  return res.json();
}
