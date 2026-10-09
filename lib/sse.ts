// Server-sent events response. The work runs detached from start(): a stream whose async start() hasn't settled
// serves no reads, which would buffer every event until the end.
export function sse(work: (send: (event: object) => void) => Promise<void>) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      void work(send).finally(() => controller.close());
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
