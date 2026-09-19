import { NextResponse } from "next/server";
import { z } from "zod";
import { CHAT_HISTORY_TURNS } from "@/lib/ai/config";
import { resolvePersona, streamChat } from "@/lib/ai";
import { todayIST } from "@/lib/dates";
import { readJson, requireUser, route } from "@/lib/http";
import { buildFactSheet, loadContext } from "@/lib/services/context";
import { withLanguage } from "@/lib/services/language";

const body = z.object({ message: z.string().trim().min(1, "Type a message first.").max(1000) });

/** Saved conversation, oldest first, so the Advisor screen can reload it. */
export const GET = route(async () => {
  const { userId, repo } = await requireUser();
  const messages = await repo.listChat(userId, 50);
  return NextResponse.json({ messages: messages.map(({ id, role, content, created_at }) => ({ id, role, content, created_at })) });
});

/** Plain-text streamed answer grounded in the user's fact sheet. */
export const POST = route(async (req: Request) => {
  const { userId, repo } = await requireUser();
  const { message } = body.parse(await readJson(req));
  const ctx = await loadContext(repo, userId, todayIST());
  const facts = buildFactSheet(ctx);
  const history = (await repo.listChat(userId, CHAT_HISTORY_TURNS)).map((m) => ({ role: m.role, content: m.content }));
  await repo.addChat(userId, "user", message);

  const source = streamChat(resolvePersona(ctx.profile.persona, facts), facts, history, withLanguage(message, ctx.profile.language ?? "en"));
  let answer = "";
  const decoder = new TextDecoder();
  const tee = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      answer += decoder.decode(chunk, { stream: true });
      controller.enqueue(chunk);
    },
    async flush() {
      if (answer.trim()) await repo.addChat(userId, "assistant", answer.trim());
    },
  });
  return new Response(source.pipeThrough(tee), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
});
