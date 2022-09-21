import { Clock, Vector3 } from "three";

const state = {
  /**
   * The clock to use for determining periodic amounts.
   * @type {Clock}
   */
  clock: null,

  /**
   * The time period, in seconds, over which to vary behavior.
   * @type {Number}
   */
  periodSeconds: 1.0,

  /**
   * The offset to use for the time period.
   * @type {Number}
   */
   periodOffset: 0.0,

  /**
   * The maximum bounds of the collection.
   * @type {Vector3}
   */
  bounds: null,

  /**
   * The length of the bounds.
   * @type {Number}
   */
  boundsLengthSquared: 1.0,

  /**
   * The upper clamp value to apply to the velocity.
   * @type {Vector3}
   */
  velocityUpperClamp: null,

   /**
    * The lower clamp value to apply to the velocity.
    * @type {Vector3}
    */
  velocityLowerClamp: null, 
  
  /**
   * The totaled center of the boids.
   * @type {Vector3}
   */
  totaledCenter: null,

  /**
   * The totaled velocity of the boids.
   * @type {Vector3}
   */
  totaledVelocity: null,

  /**
   * The number of boids being tracked.
   * @type {Number}
   */
  length: 0,

  /**
   * An array of boid positions.
   * @type {Array<Vector3>}
   */
  positions: [],

  /**
   * An array of boid velocities.
   * @type {Array<Vector3>}
   */
  velocities: []
}

const fns = {};

fns.handleInit = function(data) {
  // Create a clock
  state.clock = new Clock();
  state.periodSeconds = data.periodSeconds;
  state.periodOffset = MathUtils.randFloat(0, state.periodSeconds);

  // Copy over the bounds array
  state.bounds = new Vector3(data.bounds[0], data.bounds[1], data.bounds[2]);
  state.boundsLengthSquared = state.bounds.lengthSq();

  // Calculate clamping for velocities
  state.velocityUpperClamp = state.bounds.clone().multiplyScalar(0.1);
  state.velocityLowerClamp = state.bounds.clone().multiplyScalar(-0.1);

  // Determine the number of boids
  state.length = initialPositions.length;

  if (state.length < 2) {
    throw Error('At least two boids must be provided!');
  }

  // Track totals for the center and velocity
  state.totaledCenter = new Vector3();
  state.totaledVelocity = new Vector3();

  // Create positions/velocities
  for (const positionArray of initialPositions) {
    const positionVector = new Vector3(positionArray[0], positionArray[1], positionArray[2]);

    state.positions.push(positionVector);
    state.totaledCenter.add(positionVector);

    // Don't assign any velocities for now
    state.velocities.push(new Vector3());
  }
};

/**
 * Gets a velocity vector to congregate the boid on the center of mass.
 * @param {Number} boidIdx The index of the boid.
 * @returns {Vector3} The velocity vector to apply for centering.
 */
fns.getCenteringVector = function(boidIdx) {
  const CENTERING_INTENSITY = 0.05;
  const currentPosition = state.positions[boidIdx];

  // Calculate the perceived center by removing the current position and turning it into an average
  const perceivedCenter = state.totaledCenter.clone();
  perceivedCenter.sub(currentPosition);
  perceivedCenter.divideScalar(state.length - 1);

  // Then multiply that average by a centering factor to determine the intensity of the snapping
  return perceivedCenter.multiplyScalar(CENTERING_INTENSITY);
};

/**
 * Gets a velocity vector to distance the boid from other nearby boids.
 * @param {Number} boidIdx The index of the boid.
 * @returns {Vector3} The velocity vector to apply for distancing from other boids.
 */
fns.getDistancingVector = function(boidIdx) {
  const DISTANCE_THRESHOLD = state.boundsLengthSquared * 0.05;
  const currentPosition = state.positions[boidIdx];
  const distancingResult = new Vector3();

  // Look at all other boids in the flock
  for(let i = 0; i < state.length; i++) {
    if (i === boidIdx) {
      continue;
    }

    // If they are close enough, incorporate the distancing result into the velocity vector
    const otherPosition = state.positions[i];

    if (currentPosition.distanceToSquared(otherPosition) < DISTANCE_THRESHOLD) {
      distancingResult.sub(otherPosition).add(currentPosition);
    }
  }

  return distancingResult;
};

/**
 * Gets a velocity vector to match the velocity of nearby boids.
 * @param {Number} boidIdx The index of the boid.
 * @returns {Vector3} The velocity vector to apply for speed-matching.
 */
fns.getMatchingVector = function(boidIdx) {
  const MATCHING_INTENSITY = 0.1;
  const currentVelocity = state.velocities[boidIdx];

  // Calculate the perceived velocity by removing the current velocity and turning it into an average
  const perceivedVelocity = state.totaledVelocity.clone();
  perceivedVelocity.sub(currentVelocity);
  perceivedVelocity.divideScalar(state.length - 1);

  // Then multiply that average by a matching factor to determine the intensity of the snapping
  return perceivedVelocity.multiplyScalar(MATCHING_INTENSITY);
};

/**
 * Gets a velocity vector to ensure that the boid mainly stays within its bounds.
 * @param {Number} boidIdx The index of the boid.
 * @returns {Vector3} The velocity vector to apply for staying within bounds.
 */
fns.getBoundsVector = function (boidIdx) {
  const RETURN_INTENSITY = 0.1;
  const returnVelocity = new Vector3();
  const currentPosition = state.positions[boidIdx];

  // Snap x-values
  if (currentPosition.x > state.bounds.x) {
    returnVelocity.setX(state.bounds.x * -RETURN_INTENSITY);
  }
  else if (currentPosition.x < -state.bounds.x) {
    returnVelocity.setX(state.bounds.x * RETURN_INTENSITY);
  }
  
  // Snap y-values
  if (currentPosition.y > state.bounds.y) {
    returnVelocity.setY(state.bounds.y * -RETURN_INTENSITY);
  }
  else if (currentPosition.y < -state.bounds.y) {
    returnVelocity.setY(state.bounds.y * RETURN_INTENSITY);
  }

  // Snap z-values
  if (currentPosition.z > state.bounds.z) {
    returnVelocity.setZ(state.bounds.z * -RETURN_INTENSITY);
  }
  else if (currentPosition.z < -state.bounds.z) {
    returnVelocity.setZ(state.bounds.z * RETURN_INTENSITY);
  }

  return returnVelocity;
};

/**
 * Handles when the consumer is ready for another frame by applying move operations.
 */
 fns.handleReady = function() {
  // Determine the attraction/repulsion factor.
  // Get the elapsed time, add the offset, convert to radians, and divide by the period
  const attractionRepulsionFactor = Math.sin(((state.clock.getElapsedTime() + state.periodOffset) * 2 * Math.PI) / state.periodSeconds);

  // Track the new center and velocity
  const newCenterTotal = new Vector3();
  const newVelocityTotal = new Vector3();

  // Handle each boid in turn
  for (let boidIdx = 0; boidIdx < state.length; boidIdx++) {
    const newVelocity = new Vector3();

    // Incorporate rules 1-3 with attraction/repulsion factored in
    newVelocity.add(this.getCenteringVector(boidIdx).multiplyScalar(attractionRepulsionFactor));
    newVelocity.add(this.getDistancingVector(boidIdx).multiplyScalar(attractionRepulsionFactor));
    newVelocity.add(this.getMatchingVector(boidIdx).multiplyScalar(attractionRepulsionFactor));

    // Incorporate bounds checking with no scaling
    newVelocity.add(this.getBoundsVector(boidIdx));

    // Now update the state vectors for the boid, ensuring velocity is clamped
    state.velocities[boidIdx].add(newVelocity).clamp(state.velocityLowerClamp, state.velocityUpperClamp);
    state.positions[boidIdx].add(state.velocities[boidIdx]);

    // Add to the running totals
    state.totaledCenter.add(state.positions[boidIdx]);
    state.totaledVelocity.add(state.velocities[boidIdx]);
  }

  // Update the center/velocity calculations
  state.totaledCenter = newCenterTotal;
  state.totaledVelocity = newVelocityTotal;

  // Now start building the message, setting transferrable buffers, and doing cleanup
  const transferObjects = [];
  const message = {
    type: 'result',
    means: [],
    variances: [],
    positions: []
  };

  // Calculate means in the x, y, and z dimensions
  message.means = [
    state.totaledCenter.x / state.length,
    state.totaledCenter.y / state.length,
    state.totaledCenter.z / state.length
  ];

  // Also track running totals for variance
  let varianceSumX = 0.0;
  let varianceSumY = 0.0;
  let varianceSumZ = 0.0;

  for(let boidIdx = 0; boidIdx < state.length; boidIdx++) {
    const boidPosition = state.positions[boidIdx];

    // Convert the position vector into a float array
    const positionArray = new Float32Array(3);
    positionArray[0] = boidPosition.x;
    positionArray[1] = boidPosition.y;
    positionArray[2] = boidPosition.z;

    // Determine variance totals for this entry
    varianceSumX += Math.pow(positionArray[0] - message.means[0], 2);
    varianceSumY += Math.pow(positionArray[1] - message.means[1], 2);
    varianceSumZ += Math.pow(positionArray[2] - message.means[2], 2);

    // Add the position array as a transferrable object
    message.positions.push(positionArray);
    transferObjects.push(positionArray.buffer);
  }

  // Finish calculating variance
  message.variances = [
    varianceSumX / (state.length - 1),
    varianceSumY / (state.length - 1), 
    varianceSumZ / (state.length - 1)
  ];

  // Post the message
  postMessage(message, transferObjects);
};

onmessage = function(e) {
  switch(e.data.type) {
    case 'init':
      fns.handleInit(e.data);
      break;

    case 'ready':
      fns.handleReady();
      break;

    default:
      console.warn(`unrecognized message type: ${e.data.type}`, e);
  }
};