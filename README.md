# Global · Slot Matcher

Intern dashboard voor **Global** (exploitant van digitale schermen). Het toont
lege advertentieslots, gematcht met potentiële adverteerders en actuele
newshooks. De matches worden gegenereerd door een **Claude Managed Agent** en
weggeschreven naar Supabase; dit dashboard is de leeslaag + statusbeheer voor
accountmanagers.

> **Scope van deze versie:** het dashboard (lezen + status wijzigen) achter een
> Supabase e-mail/wachtwoord-login. Het aansturen van de agent (nieuwe run
> starten) komt in een latere iteratie via een Netlify Function.

## Inloggen & gebruikers

Het dashboard staat achter een loginscherm (Supabase Auth, e-mail + wachtwoord).
De RLS-policies geven alléén de `authenticated` rol toegang, dus zonder login
zijn er geen matches zichtbaar.

Er is bewust **geen** self-service registratie — accountmanagers worden door een
beheerder toegevoegd:

1. Supabase Dashboard → **Authentication → Users → Add user**.
2. Vul e-mailadres + wachtwoord in en vink **Auto Confirm User** aan (anders moet
   het account eerst per e-mail bevestigd worden).
3. De gebruiker kan nu inloggen op de site.

Uitloggen kan via de knop rechtsboven in de header.

## Stack

- **Vite** + **React 19** + **TypeScript**
- **Tailwind CSS v4** (via `@tailwindcss/vite`)
- **Supabase** (database + auth + RLS)
- Deploy-doel: **Netlify**

## Vereisten

- Node.js 18+ (aanbevolen 20+)
- Een Supabase-project

## 1. Installeren

```bash
npm install
```

## 2. Omgevingsvariabelen

Kopieer het voorbeeldbestand en vul je eigen Supabase-waarden in
(Supabase → Project Settings → API):

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

De `anon key` is bedoeld om publiek te zijn; de beveiliging zit in **Row Level
Security**, niet in de key.

## 3. Database-migration draaien

De tabel `match_results` (met enum, indexen en RLS-policies) staat in
`supabase/migrations/001_match_results.sql`.

**Optie A — Supabase Dashboard (snelst):**
Open **SQL Editor**, plak de inhoud van het migration-bestand en klik **Run**.

**Optie B — Supabase CLI:**

```bash
supabase db push
# of, om één bestand te draaien:
supabase db execute --file supabase/migrations/001_match_results.sql
```

**Optie C — psql:**

```bash
psql "$DATABASE_URL" -f supabase/migrations/001_match_results.sql
```

Het script is **idempotent**: opnieuw draaien geeft geen fouten.

## 4. Seed-data draaien (optioneel maar aanbevolen)

Voor ~10 realistische voorbeeldrijen zodat het dashboard gevuld oogt:

**Supabase SQL Editor:** plak `supabase/seed.sql` en klik **Run**.

**Of via CLI / psql:**

```bash
supabase db execute --file supabase/seed.sql
# of
psql "$DATABASE_URL" -f supabase/seed.sql
```

> Seeden draait als tabel-eigenaar en omzeilt daarmee RLS — dat is de bedoeling.
> Het script doet eerst een `TRUNCATE`, dus opnieuw seeden levert geen dubbele
> rijen op.

## 5. Dev-server starten

```bash
npm run dev
```

Standaard op http://localhost:5173.

> **Let op — RLS + auth:** de leespolicy staat alléén de `authenticated` rol
> toe. Je krijgt daarom eerst het loginscherm; log in met een Supabase-gebruiker
> (zie [Inloggen & gebruikers](#inloggen--gebruikers)) om de matches te zien.

## Overige scripts

```bash
npm run build     # type-check + productie-build naar dist/
npm run preview   # lokaal de productie-build serveren
npm run lint      # tsc --noEmit (type-check zonder build)
```

## Deploy naar Netlify

`netlify.toml` is meegeleverd (build `npm run build`, publish `dist`, SPA
fallback). Zet in Netlify → **Site settings → Environment variables**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Datamodel (`match_results`)

| Kolom                 | Type          | Toelichting                                        |
| --------------------- | ------------- | -------------------------------------------------- |
| `id`                  | uuid (pk)     | auto via `gen_random_uuid()`                       |
| `locatie`             | text          | naam van de locatie                                |
| `omgeving`            | text          | Treinstation, Sportschool, Winkelcentrum, …        |
| `doelgroep`           | text          | omschrijving van de doelgroep                      |
| `startdatum`          | date          | begin van de slot-periode                          |
| `einddatum`           | date          | einde van de slot-periode                          |
| `aantal_schermen`     | int           | aantal schermen op de locatie                      |
| `adverteerder`        | text          | voorgestelde adverteerder / sector                 |
| `newshook`            | text          | actuele nieuwshaak                                 |
| `newshook_bron`       | text          | url of bronnaam                                    |
| `pitchregel`          | text          | kant-en-klare pitchregel                           |
| `status`              | enum          | `nog_open` \| `benaderd` \| `gescoord` \| `afgewezen` |
| `laatst_geanalyseerd` | timestamptz   | wanneer de agent dit voor het laatst analyseerde   |

Meerdere rijen met dezelfde `locatie` + periode worden in het dashboard
gegroepeerd tot één **slot** met meerdere voorgestelde matches.

## Projectstructuur

```
supabase/
  migrations/001_match_results.sql   # tabel + enum + RLS-policies (authenticated)
  seed.sql                           # ~10 voorbeeldrijen
src/
  lib/
    supabase.ts        # client (VITE_SUPABASE_URL / _ANON_KEY)
    useAuth.ts         # Supabase-sessie (getSession + onAuthStateChange)
    matchService.ts    # fetchMatches / updateMatchStatus
    selectors.ts       # filteren, groeperen tot slots, statistieken
    constants.ts       # statuskleuren
    format.ts          # NL datum-/tijdnotatie
  components/
    LoginScreen.tsx    # e-mail/wachtwoord-login
    Dashboard.tsx      # ingelogde dashboard (data + states)
    Header.tsx         # kobalt topbar, wordmark, uitloggen
    Wordmark.tsx       # GLOBAL-logo placeholder (ring-met-stip "O")
    # + StatsStrip, FilterBar, SlotCard, MatchItem, StatusBadge, …
  App.tsx              # auth-gate: config / sessie-check / login / dashboard
```
