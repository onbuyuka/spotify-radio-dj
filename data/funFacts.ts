import type { Lang } from '../types';

// A small bundled set of fun facts so the "Fun facts" source works offline with
// zero network calls. Kept short and DJ-friendly. EN + TR variants.

export const FUN_FACTS: Record<Lang, string[]> = {
  en: [
    'Honey never spoils — archaeologists have found edible honey in ancient tombs.',
    'Octopuses have three hearts, and two of them stop beating when they swim.',
    'A day on Venus is longer than a year on Venus.',
    'Bananas are berries, but strawberries technically are not.',
    'The Eiffel Tower can grow more than fifteen centimetres taller in summer.',
    'Sharks existed before trees did.',
    'There are more possible games of chess than atoms in the observable universe.',
    'Wombats produce cube-shaped droppings.',
    'The shortest war in history lasted about thirty-eight minutes.',
    'A group of flamingos is called a flamboyance.',
    'Hot water can freeze faster than cold water under the right conditions.',
    'The dot over a lowercase i or j is called a tittle.',
  ],
  tr: [
    'Bal asla bozulmaz — arkeologlar antik mezarlarda hâlâ yenebilir bal buldu.',
    'Ahtapotların üç kalbi vardır ve yüzerken ikisi durur.',
    'Venüs’te bir gün, bir yıldan daha uzundur.',
    'Muz aslında bir meyvedir ama çilek teknik olarak değildir.',
    'Eyfel Kulesi yazın on beş santimden fazla uzayabilir.',
    'Köpekbalıkları ağaçlardan daha önce vardı.',
    'Satrançta olası oyun sayısı, evrendeki atom sayısından fazladır.',
    'Vombatların dışkısı küp şeklindedir.',
    'Tarihteki en kısa savaş yaklaşık otuz sekiz dakika sürdü.',
    'Bir flamingo grubuna İngilizcede “flamboyance” denir.',
    'Doğru koşullarda sıcak su, soğuk sudan daha hızlı donabilir.',
    'Küçük i veya j harfinin üzerindeki noktaya “tittle” denir.',
  ],
};
