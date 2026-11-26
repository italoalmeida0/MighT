import { Show, createSignal } from 'solid-js';
import { MightFigure } from '../components/MightFigure';
import { useMight } from '../lib/store';

export function OnboardingScreen() {
  const might = useMight();
  const [slide, setSlide] = createSignal<0 | 1>(0);
  const [firstName, setFirstName] = createSignal(
    might.bootstrap()?.profile.firstName &&
      might.bootstrap()?.profile.firstName !== 'Visitante'
      ? might.bootstrap()!.profile.firstName
      : ''
  );
  const [busy, setBusy] = createSignal(false);

  const hasExisting = () => Boolean(might.bootstrap()?.profile.selfTags);

  const handleStart = async () => {
    const trimmed = firstName().trim();
    if (trimmed) {
      setBusy(true);
      try {
        await might.updateMe({ firstName: trimmed });
      } catch {
        // non-blocking, name can also be saved on creator submit
      } finally {
        setBusy(false);
      }
    }
    might.navigate('/criar');
  };

  const handleLoadDemo = async () => {
    setBusy(true);
    try {
      await might.demoLoadPreset('tiago');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="min-h-full flex flex-col justify-between px-6 pt-3 pb-6 text-white">
      {/* Brand Header */}
      <div class="flex flex-col items-center text-center space-y-2">
        <img
          src="/assets/brand/logo-white-sub.svg"
          alt="MighT · Visualize Talent"
          class="h-14 w-auto drop-shadow"
        />
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0F1838]/55 text-white border border-white/25 text-[11px] font-semibold tracking-wider uppercase shadow-sm">
          Menos de 2 minutos · Sem registo
        </span>
      </div>

      {/* Swipeable / Toggleable 2-Slide Intro (Parity with ABOUT MighT + ABOUT MighT-2) */}
      <div class="my-4 flex-1 flex flex-col items-center justify-center">
        {/* Slide Switcher Dots */}
        <div class="inline-flex items-center gap-1.5 bg-black/15 border border-white/20 rounded-full p-1 mb-4">
          <button
            type="button"
            onClick={() => setSlide(0)}
            class={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
              slide() === 0 ? 'bg-white text-[#1C1E28]' : 'text-white/80 hover:text-white'
            }`}
          >
            1. O teu retrato
          </button>
          <button
            type="button"
            onClick={() => setSlide(1)}
            class={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
              slide() === 1 ? 'bg-white text-[#1C1E28]' : 'text-white/80 hover:text-white'
            }`}
          >
            2. Self vs All MighT
          </button>
        </div>

        <Show
          when={slide() === 0}
          fallback={
            <div class="w-full space-y-4 text-center animate-[fadeIn_240ms_ease-out]">
              <h1 class="text-xl font-bold leading-tight text-[#1C1E28] sm:text-[#1C1E28]">
                Há duas versões do teu MighT
              </h1>

              <div class="grid grid-cols-2 gap-3">
                <div class="rounded-3xl bg-white/18 backdrop-blur-md border border-white/25 p-3.5 flex flex-col items-center text-center">
                  <MightFigure
                    mode="blue-hero"
                    class="w-24 mb-2"
                    animateFloat
                    alt="Self MighT"
                  />
                  <span class="text-xs font-bold text-white">Self MighT</span>
                  <span class="text-[11px] text-white/85 leading-snug mt-1">
                    Tu escolhes 3 palavras: Personalidade, Poder e Carácter.
                  </span>
                </div>

                <div class="rounded-3xl bg-[#753065]/35 backdrop-blur-md border border-white/25 p-3.5 flex flex-col items-center text-center">
                  <MightFigure
                    mode="purple-hero"
                    class="w-24 mb-2"
                    animateFloat
                    alt="All MighT"
                  />
                  <span class="text-xs font-bold text-white">All MighT</span>
                  <span class="text-[11px] text-white/85 leading-snug mt-1">
                    A soma dos MighTs aceites — desbloqueia aos 3!
                  </span>
                </div>
              </div>
            </div>
          }
        >
          <div class="w-full flex flex-col items-center text-center space-y-3 animate-[fadeIn_240ms_ease-out]">
            <h1 class="text-[22px] font-bold leading-snug text-[#1C1E28] max-w-[300px]">
              O teu MighT é um retrato teu em três palavras
            </h1>

            {/* Modular 3D Trio Hero Showcase matching ABOUT MighT-1 */}
            <div class="relative flex items-end justify-center gap-2 py-2">
              <MightFigure
                mode="modular"
                headIndex={0}
                bodyIndex={0}
                armsIndex={0}
                class="w-20 opacity-90 -mr-3 translate-y-1"
                alt="MighT Modular Esquerda"
              />
              <MightFigure
                mode="modular"
                headIndex={2}
                bodyIndex={2}
                armsIndex={2}
                class="w-32 z-10"
                animateFloat
                alt="MighT Modular Centro"
              />
              <MightFigure
                mode="modular"
                headIndex={1}
                bodyIndex={1}
                armsIndex={1}
                class="w-20 opacity-90 -ml-3 translate-y-1"
                alt="MighT Modular Direita"
              />
            </div>

            <p class="text-sm text-white/95 max-w-[290px] leading-relaxed">
              Estas três palavras criam uma personagem única —{' '}
              <strong class="font-bold">o teu MighT</strong>.
            </p>
          </div>
        </Show>
      </div>

      {/* Zero-Login First-Name Input & Primary Glossy CTA */}
      <div class="space-y-3">
        <div class="rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 px-4 py-2.5">
          <label
            for="onboarding-firstname"
            class="block text-[11px] font-semibold uppercase tracking-wider text-white/80 mb-1"
          >
            Como te chamas? (só o primeiro nome)
          </label>
          <input
            id="onboarding-firstname"
            type="text"
            maxLength={24}
            value={firstName()}
            onInput={(e) => setFirstName(e.currentTarget.value)}
            placeholder="Ex.: Inês (opcional)"
            class="w-full bg-transparent text-white placeholder-white/55 text-base font-semibold outline-none"
          />
        </div>

        <button
          type="button"
          disabled={busy()}
          onClick={handleStart}
          class="w-full py-4 rounded-[20px] bg-white hover:bg-white/95 active:scale-[0.99] text-[#1C1E28] font-bold text-base shadow-[0_12px_30px_rgba(0,0,0,0.22)] transition cursor-pointer"
        >
          {busy() ? 'A preparar...' : 'Criar o meu MighT'}
        </button>

        <div class="flex items-center justify-center gap-4 pt-1 text-xs">
          <Show when={hasExisting()}>
            <button
              type="button"
              onClick={() => might.navigate('/home')}
              class="font-semibold text-white underline underline-offset-4 hover:text-[#C6EE00] cursor-pointer"
            >
              Continuar para o meu MighT
            </button>
          </Show>
          <button
            type="button"
            disabled={busy()}
            onClick={handleLoadDemo}
            class="font-medium text-white/80 hover:text-white underline underline-offset-4 cursor-pointer"
          >
            Ver demo preenchido
          </button>
        </div>
      </div>
    </div>
  );
}
