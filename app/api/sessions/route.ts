import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/sessions
 * 获取当前用户的所有对话会话
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const status = url.searchParams.get("status");

    if (!userId) {
      return new Response(JSON.stringify({ error: "缺少 userId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const sessions = await prisma.session.findMany({
      where: {
        userId,
        ...(status ? { status } : {}),
      },
      orderBy: { lastMessageAt: "desc" },
      take: 50,
    });

    return new Response(JSON.stringify({ sessions }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Get sessions error:", error);
    return new Response(
      JSON.stringify({ error: "获取会话失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

/**
 * POST /api/sessions
 * 创建新对话会话
 *
 * Body: {
 *   userId: string,
 *   title?: string,
 *   context?: { gender, age, status, focusAreas, childhoodTag, etc. }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, title, context } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: "缺少 userId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const session = await prisma.session.create({
      data: {
        userId,
        title: title || "新的对话",
        context: context || {},
        status: "active",
        startedAt: new Date(),
        lastMessageAt: new Date(),
      },
    });

    return new Response(JSON.stringify({ session }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Create session error:", error);
    return new Response(
      JSON.stringify({ error: "创建会话失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}