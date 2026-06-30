"use client";

import { useEffect, useRef } from "react";

/**
 * ParticleTrail V2 - 多层次有机流动粒子轨迹
 * 参考 Asme 网站的金色粒子效果
 *
 * 特性：
 * - 多层次粒子（远/中/近三层）
 * - 贝塞尔曲线轨迹
 * - 闪烁明暗变化
 * - 长拖尾发光
 * - 鼠标交互
 */

interface ParticleTrailProps {
  color?: string;
  className?: string;
}

interface Particle {
  angle: number;
  angleSpeed: number;
  radius: number;
  radiusVariation: number;
  speed: number;
  brightness: number;
  brightnessSpeed: number;
  size: number;
  layer: number; // 0=远, 1=中, 2=近
  history: Array<{ x: number; y: number }>;
  phase: number;
}

export default function ParticleTrail({
  color = "#D97706",
  className = "",
}: ParticleTrailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number | null>(null);
  const mouseRef = useRef<{ x: number; y: number }>({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    // 鼠标交互
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };
    canvas.addEventListener("mousemove", handleMouseMove);

    // 创建多层次粒子
    const createParticles = () => {
      const particles: Particle[] = [];

      // 远景层（小、慢、暗）
      for (let i = 0; i < 40; i++) {
        particles.push({
          angle: (i / 40) * Math.PI * 2 + Math.random() * 0.3,
          angleSpeed: 0.15 + Math.random() * 0.1,
          radius: 0.78 + Math.random() * 0.08,
          radiusVariation: 0.03 + Math.random() * 0.04,
          speed: 0.8 + Math.random() * 0.3,
          brightness: 0.4 + Math.random() * 0.2,
          brightnessSpeed: 0.5 + Math.random() * 0.5,
          size: 0.8 + Math.random() * 0.6,
          layer: 0,
          history: [],
          phase: Math.random() * Math.PI * 2,
        });
      }

      // 中景层（中、中速、中亮）
      for (let i = 0; i < 50; i++) {
        particles.push({
          angle: (i / 50) * Math.PI * 2 + Math.random() * 0.2,
          angleSpeed: 0.2 + Math.random() * 0.15,
          radius: 0.85 + Math.random() * 0.1,
          radiusVariation: 0.05 + Math.random() * 0.06,
          speed: 1 + Math.random() * 0.4,
          brightness: 0.6 + Math.random() * 0.3,
          brightnessSpeed: 0.7 + Math.random() * 0.6,
          size: 1.2 + Math.random() * 0.8,
          layer: 1,
          history: [],
          phase: Math.random() * Math.PI * 2,
        });
      }

      // 前景层（大、快、亮）
      for (let i = 0; i < 30; i++) {
        particles.push({
          angle: (i / 30) * Math.PI * 2 + Math.random() * 0.1,
          angleSpeed: 0.3 + Math.random() * 0.2,
          radius: 0.92 + Math.random() * 0.08,
          radiusVariation: 0.08 + Math.random() * 0.08,
          speed: 1.3 + Math.random() * 0.5,
          brightness: 0.8 + Math.random() * 0.2,
          brightnessSpeed: 0.9 + Math.random() * 0.7,
          size: 1.8 + Math.random() * 1.2,
          layer: 2,
          history: [],
          phase: Math.random() * Math.PI * 2,
        });
      }

      particlesRef.current = particles;
    };

    createParticles();

    // 解析颜色为 RGB
    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };

    const rgb = hexToRgb(color);

    let time = 0;
    const animate = () => {
      time += 0.008;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      const centerX = w / 2;
      const centerY = h / 2;
      const baseRadius = Math.min(w, h) * 0.32;

      // 整体半透明背景拖尾效果
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      ctx.fillRect(0, 0, w, h);

      particlesRef.current.forEach((p) => {
        // 螺旋运动（贝塞尔曲线风格）
        p.angle += 0.002 * p.angleSpeed * p.speed;
        const r =
          baseRadius *
          (p.radius +
            Math.sin(time * p.brightnessSpeed + p.phase) * p.radiusVariation);

        // 目标位置（黄金螺旋 + 椭圆变形）
        const wobbleX = Math.cos(time * 0.7 + p.phase * 2) * 8;
        const wobbleY = Math.sin(time * 0.5 + p.phase * 1.5) * 8;

        const targetX = centerX + Math.cos(p.angle) * r + wobbleX;
        const targetY =
          centerY + Math.sin(p.angle * 1.3) * r * 0.85 + wobbleY;

        // 鼠标吸引
        const dx = targetX - mouseRef.current.x;
        const dy = targetY - mouseRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100 && dist > 0) {
          const force = (1 - dist / 100) * 15;
          const angle = Math.atan2(dy, dx);
          const newX = targetX + Math.cos(angle) * force;
          const newY = targetY + Math.sin(angle) * force;
          p.history.push({ x: newX, y: newY });
        } else {
          p.history.push({ x: targetX, y: targetY });
        }

        // 限制历史长度
        const maxLength = p.layer === 2 ? 28 : p.layer === 1 ? 22 : 16;
        if (p.history.length > maxLength) {
          p.history.shift();
        }

        // 闪烁明暗
        const brightnessFactor =
          p.brightness *
          (0.7 + 0.3 * Math.sin(time * 2 + p.phase * 3));
        const alpha = brightnessFactor;

        // 绘制长拖尾（贝塞尔曲线）
        if (p.history.length > 2) {
          ctx.beginPath();
          ctx.moveTo(p.history[0].x, p.history[0].y);

          for (let i = 1; i < p.history.length - 1; i++) {
            const point = p.history[i];
            const nextPoint = p.history[i + 1];
            const midX = (point.x + nextPoint.x) / 2;
            const midY = (point.y + nextPoint.y) / 2;
            ctx.quadraticCurveTo(point.x, point.y, midX, midY);
          }

          const tailAlpha = alpha * 0.7;
          ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${tailAlpha})`;
          ctx.lineWidth = p.size * (p.layer + 1) * 0.5;
          ctx.lineCap = "round";
          ctx.stroke();
        }

        // 绘制粒子头部（带发光）
        const headPos = p.history[p.history.length - 1];
        if (headPos) {
          // 外层光晕
          const glowRadius = p.size * 8;
          const gradient = ctx.createRadialGradient(
            headPos.x,
            headPos.y,
            0,
            headPos.x,
            headPos.y,
            glowRadius,
          );
          gradient.addColorStop(
            0,
            `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`,
          );
          gradient.addColorStop(
            0.3,
            `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.5})`,
          );
          gradient.addColorStop(
            0.6,
            `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.2})`,
          );
          gradient.addColorStop(
            1,
            `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`,
          );
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(headPos.x, headPos.y, glowRadius, 0, Math.PI * 2);
          ctx.fill();

          // 核心亮点
          ctx.fillStyle = `rgba(255, 230, 200, ${alpha})`;
          ctx.beginPath();
          ctx.arc(headPos.x, headPos.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [color]);

  return (
    <canvas
      ref={canvasRef}
      className={`particle-trail ${className}`}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}