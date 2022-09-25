import { Suspense, useEffect, useRef } from 'react';
import { Texture } from 'three';
import { Canvas } from '@react-three/fiber';
import { CubeCamera, Stars, Stats } from '@react-three/drei';

import './App.css';

import * as cst from './constants';
import { useFermataStore } from './fermataState';

import BoidCloudContainer from './BoidCloudContainer';
import InterfaceControls from './InterfaceControls';
import ToneManager from './ToneManager';

function App(): JSX.Element {
  // Ensure we have a tone manager singleton shared across all of the components
  const toneManager = useRef<ToneManager>(new ToneManager());
  const setAudioPlaying = useFermataStore((state) => state.setAudioPlaying);

  useEffect(() => {
    // Ensure that when the tone manager is initialized, it reflects the audio volume in the state
    const currentToneManager = toneManager.current;
    currentToneManager.globalVolume = useFermataStore.getState().audioVolume;

    // Gracefully tear down the old tone manager when needed
    return function cleanup() {
      // Ensure that audio is not indicated as playing, since resetting the tone manager creates a new audio context that must be started
      setAudioPlaying(false);

      if (currentToneManager !== null) {
        currentToneManager.dispose();
      }
    }
  }, [toneManager, setAudioPlaying]);

  return (
    <div id="canvas-container">
      <Suspense fallback={null}>
        <Canvas
          camera={{ fov: 75, near: 0.1, far: 1000, position: [0, cst.OVERALL_Y_RANGE + (cst.CLOUD_Y_RANGE * 1.618), cst.OVERALL_XZ_RANGE + cst.CLOUD_XZ_RANGE] }}>
          <Stars
            radius={2 * cst.OVERALL_XZ_RANGE}
            speed={0}
            count={1000}
          />
          <BoidCloudContainer
            toneManager={toneManager.current}
          />
          {/* Cap the camera at the far range of the individual clouds, especially so it doesn't pick up the star fields in the reflection */}
          <CubeCamera far={cst.OVERALL_XZ_RANGE + cst.CLOUD_XZ_RANGE + cst.OVERALL_XZ_INNER_RADIUS}>
            {/*
              HACK: Work around a typing issue that is present with CubeCamera
              The sample code provided doesn't work, and I suspect it's a similar issue to:
              https://github.com/pmndrs/drei/issues/913
              https://github.com/pmndrs/drei/pull/959/commits/184e105fe06d64610c3d6982ad2f303fa6a43e52

              Similarly, the typing for CubeCamera.children is:
              "children: (tex: Texture) => React.ReactNode;"
            */}
            {((tex: Texture) => (
              <mesh>
                <sphereGeometry args={[cst.OVERALL_XZ_INNER_RADIUS, 64, 64]} />
                <meshStandardMaterial
                  emissive={0xffffff}
                  emissiveIntensity={0.01}
                  fog={false}
                  roughness={0}
                  metalness={1}
                  envMap={tex}
                />
              </mesh>
            )) as any}
          </CubeCamera>
        </Canvas>
        <InterfaceControls
          toneManager={toneManager.current}
        />
      </Suspense>
      {/* Only include stats in development */}
      {
        process.env.NODE_ENV !== 'production'
        &&
        <Stats
          showPanel={0}
          className="stats"
        />
      }
    </div>
  );
}

export default App;
