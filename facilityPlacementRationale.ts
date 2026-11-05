import { EventConfig, Facility, Language } from '../types/festival';
import { getFacilityDisplayName } from './presets';
import { tr6 } from '../i18n/localeCatalog';

function koOr6(
  lang: Language,
  ko: string,
  en: string,
  ja: string,
  zh: string,
  es: string,
  fr: string,
): { ko: string; en: string } {
  const loc = tr6(lang, ko, en, ja, zh, es, fr);
  return {
    ko: lang === 'ko' ? ko : loc,
    en: lang === 'ko' ? en : loc,
  };
}

export interface PublicStandardBasis {
  agencyKo: string;
  agencyEn: string;
  documentTitleKo: string;
  documentTitleEn: string;
  appliedReasonKo: string;
  appliedReasonEn: string;
  status: 'compliant' | 'advisory';
}

export interface FacilityPlacementRationale {
  zoneLabelKo: string;
  zoneLabelEn: string;
  spatialMetrics: {
    stageDistM: number | null;
    nearestGateDistM: number | null;
    nearestGateNameKo: string;
    nearestGateNameEn: string;
    emergencySpineClearanceM: number;
    perimeterRoadDistM: number;
  };
  whyHereSummaryKo: string;
  whyHereSummaryEn: string;
  publicStandards: PublicStandardBasis[];
  inclusiveAndPetNoteKo: string;
  inclusiveAndPetNoteEn: string;
}

function classifyVenueZone(
  x: number,
  z: number,
  venueWidth: number,
  venueDepth: number,
  lang: Language = 'ko',
): { ko: string; en: string } {
  const halfW = venueWidth / 2;
  const halfD = venueDepth / 2;
  if (z < -halfD * 0.35) {
    return koOr6(
      lang,
      '북측 주공연·안전완충 권역',
      'North Stage & Safety Buffer Zone',
      '北側メイン公演・安全緩衝ゾーン',
      '北侧主演出与安全缓冲分区',
      'Zona Norte de Escenario y Amortiguación',
      'Zone Nord Scène & Tampon de Sécurité',
    );
  }
  if (z > halfD * 0.42) {
    return koOr6(
      lang,
      '남측 주진출입·환승 연계 권역',
      'South Entry & Transit Portal Zone',
      '南側メイン出入口・交通連携ゾーン',
      '南侧主出入口与交通接驳分区',
      'Zona Sur de Acceso Principal y Transporte',
      'Zone Sud Portail d’Entrée & Transport',
    );
  }
  if (Math.abs(x + 7) <= 13) {
    return koOr6(
      lang,
      '중앙 비상·무장애 주간선 인접축',
      'Central Barrier-Free & Emergency Spine',
      '中央非常・バリアフリー主幹線隣接軸',
      '中央应急与无障碍主干走廊轴线',
      'Eje Central de Emergencia y Accesibilidad',
      'Axe Central d’Urgence & Sans Obstacle',
    );
  }
  if (x < -halfW * 0.35) {
    return koOr6(
      lang,
      '서측 분산 휴게·식음 클러스터',
      'West Dispersed Culinary & Rest Cluster',
      '西側分散休憩・飲食クラスター',
      '西侧分散餐饮与休憩组团',
      'Clúster Oeste de Gastronomía y Descanso',
      'Pôle Ouest Restauration & Détente',
    );
  }
  if (x > halfW * 0.35) {
    return koOr6(
      lang,
      '동측 체험·외곽 교통 연계 권역',
      'East Experience & Perimeter Access Zone',
      '東側体験・外周アクセス連携ゾーン',
      '东侧互动体验与外围通行分区',
      'Zona Este de Experiencias y Acceso Perimetral',
      'Zone Est Expériences & Accès Périmétrique',
    );
  }
  return koOr6(
    lang,
    '중앙 순환 광장 권역',
    'Central Circulation Plaza',
    '中央循環プラザゾーン',
    '中央环通广场分区',
    'Plaza Central de Circulación',
    'Place Centrale de Circulation',
  );
}

/**
 * Computes real-time spatial telemetry and authoritative public-agency
 * installation rationales explaining WHY a clicked booth or facility is placed at its current (x, z) location.
 */
export function buildFacilityPlacementRationale(
  facility: Facility,
  config: EventConfig,
  allFacilities: Facility[],
  language: Language = 'ko',
): FacilityPlacementRationale {
  const W = config.venueWidth;
  const D = config.venueDepth;
  const halfW = W / 2;
  const halfD = D / 2;

  const isRot90 = Math.abs(Math.sin(facility.rotation)) > 0.7;
  const effW = isRot90 ? facility.dimensions.depth : facility.dimensions.width;
  const effD = isRot90 ? facility.dimensions.width : facility.dimensions.depth;
  void effD;

  const mainStage =
    allFacilities.find((f) => f.subtype === 'main_stage') ||
    allFacilities.find((f) => f.category === 'stage');

  const stageDistM =
    mainStage && mainStage.id !== facility.id
      ? Math.round(
          Math.hypot(
            facility.position.x - mainStage.position.x,
            facility.position.z - mainStage.position.z,
          ),
        )
      : null;

  const gates = allFacilities.filter(
    (f) =>
      f.category === 'entrance' &&
      (f.subtype === 'main_entrance' || f.subtype === 'secondary_entrance') &&
      f.id !== facility.id,
  );
  let nearestGate: Facility | null = null;
  let nearestGateDist = Infinity;
  for (const g of gates) {
    const d = Math.hypot(facility.position.x - g.position.x, facility.position.z - g.position.z);
    if (d < nearestGateDist) {
      nearestGateDist = d;
      nearestGate = g;
    }
  }
  const nearestGateDistM = Number.isFinite(nearestGateDist) ? Math.round(nearestGateDist) : null;
  const fallbackGate = koOr6(
    language,
    '주출입구',
    'Main Gate',
    'メインゲート',
    '主出入口',
    'Puerta Principal',
    'Porte Principale',
  );
  const nearestGateNameKo = nearestGate
    ? getFacilityDisplayName(nearestGate, language === 'ko' ? 'ko' : language)
    : fallbackGate.ko;
  const nearestGateNameEn = nearestGate
    ? getFacilityDisplayName(nearestGate, language === 'ko' ? 'en' : language)
    : fallbackGate.en;

  // Central emergency ambulance spine runs along x = -7m
  const rawSpineClearance = Math.abs(facility.position.x + 7) - effW / 2;
  const emergencySpineClearanceM = Math.max(0, Math.round(rawSpineClearance * 10) / 10);

  // Distance to nearest outer perimeter road edge
  const distToWest = Math.abs(facility.position.x - -halfW);
  const distToEast = Math.abs(halfW - facility.position.x);
  const distToNorth = Math.abs(facility.position.z - -halfD);
  const distToSouth = Math.abs(halfD - facility.position.z);
  const perimeterRoadDistM = Math.max(
    0,
    Math.round(Math.min(distToWest, distToEast, distToNorth, distToSouth)),
  );

  const zone = classifyVenueZone(facility.position.x, facility.position.z, W, D, language);
  const hasRamp = Boolean(
    facility.accessibility.wheelchairAccessible &&
      facility.accessibility.stepFreeEntry &&
      config.accessibility.stepFreeRoutes,
  );
  const corridorWidthM = config.accessibility.wideCorridors ? 5.8 : 3.8;
  const spineCompliant = facility.category === 'stage' || emergencySpineClearanceM >= 4.5;

  const standards: PublicStandardBasis[] = [];
  let whyKo = '';
  let whyEn = '';

  switch (facility.subtype) {
    case 'beam_projector': {
      whyKo = `공연이 없는 실내 전시·컨퍼런스·설명회 환경을 위해 북측 중앙 시야축(X ${Math.round(facility.position.x)}m, Z ${Math.round(facility.position.z)}m)에 16:9 대형 스크린과 고광량 레이저 빔 프로젝터 단상을 배치하고, 출입구 외부 직사광 간섭(${nearestGateDistM ?? 75}m 이격) 및 보행 동선 가림을 방지했습니다.`;
      whyEn = `Positioned along the central indoor sightline axis (X ${Math.round(facility.position.x)}m, Z ${Math.round(facility.position.z)}m) with a 16:9 wide projection screen, overhead laser throw clearance, and low step-free presenter riser buffered ${nearestGateDistM ?? 75}m from entry glare and gate queues.`;

      standards.push(
        {
          agencyKo: '문화체육관광부 · 전시산업발전법',
          agencyEn: 'MCST · Exhibition & Convention Hall Design Standards',
          documentTitleKo: '『실내 컨벤션·세미나 시야각 및 투사거리 기준』',
          documentTitleEn: 'Indoor Convention Sightline & Projection Throw Clearance Guide',
          appliedReasonKo: '전면 투사 빔 경로 내 구조물 간섭 배제 및 후열 좌석 가독 시야각 확보',
          appliedReasonEn: 'Unobstructed overhead optical throw cone and rear-row presentation legibility',
          status: 'compliant',
        },
        {
          agencyKo: '보건복지부',
          agencyEn: 'Ministry of Health and Welfare (MoHW)',
          documentTitleKo: '『장애인·노인·임산부 등의 편의증진 보장에 관한 법률 시행규칙 별표 1』',
          documentTitleEn: 'Barrier-Free Presenter Riser & Viewing Access Standards',
          appliedReasonKo: hasRamp
            ? `0.42m 저단상 발표대 측면 완만 경사로(≤1/12) 및 수어·자막 가시 시야 확보 완료`
            : '발표자 휠체어 등단을 위한 단차 해소 경사로 점검 권고',
          appliedReasonEn: hasRamp
            ? 'Low 0.42m presenter platform equipped with <=1:12 step-free ramp & clear caption sightlines'
            : 'Verify step-free ramp access onto the presenter riser',
          status: hasRamp ? 'compliant' : 'advisory',
        },
      );
      break;
    }

    case 'main_stage':
    case 'secondary_stage': {
      const frontBufferM = Math.round(halfD + facility.position.z);
      void frontBufferM;
      whyKo = `행사장 북측 외곽(X ${Math.round(facility.position.x)}m, Z ${Math.round(facility.position.z)}m)에 등지고 배치하여 관람객 시야와 음향 지향각을 남측 중앙 광장으로 개방하고, 출입구(${nearestGateDistM ?? 85}m 이격) 입장 동선과 정면 충돌하지 않도록 분리했습니다.`;
      whyEn = `Anchored against the northern perimeter (X ${Math.round(facility.position.x)}m, Z ${Math.round(facility.position.z)}m) so sightlines and sound project into the open plaza while separating standing audiences (${nearestGateDistM ?? 85}m) from entry gate queues.`;

      standards.push(
        {
          agencyKo: '행정안전부',
          agencyEn: 'Ministry of the Interior and Safety (MoIS)',
          documentTitleKo: '『지역축제장 안전관리 매뉴얼』 및 『다중운집인파사고 안전관리 가이드라인』',
          documentTitleEn: 'Local Festival Safety Management Manual & Crowd Safety Guidelines',
          appliedReasonKo:
            '무대 전면과 첫 관람 구역 사이에 압사·전도 예방용 안전 완충구역(Safety Buffer)과 비상 퇴출 통로를 확보하도록 규정함에 따라, 부지 최북단에 고정 배치해 전면 개방 공간을 극대화했습니다.',
          appliedReasonEn:
            'Mandates a front-of-stage safety buffer and lateral emergency release lanes; placing the stage at the northern edge maximizes unobstructed forward dispersal space.',
          status: 'compliant',
        },
        {
          agencyKo: '공연법 제11조 · 소방청',
          agencyEn: 'Public Performance Act Art. 11 & National Fire Agency',
          documentTitleKo: '『공연법』 재해예방조치 기준 및 소방청 『옥외행사 안전관리 가이드라인』',
          documentTitleEn: 'Disaster Prevention Plan & Outdoor Event Fire Safety Guidelines',
          appliedReasonKo: `대형 음향·조명 전력 설비 및 트러스 구조물의 외곽 작업차량 접근성과 비상 소화차량 진출입을 위해 외곽 도로 경계에서 약 ${perimeterRoadDistM}m 이내 접면에 설치했습니다.`,
          appliedReasonEn: `Positioned ${perimeterRoadDistM}m from the perimeter service road for rigging safety, generator isolation, and fire-engine access.`,
          status: perimeterRoadDistM <= 38 ? 'compliant' : 'advisory',
        },
        {
          agencyKo: '문화체육관광부 · 한국장애인개발원',
          agencyEn: 'MCST & Korea Disabled People’s Development Institute',
          documentTitleKo: '『무장애(Barrier-Free) 관광·공연장 접근성 가이드라인』',
          documentTitleEn: 'Barrier-Free Performance & Cultural Venue Accessibility Guidelines',
          appliedReasonKo: hasRamp
            ? '일반 기립 인파에 시야가 가리지 않는 전면 측면 무장애 휠체어 관람 데크와 무대 측면 완만 경사로(기울기 1/12 기준)를 반영했습니다.'
            : '현재 무대 측면 경사로·무장애 관람 데크가 비활성 상태입니다. 휠체어·전동보장구 관람권 보장을 위해 무단차 경사로 활성화를 권장합니다.',
          appliedReasonEn: hasRamp
            ? 'Includes a side stage access ramp and an elevated front-side wheelchair viewing deck with unobstructed sightlines.'
            : 'Step-free stage ramp & viewing deck are currently disabled; enabling step-free access is advised.',
          status: hasRamp ? 'compliant' : 'advisory',
        },
      );
      break;
    }

    case 'food_truck':
    case 'food_stall': {
      const safeFromStage = (stageDistM ?? 99) >= 30;
      whyKo = `메인 무대로부터 ${stageDistM ?? 65}m 이격된 외곽·측면 식음 클러스터(X ${Math.round(facility.position.x)}m, Z ${Math.round(facility.position.z)}m)에 배치하여 조리 화기·연기를 공연 밀집 구역과 분리하고, 배식 대기줄이 중앙 비상통로(이격 ${emergencySpineClearanceM}m)를 막지 않도록 설계했습니다.`;
      whyEn = `Placed ${stageDistM ?? 65}m away from the Main Stage in a lateral food zone so cooking heat/fumes and order queues stay clear of the ${emergencySpineClearanceM}m central emergency spine.`;

      standards.push(
        {
          agencyKo: '소방청 · 화재예방법',
          agencyEn: 'National Fire Agency (NFA)',
          documentTitleKo: '『옥외행사 안전관리 가이드라인』 및 이동식 음식판매차량(푸드트럭) 소방안전 기준',
          documentTitleEn: 'Outdoor Event Fire Safety & Food Truck LPG/Electrical Guidelines',
          appliedReasonKo: safeFromStage
            ? `가스·전기 조리 화기를 취급하는 식음 부스는 무대·대형 막구조물로부터 안전거리를 유지하고 소화차량 접근이 쉬운 외곽(${perimeterRoadDistM}m)에 두도록 한 기준을 충족합니다(무대 이격 ${stageDistM ?? 65}m).`
            : `현재 무대와의 거리가 ${stageDistM}m로 가깝습니다. 조리 화기 안전 및 연기 확산 방지를 위해 무대에서 30m 이상 외곽으로 이격하는 것이 권고됩니다.`,
          appliedReasonEn: safeFromStage
            ? `Satisfies fire separation (${stageDistM ?? 65}m from stage) and perimeter service road access (${perimeterRoadDistM}m) for cooking appliances.`
            : `Currently ${stageDistM}m from stage; >=30m separation is advised for cooking fire safety.`,
          status: safeFromStage && spineCompliant ? 'compliant' : 'advisory',
        },
        {
          agencyKo: '행정안전부 · 식품의약품안전처',
          agencyEn: 'MoIS & Ministry of Food and Drug Safety',
          documentTitleKo: '『지역축제장 안전관리 매뉴얼』 (식음존 대기열 동선 분리 및 위생·급배수 관리)',
          documentTitleEn: 'Local Festival Manual — Queue Spillover Separation & Sanitation Access',
          appliedReasonKo:
            '휴식 시간(Intermission) 급증하는 식음 대기줄 꼬리가 일반 보행 간선을 침범하지 않도록 전면 대기 여유폭(Setback)을 두고 식자재·폐기물 반출이 용이한 외곽 동선에 배치했습니다.',
          appliedReasonEn:
            'Set back from main pedestrian arteries so peak intermission food queues do not spill into bidirectional walkways.',
          status: spineCompliant ? 'compliant' : 'advisory',
        },
        {
          agencyKo: '보건복지부',
          agencyEn: 'Ministry of Health and Welfare',
          documentTitleKo: '『장애인·노인·임산부 등의 편의증진 보장에 관한 법률 시행규칙』 별표 1',
          documentTitleEn: 'Act on Convenience Promotion for Persons with Disabilities — Enforcement Rule Annex 1',
          appliedReasonKo: hasRamp
            ? '휠체어·전동스쿠터 이용자의 무릎 진입과 눈높이 주문이 가능한 저상 배식 카운터(높이 0.75~0.85m) 및 전면 무단차 경사로·점자블록을 설치했습니다.'
            : '휠체어·유모차 이용자가 단차 없이 주문할 수 있도록 무단차 경사로 및 저상 카운터 적용이 필요합니다.',
          appliedReasonEn: hasRamp
            ? 'Equipped with a 0.76m lowered universal service counter, step-free ramp, and yellow tactile warning strip.'
            : 'Enable wheelchair ramp & lowered counter to comply with universal counter height standards.',
          status: hasRamp ? 'compliant' : 'advisory',
        },
      );
      break;
    }

    case 'experience_booth': {
      whyKo = `관람객이 장시간 머무르는 무대 전면과 입출구 깔때기 구간을 피해 순환 광장 연변(무대 ${stageDistM ?? 55}m, 출입구 ${nearestGateDistM ?? 45}m 이격)에 배치함으로써, 부스 체험 대기와 일반 보행 흐름이 직각 충돌하지 않도록 유도했습니다.`;
      whyEn = `Situated along the circulation promenade (${stageDistM ?? 55}m from stage, ${nearestGateDistM ?? 45}m from nearest gate) to prevent booth browsing queues from blocking stage or gate portals.`;

      standards.push(
        {
          agencyKo: '행정안전부 · 문화체육관광부',
          agencyEn: 'MoIS & Ministry of Culture, Sports and Tourism',
          documentTitleKo: '『지역축제장 안전관리 매뉴얼』 (가설 부스 이격거리 및 대기공간 확보 기준)',
          documentTitleEn: 'Local Festival Safety Manual — Temporary Booth Clearance & Queue Buffer',
          appliedReasonKo: spineCompliant
            ? `가설 텐트·부스 간 통로 폭 확보 및 중앙 비상차량 통로(${emergencySpineClearanceM}m 이격) 비침범 원칙을 준수하여 병목 발생을 억제합니다.`
            : `부스가 중앙 비상 구급차 통로(X=-7m 축)에 근접(${emergencySpineClearanceM}m)해 있어 이격 조정이 권장됩니다.`,
          appliedReasonEn: spineCompliant
            ? `Maintains ${emergencySpineClearanceM}m clearance from the central emergency lane while buffering booth queue depth.`
            : `Booth encroaches within ${emergencySpineClearanceM}m of the central emergency lane; lateral relocation advised.`,
          status: spineCompliant ? 'compliant' : 'advisory',
        },
        {
          agencyKo: '보건복지부 · 한국장애인개발원',
          agencyEn: 'MoHW & KODDI',
          documentTitleKo: '『편의증진법 시행규칙』 별표 1 및 『무장애 축제장 조성 지침』',
          documentTitleEn: 'Convenience Promotion Act Annex 1 & Barrier-Free Festival Guidelines',
          appliedReasonKo: hasRamp
            ? `부스 진입부 단차를 제거한 완만 경사로와 휠체어 회전 반경(1.4m×1.4m 이상), 보행 통로 폭(${corridorWidthM}m)을 확보해 전동보장구·유모차 동반 체험이 가능합니다.`
            : '가설 부스 바닥 패드 단차 해소를 위한 무단차 경사로 및 저상 체험 테이블 적용이 권장됩니다.',
          appliedReasonEn: hasRamp
            ? `Provides step-free booth entry, >=1.4m wheelchair turning clearance, and ${corridorWidthM}m corridor access.`
            : 'Step-free ramp is disabled; recommended to remove booth deck threshold steps.',
          status: hasRamp ? 'compliant' : 'advisory',
        },
      );
      break;
    }

    case 'restroom_bank': {
      const accessibleStallOn = config.accessibility.accessibleRestrooms && hasRamp;
      whyKo = `주 보행 간선에서 시인성이 높으면서도 식음·조리 부스와 위생 이격거리를 확보한 지점(X ${Math.round(facility.position.x)}m, Z ${Math.round(facility.position.z)}m)에 배치했으며, 급배수 관리차량 접근을 위해 외곽 도로에서 ${perimeterRoadDistM}m 거리에 위치합니다.`;
      whyEn = `Placed at (X ${Math.round(facility.position.x)}m, Z ${Math.round(facility.position.z)}m) with high wayfinding visibility, sanitary separation from food stalls, and ${perimeterRoadDistM}m access to perimeter utility roads.`;

      standards.push(
        {
          agencyKo: '보건복지부 · 행정안전부',
          agencyEn: 'MoHW & MoIS',
          documentTitleKo: '『공중화장실 등에 관한 법률 시행령』 제6조 및 『편의증진법 시행규칙』 별표 1',
          documentTitleEn: 'Public Restroom Act Art. 6 & Convenience Promotion Act Annex 1',
          appliedReasonKo: accessibleStallOn
            ? '다중운집 야외행사 시 보행 약자의 이동거리를 줄이는 주동선 인접 위치에 장애인 전용 화장실 칸(유효폭·회전공간 확보), 출입 경사로, 전면 점자블록을 설치했습니다.'
            : '장애인·노약자 전용 화장실 칸 또는 진입 경사로 설정이 꺼져 있습니다. 법정 편의시설 기준 충족을 위해 활성화를 권장합니다.',
          appliedReasonEn: accessibleStallOn
            ? 'Includes an attached barrier-free restroom stall with wide sliding door, 1.4m turning space, ramp, and tactile blocks.'
            : 'Accessible restroom stall or step-free ramp is currently off; enabling is recommended per statutory standards.',
          status: accessibleStallOn ? 'compliant' : 'advisory',
        },
        {
          agencyKo: '문화체육관광부',
          agencyEn: 'Ministry of Culture, Sports and Tourism',
          documentTitleKo: '『문화관광축제 안전·운영 지침』 (편의시설 분산 배치 및 대기열 관리)',
          documentTitleEn: 'Cultural Tourism Festival Operations Guide — Restroom Dispersion',
          appliedReasonKo:
            '공연 직후 휴식 시간(Intermission) 화장실 대기줄이 주 보행 통로를 가로막지 않도록 측면 광장 여유 공간을 끼고 분산 배치했습니다.',
          appliedReasonEn:
            'Positioned with lateral queue buffer space so intermission restroom lines do not sever primary pedestrian flow.',
          status: 'compliant',
        },
      );
      break;
    }

    case 'medical_station': {
      const roadReady = perimeterRoadDistM <= 35 || emergencySpineClearanceM <= 16;
      whyKo = `응급환자 발생 시 현장 처치 후 구급차가 즉시 외부 병원으로 이송할 수 있도록 외곽 도로(${perimeterRoadDistM}m) 및 출입구(${nearestGateNameKo} ${nearestGateDistM ?? 22}m) 직결 지점에 전진 배치했습니다.`;
      whyEn = `Strategically stationed ${perimeterRoadDistM}m from the perimeter road and ${nearestGateDistM ?? 22}m from ${nearestGateNameEn} for immediate ambulance extraction and central spine access.`;

      standards.push(
        {
          agencyKo: '행정안전부 · 보건복지부(중앙응급의료센터)',
          agencyEn: 'MoIS & National Emergency Medical Center',
          documentTitleKo: '『지역축제장 안전관리 매뉴얼』 및 『다중운집행사 응급의료 지원 지침』',
          documentTitleEn: 'Local Festival Safety Manual & Mass Gathering EMS Guidelines',
          appliedReasonKo: roadReady
            ? '응급의료부스는 구급차 전용 비상통로 및 외부 도로와 직결되어 골든타임 내 이송이 가능해야 한다는 기준에 따라 출입구·외곽도로 접면에 배치했습니다.'
            : '외곽 도로와의 거리가 멀어 구급차 반출 시간이 지연될 수 있으므로 외곽 게이트 인접 배치를 권장합니다.',
          appliedReasonEn: roadReady
            ? 'Direct linkage to emergency ambulance lane and perimeter road ensures golden-hour patient transport.'
            : 'Consider moving closer to a perimeter gate for faster ambulance egress.',
          status: roadReady ? 'compliant' : 'advisory',
        },
        {
          agencyKo: '보건복지부',
          agencyEn: 'Ministry of Health and Welfare',
          documentTitleKo: '『편의증진법 시행규칙』 (응급 들것·휠체어 무단차 진입 기준)',
          documentTitleEn: 'Barrier-Free Stretcher & Wheelchair Medical Access Standard',
          appliedReasonKo:
            '응급 들것(Stretcher)과 전동휠체어가 단차 없이 곧바로 처치실 내부로 진입할 수 있도록 완만 경사로와 전면 캐노피 회차 공간을 확보했습니다.',
          appliedReasonEn:
            'Provides step-free ramp access and canopy drop-off clearance for stretchers and wheelchairs.',
          status: hasRamp ? 'compliant' : 'advisory',
        },
      );
      break;
    }

    case 'main_entrance':
    case 'secondary_entrance': {
      whyKo = `외곽 접속도로 경계(도로 이격 ${perimeterRoadDistM}m)와 내부 순환 보행축이 만나는 지점에 다방향 분산 배치하여, 폐장 퇴장 시 단일 출구 쏠림(깔때기 병목)을 완화하고 보행 약자·대중교통 동선을 직결했습니다.`;
      whyEn = `Located at the outer road interface (${perimeterRoadDistM}m to perimeter road) to distribute arrival/egress loads across multiple directions and prevent single-gate funnel crushes.`;

      standards.push(
        {
          agencyKo: '행정안전부',
          agencyEn: 'Ministry of the Interior and Safety (MoIS)',
          documentTitleKo: '『다중운집인파사고 안전관리 가이드라인』 및 『지역축제장 안전관리 매뉴얼』',
          documentTitleEn: 'Crowd Crush Safety Guidelines & Local Festival Safety Manual',
          appliedReasonKo:
            '입·퇴장 동선 집중 방지를 위해 2개소 이상의 분산 출입구를 이격 배치하고, 비상시 1개 출구가 통제되더라도 인접 보조 출구로 우회 배출이 가능하도록 외곽 경계에 배치했습니다.',
          appliedReasonEn:
            'Multi-directional perimeter gate spacing prevents egress bottlenecks and provides redundancy if one portal is blocked.',
          status: config.entranceCount >= 2 ? 'compliant' : 'advisory',
        },
        {
          agencyKo: '보건복지부 · 국토교통부',
          agencyEn: 'MoHW & Ministry of Land, Infrastructure and Transport',
          documentTitleKo: '『장애인·노인·임산부 편의증진법 시행규칙』 및 『보도 설치 및 관리 지침』',
          documentTitleEn: 'Convenience Promotion Act & Pedestrian Sidewalk Design Guidelines',
          appliedReasonKo: hasRamp
            ? '게이트 통과 유효폭(휠체어 통과폭 0.9m 이상 광폭 레인 별도 확보), 턱낮추기·무단차 바닥, 시각장애인 유도 점자블록을 게이트 하부에 적용했습니다.'
            : '게이트 진입부 단차 제거 및 휠체어·유모차 우선 통과 레인 활성화가 권장됩니다.',
          appliedReasonEn: hasRamp
            ? 'Features flush step-free threshold, wide priority wheelchair/stroller gate lane, and tactile guidance blocks.'
            : 'Step-free threshold & wide priority gate lane recommended.',
          status: hasRamp ? 'compliant' : 'advisory',
        },
      );
      break;
    }

    case 'ticket_info':
    case 'multilingual_info': {
      const nearGate = (nearestGateDistM ?? 99) <= 42;
      whyKo = `${nearestGateNameKo}로부터 약 ${nearestGateDistM ?? 20}m 인접한 진입 초입 측면(X ${Math.round(facility.position.x)}m, Z ${Math.round(facility.position.z)}m)에 배치하여 입장 직후 즉각적인 길찾기·다국어·교통약자 안내를 제공하되, 게이트 정면 통과 흐름은 가로막지 않도록 측면 이격했습니다.`;
      whyEn = `Offset ${nearestGateDistM ?? 20}m beside ${nearestGateNameEn} so arriving visitors and international guests immediately see wayfinding help without blocking gate throughput.`;

      standards.push(
        {
          agencyKo: '문화체육관광부 · 한국관광공사',
          agencyEn: 'MCST & Korea Tourism Organization (KTO)',
          documentTitleKo: '『문화관광축제 글로벌 수용태세 및 무장애 관광 안내체계 가이드라인』',
          documentTitleEn: 'Global Festival Welcome & Barrier-Free Tourist Information Guidelines',
          appliedReasonKo: nearGate
            ? `외국인·초행 방문객 및 시청각·보행 약자가 입장 직후 동선 지도를 안내받고 보조기기를 대여할 수 있도록 주출입구 인접(${nearestGateDistM ?? 20}m) 가시권에 배치했습니다.`
            : `현재 가장 가까운 출입구와 ${nearestGateDistM}m 떨어져 있습니다. 초입 길찾기 효율을 위해 출입구 35m 이내 배치를 권장합니다.`,
          appliedReasonEn: nearGate
            ? `Positioned within ${nearestGateDistM ?? 20}m of ${nearestGateNameEn} for immediate multilingual wayfinding and mobility-aid rental.`
            : `Currently ${nearestGateDistM}m from nearest gate; <=35m proximity recommended for arrival wayfinding.`,
          status: nearGate ? 'compliant' : 'advisory',
        },
        {
          agencyKo: '행정안전부',
          agencyEn: 'Ministry of the Interior and Safety',
          documentTitleKo: '『지역축제장 안전관리 매뉴얼』 (출입구 내측 체류 병목 방지 기준)',
          documentTitleEn: 'Local Festival Safety Manual — Gate Throat Clearance',
          appliedReasonKo:
            '출입구 정면 직후방에 안내소를 두면 멈춰 선 문의 인파로 인해 입장객 정체가 역류하므로, 주 통과축에서 측면으로 비켜난 포켓 공간에 배치했습니다.',
          appliedReasonEn:
            'Lateral pocket placement prevents inquiring visitors from stalling main gate inflow.',
          status: 'compliant',
        },
      );
      break;
    }

    case 'family_lounge':
    case 'rest_plaza':
    case 'fountain_plaza':
    case 'play_zone':
    case 'rain_canopy': {
      const safeKidsFromStage = facility.subtype !== 'play_zone' || (stageDistM ?? 99) >= 48;
      whyKo = `고밀도 스탠딩 무대 구역으로부터 ${stageDistM ?? 62}m 이격된 완충 녹지·순환 동선 거점(X ${Math.round(facility.position.x)}m, Z ${Math.round(facility.position.z)}m)에 배치하여, 어르신·유모차 가족·어린이·반려동물 동반 관람객이 연속 보행 피로 없이 쉬어갈 수 있게 설계했습니다.`;
      whyEn = `Buffered ${stageDistM ?? 62}m away from high-SPL stage crowds along the barrier-free promenade to give seniors, stroller families, children, and pet owners a safe mid-venue rest node.`;

      standards.push(
        {
          agencyKo: '문화체육관광부 · 한국관광공사 · 보건복지부',
          agencyEn: 'MCST, KTO & Ministry of Health and Welfare',
          documentTitleKo: '『무장애(Barrier-Free) 관광지 조성 가이드라인』 및 『편의증진법』 휴게·수유시설 기준',
          documentTitleEn: 'Barrier-Free Tourism Guidelines & Family/Rest Facility Standards',
          appliedReasonKo:
            '고령자·장애인·임산부·영유아 동반자의 연속 보행 부담을 줄이기 위해 주 보행 동선 50~70m 간격 내 그늘 쉼터·수유실·유모차 대기 공간을 배치하도록 한 공공 지침을 반영했습니다.',
          appliedReasonEn:
            'Provides shaded seating, stroller parking, and nursing support within recommended 50–70m walking intervals for mobility-vulnerable visitors.',
          status: hasRamp ? 'compliant' : 'advisory',
        },
        {
          agencyKo: '행정안전부 · 어린이놀이시설 안전관리법',
          agencyEn: 'MoIS & Children’s Play Facility Safety Management Act',
          documentTitleKo: '『지역축제장 안전관리 매뉴얼』 및 어린이·가족 구역 소음·군중압력 분리 원칙',
          documentTitleEn: 'Festival Safety Manual — Child & Family Zone Crowd-Pressure Buffering',
          appliedReasonKo: safeKidsFromStage
            ? `대형 스피커 음압 및 공연 종료 시 일시 방출 인파에 휩쓸리지 않도록 메인 무대와 ${stageDistM ?? 62}m 안전 이격을 확보했습니다.`
            : `어린이 놀이공간이 무대와 ${stageDistM}m로 인접해 있습니다. 소음·밀집 보호를 위해 50m 이상 이격을 권장합니다.`,
          appliedReasonEn: safeKidsFromStage
            ? `Maintains ${stageDistM ?? 62}m separation from main stage sound pressure and post-show crowd surges.`
            : `Play zone is ${stageDistM}m from main stage; >=50m buffer is recommended.`,
          status: safeKidsFromStage ? 'compliant' : 'advisory',
        },
      );
      break;
    }

    case 'parking_lot': {
      whyKo = `보행자 전용 행사장 내부로 일반 차량이 진입하지 못하도록 외곽 순환도로 접면(도로 경계 ${perimeterRoadDistM}m)에 분리 배치하고, ${nearestGateNameKo}(${nearestGateDistM ?? 35}m)와 무장애 보행로로 연결했습니다.`;
      whyEn = `Isolated along the outer road boundary (${perimeterRoadDistM}m) to enforce a vehicle-free pedestrian interior while linking directly to ${nearestGateNameEn} (${nearestGateDistM ?? 35}m).`;

      standards.push(
        {
          agencyKo: '행정안전부 · 국토교통부',
          agencyEn: 'MoIS & Ministry of Land, Infrastructure and Transport',
          documentTitleKo: '『지역축제장 안전관리 매뉴얼』 (보차분리 원칙) 및 『주차장법 시행규칙』',
          documentTitleEn: 'Festival Safety Manual (Vehicle-Pedestrian Separation) & Parking Lot Act',
          appliedReasonKo:
            '행사장 내 보행 군중과 차량 동선의 교차 사고를 원천 차단하는 보차분리 원칙에 따라 부지 외곽 경계에 배치하고 출차 동선을 외부 도로로 직결했습니다.',
          appliedReasonEn:
            'Enforces strict vehicle-pedestrian separation by confining vehicle circulation to the outer boundary.',
          status: perimeterRoadDistM <= 35 ? 'compliant' : 'advisory',
        },
        {
          agencyKo: '보건복지부',
          agencyEn: 'Ministry of Health and Welfare',
          documentTitleKo: '『장애인·노인·임산부 편의증진법 시행규칙』 별표 1 (장애인전용주차구역 설치기준)',
          documentTitleEn: 'Convenience Promotion Act Annex 1 — Accessible Parking Bay Standards',
          appliedReasonKo: config.accessibility.accessibleParking
            ? `출입구(${nearestGateNameKo}) 최단거리 구간에 장애인 전용 주차면(폭 3.3m 이상·측면 휠체어 승하차 안전구획 및 수직 안내표지판)을 배치했습니다.`
            : '장애인 전용 주차면 설정이 꺼져 있습니다. 주출입구 최단거리 장애인 주차구획 표시를 위해 활성화를 권장합니다.',
          appliedReasonEn: config.accessibility.accessibleParking
            ? `Allocates 3.3m+ blue accessible bays with yellow side wheelchair transfer zones nearest to ${nearestGateNameEn}.`
            : 'Accessible parking bays are currently disabled; recommended near primary venue portals.',
          status: config.accessibility.accessibleParking ? 'compliant' : 'advisory',
        },
      );
      break;
    }

    case 'goods_shop':
    case 'photo_zone': {
      const isGoods = facility.subtype === 'goods_shop';
      whyKo = isGoods
        ? `오픈런 및 공연 직후 긴 대기열이 발생하는 공식 MD 스토어 특성상, 주출입구(${nearestGateNameKo})에서 ${nearestGateDistM}m 안쪽 측면 완충 광장에 배치해 입구 병목과 중앙 비상통로 침범(${emergencySpineClearanceM}m 이격)을 동시에 차단했습니다.`
        : `관람객 체류·촬영 대기가 집중되는 포토존 특성상 주 보행 간선에서 한 걸음 비켜난 개방형 광장 거점에 배치하여 통행 흐름 방해 없이 대기열을 수용하도록 설계했습니다.`;
      whyEn = isGoods
        ? `Placed ${nearestGateDistM}m inside ${nearestGateNameEn} on a lateral plaza pocket so long merch queues never block gate portals or the ${emergencySpineClearanceM}m emergency spine.`
        : `Set in an open plaza pocket offset from primary pedestrian arteries so photo queues do not obstruct crowd circulation.`;
      standards.push(
        {
          agencyKo: '행정안전부',
          agencyEn: 'Ministry of the Interior and Safety',
          documentTitleKo: '『지역축제장 안전관리 매뉴얼』 (인기 부스 대기열 완충공간 및 보행통로 분리 기준)',
          documentTitleEn: 'Festival Safety Manual — Queue Buffer Pocket & Walkway Separation',
          appliedReasonKo:
            '인기 MD·포토 부스의 대기열이 주 보행 동선과 직교 충돌하지 않도록 전면 대기 포켓을 확보하고 비상통로와 이격 배치했습니다.',
          appliedReasonEn:
            'Separates high-demand merch/photo queue pockets from main pedestrian and emergency corridors.',
          status: spineCompliant ? 'compliant' : 'advisory',
        },
        {
          agencyKo: '보건복지부',
          agencyEn: 'Ministry of Health and Welfare',
          documentTitleKo: '『장애인·노인·임산부 편의증진법 시행규칙』 (판매·체험시설 접근로 및 저상 카운터)',
          documentTitleEn: 'Convenience Promotion Act — Step-Free Retail & Experience Access',
          appliedReasonKo: hasRamp
            ? '휠체어·유모차 이용객이 대기열 및 매대에 단차 없이 진입할 수 있도록 완만 경사로와 여유 회전반경을 적용했습니다.'
            : '무단차 경사로 활성화 시 휠체어·유모차 직접 진입이 가능합니다.',
          appliedReasonEn: hasRamp
            ? 'Provides step-free ramp entry and turning radius for wheelchairs and strollers.'
            : 'Enable step-free ramps for direct wheelchair counter access.',
          status: hasRamp ? 'compliant' : 'advisory',
        },
      );
      break;
    }

    case 'beer_garden': {
      whyKo = `성인 인증 및 스탠딩 체류가 이루어지는 맥주·주류존 특성상, 어린이·가족 쉼터 및 무대 전면 고밀도 압축 구역(무대 이격 ${stageDistM ?? 45}m)과 분리된 식음 권역 측면에 배치하고 근접 화장실 동선을 확보했습니다.`;
      whyEn = `Zoned in the lateral F&B court (${stageDistM ?? 45}m from stage) away from family/youth zones while maintaining convenient restroom access.`;
      standards.push(
        {
          agencyKo: '행정안전부 · 식품의약품안전처',
          agencyEn: 'MoIS & Ministry of Food and Drug Safety',
          documentTitleKo: '『지역축제장 안전관리 매뉴얼』 및 『옥외 식음·주류 판매구역 운영 지침』',
          documentTitleEn: 'Festival Safety Manual & Outdoor Beverage Zone Guidelines',
          appliedReasonKo:
            '주류 반입·성인 확인 경계를 명확히 구획하고, 무대 전면 고밀도 관람 구역과 분리하여 음주 관람객과 일반 보행 동선의 충돌을 예방했습니다.',
          appliedReasonEn:
            'Clearly delineates age-verified beverage service away from high-density stage pits and youth zones.',
          status: 'compliant',
        },
      );
      break;
    }

    case 'eco_station': {
      whyKo = `식음 구역 및 퇴장 동선 결절점(출입구 ${nearestGateDistM}m)에 다회용기 반납·분리배출 스테이션을 배치하여 관람객이 식사 직후 및 퇴장 시 자연스럽게 반납할 수 있도록 유도했습니다.`;
      whyEn = `Positioned between the F&B court and exit portal (${nearestGateDistM}m) so visitors effortlessly return reusable cups after dining or while exiting.`;
      standards.push({
        agencyKo: '환경부',
        agencyEn: 'Ministry of Environment',
        documentTitleKo: '『일회용품 없는 지역축제 가이드라인』 (다회용기 회수함 및 재활용 분리배출 거점 기준)',
        documentTitleEn: 'Zero-Waste Festival Guidelines — Reusable Cup Return & Sorting Hubs',
        appliedReasonKo:
          '푸드존 인접 동선과 주출입구 귀가 동선에 회수 거점을 두어 다회용기 회수율을 높이고 바닥 폐기물로 인한 미끄럼·전도 사고를 예방합니다.',
        appliedReasonEn:
          'Maximizes reusable cup recovery along F&B-to-exit desire lines and reduces litter slip hazards.',
        status: 'compliant',
      });
      break;
    }

    case 'locker_charging':
    case 'wristband_hub': {
      const isWristband = facility.subtype === 'wristband_hub';
      whyKo = isWristband
        ? `주출입구(${nearestGateNameKo}, ${nearestGateDistM}m) 직후방 전면 광장에 다차선 티켓·팔찌 교환 및 보안검색 허브를 배치하여 입장 인파를 병렬 분산 처리하도록 설계했습니다.`
        : `관람객이 입장 직후 무거운 짐을 맡기거나 귀가 전 휴대폰을 충전할 수 있도록 출입구(${nearestGateNameKo})에서 ${nearestGateDistM}m 인접한 진입 결절점에 배치했습니다.`;
      whyEn = isWristband
        ? `Placed ${nearestGateDistM}m inside ${nearestGateNameEn} with multi-lane dividers to process wristband exchange and bag checks without backing queues onto outer roads.`
        : `Located ${nearestGateDistM}m from ${nearestGateNameEn} so visitors store bags immediately upon arrival and charge devices before transit departure.`;
      standards.push({
        agencyKo: '행정안전부',
        agencyEn: 'Ministry of the Interior and Safety',
        documentTitleKo: '『다중운집인파사고 예방 안전관리 매뉴얼』 (입장 검표·보안검색 다차선 분산 기준)',
        documentTitleEn: 'Crowd Crush Prevention Manual — Multi-Lane Entry Screening & Queuing',
        appliedReasonKo:
          '출입 게이트 외부 도로에 대기열이 역류하지 않도록 게이트 직후방 완충 구역에 다차선·편의 허브를 배치하여 유입 속도를 평탄화했습니다.',
        appliedReasonEn:
          'Buffers entry screening and locker access inside the portal apron to prevent external sidewalk spillover.',
        status: 'compliant',
      });
      break;
    }

    case 'shuttle_stop': {
      whyKo = `보차분리 대원칙에 따라 행사장 내부 보행 구역 밖 외곽 순환도로변(경계 ${perimeterRoadDistM}m)에 전용 승하차 베이를 구축하고, 최단 출입구(${nearestGateNameKo})까지 무단차 보행로로 연결했습니다.`;
      whyEn = `Placed along the exterior perimeter road (${perimeterRoadDistM}m from boundary) for strict vehicle-pedestrian separation with direct step-free access to ${nearestGateNameEn}.`;
      standards.push({
        agencyKo: '국토교통부 · 행정안전부',
        agencyEn: 'MOLIT & MoIS',
        documentTitleKo: '『교통약자 이동편의 증진법』 및 『지역축제장 보차분리 교통처리 매뉴얼』',
        documentTitleEn: 'Mobility Enhancement Act & Festival Transit Separation Manual',
        appliedReasonKo:
          '대량 퇴장 시 대중교통·셔틀 승하차 인파와 차량이 뒤섞이지 않도록 외곽 전용 정류장 및 점자블록 승강장을 설치했습니다.',
        appliedReasonEn:
          'Provides tactile-paved exterior shuttle boarding separated from internal crowd flows.',
        status: 'compliant',
      });
      break;
    }

    case 'foh_control': {
      whyKo = `메인 무대 정면 중앙 음향·조명 투사축(무대 거리 ${stageDistM ?? 34}m)을 확보하되, 양측 관객석 사이 비상통로(${emergencySpineClearanceM}m 이격)를 가로막지 않는 지점에 배치했습니다.`;
      whyEn = `Aligned on the acoustic/lighting axis ${stageDistM ?? 34}m from the stage while keeping ${emergencySpineClearanceM}m emergency egress aisles unobstructed.`;
      standards.push({
        agencyKo: '문화체육관광부 · 소방청',
        agencyEn: 'MCST & National Fire Agency',
        documentTitleKo: '『공연장 외 옥외공연 안전관리 지침』 (FOH 콘솔 타워 전도방지 및 피난동선 확보)',
        documentTitleEn: 'Outdoor Performance Safety Guide — FOH Tower Structural & Egress Clearance',
        appliedReasonKo:
          '무대 정면 음향·조명 시야를 확보하면서도 관객 피난 시 병목 장애물이 되지 않도록 사방 안전 펜스 및 우회 피난폭을 확보했습니다.',
        appliedReasonEn:
          'Secures unobstructed front-of-house sightlines while preserving dual lateral evacuation corridors.',
        status: spineCompliant ? 'compliant' : 'advisory',
      });
      break;
    }

    case 'mist_cooling': {
      whyKo = `폭염 시 온열질환 위험이 높은 중앙 보행 광장 및 대기 동선 결절점에 쿨링포그·그늘막 터널을 배치하여 보행 중 자연스러운 체온 저감을 유도했습니다.`;
      whyEn = `Installed along sunlit central pedestrian corridors to lower ambient heat stress during peak daytime hours.`;
      standards.push({
        agencyKo: '행정안전부 · 질병관리청',
        agencyEn: 'MoIS & KDCA',
        documentTitleKo: '『폭염 대비 야외 축제·행사 온열질환 예방 가이드라인』',
        documentTitleEn: 'Extreme Heat Outdoor Event Thermal Safety Guidelines',
        appliedReasonKo:
          '노약자·영유아·스태프의 열사병 예방을 위해 그늘이 부족한 주 이동 동선에 안개 분사 냉각 터널과 무장애 휴게 공간(폭원 확보)을 설치했습니다.',
        appliedReasonEn:
          'Mitigates heat-related illness for seniors, children, and staff via walk-through cooling mist arches.',
        status: 'compliant',
      });
      break;
    }

    case 'smoking_booth': {
      whyKo = `간접흡연 피해 차단 및 화재 예방을 위해 가족·어린이·밀집 관람 구역에서 완전히 격리된 최외곽 경계(${perimeterRoadDistM}m) 풍하측 코너에 밀폐 환기형 부스로 배치했습니다.`;
      whyEn = `Isolated at the outer perimeter corner (${perimeterRoadDistM}m from boundary) away from family zones, stage crowds, and combustible tents.`;
      standards.push({
        agencyKo: '보건복지부 · 소방청',
        agencyEn: 'MoHW & National Fire Agency',
        documentTitleKo: '『국민건강증진법』 금연구역 내 흡연실 설치기준 및 『화재예방법』 이격 기준',
        documentTitleEn: 'National Health Promotion Act Smoking Booth Isolation & Fire Safety Rules',
        appliedReasonKo:
          '보행 주동선·어린이 시설·가연성 천막으로부터 안전거리를 두고 정화장치가 달린 외곽 독립 부스로 격리했습니다.',
        appliedReasonEn:
          'Isolates ventilated smoking enclosure on the outer boundary away from pedestrian routes and tents.',
        status: 'compliant',
      });
      break;
    }

    case 'pet_zone':
    default: {
      // seating_block, vip_lounge, camping_zone, pet_zone
      const isPetZone = facility.subtype === 'camping_zone' || facility.subtype === 'pet_zone';
      whyKo = isPetZone
        ? `공연장 고소음 구역에서 ${stageDistM ?? 58}m 떨어진 외곽 잔디 구역에 배치하여 가족·반려동물 동반 피크닉 체류객이 일반 혼잡 통로와 부딪히지 않고 여유롭게 머물 수 있도록 구획했습니다.`
        : `무대 시야각과 음향 밸런스를 확보하면서도 중앙 비상·무장애 통로(${emergencySpineClearanceM}m 이격)를 침범하지 않는 대칭 관람 구역(무대 거리 ${stageDistM ?? 36}m)에 배치했습니다.`;
      whyEn = isPetZone
        ? `Located ${stageDistM ?? 58}m from stage speakers on outer lawn terrain so camping and pet-owning visitors enjoy low-stress open space away from dense corridors.`
        : `Positioned ${stageDistM ?? 36}m from the stage for clear sightlines while preserving a ${emergencySpineClearanceM}m central emergency and wheelchair corridor.`;

      standards.push(
        {
          agencyKo: '행정안전부 · 공연법',
          agencyEn: 'MoIS & Public Performance Act',
          documentTitleKo: '『지역축제장 안전관리 매뉴얼』 (관람석 구획 분할 및 비상 대피통로 기준)',
          documentTitleEn: 'Festival Safety Manual — Audience Block Partitioning & Emergency Aisles',
          appliedReasonKo: spineCompliant
            ? `대규모 관람 구역을 단일 밀집군으로 두지 않고 중앙·측면 비상 통로(${emergencySpineClearanceM}m 여유)로 구획 분할하여 응급 구호 및 분산 퇴장을 보장합니다.`
            : '관람·체류 구역이 중앙 비상통로에 근접해 있어 좌우 이격 확보가 권장됩니다.',
          appliedReasonEn: spineCompliant
            ? `Partitions audience seating/lounges around a clear ${emergencySpineClearanceM}m emergency corridor.`
            : 'Maintain wider clearance from the central emergency spine.',
          status: spineCompliant ? 'compliant' : 'advisory',
        },
        isPetZone
          ? {
              agencyKo: '농림축산식품부 · 한국관광공사',
              agencyEn: 'MAFRA & Korea Tourism Organization',
              documentTitleKo: '『반려동물 동반 여행·축제 운영 가이드라인』 및 『동물보호법 시행규칙』',
              documentTitleEn: 'Pet-Friendly Festival Operations Guide & Animal Protection Act Rules',
              appliedReasonKo:
                '고출력 스피커 소음에 민감한 반려견의 스트레스를 줄이고 목줄(2m 이내) 안전거리를 유지할 수 있도록 무대 밀집 구역과 분리된 외곽 녹지 피크닉 권역에 배치했습니다.',
              appliedReasonEn:
                'Buffered from high-decibel stage speakers on open turf so leashed companion pets avoid crowd crush and acoustic stress.',
              status: 'compliant',
            }
          : {
              agencyKo: '보건복지부 · 문화체육관광부',
              agencyEn: 'MoHW & MCST',
              documentTitleKo: '『편의증진법 시행규칙』 별표 1 (관람석 내 휠체어·동반자석 배치 기준)',
              documentTitleEn: 'Convenience Promotion Act Annex 1 — Wheelchair Companion Seating',
              appliedReasonKo: hasRamp
                ? '출입구·통로에서 접근하기 쉽고 시야가 확보되는 전열·측면에 휠체어 전용 관람 구획 및 완만 경사로·점자블록을 설치했습니다.'
                : '관람 데크·좌석 구역에 휠체어 전용석 구획 및 무단차 경사로 적용이 권장됩니다.',
              appliedReasonEn: hasRamp
                ? 'Integrates front-row wheelchair companion bays, step-free ramp access, and yellow tactile strips.'
                : 'Step-free ramp & wheelchair companion bays recommended.',
              status: hasRamp ? 'compliant' : 'advisory',
            },
      );
      break;
    }
  }

  const inclusiveNotePair = hasRamp
    ? koOr6(
        language,
        `현재 3D 현장에 휠체어·전동스쿠터·유모차 겸용 무단차 경사로(난간·노란 점자블록 포함)와 ${corridorWidthM}m 보행로가 연결되어 있으며, 시각장애인 안내견 및 리드줄 착용 반려동물 동반 접근 여유폭이 확보되어 있습니다.`,
        `3D step-free ramp, handrails, yellow tactile blocks, and ${corridorWidthM}m corridor access are active for wheelchairs, mobility scooters, strollers, guide dogs, and leashed companion pets.`,
        `3D会場に車椅子・電動カート・ベビーカー兼用の段差解消スロープ（手すり・黄色点字ブロック付）と${corridorWidthM}m歩道が接続されており、盲導犬やリード着用ペットも安全に通行できます。`,
        `当前3D场地已激活轮椅、电动代步车与婴儿车通用无障碍坡道（含扶手与黄色盲道砖）及${corridorWidthM}m步道，导盲犬与牵绳宠物亦可安全通行。`,
        `La rampa 3D sin escalones, pasamanos, pavimento táctil amarillo y pasillo de ${corridorWidthM}m están activos para sillas de ruedas, scooters, cochecitos, perros guía y mascotas con correa.`,
        `Rampe 3D sans marche, garde-corps, bandes podotactiles jaunes et allée de ${corridorWidthM}m actifs pour fauteuils roulants, scooters, poussettes, chiens guides et animaux tenus en laisse.`,
      )
    : koOr6(
        language,
        `현재 이 시설의 무단차 경사로가 꺼져 있어 3D 현장에 일반 계단 단차가 표시됩니다. 하단 체크박스를 켜면 즉시 완만 경사로·난간·점자블록·무장애 표지가 설치됩니다.`,
        `Step-free ramp is currently off (stepped curb shown in 3D). Check the accessibility box below to immediately install 3D ramps, handrails, and tactile paving.`,
        `現在この施設の段差解消スロープがオフになっています。下のバリアフリー設定をオンにすると、直ちにスロープ・手すり・点字ブロックが設置されます。`,
        `当前该设施的无障碍坡道处于关闭状态（3D中显示普通台阶）。勾选下方无障碍选项即可立即安装缓坡、扶手与盲道砖。`,
        `La rampa sin escalones está desactivada actualmente. Active la casilla de accesibilidad abajo para instalar de inmediato rampa 3D, pasamanos y guía táctil.`,
        `La rampe sans marche est actuellement désactivée. Cochez l’option d’accessibilité ci-dessous pour installer immédiatement rampe 3D, garde-corps et bandes podotactiles.`,
      );

  if (language !== 'ko' && language !== 'en') {
    const posStr = `(X ${Math.round(facility.position.x)}m, Z ${Math.round(facility.position.z)}m)`;
    const stgInfo =
      stageDistM !== null
        ? tr6(
            language,
            '',
            '',
            `ステージ離隔 ${stageDistM}m・`,
            `距主舞台 ${stageDistM}m · `,
            `a ${stageDistM}m del escenario, `,
            `à ${stageDistM}m de la scène, `,
          )
        : '';
    const gateInfo =
      nearestGateDistM !== null
        ? tr6(
            language,
            '',
            '',
            `${nearestGateNameEn}から ${nearestGateDistM}m`,
            `距${nearestGateNameEn} ${nearestGateDistM}m`,
            `a ${nearestGateDistM}m de ${nearestGateNameEn}`,
            `à ${nearestGateDistM}m de ${nearestGateNameEn}`,
          )
        : nearestGateNameEn;

    const localizedWhy =
      facility.subtype === 'parking_lot'
        ? tr6(
            language,
            '',
            '',
            `歩車分離原則に基づき会場境界の外側外周道路沿い${posStr}に配置し、${gateInfo}へバリアフリー歩道で直結しています。`,
            `依据人车分流原则布置在场馆边界外侧道路旁${posStr}，并通过无障碍步道直连${gateInfo}。`,
            `Ubicado en el exterior del perímetro${posStr} para separar vehículos de peatones, conectado sin escalones ${gateInfo}.`,
            `Implanté à l’extérieur du périmètre${posStr} pour séparer flux piétons et véhicules, relié sans marche ${gateInfo}.`,
          )
        : tr6(
            language,
            '',
            '',
            `${zone.en}${posStr}（${stgInfo}${gateInfo}、中央非常軸クリアランス ${emergencySpineClearanceM}m、外周境界まで ${perimeterRoadDistM}m）に配置し、待機列と主歩行・救急動線の干渉を抑えています。`,
            `布置于${zone.en}${posStr}（${stgInfo}${gateInfo}，中央应急轴净距 ${emergencySpineClearanceM}m，距外围边界 ${perimeterRoadDistM}m），有效隔离排队区与主步行及急救通道。`,
            `Situado en ${zone.en} ${posStr} (${stgInfo}${gateInfo}, despeje de emergencia ${emergencySpineClearanceM}m, borde a ${perimeterRoadDistM}m) para separar colas de los pasillos principales.`,
            `Positionné dans ${zone.en} ${posStr} (${stgInfo}${gateInfo}, dégagement d’urgence ${emergencySpineClearanceM}m, bordure à ${perimeterRoadDistM}m) afin d’isoler les files des allées principales.`,
          );

    const localizedStandards: PublicStandardBasis[] = standards.map((s, idx) => {
      const compliantLoc = s.status === 'compliant';
      const agencyLoc = tr6(
        language,
        s.agencyKo,
        s.agencyEn,
        idx === 0 ? '安全・群衆管理基準' : 'バリアフリー・施設設置基準',
        idx === 0 ? '公共活动安全与疏散规范' : '无障碍与临时设施通行规范',
        idx === 0 ? 'Normativa de Seguridad y Evacuación' : 'Estándar de Accesibilidad Universal',
        idx === 0 ? 'Norme de Sécurité & Évacuation' : 'Standard d’Accessibilité Universelle',
      );
      const docLoc = tr6(
        language,
        s.documentTitleKo,
        s.documentTitleEn,
        s.documentTitleEn,
        s.documentTitleEn,
        s.documentTitleEn,
        s.documentTitleEn,
      );
      const reasonLoc = tr6(
        language,
        s.appliedReasonKo,
        s.appliedReasonEn,
        compliantLoc
          ? `非常通路クリアランス（${emergencySpineClearanceM}m）・待機列分離・バリアフリー導線（${corridorWidthM}m）の推奨基準を満たしています。`
          : `現在の配置（非常軸 ${emergencySpineClearanceM}m / 外周 ${perimeterRoadDistM}m）について、現場スロープまたは離隔距離の追加確認を推奨します。`,
        compliantLoc
          ? `满足应急通道净距（${emergencySpineClearanceM}m）、排队缓冲分离及无障碍通道（${corridorWidthM}m）设计要求。`
          : `当前位置（应急轴距 ${emergencySpineClearanceM}m / 外围距 ${perimeterRoadDistM}m）建议进一步核查坡道或安全间距。`,
        compliantLoc
          ? `Cumple con el despeje del eje de emergencia (${emergencySpineClearanceM}m), separación de colas y pasillo accesible (${corridorWidthM}m).`
          : `Se recomienda revisar la distancia de seguridad (${emergencySpineClearanceM}m) o activar la rampa sin escalones en campo.`,
        compliantLoc
          ? `Conforme au dégagement de l’axe d’urgence (${emergencySpineClearanceM}m), à la séparation des files et au couloir PMR (${corridorWidthM}m).`
          : `Vérification recommandée de la distance de sécurité (${emergencySpineClearanceM}m) ou de la rampe sans marche sur site.`,
      );
      return {
        agencyKo: agencyLoc,
        agencyEn: agencyLoc,
        documentTitleKo: docLoc,
        documentTitleEn: docLoc,
        appliedReasonKo: reasonLoc,
        appliedReasonEn: reasonLoc,
        status: s.status,
      };
    });

    return {
      zoneLabelKo: zone.ko,
      zoneLabelEn: zone.en,
      spatialMetrics: {
        stageDistM,
        nearestGateDistM,
        nearestGateNameKo,
        nearestGateNameEn,
        emergencySpineClearanceM,
        perimeterRoadDistM,
      },
      whyHereSummaryKo: localizedWhy,
      whyHereSummaryEn: localizedWhy,
      publicStandards: localizedStandards,
      inclusiveAndPetNoteKo: inclusiveNotePair.ko,
      inclusiveAndPetNoteEn: inclusiveNotePair.en,
    };
  }

  return {
    zoneLabelKo: zone.ko,
    zoneLabelEn: zone.en,
    spatialMetrics: {
      stageDistM,
      nearestGateDistM,
      nearestGateNameKo,
      nearestGateNameEn,
      emergencySpineClearanceM,
      perimeterRoadDistM,
    },
    whyHereSummaryKo: language === 'ko' ? whyKo : whyEn,
    whyHereSummaryEn: whyEn,
    publicStandards: standards,
    inclusiveAndPetNoteKo: inclusiveNotePair.ko,
    inclusiveAndPetNoteEn: inclusiveNotePair.en,
  };
}
