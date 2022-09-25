import create from 'zustand';

/**
 * Global rotation speeds for orbit controls.
 */
const rotationSpeeds = [0, 1, 3];

const initialRotationIndex = 1;

/**
 * Global audio volume stages, in decibels.
 */
const audioVolumes = [0, -5, -10, -20];

const initialAudioVolumeIndex = 0;

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

export const useFermataStore = create<FermataState>((set, get) => ({
  rotationSpeedIndex: initialRotationIndex,
  rotationSpeed: rotationSpeeds[initialRotationIndex],
  audioVolumeIndex: initialAudioVolumeIndex,
  audioVolume: audioVolumes[initialAudioVolumeIndex],
  isAudioPlaying: false,
  lastResetTime: 0,

  setRotationSpeed: (newIndex) => {
    // Assign the index if it's within bounds
    if (newIndex > 0 && newIndex < rotationSpeeds.length) {
      set({
        rotationSpeedIndex: newIndex,
        rotationSpeed: rotationSpeeds[newIndex]
      });
    }
  },

  cycleRotation: () => {
    // Wrap around as needed
    let newIndex = get().rotationSpeedIndex + 1;

    if (newIndex >= rotationSpeeds.length) {
      newIndex = 0;
    }

    set({
      rotationSpeedIndex: newIndex,
      rotationSpeed: rotationSpeeds[newIndex]
    });
  },

  setAudioVolume: (newIndex) => {
    // Assign the index if it's within bounds
    if (newIndex > 0 && newIndex < audioVolumes.length) {
      set({
        audioVolumeIndex: newIndex,
        audioVolume: audioVolumes[newIndex]
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
}));
