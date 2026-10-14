// Server-sent events response. The work runs detached from start(): a stream whose async start() hasn't settled
// serves no reads, which would buffer every event until the end.
// A reader that leaves (a closed tab) cancels the stream; later sends are dropped and the work runs to its end, so a
// generation still lands in the cache (Oct 13 adversarial pass: a send after cancel threw "Controller is already closed").
export function sse(work: (send: (event: object) => void) => Promise<void>) {
  const encoder = new TextEncoder();
  let open = true;
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: object) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          open = false;
        }
      };
      void work(send)
        .catch((err) => console.error("[sse]", err))
        .finally(() => {
          if (!open) return;
          open = false;
          controller.close();
        });
    },
    cancel() {
      open = false;
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
