import type { Lang } from '../types';

// Text-to-speech behind a small interface so the free Web Speech engine can be
// swapped for a paid cloud voice later without touching the Director.

export interface TtsVoiceConfig {
  /** Preferred SpeechSynthesisVoice.name; falls back to the first voice for `lang`. */
  voiceName?: string;
  lang: Lang;
  rate: number;
  pitch: number;
}

export interface TtsEngine {
  isSupported(): boolean;
  speak(text: string, cfg: TtsVoiceConfig): Promise<void>;
  cancel(): void;
  voicesFor(lang: Lang): SpeechSynthesisVoice[];
  whenReady(): Promise<void>;
}

const LANG_BCP47: Record<Lang, string> = { en: 'en-US', tr: 'tr-TR' };

/** Max characters per utterance — Chrome truncates very long utterances. */
const MAX_CHUNK = 180;
/** Chrome stops speaking after ~15s; nudging resume() keeps it going. */
const KEEPALIVE_MS = 10_000;

/** Free, on-device TTS via the browser's Web Speech API. */
export class WebSpeechTts implements TtsEngine {
  private readonly synth: SpeechSynthesis | null;
  private voices: SpeechSynthesisVoice[] = [];
  private keepAlive: number | null = null;

  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis ?? null : null;
    if (this.synth) {
      this.loadVoices();
      this.synth.addEventListener?.('voiceschanged', () => this.loadVoices());
    }
  }

  isSupported(): boolean {
    return this.synth != null;
  }

  private loadVoices(): void {
    if (this.synth) this.voices = this.synth.getVoices();
  }

  voicesFor(lang: Lang): SpeechSynthesisVoice[] {
    return this.voices.filter((v) => v.lang.toLowerCase().startsWith(lang));
  }

  whenReady(): Promise<void> {
    if (!this.synth) return Promise.resolve();
    this.loadVoices();
    if (this.voices.length) return Promise.resolve();
    // Chrome populates getVoices() asynchronously and may need polling (and a
    // getVoices() call) to kick it. Resolve on voiceschanged or after a cap.
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearInterval(poll);
        this.loadVoices();
        resolve();
      };
      this.synth?.addEventListener?.('voiceschanged', finish, { once: true });
      let tries = 0;
      const poll = window.setInterval(() => {
        this.loadVoices();
        if (this.voices.length || ++tries > 20) finish();
      }, 100);
    });
  }

  /** True if the browser has at least one voice for `lang`. */
  hasVoiceFor(lang: Lang): boolean {
    return this.voicesFor(lang).length > 0;
  }

  private pickVoice(cfg: TtsVoiceConfig): SpeechSynthesisVoice | undefined {
    if (cfg.voiceName) {
      const exact = this.voices.find((v) => v.name === cfg.voiceName);
      if (exact) return exact;
    }
    return this.voicesFor(cfg.lang)[0];
  }

  cancel(): void {
    this.stopKeepAlive();
    this.synth?.cancel();
  }

  async speak(text: string, cfg: TtsVoiceConfig): Promise<void> {
    if (!this.synth) return;
    // Wait for the voice list before choosing, so Chrome (which loads voices
    // asynchronously) doesn't fall back to its default English voice and read
    // Turkish text with an English accent.
    await this.whenReady();
    this.synth.cancel();
    const voice = this.pickVoice(cfg);
    const langTag = voice?.lang ?? LANG_BCP47[cfg.lang];
    this.startKeepAlive();
    try {
      for (const chunk of chunkText(text)) {
        await this.speakChunk(chunk, voice, langTag, cfg);
      }
    } finally {
      this.stopKeepAlive();
    }
  }

  private speakChunk(
    text: string,
    voice: SpeechSynthesisVoice | undefined,
    langTag: string,
    cfg: TtsVoiceConfig,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.lang = langTag;
      u.rate = cfg.rate;
      u.pitch = cfg.pitch;
      // Resolve on end OR error so a TTS hiccup never stalls the show.
      u.onend = () => resolve();
      u.onerror = () => resolve();
      this.synth!.speak(u);
    });
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();
    this.keepAlive = window.setInterval(() => {
      if (this.synth?.speaking) this.synth.resume();
    }, KEEPALIVE_MS);
  }

  private stopKeepAlive(): void {
    if (this.keepAlive != null) {
      window.clearInterval(this.keepAlive);
      this.keepAlive = null;
    }
  }
}

/** Split text into utterance-sized chunks on sentence boundaries. */
export function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?…]+[.!?…]*/g) ?? [clean];
  const out: string[] = [];
  let buf = '';
  for (const s of sentences) {
    if (buf && (buf + s).length > MAX_CHUNK) {
      out.push(buf.trim());
      buf = '';
    }
    buf += s;
    while (buf.length > MAX_CHUNK) {
      out.push(buf.slice(0, MAX_CHUNK).trim());
      buf = buf.slice(MAX_CHUNK);
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}
