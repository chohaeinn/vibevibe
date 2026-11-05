import {
  DensityReferenceProfileId,
  EventConfig,
  Facility,
  FieldCalibrationSample,
  GateFlowAnalysis,
  Language,
  LiteratureSourceEntry,
  ModelVerificationStatus,
  MoisSafetyTier,
  SimulationAssumptions,
  SimulationSnapshot,
  SpatialRuleCheckItem,
  SpatialSafetyAudit,
  ZoneDifferentiatedAnalysis,
} from '../types/festival';
import {
  DENSITY_PROFILE_I18N,
  MOIS_TIER_I18N,
  pickL6,
  tr6,
} from '../i18n/localeCatalog';
import { getFacilityDisplayName } from './presets';

export interface DensityProfileMeta {
  id: DensityReferenceProfileId;
  nameKo: string;
  nameEn: string;
  sourceLocationKo: string;
  sourceLocationEn: string;
  referenceComfortMax: number;
  cautionStart: number;
  warningStart: number;
  dangerStart: number;
  noteKo: string;
  noteEn: string;
}

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

export function densityUnitLabel(lang: Language): string {
  return tr6(lang, '명/m²', 'p/m²', '人/m²', '人/m²', 'p/m²', 'p/m²');
}

export function getLocalizedDensityProfile(
  profileId: DensityReferenceProfileId,
  lang: Language = 'ko',
) {
  const base =
    DENSITY_REFERENCE_PROFILES[profileId] || DENSITY_REFERENCE_PROFILES.mois_2024_main_table;
  const i18n = DENSITY_PROFILE_I18N[profileId] || DENSITY_PROFILE_I18N.mois_2024_main_table;
  return {
    ...base,
    name: pickL6(lang, i18n.name),
    sourceLocation: pickL6(lang, i18n.source),
    note: pickL6(lang, i18n.note),
  };
}

export const DENSITY_REFERENCE_PROFILES: Record<DensityReferenceProfileId, DensityProfileMeta> = {
  mois_2024_main_table: {
    id: 'mois_2024_main_table',
    nameKo: DENSITY_PROFILE_I18N.mois_2024_main_table.name.ko,
    nameEn: DENSITY_PROFILE_I18N.mois_2024_main_table.name.en,
    sourceLocationKo: DENSITY_PROFILE_I18N.mois_2024_main_table.source.ko,
    sourceLocationEn: DENSITY_PROFILE_I18N.mois_2024_main_table.source.en,
    referenceComfortMax: 2.0,
    cautionStart: 2.0,
    warningStart: 3.0,
    dangerStart: 5.0,
    noteKo: DENSITY_PROFILE_I18N.mois_2024_main_table.note.ko,
    noteEn: DENSITY_PROFILE_I18N.mois_2024_main_table.note.en,
  },
  mois_2024_page10_note: {
    id: 'mois_2024_page10_note',
    nameKo: DENSITY_PROFILE_I18N.mois_2024_page10_note.name.ko,
    nameEn: DENSITY_PROFILE_I18N.mois_2024_page10_note.name.en,
    sourceLocationKo: DENSITY_PROFILE_I18N.mois_2024_page10_note.source.ko,
    sourceLocationEn: DENSITY_PROFILE_I18N.mois_2024_page10_note.source.en,
    referenceComfortMax: 2.5,
    cautionStart: 2.5,
    warningStart: 3.0,
    dangerStart: 6.0,
    noteKo: DENSITY_PROFILE_I18N.mois_2024_page10_note.note.ko,
    noteEn: DENSITY_PROFILE_I18N.mois_2024_page10_note.note.en,
  },
  indoor_narrow_conservative: {
    id: 'indoor_narrow_conservative',
    nameKo: DENSITY_PROFILE_I18N.indoor_narrow_conservative.name.ko,
    nameEn: DENSITY_PROFILE_I18N.indoor_narrow_conservative.name.en,
    sourceLocationKo: DENSITY_PROFILE_I18N.indoor_narrow_conservative.source.ko,
    sourceLocationEn: DENSITY_PROFILE_I18N.indoor_narrow_conservative.source.en,
    referenceComfortMax: 1.5,
    cautionStart: 1.5,
    warningStart: 2.5,
    dangerStart: 4.0,
    noteKo: DENSITY_PROFILE_I18N.indoor_narrow_conservative.note.ko,
    noteEn: DENSITY_PROFILE_I18N.indoor_narrow_conservative.note.en,
  },
};

export function classifyDensityByProfile(
  peakDensity: number,
  profileId: DensityReferenceProfileId = 'mois_2024_main_table',
): MoisSafetyTier {
  const p = DENSITY_REFERENCE_PROFILES[profileId] || DENSITY_REFERENCE_PROFILES.mois_2024_main_table;
  if (peakDensity <= p.cautionStart) return 'safe';
  if (peakDensity < p.warningStart) return 'caution';
  if (peakDensity < p.dangerStart) return 'warning';
  return 'danger';
}

export function getProfileTierBadgeText(
  tier: MoisSafetyTier,
  profileId: DensityReferenceProfileId = 'mois_2024_main_table',
  lang: Language = 'ko',
): { ko: string; en: string; label: string; threshold: string; colorClass: string } {
  const p = DENSITY_REFERENCE_PROFILES[profileId] || DENSITY_REFERENCE_PROFILES.mois_2024_main_table;
  const unit = densityUnitLabel(lang);
  const label = pickL6(lang, MOIS_TIER_I18N[tier]);
  const threshold =
    tier === 'safe'
      ? `≤ ${p.cautionStart.toFixed(1)} ${unit}`
      : tier === 'caution'
        ? `${p.cautionStart.toFixed(1)}–${p.warningStart.toFixed(1)} ${unit}`
        : tier === 'warning'
          ? `${p.warningStart.toFixed(1)}–${p.dangerStart.toFixed(1)} ${unit}`
          : `≥ ${p.dangerStart.toFixed(1)} ${unit}`;
  const colorClass =
    tier === 'safe'
      ? 'text-emerald-700'
      : tier === 'caution'
        ? 'text-blue-700'
        : tier === 'warning'
          ? 'text-amber-700'
          : 'text-red-700';

  return {
    ko: lang === 'ko' ? MOIS_TIER_I18N[tier].ko : label,
    en: lang === 'ko' ? MOIS_TIER_I18N[tier].en : label,
    label,
    threshold,
    colorClass,
  };
}

/**
 * Computes occupied facility footprint vs. usable pedestrian/standing area and
 * explicit reference capacity (Report Page 6: "정원 대신 사용 가능 면적과 설정 밀도로 계산한 참고 수용량").
 */
export function computeUsableAreaAndReferenceCapacity(
  config: EventConfig,
  facilities: Facility[],
  profileId: DensityReferenceProfileId = 'mois_2024_main_table',
): {
  venueAreaSqm: number;
  occupiedAreaSqm: number;
  usableAreaSqm: number;
  referenceDensityPerSqm: number;
  referenceCapacity: number;
} {
  const venueAreaSqm = Math.round(config.venueWidth * config.venueDepth);

  // Sum footprints of physical structures/parking/fenced zones that exclude free pedestrian standing
  let rawOccupied = 0;
  for (const f of facilities) {
    if (f.category === 'parking') {
      // Exterior parking lots sit outside the venue boundary and do not reduce interior walkable floor
      continue;
    }
    const footprint = f.dimensions.width * f.dimensions.depth;
    if (f.subtype === 'rain_canopy' || f.subtype === 'rest_plaza') {
      // Open canopies/plazas remain ~75% walkable underneath, ~25% posts/benches/tables
      rawOccupied += footprint * 0.28;
    } else if (f.category === 'entrance') {
      rawOccupied += footprint * 0.35;
    } else {
      rawOccupied += footprint;
    }
  }

  // Perimeter fence buffer & landscaping (~8% of gross ground)
  const perimeterBuffer = venueAreaSqm * 0.08;
  const occupiedAreaSqm = Math.min(
    Math.round(venueAreaSqm * 0.78),
    Math.round(rawOccupied + perimeterBuffer),
  );
  const usableAreaSqm = Math.max(500, venueAreaSqm - occupiedAreaSqm);

  const profile = DENSITY_REFERENCE_PROFILES[profileId] || DENSITY_REFERENCE_PROFILES.mois_2024_main_table;
  // Use conservative usable-space circulation factor (0.45 of open area actively holds simultaneous standing/walking without blocking aisles)
  const effectiveStandingShare = 0.45;
  const referenceDensityPerSqm = profile.referenceComfortMax;
  const referenceCapacity = Math.round(usableAreaSqm * effectiveStandingShare * referenceDensityPerSqm);

  return {
    venueAreaSqm,
    occupiedAreaSqm,
    usableAreaSqm,
    referenceDensityPerSqm,
    referenceCapacity,
  };
}

function getEffectiveBox(f: Facility) {
  const isRot90 = Math.abs(Math.sin(f.rotation)) > 0.7;
  const halfW = (isRot90 ? f.dimensions.depth : f.dimensions.width) * 0.5;
  const halfD = (isRot90 ? f.dimensions.width : f.dimensions.depth) * 0.5;
  return {
    minX: f.position.x - halfW,
    maxX: f.position.x + halfW,
    minZ: f.position.z - halfD,
    maxZ: f.position.z + halfD,
    effW: halfW * 2,
    effD: halfD * 2,
  };
}

/**
 * Explicit Deterministic Rule Engine (Report Page 2, 6, 15-21):
 * Performs geometric collision, boundary, emergency corridor obstruction, queue spillover,
 * gate egress failure, steward placement, and external transit bottleneck checks.
 */
export function runExplicitSpatialSafetyAudit(
  config: EventConfig,
  facilities: Facility[],
  snapshot: SimulationSnapshot,
  assumptions: SimulationAssumptions,
  calibration: FieldCalibrationSample,
  lang: Language = 'ko',
): SpatialSafetyAudit {
  const verificationStatus: ModelVerificationStatus = calibration.enabled
    ? 'field_calibrated'
    : 'assumption_sim';

  const areaStats = computeUsableAreaAndReferenceCapacity(
    config,
    facilities,
    assumptions.densityProfile,
  );

  const halfVenueW = config.venueWidth * 0.5;
  const halfVenueD = config.venueDepth * 0.5;

  const overlapMessages: string[] = [];
  const affectedOverlapIds = new Set<string>();

  for (let i = 0; i < facilities.length; i++) {
    const a = facilities[i];
    const nameA = getFacilityDisplayName(a, lang);
    const boxA = getEffectiveBox(a);
    if (a.category === 'parking') {
      if (
        boxA.maxX > -halfVenueW + 2 &&
        boxA.minX < halfVenueW - 2 &&
        boxA.maxZ > -halfVenueD + 2 &&
        boxA.minZ < halfVenueD - 2
      ) {
        affectedOverlapIds.add(a.id);
        overlapMessages.push(
          tr6(
            lang,
            `${nameA}: 주차장은 행사장 외부 공간에 배치되어야 합니다`,
            `${nameA}: parking lot must stay outside venue perimeter`,
            `${nameA}: 駐車場は会場外周スペースに配置する必要があります`,
            `${nameA}: 停车场须置于场馆外围区域`,
            `${nameA}: el estacionamiento debe permanecer fuera del perímetro`,
            `${nameA} : le parking doit rester hors du périmètre intérieur`,
          ),
        );
      }
    } else if (
      boxA.minX < -halfVenueW + 1 ||
      boxA.maxX > halfVenueW - 1 ||
      boxA.minZ < -halfVenueD + 1 ||
      boxA.maxZ > halfVenueD - 1
    ) {
      affectedOverlapIds.add(a.id);
      overlapMessages.push(
        tr6(
          lang,
          `${nameA}: 부지 외곽 경계선 근접/이탈`,
          `${nameA}: encroaches venue perimeter`,
          `${nameA}: 敷地境界線に近接・越境`,
          `${nameA}: 贴近或超出场地边界线`,
          `${nameA}: invade el borde perimetral`,
          `${nameA} : empiète sur la limite du site`,
        ),
      );
    }

    for (let j = i + 1; j < facilities.length; j++) {
      const b = facilities[j];
      if (a.subtype === 'rain_canopy' || b.subtype === 'rain_canopy') continue;
      const boxB = getEffectiveBox(b);
      const overlapX = Math.min(boxA.maxX, boxB.maxX) - Math.max(boxA.minX, boxB.minX);
      const overlapZ = Math.min(boxA.maxZ, boxB.maxZ) - Math.max(boxA.minZ, boxB.minZ);
      if (overlapX > 0.6 && overlapZ > 0.6) {
        affectedOverlapIds.add(a.id);
        affectedOverlapIds.add(b.id);
        const nameB = getFacilityDisplayName(b, lang);
        overlapMessages.push(`${nameA} ↔ ${nameB} (${overlapX.toFixed(1)}m)`);
      }
    }
  }

  const spineObstructions: string[] = [];
  const spineIds: string[] = [];
  for (const f of facilities) {
    if (f.category === 'entrance' || f.category === 'parking' || f.subtype === 'rain_canopy') continue;
    const box = getEffectiveBox(f);
    const hitsEmergencySpine = box.minX < -4.8 && box.maxX > -9.2 && box.maxZ > -halfVenueD * 0.45;
    if (hitsEmergencySpine) {
      spineIds.push(f.id);
      const fName = getFacilityDisplayName(f, lang);
      spineObstructions.push(
        tr6(
          lang,
          `${fName} (중앙 비상통로 x=-7m 침범)`,
          `${fName} encroaches central emergency lane (x=-7m)`,
          `${fName}（中央非常通路 x=-7m 干渉）`,
          `${fName}（侵入中央应急通道 x=-7m）`,
          `${fName} invade vía de emergencia (x=-7m)`,
          `${fName} empiète sur l’axe secours (x=-7m)`,
        ),
      );
    }
  }

  const queueSpills: string[] = [];
  const queueSpillIds: string[] = [];
  for (const f of facilities) {
    const q = snapshot.facilityQueues[f.id] || 0;
    if (q < 20) continue;
    const estQueueLengthM = (q / 2) * 0.65;
    const distToMainPromenade = Math.abs(f.position.z - 6);
    const distToEmergencyLane = Math.abs(f.position.x - -7);
    if (estQueueLengthM > 14 || distToMainPromenade < estQueueLengthM * 0.6 || distToEmergencyLane < 9) {
      queueSpillIds.push(f.id);
      const fName = getFacilityDisplayName(f, lang);
      queueSpills.push(
        tr6(
          lang,
          `${fName}: 대기줄 약 ${Math.round(estQueueLengthM)}m (${q}명)`,
          `${fName}: ~${Math.round(estQueueLengthM)}m queue (${q} pax)`,
          `${fName}: 待機列 約${Math.round(estQueueLengthM)}m（${q}名）`,
          `${fName}: 排队约 ${Math.round(estQueueLengthM)}m（${q}人）`,
          `${fName}: fila ~${Math.round(estQueueLengthM)}m (${q} pers.)`,
          `${fName} : file ~${Math.round(estQueueLengthM)}m (${q} pers.)`,
        ),
      );
    }
  }

  const rawGates = facilities.filter(
    (f) => f.category === 'entrance' && (f.subtype === 'main_entrance' || f.subtype === 'secondary_entrance'),
  );
  const effectiveAttendance =
    snapshot.contingency === 'surge'
      ? Math.round(config.expectedAttendance * 1.35)
      : config.expectedAttendance;

  const peakEgressWindowMin = assumptions.inflowControlMode === 'holding' ? 32 : 24;
  const totalPeakDemandPerMin = Math.round((effectiveAttendance * 0.72) / peakEgressWindowMin);

  const gateFlows: GateFlowAnalysis[] = rawGates.map((g, idx) => {
    const isClosed = assumptions.closedPrimaryGate && idx === 0;
    const effectiveWidthM = Number((g.dimensions.width * 0.52).toFixed(1));
    const designThroughputPerMin = isClosed ? 0 : Math.round(effectiveWidthM * 52);
    const gName = getFacilityDisplayName(g, lang);
    return {
      gateId: g.id,
      gateNameKo: lang === 'ko' ? getFacilityDisplayName(g, 'ko') : gName,
      gateNameEn: lang === 'ko' ? getFacilityDisplayName(g, 'en') : gName,
      effectiveWidthM,
      isClosedInScenario: isClosed,
      designThroughputPerMin,
      estimatedPeakDemandPerMin: 0,
      loadRatioPct: 0,
    };
  });

  const activeGates = gateFlows.filter((g) => !g.isClosedInScenario);
  const totalOpenThroughput = Math.max(1, activeGates.reduce((s, g) => s + g.designThroughputPerMin, 0));
  const nonCompliantBias = 1 + (1 - assumptions.guidanceComplianceRate) * 0.55;

  gateFlows.forEach((gf, idx) => {
    if (gf.isClosedInScenario) {
      gf.estimatedPeakDemandPerMin = 0;
      gf.loadRatioPct = 0;
      return;
    }
    const share = gf.designThroughputPerMin / totalOpenThroughput;
    const bias = idx === 0 || (assumptions.closedPrimaryGate && idx === 1) ? nonCompliantBias : 1 / nonCompliantBias;
    gf.estimatedPeakDemandPerMin = Math.round(totalPeakDemandPerMin * share * bias);
    gf.loadRatioPct = Math.round((gf.estimatedPeakDemandPerMin / Math.max(1, gf.designThroughputPerMin)) * 100);
  });

  const maxGateLoadPct = gateFlows.reduce((m, g) => Math.max(m, g.loadRatioPct), 0);

  const allOpenThroughput = Math.max(
    120,
    rawGates.reduce((s, g) => s + Math.round(g.dimensions.width * 0.52 * 52), 0),
  );
  const nominalOpenSec = Math.round(((effectiveAttendance * 0.72) / allOpenThroughput) * 60);
  const compliancePenaltyFactor = 1 + (1 - assumptions.guidanceComplianceRate) * 0.48;
  const currentAssumptionsSec = Math.round(
    ((effectiveAttendance * 0.72) / Math.max(80, totalOpenThroughput)) * 60 * compliancePenaltyFactor,
  );

  const peakOutboundPerHour = Math.round(
    effectiveAttendance * (assumptions.inflowControlMode === 'holding' ? 0.56 : 0.72),
  );
  const externalCap = Math.max(500, assumptions.externalTransitCapacityPerHour);
  const transitLoadPct = Math.round((peakOutboundPerHour / externalCap) * 100);
  const estimatedSpillbackQueue = Math.max(0, Math.round((peakOutboundPerHour - externalCap) * 0.45));

  const corridorW = config.accessibility.wideCorridors ? 5.2 : 3.8;
  const compliancePct = Math.round(assumptions.guidanceComplianceRate * 100);
  const z1Name = koOr6(lang, '무대 전면·관람 밀집 광장', 'Stage Front High-Density Plaza', 'ステージ前方・高密度観覧広場', '舞台前高密度观演广场', 'Plaza Frontal de Alta Densidad', 'Parvis Scène Haute Densité');
  const z1Model = koOr6(lang, '장시간 제자리 밀착 체류 및 종료 직후 일시 유출 구역', 'Prolonged stationary standing & post-show surge release', '長時間滞留および終演直後の一斉流出ゾーン', '长时间驻留观演及散场瞬间集中涌出区', 'Permanencia prolongada y salida súbita post-show', 'Stationnement prolongé et flux sortant après spectacle');
  const z2Name = koOr6(lang, `일반 순환 보행로 (폭 ${corridorW}m)`, `Main Promenade Corridors (${corridorW}m)`, `主要循環歩行通路（幅 ${corridorW}m）`, `主环行步道（宽 ${corridorW}m）`, `Pasillos Principales (${corridorW}m)`, `Allées Principales (${corridorW}m)`);
  const z2Model = koOr6(lang, '양방향 보행 흐름과 노점 시각 유인·대기줄이 만나는 구간', 'Bidirectional walking flow mixed with booth attraction & queues', '双方向歩行流とブース待機列が交差する区間', '双向步行人流与展位吸引及排队交织区间', 'Flujo bidireccional mezclado con filas de stands', 'Flux bidirectionnel mêlé aux files des stands');
  const z3Name = koOr6(lang, '출입구·검색대 및 외부 주차장/교통 연결부', 'Exit Gates & Exterior Parking/Transit Links', '出入口ゲート・外部駐車場連絡部', '出入口与外部停车场/交通衔接段', 'Puertas y Conexión con Parking Exterior', 'Portes & Liaisons Parkings Extérieurs');
  const z3Model = koOr6(lang, '넓은 광장 인파가 좁은 통과폭으로 모이는 깔때기 병목 구간', 'Funnel bottleneck constrained by clear gate width & exterior transit', '広い広場から狭い通過幅へ集まるボトルネック区間', '开阔广场人流汇入狭窄净通行宽度的漏斗瓶颈区', 'Cuello de botella limitado por ancho útil de puertas', 'Goulot contraint par la largeur utile des portes');

  const zoneProfiles: ZoneDifferentiatedAnalysis[] = [
    {
      zoneId: 'plaza_high_density',
      zoneNameKo: z1Name.ko,
      zoneNameEn: z1Name.en,
      modelRepresentationKo: z1Model.ko,
      modelRepresentationEn: z1Model.en,
      assumedSpeedMps: Number((snapshot.contingency === 'rain' ? 0.55 : 0.68).toFixed(2)),
      peakDensity: snapshot.peakDensity,
      dwellCharacteristicKo: tr6(
        lang,
        '공연 중 밀착 체류하다가 종료 순간 한꺼번에 통로로 유출되며 압력을 높임',
        'Crowds stay packed during shows, then surge into aisles right after the finale.',
        '公演中は密着滞留し、終演直後に一斉に通路へ流出して圧力を高めます。',
        '演出期间密集驻留，散场瞬间集中涌入通道导致局部压力上升。',
        'El público permanece compacto y sale en bloque hacia los pasillos al finalizar.',
        'Le public reste dense pendant le show puis afflue brusquement vers les allées.',
      ),
      citation: tr6(lang, '정지 체류와 공연 직후 일시 배출 분리', 'Separates stationary packing from post-show discharge', '静止滞留と終演直後排出の分離', '区分静态驻留与散场瞬时疏散', 'Separa densidad estática y descarga post-show', 'Sépare densité statique et décharge post-concert'),
    },
    {
      zoneId: 'promenade_corridor',
      zoneNameKo: z2Name.ko,
      zoneNameEn: z2Name.en,
      modelRepresentationKo: z2Model.ko,
      modelRepresentationEn: z2Model.en,
      assumedSpeedMps: Number((snapshot.contingency === 'rain' ? 0.92 : 1.15).toFixed(2)),
      peakDensity: Number((snapshot.peakDensity * 0.62).toFixed(2)),
      dwellCharacteristicKo: tr6(
        lang,
        `관람객이 인기 부스에 멈추며 이동(안내 준수율 ${compliancePct}%)하여 양방향 흐름과 교차함`,
        `Visitors browse popular booths (${compliancePct}% compliance), creating bidirectional cross-flow.`,
        `人気ブースへ立ち寄りながら移動（誘導遵守率${compliancePct}%）し対向流と交差します。`,
        `观众受热门展位吸引驻足（引导遵守率 ${compliancePct}%）并与对向人流交会。`,
        `Los visitantes se detienen en stands (${compliancePct}% cumplimiento) con cruce bidireccional.`,
        `Les visiteurs s’arrêtent aux stands (${compliancePct} % de suivi) avec flux croisés.`,
      ),
      citation: tr6(lang, '비최단경로 유인 이동 및 양방향 교행 반영', 'Models booth attraction & bidirectional counter-flow', '非最短経路誘引と双方向交差を反映', '反映展位吸引与双向交会摩擦', 'Modela atracción de stands y flujo doble', 'Modélise l’attraction des stands et le flux croisé'),
    },
    {
      zoneId: 'portal_transition',
      zoneNameKo: z3Name.ko,
      zoneNameEn: z3Name.en,
      modelRepresentationKo: z3Model.ko,
      modelRepresentationEn: z3Model.en,
      assumedSpeedMps: Number((maxGateLoadPct > 95 ? 0.74 : 1.05).toFixed(2)),
      peakDensity: Number(Math.min(5.2, (maxGateLoadPct / 100) * 2.4).toFixed(2)),
      dwellCharacteristicKo: tr6(
        lang,
        '검색대 구조물이 퇴장 유효폭을 좁히거나 외부 주차장·대중교통 정체가 내부로 역류함',
        'Screening posts narrow exit width, and saturated exterior parking/transit spills queues back inside.',
        '検札設備が退場有効幅を狭め、外部駐車場・交通の混雑が場内へ逆流します。',
        '安检结构压缩退场净宽，外部停车场与交通拥堵时会向场内倒灌。',
        'Los controles reducen el ancho útil y la saturación exterior genera reflujo.',
        'Les contrôles réduisent la largeur nette et la saturation extérieure refoule vers le site.',
      ),
      citation: tr6(lang, '게이트 유효폭 축소 및 외부 귀가 역류 반영', 'Accounts for portal width reduction & exterior spillback', 'ゲート有効幅縮小と外部逆流を反映', '计入出口净宽折减与外部交通倒灌', 'Contempla ancho útil y reflujo exterior', 'Intègre largeur utile et refoulement extérieur'),
    },
  ];

  const stewardPosts: SpatialSafetyAudit['stewardPosts'] = [];
  const mainStage = facilities.find((f) => f.category === 'stage');
  if (mainStage) {
    const stName = getFacilityDisplayName(mainStage, lang);
    const loc = koOr6(lang, `${stName} 진입 완충선 앞·뒤`, `Upstream & downstream of ${stName} buffer`, `${stName} 進入緩衝ライン前後`, `${stName} 进入缓冲线前后`, `Antes y después del buffer de ${stName}`, `Amont et aval de la zone tampon ${stName}`);
    const role = koOr6(
      lang,
      assumptions.inflowControlMode === 'holding' ? '대기구역 단계별 유입 제한 가동 중' : '공연 전 동시 진입 시 유입 속도 조절·분산 유도',
      assumptions.inflowControlMode === 'holding' ? 'Phased holding-zone throttling active' : 'Throttle pre-show surge inflow & keep front buffer clear',
      assumptions.inflowControlMode === 'holding' ? '待機ゾーン段階流入制限を稼働中' : '開演前の同時流入時に速度調整・分散誘導',
      assumptions.inflowControlMode === 'holding' ? '等候区分批限流机制运行中' : '开演前集中涌入时调控流速并分流',
      assumptions.inflowControlMode === 'holding' ? 'Control escalonado activo en zona de espera' : 'Regular flujo previo al show y mantener zona libre',
      assumptions.inflowControlMode === 'holding' ? 'Régulation par sas d’attente active' : 'Réguler l’afflux avant spectacle et garder le tampon libre',
    );
    stewardPosts.push({ locationKo: loc.ko, locationEn: loc.en, roleKo: role.ko, roleEn: role.en, facilityId: mainStage.id });
  }
  if (snapshot.bottlenecks[0]) {
    const bFac = facilities.find((f) => f.id === snapshot.bottlenecks[0].facilityId);
    const bName = bFac ? getFacilityDisplayName(bFac, lang) : snapshot.bottlenecks[0].facilityName;
    const loc = koOr6(lang, `${bName} 대기열 끝단 및 주 통로 경계`, `Queue tail boundary at ${bName}`, `${bName} 待機列末端・通路境界`, `${bName} 排队队尾与主通道边界`, `Final de fila en ${bName}`, `Extrémité de file ${bName}`);
    const role = koOr6(lang, '대기줄이 주 통로·비상차로를 막지 않도록 꺾임 유도선 관리', 'Keep static queue tail clear of through-corridor & emergency lane', '待機列が主要通路・緊急車線を塞がないよう折り返し誘導', '引导蛇形排队，防止队尾阻断主干道或应急车道', 'Guiar fila en zigzag sin bloquear pasillo ni vía de emergencia', 'Guider la file en serpentin hors de l’allée et de l’axe secours');
    stewardPosts.push({ locationKo: loc.ko, locationEn: loc.en, roleKo: role.ko, roleEn: role.en, facilityId: snapshot.bottlenecks[0].facilityId });
  }
  if (rawGates[0]) {
    const gName = getFacilityDisplayName(rawGates[0], lang);
    const loc = koOr6(lang, `${gName} 바깥 외부 주차장·교통 분기점`, `Exterior parking & transit split beyond ${gName}`, `${gName} 外側の外部駐車場・交通分岐点`, `${gName} 外侧外部停车场与交通分流点`, `Bifurcación exterior hacia parking tras ${gName}`, `Bifurcation parking/transports au-delà de ${gName}`);
    const role = koOr6(lang, '퇴장 시 펜스 개방 전환 및 교통약자 전용 퇴장로·외부 주차장 분산 유도', 'Open exit lanes and split priority step-free & exterior parking flows', '退場時に柵を開放し、配慮者専用退場路・外部駐車場へ分散誘導', '散场敞开通道，分流无障碍专用退场道与外部停车场客流', 'Abrir carriles de salida y separar ruta accesible y parking exterior', 'Ouvrir les voies de sortie et séparer flux PMR et parkings extérieurs');
    stewardPosts.push({ locationKo: loc.ko, locationEn: loc.en, roleKo: role.ko, roleEn: role.en, facilityId: rawGates[0].id });
  }

  const r1Title = koOr6(lang, '1. 시설 물리적 겹침 및 내·외부 경계 검사', '1. Facility Footprint Collision & Boundary Check', '1. 施設の重複および内外境界チェック', '1. 设施重叠与场馆内外边界检查', '1. Control de Colisión y Límites del Recinto', '1. Vérification des Collisions & Limites du Site');
  const r1Detail =
    overlapMessages.length === 0
      ? koOr6(lang, `배치된 ${facilities.length}개 시설 모두 물리적 충돌·경계 이탈 없이 이격됨`, `All ${facilities.length} facilities satisfy footprint separation and perimeter bounds.`, `配置された全${facilities.length}施設が重複・越境なく適切に離隔`, `已布置的 ${facilities.length} 个设施均满足安全间距与边界要求`, `Las ${facilities.length} instalaciones cumplen separación y límites.`, `Les ${facilities.length} installations respectent l’espacement et les limites.`)
      : koOr6(lang, `점검 필요 (${overlapMessages.length}건): ${overlapMessages.slice(0, 2).join(', ')}`, `Check (${overlapMessages.length}): ${overlapMessages.slice(0, 2).join('; ')}`, `要確認（${overlapMessages.length}件）: ${overlapMessages.slice(0, 2).join('、')}`, `需核查（${overlapMessages.length}项）: ${overlapMessages.slice(0, 2).join('；')}`, `Revisión (${overlapMessages.length}): ${overlapMessages.slice(0, 2).join('; ')}`, `À vérifier (${overlapMessages.length}) : ${overlapMessages.slice(0, 2).join(' ; ')}`);
  const r1Cite = koOr6(lang, '원리: 가설물 충돌·밀착 시 우회 틈새가 사라져 막다른 병목 형성', 'Mechanism: Overlapping structures create dead-end pockets with zero lateral escape.', '原理: 仮設物の接触・密着は迂回余地を奪い袋小路を生みます。', '原理：临时设施重叠紧贴会消除侧向疏散缝隙，形成死角瓶颈。', 'Principio: Estructuras solapadas crean callejones sin escape lateral.', 'Principe : Les structures chevauchées créent des poches sans dégagement.');

  const r2Title = koOr6(lang, '2. 비상 구급차 동선 및 주 통로 차단 검사', '2. Emergency Spine & Main Corridor Clearance', '2. 緊急救急車動線および主要通路クリアランス検査', '2. 应急救护通道与主干道畅通检查', '2. Despeje de Vía de Emergencia y Pasillo Principal', '2. Dégagement de l’Axe Secours & Allée Principale');
  const r2Detail =
    spineObstructions.length > 0
      ? koOr6(lang, `통로 침범: ${spineObstructions.join(', ')}`, `Encroachment: ${spineObstructions.join(', ')}`, `通路干渉: ${spineObstructions.join('、')}`, `通道占用: ${spineObstructions.join('，')}`, `Invasión: ${spineObstructions.join(', ')}`, `Empiètement : ${spineObstructions.join(', ')}`)
      : config.accessibility.wideCorridors
        ? koOr6(lang, '중앙 비상축(x=-7m) 및 5.2m 양방향 보행폭 확보됨', 'Central ambulance spine (x=-7m) and 5.2m bidirectional walkways clear.', '中央非常軸（x=-7m）および5.2m双方向歩行幅を確保', '中央应急通道（x=-7m）及 5.2m 双向步行宽度畅通', 'Eje central (x=-7m) y pasillos de 5.2m despejados.', 'Axe secours (x=-7m) et allées de 5,2 m dégagés.')
        : koOr6(lang, '중앙 비상축 확보, 일반 통로(3.8m) 양방향 피크 시 확장 권장', 'Central spine clear; 3.8m standard corridor may tighten at peak.', '中央軸は確保、3.8m標準通路はピーク時に拡幅推奨', '中央轴畅通，3.8m 标准通道在高峰期建议加宽', 'Eje libre; se recomienda ampliar pasillo de 3.8m en hora punta.', 'Axe libre ; élargissement au-delà de 3,8 m conseillé en pointe.');
  const r2Cite = koOr6(lang, '원리: 고밀도 인파 속 구급 진입 확보를 위해 직선 비상축 비침범 필수', 'Mechanism: Unobstructed straight emergency lanes are vital for stretcher access.', '原理: 高密度時の救急進入には直線非常通路の確保が不可欠です。', '原理：高密人流下须保持直线应急通道零占用以保障担架通行。', 'Principio: Vías rectas despejadas son esenciales para camillas y emergencias.', 'Principe : Un axe droit sans obstacle est indispensable aux secours.');

  const r3Title = koOr6(lang, '3. 정지 대기열과 이동 보행류 교차 검사', '3. Static Queue Tail vs. Moving Flow Check', '3. 静止待機列と歩行流の交差検査', '3. 静态排队与步行流线交叉检查', '3. Control de Filas Estáticas y Flujo Peatonal', '3. Contrôle Files Statiques vs Flux Piéton');
  const r3Detail =
    queueSpills.length === 0
      ? koOr6(lang, '식음·화장실·매표 대기줄이 주 보행통로를 침범하지 않음', 'Vendor and restroom queues stay within buffer aprons.', '飲食・トイレ・案内所の待機列は主要通路に干渉なし', '餐饮、洗手间及票务排队均未侵入主步行通道', 'Las filas se mantienen fuera de los pasillos principales.', 'Les files restent contenues hors des allées principales.')
      : koOr6(lang, queueSpills.slice(0, 2).join(' / '), queueSpills.slice(0, 2).join(' / '), queueSpills.slice(0, 2).join(' ／ '), queueSpills.slice(0, 2).join(' / '), queueSpills.slice(0, 2).join(' / '), queueSpills.slice(0, 2).join(' / '));
  const r3Cite = koOr6(lang, '원리: 부스 앞 대기줄 꼬리가 통로를 침범하면 유효폭 감소 및 교차 압력 발생', 'Mechanism: Queue tails spilling into walkways narrow lanes and cause cross-friction.', '原理: 待機列末端の通路はみ出しは有効幅を削り交差圧力を高めます。', '原理：展位前排队溢出至步道会削减净宽并引发交叉推挤。', 'Principio: Las colas que invaden pasillos reducen el paso y crean fricción.', 'Principe : Les files débordant sur l’allée réduisent la largeur utile.');

  const r4Title = koOr6(lang, '4. 출구별 유효폭 유출량 및 폐쇄 탄력성 검사', '4. Per-Gate Effective Width & Closure Resilience', '4. ゲート別有効幅流出量・閉鎖耐性検査', '4. 出口有效净宽疏散量与关闭韧性检查', '4. Capacidad por Puerta y Resiliencia ante Cierre', '4. Débit par Porte & Résilience en Fermeture');
  const r4Detail = assumptions.closedPrimaryGate
    ? koOr6(lang, `주출입구 1곳 폐쇄 시 잔여 출구 최대 부하 ${maxGateLoadPct}% (퇴장지수 ${nominalOpenSec}초→${currentAssumptionsSec}초)`, `1 primary gate closed: peak load ${maxGateLoadPct}% (${nominalOpenSec}s->${currentAssumptionsSec}s index).`, `主ゲート1閉鎖時: 残余最大負荷 ${maxGateLoadPct}%（指数 ${nominalOpenSec}秒→${currentAssumptionsSec}秒）`, `关闭1处主门时其余出口最高负荷 ${maxGateLoadPct}%（指数 ${nominalOpenSec}秒→${currentAssumptionsSec}秒）`, `Con 1 puerta cerrada: carga pico ${maxGateLoadPct}% (${nominalOpenSec}s->${currentAssumptionsSec}s).`, `1 porte fermée : charge max ${maxGateLoadPct} % (${nominalOpenSec}s->${currentAssumptionsSec}s).`)
    : koOr6(lang, `전체 ${rawGates.length}개 출구 개방 시 최대 부하 ${maxGateLoadPct}% (안내 준수율 ${compliancePct}%)`, `${rawGates.length} open gates: peak load ${maxGateLoadPct}% (${compliancePct}% compliance).`, `全${rawGates.length}ゲート開放時: 最大負荷 ${maxGateLoadPct}%（遵守率 ${compliancePct}%）`, `全部 ${rawGates.length} 个出口开放：最高负荷 ${maxGateLoadPct}%（遵守率 ${compliancePct}%）`, `${rawGates.length} puertas abiertas: carga ${maxGateLoadPct}% (${compliancePct}% guía).`, `${rawGates.length} portes ouvertes : charge ${maxGateLoadPct} % (${compliancePct} % suivi).`);
  const r4Cite = koOr6(lang, '원리: 검색대 구조물 차감 실질 유효폭 기준 산정 및 출구 상실 시 인접 게이트 분산', 'Mechanism: Evaluates net clear width after screening posts and gate loss redundancy.', '原理: 検札設備控除後の実質有効幅と1ゲート閉鎖時の冗長性を評価します。', '原理：按扣除安检台后的净有效宽度核算并检验单门受阻冗余度。', 'Principio: Evalúa el ancho neto real y redundancia si falla un acceso.', 'Principe : Évalue la largeur nette utile et la redondance des portes.');

  const r5Title = koOr6(lang, '5. 공연 전·후 집중 및 병목 요원 배치 검사', '5. Transition Surge & Steward Post Check', '5. 公演前後ピーク集中・誘導要員配置検査', '5. 演出转换高峰与引导岗配置检查', '5. Picos de Transición y Puestos de Personal', '5. Pics de Transition & Postes d’Agents');
  const r5Detail =
    assumptions.inflowControlMode === 'holding'
      ? koOr6(lang, `대기구역 단계별 유입 제한 가동 · 핵심 요원 거점 ${stewardPosts.length}개소 지정`, `Holding-zone phased inflow active across ${stewardPosts.length} steward posts.`, `段階流入制限稼働中・要員拠点 ${stewardPosts.length}か所指定`, `分批等候限流启用 · 已设关键引导岗 ${stewardPosts.length} 处`, `Control escalonado activo en ${stewardPosts.length} puestos clave.`, `Sas d’attente actif sur ${stewardPosts.length} postes d’agents.`)
      : koOr6(lang, `자유 유입 가정 중 (가용 ${areaStats.usableAreaSqm.toLocaleString()}㎡) — 전환 시간대 단계별 유입 비교 권장`, `Free inflow (${areaStats.usableAreaSqm.toLocaleString()}m² usable) — test holding-zone throttling for transitions.`, `自由流入仮定中（有効 ${areaStats.usableAreaSqm.toLocaleString()}㎡）— 転換時の段階流入比較を推奨`, `自由流入假设（净可用 ${areaStats.usableAreaSqm.toLocaleString()}㎡）— 建议对比转换期分段限流`, `Flujo libre (${areaStats.usableAreaSqm.toLocaleString()}m² útiles) — pruebe control escalonado.`, `Flux libre (${areaStats.usableAreaSqm.toLocaleString()} m² utiles) — testez la régulation par sas.`);
  const r5Cite = koOr6(lang, '원리: 공연 직전·직후 연결부 집중 완화를 위해 병목 앞·뒤 유입 조절 필수', 'Mechanism: Upstream/downstream steward throttling prevents transition connector surges.', '原理: 公演前後の接続部集中を抑えるにはボトルネック前後の流速制御が重要です。', '原理：演出前后连接段易短时拥堵，需靠瓶颈前后岗位截流疏导。', 'Principio: El control antes y después del cuello evita picos en transiciones.', 'Principe : La régulation amont/aval évite les engorgements de transition.');

  const r6Title = koOr6(lang, '6. 외부 귀가 연계 용량 (대중교통·외부 주차장) 검사', '6. Exterior Transit & Parking Dispersal Check', '6. 外部帰路連携容量（交通・外部駐車場）検査', '6. 外部疏散衔接能力（公交·外部停车场）检查', '6. Capacidad Exterior de Transporte y Parking', '6. Capacité Transports & Parkings Extérieurs');
  const r6Detail =
    transitLoadPct <= 100
      ? koOr6(lang, `외부 유출 ${peakOutboundPerHour.toLocaleString()}명/시 ≤ 외부 수용량 ${externalCap.toLocaleString()}명/시 (${transitLoadPct}%)`, `Outbound ${peakOutboundPerHour.toLocaleString()}/hr <= exterior capacity ${externalCap.toLocaleString()}/hr (${transitLoadPct}%).`, `外部流出 ${peakOutboundPerHour.toLocaleString()}人/時 ≤ 外部処理量 ${externalCap.toLocaleString()}人/時（${transitLoadPct}%）`, `外流 ${peakOutboundPerHour.toLocaleString()}人/时 ≤ 外部承载 ${externalCap.toLocaleString()}人/时（${transitLoadPct}%）`, `Salida ${peakOutboundPerHour.toLocaleString()}/h <= capacidad exterior ${externalCap.toLocaleString()}/h (${transitLoadPct}%).`, `Sortie ${peakOutboundPerHour.toLocaleString()}/h <= capacité extérieure ${externalCap.toLocaleString()}/h (${transitLoadPct} %).`)
      : koOr6(lang, `외부 병목 주의: 유출 ${peakOutboundPerHour.toLocaleString()}명/시 > 처리량 ${externalCap.toLocaleString()}명/시 (역류 약 ${estimatedSpillbackQueue.toLocaleString()}명)`, `Exterior bottleneck: ${peakOutboundPerHour.toLocaleString()}/hr > ${externalCap.toLocaleString()}/hr (~${estimatedSpillbackQueue.toLocaleString()} spillback).`, `外部ボトルネック: 流出 ${peakOutboundPerHour.toLocaleString()} > 処理 ${externalCap.toLocaleString()}人/時（逆流 約${estimatedSpillbackQueue.toLocaleString()}名）`, `外部瓶颈：外流 ${peakOutboundPerHour.toLocaleString()} > 承载 ${externalCap.toLocaleString()}人/时（倒灌约 ${estimatedSpillbackQueue.toLocaleString()}人）`, `Cuello exterior: ${peakOutboundPerHour.toLocaleString()}/h > ${externalCap.toLocaleString()}/h (~${estimatedSpillbackQueue.toLocaleString()} reflujo).`, `Goulot extérieur : ${peakOutboundPerHour.toLocaleString()}/h > ${externalCap.toLocaleString()}/h (~${estimatedSpillbackQueue.toLocaleString()} retenus).`);
  const r6Cite = koOr6(lang, '원리: 외부 역·주차장 출차 처리량 초과 시 출구 바깥 대기줄이 내부로 역류함', 'Mechanism: Saturated exterior stations and parking lots spill exit queues back into gates.', '原理: 外部駅や外部駐車場の処理量超過はゲート外待機列の場内逆流を招きます。', '原理：外部车站与停车场消化不足会导致门外队伍倒灌回场馆出口。', 'Principio: La saturación de estaciones y parkings exteriores refluye hacia las puertas.', 'Principe : La saturation des gares et parkings extérieurs refoule vers les portes.');

  const ruleChecks: SpatialRuleCheckItem[] = [
    { id: 'collision_bounds', status: overlapMessages.length === 0 ? 'pass' : 'warning', titleKo: r1Title.ko, titleEn: r1Title.en, detailKo: r1Detail.ko, detailEn: r1Detail.en, citationKo: r1Cite.ko, citationEn: r1Cite.en, affectedFacilityIds: Array.from(affectedOverlapIds) },
    { id: 'emergency_corridor', status: spineObstructions.length === 0 && config.accessibility.wideCorridors ? 'pass' : spineObstructions.length > 0 ? 'warning' : 'caution', titleKo: r2Title.ko, titleEn: r2Title.en, detailKo: r2Detail.ko, detailEn: r2Detail.en, citationKo: r2Cite.ko, citationEn: r2Cite.en, affectedFacilityIds: spineIds },
    { id: 'queue_spillover', status: queueSpills.length === 0 ? 'pass' : queueSpills.length >= 2 ? 'warning' : 'caution', titleKo: r3Title.ko, titleEn: r3Title.en, detailKo: r3Detail.ko, detailEn: r3Detail.en, citationKo: r3Cite.ko, citationEn: r3Cite.en, affectedFacilityIds: queueSpillIds },
    { id: 'gate_egress_closure', status: maxGateLoadPct <= 85 ? 'pass' : maxGateLoadPct <= 105 ? 'caution' : 'warning', titleKo: r4Title.ko, titleEn: r4Title.en, detailKo: r4Detail.ko, detailEn: r4Detail.en, citationKo: r4Cite.ko, citationEn: r4Cite.en, affectedFacilityIds: rawGates.map((g) => g.id) },
    { id: 'schedule_connector_surge', status: assumptions.inflowControlMode === 'holding' && rawGates.length >= 3 ? 'pass' : snapshot.peakDensity > 3.0 ? 'warning' : 'caution', titleKo: r5Title.ko, titleEn: r5Title.en, detailKo: r5Detail.ko, detailEn: r5Detail.en, citationKo: r5Cite.ko, citationEn: r5Cite.en, affectedFacilityIds: mainStage ? [mainStage.id] : [] },
    { id: 'external_transit_link', status: transitLoadPct <= 85 ? 'pass' : transitLoadPct <= 105 ? 'caution' : 'warning', titleKo: r6Title.ko, titleEn: r6Title.en, detailKo: r6Detail.ko, detailEn: r6Detail.en, citationKo: r6Cite.ko, citationEn: r6Cite.en, affectedFacilityIds: facilities.filter((f) => f.category === 'parking').map((f) => f.id) },
  ];

  const modeledExitFlowPerMin = gateFlows.reduce((s, g) => s + g.estimatedPeakDemandPerMin, 0);
  const flowMae = Math.abs(modeledExitFlowPerMin - calibration.observedExitFlowPerMin);
  const densityAbsDiff = Number(Math.abs(snapshot.peakDensity - calibration.observedPeakDensity).toFixed(2));
  const calibrationFactor =
    calibration.observedExitFlowPerMin > 0 && modeledExitFlowPerMin > 0
      ? Number((calibration.observedExitFlowPerMin / modeledExitFlowPerMin).toFixed(2))
      : 1.0;

  return {
    verificationStatus,
    occupiedAreaSqm: areaStats.occupiedAreaSqm,
    usableAreaSqm: areaStats.usableAreaSqm,
    referenceDensityPerSqm: areaStats.referenceDensityPerSqm,
    referenceCapacity: areaStats.referenceCapacity,
    ruleChecks,
    gateFlows,
    zoneProfiles,
    stewardPosts,
    externalTransit: {
      peakOutboundPerHour,
      externalCapacityPerHour: externalCap,
      loadRatioPct: transitLoadPct,
      estimatedSpillbackQueue,
      status: transitLoadPct <= 85 ? 'pass' : transitLoadPct <= 105 ? 'caution' : 'warning',
    },
    scenarioEgressComparisonSec: {
      nominalOpenSec,
      currentAssumptionsSec,
    },
    calibrationError: {
      enabled: calibration.enabled,
      modeledExitFlowPerMin,
      observedExitFlowPerMin: calibration.observedExitFlowPerMin,
      flowMae,
      densityAbsDiff,
      calibrationFactor,
    },
  };
}

export function getLocalizedLiteratureRegistry(lang: Language = 'ko'): LiteratureSourceEntry[] {
  return [
    {
      refNo: tr6(lang, '원리 01', 'Principle 01', '原理 01', '原理 01', 'Principio 01', 'Principe 01'),
      level: 'A',
      authorsAndYear: tr6(lang, '밀도 수치의 물리적 의미와 공간별 임계점 분리', 'Physical Crowd Density & Separate Spatial Thresholds', '群衆密度の物理的意味と空間別閾値の分離', '人群密度物理意义与空间分级阈值分离', 'Significado físico de la densidad y umbrales por zona', 'Sens physique de la densité et seuils par espace'),
      title: tr6(lang, '개방 광장·센서 경보·실내 협소 통로 기준을 평균 내지 않고 별도 비교', 'Comparing open plaza, sensor alert, and bounded indoor corridor profiles without averaging', '開放広場・センサー警報・屋内狭小通路を平均せず個別比較', '独立对比开放广场、监测预警与室内窄道基准而不简单平均', 'Comparación separada de plaza abierta, alerta y pasillo interior', 'Comparaison distincte place ouverte, alerte capteur et couloir intérieur'),
      correctionNoteKo: tr6(lang, '3~4명/㎡부터 신체 접촉이 잦아지고 5명/㎡ 이상에서 압력이 급증하나, 공간별 기준을 별도 프로파일로 제공함', 'Body contact rises at 3–4 p/m² and pressure escalates >=5 p/m²; profiles remain distinct.', '3〜4人/㎡で接触が増え5人/㎡以上で圧力が急増するため空間別プロファイルで提供します。', '3~4人/㎡起接触受限、5人/㎡以上压力骤增，按空间类型独立提供参考区间。', 'A 3–4 p/m² sube el contacto y >=5 p/m² la presión; se mantienen perfiles separados.', 'Dès 3–4 p/m² les contacts gênent la marche ; profils maintenus séparément.'),
      appliedModuleKo: tr6(lang, '3종 밀도 참고 프로파일 선택기', '3-Profile Density Selector', '3種密度プロファイル選択器', '3类密度参考方案选择器', 'Selector de 3 perfiles de densidad', 'Sélecteur de 3 profils de densité'),
    },
    {
      refNo: tr6(lang, '원리 02', 'Principle 02', '原理 02', '原理 02', 'Principio 02', 'Principe 02'),
      level: 'A',
      authorsAndYear: tr6(lang, '순수 보행 가용 면적 차감 및 참고 수용량 산정', 'Net Walkable Area Deduction & Reference Capacity', '純歩行可能面積の控除と参考収容算定', '净通行面积扣减与参考承载量核算', 'Deducción de área neta caminable y capacidad', 'Déduction de la surface nette praticable'),
      title: tr6(lang, '내부 무대·부스 점유 면적을 차감한 유효 면적 계산 (외부 주차장은 내부 면적 불차감)', 'Subtracts interior booth/stage footprints while keeping exterior parking outside net hall area', '内部ステージ・ブース面積を控除して計算（外部駐車場は場内面積から控除せず）', '扣除场内舞台展位占地计算净面积（外部停车场不占用场内面积）', 'Descuenta estructuras internas manteniendo el parking exterior fuera del área interior', 'Déduit les structures internes tout en gardant les parkings à l’extérieur'),
      correctionNoteKo: tr6(lang, '순수 가용 면적에 통로 순환 계수를 곱해 과대평가 없는 참고 수용량을 산출함', 'Applies circulation factor to net walkable floor area to avoid capacity overestimation.', '純有効面積に循環係数を掛けて過大評価のない参考収容人数を算出します。', '对净可用面积乘以流通系数，避免高估同时容纳人数。', 'Aplica factor de circulación sobre el área neta para no sobreestimar aforo.', 'Applique un coefficient de circulation sur la surface nette praticable.'),
      appliedModuleKo: tr6(lang, '시설 점유 차감 가용면적(m²) 및 참고 수용량 계산기', 'Net Usable Area & Reference Capacity Calculator', '有効面積(m²)＆参考収容計算機', '净可用面积(m²)与参考容量计算器', 'Calculadora de área útil y capacidad', 'Calculateur de surface utile et capacité'),
    },
    {
      refNo: tr6(lang, '원리 03', 'Principle 03', '原理 03', '原理 03', 'Principio 03', 'Principe 03'),
      level: 'A',
      authorsAndYear: tr6(lang, '정지 대기줄의 통로 침범 방지 및 출구 탄력성 검증', 'Queue Spillover Isolation & Gate Closure Resilience', '待機列の通路干渉防止とゲート閉鎖耐性', '排队溢出隔离与单出口受阻韧性检验', 'Aislamiento de filas y resiliencia ante cierre de puertas', 'Isolation des files d’attente et résilience des portes'),
      title: tr6(lang, '부스 대기열과 이동 보행류 분리 및 주출입구 1곳 폐쇄 시 부하 전이 점검', 'Separates booth queues from active walkways and tests single-gate closure load transfer', 'ブース待機列と歩行流を分離し、1ゲート閉鎖時の負荷転移を検証', '分离展位排队与通行人流，并测试关闭1处主门时的负荷转移', 'Separa filas de pasillos activos y evalúa sobrecarga al cerrar 1 acceso', 'Sépare les files des allées actives et teste le report de charge sur les portes'),
      correctionNoteKo: tr6(lang, '대기줄 꼬리 침범과 검색대 유효폭 축소를 반영하며 근거 없는 사상자 예측은 배제함', 'Models queue tail spillover and screening width reduction without speculative casualty claims.', '待機列のはみ出しと検札有効幅縮小を反映し、根拠のない被害予測は排除します。', '计入队尾溢出与安检净宽折减，严格排除无依据伤亡预测。', 'Modela invasión de colas y ancho neto real sin predicciones especulativas.', 'Modélise le débordement des files et la largeur nette sans extrapolations infondées.'),
      appliedModuleKo: tr6(lang, '대기열 침범 검사 · 출구 유효폭 유출표 · 출구 폐쇄 시험', 'Queue Spill Check · Gate Width Table · Gate Closure Test', '待機列検査・ゲート有効幅表・閉鎖試験', '排队溢出检查 · 出口净宽表 · 关门压力测试', 'Control de filas · Tabla de puertas · Prueba de cierre', 'Contrôle des files · Tableau des portes · Test fermeture'),
    },
    {
      refNo: tr6(lang, '원리 04', 'Principle 04', '原理 04', '原理 04', 'Principio 04', 'Principe 04'),
      level: 'B',
      authorsAndYear: tr6(lang, '교통약자 통합 그룹 전용 완만 퇴장로 및 실측 오차(MAE) 보정', 'Dedicated Priority Step-Free Egress & Field MAE Calibration', '配慮者統合グループ専用退場路と現地実測誤差(MAE)補正', '无障碍关怀群体专用退场通道与现场实测误差(MAE)校准', 'Ruta de salida prioritaria sin escalones y calibración MAE', 'Sortie dédiée sans marche PMR et calibrage terrain MAE'),
      title: tr6(lang, '휠체어·전동보장구·유모차 통합 외곽 퇴장 동선 분리 및 현장 계측 보정', 'Unified wheelchair, scooter & stroller perimeter egress lane + field sensor calibration', '車椅子・電動カート・ベビーカー統合の外周退場動線分離と実測補正', '轮椅·电动代步车·婴儿车统一外围平缓退场分流与实测校准', 'Carril perimetral unificado para silla de ruedas, scooter y carriola + calibración', 'Couloir périphérique unifié fauteuil, scooter et poussette + calibrage réel'),
      correctionNoteKo: tr6(lang, '일반 퇴장 인파와 교차하지 않는 외곽 무장애 경로를 제공하고 실측 유출량과 대조함', 'Provides a non-intersecting step-free perimeter lane and compares against observed gate flow.', '一般退場流と交差しない外周バリアフリー経路を確保し実測値と照合します。', '提供不与普通散场人流交叉的外围无台阶通道，并与实测门禁流量比对。', 'Ofrece ruta perimetral sin escalones sin cruces bruscos y contrasta con aforo medido.', 'Assure un couloir périphérique sans marche hors foule et compare aux mesures terrain.'),
      appliedModuleKo: tr6(lang, '교통약자 통합 색상 표시 · 전용 퇴장 동선 · 실측 보정기', 'Unified Priority Group · Dedicated Egress · Field Calibrator', '配慮者統合表示・専用退場動線・実測補正器', '无障碍统一配色 · 专用退场流线 · 实测校准器', 'Grupo prioritario unificado · Salida dedicada · Calibrador', 'Groupe prioritaire unifié · Sortie dédiée · Calibrateur'),
    },
  ];
}

export const VERIFIED_LITERATURE_REGISTRY: LiteratureSourceEntry[] = getLocalizedLiteratureRegistry('ko');

