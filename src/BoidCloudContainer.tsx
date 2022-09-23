import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, Color, Group, MathUtils, Vector3 } from 'three';

import * as cst from './constants';

import ToneManager from './ToneManager';
import BoidCloud from './BoidCloud';
import { initMessageToWorker, readyMessageToWorker, resultMessageFromWorker } from './workerInterface';

export interface BoidCloudContainerProps {
  toneManager: ToneManager
}

const cloudsInnerBounds = new Vector3(
  cst.OVERALL_XZ_INNER_RADIUS + (cst.CLOUD_XZ_RANGE * 1.1),
  cst.OVERALL_XZ_INNER_RADIUS + (cst.CLOUD_Y_RANGE * 1.1),
  cst.OVERALL_XZ_INNER_RADIUS + (cst.CLOUD_XZ_RANGE * 1.1));

function BoidCloudContainer(props: BoidCloudContainerProps): JSX.Element {
  // Create groups that contain BoidCloud elements, so we can individually control their position
  const cloudGroups = useRef<Group[]>([]);
  const cloudContainerElements =
    [0, 1, 2, 3, 4, 5].map((cloudIndex) => {
      const cloudBaseColor = new Color();
      cloudBaseColor.setHSL(cloudIndex / cst.CLOUD_COUNT, 0.6, 0.3);

      const cloudRad = MathUtils.degToRad(MathUtils.mapLinear(cloudIndex, 0, cst.CLOUD_COUNT, 0, 360));
      const distributionRadius = cst.OVERALL_XZ_RANGE + cst.OVERALL_XZ_INNER_RADIUS;

      return <group
        key={cloudIndex}
        ref={(grp: Group) => cloudGroups.current[cloudIndex] = grp}
        position={[Math.cos(cloudRad) * distributionRadius, cst.OVERALL_Y_RANGE, Math.sin(cloudRad) * distributionRadius]}
      >
        <BoidCloud
          cloudSize={cst.CLOUD_POINT_SIZE}
          bounds={new Vector3(cst.CLOUD_XZ_RANGE, cst.CLOUD_Y_RANGE / 2, cst.CLOUD_XZ_RANGE)}
          periodSeconds={cst.CLOUD_PERIOD_SECONDS[cloudIndex]}
          baseColor={cloudBaseColor}
          audioChain={props.toneManager.cloudChains[cloudIndex]}
          />
      </group>
    });

// Track when we last updated the cloud positions
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

  for(let boidGroupIdx = 0; boidGroupIdx < cst.CLOUD_COUNT; boidGroupIdx++) {
    const groupObject = cloudGroups.current[boidGroupIdx];

    const groupPosition = new Float32Array(3);
    groupPosition[0] = groupObject.position.x;
    groupPosition[1] = groupObject.position.y;
    groupPosition[2] = groupObject.position.z;

    initPositions.push(groupPosition);
    initTransferObjects.push(groupPosition.buffer);
  }

  const initMessage: initMessageToWorker = {
    type: 'init',
    periodSeconds: cst.OVERALL_PERIOD_SECONDS,
    bounds: new Float32Array([cst.OVERALL_XZ_RANGE, cst.OVERALL_Y_RANGE, cst.OVERALL_XZ_RANGE]),
    innerBounds: new Float32Array([cloudsInnerBounds.x, cloudsInnerBounds.y, cloudsInnerBounds.z]),
    initialPositions: initPositions,
    maximumVelocity: 0.005,
    attractionRepulsionBias: 0,
    attractionRepulsionIntensity: 0.001,
    revertIntensity: 0.001,
    distancingThreshold: 0.005,
    matchingVelocityIntensity: 0.005,
    boundingReturnIntensity: 0.1
    // maximumVelocity: 0,
    // attractionRepulsionBias: 0,
    // attractionRepulsionIntensity: 0,
    // revertIntensity: 0,
    // distancingThreshold: 0,
    // matchingVelocityIntensity: 0,
    // boundingReturnIntensity: 0
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
      for(let boidGroupIdx = 0; boidGroupIdx < cst.CLOUD_COUNT; boidGroupIdx++) {
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
      {
        /* Only include cloud inner bounds in development */
        process.env.NODE_ENV !== 'production'
        &&
        <lineSegments
          visible={false}>
          <wireframeGeometry args={[new BoxGeometry(cloudsInnerBounds.x * 2, cloudsInnerBounds.y * 2, cloudsInnerBounds.z * 2)]} />
          <lineBasicMaterial
            color={0xffffff}
            depthTest={false}
            depthWrite={false}
            transparent={true}
          />
        </lineSegments>
      }
    </group>
  );
}

export default BoidCloudContainer;
