import { sql } from "drizzle-orm";
import { db } from "@/db";
import { processOutbox } from "@/lib/discord/outbox";
import { scanAllProposals } from "@/server/scheduling";

const g = globalThis as unknown as { __jobsStarted?: boolean };
const TICK_MS = 30_000;
const SCAN_EVERY_TICKS = 20; // ~10 min

/** Pętla zadań w tle w procesie serwera. Blokada doradcza zapewnia jedną aktywną instancję. */
export function startJobs() {
  if (g.__jobsStarted || process.env.DISABLE_JOBS === "true") return;
  g.__jobsStarted = true;
  let tick = 0;
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      // transakcja trzyma blokadę przez cały przebieg; praca idzie innymi połączeniami z puli
      await db.transaction(async (tx) => {
        const [{ locked }] = (await tx.execute(sql`select pg_try_advisory_xact_lock(777001) as locked`)) as unknown as { locked: boolean }[];
        if (!locked) return;
        await processOutbox();
        if (tick % SCAN_EVERY_TICKS === 0) await scanAllProposals();
        tick++;
      });
    } catch (e) {
      console.error("[jobs]", e);
    } finally {
      running = false;
    }
  };

  setTimeout(run, 5_000);
  setInterval(run, TICK_MS).unref?.();
  console.log("[jobs] zadania w tle uruchomione");
}
