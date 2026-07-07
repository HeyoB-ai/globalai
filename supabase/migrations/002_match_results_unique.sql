-- ============================================================================
-- Global · Slot Matcher
-- Migration 002: unieke sleutel op match_results
--
-- Voegt een UNIQUE index toe op (locatie, adverteerder, startdatum). Dit is
-- de logische sleutel van een match en maakt een echte bulk-upsert mogelijk
-- (ON CONFLICT) vanuit de check-analysis-status function — in plaats van een
-- rij-voor-rij select+insert/update loop die bij grote datasets timeoutte.
--
-- Idempotent: veilig om opnieuw te draaien.
--
-- LET OP: als de tabel al dubbele rijen bevat op deze sleutel, faalt het
-- aanmaken van de index. Ontdubbel dan eerst (voorbeeld onderaan dit bestand,
-- uitgecommentarieerd) en draai de migratie opnieuw.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_match_results_key
  ON match_results (locatie, adverteerder, startdatum);

-- ---------------------------------------------------------------------------
-- Optioneel: ontdubbelen vóór het aanmaken van de index hierboven, mocht die
-- falen met "could not create unique index". Houdt de meest recent
-- geanalyseerde rij per sleutel.
-- ---------------------------------------------------------------------------
-- DELETE FROM match_results a
-- USING match_results b
-- WHERE a.locatie = b.locatie
--   AND a.adverteerder = b.adverteerder
--   AND a.startdatum = b.startdatum
--   AND a.laatst_geanalyseerd < b.laatst_geanalyseerd;
