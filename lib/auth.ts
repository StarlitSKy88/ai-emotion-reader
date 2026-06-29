import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import EmailProvider from "next-auth/providers/email";
import { Resend } from "resend";
import { prisma } from "./prisma";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export const authOptions: NextAuthOptions = {
  // 使用 JWT session 策略（兼容 Edge Runtime）
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 天
  },
  providers: [
    EmailProvider({
      server: {
        host: "smtp.resend.com",
        port: 465,
        auth: {
          user: "resend",
          pass: process.env.RESEND_API_KEY || "",
        },
      },
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      sendVerificationRequest: async ({ identifier, url, provider }) => {
        if (!resend) {
          console.error("RESEND_API_KEY 未配置");
          throw new Error("邮件服务未配置");
        }

        try {
          await resend.emails.send({
            from: provider.from as string,
            to: identifier,
            subject: "登录到 问心 AI",
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <style>
                    body { font-family: -apple-system, sans-serif; background: #FAF8F5; padding: 40px 20px; }
                    .container { max-width: 480px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; padding: 40px; }
                    h1 { font-family: Georgia, serif; font-size: 24px; color: #0A0A0A; margin: 0 0 16px; }
                    p { color: #525252; line-height: 1.6; margin: 0 0 24px; }
                    .button { display: inline-block; background: #0A0A0A; color: #FFFFFF; padding: 12px 28px; border-radius: 9999px; text-decoration: none; font-weight: 500; }
                    .footer { color: #A3A3A3; font-size: 12px; margin-top: 32px; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <h1>欢迎回到 问心 AI</h1>
                    <p>点击下面的按钮登录您的账户。链接 24 小时内有效。</p>
                    <a href="${url}" class="button">登录到 问心 AI →</a>
                    <p class="footer">如果您没有请求登录，请忽略此邮件。</p>
                  </div>
                </body>
              </html>
            `,
          });
        } catch (error) {
          console.error("邮件发送失败:", error);
          throw error;
        }
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify",
  },
  callbacks: {
    async jwt({ token, user }) {
      // 首次登录时，把用户 id 写入 token
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // @ts-ignore
        session.user.id = token.userId as string;
        // 读取用户最新信息（可选：查数据库）
        try {
          const user = await prisma.user.findUnique({
            where: { id: token.userId as string },
            select: { subscription: true, name: true },
          });
          // @ts-ignore
          session.user.subscription = user?.subscription;
        } catch (e) {
          // 数据库查询失败时不影响会话
        }
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};