import { Frequency, ToneAudioNode, ToneAudioNodeOptions, AMSynth, PolySynth, Sampler, Volume, Gain, BitCrusher, CrossFade, Loop, Pattern, Sequence } from 'tone';

// Import globals with specific aliases to avoid https://github.com/Tonejs/Tone.js/issues/1102
import { loaded as toneLoaded, getDestination as toneGetDestination, getTransport as toneGetTransport } from 'tone';
import { Frequency as FrequencyUnit } from 'tone/build/esm/core/type/Units';
import { Note } from 'tone/build/esm/core/type/NoteUnits';
import { Effect, EffectOptions } from 'tone/build/esm/effect/Effect';
import { StereoEffect, StereoEffectOptions } from 'tone/build/esm/effect/StereoEffect';
import { Instrument, InstrumentOptions } from 'tone/build/esm/instrument/Instrument';

import * as cst from './constants';

const Rest: Note = "A0";

const Bass: Note = "A1";
const Snare: Note = "A2";

const LowTom: Note = "A3";
const MidTom: Note = "D3";
const HighTom: Note = "A4";

const LowConga: Note = "A5";
const MidConga: Note = "D5";
const HighConga: Note = "A6";

const ClosedHat: Note = "A7";
const OpenHat: Note = "D7";
const Crash: Note = "A8";

function buildDrumSampler(destinationNode: ToneAudioNode<ToneAudioNodeOptions>): [ instrument: Sampler, output: Volume ] {
  const sampler = new Sampler({
    urls: {
      [Bass]: "BD2500.mp3",
      [Snare]: "SD2500.mp3",
      
      [LowTom]: "LT25.mp3",
      [MidTom]: "MT25.mp3",
      [HighTom]: "HT25.mp3",

      [LowConga]: "LC25.mp3",
      [MidConga]: "MC25.mp3",
      [HighConga]: "HC25.mp3",

      [ClosedHat]: "CH.mp3",
      [OpenHat]: "OH25.mp3",
      [Crash]: "CY2500.mp3"
    },
    baseUrl: process.env.PUBLIC_URL + '/assets/',
  });

   // Create a volume node and connect it to the main destination
  const volumeOutput = new Volume(-25);
  volumeOutput.connect(destinationNode);

  return [sampler, volumeOutput]; 
}

const drumPatternsArray: (Note | Note[])[][] = [
  [Bass, Rest, Bass, Rest, Bass, Rest, Bass, Rest],
  [Bass, Rest, [LowTom, Bass], Rest, [MidTom, Bass], Rest, [HighTom, Bass], Snare],
  [Bass, Rest, [LowTom, Bass], Snare, [MidTom, Bass], Snare, [LowTom, Bass], Snare]
  // [Bass, Rest, LowTom, Rest, Snare, Rest, LowTom, Rest, Bass, Rest, LowTom, Rest, Snare, Rest, MidTom, HighTom],
  // [Bass, Rest, [ClosedHat, Snare], Rest, Bass, Rest, [ClosedHat, Snare], Rest, Bass, OpenHat, Bass, Rest, Crash, HighTom, MidTom, LowTom]
];

const fullDrumSequence = drumPatternsArray.flat(1);

function buildCloudChain(cloudIdx: number, destinationNode: ToneAudioNode<ToneAudioNodeOptions>): CloudAudioChain {
  // Get the period for this cloud
  const periodSeconds = cst.CLOUD_PERIOD_SECONDS[cloudIdx];

  // Determine the base note to use
  const baseNote = cst.CLOUD_BASE_NOTES[cloudIdx];
  const chordFrequencies = Frequency(baseNote).harmonize([0, 4, 7]).map((fc) => fc.toFrequency());

  // Create a volume node and connect it to the main destination
  const volume = new Volume(-25);
  volume.connect(destinationNode);

  // // Create a reverb node and connect it to the volume output
  // const reverb = new Tone.Reverb((cloudIdx + 1) * 0.5);
  // reverb.wet.value = 0;
  // reverb.connect(volume);
  // const tremolo = new Tone.Tremolo((cloudIdx * 0.5) + 1, 0.75);
  // tremolo.wet.value = 0;
  // tremolo.connect(volume);
  const bitCrush = new BitCrusher(2 + (2 * cloudIdx));
  bitCrush.wet.value = 0;
  bitCrush.connect(volume);

  // Create a cross-fade for the chord and polysynth
  const crossFade = new CrossFade(0);
  crossFade.connect(bitCrush);

  // Create a base instrument
  const baseInstrument = new AMSynth();
  baseInstrument.connect(crossFade.a);

  // Create a polysynth for the chord
  const chordInstrument = new PolySynth(AMSynth);
  chordInstrument.connect(crossFade.b);

  return {
    periodSeconds,
    baseNote,
    baseInstrument,
    chordFrequencies,
    chordInstrument,
    crossFade,
    effect: bitCrush,
    volume
  };
}


const blankSequence = new Sequence({ events: [Rest, Rest] as Note[] });
const blankPattern = new Pattern({ values: [Rest, Rest] as Note[] });

/**
 * Describes a tone chain for a particular boid cloud.
 */
export interface CloudAudioChain {
  periodSeconds: number;

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

  private _isPlaying: boolean = false;

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  constructor() {
    // Create a gain node to receive all of the instruments
    this.chainReceiverNode = new Gain();

    // Create cloud instrument chains
    this.cloudChains = [];

    for(let cloudIdx = 0; cloudIdx < cst.CLOUD_COUNT; cloudIdx++) {
      this.cloudChains.push(buildCloudChain(cloudIdx, this.chainReceiverNode));
    }

    // // Drum
    // [this.drumInstrument, this.drumVolume] = buildDrumSampler();
  }
  
  public registerPatterns = async (shouldOverwrite: boolean = true): Promise<void> => {
    return toneLoaded()
      .then(() => {
        for(const cloudChain of this.cloudChains) {
          new Loop(() => {
            cloudChain.baseInstrument.triggerAttack(cloudChain.baseNote);
            cloudChain.chordInstrument.triggerAttack(cloudChain.chordFrequencies);
          }, cloudChain.periodSeconds).start(0);
        }

        // Connect the chain receiver node to the destination
        this.chainReceiverNode.toDestination();

      // // See if we need to initialize or overwrite the drums
      // if (!this.drumPatternInitialized || shouldOverwrite) {
      //   // Dispose existing drum
      //   if (this.drumPatternInitialized) {
      //     this.drumPattern.dispose();
      //   }

      //   this.drumPattern = new Tone.Sequence((time, note) => {
      //     if (note !== Rest) {
      //       this.drumInstrument.triggerAttackRelease(note, 1, time);
      //     } 
      //   }, fullDrumSequence);

      //   this.drumPatternInitialized = true;
      // }
    });
  }

  public startPlayback = async (): Promise<void> => {
    // Ensure patterns are good to go
    await this.registerPatterns(false);

    toneGetDestination().mute = false;

    const toneTransport = toneGetTransport();
    toneTransport.bpm.value = 100;
    toneTransport.start();

    // // Start all patterns
    // this.drumPattern.start(0);
    this._isPlaying = true;
  }
 
  public stopPlayback = (): void =>  {
    // // Stop all sequences
    // if (this.drumPattern.state === 'started') {
    //   this.drumPattern.stop();
    // }

    toneGetDestination().mute = true;
    toneGetTransport().pause();

    this._isPlaying = false;
  }

  public dispose = (): void => {
    this.stopPlayback();

    // if (this.drumPatternInitialized) {
    //   this.drumPattern.dispose();
    //   this.drumPatternInitialized = false;
    // }
  }
}

export default ToneManager;
