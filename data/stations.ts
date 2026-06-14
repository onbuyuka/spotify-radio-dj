import type { Station } from '../types';
import { DEFAULT_STATION_ID } from '../utils/storage';

// Seed stations. Each bundles a language, a voice and a persona; switching
// station is how the "DJ voice" changes. Source ids reference the source
// plugins (song trivia is built live; the rest come from the snapshot feed).

export const STATIONS: Station[] = [
  {
    id: 'night-owl',
    name: 'Night Owl',
    tagline: 'Late-night English radio',
    lang: 'en',
    voice: { lang: 'en', rate: 1, pitch: 1 },
    persona: {
      intros: [
        "You're locked into Radio DJ — let's keep the night rolling.",
        'Welcome back to the late shift. Here is something good.',
        'Radio DJ, coming through your speakers. Settle in.',
      ],
      outros: ['Back to the music.', "Let's get back to it.", 'Here we go.'],
      transitions: [
        "Now, here's what's going on.",
        'Quick word before the next one.',
        'A little something between tracks.',
      ],
    },
    sources: ['song', 'news-world', 'fact'],
    cadence: 3,
  },
  {
    id: 'radyo-gece',
    name: 'Radyo Gece',
    tagline: 'Gece yarısı Türkçe radyo',
    lang: 'tr',
    voice: { lang: 'tr', rate: 1, pitch: 1 },
    persona: {
      intros: [
        'Radyo DJ’dasınız ve gecenin bu geç saatinde yine birlikteyiz; önümüzdeki saatlerde sizin için özenle seçilmiş parçaları, aralarda küçük sohbetleri ve şarkılara dair ufak hikâyeleri kaçırmadan, kahvenizi alıp arkanıza yaslanmanızı ve bu yolculuğun tadını sonuna kadar çıkarmanızı diliyoruz.',
        'Tekrar hoş geldiniz. Sırada güzel bir parça var.',
        'Radyo DJ yayında. Keyfini çıkarın.',
      ],
      outros: ['Müziğe geri dönüyoruz.', 'Kaldığımız yerden devam.', 'Buyrun.'],
      transitions: [
        'Şimdi neler oluyor, bir bakalım.',
        'Bir sonraki parçadan önce birkaç kelime.',
        'Parçalar arasında ufak bir mola.',
      ],
    },
    sources: ['song', 'news-tr', 'fact'],
    cadence: 3,
  },
];

export function getStation(id: string): Station {
  return STATIONS.find((s) => s.id === id) ?? STATIONS[0];
}

export function defaultStation(): Station {
  return getStation(DEFAULT_STATION_ID);
}
