import * as QRCode from 'qrcode';
import {
  ALL_CIRCLES,
  UNLOCK_THRESHOLD,
  type AboutSectionData,
  type BootstrapResponse,
  type Circle,
  type Dimension,
  type MightRecord,
  type SseEventPayload,
  type UserProfile,
} from '../shared/types';
import { generateFigureNarrative } from './ai';
import {
  db,
  getAllRoles,
  getAllTags,
  getOrCreateSession,
  getSessionByInviteCode,
  getSessionMights,
  getSocialGraph,
  getSyntheticMights,
  getSyntheticProfiles,
  loadTiagoPreset,
  mapMightRow,
  parseAbout,
  resetSessionToFresh,
  resolveTagSlug,
  seedIfNeeded,
  type SessionRow,
} from './db';
import {
  buildDiscoverProfiles,
  buildTagMap,
  computeAllMightSummary,
  computeDimensionWeights,
  computeJohariStats,
  computeRoleRecommendations,
} from './engine';

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
    },
  });
}

function errorJson(message: string, status = 400): Response {
  return json({ error: message }, status);
}

// In-memory SSE subscribers keyed by sessionId
const sseClients = new Map<string, Set<(chunk: string) => void>>();

function broadcastSse(sessionId: string, payload: SseEventPayload): void {
  const clients = sseClients.get(sessionId);
  if (!clients || clients.size === 0) return;
  const line = `event: ${payload.type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const send of clients) {
    try {
      send(line);
    } catch {
      // Ignore closed stream
    }
  }
}

function getSessionIdFromReq(req: Request, url: URL): string {
  const headerSid = req.headers.get('X-Session-Id') || req.headers.get('x-session-id');
  const querySid = url.searchParams.get('sid');
  const raw = (headerSid || querySid || 'default-session').trim();
  return raw.slice(0, 80) || 'default-session';
}

function getRequestOrigin(req: Request, url: URL): string {
  const origin = req.headers.get('Origin');
  if (origin) return origin.replace(/\/+$/, '');
  const referer = req.headers.get('Referer');
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      // ignore
    }
  }
  const host = req.headers.get('Host');
  if (host) {
    const proto = url.protocol === 'https:' ? 'https' : 'http';
    return `${proto}://${host}`;
  }
  return url.origin;
}

function sanitizeFirstName(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  return cleaned.split(' ')[0].slice(0, 40);
}

function buildUserProfile(
  session: SessionRow,
  received: MightRecord[],
  sentCount: number,
): UserProfile {
  const acceptedCount = received.filter((m) => m.status === 'accepted').length;
  const pendingCount = received.filter((m) => m.status === 'pending').length;
  const selfTags =
    session.self_head && session.self_body && session.self_arms
      ? {
          head: session.self_head,
          body: session.self_body,
          arms: session.self_arms,
        }
      : null;

  return {
    sessionId: session.session_id,
    firstName: session.first_name,
    inviteCode: session.invite_code,
    selfTags,
    figureDescription: session.figure_description,
    tagline: session.tagline,
    artistStyle: session.artist_style || 'modular',
    sentCount: Math.max(session.sent_count, sentCount),
    acceptedCount,
    pendingCount,
    allMightUnlocked: acceptedCount >= UNLOCK_THRESHOLD,
    pedeUnlocked: Math.max(session.sent_count, sentCount) >= 1,
    score: session.score,
    about: parseAbout(session.about_json),
  };
}

function buildBootstrap(sessionId: string, origin: string): BootstrapResponse {
  const session = getOrCreateSession(sessionId);
  const tags = getAllTags();
  const profiles = getSyntheticProfiles();
  const { received, sent } = getSessionMights(sessionId);

  const pending = received.filter((m) => m.status === 'pending');
  const accepted = received.filter((m) => m.status === 'accepted');
  const declined = received.filter((m) => m.status === 'declined');

  const profile = buildUserProfile(session, received, sent.length);
  const allMight = computeAllMightSummary(
    accepted,
    pending,
    sent,
    tags,
    'all',
    profile.firstName,
  );
  const stats = computeJohariStats(profile.selfTags, accepted, tags);

  return {
    profile,
    tags,
    allMight,
    stats,
    inbox: { pending, accepted, declined },
    sentMights: sent,
    inviteUrl: `${origin}/#/convite/${session.invite_code}`,
    quickPeers: profiles.slice(0, 8).map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      company: p.company,
      avatarUrl: p.avatar_url,
      photoUrl: p.photo_url,
    })),
  };
}

async function readJsonBody(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export async function handleApiRequest(req: Request, url: URL): Promise<Response | null> {
  const pathname = url.pathname;
  if (!pathname.startsWith('/api')) return null;

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  seedIfNeeded();

  // 1. Health
  if (pathname === '/api/health' && req.method === 'GET') {
    const tags = getAllTags();
    const profiles = getSyntheticProfiles();
    const roles = getAllRoles();
    return json({
      ok: true,
      db: 'connected',
      tagsCount: tags.length,
      profilesCount: profiles.length,
      rolesCount: roles.length,
      timestamp: new Date().toISOString(),
    });
  }

  // 2. QR Code SVG
  if (pathname === '/api/qr' && req.method === 'GET') {
    const text = url.searchParams.get('text') || 'https://might.epic.pt';
    const svg = await QRCode.toString(text, {
      type: 'svg',
      margin: 1,
      width: 240,
      color: { dark: '#1C1E28', light: '#FFFFFF' },
    });
    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'no-store',
        ...CORS_HEADERS,
      },
    });
  }

  // 3. SSE Stream
  if (pathname === '/api/events' && req.method === 'GET') {
    const sessionId = getSessionIdFromReq(req, url);
    getOrCreateSession(sessionId);

    const encoder = new TextEncoder();
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let sendFn: ((chunk: string) => void) | null = null;

    const stream = new ReadableStream({
      start(controller) {
        sendFn = (chunk: string) => {
          controller.enqueue(encoder.encode(chunk));
        };

        let set = sseClients.get(sessionId);
        if (!set) {
          set = new Set();
          sseClients.set(sessionId, set);
        }
        set.add(sendFn);

        const initPayload: SseEventPayload = {
          type: 'connected',
          messagePt: 'Ligado ao canal em tempo real do MighT.',
          timestamp: new Date().toISOString(),
        };
        sendFn(`event: connected\ndata: ${JSON.stringify(initPayload)}\n\n`);

        heartbeatTimer = setInterval(() => {
          try {
            const hb: SseEventPayload = {
              type: 'heartbeat',
              timestamp: new Date().toISOString(),
            };
            sendFn?.(`event: heartbeat\ndata: ${JSON.stringify(hb)}\n\n`);
          } catch {
            if (heartbeatTimer) clearInterval(heartbeatTimer);
          }
        }, 20_000);

        req.signal.addEventListener('abort', () => {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          if (sendFn) {
            sseClients.get(sessionId)?.delete(sendFn);
          }
          try {
            controller.close();
          } catch {
            // ignore
          }
        });
      },
      cancel() {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (sendFn) {
          sseClients.get(sessionId)?.delete(sendFn);
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        ...CORS_HEADERS,
      },
    });
  }

  // 4. Public Invite Info
  const inviteGetMatch = pathname.match(/^\/api\/invite\/([A-Za-z0-9_-]+)$/);
  if (inviteGetMatch && req.method === 'GET') {
    const code = inviteGetMatch[1];
    const session = getSessionByInviteCode(code);
    if (!session) {
      return errorJson('Convite não encontrado.', 404);
    }
    const tags = getAllTags();
    return json({
      code: session.invite_code,
      requesterFirstName: session.first_name || 'Amigo',
      requesterTags:
        session.self_head && session.self_body && session.self_arms
          ? { head: session.self_head, body: session.self_body, arms: session.self_arms }
          : null,
      tags,
    });
  }

  // 5. Public Invite Submit (Accountless!)
  const invitePostMatch = pathname.match(/^\/api\/invite\/([A-Za-z0-9_-]+)\/submit$/);
  if (invitePostMatch && req.method === 'POST') {
    const code = invitePostMatch[1];
    const session = getSessionByInviteCode(code);
    if (!session) {
      return errorJson('Convite não encontrado.', 404);
    }

    const body = await readJsonBody(req);
    const senderName = sanitizeFirstName(String(body.senderName || ''));
    if (!senderName) {
      return errorJson('Indica o teu primeiro nome.', 400);
    }

    const circle: Circle = ALL_CIRCLES.includes(body.circle) ? body.circle : 'Amigos';
    const tags = getAllTags();
    const headTag = resolveTagSlug(tags, body.head);
    const bodyTag = resolveTagSlug(tags, body.body);
    const armsTag = resolveTagSlug(tags, body.arms);

    if (!headTag || !bodyTag || !armsTag) {
      return errorJson('Escolhe 1 palavra para Cabeça, Corpo e Braços.', 400);
    }

    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : null;
    const id = `inv-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const peerIdx = (Math.floor(Math.random() * 6) + 1);
    const senderAvatarUrl = `/assets/peers/peer-${peerIdx}.jpg`;

    db.query(`
      INSERT INTO mights (id, session_id, direction, sender_name, sender_avatar_url, recipient_id, recipient_name, circle, head_tag, body_tag, arms_tag, note, status, is_synthetic, opt_in_consent, created_at)
      VALUES (?, ?, 'received', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 1, ?)
    `).run(
      id,
      session.session_id,
      senderName,
      senderAvatarUrl,
      session.session_id,
      session.first_name || 'Tu',
      circle,
      headTag,
      bodyTag,
      armsTag,
      note,
      now,
    );

    const inserted = mapMightRow(db.query('SELECT * FROM mights WHERE id = ?').get(id));

    broadcastSse(session.session_id, {
      type: 'might:received',
      might: inserted,
      messagePt: `${senderName} (${circle}) enviou-te um MighT!`,
      timestamp: now,
    });

    return json({
      ok: true,
      might: inserted,
      requesterFirstName: session.first_name || 'Amigo',
      messagePt: `MighT enviado para ${session.first_name || 'Amigo'}!`,
    });
  }

  // Session-scoped endpoints below
  const sessionId = getSessionIdFromReq(req, url);
  const origin = getRequestOrigin(req, url);

  // 6. Bootstrap
  if (pathname === '/api/bootstrap' && req.method === 'GET') {
    return json(buildBootstrap(sessionId, origin));
  }

  // 7. Update Profile Basics
  if (pathname === '/api/me' && req.method === 'PATCH') {
    const session = getOrCreateSession(sessionId);
    const body = await readJsonBody(req);
    const firstName =
      typeof body.firstName === 'string'
        ? body.firstName.trim().slice(0, 50)
        : session.first_name;
    const artistStyle =
      typeof body.artistStyle === 'string' && body.artistStyle.trim()
        ? body.artistStyle.trim().slice(0, 40)
        : session.artist_style;

    db.query(`
      UPDATE sessions SET first_name = ?, artist_style = ?, updated_at = ? WHERE session_id = ?
    `).run(firstName, artistStyle, new Date().toISOString(), sessionId);

    return json(buildBootstrap(sessionId, origin));
  }

  // 8. Save Self MighT (Step 1)
  if (pathname === '/api/me/self-might' && req.method === 'POST') {
    const session = getOrCreateSession(sessionId);
    const body = await readJsonBody(req);
    const tags = getAllTags();
    const tagMap = buildTagMap(tags);

    const headSlug = resolveTagSlug(tags, body.head);
    const bodySlug = resolveTagSlug(tags, body.body);
    const armsSlug = resolveTagSlug(tags, body.arms);

    if (!headSlug || !bodySlug || !armsSlug) {
      return errorJson('Seleciona exatamente 3 palavras válidas (Cabeça, Corpo, Braços).', 400);
    }

    const firstName =
      typeof body.firstName === 'string' && body.firstName.trim()
        ? body.firstName.trim().slice(0, 50)
        : session.first_name || 'Explorador';

    const headTagItem = tagMap.get(headSlug)!;
    const bodyTagItem = tagMap.get(bodySlug)!;
    const armsTagItem = tagMap.get(armsSlug)!;

    const narrative = await generateFigureNarrative(
      headTagItem,
      bodyTagItem,
      armsTagItem,
      'self',
      firstName,
    );

    const newScore = Math.max(session.score, 40);
    db.query(`
      UPDATE sessions
      SET first_name = ?,
          self_head = ?,
          self_body = ?,
          self_arms = ?,
          figure_description = ?,
          tagline = ?,
          score = ?,
          updated_at = ?
      WHERE session_id = ?
    `).run(
      firstName,
      headSlug,
      bodySlug,
      armsSlug,
      narrative.description,
      narrative.tagline,
      newScore,
      new Date().toISOString(),
      sessionId,
    );

    return json(buildBootstrap(sessionId, origin));
  }

  // 9. Update About Sections
  if (pathname === '/api/me/about' && req.method === 'PATCH') {
    const session = getOrCreateSession(sessionId);
    const body = await readJsonBody(req);
    const current = parseAbout(session.about_json);

    const normalizeList = (val: unknown, fallback: string[]) =>
      Array.isArray(val)
        ? val.map((x) => String(x).trim()).filter(Boolean).slice(0, 12)
        : fallback;

    const updated: AboutSectionData = {
      academic: normalizeList(body.academic, current.academic),
      bio: typeof body.bio === 'string' ? body.bio.trim().slice(0, 160) : current.bio,
      experience: normalizeList(body.experience, current.experience),
      likes: normalizeList(body.likes, current.likes),
      expertise: normalizeList(body.expertise, current.expertise),
      wish: normalizeList(body.wish, current.wish),
      contactEmail:
        typeof body.contactEmail === 'string'
          ? body.contactEmail.trim().slice(0, 120)
          : current.contactEmail,
      contactVisible:
        typeof body.contactVisible === 'boolean' ? body.contactVisible : current.contactVisible,
    };

    db.query('UPDATE sessions SET about_json = ?, updated_at = ? WHERE session_id = ?').run(
      JSON.stringify(updated),
      new Date().toISOString(),
      sessionId,
    );

    return json(buildBootstrap(sessionId, origin));
  }

  // 10. Send MighT (Step 2A)
  if (pathname === '/api/mights/send' && req.method === 'POST') {
    const session = getOrCreateSession(sessionId);
    const body = await readJsonBody(req);
    const tags = getAllTags();

    const recipientName = sanitizeFirstName(String(body.recipientName || '')) || String(body.recipientName || '').trim().slice(0, 60);
    if (!recipientName) {
      return errorJson('Indica o nome da pessoa a reconhecer.', 400);
    }

    const circle: Circle = ALL_CIRCLES.includes(body.circle) ? body.circle : 'Colegas';
    const headSlug = resolveTagSlug(tags, body.head);
    const bodySlug = resolveTagSlug(tags, body.body);
    const armsSlug = resolveTagSlug(tags, body.arms);

    if (!headSlug || !bodySlug || !armsSlug) {
      return errorJson('Seleciona 3 palavras válidas (Cabeça, Corpo, Braços).', 400);
    }

    const recipientId =
      typeof body.recipientId === 'string' && body.recipientId.trim()
        ? body.recipientId.trim()
        : `peer-${recipientName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : null;
    const id = `sent-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    db.transaction(() => {
      db.query(`
        INSERT INTO mights (id, session_id, direction, sender_name, sender_avatar_url, recipient_id, recipient_name, circle, head_tag, body_tag, arms_tag, note, status, is_synthetic, opt_in_consent, created_at)
        VALUES (?, ?, 'sent', ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'accepted', 0, 1, ?)
      `).run(
        id,
        sessionId,
        session.first_name || 'Tu',
        recipientId,
        recipientName,
        circle,
        headSlug,
        bodySlug,
        armsSlug,
        note,
        now,
      );

      db.query(`
        UPDATE sessions
        SET sent_count = sent_count + 1,
            score = score + 20,
            updated_at = ?
        WHERE session_id = ?
      `).run(now, sessionId);
    })();

    return json({
      ...buildBootstrap(sessionId, origin),
      sentMight: mapMightRow(db.query('SELECT * FROM mights WHERE id = ?').get(id)),
    });
  }

  // 11. Accept / Decline Incoming MighT (Consent Gate)
  const consentMatch = pathname.match(/^\/api\/mights\/([A-Za-z0-9_-]+)\/(accept|decline)$/);
  if (consentMatch && req.method === 'POST') {
    const [, mightId, action] = consentMatch;
    const session = getOrCreateSession(sessionId);

    const row = db
      .query("SELECT * FROM mights WHERE id = ? AND session_id = ? AND direction = 'received'")
      .get(mightId, sessionId) as any;

    if (!row) {
      return errorJson('MighT não encontrado na tua caixa de entrada.', 404);
    }

    const newStatus = action === 'accept' ? 'accepted' : 'declined';
    const wasPending = row.status === 'pending';
    const now = new Date().toISOString();

    db.transaction(() => {
      db.query('UPDATE mights SET status = ? WHERE id = ?').run(newStatus, mightId);
      if (action === 'accept' && wasPending) {
        db.query('UPDATE sessions SET score = score + 30, updated_at = ? WHERE session_id = ?').run(
          now,
          sessionId,
        );
      }
    })();

    const bootstrap = buildBootstrap(sessionId, origin);
    if (action === 'accept') {
      broadcastSse(sessionId, {
        type: 'might:accepted',
        acceptedCount: bootstrap.profile.acceptedCount,
        allMightUnlocked: bootstrap.profile.allMightUnlocked,
        messagePt: bootstrap.profile.allMightUnlocked
          ? 'All MighT desbloqueado! Já podes explorar como os outros te veem.'
          : `MighT aceite (${bootstrap.profile.acceptedCount}/${UNLOCK_THRESHOLD}).`,
        timestamp: now,
      });
    }

    return json(bootstrap);
  }

  // 12. All MighT (Circle Filter)
  if (pathname === '/api/me/all-might' && req.method === 'GET') {
    const session = getOrCreateSession(sessionId);
    const tags = getAllTags();
    const { received, sent } = getSessionMights(sessionId);
    const pending = received.filter((m) => m.status === 'pending');
    const accepted = received.filter((m) => m.status === 'accepted');

    const rawCircle = url.searchParams.get('circle') || 'all';
    const circleFilter: Circle | 'all' = ALL_CIRCLES.includes(rawCircle as Circle)
      ? (rawCircle as Circle)
      : 'all';

    return json(
      computeAllMightSummary(
        accepted,
        pending,
        sent,
        tags,
        circleFilter,
        session.first_name,
      ),
    );
  }

  // 13. Johari Stats
  if (pathname === '/api/me/stats' && req.method === 'GET') {
    const session = getOrCreateSession(sessionId);
    const tags = getAllTags();
    const { received } = getSessionMights(sessionId);
    const accepted = received.filter((m) => m.status === 'accepted');
    const selfTags =
      session.self_head && session.self_body && session.self_arms
        ? { head: session.self_head, body: session.self_body, arms: session.self_arms }
        : null;
    return json(computeJohariStats(selfTags, accepted, tags));
  }

  // 14. Discover Similar Profiles
  if (pathname === '/api/discover' && req.method === 'GET') {
    const session = getOrCreateSession(sessionId);
    const tags = getAllTags();
    const profiles = getSyntheticProfiles();
    const syntheticMights = getSyntheticMights();
    const { received } = getSessionMights(sessionId);
    const accepted = received.filter((m) => m.status === 'accepted');
    const selfTags =
      session.self_head && session.self_body && session.self_arms
        ? { head: session.self_head, body: session.self_body, arms: session.self_arms }
        : null;

    const rawDim = url.searchParams.get('dimension') || 'all';
    const dimFilter: Dimension | 'all' =
      rawDim === 'personality' || rawDim === 'power' || rawDim === 'character' ? rawDim : 'all';

    const userWeights = computeDimensionWeights(accepted, tags);
    const ranked = buildDiscoverProfiles(
      userWeights,
      selfTags,
      profiles,
      syntheticMights,
      tags,
      dimFilter,
    );

    return json({
      unlocked: accepted.length >= UNLOCK_THRESHOLD,
      dimension: dimFilter,
      profiles: ranked,
    });
  }

  // 15. Ideal Roles & Career Paths (Agora -> Próximo -> Desafio)
  if (pathname === '/api/roles' && req.method === 'GET') {
    const session = getOrCreateSession(sessionId);
    const tags = getAllTags();
    const profiles = getSyntheticProfiles();
    const syntheticMights = getSyntheticMights();
    const roles = getAllRoles();
    const { received } = getSessionMights(sessionId);
    const accepted = received.filter((m) => m.status === 'accepted');
    const selfTags =
      session.self_head && session.self_body && session.self_arms
        ? { head: session.self_head, body: session.self_body, arms: session.self_arms }
        : null;

    const userWeights = computeDimensionWeights(accepted, tags);
    const rankedPeers = buildDiscoverProfiles(userWeights, selfTags, profiles, syntheticMights, tags);
    const res = computeRoleRecommendations(userWeights, selfTags, rankedPeers, roles, tags);
    return json({
      ...res,
      unlocked: accepted.length >= UNLOCK_THRESHOLD,
    });
  }

  // 16. Social Graph (63 nodes + 1,110 edges)
  if (pathname === '/api/network/graph' && req.method === 'GET') {
    return json(getSocialGraph());
  }

  // 17. Demo Mode: Simulate Receiving 1 or 3 MighTs from Room Peers
  if (pathname === '/api/demo/simulate-receive' && req.method === 'POST') {
    const session = getOrCreateSession(sessionId);
    const body = await readJsonBody(req);
    const count = body.count === 1 ? 1 : 3;
    const autoAccept = Boolean(body.autoAccept);

    const tags = getAllTags();
    const profiles = getSyntheticProfiles();
    const { received } = getSessionMights(sessionId);
    const existingSenders = new Set(received.map((m) => m.senderName));

    const heads = tags.filter((t) => t.dimension === 'personality');
    const bodies = tags.filter((t) => t.dimension === 'power');
    const arms = tags.filter((t) => t.dimension === 'character');

    const pickDifferent = (list: typeof tags, avoid?: string | null) => {
      const filtered = list.filter((t) => t.slug !== avoid);
      const pool = filtered.length > 0 ? filtered : list;
      return pool[Math.floor(Math.random() * pool.length)]?.slug ?? '';
    };

    const circlesPool: Circle[] = ['Amigos', 'Colegas', 'Família', 'Comunidade', 'Escola', 'Clientes'];
    const notesPool = [
      'Admiro imenso a forma como desbloqueias problemas difíceis na equipa!',
      'Tens um talento natural para fazer as coisas acontecer com boa energia.',
      'Reconhecimento enviado ao vivo da sala — continua a inspirar!',
      'Sempre presente quando é preciso tomar decisões com clareza.',
    ];

    const availablePeers = profiles.filter((p) => !existingSenders.has(p.name));
    const peerPool = availablePeers.length >= count ? availablePeers : profiles;

    const now = Date.now();
    const createdMights: MightRecord[] = [];

    db.transaction(() => {
      for (let i = 0; i < count; i++) {
        const peer = peerPool[(Math.floor(Math.random() * peerPool.length) + i) % peerPool.length];
        const senderFirst = peer?.name || `Convidado ${i + 1}`;
        const circle = circlesPool[(received.length + i) % circlesPool.length];

        // Mix 1-2 matching self tags (if set) + superpower tags so Johari Stats shine!
        const useSelfHead = i === 0 && Boolean(session.self_head);
        const useSelfBody = i === 1 && Boolean(session.self_body);
        const h = useSelfHead ? session.self_head! : pickDifferent(heads, session.self_head);
        const b = useSelfBody ? session.self_body! : pickDifferent(bodies, session.self_body);
        const a = pickDifferent(arms, session.self_arms);

        const id = `demo-${crypto.randomUUID().slice(0, 8)}`;
        const ts = new Date(now + i * 200).toISOString();
        const status = autoAccept ? 'accepted' : 'pending';
        const peerPhotoFallback = `/assets/peers/peer-${((received.length + i) % 6) + 1}.jpg`;
        const avatar = peer?.photo_url || peerPhotoFallback;
        const note = notesPool[(received.length + i) % notesPool.length];

        db.query(`
          INSERT INTO mights (id, session_id, direction, sender_name, sender_avatar_url, recipient_id, recipient_name, circle, head_tag, body_tag, arms_tag, note, status, is_synthetic, opt_in_consent, created_at)
          VALUES (?, ?, 'received', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
        `).run(
          id,
          sessionId,
          senderFirst,
          avatar,
          sessionId,
          session.first_name || 'Tu',
          circle,
          h,
          b,
          a,
          note,
          status,
          ts,
        );

        const row = mapMightRow(db.query('SELECT * FROM mights WHERE id = ?').get(id));
        createdMights.push(row);
      }

      if (autoAccept) {
        db.query('UPDATE sessions SET score = score + ?, updated_at = ? WHERE session_id = ?').run(
          count * 30,
          new Date().toISOString(),
          sessionId,
        );
      }
    })();

    const bootstrap = buildBootstrap(sessionId, origin);
    const lastMight = createdMights[createdMights.length - 1];
    broadcastSse(sessionId, {
      type: autoAccept ? 'might:accepted' : 'might:received',
      might: lastMight,
      acceptedCount: bootstrap.profile.acceptedCount,
      allMightUnlocked: bootstrap.profile.allMightUnlocked,
      messagePt:
        count === 1
          ? `${lastMight.senderName} (${lastMight.circle}) enviou-te um MighT!`
          : `Recebeste ${count} novos MighTs de colegas da sala!`,
      timestamp: new Date().toISOString(),
    });

    return json(bootstrap);
  }

  // 18. Demo Mode: Load Preset ('tiago' | 'fresh')
  if (pathname === '/api/demo/load-preset' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const preset = body.preset === 'fresh' ? 'fresh' : 'tiago';

    if (preset === 'fresh') {
      resetSessionToFresh(sessionId);
    } else {
      loadTiagoPreset(sessionId);
    }

    const bootstrap = buildBootstrap(sessionId, origin);
    broadcastSse(sessionId, {
      type: 'demo:updated',
      acceptedCount: bootstrap.profile.acceptedCount,
      allMightUnlocked: bootstrap.profile.allMightUnlocked,
      messagePt:
        preset === 'fresh'
          ? 'Sessão reiniciada para novo utilizador.'
          : 'Demo completo do Tiago Forjaz carregado!',
      timestamp: new Date().toISOString(),
    });

    return json(bootstrap);
  }

  return errorJson(`Rota não encontrada: ${req.method} ${pathname}`, 404);
}
