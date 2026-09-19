import { NextResponse } from "next/server";
import { aiMock } from "@/lib/ai/config";

/** Which AI mode the server is in. Safe to expose: no key, only whether one exists and the model id. */
export const GET = async () =>
  NextResponse.json({
    mock: aiMock(),
    keyConfigured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL_MID ?? null,
  });
