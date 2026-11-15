// All values are SIMPLIFIED GAME PARAMETERS, not specifications of real hardware.
export const BUDGET = 330;            // mission budget, million credits
export const MISSION_DAYS = 60;
export const TARGET_DEPTH_PPM = 3300; // the dimming reported by the ground survey (~0.33 %)

export const PAYLOADS = {
  compact: {
    id: 'compact', name: 'Compact Photometer', short: 'CP-10', aperture: 10,
    mass: 35, power: 40, cost: 30, dataRate: 1.0, noise: 1300, fairing: 'S',
    requires: {},
    capability: 'Detects deep dips only. A 0.3 % dip sits close to its noise floor.',
    limits: 'High noise per measurement. Small or shallow signals are out of reach.',
    desc: 'A 10 cm refractor with a single detector. Light, frugal and cheap, built for bright targets.',
  },
  wide: {
    id: 'wide', name: 'Wide-Field Photometer', short: 'WFP-20', aperture: 20,
    mass: 85, power: 95, cost: 70, dataRate: 2.5, noise: 350, fairing: 'S',
    requires: {},
    capability: 'Resolves a 0.3 % dip clearly in a single pass.',
    limits: 'Shallow signals (below ~0.05 %) need many repeats to stand out.',
    desc: 'A 20 cm camera with a four-detector focal plane. The workhorse option for transit photometry.',
  },
  precision: {
    id: 'precision', name: 'Precision Photometer', short: 'PP-40', aperture: 40,
    mass: 210, power: 240, cost: 120, dataRate: 6.0, noise: 120, fairing: 'M',
    requires: { adcs: 'fine', thermal: 'active' },
    capability: 'Very low noise. Can reveal shallow signals other instruments miss.',
    limits: 'Heavy, power-hungry and data-heavy. Needs fine pointing and active thermal control.',
    desc: 'A 40 cm telescope with a cooled detector. Outstanding data, if the spacecraft can support it.',
  },
};

export const BUS = {
  power: {
    label: 'Power', blurb: 'Solar arrays and battery. Must exceed the total load with margin.',
    options: {
      body: { name: 'Body-mounted arrays', gen: 150, mass: 20, cost: 8, power: 0 },
      wings: { name: 'Deployable wings', gen: 350, mass: 45, cost: 18, power: 0 },
      large: { name: 'Large tracking arrays', gen: 650, mass: 80, cost: 32, power: 0 },
    },
  },
  comms: {
    label: 'Communications', blurb: 'Sends science data to the ground during contact windows.',
    options: {
      low: { name: 'Low-gain S-band', rate: 0.5, mass: 8, cost: 6, power: 15, deepSpace: false },
      high: { name: 'High-gain X-band dish', rate: 4.0, mass: 22, cost: 16, power: 45, deepSpace: true },
    },
  },
  storage: {
    label: 'Data storage', blurb: 'Holds observations between contact windows. When full, new data is lost.',
    options: {
      small: { name: '16 GB recorder', cap: 16, mass: 3, cost: 3, power: 5 },
      big: { name: '128 GB recorder', cap: 128, mass: 6, cost: 9, power: 10 },
    },
  },
  thermal: {
    label: 'Thermal control', blurb: 'Keeps the detector temperature steady. Swings add noise.',
    options: {
      passive: { name: 'Passive (blankets, radiator)', mass: 10, cost: 4, power: 0 },
      active: { name: 'Active (heaters, cooler loop)', mass: 24, cost: 14, power: 35 },
    },
  },
  adcs: {
    label: 'Attitude control', blurb: 'Holds the telescope on target. Jitter smears starlight across pixels.',
    options: {
      basic: { name: 'Reaction wheels, coarse sensors', jitter: 250, mass: 14, cost: 8, power: 20 },
      fine: { name: 'Fine guidance with star trackers', jitter: 40, mass: 30, cost: 22, power: 45 },
    },
  },
};
export const BUS_KEYS = ['power', 'comms', 'storage', 'thermal', 'adcs'];
export const STRUCTURE = { baseMass: 60, fraction: 0.25, cost: 25, power: 60 }; // avionics + structure

export const VEHICLES = {
  kestrel: { id: 'kestrel', name: 'Kestrel-S', klass: 'Small launcher', capacity: 320, cost: 45, fairing: 'S', height: 22, stages: 2, boosters: 0,
    note: 'Lowest cost. Small fairing; cannot carry a 40 cm telescope.' },
  aquila: { id: 'aquila', name: 'Aquila-M', klass: 'Medium launcher', capacity: 650, cost: 85, fairing: 'M', height: 34, stages: 2, boosters: 0,
    note: 'Balanced capacity and cost. Medium fairing.' },
  titan: { id: 'titan', name: 'Corvus-H', klass: 'Heavy launcher', capacity: 1400, cost: 150, fairing: 'L', height: 46, stages: 2, boosters: 2,
    note: 'Large margin for any design here, at a high price.' },
};
export const FAIRING_RANK = { S: 1, M: 2, L: 3 };

export const ORBITS = {
  leo: {
    id: 'leo', name: 'Low Earth Orbit', alt: '600 km circular', minMargin: 0, needsDeepSpace: false,
    duty: 0.6, thermalSwing: true, contactPerDay: 8.4,
    observe: 'Earth blocks the target for part of every 96-minute orbit: about 60 % coverage, in short pieces.',
    comms: 'Many short ground-station passes each day. Any antenna works.',
    traits: 'Day-night cycling every orbit stresses thermal control. Easiest orbit to reach.',
    fit: 'Workable, but frequent gaps can hide a short dip.',
  },
  heo: {
    id: 'heo', name: 'High Elliptical Orbit', alt: '13.7-day resonant orbit', minMargin: 0.1, needsDeepSpace: false,
    duty: 0.92, thermalSwing: false, contactPerDay: null,
    observe: 'Long uninterrupted stares, with a one-day pause near each closest approach.',
    comms: 'One 16-hour downlink window per orbit. Data must be stored for almost two weeks.',
    traits: 'Stable temperatures. Needs 10 % launch margin to reach.',
    fit: 'Strong for transit searches if storage and downlink are sized for it.',
  },
  l2: {
    id: 'l2', name: 'Sun-Earth L2', alt: '1.5 million km from Earth', minMargin: 0.25, needsDeepSpace: true,
    duty: 0.98, thermalSwing: false, contactPerDay: 8,
    observe: 'Near-continuous view. Only brief pauses for momentum management.',
    comms: 'A scheduled 8-hour contact each day, but only a high-gain antenna can close the link.',
    traits: 'Very stable. Needs 25 % launch margin and a deep-space antenna.',
    fit: 'Best coverage, for a spacecraft and launcher that can get there.',
  },
};
