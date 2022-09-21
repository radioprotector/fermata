/**
 * The X/Z range of the overall collection of clouds.
 */
export const OVERALL_XZ_RANGE = 70;

/**
 * The Y range of the overall collection of clouds.
 */
export const OVERALL_Y_RANGE = 0;

/**
 * The X/Z range of each individual boid cloud.
 */
export const CLOUD_XZ_RANGE = 25;

/**
 * The Y range of each individual boid cloud.
 */
export const CLOUD_Y_RANGE = CLOUD_XZ_RANGE / 2;

/**
 * The number of boid clouds that should be rendered.
 */
export const CLOUD_COUNT = 6;

/**
 * Maps individual boid cloud indices to their oscillation period, in seconds.
 * Will contain at least as many elements as {@see CLOUD_COUNT}.
 */
export const CLOUD_PERIOD_SECONDS: number[] = [8, 13, 21, 34, 55, 89, 144];