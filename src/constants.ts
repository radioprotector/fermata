import { Note } from 'tone/build/esm/core/type/NoteUnits';

/**
 * The X/Z range of the overall collection of clouds.
 */
export const OVERALL_XZ_RANGE = 80;

/**
 * The Y range of the overall collection of clouds.
 */
export const OVERALL_Y_RANGE = 5;

/**
 * The inner radius of the overall collection of clouds.
 * Used to further spread out the collection from the center without impacting the bounds.
 */
export const OVERALL_XZ_INNER_RADIUS = 5;

/**
 * The X/Z range of each individual boid cloud.
 */
export const CLOUD_XZ_RANGE = 70;

/**
 * The Y range of each individual boid cloud.
 */
export const CLOUD_Y_RANGE = CLOUD_XZ_RANGE / 1.5;

/**
 * The number of boid clouds that should be rendered.
 */
export const CLOUD_COUNT = 6;

/**
 * The number of points in each cloud.
 */
export const CLOUD_POINT_SIZE = 40;

/**
 * Maps individual boid cloud indices to their oscillation period, in seconds.
 * Will contain at least as many elements as {@see CLOUD_COUNT}.
 */
// export const CLOUD_PERIOD_SECONDS: number[] = [3, 5, 8, 13, 21, 34, 55, 89, 144];
export const CLOUD_PERIOD_SECONDS: number[] = [11, 13, 17, 23, 29, 31, 37];

/**
 * Maps individual boid cloud indices to their base notes.
 * Will contain at least as many elements as {@see CLOUD_COUNT}.
 */
export const CLOUD_BASE_NOTES: Note[] = ['G5', 'C4', 'G3', 'C2', 'C1', 'C0'];