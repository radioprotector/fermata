/**
 * Describes the message that is sent to initialize the worker.
 */
export interface initMessageToWorker {
  type: 'init';

  /**
   * The period, in seconds, over which to oscillate.
   */
  periodSeconds: number;

  initialPositions: Float32Array[];

  /**
   * Describes the maximum bounds within which fluctuations are allowed.
   */
  bounds: Float32Array;

  /**
   * The maximum velocity to allow, as a 0.0-1.0 percentage of bounds.
   */
  maximumVelocity: number;

  /**
   * The bias to apply for the attraction/repulsion factor, which normally oscillates between -1 (repulsion), and 1 (attraction).
   */
  attractionRepulsionBias: number;

  /**
   * The intensity of the attraction/repulsion velocity, as a 0.0-1.0 percentage.
   */
  attractionRepulsionIntensity: number;

  /**
   * The threshold for the distancing effect, as a 0.0-1.0 percentage of length.
   */
  distancingThreshold: number;

  /**
   * The intensity of the "matching" velocity, as a 0.0-1.0 percentage.
   */
  matchingVelocityIntensity: number;

  /**
   * The intensity of the "return" velocity, as a 0.0-1.0 percentage.
   */
  boundingReturnIntensity: number;
}

/**
 * Describes the message that is sent to tell the worker that it is ready to process another frame.
 */
 export interface readyMessageToWorker {
  type: 'ready';
}

/**
 * Describes the message that is received from the worker when positions have been updated.
 */
export interface resultMessageFromWorker {
  type: 'result';

  means: Float32Array;

  stdevs: Float32Array;

  positions: Float32Array[]; 
}