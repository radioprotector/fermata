import { useRef, useMemo, useEffect } from "react";
import { TetrahedronGeometry, InstancedMesh, MathUtils, MeshBasicMaterial, Object3D, Vector3, Color, AxesHelper, Group } from "three";
import { useFrame } from "@react-three/fiber";

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
  const axesHelperRef = useRef<AxesHelper>(null);
  const dummyObject = useMemo(() => new Object3D(), []);
  const dummyColor = useMemo(() => new Color(), []);

  // Track when we last updated the buffers
  const lastRenderTime = useRef(0);
  const FRAME_SECONDS = 1/30;  

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

    for(let boidIdx = 0; boidIdx < props.cloudSize; boidIdx++) {
      // Generate a position for the boid. Arrange them circularly around the y-axis, arranging from top-to-bottom
      const boidPosition = new Float32Array(3);
      const boidRad = MathUtils.degToRad((boidIdx * 30) + degOffset);
      boidPosition[0] = (props.bounds.x / 2) * Math.cos(boidRad);
      boidPosition[1] = MathUtils.mapLinear(boidIdx, 0, props.cloudSize, -props.bounds.y / 2, props.bounds.y / 2);
      boidPosition[2] = (props.bounds.z / 2) * Math.sin(boidRad);

      initPositions.push(boidPosition);
      initTransferObjects.push(boidPosition.buffer);
    }

    const initMessage: initMessageToWorker = {
      type: 'init',
      periodSeconds: props.periodSeconds,
      bounds: new Float32Array(props.bounds.toArray()),
      initialPositions: initPositions,
      maximumVelocity: 0.05,
      attractionRepulsionBias: 0.35,
      attractionRepulsionIntensity: 0.025,
      revertIntensity: 0.0,
      distancingThreshold: 0.005,
      matchingVelocityIntensity: 0.01,
      boundingReturnIntensity: 0.02
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
        // Update positions on all of the boids
        for(let boidIdx = 0; boidIdx < props.cloudSize; boidIdx++) {
          const boidPosition = lastWorkerResult.current.positions[boidIdx];
          dummyObject.position.set(boidPosition[0], boidPosition[1], boidPosition[2]);

          // Rotate twice as slowly as the period
          const boidRad = (state.clock.elapsedTime * Math.PI) / props.periodSeconds;
          dummyObject.rotation.set(boidRad, 0, boidRad);

          dummyObject.updateMatrix();
          
          instMeshRef.current.setMatrixAt(boidIdx, dummyObject.matrix);

          // Calculate the z-stat of the boid position in each axis, converting to an absolute value and capping "extremes".
          // Because the y-range is limited compared to the other two axes, we're blending it with the X/Z values
          const Z_MAX = 3.0;
          const zStatX = Math.min(Math.abs((boidPosition[0] - lastWorkerResult.current.means[0]) / lastWorkerResult.current.stdevs[0]), Z_MAX);
          const zStatZ = Math.min(Math.abs((boidPosition[2] - lastWorkerResult.current.means[2]) / lastWorkerResult.current.stdevs[2]), Z_MAX);
          let zStatY = Math.min(Math.abs((boidPosition[1] - lastWorkerResult.current.means[1]) / lastWorkerResult.current.stdevs[1]), Z_MAX);
          zStatY = (zStatX + zStatY + zStatZ) / 3.0;

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
        if (props.audioChain != null) {
          // The closer the mean values are to 0, the more "accuracy" we have, which increases the prominence of the chords (the second input in the crossfade)
          const deviationPercentage = (Math.abs(lastWorkerResult.current.means[0] / props.bounds.x) +
            Math.abs(lastWorkerResult.current.means[1] / props.bounds.y) +
            Math.abs(lastWorkerResult.current.means[2] / props.bounds.z)) / 3;

          props.audioChain.crossFade.fade.value = MathUtils.clamp(1 - deviationPercentage, 0, 1);

          // The higher the standard deviation is, the more "dispersal" we have, which increases the intensity of the reverb.
          const dispersalPercentage = (Math.abs(lastWorkerResult.current.stdevs[0] / props.bounds.x) +
            Math.abs(lastWorkerResult.current.stdevs[1] / props.bounds.y) +
            Math.abs(lastWorkerResult.current.stdevs[2] / props.bounds.z)) / 3;

          props.audioChain.reverb.wet.value = MathUtils.clamp(dispersalPercentage, 0, 1);
        }

        // Update the axes helper if we have one.
        // Orient it on the center of the boids and scale it by the stdev for each of the different axes
        if (process.env.NODE_ENV !== 'production') {
          if (axesHelperRef.current !== null) {
            axesHelperRef.current.position.set(lastWorkerResult.current.means[0], lastWorkerResult.current.means[1], lastWorkerResult.current.means[2]);
            axesHelperRef.current.scale.set(lastWorkerResult.current.stdevs[0], lastWorkerResult.current.stdevs[1], lastWorkerResult.current.stdevs[2]);
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
      {/* Only include axes in development */}
      {
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
