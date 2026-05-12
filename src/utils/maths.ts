export const PI = Math.PI
export const PI2 = 2 * PI

export const min = Math.min.bind(Math)
export const max = Math.max.bind(Math)
export const abs = Math.abs.bind(Math)
export const ceil = Math.ceil.bind(Math)
export const floor = Math.floor.bind(Math)
export const round = Math.round.bind(Math)
export const exp = Math.exp.bind(Math)
export const sin = Math.sin.bind(Math)
export const cos = Math.cos.bind(Math)

/**
 * Linearly interpolates between two values (x and y)
 * by a normalized factor (a).
 *
 * @param x - The starting value.
 * @param y - The ending value.
 * @param a - The interpolation factor, typically between 0 and 1.
 *            When a is 0, the result is x. When a is 1, the result is y.
 * @returns The interpolated value.
 */
export function lerp(x: number, y: number, a: number) {
	return (1 - a) * x + a * y
}

/**
 * Smoothly interpolates between two values (x to y)
 * using a damping coefficient (a) and delta time (dt),
 * ensuring consistent, fluid transitions over time.
 *
 * @param x - The starting value.
 * @param y - The ending value.
 * @param a - The interpolation factor, typically between 0 and 1.
 *            When a is 0, the result is x. When a is 1, the result is y.
 * @param dt - Delta time.
 * @returns The interpolated value.
 */
export function damp(x: number, y: number, a: number, dt: number) {
	return lerp(x, y, 1 - exp(-a * 0.05 * dt))
}

/**
 * Clamps a value between a minimum and maximum value.
 *
 * @param value - The value to clamp.
 * @param minValue - The minimum value.
 * @param maxValue - The maximum value.
 * @returns The clamped value.
 */
export function clamp(v: number, mn: number, mx: number) {
	return max(mn, min(v, mx))
}

/**
 * Remaps a value from one range to another.
 *
 * @param value - The value to remap.
 * @param x1 - The minimum value of the original range.
 * @param y1 - The maximum value of the original range.
 * @param x2 - The minimum value of the new range.
 * @param y2 - The maximum value of the new range.
 * @returns The remapped value.
 */
export function remap(v: number, x1: number, y1: number, x2: number, y2: number) {
	return ((v - x1) * (y2 - x2)) / (y1 - x1) + x2
}

/**
 * Smoothly interpolates between two values (a and b)
 * using a cubic interpolation.
 *
 * @param a - The starting value.
 * @param b - The ending value.
 * @param v - The value to interpolate.
 * @returns The interpolated value.
 */
export function smoothstep(a: number, b: number, v: number) {
	v = max(0, min(1, (v - a) / (b - a)))
	return v * v * (3 - 2 * v)
}

/**
 * Returns 0 if the value is less than the edge,
 * otherwise returns 1.
 *
 * @param e - The edge value.
 * @param x - The value to check.
 * @returns 0 or 1.
 */
export function step(e: number, x: number): number {
	return x < e ? 0.0 : 1.0
}

/**
 * Returns the target value if the absolute difference
 * between the value and the target is less than the epsilon.
 *
 * @param v - The value to check.
 * @param e - The epsilon value.
 * @param t - The target value.
 * @returns The target value or the original value.
 */
export function epsilon(v: number, e: number, t: number): number {
	return abs(v) <= e ? t : v
}

/**
 * Exponentially decays a value from a starting value (a)
 * to a target value (b) over time.
 *
 * @param a - The starting value.
 * @param b - The target value.
 * @param d - The decay rate.
 * @param dt - The delta time.
 * @returns The decayed value.
 */
export function expDecay(a: number, b: number, d: number, dt: number) {
	return b + (a - b) * exp(-d * dt)
}

/**
 * Returns the distance between two values.
 *
 * @param a - The first value.
 * @param b - The second value.
 * @returns The distance between the two values.
 */
export function distance(a: number, b: number): number {
	return abs(a - b)
}

/**
 * Mixes two numbers based on a progress value.
 *
 * @param from - The starting value.
 * @param to - The ending value.
 * @param p - The progress value.
 * @returns The mixed value.
 */
export function mix(from: number, to: number, p: number): number {
	return from + (to - from) * p
}

/**
 * Pads a float value to a specified precision.
 *
 * @param value - The float value to pad.
 * @param precision - The precision to pad to.
 * @example padFloat(1.23456789, 1000) // 1.234
 * @returns The padded float value.
 */
export function padFloat(value: number, precision: number) {
	return ~~(value * precision) / precision
}

/**
 * Wraps a value within a specified range.
 * To bring a number outside an interval [min, max)
 * into this interval while maintaining a form
 * of circular continuity.
 *
 * @param value - The value to wrap.
 * @param min - The minimum value of the range.
 * @param max - The maximum value of the range.
 * @example wrap(1.23456789, 0, 1) // 0.23456789
 * @returns The wrapped value.
 */
export function wrap(value: number, min: number, max: number): number {
	const range = max - min
	return ((range + ((value - min) % range)) % range) + min
}
