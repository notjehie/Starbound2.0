// Every fixed line of dialogue in the game. These are the lines the team records.
// Lines that contain live numbers from the player's mission are built elsewhere
// and are shown as subtitles (they cannot be recorded in advance).
import { reg } from './voice.js';
import { BUDGET } from './catalog.js';
const P = (t, w) => reg('specialist', t, w), A = (t, w) => reg('scientist', t, w), G = (t, w) => reg('engineer', t, w), J = (t, w) => reg('ops', t, w);

export const SPEC = {
  intro: [
    P('Welcome to the Starbound Deep Space Science Centre. I am Godiva, mission specialist for the programme. You are our new mission lead, and we have been expecting you.', 'First meeting at reception'),
    P('Here is why you are here. A survey has flagged a small red star that dims by about a third of one percent, then recovers. It has been seen more than once, but the ground data is patchy.', 'First meeting'),
    P('Dimming like that could mean a planet is passing in front of the star. It could also be the instrument, the atmosphere, or another star in the background. Nobody knows yet. Your mission is to find out what the evidence can support.', 'First meeting'),
    P('This is your access badge. It opens the main corridor. Meet Afia in the Science Laboratory, Lady Paula in the Engineering Bay, and Jehielle in Mission Control. Then come to the Briefing Room for your formal assignment.', 'First meeting'),
  ],
  quizQ: P('Before you go, one question. What exactly are we trying to find out?', 'Quiz question'),
  quizRight: P('Exactly. Does the dimming repeat on a schedule? Keep that question in your head all day.', 'Quiz: correct answer'),
  quizWrong: P('Not quite. We cannot see the planet at all. The question is whether the dimming repeats on a regular schedule.', 'Quiz: wrong answer'),
  briefingReady: P('You have met everyone. The briefing console is in the Briefing Room, first door on the left.', 'After meeting the team'),
  briefingGo: P('The team is ready. Start the briefing at the console in the Briefing Room when you are.', 'Before the briefing'),
  payload: P('You have one budget for everything: instrument, spacecraft and launch. Start with the instrument. Afia is waiting at the payload bench.', 'Payload stage'),
  launch: P('Engineering has signed off. Jehielle runs the launch from Mission Control. Good luck. The whole centre will be watching.', 'Before launch'),
  analysis: P('The data is down. Whatever it shows, report what the evidence supports and nothing more. That is the job.', 'Analysis stage'),
  idle: P('Take your time and look around. Everything in this building exists to support your mission.', 'Any other time'),
  timeUp: P('We are behind schedule. Keep moving, mission lead.', 'When a task timer runs out'),
  resultGood: P('That star goes on the follow-up list tonight. Other telescopes will take it from here. Well done.', 'Result: correct candidate'),
  resultOver: P('We will have to withdraw that claim. Let us look at what the mission can honestly say.', 'Result: overclaim'),
  resultHonest: P('An honest result is a real result. Let us review the mission and see what would change it.', 'Result: any other'),
  brief: [
    P('This briefing sets out what you are being asked to do, why it matters, and how success will be judged. At the end you will be asked to accept the mission.', 'Briefing slide 1'),
    P('Success is a sound scientific conclusion at a sensible cost, delivered on schedule. You will be evaluated on the science returned, how you used resources and time, the engineering, the quality of the observations, communications, and above all on whether your final claim matches the evidence.', 'Briefing slide 7'),
  ],
};
export const AFIA = {
  intro: [
    A('I am Afia. I lead the science team. Let me tell you what we are looking for, because it decides everything you build.', 'First meeting in the laboratory'),
    A('When a planet crosses the face of its star, it blocks a little of the light. We call that a transit. From far away we cannot see the planet. We only see the star get slightly dimmer for a few hours, then return to normal.', 'First meeting'),
    A('The dip we are chasing is about a third of one percent deep and lasts roughly two hours. One dip proves very little. Many things cause a single dip. What matters is whether it repeats on a regular schedule, with the same depth each time.', 'First meeting'),
    A('So the instrument must do two things: measure brightness precisely enough to see the dip above its own noise, and watch for long enough, without big gaps, to catch it happening again. When you have your assignment, come to the payload bench and we will choose one.', 'First meeting'),
  ],
  quizQ: A('Quick check before you go. Why is one dip not enough?', 'Quiz question'),
  quizRight: A('Yes. A single dip has many possible causes. A repeating pattern points to something in orbit.', 'Quiz: correct answer'),
  quizWrong: A('Not quite. One dip can be noise, a pointing slip, or a background star. Only a repeating pattern points to an orbit.', 'Quiz: wrong answer'),
  payloadHint: A('Three instruments are on the pedestals behind me. Use the payload bench to compare them. Look at the noise figure first, then what it costs the spacecraft to carry.', 'Payload stage, nothing chosen'),
  analysis: A('Your measurements are loaded at the analysis station. Look for dips, check whether they repeat, and check the data quality before you believe anything. I will be right there with you.', 'Analysis stage'),
  after: A('Good science is not about getting the exciting answer. It is about claiming exactly what the data supports.', 'After the report'),
  idle: A('Remember the question: does the dimming repeat? Everything we build should serve that.', 'Any other time'),
  accept: A('Response is clean. The instrument is accepted for flight.', 'Payload activation sequence'),
  brief: [
    A('A small, cool star has been seen to dim by about a third of one percent for roughly two hours, on more than one night. Ground telescopes cannot watch continuously, so we do not know whether the dimming repeats on a schedule.', 'Briefing slide 2'),
    A('Regular, repeating dips of equal depth are the signature of something in orbit around the star. Finding that pattern would make this star a strong candidate for follow-up. Finding no pattern is also a result: it tells astronomers not to spend scarce telescope time here.', 'Briefing slide 3'),
    A('This mission can show that dips repeat. It cannot, on its own, confirm a planet. Confirmation needs independent evidence. If the data is weak, the right answer is inconclusive, and that is an acceptable result.', 'Briefing slide 8'),
  ],
};
export const ENG = {
  intro: [
    G('I am Lady Paula, spacecraft systems. Whatever instrument you and Afia choose, my job is to help you put it on a spacecraft that survives launch and actually works up there.', 'First meeting in the Engineering Bay'),
    G('A spacecraft is a set of promises that depend on each other. The instrument needs power. Power needs arrays, and arrays have mass. Mass needs a bigger rocket, and a bigger rocket costs money you might have wanted for the instrument.', 'First meeting'),
    G('There are five subsystems to choose: power, communications, data storage, thermal control and attitude control. Each one has a cheap option and a capable one. Cheap is fine when you understand what you are giving up.', 'First meeting'),
    G('Before launch I run an engineering review. If something does not fit, I will tell you exactly what and why, and you can change it. Come to the assembly terminal once you have a payload.', 'First meeting'),
  ],
  quizQ: G('Tell me this. If you choose a heavier instrument, what happens to the rest of the mission?', 'Quiz question'),
  quizRight: G('Right. More mass means more structure, maybe a bigger rocket, and less budget for everything else.', 'Quiz: correct answer'),
  quizWrong: G('Think again. Every kilogram needs structure to hold it and a rocket to lift it, and both cost budget.', 'Quiz: wrong answer'),
  noPayload: G('Pick the instrument first. I build around it.', 'Payload stage, nothing chosen'),
  startBuild: G('Open the assembly terminal and choose one option for each subsystem, then a launch vehicle. The readout shows the consequences as you go.', 'Spacecraft stage, design incomplete'),
  looksGood: G('From here the design looks like it closes. Request the engineering review at the terminal and I will check it properly.', 'Spacecraft stage, design complete'),
  idle: G('Every kilogram and every watt has to earn its place. That is all engineering is.', 'Any other time'),
  reviewFail: G('The design does not close yet. Nothing is lost. Change it and ask me again.', 'Engineering review failed'),
  reviewPass: G('The numbers close. She is cleared for launch.', 'Engineering review passed'),
  brief: [
    G('Carry a photometer above the atmosphere, hold it steady on the target for up to sixty days, record brightness every thirty minutes, and return those measurements to the ground.', 'Briefing slide 4'),
    G(`The budget is ${BUDGET} million for instrument, spacecraft and launch. Mass must fit the launch vehicle. Power generation must exceed the load with margin. Data must fit the recorder between contacts.`, 'Briefing slide 5'),
  ],
};
export const JEHIELLE = {
  intro: [
    J('I am Jehielle, flight operations. Once your spacecraft leaves the pad, it is ours to fly from this room.', 'First meeting in Mission Control'),
    J('After launch you will choose the working orbit. Low orbit is easy to reach, but the Earth gets in the way of the target on every lap. Higher orbits see the target almost continuously, but they need launch margin and they change how we talk to the spacecraft.', 'First meeting'),
    J('Communications is the part people forget. The spacecraft records data, then sends it down when a ground station is in view. If the recorder fills up before the next contact, new observations are lost. Size the storage and the antenna for the orbit you want.', 'First meeting'),
    J('Things will go wrong in flight. They always do. When they do, I will bring you the options and the consequences, and you will decide. The launch console is at the front of this room when you are cleared.', 'First meeting'),
  ],
  quizQ: J('One for you. What happens if the recorder fills up before the next ground contact?', 'Quiz question'),
  quizRight: J('Correct. New observations have nowhere to go, so they are lost.', 'Quiz: correct answer'),
  quizWrong: J('No. The spacecraft keeps flying, but new observations have nowhere to go and are lost.', 'Quiz: wrong answer'),
  launchGo: J('The vehicle is on the pad and the range is clear. Start the checklist at the launch console at the front of the room. Work it in order. I will call the steps with you.', 'Launch stage'),
  early: J('Come back when you have a design. I will tell you what it means for operations.', 'Before a design exists'),
  idle: J('A calm control room is a prepared control room.', 'Any other time'),
  brief: [J('After launch you choose the orbit and run the mission from the operations console. Expect several problems in flight. Your decisions determine how much of the star’s behaviour is actually recorded.', 'Briefing slide 6')],
  flight: {
    go: J('All stations, this is Flight. We are go for launch.', 'Launch: countdown begins'),
    ignition: J('Ignition sequence start.', 'Launch: T minus 6'),
    liftoff: J('Liftoff. The clock is running.', 'Launch: T zero'),
    steer: J('Guidance is yours. Keep her in the corridor.', 'Launch: steering begins'),
    meco: J('Main engine cut-off. Stand by for staging.', 'Launch: first stage finished'),
    stage: J('Staging confirmed. Second stage is burning.', 'Launch: after stage separation'),
    fairing: J('Fairing is away.', 'Launch: fairing separation'),
    orbit: J('Orbital insertion confirmed.', 'Launch: orbit reached'),
    sep: J('Separation confirmed. Arrays deploying.', 'Launch: spacecraft released'),
    yours: J('Arrays deployed. Power positive. The spacecraft is yours.', 'Launch: complete'),
  },
  ops: {
    acquire: J('First job in orbit: find the target. Lock the telescope onto the guide star.', 'Operations: target acquisition'),
    locked: J('Target locked. Operations begin.', 'Operations: lock achieved'),
    power: J('Flight, we have a solar array fault. Generation is down. I need a decision.', 'Operations: power event'),
    pointing: J('Reaction wheels are building up momentum. I need a decision on pointing.', 'Operations: wheel event'),
    comms: J('The ground network is down. No contacts for several days. I need a decision on data.', 'Operations: outage event'),
    absorbed: J('The design is handling it. No action needed.', 'Operations: event absorbed by the design'),
    done: J('That is the end of the observing campaign. The data is with the science team.', 'Operations: complete'),
  },
  filed: J('Flight to all stations: the science team has filed its result.', 'Result sequence'),
};
// Quick Mission: one line each at the start, then straight to the payload bench.
export const QUICK = {
  scientist: A('I am Afia, science. A small star dims by a third of one percent for about two hours. One dip proves nothing. We need to see it repeat.', 'Quick Mission: opening team call'),
  engineer: G('Lady Paula, spacecraft systems. A heavier telescope can see a smaller dip. It also needs more power and a bigger rocket. Every kilogram has to earn its place.', 'Quick Mission: opening team call'),
  ops: J('I am Jehielle, flight operations. Something will go wrong in flight. When it does, I will bring you the choice, and you will decide.', 'Quick Mission: opening team call'),
  specialist: P('I am Godiva, mission specialist. One rule here: claim only what the evidence supports. Your payload bench is ready.', 'Quick Mission: opening team call'),
  fitted: G('I have fitted a spacecraft around your telescope. Here is what I chose and why. Change anything you like at the assembly terminal.', 'Quick Mission: after choosing telescope and orbit'),
  checklist: J('Flight is working the checklist. Stand by.', 'Quick Mission: launch console'),
};
export const PA = [
  reg('pa', 'Range control reports the launch corridor is clear for today’s window.', 'Background announcement'),
  reg('pa', 'Clean-room protocol is in effect in the Engineering Bay. Garments are required beyond the yellow line.', 'Background announcement'),
  reg('pa', 'Ground station handover in ten minutes. Flight operations staff to Mission Control.', 'Background announcement'),
  reg('pa', 'Science team reminder: calibration frames are due before the end of shift.', 'Background announcement'),
];
export const QUIZ = {
  specialist: { q: SPEC.quizQ, right: SPEC.quizRight, wrong: SPEC.quizWrong, options: ['Whether the dimming repeats on a regular schedule', 'What the surface of the planet looks like', 'How hot the star is'] },
  scientist: { q: AFIA.quizQ, right: AFIA.quizRight, wrong: AFIA.quizWrong, options: ['One dip has many possible causes; only repetition points to an orbit', 'The telescope can only see two dips at a time', 'One dip is always a mistake in the data'] },
  engineer: { q: ENG.quizQ, right: ENG.quizRight, wrong: ENG.quizWrong, options: ['It needs more structure and maybe a bigger rocket, which uses up budget', 'Nothing changes, mass does not matter in space', 'The spacecraft flies faster'] },
  ops: { q: JEHIELLE.quizQ, right: JEHIELLE.quizRight, wrong: JEHIELLE.quizWrong, options: ['New observations are lost until there is room again', 'The spacecraft falls out of orbit', 'The data is sent down automatically'] },
};
