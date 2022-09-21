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
      // Unfortunately, this *has* to be in this event handler to prevent auto-play blocking
      await Tone.start();

      setAudioPlaying(true);
      props.toneManager.startPlayback();
    }
    else {
      setAudioPlaying(false);
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
