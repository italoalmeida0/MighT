import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  type Accessor,
  type ParentComponent,
} from 'solid-js';
import type {
  AboutSectionData,
  BootstrapResponse,
  Circle,
  FigureSelection,
  SseEventPayload,
  TagItem,
} from '../../../shared/types';
import * as api from './api';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

export interface PeerRef {
  id?: string;
  name: string;
  role?: string;
  company?: string;
  avatarUrl?: string | null;
  photoUrl?: string | null;
}

function normalizeRoute(rawHash: string): string {
  const cleaned = rawHash.replace(/^#/, '').trim();
  if (!cleaned || cleaned === '/') return '/';
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
}

export function resolvePartIndex(
  slug: string | null | undefined,
  tagMap: Record<string, TagItem>
): 0 | 1 | 2 {
  if (!slug) return 0;
  const found = tagMap[slug];
  if (found && (found.partIndex === 0 || found.partIndex === 1 || found.partIndex === 2)) {
    return found.partIndex;
  }
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 3) as 0 | 1 | 2;
}

export interface MightContextValue {
  bootstrap: Accessor<BootstrapResponse | null>;
  loading: Accessor<boolean>;
  error: Accessor<string | null>;
  route: Accessor<string>;
  navigate: (path: string) => void;
  activeMode: Accessor<'self' | 'all'>;
  setActiveMode: (mode: 'self' | 'all') => void;
  demoDrawerOpen: Accessor<boolean>;
  setDemoDrawerOpen: (open: boolean) => void;
  expandedShell: Accessor<boolean>;
  setExpandedShell: (expanded: boolean) => void;
  toasts: Accessor<ToastItem[]>;
  showToast: (message: string, tone?: ToastTone) => void;
  dismissToast: (id: string) => void;
  refresh: () => Promise<void>;
  preselectedPeer: Accessor<PeerRef | null>;
  setPreselectedPeer: (peer: PeerRef | null) => void;
  openSendTo: (peer: PeerRef) => void;
  preselectedCircle: Accessor<Circle | null>;
  setPreselectedCircle: (circle: Circle | null) => void;
  openAskWithCircle: (circle?: Circle) => void;
  tagMap: Accessor<Record<string, TagItem>>;
  getTag: (slug: string | null | undefined) => TagItem | undefined;
  getTagLabel: (slug: string | null | undefined) => string;
  getPartIndices: (selection: FigureSelection | null | undefined) => {
    headIndex: 0 | 1 | 2;
    bodyIndex: 0 | 1 | 2;
    armsIndex: 0 | 1 | 2;
  };
  sseConnected: Accessor<boolean>;
  justUnlockedAllMight: Accessor<boolean>;
  clearJustUnlocked: () => void;
  saveSelfMight: (body: {
    firstName?: string;
    head: string;
    body: string;
    arms: string;
  }) => Promise<BootstrapResponse>;
  updateMe: (body: {
    firstName?: string;
    artistStyle?: string;
  }) => Promise<BootstrapResponse>;
  updateAbout: (body: Partial<AboutSectionData>) => Promise<BootstrapResponse>;
  sendMight: (body: {
    recipientName: string;
    recipientId?: string;
    circle: Circle;
    head: string;
    body: string;
    arms: string;
    note?: string;
  }) => Promise<BootstrapResponse>;
  acceptMight: (id: string) => Promise<BootstrapResponse>;
  declineMight: (id: string) => Promise<BootstrapResponse>;
  demoSimulateReceive: (
    count?: 1 | 3,
    autoAccept?: boolean
  ) => Promise<BootstrapResponse>;
  demoLoadPreset: (preset: 'tiago' | 'fresh') => Promise<BootstrapResponse>;
}

const MightContext = createContext<MightContextValue>();

export const MightProvider: ParentComponent = (props) => {
  const [bootstrap, setBootstrap] = createSignal<BootstrapResponse | null>(null);
  const [loading, setLoading] = createSignal<boolean>(true);
  const [error, setError] = createSignal<string | null>(null);
  const [route, setRoute] = createSignal<string>(
    typeof window !== 'undefined' ? normalizeRoute(window.location.hash) : '/'
  );
  const [activeMode, setActiveMode] = createSignal<'self' | 'all'>('self');
  const [demoDrawerOpen, setDemoDrawerOpen] = createSignal<boolean>(false);
  const [expandedShell, setExpandedShell] = createSignal<boolean>(false);
  const [toasts, setToasts] = createSignal<ToastItem[]>([]);
  const [preselectedPeer, setPreselectedPeer] = createSignal<PeerRef | null>(null);
  const [preselectedCircle, setPreselectedCircle] = createSignal<Circle | null>(null);
  const [sseConnected, setSseConnected] = createSignal<boolean>(false);
  const [justUnlockedAllMight, setJustUnlockedAllMight] = createSignal<boolean>(false);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const showToast = (message: string, tone: ToastTone = 'info') => {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => dismissToast(id), 4500);
    }
  };

  const navigate = (path: string) => {
    const normalized = normalizeRoute(path);
    if (typeof window !== 'undefined') {
      const targetHash = `#${normalized}`;
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setRoute(normalized);
  };

  const openSendTo = (peer: PeerRef) => {
    setPreselectedPeer(peer);
    navigate('/enviar');
  };

  const openAskWithCircle = (circle?: Circle) => {
    setPreselectedCircle(circle ?? null);
    navigate('/pedir');
  };

  const refresh = async () => {
    try {
      const prevUnlocked = bootstrap()?.profile.allMightUnlocked ?? false;
      const data = await api.fetchBootstrap();
      setBootstrap(data);
      setError(null);
      if (!prevUnlocked && data.profile.allMightUnlocked) {
        setJustUnlockedAllMight(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao ligar ao servidor';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const tagMap = createMemo<Record<string, TagItem>>(() => {
    const map: Record<string, TagItem> = {};
    for (const tag of bootstrap()?.tags ?? []) {
      map[tag.slug] = tag;
    }
    return map;
  });

  const getTag = (slug: string | null | undefined): TagItem | undefined => {
    if (!slug) return undefined;
    return tagMap()[slug];
  };

  const getTagLabel = (slug: string | null | undefined): string => {
    if (!slug) return '—';
    return tagMap()[slug]?.labelPt ?? slug;
  };

  const getPartIndices = (selection: FigureSelection | null | undefined) => {
    const map = tagMap();
    return {
      headIndex: resolvePartIndex(selection?.head, map),
      bodyIndex: resolvePartIndex(selection?.body, map),
      armsIndex: resolvePartIndex(selection?.arms, map),
    };
  };

  const applyBootstrapUpdate = (data: BootstrapResponse) => {
    const prevUnlocked = bootstrap()?.profile.allMightUnlocked ?? false;
    setBootstrap(data);
    setError(null);
    if (!prevUnlocked && data.profile.allMightUnlocked) {
      setJustUnlockedAllMight(true);
      showToast('All MighT desbloqueado! Já tens 3 MighTs aceites.', 'success');
    }
    return data;
  };

  const saveSelfMight = async (body: {
    firstName?: string;
    head: string;
    body: string;
    arms: string;
  }) => {
    const data = await api.saveSelfMight(body);
    return applyBootstrapUpdate(data);
  };

  const updateMe = async (body: { firstName?: string; artistStyle?: string }) => {
    const data = await api.updateMe(body);
    return applyBootstrapUpdate(data);
  };

  const updateAbout = async (body: Partial<AboutSectionData>) => {
    const data = await api.updateAbout(body);
    return applyBootstrapUpdate(data);
  };

  const sendMight = async (body: {
    recipientName: string;
    recipientId?: string;
    circle: Circle;
    head: string;
    body: string;
    arms: string;
    note?: string;
  }) => {
    const data = await api.sendMight(body);
    return applyBootstrapUpdate(data);
  };

  const acceptMight = async (id: string) => {
    const data = await api.acceptMight(id);
    return applyBootstrapUpdate(data);
  };

  const declineMight = async (id: string) => {
    const data = await api.declineMight(id);
    return applyBootstrapUpdate(data);
  };

  const demoSimulateReceive = async (count: 1 | 3 = 1, autoAccept = false) => {
    const data = await api.demoSimulateReceive(count, autoAccept);
    return applyBootstrapUpdate(data);
  };

  const demoLoadPreset = async (preset: 'tiago' | 'fresh') => {
    const data = await api.demoLoadPreset(preset);
    setBootstrap(data);
    setError(null);
    if (preset === 'tiago') {
      setJustUnlockedAllMight(false);
      setActiveMode('self');
      showToast('Demo completo carregado (Tiago Forjaz).', 'success');
      navigate('/home');
    } else {
      setJustUnlockedAllMight(false);
      setActiveMode('self');
      showToast('Sessão reiniciada do zero.', 'info');
      navigate('/');
    }
    return data;
  };

  onMount(() => {
    const onHashChange = () => {
      setRoute(normalizeRoute(window.location.hash));
    };
    window.addEventListener('hashchange', onHashChange);

    // Keyboard shortcut Ctrl+Shift+D for Demo Drawer
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setDemoDrawerOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    void refresh();

    const isInviteRoute = () => normalizeRoute(window.location.hash).startsWith('/convite/');
    const unsubscribe = api.subscribeEvents((payload: SseEventPayload) => {
      if (payload.type === 'connected') {
        setSseConnected(true);
        return;
      }
      if (payload.type === 'might:received') {
        if (!isInviteRoute()) {
          const sender = payload.might?.senderName ?? 'Alguém na sala';
          const circle = payload.might?.circle ?? '';
          showToast(
            payload.messagePt ||
              `Novo MighT de ${sender}${circle ? ` (${circle})` : ''}! Toca para rever.`,
            'success'
          );
        }
        void refresh();
      } else if (payload.type === 'might:accepted' || payload.type === 'demo:updated') {
        if (payload.allMightUnlocked) {
          setJustUnlockedAllMight(true);
        }
        void refresh();
      }
    });

    onCleanup(() => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('keydown', onKeyDown);
      unsubscribe();
    });
  });

  // Auto-collapse expanded shell outside network/map routes
  createEffect(() => {
    const r = route();
    if (!r.startsWith('/descobrir') && !r.startsWith('/mapa')) {
      setExpandedShell(false);
    }
  });

  const value: MightContextValue = {
    bootstrap,
    loading,
    error,
    route,
    navigate,
    activeMode,
    setActiveMode,
    demoDrawerOpen,
    setDemoDrawerOpen,
    expandedShell,
    setExpandedShell,
    toasts,
    showToast,
    dismissToast,
    refresh,
    preselectedPeer,
    setPreselectedPeer,
    openSendTo,
    preselectedCircle,
    setPreselectedCircle,
    openAskWithCircle,
    tagMap,
    getTag,
    getTagLabel,
    getPartIndices,
    sseConnected,
    justUnlockedAllMight,
    clearJustUnlocked: () => setJustUnlockedAllMight(false),
    saveSelfMight,
    updateMe,
    updateAbout,
    sendMight,
    acceptMight,
    declineMight,
    demoSimulateReceive,
    demoLoadPreset,
  };

  return <MightContext.Provider value={value}>{props.children}</MightContext.Provider>;
};

export function useMight(): MightContextValue {
  const ctx = useContext(MightContext);
  if (!ctx) {
    throw new Error('useMight tem de ser usado dentro de <MightProvider>');
  }
  return ctx;
}
