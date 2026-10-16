// Domyślne treści nowego turnieju – do edycji w panelu administracyjnym.

export const DEFAULT_TOURNAMENT = {
  name: "Turniej One Hero – Heroes III",
  slug: "one-hero",
  tagline: "Jeden bohater. Jedna szansa. Dołącz do turnieju 1v1 w Heroes of Might and Magic III: Horn of the Abyss.",
  infoMd: `## O turnieju

Turniej 1v1 w formacie **One Hero** – każdy gracz prowadzi rozgrywkę jednym bohaterem.

- Wersja gry: **Horn of the Abyss** (aktualna wersja w lobby).
- Rozgrywki online w lobby HotA.
- Mecze umawiacie samodzielnie – serwis podpowie wspólne terminy na podstawie Waszej dostępności.`,
  formatMd: `## Format

1. **Faza grupowa** – grupy 4–6 osobowe, każdy z każdym, mecze **Bo3**. Z każdej grupy awansują **2 najlepsze osoby**.
2. **Faza pucharowa** – drabinka pojedynczej eliminacji, mecze **Bo3**, **finał Bo5**, mecz o **3. miejsce Bo3**.

O kolejności w grupie decydują kolejno: liczba wygranych meczów, bilans gier, wynik bezpośredniego meczu (mała tabela), a w ostateczności decyzja organizatora.`,
  prizesMd: `## Nagrody

- 🥇 1. miejsce – do uzupełnienia
- 🥈 2. miejsce – do uzupełnienia
- 🥉 3. miejsce – do uzupełnienia`,
  scheduleMd: `## Harmonogram

- Zapisy: do uzupełnienia
- Losowanie grup: do uzupełnienia
- Faza grupowa: do uzupełnienia
- Faza pucharowa: do uzupełnienia
- Finał (transmisja): do uzupełnienia`,
  rulesMd: `# Regulamin turnieju

## §1. Postanowienia ogólne
1. Organizatorem turnieju jest administracja serwisu.
2. Udział w turnieju jest dobrowolny i bezpłatny.
3. Zapis do turnieju oznacza akceptację niniejszego regulaminu.

## §2. Uczestnicy
1. Uczestnikiem może zostać każda osoba posiadająca konto Discord i będąca członkiem serwera Discord turnieju.
2. Każdy uczestnik może posiadać tylko jedno konto w turnieju.

## §3. Rozgrywki
1. Mecze rozgrywane są zgodnie z ustawieniami opisanymi w zakładce „Turniej”.
2. Wynik meczu zgłasza jeden z graczy przez formularz raportu; drugi gracz go potwierdza.
3. W razie sporu decyzję podejmuje moderator lub administrator.

## §4. Fair play
1. Zabronione jest wykorzystywanie błędów gry, oprogramowania zewnętrznego oraz zachowania niesportowe.
2. Naruszenie zasad może skutkować walkowerem lub dyskwalifikacją.

## §5. Postanowienia końcowe
1. Organizator zastrzega sobie prawo do zmian regulaminu – o zmianach uczestnicy zostaną poinformowani.`,
  privacyMd: `# Polityka prywatności

## Jakie dane przetwarzamy
- identyfikator, nazwę i awatar konta Discord (pobierane przy logowaniu),
- nick w grze, odnośniki do kanałów streamingowych, dostępność czasową oraz wyniki meczów.

## W jakim celu
Dane przetwarzamy wyłącznie w celu organizacji turnieju: prowadzenia zapisów, tabel, drabinki, kontaktu z graczami (powiadomienia Discord) i publikacji wyników.

## Co jest publiczne
Nick w grze, awatar Discord, wyniki meczów, statystyki i podane linki do streamów są widoczne publicznie na stronach turnieju.

## Okres przechowywania i Twoje prawa
Dane przechowujemy do zakończenia turnieju i archiwizacji wyników. Masz prawo do wglądu, poprawienia i usunięcia swoich danych – skontaktuj się z administracją na serwerze Discord.

## Pliki cookie
Serwis używa wyłącznie niezbędnego ciasteczka sesji logowania.`,
  gameSettings: {
    difficulty: "200% (Ekspert)",
    turnTimer: "Zgodnie z ustawieniami szablonu / lobby",
    handicap: "Brak",
    other: "Format One Hero – kupowanie dodatkowych bohaterów zabronione.",
  },
};

export const DEFAULT_TEMPLATES = [
  { name: "Jebus Cross", description: "Klasyczny szablon turniejowy" },
  { name: "Jebus Outcast", description: "Wariant szablonu Jebus dla jednego bohatera" },
  { name: "Mt. Rift", description: "" },
];
