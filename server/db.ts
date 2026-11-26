import { Database } from 'bun:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ALL_CIRCLES,
  GROUP_COLORS,
  type AboutSectionData,
  type BodyPart,
  type Circle,
  type Dimension,
  type MightRecord,
  type MightStatus,
  type SocialGraphData,
  type SocialGraphEdge,
  type SocialGraphNode,
  type TagItem,
} from '../shared/types';

export interface SessionRow {
  session_id: string;
  first_name: string;
  invite_code: string;
  self_head: string | null;
  self_body: string | null;
  self_arms: string | null;
  figure_description: string;
  tagline: string;
  artist_style: string;
  sent_count: number;
  score: number;
  about_json: string;
  created_at: string;
  updated_at: string;
}

export interface SyntheticProfileRow {
  id: string;
  name: string;
  role: string;
  company: string;
  group_name: string;
  career_level: 'now' | 'next' | 'stretch';
  bio: string;
  avatar_url: string;
  photo_url: string | null;
  self_head: string;
  self_body: string;
  self_arms: string;
  tagline_pt: string;
  score: number;
}

export interface RoleRow {
  slug: string;
  title_pt: string;
  track_pt: string;
  level: 'now' | 'next' | 'stretch';
  summary_pt: string;
  tag_weights: Record<string, number>;
  sample_companies: string[];
  hypothesis_template_pt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'might.db');
const SEED_DIR = path.join(process.cwd(), 'server', 'data');

fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(DB_PATH, { create: true });
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL DEFAULT '',
    invite_code TEXT NOT NULL UNIQUE,
    self_head TEXT,
    self_body TEXT,
    self_arms TEXT,
    figure_description TEXT NOT NULL DEFAULT '',
    tagline TEXT NOT NULL DEFAULT '',
    artist_style TEXT NOT NULL DEFAULT 'modular',
    sent_count INTEGER NOT NULL DEFAULT 0,
    score INTEGER NOT NULL DEFAULT 0,
    about_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tags (
    slug TEXT PRIMARY KEY,
    dimension TEXT NOT NULL,
    body_part TEXT NOT NULL,
    label_pt TEXT NOT NULL,
    label_en TEXT NOT NULL,
    label_es TEXT NOT NULL,
    tagline_pt TEXT NOT NULL,
    tagline_en TEXT NOT NULL,
    tagline_es TEXT NOT NULL,
    is_quick_pick INTEGER NOT NULL DEFAULT 0,
    part_index INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS synthetic_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    company TEXT NOT NULL,
    group_name TEXT NOT NULL DEFAULT '',
    career_level TEXT NOT NULL DEFAULT 'now',
    bio TEXT NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL,
    photo_url TEXT,
    self_head TEXT NOT NULL,
    self_body TEXT NOT NULL,
    self_arms TEXT NOT NULL,
    tagline_pt TEXT NOT NULL DEFAULT '',
    score INTEGER NOT NULL DEFAULT 100
  );

  CREATE TABLE IF NOT EXISTS mights (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    direction TEXT NOT NULL DEFAULT 'received',
    sender_name TEXT NOT NULL,
    sender_avatar_url TEXT,
    recipient_id TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    circle TEXT NOT NULL,
    head_tag TEXT NOT NULL,
    body_tag TEXT NOT NULL,
    arms_tag TEXT NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    is_synthetic INTEGER NOT NULL DEFAULT 0,
    opt_in_consent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS roles (
    slug TEXT PRIMARY KEY,
    title_pt TEXT NOT NULL,
    track_pt TEXT NOT NULL,
    level TEXT NOT NULL,
    summary_pt TEXT NOT NULL,
    tag_weights_json TEXT NOT NULL,
    sample_companies_json TEXT NOT NULL,
    hypothesis_template_pt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS social_nodes (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    group_name TEXT NOT NULL,
    node_type TEXT NOT NULL,
    received_count INTEGER NOT NULL,
    sent_count INTEGER NOT NULL,
    total_count INTEGER NOT NULL,
    color TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS social_edges (
    id INTEGER PRIMARY KEY,
    source_id INTEGER NOT NULL,
    target_id INTEGER NOT NULL,
    source_name TEXT NOT NULL,
    target_name TEXT NOT NULL,
    source_group TEXT NOT NULL,
    target_group TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_mights_session ON mights(session_id, direction, status);
  CREATE INDEX IF NOT EXISTS idx_mights_recipient ON mights(recipient_id, status);
  CREATE INDEX IF NOT EXISTS idx_sessions_invite ON sessions(invite_code);
`);

export const DEFAULT_ABOUT: AboutSectionData = {
  academic: [],
  bio: '',
  experience: [],
  likes: [],
  expertise: [],
  wish: [],
  contactEmail: '',
  contactVisible: false,
};

export function parseAbout(jsonStr: string | null | undefined): AboutSectionData {
  if (!jsonStr) return { ...DEFAULT_ABOUT };
  try {
    const parsed = JSON.parse(jsonStr);
    return {
      academic: Array.isArray(parsed.academic) ? parsed.academic : [],
      bio: typeof parsed.bio === 'string' ? parsed.bio : '',
      experience: Array.isArray(parsed.experience) ? parsed.experience : [],
      likes: Array.isArray(parsed.likes) ? parsed.likes : [],
      expertise: Array.isArray(parsed.expertise) ? parsed.expertise : [],
      wish: Array.isArray(parsed.wish) ? parsed.wish : [],
      contactEmail: typeof parsed.contactEmail === 'string' ? parsed.contactEmail : '',
      contactVisible: Boolean(parsed.contactVisible),
    };
  } catch {
    return { ...DEFAULT_ABOUT };
  }
}

function makeInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function resolveTagSlug(tags: TagItem[], candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  const q = candidate.trim().toLowerCase();
  const exact = tags.find((t) => t.slug.toLowerCase() === q);
  if (exact) return exact.slug;
  const byPt = tags.find((t) => t.labelPt.trim().toLowerCase() === q);
  if (byPt) return byPt.slug;
  const byEn = tags.find((t) => t.labelEn.trim().toLowerCase() === q);
  if (byEn) return byEn.slug;
  const bySlugish = tags.find(
    (t) =>
      t.labelPt
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase() ===
      q.normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
  );
  return bySlugish ? bySlugish.slug : null;
}

let seededOnce = false;

export function seedIfNeeded(force = false): void {
  if (seededOnce && !force) return;

  const tagsPath = path.join(SEED_DIR, 'tags.json');
  const networkPath = path.join(SEED_DIR, 'network.json');
  const rolesPath = path.join(SEED_DIR, 'roles.json');

  if (!fs.existsSync(tagsPath) || !fs.existsSync(networkPath) || !fs.existsSync(rolesPath)) {
    return;
  }

  const tagCount = (db.query('SELECT COUNT(*) as c FROM tags').get() as { c: number }).c;
  const profileCount = (db.query('SELECT COUNT(*) as c FROM synthetic_profiles').get() as { c: number }).c;
  const roleCount = (db.query('SELECT COUNT(*) as c FROM roles').get() as { c: number }).c;
  const nodeCount = (db.query('SELECT COUNT(*) as c FROM social_nodes').get() as { c: number }).c;

  const rawTags: any[] = JSON.parse(fs.readFileSync(tagsPath, 'utf8'));
  const rawNetwork: any = JSON.parse(fs.readFileSync(networkPath, 'utf8'));
  const rawRoles: any[] = JSON.parse(fs.readFileSync(rolesPath, 'utf8'));

  const tx = db.transaction(() => {
    if (tagCount === 0 || force) {
      db.exec('DELETE FROM tags;');
      const insertTag = db.query(`
        INSERT INTO tags (slug, dimension, body_part, label_pt, label_en, label_es, tagline_pt, tagline_en, tagline_es, is_quick_pick, part_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const t of rawTags) {
        insertTag.run(
          String(t.slug),
          String(t.dimension),
          String(t.bodyPart ?? t.body_part),
          String(t.labelPt ?? t.label_pt),
          String(t.labelEn ?? t.label_en ?? t.labelPt),
          String(t.labelEs ?? t.label_es ?? t.labelPt),
          String(t.taglinePt ?? t.tagline_pt ?? ''),
          String(t.taglineEn ?? t.tagline_en ?? ''),
          String(t.taglineEs ?? t.tagline_es ?? ''),
          t.isQuickPick ? 1 : 0,
          Number(t.partIndex ?? 0) % 3,
        );
      }
    }

    if (profileCount === 0 || force) {
      db.exec('DELETE FROM synthetic_profiles;');
      db.exec("DELETE FROM mights WHERE direction = 'synthetic';");

      const insertProfile = db.query(`
        INSERT INTO synthetic_profiles (id, name, role, company, group_name, career_level, bio, avatar_url, photo_url, self_head, self_body, self_arms, tagline_pt, score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const p of rawNetwork.profiles ?? []) {
        insertProfile.run(
          String(p.id),
          String(p.name),
          String(p.role),
          String(p.company),
          String(p.groupName ?? p.group ?? 'Corporativo'),
          String(p.careerLevel ?? 'now'),
          String(p.bio ?? ''),
          String(p.avatarUrl ?? '/assets/figures/heroes/avatar-01.png'),
          p.photoUrl ? String(p.photoUrl) : null,
          String(p.selfTags?.head ?? p.selfHead ?? ''),
          String(p.selfTags?.body ?? p.selfBody ?? ''),
          String(p.selfTags?.arms ?? p.selfArms ?? ''),
          String(p.taglinePt ?? ''),
          Number(p.score ?? 120),
        );
      }

      const insertMight = db.query(`
        INSERT INTO mights (id, session_id, direction, sender_name, sender_avatar_url, recipient_id, recipient_name, circle, head_tag, body_tag, arms_tag, note, status, is_synthetic, opt_in_consent, created_at)
        VALUES (?, NULL, 'synthetic', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'accepted', 1, 1, ?)
      `);
      const now = new Date().toISOString();
      let idx = 0;
      for (const m of rawNetwork.syntheticMights ?? []) {
        idx++;
        insertMight.run(
          String(m.id ?? `syn-m-${idx}`),
          String(m.senderName ?? 'Par'),
          m.senderAvatarUrl ? String(m.senderAvatarUrl) : null,
          String(m.recipientId),
          String(m.recipientName ?? ''),
          String(m.circle ?? 'Colegas'),
          String(m.headTag),
          String(m.bodyTag),
          String(m.armsTag),
          m.note ? String(m.note) : null,
          String(m.createdAt ?? now),
        );
      }
    }

    if (roleCount === 0 || force) {
      db.exec('DELETE FROM roles;');
      const insertRole = db.query(`
        INSERT INTO roles (slug, title_pt, track_pt, level, summary_pt, tag_weights_json, sample_companies_json, hypothesis_template_pt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of rawRoles) {
        insertRole.run(
          String(r.slug),
          String(r.titlePt),
          String(r.trackPt),
          String(r.level),
          String(r.summaryPt),
          JSON.stringify(r.tagWeights ?? {}),
          JSON.stringify(r.sampleCompanies ?? []),
          String(r.hypothesisTemplatePt ?? ''),
        );
      }
    }

    if (nodeCount === 0 || force) {
      db.exec('DELETE FROM social_nodes;');
      db.exec('DELETE FROM social_edges;');

      const insertNode = db.query(`
        INSERT INTO social_nodes (id, name, group_name, node_type, received_count, sent_count, total_count, color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const n of rawNetwork.nodes ?? []) {
        const groupName = String(n.group ?? n.grupo ?? 'Corporativo');
        const received = Number(n.receivedCount ?? n.received ?? n.tagsRecebidas ?? 0);
        const sent = Number(n.sentCount ?? n.sent ?? n.tagsEnviadas ?? 0);
        insertNode.run(
          Number(n.id),
          String(n.name ?? n.nome),
          groupName,
          String(n.type ?? n.tipo ?? 'Pessoa'),
          received,
          sent,
          Number(n.totalCount ?? received + sent),
          String(n.color ?? GROUP_COLORS[groupName] ?? '#66C69B'),
        );
      }

      const insertEdge = db.query(`
        INSERT INTO social_edges (id, source_id, target_id, source_name, target_name, source_group, target_group)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      let eIdx = 0;
      for (const e of rawNetwork.edges ?? []) {
        eIdx++;
        insertEdge.run(
          Number(e.id ?? e.nr ?? eIdx),
          Number(e.sourceId ?? e.source ?? e.remetenteId),
          Number(e.targetId ?? e.target ?? e.destinatarioId),
          String(e.sourceName ?? e.remetente ?? ''),
          String(e.targetName ?? e.destinatario ?? ''),
          String(e.sourceGroup ?? e.grupoRemetente ?? ''),
          String(e.targetGroup ?? e.grupoDestinatario ?? ''),
        );
      }
    }
  });

  tx();
  seededOnce = true;
}

export function getAllTags(): TagItem[] {
  seedIfNeeded();
  const rows = db.query('SELECT * FROM tags ORDER BY dimension, is_quick_pick DESC, label_pt ASC').all() as any[];
  return rows.map((r) => ({
    slug: r.slug,
    dimension: r.dimension as Dimension,
    bodyPart: r.body_part as BodyPart,
    labelPt: r.label_pt,
    labelEn: r.label_en,
    labelEs: r.label_es,
    taglinePt: r.tagline_pt,
    taglineEn: r.tagline_en,
    taglineEs: r.tagline_es,
    isQuickPick: Boolean(r.is_quick_pick),
    partIndex: (Number(r.part_index) % 3) as 0 | 1 | 2,
  }));
}

export function getSyntheticProfiles(): SyntheticProfileRow[] {
  seedIfNeeded();
  return db.query('SELECT * FROM synthetic_profiles ORDER BY score DESC, name ASC').all() as SyntheticProfileRow[];
}

export function getSyntheticMights(): MightRecord[] {
  seedIfNeeded();
  const rows = db.query("SELECT * FROM mights WHERE direction = 'synthetic'").all() as any[];
  return rows.map(mapMightRow);
}

export function getAllRoles(): RoleRow[] {
  seedIfNeeded();
  const rows = db.query('SELECT * FROM roles').all() as any[];
  return rows.map((r) => ({
    slug: r.slug,
    title_pt: r.title_pt,
    track_pt: r.track_pt,
    level: r.level as 'now' | 'next' | 'stretch',
    summary_pt: r.summary_pt,
    tag_weights: JSON.parse(r.tag_weights_json || '{}'),
    sample_companies: JSON.parse(r.sample_companies_json || '[]'),
    hypothesis_template_pt: r.hypothesis_template_pt,
  }));
}

export function getSocialGraph(): SocialGraphData {
  seedIfNeeded();
  const nodeRows = db.query('SELECT * FROM social_nodes ORDER BY id ASC').all() as any[];
  const edgeRows = db.query('SELECT * FROM social_edges ORDER BY id ASC').all() as any[];

  const nodes: SocialGraphNode[] = nodeRows.map((n) => ({
    id: n.id,
    name: n.name,
    group: n.group_name,
    type: n.node_type === 'Conta' ? 'Conta' : 'Pessoa',
    receivedCount: n.received_count,
    sentCount: n.sent_count,
    totalCount: n.total_count,
    color: n.color,
  }));

  const edges: SocialGraphEdge[] = edgeRows.map((e) => ({
    id: e.id,
    source: e.source_id,
    target: e.target_id,
    sourceName: e.source_name,
    targetName: e.target_name,
    sourceGroup: e.source_group,
    targetGroup: e.target_group,
  }));

  const groupMap = new Map<string, { name: string; color: string; count: number }>();
  for (const n of nodes) {
    const existing = groupMap.get(n.group);
    if (existing) {
      existing.count += 1;
    } else {
      groupMap.set(n.group, { name: n.group, color: n.color, count: 1 });
    }
  }

  return {
    nodes,
    edges,
    groups: Array.from(groupMap.values()).sort((a, b) => b.count - a.count),
  };
}

export function mapMightRow(r: any): MightRecord {
  return {
    id: r.id,
    senderName: r.sender_name,
    senderAvatarUrl: r.sender_avatar_url ?? null,
    recipientId: r.recipient_id,
    recipientName: r.recipient_name,
    circle: (ALL_CIRCLES.includes(r.circle) ? r.circle : 'Colegas') as Circle,
    headTag: r.head_tag,
    bodyTag: r.body_tag,
    armsTag: r.arms_tag,
    note: r.note ?? null,
    status: r.status as MightStatus,
    isSynthetic: Boolean(r.is_synthetic),
    createdAt: r.created_at,
  };
}

export function getOrCreateSession(sessionId: string): SessionRow {
  seedIfNeeded();
  const cleanId = (sessionId || 'default-session').trim().slice(0, 80) || 'default-session';
  const existing = db.query('SELECT * FROM sessions WHERE session_id = ?').get(cleanId) as SessionRow | null;
  if (existing) return existing;

  let code = makeInviteCode();
  while (db.query('SELECT 1 FROM sessions WHERE invite_code = ?').get(code)) {
    code = makeInviteCode();
  }
  const now = new Date().toISOString();
  db.query(`
    INSERT INTO sessions (session_id, first_name, invite_code, about_json, created_at, updated_at)
    VALUES (?, '', ?, ?, ?, ?)
  `).run(cleanId, code, JSON.stringify(DEFAULT_ABOUT), now, now);

  return db.query('SELECT * FROM sessions WHERE session_id = ?').get(cleanId) as SessionRow;
}

export function getSessionByInviteCode(code: string): SessionRow | null {
  seedIfNeeded();
  const clean = code.trim().toUpperCase();
  return db.query('SELECT * FROM sessions WHERE UPPER(invite_code) = ?').get(clean) as SessionRow | null;
}

export function getSessionMights(sessionId: string): { received: MightRecord[]; sent: MightRecord[] } {
  const rows = db
    .query("SELECT * FROM mights WHERE session_id = ? AND direction != 'synthetic' ORDER BY created_at DESC")
    .all(sessionId) as any[];
  const received: MightRecord[] = [];
  const sent: MightRecord[] = [];
  for (const r of rows) {
    if (r.direction === 'sent') {
      sent.push(mapMightRow(r));
    } else {
      received.push(mapMightRow(r));
    }
  }
  return { received, sent };
}

export function resetSessionToFresh(sessionId: string): SessionRow {
  getOrCreateSession(sessionId);
  const now = new Date().toISOString();
  db.transaction(() => {
    db.query("DELETE FROM mights WHERE session_id = ? AND direction != 'synthetic'").run(sessionId);
    db.query(`
      UPDATE sessions
      SET first_name = '',
          self_head = NULL,
          self_body = NULL,
          self_arms = NULL,
          figure_description = '',
          tagline = '',
          artist_style = 'modular',
          sent_count = 0,
          score = 0,
          about_json = ?,
          updated_at = ?
      WHERE session_id = ?
    `).run(JSON.stringify(DEFAULT_ABOUT), now, sessionId);
  })();
  return getOrCreateSession(sessionId);
}

export function loadTiagoPreset(sessionId: string): SessionRow {
  getOrCreateSession(sessionId);
  const tags = getAllTags();
  const profiles = getSyntheticProfiles();

  const tag = (pt: string, en: string, fallbackIdx: number, dim: Dimension) => {
    return (
      resolveTagSlug(tags, pt) ??
      resolveTagSlug(tags, en) ??
      tags.find((t) => t.dimension === dim)?.slug ??
      tags[fallbackIdx]?.slug ??
      pt
    );
  };

  // Self MighT from Video: Sensível | Estratega | Liberdade
  const selfHead = tag('Sensível', 'Sensitive', 0, 'personality');
  const selfBody = tag('Estratega', 'Strategizer', 1, 'power');
  const selfArms = tag('Liberdade', 'Freedom', 2, 'character');

  // Peer tags matching 05 Stats (66% alignment: Sensível + Estratega confirmed, Liberdade hidden,
  // Superpowers: Esperto 70%/63%, Altruísmo, Disciplina, Tradutor, Aprendiz)
  const hEsperto = tag('Esperto', 'Clever', 0, 'personality');
  const hCurioso = tag('Curioso', 'Curious', 0, 'personality');
  const bTradutor = tag('Tradutor', 'Translator', 1, 'power');
  const bAprendiz = tag('Aprendiz', 'Learner', 1, 'power');
  const bLider = tag('Líder', 'Leader', 1, 'power');
  const aAltruismo = tag('Altruísmo', 'Altruism', 2, 'character');
  const aDisciplina = tag('Disciplina', 'Discipline', 2, 'character');
  const aColaboracao = tag('Colaboração', 'Collaboration', 2, 'character');

  const peerNames = [
    'Lúcia Lobo',
    'Duarte Vaz Godinho',
    'Mariana Campos Neto',
    'Dinis Serrano Pestana',
    'Isabel Medeiros Rebelo',
    'Rodrigo Tavares Magalhães',
    'Leandro Xavier',
    'Beatriz Reis',
    'Álvaro Nogueiras',
    'Maria Caldas',
  ];

  const peerPhotos = [
    '/assets/peers/peer-1.jpg',
    '/assets/peers/peer-2.jpg',
    '/assets/peers/peer-3.jpg',
    '/assets/peers/peer-4.jpg',
    '/assets/peers/peer-5.jpg',
    '/assets/peers/peer-6.jpg',
    '/assets/peers/peer-1.jpg',
    '/assets/peers/peer-2.jpg',
    '/assets/peers/peer-3.jpg',
    '/assets/peers/peer-4.jpg',
  ];

  const presetMights: Array<{
    sender: string;
    avatar: string;
    circle: Circle;
    h: string;
    b: string;
    a: string;
    status: MightStatus;
    note: string;
  }> = [
    { sender: peerNames[0], avatar: peerPhotos[0], circle: 'Colegas', h: hEsperto, b: bTradutor, a: aAltruismo, status: 'accepted', note: 'Traduzes problemas complexos em visão clara para toda a equipa.' },
    { sender: peerNames[1], avatar: peerPhotos[1], circle: 'Colegas', h: hEsperto, b: bAprendiz, a: aDisciplina, status: 'accepted', note: 'A tua curiosidade e rigor elevam qualquer projeto.' },
    { sender: peerNames[2], avatar: peerPhotos[2], circle: 'Amigos', h: selfHead, b: bTradutor, a: aAltruismo, status: 'accepted', note: 'Sabes ouvir com empatia e unir pessoas.' },
    { sender: peerNames[3], avatar: peerPhotos[3], circle: 'Comunidade', h: hEsperto, b: selfBody, a: aDisciplina, status: 'accepted', note: 'Pensas sempre três passos à frente.' },
    { sender: peerNames[4], avatar: peerPhotos[4], circle: 'Clientes', h: hEsperto, b: bTradutor, a: aAltruismo, status: 'accepted', note: 'Excelente ponte entre negócio, produto e pessoas.' },
    { sender: peerNames[5], avatar: peerPhotos[5], circle: 'Família', h: selfHead, b: bAprendiz, a: aAltruismo, status: 'accepted', note: 'Sempre aberto a aprender e a cuidar dos outros.' },
    { sender: peerNames[6], avatar: peerPhotos[6], circle: 'Escola', h: hEsperto, b: bAprendiz, a: aDisciplina, status: 'accepted', note: 'Consistência e inteligência prática raras.' },
    { sender: peerNames[7], avatar: peerPhotos[7], circle: 'Amigos', h: hCurioso, b: bLider, a: aColaboracao, status: 'accepted', note: 'Energia contagiante para começar ideias novas.' },
    // 2 pending MighTs ("À TUA ESPERA · 2")
    { sender: peerNames[8], avatar: peerPhotos[8], circle: 'Colegas', h: hEsperto, b: selfBody, a: aColaboracao, status: 'pending', note: 'Adoro desenhar estratégia contigo!' },
    { sender: peerNames[9], avatar: peerPhotos[9], circle: 'Comunidade', h: selfHead, b: bTradutor, a: aAltruismo, status: 'pending', note: 'Reconhecimento enviado da comunidade Epic.' },
  ];

  const tiagoAbout: AboutSectionData = {
    academic: ['Gestão de Inovação', 'Design Thinking · Stanford', 'Psicologia Organizacional'],
    bio: 'A ajudar equipas e talentos a visualizar o seu potencial real além do CV. Criador do MighT na Epic.',
    experience: ['Founder @ Epic Labs', 'Talent Strategy @ Sonae', 'Mentoria de Carreiras'],
    likes: ['Surf', 'Cultura Pop', 'Construir produtos com alma'],
    expertise: ['Estratégia de Talento', 'Facilitação', 'Storytelling'],
    wish: ['Ligar 10.000 pessoas através dos olhos de quem as conhece'],
    contactEmail: 'tiago@epiclabs.pt',
    contactVisible: true,
  };

  const now = Date.now();
  db.transaction(() => {
    db.query("DELETE FROM mights WHERE session_id = ? AND direction != 'synthetic'").run(sessionId);

    const insertMight = db.query(`
      INSERT INTO mights (id, session_id, direction, sender_name, sender_avatar_url, recipient_id, recipient_name, circle, head_tag, body_tag, arms_tag, note, status, is_synthetic, opt_in_consent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
    `);

    presetMights.forEach((m, i) => {
      const ts = new Date(now - (12 - i) * 3600_000).toISOString();
      insertMight.run(
        `tiago-rec-${sessionId}-${i + 1}`,
        sessionId,
        'received',
        m.sender,
        m.avatar,
        sessionId,
        'Tiago Forjaz',
        m.circle,
        m.h,
        m.b,
        m.a,
        m.note,
        m.status,
        ts,
      );
    });

    // 3 sent MighTs across circles (so first 3 peers show as reciprocated!)
    for (let i = 0; i < 3; i++) {
      const target = profiles[i];
      const ts = new Date(now - (20 - i) * 3600_000).toISOString();
      insertMight.run(
        `tiago-sent-${sessionId}-${i + 1}`,
        sessionId,
        'sent',
        'Tiago Forjaz',
        '/assets/figures/heroes/blue-hero.png',
        target?.id ?? `peer-${i + 1}`,
        target?.name ?? peerNames[i],
        i === 0 ? 'Colegas' : i === 1 ? 'Amigos' : 'Comunidade',
        hEsperto,
        bTradutor,
        aAltruismo,
        'Reconhecimento mútuo!',
        'accepted',
        ts,
      );
    }

    db.query(`
      UPDATE sessions
      SET first_name = 'Tiago Forjaz',
          self_head = ?,
          self_body = ?,
          self_arms = ?,
          figure_description = 'Combinas uma sensibilidade rara para ler pessoas com visão estratégica e espírito livre. O teu Self MighT reflete quem pensa três passos à frente sem perder autonomia.',
          tagline = 'Lê a sala, pensa três passos à frente e sabe quando sair do guião.',
          artist_style = 'blue-hero',
          sent_count = 3,
          score = 310,
          about_json = ?,
          updated_at = ?
      WHERE session_id = ?
    `).run(
      selfHead,
      selfBody,
      selfArms,
      JSON.stringify(tiagoAbout),
      new Date().toISOString(),
      sessionId,
    );
  })();

  return getOrCreateSession(sessionId);
}
