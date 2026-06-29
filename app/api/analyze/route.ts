import { NextRequest } from "next/server";
import { streamFullAnalysis } from "@/lib/llm";
import { UserInput } from "@/lib/prompts";

export const runtime = "edge";
export const maxDuration = 60;

/**
 * API 路由：AI 情感完整解读
 *
 * streamFullAnalysis 返回 AsyncIterable<string>（统一接口）
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as UserInput;

    if (!body.currentQuestion || body.currentQuestion.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: "请输入至少 5 个字的困惑描述" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (body.currentQuestion.length > 2000) {
      return new Response(
        JSON.stringify({ error: "困惑描述请控制在 1000 字以内" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const stream = await streamFullAnalysis(body);
    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // 统一的字符串流接口
          for await (const chunk of stream) {
            if (chunk) {
              controller.enqueue(encoder.encode(chunk));
            }
          }
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("API Error:", error);
    return new Response(
      JSON.stringify({
        error: "服务暂时不可用",
        detail: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export async function GET() {
  const { currentLLMConfig } = await import("@/lib/llm");
  return new Response(
    JSON.stringify({
      status: "ok",
      service: "问心 AI - 情感解读服务",
      version: "1.0.0",
      llm: currentLLMConfig,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}