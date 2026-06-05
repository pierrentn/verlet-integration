import type { Vector3 } from 'three';

export function isXYInsideCircle(
  position: Vector3,
  cursorPosition: Vector3,
  radius: number
) {
  const dx = position.x - cursorPosition.x;
  const dy = position.y - cursorPosition.y;
  return dx * dx + dy * dy < radius * radius;
}
