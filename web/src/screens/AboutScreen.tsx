import { For, Show, createMemo, createSignal } from 'solid-js';
import {
  Briefcase,
  ChevronLeft,
  Eye,
  EyeOff,
  GraduationCap,
  Heart,
  Mail,
  Menu,
  Pencil,
  Plus,
  Sparkles,
  Star,
  User,
  X,
} from 'lucide-solid';
import type { AboutSectionData } from '../../../shared/types';
import { useMight } from '../lib/store';

type ListSectionKey = 'academic' | 'experience' | 'likes' | 'expertise' | 'wish';
type SectionFocus = ListSectionKey | 'bio' | 'contacts';

const EMPTY_ABOUT: AboutSectionData = {
  academic: [],
  bio: '',
  experience: [],
  likes: [],
  expertise: [],
  wish: [],
  contactEmail: '',
  contactVisible: true,
};

export function AboutScreen() {
  const { bootstrap, navigate, updateAbout, showToast, setDemoDrawerOpen } = useMight();

  const about = (): AboutSectionData => bootstrap()?.profile.about ?? EMPTY_ABOUT;

  const [editOpen, setEditOpen] = createSignal(false);
  const [draft, setDraft] = createSignal<AboutSectionData>(EMPTY_ABOUT);
  const [newInputs, setNewInputs] = createSignal<Record<ListSectionKey, string>>({
    academic: '',
    experience: '',
    likes: '',
    expertise: '',
    wish: '',
  });
  const [addingField, setAddingField] = createSignal<ListSectionKey | null>(null);
  const [saving, setSaving] = createSignal(false);

  const completedCount = createMemo(() => {
    const a = about();
    let count = 0;
    if (a.academic.length > 0) count++;
    if (a.bio.trim().length > 0) count++;
    if (a.experience.length > 0) count++;
    if (a.likes.length > 0) count++;
    if (a.expertise.length > 0) count++;
    if (a.wish.length > 0) count++;
    if (a.contactEmail.trim().length > 0) count++;
    return count;
  });

  const progressPct = createMemo(() => Math.round((completedCount() / 7) * 100));

  const openEditor = (focus?: SectionFocus) => {
    const current = about();
    setDraft({
      academic: [...current.academic],
      bio: current.bio,
      experience: [...current.experience],
      likes: [...current.likes],
      expertise: [...current.expertise],
      wish: [...current.wish],
      contactEmail: current.contactEmail,
      contactVisible: current.contactVisible,
    });
    setNewInputs({
      academic: '',
      experience: '',
      likes: '',
      expertise: '',
      wish: '',
    });
    if (
      focus === 'academic' ||
      focus === 'experience' ||
      focus === 'likes' ||
      focus === 'expertise' ||
      focus === 'wish'
    ) {
      setAddingField(focus);
    } else {
      setAddingField(null);
    }
    setEditOpen(true);
  };

  const removeItem = (field: ListSectionKey, index: number) => {
    setDraft((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const addItem = (field: ListSectionKey) => {
    const val = newInputs()[field].trim();
    if (!val) return;
    setDraft((prev) => ({
      ...prev,
      [field]: [...prev[field], val],
    }));
    setNewInputs((prev) => ({ ...prev, [field]: '' }));
    setAddingField(null);
  };

  const handleSave = async (e: Event) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Flush any typed but not-yet-confirmed chip input
      const finalDraft: AboutSectionData = { ...draft() };
      const listKeys: ListSectionKey[] = [
        'academic',
        'experience',
        'likes',
        'expertise',
        'wish',
      ];
      for (const k of listKeys) {
        const pending = newInputs()[k].trim();
        if (pending) {
          finalDraft[k] = [...finalDraft[k], pending];
        }
      }
      await updateAbout(finalDraft);
      showToast('Perfil «Sobre mim» guardado!', 'success');
      setEditOpen(false);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Erro ao guardar alterações.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const renderChipEditor = (
    field: ListSectionKey,
    title: string,
    placeholder: string,
    icon: () => ReturnType<typeof GraduationCap>
  ) => (
    <div class="space-y-2">
      <div class="flex items-center gap-2 text-[#753065]">
        {icon()}
        <span class="text-xs font-extrabold tracking-[0.08em] uppercase">{title}</span>
      </div>

      <div class="flex flex-wrap gap-2">
        <For each={draft()[field]}>
          {(item, idx) => (
            <div class="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/45 border border-white/75 text-xs font-medium text-[#1C1E28] shadow-2xs">
              <span>{item}</span>
              <button
                type="button"
                onClick={() => removeItem(field, idx())}
                class="text-[#1C1E28]/60 hover:text-[#753065] cursor-pointer"
                aria-label={`Remover ${item}`}
              >
                <X class="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </For>

        <Show
          when={addingField() === field}
          fallback={
            <button
              type="button"
              onClick={() => setAddingField(field)}
              class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-[#753065]/65 text-xs font-bold text-[#753065] hover:bg-white/30 cursor-pointer"
            >
              <Plus class="h-3.5 w-3.5" />
              <span>Adicionar</span>
            </button>
          }
        >
          <div class="w-full flex items-center gap-2">
            <input
              type="text"
              value={newInputs()[field]}
              onInput={(e) =>
                setNewInputs((prev) => ({ ...prev, [field]: e.currentTarget.value }))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addItem(field);
                }
              }}
              placeholder={placeholder}
              class="flex-1 px-3 py-2 rounded-xl bg-white/90 border border-[#753065]/60 text-xs text-[#1C1E28] focus:outline-none"
              autofocus
            />
            <button
              type="button"
              onClick={() => addItem(field)}
              class="px-3 py-2 rounded-xl bg-[#753065] text-white text-xs font-bold cursor-pointer"
            >
              OK
            </button>
          </div>
        </Show>
      </div>
    </div>
  );

  return (
    <div class="bg-might-light min-h-full flex flex-col text-[#1C1E28]">
      {/* Header matching 02 About.jpg */}
      <header class="px-4 pt-5 pb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/home')}
          class="h-10 w-10 rounded-full hover:bg-white/35 flex items-center justify-center text-[#1C1E28] cursor-pointer"
          aria-label="Voltar"
        >
          <ChevronLeft class="h-6 w-6" />
        </button>

        <h1 class="text-base font-extrabold tracking-[0.1em] uppercase text-[#1C1E28]">
          SOBRE MIM
        </h1>

        <button
          type="button"
          onClick={() => setDemoDrawerOpen(true)}
          class="h-10 w-10 rounded-full hover:bg-white/35 flex items-center justify-center text-white cursor-pointer"
          aria-label="Abrir menu"
        >
          <Menu class="h-6 w-6 text-[#1C1E28]/80" />
        </button>
      </header>

      {/* Progress Bar: X de 7 completos */}
      <div class="px-4 pb-4 space-y-2">
        <div class="flex items-center justify-between text-xs font-medium text-[#1C1E28]/75">
          <span>{completedCount()} de 7 completos</span>
          <span class="font-bold text-[#144B86]">{progressPct()}%</span>
        </div>
        <div class="h-1.5 w-full rounded-full bg-white/40 overflow-hidden">
          <div
            class="h-full rounded-full bg-[#358EC0] transition-all duration-500"
            style={{ width: `${Math.max(6, progressPct())}%` }}
          />
        </div>
      </div>

      {/* 7 Glass Cards matching 02 About.jpg */}
      <div class="flex-1 overflow-y-auto px-4 pb-8 space-y-3">
        {/* 1. ACADÉMICO */}
        <div class="glass-card-light rounded-2xl p-4 flex items-center justify-between gap-3">
          <div class="min-w-0 space-y-1">
            <div class="flex items-center gap-2 text-[#753065]">
              <GraduationCap class="h-4 w-4 shrink-0" />
              <span class="text-xs font-extrabold tracking-[0.08em] uppercase">
                Académico
              </span>
            </div>
            <Show
              when={about().academic.length > 0}
              fallback={<p class="text-xs italic text-[#1C1E28]/55">Sem formação adicionada</p>}
            >
              <div class="text-xs font-medium text-[#1C1E28]/90 space-y-0.5">
                <For each={about().academic}>{(item) => <p>{item}</p>}</For>
              </div>
            </Show>
          </div>
          <button
            type="button"
            onClick={() => openEditor('academic')}
            class="h-9 w-9 rounded-full bg-[#753065] hover:bg-[#8B3A78] text-white flex items-center justify-center shrink-0 shadow cursor-pointer"
            aria-label="Editar Académico"
          >
            <Pencil class="h-4 w-4" />
          </button>
        </div>

        {/* 2. BIO */}
        <div class="glass-card-light rounded-2xl p-4 flex items-center justify-between gap-3">
          <div class="min-w-0 space-y-1">
            <div class="flex items-center gap-2 text-[#753065]">
              <User class="h-4 w-4 shrink-0" />
              <span class="text-xs font-extrabold tracking-[0.08em] uppercase">Bio</span>
            </div>
            <p class="text-xs font-medium text-[#1C1E28]/90 leading-relaxed">
              {about().bio || 'Conta em poucas linhas quem és fora dos títulos.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openEditor('bio')}
            class="h-9 w-9 rounded-full bg-[#753065] hover:bg-[#8B3A78] text-white flex items-center justify-center shrink-0 shadow cursor-pointer"
            aria-label="Editar Bio"
          >
            <Pencil class="h-4 w-4" />
          </button>
        </div>

        {/* 3. EXPERIÊNCIA */}
        <div class="glass-card-light rounded-2xl p-4 flex items-center justify-between gap-3">
          <div class="min-w-0 space-y-1">
            <div class="flex items-center gap-2 text-[#753065]">
              <Briefcase class="h-4 w-4 shrink-0" />
              <span class="text-xs font-extrabold tracking-[0.08em] uppercase">
                Experiência
              </span>
            </div>
            <Show
              when={about().experience.length > 0}
              fallback={<p class="text-xs italic text-[#1C1E28]/55">Sem experiências adicionadas</p>}
            >
              <div class="text-xs font-medium text-[#1C1E28]/90 space-y-0.5">
                <For each={about().experience}>{(item) => <p>{item}</p>}</For>
              </div>
            </Show>
          </div>
          <button
            type="button"
            onClick={() => openEditor('experience')}
            class="h-9 w-9 rounded-full bg-[#753065] hover:bg-[#8B3A78] text-white flex items-center justify-center shrink-0 shadow cursor-pointer"
            aria-label="Editar Experiência"
          >
            <Pencil class="h-4 w-4" />
          </button>
        </div>

        {/* 4. GOSTOS */}
        <div class="glass-card-light rounded-2xl p-4 flex items-center justify-between gap-3">
          <div class="min-w-0 space-y-1">
            <div class="flex items-center gap-2 text-[#753065]">
              <Heart class="h-4 w-4 shrink-0" />
              <span class="text-xs font-extrabold tracking-[0.08em] uppercase">Gostos</span>
            </div>
            <p class="text-xs font-medium text-[#1C1E28]/90">
              {about().likes.length > 0
                ? about().likes.join(', ')
                : 'O que te dá energia no dia-a-dia'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openEditor('likes')}
            class="h-9 w-9 rounded-full bg-[#753065] hover:bg-[#8B3A78] text-white flex items-center justify-center shrink-0 shadow cursor-pointer"
            aria-label="Editar Gostos"
          >
            <Pencil class="h-4 w-4" />
          </button>
        </div>

        {/* 5. ESPECIALIDADE */}
        <div class="glass-card-light rounded-2xl p-4 flex items-center justify-between gap-3">
          <div class="min-w-0 space-y-1">
            <div class="flex items-center gap-2 text-[#753065]">
              <Star class="h-4 w-4 shrink-0" />
              <span class="text-xs font-extrabold tracking-[0.08em] uppercase">
                Especialidade
              </span>
            </div>
            <p class="text-xs font-medium text-[#1C1E28]/90">
              {about().expertise.length > 0
                ? about().expertise.join(', ')
                : 'Áreas onde entregas mais impacto'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openEditor('expertise')}
            class="h-9 w-9 rounded-full bg-[#753065] hover:bg-[#8B3A78] text-white flex items-center justify-center shrink-0 shadow cursor-pointer"
            aria-label="Editar Especialidade"
          >
            <Pencil class="h-4 w-4" />
          </button>
        </div>

        {/* 6. DESEJO */}
        <div class="glass-card-light rounded-2xl p-4 flex items-center justify-between gap-3">
          <div class="min-w-0 space-y-1">
            <div class="flex items-center gap-2 text-[#753065]">
              <Sparkles class="h-4 w-4 shrink-0" />
              <span class="text-xs font-extrabold tracking-[0.08em] uppercase">Desejo</span>
            </div>
            <p class="text-xs font-medium text-[#1C1E28]/90">
              {about().wish.length > 0
                ? about().wish.join(' · ')
                : 'Qual é o próximo desafio que queres conquistar?'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openEditor('wish')}
            class="h-9 w-9 rounded-full bg-[#753065] hover:bg-[#8B3A78] text-white flex items-center justify-center shrink-0 shadow cursor-pointer"
            aria-label="Editar Desejo"
          >
            <Pencil class="h-4 w-4" />
          </button>
        </div>

        {/* 7. CONTACTOS */}
        <div class="glass-card-light rounded-2xl p-4 flex items-center justify-between gap-3">
          <div class="min-w-0 space-y-1">
            <div class="flex items-center gap-2 text-[#753065]">
              <Mail class="h-4 w-4 shrink-0" />
              <span class="text-xs font-extrabold tracking-[0.08em] uppercase">
                Contactos
              </span>
            </div>
            <p class="text-xs font-medium text-[#1C1E28]/90 truncate">
              {about().contactEmail || 'Sem email configurado'}
            </p>
            <div class="flex items-center gap-1.5 text-[11px] text-[#1C1E28]/65">
              <Show
                when={about().contactVisible}
                fallback={<EyeOff class="h-3.5 w-3.5" />}
              >
                <Eye class="h-3.5 w-3.5" />
              </Show>
              <span>
                {about().contactVisible
                  ? 'Visível para contactos'
                  : 'Não mostrar a ninguém'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openEditor('contacts')}
            class="h-9 w-9 rounded-full bg-[#753065] hover:bg-[#8B3A78] text-white flex items-center justify-center shrink-0 shadow cursor-pointer"
            aria-label="Editar Contactos"
          >
            <Pencil class="h-4 w-4" />
          </button>
        </div>

        {/* Zero Dead-End Next Step */}
        <div class="pt-1">
          <button
            type="button"
            onClick={() => navigate('/card')}
            class="w-full py-3.5 px-5 rounded-2xl bg-[#753065] hover:bg-[#8B3A78] text-white font-extrabold text-sm shadow-lg cursor-pointer"
          >
            Ver o meu MighT Card
          </button>
        </div>
      </div>

      {/* ==================== EDIT ABOUT SHEET (04 About — Edit.jpg parity) ==================== */}
      <Show when={editOpen()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-[#0B101D]/60 backdrop-blur-xs p-0 sm:p-4">
          <div class="w-full max-w-[406px] h-full sm:h-auto sm:max-h-[860px] bg-might-light sm:rounded-[36px] flex flex-col overflow-hidden shadow-2xl border border-white/40">
            {/* Modal Header */}
            <div class="px-4 pt-5 pb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                class="h-10 w-10 rounded-full hover:bg-white/35 flex items-center justify-center text-[#1C1E28] cursor-pointer"
                aria-label="Fechar edição"
              >
                <X class="h-5 w-5" />
              </button>
              <h2 class="text-base font-extrabold text-[#1C1E28]">Editar sobre mim</h2>
              <div class="w-10" />
            </div>

            <form onSubmit={handleSave} class="flex-1 overflow-y-auto px-4 pb-6 space-y-5">
              {/* Academic */}
              {renderChipEditor(
                'academic',
                'Académico',
                'Ex.: Mestrado em Engenharia (IST)',
                () => <GraduationCap class="h-4 w-4" />
              )}

              {/* Bio with 0/160 counter */}
              <div class="space-y-2">
                <div class="flex items-center gap-2 text-[#753065]">
                  <User class="h-4 w-4" />
                  <span class="text-xs font-extrabold tracking-[0.08em] uppercase">
                    Bio
                  </span>
                </div>
                <div class="rounded-2xl bg-white border-2 border-[#753065] p-3 space-y-1 shadow-xs">
                  <textarea
                    rows={3}
                    maxLength={160}
                    value={draft().bio}
                    onInput={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        bio: e.currentTarget.value.slice(0, 160),
                      }))
                    }
                    placeholder="Escreve uma bio breve sobre ti…"
                    class="w-full text-xs font-medium text-[#1C1E28] placeholder-[#1C1E28]/40 bg-transparent focus:outline-none resize-none leading-relaxed"
                  />
                  <div class="text-right text-[11px] font-bold text-[#1C1E28]/70">
                    {draft().bio.length} / 160
                  </div>
                </div>
              </div>

              {/* Experience */}
              {renderChipEditor(
                'experience',
                'Experiência',
                'Ex.: Product Lead na Talkdesk',
                () => <Briefcase class="h-4 w-4" />
              )}

              {/* Likes */}
              {renderChipEditor(
                'likes',
                'Gostos',
                'Ex.: Corrida, fotografia, café',
                () => <Heart class="h-4 w-4" />
              )}

              {/* Expertise */}
              {renderChipEditor(
                'expertise',
                'Especialidade',
                'Ex.: Estratégia de Produto',
                () => <Star class="h-4 w-4" />
              )}

              {/* Wish */}
              {renderChipEditor(
                'wish',
                'Desejo',
                'Ex.: Liderar uma equipa de produto com impacto',
                () => <Sparkles class="h-4 w-4" />
              )}

              {/* Contacts + Visibility Toggle */}
              <div class="space-y-2.5">
                <div class="flex items-center gap-2 text-[#753065]">
                  <Mail class="h-4 w-4" />
                  <span class="text-xs font-extrabold tracking-[0.08em] uppercase">
                    Contactos
                  </span>
                </div>

                <div class="rounded-2xl bg-white/45 border border-white/75 px-3.5 py-2.5 flex items-center gap-2.5">
                  <Mail class="h-4 w-4 text-[#1C1E28]/60 shrink-0" />
                  <input
                    type="email"
                    value={draft().contactEmail}
                    onInput={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        contactEmail: e.currentTarget.value,
                      }))
                    }
                    placeholder="nome@empresa.pt"
                    class="w-full bg-transparent text-xs font-medium text-[#1C1E28] focus:outline-none"
                  />
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, contactVisible: true }))
                    }
                    class={`py-2.5 px-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                      draft().contactVisible
                        ? 'bg-white text-[#1C1E28] border-2 border-[#753065] shadow-xs'
                        : 'bg-white/35 text-[#1C1E28]/75 border border-white/60'
                    }`}
                  >
                    Visível para contactos
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, contactVisible: false }))
                    }
                    class={`py-2.5 px-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                      !draft().contactVisible
                        ? 'bg-white text-[#1C1E28] border-2 border-[#753065] shadow-xs'
                        : 'bg-white/35 text-[#1C1E28]/75 border border-white/60'
                    }`}
                  >
                    Não mostrar a ninguém
                  </button>
                </div>
              </div>

              {/* Save CTA */}
              <div class="pt-2">
                <button
                  type="submit"
                  disabled={saving()}
                  class="w-full py-3.5 px-5 rounded-2xl bg-[#753065] hover:bg-[#8B3A78] text-white font-extrabold text-sm shadow-lg cursor-pointer transition-transform active:scale-[0.98]"
                >
                  {saving() ? 'A guardar…' : 'Guardar alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
