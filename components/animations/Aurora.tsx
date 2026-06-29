"use client";

import { useEffect, useRef } from "react";
import "./Aurora.css";

/**
 * Aurora - 极光流动背景
 * 来自 ReactBits.dev
 * https://reactbits.dev/backgrounds/aurora
 */

type AuroraProps = {
  colorStops?: string[];
  blend?: number;
  amplitude?: number;
  speed?: number;
  className?: string;
};

export default function Aurora({
  colorStops = ["#FAF8F5", "#D97706", "#1A1F2E"],
  blend = 0.5,
  amplitude = 1.0,
  speed = 1.0,
  className = "",
}: AuroraProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let time = 0;
    let animationFrameId: number;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      time += 0.01 * speed;
      const { width, height } = canvas;

      ctx.clearRect(0, 0, width, height);

      // 简化的极光效果 - 多个渐变圆形
      const centerX = width / 2;
      const centerY = height / 2;

      for (let i = 0; i < colorStops.length; i++) {
        const x =
          centerX +
          Math.cos(time + (i * Math.PI * 2) / colorStops.length) *
            (width / 3) *
            amplitude;
        const y =
          centerY +
          Math.sin(time + (i * Math.PI * 2) / colorStops.length) *
            (height / 3) *
            amplitude;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, width / 2);
        gradient.addColorStop(0, colorStops[i] + "80");
        gradient.addColorStop(1, colorStops[i] + "00");

        ctx.fillStyle = gradient;
        ctx.globalCompositeOperation = "screen";
        ctx.fillRect(0, 0, width, height);
      }

      ctx.globalCompositeOperation = "source-over";

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [colorStops, blend, amplitude, speed]);

  return (
    <canvas
      ref={canvasRef}
      className={`aurora-canvas ${className}`}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        opacity: 0.6,
      }}
    />
  );
}