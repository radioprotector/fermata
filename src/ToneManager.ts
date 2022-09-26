import { Frequency, Synth, PolySynth, SynthOptions, Volume, CrossFade, Tremolo, Loop } from 'tone';

// Import globals with specific aliases to avoid https://github.com/Tonejs/Tone.js/issues/1102
import { loaded as toneLoaded, getDestination as toneGetDestination, getTransport as toneGetTransport } from 'tone';
import { RecursivePartial } from 'tone/build/esm/core/util/Interface';
import { Instrument, InstrumentOptions } from 'tone/build/esm/instrument/Instrument';
import { Frequency as FrequencyUnit } from 'tone/build/esm/core/type/Units';
import { Effect, EffectOptions } from 'tone/build/esm/effect/Effect';
import { StereoEffect, StereoEffectOptions } from 'tone/build/esm/effect/StereoEffect';

import * as cst from './constants';

/**
 * Describes a tone chain for a particular boid cloud.
 */
interface CloudAudioChain {
  periodSeconds: number;

  waveformType: string;

  baseNote: FrequencyUnit;

  baseInstrument: Instrument<InstrumentOptions>;

  chordFrequencies: FrequencyUnit[];

  chordInstrument: PolySynth;

  chordCrossfade: CrossFade;

  /**
   * The effect to apply to the cloud, in which its wetness is variable based on cloud dispersal.
   */
  effect: Effect<EffectOptions> | StereoEffect<StereoEffectOptions>;

  volume: Volume;
}

class ToneManager {

  private _audioPatternsInitialized: boolean = false;

  /**
   * The collection of cloud-specific instrument chains.
   */
  private _cloudChains: CloudAudioChain[] = [];

  /**
   * The collection of cloud-specific volume levels.
   */
  private _cloudVolumes: number[] = [];

  /**
   * The collection of cloud-specific chord intensities.
   */
  private _cloudChordIntensities: number[] = [];

  /**
   * The collection of cloud-specific effect intensities.
   */
  private _cloudEffectIntensities: number[] = [];

  /**
   * The global volume node that collects all of the cloud-specific chains.
   */
  private _globalVolumeNode: Volume | null = null;

  private _globalVolume: number = 0;

  private _isPlaying: boolean = false;

  get globalVolume(): number {
    return this._globalVolume;
  }
  set globalVolume(value: number) {
    this._globalVolume = value;

    // Cascade to the node if initialized
    if (this._globalVolumeNode !== null) {
      this._globalVolumeNode.volume.value = value;
    }
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  constructor() {
    // Reserve default values in the arrays for each of the chord values
    for(let cloudIndex = 0; cloudIndex < cst.CLOUD_COUNT; cloudIndex++) {
      this._cloudVolumes.push(-40);
      this._cloudChordIntensities.push(0);
      this._cloudEffectIntensities.push(0);
    }
  }

  /**
   * Builds an audio chain for a cloud.
   * @param cloudIndex The index of the associated cloud.
   * @returns The constructed audio chain.
   */
  private buildCloudAudioChain(cloudIndex: number): CloudAudioChain {
    // Get the period for this cloud
    const periodSeconds = cst.CLOUD_PERIOD_SECONDS[cloudIndex];
  
    // Determine the base note to use
    const baseNote = cst.CLOUD_BASE_NOTES[cloudIndex];
    const chordFrequencies = Frequency(baseNote).harmonize([0, 4, 7]).map((fc) => fc.toFrequency());
  
    // Create a volume node and connect it to the main destination
    const volume = new Volume(this._cloudVolumes[cloudIndex]);
    volume.connect(this._globalVolumeNode!);
  
    // // Create a reverb node and connect it to the volume output
    const tremolo = new Tremolo((cloudIndex * 0.5) + 1, 1);
    tremolo.wet.value = this._cloudEffectIntensities[cloudIndex];
    tremolo.connect(volume);
  
    // Create a cross-fade for the chord and polysynth
    const chordCrossfade = new CrossFade(0);
    chordCrossfade.fade.value = this._cloudChordIntensities[cloudIndex];
    chordCrossfade.connect(tremolo);
  
    // Determine synth args
    const synthOptions: RecursivePartial<SynthOptions> = {
      oscillator: {
        partialCount: 1,
        type: cst.CLOUD_OSCILLATORS[cloudIndex]
      },
      envelope: {
        attack: periodSeconds / 20
      }
    }
  
    // Create a base instrument
    const baseInstrument = new Synth(synthOptions);
    baseInstrument.connect(chordCrossfade.a);
  
    // Create a polysynth for the chord
    const chordInstrument = new PolySynth({ maxPolyphony: chordFrequencies.length * 2, voice: Synth, options: synthOptions });
    chordInstrument.connect(chordCrossfade.b);
  
    return {
      periodSeconds,
      waveformType: synthOptions.oscillator?.type || 'N/A',
      baseNote,
      baseInstrument,
      chordFrequencies,
      chordInstrument,
      chordCrossfade,
      effect: tremolo,
      volume
    };
  }
  
  public async ensureAudioInitialized(): Promise<void> {
    // Ensure the global volume node exists
    if (this._globalVolumeNode == null) {
      this._globalVolumeNode = new Volume(this.globalVolume);
      this._globalVolumeNode.connect(toneGetDestination());
    }

    // Ensure that all cloud chains have been created
    if (this._cloudChains.length === 0) {
      for(let cloudIndex = 0; cloudIndex < cst.CLOUD_COUNT; cloudIndex++) {
        this._cloudChains.push(this.buildCloudAudioChain(cloudIndex));
      }
    }

    return toneLoaded()
      .then(() => {
        if (this._audioPatternsInitialized) {
          return;
        }

        // Create a loop for each audio chain
        for(const cloudChain of this._cloudChains) {
          new Loop(() => {
            cloudChain.baseInstrument.triggerAttackRelease(cloudChain.baseNote, cloudChain.periodSeconds);
            cloudChain.chordInstrument.triggerAttackRelease(cloudChain.chordFrequencies, cloudChain.periodSeconds);
          }, cloudChain.periodSeconds).start(0);
        }

        // Indicate that the audio has been initialized
        this._audioPatternsInitialized = true;
    });
  }

  public async startPlayback(): Promise<void> {
    // Ensure audio has been initialized
    await this.ensureAudioInitialized()

    toneGetDestination().mute = false;

    const toneTransport = toneGetTransport();
    toneTransport.bpm.value = 100;
    toneTransport.start();

    this._isPlaying = true;
  }
 
  public stopPlayback(): void {
    toneGetDestination().mute = true;
    toneGetTransport().pause();

    this._isPlaying = false;
  }

  public dispose(): void {
    this.stopPlayback();
  }

  /**
   * Gets a description of the instrument configured for the specified cloud.
   * @param cloudIndex The index of the cloud.
   */
  public getInstrumentDescription(cloudIndex: number): string {
    if (this._cloudChains !== null && cloudIndex < this._cloudChains.length) {
      const chain = this._cloudChains[cloudIndex];

      return `${chain.baseNote} ${chain.waveformType}`;
    }
    else {
      return `${cst.CLOUD_BASE_NOTES[cloudIndex]} uninitialized`;
    }
  }

  public getCloudVolume(cloudIndex: number): number {
    return this._cloudVolumes[cloudIndex];
  }

  public setCloudVolume(cloudIndex: number, volume: number): void {
    this._cloudVolumes[cloudIndex] = volume;

    // Cascade to the node if it's been initialized
    if (this._cloudChains !== null && 
      cloudIndex < this._cloudChains.length && 
      this._cloudChains[cloudIndex].volume !== null) {

      this._cloudChains[cloudIndex].volume.volume.value = volume;
    }
  }

  public getChordIntensity(cloudIndex: number): number {
    return this._cloudChordIntensities[cloudIndex];
  }

  public setChordIntensity(cloudIndex: number, intensity: number): void {
    this._cloudChordIntensities[cloudIndex] = intensity;

    // Cascade to the node if it's been initialized
    if (this._cloudChains !== null && 
      cloudIndex < this._cloudChains.length && 
      this._cloudChains[cloudIndex].chordCrossfade !== null) {

      this._cloudChains[cloudIndex].chordCrossfade.fade.value = intensity;
    }
  }

  public getEffectIntensity(cloudIndex: number): number {
    return this._cloudEffectIntensities[cloudIndex];
  }

  public setEffectIntensity(cloudIndex: number, intensity: number): void {
    this._cloudEffectIntensities[cloudIndex] = intensity;

    // Cascade to the node if it's been initialized
    if (this._cloudChains !== null && 
      cloudIndex < this._cloudChains.length && 
      this._cloudChains[cloudIndex].effect !== null) {

      this._cloudChains[cloudIndex].effect.wet.value = intensity;
    }
  }
}

export default ToneManager;
