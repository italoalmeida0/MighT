import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import {
  ArrowRight,
  ChevronLeft,
  Compass,
  Lock,
  Search,
  Sparkles,
  Unlock,
  Zap,
} from 'lucide-solid';
import { DIMENSION_META, type Dimension, type JohariStats } from '../../../shared/types';
import * as api from '../lib/api';
import { useMight } from '../lib/store';

const DIMENSIONS: Dimension[] = ['personality', 'power', 'character'];

export function StatsScreen() {
  const { bootstrap, navigate, setActiveMode } = useMight();
  const [statsData, setStatsData] = createSignal<JohariStats | null>(
    bootstrap()?.stats ?? null
  );
  const [loading, setLoading] = createSignal(false);

  // Keep synced with bootstrap updates & fetch fresh /api/me/stats
  createEffect(() => {
    const bootStats = bootstrap()?.stats;
    if (bootStats) {
      setStatsData(bootStats);
    }
    setLoading(true);
    void (async () => {
      try {
        const fresh = await api.fetchStats();
        setStatsData(fresh);
      } catch {
        // retain bootstrap stats fallback
      } finally {
        setLoading(false);
      }
    })();
  });

  const stats = () => statsData() ?? bootstrap()?.stats;
  const acceptedCount = () => bootstrap()?.profile.acceptedCount ?? 0;
  const unlocked = () => Boolean(stats()?.unlocked);

  // Donut Ring Geometry (exact match to 05 Stats — My MighT.jpg)
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = createMemo(() => {
    const pct = Math.max(0, Math.min(100, stats()?.alignmentPct ?? 0));
    return circumference - (pct / 100) * circumference;
  });

  return (
    <div class="bg-might-blue min-h-full flex flex-col text-white">
      {/* Top Bar matching 05 Stats — My MighT.jpg */}
      <header class="px-4 pt-5 pb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/home')}
          class="h-10 w-10 rounded-full hover:bg-white/25 flex items-center justify-center text-[#0F1838] cursor-pointer transition-colors"
          aria-label="Voltar"
        >
          <ChevronLeft class="h-6 w-6" />
        </button>

        <div class="text-center">
          <h1 class="text-base font-extrabold tracking-[0.12em] uppercase text-[#0F1838]">
            ESTATÍSTICAS
          </h1>
          <p class="text-xs font-medium text-[#0F1838]/75">
            Mightificado {stats()?.totalReceived ?? 0}{' '}
            {(stats()?.totalReceived ?? 0) === 1 ? 'vez' : 'vezes'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!unlocked()) {
              navigate('/pedir');
            } else {
              setActiveMode('all');
              navigate('/home');
            }
          }}
          class="h-10 w-10 rounded-full hover:bg-white/25 flex items-center justify-center text-[#0F1838]/80 cursor-pointer transition-colors"
          aria-label={unlocked() ? 'Perfil desbloqueado' : 'Perfil bloqueado'}
          title={
            unlocked()
              ? 'All MighT desbloqueado'
              : `Faltam ${Math.max(0, 3 - acceptedCount())} MighTs aceites`
          }
        >
          <Show when={unlocked()} fallback={<Lock class="h-5 w-5" />}>
            <Unlock class="h-5 w-5 text-[#144B86]" />
          </Show>
        </button>
      </header>

      <div class="flex-1 overflow-y-auto px-4 pb-8 space-y-4">
        {/* Helpful Lock Banner when < 3 accepted MighTs */}
        <Show when={!unlocked()}>
          <div class="glass-card-strong rounded-2xl p-4 space-y-2.5 border border-white/50">
            <div class="flex items-center gap-2 text-[#0F1838]">
              <Lock class="h-4 w-4 shrink-0 text-[#753065]" />
              <span class="text-xs font-extrabold uppercase tracking-wide">
                Faltam {Math.max(0, 3 - acceptedCount())} MighTs aceites para desbloquear
              </span>
            </div>
            <p class="text-xs text-[#0F1838]/85 leading-relaxed">
              Aceita pelo menos 3 MighTs na tua Caixa de Entrada ou convida quem te conhece para revelar o alinhamento completo.
            </p>
            <div class="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveMode('all');
                  navigate('/home');
                }}
                class="flex-1 py-2 px-3 rounded-xl bg-[#753065] text-white text-xs font-bold cursor-pointer"
              >
                Ver Caixa de Entrada
              </button>
              <button
                type="button"
                onClick={() => navigate('/pedir')}
                class="flex-1 py-2 px-3 rounded-xl bg-[#144B86] text-white text-xs font-bold cursor-pointer"
              >
                Pedir MighTs
              </button>
            </div>
          </div>
        </Show>

        {/* CARD 1: SELF VS. ALL MIGHT (Exact parity with 05 Stats — My MighT.jpg) */}
        <section class="rounded-2xl bg-white/35 backdrop-blur-xl border border-white/60 shadow-[0_12px_32px_rgba(10,24,56,0.12)] p-4 space-y-3.5">
          <div class="flex items-center justify-between">
            <h2 class="text-xs font-extrabold tracking-[0.12em] uppercase text-[#0F1838]">
              SELF VS. ALL MIGHT
            </h2>
            <Show when={loading()}>
              <span class="text-[10px] font-semibold text-[#144B86]">A actualizar…</span>
            </Show>
          </div>

          {/* Donut Ring + Headline % */}
          <div class="flex items-center gap-4">
            <div class="relative h-20 w-20 shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 80 80" class="h-20 w-20 -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r={radius}
                  fill="none"
                  stroke="rgba(20, 75, 134, 0.22)"
                  stroke-width="11"
                />
                <circle
                  cx="40"
                  cy="40"
                  r={radius}
                  fill="none"
                  stroke="#144B86"
                  stroke-width="11"
                  stroke-dasharray={String(circumference)}
                  stroke-dashoffset={dashOffset()}
                  stroke-linecap="butt"
                  class="transition-[stroke-dashoffset] duration-700 ease-out"
                />
              </svg>
            </div>

            <div class="flex-1 min-w-0">
              <div class="text-[36px] font-extrabold text-[#144B86] leading-none tracking-tight">
                {stats()?.alignmentPct ?? 0}%
              </div>
              <p class="text-xs font-medium text-[#144B86] mt-1 leading-snug">
                {stats()?.confirmedCount ?? 0} das tuas {stats()?.selfCount ?? 3} escolhas foram confirmadas pelos outros.
              </p>
            </div>
          </div>

          {/* Blue Lightning Callout */}
          <div class="rounded-xl bg-[#A7CDF3] border border-white/50 px-3.5 py-2.5 flex items-center gap-2.5 text-[#0F1838]">
            <Zap class="h-4 w-4 text-[#0A5AA9] shrink-0 fill-[#0A5AA9]" />
            <p class="text-xs font-medium leading-snug">
              {stats()?.topHeadlineInsight ||
                'Ainda sem MighTs suficientes para destacar a percepção principal.'}
            </p>
          </div>

          {/* Orange Mirror / Contrast Callout */}
          <div class="rounded-xl bg-[#FFE5C7] border border-white/50 px-3.5 py-2.5 flex items-center gap-2.5 text-[#0F1838]">
            <Search class="h-4 w-4 text-[#E88F3D] shrink-0" />
            <p class="text-xs font-medium leading-snug">
              {stats()?.mirrorInsight ||
                'Compara as tuas escolhas com os MighTs que aceitares.'}
            </p>
          </div>
        </section>

        {/* CARD 2: MATRIZ DE JOHARI (3 Official Brand Kit Groups) */}
        <section class="rounded-2xl bg-[#0F2A4A]/28 backdrop-blur-xl border border-white/25 shadow-[0_12px_32px_rgba(10,24,56,0.16)] p-4 space-y-4">
          {/* Group 1: Confirmados (Green #3D9061 / #DBF2E5) */}
          <div class="space-y-2">
            <span class="inline-block px-3 py-1 rounded-lg bg-[#3D9061] text-white text-xs font-bold shadow-sm">
              Confirmados
            </span>
            <p class="text-xs text-white/90">
              O que dizes sobre ti que os outros também vêem
            </p>
            <div class="flex flex-wrap gap-2 pt-0.5">
              <Show
                when={(stats()?.confirmed.length ?? 0) > 0}
                fallback={
                  <span class="text-xs italic text-white/65">
                    Ainda nenhuma palavra confirmada em simultâneo.
                  </span>
                }
              >
                <For each={stats()?.confirmed ?? []}>
                  {(item) => (
                    <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#DBF2E5] text-[#1C1E28] text-xs font-semibold shadow-sm">
                      <span>{item.labelPt}</span>
                      <strong class="text-[#3D9061] font-extrabold">{item.pct}%</strong>
                    </span>
                  )}
                </For>
              </Show>
            </div>
          </div>

          <div class="border-t border-white/20" />

          {/* Group 2: Superpoderes secretos (Blue #0A5AA9 / #A7CDF3) */}
          <div class="space-y-2">
            <span class="inline-block px-3 py-1 rounded-lg bg-[#0A5AA9] text-white text-xs font-bold shadow-sm">
              Superpoderes secretos
            </span>
            <p class="text-xs text-white/90">
              O que os outros vêem em ti que não escolheste
            </p>
            <div class="flex flex-wrap gap-2 pt-0.5">
              <Show
                when={(stats()?.superpowers.length ?? 0) > 0}
                fallback={
                  <span class="text-xs italic text-white/65">
                    Recebe e aceita MighTs para descobrir os teus superpoderes secretos.
                  </span>
                }
              >
                <For each={stats()?.superpowers ?? []}>
                  {(item) => (
                    <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#A7CDF3] text-[#1C1E28] text-xs font-semibold shadow-sm">
                      <span>{item.labelPt}</span>
                      <strong class="text-[#0A5AA9] font-extrabold">{item.pct}%</strong>
                    </span>
                  )}
                </For>
              </Show>
            </div>
          </div>

          <div class="border-t border-white/20" />

          {/* Group 3: Talentos ocultos (Orange #E88F3D / #FFE5C7) */}
          <div class="space-y-2">
            <span class="inline-block px-3 py-1 rounded-lg bg-[#E88F3D] text-white text-xs font-bold shadow-sm">
              Talentos ocultos
            </span>
            <p class="text-xs text-white/90">
              O que dizes sobre ti que os outros ainda não viram
            </p>
            <div class="flex flex-wrap gap-2 pt-0.5">
              <Show
                when={(stats()?.hidden.length ?? 0) > 0}
                fallback={
                  <span class="text-xs italic text-white/65">
                    Todas as tuas escolhas já foram reconhecidas pelos outros!
                  </span>
                }
              >
                <For each={stats()?.hidden ?? []}>
                  {(item) => (
                    <span class="inline-flex items-center px-3 py-1.5 rounded-xl bg-[#FFE5C7] text-[#1C1E28] text-xs font-semibold shadow-sm">
                      {item.labelPt}
                    </span>
                  )}
                </For>
              </Show>
            </div>
          </div>
        </section>

        {/* CARD 3: DISTRIBUIÇÃO POR DIMENSÃO */}
        <section class="rounded-2xl bg-[#0F2A4A]/28 backdrop-blur-xl border border-white/25 p-4 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xs font-extrabold tracking-[0.12em] uppercase text-white">
              Distribuição por Dimensão
            </h2>
            <span class="text-[10px] font-semibold text-white/75">
              Peso = contagem ÷ total
            </span>
          </div>

          <div class="space-y-3.5">
            <For each={DIMENSIONS}>
              {(dim) => {
                const meta = DIMENSION_META[dim];
                const items = () => (stats()?.byDimension[dim] ?? []).slice(0, 4);
                return (
                  <div class="space-y-2">
                    <div class="flex items-center gap-2">
                      <span
                        class="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ background: meta.accentHex }}
                      />
                      <span class="text-xs font-extrabold text-white">
                        {meta.labelPt} · {meta.partLabelPt}
                      </span>
                    </div>

                    <Show
                      when={items().length > 0}
                      fallback={
                        <div class="text-[11px] text-white/60 pl-4">
                          Sem registos nesta dimensão ainda.
                        </div>
                      }
                    >
                      <div class="space-y-1.5 pl-4">
                        <For each={items()}>
                          {(tw) => (
                            <div class="space-y-0.5">
                              <div class="flex items-center justify-between text-[11px]">
                                <span class="font-semibold text-white/95">
                                  {tw.labelPt}
                                </span>
                                <span class="font-bold text-white/85">
                                  {tw.count} ({tw.pct}%)
                                </span>
                              </div>
                              <div class="h-2 rounded-full bg-white/15 overflow-hidden">
                                <div
                                  class="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.max(8, tw.pct)}%`,
                                    background: meta.accentHex,
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </section>

        {/* Zero Dead-End Next Steps */}
        <div class="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => navigate('/descobrir')}
            class="glass-card rounded-2xl p-3.5 text-left hover:bg-white/25 transition-colors cursor-pointer"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-extrabold text-white">Descobrir</span>
              <Compass class="h-4 w-4 text-[#1FB5D3]" />
            </div>
            <p class="text-[11px] text-white/80 mt-1 flex items-center gap-1">
              <span>Perfis semelhantes</span>
              <ArrowRight class="h-3 w-3" />
            </p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/funcoes')}
            class="glass-card rounded-2xl p-3.5 text-left hover:bg-white/25 transition-colors cursor-pointer"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-extrabold text-white">Funções ideais</span>
              <Sparkles class="h-4 w-4 text-[#C6EE00]" />
            </div>
            <p class="text-[11px] text-white/80 mt-1 flex items-center gap-1">
              <span>Agora → Próximo</span>
              <ArrowRight class="h-3 w-3" />
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
