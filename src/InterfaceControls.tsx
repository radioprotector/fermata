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
  const rotationSpeedIndex = useFermataStore((state) => state.rotationSpeedIndex);
  const cycleRotationSpeed = useFermataStore((state) => state.cycleRotation);
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
      {/**
        * Because this is using flex row-reverse order, the items that show up first will be on the far right. 
        */}
      <button
        type="button"
        title="Cycle orbit speed"
        onClick={cycleRotationSpeed}
      >
        <span
          className="fa-layers fa-fw"
        >
          <FontAwesomeIcon icon="arrow-rotate-forward" transform="shrink-1 left-6" />
          {rotationSpeedIndex == 0 && <FontAwesomeIcon icon="pause" transform="shrink-6 right-8" />}
          {rotationSpeedIndex == 1 && <FontAwesomeIcon icon="play" transform="shrink-6 right-8" />}
          {rotationSpeedIndex == 2 && <FontAwesomeIcon icon="forward" transform="shrink-6 right-8" />}
        </span>
      </button>
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
