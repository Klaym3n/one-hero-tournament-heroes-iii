/** Ustawienia gry wyświetlane w zakładce „Turniej” i edytowane w panelu admina. */
export type GameSettings = {
  chessClock: string;
  roads: string;
  monsterStrength: string;
  difficulty: string;
  finalBattle: string;
};

export const GAME_SETTING_FIELDS: { key: keyof GameSettings; label: string; default: string }[] = [
  { key: "chessClock", label: "Zegar szachowy", default: "3 + 1 + 0:15" },
  { key: "roads", label: "Rodzaj dróg", default: "szybkie" },
  { key: "monsterStrength", label: "Siła potworów", default: "Silne" },
  { key: "difficulty", label: "Poziom trudności", default: "160%" },
  { key: "finalBattle", label: "Walka finałowa", default: "242" },
];

export const DEFAULT_GAME_SETTINGS = Object.fromEntries(GAME_SETTING_FIELDS.map((f) => [f.key, f.default])) as GameSettings;

/**
 * Ustawienia z bazy w aktualnym kształcie: brakujące pola (np. w turnieju zapisanym przed zmianą listy pól)
 * dostają wartości domyślne, a nieużywane stare pola są pomijane.
 */
export function normalizeGameSettings(raw: unknown): GameSettings {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries(
    GAME_SETTING_FIELDS.map((f) => [f.key, typeof src[f.key] === "string" ? (src[f.key] as string) : f.default]),
  ) as GameSettings;
}
