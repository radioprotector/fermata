import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import * as Tone from 'tone';
import ToneManager from './ToneManager';

import './InterfaceControls.css';

export interface InterfaceControlsProps {
  toneManager: ToneManager
}

function InterfaceControls(props: InterfaceControlsProps): JSX.Element {
  // FIXME: Ensure that when the parent component swaps the tone manager, that audioPlaying reflects that state
  const [audioPlaying, setAudioPlaying] = useState(false);
  const toggleAudioClickHandler = async () => {
    if (!audioPlaying) {
      await Tone.start();

      setAudioPlaying(true);
      
      // FUTURE: See if we can move this code into the tone manager handling, assuming async operations won't interfere with auto-play blocking
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
