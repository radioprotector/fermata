import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import * as Tone from 'tone';
import ToneManager from './ToneManager';

import './InterfaceControls.css';

export interface InterfaceControlsProps {
  toneManager: ToneManager
}

function InterfaceControls(props: InterfaceControlsProps): JSX.Element {
  const [audioPlaying, setAudioPlaying] = useState(false);
  const toggleAudioClickHandler = async () => {
    if (!audioPlaying) {
      await Tone.start();

      setAudioPlaying(true);
      
      Tone.Transport.bpm.value = 100;
      Tone.Transport.start();
      props.toneManager.startPlayback();
    }
    else {
      setAudioPlaying(false);

      Tone.Transport.pause();
      props.toneManager.stopPlayback();
    }
  };

  return (
    <div id="control-items">
      <button
        type="button"
        title="Toggle audio"
        onClick={toggleAudioClickHandler}
      >
        {audioPlaying && <FontAwesomeIcon icon="volume-mute" />}
        {!audioPlaying && <FontAwesomeIcon icon="volume-up" />}
      </button>
    </div>
  );
}

export default InterfaceControls;
