import { ZodError } from "zod";
import { AuthError } from "@/lib/authz";

/** Błąd biznesowy z komunikatem dla użytkownika (po polsku). */
export class ServiceError extends Error {}

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string; errors?: string[] };

/** Opakowanie Server Action: zamienia znane błędy na wynik, nieznane loguje. */
export async function run<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message };
  } catch (e) {
    if (e instanceof ValidationFailed) return { ok: false, error: e.message, errors: e.errors };
    if (e instanceof ServiceError || e instanceof AuthError) return { ok: false, error: e.message };
    if (e instanceof ZodError) return { ok: false, error: "Nieprawidłowe dane formularza." };
    // błędy nawigacji (redirect/notFound) muszą przejść dalej
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error("[action]", e);
    return { ok: false, error: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie." };
  }
}

export class ValidationFailed extends ServiceError {
  constructor(public errors: string[]) {
    super(errors[0] ?? "Nieprawidłowe dane.");
  }
}
