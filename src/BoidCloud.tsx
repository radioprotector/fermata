import { useRef, useMemo, useEffect } from "react";
import { TetrahedronGeometry, InstancedMesh, MathUtils, MeshBasicMaterial, Object3D, Vector3, Color, AxesHelper, Group, WireframeGeometry, BoxGeometry } from "three";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";

import { CloudAudioChain } from "./ToneManager";
import { initMessageToWorker, readyMessageToWorker, resultMessageFromWorker } from "./workerInterface";

export interface BoidCloudProps {
  cloudSize: number;

  periodSeconds: number;

  bounds: Vector3;

  baseColor: Color;

  audioChain: CloudAudioChain;
};

function BoidCloud(props: BoidCloudProps): JSX.Element {
  const cloudGroupRef = useRef<Group>(null!);
  const instMeshRef = useRef<InstancedMesh>(null!);
  const debugTextRef = useRef<Text>(null);
  const axesHelperRef = useRef<AxesHelper>(null);
  const dummyObject = useMemo(() => new Object3D(), []);
  const dummyColor = useMemo(() => new Color(), []);

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
    const degOffset = MathUtils.randInt(0, 359);
    const minXDispersal = props.bounds.x * 0.4;
    const minZDispersal = props.bounds.z * 0.4;

    for(let boidIdx = 0; boidIdx < props.cloudSize; boidIdx++) {
      // Generate a position for the boid. Arrange them circularly around the y-axis, arranging from top-to-bottom
      const boidPosition = new Float32Array(3);
      const boidRad = MathUtils.degToRad((boidIdx * 30) + degOffset );
      boidPosition[0] = minXDispersal + MathUtils.randFloatSpread((props.bounds.x / 1.5) * Math.cos(boidRad));
      boidPosition[1] = MathUtils.mapLinear(boidIdx, 0, props.cloudSize, -props.bounds.y, props.bounds.y);
      boidPosition[2] = minZDispersal + MathUtils.randFloatSpread((props.bounds.z / 1.5) * Math.sin(boidRad));

      initPositions.push(boidPosition);
      initTransferObjects.push(boidPosition.buffer);
    }

    const initMessage: initMessageToWorker = {
      type: 'init',
      periodSeconds: props.periodSeconds,
      bounds: new Float32Array(props.bounds.toArray()),
      initialPositions: initPositions,
      maximumVelocity: 0.05,
      attractionRepulsionBias: -0.5,
      attractionRepulsionIntensity: 0.025,
      revertIntensity: 0.0,
      distancingThreshold: 0.05,
      matchingVelocityIntensity: 0.01, // Should be less than the attraction/repulsion intensity
      boundingReturnIntensity: 0.20
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

        // Update positions on all of the boids
        for(let boidIdx = 0; boidIdx < props.cloudSize; boidIdx++) {
          const boidPosition = lastWorkerResult.current.positions[boidIdx];
          dummyObject.position.set(boidPosition[0], boidPosition[1], boidPosition[2]);

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
          const deviationPercentage = ((cloudMeanX / props.bounds.x) + (cloudMeanY / props.bounds.y) + (cloudMeanZ / props.bounds.z)) / 6;

          props.audioChain.crossFade.fade.rampTo(MathUtils.clamp(1 - deviationPercentage, 0, 1), MUSIC_SECONDS);

          // The higher the standard deviation is, the more "dispersal" we have, which increases the intensity of the effect.
          const dispersalPercentage = (Math.abs(cloudStdevX / props.bounds.x) +
            Math.abs(cloudStdevY / props.bounds.y) +
            Math.abs(cloudStdevZ / props.bounds.z)) / 3;

          props.audioChain.effect.wet.rampTo(MathUtils.clamp(dispersalPercentage, 0, 1), MUSIC_SECONDS);

          // Indicate when the music was updated
          lastMusicTime.current = state.clock.elapsedTime;
        }

        // Update debug contents if we have them
        if (process.env.NODE_ENV !== 'production') {
          // Update debug text
          if (debugTextRef.current !== null) {
            // HACK: Work around typing problem with drei's Text component 
            (debugTextRef.current as any).text = `µ: (${cloudMeanX.toFixed(1)}, ${cloudMeanY.toFixed(1)}, ${cloudMeanZ.toFixed(1)})\n` +
              `s: (${cloudStdevX.toFixed(1)}, ${cloudStdevY.toFixed(1)}, ${cloudStdevZ.toFixed(1)})\n` +
              `f: ${(lastWorkerResult.current.attractionRepulsionFactor * 100).toFixed(1)} %`;
          }
          
          // Orient the axes helper on the center of the boids and scale it by the stdev for each of the different axes
          if (axesHelperRef.current !== null) {
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
        <lineSegments>
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
          visible={true}
          font="sans-serif"
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
