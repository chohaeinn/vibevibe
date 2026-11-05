import {
  AgentRole,
  BottleneckAlert,
  ContingencyScenario,
  CrowdRoleCounts,
  EventConfig,
  EventPhaseId,
  EventPhaseInfo,
  Facility,
  FacilityCategory,
  SimulationAssumptions,
  SimulationSnapshot,
  TimelinePoint,
} from '../types/festival';
import { DEFAULT_SIMULATION_ASSUMPTIONS, EVENT_PHASES } from './presets';
import { createSeededRandom, hashStringSeed } from './prng';

export interface SimulatedAgent {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  targetHeading: number;
  speed: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  waypointsX: number[];
  waypointsZ: number[];
  wpCount: number;
  wpIndex: number;
  targetFacilityId: string;
  seatFacilityId: string;
  seatSlotIndex: number;
  isSeated: boolean;
  isWatchingStage: boolean;
  dwellRemaining: number;
  laneOffset: number;
  colorIndex: number;
  role: AgentRole;
  hasCompanionPet: boolean;
  petCoatIndex: number;
  petOffsetSide: number;
  active: boolean;
}

export interface RouteSegment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  isEvacuation?: boolean;
  isAccessibleEgress?: boolean;
}

const GRID_COLS = 48;
const GRID_ROWS = 36;

const PHASE_CATEGORY_WEIGHTS: Record<EventPhaseId, Record<FacilityCategory, number>> = {
  arrival: {
    entrance: 2.8,
    parking: 1.5,
    booth: 1.4,
    food: 1.1,
    rest: 1.2,
    stage: 0.9,
    seating: 0.8,
    restroom: 0.9,
    vip: 0.8,
    camping: 1.6,
    medical: 0.15,
  },
  afternoon_booths: {
    entrance: 0.6,
    parking: 0.3,
    booth: 2.8,
    food: 2.0,
    rest: 2.1,
    stage: 1.0,
    seating: 1.9,
    restroom: 1.4,
    vip: 1.2,
    camping: 1.1,
    medical: 0.2,
  },
  pre_show: {
    entrance: 0.45,
    parking: 0.2,
    booth: 1.05,
    food: 1.35,
    rest: 0.95,
    stage: 2.25,
    seating: 4.85,
    restroom: 1.5,
    vip: 2.1,
    camping: 0.55,
    medical: 0.25,
  },
  headline_show: {
    entrance: 0.2,
    parking: 0.12,
    booth: 0.45,
    food: 0.65,
    rest: 0.55,
    stage: 2.95,
    seating: 6.4,
    restroom: 0.85,
    vip: 2.9,
    camping: 0.35,
    medical: 0.3,
  },
  intermission: {
    entrance: 0.4,
    parking: 0.2,
    booth: 1.3,
    food: 4.1,
    rest: 2.7,
    stage: 0.75,
    seating: 1.55,
    restroom: 4.2,
    vip: 1.8,
    camping: 0.8,
    medical: 0.35,
  },
  egress: {
    entrance: 4.6,
    parking: 3.4,
    booth: 0.25,
    food: 0.4,
    rest: 0.4,
    stage: 0.2,
    seating: 0.2,
    restroom: 1.1,
    vip: 0.3,
    camping: 1.5,
    medical: 0.2,
  },
};

function getActiveAttendanceFraction(progress: number, contingency: ContingencyScenario): number {
  let base = 0.5;
  if (progress < 0.18) {
    base = 0.32 + (progress / 0.18) * 0.46;
  } else if (progress < 0.40) {
    base = 0.78 + ((progress - 0.18) / 0.22) * 0.14;
  } else if (progress < 0.76) {
    base = 0.92 + Math.sin(((progress - 0.4) / 0.36) * Math.PI) * 0.08;
  } else if (progress < 0.88) {
    base = 0.94 - ((progress - 0.76) / 0.12) * 0.08;
  } else {
    base = Math.max(0.28, 0.86 - ((progress - 0.88) / 0.12) * 0.56);
  }

  if (contingency === 'surge') {
    return Math.min(1.35, base * 1.35);
  }
  if (contingency === 'rain') {
    return base * 0.94;
  }
  return base;
}

export function getPhaseForProgress(progress: number): EventPhaseInfo {
  const clamped = Math.max(0, Math.min(1, progress));
  for (const phase of EVENT_PHASES) {
    if (clamped >= phase.progressRange[0] && clamped <= phase.progressRange[1]) {
      return phase;
    }
  }
  return EVENT_PHASES[EVENT_PHASES.length - 1];
}

export function formatTimeFromProgress(
  progress: number,
  startTime: string,
  endTime: string,
): string {
  const parseMinutes = (str: string, fallback: number) => {
    const parts = str.split(':').map(Number);
    if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    return fallback;
  };
  const startMin = parseMinutes(startTime, 10 * 60);
  let endMin = parseMinutes(endTime, 22 * 60);
  if (endMin <= startMin) endMin += 12 * 60;

  const currentMin = Math.round(startMin + Math.max(0, Math.min(1, progress)) * (endMin - startMin));
  const hrs = Math.floor((currentMin % (24 * 60)) / 60);
  const mins = currentMin % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function buildVenueRoutes(config: EventConfig, facilities: Facility[]): RouteSegment[] {
  const W = config.venueWidth;
  const D = config.venueDepth;
  const halfW = W * 0.5;
  const halfD = D * 0.5;
  const corridorW = config.accessibility.wideCorridors ? 5.8 : 3.6;
  const routes: RouteSegment[] = [];

  const hubZ = 6;
  const westX = -W * 0.2;
  const eastX = W * 0.2;
  const northZ = -D * 0.22;
  const southZ = D * 0.28;
  const spineX = -7;

  // 1. Pedestrian Promenade Network & 2. Primary Emergency Spines
  const mainStage = facilities.find((f) => f.subtype === 'main_stage') || facilities.find((f) => f.category === 'stage');
  const isCenterArena =
    config.stagePlacement === 'center_360' ||
    Boolean(mainStage && Math.abs(mainStage.position.x) < W * 0.14 && Math.abs(mainStage.position.z) < D * 0.14);

  const stageFrontZ =
    mainStage && !isCenterArena
      ? Math.min(hubZ - 8, mainStage.position.z + mainStage.dimensions.depth * 0.5 + 4)
      : -D * 0.26;

  if (isCenterArena) {
    // Ring promenade around 360° central stage + seating bowl
    routes.push({ x1: -W * 0.36, z1: northZ, x2: W * 0.36, z2: northZ, width: corridorW });
    routes.push({ x1: -W * 0.36, z1: southZ, x2: W * 0.36, z2: southZ, width: corridorW });
    routes.push({ x1: westX * 1.35, z1: northZ, x2: westX * 1.35, z2: southZ, width: corridorW });
    routes.push({ x1: eastX * 1.35, z1: northZ, x2: eastX * 1.35, z2: southZ, width: corridorW });

    routes.push({
      x1: westX * 1.35,
      z1: northZ,
      x2: westX * 1.35,
      z2: southZ,
      width: 4.8,
      isEvacuation: true,
    });
    routes.push({
      x1: westX * 1.35,
      z1: southZ,
      x2: eastX * 1.35,
      z2: southZ,
      width: 4.6,
      isEvacuation: true,
    });
  } else {
    routes.push({ x1: -W * 0.38, z1: hubZ, x2: W * 0.38, z2: hubZ, width: corridorW });
    routes.push({ x1: -W * 0.34, z1: southZ, x2: W * 0.34, z2: southZ, width: corridorW });
    routes.push({ x1: westX, z1: northZ, x2: westX, z2: southZ, width: corridorW });
    routes.push({ x1: eastX, z1: northZ, x2: eastX, z2: southZ, width: corridorW });
    routes.push({ x1: spineX, z1: northZ - 6, x2: spineX, z2: southZ, width: corridorW * 1.15 });

    routes.push({
      x1: spineX,
      z1: stageFrontZ,
      x2: spineX,
      z2: southZ,
      width: 4.8,
      isEvacuation: true,
    });
    routes.push({
      x1: westX,
      z1: hubZ,
      x2: eastX,
      z2: hubZ,
      width: 4.6,
      isEvacuation: true,
    });
  }

  // 3. Connect EVERY Entrance/Exit Gate strictly inside the interior boundary + Dedicated Step-Free Accessible Egress Lanes!
  const entrances = facilities.filter(
    (f) => f.category === 'entrance' && (f.subtype === 'main_entrance' || f.subtype === 'secondary_entrance'),
  );

  // Dedicated Step-Free Perimeter Accessible Egress Loop (avoids stairs & central stage crowds)
  const accWestX = -W * 0.39;
  const accEastX = W * 0.39;
  const accSouthZ = D * 0.37;
  routes.push({
    x1: accWestX,
    z1: northZ,
    x2: accWestX,
    z2: accSouthZ,
    width: 4.4,
    isAccessibleEgress: true,
  });
  routes.push({
    x1: accEastX,
    z1: northZ,
    x2: accEastX,
    z2: accSouthZ,
    width: 4.4,
    isAccessibleEgress: true,
  });
  routes.push({
    x1: accWestX,
    z1: accSouthZ,
    x2: accEastX,
    z2: accSouthZ,
    width: 4.6,
    isAccessibleEgress: true,
  });

  for (const gate of entrances) {
    const gx = gate.position.x;
    const gz = gate.position.z;

    const distSouth = Math.abs(halfD - gz);
    const distNorth = Math.abs(-halfD - gz);
    const distEast = Math.abs(halfW - gx);
    const distWest = Math.abs(-halfW - gx);
    const minEdge = Math.min(distSouth, distNorth, distEast, distWest);

    let portalEdgeX = gx;
    let portalEdgeZ = gz;
    if (minEdge === distSouth) {
      portalEdgeZ = halfD - 0.8;
    } else if (minEdge === distNorth) {
      portalEdgeZ = -halfD + 0.8;
    } else if (minEdge === distEast) {
      portalEdgeX = halfW - 0.8;
    } else {
      portalEdgeX = -halfW + 0.8;
    }

    // Pedestrian feeder to gate
    const pedTargetX = Math.abs(gx) > W * 0.3 ? (gx > 0 ? eastX : westX) : gx;
    const pedTargetZ = Math.abs(gz) > D * 0.3 ? southZ : hubZ;
    routes.push({
      x1: pedTargetX,
      z1: pedTargetZ,
      x2: gx,
      z2: gz,
      width: corridorW,
    });

    // Dedicated Step-Free Accessible Egress branch directly into accessible gates
    if (gate.accessibility.wheelchairAccessible && gate.accessibility.stepFreeEntry) {
      const accAnchorX = gx >= 0 ? accEastX : accWestX;
      const accAnchorZ = Math.abs(gz - accSouthZ) < Math.abs(gz - hubZ) ? accSouthZ : gz;
      routes.push({
        x1: accAnchorX,
        z1: accAnchorZ,
        x2: gx,
        z2: gz,
        width: 4.4,
        isAccessibleEgress: true,
      });
      routes.push({
        x1: gx,
        z1: gz,
        x2: portalEdgeX,
        z2: portalEdgeZ,
        width: 4.6,
        isAccessibleEgress: true,
      });
    }

    // Emergency corridor: connect central/cross emergency spine -> gate center -> interior portal threshold
    if (minEdge === distSouth || minEdge === distNorth) {
      const junctionZ = minEdge === distSouth ? southZ : stageFrontZ;
      routes.push({
        x1: spineX,
        z1: junctionZ,
        x2: gx,
        z2: junctionZ,
        width: 4.5,
        isEvacuation: true,
      });
      routes.push({
        x1: gx,
        z1: junctionZ,
        x2: gx,
        z2: gz,
        width: 4.6,
        isEvacuation: true,
      });
    } else {
      const sideSpineX = minEdge === distEast ? eastX : westX;
      routes.push({
        x1: sideSpineX,
        z1: hubZ,
        x2: sideSpineX,
        z2: gz,
        width: 4.5,
        isEvacuation: true,
      });
      routes.push({
        x1: sideSpineX,
        z1: gz,
        x2: gx,
        z2: gz,
        width: 4.6,
        isEvacuation: true,
      });
    }

    routes.push({
      x1: gx,
      z1: gz,
      x2: portalEdgeX,
      z2: portalEdgeZ,
      width: 4.6,
      isEvacuation: true,
    });
  }

  // 4. Connect EVERY Medical Station directly to Emergency Spine & Nearest Entrance Gate
  const medicals = facilities.filter((f) => f.category === 'medical');
  for (const med of medicals) {
    let nearestGate: Facility | null = null;
    let bestDist = Infinity;
    for (const g of entrances) {
      const d = Math.hypot(g.position.x - med.position.x, g.position.z - med.position.z);
      if (d < bestDist) {
        bestDist = d;
        nearestGate = g;
      }
    }

    routes.push({
      x1: spineX,
      z1: Math.max(stageFrontZ, Math.min(southZ, med.position.z)),
      x2: med.position.x,
      z2: med.position.z,
      width: 4.4,
      isEvacuation: true,
    });

    if (nearestGate) {
      routes.push({
        x1: med.position.x,
        z1: med.position.z,
        x2: nearestGate.position.x,
        z2: nearestGate.position.z,
        width: 4.4,
        isEvacuation: true,
      });
    }
  }

  // 5. Connect Exterior/Perimeter Parking Lots via Step-Free Pedestrian Link to Nearest Gate
  const parkings = facilities.filter((f) => f.category === 'parking');
  for (const pk of parkings) {
    let nearestGate: Facility | null = null;
    let bestDist = Infinity;
    for (const g of entrances) {
      const d = Math.hypot(g.position.x - pk.position.x, g.position.z - pk.position.z);
      if (d < bestDist) {
        bestDist = d;
        nearestGate = g;
      }
    }
    if (nearestGate) {
      routes.push({
        x1: pk.position.x,
        z1: pk.position.z,
        x2: nearestGate.position.x,
        z2: nearestGate.position.z,
        width: corridorW * 0.9,
      });
    }
  }

  return routes;
}

function isFacilityCovered(f: Facility): boolean {
  if (typeof f.covered === 'boolean') return f.covered;
  return (
    f.subtype === 'experience_booth' ||
    f.subtype === 'food_stall' ||
    f.subtype === 'goods_shop' ||
    f.subtype === 'beer_garden' ||
    f.subtype === 'locker_charging' ||
    f.subtype === 'eco_station' ||
    f.subtype === 'shuttle_stop' ||
    f.subtype === 'wristband_hub' ||
    f.subtype === 'foh_control' ||
    f.subtype === 'mist_cooling' ||
    f.subtype === 'smoking_booth' ||
    f.subtype === 'vip_lounge' ||
    f.subtype === 'family_lounge' ||
    f.subtype === 'rain_canopy' ||
    f.subtype === 'restroom_bank' ||
    f.subtype === 'medical_station' ||
    f.subtype === 'ticket_info' ||
    f.subtype === 'multilingual_info'
  );
}

interface SolidCollider {
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  cosR: number;
  sinR: number;
  boundR: number;
  seatingFacilityId?: string;
}

interface SeatSlot {
  facilityId: string;
  x: number;
  y: number;
  z: number;
  aisleX: number;
  aisleZ: number;
  entryX: number;
  entryZ: number;
  heading: number;
  isAccessibleBay: boolean;
  occupiedBy: number;
}

function getAgentRadius(role: AgentRole): number {
  if (role === 'wheelchair_user' || role === 'scooter_user' || role === 'stroller_family') {
    return 0.8;
  }
  if (role === 'pet_owner' || role === 'visually_impaired') {
    return 0.72;
  }
  return 0.54;
}

function buildSeatSlotsForFacilities(facilities: Facility[], config: EventConfig): SeatSlot[] {
  const slots: SeatSlot[] = [];
  const stages = facilities.filter((f) => f.category === 'stage');
  const mainStage = stages.find((f) => f.subtype === 'main_stage') || stages[0] || null;

  for (const f of facilities) {
    if (f.category !== 'seating') continue;

    const W = f.dimensions.width;
    const D = f.dimensions.depth;
    const cosR = Math.cos(f.rotation);
    const sinR = Math.sin(f.rotation);
    const isStepFree = Boolean(
      f.accessibility.wheelchairAccessible &&
        f.accessibility.stepFreeEntry &&
        config.accessibility.stepFreeRoutes,
    );

    const toWorld = (lx: number, lz: number) => ({
      x: f.position.x + lx * cosR + lz * sinR,
      z: f.position.z - lx * sinR + lz * cosR,
    });

    const computeStageHeading = (wx: number, wz: number): number => {
      if (mainStage) {
        return Math.atan2(mainStage.position.x - wx, mainStage.position.z - wz);
      }
      // Fallback: local -Z direction of seating block
      return Math.atan2(-sinR, -cosR);
    };

    const numRows = Math.max(4, Math.min(9, Math.floor(D / 2.6)));
    const rowSpacing = (D - 3.6) / numRows;
    const sideW = Math.max(3.2, (W - 3.8) / 2);

    // 1. Front-row Barrier-Free Wheelchair / Stroller / Companion Deck Bays (y = 0.42m)
    if (isStepFree) {
      const frontLz = -D / 2 + 2.3;
      const baysPerWing = Math.max(2, Math.min(5, Math.floor(sideW / 1.95)));
      const usableBayW = Math.max(2.0, sideW - 0.8);
      for (const side of [-1, 1]) {
        const wingCenter = side * (sideW / 2 + 1.4);
        const entryPt = toWorld(side * 0.45, D / 2 + 1.5);
        const aislePt = toWorld(side * 0.45, frontLz);
        for (let b = 0; b < baysPerWing; b++) {
          const lx =
            wingCenter - usableBayW * 0.5 + ((b + 0.5) / baysPerWing) * usableBayW;
          const worldPt = toWorld(lx, frontLz);
          slots.push({
            facilityId: f.id,
            x: worldPt.x,
            y: 0.42,
            z: worldPt.z,
            aisleX: aislePt.x,
            aisleZ: aislePt.z,
            entryX: entryPt.x,
            entryZ: entryPt.z,
            heading: computeStageHeading(worldPt.x, worldPt.z),
            isAccessibleBay: true,
            occupiedBy: -1,
          });
        }
      }
    }

    // 2. Tiered Stadium Bench Rows (matching venueMeshBuilder.ts stepH = 0.35 + (r / numRows) * 0.7)
    const startRow = isStepFree ? 1 : 0;
    const usableWingW = Math.max(2.4, sideW - 1.0);
    const seatsPerWing = Math.max(3, Math.floor(usableWingW / 1.24));

    for (let r = startRow; r < numRows; r++) {
      const rz = -D / 2 + 2.2 + r * rowSpacing;
      const seatLz = rz - 0.1; // Seated neatly on bench surface right in front of backrest (rz + 0.42)
      const stepH = 0.35 + (r / numRows) * 0.7;
      const benchTopY = 0.38 + stepH;

      for (const side of [-1, 1]) {
        const wingCenter = side * (sideW / 2 + 1.4);
        const entryPt = toWorld(side * 0.45, D / 2 + 1.5);
        const aislePt = toWorld(side * 0.45, seatLz);

        for (let c = 0; c < seatsPerWing; c++) {
          const lx =
            wingCenter - usableWingW * 0.5 + ((c + 0.5) / seatsPerWing) * usableWingW;
          const worldPt = toWorld(lx, seatLz);
          slots.push({
            facilityId: f.id,
            x: worldPt.x,
            y: benchTopY,
            z: worldPt.z,
            aisleX: aislePt.x,
            aisleZ: aislePt.z,
            entryX: entryPt.x,
            entryZ: entryPt.z,
            heading: computeStageHeading(worldPt.x, worldPt.z),
            isAccessibleBay: false,
            occupiedBy: -1,
          });
        }
      }
    }
  }

  return slots;
}

function buildSolidColliders(facilities: Facility[], config: EventConfig): SolidCollider[] {
  const colliders: SolidCollider[] = [];
  const hasAccRestroom = config.accessibility.accessibleRestrooms;

  const addOBB = (
    cx: number,
    cz: number,
    halfW: number,
    halfD: number,
    rot: number,
    seatingFacilityId?: string,
  ) => {
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    colliders.push({
      cx,
      cz,
      halfW,
      halfD,
      cosR,
      sinR,
      boundR: Math.hypot(halfW, halfD) + 1.4,
      seatingFacilityId,
    });
  };

  const addLocalSubBox = (
    f: Facility,
    lx: number,
    lz: number,
    subW: number,
    subD: number,
    seatingFacilityId?: string,
  ) => {
    const cosR = Math.cos(f.rotation);
    const sinR = Math.sin(f.rotation);
    const wx = f.position.x + lx * cosR + lz * sinR;
    const wz = f.position.z - lx * sinR + lz * cosR;
    addOBB(wx, wz, subW * 0.5, subD * 0.5, f.rotation, seatingFacilityId);
  };

  for (const f of facilities) {
    const W = f.dimensions.width;
    const D = f.dimensions.depth;

    if (f.subtype === 'beer_garden') {
      // Bar counter solid at rear, open standing barrel deck in front
      addLocalSubBox(f, 0, -D * 0.32, W * 0.8, 2.6);
    } else if (f.subtype === 'photo_zone') {
      addOBB(f.position.x, f.position.z, W * 0.42 + 0.3, D * 0.42 + 0.3, f.rotation);
    } else if (f.subtype === 'pet_zone') {
      addLocalSubBox(f, -W * 0.18, 0, 3.8, 2.2);
      addLocalSubBox(f, W * 0.24, -D * 0.15, 2.4, 2.4);
    } else if (f.subtype === 'shuttle_stop') {
      addLocalSubBox(f, -W * 0.14, -D * 0.3, W * 0.56, 2.8);
      addLocalSubBox(f, W * 0.12, D * 0.16, 9.2, 3.0);
    } else if (f.subtype === 'wristband_hub') {
      addLocalSubBox(f, -W * 0.42, 0, 1.4, 2.4);
      addLocalSubBox(f, W * 0.42, 0, 1.4, 2.4);
    } else if (f.subtype === 'mist_cooling') {
      // Walk-through cooling arches: side footings only
      addLocalSubBox(f, -W * 0.38, 0, 0.9, D * 0.72);
      addLocalSubBox(f, W * 0.38, 0, 0.9, D * 0.72);
    } else if (
      f.category === 'stage' ||
      f.category === 'food' ||
      f.category === 'booth' ||
      f.category === 'medical' ||
      f.category === 'vip' ||
      f.subtype === 'foh_control' ||
      f.subtype === 'locker_charging' ||
      f.subtype === 'eco_station' ||
      f.subtype === 'smoking_booth' ||
      f.subtype === 'family_lounge' ||
      f.subtype === 'ticket_info' ||
      f.subtype === 'multilingual_info'
    ) {
      addOBB(f.position.x, f.position.z, W * 0.5 + 0.35, D * 0.5 + 0.35, f.rotation);
      if (f.category === 'stage') {
        const isCenter360 =
          f.subtype === 'main_stage' &&
          (Boolean(f.notes?.includes('[360_ARENA]')) || config.stagePlacement === 'center_360');
        const isRunwayThrust =
          f.subtype === 'main_stage' &&
          (Boolean(f.notes?.includes('[RUNWAY_THRUST]')) ||
            config.stagePlacement === 'runway_keynote');
        if (isRunwayThrust) {
          addLocalSubBox(f, 0, D * 0.5 + 5.6, 4.5, 11.6);
          addLocalSubBox(f, 0, D * 0.5 + 11.8, 11.4, 4.5);
        } else if (!isCenter360) {
          addLocalSubBox(f, 0, D * 0.5 + 1.2, W * 0.46, 3.5);
        }
      }
    } else if (f.category === 'seating') {
      // Bleacher wings block random diagonal passersby while leaving the 2.4m central aisle clear;
      // spectators targeting this seating_block bypass these wing colliders to enter their row!
      const sideW = Math.max(3.0, (W - 3.8) / 2);
      addLocalSubBox(f, -(sideW / 2 + 1.4), 0, sideW, D * 0.92, f.id);
      addLocalSubBox(f, sideW / 2 + 1.4, 0, sideW, D * 0.92, f.id);
    } else if (f.category === 'restroom') {
      if (hasAccRestroom) {
        addLocalSubBox(f, 1.78, 0, W + 3.65, D * 0.9);
      } else {
        addOBB(f.position.x, f.position.z, W * 0.5 + 0.35, D * 0.46, f.rotation);
      }
    } else if (f.subtype === 'main_entrance' || f.subtype === 'secondary_entrance') {
      const span = Math.max(10, W);
      const thick = Math.max(4, D);
      const halfSpan = span * 0.44;
      addLocalSubBox(f, -halfSpan, 0, 2.8, thick * 0.65);
      addLocalSubBox(f, halfSpan, 0, 2.8, thick * 0.65);
    } else if (f.subtype === 'play_zone') {
      addLocalSubBox(f, W * 0.22, 0, 9.2, 9.2);
      addLocalSubBox(f, -W * 0.18, 0, 6.2, 4.4);
    } else if (f.subtype === 'parking_lot') {
      addLocalSubBox(f, -W * 0.31, 0, W * 0.32, D * 0.9);
      addLocalSubBox(f, W * 0.31, 0, W * 0.32, D * 0.9);
    }
  }

  return colliders;
}

const HASH_DIM = 40;
const HASH_CELLS = HASH_DIM * HASH_DIM;

export class CrowdSimulator {
  private config: EventConfig;
  private facilities: Facility[];
  private colliders: SolidCollider[] = [];
  private seatSlots: SeatSlot[] = [];
  private seatIndicesByFacility: Map<string, number[]> = new Map();
  private contingency: ContingencyScenario = 'normal';
  private assumptions: SimulationAssumptions = DEFAULT_SIMULATION_ASSUMPTIONS;
  private primaryGateId: string | null = null;
  public agents: SimulatedAgent[] = [];
  public maxAgents = 750;
  private currentProgress = 0.04;
  private currentPhaseId: EventPhaseId = 'arrival';
  private rand: () => number;
  private densityGrid = new Float32Array(GRID_COLS * GRID_ROWS);
  private scratchGrid = new Float32Array(GRID_COLS * GRID_ROWS);
  private cachedTimeline: TimelinePoint[] = [];

  private bucketHeads = new Int32Array(HASH_CELLS);
  private bucketNext = new Int32Array(900);

  constructor(
    config: EventConfig,
    facilities: Facility[],
    contingency: ContingencyScenario = 'normal',
    assumptions: SimulationAssumptions = DEFAULT_SIMULATION_ASSUMPTIONS,
  ) {
    this.config = config;
    this.facilities = facilities;
    this.contingency = contingency;
    this.assumptions = assumptions;
    this.rand = createSeededRandom(config.seed ^ 0x9e3779b9);
    this.rebuild(config, facilities, this.currentProgress, contingency, assumptions);
  }

  public getGridDimensions(): { cols: number; rows: number } {
    return { cols: GRID_COLS, rows: GRID_ROWS };
  }

  public getContingency(): ContingencyScenario {
    return this.contingency;
  }

  public rebuild(
    config: EventConfig,
    facilities: Facility[],
    progress = this.currentProgress,
    contingency: ContingencyScenario = this.contingency,
    assumptions: SimulationAssumptions = this.assumptions,
  ): void {
    this.config = config;
    this.facilities = facilities;
    this.colliders = buildSolidColliders(facilities, config);
    this.seatSlots = buildSeatSlotsForFacilities(facilities, config);
    this.seatIndicesByFacility.clear();
    for (let s = 0; s < this.seatSlots.length; s++) {
      const fid = this.seatSlots[s].facilityId;
      let arr = this.seatIndicesByFacility.get(fid);
      if (!arr) {
        arr = [];
        this.seatIndicesByFacility.set(fid, arr);
      }
      arr.push(s);
    }

    this.contingency = contingency;
    this.assumptions = assumptions;
    const firstGate = facilities.find(
      (f) => f.category === 'entrance' && (f.subtype === 'main_entrance' || f.subtype === 'secondary_entrance'),
    );
    this.primaryGateId = firstGate ? firstGate.id : null;
    this.currentProgress = Math.max(0, Math.min(1, progress));
    this.currentPhaseId = getPhaseForProgress(this.currentProgress).id;

    const layoutHash = facilities
      .map((f) => `${f.id}:${Math.round(f.position.x)},${Math.round(f.position.z)},${f.capacity}`)
      .join('|');
    const assumpKey = `${assumptions.guidanceComplianceRate}-${assumptions.inflowControlMode}-${assumptions.closedPrimaryGate}`;
    this.rand = createSeededRandom(
      config.seed ^ hashStringSeed(`${layoutHash}-${contingency}-${assumpKey}`),
    );

    const effectiveAttendance =
      contingency === 'surge' ? Math.round(config.expectedAttendance * 1.35) : config.expectedAttendance;

    const targetCount = Math.min(
      820,
      Math.max(220, Math.round(180 + Math.sqrt(effectiveAttendance) * 5.2)),
    );
    this.maxAgents = targetCount;
    this.agents = new Array(targetCount);

    const speedFactor = contingency === 'rain' ? 0.82 : 1.0;
    const inclusiveBoost =
      config.accessibility.stepFreeRoutes || config.accessibility.wideCorridors ? 1.32 : 1.0;

    for (let i = 0; i < targetCount; i++) {
      const roleRoll = this.rand();
      let role: AgentRole = 'general';
      if (roleRoll < 0.085) {
        role = 'staff';
      } else if (roleRoll < 0.085 + 0.052 * inclusiveBoost) {
        role = 'wheelchair_user';
      } else if (roleRoll < 0.085 + 0.094 * inclusiveBoost) {
        role = 'scooter_user';
      } else if (roleRoll < 0.085 + 0.144 * inclusiveBoost) {
        role = 'stroller_family';
      } else if (roleRoll < 0.085 + 0.168 * inclusiveBoost) {
        role = 'visually_impaired';
      } else if (roleRoll < 0.085 + 0.168 * inclusiveBoost + 0.072) {
        role = 'pet_owner';
      }

      let roleSpeedMult = 1.0;
      if (role === 'staff') roleSpeedMult = 1.08;
      else if (role === 'wheelchair_user') roleSpeedMult = 0.72;
      else if (role === 'scooter_user') roleSpeedMult = 0.78;
      else if (role === 'stroller_family') roleSpeedMult = 0.75;
      else if (role === 'visually_impaired') roleSpeedMult = 0.68;
      else if (role === 'pet_owner') roleSpeedMult = 0.92;

      const hasCompanionPet = role === 'pet_owner' || role === 'visually_impaired';
      const petCoatIndex =
        role === 'visually_impaired' ? 0 : 1 + Math.floor(this.rand() * 5);
      const initHeading = this.rand() * Math.PI * 2;

      this.agents[i] = {
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vz: 0,
        heading: initHeading,
        targetHeading: initHeading,
        speed: (1.12 + this.rand() * 0.42) * speedFactor * roleSpeedMult,
        targetX: 0,
        targetY: 0,
        targetZ: 0,
        waypointsX: [0, 0, 0],
        waypointsZ: [0, 0, 0],
        wpCount: 2,
        wpIndex: 0,
        targetFacilityId: '',
        seatFacilityId: '',
        seatSlotIndex: -1,
        isSeated: false,
        isWatchingStage: false,
        dwellRemaining: 0,
        laneOffset: (this.rand() - 0.5) * (config.accessibility.wideCorridors ? 5.2 : 4.2),
        colorIndex: i % 4,
        role,
        hasCompanionPet,
        petCoatIndex,
        petOffsetSide: i % 2 === 0 ? 1 : -1,
        active: true,
      };
    }

    this.cachedTimeline = this.computeFullDayTimeline();
    this.distributeAgentsForPhase(this.currentProgress, true);
  }

  private releaseAgentSeat(agentIdx: number): void {
    const ag = this.agents[agentIdx];
    if (!ag) return;
    if (ag.seatSlotIndex >= 0 && ag.seatSlotIndex < this.seatSlots.length) {
      const slot = this.seatSlots[ag.seatSlotIndex];
      if (slot.occupiedBy === agentIdx) {
        slot.occupiedBy = -1;
      }
    }
    ag.seatSlotIndex = -1;
    ag.seatFacilityId = '';
    ag.isSeated = false;
    ag.isWatchingStage = false;
    ag.targetY = 0;
  }

  private claimSeatSlot(
    facilityId: string,
    agentIdx: number,
    preferAccessibleBay: boolean,
    r: () => number,
  ): number {
    const indices = this.seatIndicesByFacility.get(facilityId);
    if (!indices || indices.length === 0) return -1;

    const len = indices.length;
    const startOffset = Math.floor(r() * len);

    if (preferAccessibleBay) {
      for (let k = 0; k < len; k++) {
        const sIdx = indices[(startOffset + k) % len];
        const slot = this.seatSlots[sIdx];
        if (slot.isAccessibleBay && slot.occupiedBy === -1) {
          slot.occupiedBy = agentIdx;
          return sIdx;
        }
      }
      // Mobility devices only sit on step-free bays; if all accessible bays are full, return -1
      return -1;
    }

    // General / able-bodied spectators prefer tiered bench seats first, leaving wheelchair bays open
    for (let k = 0; k < len; k++) {
      const sIdx = indices[(startOffset + k) % len];
      const slot = this.seatSlots[sIdx];
      if (!slot.isAccessibleBay && slot.occupiedBy === -1) {
        slot.occupiedBy = agentIdx;
        return sIdx;
      }
    }

    return -1;
  }

  private pushOutOfColliders(
    x: number,
    z: number,
    radius: number,
    ignoreSeatingFacilityId?: string,
  ): { x: number; z: number; pushed: boolean } {
    let px = x;
    let pz = z;
    let pushed = false;

    for (let k = 0; k < this.colliders.length; k++) {
      const col = this.colliders[k];
      if (col.seatingFacilityId && col.seatingFacilityId === ignoreSeatingFacilityId) {
        continue;
      }
      const dx = px - col.cx;
      const dz = pz - col.cz;
      if (dx * dx + dz * dz > (col.boundR + radius) * (col.boundR + radius)) continue;

      const lx = dx * col.cosR - dz * col.sinR;
      const lz = dx * col.sinR + dz * col.cosR;

      const exW = col.halfW + radius;
      const exD = col.halfD + radius;

      if (Math.abs(lx) < exW && Math.abs(lz) < exD) {
        const penX = exW - Math.abs(lx);
        const penZ = exD - Math.abs(lz);
        let nlx = lx;
        let nlz = lz;
        if (penX < penZ) {
          nlx = (lx >= 0 ? 1 : -1) * (exW + 0.08);
        } else {
          nlz = (lz >= 0 ? 1 : -1) * (exD + 0.08);
        }
        px = col.cx + nlx * col.cosR + nlz * col.sinR;
        pz = col.cz - nlx * col.sinR + nlz * col.cosR;
        pushed = true;
      }
    }

    return { x: px, z: pz, pushed };
  }

  private steerAroundColliders(
    x: number,
    z: number,
    dirX: number,
    dirZ: number,
    radius: number,
    agentIdx: number,
    ignoreSeatingFacilityId?: string,
  ): { dirX: number; dirZ: number } {
    let sx = dirX;
    let sz = dirZ;
    const lookAhead = 2.6;
    const probeX = x + dirX * lookAhead;
    const probeZ = z + dirZ * lookAhead;

    for (let k = 0; k < this.colliders.length; k++) {
      const col = this.colliders[k];
      if (col.seatingFacilityId && col.seatingFacilityId === ignoreSeatingFacilityId) {
        continue;
      }
      const dx = probeX - col.cx;
      const dz = probeZ - col.cz;
      if (dx * dx + dz * dz > (col.boundR + radius + 2.5) * (col.boundR + radius + 2.5)) continue;

      const lx = dx * col.cosR - dz * col.sinR;
      const lz = dx * col.sinR + dz * col.cosR;
      const exW = col.halfW + radius + 0.9;
      const exD = col.halfD + radius + 0.9;

      if (Math.abs(lx) < exW && Math.abs(lz) < exD) {
        const normLx = Math.abs(lx) / exW > Math.abs(lz) / exD ? Math.sign(lx || 1) : 0;
        const normLz = normLx === 0 ? Math.sign(lz || 1) : 0;
        const nwx = normLx * col.cosR + normLz * col.sinR;
        const nwz = -normLx * col.sinR + normLz * col.cosR;
        let twx = -nwz;
        let twz = nwx;
        const dotT = twx * dirX + twz * dirZ;
        if (dotT < -0.05 || (Math.abs(dotT) <= 0.05 && agentIdx % 2 === 1)) {
          twx = -twx;
          twz = -twz;
        }
        sx += nwx * 1.15 + twx * 1.45;
        sz += nwz * 1.15 + twz * 1.45;
      }
    }

    const len = Math.hypot(sx, sz) || 1;
    return { dirX: sx / len, dirZ: sz / len };
  }

  private resolveHardCollisions(passes = 2): void {
    const W = this.config.venueWidth;
    const D = this.config.venueDepth;
    const halfW = W * 0.5;
    const halfD = D * 0.5;

    for (let pass = 0; pass < passes; pass++) {
      this.bucketHeads.fill(-1);
      for (let i = 0; i < this.maxAgents; i++) {
        const ag = this.agents[i];
        if (!ag.active) continue;
        const bx = Math.max(0, Math.min(HASH_DIM - 1, Math.floor(((ag.x + halfW) / W) * HASH_DIM)));
        const bz = Math.max(0, Math.min(HASH_DIM - 1, Math.floor(((ag.z + halfD) / D) * HASH_DIM)));
        const bIdx = bz * HASH_DIM + bx;
        this.bucketNext[i] = this.bucketHeads[bIdx];
        this.bucketHeads[bIdx] = i;
      }

      for (let i = 0; i < this.maxAgents; i++) {
        const ag = this.agents[i];
        if (!ag.active) continue;
        const rA = getAgentRadius(ag.role);
        const bx = Math.max(0, Math.min(HASH_DIM - 1, Math.floor(((ag.x + halfW) / W) * HASH_DIM)));
        const bz = Math.max(0, Math.min(HASH_DIM - 1, Math.floor(((ag.z + halfD) / D) * HASH_DIM)));

        for (let dz = -1; dz <= 1; dz++) {
          const nbz = bz + dz;
          if (nbz < 0 || nbz >= HASH_DIM) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nbx = bx + dx;
            if (nbx < 0 || nbx >= HASH_DIM) continue;
            let j = this.bucketHeads[nbz * HASH_DIM + nbx];
            while (j !== -1) {
              if (j > i) {
                const other = this.agents[j];
                // Two spectators already seated on assigned bench slots do not push each other off benches
                if (!(ag.seatSlotIndex >= 0 && ag.dwellRemaining > 0 && other.seatSlotIndex >= 0 && other.dwellRemaining > 0)) {
                  const minDist = rA + getAgentRadius(other.role);
                  const ox = ag.x - other.x;
                  const oz = ag.z - other.z;
                  const d2 = ox * ox + oz * oz;
                  if (d2 < minDist * minDist) {
                    const d = Math.sqrt(d2);
                    let nx = 1;
                    let nz = 0;
                    if (d > 0.001) {
                      nx = ox / d;
                      nz = oz / d;
                    } else {
                      const ang = ((i * 73 + j * 31) % 360) * (Math.PI / 180);
                      nx = Math.cos(ang);
                      nz = Math.sin(ang);
                    }
                    const aAnchored = ag.seatSlotIndex >= 0 && ag.dwellRemaining > 0;
                    const bAnchored = other.seatSlotIndex >= 0 && other.dwellRemaining > 0;
                    if (aAnchored && !bAnchored) {
                      const push = minDist - d;
                      other.x -= nx * push;
                      other.z -= nz * push;
                    } else if (!aAnchored && bAnchored) {
                      const push = minDist - d;
                      ag.x += nx * push;
                      ag.z += nz * push;
                    } else {
                      const overlap = (minDist - d) * 0.52;
                      ag.x += nx * overlap;
                      ag.z += nz * overlap;
                      other.x -= nx * overlap;
                      other.z -= nz * overlap;
                    }
                  }
                }
              }
              j = this.bucketNext[j];
            }
          }
        }
      }

      for (let i = 0; i < this.maxAgents; i++) {
        const ag = this.agents[i];
        if (!ag.active) continue;
        if (ag.seatSlotIndex >= 0 && ag.dwellRemaining > 0) {
          continue;
        }
        const rad = getAgentRadius(ag.role);
        const ignoreSeatId = ag.seatFacilityId || undefined;
        const res = this.pushOutOfColliders(ag.x, ag.z, rad, ignoreSeatId);
        ag.x = Math.max(-halfW + 2.5, Math.min(halfW - 2.5, res.x));
        ag.z = Math.max(-halfD + 2.5, Math.min(halfD - 2.5, res.z));
      }
    }
  }

  private getEffectiveFacilityWeight(f: Facility, phaseId: EventPhaseId): number {
    const baseWeights = PHASE_CATEGORY_WEIGHTS[phaseId];
    let catMult = baseWeights[f.category] ?? 1.0;

    if (this.contingency === 'rain') {
      if (f.subtype === 'rain_canopy') {
        catMult *= 4.2;
      } else if (isFacilityCovered(f)) {
        catMult *= 2.35;
      } else {
        catMult *= 0.28;
      }
    } else if (this.contingency === 'stage_delay') {
      if (f.category === 'stage' || f.category === 'seating') {
        catMult *= 0.35;
      } else if (f.category === 'food' || f.category === 'restroom' || f.category === 'booth') {
        catMult *= 2.15;
      }
    } else if (this.contingency === 'surge') {
      if (f.category === 'entrance' || f.category === 'food' || f.category === 'restroom') {
        catMult *= 1.38;
      }
    } else if (this.contingency === 'medical_emergency') {
      if (f.category === 'medical') {
        catMult *= 1.8;
      }
    }

    // Turin Piazza San Carlo [8]: Simulate 1 primary entrance/exit blocked/closed
    if (this.assumptions.closedPrimaryGate && f.id === this.primaryGateId) {
      return 0.01;
    }

    // Seongsu-dong Case [1]: Holding-zone inflow control buffers pre-show/headline surge into plazas
    if (this.assumptions.inflowControlMode === 'holding' && (phaseId === 'pre_show' || phaseId === 'headline_show')) {
      if (f.category === 'stage' || f.category === 'seating') {
        catMult *= 0.82;
      } else if (f.category === 'rest' || f.category === 'booth') {
        catMult *= 1.35;
      }
    }

    // Nishida et al. (2023) [3]: Lower guidance compliance amplifies popular stall attraction & herding
    const nonCompliance = Math.max(0, 1 - this.assumptions.guidanceComplianceRate);
    const attractionExp = 1 + nonCompliance * 1.15;
    let salienceBias = Math.pow(Math.max(0.1, f.attractionWeight), attractionExp);
    if ((phaseId === 'egress' || phaseId === 'arrival') && f.subtype === 'secondary_entrance') {
      salienceBias *= 0.55 + this.assumptions.guidanceComplianceRate * 0.45;
    }

    return Math.max(0.03, salienceBias * catMult * Math.sqrt(Math.max(50, f.capacity) / 200));
  }

  private pickTargetFacilityForRole(
    phaseId: EventPhaseId,
    role: AgentRole,
    r: () => number,
  ): Facility {
    const interiorTargets = this.facilities.filter((f) => f.category !== 'parking');
    if (interiorTargets.length === 0) {
      return {
        id: 'center',
        name: 'Central Plaza',
        category: 'rest',
        subtype: 'rest_plaza',
        position: { x: 0, z: 0 },
        dimensions: { width: 16, depth: 16, height: 1 },
        rotation: 0,
        capacity: 500,
        cost: 0,
        attractionWeight: 1,
        colorAccent: '#3b82f6',
        accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: false },
      };
    }

    const weightFor = (f: Facility): number => {
      let w = this.getEffectiveFacilityWeight(f, phaseId);
      const isShowPhase = phaseId === 'pre_show' || phaseId === 'headline_show';
      if (role === 'staff') {
        if (f.category === 'entrance' || f.category === 'medical' || f.category === 'stage') {
          w *= 2.4;
        } else if (f.category === 'seating') {
          w *= 0.35; // Staff marshal aisles & stage perimeter rather than taking spectator seats
        }
      } else if (role === 'wheelchair_user' || role === 'scooter_user') {
        if (!f.accessibility.wheelchairAccessible) w *= 0.25;
        if (f.category === 'seating' && f.accessibility.wheelchairAccessible) {
          w *= isShowPhase ? 2.65 : 1.7;
        } else if (f.category === 'rest' || f.subtype === 'multilingual_info') {
          w *= 1.5;
        }
      } else if (role === 'stroller_family') {
        if (f.category === 'seating' && f.accessibility.wheelchairAccessible) {
          w *= isShowPhase ? 2.1 : 1.3;
        } else if (f.subtype === 'family_lounge' || f.subtype === 'play_zone' || f.category === 'rest') {
          w *= 2.3;
        }
      } else if (role === 'visually_impaired') {
        if (f.category === 'seating') {
          w *= isShowPhase ? 2.1 : 1.3;
        } else if (f.subtype === 'multilingual_info' || f.subtype === 'ticket_info' || f.category === 'rest') {
          w *= 2.0;
        }
      } else if (role === 'pet_owner') {
        if (f.category === 'camping' || f.category === 'rest' || f.category === 'food') {
          w *= 2.3;
        } else if (f.category === 'stage' || f.category === 'seating') {
          w *= 0.42;
        }
      } else if (f.category === 'seating' && isShowPhase) {
        w *= 1.32;
      }
      return Math.max(0.02, w);
    };

    let totalW = 0;
    for (let i = 0; i < interiorTargets.length; i++) {
      totalW += weightFor(interiorTargets[i]);
    }

    let roll = r() * totalW;
    for (let i = 0; i < interiorTargets.length; i++) {
      const f = interiorTargets[i];
      roll -= weightFor(f);
      if (roll <= 0) return f;
    }
    return interiorTargets[interiorTargets.length - 1];
  }

  private samplePointNearFacility(
    f: Facility,
    r: () => number,
    role: AgentRole = 'general',
  ): { x: number; y: number; z: number; heading?: number } {
    const W = f.dimensions.width;
    const D = f.dimensions.depth;
    const cosR = Math.cos(f.rotation);
    const sinR = Math.sin(f.rotation);

    const toWorld = (lx: number, lz: number, y = 0, ignoreSeatingId?: string) => {
      const wx = f.position.x + lx * cosR + lz * sinR;
      const wz = f.position.z - lx * sinR + lz * cosR;
      const clean = this.pushOutOfColliders(wx, wz, 0.85, ignoreSeatingId);
      return { x: clean.x, y, z: clean.z };
    };

    if (f.category === 'stage') {
      // Dedicated Stage-Front Barrier-Free Wheelchair Viewing Platform (무장애 관람 데크)
      const isStepFree =
        f.accessibility.wheelchairAccessible &&
        f.accessibility.stepFreeEntry &&
        this.config.accessibility.stepFreeRoutes;
      if (isStepFree && (role === 'wheelchair_user' || role === 'scooter_user') && r() < 0.72) {
        const viewDeckW = Math.min(8.5, W * 0.28);
        const lx = -W * 0.36 + (r() - 0.5) * (viewDeckW * 0.72);
        const lz = D * 0.5 + 5.2 + (r() - 0.5) * 2.2;
        const pt = toWorld(lx, lz, 0.58);
        return {
          ...pt,
          heading: Math.atan2(f.position.x - pt.x, f.position.z - pt.z),
        };
      }

      const lx = (r() - 0.5) * (W * 0.88);
      const lz = D * 0.5 + 4.8 + r() * 6.4;
      const pt = toWorld(lx, lz, 0);
      return {
        ...pt,
        heading: Math.atan2(f.position.x - pt.x, f.position.z - pt.z),
      };
    }

    if (f.subtype === 'main_entrance' || f.subtype === 'secondary_entrance') {
      const lx = (r() - 0.5) * Math.max(4, W * 0.55);
      const lz = (r() - 0.5) * (D * 0.85);
      return toWorld(lx, lz, 0);
    }

    if (f.category === 'seating') {
      // Staff or overflow visitors stand along the central aisle / perimeter overlooking the stage
      const lx = (r() - 0.5) * 1.8;
      const lz = D * 0.5 + 1.2 + r() * 2.0;
      const pt = toWorld(lx, lz, 0, f.id);
      const stages = this.facilities.filter((s) => s.category === 'stage');
      const st = stages[0];
      return {
        ...pt,
        heading: st ? Math.atan2(st.position.x - pt.x, st.position.z - pt.z) : Math.atan2(-sinR, -cosR),
      };
    }

    if (f.subtype === 'rest_plaza' || f.subtype === 'rain_canopy' || f.category === 'camping') {
      const lx = (r() - 0.5) * (W * 0.8);
      const lz = (r() - 0.5) * (D * 0.8);
      return toWorld(lx, lz, 0);
    }

    if (f.subtype === 'play_zone') {
      const lx = (r() - 0.5) * (W * 0.78);
      const lz = (r() < 0.5 ? 1 : -1) * (4.8 + r() * (D * 0.3));
      return toWorld(lx, lz, 0);
    }

    if (f.subtype === 'parking_lot') {
      const lx = (r() - 0.5) * (W * 0.24);
      const lz = (r() - 0.5) * (D * 0.78);
      return toWorld(lx, lz, 0);
    }

    // Solid booths, food stalls/trucks, restrooms, medical, VIP, family_lounge, info kiosks:
    // Queue cleanly in front of the service counter (+Z local space), NEVER inside the solid structure!
    const lx = (r() - 0.5) * (W * 0.85);
    const lz = D * 0.5 + 1.8 + r() * 3.4;
    return toWorld(lx, lz, 0);
  }

  private assignRouteToAgent(
    agentIdx: number,
    dest: Facility,
    r: () => number,
  ): void {
    const agent = this.agents[agentIdx];
    this.releaseAgentSeat(agentIdx);

    const W = this.config.venueWidth;
    const D = this.config.venueDepth;
    const isShowPhase =
      this.currentPhaseId === 'pre_show' || this.currentPhaseId === 'headline_show';

    // Try assigning a real seat or front wheelchair bay when destination is an Audience Seating Block!
    if (dest.category === 'seating' && agent.role !== 'staff' && agent.role !== 'pet_owner') {
      const preferAccessible =
        agent.role === 'wheelchair_user' ||
        agent.role === 'scooter_user' ||
        agent.role === 'stroller_family';
      const slotIdx = this.claimSeatSlot(dest.id, agentIdx, preferAccessible, r);

      if (slotIdx >= 0) {
        const slot = this.seatSlots[slotIdx];
        agent.seatSlotIndex = slotIdx;
        agent.seatFacilityId = dest.id;
        agent.targetFacilityId = dest.id;
        agent.targetX = slot.x;
        agent.targetY = slot.y;
        agent.targetZ = slot.z;
        agent.targetHeading = slot.heading;
        // Route cleanly via rear ramp/entry -> central aisle -> bench seat!
        agent.waypointsX[0] = slot.entryX;
        agent.waypointsZ[0] = slot.entryZ;
        agent.waypointsX[1] = slot.aisleX;
        agent.waypointsZ[1] = slot.aisleZ;
        agent.waypointsX[2] = slot.x;
        agent.waypointsZ[2] = slot.z;
        agent.wpCount = 3;
        agent.wpIndex = 0;
        agent.dwellRemaining = isShowPhase ? 22 + r() * 26 : 8 + r() * 10;
        agent.colorIndex = 1;
        return;
      }
    }

    const pt = this.samplePointNearFacility(dest, r, agent.role);
    let clampedX = Math.max(-W * 0.46, Math.min(W * 0.46, pt.x));
    let clampedZ = Math.max(-D * 0.46, Math.min(D * 0.46, pt.z));

    if (this.contingency === 'medical_emergency' && Math.abs(clampedX + 7) < 5.5) {
      clampedX = clampedX >= -7 ? -1.0 : -13.0;
    }

    const cleanTarget = this.pushOutOfColliders(clampedX, clampedZ, getAgentRadius(agent.role));
    clampedX = Math.max(-W * 0.46, Math.min(W * 0.46, cleanTarget.x));
    clampedZ = Math.max(-D * 0.46, Math.min(D * 0.46, cleanTarget.z));

    const isPriorityAccessGroup =
      agent.role === 'wheelchair_user' ||
      agent.role === 'scooter_user' ||
      agent.role === 'stroller_family';

    let midHubX: number;
    let midHubZ: number;
    if (isPriorityAccessGroup && (this.currentPhaseId === 'egress' || dest.category === 'entrance')) {
      // Route wheelchair, scooter, and stroller visitors along wide step-free perimeter egress corridors!
      midHubX = (clampedX >= 0 ? W * 0.39 : -W * 0.39) + agent.laneOffset * 0.25;
      midHubZ = Math.max(-D * 0.35, Math.min(D * 0.37, (agent.z + clampedZ) * 0.55));
    } else {
      midHubX =
        Math.abs(agent.x - clampedX) > 32
          ? (agent.x + clampedX) * 0.5 + agent.laneOffset
          : clampedX + agent.laneOffset * 0.4;
      midHubZ =
        Math.abs(agent.z - clampedZ) > 28
          ? Math.abs(clampedZ) < 18
            ? 6 + agent.laneOffset
            : (agent.z + clampedZ) * 0.5
          : clampedZ;
    }

    const cleanMid = this.pushOutOfColliders(
      Math.max(-W * 0.45, Math.min(W * 0.45, midHubX)),
      Math.max(-D * 0.45, Math.min(D * 0.45, midHubZ)),
      getAgentRadius(agent.role),
    );

    agent.waypointsX[0] = cleanMid.x;
    agent.waypointsZ[0] = cleanMid.z;
    agent.waypointsX[1] = clampedX;
    agent.waypointsZ[1] = clampedZ;
    agent.wpCount = 2;
    agent.wpIndex = 0;
    agent.targetX = clampedX;
    agent.targetY = pt.y;
    agent.targetZ = clampedZ;
    agent.targetHeading =
      pt.heading !== undefined ? pt.heading : Math.atan2(clampedX - agent.x, clampedZ - agent.z);
    agent.targetFacilityId = dest.id;
    agent.dwellRemaining =
      dest.category === 'stage' && isShowPhase ? 9 + r() * 12 : 1.4 + r() * 3.0;

    if (dest.category === 'stage' || dest.category === 'seating') agent.colorIndex = 1;
    else if (dest.category === 'food' || dest.category === 'rest') agent.colorIndex = 2;
    else if (dest.category === 'vip') agent.colorIndex = 3;
    else agent.colorIndex = 0;
  }

  public distributeAgentsForPhase(progress: number, instantPlace: boolean): void {
    this.currentProgress = Math.max(0, Math.min(1, progress));
    const phase = getPhaseForProgress(this.currentProgress);
    this.currentPhaseId = phase.id;
    const isShowPhase = phase.id === 'pre_show' || phase.id === 'headline_show';

    const activeFrac = Math.min(1.0, getActiveAttendanceFraction(this.currentProgress, this.contingency));
    const activeCount = Math.max(15, Math.round(this.maxAgents * activeFrac));

    const phaseSeed =
      this.config.seed ^
      hashStringSeed(`${phase.id}-${this.contingency}-${Math.round(this.currentProgress * 100)}`);
    const localRand = createSeededRandom(phaseSeed);

    const entrances = this.facilities.filter((f) => f.category === 'entrance');

    if (instantPlace) {
      for (let s = 0; s < this.seatSlots.length; s++) {
        this.seatSlots[s].occupiedBy = -1;
      }
      for (let i = 0; i < this.maxAgents; i++) {
        this.agents[i].seatSlotIndex = -1;
        this.agents[i].seatFacilityId = '';
        this.agents[i].isSeated = false;
        this.agents[i].isWatchingStage = false;
        this.agents[i].y = 0;
        this.agents[i].targetY = 0;
      }
    }

    for (let i = 0; i < this.maxAgents; i++) {
      const ag = this.agents[i];
      const wasActive = ag.active;
      ag.active = i < activeCount;
      if (!ag.active) {
        if (wasActive) this.releaseAgentSeat(i);
        continue;
      }

      // During transition from pre_show -> headline_show, let already-seated spectators stay in their seats!
      if (!instantPlace && isShowPhase && ag.seatSlotIndex >= 0 && ag.dwellRemaining > 0) {
        ag.dwellRemaining = 20 + localRand() * 24;
        continue;
      }

      const dest = this.pickTargetFacilityForRole(phase.id, ag.role, localRand);
      if (instantPlace) {
        const settleProb = dest.category === 'seating' && isShowPhase ? 0.84 : 0.68;
        if (localRand() < settleProb) {
          this.assignRouteToAgent(i, dest, localRand);
          if (ag.seatSlotIndex >= 0) {
            const slot = this.seatSlots[ag.seatSlotIndex];
            ag.x = slot.x;
            ag.y = slot.y;
            ag.z = slot.z;
            ag.heading = slot.heading;
            ag.wpIndex = ag.wpCount;
            ag.isSeated = !slot.isAccessibleBay;
            ag.isWatchingStage = true;
            ag.dwellRemaining = isShowPhase ? 16 + localRand() * 26 : 6 + localRand() * 10;
          } else {
            ag.x = ag.targetX;
            ag.y = ag.targetY;
            ag.z = ag.targetZ;
            if (this.contingency === 'medical_emergency' && Math.abs(ag.x + 7) < 5.5) {
              ag.x = ag.x >= -7 ? -1.0 : -13.0;
            }
            ag.heading = ag.targetHeading;
            ag.wpIndex = ag.wpCount;
            ag.isWatchingStage = dest.category === 'stage';
            ag.dwellRemaining =
              dest.category === 'stage' && isShowPhase
                ? 12 + localRand() * 18
                : ag.role === 'staff'
                  ? 4.0 + localRand() * 5.0
                  : 2.0 + localRand() * 5.0;
          }
        } else {
          const originFacility =
            phase.id === 'arrival' && entrances.length > 0
              ? entrances[i % entrances.length]
              : this.pickTargetFacilityForRole(phase.id, ag.role, localRand);
          const startPos = this.samplePointNearFacility(originFacility, localRand, ag.role);
          this.assignRouteToAgent(i, dest, localRand);
          const endX = ag.waypointsX[0];
          const endZ = ag.waypointsZ[0];
          const t = localRand();
          ag.x = startPos.x + (endX - startPos.x) * t + ag.laneOffset * 0.35;
          ag.y = 0;
          ag.z = startPos.z + (endZ - startPos.z) * t;
          if (this.contingency === 'medical_emergency' && Math.abs(ag.x + 7) < 5.5) {
            ag.x = ag.x >= -7 ? -1.0 : -13.0;
          }
          ag.isSeated = false;
          ag.isWatchingStage = false;
          ag.dwellRemaining = 0;
        }
      } else {
        this.assignRouteToAgent(i, dest, localRand);
      }
    }

    if (instantPlace) {
      this.resolveHardCollisions(3);
    }
  }

  public step(dt: number, speedMultiplier: number, isPlaying: boolean): void {
    if (!isPlaying || this.facilities.length === 0) {
      return;
    }

    const clampedDt = Math.min(0.05, Math.max(0.001, dt));
    const safeSpeed = Math.max(0.35, Math.min(2.5, speedMultiplier));

    const nextProgress = this.currentProgress + (clampedDt * safeSpeed) / 165;
    this.currentProgress = nextProgress > 1 ? 0 : nextProgress;

    const newPhase = getPhaseForProgress(this.currentProgress);
    if (newPhase.id !== this.currentPhaseId) {
      this.currentPhaseId = newPhase.id;
      this.distributeAgentsForPhase(this.currentProgress, false);
    } else {
      const activeFrac = Math.min(
        1.0,
        getActiveAttendanceFraction(this.currentProgress, this.contingency),
      );
      const activeCount = Math.max(15, Math.round(this.maxAgents * activeFrac));
      for (let i = 0; i < this.maxAgents; i++) {
        const shouldBeActive = i < activeCount;
        if (!shouldBeActive && this.agents[i].active) {
          this.releaseAgentSeat(i);
        }
        this.agents[i].active = shouldBeActive;
      }
    }

    this.bucketHeads.fill(-1);
    const W = this.config.venueWidth;
    const D = this.config.venueDepth;
    const halfW = W * 0.5;
    const halfD = D * 0.5;

    for (let i = 0; i < this.maxAgents; i++) {
      const ag = this.agents[i];
      if (!ag.active) continue;
      const bx = Math.max(0, Math.min(HASH_DIM - 1, Math.floor(((ag.x + halfW) / W) * HASH_DIM)));
      const bz = Math.max(0, Math.min(HASH_DIM - 1, Math.floor(((ag.z + halfD) / D) * HASH_DIM)));
      const bIdx = bz * HASH_DIM + bx;
      this.bucketNext[i] = this.bucketHeads[bIdx];
      this.bucketHeads[bIdx] = i;
    }

    const moveDt = clampedDt * safeSpeed;

    for (let i = 0; i < this.maxAgents; i++) {
      const ag = this.agents[i];
      if (!ag.active) continue;

      if (this.contingency === 'medical_emergency' && Math.abs(ag.x + 7) < 5.2 && ag.seatSlotIndex < 0) {
        const pushDir = ag.x >= -7 ? 1 : -1;
        ag.x += pushDir * 8.5 * moveDt;
      }

      // Agent has arrived at destination and is dwelling (e.g., sitting in audience seating or watching stage)
      if (ag.wpIndex >= ag.wpCount) {
        if (ag.dwellRemaining > 0) {
          ag.dwellRemaining -= moveDt;
          if (ag.seatSlotIndex >= 0) {
            const slot = this.seatSlots[ag.seatSlotIndex];
            ag.x = slot.x;
            ag.y = slot.y;
            ag.z = slot.z;
            ag.heading = slot.heading;
            ag.isSeated = !slot.isAccessibleBay;
            ag.isWatchingStage = true;
          } else {
            ag.y = ag.targetY;
            if (ag.isWatchingStage) {
              ag.heading = ag.targetHeading;
            }
          }
          continue;
        } else {
          // Finished dwelling -> pick next destination (during show phases, high chance to remain seated!)
          const isShowPhase =
            this.currentPhaseId === 'pre_show' || this.currentPhaseId === 'headline_show';
          if (ag.seatSlotIndex >= 0 && isShowPhase && this.rand() < 0.72) {
            ag.dwellRemaining = 18 + this.rand() * 20;
            continue;
          }
          const nextDest = this.pickTargetFacilityForRole(this.currentPhaseId, ag.role, this.rand);
          this.assignRouteToAgent(i, nextDest, this.rand);
          if (ag.role === 'staff') {
            ag.dwellRemaining = 4.0 + this.rand() * 6.0;
          }
        }
      }

      ag.isSeated = false;
      ag.isWatchingStage = false;

      const wx = ag.waypointsX[ag.wpIndex];
      const wz = ag.waypointsZ[ag.wpIndex];
      const dx = wx - ag.x;
      const dz = wz - ag.z;
      const distSq = dx * dx + dz * dz;
      const arrivalThreshSq = ag.seatSlotIndex >= 0 && ag.wpIndex === ag.wpCount - 1 ? 1.4 : 4.2;

      if (distSq < arrivalThreshSq) {
        ag.wpIndex++;
        if (ag.wpIndex >= ag.wpCount) {
          if (ag.seatSlotIndex >= 0) {
            const slot = this.seatSlots[ag.seatSlotIndex];
            ag.x = slot.x;
            ag.y = slot.y;
            ag.z = slot.z;
            ag.heading = slot.heading;
            ag.isSeated = !slot.isAccessibleBay;
            ag.isWatchingStage = true;
          } else {
            ag.y = ag.targetY;
            const destFac = this.facilities.find((f) => f.id === ag.targetFacilityId);
            if (destFac?.category === 'stage') {
              ag.isWatchingStage = true;
              ag.heading = ag.targetHeading;
            }
          }
        }
        continue;
      }

      // Smoothly step elevation up/down when walking along seating ramp/aisle
      if (ag.seatSlotIndex >= 0 && ag.wpIndex >= 1) {
        ag.y += (0.42 - ag.y) * Math.min(1, moveDt * 5);
      } else {
        ag.y += (0 - ag.y) * Math.min(1, moveDt * 6);
      }

      const dist = Math.sqrt(distSq);
      let dirX = dx / dist;
      let dirZ = dz / dist;

      // Reduce neighbor repulsion when stepping into final assigned bench row so agent reaches exact seat
      const enteringFinalSeat = ag.seatSlotIndex >= 0 && ag.wpIndex >= ag.wpCount - 1;
      if (!enteringFinalSeat) {
        const bx = Math.max(0, Math.min(HASH_DIM - 1, Math.floor(((ag.x + halfW) / W) * HASH_DIM)));
        const bz = Math.max(0, Math.min(HASH_DIM - 1, Math.floor(((ag.z + halfD) / D) * HASH_DIM)));
        let sepX = 0;
        let sepZ = 0;
        let checks = 0;
        for (let ndz = -1; ndz <= 1 && checks < 14; ndz++) {
          const nbz = bz + ndz;
          if (nbz < 0 || nbz >= HASH_DIM) continue;
          for (let ndx = -1; ndx <= 1 && checks < 14; ndx++) {
            const nbx = bx + ndx;
            if (nbx < 0 || nbx >= HASH_DIM) continue;
            let neighbor = this.bucketHeads[nbz * HASH_DIM + nbx];
            while (neighbor !== -1 && checks < 14) {
              if (neighbor !== i) {
                const other = this.agents[neighbor];
                const ox = ag.x - other.x;
                const oz = ag.z - other.z;
                const d2 = ox * ox + oz * oz;
                if (d2 > 0.005 && d2 < 5.2) {
                  const dN = Math.sqrt(d2);
                  const strength = (2.3 - Math.min(2.3, dN)) / 2.3;
                  sepX += (ox / dN) * strength;
                  sepZ += (oz / dN) * strength;
                  checks++;
                }
              }
              neighbor = this.bucketNext[neighbor];
            }
          }
        }
        dirX += sepX * 0.72;
        dirZ += sepZ * 0.72;
        const norm = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
        dirX /= norm;
        dirZ /= norm;
      }

      const ignoreSeatId = ag.seatFacilityId || undefined;
      const steered = this.steerAroundColliders(
        ag.x,
        ag.z,
        dirX,
        dirZ,
        getAgentRadius(ag.role),
        i,
        ignoreSeatId,
      );
      dirX = steered.dirX;
      dirZ = steered.dirZ;

      ag.vx = dirX * ag.speed;
      ag.vz = dirZ * ag.speed;
      ag.x = Math.max(-halfW + 2.5, Math.min(halfW - 2.5, ag.x + ag.vx * moveDt));
      ag.z = Math.max(-halfD + 2.5, Math.min(halfD - 2.5, ag.z + ag.vz * moveDt));
      ag.heading = Math.atan2(ag.vx, ag.vz);
    }

    this.resolveHardCollisions(2);
  }

  public seekToProgress(progress: number): void {
    this.distributeAgentsForPhase(progress, true);
  }

  public getSnapshot(): SimulationSnapshot {
    const W = this.config.venueWidth;
    const D = this.config.venueDepth;
    const halfW = W * 0.5;
    const halfD = D * 0.5;
    const cellAreaSqm = (W / GRID_COLS) * (D / GRID_ROWS);

    let activeAgents = 0;
    let rawGeneral = 0;
    let rawStaff = 0;
    let rawMobility = 0;
    let rawPets = 0;
    for (let i = 0; i < this.maxAgents; i++) {
      const ag = this.agents[i];
      if (!ag.active) continue;
      activeAgents++;
      if (ag.role === 'staff') {
        rawStaff++;
      } else if (
        ag.role === 'wheelchair_user' ||
        ag.role === 'scooter_user' ||
        ag.role === 'stroller_family' ||
        ag.role === 'visually_impaired'
      ) {
        rawMobility++;
      } else {
        rawGeneral++;
      }
      if (ag.hasCompanionPet) {
        rawPets++;
      }
    }

    const activeFraction = getActiveAttendanceFraction(this.currentProgress, this.contingency);
    const activeRealVisitors = Math.round(this.config.expectedAttendance * activeFraction);
    const visitorsPerAgent = activeAgents > 0 ? activeRealVisitors / activeAgents : 1;
    const roleCounts: CrowdRoleCounts = {
      general: Math.round(rawGeneral * visitorsPerAgent),
      staff: Math.max(12, Math.round(rawStaff * Math.min(8, visitorsPerAgent * 0.55))),
      mobilityAssisted: Math.round(rawMobility * visitorsPerAgent),
      companionPets: Math.round(rawPets * Math.min(10, visitorsPerAgent * 0.65)),
    };

    this.scratchGrid.fill(0);

    for (let i = 0; i < this.maxAgents; i++) {
      const ag = this.agents[i];
      if (!ag.active) continue;
      if (Math.abs(ag.x) > halfW || Math.abs(ag.z) > halfD) continue;
      const col = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(((ag.x + halfW) / W) * GRID_COLS)));
      const row = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(((ag.z + halfD) / D) * GRID_ROWS)));
      // Seated spectators in structured bench rows carry lower crush/turbulence density than free-standing crowds
      const crushWeight = ag.isSeated ? 0.58 : 1.0;
      this.scratchGrid[row * GRID_COLS + col] += (visitorsPerAgent * crushWeight) / cellAreaSqm;
    }

    this.densityGrid.fill(0);
    let peakDensity = 0;
    let occupiedSum = 0;
    let occupiedCells = 0;
    let peakCol = 0;
    let peakRow = 0;

    const corridorRelief = this.config.accessibility.wideCorridors ? 0.9 : 1.0;
    const holdingRelief = this.assumptions.inflowControlMode === 'holding' ? 0.88 : 1.0;
    const compliancePenalty = 1 + (1 - this.assumptions.guidanceComplianceRate) * 0.28;
    const densityFactor = corridorRelief * holdingRelief * compliancePenalty;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const centerRaw = this.scratchGrid[r * GRID_COLS + c];
        let acc = 0;
        let weightSum = 0;
        let neighborOccupiedCount = 0;
        for (let dr = -1; dr <= 1; dr++) {
          const nr = r + dr;
          if (nr < 0 || nr >= GRID_ROWS) continue;
          for (let dc = -1; dc <= 1; dc++) {
            const nc = c + dc;
            if (nc < 0 || nc >= GRID_COLS) continue;
            const cellVal = this.scratchGrid[nr * GRID_COLS + nc];
            if (cellVal > 0) neighborOccupiedCount++;
            const w = dr === 0 && dc === 0 ? 5 : dr === 0 || dc === 0 ? 1.5 : 0.75;
            acc += cellVal * w;
            weightSum += w;
          }
        }
        if (centerRaw === 0 && neighborOccupiedCount < 2) {
          this.densityGrid[r * GRID_COLS + c] = 0;
          continue;
        }
        const bleedScale = centerRaw === 0 ? 0.45 : 1.0;
        const val = (acc / weightSum) * densityFactor * bleedScale;
        this.densityGrid[r * GRID_COLS + c] = val;
        if (val > peakDensity) {
          peakDensity = val;
          peakCol = c;
          peakRow = r;
        }
        if (val > 0.12) {
          occupiedSum += val;
          occupiedCells++;
        }
      }
    }

    const facilityOccupancy: Record<string, number> = {};
    const facilityQueues: Record<string, number> = {};
    for (const f of this.facilities) {
      facilityOccupancy[f.id] = 0;
      facilityQueues[f.id] = 0;
    }

    for (let i = 0; i < this.maxAgents; i++) {
      const ag = this.agents[i];
      if (!ag.active) continue;
      let nearest: Facility | null = null;
      let bestDistSq = Infinity;
      for (let j = 0; j < this.facilities.length; j++) {
        const f = this.facilities[j];
        const radius = Math.max(f.dimensions.width, f.dimensions.depth) * 0.85 + 9;
        const dx = ag.x - f.position.x;
        const dz = ag.z - f.position.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < radius * radius && d2 < bestDistSq) {
          bestDistSq = d2;
          nearest = f;
        }
      }
      if (nearest) {
        facilityOccupancy[nearest.id] = Math.round(
          (facilityOccupancy[nearest.id] || 0) + visitorsPerAgent,
        );
      }
    }

    const bottlenecks: BottleneckAlert[] = [];
    for (const f of this.facilities) {
      const occ = facilityOccupancy[f.id] || 0;
      const effectiveServiceCap = Math.max(60, f.capacity);
      const util = occ / effectiveServiceCap;
      const queue =
        occ > effectiveServiceCap * 0.82 ? Math.round((occ - effectiveServiceCap * 0.82) * 0.65) : 0;
      facilityQueues[f.id] = queue;

      const fCol = Math.max(
        0,
        Math.min(GRID_COLS - 1, Math.floor(((f.position.x + halfW) / W) * GRID_COLS)),
      );
      const fRow = Math.max(
        0,
        Math.min(GRID_ROWS - 1, Math.floor(((f.position.z + halfD) / D) * GRID_ROWS)),
      );
      let localMaxDensity = this.densityGrid[fRow * GRID_COLS + fCol];
      if (fRow + 1 < GRID_ROWS) {
        localMaxDensity = Math.max(localMaxDensity, this.densityGrid[(fRow + 1) * GRID_COLS + fCol]);
      }

      if (util > 0.92 || localMaxDensity > 2.15 || queue >= 35) {
        bottlenecks.push({
          facilityId: f.id,
          facilityName: f.nameKo || f.name,
          category: f.category,
          peakDensity: Number(Math.max(localMaxDensity, util * 1.9).toFixed(2)),
          estimatedQueue: queue,
          utilizationRatio: Number(util.toFixed(2)),
        });
      }
    }

    bottlenecks.sort((a, b) => b.peakDensity - a.peakDensity);

    const peakWorldX = -halfW + ((peakCol + 0.5) / GRID_COLS) * W;
    const peakWorldZ = -halfD + ((peakRow + 0.5) / GRID_ROWS) * D;
    let mostCongestedZone = '중앙 보행 광장';
    let mostCongestedFacilityId: string | undefined;
    let minZoneDist = Infinity;
    for (const f of this.facilities) {
      const d = Math.hypot(f.position.x - peakWorldX, f.position.z - peakWorldZ);
      if (d < minZoneDist) {
        minZoneDist = d;
        mostCongestedZone = f.nameKo || f.name;
        mostCongestedFacilityId = f.id;
      }
    }

    return {
      progress: this.currentProgress,
      currentTimeLabel: formatTimeFromProgress(
        this.currentProgress,
        this.config.startTime,
        this.config.endTime,
      ),
      phase: getPhaseForProgress(this.currentProgress),
      contingency: this.contingency,
      activeAgentCount: activeAgents,
      simulatedScaleFactor: Number(visitorsPerAgent.toFixed(1)),
      peakDensity: Number(peakDensity.toFixed(2)),
      avgActiveDensity: Number((occupiedCells > 0 ? occupiedSum / occupiedCells : 0).toFixed(2)),
      mostCongestedZone,
      mostCongestedFacilityId,
      bottlenecks: bottlenecks.slice(0, 5),
      facilityOccupancy,
      facilityQueues,
      gridCols: GRID_COLS,
      gridRows: GRID_ROWS,
      densityGrid: this.densityGrid,
      timelineSeries: this.cachedTimeline,
      roleCounts,
    };
  }

  private computeFullDayTimeline(): TimelinePoint[] {
    const points: TimelinePoint[] = [];
    const steps = 12;
    const W = this.config.venueWidth;
    const D = this.config.venueDepth;
    const areaFactor = (200 * 150) / Math.max(8000, W * D);
    const surgeMult = this.contingency === 'surge' ? 1.35 : 1.0;
    const baseCrowdLoad = ((this.config.expectedAttendance * surgeMult) / 10000) * Math.sqrt(areaFactor);

    const foodCount = Math.max(1, this.facilities.filter((f) => f.category === 'food').length);
    const restroomCount = Math.max(1, this.facilities.filter((f) => f.category === 'restroom').length);
    const rainCanopyCount = this.facilities.filter((f) => f.subtype === 'rain_canopy').length;
    const entranceCap = Math.max(
      600,
      this.facilities
        .filter((f) => f.category === 'entrance')
        .reduce((s, f) => s + f.capacity, 0),
    );

    const foods = this.facilities.filter((f) => f.category === 'food');
    const foodSpread =
      foods.length >= 2
        ? Math.max(...foods.map((f) => f.position.x)) - Math.min(...foods.map((f) => f.position.x))
        : 20;
    const clusterPenalty = foodSpread < W * 0.25 ? 1.24 : 0.92;
    const rainPenalty =
      this.contingency === 'rain' ? Math.max(0.95, 1.36 - rainCanopyCount * 0.16) : 1.0;

    const openGateFacilities = this.facilities.filter(
      (f) => f.category === 'entrance' && !(this.assumptions.closedPrimaryGate && f.id === this.primaryGateId),
    );
    const effectiveGateCap = Math.max(
      450,
      openGateFacilities.reduce((s, f) => s + f.capacity, 0),
    );
    const holdingRelief = this.assumptions.inflowControlMode === 'holding' ? 0.86 : 1.0;
    const compliancePenalty = 1 + (1 - this.assumptions.guidanceComplianceRate) * 0.32;

    for (let s = 0; s <= steps; s++) {
      const p = s / steps;
      const phase = getPhaseForProgress(p);
      const activeFrac = getActiveAttendanceFraction(p, this.contingency);
      const activeVisitors = Math.round(this.config.expectedAttendance * activeFrac);

      let phasePeakMult = 1.6;
      let queued = 0;
      let stageShare = 25;
      let foodShare = 20;
      let boothShare = 30;

      if (phase.id === 'arrival') {
        phasePeakMult = 1.75 * (3000 / effectiveGateCap);
        queued = Math.round(Math.max(0, activeVisitors * 0.18 - effectiveGateCap * 0.45));
        stageShare = 18;
        foodShare = 16;
        boothShare = 28;
      } else if (phase.id === 'afternoon_booths') {
        phasePeakMult = 1.45 * rainPenalty;
        queued = Math.round(activeVisitors * 0.05 * rainPenalty);
        stageShare = 22;
        foodShare = 26;
        boothShare = 42;
      } else if (phase.id === 'pre_show') {
        phasePeakMult = (this.contingency === 'stage_delay' ? 2.65 : 2.25) * rainPenalty * holdingRelief;
        queued = Math.round(activeVisitors * (this.contingency === 'stage_delay' ? 0.14 : 0.07));
        stageShare = this.contingency === 'stage_delay' ? 26 : 52;
        foodShare = this.contingency === 'stage_delay' ? 38 : 20;
        boothShare = this.contingency === 'stage_delay' ? 28 : 18;
      } else if (phase.id === 'headline_show') {
        phasePeakMult = (this.contingency === 'stage_delay' ? 2.75 : 2.85) * rainPenalty * holdingRelief;
        queued = Math.round(activeVisitors * (this.contingency === 'stage_delay' ? 0.16 : 0.04));
        stageShare = this.contingency === 'stage_delay' ? 30 : 68;
        foodShare = this.contingency === 'stage_delay' ? 40 : 12;
        boothShare = this.contingency === 'stage_delay' ? 22 : 10;
      } else if (phase.id === 'intermission') {
        phasePeakMult =
          ((2.55 * clusterPenalty * 5) / Math.max(2.5, foodCount + restroomCount * 0.6)) *
          rainPenalty *
          holdingRelief;
        queued = Math.round(
          ((activeVisitors * 0.22 * clusterPenalty) / Math.max(1.5, foodCount * 0.38)) * rainPenalty,
        );
        stageShare = 20;
        foodShare = 46;
        boothShare = 22;
      } else {
        phasePeakMult = 2.1 * (3200 / effectiveGateCap);
        queued = Math.round(Math.max(0, activeVisitors * 0.24 - effectiveGateCap * 0.5));
        stageShare = 10;
        foodShare = 10;
        boothShare = 12;
      }

      const corridorRelief = this.config.accessibility.wideCorridors ? 0.91 : 1.0;
      const peakDensity = Number(
        Math.min(
          6.4,
          Math.max(0.35, baseCrowdLoad * phasePeakMult * corridorRelief * compliancePenalty),
        ).toFixed(2),
      );
      const avgDensity = Number((peakDensity * 0.36).toFixed(2));

      points.push({
        timeLabel: formatTimeFromProgress(p, this.config.startTime, this.config.endTime),
        progress: p,
        phaseId: phase.id,
        phaseLabel: phase.shortLabel,
        phaseLabelKo: phase.shortLabelKo,
        peakDensity,
        avgDensity,
        activeVisitors,
        totalQueued: Math.max(0, queued),
        stageZoneShare: stageShare,
        foodZoneShare: foodShare,
        boothZoneShare: boothShare,
      });
    }
    return points;
  }
}
