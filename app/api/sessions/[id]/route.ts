import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/sessions/[id]
 * 获取单个会话详情（包含消息列表）
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await prisma.session.findUnique({
      where: { id: params.id },
      include: {
        messages: {
          orderBy: { timestamp: "asc" },
        },
      },
    });

    if (!session) {
      return new Response(JSON.stringify({ error: "会话不存在" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ session }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Get session error:", error);
    return new Response(
      JSON.stringify({ error: "获取会话失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

/**
 * PATCH /api/sessions/[id]
 * 更新会话（标题、状态、摘要等）
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json();
    const { title, status, summary, insights } = body;

    const session = await prisma.session.update({
      where: { id: params.id },
      data: {
        ...(title ? { title } : {}),
        ...(status ? { status } : {}),
        ...(summary ? { summary } : {}),
        ...(insights ? { insights } : {}),
        ...(status === "archived" ? { endedAt: new Date() } : {}),
      },
    });

    return new Response(JSON.stringify({ session }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Update session error:", error);
    return new Response(
      JSON.stringify({ error: "更新会话失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

/**
 * DELETE /api/sessions/[id]
 * 删除会话
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await prisma.session.delete({
      where: { id: params.id },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Delete session error:", error);
    return new Response(
      JSON.stringify({ error: "删除会话失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}