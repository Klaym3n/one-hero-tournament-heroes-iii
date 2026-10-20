# Turniej One Hero – Heroes of Might and Magic III

Serwis do prowadzenia turnieju 1v1 w Heroes III (Horn of the Abyss): zapisy przez Discord, faza grupowa „każdy z każdym” (Bo3), drabinka pojedynczej eliminacji (Bo3, finał Bo5, mecz o 3. miejsce), raporty meczowe z potwierdzaniem i sporami, kalendarz dostępności z automatycznym szukaniem wspólnych terminów, powiadomienia Discord oraz panel administracyjny.

**Stack:** Next.js 16 (App Router, Cache Components) · PostgreSQL · Drizzle ORM · własne logowanie Discord OAuth2 · SSE (LISTEN/NOTIFY) do odświeżania na żywo · Tailwind CSS 4.

---

## Spis treści

1. [Funkcje](#funkcje)
2. [Konfiguracja Discorda](#konfiguracja-discorda)
3. [Uruchomienie lokalne](#uruchomienie-lokalne)
4. [Wdrożenie na Pterodactylu](#wdrożenie-na-pterodactylu)
5. [Wdrożenie przez docker compose](#wdrożenie-przez-docker-compose)
6. [Grafiki z gry](#grafiki-z-gry)
7. [Przebieg turnieju krok po kroku](#przebieg-turnieju-krok-po-kroku)
8. [Architektura](#architektura)
9. [Testy](#testy)

---

## Funkcje

| Obszar | Co robi |
|---|---|
| Konta | Logowanie wyłącznie przez Discord. Zapis do turnieju to osobny krok: nick + akceptacja regulaminu i polityki prywatności (z zapisem wersji dokumentów). |
| Discord | Przy zapisie sprawdza członkostwo na serwerze; jeśli gracza brak – dodaje go automatycznie (scope `guilds.join`) lub pokazuje zaproszenie. |
| Role | Gracz / Moderator / Administrator. Role nadaje administrator w panelu. Pierwszy admin z `ADMIN_DISCORD_IDS`. |
| Grupy | Admin wybiera wariant podziału (liczba grup = potęga 2, grupy 4–6 os.). Losowanie w pełni losowe (`crypto.randomInt`). Awans: 2 najlepszych. |
| Tabele | Punkty → bilans gier → mała tabela → ręczne rozstrzygnięcie admina. |
| Drabinka | Generowana po fazie grupowej; zwycięzcy grup trafiają na drugich z grup z przeciwnej połówki. Awans automatyczny po zatwierdzeniu wyniku. |
| Raporty | Formularz kliknięciami: zwycięzca, szablon, 12 frakcji z herbami, bohater z puli frakcji (One Hero – 1 bohater na gracza na grę), dzień w formacie **MWD** (np. 142), notatki, VOD. |
| Potwierdzenia | Przeciwnik akceptuje albo zgłasza spór / składa własny raport → kolejka moderatora z porównaniem raportów. |
| Historia | Każda zmiana wyniku zapisywana jest w historii meczu; akcje krytyczne – w logu administracyjnym. |
| Terminy | Kalendarz dostępności (pola 30-min, czas polski). Wspólne terminy wyliczane automatycznie → powiadomienie DM do obu graczy. Ręczne ustawienie startu meczu. |
| Powiadomienia | W serwisie + DM od bota (fallback: oznaczenie na kanale, gdy gracz blokuje DM). Ogłoszenie rundy jednym kliknięciem. |
| Na żywo | Tabele, drabinka, mecze i panel odświeżają się same (Server-Sent Events). |

---

## Konfiguracja Discorda

1. Wejdź na <https://discord.com/developers/applications> → **New Application**.
2. **OAuth2**
   - skopiuj *Client ID* → `DISCORD_CLIENT_ID` i *Client Secret* → `DISCORD_CLIENT_SECRET`,
   - dodaj Redirect: `https://TWOJA-DOMENA/api/auth/discord/callback` (dla lokalnego testu: `http://localhost:3000/api/auth/discord/callback`).
3. **Bot** → *Reset Token* → `DISCORD_BOT_TOKEN`. Intencje (Privileged Gateway Intents) **nie są potrzebne** – serwis używa wyłącznie REST API.
4. Zaproś bota na serwer turnieju (OAuth2 → URL Generator → scope `bot`) z uprawnieniami:
   **View Channels, Send Messages, Create Instant Invite** (to ostatnie jest wymagane do automatycznego dodawania graczy na serwer).
5. W Discordzie włącz *Tryb dewelopera* (Ustawienia → Zaawansowane) i skopiuj:
   - ID serwera → `DISCORD_GUILD_ID`,
   - ID kanału na ogłoszenia rund → `DISCORD_CHANNEL_ID`,
   - swoje ID użytkownika → `ADMIN_DISCORD_IDS`.
6. Utwórz stałe zaproszenie na serwer → `DISCORD_INVITE_URL` (link w stopce).

---

## Uruchomienie lokalne

Wymagany Node.js 22+. Docker nie jest potrzebny – lokalny PostgreSQL uruchamia się z pakietu npm.

```bash
npm install
cp .env.example .env           # uzupełnij SESSION_SECRET; DEV_LOGIN=true pozwala testować bez Discorda
npm run db:local               # (osobny terminal) PostgreSQL na porcie 5433, dane w .pgdata/
npm run db:migrate
npm run db:seed -- --players=40          # opcjonalnie: dane demo (dodaj --bracket, by od razu mieć drabinkę)
npm run dev                    # http://localhost:3000
```

Logowanie testowe (tylko gdy `DEV_LOGIN=true` i nie produkcja): `http://localhost:3000/api/auth/dev?name=admin` (administrator z danych demo) lub `?name=demo0` (gracz).

| Skrypt | Opis |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | testy jednostkowe i integracyjne (wymagają `npm run db:local`) |
| `npm run lint`, `npm run typecheck` | jakość kodu |
| `npm run db:generate` | nowa migracja po zmianie `src/db/schema.ts` |
| `npm run db:migrate` | wykonanie migracji |
| `npm run db:reset` | wyczyszczenie lokalnej bazy (tylko localhost) |
| `npm run db:seed` | dane demonstracyjne (zablokowane w produkcji) |

---

## Wdrożenie na Pterodactylu

Aplikacja to jeden kontener + osobna baza PostgreSQL. Wbudowane „Databases” Pterodactyla to MySQL/MariaDB, więc PostgreSQL musi działać jako osobny serwer (np. egg PostgreSQL z [pelican-eggs/database](https://github.com/pelican-eggs/database)) albo zewnętrzna usługa.

1. **Obraz Dockera.** Wypchnij repozytorium na GitHub – workflow `.github/workflows/ci.yml` uruchomi testy i opublikuje obraz `ghcr.io/<login>/homm3-tournament:latest` (ustaw pakiet jako publiczny albo dodaj dane logowania do rejestru w Wings). Możesz też zbudować go ręcznie: `docker build -t ghcr.io/<login>/homm3-tournament .`
2. **Egg.** W panelu: *Admin → Nests → Import Egg* → `deploy/pterodactyl/egg-homm3-tournament.json`. W polu *Docker Images* wpisz adres swojego obrazu.
3. **Baza.** Utwórz serwer PostgreSQL 14+ i bazę, np. `homm3`. Zanotuj adres w formacie `postgres://użytkownik:hasło@host:port/homm3`.
4. **Serwer.** Utwórz serwer z eggiem „HoMM3 Turniej One Hero”, przydziel port (alokację) i uzupełnij zmienne (adres, sekret sesji, baza, dane Discorda, `ADMIN_DISCORD_IDS`).
5. **Domena + HTTPS.** Ustaw reverse proxy (nginx / Caddy / Cloudflare Tunnel) z domeny na port serwera. `APP_URL` musi być dokładnie adresem publicznym (https), bo z niego budowany jest Redirect URI Discorda, a ciasteczka sesji są wtedy oznaczane jako `Secure`.
   Dla SSE (odświeżanie na żywo) w nginx wyłącz buforowanie dla `/api/live` (`proxy_buffering off;`) – serwis wysyła też nagłówek `X-Accel-Buffering: no`.
6. **Start.** Przy każdym starcie kontener wykonuje migracje bazy, a następnie uruchamia serwis na porcie z `SERVER_PORT`. Komunikat „Ready in” oznacza gotowość.
7. Zaloguj się kontem z `ADMIN_DISCORD_IDS` → **Panel** (link w nagłówku; adres `/admin` jest niewidoczny dla innych – zwraca 404).

Aktualizacja: wypchnij zmiany (nowy obraz `latest`) i zrestartuj serwer w panelu (Wings pobierze nowy obraz przy reinstalacji lub możesz ustawić tag wersji).

---

## Wdrożenie przez docker compose

```bash
cp .env.example .env      # uzupełnij; DATABASE_URL ustawia compose
docker compose up -d --build
```

Aplikacja nasłuchuje na porcie 3000, baza i grafiki są na wolumenach `pgdata` i `assets`.

---

## Grafiki z gry

Do czasu wgrania oryginalnych grafik serwis pokazuje placeholdery (herby w kolorach frakcji, monogramy bohaterów). Wystarczy wgrać pliki – bez zmian w kodzie:

```
assets/factions/<slug>.png   castle, rampart, tower, inferno, necropolis, dungeon,
                             stronghold, fortress, conflux, cove, factory, bulwark
assets/heroes/<slug>.png     np. orrin.png, crag-hack.png, sir-mullich.png
assets/ui/banner.jpg         baner – w panelu ustaw adres /grafika/ui/banner.jpg
```

- Pterodactyl: katalog `assets/` w menedżerze plików serwera.
- docker compose: wolumen `assets` (montowany w `/data/assets`).
- Lokalnie: `public/assets/`.

Slugi bohaterów widać w panelu (*Bohaterowie*). Tam też można dodać/wyłączyć bohaterów (np. po aktualizacji HotA). Ramki (oryginalne grafiki 9-slice z gry, `public/assets/ui/frame-*.png`) są warstwami: rama strony `PageFrame` (`.frame` niebieska na stronach publicznych, `.frame-red` w `/konto` i `/admin`) → panele `Frame` (`.frame-sm`) → elementy w panelach (`.frame-xs`). Tła: `public/assets/ui/bg-*.jpg`.

---

## Przebieg turnieju krok po kroku

1. **Panel → Konfiguracja i treści:** nazwa, ustawienia gry, nagrody, harmonogram, regulamin, polityka prywatności (Markdown z podglądem). **Szablony map**, **Ogłoszenia**.
2. **Turniej i fazy → Otwórz zapisy.** Gracze logują się przez Discord i zapisują w *Moje konto*.
3. **Zamknij zapisy → Losowanie grup:** serwis pokazuje warianty (liczba grup = potęga 2, grupy 4–6 os., awans 2 z grupy). Dla liczby graczy, z której nie da się ułożyć takich grup (np. 26–31), wyświetla najbliższe warianty z ostrzeżeniem – możesz też ponownie otworzyć zapisy.
4. **Discord → Ogłoś rundę:** wiadomość z oznaczeniem graczy, którzy mają mecze.
5. Gracze umawiają się (kalendarz dostępności podpowiada wspólne terminy), grają i raportują wynik; przeciwnik potwierdza. Spory trafiają do **Raporty i spory**.
6. Po zakończeniu grup: **Generuj drabinkę** (remisy wpływające na awans trzeba najpierw ustalić ręcznie).
7. Drabinka sama przesuwa zwycięzców; po finale i meczu o 3. miejsce turniej przechodzi w fazę „Zakończony”.
8. **Harmonogram** pomaga planować transmisje; **Log akcji** pokazuje kto i kiedy wykonał operacje krytyczne.

---

## Architektura

```
src/
  app/                     strony (App Router) – publiczne, /konto, /admin, API
    api/auth/…             logowanie Discord OAuth2 (state w ciasteczku), wylogowanie, logowanie dev
    api/live               Server-Sent Events (LISTEN tournament_events)
    grafika/[...path]      serwowanie grafik z ASSETS_DIR
  server/                  logika domenowa (jedyne miejsce zmian stanu)
    tournament.ts          zapisy, fazy, grupy, drabinka, role, bany, konfiguracja
    matches.ts             raporty, akceptacja, spory, korekty, walkowery, awans w drabince
    scheduling.ts          dostępność i propozycje terminów
    actions.ts / admin-actions.ts   Server Actions (walidacja zod + kontrola ról)
    queries.ts             odczyty dla stron
  lib/
    tournament/            czysta logika: warianty grup, round-robin, tabela, plan drabinki, walidacja raportu
    mwd.ts                 dzień gry M-T-D ↔ indeks dnia
    discord/               REST API Discorda + kolejka wysyłki (outbox z ponawianiem)
    auth/, authz.ts        sesje (hash tokenu w bazie), role
  data/factions.ts         12 frakcji i domyślne pule bohaterów
  db/schema.ts             schemat bazy (Drizzle), migracje w drizzle/
```

**Bezpieczeństwo**
- Każda Server Action sprawdza sesję i rolę po stronie serwera (`requireUser` / `requireRole`); serwisy domenowe dodatkowo weryfikują uprawnienia (np. tylko uczestnik meczu może raportować, tylko przeciwnik akceptuje).
- Panel `/admin` zwraca 404 osobom bez roli.
- Sesje: losowy token w ciasteczku `httpOnly`, w bazie tylko jego SHA-256; ban natychmiast usuwa sesje.
- Tokeny Discord zaszyfrowane AES-256-GCM.
- Zmiany meczów w transakcjach z blokadą wiersza (`SELECT … FOR UPDATE`) – brak wyścigów przy jednoczesnych akcjach.
- Treści Markdown renderowane z sanitizacją; linki VOD/streamów tylko z YouTube/Twitch/Kick.

**Zadania w tle** (`src/instrumentation.ts` → `src/lib/jobs.ts`): co 30 s wysyłka kolejki Discord, co ~10 min przeliczenie wspólnych terminów. Blokada doradcza PostgreSQL gwarantuje, że przy kilku instancjach pracuje tylko jedna. Wyłączenie: `DISABLE_JOBS=true`.

---

## Testy

```bash
npm run db:local   # w osobnym terminalu
npm test
```

- testy jednostkowe: MWD, warianty grup dla 8–200 graczy, round-robin, tabele i remisy, drabinka, walidacja raportów, przecięcia dostępności (w tym zmiana czasu),
- test integracyjny pełnego turnieju na prawdziwej bazie: zapisy → losowanie → raporty, spory, kontr-raporty, korekty → drabinka → finał → zakończenie, a także kontrola ról,
- kolejka Discord z zamockowanym API (DM, fallback na kanał, limit zapytań, błędy trwałe).
