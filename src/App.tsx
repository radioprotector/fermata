import React, { useRef, useState } from 'react';
import * as Tone from 'tone';

import './App.css';
import ToneManager from './ToneManager';

function App(): JSX.Element {
  const toneManager = useRef<ToneManager | null>(null);

  const [bassVolume, setBassVolume] = useState(0);
  const [drumVolume, setDrumVolume] = useState(0);
  const [stringVolume, setStringVolume] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleVolumeChange = (e: React.FormEvent<HTMLInputElement>) => {
    const input = e.target as HTMLInputElement;
    const dbValue = parseFloat(input.value);

    switch (input.name) {
      case 'bassVolume':
        if (toneManager.current !== null) {
          toneManager.current.bassVolume.volume.value = dbValue;
        }
        setBassVolume(dbValue);
        break;

      case 'drumVolume':
        if (toneManager.current !== null) {
          toneManager.current.drumVolume.volume.value = dbValue;
        }
        setDrumVolume(dbValue);
        break;

      case 'stringVolume':
        if (toneManager.current !== null) {
          toneManager.current.stringVolume.volume.value = dbValue;
        }
        setStringVolume(dbValue);
        break;
    }
  }

  const handlePlayToggle = async () => {
    if (!isPlaying) {
      await Tone.start();

      setIsPlaying(true);
      Tone.Transport.bpm.value = 100;
      Tone.Transport.start();

      if (toneManager.current === null) {
        toneManager.current = new ToneManager();
        toneManager.current.bassVolume.volume.value = bassVolume;
        toneManager.current.drumVolume.volume.value = drumVolume;
        toneManager.current.stringVolume.volume.value = stringVolume;
      }

      toneManager.current.startPlayback();
    }
    else {
      setIsPlaying(false);
      Tone.Transport.pause();

      if (toneManager.current !== null) {
        toneManager.current.stopPlayback();
      }
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handlePlayToggle}
      >
        {isPlaying && "Stop"}
        {!isPlaying && "Start"}
      </button>
      <div>
        <label>
          Bass
          <input
            name="bassVolume"
            type="range"
            min="-100"
            max="0"
            value={bassVolume}
            onInput={handleVolumeChange}
          />
        </label>
      </div>
      <div>
        <label>
          Drums
          <input
            name="drumVolume"
            type="range"
            min="-100"
            max="0"
            value={drumVolume}
            onInput={handleVolumeChange}
          />
        </label>
      </div>
      <div>
        <label>
          Strings
          <input
            name="stringVolume"
            type="range"
            min="-100"
            max="0"
            value={stringVolume}
            onInput={handleVolumeChange}
          />
        </label>
      </div>
    </div>
  );
}

export default App;
