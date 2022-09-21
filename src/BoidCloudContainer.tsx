import {  useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Group, MathUtils, Vector3 } from 'three';

import BoidCloud from './BoidCloud';
import { initMessageToWorker, readyMessageToWorker, resultMessageFromWorker } from './workerInterface';

const OVERALL_RADIUS = 60;
const CLOUD_RADIUS = 25;
const CLOUD_COUNT = 6;
const CLOUD_PERIODS: number[] = [8, 13, 21, 34, 55, 89, 144];

function BoidCloudContainer(): JSX.Element {
  // Create groups that contain BoidCloud elements, so we can individually control their position
  const cloudGroups = useRef<Group[]>([]);
  const cloudContainerElements =
    [0, 1, 2, 3, 4, 5].map((cloudIndex) => {
      const cloudBaseColor = new Color();
      cloudBaseColor.setHSL(cloudIndex / CLOUD_COUNT, 0.5, 0.4);

      const cloudRad = MathUtils.degToRad(MathUtils.mapLinear(cloudIndex, 0, CLOUD_COUNT, 0, 360));

      return <group
        key={cloudIndex}
        ref={(grp: Group) => cloudGroups.current[cloudIndex] = grp}
        position={[Math.cos(cloudRad) * OVERALL_RADIUS, 0, Math.sin(cloudRad) * OVERALL_RADIUS]}
      >
        <BoidCloud
          cloudSize={30}
          bounds={new Vector3(CLOUD_RADIUS, CLOUD_RADIUS, CLOUD_RADIUS)}
          periodSeconds={CLOUD_PERIODS[cloudIndex]}
          baseColor={cloudBaseColor}
          />
      </group>
    });

// Track when we last updated the buffers
const lastRenderTime = useRef(0);
const FRAME_SECONDS = 1/30;  

// Create a web worker to handle the boid *group* processing
const lastWorkerResult = useRef<resultMessageFromWorker | null>(null);
const groupsWorker = useRef<Worker>(null!);

useEffect(() => {
  // Create a handler
  const messageHandler = (e: MessageEvent) => {
    if (e.data && e.data.type === 'result') {
      lastWorkerResult.current = e.data;
    }
  };

  const errorHandler = (e: ErrorEvent) => {
    console.error('group web worker error', e);
  };

  // Create the web worker and handlers
  groupsWorker.current = new Worker(new URL('./boidsWorker.js', import.meta.url));
  groupsWorker.current.onmessage = messageHandler;
  groupsWorker.current.onerror = errorHandler;

  // Initialize the worker state based on the positioning of the boid groups
  const initPositions: Float32Array[] = [];
  const initTransferObjects = [];

  for(let boidGroupIdx = 0; boidGroupIdx < CLOUD_COUNT; boidGroupIdx++) {
    const groupObject = cloudGroups.current[boidGroupIdx];

    const groupPosition = new Float32Array(3);
    groupPosition[0] = groupObject.position.x;
    groupPosition[1] = groupObject.position.y;
    groupPosition[2] = groupObject.position.z;

    initPositions.push(groupPosition);
    initTransferObjects.push(groupPosition.buffer);
  }

  // Unlike the individual clouds, we want to use a very slow position, don't vary the y-value much, and use the broad radius
  const initMessage: initMessageToWorker = {
    type: 'init',
    periodSeconds: CLOUD_PERIODS[CLOUD_PERIODS.length - 1],
    bounds: new Float32Array([OVERALL_RADIUS, 0, OVERALL_RADIUS]),
    initialPositions: initPositions,
    maximumVelocity: 0.01,
    attractionRepulsionBias: -0.25,
    attractionRepulsionIntensity: 0.001,
    distancingThreshold: 0.2,
    matchingVelocityIntensity: 0.0,
    boundingReturnIntensity: 0.01
  };

  groupsWorker.current.postMessage(initMessage, initTransferObjects);

  // Reset the last result
  lastWorkerResult.current = null;

  // Tell the worker to start generating data
  const readyMessage: readyMessageToWorker = {
    type: 'ready'
  };

  groupsWorker.current.postMessage(readyMessage);

  // Clean up events and terminate the worker
  return () => {
    groupsWorker.current.removeEventListener('message', messageHandler);
    groupsWorker.current.removeEventListener('error', errorHandler);
    groupsWorker.current.terminate();
    lastWorkerResult.current = null;
  }
}, []);

useFrame((state) => {
  if (state.clock.elapsedTime > lastRenderTime.current + FRAME_SECONDS) {
    // Make sure we have a result
    if (lastWorkerResult.current !== null) {
      // Update positions on all of the boid groups
      for(let boidGroupIdx = 0; boidGroupIdx < CLOUD_COUNT; boidGroupIdx++) {
        const groupObject = cloudGroups.current[boidGroupIdx];
        const newPosition = lastWorkerResult.current.positions[boidGroupIdx];

        groupObject.position.set(newPosition[0], newPosition[1], newPosition[2]);
      }

      // Clear the last worker result
      lastWorkerResult.current = null;

      // Signal that we're ready for another result to process
      const readyMessage: readyMessageToWorker = { type: 'ready' };
      groupsWorker.current.postMessage(readyMessage);

      // Indicate when we last rendered
      lastRenderTime.current = state.clock.elapsedTime;
    }
  }
});

  return (
    <group>
      {cloudContainerElements}
    </group>
  );
}

export default BoidCloudContainer;
