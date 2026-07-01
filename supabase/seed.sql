-- ============================================================================
-- Global · Slot Matcher — Seed data
--
-- ~10 realistische voorbeeldrijen zodat het dashboard gevuld oogt bij eerste
-- gebruik. Meerdere adverteerder-matches delen dezelfde slot (locatie + periode)
-- zodat de kaartweergave met meerdere matches per slot zichtbaar wordt.
--
-- Draai dit NA migration 001. Idempotent gehouden via een TRUNCATE vooraf,
-- zodat opnieuw seeden geen dubbele rijen oplevert.
-- Let op: dit script draait als tabel-eigenaar (SQL editor / psql) en omzeilt
-- daarmee RLS — dat is de bedoeling voor seeding.
-- ============================================================================

TRUNCATE TABLE match_results;

INSERT INTO match_results
  (locatie, omgeving, doelgroep, startdatum, einddatum, aantal_schermen,
   adverteerder, newshook, newshook_bron, pitchregel, status, laatst_geanalyseerd)
VALUES
  -- Slot 1: Utrecht Centraal (2 matches)
  ('Utrecht Centraal', 'Treinstation', 'Forenzen 25-45 jr', '2026-07-06', '2026-07-19', 14,
   'NS International', 'Recordaantal internationale treinreizen deze zomer',
   'NS Persbericht', 'Pak de forens op weg naar werk met de belofte van een filevrije vakantiereis per trein.',
   'benaderd', NOW() - INTERVAL '2 days'),
  ('Utrecht Centraal', 'Treinstation', 'Forenzen 25-45 jr', '2026-07-06', '2026-07-19', 14,
   'Coolblue', 'Hittegolf verwacht: vraag naar ventilatoren en airco piekt',
   'KNMI / NOS', 'Verkoelende deal precies wanneer het perron 30 graden is — bezorgd voordat je thuis bent.',
   'nog_open', NOW() - INTERVAL '1 day'),

  -- Slot 2: Basic-Fit Amsterdam Zuidas
  ('Basic-Fit Zuidas', 'Sportschool', 'Young professionals 22-35 jr', '2026-07-01', '2026-07-31', 6,
   'Optimel Protein', 'Zomer-bodygoals: piek in fitnessinschrijvingen na de feestdagen',
   'RTL Nieuws', 'Vlak na de work-out oog in oog met de eiwitshake die bij hun routine past.',
   'gescoord', NOW() - INTERVAL '4 days'),

  -- Slot 3: Hoog Catharijne (2 matches)
  ('Winkelcentrum Hoog Catharijne', 'Winkelcentrum', 'Gezinnen & shoppers', '2026-07-07', '2026-07-27', 22,
   'HEMA', 'Zomervakantie regio Midden begint komende week',
   'Rijksoverheid vakantierooster', 'Laatste rush voor de vakantie? HEMA-essentials binnen handbereik in het centrum.',
   'nog_open', NOW() - INTERVAL '6 hours'),
  ('Winkelcentrum Hoog Catharijne', 'Winkelcentrum', 'Gezinnen & shoppers', '2026-07-07', '2026-07-27', 22,
   'Rituals', 'Nationale ontspan-week: focus op zelfzorg tijdens de zomer',
   'Marketingfeed NL', 'Even ontsnappen aan de drukte van het station — een momentje voor jezelf, twee winkels verderop.',
   'nog_open', NOW() - INTERVAL '8 hours'),

  -- Slot 4: Schiphol Plaza (2 matches)
  ('Schiphol Plaza', 'Luchthaven', 'Internationale reizigers', '2026-07-10', '2026-08-10', 30,
   'Rabobank Wisselkoers', 'Drukste zomer op Schiphol sinds jaren verwacht',
   'Schiphol Group', 'Reis zorgeloos: gunstige koers geregeld voordat je door de gate loopt.',
   'benaderd', NOW() - INTERVAL '3 days'),
  ('Schiphol Plaza', 'Luchthaven', 'Internationale reizigers', '2026-07-10', '2026-08-10', 30,
   'KLM', 'Toename lastminute-boekingen naar Zuid-Europa',
   'ANVR reisbranche', 'Nog geen plannen? Vanaf deze hal ben je morgen al aan de Middellandse Zee.',
   'afgewezen', NOW() - INTERVAL '9 days'),

  -- Slot 5: Rotterdam Centraal
  ('Rotterdam Centraal', 'Treinstation', 'Forenzen & studenten', '2026-07-13', '2026-07-26', 12,
   'Swapfiets', 'Meer fietsforensen door zomerse temperaturen',
   'Fietsersbond', 'Uit de trein, op de fiets: altijd een werkende fiets voor een vast bedrag per maand.',
   'nog_open', NOW() - INTERVAL '12 hours'),

  -- Slot 6: Stadion De Kuip
  ('Stadion Feijenoord (De Kuip)', 'Sportlocatie', 'Voetbalfans 18-50 jr', '2026-07-20', '2026-08-03', 8,
   'Grolsch 0.0', 'Start voorbereiding eredivisie-seizoen trekt volle tribunes',
   'ESPN NL', 'Proost op het nieuwe seizoen — alcoholvrij genieten, klaar voor de aftrap.',
   'gescoord', NOW() - INTERVAL '5 days'),

  -- Slot 7: Batavia Stad Outlet Lelystad
  ('Batavia Stad Outlet', 'Winkelcentrum', 'Koopjesjagers & dagjesmensen', '2026-07-15', '2026-08-15', 10,
   'Nike Factory Store', 'Zomeruitverkoop: piek in outlet-bezoek tijdens schoolvakanties',
   'Retail Insiders', 'Dagje uit + zomerkorting: de nieuwe collectie tegen outlet-prijzen, hier om de hoek.',
   'nog_open', NOW() - INTERVAL '18 hours');
