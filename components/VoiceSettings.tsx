import React, { useEffect, useRef, useState } from 'react';
import type { Lang } from '../types';
import { LANGS } from '../types';
import { WebSpeechTts } from '../utils/tts';
import { getVoiceForLang, setVoiceForLang } from '../utils/storage';

const LANG_LABEL: Record<Lang, string> = { en: 'English', tr: 'Türkçe' };
const SAMPLE: Record<Lang, string> = {
  en: "You're locked into Radio DJ. Here's something good.",
  tr: 'Radyo DJ’dasınız. Sırada güzel bir parça var.',
};

export const VoiceSettings: React.FC = () => {
  const ttsRef = useRef<WebSpeechTts | null>(null);
  const [byLang, setByLang] = useState<Record<Lang, SpeechSynthesisVoice[]>>({ en: [], tr: [] });
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const tts = new WebSpeechTts();
    ttsRef.current = tts;
    if (!tts.isSupported()) {
      setSupported(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    tts.whenReady().then(() => {
      if (cancelled) return;
      setByLang({ en: tts.voicesFor('en'), tr: tts.voicesFor('tr') });
      setChosen({ en: getVoiceForLang('en') ?? '', tr: getVoiceForLang('tr') ?? '' });
      setLoading(false);
    });
    return () => {
      cancelled = true;
      tts.cancel();
    };
  }, []);

  const choose = (lang: Lang, voiceName: string) => {
    setChosen((c) => ({ ...c, [lang]: voiceName }));
    if (voiceName) setVoiceForLang(lang, voiceName);
  };

  const test = (lang: Lang) => {
    ttsRef.current?.speak(SAMPLE[lang], {
      lang,
      rate: 1,
      pitch: 1,
      voiceName: chosen[lang] || undefined,
    });
  };

  return (
    <section className="panel p-5 mt-5">
      <h2 className="font-pixel text-[11px] text-silver-300 flex items-center gap-2">
        <span className="led led-amber" /> DJ VOICES
      </h2>
      <p className="mt-3 font-lcd text-lg text-silver-300 leading-snug">
        The DJ uses your browser's built-in voices (free, on-device). Pick the best one
        per language and tap Test.
      </p>

      {!supported ? (
        <p className="mt-4 font-lcd text-lg text-onair-400">
          This browser has no speech synthesis. Try Chrome or Edge.
        </p>
      ) : loading ? (
        <p className="mt-4 font-lcd text-lg text-amber-400">▚ Loading voices…</p>
      ) : (
        <div className="mt-4 space-y-4">
          {LANGS.map((lang) => {
            const voices = byLang[lang];
            const none = voices.length === 0;
            return (
              <div key={lang}>
                <label className="block font-pixel text-[9px] text-silver-400">
                  {LANG_LABEL[lang].toUpperCase()}
                </label>
                {none ? (
                  <p className="mt-2 font-lcd text-base text-onair-400 leading-snug">
                    ⚠ No {LANG_LABEL[lang]} voice in this browser. Headlines in this language
                    won't sound right.
                    {lang === 'tr' && ' Microsoft Edge ships a Turkish voice (Tolga) — try it there, or install one via Windows → Speech.'}
                  </p>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <div className="bezel flex-1">
                      <select
                        value={chosen[lang] || ''}
                        onChange={(e) => choose(lang, e.target.value)}
                        className="w-full lcd px-3 py-2 font-lcd text-lg text-amber-400 bg-transparent focus:outline-none"
                      >
                        <option value="">Default ({voices[0].name})</option>
                        {voices.map((v) => (
                          <option key={v.name} value={v.name}>
                            {v.name} {v.localService ? '' : '(online)'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button onClick={() => test(lang)} className="btn3d">
                      ▶ Test
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
