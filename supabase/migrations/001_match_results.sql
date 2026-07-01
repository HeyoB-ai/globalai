-- ============================================================================
-- Global · Slot Matcher
-- Migration 001: match_results
--
-- Bevat de resultaten van de Claude Managed Agent: lege advertentieslots
-- gematcht met potentiele adverteerders en actuele newshooks.
--
-- RLS staat aan. Alleen de 'authenticated' rol (ingelogde gebruikers) mag
-- lezen en schrijven. Idempotent: veilig om opnieuw te draaien.
-- ============================================================================

-- Status-enum. In een DO-block zodat opnieuw draaien geen fout geeft.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_status') THEN
    CREATE TYPE match_status AS ENUM (
      'nog_open',
      'benaderd',
      'gescoord',
      'afgewezen'
    );
  END IF;
END$$;

-- Hoofdtabel.
CREATE TABLE IF NOT EXISTS match_results (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locatie            TEXT NOT NULL,
  omgeving           TEXT NOT NULL,        -- bijv. Treinstation, Sportschool, Winkelcentrum
  doelgroep          TEXT NOT NULL,
  startdatum         DATE NOT NULL,
  einddatum          DATE NOT NULL,
  aantal_schermen    INT  NOT NULL DEFAULT 1,
  adverteerder       TEXT NOT NULL,        -- voorgestelde adverteerder / sector
  newshook           TEXT,
  newshook_bron      TEXT,                 -- url of bronnaam
  pitchregel         TEXT,
  status             match_status NOT NULL DEFAULT 'nog_open',
  laatst_geanalyseerd TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexen voor de dashboard-filters (omgeving, status, periode).
CREATE INDEX IF NOT EXISTS idx_match_results_omgeving   ON match_results (omgeving);
CREATE INDEX IF NOT EXISTS idx_match_results_status     ON match_results (status);
CREATE INDEX IF NOT EXISTS idx_match_results_periode    ON match_results (startdatum, einddatum);
CREATE INDEX IF NOT EXISTS idx_match_results_geanalyseerd ON match_results (laatst_geanalyseerd);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;

-- Lezen: alleen ingelogde gebruikers.
DROP POLICY IF EXISTS "authenticated kan lezen" ON match_results;
CREATE POLICY "authenticated kan lezen"
  ON match_results
  FOR SELECT
  TO authenticated
  USING (true);

-- Toevoegen: alleen ingelogde gebruikers.
DROP POLICY IF EXISTS "authenticated kan invoegen" ON match_results;
CREATE POLICY "authenticated kan invoegen"
  ON match_results
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Wijzigen (o.a. statusupdate vanuit het dashboard): alleen ingelogde gebruikers.
DROP POLICY IF EXISTS "authenticated kan wijzigen" ON match_results;
CREATE POLICY "authenticated kan wijzigen"
  ON match_results
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Verwijderen: alleen ingelogde gebruikers.
DROP POLICY IF EXISTS "authenticated kan verwijderen" ON match_results;
CREATE POLICY "authenticated kan verwijderen"
  ON match_results
  FOR DELETE
  TO authenticated
  USING (true);
