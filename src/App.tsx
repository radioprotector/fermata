import { useState } from 'react';
import * as Tone from 'tone';

import './App.css';
import MusicPlayer from './MusicPlayer';

function App(): JSX.Element {
  const [isPlaying, setIsPlaying] = useState(false);
  const handlePlayToggle = async () => {
    if (!isPlaying) {
      await Tone.start();
      setIsPlaying(true);
      Tone.Transport.start();
    }
    else {
      setIsPlaying(false);
      Tone.Transport.pause();
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
      {isPlaying && <MusicPlayer />}
    </div>
  );
}

export default App;
