# Five-Star "Wait, What?" Projects

> Four laptop/phone-only software projects with maximum "you can do that with just my webcam?" energy. Each one re-decodes a signal your device already captures but throws away.

## The unifying pattern

Every laptop and phone is roughly fifteen sensors duct-taped together. Each sensor was designed for one narrow job (the gyro keeps your screen upright; the webcam lets you Zoom). But each sensor's *raw* output also encodes a side channel about the physical world it was never marketed to see. These four projects all live in that gap between **what the device was designed to do** and **what its signal actually contains.**

The recipe each time:

1. Pick an ambient signal your laptop/phone already captures.
2. Decode the part that gets rounded to noise or filtered out.
3. Surface it as a real-time demo that runs entirely on-device.
4. Privacy-by-construction — no data leaves the user's machine.

---

## 1. MotionMag — See your pulse in your face (Eulerian Video Magnification)

### Pitch
Open a web page, point your webcam at yourself, and watch your face pulse red-green-red-green in real time at exactly your heart rate. You weren't visibly moving. The information was always there.

### The discarded signal
Sub-pixel motion and sub-percent color changes that JPEG, codecs, and human eyes all round to noise. Skin reddens by roughly 0.5% with each heartbeat as oxygenated blood pulses through capillaries. Your chest rises by less than a millimeter when you breathe shallowly. Buildings sway by fractions of a pixel in the wind. Guitar strings vibrate at sub-pixel amplitudes between video frames.

### How it works
1. Capture webcam frames at 30fps.
2. Build a Gaussian pyramid per frame (decompose into spatial frequency bands).
3. Apply a temporal bandpass filter to each pixel across time — for pulse, keep only the 0.8–2.5 Hz band (50–150 BPM).
4. Multiply the filtered band by a large gain (α ≈ 50–100).
5. Add the amplified signal back to the original frame.
6. Display side-by-side: raw video and the magnified version.

For pulse specifically, you can also extract the scalar trace from the forehead ROI and display the BPM as a number.

### Real precedent
- MIT CSAIL paper, Wu et al. 2012, "Eulerian Video Magnification for Revealing Subtle Changes in the World." Reference MATLAB code published.
- Follow-up paper Wadhwa et al. 2013 introduced phase-based magnification (cleaner for motion, more expensive).
- Multiple open-source ports exist (Python/OpenCV, JavaScript/WebGL), but none packaged for the modern "open a URL, see your pulse" experience.

### Killer demo
A static webpage. User clicks "start." Their webcam feed appears split-screen — left side raw, right side amplified. Their face is visibly pulsing red on the right. A BPM counter ticks up in the corner. They send the link to a friend.

### Why it's the build target
- **Visual** — the demo is a GIF, not an explanation.
- **Browser-only** — runs on phone Safari too.
- **Modular** — the same pipeline supports a whole catalog of "magnify X" effects (breathing, hand tremor, guitar string, flag in wind, baby monitor mode).
- **No prior art has shipped it well** — the academic code is unmaintained, the JS ports are toy-grade, and nothing has the RuView-style "open it and be amazed" packaging.

### Difficulty
- MVP (pulse magnification + BPM): **~2 weekends**.
- Polished catalog of 5+ effects: **~3–4 weeks part-time**.

### Open problems
- Real-time performance on phones requires GPU shaders (WebGL or WebGPU).
- Motion magnification (vs. color) needs phase-based pipeline — more involved.
- Lighting sensitivity: fluorescent flicker at 60Hz can swamp the pulse band if you don't filter carefully.

---

## 2. ENFView — Geolocate and timestamp any audio recording from mains hum

### Pitch
"Send me any audio file longer than ten minutes. I'll tell you which country it was recorded in and the exact minute it was recorded, accurate to under a minute. I won't listen to a word of it."

### The discarded signal
Every electrical grid hums at a nominal 50 Hz (most of the world) or 60 Hz (North America, parts of Asia). But the *exact* frequency drifts by a few millihertz second-by-second based on national grid load — when everyone turns on a kettle, the frequency dips microscopically. This is called the Electric Network Frequency (ENF). It leaks into every microphone on Earth — including the one in your phone, your laptop, the recorder on a body cam, the mic on a Zoom call. Grid operators publish historical ENF traces at 1-second resolution, going back years.

If you extract the 50/60 Hz band from any recording, you get a fingerprint. Match it against published grid traces, and you've localized the recording in time (to under a minute) and space (to which grid synchronous region).

### How it works
1. Resample the input audio to a known sample rate (1 kHz is plenty).
2. Bandpass filter around 50 Hz (or 60 Hz) with a narrow window (±0.5 Hz).
3. Extract the instantaneous frequency over time (using STFT phase, Hilbert transform, or zero-crossing).
4. You now have a 1-Hz time series of frequency deviations.
5. Cross-correlate against published grid frequency databases (e.g., the UK National Grid, ENTSO-E for continental Europe, EIA / FNET for the US Eastern and Western Interconnects).
6. Peak correlation → exact recording time and grid region.

### Real precedent
- ENF analysis is courtroom-grade evidence. Used in UK criminal trials since ~2009.
- Multiple academic groups (Drexel, University of Surrey, Maryland) publish reference implementations.
- ENF-Enabled Authentication is a small but established research subfield.

### Killer demo
Upload an audio file. The page shows:
- Detected grid region (UK / continental Europe / Eastern US / Western US / etc.)
- Exact recording timestamp with confidence interval
- A graph of the extracted ENF trace overlaid on the matching grid history.

Show it working on a podcast episode and a leaked tape, side-by-side.

### Difficulty
- MVP (single grid region, manual upload): **~1 weekend**.
- Multi-grid auto-detection with cross-correlation: **~1 week**.
- Main effort is acquiring + caching the public grid frequency databases.

### Open problems
- Recordings need to be at least 5–10 minutes to get a unique fingerprint.
- Highly compressed audio (low-bitrate MP3, voice codecs) destroys the ENF signal.
- Some indoor environments are too far from mains-powered devices to pick up the hum cleanly.

---

## 3. GyroEar — Your gyroscope is a (terrible) microphone

### Pitch
A webpage that transcribes spoken digits without ever requesting microphone permission. It's reading them off the phone's gyroscope.

### The discarded signal
MEMS gyroscopes on modern phones sample at 100–200 Hz, which puts them well into the audible frequency range for vowels and consonants. Gyroscopes are mechanical resonators — they're literally tiny vibrating combs. Sound waves in the room physically vibrate them, contaminating the rotation signal with acoustic data.

Most operating systems treat the gyro as a "non-sensitive" sensor and let websites and apps read it with no permission prompt. The microphone requires explicit permission. The gyroscope is, in effect, an unguarded back door to a (low-quality) microphone.

### How it works
1. Use the browser `DeviceMotionEvent` or `Sensor.Gyroscope` API to stream gyro readings at maximum rate (usually 60–100 Hz).
2. Treat the three axes as three audio channels at a very low sample rate.
3. Bandpass filter and resample.
4. Train a small CNN on speech digit data downsampled to gyro-rate (TIDIGITS or Speech Commands dataset).
5. Run inference on the gyro stream in real time.

Accuracy will be poor — high-teens to mid-30s percent word accuracy depending on phone model — but recognizable, especially for restricted vocabularies like digits.

### Real precedent
- Michalevsky, Boneh, Nakibly (Stanford, USENIX Security 2014), "Gyrophone: Recognizing Speech From Gyroscope Signals." This is the seminal paper.
- Followed up by multiple groups demonstrating similar attacks on accelerometers, magnetometers, and even GPU power state.
- Browsers have *partially* mitigated this by capping motion sensor rates (iOS Safari requires explicit permission since iOS 12.2, but on Android Chrome it remains accessible).

### Killer demo
Open a webpage on a phone. Place phone on a hard surface. Speak digits "zero through nine" near the phone. Watch the page display its best guess for each digit. No permission prompts were issued.

### Difficulty
- MVP (digit recognition with pre-trained model): **~1 week** (most effort is data prep and a small CNN).
- Polish: **~2 weeks**.
- The hardest part is getting clean training data — you need to record audio + simultaneous gyro from the same device.

### Open problems
- iOS Safari now requires permission for motion sensors (post iOS 12.2) — so the "no permission" punch only fully lands on Android Chrome.
- Performance varies wildly between phone models.
- Real speech (not isolated digits) is much harder; intelligible-speech recovery from gyro alone is still an open research problem.

---

## 4. VisualMic — Recover audio from silent video of a vibrating object

### Pitch
Film a houseplant on your desk while music plays. Send the silent video file to a friend. Their copy of the page recovers the music from the leaf wobble.

### The discarded signal
Sound waves are pressure waves. Pressure waves vibrate any object they hit — by microns, but they vibrate it. A high-speed camera (or even a slow-mo phone camera at 240fps) can resolve those sub-pixel vibrations. Recover the vibration time series, and you've recovered the audio that caused it.

### How it works
1. Record video of a vibrating object at high frame rate (slow-mo on modern phones is 240fps; 1000fps cameras are better but optional).
2. For each frame, compute the local phase via a complex steerable pyramid (or simpler: optical flow on edges).
3. Sum the per-pixel phase changes over time at each spatial scale.
4. The summed time series is your audio reconstruction.
5. Bandpass and resample to audio rate.

The MIT original demonstrated intelligible speech recovery from a chip bag filmed through soundproof glass at 4.5 meters distance, using a 2200fps camera. With a 240fps iPhone, you get muffled-but-recognizable audio for music and loud speech.

### Real precedent
- Davis, Rubinstein, Wadhwa et al. (MIT CSAIL, SIGGRAPH 2014), "The Visual Microphone: Passive Recovery of Sound from Video."
- The original paper's demo video — chip bag through glass — was viral in 2014.
- A few academic re-implementations exist; nothing consumer-facing.

### Killer demo
Two-pane page. Left pane: drag-and-drop a slow-mo video file of any object near a speaker. Right pane: the recovered audio waveform plays back. Show it working on chip bag, leaf, glass of water, candle flame.

### Difficulty
- MVP (works on pre-recorded slow-mo, single object, music recovery): **~2 weeks**.
- Real-time webcam capture of vibrations: **~1 month** (240fps webcam capture is uncommon).
- Phase-based pipeline is mathematically heavy — expect to spend most of the time on the FFT/steerable-pyramid code, not the UI.

### Open problems
- Most webcams cap at 30–60fps, which is insufficient for speech (need at least 2× the audio bandwidth you want to recover).
- iPhone slow-mo at 240fps works but recording is limited to short clips.
- Reconstruction quality drops dramatically with cluttered backgrounds.

---

## Comparison

| Project | "Wait what" | Build complexity | Phone-compatible | Demo-in-a-tweet | Hero visual |
|---|:-:|:-:|:-:|:-:|:-:|
| **MotionMag** | ★★★★★ | Low–Med | Yes | ★★★★★ | Pulsing face |
| **ENFView** | ★★★★★ | Low | Audio upload | ★★★ | Hum waveform |
| **GyroEar** | ★★★★★ | Med | Android only | ★★★★ | Digit transcription |
| **VisualMic** | ★★★★★ | High | Partial | ★★★★ | Plant → music |

## Selected build target: **MotionMag**

Of the four, MotionMag wins on every dimension that matters for a side-project that goes viral:

1. **The hero shot is instant and visual.** A 5-second GIF of a pulsing face explains the whole project. ENF needs charts; Gyro needs audio; VisualMic needs a back-and-forth.
2. **Cross-device.** Runs on any phone or laptop with a webcam. No platform restrictions.
3. **Modular catalog matches the RuView pattern.** One pipeline, many "cogs": pulse, breath, tremor, vibration, micro-expression, infant monitor.
4. **Reference implementation exists.** MIT's MATLAB code is public — porting is engineering, not research.

Full project plan lives in `/PROJECT_PLAN.md`. Architectural decisions in `/DECISIONS.md`. Running state in `/MEMORY.md`.
