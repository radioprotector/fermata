/**
 * Describes the message that is sent to initialize the worker.
 */
export interface initMessageToWorker {
  type: 'init';

  periodSeconds: number;

  initialPositions: Float32Array[];

  bounds: Float32Array;
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

  variances: Float32Array;

  positions: Float32Array[]; 
}