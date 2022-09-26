import create from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

/**
 * Global rotation speeds for orbit controls.
 */
const ROTATION_SPEEDS = [0, 1, 3];

const initialRotationIndex = 1;

/**
 * Global audio volume stages, in decibels.
 */
export const AUDIO_VOLUMES = [-30, -20, -10, -5, 0];

const initialAudioVolumeIndex = 3;

interface FermataState {
  /**
   * The auto-rotation speed to use for the orbit controls.
   */
  rotationSpeed: number;

  /**
   * The index of the current auto-rotation speed value.
   */
  rotationSpeedIndex: number;

  /**
   * The audio volume value to apply globally.
   */
  audioVolume: number;

  /**
   * The index of the current audio volume value.
   */
  audioVolumeIndex: number;

  /**
   * Whether or not audio is enabled.
   */
  isAudioPlaying: boolean;

  /**
   * The last time a reset was initiated.
   */
  lastResetTime: number;

  /**
   * Sets an explicit auto-rotation speed.
   */
  setRotationSpeed: (newIndex: number) => void;

  /**
   * Cycles between rotation speeds.
   */
  cycleRotation: () => void;

  /**
   * Sets an explicit audio volume value.
   */
  setAudioVolume: (newIndex: number) => void;

  /**
   * Sets whether or not audio is enabled.
   */
  setAudioPlaying: (isPlaying: boolean) => void;

  /**
   * Initiates a reset of the clouds to their initial positions.
   */
  initiateReset: () => void;
}

export const useFermataStore = create<FermataState>()(subscribeWithSelector((set, get) => ({
  rotationSpeedIndex: initialRotationIndex,
  rotationSpeed: ROTATION_SPEEDS[initialRotationIndex],
  audioVolumeIndex: initialAudioVolumeIndex,
  audioVolume: AUDIO_VOLUMES[initialAudioVolumeIndex],
  isAudioPlaying: false,
  lastResetTime: 0,

  setRotationSpeed: (newIndex) => {
    // Assign the index if it's within bounds
    if (newIndex >= 0 && newIndex < ROTATION_SPEEDS.length) {
      set({
        rotationSpeedIndex: newIndex,
        rotationSpeed: ROTATION_SPEEDS[newIndex]
      });
    }
  },

  cycleRotation: () => {
    // Wrap around as needed
    let newIndex = get().rotationSpeedIndex + 1;

    if (newIndex >= ROTATION_SPEEDS.length) {
      newIndex = 0;
    }

    set({
      rotationSpeedIndex: newIndex,
      rotationSpeed: ROTATION_SPEEDS[newIndex]
    });
  },

  setAudioVolume: (newIndex) => {
    // Assign the index if it's within bounds
    if (newIndex >= 0 && newIndex < AUDIO_VOLUMES.length) {
      set({
        audioVolumeIndex: newIndex,
        audioVolume: AUDIO_VOLUMES[newIndex]
      });
    }
  },

  setAudioPlaying: (isPlaying) => {
    if (get().isAudioPlaying !== isPlaying) {
      set({ isAudioPlaying: isPlaying });
    }
  },

  initiateReset: () => {
    set({ lastResetTime: Date.now() });
  }
})));
