"use client";

import { useEffect, useRef } from "react";

/**
 * ParticleTrail - 金色粒子轨迹流动效果
 * 类似 Asme 网站中央图片周围的粒子流
 * 基于 Canvas 2D 实现，性能优秀
 */

interface ParticleTrailProps {
  color?: string;
  particleCount?: number;
  speed?: number;
  trailLength?: number;
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  history: Array<{ x: number; y: number }>;
}

export default function ParticleTrail({
  color = "#D97706", // 暖橘金
  particleCount = 80,
  speed = 0.4,
  trailLength = 25,
  className = "",
}: ParticleTrailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 设置画布尺寸
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    // 创建粒子
    const initParticles = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      particlesRef.current = [];

      for (let i = 0; i < particleCount; i++) {
        particlesRef.current.push(createParticle(w, h, true));
      }
    };

    initParticles();

    // 动画循环
    let time = 0;
    const animate = () => {
      time += 0.005 * speed;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;

      ctx.clearRect(0, 0, w, h);

      const centerX = w / 2;
      const centerY = h / 2;
      const radius = Math.min(w, h) * 0.28;

      particlesRef.current.forEach((p, idx) => {
        // 创建螺旋路径（围绕中心）
        const angle = time + (idx / particleCount) * Math.PI * 2;
        const r = radius + Math.sin(time * 2 + idx * 0.3) * 30;

        // 目标位置（螺旋上）
        const targetX = centerX + Math.cos(angle * 1.5) * r;
        const targetY = centerY + Math.sin(angle * 1.5) * r;

        // 平滑移动到目标
        p.x += (targetX - p.x) * 0.05;
        p.y += (targetY - p.y) * 0.05;

        // 记录历史轨迹
        p.history.push({ x: p.x, y: p.y });
        if (p.history.length > trailLength) {
          p.history.shift();
        }

        // 绘制轨迹（渐变线条）
        if (p.history.length > 1) {
          ctx.beginPath();
          ctx.moveTo(p.history[0].x, p.history[0].y);

          for (let i = 1; i < p.history.length; i++) {
            const point = p.history[i];
            const opacity = i / p.history.length;
            ctx.strokeStyle = `${color}${Math.floor(opacity * 80)
              .toString(16)
              .padStart(2, "0")}`;
            ctx.lineWidth = (opacity * 1.5);

            if (i === 1) {
              ctx.moveTo(point.x, point.y);
            } else {
              const prev = p.history[i - 1];
              const midX = (prev.x + point.x) / 2;
              const midY = (prev.y + point.y) / 2;
              ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
            }
          }
          ctx.stroke();
        }

        // 绘制发光粒子头部
        const glowRadius = p.radius * 3;
        const gradient = ctx.createRadialGradient(
          p.x,
          p.y,
          0,
          p.x,
          p.y,
          glowRadius
        );
        gradient.addColorStop(0, `${color}ff`);
        gradient.addColorStop(0.4, `${color}66`);
        gradient.addColorStop(1, `${color}00`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [color, particleCount, speed, trailLength]);

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

function createParticle(
  w: number,
  h: number,
  initial = false
): Particle {
  const centerX = w / 2;
  const centerY = h / 2;
  const radius = Math.min(w, h) * 0.28;

  if (initial) {
    const angle = Math.random() * Math.PI * 2;
    const r = radius + (Math.random() - 0.5) * 60;
    return {
      x: centerX + Math.cos(angle) * r,
      y: centerY + Math.sin(angle) * r,
      vx: 0,
      vy: 0,
      radius: 1.5 + Math.random() * 1.5,
      life: 1,
      history: [],
    };
  }
  return {
    x: centerX,
    y: centerY,
    vx: 0,
    vy: 0,
    radius: 1.5,
    life: 1,
    history: [],
  };
}