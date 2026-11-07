ALTER TABLE "tournaments" ALTER COLUMN "game_settings" SET DEFAULT '{"chessClock":"3 + 1 + 0:15","roads":"szybkie","monsterStrength":"Silne","difficulty":"160%","finalBattle":"242"}'::jsonb;--> statement-breakpoint
-- turnieje zapisane ze starą listą pól (poziom trudności, czas na turę, handicap, inne) dostają nowe ustawienia domyślne
UPDATE "tournaments" SET "game_settings" = '{"chessClock":"3 + 1 + 0:15","roads":"szybkie","monsterStrength":"Silne","difficulty":"160%","finalBattle":"242"}'::jsonb WHERE NOT ("game_settings" ? 'chessClock');
