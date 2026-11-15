# STARBOUND

A browser game for the NASA Space Apps Challenge. You lead one space mission from the first briefing to the final scientific assessment: choose the instrument, build the spacecraft, launch it, operate it through faults, then investigate the light curve it returns and decide what the evidence supports.

## Play

1. Unzip the folder.
2. Open `index.html` in a current desktop browser (Chrome, Edge, Firefox or Safari). No install and no internet connection are needed.

If your browser blocks local files, serve the folder instead: `python3 -m http.server 8080`, then open `http://localhost:8080`.

### Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Move | W A S D or arrow keys (Shift to sprint). Your avatar turns to face the way it walks | Touch anywhere on the left: a thumbstick appears under your thumb |
| Camera | Click the view, then move the mouse (Esc releases it). Mouse wheel zooms; zoom all the way in for first person | Drag anywhere else to turn the camera. Pinch to zoom |
| Jump | Space | Jump button |
| Interact | Walk up to something; a prompt appears. Press E or Enter | Walk up to something, then tap the amber button |
| Switch camera (see your avatar or first person) | V, or Settings | Settings |
| Settings | P, or the Settings button | Settings button |

Sound is off by default (Settings, Audio, to turn it on). Assist level (Guided, Standard, Independent), task timers (On, Relaxed, Off), volumes, look sensitivity, graphics quality and reduced motion are in Settings. Progress saves automatically in the browser.

## Two ways to play

Chosen on the second step of the avatar creator. Both use the same simulation, the same investigation and the same report.

| | Quick Mission (default, about 10 minutes) | Full Mission (about 40 minutes) |
| --- | --- | --- |
| Opening | A 20-second team call: one line from each crew member | Walk the centre, meet each crew member, attend the briefing |
| Design | Choose the telescope, then the orbit by how many dips it should catch. Lady Paula fits a spacecraft that passes review and explains each choice; anything can still be changed at the assembly terminal | Choose all five subsystems and the rocket yourself and pass the engineering review |
| Launch | Jehielle works the checklist; you steer the rocket and command staging | You work the checklist, then steer and stage |
| Flight | Orbit already chosen. One decision is yours; the rest are handled or absorbed by the design | Choose the orbit, then decide all three in-flight events |
| Investigation and report | Same | Same |

In Quick Mission the centre, the crew conversations and the briefing console are all still there to explore, but nothing requires them.

## What makes it a game

- **Your own mission lead.** The game opens with an animated welcome, then an avatar creator: name, skin tone, hair style and colour, uniform and build. You see your avatar walking in the centre (press V for first person).
- **Mission points and ranks.** Almost everything earns points: meeting the crew, answering their questions, inspecting equipment, finishing tasks on time, flying well, good decisions, and a claim that matches the evidence. Running over a task timer costs 10 points every 10 seconds. The report shows the total, a rank from Trainee to Starbound Commander, and where every point came from.
- **Crew questions.** Each crew member asks one multiple-choice question after introducing themselves.
- **Six hidden mission patches**, one per room, each with a real space fact.
- **Fly the rocket.** During first-stage ascent you steer to keep the rocket in its guidance corridor (A and D, or on-screen arrows). Poor steering costs up to 8 points of launch margin, which can put higher orbits out of reach. You then command stage separation yourself; faster is worth more.
- **Lock the telescope.** In orbit you steer a reticle onto the guide star before observations begin. A cheap pointing system makes the view wander more.

## The crew and their voices

| Character | Role | Voice files |
| --- | --- | --- |
| Godiva | Mission Specialist | `godiva_01` to `godiva_20` |
| Afia | Principal Scientist | `afia_01` to `afia_16` |
| Lady Paula | Spacecraft Systems Engineer | `paula_01` to `paula_17` |
| Jehielle | Flight Operations Lead | `jehielle_01` to `jehielle_31` |
| Announcements | Any voice | `pa_01` to `pa_04` |

`VOICE_SCRIPT.md` lists every line with its file name. To add recordings: put the audio files (.mp3, .m4a or .wav) in `audio/voice/`, then run `python3 tools/update_voice_manifest.py`. The game plays a recording when one exists. Until then it uses the browser's synthetic voice. Lines that contain live numbers from the player's mission cannot be recorded and are shown as subtitles. Do not edit or reorder lines in `src/lines.js` after recording, or the file names will no longer match.

## Task timers

Every task has a countdown, shown at the top right. When it reaches zero the player can still finish, but the overrun is flagged and lowers the Schedule score in the mission report. The timer pauses in Settings and during cinematic sequences, including the launch flight.

| Task | Time allowed |
| --- | --- |
| Check in at reception | 1:30 |
| Meet the mission team | 4:00 |
| Attend the briefing | 3:00 |
| Choose the payload | 4:00 |
| Configure the spacecraft and pass review | 7:00 |
| Complete the launch checklist | 3:00 |
| Select the orbit | 2:00 |
| Run mission operations | 7:00 |
| Investigate the data and submit an assessment | 8:00 |

On time, a full run takes at most about 40 minutes plus the launch. To change a limit, edit `TASK_LIMITS` in `src/science.js` and run `npm run build`.

## The five levels

| Level | Where | What you do |
| --- | --- | --- |
| 1. A day at the space centre | Six rooms, first person | Meet four crew, inspect equipment, attend the briefing, accept the mission |
| 2. Payload design | Science Laboratory, payload bench | Compare three instruments; see budget, mass, power and a predicted observation change |
| 3. Spacecraft and launch | Engineering Bay, then Mission Control | Choose five subsystems and a launch vehicle, pass the engineering review, work the launch checklist, fly the ascent |
| 4. Orbit and operations | In orbit | Choose an orbit, run 60 days of operations, decide how to handle three events: a solar array fault, a reaction wheel build-up and a ground network outage |
| 5. Results and discovery | Science Laboratory, analysis station | Mark dips, find the period by folding, check data quality, compare a second record, open the 3D star view driven by your result, submit an assessment, read the mission report |

Everything runs from one mission state (`src/state.js`). Examples of real links between levels:

- Instrument noise and pointing choice set the noise on every measurement you later analyse.
- Spacecraft mass and launch vehicle set the launch margin, which changes the ascent and decides which orbits can be reached.
- Orbit, recorder size, antenna, pointing system and your decisions during the three events decide which measurements exist in Level 5. Gaps in the plot are your gaps.
- The report re-runs the operations simulation with other choices to tell you what a different decision would have returned.

## What is real and what is simulated

- **Light-curve data: SIMULATED in this build.** The build environment could not reach NASA's MAST archive, so no real TESS or Kepler files are bundled. The game generates a dataset modelled loosely on the TOI-700 system and labels it "SIMULATED DATASET" everywhere it appears, including the provenance panel and the final report. It is never presented as NASA data.
- **Using real TESS data:** `tools/prepare_tess_data.py` downloads SPOC light curves of TOI-700 (TIC 150428135) from MAST, bins them to the game's 30-minute grid and writes `data/real_data.js` with full provenance. The game then switches to it automatically and the badge reads "REAL TESS OBSERVATIONS". **This script has not been run or validated**, because the archive was unreachable when it was written. Check its output before a demo.
- **Engineering numbers** (instruments, subsystems, rockets, budget) are simplified game parameters and are labelled as such in the game. The launch vehicles are fictional.
- **Published values used for modelling** (TOI-700 b about 9.98 days, c about 16.05 days and about 2.6 Earth radii) come from Gilbert et al. 2020 and the NASA Exoplanet Archive overview for TOI-700: https://exoplanetarchive.ipac.caltech.edu/overview/TOI-700
- The game never claims a real discovery. Choosing "a new planet has been confirmed" is scored as an overclaim.

## Tests

| Test | Command | What it covers |
| --- | --- | --- |
| Simulation logic | `npm test` | Successful mission, engineering failure, event decisions changing the outcome, poor-science outcome, efficient mission scoring, determinism |
| Quick Mission play-through | `node tests/quick.mjs` | Drives the Quick Mission from title screen to report and checks that exactly one in-flight decision is asked |
| Full play-through | `node tests/browser.mjs` (add `--mobile` for a phone-sized touch run) | Drives the real game in headless Chrome from title screen to report, then a deliberately weak mission that must end inconclusive, then replay and reload. Fails on any browser console error |

Both need `npm install` first (dev tools only: esbuild, three, puppeteer-core). The play-through test expects Chrome at `/usr/bin/google-chrome`.

## Project layout

```
index.html, styles.css      page shell and interface styles
dist/starbound.js           built game (Three.js bundled; this is what index.html loads)
data/real_data.js           empty hook for real observations
src/state.js                the single mission state, save and reset
src/catalog.js              instruments, subsystems, vehicles, orbits (game parameters)
src/engineering.js          totals, validation, orbit availability
src/ascent.js               ascent profile from mass, vehicle and margin
src/ops.js                  60-day operations simulation and the two events
src/science.js              datasets, folding, evidence evaluation, scoring
src/centre.js               the space centre: rooms, collision, doors, crew, screens
src/lines.js                every recordable line of dialogue (do not reorder after recording)
src/voice.js                recorded-voice playback with synthetic-voice fallback
src/points.js               mission points and ranks
src/quick.js                Quick Mission planner: auto-fitted spacecraft and orbit predictions
src/dialogue.js             crew dialogue, briefing, inspection text
src/design.js               payload bench and assembly terminal
src/launch.js               checklist and launch sequence
src/space.js                orbit selection and operations console
src/analysis.js             light-curve tools, discovery sequence, report
src/builders.js             procedural models and textures
src/engine.js, input.js, audio.js, ui.js, main.js
tools/prepare_tess_data.py  real-data pipeline (not yet run)
```

Rebuild after editing source: `npm install`, then `npm run build`.

## Known limits and remaining work

- Real TESS and Kepler data are not bundled (see above). The comparison record is also simulated.
- No voice recordings are bundled yet. The recording script and the playback system are ready (see above), but playback of real recordings has not been tested with real files. Until recordings are added, the browser's synthetic voice is used. No sound of any kind has been heard in testing.
- All models are procedural (no external art assets). People and rooms are clean and readable but stylised, not film-quality.
- Short skippable sequences cover arrival, payload activation, spacecraft integration, the launch and the result. They are camera moves with captions, not animated films.
- Tested in headless Chrome with software rendering, at desktop and phone sizes. Not yet tested on physical phones or in Safari and Firefox.
- The orbit is chosen after launch (as in the level plan), so the launch always goes to a parking orbit first.
