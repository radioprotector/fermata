import { useRef, useEffect } from "react";
import { TetrahedronGeometry, InstancedMesh, MathUtils, MeshBasicMaterial, Object3D, Vector3, Color, AxesHelper, Group, BoxGeometry } from "three";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";

import { CloudAudioChain } from "./ToneManager";
import { initMessageToWorker, readyMessageToWorker, resultMessageFromWorker } from "./workerInterface";

/**
 * The properties required by a {@see BoidCloud}.
 */
export interface BoidCloudProps {
  cloudSize: number;

  periodSeconds: number;

  bounds: Vector3;

  baseColor: Color;

  audioChain: CloudAudioChain;
};

/**
 * Scratch object used for calculating instanced mesh position/rotation matrices.
 */
const dummyObject = new Object3D();

/**
 * Scratch object used for calculating instanced mesh colors.
 */
const dummyColor = new Color();

function BoidCloud(props: BoidCloudProps): JSX.Element {
  const cloudGroupRef = useRef<Group>(null!);
  const instMeshRef = useRef<InstancedMesh>(null!);
  const debugTextRef = useRef<Text>(null);
  const axesHelperRef = useRef<AxesHelper>(null);

  // Track when we last updated the geometry/music
  const lastRenderTime = useRef(0);
  const lastMusicTime = useRef(0);
  const FRAME_SECONDS = 1/30;
  const MUSIC_SECONDS = 1/10;

  // Create a web worker to handle the boid processing
  const lastWorkerResult = useRef<resultMessageFromWorker | null>(null);
  const worker = useRef<Worker>(null!);

  useEffect(() => {
    // Create a handler
    const messageHandler = (e: MessageEvent) => {
      if (e.data && e.data.type === 'result') {
        lastWorkerResult.current = e.data;
      }
    };

    const errorHandler = (e: ErrorEvent) => {
      console.error('web worker error', e);
    };

    // Create the web worker and handlers
    worker.current = new Worker(new URL('./boidsWorker.js', import.meta.url));
    worker.current.onmessage = messageHandler;
    worker.current.onerror = errorHandler;

    // Initialize the worker state
    const initPositions: Float32Array[] = [];
    const initTransferObjects = [];
    const dummyVector = new Vector3();

    for(let boidIdx = 0; boidIdx < props.cloudSize; boidIdx++) {
      const boidPosition = new Float32Array(3);

      // Randomize the vector
      dummyVector.randomDirection();
      dummyVector.setX(dummyVector.x * (props.bounds.x / 1.5));
      dummyVector.setY(dummyVector.y * (props.bounds.y / 1.5));
      dummyVector.setZ(dummyVector.z * (props.bounds.z / 1.5));
      boidPosition[0] = dummyVector.x;
      boidPosition[1] = dummyVector.y;
      boidPosition[2] = dummyVector.z;

      initPositions.push(boidPosition);
      initTransferObjects.push(boidPosition.buffer);
    }

    const initMessage: initMessageToWorker = {
      type: 'init',
      periodSeconds: props.periodSeconds,
      bounds: new Float32Array(props.bounds.toArray()),
      innerBounds: new Float32Array([0, 0, 0]),
      initialPositions: initPositions,
      maximumVelocity: 0.02,
      attractionRepulsionBias: 0,
      attractionRepulsionIntensity: 0.005, // Move boids 0.5% towards the center of mass with each update
      revertIntensity: 0,
      distancingThreshold: 0.005,
      matchingVelocityIntensity: 0.03, // Incorporate 3% of other boids' velocities into this
      boundingReturnIntensity: 0.1
    };

    worker.current.postMessage(initMessage, initTransferObjects);

    // Reset the last result
    lastWorkerResult.current = null;

    // Tell the worker to start generating data
    const readyMessage: readyMessageToWorker = {
      type: 'ready'
    };

    worker.current.postMessage(readyMessage);

    // Clean up events and terminate the worker
    return () => {
      worker.current.removeEventListener('message', messageHandler);
      worker.current.removeEventListener('error', errorHandler);
      worker.current.terminate();
      lastWorkerResult.current = null;
    }
  }, [props.periodSeconds, props.bounds, props.cloudSize]);

  useFrame((state) => {
    // See if it's time to update the buffers
    if (state.clock.elapsedTime > lastRenderTime.current + FRAME_SECONDS) {
      // Make sure we have a result
      if (lastWorkerResult.current !== null) {
        const cloudMeanX = lastWorkerResult.current.means[0];
        const cloudMeanY = lastWorkerResult.current.means[1];
        const cloudMeanZ = lastWorkerResult.current.means[2];
        const cloudStdevX = lastWorkerResult.current.stdevs[0];
        const cloudStdevY = lastWorkerResult.current.stdevs[1];
        const cloudStdevZ = lastWorkerResult.current.stdevs[2];

        const rotationClockPercentage = state.clock.getElapsedTime() / (0.5 * props.periodSeconds);
        const rotationClockAmount1 = Math.cos(rotationClockPercentage * 2 * Math.PI);
        const rotationClockAmount2 = Math.sin(rotationClockPercentage * 2 * Math.PI);

        // Update positions on all of the boids
        for(let boidIdx = 0; boidIdx < props.cloudSize; boidIdx++) {
          const boidPosition = lastWorkerResult.current.positions[boidIdx];
          dummyObject.position.set(boidPosition[0], boidPosition[1], boidPosition[2]);
          dummyObject.rotation.set(0, rotationClockAmount1 - boidIdx, rotationClockAmount2 + boidIdx);

          dummyObject.updateMatrix();
          
          instMeshRef.current.setMatrixAt(boidIdx, dummyObject.matrix);

          // Calculate the z-stat of the boid position in each axis, converting to an absolute value and capping "extremes".
          const Z_MAX = 1.5;
          const zStatX = Math.min(Math.abs((boidPosition[0] - cloudMeanX) / cloudStdevX), Z_MAX);
          const zStatY = Math.min(Math.abs((boidPosition[1] - cloudMeanY) / cloudStdevY), Z_MAX);
          const zStatZ = Math.min(Math.abs((boidPosition[2] - cloudMeanZ) / cloudStdevZ), Z_MAX);

          // Further darken the color based on its distance from the center of mass
          dummyColor.setRGB(
            MathUtils.mapLinear(zStatX, 0.0, Z_MAX, props.baseColor.r, 1.0),
            MathUtils.mapLinear(zStatY, 0.0, Z_MAX, props.baseColor.g, 1.0),
            MathUtils.mapLinear(zStatZ, 0.0, Z_MAX, props.baseColor.b, 1.0)
          );

          instMeshRef.current.setColorAt(boidIdx, dummyColor);
        }

        instMeshRef.current.instanceMatrix.needsUpdate = true;
        instMeshRef.current.instanceColor!.needsUpdate = true;

        // Update the cloud audio chain if we have one
        if (props.audioChain != null && state.clock.elapsedTime > lastMusicTime.current + MUSIC_SECONDS) {
          // The closer the mean values are to 0, the more "accuracy" we have, which increases the prominence of the chords (the second input in the crossfade)
          const deviationPercentage =  (MathUtils.mapLinear(Math.abs(cloudMeanX), 0, props.bounds.x / 2, 0, 1) +
            MathUtils.mapLinear(Math.abs(cloudMeanY), 0, props.bounds.y / 2, 0, 1) +
            MathUtils.mapLinear(Math.abs(cloudMeanZ), 0, props.bounds.z / 2, 0, 1)) / 3;

          props.audioChain.crossFade.fade.value = MathUtils.clamp(1 - deviationPercentage, 0, 1);

          // // The higher the standard deviation is, the more "dispersal" we have, which impacts the intensity of the effect.
          const dispersalPercentage = (MathUtils.mapLinear(cloudStdevX, 0, props.bounds.x, 0, 1) +
            MathUtils.mapLinear(cloudStdevY, 0, props.bounds.y, 0, 1) +
            MathUtils.mapLinear(cloudStdevZ, 0, props.bounds.z, 0, 1)) / 3;

          props.audioChain.effect.wet.value = MathUtils.clamp(1 - dispersalPercentage, 0, 1);

          // Indicate when the music was updated
          lastMusicTime.current = state.clock.elapsedTime;
        }

        // Update debug contents if we have them
        if (process.env.NODE_ENV !== 'production') {
          // Update debug text
          // HACK: Work around typing problems with drei's Text component 
          if (debugTextRef.current !== null && (debugTextRef.current as any).visible) {
            const volumeDbStr = props.audioChain.volume.volume.value.toFixed(0);
            const chordPercentageStr = (props.audioChain.crossFade.fade.value * 100).toFixed(0);
            const fxPercentageStr = (props.audioChain.effect.wet.value * 100).toFixed(0);
            const clockPercentageStr = (lastWorkerResult.current.clockPercentage * 100).toFixed(0);
            const attractionRepulsionStr = lastWorkerResult.current.attractionRepulsionFactor.toFixed(1);

            (debugTextRef.current as any).text = `${props.audioChain.baseNote} ${props.audioChain.waveformType} ${volumeDbStr}dB\n` + 
              `µ: (${cloudMeanX.toFixed(1)}, ${cloudMeanY.toFixed(1)}, ${cloudMeanZ.toFixed(1)}) - ${chordPercentageStr}% chord\n` +
              `s: (${cloudStdevX.toFixed(1)}, ${cloudStdevY.toFixed(1)}, ${cloudStdevZ.toFixed(1)}) - ${fxPercentageStr}% fx\n` +
              `c: ${attractionRepulsionStr} - ${clockPercentageStr}% clock`;
          }
          
          // Orient the axes helper on the center of the boids and scale it by the stdev for each of the different axes
          if (axesHelperRef.current !== null && axesHelperRef.current.visible) {
            axesHelperRef.current.position.set(cloudMeanX, cloudMeanY, cloudMeanZ);
            axesHelperRef.current.scale.set(cloudStdevX, cloudStdevY, cloudStdevZ);
          }
        }

        // Clear the last worker result
        lastWorkerResult.current = null;

        // Signal that we're ready for another result to process
        const readyMessage: readyMessageToWorker = { type: 'ready' };
        worker.current.postMessage(readyMessage);

        // Ensure that the instanced mesh is visible
        instMeshRef.current.visible = true;

        // Indicate when we last rendered
        lastRenderTime.current = state.clock.elapsedTime;
      }
    }
  });

  return (
    <group
      ref={cloudGroupRef}>
      <instancedMesh
        ref={instMeshRef}
        args={[new TetrahedronGeometry(1), new MeshBasicMaterial({ color: props.baseColor }), props.cloudSize]}
        visible={false}
      />
      {
        /* Only include bounding box in development */
        process.env.NODE_ENV !== 'production'
        &&
        <lineSegments
          visible={false}>
          <wireframeGeometry args={[new BoxGeometry(props.bounds.x * 2, props.bounds.y * 2, props.bounds.z * 2)]} />
          <lineBasicMaterial
            color={props.baseColor}
            depthTest={false}
            transparent={true}
          />
        </lineSegments>
      }
      {
        /* Only include debug text in development */
        process.env.NODE_ENV !== 'production'
        &&
        <Text
          ref={debugTextRef}
          visible={false}
          fontSize={4}
          color={0xffffff}
          anchorX="center"
          anchorY="middle"
        >
        </Text>
      }
      {
        /* Only include axes in development */
        process.env.NODE_ENV !== 'production'
        &&
        <axesHelper
          ref={axesHelperRef}
          visible={false}
          />
      }
    </group>
  );
}

export default BoidCloud;
