import * as Tone from 'tone';
import { Note } from 'tone/build/esm/core/type/NoteUnits';
import { Instrument, InstrumentOptions } from 'tone/build/esm/instrument/Instrument';

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

function buildInstrumentChain<T extends Instrument<InstrumentOptions>>(instrument: T, effectChain: Tone.InputNode[] = []): [ instrument: T, output: Tone.Volume ] {
  // Create a volume node and connect it to the main destination
  const volumeOutput = new Tone.Volume()
  volumeOutput.toDestination();

  // Connect the effect chain if defined
  if (effectChain && effectChain.length > 0) {
    instrument.chain(...effectChain.concat([volumeOutput]));
  }
  else {
    instrument.connect(volumeOutput);
  }

  return [instrument, volumeOutput]; 
}

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

  return buildInstrumentChain(sampler, effectChain);
}

function buildStrings(...effectChain: Tone.InputNode[]): [ instrument: Tone.AMSynth, output: Tone.Volume ] {
  const strings = new Tone.AMSynth();

  return buildInstrumentChain(strings, effectChain);
}

function buildBass(...effectChain: Tone.InputNode[]): [ instrument: Tone.DuoSynth, output: Tone.Volume ] {
  const bass = new Tone.DuoSynth();

  return buildInstrumentChain(bass, effectChain);
}

const drumPatternsArray: (Note | Note[])[][] = [
  [Bass, Rest, Bass, Rest, Bass, Rest, Bass, Rest],
  [Bass, Rest, [LowTom, Bass], Rest, [MidTom, Bass], Rest, [HighTom, Bass], Snare],
  [Bass, Rest, [LowTom, Bass], Snare, [MidTom, Bass], Snare, [LowTom, Bass], Snare]
  // [Bass, Rest, LowTom, Rest, Snare, Rest, LowTom, Rest, Bass, Rest, LowTom, Rest, Snare, Rest, MidTom, HighTom],
  // [Bass, Rest, [ClosedHat, Snare], Rest, Bass, Rest, [ClosedHat, Snare], Rest, Bass, OpenHat, Bass, Rest, Crash, HighTom, MidTom, LowTom]
];

const fullDrumSequence = drumPatternsArray.flat(1);

const blankSequence = new Tone.Sequence({ events: [Rest, Rest] as Note[] });
const blankPattern = new Tone.Pattern({ values: [Rest, Rest] as Note[] });

class ToneManager {

  public stringInstrument: Tone.AMSynth;

  public stringDelay: Tone.PingPongDelay;

  public stringVolume: Tone.Volume;

  public stringPattern: Tone.Pattern<Note> = blankPattern;

  private stringPatternInitialized: boolean = false;

  public drumInstrument: Tone.Sampler;

  public drumVolume: Tone.Volume;

  public drumPattern: Tone.Sequence<Note> = blankSequence;

  private drumPatternInitialized: boolean = false;

  public bassInstrument: Tone.DuoSynth;

  public bassVolume: Tone.Volume;

  public bassPattern: Tone.Sequence<Note> = blankSequence;

  private bassPatternInitialized: boolean = false;

  private _isPlaying: boolean = false;

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  constructor() {
    // Drum
    [this.drumInstrument, this.drumVolume] = buildDrumSampler();

    // String
    this.stringDelay = new Tone.PingPongDelay('2n', 0.15);
    [this.stringInstrument, this.stringVolume] = buildStrings(this.stringDelay);

    // Bass
    [this.bassInstrument, this.bassVolume] = buildBass();
  }
  
  public registerPatterns = async (shouldOverwrite: boolean = true): Promise<void> => {
    const stringNotes = ['C3', 'D3', 'C2', 'C4'] as Note[];
    const bassNotes = ['C2', 'C2', Rest, 'B2', 'B2', Rest, 'A2', 'D2', 'A2', Rest] as Note[];

    return Tone.loaded()
      .then(() => {

      // See if we need to initialize or overwrite the strings
      if (!this.stringPatternInitialized || shouldOverwrite) {
        // Dispose existing string
        if (this.stringPatternInitialized) {
          this.stringPattern.dispose();
        }

        this.stringPattern = new Tone.Pattern((time, note) => {
          if (note !== Rest) {
            this.stringInstrument.triggerAttackRelease(note, '4n', time);
          }   
        }, stringNotes, 'upDown');

        this.stringPattern.interval = '16n';
        this.stringPatternInitialized = true;
      }

      // See if we need to initialize or overwrite the drums
      if (!this.drumPatternInitialized || shouldOverwrite) {
        // Dispose existing drum
        if (this.drumPatternInitialized) {
          this.drumPattern.dispose();
        }

        this.drumPattern = new Tone.Sequence((time, note) => {
          if (note !== Rest) {
            this.drumInstrument.triggerAttackRelease(note, 1, time);
          } 
        }, fullDrumSequence);

        this.drumPatternInitialized = true;
      }
  
      // See if we need to initialize or overwrite the bass
      if (!this.bassPatternInitialized || shouldOverwrite) {
        // Dispose existing bass
        if (this.bassPatternInitialized) {
          this.bassPattern.dispose();
        }

        this.bassPattern = new Tone.Sequence((time, note) => {
          if (note !== Rest) {
            this.bassInstrument.triggerAttackRelease(note, '4n.', time);
          }
        }, bassNotes);

        this.bassPatternInitialized = true;
      }
    });
  }

  public startPlayback = async (): Promise<void> => {
    // Ensure patterns are good to go
    await this.registerPatterns(false);

    // Start all patterns
    this.drumPattern.start(0);
    this.stringPattern.start(0);
    this.bassPattern.start(0);
    this._isPlaying = true;
  }
 
  public stopPlayback = (): void =>  {
    // Stop all sequences
    if (this.drumPattern.state === 'started') {
      this.drumPattern.stop();
    }

    if (this.bassPattern.state === 'started') {
      this.bassPattern.stop();
    }

    if (this.stringPattern.state === 'started') {
      this.stringPattern.stop();
    }

    this._isPlaying = false;
  }

  public dispose = (): void => {
    this.stopPlayback();

    if (this.drumPatternInitialized) {
      this.drumPattern.dispose();
      this.drumPatternInitialized = false;
    }

    if (this.bassPatternInitialized) {
      this.bassPattern.dispose();
      this.bassPatternInitialized = false;
    }

    if (this.stringPatternInitialized) {
      this.stringPattern.dispose();
      this.stringPatternInitialized = false;
    }
  }
}

export default ToneManager;
