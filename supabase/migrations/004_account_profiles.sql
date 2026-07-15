-- ============================================================================
-- Global · Slot Matcher
-- Migration 004: account_profiles
--
-- Cachelaag voor de SECTORCLASSIFICATIE van adverteerders. Sectorclassificatie
-- verandert nauwelijks, dus dat hoeft niet bij elke analyse opnieuw via
-- websearch te worden uitgezocht. Newshooks (actueel nieuws) blijven WEL elke
-- analyse vers opgezocht — die staan bewust NIET in deze tabel.
--
-- Gevuld door het classificatieproces (Managed Agent-sessie → JSON → upsert
-- vanuit de classify-accounts function). De hoofdanalyse (start-analysis) mount
-- de inhoud van deze tabel als voorgeclassificeerde data, zodat de agent alleen
-- nog naar newshooks hoeft te zoeken.
--
-- RLS staat aan. Ingelogde gebruikers mogen lezen (zodat /admin de tellingen
-- "X bekend / Y nieuw" kan tonen). Schrijven gebeurt uitsluitend server-side
-- met de service-role key (omzeilt RLS).
--
-- Idempotent: veilig om opnieuw te draaien.
-- ============================================================================

CREATE TABLE IF NOT EXISTS account_profiles (
  advertiser          TEXT PRIMARY KEY,        -- exacte naam zoals in Accounts.xlsx
  sector              TEXT NOT NULL,           -- bijv. "Verzekeringen", "Reisorganisatie"
  typische_doelgroep  TEXT NOT NULL,           -- korte omschrijving van wie dit bedrijf wil bereiken
  korte_beschrijving  TEXT,                    -- 1 zin context voor de matching-agent (nullable)
  classified_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE account_profiles ENABLE ROW LEVEL SECURITY;

-- Lezen: alleen ingelogde gebruikers (voor de tellingen in /admin).
DROP POLICY IF EXISTS "authenticated kan lezen" ON account_profiles;
CREATE POLICY "authenticated kan lezen"
  ON account_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Bewust GEEN insert/update/delete-policy voor 'authenticated': schrijven mag
-- alleen server-side met de service-role key (die RLS omzeilt). Zo kan de
-- browser de classificatie-cache niet rechtstreeks manipuleren.
