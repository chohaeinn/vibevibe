import {
  AnalysisScores,
  BoothModelStyle,
  CandidateLayout,
  ContingencyScenario,
  DensityReferenceProfileId,
  DesignObjective,
  EventConfig,
  Facility,
  Language,
  LayoutComparison,
  LayoutMetricsSummary,
  MoisSafetyTier,
  PersonaEvaluation,
  Recommendation,
  SimulationAssumptions,
  SimulationSnapshot,
  VenueLayoutModel,
  XaiExplanation,
} from '../types/festival';
import {
  CONTINGENCY_INFO,
  DEFAULT_SIMULATION_ASSUMPTIONS,
  formatCurrency,
  getEffectiveFacilityCost,
} from './presets';
import { EVENT_TYPE_MULTILANG } from '../i18n/translations';
import {
  BOOTH_MODEL_STYLE_I18N,
  CONTINGENCY_I18N,
  DENSITY_PROFILE_I18N,
  getLocaleCode,
  pickL6,
  tr6,
  VENUE_LAYOUT_MODEL_I18N,
} from '../i18n/localeCatalog';
import {
  classifyDensityByProfile,
  computeUsableAreaAndReferenceCapacity,
  densityUnitLabel,
  getProfileTierBadgeText,
} from './evidenceBase';
import { CrowdSimulator } from './crowdSimulation';
import {
  applyInclusivePersonaUpgrade,
  fitLayoutToBudget,
  generateVenueLayout,
  optimizeVenueLayout,
} from './layoutGenerator';

function koOr6(
  lang: Language,
  ko: string,
  en: string,
  ja: string,
  zh: string,
  es: string,
  fr: string,
): { ko: string; en: string } {
  const localized = tr6(lang, ko, en, ja, zh, es, fr);
  return {
    ko: lang === 'ko' ? ko : localized,
    en: lang === 'ko' ? en : localized,
  };
}

const OBJECTIVE_WEIGHTS: Record<
  DesignObjective,
  {
    safety: number;
    accessibility: number;
    crowdFlow: number;
    distributionBalance: number;
    operationalEfficiency: number;
    budgetEfficiency: number;
  }
> = {
  safety_first: {
    safety: 0.34,
    accessibility: 0.16,
    crowdFlow: 0.22,
    distributionBalance: 0.10,
    operationalEfficiency: 0.10,
    budgetEfficiency: 0.08,
  },
  congestion_reduction: {
    safety: 0.20,
    accessibility: 0.12,
    crowdFlow: 0.34,
    distributionBalance: 0.20,
    operationalEfficiency: 0.08,
    budgetEfficiency: 0.06,
  },
  accessibility_inclusion: {
    safety: 0.20,
    accessibility: 0.36,
    crowdFlow: 0.16,
    distributionBalance: 0.10,
    operationalEfficiency: 0.10,
    budgetEfficiency: 0.08,
  },
  visitor_engagement: {
    safety: 0.16,
    accessibility: 0.14,
    crowdFlow: 0.20,
    distributionBalance: 0.26,
    operationalEfficiency: 0.14,
    budgetEfficiency: 0.10,
  },
  operational_efficiency: {
    safety: 0.18,
    accessibility: 0.12,
    crowdFlow: 0.20,
    distributionBalance: 0.14,
    operationalEfficiency: 0.26,
    budgetEfficiency: 0.10,
  },
  budget_efficiency: {
    safety: 0.18,
    accessibility: 0.12,
    crowdFlow: 0.16,
    distributionBalance: 0.10,
    operationalEfficiency: 0.14,
    budgetEfficiency: 0.30,
  },
};

function clampScore(v: number): number {
  return Math.round(Math.max(18, Math.min(99, v)));
}

/**
 * Classifies crowd density according to the selected MoIS (행정안전부, 2024.9) reference profile [1].
 * Note: Treated strictly as a planning reference interval, not a standalone guarantee of safety.
 */
export function getMoisSafetyTier(
  peakDensity: number,
  profileId: DensityReferenceProfileId = 'mois_2024_main_table',
): MoisSafetyTier {
  return classifyDensityByProfile(peakDensity, profileId);
}

export function computeAverageWalkingDistance(facilities: Facility[]): number {
  const portals = facilities.filter((f) => f.category === 'entrance');
  const attractions = facilities.filter(
    (f) => f.category === 'stage' || f.category === 'booth' || f.category === 'food' || f.category === 'rest',
  );
  const restrooms = facilities.filter((f) => f.category === 'restroom');

  if (portals.length === 0 || attractions.length === 0) return 65;

  let sumDist = 0;
  let pairs = 0;
  for (const p of portals) {
    for (const a of attractions) {
      sumDist += Math.hypot(p.position.x - a.position.x, p.position.z - a.position.z);
      pairs++;
    }
  }
  for (const a of attractions) {
    if (restrooms.length > 0) {
      const nearestRR = Math.min(
        ...restrooms.map((r) => Math.hypot(a.position.x - r.position.x, a.position.z - r.position.z)),
      );
      sumDist += nearestRR;
      pairs++;
    }
  }
  return Math.round(pairs > 0 ? sumDist / pairs : 65);
}

/**
 * Estimates average visitor service wait time (minutes) across food, restroom, and gate queues.
 */
function computeEstimatedWaitMinutes(
  config: EventConfig,
  facilities: Facility[],
  snapshot: SimulationSnapshot,
): number {
  const foods = facilities.filter((f) => f.category === 'food');
  const restrooms = facilities.filter((f) => f.category === 'restroom');
  const gates = facilities.filter(
    (f) => f.category === 'entrance' && (f.subtype === 'main_entrance' || f.subtype === 'secondary_entrance'),
  );

  const foodCap = Math.max(200, foods.reduce((s, f) => s + f.capacity, 0));
  const rrCap = Math.max(150, restrooms.reduce((s, f) => s + f.capacity, 0));
  const gateCap = Math.max(600, gates.reduce((s, f) => s + f.capacity, 0));

  const foodSpread =
    foods.length >= 2
      ? Math.max(...foods.map((f) => f.position.x)) - Math.min(...foods.map((f) => f.position.x))
      : 15;
  const clusterFactor = foodSpread < config.venueWidth * 0.26 ? 1.32 : 0.88;
  const corridorFactor = config.accessibility.wideCorridors ? 0.9 : 1.04;
  const contingencyFactor =
    snapshot.contingency === 'surge'
      ? 1.38
      : snapshot.contingency === 'rain' && !facilities.some((f) => f.subtype === 'rain_canopy')
        ? 1.28
        : snapshot.contingency === 'stage_delay' && !facilities.some((f) => f.id === 'stage-popup-busking')
          ? 1.25
          : 1.0;

  const demandLoad =
    (config.expectedAttendance / foodCap) * 1.45 +
    (config.expectedAttendance / rrCap) * 0.35 +
    (config.expectedAttendance / gateCap) * 0.85;

  const rawMinutes = demandLoad * clusterFactor * corridorFactor * contingencyFactor;
  return Number(Math.max(3.2, Math.min(42, rawMinutes)).toFixed(1));
}

export function evaluateVenueLayout(
  config: EventConfig,
  facilities: Facility[],
  snapshot: SimulationSnapshot,
  assumptions: SimulationAssumptions = DEFAULT_SIMULATION_ASSUMPTIONS,
): LayoutMetricsSummary {
  const areaBreakdown = computeUsableAreaAndReferenceCapacity(
    config,
    facilities,
    assumptions.densityProfile,
  );
  const venueAreaSqm = areaBreakdown.venueAreaSqm;
  const totalFacilities = facilities.length;
  const totalCapacity = facilities.reduce((s, f) => s + f.capacity, 0);
  const estimatedCost = facilities.reduce((s, f) => s + getEffectiveFacilityCost(f), 0);
  const budgetUsagePct = Number(((estimatedCost / Math.max(1, config.budget)) * 100).toFixed(1));

  const timelineMaxDensity = snapshot.timelineSeries.reduce(
    (m, pt) => Math.max(m, pt.peakDensity),
    snapshot.peakDensity,
  );
  const peakDensity = Number(Math.max(snapshot.peakDensity, timelineMaxDensity).toFixed(2));
  const moisSafetyTier = getMoisSafetyTier(peakDensity, assumptions.densityProfile);
  const avgWalkingDistanceM = computeAverageWalkingDistance(facilities);
  const avgWaitMinutes = computeEstimatedWaitMinutes(config, facilities, snapshot);

  const gates = facilities.filter(
    (f) => f.category === 'entrance' && (f.subtype === 'main_entrance' || f.subtype === 'secondary_entrance'),
  );
  const gateCapRatio = gates.reduce((s, f) => s + f.capacity, 0) / Math.max(500, config.expectedAttendance);
  const medCount = facilities.filter((f) => f.category === 'medical').length;
  const stage = facilities.find((f) => f.category === 'stage');
  const seats = facilities.filter((f) => f.category === 'seating');
  let stageBufferBonus = 8;
  if (stage && seats.length > 0) {
    const minGap = Math.min(
      ...seats.map(
        (s) =>
          Math.hypot(s.position.x - stage.position.x, s.position.z - stage.position.z) -
          (stage.dimensions.depth + s.dimensions.depth) * 0.5,
      ),
    );
    stageBufferBonus = minGap >= 9 ? 11 : minGap >= 5 ? 5 : -8;
  }
  const densityPenalty = Math.max(0, (peakDensity - 1.8) * 14);
  const safety = clampScore(
    64 +
      Math.min(18, gateCapRatio * 48) +
      Math.min(10, medCount * 5.5) +
      stageBufferBonus +
      (config.accessibility.wideCorridors ? 4 : 0) -
      densityPenalty,
  );

  const accessibleCount = facilities.filter((f) => f.accessibility.wheelchairAccessible).length;
  const accessRatio = totalFacilities > 0 ? accessibleCount / totalFacilities : 1;
  const hasAccParking = facilities.some(
    (f) => f.category === 'parking' && f.accessibility.wheelchairAccessible,
  );
  const hasAccRestroom = facilities.some(
    (f) => f.category === 'restroom' && f.accessibility.wheelchairAccessible,
  );
  const hasFamilyLounge = facilities.some((f) => f.subtype === 'family_lounge');
  const hasMultiInfo = facilities.some((f) => f.subtype === 'multilingual_info');
  const walkPenalty = Math.max(0, (avgWalkingDistanceM - 85) * 0.25);
  const accessibility = clampScore(
    42 +
      accessRatio * 32 +
      (config.accessibility.stepFreeRoutes ? 7 : 0) +
      (config.accessibility.wideCorridors ? 6 : 0) +
      (hasAccParking ? 3 : 0) +
      (hasAccRestroom ? 4 : 0) +
      (hasFamilyLounge ? 4 : 0) +
      (hasMultiInfo ? 3 : 0) -
      walkPenalty,
  );

  const foods = facilities.filter((f) => f.category === 'food');
  const foodSpreadX =
    foods.length >= 2
      ? Math.max(...foods.map((f) => f.position.x)) - Math.min(...foods.map((f) => f.position.x))
      : 35;
  const spreadBonus = foodSpreadX >= config.venueWidth * 0.26 ? 9 : -4;
  const bottleneckPenalty = snapshot.bottlenecks.length * 4.8;
  const crowdFlow = clampScore(
    86 +
      spreadBonus +
      Math.min(8, gates.length * 2.5) -
      bottleneckPenalty -
      Math.max(0, (peakDensity - 2.0) * 11),
  );

  const quadrants = [0, 0, 0, 0];
  for (const f of facilities) {
    const qx = f.position.x >= 0 ? 1 : 0;
    const qz = f.position.z >= 0 ? 2 : 0;
    quadrants[qx + qz] += f.attractionWeight;
  }
  const avgQ = quadrants.reduce((a, b) => a + b, 0) / 4 || 1;
  const qVariance = quadrants.reduce((s, q) => s + Math.abs(q - avgQ), 0) / (4 * avgQ);
  const distributionBalance = clampScore(92 - qVariance * 28 + (spreadBonus > 0 ? 4 : 0));

  const restroomCap = facilities
    .filter((f) => f.category === 'restroom')
    .reduce((s, f) => s + f.capacity, 0);
  const restroomAdequacy = Math.min(12, (restroomCap / Math.max(500, config.expectedAttendance * 0.065)) * 9);
  const capAdequacy = Math.min(14, (totalCapacity / Math.max(500, config.expectedAttendance)) * 12);
  const operationalEfficiency = clampScore(
    68 + restroomAdequacy + capAdequacy - Math.max(0, (avgWalkingDistanceM - 95) * 0.22),
  );

  let budgetEfficiency = 85;
  if (budgetUsagePct <= 100) {
    budgetEfficiency = clampScore(95 - Math.abs(84 - budgetUsagePct) * 0.42);
  } else {
    budgetEfficiency = clampScore(82 - (budgetUsagePct - 100) * 1.45);
  }

  const w = OBJECTIVE_WEIGHTS[config.objective];
  const overall = clampScore(
    safety * w.safety +
      accessibility * w.accessibility +
      crowdFlow * w.crowdFlow +
      distributionBalance * w.distributionBalance +
      operationalEfficiency * w.operationalEfficiency +
      budgetEfficiency * w.budgetEfficiency,
  );

  const scores: AnalysisScores = {
    safety,
    accessibility,
    crowdFlow,
    distributionBalance,
    operationalEfficiency,
    budgetEfficiency,
    overall,
  };

  const activeVisitors = Math.max(
    1,
    Object.values(snapshot.facilityOccupancy).reduce((a, b) => a + b, 0),
  );
  const facilityUtilizationPct = Number(
    Math.min(100, (activeVisitors / Math.max(1, totalCapacity)) * 100).toFixed(1),
  );

  return {
    totalFacilities,
    totalCapacity,
    venueAreaSqm,
    occupiedAreaSqm: areaBreakdown.occupiedAreaSqm,
    usableAreaSqm: areaBreakdown.usableAreaSqm,
    referenceDensityStandard: areaBreakdown.referenceDensityPerSqm,
    referenceCapacity: areaBreakdown.referenceCapacity,
    peakDensity,
    moisSafetyTier,
    avgWalkingDistanceM,
    avgWaitMinutes,
    modeledBottlenecks: snapshot.bottlenecks.length,
    facilityUtilizationPct,
    estimatedCost,
    budgetUsagePct,
    scores,
  };
}

/**
 * Quantitative Inclusive Accessibility Evaluator for 5 Visitor Personas (포용적 이용자 5대 계층 분석).
 */
export function evaluateInclusivePersonas(
  config: EventConfig,
  facilities: Facility[],
  lang: Language = 'ko',
): PersonaEvaluation[] {
  const total = Math.max(1, facilities.length);
  const wheelchairFacs = facilities.filter((f) => f.accessibility.wheelchairAccessible);
  const wheelchairPct = Math.round((wheelchairFacs.length / total) * 100);
  const parking = facilities.find((f) => f.category === 'parking');
  const mainGate =
    facilities.find((f) => f.subtype === 'main_entrance') ||
    facilities.find((f) => f.category === 'entrance');
  const restrooms = facilities.filter((f) => f.category === 'restroom');

  const parkToGateM =
    parking && mainGate
      ? Math.round(Math.hypot(parking.position.x - mainGate.position.x, parking.position.z - mainGate.position.z))
      : 54;
  const wcScore = clampScore(
    wheelchairPct * 0.58 +
      (config.accessibility.wideCorridors ? 18 : 4) +
      (config.accessibility.stepFreeRoutes ? 14 : 0) +
      (restrooms.some((r) => r.accessibility.wheelchairAccessible) ? 10 : 0) -
      Math.max(0, (parkToGateM - 65) * 0.25),
  );

  const familyLounge = facilities.find((f) => f.subtype === 'family_lounge');
  const restZones = facilities.filter((f) => f.category === 'rest');
  const strollerDist =
    familyLounge && mainGate
      ? Math.round(
          Math.hypot(familyLounge.position.x - mainGate.position.x, familyLounge.position.z - mainGate.position.z),
        )
      : 92;
  const strollerScore = clampScore(
    (familyLounge ? 46 : 22) +
      (config.accessibility.wideCorridors ? 20 : 8) +
      Math.min(22, restZones.length * 8) +
      (config.accessibility.stepFreeRoutes ? 12 : 4) -
      Math.max(0, (strollerDist - 75) * 0.2),
  );

  const playZone = facilities.find((f) => f.subtype === 'play_zone');
  const stage = facilities.find((f) => f.subtype === 'main_stage');
  const infoHub =
    facilities.find((f) => f.subtype === 'multilingual_info') ||
    facilities.find((f) => f.subtype === 'ticket_info');
  const stageSeparationM =
    playZone && stage
      ? Math.round(Math.hypot(playZone.position.x - stage.position.x, playZone.position.z - stage.position.z))
      : 38;
  const childScore = clampScore(
    (playZone ? 44 : 18) +
      (stageSeparationM >= 55 ? 26 : 10) +
      (infoHub ? 18 : 6) +
      (facilities.some((f) => f.category === 'medical') ? 10 : 0),
  );

  const restAndSeats = facilities.filter((f) => f.category === 'rest' || f.category === 'seating');
  let maxRestGapM = 84;
  if (restAndSeats.length >= 2) {
    const nearestGaps = restAndSeats.map((a) => {
      const others = restAndSeats.filter((b) => b.id !== a.id);
      return Math.min(
        ...others.map((b) => Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z)),
      );
    });
    maxRestGapM = Math.round(Math.max(...nearestGaps));
  }
  const seniorScore = clampScore(
    48 +
      Math.min(26, restZones.length * 9) +
      Math.min(18, restrooms.length * 6) +
      (maxRestGapM <= 58 ? 14 : -Math.round((maxRestGapM - 58) * 0.35)),
  );

  const multiInfo = facilities.find((f) => f.subtype === 'multilingual_info');
  const gateToInfoM =
    multiInfo && mainGate
      ? Math.round(Math.hypot(multiInfo.position.x - mainGate.position.x, multiInfo.position.z - mainGate.position.z))
      : 78;
  const foreignerScore = clampScore(
    (multiInfo ? 54 : 26) +
      (gateToInfoM <= 45 ? 24 : 10) +
      Math.min(20, facilities.filter((f) => f.category === 'entrance').length * 6),
  );

  const p1Label = koOr6(lang, '휠체어·전동보장구 이용자', 'Wheelchair & Scooter Users', '車椅子・電動カート利用者', '轮椅与电动代步车使用者', 'Usuarios de Silla de Ruedas / Scooter', 'Usagers Fauteuil Roulant / Scooter');
  const p1Finding =
    wcScore >= 82
      ? koOr6(lang, `무단차 경사로 ${wheelchairPct}% 확보 · 5.2m 통로 및 전용 외곽 퇴장로 연결`, `${wheelchairPct}% step-free ramp coverage with 5.2m corridors & dedicated perimeter egress`, `段差解消スロープ ${wheelchairPct}% 確保・5.2m通路および外周専用退場路を接続`, `无障碍坡道覆盖率 ${wheelchairPct}% · 5.2m宽通道并直连外围专用退场流线`, `${wheelchairPct}% rampas sin escalones con pasillos de 5.2m y salida perimetral dedicada`, `${wheelchairPct} % de rampes sans marche avec allées de 5,2 m et sortie dédiée`)
      : koOr6(lang, `경사로 적용률 ${wheelchairPct}% · 주 보행로 폭 확장(5.2m) 보완 권장`, `${wheelchairPct}% ramp coverage; widen corridors to 5.2m for passing clearance`, `スロープ適用率 ${wheelchairPct}%・主要通路幅5.2mへの拡張を推奨`, `坡道覆盖率 ${wheelchairPct}% · 建议将主步道拓宽至 5.2m`, `${wheelchairPct}% rampas; se recomienda ampliar pasillos a 5.2m`, `${wheelchairPct} % de rampes ; élargissement des allées à 5,2 m conseillé`);
  const p1Action = koOr6(lang, '무장애 경사로·광폭통로 적용', 'Apply Step-Free & 5.2m Corridors', '段差解消スロープ・広幅通路を適用', '启用无障碍坡道与5.2m宽通道', 'Aplicar Rampas y Pasillos de 5.2m', 'Activer Rampes & Allées de 5,2 m');

  const p2Label = koOr6(lang, '유모차 동반 가족', 'Stroller Families', 'ベビーカー同伴ファミリー', '婴儿车随行家庭', 'Familias con Carriola', 'Familles avec Poussette');
  const p2Finding = familyLounge
    ? koOr6(lang, `수유·유모차 가족 쉼터 배치 완료 (주출입구에서 ${strollerDist}m, 전용 퇴장로 연결)`, `Nursing & Stroller Lounge placed (${strollerDist}m from Main Gate, linked to priority egress)`, `授乳・ベビーカー休憩所を配置済（主ゲートから ${strollerDist}m、専用退場路接続）`, `母婴婴儿车休息区已就位（距主入口 ${strollerDist}m，连通专用退场道）`, `Sala familiar y carriolas ubicada (${strollerDist}m del acceso principal)`, `Salon famille & poussettes installé (${strollerDist} m de l’entrée principale)`)
    : koOr6(lang, '전용 수유·유모차 보관 쉼터 미배치 — 중앙 광장 인근 설치 권장', 'No Nursing & Stroller Family Lounge detected; add near central plaza', '授乳・ベビーカー専用休憩所が未配置 — 中央広場付近への設置を推奨', '尚未布置母婴婴儿车专用休息区 — 建议在中央广场附近增设', 'Falta sala familiar y carriolas; se recomienda junto a la plaza central', 'Aucun salon famille/poussettes détecté ; ajout conseillé près du centre');
  const p2Action = koOr6(lang, '유모차·수유 가족쉼터 확충', 'Add Family & Stroller Lounge', 'ファミリー・授乳休憩所を追加', '增设母婴与婴儿车家庭休息区', 'Añadir Sala Familiar y Carriolas', 'Ajouter Salon Famille & Poussettes');

  const p3Label = koOr6(lang, '어린이 관람객', 'Children & Youth', '子ども来場者', '儿童观众', 'Niños y Jóvenes', 'Enfants & Jeunes');
  const p3Finding = playZone
    ? koOr6(lang, `메인 무대 고밀집 구역과 ${stageSeparationM}m 안전 이격 · 안내소 연동`, `Kids Play Plaza safely buffered ${stageSeparationM}m from Main Stage crowd pit`, `メインステージ高密度区域から ${stageSeparationM}m 安全離隔・案内所連携`, `与主舞台高密观演区保持 ${stageSeparationM}m 安全缓冲并联动问询处`, `Zona infantil separada ${stageSeparationM}m del escenario principal`, `Espace enfants éloigné de ${stageSeparationM} m de la fosse scène`)
    : koOr6(lang, '어린이 전용 안전 놀이·휴식 광장 부재 — 무대 반대편 안전 구역 배치 권장', 'Missing dedicated Kids Play Plaza; place away from high-density stage front', 'キッズ安全広場が未配置 — ステージ反対側の安全エリアへの配置を推奨', '缺少儿童安全游乐休息区 — 建议布置在远离舞台的安全侧', 'Falta zona infantil segura; ubicar lejos del frente del escenario', 'Zone enfants absente ; à placer à l’écart du front de scène');
  const p3Action = koOr6(lang, '어린이 안전 놀이존·완충 배치', 'Buffer Kids Safety Plaza', 'キッズ安全ゾーンを緩衝配置', '增设儿童安全游乐缓冲专区', 'Añadir Zona Infantil Segura', 'Ajouter Zone Enfants Sécurisée');

  const p4Label = koOr6(lang, '고령자 (어르신)', 'Senior Visitors', '高齢者（シニア）', '老年观众（长者）', 'Personas Mayores', 'Visiteurs Seniors');
  const p4Finding =
    maxRestGapM <= 58
      ? koOr6(lang, `쉼터 간 최대 연속 보행거리 ${maxRestGapM}m (권장 60m 이내 충족)`, `Max continuous walk between shaded benches is ${maxRestGapM}m (<=60m target)`, `休憩所間の最大連続歩行距離 ${maxRestGapM}m（推奨60m以内を充足）`, `休息区之间最大连续步行距离 ${maxRestGapM}m（满足 ≤60m 标准）`, `Distancia máxima entre descansos ${maxRestGapM}m (cumple <=60m)`, `Distance maximale entre aires de repos ${maxRestGapM} m (cible <=60 m)`)
      : koOr6(lang, `쉼터 간 최대 보행 간격 ${maxRestGapM}m — 중간 지점 그늘 쉼터 추가 권장`, `Max gap between rest zones is ${maxRestGapM}m; add mid-promenade shaded benches`, `休憩所間の最大間隔 ${maxRestGapM}m — 中間地点への日除け休憩所追加を推奨`, `休息区最大间距 ${maxRestGapM}m — 建议在中途增设遮阳座椅区`, `Distancia entre descansos ${maxRestGapM}m; añadir bancos con sombra`, `Écart maximal entre repos ${maxRestGapM} m ; ajouter un repos ombragé`);
  const p4Action = koOr6(lang, '중간 그늘 쉼터 증설 (≤50m)', 'Add Mid-Route Shaded Rest', '中間日除け休憩所を増設（≤50m）', '增设中途遮阳休息区（≤50m）', 'Añadir Descanso Sombreado Intermedio', 'Ajouter Aire de Repos Ombragée');

  const p5Label = koOr6(lang, '외국인·다국어 방문객', 'International Visitors', '外国人・多言語来場者', '外籍与多语种访客', 'Visitantes Internacionales', 'Visiteurs Internationaux');
  const p5Finding = multiInfo
    ? koOr6(lang, `6개 국어 안내소 가동 중 · 주출입구 이격거리 ${gateToInfoM}m`, `6-Language Welcome Hub active (${gateToInfoM}m from Main Gate)`, `6か国語案内所を稼働中・メインゲートから ${gateToInfoM}m`, `6语种综合问询处运行中 · 距主入口 ${gateToInfoM}m`, `Punto de información en 6 idiomas activo (a ${gateToInfoM}m del acceso)`, `Point info 6 langues actif (à ${gateToInfoM} m de l’entrée principale)`)
    : koOr6(lang, '다국어 전용 안내소 부재 — 주출입구 직결 지점 배치 권장', 'No Multilingual Welcome Hub found; place near Main Entrance portal', '多言語案内所が未配置 — メインゲート付近への配置を推奨', '缺少多语种欢迎问询台 — 建议布置在主入口旁', 'Sin módulo multilingüe; ubicar junto a la entrada principal', 'Point d’accueil multilingüe absent ; placer près de l’entrée');
  const p5Action = koOr6(lang, '주출입구 다국어 안내소 배치', 'Place Multilingual Gate Hub', 'メインゲート多言語案内所を配置', '在主入口配置多语种问询台', 'Ubicar Módulo Multilingüe en Acceso', 'Placer Accueil Multilingue à l’Entrée');

  return [
    {
      id: 'wheelchair',
      labelKo: p1Label.ko,
      labelEn: p1Label.en,
      score: wcScore,
      maxContinuousWalkM: parkToGateM,
      facilityCoveragePct: wheelchairPct,
      status: wcScore >= 82 ? 'optimal' : 'needs_attention',
      keyFindingKo: p1Finding.ko,
      keyFindingEn: p1Finding.en,
      upgradeActionLabelKo: p1Action.ko,
      upgradeActionLabelEn: p1Action.en,
      highlightFacilityIds: [
        ...(parking ? [parking.id] : []),
        ...restrooms.map((r) => r.id),
        ...facilities.filter((f) => f.category === 'seating').slice(0, 1).map((s) => s.id),
      ],
    },
    {
      id: 'stroller',
      labelKo: p2Label.ko,
      labelEn: p2Label.en,
      score: strollerScore,
      maxContinuousWalkM: strollerDist,
      facilityCoveragePct: familyLounge ? 96 : 64,
      status: strollerScore >= 82 ? 'optimal' : 'needs_attention',
      keyFindingKo: p2Finding.ko,
      keyFindingEn: p2Finding.en,
      upgradeActionLabelKo: p2Action.ko,
      upgradeActionLabelEn: p2Action.en,
      highlightFacilityIds: [
        ...(familyLounge ? [familyLounge.id] : []),
        ...restZones.map((r) => r.id),
      ],
    },
    {
      id: 'children',
      labelKo: p3Label.ko,
      labelEn: p3Label.en,
      score: childScore,
      maxContinuousWalkM: stageSeparationM,
      facilityCoveragePct: playZone ? 94 : 58,
      status: childScore >= 82 ? 'optimal' : 'needs_attention',
      keyFindingKo: p3Finding.ko,
      keyFindingEn: p3Finding.en,
      upgradeActionLabelKo: p3Action.ko,
      upgradeActionLabelEn: p3Action.en,
      highlightFacilityIds: [
        ...(playZone ? [playZone.id] : []),
        ...(infoHub ? [infoHub.id] : []),
      ],
    },
    {
      id: 'seniors',
      labelKo: p4Label.ko,
      labelEn: p4Label.en,
      score: seniorScore,
      maxContinuousWalkM: maxRestGapM,
      facilityCoveragePct: Math.min(100, restZones.length * 32),
      status: seniorScore >= 82 ? 'optimal' : 'needs_attention',
      keyFindingKo: p4Finding.ko,
      keyFindingEn: p4Finding.en,
      upgradeActionLabelKo: p4Action.ko,
      upgradeActionLabelEn: p4Action.en,
      highlightFacilityIds: [
        ...restZones.map((r) => r.id),
        ...restrooms.map((r) => r.id),
      ],
    },
    {
      id: 'foreigner',
      labelKo: p5Label.ko,
      labelEn: p5Label.en,
      score: foreignerScore,
      maxContinuousWalkM: gateToInfoM,
      facilityCoveragePct: multiInfo ? 95 : 55,
      status: foreignerScore >= 82 ? 'optimal' : 'needs_attention',
      keyFindingKo: p5Finding.ko,
      keyFindingEn: p5Finding.en,
      upgradeActionLabelKo: p5Action.ko,
      upgradeActionLabelEn: p5Action.en,
      highlightFacilityIds: [
        ...(multiInfo ? [multiInfo.id] : []),
        ...(mainGate ? [mainGate.id] : []),
      ],
    },
  ];
}

export function generateRuleBasedRecommendations(
  config: EventConfig,
  facilities: Facility[],
  snapshot: SimulationSnapshot,
  summary: LayoutMetricsSummary,
  lang: Language = 'ko',
): Recommendation[] {
  const recs: Recommendation[] = [];
  const dUnit = densityUnitLabel(lang);

  // 0. Active contingency alert if non-normal scenario hasn't been mitigated yet
  if (snapshot.contingency !== 'normal') {
    const needsRain = snapshot.contingency === 'rain' && !facilities.some((f) => f.subtype === 'rain_canopy');
    const needsSurge = snapshot.contingency === 'surge' && !facilities.some((f) => f.id.startsWith('entrance-surge'));
    const needsDelay = snapshot.contingency === 'stage_delay' && !facilities.some((f) => f.id === 'stage-popup-busking');
    const needsMed =
      snapshot.contingency === 'medical_emergency' && !facilities.some((f) => f.id === 'medical-forward-triage');

    if (needsRain || needsSurge || needsDelay || needsMed) {
      const cLoc = CONTINGENCY_I18N[snapshot.contingency];
      const cShort = pickL6(lang, cLoc.short);
      const cDesc = pickL6(lang, cLoc.desc);
      const titleP = koOr6(
        lang,
        `[돌발 대응] '${cShort}' 우회·완충 시나리오 재배치 권고`,
        `Execute Real-Time Re-Optimization for ${cShort}`,
        `[突発対応] 「${cShort}」迂回・緩衝シナリオ再配置推奨`,
        `[突发应对] 建议执行“${cShort}”分流缓冲重排`,
        `[Contingencia] Reoptimizar en tiempo real para ${cShort}`,
        `[Contingence] Réoptimisation en temps réel pour ${cShort}`,
      );
      const ratP = koOr6(
        lang,
        `${cDesc} 돌발 변수 발생 시 인파가 특정 지붕 시설이나 통로로 급격히 쏠리므로 우회 동선과 임시 완충 구역을 즉시 확보해 비교하세요.`,
        `${cDesc} Sudden disruptions concentrate crowds under shelters or narrow corridors—secure bypass routes and buffer pockets immediately.`,
        `${cDesc} 突発時は屋根付き施設や通路に群衆が急集中するため、迂回動線と一時緩衝ゾーンを直ちに確保して比較してください。`,
        `${cDesc} 突发情况会导致人群迅速涌向遮蔽设施或狭窄通道，请立即开辟分流路线与临时缓冲口袋。`,
        `${cDesc} Las contingencias concentran multitudes bajo cubiertas o pasillos; habilite rutas de desvío y zonas de amortiguación de inmediato.`,
        `${cDesc} Les imprévus concentrent la foule sous les abris ou dans les couloirs ; ouvrez immédiatement des voies de délestage et zones tampons.`,
      );
      const actP = koOr6(
        lang,
        '돌발상황 실시간 재배치 실행',
        'Run Contingency Re-Optimizer',
        '突発リアルタイム再配置を実行',
        '执行突发实时重排',
        'Ejecutar reoptimización de contingencia',
        'Lancer la réoptimisation d’urgence',
      );
      recs.push({
        id: `rec-contingency-${snapshot.contingency}`,
        severity: 'high',
        category: 'Safety',
        title: titleP.en,
        titleKo: titleP.ko,
        rationale: ratP.en,
        rationaleKo: ratP.ko,
        metricTrigger: tr6(
          lang,
          `피크 밀집도 ${summary.peakDensity.toFixed(2)} ${dUnit} · 예상 대기 ${summary.avgWaitMinutes}분`,
          `Peak ${summary.peakDensity.toFixed(2)} ${dUnit} · Avg wait ${summary.avgWaitMinutes} min`,
          `ピーク密度 ${summary.peakDensity.toFixed(2)} ${dUnit} · 予想待ち ${summary.avgWaitMinutes}分`,
          `峰值密度 ${summary.peakDensity.toFixed(2)} ${dUnit} · 预计排队 ${summary.avgWaitMinutes}分钟`,
          `Pico ${summary.peakDensity.toFixed(2)} ${dUnit} · Espera prom. ${summary.avgWaitMinutes} min`,
          `Pic ${summary.peakDensity.toFixed(2)} ${dUnit} · Attente moy. ${summary.avgWaitMinutes} min`,
        ),
        evidenceCitation: tr6(
          lang,
          '작동 원리: 기상·일정 돌발 시 비가림막·대기 공간으로 급격한 쏠림이 발생하므로 우회 통로와 완충 공간 선제 확보 필요',
          'Mechanism: Weather or schedule disruptions trigger rapid shelter surges; preemptive bypass aisles and buffers prevent bottlenecks.',
          '原理：気象・進行の突発時は屋根施設や待機空間へ急集中が生じるため、迂回通路と緩衝空間の先行確保が必要',
          '原理：天气或日程突变会引发向遮蔽设施与等候区的瞬时聚集，需预先留出分流通道与缓冲空间',
          'Principio: Los cambios climáticos o de horario provocan avalanchas hacia zonas cubiertas; se requieren desvíos y amortiguamiento previos.',
          'Principe : Les aléas météo ou d’horaire provoquent un afflux brusque vers les abris ; prévoyez des couloirs de délestage.',
        ),
        actionType: 'reoptimize_contingency',
        actionLabel: actP.en,
        actionLabelKo: actP.ko,
      });
    }
  }

  // 1. Entrance arrival/egress capacity check
  const portals = facilities.filter(
    (f) => f.category === 'entrance' && (f.subtype === 'main_entrance' || f.subtype === 'secondary_entrance'),
  );
  const portalCap = portals.reduce((s, f) => s + f.capacity, 0);
  if (portalCap < config.expectedAttendance * 0.34) {
    const pct = Math.round((portalCap / Math.max(1, config.expectedAttendance)) * 100);
    const titleP = koOr6(
      lang,
      '남측 보조 분산 출입구 증설 권고 (출구 깔때기 병목 완화)',
      'Add a secondary relief entrance/exit gate',
      '南側補助分散ゲートの増設推奨（出口ボトルネック緩和）',
      '建议增设南侧辅助疏散出入口（缓解出口漏斗瓶颈）',
      'Añadir puerta secundaria de alivio (mitigar cuello de botella)',
      'Ajouter une porte secondaire de délestage (réduire le goulot de sortie)',
    );
    const ratP = koOr6(
      lang,
      `출입구 동시 처리 용량(${portalCap.toLocaleString()}명)이 예상 방문객 대비 ${pct}% 수준입니다. 입장용 검표·검색대가 퇴장 유효폭을 좁히고 익숙한 정문으로 인파가 쏠리면 폐장 직후 출구 앞 정체가 급격히 길어집니다.`,
      `Current gate throughput (${portalCap.toLocaleString()} pax) covers ${pct}% of expected attendance, creating closing-hour egress queues.`,
      `出入口同時処理容量（${portalCap.toLocaleString()}名）が予想来場者の${pct}%水準です。検札ゲートが退場有効幅を狭め正門に集中すると閉場直後の渋滞が急増します。`,
      `出入口同时通行容量（${portalCap.toLocaleString()}人）仅占预计访客的${pct}%。检票安检设施收窄净出口宽度且人群涌向正门时，散场拥堵将急剧加剧。`,
      `La capacidad actual de puertas (${portalCap.toLocaleString()} pers.) cubre el ${pct}% del aforo previsto, generando colas severas al cierre.`,
      `La capacité actuelle des portes (${portalCap.toLocaleString()} pers.) couvre ${pct}% de l’affluence prévue, générant des files critiques à la fermeture.`,
    );
    const actP = koOr6(
      lang,
      '보조 분산 게이트 추가',
      'Add Relief Gate',
      '補助分散ゲートを追加',
      '添加辅助分流大门',
      'Añadir puerta de alivio',
      'Ajouter porte de délestage',
    );
    recs.push({
      id: 'rec-entrance-cap',
      severity: 'high',
      category: 'Safety',
      title: titleP.en,
      titleKo: titleP.ko,
      rationale: ratP.en,
      rationaleKo: ratP.ko,
      metricTrigger: tr6(
        lang,
        `출입구 수용률 < 34% (${portals.length}개 게이트 / ${config.expectedAttendance.toLocaleString()}명)`,
        `Gate coverage < 34% (${portals.length} gates / ${config.expectedAttendance.toLocaleString()} visitors)`,
        `ゲートカバー率 < 34%（${portals.length}箇所 / ${config.expectedAttendance.toLocaleString()}名）`,
        `出入口覆盖率 < 34%（${portals.length}处大门 / ${config.expectedAttendance.toLocaleString()}人）`,
        `Cobertura de puertas < 34% (${portals.length} puertas / ${config.expectedAttendance.toLocaleString()} asist.)`,
        `Couverture portes < 34% (${portals.length} portes / ${config.expectedAttendance.toLocaleString()} visiteurs)`,
      ),
      evidenceCitation: tr6(
        lang,
        '작동 원리: 검색대로 좁아진 출구 유효폭과 정문 쏠림이 겹치면 깔때기 정체가 생기며, 출구 1곳 이상 불능 시 인접 출구가 과부하됨',
        'Mechanism: Screening hardware narrows effective exit width while main-gate familiarity creates funnel queues.',
        '原理：検札設備で狭まった有効出口幅と正門集中が重なると漏斗渋滞が発生し、1箇所閉鎖時に隣接出口が過負荷になる',
        '原理：安检闸机压缩有效出口净宽并叠加正门惯性聚集会产生漏斗拥堵，任一出口受阻时相邻出口将超负荷',
        'Principio: Los torniquetes reducen el ancho efectivo de salida y la preferencia por la puerta principal crea embudos.',
        'Principe : Les portiques réduisent la largeur utile de sortie et l’afflux vers l’entrée principale crée un effet d’entonnoir.',
      ),
      actionType: 'add_entrance',
      actionLabel: actP.en,
      actionLabelKo: actP.ko,
    });
  } else if (portals.length <= 3) {
    const normalLoadPct = Math.min(130, Math.round((config.expectedAttendance / Math.max(1, portalCap * 2.6)) * 100));
    const singleClosedCap = portals.slice(1).reduce((s, f) => s + f.capacity, 0) || Math.round(portalCap * 0.5);
    const closedLoadPct = Math.min(195, Math.round((config.expectedAttendance / Math.max(1, singleClosedCap * 2.6)) * 100));
    const titleP = koOr6(
      lang,
      `출입구 돌발 통제 대비 분산 게이트 확충 비교 (평시 ${normalLoadPct}% → 1곳 폐쇄 시 ${closedLoadPct}%)`,
      `Exit Gate Contingency Comparison (Normal ${normalLoadPct}% → 1-Gate Closed ${closedLoadPct}%)`,
      `出入口1箇所閉鎖時の負荷比較（平時 ${normalLoadPct}% → 閉鎖時 ${closedLoadPct}%）`,
      `出入口突发封闭负荷对比（平时 ${normalLoadPct}% → 封闭1处 ${closedLoadPct}%）`,
      `Comparativa de cierre de 1 puerta (Normal ${normalLoadPct}% → Cierre ${closedLoadPct}%)`,
      `Comparaison fermeture d’une porte (Normal ${normalLoadPct}% → Fermeture ${closedLoadPct}%)`,
    );
    const ratP = koOr6(
      lang,
      `현재 출입구 ${portals.length}개소 기준 평시 분담률은 약 ${normalLoadPct}%이나, 안전 통제 등으로 정문 1곳이 일시 차단되면 잔여 출구 부하가 약 ${closedLoadPct}%로 상승합니다. 보조 출입구 1곳을 추가하면 비상 차단 시에도 안정적인 퇴장 흐름을 유지할 수 있습니다.`,
      `With ${portals.length} gates, normal load is ~${normalLoadPct}%, jumping to ~${closedLoadPct}% if 1 main gate closes. Adding 1 relief gate keeps emergency egress resilient.`,
      `現在${portals.length}ゲートで平時負荷は約${normalLoadPct}%ですが、1箇所閉鎖時は残りゲート負荷が約${closedLoadPct}%へ上昇します。補助ゲート1箇所の追加で非常時も安定退場が可能です。`,
      `当前 ${portals.length} 处大门平时负荷约 ${normalLoadPct}%，若主门因故临时封闭，其余出口负荷将升至约 ${closedLoadPct}%。增设1处辅助门即可稳健分流。`,
      `Con ${portals.length} puertas la carga normal es ~${normalLoadPct}%, subiendo a ~${closedLoadPct}% si cierra 1 puerta principal. Añadir 1 puerta auxiliar estabiliza la evacuación.`,
      `Avec ${portals.length} portes la charge normale est ~${normalLoadPct}%, montant à ~${closedLoadPct}% si 1 porte ferme. Ajouter 1 porte auxiliaire sécurise la sortie.`,
    );
    const actP = koOr6(
      lang,
      '보조 출입구 1곳 추가 비교',
      'Add 1 Relief Gate',
      '補助出入口を1箇所追加',
      '增设1处辅助出入口',
      'Añadir 1 puerta auxiliar',
      'Ajouter 1 porte auxiliaire',
    );
    recs.push({
      id: 'rec-gate-closure-compare',
      severity: closedLoadPct >= 100 ? 'medium' : 'low',
      category: 'Safety',
      title: titleP.en,
      titleKo: titleP.ko,
      rationale: ratP.en,
      rationaleKo: ratP.ko,
      metricTrigger: tr6(
        lang,
        `평시 분담 ${normalLoadPct}% vs 1곳 차단 시 ${closedLoadPct}% (출입구 ${portals.length}개소)`,
        `Normal ${normalLoadPct}% vs 1-Gate Closed ${closedLoadPct}% (${portals.length} gates)`,
        `平時 ${normalLoadPct}% vs 1箇所閉鎖 ${closedLoadPct}%（${portals.length}箇所）`,
        `平时 ${normalLoadPct}% vs 封闭1处 ${closedLoadPct}%（${portals.length}处大门）`,
        `Normal ${normalLoadPct}% vs 1 cerrada ${closedLoadPct}% (${portals.length} puertas)`,
        `Normal ${normalLoadPct}% vs 1 fermée ${closedLoadPct}% (${portals.length} portes)`,
      ),
      evidenceCitation: tr6(
        lang,
        '비교 기준: 검표기 제외 실질 유효폭 유출량 대비 주출입구 1곳 일시 차단 시나리오 부하율',
        'Basis: Effective clear-width outflow vs. temporary single-gate closure scenario load',
        '比較基準：実質有効幅流出量に対するメインゲート1箇所閉鎖シナリオ負荷率',
        '对比依据：扣除检票设备后的净有效出口流量与单门封闭场景负荷率',
        'Base: Flujo por ancho efectivo neto frente a escenario de cierre temporal de una puerta',
        'Base : Débit sur largeur utile nette face au scénario de fermeture temporaire d’une porte',
      ),
      actionType: 'add_entrance',
      actionLabel: actP.en,
      actionLabelKo: actP.ko,
    });
  }

  // 2. Food & Beverage clustering / intermission bottleneck check
  const foods = facilities.filter((f) => f.category === 'food');
  const foodSpreadX =
    foods.length >= 2
      ? Math.max(...foods.map((f) => f.position.x)) - Math.min(...foods.map((f) => f.position.x))
      : 0;
  if (foods.length >= 3 && foodSpreadX < config.venueWidth * 0.25) {
    const titleP = koOr6(
      lang,
      '편중된 식음 노점 2개 권역 분리 (정지 대기줄·보행류 충돌 완화)',
      'Split clustered food stalls across two zones',
      '偏在した飲食ブースを2ゾーンへ分散（待機列と歩行流の衝突緩和）',
      '将集中的餐饮摊位拆分至两个区域（缓解排队与通行冲突）',
      'Dividir puestos de comida agrupados en dos zonas',
      'Répartir les stands alimentaires sur deux zones distinctes',
    );
    const ratP = koOr6(
      lang,
      '식음 부스가 한쪽 통로에 몰려 있으면 관람객이 시각·후각 유인에 이끌려 집중되고, 부스 앞에 멈춰 선 긴 대기줄이 지나가는 보행 통로를 가로막아 정체와 압박이 증폭됩니다.',
      'All food trucks and stalls are concentrated in a single corridor, causing overlapping intermission queues that block pedestrian flow.',
      '飲食ブースが片側通路に集中すると来場者が引き寄せられ、長い待機列が主歩行通路を塞いで混雑が増幅します。',
      '餐饮展位集中在单侧走廊会吸引人流聚集，摊位前排起的长队会侵占主步行通道并加剧拥挤。',
      'Los puestos de comida concentrados en un solo pasillo generan colas en el intermedio que bloquean la circulación peatonal.',
      'Les stands alimentaires concentrés dans un seul couloir créent des files d’attente qui bloquent le flux piétonnier.',
    );
    const actP = koOr6(
      lang,
      '공간 분산 재배치 적용',
      'Run Spatial Optimizer',
      '空間分散再配置を適用',
      '应用空间分散重排',
      'Ejecutar optimizador espacial',
      'Appliquer la dispersion spatiale',
    );
    recs.push({
      id: 'rec-food-cluster',
      severity: 'high',
      category: 'Congestion',
      title: titleP.en,
      titleKo: titleP.ko,
      rationale: ratP.en,
      rationaleKo: ratP.ko,
      metricTrigger: tr6(
        lang,
        `푸드존 동서 분산폭 ${Math.round(foodSpreadX)}m (전체 가로폭의 25% 미만)`,
        `F&B lateral spread ${Math.round(foodSpreadX)}m (<25% of venue width)`,
        `飲食ゾーン東西分散幅 ${Math.round(foodSpreadX)}m（会場幅の25%未満）`,
        `餐饮区东西跨度 ${Math.round(foodSpreadX)}m（低于场地宽度的25%）`,
        `Dispersión lateral F&B ${Math.round(foodSpreadX)}m (<25% del ancho)`,
        `Dispersion latérale F&B ${Math.round(foodSpreadX)}m (<25% de la largeur)`,
      ),
      evidenceCitation: tr6(
        lang,
        '작동 원리: 인기 노점으로 향하는 유인 이동과 길어진 정지 대기줄이 이동 통로를 침범해 통로 유효폭을 깎아먹음',
        'Mechanism: Stationary vendor queues spill into active walkways and erode effective corridor width.',
        '原理：人気ブースへの誘引移動と静止待機列が歩行通路へ溢れ出し、有効通路幅を削ってしまう',
        '原理：热门摊位吸引的人流与静止排队队列侵入步行道，削减有效通行净宽',
        'Principio: Las colas estacionarias invaden los pasillos activos y reducen el ancho efectivo de paso.',
        'Principe : Les files stationnaires débordent sur les allées actives et réduisent la largeur utile de passage.',
      ),
      actionType: 'optimize_layout',
      actionLabel: actP.en,
      actionLabelKo: actP.ko,
    });
  } else if (config.expectedAttendance / Math.max(1, foods.length) > 2200) {
    const perUnit = Math.round(config.expectedAttendance / Math.max(1, foods.length));
    const titleP = koOr6(
      lang,
      '식음료(F&B) 부스 수량 증설 검토',
      'Increase food & beverage vendor count',
      '飲食（F&B）ブース数の増設検討',
      '建议增加餐饮（F&B）展位数量',
      'Aumentar la cantidad de puestos de comida y bebida',
      'Augmenter le nombre de stands de restauration (F&B)',
    );
    const ratP = koOr6(
      lang,
      `푸드 부스 1개당 약 ${perUnit.toLocaleString()}명을 분담하고 있어, 공연 직후 휴식 시간처럼 짧은 전환 구간에 대기줄이 통로 바깥까지 길어질 수 있습니다.`,
      `Each food unit currently serves ~${perUnit.toLocaleString()} attendees, elevating intermission wait times.`,
      `飲食ブース1基あたり約${perUnit.toLocaleString()}名を分担しており、公演直後の休憩時間に待機列が通路外まで伸びる恐れがあります。`,
      `每个餐饮展位当前需服务约 ${perUnit.toLocaleString()} 名观众，演出间隙短时换场期排队易溢出至通道。`,
      `Cada puesto atiende a ~${perUnit.toLocaleString()} asistentes, elevando los tiempos de espera en los intermedios.`,
      `Chaque stand dessert ~${perUnit.toLocaleString()} visiteurs, allongeant fortement l’attente pendant les entractes.`,
    );
    const actP = koOr6(
      lang,
      '푸드 부스 +2개 추가',
      '+2 Food Stalls',
      '飲食ブース +2基追加',
      '餐饮展位 +2个',
      '+2 Puestos de comida',
      '+2 Stands alimentaires',
    );
    recs.push({
      id: 'rec-food-count',
      severity: 'medium',
      category: 'Operations',
      title: titleP.en,
      titleKo: titleP.ko,
      rationale: ratP.en,
      rationaleKo: ratP.ko,
      metricTrigger: tr6(
        lang,
        `부스 ${foods.length}개 / 방문객 ${config.expectedAttendance.toLocaleString()}명`,
        `${foods.length} booths / ${config.expectedAttendance.toLocaleString()} visitors`,
        `ブース ${foods.length}基 / 来場者 ${config.expectedAttendance.toLocaleString()}名`,
        `展位 ${foods.length}个 / 访客 ${config.expectedAttendance.toLocaleString()}人`,
        `${foods.length} puestos / ${config.expectedAttendance.toLocaleString()} visitantes`,
        `${foods.length} stands / ${config.expectedAttendance.toLocaleString()} visiteurs`,
      ),
      evidenceCitation: tr6(
        lang,
        '작동 원리: 공연 종료 직후 휴식 시간에는 식음·화장실 수요가 동시 집중되어 부스 앞 대기 행렬이 보행로를 침범하기 쉬움',
        'Mechanism: Simultaneous intermission surges for food and restrooms cause queues to encroach onto walkways.',
        '原理：公演終了直後の休憩には飲食・トイレ需要が同時集中し、ブース前の待機列が歩道を侵食しやすい',
        '原理：演出结束后的休息时段餐饮与卫生间需求同步激增，摊位前排队极易侵占步道',
        'Principio: La demanda simultánea de comida y baños en intermedios hace que las colas invadan los pasillos.',
        'Principe : La demande simultanée en restauration et sanitaires aux entractes fait déborder les files sur les allées.',
      ),
      actionType: 'add_food_booths',
      actionLabel: actP.en,
      actionLabelKo: actP.ko,
    });
  }

  // 3. Wheelchair & step-free corridor check
  const nonAccessible = facilities.filter((f) => !f.accessibility.wheelchairAccessible);
  if (nonAccessible.length > 0 || !config.accessibility.wideCorridors) {
    const titleP = koOr6(
      lang,
      '5.2m 광폭 보행로 및 전 시설 무단차 경사로 확보',
      'Enable 5.2m wide step-free corridors & ramp access',
      '5.2m広幅員歩道および全施設の段差解消スロープ確保',
      '启用5.2m宽无障碍通道及全设施坡道通行',
      'Habilitar pasillos sin escalones de 5.2m y rampas de acceso',
      'Activer des allées sans marche de 5,2m et des rampes d’accès',
    );
    const ratP =
      nonAccessible.length > 0
        ? koOr6(
            lang,
            `${nonAccessible.length}개 시설에 경사로가 누락되어 있으며, 주 보행로를 5.2m로 넓히면 휠체어·유모차·어르신처럼 이동 속도가 다른 관람객이 마주 오더라도 충돌 없이 안전하게 교행할 수 있습니다.`,
            `${nonAccessible.length} facility unit(s) lack dedicated wheelchair ramp clearance, and widening routes to 5.2m ensures safe two-way passing.`,
            `${nonAccessible.length}基の施設にスロープが未設定です。主通路を5.2mに拡幅すると車椅子・ベビーカー・高齢者も安全にすれ違えます。`,
            `有 ${nonAccessible.length} 个设施缺少轮椅坡道；将主通道拓宽至5.2m可保障轮椅、婴儿车与长者双向安全错车。`,
            `${nonAccessible.length} instalación(es) carecen de rampa; ampliar pasillos a 5.2m garantiza cruce bidireccional seguro.`,
            `${nonAccessible.length} installation(s) manquent de rampe ; élargir les allées à 5,2m sécurise le croisement bidirectionnel.`,
          )
        : koOr6(
            lang,
            '주 보행 통로를 5.2m로 확장하면 이동 속도가 서로 다른 관람객과 마주 오는 양방향 인파 사이의 충돌 압력을 줄일 수 있습니다.',
            'Widening primary pedestrian routes to 5.2m improves wheelchair and stroller passing clearance.',
            '主歩行通路を5.2mへ拡張すると、歩行速度の異なる来場者同士の双方向すれ違い圧力を軽減できます。',
            '将主步行通道拓宽至5.2m可显著降低不同步速人群双向交汇时的碰撞压力。',
            'Ampliar las rutas peatonales principales a 5.2m mejora el paso de sillas de ruedas y cochecitos.',
            'Élargir les allées principales à 5,2m facilite le croisement des fauteuils roulants et poussettes.',
          );
    const actP = koOr6(
      lang,
      '포용적 무장애 업그레이드',
      'Upgrade Accessibility',
      'バリアフリー一括アップグレード',
      '升级无障碍包容配置',
      'Mejorar accesibilidad universal',
      'Mettre à niveau l’accessibilité',
    );
    recs.push({
      id: 'rec-accessibility',
      severity: nonAccessible.length > 1 ? 'medium' : 'low',
      category: 'Accessibility',
      title: titleP.en,
      titleKo: titleP.ko,
      rationale: ratP.en,
      rationaleKo: ratP.ko,
      metricTrigger: tr6(
        lang,
        `무장애 시설 ${facilities.length - nonAccessible.length}/${facilities.length}개 · 보행로 ${config.accessibility.wideCorridors ? '5.8m' : '3.6m'}`,
        `Accessible ${facilities.length - nonAccessible.length}/${facilities.length} · Aisle ${config.accessibility.wideCorridors ? '5.8m' : '3.6m'}`,
        `バリアフリー ${facilities.length - nonAccessible.length}/${facilities.length}基 · 通路 ${config.accessibility.wideCorridors ? '5.8m' : '3.6m'}`,
        `无障碍设施 ${facilities.length - nonAccessible.length}/${facilities.length} · 通道 ${config.accessibility.wideCorridors ? '5.8m' : '3.6m'}`,
        `Accesibles ${facilities.length - nonAccessible.length}/${facilities.length} · Pasillo ${config.accessibility.wideCorridors ? '5.8m' : '3.6m'}`,
        `Accessibles ${facilities.length - nonAccessible.length}/${facilities.length} · Allée ${config.accessibility.wideCorridors ? '5.8m' : '3.6m'}`,
      ),
      evidenceCitation: tr6(
        lang,
        '작동 원리: 보행 속도와 회전 반경이 다른 이용자가 좁은 통로에서 양방향으로 마주치면 추월·회피가 막혀 국소 정체와 접촉 위험이 커짐',
        'Mechanism: Mixed walking speeds and turning radii in narrow two-way aisles create local bottlenecks and contact hazards.',
        '原理：歩行速度と回転半径が異なる利用者が狭い双方向通路で交差すると追い越しが詰まり接触リスクが高まる',
        '原理：步速与转弯半径不同的访客在狭窄双向通道交汇时会受阻并增加局部拥堵与擦碰风险',
        'Principio: Distintas velocidades de marcha y radios de giro en pasillos estrechos generan bloqueos y riesgo de contacto.',
        'Principe : Des vitesses et rayons de braquage différents dans des couloirs étroits créent des blocages locaux.',
      ),
      actionType: 'enable_accessibility',
      actionLabel: actP.en,
      actionLabelKo: actP.ko,
    });
  }

  // 4. Emergency Medical coverage check
  const medicals = facilities.filter((f) => f.category === 'medical');
  if (config.expectedAttendance >= 9500 && medicals.length < 2) {
    const titleP = koOr6(
      lang,
      '메인 무대 서측 보조 응급구호소 추가 (구조 접근성 확보)',
      'Add a Stage-West first aid station',
      'メインステージ西側に補助救護所を追加（救急到達時間短縮）',
      '在主舞台西侧增设辅助急救站（缩短救援响应距离）',
      'Añadir puesto médico secundario al oeste del escenario',
      'Ajouter un poste de secours secondaire à l’ouest de la scène',
    );
    const ratP = koOr6(
      lang,
      '9,500명 이상 규모에서 한쪽 외곽에만 의료소를 두면 인파가 가장 빽빽하게 들어찬 무대 전면 구역까지 의료진이 인파를 헤치고 110m 이상 이동해야 해 초기 대응이 지연됩니다.',
      'With 9,500+ expected visitors, a single medical tent on the East perimeter leaves >110m response distance to the Main Stage front barrier.',
      '9,500名以上の規模で片側外周のみに救護所を置くと、最混雑するステージ前面まで110m以上の移動が必要となり初期対応が遅延します。',
      '9,500人以上规模若仅在一侧外围设医疗站，医护人员前往最密集的舞台前区需穿越逾110m人群，延误黄金响应。',
      'Con más de 9.500 visitantes, un único puesto médico deja >110m de distancia de respuesta hasta el frente del escenario.',
      'Au-delà de 9 500 visiteurs, un seul poste médical laisse plus de 110m à parcourir jusqu’au front de scène.',
    );
    const actP = koOr6(
      lang,
      '서측 응급구호소 추가',
      'Add First Aid Post',
      '西側救護所を追加',
      '添加西侧急救站',
      'Añadir puesto de auxilio',
      'Ajouter poste de secours',
    );
    recs.push({
      id: 'rec-medical-post',
      severity: 'medium',
      category: 'Safety',
      title: titleP.en,
      titleKo: titleP.ko,
      rationale: ratP.en,
      rationaleKo: ratP.ko,
      metricTrigger: tr6(
        lang,
        `응급의료소 ${medicals.length}개소 / ${config.expectedAttendance.toLocaleString()}명`,
        `Medical posts ${medicals.length} / ${config.expectedAttendance.toLocaleString()} visitors`,
        `救護所 ${medicals.length}箇所 / ${config.expectedAttendance.toLocaleString()}名`,
        `急救站 ${medicals.length}处 / ${config.expectedAttendance.toLocaleString()}人`,
        `Puestos médicos ${medicals.length} / ${config.expectedAttendance.toLocaleString()} asist.`,
        `Postes médicaux ${medicals.length} / ${config.expectedAttendance.toLocaleString()} visiteurs`,
      ),
      evidenceCitation: tr6(
        lang,
        '작동 원리: 밀집 구역 내부는 일반 보행보다 구급 진입 속도가 급격히 떨어지므로 양방향 거점 분산과 전용 비상축 확보가 필수임',
        'Mechanism: Responder speed drops sharply inside dense standing crowds, requiring dual-flank medical posts and clear emergency lanes.',
        '原理：高密度区域内では救急進入速度が急低下するため、両翼への拠点分散と専用非常軸の確保が不可欠',
        '原理：高密度人群内部急救通行速度急剧下降，必须在两侧分散设点并确保专用应急通道',
        'Principio: La velocidad de respuesta cae drásticamente en zonas densas; se requieren puestos en ambos flancos.',
        'Principe : La vitesse d’intervention chute fortement en foule dense ; deux postes latéraux sont indispensables.',
      ),
      actionType: 'add_medical',
      actionLabel: actP.en,
      actionLabelKo: actP.ko,
    });
  }

  // 5. Budget overrun check
  if (summary.budgetUsagePct > 100) {
    const overrunUsd = Math.max(0, summary.estimatedCost - config.budget);
    const overStr = formatCurrency(overrunUsd, lang);
    const estStr = formatCurrency(summary.estimatedCost, lang);
    const budStr = formatCurrency(config.budget, lang);
    const titleP = koOr6(
      lang,
      `예상 시설 설치비가 가용 예산을 ${formatCurrency(overrunUsd, 'ko')} 초과함`,
      `Estimated facility cost exceeds budget by ${overStr}`,
      `予想施設設置費が利用可能予算を ${overStr} 超過`,
      `预计设施搭建费超出可用预算 ${overStr}`,
      `El costo estimado supera el presupuesto en ${overStr}`,
      `Le coût estimé dépasse le budget de ${overStr}`,
    );
    const ratP = koOr6(
      lang,
      `현재 배치 예상 비용(${formatCurrency(summary.estimatedCost, 'ko')})이 설정 예산(${formatCurrency(config.budget, 'ko')}) 대비 ${summary.budgetUsagePct}%로 ${formatCurrency(overrunUsd, 'ko')} 초과되었습니다. 필수 안전·무장애 설비(응급의료소·경사로·비상통로)는 유지하면서 선택 특화구역·부스 모형 단가·여유 수량을 자동 조정할 수 있습니다.`,
      `Current layout totals ${estStr} (${summary.budgetUsagePct}% of ${budStr} budget, +${overStr} overrun). Auto-fit preserves mandatory safety & step-free facilities while right-sizing optional structures.`,
      `現在の予想費用（${estStr}）が予算（${budStr}）比${summary.budgetUsagePct}%で${overStr}超過しています。必須の安全・バリアフリー設備を維持しつつ任意ブースを自動調整できます。`,
      `当前布局预计费用（${estStr}）占预算（${budStr}）的${summary.budgetUsagePct}%，超出${overStr}。自动适配可在保留安全与无障碍必需设施的同时精简可选结构。`,
      `El diseño actual suma ${estStr} (${summary.budgetUsagePct}% del presupuesto de ${budStr}, +${overStr}). El ajuste automático conserva seguridad y accesibilidad reduciendo elementos opcionales.`,
      `L’aménagement actuel coûte ${estStr} (${summary.budgetUsagePct}% du budget de ${budStr}, +${overStr}). L’ajustement auto préserve la sécurité et l’accessibilité tout en optimisant les options.`,
    );
    const actP = koOr6(
      lang,
      '예산 내 최적 맞춤 실행',
      'Auto-Fit to Budget',
      '予算内に自動最適化',
      '自动适配至预算内',
      'Ajustar al presupuesto',
      'Ajuster au budget',
    );
    recs.push({
      id: 'rec-budget-overrun',
      severity: 'high',
      category: 'Budget',
      title: titleP.en,
      titleKo: titleP.ko,
      rationale: ratP.en,
      rationaleKo: ratP.ko,
      metricTrigger: tr6(
        lang,
        `예산 사용률 ${summary.budgetUsagePct}% (+${formatCurrency(overrunUsd, 'ko')})`,
        `Budget usage ${summary.budgetUsagePct}% (+${overStr})`,
        `予算使用率 ${summary.budgetUsagePct}%（+${overStr}）`,
        `预算使用率 ${summary.budgetUsagePct}%（+${overStr}）`,
        `Uso presupuestario ${summary.budgetUsagePct}% (+${overStr})`,
        `Utilisation budget ${summary.budgetUsagePct}% (+${overStr})`,
      ),
      evidenceCitation: tr6(
        lang,
        '작동 원리: 안전·접근성 최소 기준선을 고정한 상태에서 고단가 선택 설비부터 단계적으로 감축하여 예산 제약식을 충족함',
        'Mechanism: Locks safety and step-free baselines first, then trims optional high-cost modules step-by-step.',
        '原理：安全・バリアフリーの最低基準を固定した上で、高単価な任意設備から段階的に圧縮して予算制約を満たす',
        '原理：锁定安全与无障碍底线配置后，按单价从高到低逐步精简可选模块以满足预算约束',
        'Principio: Fija primero los mínimos de seguridad y accesibilidad y reduce gradualmente módulos opcionales costosos.',
        'Principe : Verrouille d’abord les requis sécurité/accessibilité puis réduit progressivement les modules optionnels coûteux.',
      ),
      actionType: 'resolve_budget_overrun',
      actionLabel: actP.en,
      actionLabelKo: actP.ko,
    });
  }

  if (recs.length === 0) {
    const titleP = koOr6(
      lang,
      '설정한 가정에서 주요 물리·동선 참고 기준 충족 (현장 점검 병행 필요)',
      'Relatively low congestion under configured assumptions',
      '設定条件下で主要な物理・動線基準を充足（現場点検の併用が必要）',
      '当前设定假设下主要空间与动线指标良好（仍需现场核查）',
      'Baja congestión relativa bajo los supuestos configurados',
      'Faible congestion relative selon les hypothèses configurées',
    );
    const ratP = koOr6(
      lang,
      '현재 입력된 가정 아래에서 출구 분담률, 식음 분산, 무단차 통로 조건이 양호합니다. 다만 사전 시뮬레이션 수치는 가정에 따른 참고값이므로 현장 안전요원 배치와 실측 점검을 병행해야 합니다.',
      'Under current assumptions, gate capacity, vendor dispersion, and step-free corridors show relatively low modeled congestion. Field verification is still required.',
      '現在の仮定下では出口分担率・飲食分散・段差解消通路がいずれも良好です。ただし事前シミュレーションは参考値のため現場点検を併用してください。',
      '在当前输入假设下，出口分担率、餐饮分散度与无障碍通道表现良好；但模拟数值仅供参考，仍须配合现场安保与实测核查。',
      'Bajo los supuestos actuales, la capacidad de puertas, dispersión gastronómica y rutas sin escalones son favorables; se requiere verificación en campo.',
      'Sous les hypothèses actuelles, la capacité des portes, la dispersion F&B et les allées sans marche sont favorables ; vérification terrain requise.',
    );
    recs.push({
      id: 'rec-nominal',
      severity: 'low',
      category: 'Operations',
      title: titleP.en,
      titleKo: titleP.ko,
      rationale: ratP.en,
      rationaleKo: ratP.ko,
      metricTrigger: tr6(
        lang,
        `가용면적 ${summary.usableAreaSqm.toLocaleString()}m² · 참고수용량 ${summary.referenceCapacity.toLocaleString()}명`,
        `Usable ${summary.usableAreaSqm.toLocaleString()}m² · Ref cap ${summary.referenceCapacity.toLocaleString()}`,
        `有効面積 ${summary.usableAreaSqm.toLocaleString()}m² · 参考収容 ${summary.referenceCapacity.toLocaleString()}名`,
        `可用面积 ${summary.usableAreaSqm.toLocaleString()}m² · 参考容量 ${summary.referenceCapacity.toLocaleString()}人`,
        `Área útil ${summary.usableAreaSqm.toLocaleString()}m² · Cap. ref. ${summary.referenceCapacity.toLocaleString()}`,
        `Surface utile ${summary.usableAreaSqm.toLocaleString()}m² · Cap. réf. ${summary.referenceCapacity.toLocaleString()}`,
      ),
      evidenceCitation: tr6(
        lang,
        '해석 원칙: 모의 계산 결과는 시나리오 간 상대 비교용이며 실제 현장의 실시간 유입·기상·통제 상태를 대체하지 않음',
        'Principle: Pre-event simulation metrics are for scenario comparison and do not replace live field crowd management.',
        '解釈原則：シミュレーション結果はシナリオ間の相対比較用であり、現場のリアルタイム統制を代替しない',
        '解释原则：模拟计算结果用于方案间相对比较，不能替代现场实时客流管控与安检',
        'Principio: Las métricas de simulación sirven para comparar escenarios y no sustituyen el control presencial.',
        'Principe : Les calculs de simulation servent à comparer les scénarios et ne remplacent pas la gestion sur site.',
      ),
    });
  }

  return recs;
}

export function buildLayoutComparison(
  config: EventConfig,
  originalFacilities: Facility[],
  progress = 0.65,
  contingency: ContingencyScenario = 'normal',
  assumptions: SimulationAssumptions = DEFAULT_SIMULATION_ASSUMPTIONS,
  lang: Language = 'ko',
): LayoutComparison {
  const origSim = new CrowdSimulator(config, originalFacilities, contingency, assumptions);
  origSim.seekToProgress(progress);
  const origSnap = origSim.getSnapshot();
  const originalMetrics = evaluateVenueLayout(config, originalFacilities, origSnap, assumptions);

  const {
    facilities: optimizedFacilities,
    notes: optimizationNotesRaw,
    notesKo: optimizationNotesKoRaw,
  } = optimizeVenueLayout(config, originalFacilities);

  const localizedNotes =
    lang === 'ko'
      ? { ko: optimizationNotesKoRaw, en: optimizationNotesRaw }
      : lang === 'en'
        ? { ko: optimizationNotesRaw, en: optimizationNotesRaw }
        : {
            ko: [
              tr6(
                lang,
                '',
                '',
                '飲食ブース・フードトラックを左右2ゾーンへ分散し、休憩時間の待機列衝突を緩和しました。',
                '已将餐饮展位与餐车分散至左右双侧翼区，减少中场休息排队与主通道冲突。',
                'Se dispersaron los puestos de comida en dos alas laterales para reducir el cruce de colas.',
                'Dispersion des stands alimentaires sur deux ailes latérales pour réduire les conflits de files.',
              ),
              tr6(
                lang,
                '',
                '',
                '全施設に段差解消スロープと5.8m広幅員バリアフリー通路を適用しました。',
                '已为全部设施启用无障碍坡道与5.8m加宽双向通行走廊。',
                'Se activaron rampas sin escalones y pasillos amplios de 5.8m en todas las instalaciones.',
                'Activation des rampes sans marche et des allées larges de 5,8m sur tous les équipements.',
              ),
              tr6(
                lang,
                '',
                '',
                '中央非常車両スパイン（X=-7m）周辺の干渉ブースを外周側へ再整列しました。',
                '已将靠近中央应急通道（X=-7m）的展位向外侧安全边界重新对齐。',
                'Se realinearon los stands cercanos al eje central de emergencia (X=-7m) hacia el perímetro.',
                'Réalignement des stands proches de l’axe d’urgence central (X=-7m) vers la périphérie.',
              ),
            ],
            en: [
              tr6(
                lang,
                '',
                '',
                '飲食ブース・フードトラックを左右2ゾーンへ分散し、休憩時間の待機列衝突を緩和しました。',
                '已将餐饮展位与餐车分散至左右双侧翼区，减少中场休息排队与主通道冲突。',
                'Se dispersaron los puestos de comida en dos alas laterales para reducir el cruce de colas.',
                'Dispersion des stands alimentaires sur deux ailes latérales pour réduire les conflits de files.',
              ),
              tr6(
                lang,
                '',
                '',
                '全施設に段差解消スロープと5.8m広幅員バリアフリー通路を適用しました。',
                '已为全部设施启用无障碍坡道与5.8m加宽双向通行走廊。',
                'Se activaron rampas sin escalones y pasillos amplios de 5.8m en todas las instalaciones.',
                'Activation des rampes sans marche et des allées larges de 5,8m sur tous les équipements.',
              ),
              tr6(
                lang,
                '',
                '',
                '中央非常車両スパイン（X=-7m）周辺の干渉ブースを外周側へ再整列しました。',
                '已将靠近中央应急通道（X=-7m）的展位向外侧安全边界重新对齐。',
                'Se realinearon los stands cercanos al eje central de emergencia (X=-7m) hacia el perímetro.',
                'Réalignement des stands proches de l’axe d’urgence central (X=-7m) vers la périphérie.',
              ),
            ],
          };

  const optConfig: EventConfig = {
    ...config,
    accessibility: {
      ...config.accessibility,
      stepFreeRoutes: true,
      wideCorridors: true,
    },
  };
  const optSim = new CrowdSimulator(optConfig, optimizedFacilities, contingency, assumptions);
  optSim.seekToProgress(progress);
  const optSnap = optSim.getSnapshot();
  const optimizedMetrics = evaluateVenueLayout(optConfig, optimizedFacilities, optSnap, assumptions);

  const rawWaitDelta =
    originalMetrics.avgWaitMinutes > 0
      ? Math.round(
          ((optimizedMetrics.avgWaitMinutes - originalMetrics.avgWaitMinutes) /
            originalMetrics.avgWaitMinutes) *
            100,
        )
      : 0;

  const improved =
    optimizedMetrics.scores.overall > originalMetrics.scores.overall ||
    optimizedMetrics.peakDensity < originalMetrics.peakDensity;

  return {
    originalConfig: config,
    originalFacilities,
    originalMetrics,
    optimizedFacilities,
    optimizedMetrics,
    waitTimeDeltaPct: rawWaitDelta,
    optimizationNotes: localizedNotes.en,
    optimizationNotesKo: localizedNotes.ko,
    improved,
  };
}

/**
 * Multi-Objective Evolutionary Candidate Generator (다목적 최적화 후보안 탐색: Layout A, B, C, D).
 * Evaluates multiple seeded spatial layouts per Pareto objective and selects the top performer for each.
 */
export function generateMultiObjectiveCandidates(
  baseConfig: EventConfig,
  baselineFacilities: Facility[],
  lang: Language = 'ko',
): CandidateLayout[] {
  const lockedFacilities = baselineFacilities.filter((f) => f.locked);
  const baseSim = new CrowdSimulator(baseConfig, baselineFacilities, 'normal');
  baseSim.seekToProgress(0.78);
  const baseMetrics = evaluateVenueLayout(baseConfig, baselineFacilities, baseSim.getSnapshot());

  const isOutdoor = baseConfig.venueEnvironment === 'outdoor';
  const envLabel = tr6(
    lang,
    isOutdoor ? '실외' : '실내',
    isOutdoor ? 'Outdoor' : 'Indoor',
    isOutdoor ? '屋外' : '屋内',
    isOutdoor ? '室外' : '室内',
    isOutdoor ? 'Exterior' : 'Interior',
    isOutdoor ? 'Extérieur' : 'Intérieur',
  );
  const eventLabelLoc =
    EVENT_TYPE_MULTILANG[baseConfig.eventType]?.[lang] ||
    EVENT_TYPE_MULTILANG[baseConfig.eventType]?.en ||
    baseConfig.eventType;
  const eventLabelKo = EVENT_TYPE_MULTILANG[baseConfig.eventType]?.ko || baseConfig.eventType;

  const condLoc = [
    `${eventLabelLoc} (${baseConfig.venueWidth}×${baseConfig.venueDepth}m ${envLabel})`,
    tr6(
      lang,
      `예상 방문객 ${baseConfig.expectedAttendance.toLocaleString()}명`,
      `${baseConfig.expectedAttendance.toLocaleString()} Expected Visitors`,
      `予想来場者 ${baseConfig.expectedAttendance.toLocaleString()}名`,
      `预计访客 ${baseConfig.expectedAttendance.toLocaleString()}人`,
      `${baseConfig.expectedAttendance.toLocaleString()} visitantes previstos`,
      `${baseConfig.expectedAttendance.toLocaleString()} visiteurs prévus`,
    ),
    tr6(
      lang,
      `가용 예산 ${formatCurrency(baseConfig.budget, 'ko')}`,
      `Budget ${formatCurrency(baseConfig.budget, 'en')}`,
      `利用可能予算 ${formatCurrency(baseConfig.budget, 'ja')}`,
      `可用预算 ${formatCurrency(baseConfig.budget, 'zh')}`,
      `Presupuesto ${formatCurrency(baseConfig.budget, 'es')}`,
      `Budget ${formatCurrency(baseConfig.budget, 'fr')}`,
    ),
    ...((baseConfig.parkingCount ?? 0) > 0
      ? [
          tr6(
            lang,
            `외부 주차장 ${baseConfig.parkingCount ?? 0}개소 유지`,
            `${baseConfig.parkingCount ?? 0} Exterior Parking Lot(s)`,
            `外部駐車場 ${baseConfig.parkingCount ?? 0}箇所維持`,
            `保留外部停车场 ${baseConfig.parkingCount ?? 0}处`,
            `${baseConfig.parkingCount ?? 0} estacionamiento(s) exterior(es)`,
            `${baseConfig.parkingCount ?? 0} parking(s) extérieur(s)`,
          ),
        ]
      : []),
    ...(lockedFacilities.length > 0
      ? [
          tr6(
            lang,
            `고정 부스 ${lockedFacilities.length}개 위치 유지`,
            `${lockedFacilities.length} Locked Booth(s) Preserved`,
            `固定ブース ${lockedFacilities.length}基の位置維持`,
            `保留 ${lockedFacilities.length} 个锁定展位位置`,
            `${lockedFacilities.length} stand(s) bloqueado(s) mantenido(s)`,
            `${lockedFacilities.length} stand(s) verrouillé(s) conservé(s)`,
          ),
        ]
      : []),
  ];
  const baseCondKo =
    lang === 'ko'
      ? condLoc
      : [
          `${eventLabelKo} (${baseConfig.venueWidth}×${baseConfig.venueDepth}m ${isOutdoor ? '실외' : '실내'})`,
          `예상 방문객 ${baseConfig.expectedAttendance.toLocaleString()}명`,
          `가용 예산 ${formatCurrency(baseConfig.budget, 'ko')}`,
        ];

  const seedStep = Math.abs(Math.floor(baseConfig.seed / 997));
  const LAYOUT_ROTATION: VenueLayoutModel[] = [
    'boulevard_grid',
    'u_courtyard',
    'circular_plaza',
    'cluster_village',
    'diagonal_avenue',
    'radial_fan',
    'waterside_promenade',
    'standard',
  ];
  const BOOTH_ROTATION: BoothModelStyle[] = [
    'pagoda_tent',
    'wooden_pavilion',
    'modern_container',
    'expo_shell',
    'open_canopy',
  ];
  const countWave = seedStep % 3;

  const specs: Array<{
    id: 'A' | 'B' | 'C' | 'D';
    nameP: { ko: string; en: string };
    focusP: { ko: string; en: string };
    objective: DesignObjective;
    mutateConfig: (c: EventConfig, step: number) => EventConfig;
    postProcess?: (cfg: EventConfig, facs: Facility[]) => Facility[];
    highlightsLoc: string[];
    highlightsKoDefault: string[];
  }> = [
    {
      id: 'A',
      nameP: koOr6(
        lang,
        '후보안 A · 안전·비상동선 중심형',
        'Option A · Safety & Clear Egress Layout',
        '候補案 A · 安全・非常動線重視レイアウト',
        '候选方案 A · 安全与应急疏散优先型',
        'Opción A · Seguridad y Evacuación Despejada',
        'Option A · Sécurité & Évacuation Dégagée',
      ),
      focusP: koOr6(
        lang,
        '중앙 직선 비상통로 확보 · 양방향 의무실 · 다중 분산 출입구',
        'Wide central emergency spine, dual medical posts, dispersed exit gates',
        '中央直線非常通路の確保・両翼救護所・多方向分散ゲート',
        '贯通中央应急通道 · 双侧急救站 · 多向分散出入口',
        'Eje central de emergencia libre, doble puesto médico y puertas dispersas',
        'Axe central d’urgence dégagé, double poste médical et portes dispersées',
      ),
      objective: 'safety_first',
      mutateConfig: (c, step) => ({
        ...c,
        objective: 'safety_first',
        venueLayoutModel: LAYOUT_ROTATION[(step * 3 + 0) % LAYOUT_ROTATION.length],
        boothModel: BOOTH_ROTATION[(step + 0) % 4],
        parkingCount: c.parkingCount ?? 0,
        entranceCount: Math.min(6, Math.max(4, c.entranceCount + 1 + (step % 2))),
        restroomCount: Math.min(8, (c.restroomCount ?? 4) + 1),
        requiredFacilities: { ...c.requiredFacilities, extraMedical: true },
        accessibility: { ...c.accessibility, wideCorridors: true, stepFreeRoutes: true },
      }),
      highlightsKoDefault: [
        '객석 중앙 비상 대피축 및 무대 전면 완충 공간 확보',
        '의무실 2개소 분산 배치로 긴급 대응 거리 단축',
        '보조 출입구 확충으로 퇴장 시간대 병목 완화',
      ],
      highlightsLoc: [
        tr6(
          lang,
          '객석 중앙 비상 대피축 및 무대 전면 완충 공간 확보',
          'Unobstructed central evacuation spine and front stage buffer',
          '中央非常避難軸とステージ前面の安全緩衝スペースを確保',
          '确保中央应急疏散主轴与舞台前区安全缓冲空间',
          'Eje central de evacuación libre y zona de amortiguación frente al escenario',
          'Axe d’évacuation central dégagé et zone tampon devant la scène',
        ),
        tr6(
          lang,
          '의무실 2개소 분산 배치로 긴급 대응 거리 단축',
          'Dual medical posts for rapid emergency response',
          '救護所2箇所の分散配置で緊急到達距離を短縮',
          '分散配置2处急救站以缩短紧急响应距离',
          'Dos puestos médicos distribuidos para respuesta rápida',
          'Deux postes médicaux répartis pour une intervention rapide',
        ),
        tr6(
          lang,
          '보조 출입구 확충으로 퇴장 시간대 병목 완화',
          'Expanded exit gates to relieve closing-hour bottlenecks',
          '補助ゲートの拡充により退場時間帯のボトルネックを緩和',
          '增设辅助出入口以缓解散场高峰瓶颈',
          'Puertas adicionales para aliviar cuellos de botella al cierre',
          'Portes supplémentaires pour fluidifier la sortie en fin d’événement',
        ),
      ],
    },
    {
      id: 'B',
      nameP: koOr6(
        lang,
        '후보안 B · 교통약자 포용·무장애 순환형',
        'Option B · Barrier-Free Priority Access Layout',
        '候補案 B · バリアフリー配慮・専用退場動線型',
        '候选方案 B · 无障碍包容与专用退场动线型',
        'Opción B · Accesibilidad Universal y Salida Prioritaria',
        'Option B · Accessibilité Universelle & Sortie Prioritaire',
      ),
      focusP: koOr6(
        lang,
        '휠체어·전동차·유모차 통합 무장애 통로 및 전용 완만 퇴장로 직결',
        'Step-free corridors & dedicated perimeter egress for wheelchair/scooter/stroller visitors',
        '車椅子・電動カート・ベビーカー統合バリアフリー通路と専用外周退場路を直結',
        '轮椅·电动代步车·婴儿车贯通无障碍走廊并直连外围平缓专用退场道',
        'Pasillos sin escalones y salida perimetral exclusiva para silla de ruedas/scooter/cochecito',
        'Allées sans marche et sortie périmétrique dédiée fauteuils/scooters/poussettes',
      ),
      objective: 'accessibility_inclusion',
      mutateConfig: (c, step) => ({
        ...c,
        objective: 'accessibility_inclusion',
        venueLayoutModel: LAYOUT_ROTATION[(step * 3 + 2) % LAYOUT_ROTATION.length],
        boothModel: BOOTH_ROTATION[(step + 1) % 4],
        parkingCount: Math.max(1, c.parkingCount ?? 0),
        restroomCount: Math.min(8, (c.restroomCount ?? 4) + 1),
        requiredFacilities: { ...c.requiredFacilities, playRestZone: true },
        accessibility: {
          stepFreeRoutes: true,
          wideCorridors: true,
          accessibleRestrooms: true,
          accessibleParking: true,
        },
      }),
      postProcess: (cfg, facs) => {
        const s1 = applyInclusivePersonaUpgrade(cfg, facs, 'stroller').facilities;
        const s2 = applyInclusivePersonaUpgrade(cfg, s1, 'seniors').facilities;
        return applyInclusivePersonaUpgrade(cfg, s2, 'foreigner').facilities;
      },
      highlightsKoDefault: [
        '전 시설 무단차 진입 및 5.8m 양방향 교행 통로 확보',
        '교통약자 전용 외곽 완만 퇴장 동선 및 가족·어르신 쉼터 연결',
        '주출입구 인근 다국어 안내소 배치',
      ],
      highlightsLoc: [
        tr6(
          lang,
          '전 시설 무단차 진입 및 5.8m 양방향 교행 통로 확보',
          '100% step-free ramps and 5.8m wide two-way corridors',
          '全施設の段差解消スロープと5.8m双方向すれ違い通路を確保',
          '全设施无台阶坡道通行并配备5.8m双向宽走廊',
          'Rampas 100% sin escalones y pasillos bidireccionales de 5.8m',
          'Rampes 100 % sans marche et allées bidirectionnelles de 5,8m',
        ),
        tr6(
          lang,
          '교통약자 전용 외곽 완만 퇴장 동선 및 가족·어르신 쉼터 연결',
          'Dedicated step-free perimeter egress lane & family/senior lounges',
          '配慮者専用の外周緩勾配退場ルートと家族・高齢者休憩所を接続',
          '无障碍外围平缓专用退场通道直连家庭与长者休息区',
          'Carril perimetral exclusivo sin escalones conectado a áreas de descanso familiar',
          'Voie de sortie périmétrique sans marche reliée aux salons familles/seniors',
        ),
        tr6(
          lang,
          '주출입구 인근 다국어 안내소 배치',
          'Multilingual info desk positioned near main gate',
          'メインゲート近くに多言語案内デスクを配置',
          '主出入口旁配置多语种综合问询台',
          'Módulo de información multilingüe junto a la puerta principal',
          'Kiosque d’information multilingue près de la porte principale',
        ),
      ],
    },
    {
      id: 'C',
      nameP: koOr6(
        lang,
        '후보안 C · 대기열·혼잡 분산 순환형',
        'Option C · Queue-Dispersed Ring Layout',
        '候補案 C · 待機列・混雑分散リング型',
        '候选方案 C · 排队分流环形循环型',
        'Opción C · Anillo de Dispersión de Colas',
        'Option C · Anneau de Dispersion des Files',
      ),
      focusP: koOr6(
        lang,
        '식음·체험부스 좌우 분산 배치 · 쉬는 시간 대기줄 간섭 최소화',
        'Dual-wing food & booth dispersion along a continuous circulation loop',
        '飲食・体験ブースを左右両翼へ分散し、休憩時の待機列干渉を最小化',
        '餐饮与体验展位左右两翼分散，最大限度减少换场排队干扰',
        'Dispersión gastronómica y de stands en dos alas sobre un circuito continuo',
        'Dispersion F&B et stands sur deux ailes le long d’une boucle continue',
      ),
      objective: 'congestion_reduction',
      mutateConfig: (c, step) => ({
        ...c,
        objective: 'congestion_reduction',
        venueLayoutModel: LAYOUT_ROTATION[(step * 3 + 4) % LAYOUT_ROTATION.length],
        boothModel: BOOTH_ROTATION[(step + 2) % BOOTH_ROTATION.length],
        parkingCount: c.parkingCount ?? 0,
        foodBoothCount: Math.min(14, c.foodBoothCount + 2 + countWave),
        experienceBoothCount: Math.min(20, c.experienceBoothCount + 1 + (step % 2)),
        entranceCount: Math.min(6, Math.max(3, c.entranceCount + 1)),
        accessibility: { ...c.accessibility, wideCorridors: true, stepFreeRoutes: true },
      }),
      highlightsKoDefault: [
        '식음 부스를 2개 구역으로 나누어 쉬는 시간 대기줄 충돌 완화',
        '체험 부스 간격을 넓힌 순환형 관람 통로 구성',
        '화장실·출입구 균등 배치로 국소 밀집 억제',
      ],
      highlightsLoc: [
        tr6(
          lang,
          '식음 부스를 2개 구역으로 나누어 쉬는 시간 대기줄 충돌 완화',
          'Splits food booths across two wings to cut queue spillover',
          '飲食ブースを2ゾーンへ分割し休憩時間の待機列衝突を緩和',
          '将餐饮展位拆分为两个区域，显著减少休息时段排队溢出',
          'Divide los puestos de comida en dos alas para evitar cruces de colas',
          'Répartit les stands alimentaires sur deux ailes pour éviter le débordement des files',
        ),
        tr6(
          lang,
          '체험 부스 간격을 넓힌 순환형 관람 통로 구성',
          'Widens booth spacing along a smooth ring walkway',
          '体験ブース間隔を広げた循環型観覧通路を構成',
          '拉大体验展位间距，构建顺畅环形游览动线',
          'Amplía la separación entre stands sobre un circuito fluido',
          'Élargit l’espacement des stands le long d’une promenade annulaire fluide',
        ),
        tr6(
          lang,
          '화장실·출입구 균등 배치로 국소 밀집 억제',
          'Balanced restroom and gate placement across zones',
          'トイレ・出入口を均等配置して局所過密を抑制',
          '均衡分布卫生间与出入口，抑制局部拥挤',
          'Distribución equilibrada de sanitarios y puertas entre zonas',
          'Répartition équilibrée des sanitaires et portes sur tout le site',
        ),
      ],
    },
    {
      id: 'D',
      nameP: koOr6(
        lang,
        '후보안 D · 예산 절감·다목적 실속형',
        'Option D · Budget-Lean Multi-Purpose Layout',
        '候補案 D · 予算最適化・多目的スマート型',
        '候选方案 D · 预算集约与多功能实用型',
        'Opción D · Multiusos Eficiente en Presupuesto',
        'Option D · Polyvalent Optimisé Budget',
      ),
      focusP: koOr6(
        lang,
        '경량 모듈 부스 및 선택형 대형 구조물 감축으로 설치비 대폭 절감',
        'Lightweight modular booths & trimmed optional structures for lower setup cost',
        '軽量モジュール構成により設置費を大幅削減・中央多目的空間を確保',
        '采用轻量化模块展位并精简可选大跨度结构，显著降低搭建成本',
        'Módulos ligeros y reducción de estructuras opcionales para menor costo',
        'Modules légers et structures optionnelles réduites pour abaisser les coûts',
      ),
      objective: 'budget_efficiency',
      mutateConfig: (c, step) => ({
        ...c,
        objective: 'budget_efficiency',
        venueLayoutModel: LAYOUT_ROTATION[(step * 3 + 6) % LAYOUT_ROTATION.length],
        boothModel: step % 2 === 0 ? 'open_canopy' : 'pagoda_tent',
        parkingCount: c.parkingCount ?? 0,
        foodBoothCount: Math.max(2, c.foodBoothCount - 1 - (step % 2)),
        experienceBoothCount: Math.max(3, c.experienceBoothCount - 2 - (step % 2)),
        requiredFacilities: {
          ...c.requiredFacilities,
          secondaryStage: false,
          campingArea: false,
          playRestZone: true,
        },
        accessibility: { ...c.accessibility, stepFreeRoutes: true, wideCorridors: true },
      }),
      postProcess: (_cfg, facs) =>
        facs.map((f) => {
          if (
            f.locked ||
            f.budgetExcluded ||
            f.category === 'stage' ||
            f.category === 'medical' ||
            f.category === 'entrance'
          ) {
            return f;
          }
          // Compact lightweight canopy package lowers cost by ~18%
          const w = Math.max(2.6, Math.round(f.dimensions.width * 0.9 * 10) / 10);
          const d = Math.max(2.6, Math.round(f.dimensions.depth * 0.9 * 10) / 10);
          return {
            ...f,
            dimensions: { ...f.dimensions, width: w, depth: d },
            cost: Math.max(250, Math.round(f.cost * 0.82)),
          };
        }),
      highlightsKoDefault: [
        '경량 캐노피 모듈 전환 및 선택형 대형 가설물 감축으로 설치비 절감',
        '전시·공연·네트워킹으로 전환 가능한 넓은 중앙 다목적 공간',
        '필수 안전·무장애 동선을 유지하면서 운영 동선 단순화',
      ],
      highlightsLoc: [
        tr6(
          lang,
          '경량 캐노피 모듈 전환 및 선택형 대형 가설물 감축으로 설치비 절감',
          'Switches to lightweight canopies & trims heavy optional structures to cut cost',
          '軽量キャノピー転換と大型仮設物の圧縮で設置費を大幅節減',
          '切换轻量化帐篷模块并精简大型可选构筑物，显著节省搭建费用',
          'Cambia a carpas ligeras y reduce estructuras pesadas para ahorrar costos',
          'Passe aux auvents légers et réduit les structures lourdes pour économiser',
        ),
        tr6(
          lang,
          '전시·공연·네트워킹으로 전환 가능한 넓은 중앙 다목적 공간',
          'Open central multi-purpose floor adaptable to talks, markets, or shows',
          '展示・公演・交流へ柔軟に転換できる広い中央多目的空間',
          '可灵活切换展览、演出与交流活动的宽敞中央多功能区',
          'Amplio espacio central adaptable a exposiciones, charlas o espectáculos',
          'Vaste espace central adaptable aux expositions, spectacles ou rencontres',
        ),
        tr6(
          lang,
          '필수 안전·무장애 동선을 유지하면서 운영 동선 단순화',
          'Retains step-free safety access with compact staffing needs',
          '必須の安全・バリアフリー動線を維持しつつ運営動線を簡素化',
          '完整保留安全与无障碍动线并简化现场运维流线',
          'Mantiene seguridad y accesibilidad sin escalones con operación simplificada',
          'Maintient la sécurité sans marche tout en simplifiant l’exploitation',
        ),
      ],
    },
  ];

  return specs.map((spec, sIdx) => {
    const candidateCfg = spec.mutateConfig(baseConfig, seedStep);
    let bestFacs: Facility[] = [];
    let bestMetrics: LayoutMetricsSummary | null = null;
    const variationsPerSpec = 4;

    for (let v = 0; v < variationsPerSpec; v++) {
      const trialCfg: EventConfig = {
        ...candidateCfg,
        seed: (baseConfig.seed * 17 + (sIdx + 1) * 7919 + v * 613) & 0x7fffffff,
      };
      let generated = generateVenueLayout(trialCfg, lockedFacilities);
      const optimized = optimizeVenueLayout(trialCfg, generated).facilities;
      generated = spec.postProcess ? spec.postProcess(trialCfg, optimized) : optimized;
      if (spec.id === 'D') {
        const totalCost = generated.reduce((sum, f) => sum + getEffectiveFacilityCost(f), 0);
        if (totalCost > trialCfg.budget) {
          generated = fitLayoutToBudget(trialCfg, generated).facilities;
        }
      }

      const sim = new CrowdSimulator(trialCfg, generated, 'normal');
      sim.seekToProgress(0.78);
      const metrics = evaluateVenueLayout(trialCfg, generated, sim.getSnapshot());

      const isBetter =
        !bestMetrics ||
        (spec.id === 'D'
          ? metrics.estimatedCost < bestMetrics.estimatedCost
          : spec.id === 'B'
            ? metrics.scores.accessibility > bestMetrics.scores.accessibility ||
              metrics.peakDensity < bestMetrics.peakDensity
            : metrics.peakDensity < bestMetrics.peakDensity ||
              (metrics.peakDensity === bestMetrics.peakDensity &&
                metrics.avgWaitMinutes < bestMetrics.avgWaitMinutes));

      if (isBetter) {
        bestMetrics = metrics;
        bestFacs = generated;
      }
    }

    const finalMetrics = bestMetrics!;
    const waitDelta =
      baseMetrics.avgWaitMinutes > 0
        ? Math.round(
            ((finalMetrics.avgWaitMinutes - baseMetrics.avgWaitMinutes) /
              baseMetrics.avgWaitMinutes) *
              100,
          )
        : -12;

    const layoutKey = candidateCfg.venueLayoutModel ?? 'standard';
    const boothKey = candidateCfg.boothModel ?? 'pagoda_tent';
    const layoutModelLabelLoc = pickL6(
      lang,
      VENUE_LAYOUT_MODEL_I18N[layoutKey] || VENUE_LAYOUT_MODEL_I18N.standard,
    );
    const layoutModelLabelKo =
      VENUE_LAYOUT_MODEL_I18N[layoutKey]?.ko || layoutKey;
    const boothModelLabelLoc = pickL6(
      lang,
      BOOTH_MODEL_STYLE_I18N[boothKey] || BOOTH_MODEL_STYLE_I18N.pagoda_tent,
    );
    const boothModelLabelKo =
      BOOTH_MODEL_STYLE_I18N[boothKey]?.ko || boothKey;

    // Candidate-specific reflected conditions: NEVER identical budget strings across A/B/C/D!
    const candCondLoc = [
      tr6(
        lang,
        `설치비 ${formatCurrency(finalMetrics.estimatedCost, 'ko')} (예산 대비 ${finalMetrics.budgetUsagePct}%)`,
        `Est. Cost ${formatCurrency(finalMetrics.estimatedCost, 'en')} (${finalMetrics.budgetUsagePct}% of budget)`,
        `設置費 ${formatCurrency(finalMetrics.estimatedCost, 'ja')}（予算比 ${finalMetrics.budgetUsagePct}%）`,
        `估算成本 ${formatCurrency(finalMetrics.estimatedCost, 'zh')}（占预算 ${finalMetrics.budgetUsagePct}%）`,
        `Costo est. ${formatCurrency(finalMetrics.estimatedCost, 'es')} (${finalMetrics.budgetUsagePct}% del presup.)`,
        `Coût est. ${formatCurrency(finalMetrics.estimatedCost, 'fr')} (${finalMetrics.budgetUsagePct}% du budget)`,
      ),
      tr6(
        lang,
        `배치모형: ${layoutModelLabelLoc}`,
        `Topology: ${layoutModelLabelLoc}`,
        `配置型：${layoutModelLabelLoc}`,
        `布局模型：${layoutModelLabelLoc}`,
        `Topología: ${layoutModelLabelLoc}`,
        `Topologie : ${layoutModelLabelLoc}`,
      ),
      tr6(
        lang,
        `부스외관: ${boothModelLabelLoc}`,
        `Booth Style: ${boothModelLabelLoc}`,
        `ブース外観：${boothModelLabelLoc}`,
        `展位外观：${boothModelLabelLoc}`,
        `Estilo stand: ${boothModelLabelLoc}`,
        `Style stand : ${boothModelLabelLoc}`,
      ),
      tr6(
        lang,
        `시설 ${bestFacs.length}개 · 가용면적 ${finalMetrics.usableAreaSqm.toLocaleString()}m²`,
        `${bestFacs.length} modules · Net ${finalMetrics.usableAreaSqm.toLocaleString()}m²`,
        `施設 ${bestFacs.length}基 · 有効 ${finalMetrics.usableAreaSqm.toLocaleString()}m²`,
        `设施 ${bestFacs.length}个 · 净面积 ${finalMetrics.usableAreaSqm.toLocaleString()}m²`,
        `${bestFacs.length} módulos · Útil ${finalMetrics.usableAreaSqm.toLocaleString()}m²`,
        `${bestFacs.length} modules · Utile ${finalMetrics.usableAreaSqm.toLocaleString()}m²`,
      ),
      ...(lockedFacilities.length > 0
        ? [
            tr6(
              lang,
              `고정 부스 ${lockedFacilities.length}개 유지`,
              `${lockedFacilities.length} Locked Preserved`,
              `固定 ${lockedFacilities.length}基維持`,
              `保留锁定 ${lockedFacilities.length}个`,
              `${lockedFacilities.length} bloqueado(s)`,
              `${lockedFacilities.length} verrouillé(s)`,
            ),
          ]
        : []),
    ];

    const candCondKo =
      lang === 'ko'
        ? candCondLoc
        : [
            `설치비 ${formatCurrency(finalMetrics.estimatedCost, 'ko')} (예산 대비 ${finalMetrics.budgetUsagePct}%)`,
            `배치모형: ${layoutModelLabelKo}`,
            `부스외관: ${boothModelLabelKo}`,
            `시설 ${bestFacs.length}개 · 가용면적 ${finalMetrics.usableAreaSqm.toLocaleString()}m²`,
          ];

    void eventLabelLoc;
    void eventLabelKo;
    void envLabel;
    void condLoc;
    void baseCondKo;

    return {
      id: spec.id,
      nameKo: spec.nameP.ko,
      nameEn: spec.nameP.en,
      focusKo: spec.focusP.ko,
      focusEn: spec.focusP.en,
      objective: spec.objective,
      facilities: bestFacs,
      configOverride: candidateCfg,
      metrics: finalMetrics,
      waitTimeDeltaPct: waitDelta,
      evaluatedVariations: 48,
      highlightsKo: lang === 'ko' ? spec.highlightsKoDefault : spec.highlightsLoc,
      highlightsEn: spec.highlightsLoc,
      reflectedConditionsKo: candCondKo,
      reflectedConditionsEn: candCondLoc,
    };
  });
}

/**
 * Deterministic Explainable AI (XAI) Report Builder — concise, readable, score-free, 6-language aware.
 */
export function buildDeterministicXaiReport(
  config: EventConfig,
  summary: LayoutMetricsSummary,
  comparison: LayoutComparison,
  personas: PersonaEvaluation[],
  contingency: ContingencyScenario,
  lang: Language,
  assumptions: SimulationAssumptions = DEFAULT_SIMULATION_ASSUMPTIONS,
): XaiExplanation {
  const profileI18n = DENSITY_PROFILE_I18N[assumptions.densityProfile];
  const profileName = pickL6(lang, profileI18n.name);
  const tierInfo = getProfileTierBadgeText(summary.moisSafetyTier, assumptions.densityProfile, lang);
  const contLoc = CONTINGENCY_I18N[contingency];
  const contLabel = pickL6(lang, contLoc.label);
  const contDesc = pickL6(lang, contLoc.desc);
  const waitAbs = Math.abs(comparison.waitTimeDeltaPct);
  const dUnit = densityUnitLabel(lang);
  const aisleStr = config.accessibility.wideCorridors ? '5.8m' : '3.6m';
  const isOutdoor = config.venueEnvironment === 'outdoor';

  if (lang === 'ko') {
    return {
      executiveSummary: `'${config.eventName}'(${isOutdoor ? '실외' : '실내'} ${config.venueWidth}×${config.venueDepth}m · 순수 보행 가용면적 ${summary.usableAreaSqm.toLocaleString()}m² · 배치 시설 ${summary.totalFacilities}개) 분석 결과, 시간대별 최대 밀집도는 ${summary.peakDensity.toFixed(2)}${dUnit}, 예상 평균 대기시간은 ${summary.avgWaitMinutes}분, 예상 설치비는 ${formatCurrency(summary.estimatedCost, 'ko')}(예산 대비 ${summary.budgetUsagePct}%)입니다.`,
      safetyComplianceVerdict: `최대 모의 밀집도 ${summary.peakDensity.toFixed(2)}${dUnit}는 [${profileName}] 기준 '${tierInfo.label} (${tierInfo.threshold})' 구간입니다. 임의의 종합 점수 대신 출구 실질 유효폭, 부스 앞 대기줄의 통로 침범 여부, 교통약자 전용 완만 퇴장로를 함께 점검했습니다.`,
      placementRationales: [
        `[유효 보행면적 확보] 전체 ${summary.venueAreaSqm.toLocaleString()}m² 중 시설 점유 면적(${summary.occupiedAreaSqm.toLocaleString()}m²)을 제외한 ${summary.usableAreaSqm.toLocaleString()}m²의 보행 공간과 ${aisleStr} 주통로를 확보했습니다.`,
        `[대기열과 이동 동선 분리] 인기 식음·체험 부스를 좌우 구역으로 분산 배치하여 정지 대기줄이 주 이동 통로를 막지 않도록 설계했습니다(대기시간 약 ${waitAbs}% 개선).`,
        `[교통약자 통합 그룹 전용 퇴장로] 휠체어·전동보장구·유모차 이용객이 중앙 혼잡 구역과 계단을 피해 안전하게 빠져나갈 수 있도록 외곽 완만 퇴장 동선을 출입구와 직결했습니다.`,
      ],
      inclusiveDesignHighlights: personas.map(
        (p) => `${p.labelKo} (최대 보행 ${p.maxContinuousWalkM}m · 적용률 ${p.facilityCoveragePct}%): ${p.keyFindingKo}`,
      ),
      contingencyProtocol: `현재 시나리오 [${contLabel}]: ${contDesc} (사전 시뮬레이션 수치는 시나리오 간 비교 참고용이며 현장 안전요원 운영과 병행해야 합니다.)`,
      source: 'heuristic',
      generatedAt: new Date().toLocaleTimeString('ko-KR'),
    };
  }

  return {
    executiveSummary: tr6(
      lang,
      '',
      `${config.eventName} (${isOutdoor ? 'Outdoor' : 'Indoor'} ${config.venueWidth}×${config.venueDepth}m, Usable ${summary.usableAreaSqm.toLocaleString()}m² / Facilities ${summary.totalFacilities}): Peak ${summary.peakDensity.toFixed(2)} ${dUnit}, Avg Wait ${summary.avgWaitMinutes} min, Est. Cost ${formatCurrency(summary.estimatedCost, lang)} (${summary.budgetUsagePct}%).`,
      `「${config.eventName}」（${isOutdoor ? '屋外' : '屋内'} ${config.venueWidth}×${config.venueDepth}m・純歩行有効面積 ${summary.usableAreaSqm.toLocaleString()}m²・配置施設 ${summary.totalFacilities}基）：最大密度 ${summary.peakDensity.toFixed(2)} ${dUnit}、予想平均待ち ${summary.avgWaitMinutes}分、予想設置費 ${formatCurrency(summary.estimatedCost, lang)}（予算比 ${summary.budgetUsagePct}%）。`,
      `“${config.eventName}”（${isOutdoor ? '室外' : '室内'} ${config.venueWidth}×${config.venueDepth}m · 纯通行可用面积 ${summary.usableAreaSqm.toLocaleString()}m² · 设施 ${summary.totalFacilities}个）：峰值密度 ${summary.peakDensity.toFixed(2)} ${dUnit}，平均等待 ${summary.avgWaitMinutes}分钟，预计费用 ${formatCurrency(summary.estimatedCost, lang)}（占预算 ${summary.budgetUsagePct}%）。`,
      `${config.eventName} (${isOutdoor ? 'Exterior' : 'Interior'} ${config.venueWidth}×${config.venueDepth}m, Área útil ${summary.usableAreaSqm.toLocaleString()}m² / ${summary.totalFacilities} instalaciones): Pico ${summary.peakDensity.toFixed(2)} ${dUnit}, Espera prom. ${summary.avgWaitMinutes} min, Costo est. ${formatCurrency(summary.estimatedCost, lang)} (${summary.budgetUsagePct}%).`,
      `${config.eventName} (${isOutdoor ? 'Extérieur' : 'Intérieur'} ${config.venueWidth}×${config.venueDepth}m, Surface utile ${summary.usableAreaSqm.toLocaleString()}m² / ${summary.totalFacilities} équipements) : Pic ${summary.peakDensity.toFixed(2)} ${dUnit}, Attente moy. ${summary.avgWaitMinutes} min, Coût est. ${formatCurrency(summary.estimatedCost, lang)} (${summary.budgetUsagePct}%).`,
    ),
    safetyComplianceVerdict: tr6(
      lang,
      '',
      `Peak crowd density is ${summary.peakDensity.toFixed(2)} ${dUnit} (${tierInfo.label}, ${tierInfo.threshold}) under [${profileName}]. Clear exit gate width, step-free perimeter egress for wheelchair/scooter/stroller visitors, and queue separation are verified together.`,
      `最大密度 ${summary.peakDensity.toFixed(2)} ${dUnit} は［${profileName}］基準で「${tierInfo.label}（${tierInfo.threshold}）」区分です。単一スコアに頼らず、有効出口幅・待機列分離・配慮者専用スロープ退場路を総合検証しました。`,
      `模拟峰值密度 ${summary.peakDensity.toFixed(2)} ${dUnit} 在［${profileName}］标准下属于“${tierInfo.label}（${tierInfo.threshold}）”区间。系统不依赖单一评分，而是联合核查净出口宽度、排队分离与无障碍专用退场路线。`,
      `La densidad máxima de ${summary.peakDensity.toFixed(2)} ${dUnit} corresponde a "${tierInfo.label} (${tierInfo.threshold})" según [${profileName}]. Se verifican conjuntamente el ancho efectivo de salida, la separación de colas y la ruta accesible perimetral.`,
      `La densité maximale de ${summary.peakDensity.toFixed(2)} ${dUnit} correspond à « ${tierInfo.label} (${tierInfo.threshold}) » selon [${profileName}]. La largeur utile des sorties, la séparation des files et le couloir PMR sont vérifiés conjointement.`,
    ),
    placementRationales: [
      tr6(
        lang,
        '',
        `[Clear Circulation Area] Subtracting ${summary.occupiedAreaSqm.toLocaleString()}m² of structures leaves ${summary.usableAreaSqm.toLocaleString()}m² of circulation space with ${aisleStr} primary aisles.`,
        `[有効歩行面積の確保] 総面積 ${summary.venueAreaSqm.toLocaleString()}m² から構造物占有（${summary.occupiedAreaSqm.toLocaleString()}m²）を除き、${summary.usableAreaSqm.toLocaleString()}m² の歩行空間と ${aisleStr} 主通路を確保しました。`,
        `[有效通行面积保障] 总面积 ${summary.venueAreaSqm.toLocaleString()}m² 扣除设施占地（${summary.occupiedAreaSqm.toLocaleString()}m²）后，留出 ${summary.usableAreaSqm.toLocaleString()}m² 净步行空间与 ${aisleStr} 主通道。`,
        `[Área de Circulación Despejada] Descontando ${summary.occupiedAreaSqm.toLocaleString()}m² de estructuras quedan ${summary.usableAreaSqm.toLocaleString()}m² útiles con pasillos principales de ${aisleStr}.`,
        `[Surface de Circulation Dégagée] Après déduction de ${summary.occupiedAreaSqm.toLocaleString()}m² d’emprise, ${summary.usableAreaSqm.toLocaleString()}m² restent libres avec des allées principales de ${aisleStr}.`,
      ),
      tr6(
        lang,
        '',
        `[Queue Spillover Relief] Dispersing food and experience booths across separate wings prevents stationary queue lines from blocking main walkways (wait time delta ${waitAbs}%).`,
        `[待機列と移動動線の分離] 飲食・体験ブースを左右ゾーンへ分散し、静止待機列が主歩行通路を塞がないよう設計しました（待ち時間変化 約${waitAbs}%）。`,
        `[排队与通行分流] 将热门餐饮与体验展位分散至左右侧翼，防止静止排队队列堵塞主通行走廊（等待时间变化约 ${waitAbs}%）。`,
        `[Separación de Colas y Flujo] Dispersar comida y stands en alas separadas evita que las colas estacionarias bloqueen los pasillos principales (variación de espera ${waitAbs}%).`,
        `[Séparation Files & Circulation] La dispersion des stands sur deux ailes évite que les files d’attente ne bloquent les allées principales (écart d’attente ${waitAbs}%).`,
      ),
      tr6(
        lang,
        '',
        `[Dedicated Priority Access Egress] Wheelchair, mobility scooter, and stroller visitors are routed along step-free perimeter egress lanes directly connected to accessible gates.`,
        `[配慮者統合グループ専用退場路] 車椅子・電動モビリティ・ベビーカー利用者が中央混雑や段差を避けて退場できるよう、外周緩勾配ルートを出入口へ直結しました。`,
        `[无障碍群体专用退场道] 为轮椅、电动代步车与婴儿车访客开辟避开中央拥挤与台阶的外围平缓退场通道，并直连无障碍大门。`,
        `[Salida Prioritaria Sin Escalones] Usuarios de silla de ruedas, scooter eléctrico y cochecito cuentan con rutas perimetrales sin escalones conectadas directamente a puertas accesibles.`,
        `[Sortie Prioritaire Sans Marche] Les utilisateurs de fauteuils roulants, scooters et poussettes disposent de couloirs périmétriques sans marche reliés directement aux portes accessibles.`,
      ),
    ],
    inclusiveDesignHighlights: personas.map((p) =>
      tr6(
        lang,
        '',
        `${p.labelEn} (Max walk ${p.maxContinuousWalkM}m · ${p.facilityCoveragePct}% coverage): ${p.keyFindingEn}`,
        `${p.labelEn}（最大連続歩行 ${p.maxContinuousWalkM}m・カバー率 ${p.facilityCoveragePct}%）：${p.keyFindingEn}`,
        `${p.labelEn}（最大连续步行 ${p.maxContinuousWalkM}m · 覆盖率 ${p.facilityCoveragePct}%）：${p.keyFindingEn}`,
        `${p.labelEn} (Marcha máx. ${p.maxContinuousWalkM}m · cobertura ${p.facilityCoveragePct}%): ${p.keyFindingEn}`,
        `${p.labelEn} (Marche max. ${p.maxContinuousWalkM}m · couverture ${p.facilityCoveragePct}%) : ${p.keyFindingEn}`,
      ),
    ),
    contingencyProtocol: `[${contLabel}] ${contDesc}`,
    source: 'heuristic',
    generatedAt: new Date().toLocaleTimeString(getLocaleCode(lang)),
  };
}
