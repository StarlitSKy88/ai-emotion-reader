import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { streamFullAnalysis } from "@/lib/llm";
import { buildChatPrompt, UserInput } from "@/lib/prompts";

export const runtime = "edge";
export const maxDuration = 60;

/**
 * GET /api/sessions/[id]/messages
 * 获取会话的所有消息
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const messages = await prisma.message.findMany({
      where: { sessionId: params.id },
      orderBy: { timestamp: "asc" },
    });

    return new Response(JSON.stringify({ messages }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Get messages error:", error);
    return new Response(
      JSON.stringify({ error: "获取消息失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

/**
 * POST /api/sessions/[id]/messages
 * 发送新消息并获取 AI 流式回复
 *
 * Body: {
 *   userId: string,
 *   content: string,
 *   context?: UserInput  // 用户上下文（首次对话时）
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json();
    const { userId, content, context } = body;

    if (!userId || !content || content.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "缺少 userId 或 content" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // 获取会话历史（最近 10 条）
    const history = await prisma.message.findMany({
      where: { sessionId: params.id },
      orderBy: { timestamp: "desc" },
      take: 10,
    });
    const chatHistory = history.reverse().map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 保存用户消息
    await prisma.message.create({
      data: {
        sessionId: params.id,
        userId,
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      },
    });

    // 更新会话最后消息时间
    await prisma.session.update({
      where: { id: params.id },
      data: { lastMessageAt: new Date() },
    });

    // 获取会话上下文（如果 context 没传）
    let userContext = context;
    if (!userContext) {
      const session = await prisma.session.findUnique({
        where: { id: params.id },
      });
      userContext = (session?.context as UserInput) || ({} as UserInput);
    }

    // 构建对话 prompt（带历史）
    const prompt = buildChatPrompt(
      userContext,
      chatHistory,
      content.trim(),
    );

    // 调用 AI 流式
    const stream = await streamFullAnalysisWithChat(prompt);

    // 收集完整回复
    let accumulated = "";
    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            accumulated += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();

          // AI 回复完成后保存到数据库
          await prisma.message.create({
            data: {
              sessionId: params.id,
              userId,
              role: "assistant",
              content: accumulated,
              timestamp: new Date(),
            },
          });
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
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Send message error:", error);
    return new Response(
      JSON.stringify({ error: "发送消息失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

// 包装 stream 函数以支持对话 prompt
async function streamFullAnalysisWithChat(
  prompt: string,
): Promise<AsyncIterable<string>> {
  // 直接调用 LLM
  const { streamFullAnalysis } = await import("@/lib/llm");
  const stream = await streamFullAnalysis({
    name: "",
    gender: "",
    age: "",
    status: "",
    currentQuestion: prompt,
    childhoodTag: "",
    relationshipPattern: "",
    selfDescription: "",
    focusAreas: [],
  });

  async function* generate() {
    for await (const chunk of stream as any) {
      const content = chunk;
      if (content) yield content;
    }
  }

  return generate();
}