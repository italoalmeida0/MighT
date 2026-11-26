export type Dimension = 'personality' | 'power' | 'character';

export type BodyPart = 'head' | 'body' | 'arms';

export type Circle =
  | 'Família'
  | 'Amigos'
  | 'Colegas'
  | 'Escola'
  | 'Comunidade'
  | 'Clientes';

export const ALL_CIRCLES: readonly Circle[] = [
  'Família',
  'Amigos',
  'Colegas',
  'Escola',
  'Comunidade',
  'Clientes',
] as const;

export const UNLOCK_THRESHOLD = 3;

export const DIMENSION_TO_PART: Record<Dimension, BodyPart> = {
  personality: 'head',
  power: 'body',
  character: 'arms',
};

export const PART_TO_DIMENSION: Record<BodyPart, Dimension> = {
  head: 'personality',
  body: 'power',
  arms: 'character',
};

export const DIMENSION_META: Record<
  Dimension,
  {
    dimension: Dimension;
    bodyPart: BodyPart;
    labelPt: string;
    partLabelPt: string;
    subtitlePt: string;
    accentHex: string;
  }
> = {
  personality: {
    dimension: 'personality',
    bodyPart: 'head',
    labelPt: 'Personalidade',
    partLabelPt: 'Cabeça',
    subtitlePt: 'As qualidades que te tornam único',
    accentHex: '#1FB5D3',
  },
  power: {
    dimension: 'power',
    bodyPart: 'body',
    labelPt: 'Poder',
    partLabelPt: 'Corpo',
    subtitlePt: 'Capacidade natural para fazer: talento',
    accentHex: '#E94B7B',
  },
  character: {
    dimension: 'character',
    bodyPart: 'arms',
    labelPt: 'Carácter',
    partLabelPt: 'Braços',
    subtitlePt: 'Traços mentais e éticos que te marcam',
    accentHex: '#C6EE00',
  },
};

export const GROUP_COLORS: Record<string, string> = {
  Corporativo: '#66C69B',
  'Marca C': '#FD8070',
  'Marca B': '#C0E194',
  'Marca A': '#5D6B70',
  'Marca D': '#11B6BA',
  'Marca H': '#F9B164',
  'Marca E': '#9BE0D7',
  'Facilitação': '#FEE585',
  'Marca F': '#CCA48A',
  'Marca G': '#FFCF9B',
  Programa: '#836C36',
};

export interface TagItem {
  slug: string;
  dimension: Dimension;
  bodyPart: BodyPart;
  labelPt: string;
  labelEn: string;
  labelEs: string;
  taglinePt: string;
  taglineEn: string;
  taglineEs: string;
  isQuickPick: boolean;
  partIndex: 0 | 1 | 2;
}

export interface FigureSelection {
  head: string;
  body: string;
  arms: string;
}

export interface TagWeight {
  slug: string;
  labelPt: string;
  dimension: Dimension;
  bodyPart: BodyPart;
  count: number;
  weight: number;
  pct: number;
}

export type MightStatus = 'pending' | 'accepted' | 'declined';

export interface MightRecord {
  id: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  recipientId: string;
  recipientName: string;
  circle: Circle;
  headTag: string;
  bodyTag: string;
  armsTag: string;
  note?: string | null;
  status: MightStatus;
  isSynthetic: boolean;
  createdAt: string;
}

export interface AboutSectionData {
  academic: string[];
  bio: string;
  experience: string[];
  likes: string[];
  expertise: string[];
  wish: string[];
  contactEmail: string;
  contactVisible: boolean;
}

export interface UserProfile {
  sessionId: string;
  firstName: string;
  inviteCode: string;
  selfTags: FigureSelection | null;
  figureDescription: string;
  tagline: string;
  artistStyle: string;
  sentCount: number;
  acceptedCount: number;
  pendingCount: number;
  allMightUnlocked: boolean;
  pedeUnlocked: boolean;
  score: number;
  about: AboutSectionData;
}

export interface OrbitPeer {
  id: string;
  name: string;
  circle: Circle;
  photoUrl?: string | null;
  avatarUrl?: string | null;
  headTag: string;
  bodyTag: string;
  armsTag: string;
  reciprocated?: boolean;
}

export interface AllMightSummary {
  unlocked: boolean;
  acceptedCount: number;
  threshold: number;
  activeCircle: Circle | 'all';
  circlesRepresented: Circle[];
  topTags: FigureSelection | null;
  weightsByDimension: Record<Dimension, TagWeight[]>;
  tagCloud: TagWeight[];
  recentPeers: OrbitPeer[];
  waitingForYou: OrbitPeer[];
  description: string;
  tagline: string;
}

export interface JohariStats {
  unlocked: boolean;
  totalReceived: number;
  alignmentPct: number;
  confirmedCount: number;
  selfCount: number;
  topHeadlineInsight: string;
  mirrorInsight: string;
  confirmed: TagWeight[];
  superpowers: TagWeight[];
  hidden: TagWeight[];
  byDimension: Record<Dimension, TagWeight[]>;
}

export interface BiggestDifference {
  dimension: Dimension;
  labelPt: string;
  userTopTag: string | null;
  otherTopTag: string | null;
  summaryPt: string;
}

export interface DiscoverProfile {
  id: string;
  name: string;
  role: string;
  company: string;
  groupName: string;
  careerLevel: 'now' | 'next' | 'stretch';
  bio: string;
  avatarUrl: string;
  photoUrl: string | null;
  selfTags: FigureSelection;
  taglinePt: string;
  score: number;
  circles: Circle[];
  similarityPct: number;
  commonTags: TagWeight[];
  biggestDifference: BiggestDifference;
  weightsByDimension: Record<Dimension, TagWeight[]>;
  topTags: TagWeight[];
}

export interface DiscoverResponse {
  unlocked: boolean;
  dimension: Dimension | 'all';
  profiles: DiscoverProfile[];
}

export interface RolePeerRef {
  id: string;
  name: string;
  role: string;
  company: string;
  avatarUrl: string;
  photoUrl: string | null;
  similarityPct: number;
}

export interface RoleRecommendation {
  slug: string;
  titlePt: string;
  trackPt: string;
  level: 'now' | 'next' | 'stretch';
  matchPct: number;
  matchedTags: string[];
  similarPeers: RolePeerRef[];
  sampleCompanies: string[];
  hypothesisPt: string;
  summaryPt: string;
  disclaimerPt: string;
}

export interface RolesResponse {
  unlocked: boolean;
  trajectory: {
    now: RoleRecommendation | null;
    next: RoleRecommendation | null;
    stretch: RoleRecommendation | null;
  };
  roles: RoleRecommendation[];
  disclaimerPt: string;
}

export interface SocialGraphNode {
  id: number;
  name: string;
  group: string;
  type: 'Pessoa' | 'Conta';
  receivedCount: number;
  sentCount: number;
  totalCount: number;
  color: string;
}

export interface SocialGraphEdge {
  id: number;
  source: number;
  target: number;
  sourceName: string;
  targetName: string;
  sourceGroup: string;
  targetGroup: string;
}

export interface SocialGraphData {
  nodes: SocialGraphNode[];
  edges: SocialGraphEdge[];
  groups: { name: string; color: string; count: number }[];
}

export interface InboxData {
  pending: MightRecord[];
  accepted: MightRecord[];
  declined: MightRecord[];
}

export interface BootstrapResponse {
  profile: UserProfile;
  tags: TagItem[];
  allMight: AllMightSummary;
  stats: JohariStats;
  inbox: InboxData;
  sentMights: MightRecord[];
  inviteUrl: string;
  quickPeers: {
    id: string;
    name: string;
    role: string;
    company: string;
    avatarUrl: string;
    photoUrl: string | null;
  }[];
}

export interface InviteInfoResponse {
  code: string;
  requesterFirstName: string;
  requesterTags: FigureSelection | null;
  tags: TagItem[];
}

export interface SseEventPayload {
  type: 'connected' | 'might:received' | 'might:accepted' | 'demo:updated' | 'heartbeat';
  might?: MightRecord;
  acceptedCount?: number;
  allMightUnlocked?: boolean;
  messagePt?: string;
  timestamp: string;
}
