
import { useRef } from 'react';

import * as Tone from 'tone';
import { Note } from 'tone/build/esm/core/type/NoteUnits';

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

function buildSampler(): Tone.Sampler {
  return new Tone.Sampler({
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
  }).toDestination();
}

function MusicPlayer(): JSX.Element {
  const samplerInstrument = useRef<Tone.Sampler>(buildSampler());
  const stringInstrument = useRef<Tone.PluckSynth>(new Tone.PluckSynth().toDestination());

  Tone.loaded().then(() => {
    const drumPattern = new Tone.Sequence((time, note) => {
      samplerInstrument.current.triggerAttackRelease(note, 0.25, time);
    }, [Bass, [Bass, LowTom], Bass, [Bass, MidTom], Bass, [Bass, LowTom], Bass, [Bass, MidTom]]).start(0);
  });

  const synthPattern = new Tone.Pattern((time, note) => {
    stringInstrument.current.triggerAttack(note, time);
  }, ["C2", "D2", "C1", "C3"], "up").start(0);
  synthPattern.interval = "8n";

  return (
    <div>
      hi
    </div>
  );
}

export default MusicPlayer;
