-- ============================================================================
-- Global · Slot Matcher
-- Migration 003: app_settings
--
-- Kleine key-value tabel voor app-brede instellingen die at-runtime wijzigbaar
-- moeten zijn zonder redeploy. Eerste gebruik: de Anthropic Files-API file_id
-- van de actieve accountlijst (Accounts.xlsx). Het /admin-scherm uploadt een
-- nieuwe lijst en schrijft de nieuwe file_id hier weg; start-analysis leest 'm
-- bij elke sessie uit (met de env var ANTHROPIC_ACCOUNTS_FILE_ID als fallback).
--
-- RLS staat aan. Ingelogde gebruikers mogen lezen (zodat /admin de huidige
-- waarde kan tonen). Schrijven gebeurt uitsluitend server-side met de
-- service-role key (omzeilt RLS) vanuit de update-accounts function.
--
-- Idempotent: veilig om opnieuw te draaien.
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Lezen: alleen ingelogde gebruikers (voor het /admin-scherm).
DROP POLICY IF EXISTS "authenticated kan lezen" ON app_settings;
CREATE POLICY "authenticated kan lezen"
  ON app_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Bewust GEEN insert/update/delete-policy voor 'authenticated': schrijven mag
-- alleen server-side met de service-role key (die RLS omzeilt). Zo kan de
-- browser de accountlijst-instelling niet rechtstreeks manipuleren.

-- ---------------------------------------------------------------------------
-- Seed: huidige accountlijst-file_id (upload van Accounts.xlsx, 2026-07-14).
-- ON CONFLICT houdt de migratie idempotent én werkt de waarde bij als je 'm
-- opnieuw draait met een nieuwe file_id.
-- ---------------------------------------------------------------------------
INSERT INTO app_settings (key, value)
VALUES ('accounts_file_id', 'file_011Cd2Mv9aRuGPqj9wejWTZD')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = NOW();
