import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

// Import globals with specific aliases to avoid https://github.com/Tonejs/Tone.js/issues/1102
import { start as toneStart } from 'tone';

import ToneManager from './ToneManager';

import './InterfaceControls.css';
import { useFermataStore } from './fermataState';

export interface InterfaceControlsProps {
  toneManager: ToneManager
}

function InterfaceControls(props: InterfaceControlsProps): JSX.Element {
  const isAudioPlaying = useFermataStore((state) => state.isAudioPlaying);
  const setAudioPlaying = useFermataStore((state) => state.setAudioPlaying);

  const toggleAudioClickHandler = async () => {
    if (!isAudioPlaying) {
      // Unfortunately, this *has* to be in this event handler to prevent auto-play blocking
      await toneStart();

      props.toneManager.startPlayback();
      setAudioPlaying(true);
    }
    else {
      props.toneManager.stopPlayback();
      setAudioPlaying(false);
    }
  };

  return (
    <div id="control-items">
      <button
        type="button"
        title="Toggle audio"
        onClick={toggleAudioClickHandler}
      >
        {isAudioPlaying && <FontAwesomeIcon icon="volume-mute" />}
        {!isAudioPlaying && <FontAwesomeIcon icon="volume-up" />}
      </button>
    </div>
  );
}

export default InterfaceControls;
