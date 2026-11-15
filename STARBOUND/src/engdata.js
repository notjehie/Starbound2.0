// Spacecraft engineering model. The formulas are the real first-order ones engineers use
// (rocket equation, solar-array sizing, radiator balance, link volume, mass growth allowance).
// Component numbers are REPRESENTATIVE of small science spacecraft, not any real product.
export const G0 = 9.80665, SOLAR = 1361, CELL_EFF = 0.29, SIGMA = 5.670e-8;

export const MISSIONS = {
  transit: { id: 'transit', name: 'Exoplanet Transit Watcher', field: 'Astrophysics', need: 'A nearby star dims slightly every few days. Scientists need steady, precise brightness measurements to learn whether a planet is crossing it.', goals: ['Measure the star’s brightness without blinking for weeks', 'Hold the telescope almost perfectly still', 'Send every measurement home each day'], },
  flood: { id: 'flood', name: 'Flood Mapper', field: 'Earth science', need: 'When rivers burst their banks, rescue teams need a map of the water within hours. A satellite can see a whole region at once.', goals: ['Image flooded regions every day', 'Downlink large images quickly', 'Keep working for three years'], },
  fire: { id: 'fire', look: 'flood', name: 'Wildfire Spotter', field: 'Earth science', need: 'Wildfires spread fast. Firefighters need to know where a fire started within minutes, even at night.', goals: ['Spot new fires from their heat', 'Pass over the same forests every day', 'Send alerts down quickly'], },
  neo: { id: 'neo', look: 'transit', name: 'Asteroid Hunter', field: 'Planetary defence', need: 'Some asteroids cross Earth’s path. We can only protect the planet from the ones we have found.', goals: ['Find dark asteroids by their warmth', 'Watch the sky without Earth in the way', 'Hold very still for long exposures'], },
  storm: { id: 'storm', look: 'flood', name: 'Hurricane Tracker', field: 'Weather', need: 'Hurricanes grow stronger over warm seas. Forecasters need to see inside the clouds to warn people in time.', goals: ['See rain and wind inside the storm', 'Pass over the tropics many times a day', 'Deliver data within hours'], },
  wind: { id: 'wind', name: 'Solar Wind Sentinel', field: 'Heliophysics', need: 'Storms from the Sun can knock out power grids and satellites. An early-warning spacecraft far from Earth can give people time to prepare.', goals: ['Measure the solar wind before it reaches Earth', 'Reach and hold a high orbit', 'Run on very little power'], },
};

// Mission-level choices from the challenge brief: instrument, orbit, launch vehicle, lifetime.
export const INSTRUMENTS = {
  transit: { cam10: { name: '10 cm survey camera', mass: 14, power: 30, data: 3, point: 60, value: 40, cost: 1.5, note: 'Light and cheap. Sees only the deepest dips.' }, tel20: { name: '20 cm photometer telescope', mass: 28, power: 60, data: 8, point: 10, value: 70, cost: 3.0, note: 'The workhorse. Needs steady pointing.' }, tel35: { name: '35 cm cooled telescope', mass: 52, power: 110, data: 20, point: 3, value: 100, cost: 5.5, note: 'Best science. Heavy, hungry, and needs the finest pointing.' } },
  flood: { cam: { name: 'Colour camera, 10 m detail', mass: 18, power: 60, data: 15, point: 120, value: 45, cost: 1.8, note: 'Simple pictures. Clouds block the view.' }, msi: { name: 'Multispectral imager, 5 m detail', mass: 34, power: 140, data: 40, point: 60, value: 75, cost: 3.4, note: 'Tells water from land clearly. A lot of data.' }, sar: { name: 'Radar imager', mass: 60, power: 260, data: 80, point: 60, value: 100, cost: 6.0, note: 'Sees through cloud and at night, when floods happen. Very power-hungry.' } },
  fire: { t1: { name: 'Thermal camera, 200 m detail', mass: 16, power: 45, data: 6, point: 300, value: 45, cost: 1.6, note: 'Sees only big fires.' }, t2: { name: 'Infrared fire imager, 50 m detail', mass: 30, power: 110, data: 25, point: 90, value: 75, cost: 3.2, note: 'Catches fires while they are still small.' }, t3: { name: 'Cooled infrared imager, 20 m detail', mass: 50, power: 200, data: 55, point: 60, value: 100, cost: 5.4, note: 'Sees a single burning house. Heavy and hungry.' } },
  neo: { v15: { name: '15 cm visible telescope', mass: 16, power: 35, data: 2, point: 30, value: 40, cost: 1.6, note: 'Finds only bright asteroids.' }, i25: { name: '25 cm infrared telescope', mass: 32, power: 70, data: 6, point: 10, value: 75, cost: 3.4, note: 'Sees dark asteroids by their heat.' }, i40: { name: '40 cm cooled infrared telescope', mass: 55, power: 120, data: 14, point: 5, value: 100, cost: 5.8, note: 'Finds the small, dark ones. Needs the steadiest pointing.' } },
  storm: { r1: { name: 'Microwave radiometer', mass: 12, power: 30, data: 2, point: 600, value: 45, cost: 1.4, note: 'Measures rain. Small and simple.' }, r2: { name: 'Microwave sounder', mass: 24, power: 75, data: 8, point: 300, value: 75, cost: 2.8, note: 'Measures temperature and moisture inside the storm.' }, r3: { name: 'Sounder with lightning camera', mass: 42, power: 140, data: 22, point: 120, value: 100, cost: 4.6, note: 'The full picture of a storm. More of everything.' } },
  wind: { mag: { name: 'Magnetometer on a boom', mass: 6, power: 8, data: 0.4, point: 1800, value: 45, cost: 0.8, note: 'Measures the magnetic field only.' }, magp: { name: 'Magnetometer and particle detector', mass: 14, power: 25, data: 1.5, point: 1800, value: 75, cost: 1.8, note: 'Field and particles together give a real storm warning.' }, suite: { name: 'Full plasma suite with solar imager', mass: 30, power: 60, data: 6, point: 300, value: 100, cost: 3.6, note: 'Everything, including pictures of the Sun. Needs better pointing and more data.' } },
};
export const ORBITS = {
  leo: { name: 'Low Earth orbit, 550 km', period: 95.6, eclipse: 0.37, eclipseHours: 0.59, contact: 2400, dv0: 15, dvYear: 8, lift: 1, sci: { transit: 0.8, flood: 0.9, wind: 0.45, fire: 0.9, neo: 0.6, storm: 1 }, note: 'Easy to reach. In Earth’s shadow a third of the time, and thin air slowly drags it down.' },
  sso: { name: 'Sun-synchronous orbit, 700 km', period: 98.8, eclipse: 0.35, eclipseHours: 0.57, contact: 3000, dv0: 25, dvYear: 4, lift: 0.85, sci: { transit: 0.9, flood: 1, wind: 0.55, fire: 1, neo: 0.75, storm: 0.85 }, note: 'Passes over each place at the same local time every day. Costs more rocket performance.' },
  high: { name: 'High orbit, far from Earth', eclipse: 0.05, eclipseHours: 0.3, contact: 7200, dv0: 110, dvYear: 10, lift: 0.45, sci: { transit: 1, flood: 0.15, wind: 1, fire: 0.2, neo: 1, storm: 0.3 }, note: 'Almost constant sunlight and an uninterrupted view. Hard to reach: the rocket can lift less than half as much.' },
};
export const LAUNCHERS = {
  ride: { name: 'Rideshare slot', cap: 300, cost: 2.5, high: false, note: 'Share a rocket with other satellites. Cheap, but it cannot take you to a high orbit.' },
  small: { name: 'Dedicated small launcher', cap: 240, cost: 5, high: true, note: 'Your own small rocket, your own orbit. Limited lifting power.' },
  medium: { name: 'Dedicated medium rocket', cap: 900, cost: 12, high: true, note: 'Lifts almost anything you design. Takes a large bite out of the budget.' },
};
export const LIVES = { y1: { name: '1 year', years: 1, f: 0.55, dod: 0.6, note: 'Short and cheap. Less science, and the battery can be worked harder.' }, y3: { name: '3 years', years: 3, f: 0.85, dod: 0.4, note: 'A typical small science mission.' }, y5: { name: '5 years', years: 5, f: 1, dod: 0.3, note: 'Most science. Needs more propellant and a gently treated battery.' } };
export const BUDGETS = { transit: 27, flood: 31, wind: 25, fire: 30, neo: 28, storm: 28 };
export const OPS_PER_YEAR = 0.5;
export const missionChoices = (m) => [
  { key: 'instrument', label: 'Science instrument', role: 0, what: 'The reason for the mission. A more capable instrument returns more science, and costs mass, power, data and money.', options: Object.fromEntries(Object.entries(INSTRUMENTS[m.id]).map(([k, o]) => [k, Object.assign({ line: `${o.mass} kg \u00B7 ${o.power} W \u00B7 ${o.data} GB/day \u00B7 ${o.cost.toFixed(1)} M \u00B7 science ${o.value}` }, o)])) },
  { key: 'orbit', label: 'Orbit', role: 0, what: 'Where the spacecraft flies decides sunlight, contact with the ground, and how much the rocket can lift.', options: Object.fromEntries(Object.entries(ORBITS).map(([k, o]) => [k, Object.assign({ line: `${o.period ? o.period + ' min per lap \u00B7 ' : ''}${Math.round(o.eclipse * 100)} % in shadow \u00B7 ${Math.round(o.contact / 60)} min contact/day \u00B7 science \u00D7${o.sci[m.id]}` }, o)])) },
  { key: 'life', label: 'Mission lifetime', role: 0, what: 'Longer missions return more science but need more propellant, a gentler battery and more years of operations to pay for.', options: Object.fromEntries(Object.entries(LIVES).map(([k, o]) => [k, Object.assign({ line: `science \u00D7${o.f} \u00B7 operations ${(o.years * OPS_PER_YEAR).toFixed(1)} M` }, o)])) },
  { key: 'launcher', label: 'Launch vehicle', role: 1, what: 'The rocket sets the mass limit. What it can lift depends on the orbit you chose.', options: Object.fromEntries(Object.entries(LAUNCHERS).map(([k, o]) => [k, Object.assign({ line: `lifts ${o.cap} kg to low orbit \u00B7 ${o.cost.toFixed(1)} M` }, o)])) },
];
export const ROLES = ['Mission scientist', 'Systems engineer', 'Power and thermal engineer', 'Avionics engineer'];
export const ROLE_OF = { structure: 1, arrays: 2, battery: 2, thermal: 2, adcs: 3, comms: 3, prop: 3, layout: 1 };
// The mission as the current design defines it.
export function effective(m, d) { const inst = INSTRUMENTS[m.id][d.instrument] || Object.values(INSTRUMENTS[m.id])[1]; const orb = ORBITS[d.orbit] || ORBITS.sso; const lv = LAUNCHERS[d.launcher] || LAUNCHERS.small; const life = LIVES[d.life] || LIVES.y3; const reach = lv.high || d.orbit !== 'high';
  return Object.assign({}, m, { payload: inst, orbit: orb, launcher: lv, life, reach, science: Math.round(inst.value * orb.sci[m.id] * life.f), req: { mass: reach ? Math.round(lv.cap * orb.lift) : 0, point: inst.point, data: inst.data, dv: Math.round(orb.dv0 + orb.dvYear * life.years), cost: BUDGETS[m.id] } }); }

export const SUBSYSTEMS = [
  { key: 'structure', label: 'Structure', what: 'The skeleton. It carries every load from launch and holds everything in line.', options: {
    al: { name: 'Aluminium honeycomb panels', mass: 32, cost: 1.0, stiff: 1.0, note: 'The standard choice: light, stiff and well understood.' },
    cfrp: { name: 'Carbon-fibre panels', mass: 21, cost: 2.4, stiff: 1.3, note: 'Lighter and stiffer, but costs more and is harder to repair.' },
    frame: { name: 'Machined aluminium frame', mass: 44, cost: 0.7, stiff: 1.5, note: 'Cheap and very stiff, but heavy.' } } },
  { key: 'arrays', label: 'Solar arrays', what: 'Turn sunlight into electricity. Bigger and better aimed means more power.', options: {
    body: { name: 'Body-mounted cells', area: 0.9, aim: 0.4, mass: 6, cost: 0.6, deploy: false, note: 'Nothing to unfold, nothing to jam. But only some cells face the Sun.' },
    wings: { name: 'Two deployable wings', area: 1.2, aim: 0.8, mass: 12, cost: 1.4, deploy: true, note: 'Folded for launch, opened in orbit. More power, one more thing that must work.' },
    track: { name: 'Sun-tracking wings', area: 1.8, aim: 0.97, mass: 19, cost: 2.6, deploy: true, note: 'Motors keep the wings facing the Sun. Most power, most mass and cost.' } } },
  { key: 'battery', label: 'Battery', what: 'Runs the spacecraft in Earth’s shadow. Draining it less deeply makes it last for years.', options: {
    b10: { name: 'Li-ion 280 Wh', wh: 280, mass: 3.5, cost: 0.3, note: 'Small and light.' },
    b20: { name: 'Li-ion 560 Wh', wh: 560, mass: 6, cost: 0.5, note: 'A comfortable middle.' },
    b40: { name: 'Li-ion 1120 Wh', wh: 1120, mass: 11, cost: 0.9, note: 'Large reserve, and heavy: where you mount it matters.' } } },
  { key: 'adcs', label: 'Pointing control', what: 'Knows which way the spacecraft faces, and turns it. Engineers call it ADCS.', options: {
    coarse: { name: 'Magnetic rods and sun sensors', acc: 1800, mass: 3, power: 6, cost: 0.5, note: 'Points to about half a degree. Simple and robust.' },
    wheels: { name: '3 reaction wheels, 1 star tracker', acc: 20, mass: 9, power: 22, cost: 2.2, note: 'Points to about 20 arcseconds.' },
    fine: { name: '4 reaction wheels, 2 star trackers, gyro', acc: 3, mass: 14, power: 38, cost: 4.5, note: 'Points to about 3 arcseconds, with a spare wheel.' } } },
  { key: 'comms', label: 'Radio', what: 'Sends science data to the ground during short passes over a ground station.', options: {
    s: { name: 'S-band, 2 Mbit/s', rate: 2, mass: 3, tx: 20, cost: 0.6, note: 'Reliable and cheap. Low data rate.' },
    x: { name: 'X-band, 50 Mbit/s', rate: 50, mass: 6, tx: 55, cost: 1.6, note: 'The science workhorse.' },
    ka: { name: 'Ka-band, 300 Mbit/s', rate: 300, mass: 9, tx: 90, cost: 3.4, note: 'Huge data volumes, needs accurate pointing and more power.' } } },
  { key: 'prop', label: 'Propulsion', what: 'Changes the orbit. How much depends on engine efficiency (Isp) and propellant carried.', options: {
    cold: { name: 'Cold-gas thrusters', isp: 65, dry: 4, propellant: 6, power: 0, cost: 0.6, note: 'Just compressed gas. Safe and simple, very little push.' },
    mono: { name: 'Hydrazine monopropellant', isp: 220, dry: 7, propellant: 12, power: 0, cost: 1.5, note: 'The classic. Good push, toxic to handle.' },
    elec: { name: 'Hall-effect electric thruster', isp: 1400, dry: 12, propellant: 5, power: 20, cost: 3.8, note: 'Very efficient, very gentle, hungry for power.' } } },
  { key: 'thermal', label: 'Thermal control', what: 'Keeps everything between too hot and too cold. Electricity used on board ends up as heat that must be radiated away.', options: {
    passive: { name: 'Blankets and a 0.5 m² radiator', area: 0.5, heater: 10, mass: 4, power: 0, cost: 0.4, note: 'No moving parts.' },
    mid: { name: 'Blankets, 1.0 m² radiator, heaters', area: 1.0, heater: 25, mass: 7, power: 0, cost: 0.9, note: 'More heat out, heaters for the cold.' },
    active: { name: 'Heat pipes and 1.6 m² louvred radiator', area: 1.6, heater: 30, mass: 12, power: 10, cost: 1.8, note: 'Moves heat where it is needed. Complex.' } } },
];
export const SUB = Object.fromEntries(SUBSYSTEMS.map((s) => [s.key, s]));
export const AVIONICS = { mass: 7, power: 15, cost: 3.0 }; // flight computer + power unit, always carried
export const HARNESS_FRACTION = 0.08, GROWTH = 0.15, POWER_MARGIN = 0.2, DOD = 0.4, CG_LIMIT = 15, FREQ_LIMIT = 35, MOUNT_X = 0.3;
export const DEFAULT_DESIGN = { instrument: null, orbit: null, life: null, launcher: null, structure: null, arrays: null, battery: null, adcs: null, comms: null, prop: null, thermal: null, battSide: 'A', aviSide: 'A' };
const sideX = (s) => (s === 'A' ? MOUNT_X : s === 'B' ? -MOUNT_X : 0);

export function analyse(d, m0) {
  const m = effective(m0, d);
  const o = (k) => (d[k] ? SUB[k].options[d[k]] : null); const st = o('structure'), ar = o('arrays'), ba = o('battery'), ad = o('adcs'), co = o('comms'), pr = o('prop'), th = o('thermal');
  const complete = !!(st && ar && ba && ad && co && pr && th && d.instrument && d.orbit && d.life && d.launcher);
  const items = [['Payload', m.payload.mass], ['Structure', st ? st.mass : 0], ['Solar arrays', ar ? ar.mass : 0], ['Battery', ba ? ba.mass : 0], ['Pointing control', ad ? ad.mass : 0], ['Radio', co ? co.mass : 0], ['Propulsion (dry)', pr ? pr.dry : 0], ['Thermal', th ? th.mass : 0], ['Avionics', AVIONICS.mass]];
  const base = items.reduce((a, x) => a + x[1], 0); const harness = base * HARNESS_FRACTION; const dry = base + harness; const growth = dry * GROWTH; const propellant = pr ? pr.propellant : 0; const wet = dry + growth + propellant;
  const gen = ar ? ar.area * SOLAR * CELL_EFF * ar.aim * 0.88 : 0; const avgGen = gen * (1 - m.orbit.eclipse);
  const load = m.payload.power + (ad ? ad.power : 0) + AVIONICS.power + 5 + (co ? co.tx * 0.1 : 0) + (th ? th.heater * 0.5 + th.power : 0) + (pr ? pr.power : 0);
  const eclipseWh = load * m.orbit.eclipseHours; const usableWh = ba ? ba.wh * m.life.dod : 0;
  const dataGB = co ? co.rate * m.orbit.contact / 8000 : 0; const dv = pr && wet > propellant ? pr.isp * G0 * Math.log(wet / (wet - propellant)) : 0;
  const reject = th ? 0.85 * SIGMA * th.area * Math.pow(283, 4) : 0; const freq = st ? 38 * st.stiff * Math.sqrt(150 / wet) : 0;
  const cg = Math.abs(((ba ? ba.mass : 0) * sideX(d.battSide) + AVIONICS.mass * sideX(d.aviSide)) / wet) * 1000;
  const cost = AVIONICS.cost + [st, ar, ba, ad, co, pr, th].reduce((a, x) => a + (x ? x.cost : 0), 0) + (d.instrument ? m.payload.cost : 0) + (d.launcher ? m.launcher.cost : 0) + (d.life ? m.life.years * OPS_PER_YEAR : 0);
  const checks = [
    { id: 'mass', label: 'Launch mass', value: wet, limit: m.req.mass, unit: 'kg', ok: wet <= m.req.mass, less: true, fix: m.reach ? 'Choose lighter parts, a bigger rocket or an easier orbit. Every kilogram of dry mass also adds harness and growth allowance.' : 'A rideshare cannot reach a high orbit. Choose a dedicated rocket or a lower orbit.', method: 'Test' },
    { id: 'power', label: 'Power, orbit average', value: avgGen, limit: load * (1 + POWER_MARGIN), unit: 'W', ok: avgGen >= load * (1 + POWER_MARGIN), fix: 'Add array area or aim the cells better, or cut the electrical load.', method: 'Analysis' },
    { id: 'battery', label: 'Battery in eclipse', value: usableWh, limit: eclipseWh, unit: 'Wh', ok: usableWh >= eclipseWh, fix: 'Fit a bigger battery, or lower the load it must carry through the shadow.', method: 'Analysis' },
    { id: 'point', label: 'Pointing accuracy', value: ad ? ad.acc : Infinity, limit: m.req.point, unit: 'arcsec', ok: !!ad && ad.acc <= m.req.point, less: true, fix: 'Fit reaction wheels and star trackers accurate enough for this payload.', method: 'Test' },
    { id: 'data', label: 'Daily downlink', value: dataGB, limit: m.req.data, unit: 'GB', ok: dataGB >= m.req.data, fix: 'The instrument makes more data than the radio can send home. Use a higher-rate band, an orbit with more ground contact, or a less data-hungry instrument.', method: 'Analysis' },
    { id: 'dv', label: 'Velocity change', value: dv, limit: m.req.dv, unit: 'm/s', ok: dv >= m.req.dv, fix: 'Use a more efficient engine or more propellant. A lighter spacecraft also goes further on the same tank.', method: 'Analysis' },
    { id: 'thermal', label: 'Heat rejection', value: reject, limit: load, unit: 'W', ok: reject >= load, fix: 'Fit a larger radiator, or use less power so there is less heat to lose.', method: 'Test' },
    { id: 'freq', label: 'Stiffness (first resonance)', value: freq, limit: FREQ_LIMIT, unit: 'Hz', ok: freq >= FREQ_LIMIT, fix: 'Use a stiffer structure or reduce mass, so launch vibration cannot shake it apart.', method: 'Test' },
    { id: 'cg', label: 'Balance (centre of mass offset)', value: cg, limit: CG_LIMIT, unit: 'mm', ok: cg <= CG_LIMIT, less: true, fix: 'Mount heavy boxes on opposite sides, or on the centre deck, so they balance.', method: 'Test' },
    { id: 'cost', label: 'Total mission cost', value: cost, limit: m.req.cost, unit: 'M', ok: cost <= m.req.cost, less: true, fix: 'Swap an expensive part for a simpler one that still meets its requirement.', method: 'Inspection' },
  ];
  return { m, science: m.science, complete, items, harness, dry, growth, propellant, wet, gen, avgGen, load, eclipseWh, usableWh, dataGB, dv, reject, freq, cg, cost, checks, ok: complete && checks.every((c) => c.ok) };
}
// The requirement -> verification method exercise (NASA's four methods).
export const METHODS = ['Test', 'Analysis', 'Inspection', 'Demonstration'];
export const VERIFY = [
  { req: (m) => `Launch mass is no more than ${m.req.mass} kg`, method: 'Test', why: 'You weigh the finished spacecraft on a calibrated scale. Measuring the real thing is a test.' },
  { req: () => 'The spacecraft fits inside the rocket’s fairing', method: 'Inspection', why: 'You measure it and look. No operation is needed, so it is an inspection.' },
  { req: (m) => `Engines can change the orbit speed by at least ${m.req.dv} m/s`, method: 'Analysis', why: 'You cannot fly the mission on the ground. You calculate it with the rocket equation from measured mass and engine data.' },
  { req: () => 'Solar arrays unfold after launch', method: 'Demonstration', why: 'You release the arrays on the ground and watch them open. Showing that it works, without detailed measurement, is a demonstration.' },
  { req: () => 'The structure survives launch vibration', method: 'Test', why: 'You bolt it to a shaker table and vibrate it harder than the rocket will, with sensors recording.' },
  { req: (m) => `At least ${m.req.data} GB reaches the ground each day`, method: 'Analysis', why: 'You calculate it from radio rate and time in view of ground stations. A radio test on the ground supports the numbers.' },
];
export const CONOPS = ['Launch on the rocket', 'Separate from the rocket', 'Stop tumbling and find the Sun', 'Unfold the solar arrays', 'Check out every system', 'Collect science data', 'Downlink data to the ground station', 'Retire the spacecraft safely'];
export const STARTER = {"transit":{"instrument":"cam10","orbit":"high","life":"y5","launcher":"medium","structure":"frame","arrays":"body","battery":"b10","adcs":"wheels","comms":"x","prop":"mono","thermal":"passive","battSide":"A","aviSide":"B"},"flood":{"instrument":"cam","orbit":"sso","life":"y3","launcher":"ride","structure":"frame","arrays":"wings","battery":"b10","adcs":"wheels","comms":"x","prop":"mono","thermal":"passive","battSide":"A","aviSide":"B"},"fire":{"instrument":"t3","orbit":"leo","life":"y1","launcher":"ride","structure":"frame","arrays":"track","battery":"b10","adcs":"wheels","comms":"ka","prop":"mono","thermal":"mid","battSide":"A","aviSide":"B"},"neo":{"instrument":"i25","orbit":"leo","life":"y3","launcher":"ride","structure":"frame","arrays":"wings","battery":"b10","adcs":"fine","comms":"x","prop":"mono","thermal":"passive","battSide":"A","aviSide":"B"},"storm":{"instrument":"r2","orbit":"sso","life":"y3","launcher":"ride","structure":"frame","arrays":"wings","battery":"b10","adcs":"wheels","comms":"x","prop":"mono","thermal":"passive","battSide":"A","aviSide":"B"},"wind":{"instrument":"mag","orbit":"high","life":"y3","launcher":"small","structure":"al","arrays":"body","battery":"b10","adcs":"coarse","comms":"s","prop":"mono","thermal":"passive","battSide":"A","aviSide":"B"}};
