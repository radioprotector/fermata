import { Note } from 'tone/build/esm/core/type/NoteUnits';
import { NonCustomOscillatorType } from 'tone/build/esm/source/oscillator/OscillatorInterface';

/**
 * The X/Z range of the overall collection of clouds.
 */
export const OVERALL_XZ_RANGE = 100;

/**
 * The Y range of the overall collection of clouds.
 */
export const OVERALL_Y_RANGE = 0.5;

/**
 * The inner radius of the overall collection of clouds.
 * Used to further spread out the collection from the center without impacting the bounds.
 */
export const OVERALL_XZ_INNER_RADIUS = 20;

/**
 * The X/Z range of each individual boid cloud.
 */
export const CLOUD_XZ_RANGE = 50;

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
export const CLOUD_POINT_SIZE = 100;

/**
 * Maps individual boid cloud indices to their oscillation period, in seconds.
 * Will contain at least as many elements as {@see CLOUD_COUNT}.
 */
// export const CLOUD_PERIOD_SECONDS: number[] = [3, 5, 8, 13, 21, 34, 55, 89, 144];
export const CLOUD_PERIOD_SECONDS: number[] = [11, 13, 17, 23, 29, 31, 37];

/**
 * The oscillation period for the overall cloud, in seconds.
 */
export const OVERALL_PERIOD_SECONDS: number = 89;

/**
 * Maps individual boid cloud indices to their base notes.
 * Will contain at least as many elements as {@see CLOUD_COUNT}.
 */
export const CLOUD_BASE_NOTES: Note[] = ['C5', 'G5', 'C4', 'G3', 'C2', 'C1'];

/**
 * Maps individual boid cloud indices to their underlying instruments.
 * Will contain at least as many elements as {@see CLOUD_COUNT}.
 */
export const CLOUD_OSCILLATORS: NonCustomOscillatorType[] = ['sine', 'sawtooth', 'triangle', 'sine', 'sawtooth', 'triangle'];