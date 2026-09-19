import { z } from "zod";
import { runAgent, type AgentEvent } from "@/lib/ai";
import { CHAT_HISTORY_TURNS } from "@/lib/ai/config";
import { todayIST } from "@/lib/dates";
import { readJson, requireUser, route } from "@/lib/http";
import { buildFactSheet, loadContext } from "@/lib/services/context";
import { withLanguage } from "@/lib/services/language";
import { createToolExecutors } from "@/lib/services/tools";

const body = z.object({
  message: z.string().trim().min(1, "Type a message first.").max(1000),
  /** One-off style for this reply only, used by the "Roast my wallet" button. The saved persona is unchanged. */
  persona: z.enum(["friendly", "roast", "coach"]).optional(),
});

/**
 * The Advisor screen's endpoint. Streams AgentEvent objects as server-sent events
 * (tool steps, tokens, confirm and undo cards, done). The user id is the session's.
 */
export const POST = route(async (req: Request) => {
  const { userId, repo } = await requireUser();
  const { message, persona } = body.parse(await readJson(req));
  const today = todayIST();
  const ctx = await loadContext(repo, userId, today);
  const base = buildFactSheet(ctx);
  const facts = persona ? { ...base, profile: { ...base.profile, persona } } : base;
  const history = (await repo.listChat(userId, CHAT_HISTORY_TURNS)).map((m) => ({ role: m.role, content: m.content }));
  await repo.addChat(userId, "user", message);

  const encoder = new TextEncoder();
  let answer = "";
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AgentEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        for await (const event of runAgent({ message: withLanguage(message, ctx.profile.language ?? "en"), history, facts, userId, tools: createToolExecutors(repo, today) })) {
          if (event.type === "token") answer += event.text;
          send(event);
        }
      } catch (err) {
        console.error("[agent] run failed", err);
        send({ type: "error", message: "Something went wrong. Please try again." });
        send({ type: "done" });
      } finally {
        if (answer.trim()) await repo.addChat(userId, "assistant", answer.trim()).catch(() => undefined);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
    },
  });
});
