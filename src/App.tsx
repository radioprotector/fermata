import { Suspense, useEffect, useRef } from 'react';
import { OrbitControls, Stats } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';

import './App.css';
import BoidCloudContainer from './BoidCloudContainer';
import InterfaceControls from './InterfaceControls';
import ToneManager from './ToneManager';

function App(): JSX.Element {
  // Ensure we have a tone manager singleton shared across all of the components
  const toneManager = useRef<ToneManager>(new ToneManager());

  useEffect(() => {
    const currentToneManager = toneManager.current;

    // Gracefully tear down the old tone manager when needed
    return function cleanup() {
      if (currentToneManager !== null) {
        currentToneManager.dispose();
      }
    }
  }, [toneManager])

  return (
    <div id="canvas-container">
      <Suspense fallback={null}>
        <Canvas
          camera={{ fov: 75, near: 0.1, far: 1000, position: [0, 66, -100] }}>
          <OrbitControls
            enablePan={true}
            enableRotate={true}
            enableZoom={true}
            autoRotate={true}
            autoRotateSpeed={4}
          />
          <BoidCloudContainer
            toneManager={toneManager.current}
          />
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
