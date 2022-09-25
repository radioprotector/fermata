import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, Color, Group, MathUtils, Vector3 } from 'three';
import { OrbitControls } from '@react-three/drei';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import * as cst from './constants';

import ToneManager from './ToneManager';
import BoidCloud from './BoidCloud';
import { initMessageToWorker, readyMessageToWorker, resetMessageToWorker, resultMessageFromWorker } from './workerInterface';
import { useFermataStore } from './fermataState';

/**
 * The properties required by a {@see BoidCloudContainer}.
 */
export interface BoidCloudContainerProps {
  toneManager: ToneManager
}

/**
 * The radius used to distribute each of the different boid clouds around the center.
 */
const cloudDistributionRadius = cst.OVERALL_XZ_RANGE + cst.OVERALL_XZ_INNER_RADIUS;

const cloudsInnerBounds = new Vector3(
  (cst.OVERALL_XZ_INNER_RADIUS * 1.25) + (cst.CLOUD_XZ_RANGE),
  (cst.OVERALL_XZ_INNER_RADIUS * 1.25) + (cst.CLOUD_Y_RANGE),
  (cst.OVERALL_XZ_INNER_RADIUS * 1.25) + (cst.CLOUD_XZ_RANGE));

function BoidCloudContainer(props: BoidCloudContainerProps): JSX.Element {
  // Create groups that contain BoidCloud elements, so we can individually control their position
  const cloudGroups = useRef<Group[]>([]);
  const cloudContainerElements =
    [0, 1, 2, 3, 4, 5].map((cloudIndex) => {
      const cloudBaseColor = new Color();
      cloudBaseColor.setHSL(cloudIndex / cst.CLOUD_COUNT, 0.6, 0.3);

      const cloudRad = MathUtils.degToRad(MathUtils.mapLinear(cloudIndex, 0, cst.CLOUD_COUNT, 0, 360));

      return <group
        key={cloudIndex}
        ref={(grp: Group) => cloudGroups.current[cloudIndex] = grp}
        position={[Math.cos(cloudRad) * cloudDistributionRadius, cst.OVERALL_Y_RANGE, Math.sin(cloudRad) * cloudDistributionRadius]}
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

// Track when we last updated the cloud positions/music
const lastRenderTime = useRef(0);
const lastMusicTime = useRef(0);
const FRAME_SECONDS = 1/30;
const MUSIC_SECONDS = 1/10;

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
    maximumVelocity: 0.0025,
    attractionRepulsionBias: 0,
    attractionRepulsionIntensity: 0.0025,
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

  // When a reset event has been initiated in state, we want to notify the worker
  useEffect(() => {
    const notifyWorker = (): void => {
      if (groupsWorker.current !== null) {
        const resetMessage: resetMessageToWorker = {
          type: 'reset'
        };

        groupsWorker.current.postMessage(resetMessage);
      }
    };

    return useFermataStore.subscribe((state) => state.lastResetTime, notifyWorker);
  }, []);

// Store a reference to orbit controls
const orbitControlsRef = useRef<OrbitControlsImpl>(null!);
const initialOrbitRotateSpeed = useFermataStore.getState().rotationSpeed;

useFrame((state) => {
  // Ensure orbit controls reflect state
  orbitControlsRef.current.autoRotateSpeed = useFermataStore.getState().rotationSpeed;

  // See if it is time to update the boid cloud positions
  if (state.clock.elapsedTime > lastRenderTime.current + FRAME_SECONDS) {
    // Make sure we have a result
    if (lastWorkerResult.current !== null) {
      // Update positions on all of the boid groups
      for(let boidGroupIdx = 0; boidGroupIdx < cst.CLOUD_COUNT; boidGroupIdx++) {
        const groupObject = cloudGroups.current[boidGroupIdx];
        const newPosition = lastWorkerResult.current.positions[boidGroupIdx];

        groupObject.position.set(newPosition[0], newPosition[1], newPosition[2]);
      }

      if (props.toneManager !== null && props.toneManager.cloudChains.length > 0 && state.clock.elapsedTime > lastMusicTime.current + MUSIC_SECONDS) {
        // As individual clouds get closer to the center (i.e. have a shorter position vector length), increase the volume
        const farVolumeDb = -55;
        const closeVolumeDb = -20;
        const farVolumeRadiusSq = Math.pow(cloudDistributionRadius * 1.25, 2);
        const closeVolumeRadiusSq = Math.pow(cloudDistributionRadius * 0.75, 2);

        for(let boidGroupIdx = 0; boidGroupIdx < cst.CLOUD_COUNT; boidGroupIdx++) {
          const groupObject = cloudGroups.current[boidGroupIdx];
          const cloudVolumeRadiusSq = MathUtils.clamp(groupObject.position.lengthSq(), closeVolumeRadiusSq, farVolumeRadiusSq);
          
          props.toneManager.cloudChains[boidGroupIdx].volume.volume.value = MathUtils.mapLinear(cloudVolumeRadiusSq, farVolumeRadiusSq, closeVolumeRadiusSq, farVolumeDb, closeVolumeDb);
        }

        // Indicate when the music was updated
        lastMusicTime.current = state.clock.elapsedTime;
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
      {/* Track orbit controls in this element so we can update them via useFrame */}
      <OrbitControls
        ref={orbitControlsRef}
        enablePan={true}
        enableRotate={true}
        enableZoom={true}
        autoRotate={true}
        autoRotateSpeed={initialOrbitRotateSpeed}
      />
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
