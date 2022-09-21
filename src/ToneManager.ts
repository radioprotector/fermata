import * as Tone from 'tone';
import { PolySynth } from 'tone';
import { Note } from 'tone/build/esm/core/type/NoteUnits';
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

function buildDrumSampler(...effectChain: Tone.InputNode[]): [ instrument: Tone.Sampler, output: Tone.Volume ] {
  const sampler = new Tone.Sampler({
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
  const volumeOutput = new Tone.Volume()
  volumeOutput.toDestination(); 

  // Connect the effect chain if defined
  if (effectChain && effectChain.length > 0) {
    sampler.chain(...effectChain.concat([volumeOutput]));
  }
  else {
    sampler.connect(volumeOutput);
  }

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

function buildCloudChain(cloudIdx: number): CloudAudioChain {
  // Determine the base note to use
  const baseNote = cst.CLOUD_BASE_NOTES[cloudIdx];
  const noteHarmonies = Tone.Frequency(baseNote).harmonize([0, 4, 7]).map((fc) => fc.toFrequency());

  // Create a volume node and connect it to the main destination
  const volume = new Tone.Volume(-20);
  volume.toDestination();

  // Create a reverb node and connect it to the volume output
  const reverb = new Tone.Reverb(cloudIdx * 0.5);
  reverb.wet.value = 0;
  reverb.connect(volume);

  // Create a cross-fade for the chord and polysynth
  const crossFade = new Tone.CrossFade(0);
  crossFade.connect(reverb);

  // Create a base instrument
  const baseInstrument = new Tone.AMSynth();
  baseInstrument.triggerAttack(baseNote);
  baseInstrument.connect(crossFade.a);

  // Create a polysynth for the chord
  const chordInstrument = new Tone.PolySynth(Tone.AMSynth);
  chordInstrument.triggerAttack(noteHarmonies);
  chordInstrument.connect(crossFade.b);

  return {
    baseInstrument,
    chordInstrument,
    crossFade,
    reverb,
    volume
  };
}


const blankSequence = new Tone.Sequence({ events: [Rest, Rest] as Note[] });
const blankPattern = new Tone.Pattern({ values: [Rest, Rest] as Note[] });

/**
 * Describes a tone chain for a particular boid cloud.
 */
export interface CloudAudioChain {
  baseInstrument: Instrument<InstrumentOptions>;

  chordInstrument: PolySynth;

  crossFade: Tone.CrossFade;

  reverb: Tone.Reverb;

  volume: Tone.Volume;
}

class ToneManager {

  public readonly cloudChains: CloudAudioChain[];

  private _isPlaying: boolean = false;

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  constructor() {
    // Create cloud instrument chains
    this.cloudChains = [];

    for(let cloudIdx = 0; cloudIdx < cst.CLOUD_COUNT; cloudIdx++) {
      this.cloudChains.push(buildCloudChain(cloudIdx));
    }

    // // Drum
    // [this.drumInstrument, this.drumVolume] = buildDrumSampler();
  }
  
  public registerPatterns = async (shouldOverwrite: boolean = true): Promise<void> => {
    // const stringNotes = ['C3', 'D3', 'C2', 'C4'] as Note[];
    // const bassNotes = ['C2', 'C2', Rest, 'B2', 'B2', Rest, 'A2', 'D2', 'A2', Rest] as Note[];

    return Tone.loaded()
      .then(() => {
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

    Tone.Destination.mute = false;
    Tone.Transport.bpm.value = 100;
    Tone.Transport.start();

    // // Start all patterns
    // this.drumPattern.start(0);
    this._isPlaying = true;
  }
 
  public stopPlayback = (): void =>  {
    // // Stop all sequences
    // if (this.drumPattern.state === 'started') {
    //   this.drumPattern.stop();
    // }

    Tone.Destination.mute = true;
    Tone.Transport.pause();

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
