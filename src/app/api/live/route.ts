import { connection } from "next/server";
import { liveBus } from "@/lib/realtime";

/** Server-Sent Events: powiadamia przeglądarki o zmianach w turnieju (tylko nazwy tematów, bez danych). */
export async function GET(req: Request) {
  await connection();
  const bus = liveBus();
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (topics: string[]) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(topics)}\n\n`));
      const ping = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 25_000);
      bus.on("event", send);
      controller.enqueue(encoder.encode("retry: 5000\n\n"));
      cleanup = () => {
        clearInterval(ping);
        bus.off("event", send);
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
