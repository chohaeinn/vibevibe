import {
  DataReliabilityLabel,
  DesignConfidenceVerdict,
  EightDomainVerificationItem,
  EventConfig,
  Facility,
  FacilityAssetMetadata,
  FacilitySubtype,
  FieldCalibrationSample,
  Language,
  LayoutMetricsSummary,
  SimulationSnapshot,
  SpatialZoneTarget,
  SpatialSafetyAudit,
  StatutorySafetyChecklistState,
  WeatherScenarioId,
} from '../types/festival';
import { formatCurrency, getFacilityDisplayName, KRW_PER_USD } from './presets';
import { SUBTYPE_BLUEPRINTS } from './layoutGenerator';
import { SUBTYPE_SIMPLE_LABELS } from '../i18n/translations';
import {
  pickL6,
  RELIABILITY_BADGE_I18N,
  tr6,
  WEATHER_SCENARIO_I18N,
  ZONE_TARGET_I18N,
} from '../i18n/localeCatalog';

export interface ExtendedCatalogFacilitySpec {
  subtype: FacilitySubtype;
  defaultZone: SpatialZoneTarget;
  powerKw: number;
  waterRequired: boolean;
  networkRequired: boolean;
  lightingLuxMin: number;
  staffRequired: number;
  roleKo: string;
  roleEn: string;
  legalBasisKo: string;
}

export interface ExtendedCatalogCategory {
  id: 'barrier_free' | 'rest_care' | 'safety_rescue' | 'traffic_access' | 'culture_exhibit' | 'ops_control';
  titleKo: string;
  titleEn: string;
  summaryKo: string;
  items: ExtendedCatalogFacilitySpec[];
}

export const DB_SIX_IMPROVEMENT_PILLARS = [
  {
    id: 'cat-expand',
    problemKo: '시설물 종류 제한적 (기존 11종 시트 위주)',
    reasonKo: '11종만으로는 무장애·안전·문화·통제·비공연 실내발표 등 다양한 행사를 표현하기 어려움',
    solutionKo: '6대 신규 카테고리 19종 확장 완료 (빔 프로젝터 포함 총 43종 표준 시설 카탈로그 구축)',
  },
  {
    id: 'spec-version',
    problemKo: '규격 데이터의 신뢰성 편차',
    reasonKo: '실제 제조사·제품별 텐트·트러스·컨테이너 규격이 상이함',
    solutionKo: '자산별 공공표준·제조사 출처(sourceStd) 및 버전(v2026.2) 명시 관리',
  },
  {
    id: 'law-condition-status',
    problemKo: '법령 검토의 복잡성',
    reasonKo: '행사 규모(1,000명)·수변/산지·화기/가스 조건에 따라 적용 여부가 달라짐',
    solutionKo: '법령 적용 조건 자동 판별과 4단계 이행 검토 상태(협의·서류·합동점검) 분리',
  },
  {
    id: 'rag-rule-link',
    problemKo: '단순 문서 검색(RAG)의 한계',
    reasonKo: '법령·매뉴얼 문서를 검색한다고 자동으로 안전한 배치가 보장되지 않음',
    solutionKo: 'RAG 조문 근거를 실시간 수치 검증 규칙 엔진(유효폭·이격·밀도 산식)에 직결',
  },
  {
    id: '3d-db-sync',
    problemKo: '3D 모델과 DB 치수 불일치 우려',
    reasonKo: '화면의 3D 메쉬 크기와 DB 표기 규격이 따로 관리되면 오차 발생',
    solutionKo: '단일 규격 원본(SUBTYPE_BLUEPRINTS)으로 3D 모델과 DB 제원 1:1 자동 일치 생성',
  },
  {
    id: 'ops-scenario',
    problemKo: '운영 조건 부족',
    reasonKo: '전력·급배수 외에도 통신망·야간조도·소음이격·악천후 역할이 필수적임',
    solutionKo: '유무선 통신망, 최소 조도(lux), 소음 이격, 비상 역할 및 악천후 시나리오 확장',
  },
];

export const EXTENDED_CATALOG_CATEGORIES: ExtendedCatalogCategory[] = [
  {
    id: 'barrier_free',
    titleKo: '무장애 시설',
    titleEn: 'Barrier-Free Facilities',
    summaryKo: '휠체어·유모차·시각장애 관람객의 시야·단차해소·보행유도 필수 모듈',
    items: [
      {
        subtype: 'wheelchair_viewing',
        defaultZone: 'stage_front',
        powerKw: 1.2,
        waterRequired: false,
        networkRequired: false,
        lightingLuxMin: 75,
        staffRequired: 2,
        roleKo: '단차 0.45m 상승 시야 데크 · 동반자석 · 안전 난간 및 완만 진입 경사로 일체형',
        roleEn: 'Elevated sightline viewing deck with companion seating, safety rails & ramp',
        legalBasisKo: '장애인등편의법 시행규칙 별표 1 관람석 및 유효폭·회전반경(Ø1.8m)',
      },
      {
        subtype: 'access_ramp',
        defaultZone: 'entrance',
        powerKw: 0.3,
        waterRequired: false,
        networkRequired: false,
        lightingLuxMin: 100,
        staffRequired: 1,
        roleKo: '기울기 1/12 이하 · 유효폭 1.8m 이상 · 양측 이중 핸드레일 및 논슬립 단차 해소',
        roleEn: '<=1:12 slope modular ramp with >=1.8m clear width & dual handrails',
        legalBasisKo: '장애인등편의법 시행규칙 별표 1 경사로 유효폭(≥1.2m)·기울기(≤1/12)',
      },
      {
        subtype: 'tactile_paving',
        defaultZone: 'center',
        powerKw: 0,
        waterRequired: false,
        networkRequired: false,
        lightingLuxMin: 75,
        staffRequired: 0,
        roleKo: '주출입구~안내소~화장실 연결 선형 유도블록 및 분기점 점형 경고블록 동선 축',
        roleEn: 'High-contrast yellow tactile guidance & hazard blister paving spine',
        legalBasisKo: '장애인등편의법 시행규칙 별표 1 점자블록 설치 기준 (출입구·교차점)',
      },
    ],
  },
  {
    id: 'rest_care',
    titleKo: '휴식 시설',
    titleEn: 'Rest & Care Facilities',
    summaryKo: '영유아 동반 가족·어르신·일반 관람객의 온열질환 예방 및 체력 회복 공간',
    items: [
      {
        subtype: 'family_lounge',
        defaultZone: 'southeast',
        powerKw: 4.5,
        waterRequired: true,
        networkRequired: true,
        lightingLuxMin: 150,
        staffRequired: 2,
        roleKo: '냉난방 프라이빗 수유실 · 기저귀 교환대 · 온수 세면대 · 유모차 정차 공간',
        roleEn: 'Climate-controlled nursing room, diaper station, sink & stroller bay',
        legalBasisKo: '장애인·노인·임산부 편의증진법 영유아·임산부 휴게시설 권장 기준',
      },
      {
        subtype: 'rain_canopy',
        defaultZone: 'center',
        powerKw: 1.5,
        waterRequired: false,
        networkRequired: false,
        lightingLuxMin: 60,
        staffRequired: 1,
        roleKo: '폭염 직사광선 차단 및 우천 시 일시 대피용 인장 막구조 대형 그늘막',
        roleEn: 'Large tensile membrane shade & rain shelter canopy with ballast anchors',
        legalBasisKo: '기상청 폭염영향예보 대응 지침 및 행안부 매뉴얼 순간풍속 고정 기준',
      },
      {
        subtype: 'senior_rest',
        defaultZone: 'southwest',
        powerKw: 3.5,
        waterRequired: true,
        networkRequired: false,
        lightingLuxMin: 120,
        staffRequired: 2,
        roleKo: '등받이·팔걸이 벤치, 음수대, 저소음 차양 파고라를 갖춘 노약자 전용 쉼터',
        roleEn: 'Shaded senior rest pavilion with armrest benches, water cooler & calm acoustics',
        legalBasisKo: '고령자 보행 피로 저감을 위한 50~70m 간격 휴식 거점 설계 원칙',
      },
    ],
  },
  {
    id: 'safety_rescue',
    titleKo: '안전 시설',
    titleEn: 'Safety & Rescue Facilities',
    summaryKo: '응급 처치·초기 화재 진압·기상 및 인파 비상 대피를 담당하는 핵심 거점',
    items: [
      {
        subtype: 'medical_station',
        defaultZone: 'east',
        powerKw: 5.5,
        waterRequired: true,
        networkRequired: true,
        lightingLuxMin: 250,
        staffRequired: 4,
        roleKo: '응급 처치 베드·제세동기(AED)·냉방 전력을 갖추고 구급차 비상차로와 직결',
        roleEn: 'Triage beds, AED, climate power & direct ambulance emergency lane access',
        legalBasisKo: '행안부 지역축제장 안전관리 매뉴얼 구조·구급 및 응급이송체계',
      },
      {
        subtype: 'fire_safety_unit',
        defaultZone: 'west',
        powerKw: 1.0,
        waterRequired: true,
        networkRequired: true,
        lightingLuxMin: 150,
        staffRequired: 2,
        roleKo: '대형 소화기함·옥외 소화전 호스릴·비상경보 경광등·모래함 통합 소방 거점',
        roleEn: 'Outdoor fire hydrant cabinet, multi-extinguisher rack & strobe alarm post',
        legalBasisKo: '재난안전법 시행령 제73조의9 화기·가스 사용 시 초기 소화설비 배치',
      },
      {
        subtype: 'emergency_shelter',
        defaultZone: 'perimeter',
        powerKw: 2.5,
        waterRequired: false,
        networkRequired: true,
        lightingLuxMin: 150,
        staffRequired: 3,
        roleKo: '강풍·낙뢰·돌발 밀집 발생 시 관람객을 분산 수용하는 고시인성 비상 대피소',
        roleEn: 'High-visibility emergency assembly & weather evacuation muster shelter',
        legalBasisKo: '행안부 지역축제장 안전관리 매뉴얼 비상 대피구역 및 집결지 지정',
      },
    ],
  },
  {
    id: 'traffic_access',
    titleKo: '교통 시설',
    titleEn: 'Traffic & Access Facilities',
    summaryKo: '외부 대중교통 환승 및 교통약자 차량의 안전한 하차·무단차 진입 연계',
    items: [
      {
        subtype: 'shuttle_stop',
        defaultZone: 'southwest',
        powerKw: 2.0,
        waterRequired: false,
        networkRequired: true,
        lightingLuxMin: 120,
        staffRequired: 3,
        roleKo: '보행자 동선과 분리된 셔틀버스 전용 승하차 쉘터 및 시차 퇴장 대기 라인',
        roleEn: 'Segregated shuttle bus boarding shelter with staggered egress queue lane',
        legalBasisKo: '폐장 직후 외부 대중교통 수송용량 연계 및 출구 역류(Spillback) 방지',
      },
      {
        subtype: 'accessible_parking',
        defaultZone: 'south',
        powerKw: 1.5,
        waterRequired: false,
        networkRequired: false,
        lightingLuxMin: 100,
        staffRequired: 2,
        roleKo: '휠체어 리프트 하차 사선 구역(1.2m+) 확보 및 주출입구 최단 무장애 통로 직결',
        roleEn: 'ISA accessible parking bays with 1.2m+ hatched transfer zone near main gate',
        legalBasisKo: '장애인등편의법 시행규칙 별표 1 장애인전용주차구역(폭 3.3m×길이 5.0m 이상)',
      },
    ],
  },
  {
    id: 'culture_exhibit',
    titleKo: '문화 시설',
    titleEn: 'Cultural & Exhibition Facilities',
    summaryKo: '지역 문화 전시·실내형 체험 프로그램·어린이 동반 가족 관람 콘텐츠',
    items: [
      {
        subtype: 'experience_pavilion',
        defaultZone: 'west',
        powerKw: 8.5,
        waterRequired: true,
        networkRequired: true,
        lightingLuxMin: 200,
        staffRequired: 4,
        roleKo: '전면 개방 글라스 및 아치 지붕을 갖춘 대형 문화·공예 체험 파빌리온',
        roleEn: 'Spacious vaulted cultural workshop & hands-on experience pavilion',
        legalBasisKo: '실내형 체류 인원 분산 및 우천 시 대체 프로그램 수용 거점',
      },
      {
        subtype: 'exhibition_hall',
        defaultZone: 'east',
        powerKw: 11.0,
        waterRequired: false,
        networkRequired: true,
        lightingLuxMin: 250,
        staffRequired: 4,
        roleKo: '자연채광 스카이라이트와 일방통행 관람 동선을 갖춘 모듈형 주제 전시관',
        roleEn: 'Modular gallery exhibition hall with skylight roof & one-way visitor flow',
        legalBasisKo: '전시실 내부 출입구 2개소 이상 분리 및 내부 통로 유효폭 1.8m 이상 확보',
      },
      {
        subtype: 'play_zone',
        defaultZone: 'east',
        powerKw: 7.5,
        waterRequired: false,
        networkRequired: false,
        lightingLuxMin: 120,
        staffRequired: 4,
        roleKo: '충격흡수 안전매트·송풍 고정팩·보호자 시야 벤치를 갖춘 어린이 놀이시설',
        roleEn: 'Safety-matted kids bounce & play zone with wind anchors & parent seating',
        legalBasisKo: '어린이놀이시설 안전관리 지침 및 순간풍속 주의 시 송풍 중단 수칙',
      },
      {
        subtype: 'beam_projector',
        defaultZone: 'north',
        powerKw: 3.8,
        waterRequired: false,
        networkRequired: true,
        lightingLuxMin: 150,
        staffRequired: 2,
        roleKo: '공연 없는 실내 박람회·컨퍼런스·세미나용 고광량 레이저 빔 프로젝터·16:9 대형 스크린 및 저단상 발표대',
        roleEn: 'High-lumen laser beam projector, 16:9 wide screen & low step-free presenter riser for indoor events',
        legalBasisKo: '실내 컨벤션 시야각·투사거리 확보 및 발표자 무단차 경사로(≤1/12) 접근 기준',
      },
    ],
  },
  {
    id: 'ops_control',
    titleKo: '운영 시설',
    titleEn: 'Operations & Control Facilities',
    summaryKo: '현장 인력 교대·관람객 편의 수납·실시간 CCTV 및 안전 통합 지휘 본부',
    items: [
      {
        subtype: 'volunteer_center',
        defaultZone: 'northwest',
        powerKw: 4.5,
        waterRequired: true,
        networkRequired: true,
        lightingLuxMin: 180,
        staffRequired: 3,
        roleKo: '운영요원·자원봉사자 교대 브리핑, 무전기 충전 및 휴식 지원 본부',
        roleEn: 'Staff & volunteer briefing, radio charging, and shift rotation center',
        legalBasisKo: '행안부 매뉴얼 안전관리요원 배치·교대 및 비상 연락체계 운영 거점',
      },
      {
        subtype: 'locker_charging',
        defaultZone: 'entrance',
        powerKw: 5.0,
        waterRequired: false,
        networkRequired: true,
        lightingLuxMin: 150,
        staffRequired: 2,
        roleKo: '관람객 짐 보관 스마트 락커 및 휴대폰·전동보장구(휠체어) 급속 충전소',
        roleEn: 'Smart parcel lockers, mobile charging & powered wheelchair battery hub',
        legalBasisKo: '장시간 체류 관람객 짐 부피 감소 및 전동휠체어 방전 예방 지원',
      },
      {
        subtype: 'control_room',
        defaultZone: 'northwest',
        powerKw: 14.0,
        waterRequired: false,
        networkRequired: true,
        lightingLuxMin: 300,
        staffRequired: 6,
        roleKo: '복층 시야 관측창·CCTV 밀집 관제·비상 방송·기상 풍속계를 통합한 종합통제실',
        roleEn: 'Elevated command & CCTV crowd control center with PA & weather telemetry',
        legalBasisKo: '재난안전법 시행령 제73조의9 현장 종합상황실 및 유관기관 합동 지휘소',
      },
    ],
  },
];

export interface ReferenceAssetSheet {
  id: string;
  titleKo: string;
  titleEn: string;
  imageUrl: string;
  categoryGroupKo: string;
  visualFeaturesKo: string[];
  mappedSubtypes: FacilitySubtype[];
  spawnPresets: Array<{
    subtype: FacilitySubtype;
    labelKo: string;
    labelEn: string;
    defaultZone: SpatialZoneTarget;
  }>;
  designRuleKo: string;
}

/**
 * All 11 Uploaded 3D Reference Image Sheets (/public/assets/aistudio/*.png)
 * Mapped directly to INCLUSE 3D procedural meshes, metadata, and 1-click spawning.
 */
export const REFERENCE_ASSET_SHEETS: ReferenceAssetSheet[] = [
  {
    id: 'ref-stage-performance',
    titleKo: '무대 및 공연 시설 (Stage & Performance)',
    titleEn: 'Stage, Line-Array Truss, FOH Booth & Giant Relay Screen',
    imageUrl: '/assets/aistudio/___________2026-11-01______8.26.51_1d05dfb7.png',
    categoryGroupKo: '공연·음향·영상 코어',
    visualFeaturesKo: [
      '은색 아치형 볼트 트러스 지붕(Vaulted Arch Roof) 주무대 및 전면 중앙 계단',
      '좌·우 래티스 트러스 타워 현수형 블랙 라인어레이 스피커 및 양측 세로형 LED 윙 스크린',
      '전면 콘서트 바닥 블루·퍼플 워시 조명 및 무장애 관람데크 연계',
      '트러스 프레임 + 화이트 피치 캐노피 + 블랙 스커트 FOH 음향·조명 콘솔 부스 및 독립형 대형 LED 중계 스크린',
    ],
    mappedSubtypes: ['main_stage', 'secondary_stage', 'foh_control'],
    spawnPresets: [
      { subtype: 'main_stage', labelKo: '아치 트러스 주무대', labelEn: 'Arch Main Stage', defaultZone: 'north' },
      { subtype: 'foh_control', labelKo: 'FOH 음향·조명 부스', labelEn: 'FOH Control Booth', defaultZone: 'stage_front' },
      { subtype: 'secondary_stage', labelKo: '보조무대·대형 LED 스크린', labelEn: 'Sub-Stage & LED Screen', defaultZone: 'south' },
    ],
    designRuleKo:
      '관람 구역 뒤편 FOH 콘솔 가시선을 확보하고, 무대 좌·우 음향 타워 지향각과 전면 안전 펜스·비상 대피 통로(최소 3.5m 이상)를 분리합니다.',
  },
  {
    id: 'ref-booths-foodtruck',
    titleKo: '부스 및 판매 시설 (Booths & Food Trucks)',
    titleEn: 'Pagoda Tent, Striped Stall, Timber Gastro Booth & Retro Food Truck',
    imageUrl: '/assets/aistudio/___________2026-11-01______8.26.55_02321709.png',
    categoryGroupKo: '식음(F&B)·판매 부스',
    visualFeaturesKo: [
      '물결 발란스(Scalloped Valance)와 화이트 하단 스커트를 갖춘 뾰족 지붕 파고다 텐트',
      '블루·화이트 스트라이프 어닝 마켓 판매 부스 및 목재 박공지붕·웜 스트링라이트 미식 부스',
      '크림·머스타드 투톤 레트로 푸드트럭, 스트라이프 측면 어닝, 원형 루프탑 엠블럼 간판, 저상 서비스 카운터',
    ],
    mappedSubtypes: ['food_truck', 'food_stall', 'goods_shop', 'beer_garden'],
    spawnPresets: [
      { subtype: 'food_truck', labelKo: '레트로 푸드트럭 추가', labelEn: 'Add Retro Food Truck', defaultZone: 'west' },
      { subtype: 'food_stall', labelKo: '스트라이프·파고다 판매부스', labelEn: 'Add Vendor Booth', defaultZone: 'east' },
      { subtype: 'beer_garden', labelKo: '스트링라이트 비어가든', labelEn: 'Add Gastro Beer Garden', defaultZone: 'east' },
    ],
    designRuleKo:
      '조리·전력 부하(5~15kW) 및 화기·가스 사용 여부를 분리 점검하고, 전면 주문 대기열(2.5~4.0m)이 주 보행 통로를 가로막지 않도록 배치합니다.',
  },
  {
    id: 'ref-experience-play',
    titleKo: '체험 및 놀이 시설 (Experience & Play)',
    titleEn: 'Rainbow Bounce Slide, Carnival Booth, Picnic Table & Portal Arch',
    imageUrl: '/assets/aistudio/___________2026-11-01______8.27.00_32fe5d5a.png',
    categoryGroupKo: '가족 체험·놀이 존',
    visualFeaturesKo: [
      '무지개 컬러 에어바운스 슬라이드(Inflatable Bounce Slide) 및 안전 매트 구역',
      '블루·화이트 스트라이프 카니발 링토스 체험 부스',
      '원목 A형 피크닉 테이블 및 퍼플 발광 지오메트릭 포털 아치',
    ],
    mappedSubtypes: ['play_zone', 'experience_booth'],
    spawnPresets: [
      { subtype: 'play_zone', labelKo: '에어바운스·놀이존 배치', labelEn: 'Add Bounce & Play Zone', defaultZone: 'east' },
      { subtype: 'experience_booth', labelKo: '카니발 체험부스 추가', labelEn: 'Add Carnival Booth', defaultZone: 'center' },
    ],
    designRuleKo:
      '에어바운스·대형 공기막 구조물은 송풍기 상시 전력과 고정 팩·모래주머니 풍속 한계(순간풍속 점검) 및 어린이 보호자 대기 벤치를 함께 확보합니다.',
  },
  {
    id: 'ref-rest-shade',
    titleKo: '휴식 공간 및 그늘막 (Rest & Shade)',
    titleEn: 'Tensile Shade Sail, Parasol Picnic Tables, Benches & Vine Pergola',
    imageUrl: '/assets/aistudio/___________2026-11-01______8.27.04_8d7fc9e8.png',
    categoryGroupKo: '무장애 휴게·폭염·우천 대피',
    visualFeaturesKo: [
      '인장 폴대와 가이와이어(Guy-wires)로 지지되는 대형 웜베이지 막구조 그늘막(Tensile Shade Sail)',
      '크림색 팔각 파라솔이 결합된 원목 A형 피크닉 테이블 및 등받이 공원 벤치',
      '덩굴 식재와 플랜터 박스가 어우러진 원목 파고라(Vine-Draped Pergola) 가족 쉼터',
    ],
    mappedSubtypes: ['rain_canopy', 'rest_plaza', 'family_lounge', 'mist_cooling'],
    spawnPresets: [
      { subtype: 'rain_canopy', labelKo: '대형 막구조 그늘막', labelEn: 'Add Tensile Shade Canopy', defaultZone: 'center' },
      { subtype: 'rest_plaza', labelKo: '파라솔 피크닉 쉼터', labelEn: 'Add Parasol Rest Plaza', defaultZone: 'center' },
      { subtype: 'family_lounge', labelKo: '파고라 가족·수유 쉼터', labelEn: 'Add Pergola Family Lounge', defaultZone: 'southeast' },
    ],
    designRuleKo:
      '고령자·유모차·어린이 동반 관람객의 온열질환 예방을 위해 보행 50~70m 간격마다 그늘 쉼터와 휠체어 정차 여유 공간을 배치합니다.',
  },
  {
    id: 'ref-convenience-medical',
    titleKo: '편의 및 안전·의료 시설 (Convenience & Medical)',
    titleEn: 'Blue/Pink Modular Restrooms, i-Medallion Info Kiosk & Red-Cross Medical Tent',
    imageUrl: '/assets/aistudio/___________2026-11-01______8.27.09_e2d5527b.png',
    categoryGroupKo: '필수 위생·안내·응급의료',
    visualFeaturesKo: [
      '블루(남성)·마젠타핑크(여성) 픽토그램 도어가 구분된 화이트 모듈형 화장실 뱅크 + 장애인 전용 칸',
      '원형 블루 "i" 루프탑 메달리온과 블루 내부 조명을 갖춘 유리형 종합안내소',
      '원형 레드 "+" 십자 메달리온 박공지붕과 출입 커튼을 갖춘 응급의료 부스',
    ],
    mappedSubtypes: ['restroom_bank', 'ticket_info', 'multilingual_info', 'medical_station'],
    spawnPresets: [
      { subtype: 'restroom_bank', labelKo: '블루·핑크 모듈 화장실', labelEn: 'Add Modular Restroom', defaultZone: 'perimeter' },
      { subtype: 'multilingual_info', labelKo: '블루 i 안내부스', labelEn: 'Add Info Booth', defaultZone: 'entrance' },
      { subtype: 'medical_station', labelKo: '적십자 응급의료 텐트', labelEn: 'Add Medical Tent', defaultZone: 'east' },
    ],
    designRuleKo:
      '화장실은 급수·오수 수거차량 접근이 가능한 외곽에 분산 배치하고, 의무실은 구급차 비상 진출입로와 직결되는 지점에 시인성 높은 표지와 함께 설치합니다.',
  },
  {
    id: 'ref-entrance-wayfinding',
    titleKo: '입출구 게이트 및 유도 사인 (Entrances & Wayfinding)',
    titleEn: 'Curved Blue FESTIVAL Arch, Turnstiles, Planters & 3-Blade Signpost',
    imageUrl: '/assets/aistudio/___________2026-11-01______8.27.13_e4647500.png',
    categoryGroupKo: '출입 통제·분산 퇴장·길안내',
    visualFeaturesKo: [
      '블루 발광 세그먼트 곡선형 FESTIVAL 메인 아치 게이트',
      '스테인리스 턴스타일 검표 게이트 3기 + 우측 광폭 휠체어·유모차 우선 통로',
      '조경 플랜터 화분 및 3단 블루 방향 유도 이정표(Wayfinding Signpost)',
    ],
    mappedSubtypes: ['main_entrance', 'secondary_entrance', 'wristband_hub'],
    spawnPresets: [
      { subtype: 'main_entrance', labelKo: '곡선형 FESTIVAL 주출입구', labelEn: 'Add Main Arch Gate', defaultZone: 'south' },
      { subtype: 'secondary_entrance', labelKo: '보조 분산 출입구', labelEn: 'Add Relief Gate', defaultZone: 'southeast' },
      { subtype: 'wristband_hub', labelKo: '티켓·팔찌 교환 허브', labelEn: 'Add Wristband Hub', defaultZone: 'entrance' },
    ],
    designRuleKo:
      '입장 검표·보안검색 대기줄이 퇴장 동선과 겹치지 않도록 분리하고, 턴스타일 구조물을 제외한 실질 유효 출구 폭으로 시간당 유출 용량을 산정합니다.',
  },
  {
    id: 'ref-traffic-parking',
    titleKo: '교통·주차장 및 셔틀버스 정류장 (Traffic & Shuttle)',
    titleEn: 'Tree-Lined Asphalt Parking, Disabled Bays & Blue Glass Shuttle Shelter',
    imageUrl: '/assets/aistudio/___________2026-11-01______8.27.17_390416f3.png',
    categoryGroupKo: '외부 교통 연계·주차·셔틀',
    visualFeaturesKo: [
      '가로수길과 백색 주차 구획선·장애인 전용 주차구역(ISA)이 표시된 아스팔트 주차장',
      '실버·레드·블루·올리브 다색 승용차 및 장애인 리프트 밴',
      '블루 글라스 승하차 쉘터에 정차한 블루·화이트 페스티벌 셔틀버스',
    ],
    mappedSubtypes: ['parking_lot', 'shuttle_stop'],
    spawnPresets: [
      { subtype: 'parking_lot', labelKo: '교통·무장애 주차장', labelEn: 'Add Parking Lot', defaultZone: 'south' },
      { subtype: 'shuttle_stop', labelKo: '셔틀버스 승하차장', labelEn: 'Add Shuttle Bus Stop', defaultZone: 'southwest' },
    ],
    designRuleKo:
      '보행자 출입구와 차량·셔틀 동선을 물리적으로 분리하고, 공연 종료 직후 대중교통·셔틀 시간당 수송용량 부족에 따른 출구 역류(Spillback)를 점검합니다.',
  },
  {
    id: 'ref-lighting-micro-objects',
    titleKo: '조명·장식 및 현장 안전 마이크로 오브젝트 (Lighting & Micro-Objects)',
    titleEn: 'Floodlight Towers, Crystal Obelisks, Feather Flags, Barricades, Cones & Bins',
    imageUrl: '/assets/aistudio/___________2026-11-01______8.27.24_3d15f587.png',
    categoryGroupKo: '야간 조도·포토존·동선 통제 소품',
    visualFeaturesKo: [
      '6구 투광등 블랙 트러스 조명타워, 스트링라이트, 더블 네온 아치, 파스텔 크리스탈 오벨리스크 조형물',
      '3단 원목 이정표 및 5색 곡선형 페더 배너(Feather Flags)',
      '철제 군중 안전 바리케이드, 주황·백색 라바콘(Traffic Cones), 리브형 분리수거 휴지통',
    ],
    mappedSubtypes: ['photo_zone', 'eco_station', 'locker_charging'],
    spawnPresets: [
      { subtype: 'photo_zone', labelKo: '크리스탈·네온아치 포토존', labelEn: 'Add Crystal Photo Zone', defaultZone: 'center' },
      { subtype: 'eco_station', labelKo: '다회용기·분리배출 스테이션', labelEn: 'Add Eco Waste Station', defaultZone: 'perimeter' },
    ],
    designRuleKo:
      '문서 7페이지 기준 배너·바리케이드·라바콘·쓰레기통·사인물·투광등 같은 소형 현장 설비가 실제 시야와 통로 유효폭을 좌우하므로 조경·안전 레이어에 함께 배치합니다.',
  },
  {
    id: 'ref-environment-landscaping',
    titleKo: '환경·조경 및 야간 가로등 요소 (Environmental Elements)',
    titleEn: 'Broadleaf & Conifer Trees, Boulders, Flower Beds, Streetlamp & Light Tower',
    imageUrl: '/assets/aistudio/___________2026-11-01______8.26.41_6effe305.png',
    categoryGroupKo: '수목·화단·자연 지형·야간 조명',
    visualFeaturesKo: [
      '3종 활엽수(Broadleaf Trees) 및 원추형 상록 침엽수(Conifer Pine Trees)',
      '자연석 바위(Boulders), 관목 군락, 퍼플·옐로우·핑크 화단(Flower Beds)',
      '원목 피크닉 테이블, 클래식 블랙 가로등(Vintage Streetlamp), 트러스 투광등 타워',
    ],
    mappedSubtypes: ['rest_plaza', 'camping_zone', 'pet_zone'],
    spawnPresets: [
      { subtype: 'camping_zone', labelKo: '그린 피크닉·캠핑존', labelEn: 'Add Picnic Camping Zone', defaultZone: 'west' },
      { subtype: 'pet_zone', labelKo: '반려동물 동반 쉼터', labelEn: 'Add Companion Pet Zone', defaultZone: 'southwest' },
    ],
    designRuleKo:
      '기존 수목·화단·자연석은 철거 대상이 아닌 고정 지형 제약조건으로 반영하며, 야간 퇴장 동선·계단·화장실 주변에는 가로등과 투광등을 중첩 배치합니다.',
  },
  {
    id: 'ref-additional-infrastructure',
    titleKo: '인프라·발전기 펜스·웰컴 트러스 게이트 (Infrastructure & Assets)',
    titleEn: 'Cherry Blossom, Fountain, Treble Sculpture, Fenced Generator & WELCOME Gate',
    imageUrl: '/assets/aistudio/___________2026-11-01______8.27.40_5dfdd9a4.png',
    categoryGroupKo: '전력·배전 인프라·랜드마크·보안 게이트',
    visualFeaturesKo: [
      '핑크 벚꽃나무, 원형 석조 분수대, 골드 높은음자리표 음악 조형물, 디지털 안내 키오스크',
      '전면 안전 바리케이드가 설치된 이동식 화장실, 적십자 의무실, INFORMATION 안내소',
      '안전 펜스로 격리된 발전기·분전반(Power Generator Enclosure) 및 오렌지·블루 WELCOME 트러스 게이트·경비초소',
    ],
    mappedSubtypes: ['fountain_plaza', 'secondary_entrance', 'smoking_booth'],
    spawnPresets: [
      { subtype: 'fountain_plaza', labelKo: '석조 분수 광장 추가', labelEn: 'Add Stone Fountain Plaza', defaultZone: 'center' },
      { subtype: 'secondary_entrance', labelKo: 'WELCOME 트러스 게이트', labelEn: 'Add WELCOME Truss Gate', defaultZone: 'east' },
    ],
    designRuleKo:
      '발전기·분전반은 관람객 접근 차단 펜스와 소화기를 갖추어 외곽 서비스 구역에 격리하고, 횡단 케이블은 무장애 경사형 케이블 프로텍터로 마감합니다.',
  },
  {
    id: 'ref-festival-site-overall',
    titleKo: '수변 공원형 페스티벌 전체 마스터플랜 (Overall Aerial Reference)',
    titleEn: 'Waterfront Park Aerial Layout: Stage, Central Lawn, Ferris Wheel & Perimeter Zones',
    imageUrl: '/assets/aistudio/___________2026-11-01______8.27.58_a734bf40.png',
    categoryGroupKo: '마스터플랜 조닝(Zoning) 표준',
    visualFeaturesKo: [
      '북서측 아치형 주무대 + 배후 외곽 순환도로 셔틀버스·서비스 차량 동선 분리',
      '중앙 오픈 잔디 관람 광장(Open Central Lawn) 확보 및 동북측 대관람차 랜드마크 배치',
      '남동측 수변 안전 경계 확보 및 외곽 보행 축을 따라 식음·체험 파고다 부스열 정렬',
    ],
    mappedSubtypes: ['main_stage', 'play_zone', 'vip_lounge'],
    spawnPresets: [
      { subtype: 'vip_lounge', labelKo: '수변·전망 VIP 라운지', labelEn: 'Add Perimeter VIP Lounge', defaultZone: 'northwest' },
    ],
    designRuleKo:
      '중앙 광장은 고밀도 관람·비상 분산을 위해 비워 두고, 부스·화장실·발전기·셔틀 승하차장은 외곽 순환축에 배치하여 관람객 동선과 물류 동선을 분리합니다.',
  },
];

export const RELIABILITY_LABEL_META: Record<
  DataReliabilityLabel,
  {
    badgeKo: string;
    badgeEn: string;
    meaningKo: string;
    requiredMetaKo: string;
    toneClass: string;
  }
> = {
  OFFICIAL: {
    badgeKo: 'OFFICIAL · 공식 법령·매뉴얼',
    badgeEn: 'OFFICIAL',
    meaningKo: '법령·정부 매뉴얼·공식 통계 포털 원문 기준',
    requiredMetaKo: '기관명, 문서명, 발행일, 확인일, 조문·표 번호',
    toneClass: 'bg-blue-50 text-blue-800 border-blue-200',
  },
  OBSERVED: {
    badgeKo: 'OBSERVED · 현장 실측·관측',
    badgeEn: 'OBSERVED',
    meaningKo: '실제 행사 게이트 계측·통신 유동인구·결산서 관측값',
    requiredMetaKo: '행사명, 연도, 측정 위치, 계측 방법',
    toneClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  ESTIMATED: {
    badgeKo: 'ESTIMATED · 산식 추정치',
    badgeEn: 'ESTIMATED',
    meaningKo: '관측·공식 자료를 바탕으로 대기행렬·면적 산식으로 계산한 값',
    requiredMetaKo: '추정 산식, 입력 변수, 불확실성 범위',
    toneClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  },
  ASSUMPTION: {
    badgeKo: 'ASSUMPTION · 시뮬레이션 가정값',
    badgeEn: 'ASSUMPTION',
    meaningKo: '기획 단계 기본 가정값 (법적 기준·실제 견적 확정값 아님, 사용자 수정 가능)',
    requiredMetaKo: '가정 사유, 기본값 범위, 사용자 수정 가능 여부',
    toneClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  MISSING: {
    badgeKo: 'MISSING · 현장 자료 미입력',
    badgeEn: 'MISSING',
    meaningKo: '관할기관 협의·실측·견적 자료가 아직 없어 검증 보류된 항목',
    requiredMetaKo: '필요 자료 목록, 설계 판정 보류 여부',
    toneClass: 'bg-rose-50 text-rose-800 border-rose-200',
  },
};

export const RAG_FIVE_LAYERS = [
  {
    layerId: 'Layer A',
    nameKo: '법령·공식 지침 계층',
    roleKo: '안전관리계획 수립 대상 판별, 단계별 안전 점검표, 장애인·노인·임산부 편의시설 기준 검토',
    sourcesKo:
      '재난 및 안전관리 기본법 시행령 제73조의9(2026-07-22 시행), 행정안전부 지역축제장 안전관리 매뉴얼(2021), 장애인등편의법 시행규칙 별표 1',
    cautionKo: '법령 해석·인허가·안전 승인 여부를 자동 확정하지 않으며 관할 지자체·소방·경찰 검토 항목으로 안내합니다.',
  },
  {
    layerId: 'Layer B',
    nameKo: '실측·공개 데이터 계층',
    roleKo: '유사 지역축제의 일자·장소·예산·원가회계·기상청 ASOS 극값·방문객 추세 비교',
    sourcesKo:
      '공공데이터포털 전국문화축제표준데이터, 한국관광데이터랩, 지방재정365 행사·축제 원가회계, 기상청 기상자료개방포털, KOSIS',
    cautionKo: '주최 측 추산 연인원(누적)과 통신·카드 기반 유동인구 추정치를 섞지 않고 산정 방식을 분리 기록합니다.',
  },
  {
    layerId: 'Layer C',
    nameKo: '운영·대기열 계층',
    roleKo: '부스·화장실·푸드트럭·검표구의 도착률(λ), 서비스율(μ), 병렬 창구 수(c), 대기 면적 계산',
    sourcesKo: '현장 운영계획서, 실측 평균 처리시간(service_time_sec), 부스 운영 인력표',
    cautionKo: '실측치 미입력 시 업종별 시뮬레이션 가정값(ASSUMPTION)으로 표시하고 사용자 수정을 허용합니다.',
  },
  {
    layerId: 'Layer D',
    nameKo: '시뮬레이션 가정 계층',
    roleKo: '타임테이블 연동 15분 구간 입장·퇴장·동시 재실 인원 및 8대 관람객 행동 전환 시나리오 비교',
    sourcesKo: '공연 타임테이블, 우천·강풍·폭염·인파급증·출구폐쇄 가정 시나리오',
    cautionKo: '시뮬레이션 히트맵은 병목 후보 비교용 시각 보조 도구이며 실제 안전 인증 근거로 단독 사용하지 않습니다.',
  },
  {
    layerId: 'Layer E',
    nameKo: '3D 자산 메타데이터 계층',
    roleKo: '업로드된 11종 3D 레퍼런스 시트와 연동된 규격(L×W×H), 여유 폭, 전력(kW), 급배수, 단가 명세',
    sourcesKo: '11종 3D 에셋 레퍼런스 시트 + 표준 JSON 자산 스키마(11-1)',
    cautionKo: '설치비·전력·급배수 단가는 지역·계절·운반 거리에 따라 달라지므로 견적서 확인 전까지 ASSUMPTION으로 관리합니다.',
  },
];

export const OFFICIAL_PUBLIC_DATA_SOURCES = [
  {
    id: 'law-73-9',
    categoryKo: '국가 법령',
    titleKo: '재난 및 안전관리 기본법 시행령 제73조의9 (지역축제 안전관리계획)',
    orgKo: '법제처 국가법령정보센터',
    url: 'https://www.law.go.kr',
    usageKo: '순간 최대 관람객 1,000명 이상, 산·수면 개최, 불·폭죽·석유류·가연성 가스 사용 시 안전관리계획 및 기관 협의 대상 판별',
    checkedDate: '2026-07-22 시행본 기준',
  },
  {
    id: 'mois-manual-2021',
    categoryKo: '정부 안전 매뉴얼',
    titleKo: '2021년 지역축제장 안전관리 매뉴얼',
    orgKo: '행정안전부',
    url: 'https://www.mois.go.kr',
    usageKo: '축제 기획 → 개최 전 → 운영 중 → 종료 → 사고 대응 5단계 점검표 및 구조·구급·전기·가스·시설 점검 항목 반영',
    checkedDate: '2026-04-20 확인',
  },
  {
    id: 'bf-act',
    categoryKo: '무장애 법령',
    titleKo: '장애인·노인·임산부 등의 편의증진 보장에 관한 법률 및 시행규칙 별표 1',
    orgKo: '보건복지부 · 국가법령정보센터',
    url: 'https://www.law.go.kr',
    usageKo: '주출입구 높이차 제거, 유효폭, 경사로 기울기, 장애인 전용 주차구역 및 화장실 회전 공간 기준',
    checkedDate: '2026-04-20 확인',
  },
  {
    id: 'data-go-festival',
    categoryKo: '공공 표준데이터',
    titleKo: '전국문화축제표준데이터 (개방표준)',
    orgKo: '공공데이터포털',
    url: 'https://www.data.go.kr',
    usageKo: '축제명, 개최 장소, 시작·종료일, 주관기관, 주소·위경도 좌표 스키마 연동',
    checkedDate: '2026-04-20 확인',
  },
  {
    id: 'datalab-visitkorea',
    categoryKo: '관광·유동인구 빅데이터',
    titleKo: '한국관광데이터랩 지역별 관광 현황·축제 분석',
    orgKo: '한국관광공사',
    url: 'https://datalab.visitkorea.or.kr',
    usageKo: '통신·카드·내비게이션 기반 방문자 추이 및 유사 시기 수요 비교 (주최 측 추산 인원과 분리 표기)',
    checkedDate: '2026-04-20 확인',
  },
  {
    id: 'lofin-365',
    categoryKo: '예산·결산 원가회계',
    titleKo: '지방재정365 행사·축제 원가회계 공개',
    orgKo: '행정안전부 지방재정365',
    url: 'https://www.lofin365.go.kr',
    usageKo: '유사 규모 공공 축제의 시설비·운영비·안전관리비·홍보비 결산 원가 비율 벤치마크',
    checkedDate: '2026-04-20 확인',
  },
  {
    id: 'kma-asos',
    categoryKo: '기상 관측 데이터',
    titleKo: '기상자료개방포털 종관기상관측(ASOS)',
    orgKo: '기상청',
    url: 'https://data.kma.go.kr',
    usageKo: '행사 월·시간대 기온, 강수량, 최대순간풍속 분포를 통한 그늘막·배수·천막 고정 강풍 기준 설정',
    checkedDate: '2026-04-20 확인',
  },
  {
    id: 'kosis-culture',
    categoryKo: '국가승인통계',
    titleKo: '국가통계포털(KOSIS) 문화·여가·인구 통계',
    orgKo: '통계청',
    url: 'https://kosis.kr',
    usageKo: '배후 인구 연령대·고령자·어린이 비율에 따른 가족 쉼터·무장애 편의시설 수요 보정',
    checkedDate: '2026-04-20 확인',
  },
];

export const WEATHER_SCENARIO_GUIDES: Record<
  WeatherScenarioId,
  {
    nameKo: string;
    nameEn: string;
    triggerConditionKo: string;
    crowdImpactKo: string;
    requiredDesignActionsKo: string[];
    linkedContingency: 'normal' | 'rain' | 'surge' | 'stage_delay' | 'medical_emergency';
  }
> = {
  clear: {
    nameKo: '평시 맑음 (기준 기상)',
    nameEn: 'Standard Clear Weather',
    triggerConditionKo: '기온 18~25°C, 풍속 4m/s 미만, 강수 없음',
    crowdImpactKo: '야외 잔디 광장·체험부스·푸드존 전반에 고른 체류 분포 형성',
    requiredDesignActionsKo: [
      '주 동선 유효폭 및 대기열 경계선(바리케이드·라바콘) 기본 유지',
      '시간대별 공연 전환기(입장·종료 직후) 화장실·식음 병목 모니터링',
    ],
    linkedContingency: 'normal',
  },
  rain: {
    nameKo: '우천·집중호우 시나리오',
    nameEn: 'Rain & Wet Ground',
    triggerConditionKo: '시간당 강수 발생 및 잔디·비포장 지면 배수 저하',
    crowdImpactKo: '비가림 캐노피·실내형 부스로 급격한 밀집 발생, 우산 사용으로 보행 점유 폭 증가 및 미끄럼 위험 상승',
    requiredDesignActionsKo: [
      '대형 우천 대피 캐노피(rain_canopy) 확충 및 저지대 물고임 구역 부스·분전반 배치 배제',
      '경사로·계단 미끄럼 방지 매트 및 우천용 케이블 프로텍터·누전차단기 점검',
    ],
    linkedContingency: 'rain',
  },
  strong_wind: {
    nameKo: '강풍·돌풍 시나리오',
    nameEn: 'Strong Wind & Gusts',
    triggerConditionKo: '기상청 ASOS 순간풍속 주의 구간 진입',
    crowdImpactKo: '파고다 텐트·에어바운스·페더 배너·아치 구조물 전도 위험에 따른 일시 운영 중지 및 대피 동선 전환',
    requiredDesignActionsKo: [
      '천막·캐노피·에어아치·현수막의 웨이트(모래주머니·콘크리트 블록) 고정 및 강풍 시 철거·하강 기준 명시',
      '에어바운스 놀이존(play_zone) 즉시 송풍 중단·퇴거 프로토콜 및 무대 라인어레이 윈드로드 확인',
    ],
    linkedContingency: 'stage_delay',
  },
  heatwave: {
    nameKo: '폭염·고온 시나리오',
    nameEn: 'Heatwave & High WBGT',
    triggerConditionKo: '체감온도 31°C 이상 및 직사광선 노출 증가',
    crowdImpactKo: '그늘막·쿨링포그·음료 부스 대기열 급증 및 고령자·어린이 온열질환 응급 수요 증가',
    requiredDesignActionsKo: [
      '인장 막구조 그늘막(rain_canopy), 파라솔 쉼터(rest_plaza), 쿨링포그(mist_cooling), 급수대 증설',
      '응급의료 부스(medical_station) 냉방 전력 확보 및 온열질환 구급차 이송 동선 직결',
    ],
    linkedContingency: 'medical_emergency',
  },
  cold_wave: {
    nameKo: '저온·야간 한기 시나리오',
    nameEn: 'Cold Snap & Chilly Evening',
    triggerConditionKo: '봄·가을 야간 기온 급강하 및 체온 저하',
    crowdImpactKo: '온음료 부스·방풍형 텐트 집중 및 난방기 사용에 따른 전력·화기 안전 위험 증가',
    requiredDesignActionsKo: [
      '방풍 가림막 쉼터 확보 및 전기 난방기 추가 전력 부하(kW) 사전 반영',
      '가스·석유류 난방기 사용 시 재난안전법 시행령 제73조의9 화기 안전점검·소화기 비치 필수',
    ],
    linkedContingency: 'normal',
  },
  night_ops: {
    nameKo: '야간 공연·폐장 퇴장 시나리오',
    nameEn: 'Nighttime Show & Mass Egress',
    triggerConditionKo: '일몰 이후 조도 저하 + 메인 공연 종료 직후 일시 퇴장',
    crowdImpactKo: '시야가 좁아진 상태에서 출입구·계단·화장실·셔틀 정류장으로 대규모 퇴장 인파 집중',
    requiredDesignActionsKo: [
      '출입구·경사로·화장실·분전반 주변 트러스 투광등 타워(Floodlight Tower) 및 가로등 조도 확보',
      '발광 유도 사인·스태프 경광봉 배치 및 외부 셔틀·대중교통 수송용량 연계 시차 퇴장 유도',
    ],
    linkedContingency: 'surge',
  },
};

export const SETUP_TEARDOWN_SCHEDULE_7_STEPS = [
  {
    step: 1,
    dDayTag: 'D-30',
    phaseKo: '1단계 (D-30) · 지역축제 안전관리계획서 작성 및 제출',
    detailKo: '순간 최대 관람객·화기·수변 조건을 반영한 안전관리계획서, 비상 대피도, 무장애 배치안을 관할 지자체에 공식 제출',
    vehicleNoteKo: '행정·사전 서류 접수 단계',
  },
  {
    step: 2,
    dDayTag: 'D-21',
    phaseKo: '2단계 (D-21) · 지자체·소방·경찰·전기 유관기관 실무심의',
    detailKo: '안전정책실무조정위원회 심의 및 소방차·구급차 진입폭(≥3.5m), 소화전 위치, 외부 교통 통제 대책 사전 협의',
    vehicleNoteKo: '유관기관 합동 도면 검토',
  },
  {
    step: 3,
    dDayTag: 'D-14',
    phaseKo: '3단계 (D-14) · 심의 보완 반영 및 최종 3D 시공 도면 확정',
    detailKo: '기관 보완 의견(출구 유효폭 확충·화기 이격·무장애 경사로)을 3D 배치도에 반영하고 운영요원·안전보험 계약 확정',
    vehicleNoteKo: '시공·렌탈 물량 최종 동결',
  },
  {
    step: 4,
    dDayTag: 'D-7',
    phaseKo: '4단계 (D-7) · 가설 구조물·발전기·무장애 자재 사전 배정 및 검수',
    detailKo: '트러스·파고다 부스·경사로(1/12)·점자블록·모래주머니 웨이트·비상 발전기 물량 사전 안전성 검수 및 반입 시간표 확정',
    vehicleNoteKo: '물류 배차 타임슬롯 배정',
  },
  {
    step: 5,
    dDayTag: 'D-5',
    phaseKo: '5단계 (D-5) · 부지 현장 측량·지장물 및 비상차로 그리드 마킹',
    detailKo: '경계선·기존 수목·맨홀·소화전·경사 구간 실측, 구역 그리드 초크 마킹 및 중앙 비상차량 진입 축(최소 3.5~4.5m) 선점',
    vehicleNoteKo: '측량팀·안전관리자 도보 실측',
  },
  {
    step: 6,
    dDayTag: 'D-4',
    phaseKo: '6단계 (D-4) · 전력 발전기·급배수·유무선 통신망 기반 인입',
    detailKo: '외곽 안전 펜스 내 발전기·분전반 설치, 급수·오수 라인 및 통제실 광통신 포설, 보행로 횡단 구간 경사형 케이블 프로텍터 시공',
    vehicleNoteKo: '발전차·설비 트럭 외곽 순환도로 진입',
  },
  {
    step: 7,
    dDayTag: 'D-3',
    phaseKo: '7단계 (D-3) · 주무대·트러스 타워·종합통제실 대형 구조물 시공',
    detailKo: '볼트 아치 트러스 지붕, 라인어레이 타워, 대형 LED 스크린, 종합통제실·전시관 시공 및 구조·풍압 안전 점검',
    vehicleNoteKo: '크레인·대형 카고트럭 반경 통제',
  },
  {
    step: 8,
    dDayTag: 'D-2',
    phaseKo: '8단계 (D-2) · 판매·체험관·푸드트럭·화장실·휴식시설 반입 설치',
    detailKo: '부스·체험관 설치 및 웨이트 고정, 푸드트럭 정위치 도킹, 모듈형 화장실·수유실·노약자 쉼터·그늘막 설치',
    vehicleNoteKo: '물류 차량 일방통행 반입 후 외곽 이동',
  },
  {
    step: 9,
    dDayTag: 'D-1 AM',
    phaseKo: '9단계 (D-1 오전) · 무장애 경사로·점자블록·소방시설·유도사인 마감',
    detailKo: '휠체어 관람석·경사로·점자블록 시공, 소방시설·응급의료소·대피소 표지, 투광등 타워·바리케이드·분리수거함 배치',
    vehicleNoteKo: '행사장 내부 일반 차량 전면 통제 전환',
  },
  {
    step: 10,
    dDayTag: 'D-1 PM',
    phaseKo: '10단계 (D-1 오후) · 지자체·소방·경찰·전기·가스 합동 현장점검 및 리허설',
    detailKo: '행안부 개최 전 안전점검표 기준 현장 합동점검, 누전·가스누출·경사로 기울기 실측, 비상 방송·구급차 기동 리허설',
    vehicleNoteKo: '응급 구급차·소방차 비상 진출입 기동 테스트',
  },
  {
    step: 11,
    dDayTag: 'D-Day',
    phaseKo: '11단계 (D-Day) · 본 행사 시간대별 인파 밀도·기상 실시간 통제 운영',
    detailKo: '개장 검표 → 공연 피크 구역 밀집 모니터링 → 기상 풍속·폭염 대응 → 폐장 시차 퇴장 및 외부 셔틀 승하차 유도',
    vehicleNoteKo: '응급차량 외 내부 차량 진입 엄금',
  },
  {
    step: 12,
    dDayTag: 'D+1~D+3',
    phaseKo: '12단계 (D+1 ~ D+3) · 완전 퇴장 확인 후 순차 철거·폐기물 정산·원상복구',
    detailKo: '관람객 100% 퇴장 확인 후 철거 개시 → 소품·부스 해체(D+1) → 전력 차단·대형 무대 해체(D+2) → 부지 원상복구·결산(D+3)',
    vehicleNoteKo: '관람객 퇴장 종료 선언 이후 물류 차량 단계별 진입',
  },
];

export const DEFAULT_STATUTORY_CHECKLIST: StatutorySafetyChecklistState = {
  usesMountainOrWaterSurface: false,
  usesFirePyroOilOrGas: true,
  safetyManagementPlanPrepared: false,
  localGovFirePoliceConsulted: false,
  stage1PlanningChecked: true,
  stage2PreEventInspectionDone: false,
  stage3LiveOpsManualReady: true,
  stage4EgressDispersalPlanReady: true,
  stage5IncidentResponseReady: false,
  reviewStatuses: {
    art73_9_plan: 'pending_review',
    agency_consult: 'pending_review',
    fire_gas_audit: 'in_consultation',
    barrier_free_slope: 'verified',
    stage_wind_structural: 'verified',
  },
};

export const EVIDENCE_GROUNDED_15_RULES_PROMPT =
  '[실제 자료 기반 AI 행사장 설계·분석 15대 준칙]\n' +
  '1. 확인되지 않은 법적 기준·단가·수용인원·처리속도를 임의로 만들어 단정하지 않는다.\n' +
  '2. 공식 기준(OFFICIAL), 실측값(OBSERVED), 산식 추정치(ESTIMATED), 시뮬레이션 가정값(ASSUMPTION), 자료 부족(MISSING)을 구분해 표시한다.\n' +
  '3. 하루 누적 방문객(연인원)과 시간대별 동시 재실 인원(occupancy)을 절대 혼동하지 않는다.\n' +
  '4. 총면적만으로 수용 가능 인원을 단정하지 않고 구조물·설비 점유 면적을 제외한 순수 유효 가용 면적을 사용한다.\n' +
  '5. 대기열 면적(푸드·화장실·검표줄)과 이동·비상 대피 통로 면적을 겹쳐 계산하지 않는다.\n' +
  '6. 장애인·노인·유모차 동반자·어린이·반려동물 동반 관람객의 보행 폭·경사로·휴식·회전반경 조건을 별도 확인한다.\n' +
  '7. 응급차량·소방차 접근 경로와 관람객 주 동선의 충돌 여부를 반드시 점검한다.\n' +
  '8. 전력(kW)·급수·오수·배수·폐기물·물류 차량 동선을 공간 설계 항목에 포함한다.\n' +
  '9. 우천·강풍·폭염·야간 조도 저하 시나리오에서 취약해지는 시설(천막·에어바운스·배수·전력)을 표시한다.\n' +
  '10. 예산은 지역·계절·설치 조건에 따라 달라지므로 실제 견적 미입력 시 범위·가정값(ASSUMPTION)으로 제시한다.\n' +
  '11. 안전 관련 법령·매뉴얼 해당 가능성이 있으면 자동 승인 판정을 내리지 않고 관할 지자체·소방·경찰 확인 필요 항목으로 안내한다.\n' +
  '12. 3D 배치 결과는 시각적 표현일 뿐 실제 구조·전기·소방 안전 인증을 대체하지 않음을 명시한다.\n' +
  '13. 데이터 부족으로 판단할 수 없는 항목은 평균 점수로 가리지 않고 판정 보류 및 추가 필요 자료를 안내한다.\n' +
  '14. 설계안 설명 순서는 [행사 개요 → 하드 제약 확인 → 조닝·동선 근거 → 정량 지표 → 위험·취약점 → 대안 비교 → 한계·추가 확인 자료]를 따른다.\n' +
  '15. 최종 출력에는 현장 실측·설계 전문가·관할기관 검토가 필요하다는 안내를 포함한다.';

function matchReferenceSheetForSubtype(subtype: FacilitySubtype): ReferenceAssetSheet {
  const found = REFERENCE_ASSET_SHEETS.find((s) => s.mappedSubtypes.includes(subtype));
  return found || REFERENCE_ASSET_SHEETS[1];
}

/**
 * Returns 6-language localized 3D Reference Asset Sheets for KnowledgeBaseView
 */
export function getLocalizedReferenceAssetSheets(lang: Language): ReferenceAssetSheet[] {
  if (lang === 'ko') return REFERENCE_ASSET_SHEETS;
  return REFERENCE_ASSET_SHEETS.map((sheet) => {
    const mappedNames = sheet.mappedSubtypes
      .map((st) => SUBTYPE_SIMPLE_LABELS[st]?.[lang] || st)
      .join(' · ');
    const catGroup = tr6(
      lang,
      sheet.categoryGroupKo,
      sheet.titleEn,
      `3D標準カタログ · ${mappedNames}`,
      `3D标准资产目录 · ${mappedNames}`,
      `Catálogo 3D Estándar · ${mappedNames}`,
      `Catalogue 3D Standard · ${mappedNames}`,
    );
    const titleLoc =
      lang === 'en'
        ? sheet.titleEn
        : `${mappedNames} (${sheet.id.replace('ref-', '').toUpperCase()})`;
    const featuresLoc = sheet.mappedSubtypes.map((st) => {
      const label = SUBTYPE_SIMPLE_LABELS[st]?.[lang] || st;
      return tr6(
        lang,
        '',
        `Standardized 3D BIM/CAD module for ${label} with zero-overlap clearance`,
        `「${label}」標準3Dモジュール（離隔クリアランス・バリアフリー対応）`,
        `“${label}”标准3D构件（含零重叠净距与无障碍坡道参数）`,
        `Módulo 3D estandarizado para ${label} con margen cero solapamiento`,
        `Module 3D standardisé pour ${label} avec dégagement sans chevauchement`,
      );
    });
    const ruleLoc = tr6(
      lang,
      sheet.designRuleKo,
      `Separates queue apron depth (2.5–4.0m), power/water utility routing, and step-free emergency clearance for ${mappedNames}.`,
      `${mappedNames}の前面待機ポケット（2.5〜4.0m）・電力給排水ルート・非常通路クリアランスを分離確保します。`,
      `为${mappedNames}预留2.5–4.0m前区排队缓冲、水电管线隔离及无障碍应急净宽。`,
      `Asegura bolsillo frontal de cola (2.5–4.0m), servicios eléctricos/agua y despeje de emergencia sin escalones para ${mappedNames}.`,
      `Garantit une zone tampon de file (2,5–4,0m), l’isolation des réseaux et le dégagement d’urgence sans marche pour ${mappedNames}.`,
    );
    return {
      ...sheet,
      titleKo: titleLoc,
      categoryGroupKo: catGroup,
      visualFeaturesKo: featuresLoc,
      designRuleKo: ruleLoc,
      spawnPresets: sheet.spawnPresets.map((sp) => {
        const stName = SUBTYPE_SIMPLE_LABELS[sp.subtype]?.[lang] || sp.labelEn;
        const zoneName = pickL6(lang, ZONE_TARGET_I18N[sp.defaultZone]);
        const lbl = tr6(
          lang,
          sp.labelKo,
          sp.labelEn,
          `${stName}を追加（${zoneName}）`,
          `添加${stName}（${zoneName}）`,
          `Añadir ${stName} (${zoneName})`,
          `Ajouter ${stName} (${zoneName})`,
        );
        return {
          ...sp,
          labelKo: lbl,
          labelEn: lbl,
        };
      }),
    };
  });
}

/**
 * Generates PDF Section 11-1 Standardized 3D Asset Metadata for any live Facility
 */
export function getFacilityAssetMetadata(
  facility: Facility,
  config: EventConfig,
  snapshot: SimulationSnapshot,
  lang: Language = 'ko',
): FacilityAssetMetadata {
  const sheet = matchReferenceSheetForSubtype(facility.subtype);
  const footprintM2 = Math.round(facility.dimensions.width * facility.dimensions.depth * 10) / 10;

  let electricityKw = 1.5;
  let waterRequired = false;
  let wastewaterRequired = false;
  let wasteStreams = 1;
  let soundLevelNoteKo = tr6(
    lang,
    '일반 생활 소음 범위',
    'Standard ambient sound range',
    '一般生活騒音範囲',
    '常规环境声级范围',
    'Rango acústico ambiental estándar',
    'Niveau sonore ambiant standard',
  );
  let serviceTimeSec = 45;
  let parallelServersC = 2;
  let frontQueueM = 2.5;
  let serviceVehicleAccess = false;
  let staffRequired = 2;

  switch (facility.subtype) {
    case 'main_stage':
      electricityKw = 85;
      soundLevelNoteKo = tr6(
        lang,
        '고출력 라인어레이 음향 (주변 안내소·의무실 이격 필요)',
        'High-SPL line-array PA (buffer medical & info desks)',
        '高出力ラインアレイ音響（案内所・救護所の離隔が必要）',
        '高声压线阵列音响（需与问询台及急救站保持间距）',
        'Audio line-array de alta potencia (separar de info y puesto médico)',
        'Sonorisation line-array haute puissance (éloigner accueil et secours)',
      );
      serviceTimeSec = 0;
      parallelServersC = 1;
      frontQueueM = 8.0;
      serviceVehicleAccess = true;
      staffRequired = 12;
      break;
    case 'secondary_stage':
      electricityKw = 38;
      soundLevelNoteKo = tr6(
        lang,
        '중출력 공연·중계 음향 (주무대와 지향각 분리)',
        'Medium-SPL stage audio (isolate axis from main stage)',
        '中出力ステージ音響（メインステージと指向角を分離）',
        '中功率演出音响（与主舞台声轴错开）',
        'Audio escénico medio (aislar eje acústico del escenario principal)',
        'Sonorisation moyenne puissance (isoler l’axe de la scène principale)',
      );
      serviceTimeSec = 0;
      parallelServersC = 1;
      frontQueueM = 5.0;
      serviceVehicleAccess = true;
      staffRequired = 6;
      break;
    case 'foh_control':
      electricityKw = 12;
      soundLevelNoteKo = tr6(
        lang,
        '음향·조명 콘솔 계측 지점',
        'FOH audio & lighting metering point',
        '音響・照明コンソール計測地点',
        '音响与灯光控台监测点',
        'Punto de control acústico e iluminación FOH',
        'Point de régie son et lumière FOH',
      );
      serviceTimeSec = 0;
      parallelServersC = 1;
      frontQueueM = 1.5;
      staffRequired = 4;
      break;
    case 'food_truck':
      electricityKw = 9.5;
      waterRequired = true;
      wastewaterRequired = true;
      wasteStreams = 3;
      soundLevelNoteKo = tr6(
        lang,
        '조리 환기팬·결제 호명 소음',
        'Cooking hood & order callout noise',
        '調理換気・呼び出し音',
        '烹饪排风与叫号声',
        'Ruido de extracción y llamado de pedidos',
        'Bruit de hotte et d’appel des commandes',
      );
      serviceTimeSec = 75;
      parallelServersC = 2;
      frontQueueM = 4.0;
      serviceVehicleAccess = true;
      staffRequired = 3;
      break;
    case 'food_stall':
    case 'beer_garden':
      electricityKw = facility.subtype === 'beer_garden' ? 14 : 6.5;
      waterRequired = true;
      wastewaterRequired = true;
      wasteStreams = 4;
      serviceTimeSec = 65;
      parallelServersC = facility.subtype === 'beer_garden' ? 4 : 2;
      frontQueueM = 3.5;
      serviceVehicleAccess = true;
      staffRequired = facility.subtype === 'beer_garden' ? 5 : 3;
      break;
    case 'restroom_bank':
      electricityKw = 3.5;
      waterRequired = true;
      wastewaterRequired = true;
      wasteStreams = 2;
      serviceTimeSec = 95;
      parallelServersC = Math.max(4, Math.floor(facility.dimensions.width / 2.0));
      frontQueueM = 3.2;
      serviceVehicleAccess = true;
      staffRequired = 2;
      break;
    case 'medical_station':
      electricityKw = 5.0;
      waterRequired = true;
      wastewaterRequired = false;
      wasteStreams = 2;
      soundLevelNoteKo = tr6(
        lang,
        '정숙 구역 권장 (주무대 고소음 이격)',
        'Quiet triage zone advised (buffer from stage SPL)',
        '静穏ゾーン推奨（大音量ステージから離隔）',
        '建议保持安静区域（远离高分贝主舞台）',
        'Zona tranquila recomendada (alejar del escenario)',
        'Zone calme recommandée (éloigner de la scène)',
      );
      serviceTimeSec = 300;
      parallelServersC = 3;
      frontQueueM = 3.5;
      serviceVehicleAccess = true;
      staffRequired = 4;
      break;
    case 'main_entrance':
    case 'secondary_entrance':
    case 'wristband_hub':
      electricityKw = 4.0;
      serviceTimeSec = 12;
      parallelServersC = Math.max(3, Math.floor(Math.max(facility.dimensions.width, facility.dimensions.depth) / 2.8));
      frontQueueM = 5.0;
      serviceVehicleAccess = true;
      staffRequired = Math.max(4, parallelServersC + 1);
      break;
    case 'ticket_info':
    case 'multilingual_info':
      electricityKw = 2.5;
      serviceTimeSec = 55;
      parallelServersC = 2;
      frontQueueM = 3.0;
      staffRequired = 2;
      break;
    case 'play_zone':
      electricityKw = 7.5;
      soundLevelNoteKo = tr6(
        lang,
        '에어바운스 상시 송풍기 및 놀이 소음',
        'Continuous air-blower & play zone sound',
        'エア遊具の常時送風機および遊び音',
        '充气设施持续鼓风机与游乐声',
        'Soplador continuo de inflables y sonido infantil',
        'Soufflerie continue des jeux gonflables',
      );
      serviceTimeSec = 180;
      parallelServersC = 8;
      frontQueueM = 3.0;
      staffRequired = 4;
      break;
    case 'mist_cooling':
      electricityKw = 3.2;
      waterRequired = true;
      serviceTimeSec = 0;
      parallelServersC = 1;
      frontQueueM = 2.0;
      staffRequired = 1;
      break;
    case 'eco_station':
      electricityKw = 0.8;
      waterRequired = true;
      wastewaterRequired = true;
      wasteStreams = 4;
      serviceTimeSec = 20;
      parallelServersC = 4;
      frontQueueM = 2.0;
      serviceVehicleAccess = true;
      staffRequired = 2;
      break;
    case 'wheelchair_viewing':
      electricityKw = 1.2;
      serviceTimeSec = 0;
      parallelServersC = 6;
      frontQueueM = 2.5;
      staffRequired = 2;
      break;
    case 'access_ramp':
    case 'tactile_paving':
      electricityKw = facility.subtype === 'access_ramp' ? 0.3 : 0;
      serviceTimeSec = 0;
      parallelServersC = 2;
      frontQueueM = 1.8;
      staffRequired = facility.subtype === 'access_ramp' ? 1 : 0;
      break;
    case 'senior_rest':
    case 'family_lounge':
      electricityKw = facility.subtype === 'family_lounge' ? 4.5 : 3.5;
      waterRequired = true;
      wastewaterRequired = facility.subtype === 'family_lounge';
      serviceTimeSec = 120;
      parallelServersC = 4;
      frontQueueM = 2.5;
      staffRequired = 2;
      break;
    case 'fire_safety_unit':
    case 'emergency_shelter':
      electricityKw = facility.subtype === 'emergency_shelter' ? 2.5 : 1.0;
      waterRequired = facility.subtype === 'fire_safety_unit';
      serviceTimeSec = 0;
      parallelServersC = 4;
      frontQueueM = 3.5;
      serviceVehicleAccess = true;
      staffRequired = facility.subtype === 'emergency_shelter' ? 3 : 2;
      break;
    case 'accessible_parking':
    case 'shuttle_stop':
      electricityKw = 2.0;
      serviceTimeSec = 30;
      parallelServersC = 3;
      frontQueueM = 4.0;
      serviceVehicleAccess = true;
      staffRequired = 2;
      break;
    case 'experience_pavilion':
    case 'exhibition_hall':
      electricityKw = facility.subtype === 'exhibition_hall' ? 11.0 : 8.5;
      waterRequired = facility.subtype === 'experience_pavilion';
      serviceTimeSec = 90;
      parallelServersC = 6;
      frontQueueM = 3.5;
      serviceVehicleAccess = true;
      staffRequired = 4;
      break;
    case 'volunteer_center':
    case 'control_room':
      electricityKw = facility.subtype === 'control_room' ? 14.0 : 4.5;
      waterRequired = facility.subtype === 'volunteer_center';
      serviceTimeSec = 0;
      parallelServersC = 2;
      frontQueueM = 2.0;
      serviceVehicleAccess = true;
      staffRequired = facility.subtype === 'control_room' ? 6 : 3;
      break;
    case 'beam_projector':
      electricityKw = 3.8;
      waterRequired = false;
      serviceTimeSec = 0;
      parallelServersC = 2;
      frontQueueM = 3.5;
      serviceVehicleAccess = false;
      staffRequired = 2;
      break;
    default:
      electricityKw = 2.0;
      serviceTimeSec = 60;
      parallelServersC = 2;
      frontQueueM = 2.5;
      staffRequired = 2;
      break;
  }

  const bp = SUBTYPE_BLUEPRINTS[facility.subtype];
  const networkRequired = [
    'main_stage',
    'beam_projector',
    'foh_control',
    'control_room',
    'medical_station',
    'ticket_info',
    'multilingual_info',
    'wristband_hub',
    'food_truck',
    'food_stall',
    'goods_shop',
    'exhibition_hall',
    'experience_pavilion',
    'volunteer_center',
    'locker_charging',
  ].includes(facility.subtype);
  const lightingLuxMin =
    facility.subtype === 'control_room' || facility.subtype === 'medical_station'
      ? 250
      : facility.subtype === 'access_ramp' || facility.category === 'entrance'
        ? 120
        : 75;
  const emergencyRoleKo =
    facility.category === 'medical' || facility.subtype === 'fire_safety_unit'
      ? '초기 응급처치·화재 진압 및 구급차 인계 거점'
      : facility.subtype === 'emergency_shelter' || facility.subtype === 'rain_canopy'
        ? '악천후·돌발 밀집 시 관람객 분산 대피 거점'
        : facility.subtype === 'control_room'
          ? '전 구역 CCTV·풍속계 관제 및 비상 대피 방송 지휘'
          : facility.category === 'entrance'
            ? '비상 시 검표 개방 및 일방통행 대피 출구 전환'
            : '비상 대피 발령 시 대기열 즉시 해산 및 통로 확보';

  const serviceRatePerMinMu =
    serviceTimeSec > 0
      ? Math.round(((60 / serviceTimeSec) * parallelServersC) * 10) / 10
      : 0;
  const activeQueue = snapshot.facilityQueues[facility.id] || 0;
  const arrivalRatePerMinLambda =
    serviceRatePerMinMu > 0
      ? Math.round((serviceRatePerMinMu * Math.min(1.35, 0.45 + activeQueue / 35)) * 10) / 10
      : 0;

  return {
    assetId: `${facility.subtype}_${facility.id}`,
    category: facility.category,
    subtype: facility.subtype,
    nameKo: getFacilityDisplayName(facility, lang),
    referenceSheetId: sheet.id,
    referenceImageUrl: sheet.imageUrl,
    geometry: {
      lengthM: facility.dimensions.width,
      widthM: facility.dimensions.depth,
      heightM: facility.dimensions.height,
      footprintM2,
    },
    clearance: {
      frontQueueM,
      sideM: 1.2,
      rearM: 1.5,
      serviceVehicleAccess,
    },
    accessibility: {
      wheelchairAccess:
        facility.accessibility.wheelchairAccessible && config.accessibility.stepFreeRoutes,
      rampRequired: facility.dimensions.height > 0.2,
      minRouteWidthM: config.accessibility.wideCorridors ? 1.8 : 1.2,
    },
    utilities: {
      electricityKw,
      waterRequired,
      wastewaterRequired,
      wasteStreams,
      soundLevelNoteKo,
      networkRequired,
      lightingLuxMin,
    },
    operations: {
      openTime: config.startTime,
      closeTime: config.endTime,
      serviceTimeSec,
      parallelServersC,
      serviceRatePerMinMu,
      arrivalRatePerMinLambda,
      staffRequired,
      queueAreaM2: Math.round(facility.dimensions.width * frontQueueM * 10) / 10,
      emergencyRoleKo,
    },
    cost: {
      unitCostKrw: facility.budgetExcluded ? 0 : Math.round(facility.cost * KRW_PER_USD),
      costUnit: 'event_package',
      includesSetup: !facility.budgetExcluded,
      includesStaff: false,
      includesPower: false,
      priceReliability: 'ASSUMPTION',
    },
    source: {
      label: 'ASSUMPTION',
      referenceTitle:
        bp?.sourceStd ||
        (lang === 'ko'
          ? `${sheet.titleKo} + 표준 3D 자산 메타데이터(11-1)`
          : `${sheet.titleEn} (Spec 11-1)`),
      checkedDate: '2026-11-01',
      version: bp?.version || 'v2026.2',
      modelSyncVerified: true,
      notes: tr6(
        lang,
        `단일 규격 원본(SUBTYPE_BLUEPRINTS ${bp?.version || 'v2026.2'})으로 3D 모델(${facility.dimensions.width}×${facility.dimensions.depth}×${facility.dimensions.height}m)과 DB 치수가 1:1 동기화됩니다.`,
        `3D mesh (${facility.dimensions.width}×${facility.dimensions.depth}×${facility.dimensions.height}m) and DB dimensions are 1:1 synced via SUBTYPE_BLUEPRINTS (${bp?.version || 'v2026.2'}).`,
        `単一規格原票（${bp?.version || 'v2026.2'}）により3DモデルとDB寸法が1:1で同期しています。`,
        `通过单一规格源（${bp?.version || 'v2026.2'}）实现3D模型尺寸与数据库参数1:1严格同步。`,
        `Modelo 3D y dimensiones BD sincronizados 1:1 mediante SUBTYPE_BLUEPRINTS (${bp?.version || 'v2026.2'}).`,
        `Modèle 3D et dimensions BD synchronisés 1:1 via SUBTYPE_BLUEPRINTS (${bp?.version || 'v2026.2'}).`,
      ),
    },
  };
}

/**
 * Explicit calculation conditions & formula breakdown for Peak Congestion Density (e.g. 3.64 p/m²)
 * Addresses user feedback: "혼잡도 3.64명/㎡의 산정 조건이 부족함" & "현재 수치의 계산 근거와 데이터 출처가 충분히 드러나지 않음"
 */
export function computePeakDensityFormulaBreakdown(
  config: EventConfig,
  facilities: Facility[],
  snapshot: SimulationSnapshot,
  summary: LayoutMetricsSummary,
) {
  const simultaneousPax = Math.round(snapshot.activeAgentCount * snapshot.simulatedScaleFactor);
  const avgNetDensity =
    summary.usableAreaSqm > 0
      ? Math.round((simultaneousPax / summary.usableAreaSqm) * 100) / 100
      : 0;
  const topHotspot = snapshot.bottlenecks[0];
  const gridCellAreaM2 = 25; // 5m x 5m spatial grid cell
  const estimatedHotspotPax = Math.round(snapshot.peakDensity * gridCellAreaM2);
  const queueTotalPax = Object.values(snapshot.facilityQueues).reduce((s, q) => s + q, 0);

  return {
    peakDensityValue: Number(snapshot.peakDensity.toFixed(2)),
    timeLabel: snapshot.currentTimeLabel,
    phaseLabelKo: snapshot.phase.labelKo || snapshot.phase.label,
    simultaneousPax,
    targetPeakPax: config.expectedAttendance,
    grossAreaSqm: summary.venueAreaSqm,
    occupiedAreaSqm: summary.occupiedAreaSqm,
    usableAreaSqm: summary.usableAreaSqm,
    avgNetDensity,
    gridResolutionDesc: '5m × 5m 국소 보행 격자 (25m² 셀 단위 최대 밀집 셀)',
    estimatedHotspotPax,
    hotspotFacilityName: topHotspot?.facilityName || '주무대 전면 관람·전환 구역',
    queueTotalPax,
    formulaText:
      '국소 피크 밀도(명/m²) = max_cell [ (셀 내 보행·관람 체류 인원 + 인접 대기열 중첩 인원) ÷ 유효 보행 셀 면적(25m²) ]',
    sourceText:
      '군중밀도 등급 기준: 국제 군중안전 가이드라인(Fruin LoS / Green Guide) 참고 (여유 ≤2.0 · 주의 2.1~4.0 · 위험 ≥4.5명/m²) + 시뮬레이션 가정(ASSUMPTION)',
    facilityCount: facilities.length,
  };
}

/**
 * Quantitative Barrier-Free Audit beyond simple ON/OFF switches
 * Addresses user feedback: "접근성 ON/OFF만으로 실제 무장애 설계를 검증하기 어려움"
 */
export function computeQuantitativeBarrierFreeAudit(
  config: EventConfig,
  facilities: Facility[],
) {
  const insideFacilities = facilities.filter(
    (f) => f.subtype !== 'parking_lot' && f.subtype !== 'accessible_parking' && f.subtype !== 'shuttle_stop',
  );
  const accessibleCount = insideFacilities.filter(
    (f) => f.accessibility.wheelchairAccessible && config.accessibility.stepFreeRoutes,
  ).length;
  const stepFreeRatePct =
    insideFacilities.length > 0 ? Math.round((accessibleCount / insideFacilities.length) * 100) : 100;

  const corridorClearWidthM = config.accessibility.wideCorridors ? 5.8 : 3.2;
  const turningRadiusPass = corridorClearWidthM >= 1.8 && config.accessibility.stepFreeRoutes;

  const restNodes = facilities.filter((f) =>
    ['rest_plaza', 'family_lounge', 'senior_rest', 'rain_canopy'].includes(f.subtype),
  );
  const maxContinuousWalkM =
    restNodes.length >= 3
      ? 42
      : restNodes.length === 2
        ? 58
        : restNodes.length === 1
          ? 78
          : Math.round(Math.hypot(config.venueWidth, config.venueDepth) * 0.55);

  const mainGate =
    facilities.find((f) => f.subtype === 'main_entrance') ||
    facilities.find((f) => f.category === 'entrance');
  const accParking =
    facilities.find((f) => f.subtype === 'accessible_parking') ||
    facilities.find((f) => f.subtype === 'parking_lot');
  const parkingToGateDistM =
    mainGate && accParking
      ? Math.round(
          Math.hypot(
            mainGate.position.x - accParking.position.x,
            mainGate.position.z - accParking.position.z,
          ),
        )
      : config.accessibility.accessibleParking
        ? 28
        : 95;

  const wheelchairViewingCount = facilities.filter((f) => f.subtype === 'wheelchair_viewing').length;
  const rampUnitCount = facilities.filter((f) => f.subtype === 'access_ramp').length;
  const tactileCount = facilities.filter((f) => f.subtype === 'tactile_paving').length;
  const accessibleWcCount = config.accessibility.accessibleRestrooms
    ? facilities.filter((f) => f.subtype === 'restroom_bank').length
    : 0;

  return {
    stepFreeRatePct,
    accessibleCount,
    totalInsideCount: insideFacilities.length,
    corridorClearWidthM,
    rampSlopeSpec: config.accessibility.stepFreeRoutes ? '≤ 1/12 (4.8° 이하 충족)' : '미적용 (단차 발생 우려)',
    turningRadiusPass,
    maxContinuousWalkM,
    walkRestPass: maxContinuousWalkM <= 65,
    parkingToGateDistM,
    parkingDistPass: parkingToGateDistM <= 55 && config.accessibility.accessibleParking,
    wheelchairViewingCount,
    rampUnitCount,
    tactileCount,
    accessibleWcCount,
  };
}

/**
 * Computes PDF Section 4-2 & 11-2 Crowd Time-Interval Record
 */
export function computeCrowdRecord11_2(
  config: EventConfig,
  snapshot: SimulationSnapshot,
  calibration: FieldCalibrationSample,
  lang: Language = 'ko',
) {
  const simultaneousOccupancy = Math.round(
    snapshot.activeAgentCount * snapshot.simulatedScaleFactor,
  );
  const dailyCumulativeVisitors = Math.round(config.expectedAttendance * 1.65);

  const phaseId = snapshot.phase.id;
  let arrivals15m = Math.round(simultaneousOccupancy * 0.08);
  let departures15m = Math.round(simultaneousOccupancy * 0.05);
  if (phaseId === 'arrival') {
    arrivals15m = Math.round(config.expectedAttendance * 0.18);
    departures15m = Math.round(config.expectedAttendance * 0.02);
  } else if (phaseId === 'pre_show' || phaseId === 'headline_show') {
    arrivals15m = Math.round(config.expectedAttendance * 0.06);
    departures15m = Math.round(config.expectedAttendance * 0.03);
  } else if (phaseId === 'egress') {
    arrivals15m = Math.round(config.expectedAttendance * 0.01);
    departures15m = Math.round(simultaneousOccupancy * 0.34);
  }

  const latestPoint =
    snapshot.timelineSeries[
      Math.min(
        snapshot.timelineSeries.length - 1,
        Math.max(0, Math.floor(snapshot.progress * snapshot.timelineSeries.length)),
      )
    ] || snapshot.timelineSeries[0];

  const stageShare = (latestPoint?.stageZoneShare ?? 40) / 100;
  const foodShare = (latestPoint?.foodZoneShare ?? 30) / 100;
  const boothShare = (latestPoint?.boothZoneShare ?? 30) / 100;

  return {
    eventId: config.eventName.replace(/\s+/g, '_').toLowerCase(),
    intervalLabel: tr6(
      lang,
      `${snapshot.currentTimeLabel} (15분 구간)`,
      `${snapshot.currentTimeLabel} (15-min window)`,
      `${snapshot.currentTimeLabel}（15分区分）`,
      `${snapshot.currentTimeLabel}（15分钟时段）`,
      `${snapshot.currentTimeLabel} (tramo 15 min)`,
      `${snapshot.currentTimeLabel} (tranche 15 min)`,
    ),
    dailyCumulativeVisitors,
    simultaneousOccupancy,
    peakTargetSimultaneous: config.expectedAttendance,
    arrivals15m,
    departures15m,
    zoneOccupancy: {
      stageAndSeating: Math.round(simultaneousOccupancy * stageShare),
      foodAndRest: Math.round(simultaneousOccupancy * foodShare),
      boothsAndCorridors: Math.round(simultaneousOccupancy * boothShare),
    },
    countMethod: calibration.enabled ? 'gate_counter_calibrated' : 'simulation_assumption',
    reliabilityLabel: (calibration.enabled ? 'OBSERVED' : 'ASSUMPTION') as DataReliabilityLabel,
  };
}

/**
 * Evaluates Statutory Art. 73-9 Triggers, Site-Wide Utilities, and the 8-Domain Non-Averaged Confidence Verdict
 */
export function evaluateStatutoryAndEightDomains(
  config: EventConfig,
  facilities: Facility[],
  snapshot: SimulationSnapshot,
  summary: LayoutMetricsSummary,
  safetyAudit: SpatialSafetyAudit,
  checklist: StatutorySafetyChecklistState,
  calibration: FieldCalibrationSample,
  weatherScenario: WeatherScenarioId,
  lang: Language = 'ko',
) {
  void RELIABILITY_BADGE_I18N;
  const allMeta = facilities.map((f) => getFacilityAssetMetadata(f, config, snapshot, lang));
  const totalPowerKw = Math.round(allMeta.reduce((acc, m) => acc + m.utilities.electricityKw, 0) * 10) / 10;
  const peakPowerWithMarginKw = Math.round(totalPowerKw * 1.25 * 10) / 10;
  const recommendedGeneratorUnits = Math.max(1, Math.ceil(peakPowerWithMarginKw / 75));
  const waterFacilityCount = allMeta.filter((m) => m.utilities.waterRequired).length;
  const wastewaterFacilityCount = allMeta.filter((m) => m.utilities.wastewaterRequired).length;
  const recommendedWasteBins = Math.max(8, Math.ceil(config.expectedAttendance / 250));
  const totalStaffRequired = allMeta.reduce((acc, m) => acc + m.operations.staffRequired, 0);

  const hasFoodTruckOrCooking = facilities.some(
    (f) => f.subtype === 'food_truck' || f.subtype === 'food_stall' || f.subtype === 'beer_garden',
  );
  const isWaterfrontOrHill =
    config.venueShape === 'linear_park' || checklist.usesMountainOrWaterSurface;
  const usesFireOrGas = checklist.usesFirePyroOilOrGas || hasFoodTruckOrCooking;
  const peakOver1000 = config.expectedAttendance >= 1000;

  const statutoryReasonsKo: string[] = [];
  if (peakOver1000) {
    statutoryReasonsKo.push(
      tr6(
        lang,
        `순간 최대 관람객 ${config.expectedAttendance.toLocaleString()}명 (시행령 제73조의9 기준 1,000명 이상 해당 가능)`,
        `Peak simultaneous attendance ${config.expectedAttendance.toLocaleString()} (>=1,000 threshold under Safety Decree Art. 73-9)`,
        `瞬間最大来場者 ${config.expectedAttendance.toLocaleString()}名（1,000名以上の安全管理計画対象に該当する可能性）`,
        `瞬时最大观众 ${config.expectedAttendance.toLocaleString()}人（达到1,000人以上安全管理计划适用门槛）`,
        `Aforo simultáneo máximo ${config.expectedAttendance.toLocaleString()} (>=1.000 asistentes sujeto a plan oficial de seguridad)`,
        `Affluence simultanée max. ${config.expectedAttendance.toLocaleString()} (>=1 000 personnes soumise à plan de sécurité officiel)`,
      ),
    );
  }
  if (isWaterfrontOrHill) {
    statutoryReasonsKo.push(
      tr6(
        lang,
        '수변·산지 인접 장소 개최 조건 해당 가능',
        'Waterfront or sloped/hillside site safety review trigger',
        '水辺・山地隣接会場の安全審査条件に該当する可能性',
        '符合滨水或山地毗邻场地的专项安全审查条件',
        'Condición de recinto ribereño o en pendiente sujeta a revisión',
        'Site riverain ou en relief soumis à revue de sécurité spécifique',
      ),
    );
  }
  if (usesFireOrGas) {
    statutoryReasonsKo.push(
      tr6(
        lang,
        '조리 화기·가연성 가스·석유류(발전기/푸드트럭) 사용 조건 해당 가능',
        'Cooking flame, LPG gas, or generator fuel safety inspection trigger',
        '調理火気・可燃性ガス・発電機燃料の使用点検対象に該当する可能性',
        '涉及餐饮明火、可燃气体或发电机燃油消防安全核查条件',
        'Uso de fuego de cocina, gas GLP o combustible de generador sujeto a inspección',
        'Usage d’appareils de cuisson, gaz GPL ou groupes électrogènes soumis à contrôle incendie',
      ),
    );
  }

  const requiresStatutorySafetyPlan = statutoryReasonsKo.length > 0;
  const statutoryPlanUnverified =
    requiresStatutorySafetyPlan &&
    (!checklist.safetyManagementPlanPrepared || !checklist.localGovFirePoliceConsulted);

  const ruleFailCount = safetyAudit.ruleChecks.filter((r) => r.status === 'warning').length;
  const ruleCautionCount = safetyAudit.ruleChecks.filter((r) => r.status === 'caution').length;
  const budgetOverrun = summary.estimatedCost > config.budget;
  const accessibilityComplete =
    config.accessibility.stepFreeRoutes &&
    config.accessibility.wideCorridors &&
    config.accessibility.accessibleRestrooms &&
    config.accessibility.accessibleParking;

  const weatherLoc = WEATHER_SCENARIO_I18N[weatherScenario];
  const weatherName = pickL6(lang, weatherLoc.name);
  const weatherImpact = pickL6(lang, weatherLoc.impact);

  const domains: EightDomainVerificationItem[] = [
    {
      domainId: 'space',
      domainKo: tr6(lang, '1. 공간 활용', '1. Space Utilization', '1. 空間活用', '1. 空间利用', '1. Uso del Espacio', '1. Utilisation de l’Espace'),
      domainEn: 'Space Utilization',
      coreQuestionKo: tr6(
        lang,
        '부지 경계·시설 점유 면적 제외 후 순수 가용 면적이 충분한가?',
        'Is net usable circulation area sufficient after subtracting facility footprints?',
        '施設占有面積を除いた純歩行有効面積は十分か？',
        '扣除设施占地后的净通行可用面积是否充足？',
        '¿Es suficiente el área útil neta tras descontar las estructuras?',
        'La surface utile nette est-elle suffisante hors emprise des structures ?',
      ),
      evidenceDataKo: tr6(
        lang,
        `총 ${summary.venueAreaSqm.toLocaleString()}m² 중 구조물 ${summary.occupiedAreaSqm.toLocaleString()}m² 제외 → 순수 가용 ${summary.usableAreaSqm.toLocaleString()}m²`,
        `Gross ${summary.venueAreaSqm.toLocaleString()}m² - Footprints ${summary.occupiedAreaSqm.toLocaleString()}m² = Net ${summary.usableAreaSqm.toLocaleString()}m²`,
        `総面積 ${summary.venueAreaSqm.toLocaleString()}m² − 構造物 ${summary.occupiedAreaSqm.toLocaleString()}m² ＝ 純有効 ${summary.usableAreaSqm.toLocaleString()}m²`,
        `总面积 ${summary.venueAreaSqm.toLocaleString()}m² − 设施占地 ${summary.occupiedAreaSqm.toLocaleString()}m² ＝ 净可用 ${summary.usableAreaSqm.toLocaleString()}m²`,
        `Bruto ${summary.venueAreaSqm.toLocaleString()}m² − Estructuras ${summary.occupiedAreaSqm.toLocaleString()}m² = Útil ${summary.usableAreaSqm.toLocaleString()}m²`,
        `Brut ${summary.venueAreaSqm.toLocaleString()}m² − Structures ${summary.occupiedAreaSqm.toLocaleString()}m² = Utile ${summary.usableAreaSqm.toLocaleString()}m²`,
      ),
      reliabilityLabel: 'ESTIMATED',
      status: summary.usableAreaSqm >= config.expectedAttendance * 0.9 ? 'pass' : 'review',
      judgmentKo:
        summary.usableAreaSqm >= config.expectedAttendance * 0.9
          ? tr6(lang, '순수 보행·체류 면적 기준 여유 확보', 'Adequate net circulation & standing area secured', '純歩行・滞留面積に十分な余裕を確保', '净步行与驻留空间充足', 'Área neta de circulación adecuada', 'Surface nette de circulation suffisante')
          : tr6(lang, '동시 재실 목표 인원 대비 유효 가용면적 협소 — 시설 축소·인원 분산 필요', 'Tight net area relative to peak target — reduce structures or stagger arrivals', '目標人数に対し有効面積が狭小 — 施設縮小・分散が必要', '相对峰值人数净可用面积偏紧 — 建议精简设施或错峰限流', 'Área útil ajustada frente al aforo pico — reducir módulos o escalonar acceso', 'Surface utile restreinte pour la jauge cible — réduire l’emprise ou échelonner'),
      limitNoteKo: tr6(lang, '실제 현장 지장물(수목·경사·맨홀) 실측 도면 대조 필요', 'Cross-check against surveyed trees, slopes, and utility manholes on site', '現場の樹木・勾配・マンホール実測図との照合が必要', '需对照现场树木、坡度与井盖实测图纸', 'Contrastar con plano topográfico real en campo', 'Vérifier sur plan géomètre réel (arbres, pentes, regards)'),
    },
    {
      domainId: 'flow',
      domainKo: tr6(lang, '2. 보행·비상 동선', '2. Circulation & Egress', '2. 歩行・非常動線', '2. 步行与应急动线', '2. Circulación y Evacuación', '2. Circulation & Évacuation'),
      domainEn: 'Circulation & Egress',
      coreQuestionKo: tr6(
        lang,
        '입장·관람·대기·퇴장 및 응급차량 동선이 충돌 없이 연결되는가?',
        'Are entry, queue, egress, and emergency responder lanes connected without conflict?',
        '入場・待機・退場および救急車両ルートが干渉なく接続されているか？',
        '入场、排队、散场与急救车通道是否无冲突贯通？',
        '¿Se conectan sin conflicto las rutas de entrada, cola, salida y ambulancia?',
        'Les flux d’entrée, d’attente, de sortie et d’urgence sont-ils sans conflit ?',
      ),
      evidenceDataKo: tr6(
        lang,
        `출입구 ${config.entranceCount}개소 · 평균 보행거리 ${summary.avgWalkingDistanceM}m · 동선 규칙 경고 ${ruleFailCount}건`,
        `${config.entranceCount} gates · Avg walk ${summary.avgWalkingDistanceM}m · ${ruleFailCount} rule warning(s)`,
        `出入口 ${config.entranceCount}箇所 · 平均歩行 ${summary.avgWalkingDistanceM}m · 警告 ${ruleFailCount}件`,
        `出入口 ${config.entranceCount}处 · 平均步行 ${summary.avgWalkingDistanceM}m · 动线警告 ${ruleFailCount}项`,
        `${config.entranceCount} puertas · Marcha prom. ${summary.avgWalkingDistanceM}m · ${ruleFailCount} alerta(s)`,
        `${config.entranceCount} portes · Marche moy. ${summary.avgWalkingDistanceM}m · ${ruleFailCount} alerte(s)`,
      ),
      reliabilityLabel: 'ESTIMATED',
      status: ruleFailCount === 0 && config.entranceCount >= 2 ? 'pass' : 'review',
      judgmentKo:
        ruleFailCount === 0 && config.entranceCount >= 2
          ? tr6(lang, '다방향 출입구 및 중앙 비상통로 직결 확인', 'Multi-directional gates & central emergency spine verified', '多方向ゲートおよび中央非常通路の直結を確認', '已确认多向出入口及中央应急走廊贯通', 'Puertas multidireccionales y eje de emergencia verificados', 'Portes multidirectionnelles et axe d’urgence vérifiés')
          : tr6(lang, '출입구 편중 또는 통로 병목 우려 구간 존재 — 분산 게이트 점검 필요', 'Gate imbalance or corridor pinch point detected — review relief gates', 'ゲート偏在またはボトルネック懸念あり — 分散ゲートを点検', '存在出入口偏置或走廊瓶颈风险 — 请核查辅助大门', 'Desequilibrio de puertas o cuello de botella — revisar accesos', 'Déséquilibre des portes ou goulot détecté — vérifier les sorties'),
      limitNoteKo: tr6(lang, '외부 도로 횡단보도·대중교통 정류장 신호주기는 별도 교통영향 확인 필요', 'Verify external crosswalks and transit signal cycles separately', '外部横断歩道・公共交通の信号周期は別途確認が必要', '外部人行横道与公交信号周期需另行核查', 'Verificar cruces peatonales externos y transporte público', 'Vérifier séparément les passages piétons externes et transports'),
    },
    {
      domainId: 'accessibility',
      domainKo: tr6(lang, '3. 무장애 접근성', '3. Barrier-Free Inclusion', '3. バリアフリー配慮', '3. 无障碍可达性', '3. Accesibilidad Universal', '3. Accessibilité Universelle'),
      domainEn: 'Barrier-Free Inclusion',
      coreQuestionKo: tr6(
        lang,
        '휠체어·유모차·고령자가 모든 주요 구역에 단차 없이 도달 가능한가?',
        'Can wheelchair, stroller, and senior visitors reach all key zones step-free?',
        '車椅子・ベビーカー・高齢者が全主要ゾーンへ段差なしで到達できるか？',
        '轮椅、婴儿车与高龄访客能否无台阶顺畅抵达所有核心区域？',
        '¿Pueden sillas de ruedas, cochecitos y mayores llegar sin escalones a cada zona?',
        'Fauteuils roulants, poussettes et seniors accèdent-ils sans marche à toutes les zones ?',
      ),
      evidenceDataKo: tr6(
        lang,
        `무단차 경사로(${config.accessibility.stepFreeRoutes ? 'ON' : 'OFF'}) · 광폭동선(${config.accessibility.wideCorridors ? 'ON' : 'OFF'}) · 장애인화장실·주차(${config.accessibility.accessibleRestrooms && config.accessibility.accessibleParking ? 'ON' : 'OFF'})`,
        `Ramps(${config.accessibility.stepFreeRoutes ? 'ON' : 'OFF'}) · Wide Aisles(${config.accessibility.wideCorridors ? 'ON' : 'OFF'}) · Accessible WC/Parking(${config.accessibility.accessibleRestrooms && config.accessibility.accessibleParking ? 'ON' : 'OFF'})`,
        `スロープ(${config.accessibility.stepFreeRoutes ? 'ON' : 'OFF'}) · 広幅員(${config.accessibility.wideCorridors ? 'ON' : 'OFF'}) · 多目的トイレ・駐車(${config.accessibility.accessibleRestrooms && config.accessibility.accessibleParking ? 'ON' : 'OFF'})`,
        `无障碍坡道(${config.accessibility.stepFreeRoutes ? 'ON' : 'OFF'}) · 宽走廊(${config.accessibility.wideCorridors ? 'ON' : 'OFF'}) · 无障碍卫浴/停车(${config.accessibility.accessibleRestrooms && config.accessibility.accessibleParking ? 'ON' : 'OFF'})`,
        `Rampas(${config.accessibility.stepFreeRoutes ? 'ON' : 'OFF'}) · Pasillos anchos(${config.accessibility.wideCorridors ? 'ON' : 'OFF'}) · WC/Parking PMR(${config.accessibility.accessibleRestrooms && config.accessibility.accessibleParking ? 'ON' : 'OFF'})`,
        `Rampes(${config.accessibility.stepFreeRoutes ? 'ON' : 'OFF'}) · Allées larges(${config.accessibility.wideCorridors ? 'ON' : 'OFF'}) · WC/Parking PMR(${config.accessibility.accessibleRestrooms && config.accessibility.accessibleParking ? 'ON' : 'OFF'})`,
      ),
      reliabilityLabel: 'OFFICIAL',
      status: accessibilityComplete ? 'pass' : 'review',
      judgmentKo: accessibilityComplete
        ? tr6(lang, '장애인등편의법 별표 1 참고 무장애 경사로·회전폭·전용 화장실·주차 반영', 'Step-free ramps, turning radii, accessible restrooms, and ISA bays active', '段差解消スロープ・回転幅・多目的トイレ・専用駐車すべて反映済み', '已完整启用无障碍坡道、回转净宽、专用卫生间与无障碍车位', 'Rampas sin escalones, giros, baños accesibles y estacionamiento PMR activos', 'Rampes sans marche, rayons de rotation, sanitaires et places PMR actifs')
        : tr6(lang, '일부 무장애 옵션 비활성화 — 단차·통로 유효폭 보완 권고', 'Some barrier-free options are off — enable ramps & wide corridors', '一部バリアフリー設定がオフ — スロープ・通路幅の有効化を推奨', '部分无障碍选项未开启 — 建议启用坡道与宽通道', 'Algunas opciones accesibles están apagadas — se recomienda activarlas', 'Certaines options PMR sont désactivées — activation recommandée'),
      limitNoteKo: tr6(lang, '현장 지면 실제 경사도(1/12 이하 여부)는 시공 전 실측 필수', 'Field-verify ramp gradient (<=1:12) prior to opening', '現地勾配（1/12以下）は施工前の実測が必須', '施工前须现场实测坡度（确保≤1/12）', 'Verificar pendiente real (<=1:12) en obra antes de abrir', 'Vérifier la pente réelle (<=1/12) sur site avant ouverture'),
    },
    {
      domainId: 'congestion',
      domainKo: tr6(lang, '4. 시간대별 혼잡', '4. Temporal Congestion', '4. 時間帯別混雑', '4. 分时段拥挤度', '4. Congestión Temporal', '4. Congestion Temporelle'),
      domainEn: 'Temporal Congestion',
      coreQuestionKo: tr6(
        lang,
        '공연 직전·종료 직후 피크 구간에서 과밀 구역이 발생하는가?',
        'Do pre-show or closing egress transitions trigger localized crowding?',
        '開演直前・終演直後のピーク時に過密ゾーンが発生するか？',
        '演出开场前及散场高峰时段是否出现局部过密区？',
        '¿Se generan puntos de hacinamiento antes del show o al cierre?',
        'Des zones de surdensité apparaissent-elles avant le spectacle ou à la sortie ?',
      ),
      evidenceDataKo: tr6(
        lang,
        `현재 피크 ${snapshot.peakDensity.toFixed(2)}명/m² · 병목 시설 ${snapshot.bottlenecks.length}개 · 산정방식: ${calibration.enabled ? '현장보정' : '가정 시뮬레이션'}`,
        `Peak ${snapshot.peakDensity.toFixed(2)} p/m² · ${snapshot.bottlenecks.length} bottleneck(s) · Mode: ${calibration.enabled ? 'Calibrated' : 'Assumed'}`,
        `現在ピーク ${snapshot.peakDensity.toFixed(2)}人/m² · ボトルネック ${snapshot.bottlenecks.length}箇所 · ${calibration.enabled ? '実測補正' : '仮定計算'}`,
        `当前峰值 ${snapshot.peakDensity.toFixed(2)}人/m² · 瓶颈设施 ${snapshot.bottlenecks.length}处 · ${calibration.enabled ? '现场校准' : '假设模拟'}`,
        `Pico ${snapshot.peakDensity.toFixed(2)} pers./m² · ${snapshot.bottlenecks.length} cuello(s) · ${calibration.enabled ? 'Calibrado' : 'Supuesto'}`,
        `Pic ${snapshot.peakDensity.toFixed(2)} pers./m² · ${snapshot.bottlenecks.length} goulot(s) · ${calibration.enabled ? 'Calibré' : 'Simulé'}`,
      ),
      reliabilityLabel: calibration.enabled ? 'OBSERVED' : 'ASSUMPTION',
      status: snapshot.peakDensity < 3.0 && snapshot.bottlenecks.length <= 2 ? 'pass' : 'review',
      judgmentKo:
        snapshot.peakDensity < 3.0
          ? tr6(lang, '설정 가정 하에서 주요 구역 밀집도 관리 범위 이내', 'Modeled zone densities remain within manageable range', '設定条件下で主要ゾーン密度は管理範囲内', '设定假设下各主要分区密度处于可控范围', 'Densidad modelada dentro de rango manejable', 'Densité modélisée dans la plage maîtrisée')
          : tr6(lang, '공연 전환·대기열 집중 구간 밀집 주의 — 시간차 운영·부스 분산 권장', 'Elevated transition density — stagger schedules and disperse booths', '転換時間帯の局所混雑に注意 — 時差運営・ブース分散を推奨', '换场与排队集中区密度偏高 — 建议错峰引导并分散展位', 'Densidad elevada en transiciones — dispersar stands y escalonar horarios', 'Densité élevée aux transitions — disperser les stands et échelonner les flux'),
      limitNoteKo: tr6(lang, '히트맵은 시각 보조 도구이며 실제 인파 안전 인증을 대체하지 않음', 'Heatmaps are visual aids and do not replace live crowd safety certification', 'ヒートマップは視覚補助であり安全認証を代替しない', '热力图仅作视觉辅助，不能替代现场安全认证', 'El mapa de calor es apoyo visual y no sustituye certificación presencial', 'La carte de densité est une aide visuelle et ne remplace pas une homologation'),
    },
    {
      domainId: 'operations',
      domainKo: tr6(lang, '5. 설비·운영 인력', '5. Utilities & Operations', '5. 設備・運営人員', '5. 水电设施与运维人力', '5. Servicios y Operación', '5. Réseaux & Exploitation'),
      domainEn: 'Utilities & Operations',
      coreQuestionKo: tr6(
        lang,
        '대기열 처리율(μ), 운영 인력, 전력(kW)·급배수·폐기물 계획이 충분한가?',
        'Are service rates (μ), staffing, power (kW), water, and waste plans sized adequately?',
        '処理率(μ)・運営スタッフ・電力(kW)・給排水・廃棄物計画は十分か？',
        '排队服务率(μ)、运维人力、电力(kW)、给排水及垃圾清运配置是否充足？',
        '¿Son suficientes la tasa de servicio (μ), personal, energía (kW), agua y residuos?',
        'La cadence de service (μ), les effectifs, la puissance (kW), l’eau et les déchets suffisent-ils ?',
      ),
      evidenceDataKo: tr6(
        lang,
        `추정 총 전력 ${peakPowerWithMarginKw}kW(발전기 ${recommendedGeneratorUnits}기) · 급수 ${waterFacilityCount}개소 · 최소 운영인력 약 ${totalStaffRequired}명`,
        `Est. peak power ${peakPowerWithMarginKw}kW (${recommendedGeneratorUnits} gen) · ${waterFacilityCount} water nodes · ~${totalStaffRequired} staff`,
        `推定総電力 ${peakPowerWithMarginKw}kW（発電機 ${recommendedGeneratorUnits}台）· 給水 ${waterFacilityCount}箇所 · 運営約 ${totalStaffRequired}名`,
        `预计峰值电力 ${peakPowerWithMarginKw}kW（发电机 ${recommendedGeneratorUnits}台）· 供水点 ${waterFacilityCount}处 · 约需人力 ${totalStaffRequired}人`,
        `Potencia est. ${peakPowerWithMarginKw}kW (${recommendedGeneratorUnits} gen.) · ${waterFacilityCount} tomas agua · ~${totalStaffRequired} personal`,
        `Puissance est. ${peakPowerWithMarginKw}kW (${recommendedGeneratorUnits} groupes) · ${waterFacilityCount} points d’eau · ~${totalStaffRequired} agents`,
      ),
      reliabilityLabel: 'ASSUMPTION',
      status: waterFacilityCount > 0 ? 'pass' : 'review',
      judgmentKo: tr6(
        lang,
        `분전반·발전기 외곽 격리 및 분리배출함 약 ${recommendedWasteBins}개소 배치 기준 산출`,
        `Sized perimeter generator isolation and ~${recommendedWasteBins} sorting waste stations`,
        `発電機の外周隔離および分別回収ステーション約 ${recommendedWasteBins}箇所を算出`,
        `已核算外围发电机隔离区及约 ${recommendedWasteBins} 处分类回收站`,
        `Dimensionados generadores perimetrales y ~${recommendedWasteBins} puntos de reciclaje`,
        `Dimensionnement des groupes périmétriques et ~${recommendedWasteBins} points de tri`,
      ),
      limitNoteKo: tr6(lang, '부스별 실제 소비전력 명판 및 상하수도 인입 가능 위치 현장 확인 필요', 'Verify vendor appliance kW ratings and utility hookup points on site', '各ブースの定格消費電力と給排水引込位置の現地確認が必要', '需现场核实各展位设备额定功率及上下水接驳点', 'Verificar placas de consumo eléctrico y tomas hidráulicas reales', 'Vérifier sur site les plaques de puissance (kW) et raccordements eau'),
    },
    {
      domainId: 'safety',
      domainKo: tr6(lang, '6. 법령·안전관리 점검', '6. Statutory Safety Audit', '6. 法令・安全管理点検', '6. 法规与安全管理核查', '6. Auditoría Legal de Seguridad', '6. Audit Réglementaire de Sécurité'),
      domainEn: 'Statutory Safety Audit',
      coreQuestionKo: tr6(
        lang,
        '재난안전법 시행령 제73조의9 및 행안부 5단계 안전점검표를 충족했는가?',
        'Are statutory safety management plan & multi-agency consultation items verified?',
        '安全管理計画および自治体・消防・警察との事前協議項目を確認したか？',
        '是否已完成法定安全管理计划编制及市政·消防·警方事前协商核查？',
        '¿Se verificaron el plan oficial de seguridad y la consulta con bomberos/policía?',
        'Le plan réglementaire de sécurité et la concertation pompiers/police sont-ils vérifiés ?',
      ),
      evidenceDataKo: requiresStatutorySafetyPlan
        ? tr6(
            lang,
            `안전관리계획 대상 가능 (${statutoryReasonsKo.length}개 사유) · 계획수립(${checklist.safetyManagementPlanPrepared ? '확인' : '미확인'}) · 기관협의(${checklist.localGovFirePoliceConsulted ? '확인' : '미확인'})`,
            `Safety plan triggered (${statutoryReasonsKo.length}) · Plan(${checklist.safetyManagementPlanPrepared ? 'YES' : 'PENDING'}) · Agency(${checklist.localGovFirePoliceConsulted ? 'YES' : 'PENDING'})`,
            `安全計画対象（${statutoryReasonsKo.length}件）· 計画(${checklist.safetyManagementPlanPrepared ? '確認済' : '未確認'}) · 機関協議(${checklist.localGovFirePoliceConsulted ? '確認済' : '未確認'})`,
            `触发安全计划条件（${statutoryReasonsKo.length}项）· 计划(${checklist.safetyManagementPlanPrepared ? '已确认' : '待确认'}) · 机构协商(${checklist.localGovFirePoliceConsulted ? '已确认' : '待确认'})`,
            `Plan requerido (${statutoryReasonsKo.length}) · Plan(${checklist.safetyManagementPlanPrepared ? 'SÍ' : 'PENDIENTE'}) · Autoridades(${checklist.localGovFirePoliceConsulted ? 'SÍ' : 'PENDIENTE'})`,
            `Plan requis (${statutoryReasonsKo.length}) · Plan(${checklist.safetyManagementPlanPrepared ? 'OUI' : 'EN ATTENTE'}) · Autorités(${checklist.localGovFirePoliceConsulted ? 'OUI' : 'EN ATTENTE'})`,
          )
        : tr6(lang, '1,000명 미만·비위험 조건이나 기본 5단계 자율 안전점검 권고', 'Under 1,000 threshold, 5-stage voluntary safety checklist advised', '1,000名未満条件だが5段階自主安全点検を推奨', '虽低于1,000人门槛，仍建议执行5阶段安全自查', 'Bajo umbral de 1.000, se recomienda lista preventiva de 5 etapas', 'Sous le seuil de 1 000, contrôle préventif en 5 étapes recommandé'),
      reliabilityLabel: statutoryPlanUnverified ? 'MISSING' : 'OFFICIAL',
      status: statutoryPlanUnverified ? 'hold' : ruleCautionCount > 1 ? 'review' : 'pass',
      judgmentKo: statutoryPlanUnverified
        ? tr6(lang, '판정 보류 — 지역축제 안전관리계획 수립 및 지자체·소방·경찰 사전 협의 확인 필수', 'On Hold — Confirm statutory safety plan & municipality/fire/police consultation', '判定保留 — 安全管理計画の策定および自治体・消防・警察協議の確認が必須', '暂缓判定 — 须先确认安全管理计划编制及市政、消防、警方事前协商', 'En espera — Confirmar plan de seguridad y consulta con autoridades locales', 'En attente — Confirmer le plan de sécurité et la concertation pompiers/police')
        : tr6(lang, '사전 안전관리계획 수립 및 유관기관 협의 체크 완료 (현장 합동점검 필수)', 'Pre-event safety plan & agency consultation checked (joint site inspection required)', '事前安全管理計画および関係機関協議チェック完了（現地合同点検が必須）', '已完成事前安全计划与机构协商核对（仍须执行现场联合检查）', 'Plan previo y consulta verificados (inspección conjunta en sitio obligatoria)', 'Plan préalable et concertation cochés (inspection conjointe sur site requise)'),
      limitNoteKo: tr6(lang, 'AI 결과는 법적 인허가·승인이 아니며 관할기관 최종 심의가 우선함', 'Dashboard output is not legal approval; local authority review governs', '本出力は法的承認ではなく管轄機関の最終審査が優先されます', '系统输出不构成行政审批，以主管部门最终审查为准', 'Este resultado no sustituye permisos legales; prevalece la autoridad competente', 'Ce rapport ne vaut pas autorisation administrative ; l’avis officiel prévaut'),
    },
    {
      domainId: 'budget',
      domainKo: tr6(lang, '7. 예산·원가 타당성', '7. Budget & Cost Realism', '7. 予算・原価妥当性', '7. 预算与成本合理性', '7. Viabilidad Presupuestaria', '7. Réalisme Budgétaire'),
      domainEn: 'Budget & Cost Realism',
      coreQuestionKo: tr6(
        lang,
        '시설 임차·설치 추정 비용이 가용 예산 범위 내이며 누락 항목이 없는가?',
        'Are estimated rental/setup costs within available budget without omitted items?',
        '施設賃借・設置推定費は利用可能予算内であり漏れ項目はないか？',
        '设施租赁搭建估算费用是否在可用预算内且无遗漏项？',
        '¿Está el costo estimado de montaje dentro del presupuesto disponible?',
        'Le coût estimé d’installation respecte-t-il le budget disponible ?',
      ),
      evidenceDataKo: `${formatCurrency(summary.estimatedCost, lang)} / ${formatCurrency(config.budget, lang)} (${summary.budgetUsagePct}%)`,
      reliabilityLabel: 'ASSUMPTION',
      status: budgetOverrun ? 'review' : 'pass',
      judgmentKo: budgetOverrun
        ? tr6(lang, '가용 예산 초과 — 안전·무장애 필수시설을 유지한 채 비필수 부스·외관 조정 필요', 'Budget overrun — preserve safety/accessibility baselines and right-size optional booths', '予算超過 — 安全・バリアフリー必須施設を維持しつつ任意ブースを調整', '超出可用预算 — 请在保留安全与无障碍必需设施前提下精简可选展位', 'Presupuesto excedido — conservar seguridad/accesibilidad y ajustar módulos opcionales', 'Dépassement budgétaire — préserver sécurité/PMR et ajuster les stands optionnels')
        : tr6(lang, '가용 예산 범위 내 구성 (단, 안전요원 인건비·보험·폐기물 처리비 별도 견적 확인)', 'Within available budget (verify steward labor, insurance, and waste hauling quotes separately)', '利用可能予算内（警備人件費・保険・廃棄物処理費は別途見積確認）', '处于可用预算范围内（安保人力、保险及垃圾清运费需另行核报价）', 'Dentro del presupuesto (verificar aparte personal de seguridad, seguros y residuos)', 'Dans l’enveloppe budgétaire (vérifier séparément gardiennage, assurance et déchets)'),
      limitNoteKo: tr6(lang, '단가는 기획 가정값(ASSUMPTION)이며 실제 업체 견적서·지방재정365 결산 대조 필요', 'Unit prices are planning assumptions; compare against actual vendor quotes', '単価は企画仮定値（ASSUMPTION）であり実際の業者見積との照合が必要', '单价为规划假设值（ASSUMPTION），需对照供应商正式报价单', 'Precios unitarios estimados; contrastar con cotizaciones reales de proveedores', 'Coûts unitaires estimatifs ; à confronter aux devis fournisseurs réels'),
    },
    {
      domainId: 'environment',
      domainKo: tr6(lang, '8. 기상·환경 대응력', '8. Weather & Site Resilience', '8. 気象・環境対応力', '8. 气象与环境韧性', '8. Resiliencia Climática', '8. Résilience Météo & Site'),
      domainEn: 'Weather & Site Resilience',
      coreQuestionKo: tr6(
        lang,
        '우천·강풍·폭염·야간 조도 변화에 대비한 대피·고정 대책이 있는가?',
        'Are shelter, wind-ballast, cooling, and night lighting countermeasures prepared?',
        '雨天・強風・猛暑・夜間照度低下に対する退避・固定対策はあるか？',
        '是否具备应对降雨、强风、高温及夜间照度下降的遮蔽与加固措施？',
        '¿Existen medidas de refugio, lastre por viento, sombra e iluminación nocturna?',
        'Les mesures d’abri pluie, lestage vent, fraîcheur et éclairage nocturne sont-elles prévues ?',
      ),
      evidenceDataKo: tr6(
        lang,
        `현재 점검 기상: ${weatherName} · 그늘/비가림 시설 ${facilities.filter((f) => f.covered).length}개소`,
        `Weather: ${weatherName} · Covered shelters: ${facilities.filter((f) => f.covered).length}`,
        `点検気象：${weatherName} · 屋根/日除け施設 ${facilities.filter((f) => f.covered).length}箇所`,
        `当前气象场景：${weatherName} · 遮阳避雨设施 ${facilities.filter((f) => f.covered).length}处`,
        `Clima evaluado: ${weatherName} · Módulos cubiertos: ${facilities.filter((f) => f.covered).length}`,
        `Météo évaluée : ${weatherName} · Abris couverts : ${facilities.filter((f) => f.covered).length}`,
      ),
      reliabilityLabel: 'ESTIMATED',
      status: weatherScenario === 'clear' || facilities.some((f) => f.subtype === 'rain_canopy') ? 'pass' : 'review',
      judgmentKo: weatherImpact,
      limitNoteKo: tr6(lang, '기상청 ASOS 개최지 과거 풍속·강수 극값 조회 및 현장 풍속계 비치 권장', 'Check historical wind/rain extremes and deploy an on-site anemometer', '開催地の過去最大瞬間風速・降水データ確認および現地風速計の設置を推奨', '建议核查举办地历史极大风速降水数据并在现场配置风速仪', 'Consultar máximos históricos de viento/lluvia y disponer anemómetro en sitio', 'Consulter les extrêmes météo locaux et installer un anémomètre sur site'),
    },
  ];

  let verdict: DesignConfidenceVerdict = 'high';
  let verdictTitleKo = tr6(
    lang,
    '설계 근거 신뢰도: 높음 (공식 지침·실측 보정·핵심 안전 점검 반영)',
    'Evidence Confidence: High (Statutory checks, field calibration & spatial rules verified)',
    '設計根拠の信頼度：高（公式指針・実測補正・主要安全点検を反映）',
    '设计依据可信度：高（已纳入官方规范、实测校准与核心安全核查）',
    'Confianza de Evidencia: Alta (normativa, calibración y reglas espaciales verificadas)',
    'Confiance des Preuves : Élevée (normes, calibrage terrain et règles spatiales vérifiés)',
  );
  let verdictReasonKo = tr6(
    lang,
    '법정 안전관리계획 협의 항목, 현장 관측 보정값, 무장애 및 가용면적 기준이 모두 확인되었습니다. 시공 전 구조·전기·소방 전문가 현장 실측만 수행하면 됩니다.',
    'Statutory safety plan items, observed gate calibration, step-free routes, and net usable area checks are all verified. Complete on-site engineering inspection prior to opening.',
    '法定安全管理計画の協議項目、現場観測補正、バリアフリーおよび有効面積基準がすべて確認されました。施工前の現地専門家点検を実施してください。',
    '法定安全管理计划协商项、现场客流校准、无障碍动线及净可用面积均已核实。施工前完成结构、电气与消防现场实测即可。',
    'Se verificaron el plan legal de seguridad, la calibración de flujo, las rutas sin escalones y el área neta. Realice la inspección técnica presencial antes de abrir.',
    'Le plan réglementaire, le calibrage terrain, l’accessibilité PMR et la surface utile sont vérifiés. Effectuez le contrôle technique sur site avant ouverture.',
  );

  if (statutoryPlanUnverified) {
    verdict = 'indeterminate_expert_required';
    verdictTitleKo = tr6(
      lang,
      '안전 적합성 판정 보류 (관할 지자체·소방·경찰 협의 및 안전관리계획 확인 필요)',
      'Safety Verdict On Hold (Confirm statutory safety plan & fire/police consultation)',
      '安全適合性の判定保留（自治体・消防・警察協議および安全管理計画の確認が必要）',
      '安全合规判定暂缓（需确认安全管理计划及市政·消防·警方事前协商）',
      'Veredicto en Espera (requiere plan de seguridad y consulta con autoridades)',
      'Verdict en Attente (plan de sécurité et concertation pompiers/police requis)',
    );
    verdictReasonKo = tr6(
      lang,
      '재난 및 안전관리 기본법 시행령 제73조의9에 따른 지역축제 안전관리계획 수립 대상 가능성이 있으나, 아직 안전관리계획 수립 또는 유관기관 협의 완료 여부가 확인되지 않았습니다. 평균 점수로 대체하지 않고 전문가·관할기관 검토 필요 상태로 표시합니다.',
      'This event meets statutory mass-gathering safety plan triggers, but safety plan preparation or multi-agency consultation has not yet been confirmed. Never masked by an average score.',
      '安全管理計画の策定対象条件に該当する可能性がありますが、計画策定または関係機関協議の完了が未確認です。平均スコアで隠さず専門家確認待ちとして表示します。',
      '当前活动规模或条件触发法定安全管理计划要求，但尚未勾选确认计划编制与机构协商完成状态。系统不以平均分掩盖，明确标示需主管部门审查。',
      'El evento activa criterios de plan oficial de seguridad aún pendientes de confirmación con autoridades locales; no se oculta tras un puntaje promedio.',
      'L’événement déclenche les critères d’un plan officiel de sécurité non encore confirmé avec les autorités ; aucun score moyen ne masque ce point.',
    );
  } else if (!calibration.enabled || budgetOverrun || ruleFailCount > 0) {
    verdict = 'low_assumption';
    verdictTitleKo = tr6(
      lang,
      '설계 신뢰도: 낮음~보통 (시뮬레이션 가정값 ASSUMPTION 포함 — 현장 검증 필요)',
      'Evidence Confidence: Planning Assumption Mode (Field verification & quotes needed)',
      '設計信頼度：企画仮定モード（ASSUMPTIONを含むため現地検証・見積照合が必要）',
      '设计可信度：规划假设模式（含 ASSUMPTION 假设值，需现场实测与正式报价核验）',
      'Confianza de Diseño: Modo Supuesto (requiere cotizaciones y medición en campo)',
      'Confiance : Mode Hypothèse de Planification (devis et mesures terrain requis)',
    );
    verdictReasonKo = tr6(
      lang,
      '공간 배치·무장애 동선 규칙은 반영되었으나, 부스 처리속도·단가·인파 분포에 기획 단계 가정값(ASSUMPTION)이 포함되어 있습니다. 실제 업체 견적서와 현장 게이트 실측 데이터 입력 시 신뢰도가 향상됩니다.',
      'Spatial clearances and step-free rules are active, while service rates, unit costs, or crowd inflows currently use planning assumptions (ASSUMPTION). Enable field calibration and vendor quotes to upgrade.',
      '空間配置とバリアフリー規則は反映されていますが、処理速度・単価・流入分布に企画段階の仮定値（ASSUMPTION）が含まれています。実測値と見積の入力で信頼度が向上します。',
      '空间净距与无障碍规则已生效，但摊位服务速率、单价与客流分布仍包含规划阶段假设值（ASSUMPTION）。输入正式报价与闸机实测数据后可提升等级。',
      'Las reglas espaciales y accesibles están activas, pero costos, tasas de atención y afluencia usan supuestos iniciales (ASSUMPTION).',
      'Les règles spatiales et PMR sont actives, mais les coûts, cadences et flux reposent sur des hypothèses initiales (ASSUMPTION).',
    );
  } else if (ruleCautionCount > 0 || !accessibilityComplete) {
    verdict = 'medium';
    verdictTitleKo = tr6(
      lang,
      '설계 신뢰도: 보통 (일부 동선·접근성 권고 항목 현장 보완 필요)',
      'Evidence Confidence: Moderate (Review advisory queue or accessibility items)',
      '設計信頼度：中（一部の動線・バリアフリー推奨項目の現地補完を推奨）',
      '设计可信度：中等（部分排队缓冲或无障碍建议项需现场完善）',
      'Confianza de Diseño: Moderada (revisar recomendaciones de colas o accesibilidad)',
      'Confiance : Modérée (vérifier les recommandations de files ou d’accessibilité)',
    );
    verdictReasonKo = tr6(
      lang,
      '핵심 안전계획과 실측 비교가 반영되었으나 일부 대기열·무장애 세부 권고 항목에 대한 현장 보완이 권장됩니다.',
      'Core safety planning and calibration are active; fine-tune remaining queue pocket or accessibility advisories on site.',
      '主要安全計画と実測補正は反映済みですが、一部の待機列・バリアフリー推奨項目の補完を推奨します。',
      '核心安全计划与实测校准已启用，建议在现场进一步完善局部排队缓冲或无障碍细节。',
      'El plan principal y la calibración están activos; ajuste en campo los detalles restantes de colas o accesibilidad.',
      'Le plan principal et le calibrage sont actifs ; ajustez sur site les points secondaires de files ou d’accessibilité PMR.',
    );
  }

  return {
    verdict,
    verdictTitleKo,
    verdictReasonKo,
    requiresStatutorySafetyPlan,
    statutoryPlanUnverified,
    statutoryReasonsKo,
    utilitiesSummary: {
      totalPowerKw,
      peakPowerWithMarginKw,
      recommendedGeneratorUnits,
      waterFacilityCount,
      wastewaterFacilityCount,
      recommendedWasteBins,
      totalStaffRequired,
    },
    domains,
  };
}

export type StandardCsvType =
  | 'festival_cases.csv'
  | 'assets.csv'
  | 'crowd_timeseries.csv'
  | 'facility_operations.csv'
  | 'weather.csv'
  | 'cost_items.csv'
  | 'safety_checks.csv'
  | 'incident_log.csv';

function escCsv(val: string | number | boolean): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Generates any of the 8 Standardized CSV Datasets defined in PDF Section 11-4 (p.14)
 */
export function generateRecommendedCsvContent(
  csvType: StandardCsvType,
  config: EventConfig,
  facilities: Facility[],
  snapshot: SimulationSnapshot,
  summary: LayoutMetricsSummary,
  safetyAudit: SpatialSafetyAudit,
  checklist: StatutorySafetyChecklistState,
  calibration: FieldCalibrationSample,
): string {
  const metas = facilities.map((f) => getFacilityAssetMetadata(f, config, snapshot));
  const eventId = config.eventName.replace(/\s+/g, '_');

  switch (csvType) {
    case 'festival_cases.csv': {
      const header = [
        'event_id',
        'event_name',
        'event_type',
        'venue_width_m',
        'venue_depth_m',
        'gross_area_m2',
        'usable_area_m2',
        'peak_simultaneous_target',
        'estimated_daily_cumulative',
        'budget_krw',
        'estimated_cost_krw',
        'reliability_label',
      ];
      const row = [
        eventId,
        config.eventName,
        config.eventType,
        config.venueWidth,
        config.venueDepth,
        summary.venueAreaSqm,
        summary.usableAreaSqm,
        config.expectedAttendance,
        Math.round(config.expectedAttendance * 1.65),
        Math.round(config.budget * KRW_PER_USD),
        Math.round(summary.estimatedCost * KRW_PER_USD),
        calibration.enabled ? 'OBSERVED' : 'ASSUMPTION',
      ];
      return `${header.join(',')}\n${row.map(escCsv).join(',')}\n`;
    }

    case 'assets.csv': {
      const header = [
        'asset_id',
        'name_ko',
        'category',
        'subtype',
        'pos_x_m',
        'pos_z_m',
        'length_m',
        'width_m',
        'height_m',
        'footprint_m2',
        'front_queue_m',
        'wheelchair_access',
        'electricity_kw',
        'water_required',
        'wastewater_required',
        'unit_cost_krw',
        'reliability_label',
        'reference_image',
      ];
      const lines = metas.map((m, idx) => {
        const f = facilities[idx];
        return [
          m.assetId,
          m.nameKo,
          m.category,
          m.subtype,
          Math.round(f.position.x),
          Math.round(f.position.z),
          m.geometry.lengthM,
          m.geometry.widthM,
          m.geometry.heightM,
          m.geometry.footprintM2,
          m.clearance.frontQueueM,
          m.accessibility.wheelchairAccess,
          m.utilities.electricityKw,
          m.utilities.waterRequired,
          m.utilities.wastewaterRequired,
          m.cost.unitCostKrw,
          m.source.label,
          m.referenceImageUrl,
        ]
          .map(escCsv)
          .join(',');
      });
      return `${header.join(',')}\n${lines.join('\n')}\n`;
    }

    case 'crowd_timeseries.csv': {
      const header = [
        'event_id',
        'time_label',
        'phase_ko',
        'simultaneous_occupancy',
        'peak_density_pm2',
        'avg_active_density_pm2',
        'total_queued_pax',
        'stage_zone_share_pct',
        'food_zone_share_pct',
        'booth_zone_share_pct',
        'count_method',
        'reliability_label',
      ];
      const lines = snapshot.timelineSeries.map((pt) =>
        [
          eventId,
          pt.timeLabel,
          pt.phaseLabelKo || pt.phaseLabel,
          pt.activeVisitors,
          pt.peakDensity,
          pt.avgDensity,
          pt.totalQueued,
          pt.stageZoneShare,
          pt.foodZoneShare,
          pt.boothZoneShare,
          calibration.enabled ? 'field_calibrated' : 'simulation_assumption',
          calibration.enabled ? 'OBSERVED' : 'ASSUMPTION',
        ]
          .map(escCsv)
          .join(','),
      );
      return `${header.join(',')}\n${lines.join('\n')}\n`;
    }

    case 'facility_operations.csv': {
      const header = [
        'asset_id',
        'name_ko',
        'open_time',
        'close_time',
        'service_time_sec',
        'parallel_servers_c',
        'service_rate_per_min_mu',
        'arrival_rate_per_min_lambda',
        'current_queue_pax',
        'queue_area_m2',
        'staff_required',
        'reliability_label',
      ];
      const lines = metas.map((m, idx) => {
        const f = facilities[idx];
        return [
          m.assetId,
          m.nameKo,
          m.operations.openTime,
          m.operations.closeTime,
          m.operations.serviceTimeSec,
          m.operations.parallelServersC,
          m.operations.serviceRatePerMinMu,
          m.operations.arrivalRatePerMinLambda,
          snapshot.facilityQueues[f.id] || 0,
          m.operations.queueAreaM2,
          m.operations.staffRequired,
          'ASSUMPTION',
        ]
          .map(escCsv)
          .join(',');
      });
      return `${header.join(',')}\n${lines.join('\n')}\n`;
    }

    case 'weather.csv': {
      const header = [
        'scenario_id',
        'scenario_name_ko',
        'trigger_condition',
        'crowd_impact',
        'design_countermeasure',
        'data_source',
      ];
      const lines = (Object.keys(WEATHER_SCENARIO_GUIDES) as WeatherScenarioId[]).map((id) => {
        const g = WEATHER_SCENARIO_GUIDES[id];
        return [
          id,
          g.nameKo,
          g.triggerConditionKo,
          g.crowdImpactKo,
          g.requiredDesignActionsKo.join(' / '),
          '기상청 기상자료개방포털 ASOS 참고 + 시나리오 가정(ASSUMPTION)',
        ]
          .map(escCsv)
          .join(',');
      });
      return `${header.join(',')}\n${lines.join('\n')}\n`;
    }

    case 'cost_items.csv': {
      const header = [
        'item_id',
        'facility_name_ko',
        'category',
        'estimated_cost_krw',
        'includes_setup',
        'includes_staff',
        'includes_power',
        'reliability_label',
        'notes',
      ];
      const lines = metas.map((m) =>
        [
          m.assetId,
          m.nameKo,
          m.category,
          m.cost.unitCostKrw,
          m.cost.includesSetup,
          m.cost.includesStaff,
          m.cost.includesPower,
          m.cost.priceReliability,
          m.cost.unitCostKrw === 0
            ? '기존 행사장 보유 시설·부스 (예산 제외 적용 · ₩0)'
            : '지역·계절·운반거리·인건비 별도 견적 확인 필요',
        ]
          .map(escCsv)
          .join(','),
      );
      return `${header.join(',')}\n${lines.join('\n')}\n`;
    }

    case 'safety_checks.csv': {
      const header = [
        'check_id',
        'stage_or_rule',
        'title_ko',
        'status',
        'detail_ko',
        'reference_basis',
      ];
      const checklistRows = [
        [
          'LAW-73-9-PLAN',
          '법정 안전관리계획',
          '지역축제 안전관리계획 수립 여부',
          checklist.safetyManagementPlanPrepared ? 'CONFIRMED' : 'PENDING_REVIEW',
          `순간 최대 ${config.expectedAttendance}명 기준 관할기관 검토 대상 확인`,
          '재난 및 안전관리 기본법 시행령 제73조의9 (OFFICIAL)',
        ],
        [
          'LAW-73-9-CONSULT',
          '유관기관 사전협의',
          '지자체·소방서·경찰서 사전 안전협의',
          checklist.localGovFirePoliceConsulted ? 'CONFIRMED' : 'PENDING_REVIEW',
          '소방차·구급차 진입로 및 인파관리 계획 사전 협의',
          '행정안전부 지역축제장 안전관리 매뉴얼 (OFFICIAL)',
        ],
      ];
      const ruleRows = safetyAudit.ruleChecks.map((r) => [
        r.id,
        '공간·동선 규칙',
        r.titleKo,
        r.status.toUpperCase(),
        r.detailKo,
        r.citationKo,
      ]);
      const all = [...checklistRows, ...ruleRows].map((r) => r.map(escCsv).join(','));
      return `${header.join(',')}\n${all.join('\n')}\n`;
    }

    case 'incident_log.csv': {
      const header = [
        'log_id',
        'time_label',
        'zone_or_facility',
        'risk_type',
        'modeled_metric',
        'recommended_response_ko',
        'record_type',
      ];
      const rows =
        snapshot.bottlenecks.length > 0
          ? snapshot.bottlenecks.map((b, i) =>
              [
                `SIM-RISK-${i + 1}`,
                snapshot.currentTimeLabel,
                b.facilityName,
                '대기열·국소 밀집 주의',
                `대기 약 ${b.estimatedQueue}명 / 피크 ${b.peakDensity}명/m²`,
                '전면 대기줄 지그재그 유도봉 설치 및 인접 분산 부스 안내',
                'SIMULATION_PRE_CHECK (실제 사고 기록 아님)',
              ]
                .map(escCsv)
                .join(','),
            )
          : [
              [
                'SIM-RISK-0',
                snapshot.currentTimeLabel,
                '전 구역',
                '특이 병목 없음',
                `피크 ${snapshot.peakDensity.toFixed(2)}명/m²`,
                '현장 안전요원 정위치 순찰 및 비상통로 적치물 상시 점검',
                'SIMULATION_PRE_CHECK (실제 사고 기록 아님)',
              ]
                .map(escCsv)
                .join(','),
            ];
      return `${header.join(',')}\n${rows.join('\n')}\n`;
    }
  }
}
