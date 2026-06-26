import { NextRequest } from "next/server";
import { streamSummary, currentLLMConfig } from "@/lib/llm";
import { UserInput } from "@/lib/prompts";

export const runtime = "edge";
export const maxDuration = 30;

/**
 * API 路由：生成免费摘要（引流钩子）
 *
 * streamSummary 返回 AsyncIterable<string>（统一接口）
 * 不再需要区分 provider
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as UserInput;

    if (!body.question || body.question.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: "请输入至少 5 个字的困惑描述" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const stream = await streamSummary(body);
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
          console.error("Summary stream error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Summary API Error:", error);
    return new Response(
      JSON.stringify({
        error: "服务暂时不可用",
        detail: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}