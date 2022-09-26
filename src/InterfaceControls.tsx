import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

// Import globals with specific aliases to avoid https://github.com/Tonejs/Tone.js/issues/1102
import { Context, getContext as toneGetContext, setContext as toneSetContext } from 'tone';

import { useFermataStore, AUDIO_VOLUMES } from './fermataState';
import ToneManager from './ToneManager';

import './InterfaceControls.css';

export interface InterfaceControlsProps {
  toneManager: ToneManager
}

function InterfaceControls(props: InterfaceControlsProps): JSX.Element {
  const initiateReset = useFermataStore((state) => state.initiateReset);
  const rotationSpeedIndex = useFermataStore((state) => state.rotationSpeedIndex);
  const cycleRotationSpeed = useFermataStore((state) => state.cycleRotation);
  const isAudioPlaying = useFermataStore((state) => state.isAudioPlaying);
  const setAudioPlaying = useFermataStore((state) => state.setAudioPlaying);
  const audioVolumeIndex = useFermataStore((state) => state.audioVolumeIndex);
  const setAudioVolume = useFermataStore((state) =>  state.setAudioVolume);

  // For whatever reason, Safari autoplay really doesn't like async click handlers for starting audio context,
  // so we're going to make sure this is synchronous even if the underlying methods aren't
  const toggleAudioClickHandler = () => {
    if (!isAudioPlaying) {
      // Ensure we have a Tone context initialized and ready to play.
      // Unfortunately, this *has* to be in this event handler to prevent auto-play blocking
      // Get the audio context currently in use by Tone
      let toneContext = toneGetContext();

      // See if we need to create a new context with a latency hit
      if (toneContext === null || toneContext.latencyHint !== 'playback') {
        toneContext = new Context({ latencyHint: 'playback'});
        toneSetContext(toneContext);
      }

      // Unfortunately, this *has* to be in this event handler to prevent auto-play blocking
      if (toneContext.state !== 'running') {
        toneContext.resume();
      }

      props.toneManager.startPlayback();
      setAudioPlaying(true);
    }
    else {
      props.toneManager.stopPlayback();
      setAudioPlaying(false);
    }
  };

  const audioVolumeChangeHandler = (e: React.FormEvent<HTMLInputElement>) => {
    const input = e.target as HTMLInputElement;
    const newVolumeIndex = parseInt(input.value, 10);

    setAudioVolume(newVolumeIndex);
    props.toneManager.globalVolume = AUDIO_VOLUMES[newVolumeIndex];
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
          {rotationSpeedIndex === 0 && <FontAwesomeIcon icon="pause" transform="shrink-6 right-8" />}
          {rotationSpeedIndex === 1 && <FontAwesomeIcon icon="play" transform="shrink-6 right-8" />}
          {rotationSpeedIndex === 2 && <FontAwesomeIcon icon="forward" transform="shrink-6 right-8" />}
        </span>
      </button>
      <button
        type="button"
        title="Reset positions"
        onClick={initiateReset}
      >
        <FontAwesomeIcon fixedWidth={true} icon="clock-rotate-left" />
      </button>
      {
        isAudioPlaying &&
        <input
          type="range"
          min="0"
          max={AUDIO_VOLUMES.length - 1}
          step="1"
          value={audioVolumeIndex}
          onChange={audioVolumeChangeHandler}
          title="Volume"
          aria-label="Volume"
        />
      }
      <button
        type="button"
        title="Toggle audio"
        onClick={toggleAudioClickHandler}
      >
        {isAudioPlaying && <FontAwesomeIcon icon="volume-up" />}
        {!isAudioPlaying && <FontAwesomeIcon icon="volume-mute" />}
      </button>
    </div>
  );
}

export default InterfaceControls;
