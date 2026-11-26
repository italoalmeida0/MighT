import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import {
  ArrowRight,
  ChevronLeft,
  Compass,
  Maximize2,
  Minimize2,
  Network,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-solid';
import {
  DIMENSION_META,
  type Dimension,
  type DiscoverProfile,
  type SocialGraphData,
  type SocialGraphNode,
} from '../../../shared/types';
import { MightFigure } from '../components/MightFigure';
import * as api from '../lib/api';
import { useMight } from '../lib/store';

interface PositionedNode extends SocialGraphNode {
  x: number;
  y: number;
}

const DIM_FILTERS: { key: Dimension | 'all'; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'personality', label: 'Personalidade' },
  { key: 'power', label: 'Poder' },
  { key: 'character', label: 'Carácter' },
];

/**
 * Deterministic lightweight force layout for the 63-node MighT Social Graph.
 * Runs synchronously in a few milliseconds without external D3 dependencies.
 */
function computeForceLayout(data: SocialGraphData): PositionedNode[] {
  const nodes = data.nodes;
  if (nodes.length === 0) return [];

  const groups = Array.from(new Set(nodes.map((n) => n.group)));
  const groupAngle = new Map<string, number>();
  groups.forEach((g, idx) => {
    groupAngle.set(g, (idx / Math.max(1, groups.length)) * Math.PI * 2);
  });

  const pos = nodes.map((n, i) => {
    const baseAngle = groupAngle.get(n.group) ?? 0;
    const jitterAngle = baseAngle + ((i % 7) - 3) * 0.22;
    const ringRadius = 110 + (n.id % 5) * 28;
    return {
      ...n,
      x: Math.cos(jitterAngle) * ringRadius,
      y: Math.sin(jitterAngle) * ringRadius,
      vx: 0,
      vy: 0,
    };
  });

  const byId = new Map(pos.map((p) => [p.id, p]));
  const edges = data.edges;

  const iterations = 90;
  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations;

    // Repulsion between nodes
    for (let i = 0; i < pos.length; i++) {
      const a = pos[i]!;
      for (let j = i + 1; j < pos.length; j++) {
        const b = pos[j]!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let distSq = dx * dx + dy * dy;
        if (distSq < 1) {
          dx = 0.5;
          dy = 0.5;
          distSq = 0.5;
        }
        const dist = Math.sqrt(distSq);
        const minSpace = 26 + (a.receivedCount + b.receivedCount) * 0.25;
        const repulse = (620 / distSq) * alpha;
        const fx = (dx / dist) * repulse;
        const fy = (dy / dist) * repulse;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;

        if (dist < minSpace) {
          const push = ((minSpace - dist) / dist) * 0.28;
          a.x += dx * push;
          a.y += dy * push;
          b.x -= dx * push;
          b.y -= dy * push;
        }
      }
    }

    // Gentle attraction along recognition edges
    for (let k = 0; k < edges.length; k++) {
      const e = edges[k]!;
      const s = byId.get(e.source);
      const t = byId.get(e.target);
      if (!s || !t) continue;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const targetLen = 145;
      const pull = ((dist - targetLen) / dist) * 0.012 * alpha;
      s.vx += dx * pull;
      s.vy += dy * pull;
      t.vx -= dx * pull;
      t.vy -= dy * pull;
    }

    // Center gravity & velocity damping
    for (let i = 0; i < pos.length; i++) {
      const p = pos[i]!;
      p.vx += -p.x * 0.025 * alpha;
      p.vy += -p.y * 0.025 * alpha;
      p.vx *= 0.72;
      p.vy *= 0.72;
      p.x += p.vx;
      p.y += p.vy;
    }
  }

  return pos.map(({ vx: _vx, vy: _vy, ...rest }) => rest);
}

export function DiscoverScreen() {
  const {
    bootstrap,
    route,
    navigate,
    openSendTo,
    expandedShell,
    setExpandedShell,
    getTagLabel,
  } = useMight();

  const [subTab, setSubTab] = createSignal<'similar' | 'graph'>(
    route().startsWith('/mapa') ? 'graph' : 'similar'
  );
  const [dimFilter, setDimFilter] = createSignal<Dimension | 'all'>('all');
  const [peerQuery, setPeerQuery] = createSignal('');
  const [profiles, setProfiles] = createSignal<DiscoverProfile[]>([]);
  const [loadingSimilar, setLoadingSimilar] = createSignal(true);
  const [selectedProfile, setSelectedProfile] = createSignal<DiscoverProfile | null>(null);
  const [drawerFigureMode, setDrawerFigureMode] = createSignal<'modular' | 'avatar'>('modular');

  // Graph State
  const [graphData, setGraphData] = createSignal<SocialGraphData | null>(null);
  const [loadingGraph, setLoadingGraph] = createSignal(false);
  const [sizeBySent, setSizeBySent] = createSignal(false);
  const [hiddenGroups, setHiddenGroups] = createSignal<Set<string>>(new Set());
  const [graphSearch, setGraphSearch] = createSignal('');
  const [selectedNodeId, setSelectedNodeId] = createSignal<number | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = createSignal<number | null>(null);
  const [zoom, setZoom] = createSignal(1);
  const [pan, setPan] = createSignal({ x: 0, y: 0 });
  const [draggingPan, setDraggingPan] = createSignal<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // Sync sub-tab if route is #/mapa
  createEffect(() => {
    if (route().startsWith('/mapa')) {
      setSubTab('graph');
    }
  });

  // Expand shell automatically on desktop when viewing the 63-node Social Graph
  createEffect(() => {
    if (subTab() === 'graph') {
      setExpandedShell(true);
    } else {
      setExpandedShell(false);
    }
  });

  // Fetch ranked Discover profiles
  createEffect(() => {
    const dim = dimFilter();
    void bootstrap();
    setLoadingSimilar(true);
    void (async () => {
      try {
        const res = await api.fetchDiscover(dim);
        setProfiles(res.profiles);
      } catch {
        // ignore transient error
      } finally {
        setLoadingSimilar(false);
      }
    })();
  });

  // Lazy-fetch 63-node social graph when entering Graph tab
  createEffect(() => {
    if (subTab() !== 'graph' || graphData() !== null || loadingGraph()) return;
    setLoadingGraph(true);
    void (async () => {
      try {
        const data = await api.fetchNetworkGraph();
        setGraphData(data);
      } catch {
        // ignore transient error
      } finally {
        setLoadingGraph(false);
      }
    })();
  });

  const filteredProfiles = createMemo(() => {
    const q = peerQuery().trim().toLowerCase();
    if (!q) return profiles();
    return profiles().filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q) ||
        p.company.toLowerCase().includes(q) ||
        p.groupName.toLowerCase().includes(q)
    );
  });

  // Graph memoized layout & link lookups
  const positionedNodes = createMemo<PositionedNode[]>(() => {
    const g = graphData();
    if (!g) return [];
    return computeForceLayout(g);
  });

  const nodeMap = createMemo(() => {
    const m = new Map<number, PositionedNode>();
    for (const n of positionedNodes()) m.set(n.id, n);
    return m;
  });

  const activeFocusNodeId = createMemo(() => hoveredNodeId() ?? selectedNodeId());

  const activeFocusNode = createMemo(() => {
    const id = activeFocusNodeId();
    return id !== null ? nodeMap().get(id) ?? null : null;
  });

  const focusRelations = createMemo(() => {
    const id = activeFocusNodeId();
    const outSet = new Set<number>();
    const inSet = new Set<number>();
    if (id === null || !graphData()) return { outSet, inSet };
    for (const e of graphData()!.edges) {
      if (e.source === id) outSet.add(e.target);
      if (e.target === id) inSet.add(e.source);
    }
    return { outSet, inSet };
  });

  const mutualCountForFocus = createMemo(() => {
    const { outSet, inSet } = focusRelations();
    let count = 0;
    for (const tid of outSet) {
      if (inSet.has(tid)) count++;
    }
    return count;
  });

  const toggleGroupVisibility = (groupName: string) => {
    setHiddenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  };

  const graphSearchMatches = createMemo(() => {
    const q = graphSearch().trim().toLowerCase();
    if (!q) return [];
    return positionedNodes()
      .filter((n) => n.name.toLowerCase().includes(q) || n.group.toLowerCase().includes(q))
      .slice(0, 6);
  });

  const selectNodeAndCenter = (node: PositionedNode) => {
    setSelectedNodeId(node.id);
    setGraphSearch(node.name);
    setPan({ x: -node.x * zoom(), y: -node.y * zoom() });
  };

  const nodeRadius = (n: PositionedNode) => {
    const val = sizeBySent() ? n.sentCount : n.receivedCount;
    return Math.max(5, Math.min(20, 4 + val * 0.36));
  };

  const matchingDiscoverPeer = (name: string): DiscoverProfile | undefined =>
    profiles().find((p) => p.name.toLowerCase() === name.toLowerCase());

  return (
    <div class="bg-might-light min-h-full flex flex-col text-[#1C1E28]">
      {/* Header matching 02 About-1.jpg */}
      <header class="px-4 pt-4 pb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/home')}
          class="h-10 w-10 rounded-full hover:bg-white/35 flex items-center justify-center text-[#1C1E28] cursor-pointer"
          aria-label="Voltar"
        >
          <ChevronLeft class="h-6 w-6" />
        </button>

        <div class="text-center">
          <h1 class="text-base font-extrabold tracking-[0.12em] uppercase text-[#1C1E28]">
            {subTab() === 'similar' ? 'DESCOBRIR' : 'MAPA DE REDE'}
          </h1>
          <p class="text-[11px] font-medium text-[#1C1E28]/70">
            {subTab() === 'similar'
              ? 'Passo 5 · Pessoas semelhantes a ti'
              : '63 participantes · 1.110 reconhecimentos'}
          </p>
        </div>

        <Show
          when={subTab() === 'graph'}
          fallback={
            <button
              type="button"
              onClick={() => navigate('/funcoes')}
              class="h-10 w-10 rounded-full hover:bg-white/35 flex items-center justify-center text-[#753065] cursor-pointer"
              aria-label="Ver Funções ideais"
              title="Funções ideais"
            >
              <Sparkles class="h-5 w-5" />
            </button>
          }
        >
          <button
            type="button"
            onClick={() => setExpandedShell(!expandedShell())}
            class="h-10 w-10 rounded-full hover:bg-white/35 hidden sm:flex items-center justify-center text-[#144B86] cursor-pointer"
            aria-label={expandedShell() ? 'Reduzir vista' : 'Expandir mapa'}
            title={expandedShell() ? 'Modo telemóvel' : 'Expandir vista do mapa'}
          >
            <Show when={expandedShell()} fallback={<Maximize2 class="h-5 w-5" />}>
              <Minimize2 class="h-5 w-5" />
            </Show>
          </button>
        </Show>
      </header>

      {/* Sub-Tabs: Semelhantes (30) vs Mapa de Rede (63) */}
      <div class="px-4 pb-3">
        <div class="p-1 rounded-2xl bg-white/45 backdrop-blur-md border border-white/70 grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setSubTab('similar')}
            class={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              subTab() === 'similar'
                ? 'bg-[#753065] text-white shadow-sm'
                : 'text-[#1C1E28]/75 hover:bg-white/40'
            }`}
          >
            <Users class="h-3.5 w-3.5" />
            <span>Semelhantes ({profiles().length || 30})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('graph')}
            class={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              subTab() === 'graph'
                ? 'bg-[#144B86] text-white shadow-sm'
                : 'text-[#1C1E28]/75 hover:bg-white/40'
            }`}
          >
            <Network class="h-3.5 w-3.5" />
            <span>Mapa de Rede (63)</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <Show
        when={subTab() === 'similar'}
        fallback={
          /* ==================== MAPA DE REDE (63 NÓS · 1.110 LIGAÇÕES) ==================== */
          <div class="flex-1 flex flex-col px-4 pb-6 gap-3 overflow-y-auto">
            {/* Search & Controls Bar */}
            <div class="glass-card-light rounded-2xl p-3 flex flex-wrap items-center gap-2">
              <div class="relative flex-1 min-w-[180px]">
                <Search class="h-3.5 w-3.5 text-[#1C1E28]/55 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={graphSearch()}
                  onInput={(e) => setGraphSearch(e.currentTarget.value)}
                  placeholder="Procurar pessoa na rede..."
                  class="w-full pl-8 pr-7 py-1.5 rounded-xl bg-white/85 text-xs font-semibold text-[#1C1E28] placeholder-[#1C1E28]/45 border border-white focus:outline-none focus:ring-2 focus:ring-[#144B86]"
                />
                <Show when={graphSearch()}>
                  <button
                    type="button"
                    onClick={() => {
                      setGraphSearch('');
                      setSelectedNodeId(null);
                    }}
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-[#1C1E28]/50 hover:text-[#1C1E28] cursor-pointer"
                    aria-label="Limpar pesquisa"
                  >
                    <X class="h-3.5 w-3.5" />
                  </button>
                </Show>

                {/* Instant Autocomplete */}
                <Show when={graphSearchMatches().length > 0 && activeFocusNode()?.name !== graphSearch()}>
                  <div class="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl bg-white shadow-xl border border-[#144B86]/15 overflow-hidden">
                    <For each={graphSearchMatches()}>
                      {(match) => (
                        <button
                          type="button"
                          onClick={() => selectNodeAndCenter(match)}
                          class="w-full px-3 py-2 text-left text-xs hover:bg-[#D1EAFF]/50 flex items-center justify-between cursor-pointer"
                        >
                          <span class="font-bold text-[#1C1E28]">{match.name}</span>
                          <span class="flex items-center gap-1.5 text-[10px] font-semibold text-[#1C1E28]/65">
                            <span
                              class="h-2 w-2 rounded-full"
                              style={{ background: match.color }}
                            />
                            {match.group}
                          </span>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </div>

              <button
                type="button"
                onClick={() => setSizeBySent((v) => !v)}
                class="px-3 py-1.5 rounded-xl bg-[#144B86] text-white text-[11px] font-bold cursor-pointer shrink-0"
              >
                Tamanho: {sizeBySent() ? 'enviadas' : 'recebidas'}
              </button>

              <div class="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(2.8, +(z + 0.25).toFixed(2)))}
                  class="h-8 w-8 rounded-xl bg-white/80 hover:bg-white flex items-center justify-center text-[#1C1E28] cursor-pointer"
                  aria-label="Aproximar"
                >
                  <ZoomIn class="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                  class="h-8 w-8 rounded-xl bg-white/80 hover:bg-white flex items-center justify-center text-[#1C1E28] cursor-pointer"
                  aria-label="Afastar"
                >
                  <ZoomOut class="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                    setSelectedNodeId(null);
                  }}
                  class="h-8 w-8 rounded-xl bg-white/80 hover:bg-white flex items-center justify-center text-[#1C1E28] cursor-pointer"
                  aria-label="Repor vista"
                >
                  <RotateCcw class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Interactive SVG Constellation Canvas */}
            <div class="relative rounded-3xl bg-[#0B172A] border border-white/40 shadow-xl overflow-hidden min-h-[370px] flex-1">
              <Show
                when={!loadingGraph() && positionedNodes().length > 0}
                fallback={
                  <div class="h-full min-h-[370px] flex items-center justify-center text-xs text-white/75">
                    A construir o grafo de 63 participantes e 1.110 ligações…
                  </div>
                }
              >
                <svg
                  viewBox="-284 -254 568 508"
                  class="w-full h-[370px] sm:h-[430px] select-none touch-none cursor-grab active:cursor-grabbing"
                  onPointerDown={(e) => {
                    if ((e.target as HTMLElement).dataset.nodeid) return;
                    setDraggingPan({
                      startX: e.clientX,
                      startY: e.clientY,
                      origX: pan().x,
                      origY: pan().y,
                    });
                  }}
                  onPointerMove={(e) => {
                    const drag = draggingPan();
                    if (!drag) return;
                    setPan({
                      x: drag.origX + (e.clientX - drag.startX),
                      y: drag.origY + (e.clientY - drag.startY),
                    });
                  }}
                  onPointerUp={() => setDraggingPan(null)}
                  onPointerLeave={() => setDraggingPan(null)}
                  onWheel={(e) => {
                    e.preventDefault();
                    const delta = e.deltaY < 0 ? 0.14 : -0.14;
                    setZoom((z) => Math.max(0.45, Math.min(3, +(z + delta).toFixed(2))));
                  }}
                >
                  <g transform={`translate(${pan().x} ${pan().y}) scale(${zoom()})`}>
                    {/* Links (1,110 directed recognitions) */}
                    <For each={graphData()?.edges ?? []}>
                      {(edge) => {
                        const s = () => nodeMap().get(edge.source);
                        const t = () => nodeMap().get(edge.target);
                        const hidden = () =>
                          hiddenGroups().has(edge.sourceGroup) ||
                          hiddenGroups().has(edge.targetGroup);

                        const linkVisual = createMemo(() => {
                          const fid = activeFocusNodeId();
                          if (fid === null) {
                            return {
                              stroke: 'rgba(17, 182, 186, 0.45)',
                              opacity: hidden() ? 0.02 : 0.14,
                              width: 0.75,
                            };
                          }
                          const { outSet, inSet } = focusRelations();
                          if (edge.source === fid) {
                            const isMutual = inSet.has(edge.target);
                            return {
                              stroke: isMutual ? '#e0412b' : '#fa0',
                              opacity: hidden() ? 0.05 : 0.85,
                              width: isMutual ? 1.8 : 1.4,
                            };
                          }
                          if (edge.target === fid) {
                            const isMutual = outSet.has(edge.source);
                            return {
                              stroke: isMutual ? '#e0412b' : '#358EC0',
                              opacity: hidden() ? 0.05 : 0.85,
                              width: isMutual ? 1.8 : 1.4,
                            };
                          }
                          return {
                            stroke: 'rgba(255,255,255,0.12)',
                            opacity: 0.04,
                            width: 0.5,
                          };
                        });

                        return (
                          <Show when={s() && t()}>
                            <line
                              x1={s()!.x}
                              y1={s()!.y}
                              x2={t()!.x}
                              y2={t()!.y}
                              stroke={linkVisual().stroke}
                              stroke-opacity={linkVisual().opacity}
                              stroke-width={linkVisual().width}
                            />
                          </Show>
                        );
                      }}
                    </For>

                    {/* Nodes (63 participants) */}
                    <For each={positionedNodes()}>
                      {(node) => {
                        const isHidden = () => hiddenGroups().has(node.group);
                        const isSelected = () => activeFocusNodeId() === node.id;
                        const isNeighbor = () => {
                          const fid = activeFocusNodeId();
                          if (fid === null) return true;
                          if (fid === node.id) return true;
                          const { outSet, inSet } = focusRelations();
                          return outSet.has(node.id) || inSet.has(node.id);
                        };
                        return (
                          <g
                            data-nodeid={node.id}
                            class="cursor-pointer"
                            onMouseEnter={() => setHoveredNodeId(node.id)}
                            onMouseLeave={() => setHoveredNodeId(null)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedNodeId((prev) =>
                                prev === node.id ? null : node.id
                              );
                            }}
                          >
                            <circle
                              data-nodeid={node.id}
                              cx={node.x}
                              cy={node.y}
                              r={nodeRadius(node)}
                              fill={node.color}
                              opacity={
                                isHidden() ? 0.1 : isNeighbor() ? 0.96 : 0.2
                              }
                              stroke={isSelected() ? '#FFFFFF' : 'rgba(11,23,42,0.55)'}
                              stroke-width={isSelected() ? 2.8 : 0.8}
                            />
                            <Show when={isSelected() || node.receivedCount >= 32}>
                              <text
                                x={node.x}
                                y={node.y}
                                dy="15"
                                text-anchor="middle"
                                fill="#FFFFFF"
                                font-size={isSelected() ? '9' : '7.5'}
                                font-weight={isSelected() ? '700' : '600'}
                                opacity={isHidden() ? 0.15 : 0.96}
                                style={{
                                  'pointer-events': 'none',
                                  'paint-order': 'stroke',
                                  stroke: '#0F1838',
                                  'stroke-width': '3px',
                                  'stroke-linejoin': 'round',
                                }}
                              >
                                {node.name.split(' ')[0]}
                              </text>
                            </Show>
                          </g>
                        );
                      }}
                    </For>
                  </g>
                </svg>
              </Show>

              {/* Link Color Legend Overlay */}
              <div class="absolute top-3 left-3 flex flex-wrap gap-1.5 pointer-events-none">
                <span class="px-2 py-0.5 rounded-full bg-[#0B172A]/80 border border-white/20 text-[10px] font-semibold text-white flex items-center gap-1">
                  <span class="h-2 w-2 rounded-full bg-[#fa0]" /> Enviadas
                </span>
                <span class="px-2 py-0.5 rounded-full bg-[#0B172A]/80 border border-white/20 text-[10px] font-semibold text-white flex items-center gap-1">
                  <span class="h-2 w-2 rounded-full bg-[#358EC0]" /> Recebidas
                </span>
                <span class="px-2 py-0.5 rounded-full bg-[#0B172A]/80 border border-white/20 text-[10px] font-semibold text-white flex items-center gap-1">
                  <span class="h-2 w-2 rounded-full bg-[#e0412b]" /> Mútuas
                </span>
              </div>

              {/* Selected/Hovered Node Inspector Card */}
              <Show when={activeFocusNode()}>
                {(node) => {
                  const discoverMatch = () => matchingDiscoverPeer(node().name);
                  return (
                    <div class="absolute bottom-3 left-3 right-3 rounded-2xl bg-[#0F1838]/92 backdrop-blur-md border border-white/30 p-3 text-white flex items-center justify-between gap-3 shadow-xl">
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <span
                            class="h-3 w-3 rounded-full shrink-0"
                            style={{ background: node().color }}
                          />
                          <h3 class="text-sm font-extrabold truncate">{node().name}</h3>
                          <span class="px-2 py-0.5 rounded-full bg-white/15 text-[10px] font-semibold shrink-0">
                            {node().group}
                          </span>
                        </div>
                        <p class="text-[11px] text-white/80 mt-0.5">
                          Recebidas: <strong>{node().receivedCount}</strong> · Enviadas:{' '}
                          <strong>{node().sentCount}</strong> · Mútuas:{' '}
                          <strong>{mutualCountForFocus()}</strong>
                        </p>
                      </div>

                      <div class="flex items-center gap-1.5 shrink-0">
                        <Show when={discoverMatch()}>
                          {(peer) => (
                            <button
                              type="button"
                              onClick={() => {
                                setSubTab('similar');
                                setSelectedProfile(peer());
                              }}
                              class="px-2.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-[11px] font-bold cursor-pointer"
                            >
                              Perfil
                            </button>
                          )}
                        </Show>
                        <button
                          type="button"
                          onClick={() =>
                            openSendTo({
                              name: node().name.split(' ')[0] || node().name,
                            })
                          }
                          class="px-3 py-1.5 rounded-xl bg-[#753065] hover:bg-[#8B3A78] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Send class="h-3 w-3" />
                          <span>Mandar</span>
                        </button>
                      </div>
                    </div>
                  );
                }}
              </Show>
            </div>

            {/* Interactive Group Legend (11 Official Groups) */}
            <div class="glass-card-light rounded-2xl p-3 space-y-2">
              <div class="flex items-center justify-between text-[11px]">
                <span class="font-extrabold uppercase tracking-wider text-[#1C1E28]/80">
                  Grupos (toca para filtrar)
                </span>
                <span class="text-[#1C1E28]/65">Dados fictícios da rede</span>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <For each={graphData()?.groups ?? []}>
                  {(g) => {
                    const isHidden = () => hiddenGroups().has(g.name);
                    return (
                      <button
                        type="button"
                        onClick={() => toggleGroupVisibility(g.name)}
                        class={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 border transition-opacity cursor-pointer ${
                          isHidden()
                            ? 'opacity-35 bg-white/40 border-white/40'
                            : 'bg-white/80 border-white shadow-xs'
                        }`}
                      >
                        <span
                          class="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ background: g.color }}
                        />
                        <span>{g.name}</span>
                        <span class="text-[10px] opacity-60">{g.count}</span>
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>
          </div>
        }
      >
        {/* ==================== SEMELHANTES TAB (Passo 5 Descobrir) ==================== */}
        <div class="flex-1 overflow-y-auto px-4 pb-8 space-y-3">
          {/* Privacy Badge */}
          <div class="rounded-2xl bg-white/55 border border-white/80 px-3.5 py-2 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 text-xs font-semibold text-[#144B86]">
              <ShieldCheck class="h-4 w-4 shrink-0" />
              <span>Perfis sintéticos por defeito (30 pessoas · 90 MighTs)</span>
            </div>
          </div>

          {/* Search Bar */}
          <div class="relative">
            <Search class="h-4 w-4 text-[#1C1E28]/45 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={peerQuery()}
              onInput={(e) => setPeerQuery(e.currentTarget.value)}
              placeholder="Procurar por nome, função ou empresa…"
              class="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/80 border border-white text-xs font-semibold text-[#1C1E28] placeholder-[#1C1E28]/45 focus:outline-none focus:ring-2 focus:ring-[#753065]"
            />
          </div>

          {/* Dimension Filter Pills (matching 02 About-1.jpg pills) */}
          <div class="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
            <For each={DIM_FILTERS}>
              {(item) => {
                const active = () => dimFilter() === item.key;
                return (
                  <button
                    type="button"
                    onClick={() => setDimFilter(item.key)}
                    class={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      active()
                        ? 'bg-[#753065] text-white shadow-sm'
                        : 'bg-white/75 text-[#1C1E28] hover:bg-white'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              }}
            </For>
          </div>

          <div class="text-[11px] font-extrabold tracking-[0.1em] uppercase text-[#1C1E28]/65 pt-1">
            PESSOAS COM POTENCIAL SEMELHANTE
          </div>

          {/* Ranked Profile Cards */}
          <Show
            when={!loadingSimilar()}
            fallback={
              <div class="glass-card-light rounded-2xl p-6 text-center text-xs font-semibold text-[#1C1E28]/70">
                A calcular % de peso sobreposto…
              </div>
            }
          >
            <Show
              when={filteredProfiles().length > 0}
              fallback={
                <div class="glass-card-light rounded-2xl p-6 text-center space-y-2">
                  <Compass class="h-7 w-7 mx-auto text-[#144B86]" />
                  <p class="text-xs font-bold text-[#1C1E28]">
                    Nenhum perfil corresponde à tua pesquisa.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPeerQuery('')}
                    class="px-3.5 py-1.5 rounded-xl bg-[#753065] text-white text-xs font-bold cursor-pointer"
                  >
                    Mostrar todos
                  </button>
                </div>
              }
            >
              <div class="space-y-2.5">
                <For each={filteredProfiles()}>
                  {(person) => (
                    <div
                      onClick={() => {
                        setDrawerFigureMode('modular');
                        setSelectedProfile(person);
                      }}
                      class="glass-card-light rounded-2xl p-3.5 space-y-2.5 hover:bg-white/65 transition-all cursor-pointer"
                    >
                      <div class="flex items-center justify-between gap-3">
                        <div class="flex items-center gap-3 min-w-0">
                          <img
                            src={person.photoUrl || person.avatarUrl}
                            alt={person.name}
                            class="h-12 w-12 rounded-full object-cover bg-white/70 border border-white shrink-0 shadow-xs"
                          />
                          <div class="min-w-0">
                            <h3 class="text-sm font-extrabold text-[#1C1E28] truncate">
                              {person.name}
                            </h3>
                            <p class="text-xs font-medium text-[#1C1E28]/75 truncate">
                              {person.role} · {person.company}
                            </p>
                            <div class="flex items-center gap-1.5 mt-0.5">
                              <span class="px-2 py-0.5 rounded-full bg-[#144B86]/12 text-[#144B86] text-[10px] font-bold">
                                {person.groupName}
                              </span>
                              <span class="text-[11px] font-extrabold text-[#3D9061]">
                                {person.similarityPct}% semelhança
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openSendTo({
                              id: person.id,
                              name: person.name.split(' ')[0] || person.name,
                              role: person.role,
                              company: person.company,
                              avatarUrl: person.avatarUrl,
                              photoUrl: person.photoUrl,
                            });
                          }}
                          class="h-9 w-9 rounded-full bg-[#753065] hover:bg-[#8B3A78] text-white flex items-center justify-center shrink-0 shadow cursor-pointer"
                          aria-label={`Mandar MighT para ${person.name}`}
                          title="Mandar MighT"
                        >
                          <Send class="h-4 w-4" />
                        </button>
                      </div>

                      {/* Common Tags + Biggest Difference */}
                      <div class="space-y-1.5 pt-1 border-t border-white/60">
                        <div class="flex flex-wrap items-center gap-1.5">
                          <span class="text-[10px] font-extrabold uppercase tracking-wide text-[#1C1E28]/60 mr-0.5">
                            Em comum:
                          </span>
                          <Show
                            when={person.commonTags.length > 0}
                            fallback={
                              <span class="text-[11px] italic text-[#1C1E28]/60">
                                Perfis complementares
                              </span>
                            }
                          >
                            <For each={person.commonTags.slice(0, 3)}>
                              {(ct) => (
                                <span class="px-2 py-0.5 rounded-lg bg-[#DBF2E5] text-[#3D9061] text-[11px] font-bold">
                                  {ct.labelPt}
                                </span>
                              )}
                            </For>
                          </Show>
                        </div>

                        <p class="text-[11px] text-[#144B86] font-medium leading-snug">
                          <strong>Maior diferença:</strong> {person.biggestDifference.summaryPt}
                        </p>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </div>
      </Show>

      {/* ==================== PROFILE DETAIL DRAWER ==================== */}
      <Show when={selectedProfile()}>
        {(person) => (
          <div
            class="fixed inset-0 z-50 bg-[#0B101D]/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedProfile(null)}
          >
            <div
              class="w-full max-w-[420px] max-h-[88dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-might-blue text-white p-5 space-y-4 shadow-2xl border border-white/30"
              onClick={(e) => e.stopPropagation()}
            >
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <img
                    src={person().photoUrl || person().avatarUrl}
                    alt={person().name}
                    class="h-12 w-12 rounded-full object-cover border-2 border-white shadow shrink-0"
                  />
                  <div class="min-w-0">
                    <h2 class="text-base font-extrabold text-[#0F1838] truncate">
                      {person().name}
                    </h2>
                    <p class="text-xs font-semibold text-[#0F1838]/80 truncate">
                      {person().role} · {person().company}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedProfile(null)}
                  class="h-8 w-8 rounded-full bg-white/30 hover:bg-white/45 flex items-center justify-center text-[#0F1838] cursor-pointer shrink-0"
                  aria-label="Fechar"
                >
                  <X class="h-4 w-4" />
                </button>
              </div>

              {/* 3D Figure & Similarity Score */}
              <div class="glass-card-strong rounded-3xl p-4 flex items-center gap-4">
                <div class="w-24 h-28 shrink-0 flex flex-col items-center">
                  <MightFigure
                    mode={drawerFigureMode()}
                    selection={person().selfTags}
                    avatarUrl={person().avatarUrl}
                    tags={bootstrap()?.tags ?? []}
                    animateFloat
                    class="w-full h-full"
                  />
                </div>
                <div class="flex-1 space-y-2">
                  <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#3D9061] text-white text-xs font-extrabold">
                    <span>{person().similarityPct}% semelhança contigo</span>
                  </div>
                  <p class="text-xs text-white/95 italic leading-snug">
                    «{person().taglinePt}»
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setDrawerFigureMode((m) => (m === 'modular' ? 'avatar' : 'modular'))
                    }
                    class="text-[10px] font-bold underline text-white/80 cursor-pointer"
                  >
                    {drawerFigureMode() === 'modular'
                      ? 'Ver figura artística'
                      : 'Ver figura modular 3D'}
                  </button>
                </div>
              </div>

              {/* Self MighT + Full Tag Cloud */}
              <div class="glass-card rounded-2xl p-3.5 space-y-2.5">
                <div class="text-[11px] font-extrabold uppercase tracking-wider text-white/85">
                  3 palavras principais
                </div>
                <div class="grid grid-cols-3 gap-1.5 text-center">
                  <div class="rounded-xl bg-white/20 px-2 py-1.5">
                    <div class="text-[9px] uppercase opacity-75">Cabeça</div>
                    <div class="text-xs font-extrabold truncate">
                      {getTagLabel(person().selfTags.head)}
                    </div>
                  </div>
                  <div class="rounded-xl bg-white/20 px-2 py-1.5">
                    <div class="text-[9px] uppercase opacity-75">Corpo</div>
                    <div class="text-xs font-extrabold truncate">
                      {getTagLabel(person().selfTags.body)}
                    </div>
                  </div>
                  <div class="rounded-xl bg-white/20 px-2 py-1.5">
                    <div class="text-[9px] uppercase opacity-75">Braços</div>
                    <div class="text-xs font-extrabold truncate">
                      {getTagLabel(person().selfTags.arms)}
                    </div>
                  </div>
                </div>

                <Show when={person().topTags.length > 0}>
                  <div class="pt-1">
                    <div class="text-[10px] font-bold uppercase tracking-wider text-white/75 mb-1.5">
                      Nuvem de reconhecimento
                    </div>
                    <div class="flex flex-wrap gap-1.5">
                      <For each={person().topTags.slice(0, 8)}>
                        {(t) => (
                          <span
                            class="px-2.5 py-1 rounded-full bg-white/90 text-[#1C1E28] text-[11px] font-bold flex items-center gap-1"
                            style={{
                              'border-left': `3px solid ${DIMENSION_META[t.dimension].accentHex}`,
                            }}
                          >
                            <span>{t.labelPt}</span>
                            <span class="text-[#144B86] text-[10px]">{t.pct}%</span>
                          </span>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>

                <Show when={person().circles.length > 0}>
                  <div class="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                    <span class="text-white/75 font-semibold">Círculos:</span>
                    <For each={person().circles}>
                      {(c) => (
                        <span class="px-2 py-0.5 rounded-full bg-white/15 text-white text-[10px] font-semibold">
                          {c}
                        </span>
                      )}
                    </For>
                  </div>
                </Show>
              </div>

              {/* Biggest Difference & Bio */}
              <div class="rounded-2xl bg-[#0F1838]/30 border border-white/20 p-3 space-y-1.5 text-xs">
                <p class="text-white/90">{person().bio}</p>
                <p class="text-[#FFE5C7] font-semibold">
                  Maior diferença: {person().biggestDifference.summaryPt}
                </p>
              </div>

              {/* Zero Dead-End Actions */}
              <div class="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const p = person();
                    setSelectedProfile(null);
                    openSendTo({
                      id: p.id,
                      name: p.name.split(' ')[0] || p.name,
                      role: p.role,
                      company: p.company,
                      avatarUrl: p.avatarUrl,
                      photoUrl: p.photoUrl,
                    });
                  }}
                  class="flex-1 py-3 px-4 rounded-2xl bg-[#753065] hover:bg-[#8B3A78] text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send class="h-4 w-4" />
                  <span>Mandar MighT</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedProfile(null);
                    navigate('/funcoes');
                  }}
                  class="py-3 px-4 rounded-2xl bg-white/25 hover:bg-white/35 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Funções</span>
                  <ArrowRight class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
