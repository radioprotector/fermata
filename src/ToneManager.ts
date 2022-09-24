import { Frequency, ToneAudioNode, ToneAudioNodeOptions, Synth, PolySynth, SynthOptions, Volume, Gain, CrossFade, Tremolo, Loop, Context } from 'tone';

// Import globals with specific aliases to avoid https://github.com/Tonejs/Tone.js/issues/1102
import { loaded as toneLoaded, getDestination as toneGetDestination, getTransport as toneGetTransport, setContext as toneSetContext } from 'tone';
import { RecursivePartial } from 'tone/build/esm/core/util/Interface';
import { Instrument, InstrumentOptions } from 'tone/build/esm/instrument/Instrument';
import { Frequency as FrequencyUnit } from 'tone/build/esm/core/type/Units';
import { Effect, EffectOptions } from 'tone/build/esm/effect/Effect';
import { StereoEffect, StereoEffectOptions } from 'tone/build/esm/effect/StereoEffect';

import * as cst from './constants';

function buildCloudChain(cloudIdx: number, destinationNode: ToneAudioNode<ToneAudioNodeOptions>): CloudAudioChain {
  // Get the period for this cloud
  const periodSeconds = cst.CLOUD_PERIOD_SECONDS[cloudIdx];

  // Determine the base note to use
  const baseNote = cst.CLOUD_BASE_NOTES[cloudIdx];
  const chordFrequencies = Frequency(baseNote).harmonize([0, 4, 7]).map((fc) => fc.toFrequency());

  // Create a volume node and connect it to the main destination
  const volume = new Volume(-40);
  volume.connect(destinationNode);

  // // Create a reverb node and connect it to the volume output
  const tremolo = new Tremolo((cloudIdx * 0.5) + 1, 1);
  tremolo.wet.value = 0;
  tremolo.connect(volume);

  // Create a cross-fade for the chord and polysynth
  const crossFade = new CrossFade(0);
  crossFade.connect(tremolo);

  // Determine synth args
  const synthOptions: RecursivePartial<SynthOptions> = {
    oscillator: {
      partialCount: 1,
      type: cst.CLOUD_OSCILLATORS[cloudIdx]
    },
    envelope: {
      attack: periodSeconds / 20
    }
  }

  // Create a base instrument
  const baseInstrument = new Synth(synthOptions);
  baseInstrument.connect(crossFade.a);

  // Create a polysynth for the chord
  const chordInstrument = new PolySynth({ maxPolyphony: chordFrequencies.length * 2, voice: Synth, options: synthOptions });
  chordInstrument.connect(crossFade.b);

  return {
    periodSeconds,
    waveformType: synthOptions.oscillator?.type || '',
    baseNote,
    baseInstrument,
    chordFrequencies,
    chordInstrument,
    crossFade,
    effect: tremolo,
    volume
  };
}

/**
 * Describes a tone chain for a particular boid cloud.
 */
export interface CloudAudioChain {
  periodSeconds: number;

  waveformType: string;

  baseNote: FrequencyUnit;

  baseInstrument: Instrument<InstrumentOptions>;

  chordFrequencies: FrequencyUnit[];

  chordInstrument: PolySynth;

  crossFade: CrossFade;

  /**
   * The effect to apply to the cloud, in which its wetness is variable based on cloud dispersal.
   */
  effect: Effect<EffectOptions> | StereoEffect<StereoEffectOptions>;

  volume: Volume;
}

class ToneManager {

  public readonly cloudChains: CloudAudioChain[];

  private readonly chainReceiverNode: Gain;

  private patternsInitialized: boolean = false;

  private _isPlaying: boolean = false;

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  constructor() {
    toneSetContext(new Context({ latencyHint : 'playback', lookAhead: 0 }));

    // Create a gain node to receive all of the instruments
    this.chainReceiverNode = new Gain();

    // Create cloud instrument chains
    this.cloudChains = [];

    for(let cloudIdx = 0; cloudIdx < cst.CLOUD_COUNT; cloudIdx++) {
      this.cloudChains.push(buildCloudChain(cloudIdx, this.chainReceiverNode));
    }
  }
  
  public registerPatterns = async (): Promise<void> => {
    return toneLoaded()
      .then(() => {
        if (this.patternsInitialized) {
          return;
        }

        // Create loops for all of the cloud chains
        for(const cloudChain of this.cloudChains) {
          new Loop(() => {
            cloudChain.baseInstrument.triggerAttackRelease(cloudChain.baseNote, cloudChain.periodSeconds * 1.05);
            cloudChain.chordInstrument.triggerAttackRelease(cloudChain.chordFrequencies, cloudChain.periodSeconds * 1.05);
          }, cloudChain.periodSeconds).start(0);
        }

        // Connect the chain receiver node to the destination
        this.chainReceiverNode.toDestination();

        // Indicate that the patterns have been initialized
        this.patternsInitialized = true;
    });
  }

  public startPlayback = async (): Promise<void> => {
    // Ensure patterns are good to go
    await this.registerPatterns();
    
    toneGetDestination().mute = false;

    const toneTransport = toneGetTransport();
    toneTransport.bpm.value = 100;
    toneTransport.start();

    this._isPlaying = true;
  }
 
  public stopPlayback = (): void =>  {
    toneGetDestination().mute = true;
    toneGetTransport().pause();

    this._isPlaying = false;
  }

  public dispose = (): void => {
    this.stopPlayback();
  }
}

export default ToneManager;
