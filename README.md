# fermata

fermata is a browser-based flocking simulation incorporating 3D rendering and dynamic audio.

This project is implemented using the following libraries:

- [React](https://reactjs.org/)
- [three.js](https://threejs.org/) and corresponding helper libraries:
  - [react-three-fiber](https://docs.pmnd.rs/react-three-fiber)
  - [drei](https://docs.pmnd.rs/drei)
- [Tone.js](https://tonejs.github.io/)
- [zustand](https://docs.pmnd.rs/zustand)

This project is written in TypeScript and makes use of [the Hooks API](https://reactjs.org/docs/hooks-intro.html). All primary components use the [functional component style](https://reactjs.org/docs/components-and-props.html#function-and-class-components). It was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

Because web workers produce flocking data up to 30 times per second, the Zustand store is not used to store any information derived from the flocking calculations. Instead, it primarily stores "configuration" options altered via the HTML-based `InterfaceControls` component.

## Flocking Simulation

The flocking logic is modeled on [Craig Reynolds' Boids algorithm](https://en.wikipedia.org/wiki/Boids). [Conrad Parker had an extremely useful guide](https://vergenet.net/~conrad/boids/pseudocode.html) that I frequently referred to during development.

This flocking logic was also expanded with:

- Variable oscillation between attraction to/repulsion from the perceived center of mass (Boid Rule 1)
- "Bounds" to keep boids within a defined volume
- "Inner bounds" used to keep boids out of a defined center of the available range
- Attraction to the initial boid positions provided to the web worker

There are technically two different levels of flocking taking place:

1. Flocking *within* individual clouds (6 in total), each of which is represented by a `BoidCloud` component
2. Flocking *of* those 6 clouds, which is represented by a `BoidCloudContainer` component

These share the same logic, but differ in parameters including:

- The intensity with which the center of mass' attraction/repulsion force is applied
- The period and biasing used for oscillation of the attraction/repulsion force
- The distance threshold for which boids are considered "adjacent" and attempt to distance from each other
- The intensity with which boids match velocity to each other
- The intensity with which boids are attracted to their initial positions (_optional_)
- The bounds over which boids can move
- The "inner" bounds which boids cannot move (_optional_)
- The intensity with which boids are repelled from the aforementioned bounds/inner bounds
- The maximum velocity of any one boid

Each individual boid cloud is assigned a base color and oscillation period.

### Web Worker Use

To minimize the impact on the main UI thread, the actual flocking for each cloud is performed in a separate `boidsWorker.ts` web worker. The messages sent to and received from the web worker are documented in the `workerInterface.ts` file.

The web worker, once initialized, will operate on an array of boid positions and transmit those to the main animation thread in its corresponding `BoidCloudContainer` or `BoidCloud` component. To ensure efficiency of communication, each flocking result is communicated using [transferable position arrays](https://developer.mozilla.org/en-US/docs/Glossary/Transferable_objects). 

Each transmitted flocking result includes the calculated center-of-mass and the standard deviations for each position dimension. When each boid in a cloud is updated, its color is varied based on its distance from the calculated center-of-mass.

"Reset" requests are signaled to the web worker and incorporated in its next flocking simulation round.

### Audio 

Each boid cloud is assigned a base note, a corresponding major triad chord, and a waveform to use. These are used to create an audio "chain" representing that cloud. Each chain includes:

- A standard instrument tuned to the base note
- A polyphonic instrument tuned to the chord notes
- A cross-fade node to mix between the two instruments
- An effect node for the cross-faded result
- A volume node for the entire chain

As the flocking simulation proceeds, tonal qualities are altered based on the state of the simulation:

- **Chain volume** is based on the distance between the center of the bounds and the center of the simulation (_set via `BoidCloudContainer`_)
- **Chord prominence** is based on the variance between the center of the bounds and the center of mass (_set via `BoidCloud`_)
- **Effect intensity** is based on the amount of "dispersal" (measured via standard deviation) within the cloud (_set via `BoidCloud`_)
