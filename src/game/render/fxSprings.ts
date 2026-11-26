import { SPRING_TOKENS } from '../../data/tuning';

export interface CanvasSpring {
  value: number;
  velocity: number;
  target: number;
}

export function createCanvasSpring(initial = 0, target = initial): CanvasSpring {
  return { value: initial, velocity: 0, target };
}

export function stepCanvasSpring(
  spring: CanvasSpring,
  dtS: number,
  tokenName: keyof typeof SPRING_TOKENS,
): number {
  const { stiffness, damping, mass } = SPRING_TOKENS[tokenName];
  const force = -stiffness * (spring.value - spring.target) - damping * spring.velocity;
  const accel = force / mass;
  spring.velocity += accel * dtS;
  spring.value += spring.velocity * dtS;
  return spring.value;
}
