import confetti from "canvas-confetti";

const COLORS = ["#3B82F6", "#6366F1", "#8B5CF6", "#A855F7", "#FBBF24"];

export function celebrate({ intensity = "medium" } = {}) {
  const presets = {
    small: { count: 60, spread: 50, scalar: 0.8 },
    medium: { count: 130, spread: 70, scalar: 1 },
    big: { count: 220, spread: 90, scalar: 1.1 },
  };
  const p = presets[intensity] || presets.medium;
  // Center burst
  confetti({
    particleCount: p.count,
    spread: p.spread,
    startVelocity: 45,
    scalar: p.scalar,
    origin: { x: 0.5, y: 0.6 },
    colors: COLORS,
  });
  // Side bursts
  setTimeout(() => {
    confetti({
      particleCount: Math.round(p.count * 0.4),
      angle: 60, spread: 55, startVelocity: 40,
      origin: { x: 0, y: 0.7 }, colors: COLORS,
    });
    confetti({
      particleCount: Math.round(p.count * 0.4),
      angle: 120, spread: 55, startVelocity: 40,
      origin: { x: 1, y: 0.7 }, colors: COLORS,
    });
  }, 150);
}
