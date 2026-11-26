import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Compass,
  Info,
  Send,
  Sparkles,
  TrendingUp,
} from 'lucide-solid';
import type { RoleRecommendation, RolesResponse } from '../../../shared/types';
import * as api from '../lib/api';
import { useMight } from '../lib/store';

const LEVEL_META: Record<
  'now' | 'next' | 'stretch',
  { label: string; subtitle: string; badgeBg: string; ringColor: string }
> = {
  now: {
    label: 'Agora',
    subtitle: 'Encaixe imediato com o teu MighT actual',
    badgeBg: 'bg-[#3D9061] text-white',
    ringColor: 'border-[#3D9061]',
  },
  next: {
    label: 'Próximo',
    subtitle: 'Evolução natural a 12–24 meses',
    badgeBg: 'bg-[#0A5AA9] text-white',
    ringColor: 'border-[#0A5AA9]',
  },
  stretch: {
    label: 'Desafio',
    subtitle: 'Salto ambicioso onde o teu potencial brilha',
    badgeBg: 'bg-[#753065] text-white',
    ringColor: 'border-[#753065]',
  },
};

export function RolesScreen() {
  const { bootstrap, navigate, getTagLabel, openSendTo } = useMight();

  const [rolesData, setRolesData] = createSignal<RolesResponse | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [selectedTrack, setSelectedTrack] = createSignal<string>('Todas');
  const [expandedSlugs, setExpandedSlugs] = createSignal<Set<string>>(new Set());

  createEffect(() => {
    void bootstrap();
    setLoading(true);
    void (async () => {
      try {
        const res = await api.fetchRoles();
        setRolesData(res);
      } catch {
        // ignore transient error
      } finally {
        setLoading(false);
      }
    })();
  });

  const tracks = createMemo(() => {
    const all = rolesData()?.roles ?? [];
    const set = new Set(all.map((r) => r.trackPt));
    return ['Todas', ...Array.from(set)];
  });

  const trajectoryStages = createMemo(() => {
    const t = rolesData()?.trajectory;
    if (!t) return [];
    const list: { stage: 'now' | 'next' | 'stretch'; role: RoleRecommendation }[] = [];
    if (t.now) list.push({ stage: 'now', role: t.now });
    if (t.next) list.push({ stage: 'next', role: t.next });
    if (t.stretch) list.push({ stage: 'stretch', role: t.stretch });
    return list;
  });

  const filteredCatalog = createMemo(() => {
    const all = rolesData()?.roles ?? [];
    const tr = selectedTrack();
    if (tr === 'Todas') return all;
    return all.filter((r) => r.trackPt === tr);
  });

  const toggleExpand = (slug: string) => {
    setExpandedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  return (
    <div class="bg-might-blue min-h-full flex flex-col text-white">
      {/* Header */}
      <header class="px-4 pt-4 pb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/home')}
          class="h-10 w-10 rounded-full hover:bg-white/25 flex items-center justify-center text-[#0F1838] cursor-pointer"
          aria-label="Voltar"
        >
          <ChevronLeft class="h-6 w-6" />
        </button>

        <div class="text-center">
          <h1 class="text-base font-extrabold tracking-[0.12em] uppercase text-[#0F1838]">
            FUNÇÕES IDEAIS
          </h1>
          <p class="text-[11px] font-medium text-[#0F1838]/75">
            Passo 6 · Agora → Próximo → Desafio
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/descobrir')}
          class="h-10 w-10 rounded-full hover:bg-white/25 flex items-center justify-center text-[#0F1838] cursor-pointer"
          aria-label="Descobrir pessoas semelhantes"
          title="Descobrir semelhantes"
        >
          <Compass class="h-5 w-5" />
        </button>
      </header>

      <div class="flex-1 overflow-y-auto px-4 pb-8 space-y-4">
        {/* Explicit "Apenas hipóteses" Trust Banner */}
        <div class="rounded-2xl bg-[#FFE5C7] border border-white/70 px-3.5 py-2.5 flex items-start gap-2.5 text-[#0F1838] shadow-sm">
          <Info class="h-4 w-4 text-[#E88F3D] shrink-0 mt-0.5" />
          <div class="space-y-0.5">
            <div class="text-[11px] font-extrabold uppercase tracking-wider text-[#B65D14]">
              Apenas hipóteses
            </div>
            <p class="text-xs font-medium leading-snug">
              {rolesData()?.disclaimerPt ||
                'Sugestões explicáveis com base nas tuas tags e em perfis semelhantes — nunca um diagnóstico definitivo.'}
            </p>
          </div>
        </div>

        {/* Visual 3-Stage Progression Strip: Agora → Próximo → Desafio */}
        <div class="grid grid-cols-3 gap-2">
          <For each={['now', 'next', 'stretch'] as const}>
            {(stage) => {
              const meta = LEVEL_META[stage];
              const role = () => rolesData()?.trajectory?.[stage];
              return (
                <div class="min-w-0 flex flex-col items-center text-center p-2 rounded-xl bg-white/85 backdrop-blur-md border border-white/90 shadow-sm">
                  <span
                    class={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold ${meta.badgeBg}`}
                  >
                    {meta.label}
                  </span>
                  <div class="text-[11px] font-bold text-[#0F1838] leading-tight line-clamp-2 mt-1">
                    {role()?.titlePt || '…'}
                  </div>
                </div>
              );
            }}
          </For>
        </div>

        {/* Unlock Hint if using Self MighT only */}
        <Show when={rolesData() && !rolesData()!.unlocked}>
          <div class="rounded-2xl bg-white/85 backdrop-blur-md border border-white/90 shadow-sm px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-[#0F1838]">
            <span class="font-medium text-[#1C1E28]/85">
              Baseado no teu Self MighT. Aceita 3 MighTs para afinar com a visão dos outros.
            </span>
            <button
              type="button"
              onClick={() => navigate('/pedir')}
              class="shrink-0 px-2.5 py-1.5 rounded-xl bg-[#753065] text-white font-bold text-[11px] cursor-pointer"
            >
              Pedir MighT
            </button>
          </div>
        </Show>

        {/* Featured 3-Step Trajectory Cards */}
        <Show
          when={!loading()}
          fallback={
            <div class="rounded-3xl bg-white/85 backdrop-blur-md border border-white/90 p-6 text-center text-xs font-semibold text-[#0F1838]">
              A cruzar as tuas palavras com perfis semelhantes…
            </div>
          }
        >
          <div class="relative space-y-3 pl-3">
            {/* Vertical Progression Connector Line */}
            <div class="absolute left-[19px] top-6 bottom-6 w-0.5 bg-white/55 pointer-events-none" />

            <For each={trajectoryStages()}>
              {(entry) => {
                const meta = LEVEL_META[entry.stage];
                const role = entry.role;
                const isExpanded = () => expandedSlugs().has(`traj-${role.slug}`);

                return (
                  <div class="relative pl-5">
                    {/* Timeline Node Dot */}
                    <div
                      class={`absolute left-0 top-5 h-4 w-4 rounded-full bg-white border-4 ${meta.ringColor} shadow`}
                    />

                    <article class="rounded-3xl bg-white/85 backdrop-blur-md border border-white/90 shadow-md p-4 space-y-3 text-[#0F1838]">
                      {/* Header Row */}
                      <div class="flex items-start justify-between gap-2">
                        <div class="space-y-1 min-w-0">
                          <div class="flex flex-wrap items-center gap-1.5">
                            <span
                              class={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${meta.badgeBg}`}
                            >
                              {meta.label}
                            </span>
                            <span class="px-2.5 py-0.5 rounded-full bg-[#E6F4FF] text-[#144B86] text-[10px] font-bold">
                              {role.trackPt}
                            </span>
                          </div>
                          <h2 class="text-base font-extrabold text-[#0F1838] leading-snug">
                            {role.titlePt}
                          </h2>
                          <p class="text-[11px] font-medium text-[#1C1E28]/75">{meta.subtitle}</p>
                        </div>

                        <div class="shrink-0 text-right">
                          <div class="px-2.5 py-1 rounded-xl bg-[#144B86] text-white text-xs font-extrabold shadow-sm">
                            {role.matchPct}%
                          </div>
                          <div class="text-[9px] font-bold text-[#1C1E28]/70 mt-0.5">
                            encaixe
                          </div>
                        </div>
                      </div>

                      {/* Matched Tags */}
                      <Show when={role.matchedTags.length > 0}>
                        <div class="flex flex-wrap gap-1.5">
                          <For each={role.matchedTags}>
                            {(slug) => (
                              <span class="px-2.5 py-1 rounded-xl bg-[#DBF2E5] text-[#1C1E28] border border-[#3D9061]/20 text-[11px] font-bold">
                                {getTagLabel(slug)}
                              </span>
                            )}
                          </For>
                        </div>
                      </Show>

                      {/* 1-Line Explainable Hypothesis in Guillemets */}
                      <div class="rounded-2xl bg-[#0F1838] text-white px-3.5 py-2.5 text-xs leading-relaxed shadow-sm">
                        <strong class="text-[#C6EE00]">
                          «Porque é que isto encaixa em ti:
                        </strong>{' '}
                        {role.hypothesisPt}»
                      </div>

                      {/* Similar Peers Already in That Role (Clickable) */}
                      <Show when={role.similarPeers.length > 0}>
                        <div class="space-y-1.5">
                          <div class="text-[10px] font-extrabold uppercase tracking-wider text-[#1C1E28]/70">
                            Pessoas semelhantes nesta função
                          </div>
                          <div class="flex flex-wrap gap-1.5">
                            <For each={role.similarPeers}>
                              {(peer) => (
                                <button
                                  type="button"
                                  onClick={() => navigate('/descobrir')}
                                  class="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-[#E6F4FF] hover:bg-[#D1EAFF] border border-[#0A5AA9]/20 text-[11px] font-bold text-[#0A5AA9] cursor-pointer transition-colors"
                                  title={`${peer.name} · ${peer.role} @ ${peer.company}`}
                                >
                                  <img
                                    src={peer.photoUrl || peer.avatarUrl}
                                    alt={peer.name}
                                    class="h-5 w-5 rounded-full object-cover"
                                  />
                                  <span>{peer.name.split(' ')[0]}</span>
                                  <span class="text-[#144B86] font-extrabold">{peer.similarityPct}%</span>
                                </button>
                              )}
                            </For>
                          </div>
                        </div>
                      </Show>

                      {/* Sample Companies + Expand Toggle */}
                      <div class="flex items-center justify-between gap-2 pt-2 border-t border-[#0F1838]/10">
                        <div class="flex items-center gap-1.5 text-[11px] font-medium text-[#1C1E28]/75 truncate">
                          <Building2 class="h-3.5 w-3.5 shrink-0 text-[#144B86]" />
                          <span class="truncate">
                            {role.sampleCompanies.join(' · ')}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleExpand(`traj-${role.slug}`)}
                          class="shrink-0 text-[11px] font-extrabold text-[#753065] flex items-center gap-1 cursor-pointer hover:underline"
                        >
                          <span>{isExpanded() ? 'Menos' : 'Detalhes'}</span>
                          <Show
                            when={isExpanded()}
                            fallback={<ChevronDown class="h-3.5 w-3.5" />}
                          >
                            <ChevronUp class="h-3.5 w-3.5" />
                          </Show>
                        </button>
                      </div>

                      <Show when={isExpanded()}>
                        <div class="rounded-2xl bg-[#F2F7FC] border border-[#144B86]/15 p-3 space-y-2 text-xs text-[#1C1E28]">
                          <p class="leading-relaxed">{role.summaryPt}</p>
                          <div class="flex items-center justify-between gap-2 pt-1">
                            <span class="text-[10px] italic text-[#1C1E28]/70">
                              {role.disclaimerPt}
                            </span>
                            <Show when={role.similarPeers[0]}>
                              {(firstPeer) => (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openSendTo({
                                      id: firstPeer().id,
                                      name: firstPeer().name.split(' ')[0] || firstPeer().name,
                                      role: firstPeer().role,
                                      company: firstPeer().company,
                                      avatarUrl: firstPeer().avatarUrl,
                                      photoUrl: firstPeer().photoUrl,
                                    })
                                  }
                                  class="shrink-0 px-2.5 py-1 rounded-xl bg-[#753065] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <Send class="h-3 w-3" />
                                  <span>Conectar</span>
                                </button>
                              )}
                            </Show>
                          </div>
                        </div>
                      </Show>
                    </article>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>

        {/* Filterable Catalog of All 20 Roles by Track */}
        <section class="space-y-3 pt-2">
          <div class="flex items-center justify-between">
            <h2 class="text-xs font-extrabold tracking-[0.12em] uppercase text-[#0F1838]">
              Catálogo completo ({filteredCatalog().length} funções)
            </h2>
            <span class="text-[11px] font-semibold text-[#0F1838]/75 flex items-center gap-1">
              <TrendingUp class="h-3.5 w-3.5" />
              <span>5 trilhos</span>
            </span>
          </div>

          {/* Track Filter Pills */}
          <div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <For each={tracks()}>
              {(track) => {
                const active = () => selectedTrack() === track;
                return (
                  <button
                    type="button"
                    onClick={() => setSelectedTrack(track)}
                    class={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      active()
                        ? 'bg-[#753065] text-white shadow'
                        : 'bg-white/80 text-[#0F1838] border border-white/90 hover:bg-white'
                    }`}
                  >
                    {track}
                  </button>
                );
              }}
            </For>
          </div>

          {/* Role Cards */}
          <div class="space-y-2.5">
            <For each={filteredCatalog()}>
              {(role) => {
                const meta = LEVEL_META[role.level];
                const isOpen = () => expandedSlugs().has(`cat-${role.slug}`);
                return (
                  <div class="rounded-2xl bg-white/85 backdrop-blur-md border border-white/90 shadow-md p-3.5 space-y-2.5 text-[#0F1838]">
                    <div
                      onClick={() => toggleExpand(`cat-${role.slug}`)}
                      class="flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div class="min-w-0">
                        <div class="flex items-center gap-1.5">
                          <span
                            class={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${meta.badgeBg}`}
                          >
                            {meta.label}
                          </span>
                          <span class="text-[10px] font-bold text-[#144B86] truncate">
                            {role.trackPt}
                          </span>
                        </div>
                        <h3 class="text-sm font-extrabold text-[#0F1838] mt-0.5 truncate">
                          {role.titlePt}
                        </h3>
                      </div>

                      <div class="flex items-center gap-2 shrink-0">
                        <span class="px-2.5 py-1 rounded-xl bg-[#144B86] text-white text-xs font-extrabold">
                          {role.matchPct}%
                        </span>
                        <Show
                          when={isOpen()}
                          fallback={<ChevronDown class="h-4 w-4 text-[#753065]" />}
                        >
                          <ChevronUp class="h-4 w-4 text-[#753065]" />
                        </Show>
                      </div>
                    </div>

                    <p class="rounded-xl bg-[#0F1838] text-white px-3 py-2 text-[11px] leading-snug">
                      <strong class="text-[#C6EE00]">«Porque é que isto encaixa em ti:</strong>{' '}
                      {role.hypothesisPt}»
                    </p>

                    <Show when={isOpen()}>
                      <div class="pt-2 border-t border-[#0F1838]/10 space-y-2 text-xs text-[#1C1E28]">
                        <p class="text-[#1C1E28]/85">{role.summaryPt}</p>
                        <div class="flex flex-wrap gap-1.5">
                          <For each={role.matchedTags}>
                            {(slug) => (
                              <span class="px-2 py-0.5 rounded-lg bg-[#DBF2E5] text-[#1C1E28] text-[10px] font-bold">
                                {getTagLabel(slug)}
                              </span>
                            )}
                          </For>
                        </div>
                        <div class="flex items-center justify-between text-[11px] text-[#1C1E28]/75">
                          <span>Empresas: {role.sampleCompanies.join(', ')}</span>
                          <button
                            type="button"
                            onClick={() => navigate('/descobrir')}
                            class="font-extrabold text-[#753065] hover:underline cursor-pointer"
                          >
                            Ver semelhantes →
                          </button>
                        </div>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </section>

        {/* Zero Dead-End Footer */}
        <button
          type="button"
          onClick={() => navigate('/card')}
          class="w-full py-3.5 px-5 rounded-2xl bg-[#753065] hover:bg-[#8B3A78] text-white font-extrabold text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer"
        >
          <Sparkles class="h-4 w-4" />
          <span>Ir para o meu MighT Card</span>
        </button>
      </div>
    </div>
  );
}
