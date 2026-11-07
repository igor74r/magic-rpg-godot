// Frame-rate independent overworld movement helpers.
// deltaFrames is measured in 60 FPS frames (the render loop's normalized dt).
export function getMovementDelta(dx, dy, deltaFrames = 1, speed = 3.2) {
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length === 0) return { x: 0, y: 0 };
  const frames = Number.isFinite(deltaFrames) ? Math.max(0, Math.min(3, deltaFrames)) : 1;
  const distance = speed * frames;
  return { x: (dx / length) * distance, y: (dy / length) * distance };
}

// Swept circle movement with balanced axis sliding. Try the intended diagonal
// first; when a corner blocks it, advance along whichever axis is furthest
// behind the requested direction. This avoids a permanent X-first bias.
export function resolveSweptMovement(x, y, dx, dy, canOccupy, maxStep = 4) {
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance === 0) return { x, y, moved: false };
  const stepSize = Number.isFinite(maxStep) ? Math.max(1, maxStep) : 4;
  const count = Math.max(1, Math.ceil(distance / stepSize));
  const stepX = dx / count, stepY = dy / count;
  let progressX = 0, progressY = 0, moved = false;

  for (let i = 0; i < count; i++) {
    const nextX = x + stepX, nextY = y + stepY;
    if (canOccupy(nextX, nextY)) {
      x = nextX; y = nextY;
      progressX += Math.abs(stepX); progressY += Math.abs(stepY);
      moved = true;
      continue;
    }

    const canX = canOccupy(nextX, y);
    const canY = canOccupy(x, nextY);
    if (canX && canY) {
      const wantedX = Math.abs(dx) / (Math.abs(dx) + Math.abs(dy));
      const currentTotal = progressX + progressY;
      const currentX = currentTotal > 0 ? progressX / currentTotal : wantedX;
      if (currentX < wantedX) {
        x = nextX; progressX += Math.abs(stepX);
      } else {
        y = nextY; progressY += Math.abs(stepY);
      }
      moved = true;
    } else if (canX) {
      x = nextX; progressX += Math.abs(stepX); moved = true;
    } else if (canY) {
      y = nextY; progressY += Math.abs(stepY); moved = true;
    }
  }
  return { x, y, moved };
}

// Exponential camera easing expressed in normalized 60 FPS frames.
// This preserves the existing 0.15-per-frame feel while making it FPS independent.
export function getCameraPosition(current, target, deltaFrames = 1, smoothing = 0.15) {
  if (!Number.isFinite(current) || !Number.isFinite(target)) return current;
  const frames = Number.isFinite(deltaFrames) ? Math.max(0, Math.min(3, deltaFrames)) : 1;
  const factor = Number.isFinite(smoothing) ? Math.max(0, Math.min(1, smoothing)) : 0.15;
  if (frames === 0 || factor === 0) return current;
  if (factor === 1) return target;
  const next = current + (target - current) * (1 - Math.pow(1 - factor, frames));
  return Math.abs(target - next) < 0.05 ? target : next;
}
