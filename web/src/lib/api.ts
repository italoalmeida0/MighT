import type {
  AboutSectionData,
  AllMightSummary,
  BootstrapResponse,
  Circle,
  Dimension,
  DiscoverResponse,
  InviteInfoResponse,
  JohariStats,
  MightRecord,
  RolesResponse,
  SocialGraphData,
  SseEventPayload,
} from '../../../shared/types';

const SESSION_STORAGE_KEY = 'might_session_id';

export function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr-session';
  let sid = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!sid) {
    sid =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `might-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(SESSION_STORAGE_KEY, sid);
  }
  return sid;
}

export function setSessionId(sid: string): void {
  if (typeof window !== 'undefined' && sid) {
    window.localStorage.setItem(SESSION_STORAGE_KEY, sid);
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('X-Session-Id', getSessionId());
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, {
    ...init,
    headers,
  });

  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) msg = String(data.error);
      else if (data?.message) msg = String(data.message);
    } catch {
      // ignore non-json error body
    }
    throw new ApiError(res.status, msg);
  }

  return (await res.json()) as T;
}

export function fetchBootstrap(): Promise<BootstrapResponse> {
  return apiFetch<BootstrapResponse>('/api/bootstrap');
}

export function updateMe(body: {
  firstName?: string;
  artistStyle?: string;
}): Promise<BootstrapResponse> {
  return apiFetch<BootstrapResponse>('/api/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function saveSelfMight(body: {
  firstName?: string;
  head: string;
  body: string;
  arms: string;
}): Promise<BootstrapResponse> {
  return apiFetch<BootstrapResponse>('/api/me/self-might', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateAbout(body: Partial<AboutSectionData>): Promise<BootstrapResponse> {
  return apiFetch<BootstrapResponse>('/api/me/about', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function sendMight(body: {
  recipientName: string;
  recipientId?: string;
  circle: Circle;
  head: string;
  body: string;
  arms: string;
  note?: string;
}): Promise<BootstrapResponse> {
  return apiFetch<BootstrapResponse>('/api/mights/send', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function acceptMight(id: string): Promise<BootstrapResponse> {
  return apiFetch<BootstrapResponse>(`/api/mights/${encodeURIComponent(id)}/accept`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function declineMight(id: string): Promise<BootstrapResponse> {
  return apiFetch<BootstrapResponse>(`/api/mights/${encodeURIComponent(id)}/decline`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function fetchAllMight(circle: Circle | 'all' = 'all'): Promise<AllMightSummary> {
  return apiFetch<AllMightSummary>(
    `/api/me/all-might?circle=${encodeURIComponent(circle)}`
  );
}

export function fetchStats(): Promise<JohariStats> {
  return apiFetch<JohariStats>('/api/me/stats');
}

export function fetchDiscover(dimension: Dimension | 'all' = 'all'): Promise<DiscoverResponse> {
  return apiFetch<DiscoverResponse>(
    `/api/discover?dimension=${encodeURIComponent(dimension)}`
  );
}

export function fetchRoles(): Promise<RolesResponse> {
  return apiFetch<RolesResponse>('/api/roles');
}

export function fetchNetworkGraph(): Promise<SocialGraphData> {
  return apiFetch<SocialGraphData>('/api/network/graph');
}

export function fetchInviteInfo(code: string): Promise<InviteInfoResponse> {
  return apiFetch<InviteInfoResponse>(`/api/invite/${encodeURIComponent(code)}`);
}

export function submitInviteMight(
  code: string,
  body: {
    senderName: string;
    circle: Circle;
    head: string;
    body: string;
    arms: string;
    note?: string;
  }
): Promise<{ ok: boolean; might: MightRecord; messagePt: string }> {
  return apiFetch<{ ok: boolean; might: MightRecord; messagePt: string }>(
    `/api/invite/${encodeURIComponent(code)}/submit`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
}

export function demoSimulateReceive(
  count: 1 | 3 = 1,
  autoAccept = false
): Promise<BootstrapResponse> {
  return apiFetch<BootstrapResponse>('/api/demo/simulate-receive', {
    method: 'POST',
    body: JSON.stringify({ count, autoAccept }),
  });
}

export function demoLoadPreset(preset: 'tiago' | 'fresh'): Promise<BootstrapResponse> {
  return apiFetch<BootstrapResponse>('/api/demo/load-preset', {
    method: 'POST',
    body: JSON.stringify({ preset }),
  });
}

export function getQrUrl(text: string): string {
  return `/api/qr?text=${encodeURIComponent(text)}`;
}

export function subscribeEvents(onEvent: (payload: SseEventPayload) => void): () => void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return () => {};
  }

  const sid = getSessionId();
  const es = new EventSource(`/api/events?sid=${encodeURIComponent(sid)}`);

  const handleRaw = (ev: MessageEvent) => {
    try {
      const data = JSON.parse(ev.data) as SseEventPayload;
      onEvent(data);
    } catch {
      // ignore malformed event payload
    }
  };

  es.onmessage = handleRaw;
  const namedEvents: SseEventPayload['type'][] = [
    'connected',
    'might:received',
    'might:accepted',
    'demo:updated',
  ];
  for (const evt of namedEvents) {
    es.addEventListener(evt, handleRaw as EventListener);
  }

  return () => {
    es.close();
  };
}
