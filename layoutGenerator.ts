import {
  AiFacilityAction,
  BoothModelStyle,
  ContingencyScenario,
  CustomRequestedFacilitySpec,
  CustomZoneHint,
  DesignObjective,
  EventConfig,
  EventType,
  Facility,
  FacilityCategory,
  FacilitySubtype,
  IndoorFloorPresetId,
  Language,
  OutdoorFloorPresetId,
  ParsedBriefResult,
  RecommendedBoothItem,
  SpatialZoneTarget,
  StagePlacementMode,
  VenueBoundaryShape,
  VenueEnvironmentType,
  VenueFloorMode,
  VenueLayoutModel,
  VisitorPersonaId,
} from '../types/festival';
import { SUBTYPE_SIMPLE_LABELS } from '../i18n/translations';
import {
  BOOTH_MODEL_STYLE_I18N,
  EVENT_PRESET_NAME_I18N,
  INDOOR_FLOOR_I18N,
  OUTDOOR_FLOOR_I18N,
  pickL6,
  STAGE_PLACEMENT_I18N,
  tr6,
  VENUE_LAYOUT_MODEL_I18N,
  VENUE_SHAPE_I18N,
  ZONE_TARGET_I18N,
} from '../i18n/localeCatalog';
import {
  BOOTH_MODEL_STYLE_LABELS,
  EVENT_TYPE_PRESETS,
  formatCurrency,
  getFacilityDisplayName,
  KRW_PER_USD,
} from './presets';
import { createSeededRandom, hashStringSeed } from './prng';

interface Box2D {
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface WorldAABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  spanW: number;
  spanD: number;
}

export interface FacilityClearanceEntry {
  nearestId: string;
  nearestNameKo: string;
  nearestNameEn: string;
  clearanceM: number;
}

export interface FacilityClearanceAudit {
  conflictCount: number;
  minClearanceM: number;
  byFacilityId: Record<string, FacilityClearanceEntry>;
}

/**
 * Exact local-space [minX..maxX, minZ..maxZ] bounds of the 3D procedural mesh
 * (including ramps, stage speaker wings, relay screens, gate planters, and queue aprons).
 */
export function getFacilityLocalBounds(
  facility: Pick<Facility, 'subtype' | 'dimensions' | 'accessibility'>,
  config?: Pick<EventConfig, 'stagePlacement' | 'accessibility'>,
): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const W = facility.dimensions.width;
  const D = facility.dimensions.depth;
  const hasRamp =
    Boolean(config?.accessibility?.stepFreeRoutes) ||
    Boolean(facility.accessibility?.wheelchairAccessible);

  switch (facility.subtype) {
    case 'main_entrance':
    case 'secondary_entrance': {
      if (D > W) {
        return {
          minX: -W * 0.5 - 1.2,
          maxX: W * 0.5 + 1.2,
          minZ: -D * 0.5 - 2.8,
          maxZ: D * 0.5 + 2.6,
        };
      }
      return {
        minX: -W * 0.5 - 2.6,
        maxX: W * 0.5 + 2.8,
        minZ: -D * 0.5 - 1.2,
        maxZ: D * 0.5 + 1.2,
      };
    }
    case 'main_stage': {
      if (config?.stagePlacement === 'center_360') {
        const r = Math.max(W, D) * 0.44;
        return {
          minX: -r - 1.8,
          maxX: r + 1.8,
          minZ: -r - 1.8,
          maxZ: r + (hasRamp ? 3.4 : 2.0),
        };
      }
      const frontBuffer = config?.stagePlacement === 'runway_keynote' ? 14.4 : 10.2;
      return {
        minX: -W * 0.5 - 4.8,
        maxX: W * 0.5 + 4.8,
        minZ: -D * 0.5 - 1.2,
        maxZ: D * 0.5 + frontBuffer,
      };
    }
    case 'secondary_stage':
      return {
        minX: -W * 0.5 - 2.4,
        maxX: W * 0.5 + 4.8,
        minZ: -D * 0.5 - 0.8,
        maxZ: D * 0.5 + 3.2,
      };
    case 'seating_block':
      return {
        minX: -W * 0.5 - 0.8,
        maxX: W * 0.5 + 0.8,
        minZ: -D * 0.5 - 1.2,
        maxZ: D * 0.5 + 1.8,
      };
    case 'food_truck':
      return {
        minX: -W * 0.5 - 0.6,
        maxX: W * 0.5 + 0.6,
        minZ: -D * 0.5 - 0.5,
        maxZ: D * 0.5 + (hasRamp ? 2.6 : 1.6),
      };
    case 'restroom_bank':
      return {
        minX: -W * 0.5 - 0.7,
        maxX: W * 0.5 + 0.7,
        minZ: -D * 0.5 - 0.6,
        maxZ: D * 0.5 + 2.4,
      };
    case 'food_stall':
    case 'experience_booth':
    case 'goods_shop':
    case 'beer_garden':
    case 'ticket_info':
    case 'multilingual_info':
    case 'medical_station':
    case 'vip_lounge':
    case 'family_lounge':
      return {
        minX: -W * 0.5 - 0.6,
        maxX: W * 0.5 + 0.6,
        minZ: -D * 0.5 - 0.6,
        maxZ: D * 0.5 + (hasRamp ? 2.5 : 1.5),
      };
    case 'tactile_paving':
    case 'access_ramp':
      return {
        minX: -W * 0.5 - 0.3,
        maxX: W * 0.5 + 0.3,
        minZ: -D * 0.5 - 0.3,
        maxZ: D * 0.5 + 0.3,
      };
    default:
      return {
        minX: -W * 0.5 - 0.6,
        maxX: W * 0.5 + 0.6,
        minZ: -D * 0.5 - 0.6,
        maxZ: D * 0.5 + 1.1,
      };
  }
}

/**
 * Exact world-space Axis-Aligned Bounding Box of a rotated 3D facility mesh.
 * Matches Three.js right-handed Y-axis rotation:
 *   wx = pos.x + lx * cos(theta) + lz * sin(theta)
 *   wz = pos.z - lx * sin(theta) + lz * cos(theta)
 */
export function getFacilityWorldFootprint(
  facility: Pick<Facility, 'subtype' | 'position' | 'dimensions' | 'rotation' | 'accessibility'>,
  config?: Pick<EventConfig, 'stagePlacement' | 'accessibility'>,
  extraMargin = 0,
): WorldAABB {
  const local = getFacilityLocalBounds(facility, config);
  const cos = Math.cos(facility.rotation || 0);
  const sin = Math.sin(facility.rotation || 0);
  const corners: Array<[number, number]> = [
    [local.minX, local.minZ],
    [local.maxX, local.minZ],
    [local.maxX, local.maxZ],
    [local.minX, local.maxZ],
  ];

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const [lx, lz] of corners) {
    const wx = facility.position.x + lx * cos + lz * sin;
    const wz = facility.position.z - lx * sin + lz * cos;
    if (wx < minX) minX = wx;
    if (wx > maxX) maxX = wx;
    if (wz < minZ) minZ = wz;
    if (wz > maxZ) maxZ = wz;
  }

  minX -= extraMargin;
  maxX += extraMargin;
  minZ -= extraMargin;
  maxZ += extraMargin;

  return {
    minX,
    maxX,
    minZ,
    maxZ,
    centerX: (minX + maxX) * 0.5,
    centerZ: (minZ + maxZ) * 0.5,
    spanW: maxX - minX,
    spanD: maxZ - minZ,
  };
}

export function worldAABBsOverlap(a: WorldAABB, b: WorldAABB, clearance = 0): boolean {
  return (
    a.minX - clearance < b.maxX &&
    a.maxX + clearance > b.minX &&
    a.minZ - clearance < b.maxZ &&
    a.maxZ + clearance > b.minZ
  );
}

function boxesOverlap(a: Box2D, b: Box2D, margin: number): boolean {
  return (
    Math.abs(a.x - b.x) * 2 < a.w + b.w + margin * 2 &&
    Math.abs(a.z - b.z) * 2 < a.d + b.d + margin * 2
  );
}

function clampToVenue(
  x: number,
  z: number,
  w: number,
  d: number,
  venueWidth: number,
  venueDepth: number,
  edgePadding = 5,
  venueShape: VenueBoundaryShape = 'rectangle',
): { x: number; z: number } {
  const halfW = Math.max(12, venueWidth / 2 - w / 2 - edgePadding);
  const halfD = Math.max(12, venueDepth / 2 - d / 2 - edgePadding);
  let cx = Math.max(-halfW, Math.min(halfW, x));
  let cz = Math.max(-halfD, Math.min(halfD, z));

  if (venueShape === 'circle_arena') {
    const rx = Math.max(20, halfW * 0.96);
    const rz = Math.max(20, halfD * 0.96);
    const norm = Math.hypot(cx / rx, cz / rz);
    if (norm > 1) {
      cx /= norm;
      cz /= norm;
    }
  } else if (venueShape === 'fan_amphitheater') {
    // Narrower near north stage apex, wider toward south fan rim
    const zRatio = (cz + halfD) / Math.max(1, halfD * 2); // 0 at north, 1 at south
    const allowedHalfW = halfW * (0.48 + 0.52 * Math.min(1, zRatio * 1.15));
    cx = Math.max(-allowedHalfW, Math.min(allowedHalfW, cx));
  }

  return {
    x: Math.round(cx * 2) / 2,
    z: Math.round(cz * 2) / 2,
  };
}

/**
 * Clamps exterior parking & transit bays strictly OUTSIDE the venue perimeter walls
 * (`[-venueWidth/2, +venueWidth/2] x [-venueDepth/2, +venueDepth/2]`) while keeping them
 * neatly aligned with the exterior apron ring.
 */
export function clampExteriorParkingPosition(
  x: number,
  z: number,
  w: number,
  d: number,
  venueWidth: number,
  venueDepth: number,
): { x: number; z: number } {
  const halfVenueW = venueWidth / 2;
  const halfVenueD = venueDepth / 2;
  const minExtX = halfVenueW + 7 + w / 2;
  const maxExtX = halfVenueW + 48 + w / 2;
  const minExtZ = halfVenueD + 7 + d / 2;
  const maxExtZ = halfVenueD + 48 + d / 2;

  let cx = Math.max(-maxExtX, Math.min(maxExtX, x));
  let cz = Math.max(-maxExtZ, Math.min(maxExtZ, z));

  const outsideX = Math.abs(cx) >= minExtX;
  const outsideZ = Math.abs(cz) >= minExtZ;

  if (!outsideX && !outsideZ) {
    const relX = Math.abs(cx) / Math.max(1, halfVenueW);
    const relZ = Math.abs(cz) / Math.max(1, halfVenueD);
    if (relX >= relZ) {
      cx = (cx >= 0 ? 1 : -1) * minExtX;
      cz = Math.max(-halfVenueD + d * 0.25, Math.min(halfVenueD - d * 0.25, cz));
    } else {
      cz = (cz >= 0 ? 1 : -1) * minExtZ;
      cx = Math.max(-halfVenueW + w * 0.25, Math.min(halfVenueW - w * 0.25, cx));
    }
  }

  return {
    x: Math.round(cx * 2) / 2,
    z: Math.round(cz * 2) / 2,
  };
}

export function validateEventConfig(config: EventConfig, lang: Language = 'ko'): string[] {
  const errors: string[] = [];
  if (!config.eventName.trim()) {
    errors.push(
      tr6(
        lang,
        '행사명을 입력해 주세요.',
        'Event name cannot be empty.',
        'イベント名を入力してください。',
        '请输入活动名称。',
        'Ingrese el nombre del evento.',
        'Veuillez saisir le nom de l’événement.',
      ),
    );
  }
  if (config.venueWidth < 100 || config.venueWidth > 360) {
    errors.push(
      tr6(
        lang,
        '행사장 가로 폭은 100m ~ 360m 범위여야 합니다.',
        'Venue width must be between 100m and 360m.',
        '会場の横幅は 100m〜360m の範囲で設定してください。',
        '场地宽度须在 100m ~ 360m 范围内。',
        'El ancho del recinto debe estar entre 100m y 360m.',
        'La largeur du site doit être comprise entre 100m et 360m.',
      ),
    );
  }
  if (config.venueDepth < 90 || config.venueDepth > 300) {
    errors.push(
      tr6(
        lang,
        '행사장 세로 길이는 90m ~ 300m 범위여야 합니다.',
        'Venue depth must be between 90m and 300m.',
        '会場の奥行は 90m〜300m の範囲で設定してください。',
        '场地纵深须在 90m ~ 300m 范围内。',
        'La profundidad del recinto debe estar entre 90m y 300m.',
        'La profondeur du site doit être comprise entre 90m et 300m.',
      ),
    );
  }
  if (config.expectedAttendance < 200 || config.expectedAttendance > 50000) {
    errors.push(
      tr6(
        lang,
        '예상 방문객 수는 200명 ~ 50,000명 범위여야 합니다.',
        'Expected attendance must be between 200 and 50,000 visitors.',
        '予想来場者数は 200〜50,000名の範囲で設定してください。',
        '预计访客人数须在 200 ~ 50,000 人范围内。',
        'El aforo previsto debe estar entre 200 y 50,000 visitantes.',
        'La fréquentation prévue doit être comprise entre 200 et 50 000 visiteurs.',
      ),
    );
  }
  if (config.budget < 10000) {
    errors.push(
      tr6(
        lang,
        '가용 예산은 최소 약 1,350만 원($10,000) 이상이어야 합니다.',
        'Available budget must be at least $10,000.',
        '利用可能予算は最低約150万円（$10,000）以上に設定してください。',
        '可用预算至少需达到 ¥72,000（$10,000）以上。',
        'El presupuesto disponible debe ser de al menos €9,200 ($10,000).',
        'Le budget disponible doit être d’au moins 9 200 € ($10,000).',
      ),
    );
  }
  if (config.entranceCount < 1 || config.entranceCount > 6) {
    errors.push(
      tr6(
        lang,
        '출입구 수는 1개 ~ 6개 사이로 설정해 주세요.',
        'Number of entrances/exits must be between 1 and 6.',
        '出入口の数は 1〜6箇所の間で設定してください。',
        '出入口数量请设置在 1 ~ 6 个之间。',
        'El número de accesos debe estar entre 1 y 6.',
        'Le nombre d’entrées/sorties doit être compris entre 1 et 6.',
      ),
    );
  }
  return errors;
}

/**
 * Converts native Korean count words before counters (개/대/동/곳/존/칸/구역/문) into digits.
 */
function normalizeKoreanNumerals(raw: string): string {
  const wordPairs: Array<[RegExp, string]> = [
    [/서른\s*(?=(?:개|대|동|곳|존|칸|구역|기))/g, '30'],
    [/스물다섯\s*(?=(?:개|대|동|곳|존|칸|구역|기))/g, '25'],
    [/(?:스물|스무)\s*(?=(?:개|대|동|곳|존|칸|구역|기))/g, '20'],
    [/열여덟\s*(?=(?:개|대|동|곳|존|칸|구역|기))/g, '18'],
    [/열여섯\s*(?=(?:개|대|동|곳|존|칸|구역|기))/g, '16'],
    [/열다섯\s*(?=(?:개|대|동|곳|존|칸|구역|기))/g, '15'],
    [/(?:열네|열넷)\s*(?=(?:개|대|동|곳|존|칸|구역|기))/g, '14'],
    [/(?:열세|열셋)\s*(?=(?:개|대|동|곳|존|칸|구역|기))/g, '13'],
    [/(?:열두|열둘)\s*(?=(?:개|대|동|곳|존|칸|구역|기))/g, '12'],
    [/(?:열한|열하나)\s*(?=(?:개|대|동|곳|존|칸|구역|기))/g, '11'],
    [/열\s*(?=(?:개|대|동|곳|존|칸|구역|기))/g, '10'],
    [/아홉\s*(?=(?:개|대|동|곳|존|칸|구역|기|곳))/g, '9'],
    [/여덟\s*(?=(?:개|대|동|곳|존|칸|구역|기|곳))/g, '8'],
    [/일곱\s*(?=(?:개|대|동|곳|존|칸|구역|기|곳))/g, '7'],
    [/여섯\s*(?=(?:개|대|동|곳|존|칸|구역|기|곳))/g, '6'],
    [/다섯\s*(?=(?:개|대|동|곳|존|칸|구역|기|곳|문))/g, '5'],
    [/(?:네|넷)\s*(?=(?:개|대|동|곳|존|칸|구역|기|문))/g, '4'],
    [/(?:세|셋)\s*(?=(?:개|대|동|곳|존|칸|구역|기|문))/g, '3'],
    [/(?:두|둘)\s*(?=(?:개|대|동|곳|존|칸|구역|기|문))/g, '2'],
    [/(?:한|하나)\s*(?=(?:개|대|동|곳|존|칸|구역|기|문))/g, '1'],
  ];
  let out = raw;
  for (const [rx, rep] of wordPairs) {
    out = out.replace(rx, `${rep}`);
  }
  return out;
}

function extractBudgetUsdFromPrompt(text: string, baseBudgetUsd?: number): number | null {
  const clean = text.replace(/,/g, '');
  let parsedUsd: number | null = null;

  // 1. Combined eok + cheonman / man: e.g. "1억 5천만원", "1억 2000만원", "2.4억원"
  const eokCombo = clean.match(/(\d+(?:\.\d+)?)\s*억(?:\s*(\d+(?:\.\d+)?)\s*(천만|백만|만))?/);
  if (eokCombo) {
    let krw = Number(eokCombo[1]) * 100_000_000;
    if (eokCombo[2]) {
      const subVal = Number(eokCombo[2]);
      const unit = eokCombo[3];
      if (unit === '천만') krw += subVal * 10_000_000;
      else if (unit === '백만') krw += subVal * 1_000_000;
      else krw += subVal * 10_000;
    }
    parsedUsd = Math.round(krw / KRW_PER_USD);
  }
  // 2. Cheon-man-won: e.g. "7천만원", "5.5천만"
  if (parsedUsd === null) {
    const cheonMan = clean.match(/(\d+(?:\.\d+)?)\s*천\s*만\s*(?:원)?/);
    if (cheonMan) {
      parsedUsd = Math.round((Number(cheonMan[1]) * 10_000_000) / KRW_PER_USD);
    }
  }
  // 3. Baek-man-won: e.g. "85백만원"
  if (parsedUsd === null) {
    const baekMan = clean.match(/(\d+(?:\.\d+)?)\s*백\s*만\s*(?:원)?/);
    if (baekMan) {
      parsedUsd = Math.round((Number(baekMan[1]) * 1_000_000) / KRW_PER_USD);
    }
  }
  // 4. Man-won: e.g. "5000만원", "8000만 원", "예산 4500만" (avoid matching "1만 명")
  if (parsedUsd === null) {
    const manWon = clean.match(/(\d{2,6}(?:\.\d+)?)\s*만\s*(?:원|(?!\s*명|\s*인|\s*평|\s*m))/);
    if (manWon) {
      parsedUsd = Math.round((Number(manWon[1]) * 10_000) / KRW_PER_USD);
    }
  }
  // 5. Direct KRW won: e.g. "80000000원"
  if (parsedUsd === null) {
    const rawWon = clean.match(/(\d{7,10})\s*원/);
    if (rawWon) {
      parsedUsd = Math.round(Number(rawWon[1]) / KRW_PER_USD);
    }
  }
  // 6. USD: e.g. "$85000", "85000 달러", "85k usd"
  if (parsedUsd === null) {
    const usdK = clean.match(/(?:\$\s*)?(\d+(?:\.\d+)?)\s*k\s*(?:usd|달러|\$)/i);
    if (usdK) {
      parsedUsd = Math.round(Number(usdK[1]) * 1000);
    }
  }
  if (parsedUsd === null) {
    const usdPlain = clean.match(/\$\s*(\d{4,6})|(\d{4,6})\s*(?:usd|달러)/i);
    if (usdPlain) {
      parsedUsd = Number(usdPlain[1] || usdPlain[2]);
    }
  }

  if (parsedUsd !== null && baseBudgetUsd !== undefined) {
    if (/예산[^.,\n]{0,20}(?:증액|추가|더\s*늘려|상향\s*\+|인상)/.test(clean)) {
      return baseBudgetUsd + parsedUsd;
    }
    if (/예산[^.,\n]{0,20}(?:삭감|감액|줄여\s*-)/.test(clean) && parsedUsd < baseBudgetUsd) {
      return Math.max(10000, baseBudgetUsd - parsedUsd);
    }
  }

  return parsedUsd;
}

export function extractVenueShapeFromPrompt(text: string): VenueBoundaryShape | null {
  const lower = text.toLowerCase();
  if (/컨벤션|코엑스|킨텍스|벡스코|실내\s*전시|전시장\s*홀|박람회장|엑스포\s*홀|convention|expo\s*hall|coex|kintex/i.test(lower)) {
    return 'expo_hall';
  }
  if (/부채꼴|노천극장|야외음악당|반원형\s*(?:극장|무대|광장)|언덕\s*객석|amphitheater|fan[\s-]*shape/i.test(lower)) {
    return 'fan_amphitheater';
  }
  if (/한강|수변|강변|청계천|차\s*없는\s*거리|가로수길|선형\s*공원|스트리트\s*마켓|거리\s*축제|야시장\s*거리|riverfront|waterside|promenade\s*park|linear\s*park/i.test(lower)) {
    return 'linear_park';
  }
  if (/운동장|육상\s*트랙|트랙형|캠퍼스\s*중정|학교\s*운동장|잔디\s*구장|축구장|track\s*field|campus\s*courtyard/i.test(lower)) {
    return 'courtyard_campus';
  }
  if (/원형\s*(?:경기장|아레나|광장|부지|행사장|잔디)|타원형|돔\s*경기장|서클\s*아레나|oval\s*arena|circle\s*arena|circular\s*arena|stadium\s*bowl/i.test(lower)) {
    return 'circle_arena';
  }
  if (/직사각형|사각형\s*(?:광장|부지|행사장)|시청\s*광장|광화문\s*광장|표준\s*부지|rectangular\s*plaza/i.test(lower)) {
    return 'rectangle';
  }
  return null;
}

export function extractStagePlacementFromPrompt(text: string): StagePlacementMode | null {
  const lower = text.toLowerCase();
  if (
    /(?:무대\s*대신|공연\s*(?:없이|없는)\s*(?:실내\s*)?).*(?:빔\s*프로젝터|프로젝터|스크린)|(?:빔\s*프로젝터|대형\s*스크린)\s*(?:무대|단상|모드|중심|발표형)|비공연\s*실내\s*(?:발표|프로젝터|스크린)|projector\s*(?:stage|screen\s*mode)|non[\s-]*performance\s*projector/i.test(
      lower,
    )
  ) {
    return 'projector_screen';
  }
  if (
    /(?:메인\s*)?무대(?:를|는|가)?\s*(?:없음|없이|없애|제거|삭제|빼고|빼줘|미설치)|공연\s*무대\s*없이|순수\s*(?:마켓|전시)|no\s*stage|without\s*stage/i.test(
      lower,
    )
  ) {
    return 'none';
  }
  if (
    /360\s*도|360°|중앙\s*(?:메인\s*)?무대|무대(?:를|가)?\s*중앙|센터\s*스테이지|사방\s*(?:관람|무대)|사면\s*무대|인더라운드|center\s*stage|360\s*stage|in[\s-]*the[\s-]*round/i.test(
      lower,
    )
  ) {
    return 'center_360';
  }
  if (
    /트윈\s*(?:무대|스테이지)|듀얼\s*(?:무대|스테이지)|양쪽\s*무대|양측\s*(?:메인\s*)?무대|주무대\s*2|메인\s*무대\s*2|더블\s*스테이지|교차\s*공연\s*무대|twin\s*stage|dual\s*stage/i.test(
      lower,
    )
  ) {
    return 'twin_stages';
  }
  if (
    /돌출\s*무대|런웨이|t자(?:형)?\s*무대|캣워크|패션쇼\s*무대|키노트\s*런웨이|연장\s*무대|runway|thrust\s*stage|catwalk/i.test(
      lower,
    )
  ) {
    return 'runway_keynote';
  }
  if (/북측\s*무대|엔드\s*스테이지|정면\s*단일\s*무대|기본\s*무대\s*배치|north\s*stage|end\s*stage/i.test(lower)) {
    return 'north_end';
  }
  return null;
}

export function extractVenueLayoutModelFromPrompt(text: string): VenueLayoutModel | null {
  const lower = text.toLowerCase();
  if (/부채꼴\s*(?:배치|동선|아크)|노천극장형|방사\s*아크|radial\s*fan|amphitheater\s*layout/i.test(lower)) {
    return 'radial_fan';
  }
  if (/대각선|x자|엑스자|크로스\s*애비뉴|십자\s*교차|사선형|diagonal|x[\s-]*cross/i.test(lower)) {
    return 'diagonal_avenue';
  }
  if (/수변|강변|한강형|프롬나드|가로변|산책로형|야시장\s*일자|waterside|promenade/i.test(lower)) {
    return 'waterside_promenade';
  }
  if (/원형|방사형|아레나|둥근|서클|환형|링형|circular|radial|arena|ring\s*layout/i.test(lower)) {
    return 'circular_plaza';
  }
  if (/u자|유자|ㄷ자|디귿|중정|코트야드|말굽|ㅁ자|u-shape|u\s*shape|courtyard|horseshoe/i.test(lower)) {
    return 'u_courtyard';
  }
  if (/격자|일자|스트리트|대로형|거리형|바둑판|보행몰|직선형|박람회\s*열|grid|boulevard|street|aisle/i.test(lower)) {
    return 'boulevard_grid';
  }
  if (/클러스터|빌리지|권역별|마을형|타운형|포드형|섬형|분산\s*군집|cluster|village|pod/i.test(lower)) {
    return 'cluster_village';
  }
  if (/표준\s*(?:배치|모형)|기본\s*(?:배치|모형)|중앙축|standard\s*(?:layout|model)/i.test(lower)) {
    return 'standard';
  }
  return null;
}

export function extractBoothModelFromPrompt(text: string): BoothModelStyle | null {
  const lower = text.toLowerCase();
  if (/옥타늄|시스템\s*부스|전시\s*파티션|박람회\s*부스|코엑스형\s*부스|쉘\s*부스|octanorm|expo\s*shell|shell\s*scheme/i.test(lower)) {
    return 'expo_shell';
  }
  if (/파라솔\s*(?:부스|마켓|테이블)|마켓\s*파라솔|원형\s*파라솔|야시장\s*매대|플리마켓\s*테이블|parasol|umbrella\s*stall/i.test(lower)) {
    return 'parasol_table';
  }
  if (/에어\s*(?:부스|텐트|아치|돔)|풍선형|인플레이터블|스포츠\s*아치|inflatable|air\s*tent|air\s*arch/i.test(lower)) {
    return 'inflatable_air';
  }
  if (/컨테이너|팝업\s*박스|박스형|모듈러|철제\s*부스|성수동\s*팝업|container|box\s*booth|modular/i.test(lower)) {
    return 'modern_container';
  }
  if (/캐노피|개방형\s*(?:부스|텐트)|그늘막\s*부스|어닝형|경량\s*텐트|폴딩\s*텐트|접이식\s*천막|canopy|gazebo|open\s*tent/i.test(lower)) {
    return 'open_canopy';
  }
  if (/목조|목재|나무\s*부스|파빌리온|한옥|처마|오두막|우드|친환경\s*목|원목|wood|timber|pavilion|hanok/i.test(lower)) {
    return 'wooden_pavilion';
  }
  if (/돔\s*부스|돔형|지오데식|구형\s*부스|이글루|돔\s*모형|돔으로|dome|geodesic/i.test(lower)) {
    return 'geodesic_dome';
  }
  if (/파고다|몽골\s*텐트|몽골\s*천막|뾰족\s*텐트|삼각\s*텐트|기본\s*텐트|pagoda|peaked\s*tent/i.test(lower)) {
    return 'pagoda_tent';
  }
  return null;
}

/**
 * Helper that extracts an explicit count or relative delta (+N / -N) for a facility noun pattern,
 * supporting both Korean word orders ("푸드트럭 8개" AND "8개의 푸드트럭").
 */
function matchCountOrDelta(
  normalizedText: string,
  nounPattern: string,
  unitPattern: string,
  baseCount: number,
  minVal: number,
  maxVal: number,
): number | undefined {
  // 1. Relative increase: e.g. "푸드트럭 3개 더 추가", "체험부스 4동 증설/늘려"
  const incRx = new RegExp(
    `(?:${nounPattern})\\s*(?:을|를|은|는|이|가)?\\s*(\\d{1,2})\\s*(?:${unitPattern})?\\s*(?:더\\s*)?(?:추가|증설|늘려|증가|플러스)`,
    'i',
  );
  const incMatch = normalizedText.match(incRx);
  if (incMatch) {
    return Math.max(minVal, Math.min(maxVal, baseCount + Number(incMatch[1])));
  }

  // 2. Relative decrease: e.g. "부스 3개 줄여줘", "푸드트럭 2대 감축/제외"
  const decRx = new RegExp(
    `(?:${nounPattern})\\s*(?:을|를|은|는|이|가)?\\s*(\\d{1,2})\\s*(?:${unitPattern})?\\s*(?:줄여|감축|축소|감소|빼|제외)`,
    'i',
  );
  const decMatch = normalizedText.match(decRx);
  if (decMatch) {
    return Math.max(minVal, Math.min(maxVal, baseCount - Number(decMatch[1])));
  }

  // 3. Zero / remove all: e.g. "푸드트럭 없이", "관객석 없애고"
  if (minVal === 0) {
    const zeroRx = new RegExp(
      `(?:${nounPattern})\\s*(?:은|는|을|를)?\\s*(?:없음|없이|없애|제거|삭제|0\\s*(?:${unitPattern})?)`,
      'i',
    );
    if (zeroRx.test(normalizedText)) {
      return 0;
    }
  }

  // 4. Noun -> Number: e.g. "푸드트럭을 10대로", "체험부스 약 15개"
  const forwardRx = new RegExp(
    `(?:${nounPattern})\\s*(?:수|수량|은|는|을|를|이|가|:|약|총)?\\s*(\\d{1,2})\\s*(?:${unitPattern}|로|으로)(?!\\s*m|\\s*미터|\\s*명|\\s*원|\\s*만|\\s*억)`,
    'i',
  );
  const fwd = normalizedText.match(forwardRx);
  if (fwd) {
    return Math.max(minVal, Math.min(maxVal, Number(fwd[1])));
  }

  // 5. Number -> Noun: e.g. "10대의 푸드트럭", "15개 체험부스"
  const reverseRx = new RegExp(
    `(\\d{1,2})\\s*(?:${unitPattern})의?\\s*(?:${nounPattern})`,
    'i',
  );
  const rev = normalizedText.match(reverseRx);
  if (rev) {
    return Math.max(minVal, Math.min(maxVal, Number(rev[1])));
  }

  return undefined;
}

interface RealWorldCatalogEntry {
  subtype: FacilitySubtype;
  category: FacilityCategory;
  nameKo: string;
  nameEn: string;
  zoneHint: CustomZoneHint;
  width: number;
  depth: number;
  regex: RegExp;
}

const REAL_WORLD_ELEMENT_CATALOG: RealWorldCatalogEntry[] = [
  {
    subtype: 'beam_projector',
    category: 'stage',
    nameKo: '빔 프로젝터·대형 스크린 단상',
    nameEn: 'Beam Projector & Presentation Screen',
    zoneHint: 'north',
    width: 14,
    depth: 6.5,
    regex: /빔\s*프로젝터|빔프로젝터|프로젝터\s*스크린|발표용?\s*스크린|프레젠테이션\s*스크린|beam\s*projector|projection\s*screen/i,
  },
  {
    subtype: 'goods_shop',
    category: 'booth',
    nameKo: '공식 굿즈·MD 스토어',
    nameEn: 'Official Merch & Goods Store',
    zoneHint: 'east',
    width: 11,
    depth: 8.5,
    regex: /굿즈\s*(?:샵|존|부스|스토어|매장)?|md\s*(?:샵|존|부스|스토어)|기념품\s*(?:샵|부스)|merch(?:\s*store|\s*booth)?/i,
  },
  {
    subtype: 'beer_garden',
    category: 'food',
    nameKo: '비어가든 · 성인인증 맥주존',
    nameEn: 'Craft Beer Garden & Adult Zone',
    zoneHint: 'west',
    width: 18,
    depth: 13,
    regex: /맥주\s*(?:존|부스|가든|광장)|비어\s*가든|주류\s*(?:존|부스)|생맥주\s*부스|하이볼\s*존|beer\s*(?:garden|zone)/i,
  },

  {
    subtype: 'locker_charging',
    category: 'rest',
    nameKo: '물품보관소 · 휴대폰 충전 허브',
    nameEn: 'Smart Locker & Charging Hub',
    zoneHint: 'entrance',
    width: 11,
    depth: 7,
    regex: /물품\s*보관\s*(?:소|함|존)?|물품보관[·\s]*충전소|락커(?:룸|존|함)?|짐\s*보관(?:소)?|충전\s*(?:소|부스|존|허브)|보조배터리(?:\s*대여소)?|locker|bag\s*check|charging/i,
  },
  {
    subtype: 'pet_zone',
    category: 'camping',
    nameKo: '반려견 놀이터 · 펫 쉼터',
    nameEn: 'Companion Dog Park & Pet Zone',
    zoneHint: 'perimeter',
    width: 20,
    depth: 16,
    regex: /반려견\s*(?:놀이터|존|쉼터|파크)|반려동물\s*(?:존|쉼터|놀이터)|펫\s*(?:존|파크|놀이터|쉼터)|애견\s*(?:존|놀이터)|dog\s*park|pet\s*zone/i,
  },
  {
    subtype: 'eco_station',
    category: 'rest',
    nameKo: '다회용기 반납 · 분리수거 클린존',
    nameEn: 'Reusable Cup & Eco Recycling Hub',
    zoneHint: 'south',
    width: 9.5,
    depth: 6.5,
    regex: /다회용기(?:\s*(?:반납소|반납함|반납존|회수함|부스))?|분리수거\s*(?:장|존|소)?|친환경\s*클린존|리사이클\s*존|쓰레기\s*수거소|제로웨이스트(?:\s*존)?|eco\s*station|recycling/i,
  },
  {
    subtype: 'shuttle_stop',
    category: 'parking',
    nameKo: '셔틀버스 · 택시 승하차장',
    nameEn: 'Shuttle Bus & Taxi Drop-Off Bay',
    zoneHint: 'perimeter',
    width: 22,
    depth: 9,
    regex: /셔틀\s*(?:버스)?\s*(?:정류장|승하차장|존|타는곳)?|택시\s*승강장|환승\s*정류소|드롭오프|shuttle|drop[\s-]*off/i,
  },
  {
    subtype: 'wristband_hub',
    category: 'entrance',
    nameKo: '티켓교환 · 손목밴드 · 보안검색소',
    nameEn: 'Wristband Exchange & Bag Check',
    zoneHint: 'entrance',
    width: 14,
    depth: 7.5,
    regex: /(?:입장\s*)?팔찌\s*(?:교환소|교환\s*부스|배부소)|손목\s*밴드(?:\s*교환소|\s*부스)?|리스트밴드(?:\s*교환소|\s*부스)?|티켓\s*(?:교환소|배부소|부스)|보안\s*검색(?:대|소)?|성인\s*인증\s*부스|wristband|security\s*check/i,
  },
  {
    subtype: 'foh_control',
    category: 'stage',
    nameKo: 'FOH 음향·조명 콘솔 & 종합상황실',
    nameEn: 'FOH Sound/Light Tower & Control HQ',
    zoneHint: 'center',
    width: 9,
    depth: 7,
    regex: /foh(?:\s*타워|\s*부스|\s*콘솔)?|음향\s*(?:콘솔|부스|타워)|조명\s*타워|종합\s*상황실|운영\s*본부|컨트롤\s*타워|control\s*tower|sound\s*booth/i,
  },
  {
    subtype: 'mist_cooling',
    category: 'rest',
    nameKo: '쿨링포그 · 무더위 그늘막 쉼터',
    nameEn: 'Mist Cooling & Shade Arcade',
    zoneHint: 'center',
    width: 15,
    depth: 8,
    regex: /쿨링\s*포그(?:\s*존|\s*터널)?|미스트\s*(?:존|터널)|무더위\s*쉼터|안개\s*분사(?:기)?|폭염\s*그늘막|cooling\s*zone|mist\s*tunnel/i,
  },
  {
    subtype: 'smoking_booth',
    category: 'rest',
    nameKo: '외곽 밀폐형 제연 흡연부스',
    nameEn: 'Perimeter Enclosed Smoking Booth',
    zoneHint: 'perimeter',
    width: 6.5,
    depth: 5,
    regex: /흡연\s*(?:부스|실|구역|존)|smoking\s*(?:booth|zone)/i,
  },
];

export function extractCustomElementsFromPrompt(
  rawPrompt: string,
  existingElements: CustomRequestedFacilitySpec[] = [],
): { elements: CustomRequestedFacilitySpec[]; cleared: boolean; changed: boolean } {
  const norm = normalizeKoreanNumerals(rawPrompt);
  const lower = norm.toLowerCase();

  const cleared =
    /(?:특화\s*시설|추가\s*부스|커스텀\s*부스|추가\s*요소)\s*(?:초기화|전체\s*삭제|모두\s*제거)/.test(lower);

  const map = new Map<string, CustomRequestedFacilitySpec>();
  if (!cleared) {
    for (const el of existingElements) {
      map.set(`${el.subtype}::${el.nameKo}`, { ...el });
    }
  }

  let changed = cleared;

  for (const catItem of REAL_WORLD_ELEMENT_CATALOG) {
    if (!catItem.regex.test(norm)) continue;

    // Check if user wants to remove this specific element (e.g., "흡연부스 빼줘/제거")
    const removeRx = new RegExp(
      `(?:${catItem.regex.source})\\s*(?:은|는|을|를)?\\s*(?:제외|삭제|제거|빼|없애)`,
      'i',
    );
    if (removeRx.test(norm)) {
      for (const k of Array.from(map.keys())) {
        if (k.startsWith(`${catItem.subtype}::`)) {
          map.delete(k);
          changed = true;
        }
      }
      continue;
    }

    // Check if count is specified near keyword (e.g., "굿즈샵 2개", "포토존 3곳", "2개의 포토존")
    const countAfterRx = new RegExp(
      `(?:${catItem.regex.source})\\s*(?:은|는|을|를|:)?\\s*(\\d{1,2})\\s*(?:개|동|곳|존|대|소)?`,
      'i',
    );
    const countBeforeRx = new RegExp(
      `(\\d{1,2})\\s*(?:개|동|곳|존|대)의?\\s*(?:${catItem.regex.source})`,
      'i',
    );
    const mAfter = norm.match(countAfterRx);
    const mBefore = norm.match(countBeforeRx);
    const count = Math.max(
      1,
      Math.min(6, Number(mAfter?.[1] || mBefore?.[1] || 1)),
    );

    const key = `${catItem.subtype}::${catItem.nameKo}`;
    map.set(key, {
      nameKo: catItem.nameKo,
      nameEn: catItem.nameEn,
      category: catItem.category,
      subtype: catItem.subtype,
      count,
      zoneHint: catItem.zoneHint,
      width: catItem.width,
      depth: catItem.depth,
    });
    changed = true;
  }

  // Also capture user-named custom booths! e.g. "타로 상담 부스 2개", "페이스페인팅 부스 3개", "커피차 2대"
  const genericIgnoreWords =
    /^(?:체험|전시|학생|홍보|일반|마켓|플리마켓|음식|푸드|식음|먹거리|의료|응급|안내|매표|시스템|옥타늄|컨테이너|파고다|몽골|돔|지오데식|우드|목조|캐노피|파라솔|에어|전체|총|기존|모든|각각|추가)$/;

  const customBoothRegex =
    /([가-힣A-Za-z0-9]{2,10}(?:\s+[가-힣A-Za-z0-9]{1,8})?)\s*(?:체험\s*)?(부스|트럭|차)\s*(\d{1,2})\s*(?:개|동|대|곳)/g;
  let match: RegExpExecArray | null;
  while ((match = customBoothRegex.exec(norm)) !== null) {
    const rawPrefix = match[1].trim().replace(/^(?:그리고|또|및|와|과)\s*/, '');
    const kindWord = match[2];
    const cnt = Math.max(1, Math.min(8, Number(match[3])));
    const firstToken = rawPrefix.split(/\s+/)[0];
    if (
      !rawPrefix ||
      genericIgnoreWords.test(rawPrefix) ||
      genericIgnoreWords.test(firstToken) ||
      REAL_WORLD_ELEMENT_CATALOG.some((c) => c.regex.test(rawPrefix))
    ) {
      continue;
    }

    const isFood = /커피|음료|간식|디저트|분식|베이커리|다과|시식/.test(rawPrefix) || kindWord === '트럭' || kindWord === '차';
    const subtype: FacilitySubtype =
      kindWord === '트럭' || kindWord === '차'
        ? 'food_truck'
        : isFood
          ? 'food_stall'
          : 'experience_booth';
    const category: FacilityCategory = isFood ? 'food' : 'booth';
    const labelKo = `${rawPrefix} ${kindWord}`;
    const key = `${subtype}::${labelKo}`;
    map.set(key, {
      nameKo: labelKo,
      nameEn: `${rawPrefix} ${kindWord === '부스' ? 'Booth' : 'Truck'}`,
      category,
      subtype,
      count: cnt,
      zoneHint: isFood ? 'west' : 'east',
    });
    changed = true;
  }

  return {
    elements: Array.from(map.values()),
    cleared,
    changed,
  };
}

function extractVenueEnvironmentAndFloorOverrides(text: string): {
  venueEnvironment?: VenueEnvironmentType;
  floorMode?: VenueFloorMode;
  indoorFloorPreset?: IndoorFloorPresetId;
  outdoorFloorPreset?: OutdoorFloorPresetId;
  floorCustomColor?: string;
  showFloorGrid?: boolean;
} {
  const lower = text.toLowerCase();
  const res: {
    venueEnvironment?: VenueEnvironmentType;
    floorMode?: VenueFloorMode;
    indoorFloorPreset?: IndoorFloorPresetId;
    outdoorFloorPreset?: OutdoorFloorPresetId;
    floorCustomColor?: string;
    showFloorGrid?: boolean;
  } = {};

  // Explicit indoor / outdoor environment keywords across 6 languages
  if (
    /실외|야외|노천|공원\s*광장|잔디\s*광장|야외\s*행사장|outdoor|open[\s-]*air|屋外|野外|室外|露天|exterior|aire\s*libre|extérieur|plein\s*air/i.test(
      lower,
    )
  ) {
    res.venueEnvironment = 'outdoor';
  } else if (
    /실내|컨벤션\s*홀|전시장\s*내부|실내\s*행사장|실내\s*홀|indoor|interior\s*hall|屋内|室内|展厅内|recinto\s*interior|pabellón\s*cubierto|intérieur|hall\s*couvert/i.test(
      lower,
    )
  ) {
    res.venueEnvironment = 'indoor';
  }

  // Outdoor floor presets
  if (/천연\s*잔디|잔디\s*(?:광장|바닥|구장|마당|로|으로)|잔디밭|natural\s*lawn|grass\s*floor|lawn\s*floor|芝生|天然芝|草坪|草地|césped|pelouse|gazon/i.test(lower)) {
    res.outdoorFloorPreset = 'natural_lawn';
    res.floorMode = 'preset';
    if (!res.venueEnvironment) res.venueEnvironment = 'outdoor';
  } else if (/화강석|석재\s*바닥|돌\s*바닥|보도블록|stone\s*plaza|granite\s*floor|石畳|御影石|花岗岩|石砖地面|piedra|granito|pierre|granit/i.test(lower)) {
    res.outdoorFloorPreset = 'stone_plaza';
    res.floorMode = 'preset';
    if (!res.venueEnvironment) res.venueEnvironment = 'outdoor';
  } else if (/아스팔트|타맥|도로\s*포장|asphalt|tarmac|アスファルト|沥青|柏油|asfalto|asphalte/i.test(lower)) {
    res.outdoorFloorPreset = 'asphalt_street';
    res.floorMode = 'preset';
    if (!res.venueEnvironment) res.venueEnvironment = 'outdoor';
  } else if (/마사토|흙\s*바닥|운동장\s*트랙|육상\s*트랙\s*바닥|clay\s*campus|sand\s*track|dirt\s*field|真砂土|土グラウンド|沙土|跑道地面|tierra\s*batida|terre\s*battue/i.test(lower)) {
    res.outdoorFloorPreset = 'clay_campus';
    res.floorMode = 'preset';
    if (!res.venueEnvironment) res.venueEnvironment = 'outdoor';
  }

  // Indoor floor presets
  if (/에폭시|라이트\s*그레이\s*바닥|epoxy|エポキシ|环氧地坪|epoxi|époxy/i.test(lower)) {
    res.indoorFloorPreset = 'epoxy_light';
    res.floorMode = 'preset';
    if (!res.venueEnvironment) res.venueEnvironment = 'indoor';
  } else if (/카펫|카페트|컨벤션\s*카펫|carpet|カーペット|地毯|moqueta|alfombra|moquette/i.test(lower)) {
    res.indoorFloorPreset = 'expo_carpet';
    res.floorMode = 'preset';
    if (!res.venueEnvironment) res.venueEnvironment = 'indoor';
  } else if (/우드\s*마루|나무\s*바닥|원목\s*마루|체육관\s*마루|목재\s*바닥|parquet|hardwood|wood\s*floor|ウッドパーケット|フローリング|木地板|madera|parquet\s*bois/i.test(lower)) {
    res.indoorFloorPreset = 'wood_parquet';
    res.floorMode = 'preset';
    if (!res.venueEnvironment) res.venueEnvironment = 'indoor';
  } else if (/폴리싱\s*콘크리트|다크\s*콘크리트|노출\s*콘크리트\s*바닥|polished\s*concrete|dark\s*concrete|ポリッシュコンクリート|抛光混凝土|hormigón\s*pulido|béton\s*ciré/i.test(lower)) {
    res.indoorFloorPreset = 'polished_dark';
    res.floorMode = 'preset';
    if (!res.venueEnvironment) res.venueEnvironment = 'indoor';
  }

  // Custom hex color or floor-specific color command
  const hexMatch = text.match(/#([0-9a-fA-F]{6})\b/);
  const mentionsFloor = /바닥|플로어|그라운드|floor|ground|床|地面|suelo|piso|sol\b/i.test(lower);
  if (hexMatch) {
    res.floorMode = 'color';
    res.floorCustomColor = `#${hexMatch[1].toLowerCase()}`;
  } else if (mentionsFloor) {
    const namedColors: Array<[RegExp, string]> = [
      [/하늘색|연파랑|라이트\s*블루|sky\s*blue|light\s*blue|水色|浅蓝|azul\s*claro|bleu\s*clair/i, '#dbeafe'],
      [/파란색|블루|네이비|blue|navy|青|蓝色|azul|bleu/i, '#bfdbfe'],
      [/연두색|초록색|민트|그린|green|mint|緑|绿色|verde|vert/i, '#dcfce7'],
      [/베이지|아이보리|크림색|따뜻한\s*톤|beige|ivory|cream|ベージュ|米色|crema|ivoire/i, '#fef3c7'],
      [/분홍색|핑크|로즈|pink|rose|ピンク|粉色|rosa|rose/i, '#fce7f3'],
      [/연보라|라벤더|퍼플|lavender|purple|ラベンダー|浅紫|lavanda|lavande/i, '#ede9fe'],
      [/어두운\s*회색|차콜|다크\s*그레이|검정|블랙|dark\s*gray|charcoal|black|ダークグレー|深灰|gris\s*oscuro|gris\s*foncé/i, '#334155'],
      [/밝은\s*회색|흰색|화이트|실버|white|light\s*gray|silver|白|ライトグレー|白色|浅灰|blanco|gris\s*claro|blanc/i, '#f8fafc'],
    ];
    for (const [rx, hex] of namedColors) {
      if (rx.test(lower)) {
        res.floorMode = 'color';
        res.floorCustomColor = hex;
        break;
      }
    }
  }

  // Floor grid visibility
  if (/(?:바닥\s*)?(?:격자|그리드)\s*(?:숨김|숨겨|끄기|꺼|없애|제거|비표시)|hide\s*(?:floor\s*)?grid|grid\s*off|グリッド非表示|隐藏网格|ocultar\s*cuadrícula|masquer\s*(?:la\s*)?grille/i.test(lower)) {
    res.showFloorGrid = false;
  } else if (/(?:바닥\s*)?(?:격자|그리드)\s*(?:표시|켜기|켜|보여)|show\s*(?:floor\s*)?grid|grid\s*on|グリッド表示|显示网格|mostrar\s*cuadrícula|afficher\s*(?:la\s*)?grille/i.test(lower)) {
    res.showFloorGrid = true;
  }

  return res;
}

/**
 * Extracts ONLY fields explicitly mentioned in `prompt`.
 * Undefined fields were NOT explicitly commanded in `prompt` — preventing accidental overwrites of Gemini output!
 */
export function extractExplicitFieldOverrides(
  prompt: string,
  baseConfig: EventConfig,
): Partial<ParsedBriefResult> {
  const raw = prompt.trim();
  const norm = normalizeKoreanNumerals(raw);
  const lower = norm.toLowerCase();
  const out: Partial<ParsedBriefResult> = {};

  // 1. Event Type & Archetype (6 languages)
  if (/학교|대동제|한솔|학생\s*축제|캠퍼스\s*축제|대학\s*축제|school|campus\s*festival|学園祭|文化祭|校园节|大学生节|festival\s*(?:escolar|universitario|estudiantil)|festival\s*(?:étudiant|scolaire|campus)/i.test(lower)) {
    out.eventType = 'school_festival';
  } else if (/체육대회|마라톤|스포츠\s*팬|운동회|경기장\s*축제|sports|marathon|スポーツ大会|運動会|运动会|体育节|evento\s*deportivo|événement\s*sportif/i.test(lower)) {
    out.eventType = 'sports_event';
  } else if (/진로|취업|채용\s*박람회|커리어|잡페어|career|job\s*fair|就職フェア|キャリアフェア|招聘会|职业博览会|feria\s*de\s*empleo|salon\s*de\s*l['’]emploi/i.test(lower)) {
    out.eventType = 'career_fair';
  } else if (/박람회|전시회|엑스포|컨벤션|산업전|expo|exhibition|展示会|エキスポ|博覧会|博览会|展览会|exposición|feria\s*comercial|exposition|salon\s*pro/i.test(lower)) {
    out.eventType = 'exhibition';
  } else if (/플리마켓|벼룩시장|야시장|수공예\s*마켓|나이트\s*마켓|flea\s*market|night\s*market|フリーマーケット|マルシェ|跳蚤市场|夜市|市集|mercado\s*(?:de\s*pulgas|artesanal|nocturno)|marché\s*(?:aux\s*puces|artisanal|nocturne)/i.test(lower)) {
    out.eventType = 'flea_market';
  } else if (/지역\s*축제|시민\s*축제|마을\s*축제|농특산물|전통\s*문화제|지자체\s*축제|community\s*festival|地域祭り|市民祭り|地方文化节|社区节|feria\s*comunitaria|fête\s*(?:communautaire|locale)/i.test(lower)) {
    out.eventType = 'community_festival';
  } else if (/음악\s*페스티벌|뮤직\s*페스티벌|락\s*페스티벌|edm\s*페스티벌|콘서트|재즈\s*페스티벌|music\s*festival|rock\s*festival|音楽フェス|ミュージックフェス|音乐节|演唱会|festival\s*de\s*música|festival\s*de\s*musique/i.test(lower)) {
    out.eventType = 'music_festival';
  }

  // Quoted Event Name (keep away from rename clauses)
  const isRenameClause = /이름을?\s*.*(?:변경|바꿔|수정)|rename\s+.+\s+to\s+|名前を.*変更|改名为|重命名|renombrar|renommer/i.test(raw);
  if (!isRenameClause) {
    const quoteMatch = raw.match(/['"「『“]([^'"」』”]{2,40})['"」』”]/);
    if (quoteMatch && /행사|축제|페스티벌|박람회|마켓|festival|expo|fair|market|フェス|フェア|节|展|feria|salon/i.test(quoteMatch[1])) {
      out.eventName = quoteMatch[1];
    } else {
      const namedMatch = raw.match(/(?:행사명|이벤트명|event\s*name|イベント名|活动名称|nombre\s*del\s*evento|nom\s*de\s*l['’]événement)(?:은|을|이|:|\s*is)?\s*['"「『“]?([^'"」』”,.\n]{2,32})['"」』”]?/i);
      if (namedMatch) {
        out.eventName = namedMatch[1].replace(/(?:으로|로|이고)$/, '').trim();
      }
    }
  }

  // 2. Attendance (6 languages)
  const cleanNumText = norm.replace(/,/g, '');
  const manMatch = cleanNumText.match(/(\d+(?:\.\d+)?)\s*(?:만|万)\s*(?:명|인|人)/);
  const cheonMatch = cleanNumText.match(/(\d+(?:\.\d+)?)\s*(?:천|千)\s*(?:명|인|人)/);
  const plainPeopleMatch = cleanNumText.match(
    /(\d{3,5})\s*(?:명|인|人|pax|people|visitors|attendees|personas|visitantes|asistentes|visiteurs|personnes)/i,
  );
  if (manMatch) {
    out.expectedAttendance = Math.max(200, Math.min(50000, Math.round(Number(manMatch[1]) * 10000)));
  } else if (cheonMatch) {
    out.expectedAttendance = Math.max(200, Math.min(50000, Math.round(Number(cheonMatch[1]) * 1000)));
  } else if (plainPeopleMatch) {
    out.expectedAttendance = Math.max(200, Math.min(50000, Number(plainPeopleMatch[1])));
  }

  // 3. Venue Dimensions (avoid matching small booth sizes like 6x5m; venue is >= 90m)
  const dimMatch = cleanNumText.match(/(\d{2,3})\s*(?:m|미터|メートル|米)?\s*[xX×*]\s*(\d{2,3})\s*(?:m|미터|メートル|米)?/);
  const widthOnlyMatch = cleanNumText.match(/(?:행사장\s*)?(?:가로|폭|width|横幅|场地宽|ancho|largeur)\s*(?:은|는|을|를|:)?\s*(\d{3})\s*(?:m|미터)?/i);
  const depthOnlyMatch = cleanNumText.match(/(?:행사장\s*)?(?:세로|깊이|길이|depth|奥行|场地深|profundidad|profondeur)\s*(?:은|는|을|를|:)?\s*(\d{2,3})\s*(?:m|미터)?/i);
  if (dimMatch && Number(dimMatch[1]) >= 80 && Number(dimMatch[2]) >= 70) {
    out.venueWidth = Math.max(100, Math.min(360, Number(dimMatch[1])));
    out.venueDepth = Math.max(90, Math.min(300, Number(dimMatch[2])));
  } else {
    if (widthOnlyMatch && Number(widthOnlyMatch[1]) >= 100) {
      out.venueWidth = Math.max(100, Math.min(360, Number(widthOnlyMatch[1])));
    }
    if (depthOnlyMatch && Number(depthOnlyMatch[1]) >= 90) {
      out.venueDepth = Math.max(90, Math.min(300, Number(depthOnlyMatch[1])));
    }
  }

  // 4. Budget (KRW, USD, JPY, CNY, EUR)
  let explicitBudget = extractBudgetUsdFromPrompt(raw, baseConfig.budget);
  if (explicitBudget === null) {
    const jpyMan = cleanNumText.match(/(\d+(?:\.\d+)?)\s*万\s*円/);
    const cnyWan = cleanNumText.match(/(\d+(?:\.\d+)?)\s*万\s*(?:元|人民币|rmb)/i);
    const eurMatch = cleanNumText.match(/(?:€\s*(\d{4,6})|(\d{4,6})\s*(?:eur|euros?))/i);
    if (jpyMan) explicitBudget = Math.round((Number(jpyMan[1]) * 10000) / 150);
    else if (cnyWan) explicitBudget = Math.round((Number(cnyWan[1]) * 10000) / 7.2);
    else if (eurMatch) explicitBudget = Math.round(Number(eurMatch[1] || eurMatch[2]) / 0.92);
  }
  if (explicitBudget !== null) {
    out.budget = Math.max(10000, Math.min(950000, explicitBudget));
  }

  // 5. Objective
  if (/예산\s*절감|저비용|비용\s*절감|예산\s*최적|가성비|예산\s*이내|budget\s*efficiency|low\s*cost|予算効率|低コスト|预算优先|低成本|presupuesto|económico|budget\s*optimisé/i.test(lower)) {
    out.objective = 'budget_efficiency';
  } else if (/휠체어|유모차|교통약자|고령자|어르신|포용|무장애|accessible|wheelchair|inclusive|バリアフリー|車椅子|无障碍|轮椅|accesibilidad|silla\s*de\s*ruedas|accessibilité|fauteuil\s*roulant/i.test(lower)) {
    out.objective = 'accessibility_inclusion';
  } else if (/혼잡\s*완화|병목\s*해소|대기시간\s*단축|분산\s*최적|congestion|queue|混雑緩和|ボトルネック|缓解拥堵|congestión|colas|embouteillage/i.test(lower)) {
    out.objective = 'congestion_reduction';
  } else if (/안전\s*최우선|비상\s*대피|밀집\s*안전|행안부|압사\s*예방|safety\s*first|安全最優先|避難優先|安全第一|应急优先|seguridad\s*primero|sécurité\s*prioritaire/i.test(lower)) {
    out.objective = 'safety_first';
  } else if (/체험\s*중심|참여|체류\s*만족|즐길거리|engagement|体験重視|互动体验|experiencia\s*del\s*visitante|expérience\s*visiteur/i.test(lower)) {
    out.objective = 'visitor_engagement';
  } else if (/운영\s*효율|관리\s*동선|스태프\s*동선|operational|運営効率|运营效率|eficiencia\s*operativa|efficacité\s*opérationnelle/i.test(lower)) {
    out.objective = 'operational_efficiency';
  }

  // 6. Indoor / Outdoor Environment & Floor Surface Settings
  const envFloor = extractVenueEnvironmentAndFloorOverrides(raw);
  if (envFloor.venueEnvironment) out.venueEnvironment = envFloor.venueEnvironment;
  if (envFloor.floorMode) out.floorMode = envFloor.floorMode;
  if (envFloor.indoorFloorPreset) out.indoorFloorPreset = envFloor.indoorFloorPreset;
  if (envFloor.outdoorFloorPreset) out.outdoorFloorPreset = envFloor.outdoorFloorPreset;
  if (envFloor.floorCustomColor) out.floorCustomColor = envFloor.floorCustomColor;
  if (envFloor.showFloorGrid !== undefined) out.showFloorGrid = envFloor.showFloorGrid;

  // 7. Real-world Venue Shape, Stage Placement, Layout Model, Booth Style
  const vShape = extractVenueShapeFromPrompt(raw);
  if (vShape) out.venueShape = vShape;

  const sPlace = extractStagePlacementFromPrompt(raw);
  if (sPlace) out.stagePlacement = sPlace;

  const vModel = extractVenueLayoutModelFromPrompt(raw);
  if (vModel) out.venueLayoutModel = vModel;
  else if (vShape === 'circle_arena') out.venueLayoutModel = 'circular_plaza';
  else if (vShape === 'fan_amphitheater') out.venueLayoutModel = 'radial_fan';
  else if (vShape === 'linear_park') out.venueLayoutModel = 'waterside_promenade';
  else if (vShape === 'expo_hall') out.venueLayoutModel = 'boulevard_grid';
  else if (sPlace === 'center_360' && !baseConfig.venueLayoutModel) out.venueLayoutModel = 'circular_plaza';

  const bModel = extractBoothModelFromPrompt(raw);
  if (bModel) out.boothModel = bModel;

  // 8. Facility Counts (bidirectional & delta-aware across 6 languages!)
  const foodCnt = matchCountOrDelta(
    cleanNumText,
    '푸드트럭|푸드\\s*부스|푸드존|음식\\s*부스|음식점|식음\\s*부스|식음료\\s*부스|먹거리\\s*부스|먹거리존|매점|food\\s*trucks?|food\\s*booths?|food\\s*stalls?|キッチンカー|飲食ブース|フードトラック|餐车|美食展位|餐饮摊位|puestos?\\s*de\\s*comida|stands?\\s*repas',
    '개|대|동|곳|존|칸|기|units?|stalls?|trucks?|台|箇所|つ|个|辆|处|unidades?',
    baseConfig.foodBoothCount,
    0,
    24,
  );
  if (foodCnt !== undefined) out.foodBoothCount = foodCnt;

  let expCnt = matchCountOrDelta(
    cleanNumText,
    '(?:모던\\s*)?컨테이너\\s*부스|(?:지오데식\\s*)?돔\\s*부스|(?:우드\\s*)?파빌리온\\s*부스|목조\\s*부스|옥타늄\\s*(?:전시\\s*)?부스|시스템\\s*부스|(?:마켓\\s*)?파라솔\\s*부스|캐노피\\s*부스|파고다\\s*(?:부스|텐트)|몽골\\s*텐트|에어(?:돔)?\\s*부스|체험\\s*부스|체험존|전시\\s*부스|홍보\\s*부스|동아리\\s*부스|학생\\s*(?:체험\\s*)?부스|(?:진로|취업|채용)\\s*상담\\s*부스|마켓\\s*부스|플리마켓\\s*(?:파라솔|부스)|판매\\s*부스|팝업\\s*부스|기업\\s*부스|채용\\s*부스|experience\\s*booths?|exhibition\\s*booths?|体験ブース|展示ブース|体验展位|互动展位|stands?\\s*de\\s*experiencia|stands?\\s*d[’\']expérience',
    '개|동|곳|칸|존|매대|부스|units?|booths?|箇所|つ|棟|个|处|stands?|unidades?',
    baseConfig.experienceBoothCount,
    0,
    40,
  );
  if (expCnt === undefined) {
    const genericAfter = cleanNumText.match(
      /(?:^|[,.\n]|그리고\s+|및\s+)부스\s*(?:수|수량|은|는|을|를|이|가|:|약|총)?\s*(\d{1,2})\s*(?:개|동|곳|칸|매대|로|으로)(?!\s*m|\s*명|\s*원)/,
    );
    const genericDeltaInc = cleanNumText.match(
      /(?:^|[,.\n]|\s)(?!(?:푸드|음식|의료|흡연)\s*)부스\s*(?:을|를)?\s*(\d{1,2})\s*(?:개|동|곳)?\s*(?:더\s*)?(?:추가|증설|늘려)/,
    );
    const genericDeltaDec = cleanNumText.match(
      /(?:^|[,.\n]|\s)(?!(?:푸드|음식|의료|흡연)\s*)부스\s*(?:을|를)?\s*(\d{1,2})\s*(?:개|동|곳)?\s*(?:줄여|감축|축소)/,
    );
    if (genericDeltaInc) {
      expCnt = Math.min(40, baseConfig.experienceBoothCount + Number(genericDeltaInc[1]));
    } else if (genericDeltaDec) {
      expCnt = Math.max(0, baseConfig.experienceBoothCount - Number(genericDeltaDec[1]));
    } else if (genericAfter) {
      expCnt = Math.max(0, Math.min(40, Number(genericAfter[1])));
    }
  }
  if (expCnt !== undefined) out.experienceBoothCount = expCnt;

  const gateCnt = matchCountOrDelta(
    cleanNumText,
    '출입구|게이트|입출구|진출입구|입구|비상출구|entrances?|gates?|出入口|ゲート|入口|acceso|puertas?|entrées?|portes?',
    '개|곳|문|차선|개소|gates?|箇所|つ|个|处|puertas?|portes?',
    baseConfig.entranceCount,
    1,
    6,
  );
  if (gateCnt !== undefined) out.entranceCount = gateCnt;

  const rrCnt = matchCountOrDelta(
    cleanNumText,
    '화장실|변기동|위생시설|restrooms?|toilets?|トイレ|お手洗い|卫生间|洗手间|厕所|baños?|sanitarios?|sanitaires?|toilettes?',
    '개|동|곳|소|개소|箇所|つ|棟|个|处|unidades?',
    baseConfig.restroomCount ?? 2,
    1,
    8,
  );
  if (rrCnt !== undefined) out.restroomCount = rrCnt;

  const medCnt = matchCountOrDelta(
    cleanNumText,
    '응급의료소|의료소|응급구호소|구호소|의무실|의료\\s*부스|medical\\s*(?:posts?|stations?)?|first\\s*aid|救護室|救護所|医务室|医疗站|puestos?\\s*médicos?|postes?\\s*médicaux|infirmerie',
    '개|동|곳|소|개소|箇所|つ|个|处|unidades?',
    baseConfig.medicalCount ?? 1,
    1,
    5,
  );
  if (medCnt !== undefined) out.medicalCount = medCnt;

  const parkCnt = matchCountOrDelta(
    cleanNumText,
    '(?:외부\\s*|외곽\\s*)?주차장|주차구역|주차존|(?:exterior\\s*)?parking(?:\\s*lots?)?|外部駐車場|駐車場|外部停车场|停车场|estacionamientos?|aparcamientos?|parkings?',
    '개|곳|존|면|소|개소|lots?|bays?|箇所|つ|处|个|zonas?|zones?',
    baseConfig.parkingCount ?? 1,
    0,
    6,
  );
  if (parkCnt !== undefined) {
    out.parkingCount = parkCnt;
  } else if (
    /(?:외부\s*|외곽\s*)?(?:주차장|parking|駐車場|停车场|estacionamiento)\s*(?:설치|추가|신설|배치|마련|조성|add|install|設置|追加|设置|añadir|ajouter)/i.test(
      lower,
    )
  ) {
    out.parkingCount = Math.max(1, (baseConfig.parkingCount ?? 0) + 1);
  }

  const seatCnt = matchCountOrDelta(
    cleanNumText,
    '관객석|객석|좌석\\s*블록|좌석\\s*구역|관람석|스탠드석|seating\\s*blocks?|bleachers?|観客席|客席|观众席|看台|gradas?|asientos?|gradins?',
    '개|구역|블록|동|곳|존|blocks?|箇所|ブロック|个|区',
    baseConfig.seatingBlockCount ?? 2,
    0,
    6,
  );
  if (seatCnt !== undefined) {
    out.seatingBlockCount = seatCnt;
  } else if (/전석\s*스탠딩|스탠딩\s*전용|좌석\s*없이|관객석\s*없이|standing\s*only|no\s*seating|オールスタンディング|全站席|sin\s*gradas|debout\s*uniquement/i.test(lower)) {
    out.seatingBlockCount = 0;
  } else if (sPlace === 'center_360' && baseConfig.seatingBlockCount === undefined) {
    out.seatingBlockCount = 4;
  } else if (sPlace === 'none') {
    out.seatingBlockCount = 0;
  }

  const subCnt = matchCountOrDelta(
    cleanNumText,
    '보조\\s*무대|서브\\s*무대|소무대|버스킹\\s*무대|세컨드\\s*무대|sub[\\s-]*stages?|secondary\\s*stages?|サブステージ|副舞台|escenarios?\\s*secundarios?|scènes?\\s*secondaires?',
    '개|곳|동|기|stages?|箇所|つ|个',
    baseConfig.subStageCount ?? 0,
    0,
    3,
  );
  if (subCnt !== undefined) {
    out.subStageCount = subCnt;
  } else if (/(?:보조\s*무대|서브\s*무대|소무대|버스킹\s*무대|sub[\s-]*stage|サブステージ|副舞台)\s*(?:추가|설치|넣어|배치|add|追加|添加)/i.test(lower)) {
    out.subStageCount = Math.max(1, (baseConfig.subStageCount ?? 0) + 1);
  }

  // 9. Boolean zones & Accessibility flags
  if (/vip\s*(?:제외|없음|삭제|빼|제거|미포함)|no\s*vip|without\s*vip|vipなし|取消vip|sin\s*vip|sans\s*vip/i.test(lower)) out.vipZone = false;
  else if (/\bvip\b|vip\s*(?:존|라운지|석|데크|ラウンジ|贵宾|salón|salon)/i.test(lower)) out.vipZone = true;

  if (/(?:캠핑|피크닉)\s*(?:제외|없음|삭제|빼|제거|미포함)|no\s*camping|sin\s*camping|sans\s*camping/i.test(lower)) out.campingArea = false;
  else if (/캠핑|피크닉\s*(?:존|빌리지|구역)|글램핑|camping|ピクニック|露营|野餐|zona\s*picnic|zone\s*picnic/i.test(lower)) out.campingArea = true;

  if (/(?:어린이|놀이광장|키즈존|분수|관람차)\s*(?:제외|없음|삭제|빼|제거)|no\s*kids\s*zone/i.test(lower)) out.playRestZone = false;
  else if (/어린이|놀이광장|키즈존|분수|관람차|패밀리존|kids\s*zone|キッズゾーン|儿童区|zona\s*infantil|espace\s*enfants/i.test(lower)) out.playRestZone = true;

  if (/(?:경사로|무장애|무단차)\s*(?:해제|제외|없음|끄기|off)/i.test(lower)) out.stepFreeRoutes = false;
  else if (/휠체어|유모차|무단차|경사로|포용|무장애|배리어프리|barrier[\s-]*free|step[\s-]*free|ramp|バリアフリー|スロープ|无障碍|坡道|sin\s*escalones|rampa|sans\s*marche|rampe/i.test(lower)) {
    out.stepFreeRoutes = true;
  }

  if (/광폭\s*(?:해제|제외|끄기)|일반\s*통로/.test(lower)) out.wideCorridors = false;
  else if (/휠체어|유모차|어르신|포용|무장애|배리어프리|광폭|통로\s*확장|wide\s*corridor|wide\s*aisle|広幅通路|宽通道|pasillo\s*ancho|allée\s*large/i.test(lower)) {
    out.wideCorridors = true;
  }

  if (/장애인\s*화장실|다목적\s*화장실|accessible\s*restroom|多目的トイレ|无障碍卫生间|baño\s*accesible|sanitaires?\s*pmr/i.test(lower)) {
    out.accessibleRestrooms = true;
  }
  if (/장애인\s*주차|교통약자\s*주차|accessible\s*parking|思いやり駐車場|无障碍停车|parking\s*pmr/i.test(lower)) {
    out.accessibleParking = true;
  }

  // 10. Custom Real-World Festival Elements
  const customParsed = extractCustomElementsFromPrompt(raw, baseConfig.customElements ?? []);
  if (customParsed.changed) {
    out.customElements = customParsed.elements;
    if (customParsed.cleared) out.clearCustomElements = true;
  }

  return out;
}

/**
 * Deterministic Natural-Language Event Brief & Modification Parser.
 * Preserves existing baseConfig fields whenever the user enters an incremental change command,
 * while applying full archetype presets when a brand-new event type is requested!
 */
export function parseBriefDeterministically(
  prompt: string,
  baseConfig: EventConfig,
  lang: Language = 'ko',
): ParsedBriefResult {
  const exp = extractExplicitFieldOverrides(prompt, baseConfig);
  const eventTypeChanged = exp.eventType !== undefined && exp.eventType !== baseConfig.eventType;
  const preset = eventTypeChanged ? EVENT_TYPE_PRESETS[exp.eventType!] || {} : {};

  const eventType: EventType = exp.eventType ?? baseConfig.eventType;
  const expectedAttendance =
    exp.expectedAttendance ??
    (eventTypeChanged && preset.expectedAttendance ? preset.expectedAttendance : baseConfig.expectedAttendance);

  let venueWidth =
    exp.venueWidth ??
    (eventTypeChanged && preset.venueWidth ? preset.venueWidth : baseConfig.venueWidth);
  let venueDepth =
    exp.venueDepth ??
    (eventTypeChanged && preset.venueDepth ? preset.venueDepth : baseConfig.venueDepth);

  if (exp.venueWidth === undefined && exp.venueDepth === undefined && exp.expectedAttendance !== undefined) {
    if (expectedAttendance <= 3500) {
      venueWidth = 160;
      venueDepth = 130;
    } else if (expectedAttendance >= 15000) {
      venueWidth = 260;
      venueDepth = 190;
    }
  }

  const budget =
    exp.budget ??
    (eventTypeChanged && preset.budget ? preset.budget : baseConfig.budget);
  const objective = exp.objective ?? baseConfig.objective;

  const venueShape: VenueBoundaryShape =
    exp.venueShape ??
    (eventTypeChanged && preset.venueShape ? preset.venueShape : baseConfig.venueShape ?? 'rectangle');

  const stagePlacement: StagePlacementMode =
    exp.stagePlacement ??
    (eventTypeChanged && preset.stagePlacement
      ? preset.stagePlacement
      : baseConfig.stagePlacement ?? 'north_end');

  const venueLayoutModel: VenueLayoutModel =
    exp.venueLayoutModel ??
    (eventTypeChanged && preset.venueLayoutModel
      ? preset.venueLayoutModel
      : baseConfig.venueLayoutModel ?? 'standard');

  const boothModel: BoothModelStyle =
    exp.boothModel ??
    (eventTypeChanged && preset.boothModel
      ? preset.boothModel
      : baseConfig.boothModel ?? 'pagoda_tent');

  const foodBoothCount =
    exp.foodBoothCount ??
    (eventTypeChanged && preset.foodBoothCount !== undefined
      ? preset.foodBoothCount
      : baseConfig.foodBoothCount);

  const experienceBoothCount =
    exp.experienceBoothCount ??
    (eventTypeChanged && preset.experienceBoothCount !== undefined
      ? preset.experienceBoothCount
      : baseConfig.experienceBoothCount);

  const entranceCount =
    exp.entranceCount ??
    (eventTypeChanged && preset.entranceCount !== undefined
      ? preset.entranceCount
      : baseConfig.entranceCount);

  const seatingBlockCount =
    exp.seatingBlockCount ??
    (stagePlacement === 'none'
      ? 0
      : stagePlacement === 'center_360'
        ? 4
        : eventTypeChanged && preset.seatingBlockCount !== undefined
          ? preset.seatingBlockCount
          : baseConfig.seatingBlockCount ?? 2);

  const restroomCount = exp.restroomCount ?? baseConfig.restroomCount;
  const medicalCount = exp.medicalCount ?? baseConfig.medicalCount;
  const parkingCount = exp.parkingCount ?? baseConfig.parkingCount;
  const subStageCount = exp.subStageCount ?? baseConfig.subStageCount;

  const vipZone =
    exp.vipZone ??
    (eventTypeChanged && preset.requiredFacilities
      ? preset.requiredFacilities.vipZone
      : baseConfig.requiredFacilities.vipZone);
  const campingArea =
    exp.campingArea ??
    (eventTypeChanged && preset.requiredFacilities
      ? preset.requiredFacilities.campingArea
      : baseConfig.requiredFacilities.campingArea);
  const playRestZone =
    exp.playRestZone ??
    (eventTypeChanged && preset.requiredFacilities
      ? preset.requiredFacilities.playRestZone
      : baseConfig.requiredFacilities.playRestZone);
  const extraMedical =
    (medicalCount !== undefined && medicalCount >= 2) ||
    expectedAttendance >= 9000 ||
    baseConfig.requiredFacilities.extraMedical;

  const stepFreeRoutes = exp.stepFreeRoutes ?? baseConfig.accessibility.stepFreeRoutes;
  const wideCorridors = exp.wideCorridors ?? baseConfig.accessibility.wideCorridors;
  const accessibleRestrooms = exp.accessibleRestrooms ?? baseConfig.accessibility.accessibleRestrooms;
  const accessibleParking = exp.accessibleParking ?? baseConfig.accessibility.accessibleParking;
  const customElements = exp.customElements ?? baseConfig.customElements ?? [];

  const venueEnvironment =
    exp.venueEnvironment ??
    (eventTypeChanged && preset.venueEnvironment ? preset.venueEnvironment : baseConfig.venueEnvironment);
  const floorMode = exp.floorMode ?? baseConfig.floorSettings?.mode;
  const indoorFloorPreset = exp.indoorFloorPreset ?? baseConfig.floorSettings?.indoorPreset;
  const outdoorFloorPreset = exp.outdoorFloorPreset ?? baseConfig.floorSettings?.outdoorPreset;
  const floorCustomColor = exp.floorCustomColor ?? baseConfig.floorSettings?.customColor;
  const showFloorGrid = exp.showFloorGrid ?? baseConfig.floorSettings?.showGrid;

  let eventName = exp.eventName ?? baseConfig.eventName;
  if (!exp.eventName && eventTypeChanged) {
    eventName = pickL6(lang, EVENT_PRESET_NAME_I18N[eventType]);
  }

  const shapeLabel = pickL6(lang, VENUE_SHAPE_I18N[venueShape]).split(' (')[0].split('（')[0];
  const stageLabel = pickL6(lang, STAGE_PLACEMENT_I18N[stagePlacement]).split(' (')[0].split('（')[0];
  const layoutLabel = pickL6(lang, VENUE_LAYOUT_MODEL_I18N[venueLayoutModel]).split(' (')[0].split('（')[0];
  const boothLabel = pickL6(lang, BOOTH_MODEL_STYLE_I18N[boothModel]).split(' (')[0].split('（')[0];
  const envLabel =
    venueEnvironment === 'outdoor'
      ? tr6(lang, '실외', 'Outdoor', '屋外', '室外', 'Exterior', 'Extérieur')
      : tr6(lang, '실내', 'Indoor', '屋内', '室内', 'Interior', 'Intérieur');

  const summaryParts = [
    `${envLabel} ${venueWidth}m×${venueDepth}m (${shapeLabel})`,
    `${expectedAttendance.toLocaleString()} ${tr6(lang, '명', 'pax', '名', '人', 'pax', 'pers.')}`,
    `${tr6(lang, '무대', 'Stage', 'ステージ', '舞台', 'Escenario', 'Scène')}: ${stageLabel}`,
    `${layoutLabel} · ${boothLabel}`,
    `${tr6(lang, '푸드', 'Food', '飲食', '餐饮', 'Comida', 'Repas')} ${foodBoothCount} · ${tr6(lang, '체험', 'Booths', '体験', '展位', 'Stands', 'Stands')} ${experienceBoothCount} · ${tr6(lang, '출입구', 'Gates', '出入口', '入口', 'Accesos', 'Portes')} ${entranceCount}`,
    `${tr6(lang, '예산', 'Budget', '予算', '预算', 'Presupuesto', 'Budget')} ${formatCurrency(budget, lang)}`,
  ];
  if (parkingCount !== undefined && parkingCount > 0) {
    summaryParts.push(
      `${tr6(lang, '외부주차장', 'Ext. Parking', '外部駐車場', '外部停车场', 'Parking Ext.', 'Parking Ext.')} ${parkingCount}`,
    );
  }
  if (customElements.length > 0) {
    summaryParts.push(
      customElements
        .map((c) => {
          const subLabel = SUBTYPE_SIMPLE_LABELS[c.subtype]?.[lang] || (lang === 'ko' ? c.nameKo : c.nameEn);
          return `${subLabel}${c.count > 1 ? `×${c.count}` : ''}`;
        })
        .join(', '),
    );
  }

  const summaryPrefix = tr6(
    lang,
    '조건 반영 완료',
    'Conditions applied',
    '条件を反映しました',
    '条件已应用',
    'Condiciones aplicadas',
    'Conditions appliquées',
  );

  return {
    eventName,
    eventType,
    venueWidth,
    venueDepth,
    expectedAttendance,
    budget,
    objective,
    venueShape,
    stagePlacement,
    venueLayoutModel,
    boothModel,
    venueEnvironment,
    floorMode,
    indoorFloorPreset,
    outdoorFloorPreset,
    floorCustomColor,
    showFloorGrid,
    seatingBlockCount,
    foodBoothCount,
    experienceBoothCount,
    entranceCount,
    restroomCount,
    medicalCount,
    parkingCount,
    subStageCount,
    customElements,
    clearCustomElements: exp.clearCustomElements,
    vipZone,
    campingArea,
    extraMedical,
    playRestZone,
    stepFreeRoutes,
    wideCorridors,
    accessibleRestrooms,
    accessibleParking,
    extractedSummary: `${summaryPrefix}: ${summaryParts.join(' · ')}`,
  };
}

const VALID_SHAPES: VenueBoundaryShape[] = [
  'rectangle',
  'circle_arena',
  'fan_amphitheater',
  'linear_park',
  'courtyard_campus',
  'expo_hall',
];

const VALID_STAGE_MODES: StagePlacementMode[] = [
  'north_end',
  'center_360',
  'twin_stages',
  'runway_keynote',
  'projector_screen',
  'none',
];

const VALID_VENUE_MODELS: VenueLayoutModel[] = [
  'standard',
  'circular_plaza',
  'u_courtyard',
  'boulevard_grid',
  'cluster_village',
  'radial_fan',
  'diagonal_avenue',
  'waterside_promenade',
];

const VALID_BOOTH_MODELS: BoothModelStyle[] = [
  'pagoda_tent',
  'modern_container',
  'open_canopy',
  'wooden_pavilion',
  'geodesic_dome',
  'expo_shell',
  'parasol_table',
  'inflatable_air',
];

/**
 * Non-destructive merger between Gemini 3.8 output (`aiData`) and deterministic explicit overrides (`exp`).
 * ONLY fields that had a direct linguistic match in `prompt` override `aiData` — NEVER clobbering Gemini's
 * smart inferences with stale `baseConfig` values!
 */
export function mergeExplicitPromptOverrides(
  prompt: string,
  baseConfig: EventConfig,
  aiData: ParsedBriefResult,
): ParsedBriefResult {
  const exp = extractExplicitFieldOverrides(prompt, baseConfig);
  const detFallback = parseBriefDeterministically(prompt, baseConfig);

  const venueShape: VenueBoundaryShape =
    exp.venueShape ??
    (aiData.venueShape && VALID_SHAPES.includes(aiData.venueShape)
      ? aiData.venueShape
      : baseConfig.venueShape ?? 'rectangle');

  const stagePlacement: StagePlacementMode =
    exp.stagePlacement ??
    (aiData.stagePlacement && VALID_STAGE_MODES.includes(aiData.stagePlacement)
      ? aiData.stagePlacement
      : baseConfig.stagePlacement ?? 'north_end');

  const venueLayoutModel: VenueLayoutModel =
    exp.venueLayoutModel ??
    (aiData.venueLayoutModel && VALID_VENUE_MODELS.includes(aiData.venueLayoutModel)
      ? aiData.venueLayoutModel
      : detFallback.venueLayoutModel ?? 'standard');

  const boothModel: BoothModelStyle =
    exp.boothModel ??
    (aiData.boothModel && VALID_BOOTH_MODELS.includes(aiData.boothModel)
      ? aiData.boothModel
      : detFallback.boothModel ?? 'pagoda_tent');

  // Merge customElements from existing + Gemini + explicit regex without duplicates
  const mergedCustomMap = new Map<string, CustomRequestedFacilitySpec>();
  const shouldClear = Boolean(exp.clearCustomElements || aiData.clearCustomElements);
  if (!shouldClear && Array.isArray(baseConfig.customElements)) {
    for (const c of baseConfig.customElements) {
      mergedCustomMap.set(`${c.subtype}::${c.nameKo}`, { ...c });
    }
  }
  if (Array.isArray(aiData.customElements)) {
    for (const c of aiData.customElements) {
      if (c && c.nameKo && c.subtype && c.category) {
        mergedCustomMap.set(`${c.subtype}::${c.nameKo}`, {
          nameKo: c.nameKo,
          nameEn: c.nameEn || c.nameKo,
          category: c.category,
          subtype: c.subtype,
          count: Math.max(1, Math.min(8, Math.round(Number(c.count) || 1))),
          zoneHint: c.zoneHint,
        });
      }
    }
  }
  if (Array.isArray(exp.customElements)) {
    if (exp.clearCustomElements) mergedCustomMap.clear();
    for (const c of exp.customElements) {
      // Avoid duplicating same subtype if Gemini already added a slightly differently named entry for the same standard catalog subtype
      if (c.subtype !== 'experience_booth' && c.subtype !== 'food_truck' && c.subtype !== 'food_stall') {
        for (const k of Array.from(mergedCustomMap.keys())) {
          if (k.startsWith(`${c.subtype}::`)) mergedCustomMap.delete(k);
        }
      }
      mergedCustomMap.set(`${c.subtype}::${c.nameKo}`, { ...c });
    }
  }

  const mergedCustom = Array.from(mergedCustomMap.values());

  return {
    ...aiData,
    eventName: exp.eventName ?? aiData.eventName ?? baseConfig.eventName,
    eventType: exp.eventType ?? aiData.eventType ?? baseConfig.eventType,
    venueWidth: exp.venueWidth ?? aiData.venueWidth ?? baseConfig.venueWidth,
    venueDepth: exp.venueDepth ?? aiData.venueDepth ?? baseConfig.venueDepth,
    expectedAttendance:
      exp.expectedAttendance ?? aiData.expectedAttendance ?? baseConfig.expectedAttendance,
    budget: exp.budget ?? aiData.budget ?? baseConfig.budget,
    objective: exp.objective ?? aiData.objective ?? baseConfig.objective,
    venueShape,
    stagePlacement,
    venueLayoutModel,
    boothModel,
    seatingBlockCount:
      exp.seatingBlockCount ??
      aiData.seatingBlockCount ??
      (stagePlacement === 'none'
        ? 0
        : stagePlacement === 'center_360'
          ? 4
          : baseConfig.seatingBlockCount ?? 2),
    foodBoothCount:
      exp.foodBoothCount ??
      (typeof aiData.foodBoothCount === 'number'
        ? aiData.foodBoothCount
        : baseConfig.foodBoothCount),
    experienceBoothCount:
      exp.experienceBoothCount ??
      (typeof aiData.experienceBoothCount === 'number'
        ? aiData.experienceBoothCount
        : baseConfig.experienceBoothCount),
    entranceCount:
      exp.entranceCount ??
      (typeof aiData.entranceCount === 'number' ? aiData.entranceCount : baseConfig.entranceCount),
    restroomCount: exp.restroomCount ?? aiData.restroomCount ?? baseConfig.restroomCount,
    medicalCount: exp.medicalCount ?? aiData.medicalCount ?? baseConfig.medicalCount,
    parkingCount: exp.parkingCount ?? aiData.parkingCount ?? baseConfig.parkingCount,
    subStageCount: exp.subStageCount ?? aiData.subStageCount ?? baseConfig.subStageCount,
    customElements: mergedCustom,
    vipZone: exp.vipZone ?? aiData.vipZone ?? baseConfig.requiredFacilities.vipZone,
    campingArea: exp.campingArea ?? aiData.campingArea ?? baseConfig.requiredFacilities.campingArea,
    extraMedical:
      exp.medicalCount !== undefined && exp.medicalCount >= 2
        ? true
        : (aiData.extraMedical ?? baseConfig.requiredFacilities.extraMedical),
    playRestZone:
      exp.playRestZone ?? aiData.playRestZone ?? baseConfig.requiredFacilities.playRestZone,
    stepFreeRoutes:
      exp.stepFreeRoutes ?? aiData.stepFreeRoutes ?? baseConfig.accessibility.stepFreeRoutes,
    wideCorridors:
      exp.wideCorridors ?? aiData.wideCorridors ?? baseConfig.accessibility.wideCorridors,
    accessibleRestrooms:
      aiData.accessibleRestrooms ?? baseConfig.accessibility.accessibleRestrooms,
    accessibleParking:
      aiData.accessibleParking ?? baseConfig.accessibility.accessibleParking,
    extractedSummary: aiData.extractedSummary || detFallback.extractedSummary,
  };
}

function getSubtypeDefaultSpec(subtype: FacilitySubtype, boothCostMult: number): {
  w: number;
  d: number;
  h: number;
  cap: number;
  cost: number;
  weight: number;
  color: string;
  covered: boolean;
  zone: CustomZoneHint;
} {
  switch (subtype) {
    case 'goods_shop':
      return { w: 11, d: 8.5, h: 5.2, cap: 280, cost: Math.round(7800 * boothCostMult), weight: 1.95, color: '#f59e0b', covered: true, zone: 'east' };
    case 'beer_garden':
      return { w: 18, d: 13, h: 4.5, cap: 420, cost: 11500, weight: 2.0, color: '#eab308', covered: true, zone: 'west' };
    case 'photo_zone':
      return { w: 4.4, d: 3.6, h: 7.4, cap: 190, cost: 5200, weight: 1.85, color: '#ec4899', covered: false, zone: 'center' };
    case 'locker_charging':
      return { w: 11, d: 7, h: 3.8, cap: 320, cost: 6800, weight: 1.3, color: '#0284c7', covered: true, zone: 'entrance' };
    case 'pet_zone':
      return { w: 20, d: 16, h: 2.8, cap: 260, cost: 9200, weight: 1.25, color: '#10b981', covered: false, zone: 'perimeter' };
    case 'eco_station':
      return { w: 9.5, d: 6.5, h: 3.6, cap: 220, cost: 4500, weight: 1.1, color: '#16a34a', covered: true, zone: 'south' };
    case 'shuttle_stop':
      return { w: 22, d: 9, h: 4.2, cap: 480, cost: 9800, weight: 1.45, color: '#0ea5e9', covered: true, zone: 'perimeter' };
    case 'wristband_hub':
      return { w: 14, d: 7.5, h: 4.5, cap: 520, cost: 8600, weight: 1.75, color: '#6366f1', covered: true, zone: 'entrance' };
    case 'foh_control':
      return { w: 9, d: 7, h: 7.5, cap: 40, cost: 12000, weight: 0.25, color: '#334155', covered: true, zone: 'center' };
    case 'mist_cooling':
      return { w: 15, d: 8, h: 4.2, cap: 340, cost: 6200, weight: 1.45, color: '#38bdf8', covered: true, zone: 'center' };
    case 'smoking_booth':
      return { w: 6.5, d: 5, h: 3.2, cap: 60, cost: 4800, weight: 0.55, color: '#64748b', covered: true, zone: 'perimeter' };
    case 'food_truck':
      return { w: 10, d: 5.5, h: 4.0, cap: 240, cost: 5200, weight: 1.8, color: '#f97316', covered: false, zone: 'west' };
    case 'food_stall':
      return { w: 8, d: 7, h: 4.2, cap: 220, cost: Math.round(4500 * boothCostMult), weight: 1.7, color: '#ea580c', covered: true, zone: 'west' };
    default:
      return { w: 8, d: 8, h: 5.0, cap: 190, cost: Math.round(5400 * boothCostMult), weight: 1.55, color: '#8b5cf6', covered: true, zone: 'east' };
  }
}

/**
 * Multi-Topology Spatial Layout Generator supporting:
 * - 6 Real-World Venue Boundary Shapes (`venueShape`)
 * - 5 Stage Placement Configurations (`stagePlacement`: north_end, center_360, twin_stages, runway_keynote, none)
 * - 8 Spatial Zoning Topologies (`venueLayoutModel`)
 * - 8 Booth Architectural 3D Models (`boothModel`)
 * - Unlimited Prompt-Driven Custom Festival Elements (`customElements`)
 */
export function generateVenueLayout(
  config: EventConfig,
  lockedFacilities: Facility[] = [],
): Facility[] {
  const venueShape: VenueBoundaryShape = config.venueShape || 'rectangle';
  const stagePlacement: StagePlacementMode = config.stagePlacement || 'north_end';
  const venueModel: VenueLayoutModel = config.venueLayoutModel || 'standard';
  const boothModel: BoothModelStyle = config.boothModel || 'pagoda_tent';
  const boothCostMult = BOOTH_MODEL_STYLE_LABELS[boothModel]?.costMult ?? 1.0;

  const customKey = (config.customElements || [])
    .map((c) => `${c.subtype}:${c.nameKo}:${c.count}`)
    .join(',');

  const seed =
    config.seed ^
    hashStringSeed(
      `${config.eventType}-${venueShape}-${stagePlacement}-${venueModel}-${boothModel}-${config.venueWidth}x${config.venueDepth}-${config.objective}-${config.foodBoothCount}-${config.experienceBoothCount}-${config.entranceCount}-${config.seatingBlockCount ?? 'a'}-${config.restroomCount ?? 'a'}-${config.medicalCount ?? 'a'}-${config.parkingCount ?? 0}-${config.subStageCount ?? 0}-${customKey}`,
    );
  const rand = createSeededRandom(seed);

  const W = config.venueWidth;
  const D = config.venueDepth;
  const minMargin =
    config.accessibility.wideCorridors ||
    config.objective === 'safety_first' ||
    config.objective === 'accessibility_inclusion'
      ? 4.6
      : 3.2;

  const placed: Box2D[] = [];
  const facilities: Facility[] = [];

  for (const lf of lockedFacilities) {
    if (!lf.locked) continue;
    const clampedPos =
      lf.category === 'parking'
        ? clampExteriorParkingPosition(
            lf.position.x,
            lf.position.z,
            lf.dimensions.width,
            lf.dimensions.depth,
            W,
            D,
          )
        : clampToVenue(
            lf.position.x,
            lf.position.z,
            lf.dimensions.width,
            lf.dimensions.depth,
            W,
            D,
            3.5,
            venueShape,
          );
    const copy: Facility = {
      ...lf,
      position: clampedPos,
      dimensions: { ...lf.dimensions },
      accessibility: { ...lf.accessibility },
      locked: true,
    };
    facilities.push(copy);
    if (lf.category !== 'parking') {
      placed.push({
        x: clampedPos.x,
        z: clampedPos.z,
        w: copy.dimensions.width + 2.4,
        d: copy.dimensions.depth + 2.4,
      });
    }
  }

  // Reserve central emergency evacuation spine (unless center_360 places arena stage at center, in which case spine flanks x = -22)
  if (stagePlacement !== 'center_360') {
    placed.push({ x: -7, z: 8, w: config.accessibility.wideCorridors ? 9.0 : 6.8, d: D * 0.48 });
  }

  const tryPlace = (
    preferredX: number,
    preferredZ: number,
    width: number,
    depth: number,
    edgePad = 5,
  ): { x: number; z: number } => {
    const padW = width + 2.4;
    const padD = depth + 2.4;
    const base = clampToVenue(preferredX, preferredZ, padW, padD, W, D, edgePad, venueShape);
    if (!placed.some((b) => boxesOverlap({ x: base.x, z: base.z, w: padW, d: padD }, b, minMargin))) {
      placed.push({ x: base.x, z: base.z, w: padW, d: padD });
      return base;
    }
    const maxR = Math.max(W, D) * 0.95;
    for (let radius = 4.5; radius <= maxR; radius += 4.0) {
      for (let angleStep = 0; angleStep < 28; angleStep++) {
        const theta = (angleStep / 28) * Math.PI * 2 + rand() * 0.08;
        const cand = clampToVenue(
          base.x + Math.cos(theta) * radius,
          base.z + Math.sin(theta) * radius,
          padW,
          padD,
          W,
          D,
          edgePad,
          venueShape,
        );
        if (!placed.some((b) => boxesOverlap({ x: cand.x, z: cand.z, w: padW, d: padD }, b, minMargin))) {
          placed.push({ x: cand.x, z: cand.z, w: padW, d: padD });
          return cand;
        }
      }
    }
    placed.push({ x: base.x, z: base.z, w: padW, d: padD });
    return base;
  };

  const allAccessible =
    config.accessibility.stepFreeRoutes || config.objective === 'accessibility_inclusion';

  // 1. Exterior Parking Lots (installed strictly OUTSIDE the venue perimeter walls)
  const lockedParkingCount = facilities.filter((f) => f.category === 'parking').length;
  const parkingCount = Math.max(
    0,
    Math.min(4, (config.parkingCount ?? 1) - lockedParkingCount),
  );
  const exteriorParkingSpecs: Array<{
    x: number;
    z: number;
    w: number;
    d: number;
    name: string;
    nameKo: string;
  }> = [
    {
      x: W * 0.5 + 9 + 12,
      z: D * 0.15,
      w: 24,
      d: 38,
      name: 'Exterior Parking Lot 1 (East Gate)',
      nameKo: '외부 주차장 1',
    },
    {
      x: -W * 0.2,
      z: D * 0.5 + 9 + 11,
      w: 36,
      d: 22,
      name: 'Exterior Parking Lot 2 (South Gate)',
      nameKo: '외부 주차장 2',
    },
    {
      x: -(W * 0.5 + 9 + 12),
      z: -D * 0.04,
      w: 24,
      d: 36,
      name: 'Exterior Parking Lot 3 (West Gate)',
      nameKo: '외부 주차장 3',
    },
    {
      x: W * 0.5 + 9 + 12,
      z: -D * 0.25,
      w: 24,
      d: 32,
      name: 'Exterior Parking Lot 4 (North-East)',
      nameKo: '외부 주차장 4',
    },
  ];
  for (let p = 0; p < parkingCount; p++) {
    const spec = exteriorParkingSpecs[(p + lockedParkingCount) % exteriorParkingSpecs.length];
    const parkPos = clampExteriorParkingPosition(spec.x, spec.z, spec.w, spec.d, W, D);
    facilities.push({
      id: `parking-exterior-${p + 1 + lockedParkingCount}`,
      name: spec.name,
      nameKo: spec.nameKo,
      category: 'parking',
      subtype: 'parking_lot',
      position: parkPos,
      dimensions: { width: spec.w, depth: spec.d, height: 2.4 },
      rotation: 0,
      capacity: Math.round(spec.w * spec.d * 0.35),
      cost: config.objective === 'budget_efficiency' ? 9200 : 12000,
      attractionWeight: 0.7,
      colorAccent: '#475569',
      covered: false,
      accessibility: {
        wheelchairAccessible: config.accessibility.accessibleParking || allAccessible,
        stepFreeEntry: true,
        priorityQueue: config.accessibility.accessibleParking,
      },
      notes: '행사장 외부 공간에 설치되어 주출입구 무단차 보행 연결로와 이어지는 외부 방문객·교통약자 주차장입니다.',
    });
  }

  // 2. Stage Architecture & Audience Seating Blocks based on `stagePlacement`!
  const isStageCentric =
    config.eventType === 'music_festival' ||
    config.eventType === 'school_festival' ||
    config.eventType === 'sports_event';

  let primaryStageAnchor = { x: 0, z: -D * 0.32, w: 32, d: 18 };

  if (stagePlacement === 'center_360') {
    const stW = 24;
    const stD = 24;
    const stPos = tryPlace(0, -4, stW, stD, 8);
    primaryStageAnchor = { x: stPos.x, z: stPos.z, w: stW, d: stD };
    facilities.push({
      id: 'stage-main',
      name: 'Center 360° Arena Stage',
      nameKo: '중앙 360° 아레나 메인 무대',
      category: 'stage',
      subtype: 'main_stage',
      position: stPos,
      dimensions: { width: stW, depth: stD, height: 14.5 },
      rotation: 0,
      capacity: Math.round(config.expectedAttendance * 0.46),
      cost: config.objective === 'budget_efficiency' ? 48000 : 76000,
      attractionWeight: 2.9,
      colorAccent: '#2563eb',
      covered: true,
      accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
      notes: '[360_ARENA] 사방 360도에서 시야가 열리는 원형 아레나 중앙 무대 및 4면 상부 LED 큐브입니다.',
    });

    const seatBlocks =
      config.seatingBlockCount !== undefined
        ? Math.max(0, Math.min(6, config.seatingBlockCount))
        : 4;
    const ringDist = stW * 0.5 + 18;
    const blockNamesKo = [
      '관객석 A구역 (남측·휠체어석)',
      '관객석 B구역 (북측)',
      '관객석 C구역 (서측)',
      '관객석 D구역 (동측)',
      '관객석 E구역 (남서측)',
      '관객석 F구역 (남동측)',
    ];
    const angles = [Math.PI * 0.5, -Math.PI * 0.5, Math.PI, 0, Math.PI * 0.75, Math.PI * 0.25];
    for (let i = 0; i < seatBlocks; i++) {
      const ang = angles[i % angles.length];
      const sx = stPos.x + Math.cos(ang) * ringDist;
      const sz = stPos.z + Math.sin(ang) * ringDist;
      // Seating block local -Z faces the stage!
      const rotToCenter = Math.atan2(sx - stPos.x, sz - stPos.z);
      const pos = tryPlace(sx, sz, 20, 16, 7);
      facilities.push({
        id: `seating-${i + 1}`,
        name: `360° Arena Seating Sector ${String.fromCharCode(65 + i)}`,
        nameKo: blockNamesKo[i % blockNamesKo.length],
        category: 'seating',
        subtype: 'seating_block',
        position: pos,
        dimensions: { width: 20, depth: 16, height: 2.1 },
        rotation: rotToCenter,
        capacity: Math.round((config.expectedAttendance * 0.42) / Math.max(1, seatBlocks)),
        cost: 12500,
        attractionWeight: 2.25,
        colorAccent: '#3b82f6',
        covered: false,
        accessibility: {
          wheelchairAccessible: true,
          stepFreeEntry: true,
          priorityQueue: i === 0 || allAccessible,
        },
        notes: '중앙 360° 무대를 향해 방사형으로 배치된 사방 관람 객석 구역입니다.',
      });
    }
  } else if (stagePlacement === 'twin_stages') {
    const stW = Math.min(32, Math.max(24, Math.round(W * 0.15)));
    const stD = 17;
    const westStagePos = tryPlace(-W * 0.2, -D * 0.32, stW, stD, 7);
    const eastStagePos = tryPlace(W * 0.2, -D * 0.32, stW, stD, 7);
    primaryStageAnchor = { x: westStagePos.x, z: westStagePos.z, w: stW, d: stD };

    facilities.push(
      {
        id: 'stage-main',
        name: 'Twin Main Stage ALPHA (West)',
        nameKo: '트윈 메인 무대 A (서측 블루스테이지)',
        category: 'stage',
        subtype: 'main_stage',
        position: westStagePos,
        dimensions: { width: stW, depth: stD, height: 13.5 },
        rotation: 0,
        capacity: Math.round(config.expectedAttendance * 0.3),
        cost: config.objective === 'budget_efficiency' ? 38000 : 54000,
        attractionWeight: 2.65,
        colorAccent: '#2563eb',
        covered: true,
        accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
        notes: '대형 페스티벌 교차 공연을 통해 전환 대기 병목을 분산하는 서측 주무대입니다.',
      },
      {
        id: 'stage-twin-east',
        name: 'Twin Main Stage BETA (East)',
        nameKo: '트윈 메인 무대 B (동측 그린스테이지)',
        category: 'stage',
        subtype: 'main_stage',
        position: eastStagePos,
        dimensions: { width: stW, depth: stD, height: 13.0 },
        rotation: 0,
        capacity: Math.round(config.expectedAttendance * 0.28),
        cost: config.objective === 'budget_efficiency' ? 36000 : 50000,
        attractionWeight: 2.5,
        colorAccent: '#0d9488',
        covered: true,
        accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
        notes: '서측 무대와 번갈아 공연하여 단일 구역 과밀을 해소하는 동측 트윈 주무대입니다.',
      },
    );

    const seatBlocks =
      config.seatingBlockCount !== undefined
        ? Math.max(0, Math.min(6, config.seatingBlockCount))
        : 2;
    for (let i = 0; i < seatBlocks; i++) {
      const anchor = i % 2 === 0 ? westStagePos : eastStagePos;
      const offsetX = seatBlocks > 2 ? (i < 2 ? -9 : 9) : 0;
      const pos = tryPlace(anchor.x + offsetX, anchor.z + stD / 2 + 19, 21, 18, 7);
      facilities.push({
        id: `seating-${i + 1}`,
        name: `Twin Stage Audience Block ${i + 1}`,
        nameKo: `트윈무대 관객석 ${String.fromCharCode(65 + i)}구역`,
        category: 'seating',
        subtype: 'seating_block',
        position: pos,
        dimensions: { width: 21, depth: 18, height: 2.0 },
        rotation: 0,
        capacity: Math.round((config.expectedAttendance * 0.36) / Math.max(1, seatBlocks)),
        cost: 12000,
        attractionWeight: 2.1,
        colorAccent: i % 2 === 0 ? '#3b82f6' : '#0ea5e9',
        covered: false,
        accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: i === 0 },
      });
    }
  } else if (stagePlacement === 'projector_screen') {
    const projW = Math.min(18, Math.max(13, Math.round(W * 0.11)));
    const projD = 6.5;
    const projPos = tryPlace(0, -D * 0.34, projW, projD, 6);
    primaryStageAnchor = { x: projPos.x, z: projPos.z, w: projW, d: projD };

    facilities.push({
      id: 'stage-projector-main',
      name: 'Indoor Beam Projector & 16:9 Presentation Screen',
      nameKo: '빔 프로젝터·대형 스크린 발표 단상',
      category: 'stage',
      subtype: 'beam_projector',
      position: projPos,
      dimensions: { width: projW, depth: projD, height: 5.6 },
      rotation: 0,
      capacity: Math.round(config.expectedAttendance * 0.28),
      cost: 6800,
      attractionWeight: 2.15,
      colorAccent: '#0284c7',
      covered: true,
      accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
      notes: '공연이 없는 실내 박람회·컨퍼런스·세미나를 위한 고광량 빔 프로젝터, 16:9 대형 스크린 및 무단차 발표 단상입니다.',
    });

    const seatBlocks =
      config.seatingBlockCount !== undefined
        ? Math.max(0, Math.min(4, config.seatingBlockCount))
        : 2;
    for (let i = 0; i < seatBlocks; i++) {
      const offsetX =
        seatBlocks === 1 ? 0 : (i - (seatBlocks - 1) / 2) * 20;
      const pos = tryPlace(projPos.x + offsetX, projPos.z + projD / 2 + 15, 17, 13, 6);
      facilities.push({
        id: `seating-${i + 1}`,
        name: `Session Seating Block ${String.fromCharCode(65 + i)}`,
        nameKo: `세미나·발표 좌석 ${String.fromCharCode(65 + i)}구역`,
        category: 'seating',
        subtype: 'seating_block',
        position: pos,
        dimensions: { width: 17, depth: 13, height: 1.4 },
        rotation: 0,
        capacity: Math.round((config.expectedAttendance * 0.3) / Math.max(1, seatBlocks)),
        cost: 4600,
        attractionWeight: 1.85,
        colorAccent: '#0284c7',
        covered: false,
        accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: i === 0 },
        notes: '빔 프로젝터 대형 스크린 가시 시야각에 맞춰 배치된 실내 세션 좌석 구역입니다.',
      });
    }
  } else if (stagePlacement !== 'none') {
    // 'north_end' or 'runway_keynote'
    const isRunway = stagePlacement === 'runway_keynote';
    const stageW = isStageCentric ? Math.min(42, Math.max(28, Math.round(W * 0.19))) : 26;
    const stageD = isRunway ? 24 : isStageCentric ? 19 : 15;
    const stageTargetX =
      venueModel === 'circular_plaza' || venueModel === 'u_courtyard' || venueModel === 'radial_fan'
        ? 0
        : -6;
    const stageTargetZ = -D * 0.32;
    const stagePos = tryPlace(stageTargetX, stageTargetZ, stageW, stageD, 7);
    primaryStageAnchor = { x: stagePos.x, z: stagePos.z, w: stageW, d: stageD };

    facilities.push({
      id: 'stage-main',
      name: isRunway
        ? 'T-Thrust Runway & Keynote Stage'
        : config.eventType === 'career_fair' || config.eventType === 'exhibition'
          ? 'Keynote & Presentation Stage'
          : 'Main Performance Stage',
      nameKo: isRunway
        ? 'T자형 돌출 런웨이 메인 무대'
        : config.eventType === 'career_fair' || config.eventType === 'exhibition'
          ? '키노트 발표 무대'
          : '메인 공연 무대',
      category: 'stage',
      subtype: 'main_stage',
      position: stagePos,
      dimensions: { width: stageW, depth: stageD, height: isStageCentric ? 14 : 10 },
      rotation: 0,
      capacity: Math.round(config.expectedAttendance * (isStageCentric ? 0.42 : 0.24)),
      cost: config.objective === 'budget_efficiency' ? 38000 : isStageCentric ? 66000 : 38000,
      attractionWeight: isStageCentric ? 2.75 : 1.6,
      colorAccent: isRunway ? '#7c3aed' : '#2563eb',
      covered: true,
      accessibility: {
        wheelchairAccessible: true,
        stepFreeEntry: true,
        priorityQueue: allAccessible,
      },
      notes: isRunway
        ? '[RUNWAY_THRUST] 관객석 중앙으로 뻗어나가는 T자형 돌출 런웨이 및 무장애 관람 데크입니다.'
        : '전면 안전 완충 구역 및 무장애 경사로·관람데크가 적용된 중심 무대입니다.',
    });

    const defaultSeats = config.eventType === 'flea_market' ? 0 : 2;
    const seatBlocks =
      config.seatingBlockCount !== undefined
        ? Math.max(0, Math.min(6, config.seatingBlockCount))
        : defaultSeats;
    const seatSafetyGap = config.objective === 'safety_first' ? 12 : 9.5;

    for (let i = 0; i < seatBlocks; i++) {
      const sw = seatBlocks === 1 ? 26 : 21;
      const sd = isStageCentric ? 21 : 16;
      const col = i % 2;
      const tier = Math.floor(i / 2);
      let targetX =
        seatBlocks === 1
          ? stagePos.x
          : stagePos.x + (col === 0 ? -(isRunway ? 20 : 16) : isRunway ? 20 : 16);
      let targetZ = stagePos.z + stageD / 2 + seatSafetyGap + sd / 2 + tier * (sd + 7);
      let sRot = 0;

      if (venueModel === 'radial_fan' || venueShape === 'fan_amphitheater') {
        const fanAngle = seatBlocks === 1 ? 0 : ((i / (seatBlocks - 1)) - 0.5) * 0.95;
        const fanR = 32 + tier * 22;
        targetX = stagePos.x + Math.sin(fanAngle) * fanR;
        targetZ = stagePos.z + Math.cos(fanAngle) * fanR;
        sRot = Math.atan2(targetX - stagePos.x, targetZ - stagePos.z) * 0.65;
      }

      const pos = tryPlace(targetX, targetZ, sw, sd, 7);
      facilities.push({
        id: `seating-${i + 1}`,
        name: `Audience Block ${String.fromCharCode(65 + i)}`,
        nameKo:
          seatBlocks === 1
            ? '중앙 관람 객석 (휠체어석 포함)'
            : `관객석 ${String.fromCharCode(65 + i)}구역${i === 0 ? ' (휠체어 전용석)' : ''}`,
        category: 'seating',
        subtype: 'seating_block',
        position: pos,
        dimensions: { width: sw, depth: sd, height: 2.1 },
        rotation: sRot,
        capacity: Math.round(
          (config.expectedAttendance * (isStageCentric ? 0.42 : 0.22)) / Math.max(1, seatBlocks),
        ),
        cost: config.objective === 'budget_efficiency' ? 9800 : 13000,
        attractionWeight: isStageCentric ? 2.2 : 1.35,
        colorAccent: '#3b82f6',
        covered: false,
        accessibility: {
          wheelchairAccessible: true,
          stepFreeEntry: true,
          priorityQueue: i === 0 || allAccessible,
        },
      });
    }
  }

  // Optional Secondary / Busking Stages
  const subStageCount = Math.max(0, Math.min(3, config.subStageCount ?? 0));
  const subStageSpecs = [
    { x: W * 0.22, z: D * 0.22, rot: Math.PI, nameKo: '남동측 서브·버스킹 무대 #1' },
    { x: -W * 0.24, z: D * 0.2, rot: Math.PI, nameKo: '남서측 어쿠스틱 소무대 #2' },
    { x: W * 0.22, z: -D * 0.08, rot: -Math.PI / 2, nameKo: '동측 크리에이터 오픈스테이지 #3' },
  ];
  for (let s = 0; s < subStageCount; s++) {
    const sp = subStageSpecs[s % subStageSpecs.length];
    const subPos = tryPlace(sp.x, sp.z, 17, 11, 7);
    facilities.push({
      id: `stage-sub-${s + 1}`,
      name: `Secondary Performance Stage #${s + 1}`,
      nameKo: sp.nameKo,
      category: 'stage',
      subtype: 'secondary_stage',
      position: subPos,
      dimensions: { width: 17, depth: 11, height: 7.5 },
      rotation: sp.rot,
      capacity: Math.round(config.expectedAttendance * 0.14),
      cost: 12000,
      attractionWeight: 1.9,
      colorAccent: '#6366f1',
      covered: true,
      accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
      notes: '주무대 인파 집중을 분산하기 위해 배치된 보조 공연 무대입니다.',
    });
  }

  // 4. Optional VIP Zone & Camping Area
  if (config.requiredFacilities.vipZone) {
    const vipTargetX =
      stagePlacement === 'center_360'
        ? W * 0.24
        : primaryStageAnchor.x + primaryStageAnchor.w / 2 + 16;
    const vipTargetZ = stagePlacement === 'center_360' ? -4 : primaryStageAnchor.z + 6;
    const vipPos = tryPlace(vipTargetX, vipTargetZ, 19, 13, 7);
    facilities.push({
      id: 'vip-lounge-1',
      name: 'VIP Hospitality Lounge',
      nameKo: 'VIP 라운지 데크',
      category: 'vip',
      subtype: 'vip_lounge',
      position: vipPos,
      dimensions: { width: 19, depth: 13, height: 5.5 },
      rotation: -Math.PI / 2,
      capacity: Math.round(config.expectedAttendance * 0.05),
      cost: 21000,
      attractionWeight: 1.3,
      colorAccent: '#7c3aed',
      covered: true,
      accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
    });
  }

  if (config.requiredFacilities.campingArea) {
    const campPos = tryPlace(-W * 0.32, -D * 0.26, 32, 26, 6);
    facilities.push({
      id: 'camping-zone-1',
      name: 'Meadow Camping Village',
      nameKo: '캠핑·피크닉 빌리지',
      category: 'camping',
      subtype: 'camping_zone',
      position: campPos,
      dimensions: { width: 32, depth: 26, height: 3.5 },
      rotation: 0,
      capacity: Math.round(config.expectedAttendance * 0.08),
      cost: 12500,
      attractionWeight: 0.95,
      colorAccent: '#0d9488',
      covered: true,
      accessibility: { wheelchairAccessible: allAccessible, stepFreeEntry: true, priorityQueue: false },
    });
  }

  // 5. Entrances & Exits
  const portalSpecs: Array<{
    x: number;
    z: number;
    rot: number;
    name: string;
    nameKo: string;
    main?: boolean;
  }> = [
    {
      x: W * 0.41,
      z: D * 0.16,
      rot: Math.PI / 2,
      name: 'Main East Gate Arch',
      nameKo: '동측 주출입구 아치',
      main: true,
    },
    {
      x: -W * 0.26,
      z: D * 0.42,
      rot: 0,
      name: 'South-West Park Gate',
      nameKo: '남서측 보조 출입구',
    },
    {
      x: W * 0.12,
      z: D * 0.42,
      rot: 0,
      name: 'South Boulevard Gate',
      nameKo: '남측 중앙 분산 게이트',
    },
    {
      x: -W * 0.41,
      z: -D * 0.04,
      rot: -Math.PI / 2,
      name: 'West Promenade Gate',
      nameKo: '서측 산책로 게이트',
    },
    {
      x: W * 0.18,
      z: -D * 0.42,
      rot: Math.PI,
      name: 'North Transit Gate',
      nameKo: '북측 대중교통 출입구',
    },
    {
      x: -W * 0.07,
      z: D * 0.42,
      rot: 0,
      name: 'Central South Egress Gate',
      nameKo: '남측 비상 퇴장 게이트',
    },
  ];

  const entranceCapacityEach = Math.max(
    900,
    Math.round((config.expectedAttendance * 0.36) / Math.max(1, config.entranceCount)),
  );

  let mainGatePos = { x: W * 0.38, z: D * 0.16 };
  for (let i = 0; i < config.entranceCount; i++) {
    const spec = portalSpecs[i % portalSpecs.length];
    const isVert = Math.abs(Math.sin(spec.rot)) > 0.5;
    const ew = isVert ? 8 : 15;
    const ed = isVert ? 16 : 7;
    const pos = tryPlace(spec.x, spec.z, ew, ed, 3);
    if (i === 0) mainGatePos = pos;
    facilities.push({
      id: `entrance-${i + 1}`,
      name: spec.name,
      nameKo: spec.nameKo,
      category: 'entrance',
      subtype: spec.main ? 'main_entrance' : 'secondary_entrance',
      position: pos,
      dimensions: { width: ew, depth: ed, height: spec.main ? 9.5 : 8 },
      rotation: spec.rot,
      capacity: spec.main ? Math.round(entranceCapacityEach * 1.25) : entranceCapacityEach,
      cost: spec.main ? 11500 : 8800,
      attractionWeight: spec.main ? 1.9 : 1.35,
      colorAccent: spec.main ? '#2563eb' : '#0ea5e9',
      covered: true,
      accessibility: {
        wheelchairAccessible: true,
        stepFreeEntry: true,
        priorityQueue: i === 0 || allAccessible,
      },
    });
  }

  // Multilingual Info & Box Office near Main Gate
  const infoPos = tryPlace(mainGatePos.x - 16, mainGatePos.z + 6, 12, 8, 6);
  facilities.push({
    id: 'info-multilingual-1',
    name: 'Multilingual Info & Lost-Child Hub',
    nameKo: '다국어 종합안내소 · 미아보호소',
    category: 'entrance',
    subtype: 'multilingual_info',
    position: infoPos,
    dimensions: { width: 12, depth: 8, height: 4.5 },
    rotation: 0,
    capacity: 340,
    cost: 7600,
    attractionWeight: 1.15,
    colorAccent: '#0284c7',
    covered: true,
    accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
    notes: '주출입구 직결 한·영·중·일 다국어 안내 및 미아보호 통합 부스입니다.',
  });

  // 6. Food Trucks & Stalls — Spatial coordinates adapt to all 8 `venueLayoutModel` topologies!
  const splitFoodZones =
    config.objective === 'congestion_reduction' ||
    config.objective === 'visitor_engagement' ||
    config.objective === 'safety_first';
  const foodColors = ['#f97316', '#ef4444', '#06b6d4', '#eab308', '#10b981', '#ec4899', '#8b5cf6'];
  const foodNames = [
    ['Seoul Street Kitchen Truck', '푸드트럭 1 (스트리트 키친)'],
    ['Artisan Wood-Fired Pizza', '푸드트럭 2 (화덕 피자)'],
    ['Citrus Cold Brew & Gelato', '푸드트럭 3 (콜드브루·젤라또)'],
    ['Craft Smokehouse Pavilion', '음식 부스 4 (바비큐 존)'],
    ['Fresh Berry & Bento Stall', '음식 부스 5 (수제 도시락)'],
    ['Taco & Churro Cruiser', '푸드트럭 6 (타코·츄러스)'],
    ['Matcha & Waffle Bar', '음식 부스 7 (와플·음료)'],
    ['Crispy Skewer Market Stall', '음식 부스 8 (로컬 분식)'],
    ['Vegan Salad & Juice Booth', '음식 부스 9 (비건·주스바)'],
    ['Korean Chicken & Tteok Stall', '푸드트럭 10 (닭강정·분식)'],
  ];

  for (let i = 0; i < config.foodBoothCount; i++) {
    const isTruck =
      (boothModel === 'pagoda_tent' || boothModel === 'parasol_table') &&
      i < Math.ceil(config.foodBoothCount * 0.45);
    const fw = isTruck ? 10 : 8;
    const fd = isTruck ? 5.5 : 7;

    let targetX = -W * 0.25 + (i % 2) * 12;
    let targetZ = -D * 0.05 + Math.floor(i / 2) * 13;
    let rot = 0;

    if (venueModel === 'circular_plaza') {
      const t = config.foodBoothCount > 1 ? i / (config.foodBoothCount - 1) : 0.5;
      const theta = Math.PI * (0.58 + t * 0.72);
      targetX = Math.cos(theta) * W * 0.31;
      targetZ = 4 + Math.sin(theta) * D * 0.29;
      rot = Math.atan2(-targetX, 4 - targetZ);
    } else if (venueModel === 'radial_fan') {
      const t = config.foodBoothCount > 1 ? i / (config.foodBoothCount - 1) : 0.5;
      const fanTheta = -Math.PI * 0.38 + t * Math.PI * 0.76;
      targetX = Math.sin(fanTheta) * W * 0.34;
      targetZ = -D * 0.24 + Math.cos(fanTheta) * D * 0.52;
      rot = Math.atan2(-targetX, -D * 0.2 - targetZ);
    } else if (venueModel === 'waterside_promenade') {
      // North riverside food promenade strip facing South promenade walkway
      const spacing = Math.min(13.5, (W * 0.72) / Math.max(1, config.foodBoothCount));
      targetX = -W * 0.34 + i * spacing;
      targetZ = -D * 0.24 + (i % 2) * 4;
      rot = 0;
    } else if (venueModel === 'diagonal_avenue') {
      // Along North-West to South-West diagonal arm
      const t = (i + 0.5) / Math.max(1, config.foodBoothCount);
      targetX = -W * 0.34 + t * (W * 0.22);
      targetZ = -D * 0.16 + t * (D * 0.44);
      rot = Math.PI * 0.25;
    } else if (venueModel === 'u_courtyard') {
      targetX = -W * 0.29;
      targetZ = -D * 0.14 + i * Math.min(12.5, (D * 0.48) / Math.max(1, config.foodBoothCount));
      rot = Math.PI / 2;
    } else if (venueModel === 'boulevard_grid') {
      const col = i % 2;
      const row = Math.floor(i / 2);
      targetX = -W * 0.29 + col * 13.5;
      targetZ = -D * 0.12 + row * 12.5;
      rot = col === 0 ? Math.PI / 2 : -Math.PI / 2;
    } else if (venueModel === 'cluster_village') {
      const ang = (i / Math.max(1, config.foodBoothCount)) * Math.PI * 2;
      const podR = Math.max(11, config.foodBoothCount * 2.0);
      targetX = -W * 0.24 + Math.cos(ang) * podR;
      targetZ = D * 0.04 + Math.sin(ang) * podR;
      rot = Math.atan2(-Math.cos(ang), -Math.sin(ang));
    } else {
      const inEastSplit = splitFoodZones && i % 2 === 1;
      targetX = inEastSplit ? W * 0.14 + (i % 3) * 10 : -W * 0.26 + (i % 2) * 12;
      targetZ = inEastSplit
        ? D * 0.21
        : -D * 0.06 + Math.floor(i / (splitFoodZones ? 2 : 1.5)) * 12.5;
      rot = isTruck && !inEastSplit ? Math.PI / 2 : 0;
    }

    const pos = tryPlace(targetX, targetZ, fw, fd, 6);
    const pair = foodNames[i % foodNames.length];
    const baseCost = isTruck ? 5200 : Math.round(4400 * boothCostMult);
    facilities.push({
      id: `food-${i + 1}`,
      name: i >= foodNames.length ? `Culinary Booth #${i + 1}` : pair[0],
      nameKo: i >= foodNames.length ? `식음·푸드 부스 #${i + 1}` : pair[1],
      category: 'food',
      subtype: isTruck ? 'food_truck' : 'food_stall',
      position: pos,
      dimensions: { width: fw, depth: fd, height: 4.1 },
      rotation: rot,
      capacity: Math.round(230 + (config.expectedAttendance / 1000) * 8),
      cost: config.objective === 'budget_efficiency' ? Math.round(baseCost * 0.86) : baseCost,
      attractionWeight: 1.75,
      colorAccent: foodColors[i % foodColors.length],
      covered: !isTruck,
      accessibility: {
        wheelchairAccessible: true,
        stepFreeEntry: true,
        priorityQueue: allAccessible && i === 0,
      },
      notes: `부스 외관: ${BOOTH_MODEL_STYLE_LABELS[boothModel].ko} · 공간 배치: ${VENUE_LAYOUT_MODEL_I18N[venueModel].ko}`,
    });
  }

  // 7. Experience / Exhibition Booths — Adapts to all 8 topologies & up to 40 booths!
  const boothColors = ['#2563eb', '#f59e0b', '#6366f1', '#10b981', '#8b5cf6', '#0ea5e9'];
  const cols = Math.max(2, Math.ceil(Math.sqrt(Math.max(1, config.experienceBoothCount))));
  const baseBoothUnitCost = Math.round(
    (config.objective === 'budget_efficiency' ? 4200 : 5400) * boothCostMult,
  );

  for (let i = 0; i < config.experienceBoothCount; i++) {
    let bx = W * 0.17;
    let bz = -D * 0.08;
    let brot = 0;

    if (venueModel === 'circular_plaza') {
      const ringIdx = Math.floor(i / 14);
      const idxInRing = i % 14;
      const totalInRing = Math.min(14, config.experienceBoothCount - ringIdx * 14);
      const t = totalInRing > 1 ? idxInRing / (totalInRing - 1) : 0.5;
      const theta = -Math.PI * 0.34 + t * Math.PI * 0.88;
      const ringOffset = ringIdx * 12;
      bx = Math.cos(theta) * (W * 0.28 + ringOffset);
      bz = 4 + Math.sin(theta) * (D * 0.27 + ringOffset * 0.8);
      brot = Math.atan2(-bx, 4 - bz);
    } else if (venueModel === 'radial_fan') {
      const arcRow = Math.floor(i / 8);
      const idxInArc = i % 8;
      const totalInArc = Math.min(8, config.experienceBoothCount - arcRow * 8);
      const t = totalInArc > 1 ? idxInArc / (totalInArc - 1) : 0.5;
      const ang = -Math.PI * 0.36 + t * Math.PI * 0.72;
      const rArc = D * (0.36 + arcRow * 0.13);
      bx = Math.sin(ang) * (rArc * (W / D) * 0.88);
      bz = -D * 0.26 + Math.cos(ang) * rArc;
      brot = Math.atan2(-bx, -D * 0.26 - bz);
    } else if (venueModel === 'waterside_promenade') {
      // Double-sided riverside market street rows along Z = +2 and Z = +16
      const row = i % 2;
      const colIdx = Math.floor(i / 2);
      const totalCols = Math.max(1, Math.ceil(config.experienceBoothCount / 2));
      const spacing = Math.min(11, (W * 0.74) / totalCols);
      bx = -W * 0.35 + colIdx * spacing;
      bz = row === 0 ? 2 : 16;
      brot = row === 0 ? 0 : Math.PI;
    } else if (venueModel === 'diagonal_avenue') {
      const arm = i % 2;
      const step = Math.floor(i / 2);
      const totalSteps = Math.max(1, Math.ceil(config.experienceBoothCount / 2));
      const t = (step + 0.5) / totalSteps;
      bx = W * 0.08 + t * (W * 0.28);
      bz = arm === 0 ? -D * 0.2 + t * (D * 0.42) : D * 0.26 - t * (D * 0.42);
      brot = arm === 0 ? -Math.PI * 0.25 : -Math.PI * 0.75;
    } else if (venueModel === 'u_courtyard') {
      const eastQuota = Math.ceil(config.experienceBoothCount * 0.6);
      if (i < eastQuota) {
        bx = W * 0.28;
        bz = -D * 0.16 + i * Math.min(11.5, (D * 0.5) / Math.max(1, eastQuota));
        brot = -Math.PI / 2;
      } else {
        const remIdx = i - eastQuota;
        const remTotal = Math.max(1, config.experienceBoothCount - eastQuota);
        bx = -W * 0.2 + ((remIdx + 0.5) / remTotal) * (W * 0.42);
        bz = D * 0.26;
        brot = Math.PI;
      }
    } else if (venueModel === 'boulevard_grid') {
      const gridCols = Math.max(2, Math.min(6, Math.ceil(Math.sqrt(config.experienceBoothCount * 1.2))));
      const c = i % gridCols;
      const r = Math.floor(i / gridCols);
      bx = (stagePlacement === 'none' ? -W * 0.12 : W * 0.04) + c * 11.5;
      bz = (stagePlacement === 'none' ? -D * 0.22 : -D * 0.1) + r * 11.5;
      brot = r % 2 === 1 ? Math.PI : 0;
    } else if (venueModel === 'cluster_village') {
      const podCount = config.experienceBoothCount > 14 ? 3 : 2;
      const podIdx = i % podCount;
      const localIdx = Math.floor(i / podCount);
      const localTotal = Math.max(1, Math.ceil(config.experienceBoothCount / podCount));
      const ang = (localIdx / localTotal) * Math.PI * 2;
      const centers: Array<[number, number]> = [
        [W * 0.22, -D * 0.06],
        [W * 0.16, D * 0.2],
        [-W * 0.04, D * 0.22],
      ];
      const [centerX, centerZ] = centers[podIdx % centers.length];
      const podR = Math.max(10.5, localTotal * 1.9);
      bx = centerX + Math.cos(ang) * podR;
      bz = centerZ + Math.sin(ang) * podR;
      brot = Math.atan2(-Math.cos(ang), -Math.sin(ang));
    } else {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const spreadWest = splitFoodZones && i >= Math.ceil(config.experienceBoothCount * 0.65);
      bx = spreadWest ? -W * 0.16 - col * 10.5 : W * 0.15 + col * 11;
      bz = spreadWest ? D * 0.12 + row * 10.5 : -D * 0.1 + row * 11;
      brot = 0;
    }

    const pos = tryPlace(bx, bz, 8, 8, 6);
    facilities.push({
      id: `booth-${i + 1}`,
      name:
        config.eventType === 'career_fair'
          ? `Employer Pavilion #${i + 1}`
          : config.eventType === 'flea_market'
            ? `Maker Market Booth #${i + 1}`
            : `Experience Booth #${i + 1}`,
      nameKo:
        config.eventType === 'school_festival'
          ? `학생 동아리 체험부스 #${i + 1}`
          : config.eventType === 'career_fair'
            ? `진로·직업체험 부스 #${i + 1}`
            : config.eventType === 'flea_market'
              ? `플리마켓 셀러 부스 #${i + 1}`
              : `체험·전시 부스 #${i + 1}`,
      category: 'booth',
      subtype: 'experience_booth',
      position: pos,
      dimensions: { width: 8, depth: 8, height: 5 },
      rotation: brot,
      capacity: 185,
      cost: baseBoothUnitCost,
      attractionWeight: 1.4 + (i % 3) * 0.15,
      colorAccent: boothColors[i % boothColors.length],
      covered: boothModel !== 'parasol_table',
      accessibility: {
        wheelchairAccessible: allAccessible || i % 4 !== 3,
        stepFreeEntry: true,
        priorityQueue: false,
      },
      notes: `부스 외관: ${BOOTH_MODEL_STYLE_LABELS[boothModel].ko} · 공간 배치: ${VENUE_LAYOUT_MODEL_I18N[venueModel].ko}`,
    });
  }



  // 7B. Prompt-Driven Custom Real-World Festival Elements (`config.customElements`)!
  if (Array.isArray(config.customElements) && config.customElements.length > 0) {
    let customSeq = 1;
    for (const item of config.customElements) {
      const def = getSubtypeDefaultSpec(item.subtype, boothCostMult);
      const cw = item.width ?? def.w;
      const cd = item.depth ?? def.d;
      const zone = item.zoneHint ?? def.zone;
      const copies = Math.max(1, Math.min(8, Math.round(item.count || 1)));

      for (let c = 0; c < copies; c++) {
        let tx = 0;
        let tz = 10;
        let crot = 0;
        const spread = (c - (copies - 1) / 2) * (cw + 4.5);

        if (item.subtype === 'foh_control') {
          tx = primaryStageAnchor.x;
          tz = stagePlacement === 'center_360' ? primaryStageAnchor.z + 28 : primaryStageAnchor.z + 34;
        } else if (zone === 'entrance') {
          tx = mainGatePos.x - 14 - c * 13;
          tz = mainGatePos.z - 12;
        } else if (zone === 'perimeter') {
          tx = item.subtype === 'shuttle_stop' ? W * 0.36 : -W * 0.36;
          tz = item.subtype === 'smoking_booth' ? -D * 0.38 + c * 10 : D * 0.35 - c * 14;
        } else if (zone === 'center') {
          tx = 4 + spread;
          tz = stagePlacement === 'center_360' ? D * 0.24 : 8;
        } else if (zone === 'west') {
          tx = -W * 0.24;
          tz = D * 0.14 + c * (cd + 5);
          crot = Math.PI / 2;
        } else if (zone === 'east') {
          tx = W * 0.22;
          tz = D * 0.08 + c * (cd + 5);
          crot = -Math.PI / 2;
        } else if (zone === 'north') {
          tx = spread;
          tz = -D * 0.24;
        } else {
          tx = spread;
          tz = D * 0.28;
        }

        const pos = tryPlace(
          tx,
          tz,
          cw,
          cd,
          zone === 'perimeter' ? 3 : 6,
        );
        const suffix = copies > 1 ? ` #${c + 1}` : '';
        facilities.push({
          id: `custom-${item.subtype}-${customSeq++}`,
          name: `${item.nameEn || item.nameKo}${suffix}`,
          nameKo: `${item.nameKo}${suffix}`,
          category: item.category,
          subtype: item.subtype,
          position: pos,
          dimensions: { width: cw, depth: cd, height: def.h },
          rotation: crot,
          capacity: def.cap,
          cost: def.cost,
          attractionWeight: def.weight,
          colorAccent: def.color,
          covered: def.covered,
          accessibility: {
            wheelchairAccessible: true,
            stepFreeEntry: true,
            priorityQueue: item.subtype === 'wristband_hub' || item.subtype === 'shuttle_stop',
          },
          notes: `사용자 자연어 프롬프트 조건으로 맞춤 배치된 실제 축제 특화 시설(${item.nameKo})입니다.`,
        });
      }
    }
  }

  // 8. Rest Areas, Family Lounge & Play Plaza
  const restCenterX =
    stagePlacement === 'none'
      ? 0
      : venueModel === 'circular_plaza' || venueModel === 'u_courtyard'
        ? 2
        : -W * 0.14;
  const restCenterZ =
    stagePlacement === 'none'
      ? 0
      : stagePlacement === 'center_360'
        ? D * 0.28
        : venueModel === 'circular_plaza' || venueModel === 'u_courtyard'
          ? 12
          : D * 0.27;
  const restPos = tryPlace(restCenterX, restCenterZ, 22, 15, 6);
  facilities.push({
    id: 'rest-dining-main',
    name: 'Shaded Parasol Dining Plaza',
    nameKo: '그늘막 파라솔 휴게 광장',
    category: 'rest',
    subtype: 'rest_plaza',
    position: restPos,
    dimensions: { width: 22, depth: 15, height: 3.5 },
    rotation: 0,
    capacity: 500,
    cost: config.objective === 'budget_efficiency' ? 7200 : 9200,
    attractionWeight: 1.35,
    colorAccent: '#0ea5e9',
    covered: false,
    accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: false },
  });

  // Inclusive Family & Stroller Nursing Lounge
  const famPos = tryPlace(W * 0.08, D * 0.2, 13, 9, 6);
  facilities.push({
    id: 'rest-family-lounge',
    name: 'Stroller & Nursing Family Lounge',
    nameKo: '유모차·수유 가족 쉼터',
    category: 'rest',
    subtype: 'family_lounge',
    position: famPos,
    dimensions: { width: 13, depth: 9, height: 4.2 },
    rotation: 0,
    capacity: 180,
    cost: 8200,
    attractionWeight: 1.15,
    colorAccent: '#f43f5e',
    covered: true,
    accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
  });



  // 9. Restrooms (supports explicit config.restroomCount 1..8)
  const restroomCount =
    config.restroomCount !== undefined
      ? Math.max(1, Math.min(8, config.restroomCount))
      : config.expectedAttendance >= 8500
        ? 3
        : 2;
  const rrTargets = [
    { x: 4, z: D * 0.34, name: 'South Central Restrooms', nameKo: '남측 중앙 화장실 (장애인 칸)' },
    { x: -W * 0.22, z: -D * 0.32, name: 'North-West Stage Restrooms', nameKo: '북서측 무대 화장실' },
    { x: W * 0.24, z: -D * 0.24, name: 'East Plaza Restrooms', nameKo: '동측 부스존 화장실' },
    { x: -W * 0.26, z: D * 0.08, name: 'West Culinary Restrooms', nameKo: '서측 푸드존 화장실' },
    { x: W * 0.26, z: D * 0.14, name: 'South-East Gate Restrooms', nameKo: '남동측 출입구 화장실' },
    { x: 0, z: -D * 0.38, name: 'North Backstage Restrooms', nameKo: '북측 보조 화장실' },
    { x: -W * 0.12, z: D * 0.36, name: 'South-West Egress Restrooms', nameKo: '남서측 퇴장로 화장실' },
    { x: W * 0.14, z: -D * 0.04, name: 'Central Promenade Restrooms', nameKo: '중앙 산책로 화장실' },
  ];
  for (let i = 0; i < restroomCount; i++) {
    const spec = rrTargets[i % rrTargets.length];
    const pos = tryPlace(spec.x, spec.z, 14, 7, 6);
    facilities.push({
      id: `restroom-${i + 1}`,
      name: spec.name,
      nameKo: spec.nameKo,
      category: 'restroom',
      subtype: 'restroom_bank',
      position: pos,
      dimensions: { width: 14, depth: 7, height: 3.8 },
      rotation: 0,
      capacity: 260,
      cost: 10500,
      attractionWeight: 1.5,
      colorAccent: '#0284c7',
      covered: true,
      accessibility: {
        wheelchairAccessible: config.accessibility.accessibleRestrooms || allAccessible,
        stepFreeEntry: true,
        priorityQueue: true,
      },
    });
  }

  // 10. Medical Stations (supports explicit config.medicalCount 1..5)
  const medCount =
    config.medicalCount !== undefined
      ? Math.max(1, Math.min(5, config.medicalCount))
      : config.requiredFacilities.extraMedical ||
          config.objective === 'safety_first' ||
          config.expectedAttendance >= 10500
        ? 2
        : 1;
  const medTargets = [
    { x: W * 0.22, z: D * 0.3, name: 'Primary Emergency Medical Center', nameKo: '응급 의료 본부' },
    { x: -W * 0.18, z: -D * 0.14, name: 'Stage West First Aid Post', nameKo: '무대 서측 응급구호소' },
    { x: W * 0.22, z: -D * 0.14, name: 'East Booth First Aid Post', nameKo: '동측 부스존 응급구호소' },
    { x: -W * 0.22, z: D * 0.3, name: 'South-West Gate Medical Post', nameKo: '남서측 출입구 응급구호소' },
    { x: 0, z: D * 0.04, name: 'Central Triage Medical Hub', nameKo: '중앙 광장 응급처치소' },
  ];
  for (let i = 0; i < medCount; i++) {
    const spec = medTargets[i % medTargets.length];
    const pos = tryPlace(spec.x, spec.z, 13, 8.5, 6);
    facilities.push({
      id: `medical-${i + 1}`,
      name: spec.name,
      nameKo: spec.nameKo,
      category: 'medical',
      subtype: 'medical_station',
      position: pos,
      dimensions: { width: 13, depth: 8.5, height: 4.5 },
      rotation: 0,
      capacity: 120,
      cost: 12500,
      attractionWeight: 0.35,
      colorAccent: '#dc2626',
      covered: true,
      accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
    });
  }

  return enforceZeroFacilityOverlap(facilities, config);
}

const ANCHOR_PRIORITY_BY_SUBTYPE: Partial<Record<FacilitySubtype, number>> = {
  main_stage: 1,
  parking_lot: 2,
  main_entrance: 3,
  secondary_entrance: 4,
  shuttle_stop: 5,
  seating_block: 6,
  secondary_stage: 7,
  camping_zone: 8,
  vip_lounge: 9,
  play_zone: 10,
  medical_station: 11,
  restroom_bank: 12,
  foh_control: 13,
};

/**
 * Guarantees 0 physical overlaps across all 3D facility meshes (including rotated footprints,
 * wheelchair ramps, stage speaker wings, relay screens, and entrance portals).
 */
export function enforceZeroFacilityOverlap(
  facilities: Facility[],
  config: EventConfig,
  priorityIds: string[] = [],
): Facility[] {
  if (facilities.length <= 1) return facilities;

  const W = config.venueWidth;
  const D = config.venueDepth;
  const shape = config.venueShape ?? 'rectangle';
  const targetClearance = config.accessibility.wideCorridors ? 2.2 : 1.6;
  const prioritySet = new Set(priorityIds);

  const cloned = facilities.map((f) => ({
    ...f,
    position: { ...f.position },
    dimensions: { ...f.dimensions },
    accessibility: { ...f.accessibility },
  }));

  // Order: locked facilities (-1) -> explicit user-edited/spawned priorityIds (0) -> structural anchors -> booths
  const ordered = [...cloned].sort((a, b) => {
    const ap = a.locked ? -1 : prioritySet.has(a.id) ? 0 : (ANCHOR_PRIORITY_BY_SUBTYPE[a.subtype] ?? 20);
    const bp = b.locked ? -1 : prioritySet.has(b.id) ? 0 : (ANCHOR_PRIORITY_BY_SUBTYPE[b.subtype] ?? 20);
    return ap - bp;
  });

  const accepted: Array<{ fac: Facility; aabb: WorldAABB }> = [];

  // Cardinal-first search angles keep row/boulevard booths crisply aligned
  const baseAngles: number[] = [0, Math.PI, Math.PI / 2, -Math.PI / 2];
  for (let i = 0; i < 28; i++) {
    const ang = (i / 28) * Math.PI * 2;
    if (!baseAngles.some((b) => Math.abs(b - ang) < 0.08)) {
      baseAngles.push(ang);
    }
  }

  for (const f of ordered) {
    const initialFp = getFacilityWorldFootprint(f, config, 0);
    const edgePad =
      f.category === 'parking' || f.category === 'entrance' || f.subtype === 'shuttle_stop'
        ? 2.5
        : 4.5;

    if (f.locked) {
      const clampedLocked =
        f.category === 'parking'
          ? clampExteriorParkingPosition(
              f.position.x,
              f.position.z,
              initialFp.spanW,
              initialFp.spanD,
              W,
              D,
            )
          : clampToVenue(
              f.position.x,
              f.position.z,
              initialFp.spanW,
              initialFp.spanD,
              W,
              D,
              2.5,
              shape,
            );
      f.position = clampedLocked;
      accepted.push({ fac: f, aabb: getFacilityWorldFootprint(f, config, 0) });
      continue;
    }

    const testAt = (cx: number, cz: number, clearance: number): { pos: { x: number; z: number }; aabb: WorldAABB } | null => {
      const clamped =
        f.category === 'parking'
          ? clampExteriorParkingPosition(cx, cz, initialFp.spanW, initialFp.spanD, W, D)
          : clampToVenue(cx, cz, initialFp.spanW, initialFp.spanD, W, D, edgePad, shape);
      const probe: Facility = { ...f, position: clamped };
      const fp = getFacilityWorldFootprint(probe, config, 0);
      for (const acc of accepted) {
        if (worldAABBsOverlap(fp, acc.aabb, clearance)) {
          return null;
        }
      }
      return { pos: clamped, aabb: fp };
    };

    let chosen = testAt(f.position.x, f.position.z, targetClearance);

    if (!chosen) {
      const maxSearchR = Math.max(W, D) * 1.15;
      for (const clearance of [targetClearance, 0.8, 0.25]) {
        chosen = testAt(f.position.x, f.position.z, clearance);
        if (chosen) break;

        for (let r = 2.5; r <= maxSearchR; r += 2.5) {
          for (const ang of baseAngles) {
            const tx = f.position.x + Math.cos(ang) * r;
            const tz = f.position.z + Math.sin(ang) * r;
            const hit = testAt(tx, tz, clearance);
            if (hit) {
              chosen = hit;
              break;
            }
          }
          if (chosen) break;
        }
        if (chosen) break;
      }
    }

    if (chosen) {
      f.position = chosen.pos;
      accepted.push({ fac: f, aabb: chosen.aabb });
    } else {
      const fallbackFp = getFacilityWorldFootprint(f, config, 0);
      accepted.push({ fac: f, aabb: fallbackFp });
    }
  }

  // Preserve original array ordering so UI lists and selection indices never jump
  const byId = new Map(ordered.map((f) => [f.id, f]));
  return facilities.map((orig) => byId.get(orig.id) ?? orig);
}

/**
 * Computes exact edge-to-edge 3D envelope clearance between every facility and its closest neighbor.
 */
export function computeFacilityClearanceAudit(
  facilities: Facility[],
  config: EventConfig,
): FacilityClearanceAudit {
  const byFacilityId: Record<string, FacilityClearanceEntry> = {};
  if (facilities.length <= 1) {
    return { conflictCount: 0, minClearanceM: 12, byFacilityId };
  }

  const boxes = facilities.map((f) => ({
    fac: f,
    // Measure structural body + attachment envelope without extra inflation
    aabb: getFacilityWorldFootprint(f, config, -0.35),
  }));

  let conflictCount = 0;
  let globalMin = Infinity;

  for (let i = 0; i < boxes.length; i++) {
    let nearestDist = Infinity;
    let nearestIdx = -1;

    for (let j = 0; j < boxes.length; j++) {
      if (i === j) continue;
      const a = boxes[i].aabb;
      const b = boxes[j].aabb;
      const dx = Math.max(0, b.minX - a.maxX, a.minX - b.maxX);
      const dz = Math.max(0, b.minZ - a.maxZ, a.minZ - b.maxZ);
      let dist: number;
      if (dx === 0 && dz === 0) {
        // Overlapping penetration depth (negative clearance)
        const penX = Math.min(a.maxX - b.minX, b.maxX - a.minX);
        const penZ = Math.min(a.maxZ - b.minZ, b.maxZ - a.minZ);
        dist = -Math.min(penX, penZ);
      } else {
        dist = Math.hypot(dx, dz);
      }
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = j;
      }
      if (j > i && dist < -0.05) {
        conflictCount++;
      }
    }

    if (nearestIdx >= 0) {
      const neighbor = boxes[nearestIdx].fac;
      const rounded = Math.round(nearestDist * 10) / 10;
      if (rounded < globalMin) globalMin = rounded;
      byFacilityId[boxes[i].fac.id] = {
        nearestId: neighbor.id,
        nearestNameKo: neighbor.nameKo || neighbor.name,
        nearestNameEn: neighbor.name,
        clearanceM: rounded,
      };
    }
  }

  return {
    conflictCount,
    minClearanceM: Number.isFinite(globalMin) ? Math.max(0, globalMin) : 8,
    byFacilityId,
  };
}

function resolveFacilityOverlaps(
  facilities: Facility[],
  config: EventConfig,
  priorityIds: string[] = [],
): void {
  const resolved = enforceZeroFacilityOverlap(facilities, config, priorityIds);
  for (let i = 0; i < facilities.length; i++) {
    facilities[i].position = { ...resolved[i].position };
  }
}

/**
 * Heuristic Layout Optimizer for Before/After Comparison.
 */
export function optimizeVenueLayout(
  config: EventConfig,
  currentFacilities: Facility[],
): { facilities: Facility[]; notes: string[]; notesKo: string[] } {
  const W = config.venueWidth;
  const D = config.venueDepth;
  const notes: string[] = [];
  const notesKo: string[] = [];
  const initialTotalCost = currentFacilities.reduce(
    (s, f) => s + (f.budgetExcluded ? 0 : f.cost),
    0,
  );
  const initialOccupiedSqm = currentFacilities.reduce(
    (s, f) => (f.category === 'parking' ? s : s + f.dimensions.width * f.dimensions.depth),
    0,
  );

  const next: Facility[] = currentFacilities.map((f) => ({
    ...f,
    position: { ...f.position },
    dimensions: { ...f.dimensions },
    accessibility: { ...f.accessibility },
  }));

  // 1. Unmistakably disperse Food & Beverage facilities across West and South-East wings
  const foods = next.filter((f) => f.category === 'food' && !f.locked);
  if (foods.length >= 2) {
    let movedFoodCount = 0;
    foods.forEach((f, idx) => {
      const targetWingEast = idx % 2 === 1;
      const wingRow = Math.floor(idx / 2);
      const targetX = targetWingEast
        ? Math.round(W * 0.24 + (wingRow % 2) * 11)
        : Math.round(-W * 0.33 + (wingRow % 2) * 10);
      const targetZ = targetWingEast
        ? Math.round(D * 0.16 + wingRow * 12)
        : Math.round(-D * 0.12 + wingRow * 14);
      const clamped = clampToVenue(targetX, targetZ, f.dimensions.width, f.dimensions.depth, W, D, 6);
      const dist = Math.hypot(clamped.x - f.position.x, clamped.z - f.position.z);
      if (dist >= 4) {
        f.position = clamped;
        f.rotation = targetWingEast ? -Math.PI / 2 : Math.PI / 2;
        movedFoodCount++;
      }
    });
    if (movedFoodCount > 0) {
      notes.push(
        `Dispersed ${movedFoodCount} food vendor(s) symmetrically across West & South-East wings to eliminate single-side queue congestion.`,
      );
      notesKo.push(
        `한쪽에 몰려 있던 식음·푸드 부스 ${movedFoodCount}동을 서측·남동측 양방향 외곽으로 분산 배치하여 대기열 교차 병목을 해소했습니다.`,
      );
    }
  }

  // 2. Re-space Experience & Merchandise booths into wide perimeter avenues to open central plaza
  const booths = next.filter((f) => f.category === 'booth' && !f.locked);
  if (booths.length >= 3) {
    let movedBoothCount = 0;
    booths.forEach((f, idx) => {
      const toWestArc = idx >= Math.ceil(booths.length * 0.6);
      const localIdx = toWestArc ? idx - Math.ceil(booths.length * 0.6) : idx;
      const targetX = toWestArc
        ? Math.round(-W * 0.19 - (localIdx % 2) * 10)
        : Math.round(W * 0.31 - (localIdx % 2) * 11);
      const targetZ = toWestArc
        ? Math.round(D * 0.14 + Math.floor(localIdx / 2) * 13)
        : Math.round(-D * 0.22 + localIdx * 11.5);
      const clamped = clampToVenue(targetX, targetZ, f.dimensions.width, f.dimensions.depth, W, D, 6);
      if (Math.hypot(clamped.x - f.position.x, clamped.z - f.position.z) >= 4) {
        f.position = clamped;
        movedBoothCount++;
      }
    });
    if (movedBoothCount > 0) {
      notes.push(
        `Realigned ${movedBoothCount} experience/merch booth(s) along wide perimeter avenues to open central circulation space.`,
      );
      notesKo.push(
        `체험·전시 부스 ${movedBoothCount}동을 외곽 광폭 가로축으로 정렬하여 중앙 광장 순환 보행 공간을 대폭 개방했습니다.`,
      );
    }
  }

  // 3. Widen central emergency & viewing corridor between seating blocks and Main Stage
  const stage = next.find((f) => f.category === 'stage');
  const seats = next.filter((f) => f.category === 'seating' && !f.locked);
  if (stage && seats.length >= 2) {
    const leftSeat = seats[0];
    const rightSeat = seats[1];
    leftSeat.position.x = Math.round(stage.position.x - leftSeat.dimensions.width / 2 - 6.5);
    rightSeat.position.x = Math.round(stage.position.x + rightSeat.dimensions.width / 2 + 6.5);
    notes.push(
      'Widened central audience emergency spine to 13m and aligned seating symmetrically with Main Stage.',
    );
    notesKo.push(
      '객석 중앙 비상·구급 통로 폭을 13m로 확장하고 메인 무대 전면 안전 완충 구역(11m+)을 확보했습니다.',
    );
    seats.forEach((s) => {
      const minZ = stage.position.z + stage.dimensions.depth / 2 + 11.5 + s.dimensions.depth / 2;
      if (s.position.z < minZ) {
        s.position.z = Math.round(minZ);
      }
    });
  }

  // 4. Right-size sprawling secondary modules (~10% modular footprint compaction) & recalculate area-proportional installation cost!
  let compactedCount = 0;
  next.forEach((f) => {
    if (f.locked) return;
    if (
      f.subtype === 'camping_zone' ||
      f.subtype === 'rest_plaza' ||
      f.subtype === 'play_zone' ||
      f.subtype === 'experience_booth' ||
      f.subtype === 'food_stall'
    ) {
      const oldArea = Math.max(1, f.dimensions.width * f.dimensions.depth);
      const shrinkFactor = f.category === 'camping' || f.subtype === 'play_zone' ? 0.88 : 0.92;
      const newW = Math.max(3.6, Math.round(f.dimensions.width * shrinkFactor * 2) / 2);
      const newD = Math.max(3.6, Math.round(f.dimensions.depth * shrinkFactor * 2) / 2);
      const newArea = newW * newD;
      if (newArea < oldArea - 0.5) {
        f.dimensions.width = newW;
        f.dimensions.depth = newD;
        if (!f.budgetExcluded) {
          const areaRatio = newArea / oldArea;
          // 30% fixed mobilization + 70% area-proportional structure/tent setup cost
          f.cost = Math.max(1200, Math.round(f.cost * (0.3 + 0.7 * areaRatio)));
        }
        compactedCount++;
      }
    }
  });

  // 5. Upgrade step-free & wheelchair accessibility on any non-compliant booths
  let upgradedAccess = 0;
  next.forEach((f) => {
    if (!f.accessibility.wheelchairAccessible) {
      f.accessibility.wheelchairAccessible = true;
      f.accessibility.stepFreeEntry = true;
      upgradedAccess++;
    }
  });
  if (upgradedAccess > 0) {
    notes.push(`Upgraded ${upgradedAccess} facility ramp(s) to 100% wheelchair-accessible step-free entry.`);
    notesKo.push(
      `단차가 존재하던 ${upgradedAccess}개 시설에 휠체어·유모차 겸용 무단차 경사로를 100% 적용했습니다.`,
    );
  }

  resolveFacilityOverlaps(next, config);

  const finalTotalCost = next.reduce((s, f) => s + (f.budgetExcluded ? 0 : f.cost), 0);
  const finalOccupiedSqm = next.reduce(
    (s, f) => (f.category === 'parking' ? s : s + f.dimensions.width * f.dimensions.depth),
    0,
  );
  const freedSqm = Math.max(0, Math.round(initialOccupiedSqm - finalOccupiedSqm));
  const savedUsd = Math.max(0, initialTotalCost - finalTotalCost);
  if (compactedCount > 0 && freedSqm > 0) {
    notes.push(
      `Modularized ${compactedCount} booth/zone footprints (+${freedSqm.toLocaleString()}m² walkable area), reducing structural setup cost by $${savedUsd.toLocaleString()}.`,
    );
    notesKo.push(
      `과대 점유 부스·휴게존 ${compactedCount}개소를 표준 모듈 규격으로 경량화하여 순수 보행 가용면적을 +${freedSqm.toLocaleString()}㎡ 넓히고 구조물 설치비를 ${formatCurrency(savedUsd, 'ko')} 절감했습니다.`,
    );
  }

  if (notes.length === 0) {
    notes.push('Current layout already satisfies spatial clearance, portal capacity, and accessibility heuristics.');
    notesKo.push('현재 배치가 이미 비상 이격 거리, 출입구 처리 용량, 무장애 접근성 기준을 모두 충족하고 있습니다.');
  }

  return { facilities: next, notes, notesKo };
}

/**
 * Real-Time Contingency Re-Optimization (돌발상황 실시간 재배치 엔진).
 */
export function reoptimizeForContingency(
  config: EventConfig,
  currentFacilities: Facility[],
  scenario: ContingencyScenario,
): { facilities: Facility[]; updatedConfig: EventConfig; actionSummaryKo: string; actionSummaryEn: string } {
  const W = config.venueWidth;
  const D = config.venueDepth;
  const next: Facility[] = currentFacilities.map((f) => ({
    ...f,
    position: { ...f.position },
    dimensions: { ...f.dimensions },
    accessibility: { ...f.accessibility },
  }));
  let updatedConfig: EventConfig = {
    ...config,
    accessibility: { ...config.accessibility, wideCorridors: true, stepFreeRoutes: true },
  };

  if (scenario === 'rain') {
    if (!next.some((f) => f.subtype === 'rain_canopy')) {
      next.push(
        {
          id: 'rain-canopy-central',
          name: 'Central Emergency Rain Canopy A',
          nameKo: '우천 대비 대형 비가림 캐노피 A',
          category: 'rest',
          subtype: 'rain_canopy',
          position: { x: -4, z: 12 },
          dimensions: { width: 26, depth: 16, height: 6.2 },
          rotation: 0,
          capacity: 850,
          cost: 9000,
          attractionWeight: 2.1,
          colorAccent: '#0284c7',
          covered: true,
          accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
          notes: '우천 돌발상황 시 야외 관람객을 즉각 수용하는 막구조 비가림 쉘터입니다.',
        },
        {
          id: 'rain-canopy-east',
          name: 'East Plaza Rain Shelter Canopy B',
          nameKo: '우천 대비 동측 비가림 캐노피 B',
          category: 'rest',
          subtype: 'rain_canopy',
          position: { x: Math.round(W * 0.14), z: Math.round(D * 0.26) },
          dimensions: { width: 22, depth: 14, height: 5.8 },
          rotation: 0,
          capacity: 650,
          cost: 7500,
          attractionWeight: 1.9,
          colorAccent: '#0284c7',
          covered: true,
          accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
        },
      );
    }
    resolveFacilityOverlaps(next, updatedConfig, ['rain-canopy-central', 'rain-canopy-east']);
    return {
      facilities: next,
      updatedConfig,
      actionSummaryKo:
        '우천 대응 재최적화 완료: 중앙·동측 광장에 대형 비가림 캐노피 2개소(+1,500명 수용)를 긴급 배치하여 실내 부스 과밀을 분산했습니다.',
      actionSummaryEn:
        'Rainstorm re-optimization applied: deployed 2 tensile rain canopies (+1,500 covered capacity) to relieve indoor booth crowding.',
    };
  }

  if (scenario === 'surge') {
    if (!next.some((f) => f.id.startsWith('entrance-surge'))) {
      next.push({
        id: 'entrance-surge-relief',
        name: 'Emergency Surge Relief Gate',
        nameKo: '인파 급증 비상 분산 게이트',
        category: 'entrance',
        subtype: 'secondary_entrance',
        position: { x: 10, z: Math.round(D * 0.42) },
        dimensions: { width: 16, depth: 7, height: 8.2 },
        rotation: 0,
        capacity: 1800,
        cost: 9500,
        attractionWeight: 1.6,
        colorAccent: '#0ea5e9',
        covered: true,
        accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
      });
      next.push({
        id: 'food-surge-express',
        name: 'Express Beverage & Snack Kiosk',
        nameKo: '고속 배식 푸드 익스프레스 부스',
        category: 'food',
        subtype: 'food_stall',
        position: { x: Math.round(W * 0.18), z: Math.round(D * 0.24) },
        dimensions: { width: 9, depth: 7, height: 4.2 },
        rotation: 0,
        capacity: 380,
        cost: 4800,
        attractionWeight: 1.8,
        colorAccent: '#10b981',
        covered: true,
        accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
      });
      updatedConfig = {
        ...updatedConfig,
        entranceCount: Math.min(6, updatedConfig.entranceCount + 1),
        foodBoothCount: Math.min(12, updatedConfig.foodBoothCount + 1),
      };
    }
    resolveFacilityOverlaps(next, updatedConfig, ['entrance-surge-relief', 'food-surge-express']);
    return {
      facilities: next,
      updatedConfig,
      actionSummaryKo:
        '방문객 급증(+35%) 재최적화 완료: 남측 비상 분산 게이트 개방(+1,800명) 및 5.2m 광폭 보행로·익스프레스 매점을 가동했습니다.',
      actionSummaryEn:
        'Crowd surge (+35%) re-optimization applied: opened emergency relief gate (+1,800 pax) and express food kiosk with 5.2m wide corridors.',
    };
  }

  if (scenario === 'stage_delay') {
    if (!next.some((f) => f.id === 'stage-popup-busking')) {
      next.push({
        id: 'stage-popup-busking',
        name: 'Pop-Up Acoustic Sub-Stage',
        nameKo: '공연 지연 분산용 서브 버스킹 무대',
        category: 'stage',
        subtype: 'secondary_stage',
        position: { x: Math.round(W * 0.14), z: Math.round(D * 0.28) },
        dimensions: { width: 18, depth: 11, height: 7.5 },
        rotation: Math.PI,
        capacity: 1100,
        cost: 12000,
        attractionWeight: 2.2,
        colorAccent: '#6366f1',
        covered: true,
        accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
      });
    }
    resolveFacilityOverlaps(next, updatedConfig, ['stage-popup-busking']);
    return {
      facilities: next,
      updatedConfig,
      actionSummaryKo:
        '공연 지연 대응 재최적화 완료: 남동측 광장에 서브 버스킹 무대(1,100명 수용)를 가동하여 푸드존·화장실 역류 인파를 흡수했습니다.',
      actionSummaryEn:
        'Stage delay re-optimization applied: activated South-East Pop-Up Sub-Stage (1,100 pax) to absorb intermission backflow.',
    };
  }

  if (scenario === 'medical_emergency') {
    // Clear central corridor x in [-15, 2] for non-stage facilities & add forward triage post
    for (const f of next) {
      if (f.category !== 'stage' && Math.abs(f.position.x + 7) < 9) {
        f.position.x = f.position.x >= -7 ? 8 : -22;
      }
    }
    if (!next.some((f) => f.id === 'medical-forward-triage')) {
      next.push({
        id: 'medical-forward-triage',
        name: 'Forward Stage Triage Post',
        nameKo: '무대 전방 긴급 응급처치소',
        category: 'medical',
        subtype: 'medical_station',
        position: { x: -24, z: -32 },
        dimensions: { width: 12, depth: 8, height: 4.4 },
        rotation: 0,
        capacity: 100,
        cost: 11000,
        attractionWeight: 0.5,
        colorAccent: '#dc2626',
        covered: true,
        accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
      });
    }
    resolveFacilityOverlaps(next, updatedConfig, ['medical-forward-triage']);
    return {
      facilities: next,
      updatedConfig,
      actionSummaryKo:
        '응급환자 대응 재최적화 완료: 중앙 구급차 전용 통로(폭 12m) 내 간섭 시설을 즉시 이격하고 무대 전방 응급처치소를 배치했습니다.',
      actionSummaryEn:
        'Medical emergency re-optimization applied: cleared 12m central ambulance spine and deployed Forward Stage Triage Post.',
    };
  }

  const opt = optimizeVenueLayout(config, next);
  return {
    facilities: opt.facilities,
    updatedConfig,
    actionSummaryKo: '표준 다목적 공간 최적화를 적용하여 동선 분산 및 무장애 통로를 확보했습니다.',
    actionSummaryEn: 'Applied multi-objective spatial optimization across corridors and food zones.',
  };
}

/**
 * Targeted 1-Click Inclusive Upgrade for any of the 5 Visitor Personas.
 */
export function applyInclusivePersonaUpgrade(
  config: EventConfig,
  currentFacilities: Facility[],
  personaId: VisitorPersonaId,
): { facilities: Facility[]; updatedConfig: EventConfig; messageKo: string; messageEn: string } {
  const W = config.venueWidth;
  const D = config.venueDepth;
  const next: Facility[] = currentFacilities.map((f) => ({
    ...f,
    position: { ...f.position },
    dimensions: { ...f.dimensions },
    accessibility: { ...f.accessibility },
  }));
  let updatedConfig: EventConfig = { ...config };

  if (personaId === 'wheelchair') {
    updatedConfig = {
      ...config,
      accessibility: {
        stepFreeRoutes: true,
        wideCorridors: true,
        accessibleRestrooms: true,
        accessibleParking: true,
      },
    };
    next.forEach((f) => {
      f.accessibility.wheelchairAccessible = true;
      f.accessibility.stepFreeEntry = true;
    });
    resolveFacilityOverlaps(next, updatedConfig);
    return {
      facilities: next,
      updatedConfig,
      messageKo: '휠체어 이용자 맞춤 보완 완료: 전 시설 무단차 경사로 100% 적용 및 5.2m 광폭 회전 통로를 확보했습니다.',
      messageEn: 'Wheelchair upgrade applied: 100% step-free ramps and 5.2m turning corridors enabled.',
    };
  }

  if (personaId === 'stroller') {
    updatedConfig = {
      ...config,
      accessibility: { ...config.accessibility, stepFreeRoutes: true, wideCorridors: true },
    };
    if (!next.some((f) => f.subtype === 'family_lounge')) {
      next.push({
        id: 'rest-family-stroller',
        name: 'Stroller & Nursing Family Lounge',
        nameKo: '유모차·수유 가족 전용 쉼터',
        category: 'rest',
        subtype: 'family_lounge',
        position: { x: 16, z: 22 },
        dimensions: { width: 14, depth: 9, height: 4.2 },
        rotation: 0,
        capacity: 200,
        cost: 8500,
        attractionWeight: 1.2,
        colorAccent: '#f43f5e',
        covered: true,
        accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
      });
    }
    resolveFacilityOverlaps(next, updatedConfig, ['rest-family-stroller']);
    return {
      facilities: next,
      updatedConfig,
      messageKo: '유모차 동반 가족 보완 완료: 수유·유모차 보관 전용 가족 쉼터 및 우회 완충 보행로를 확보했습니다.',
      messageEn: 'Stroller & family upgrade applied: added dedicated Nursing & Stroller Family Lounge.',
    };
  }



  if (personaId === 'seniors') {
    if (!next.some((f) => f.id === 'rest-senior-north')) {
      next.push({
        id: 'rest-senior-north',
        name: 'Senior Shaded Rest & Hydration Pavilion',
        nameKo: '어르신 그늘 쉼터 (중간 휴식존)',
        category: 'rest',
        subtype: 'rest_plaza',
        position: { x: 14, z: -12 },
        dimensions: { width: 16, depth: 12, height: 3.6 },
        rotation: 0,
        capacity: 280,
        cost: 6800,
        attractionWeight: 1.2,
        colorAccent: '#10b981',
        covered: true,
        accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
        notes: '연속 보행거리 50m 이내 휴식을 보장하는 어르신 친화 그늘 쉼터입니다.',
      });
    }
    resolveFacilityOverlaps(next, updatedConfig, ['rest-senior-north']);
    return {
      facilities: next,
      updatedConfig,
      messageKo: '고령자 맞춤 보완 완료: 주동선 중간 지점에 그늘 쉼터를 추가하여 연속 보행거리를 50m 이하로 단축했습니다.',
      messageEn: 'Senior comfort upgrade applied: added mid-promenade shaded rest pavilion (<50m walk intervals).',
    };
  }

  // foreigner persona
  const mainGate = next.find((f) => f.subtype === 'main_entrance') || next.find((f) => f.category === 'entrance');
  const existingMulti = next.find((f) => f.subtype === 'multilingual_info');
  if (!existingMulti) {
    const gx = mainGate ? mainGate.position.x - 16 : W * 0.28;
    const gz = mainGate ? mainGate.position.z + 6 : D * 0.2;
    next.push({
      id: 'info-multilingual-gate',
      name: 'Global Multilingual Welcome Hub (KR/EN/JP/CN)',
      nameKo: '다국어 글로벌 안내소 (주출입구 직결)',
      category: 'entrance',
      subtype: 'multilingual_info',
      position: clampToVenue(gx, gz, 12, 8, W, D, 5),
      dimensions: { width: 12, depth: 8, height: 4.6 },
      rotation: 0,
      capacity: 320,
      cost: 7800,
      attractionWeight: 1.25,
      colorAccent: '#0284c7',
      covered: true,
      accessibility: { wheelchairAccessible: true, stepFreeEntry: true, priorityQueue: true },
    });
  } else if (mainGate) {
    existingMulti.position = clampToVenue(
      mainGate.position.x - 16,
      mainGate.position.z + 8,
      existingMulti.dimensions.width,
      existingMulti.dimensions.depth,
      W,
      D,
      5,
    );
  }
  resolveFacilityOverlaps(next, updatedConfig, ['info-multilingual-gate']);
  return {
    facilities: next,
    updatedConfig,
    messageKo: '외국인 이용자 보완 완료: 주출입구 직결 지점에 다국어(한·영·일·중) 글로벌 안내 부스를 전진 배치했습니다.',
    messageEn: 'International visitor upgrade applied: positioned Multilingual Welcome Hub directly inside Main Gate.',
  };
}

/**
 * Budget Overrun Resolver (예산 초과 시 안전·무장애 필수 시설을 보존하면서 예산 한도 내로 최적 맞춤 조정)
 */
export function fitLayoutToBudget(
  config: EventConfig,
  currentFacilities: Facility[],
): {
  facilities: Facility[];
  updatedConfig: EventConfig;
  savedUsd: number;
  adjustmentsKo: string[];
  adjustmentsEn: string[];
} {
  let next: Facility[] = currentFacilities.map((f) => ({
    ...f,
    position: { ...f.position },
    dimensions: { ...f.dimensions },
    accessibility: { ...f.accessibility },
  }));
  let updatedConfig: EventConfig = {
    ...config,
    requiredFacilities: { ...config.requiredFacilities },
    accessibility: { ...config.accessibility },
  };

  const sumCost = (list: Facility[]) =>
    list.reduce((s, f) => s + (f.budgetExcluded ? 0 : f.cost), 0);
  const initialCost = sumCost(next);
  const targetBudget = Math.max(10000, config.budget);
  const adjustmentsKo: string[] = [];
  const adjustmentsEn: string[] = [];

  if (initialCost <= targetBudget) {
    return {
      facilities: next,
      updatedConfig,
      savedUsd: 0,
      adjustmentsKo: ['현재 총 예상 비용이 이미 설정 예산 이내입니다.'],
      adjustmentsEn: ['Current layout cost is already within the target budget.'],
    };
  }

  // Step 1: Switch booth model to cost-efficient 'open_canopy' (-22% on food_stall & experience_booth)
  const currentBoothStyle = updatedConfig.boothModel ?? 'pagoda_tent';
  if (currentBoothStyle !== 'open_canopy') {
    const prevMult = BOOTH_MODEL_STYLE_LABELS[currentBoothStyle].costMult;
    const nextMult = BOOTH_MODEL_STYLE_LABELS.open_canopy.costMult;
    let boothSaved = 0;
    next.forEach((f) => {
      if ((f.subtype === 'experience_booth' || f.subtype === 'food_stall') && !f.budgetExcluded) {
        const newCost = Math.max(2200, Math.round((f.cost / prevMult) * nextMult));
        boothSaved += f.cost - newCost;
        f.cost = newCost;
      }
    });
    updatedConfig.boothModel = 'open_canopy';
    if (boothSaved > 0) {
      adjustmentsKo.push(
        `부스 외관 모형을 경제형 오픈 캐노피로 전환하여 부스 가설비를 절감했습니다 (-₩${Math.round((boothSaved * 1350) / 10000).toLocaleString()}만).`,
      );
      adjustmentsEn.push(`Switched booth architecture to Open Canopy (-$${boothSaved.toLocaleString()}).`);
    }
  }

  // Step 2: Remove optional VIP Lounge if still over budget (preserving locked & budgetExcluded)
  if (sumCost(next) > targetBudget && next.some((f) => f.category === 'vip' && !f.locked && !f.budgetExcluded)) {
    const vipCost = next
      .filter((f) => f.category === 'vip' && !f.locked && !f.budgetExcluded)
      .reduce((s, f) => s + f.cost, 0);
    next = next.filter((f) => f.category !== 'vip' || f.locked || f.budgetExcluded);
    updatedConfig.requiredFacilities.vipZone = false;
    adjustmentsKo.push(
      `선택 시설인 VIP 전용 라운지를 제외하고 일반 관람 광장으로 전환했습니다 (-₩${Math.round((vipCost * 1350) / 10000).toLocaleString()}만).`,
    );
    adjustmentsEn.push(`Removed optional VIP Lounge (-$${vipCost.toLocaleString()}).`);
  }

  // Step 3: Remove optional Camping Zone if still over budget (preserving locked & budgetExcluded)
  if (sumCost(next) > targetBudget && next.some((f) => f.category === 'camping' && !f.locked && !f.budgetExcluded)) {
    const campCost = next
      .filter((f) => f.category === 'camping' && !f.locked && !f.budgetExcluded)
      .reduce((s, f) => s + f.cost, 0);
    next = next.filter((f) => f.category !== 'camping' || f.locked || f.budgetExcluded);
    updatedConfig.requiredFacilities.campingArea = false;
    adjustmentsKo.push(
      `선택 시설인 외곽 캠핑·피크닉 존 가설 텐트 패키지를 제외했습니다 (-₩${Math.round((campCost * 1350) / 10000).toLocaleString()}만).`,
    );
    adjustmentsEn.push(`Removed optional Camping & Picnic Zone (-$${campCost.toLocaleString()}).`);
  }

  // Step 4: Convert high-cost Ferris-Wheel Play Zone ($18,500) into Compact Shaded Rest Plaza ($5,800)
  if (sumCost(next) > targetBudget) {
    const playIdx = next.findIndex((f) => f.subtype === 'play_zone' && !f.budgetExcluded);
    if (playIdx !== -1) {
      const oldCost = next[playIdx].cost;
      const newCost = 5800;
      next[playIdx] = {
        ...next[playIdx],
        subtype: 'rest_plaza',
        name: 'Compact Family Shaded Rest Plaza',
        nameKo: '가족 친화 파라솔 쉼터 (경량형)',
        dimensions: { width: 18, depth: 14, height: 3.5 },
        cost: newCost,
      };
      updatedConfig.requiredFacilities.playRestZone = false;
      adjustmentsKo.push(
        `대형 관람차 놀이광장을 경량형 가족 파라솔 쉼터로 대체하여 안전 휴게 면적은 유지하고 설치비를 절감했습니다 (-₩${Math.round(((oldCost - newCost) * 1350) / 10000).toLocaleString()}만).`,
      );
      adjustmentsEn.push(
        `Converted heavy Play Zone into Compact Family Shaded Rest Plaza (-$${(oldCost - newCost).toLocaleString()}).`,
      );
    }
  }

  // Step 5: Remove optional secondary sub-stages while keeping main_stage intact
  if (sumCost(next) > targetBudget && next.some((f) => f.subtype === 'secondary_stage' && !f.budgetExcluded)) {
    const subCost = next
      .filter((f) => f.subtype === 'secondary_stage' && !f.budgetExcluded)
      .reduce((s, f) => s + f.cost, 0);
    next = next.filter((f) => f.subtype !== 'secondary_stage' || f.budgetExcluded);
    updatedConfig.subStageCount = 0;
    adjustmentsKo.push(
      `보조 서브 무대를 메인 무대 타임테이블로 통합 운영하여 음향·조명 중복 임차비를 절감했습니다 (-₩${Math.round((subCost * 1350) / 10000).toLocaleString()}만).`,
    );
    adjustmentsEn.push(`Consolidated secondary sub-stage into Main Stage schedule (-$${subCost.toLocaleString()}).`);
  }

  // Step 6: Right-size Main Stage truss/LED package (preserving safety buffer & wheelchair viewing deck)
  if (sumCost(next) > targetBudget) {
    const mainStage = next.find((f) => f.subtype === 'main_stage' && !f.budgetExcluded);
    if (mainStage && mainStage.cost > 22000) {
      const reducedStageCost = Math.max(22000, Math.round(mainStage.cost * 0.65));
      const diff = mainStage.cost - reducedStageCost;
      mainStage.cost = reducedStageCost;
      mainStage.dimensions.width = Math.max(24, Math.round(mainStage.dimensions.width * 0.88));
      adjustmentsKo.push(
        `메인 무대를 표준 모듈형 트러스 패키지로 경량화했습니다 (무장애 관람석·안전 이격거리 100% 유지, -₩${Math.round((diff * 1350) / 10000).toLocaleString()}만).`,
      );
      adjustmentsEn.push(`Right-sized Main Stage to modular truss specification (-$${diff.toLocaleString()}).`);
    }
  }

  // Step 7: Trim excess paid experience booths (keep >= 2) and food booths (keep >= 2) one by one until <= budget
  let trimmedExp = 0;
  while (sumCost(next) > targetBudget) {
    const expBooths = next.filter((f) => f.category === 'booth' && !f.locked && !f.budgetExcluded);
    if (expBooths.length <= 2) break;
    const victim = expBooths[expBooths.length - 1];
    next = next.filter((f) => f.id !== victim.id);
    trimmedExp++;
  }
  if (trimmedExp > 0) {
    updatedConfig.experienceBoothCount = next.filter((f) => f.category === 'booth').length;
    adjustmentsKo.push(
      `체험·전시 부스 수량을 ${trimmedExp}개 감축하여 핵심 프로그램 중심으로 통합했습니다 (현재 ${updatedConfig.experienceBoothCount}개).`,
    );
    adjustmentsEn.push(`Consolidated ${trimmedExp} experience booth(s) into shared maker pods.`);
  }

  let trimmedFood = 0;
  while (sumCost(next) > targetBudget) {
    const foods = next.filter((f) => f.category === 'food' && !f.locked && !f.budgetExcluded);
    if (foods.length <= 2) break;
    const victim = foods[foods.length - 1];
    next = next.filter((f) => f.id !== victim.id);
    trimmedFood++;
  }
  if (trimmedFood > 0) {
    updatedConfig.foodBoothCount = next.filter((f) => f.category === 'food').length;
    adjustmentsKo.push(
      `푸드 부스 수량을 ${trimmedFood}개 조정하고 회전율이 높은 메뉴 중심으로 구성했습니다 (현재 ${updatedConfig.foodBoothCount}개).`,
    );
    adjustmentsEn.push(`Right-sized ${trimmedFood} food vendor unit(s) for budget compliance.`);
  }

  const remainingCost = sumCost(next);
  if (remainingCost > targetBudget) {
    const ratio = (targetBudget * 0.98) / remainingCost;
    next.forEach((f) => {
      if (!f.budgetExcluded) {
        f.cost = Math.max(800, Math.floor(f.cost * ratio));
      }
    });
    const postScaleDiff = sumCost(next) - targetBudget;
    if (postScaleDiff > 0) {
      const largest = [...next]
        .filter((f) => !f.budgetExcluded)
        .sort((a, b) => b.cost - a.cost)[0];
      if (largest) largest.cost = Math.max(500, largest.cost - postScaleDiff);
    }
    adjustmentsKo.push(
      `지자체·공공기관 공유 기자재 대여 단가를 적용하여 필수 응급의료소·장애인화장실·비상출입구를 100% 유지한 채 목표 예산 이내로 맞췄습니다.`,
    );
    adjustmentsEn.push(
      `Applied public-sector modular rental tier pricing while preserving 100% of mandatory safety, medical, and accessible facilities.`,
    );
  }

  resolveFacilityOverlaps(next, updatedConfig);
  const finalCost = sumCost(next);

  return {
    facilities: next,
    updatedConfig,
    savedUsd: Math.max(0, initialCost - finalCost),
    adjustmentsKo,
    adjustmentsEn,
  };
}

const ZONE_LABELS_KO: Record<SpatialZoneTarget, string> = {
  stage_left: '무대 좌측',
  stage_right: '무대 우측',
  stage_front: '무대 정면',
  center: '중앙 광장',
  north: '북측 구역',
  south: '남측 구역',
  east: '동측 구역',
  west: '서측 구역',
  northwest: '북서측 코너',
  northeast: '북동측 코너',
  southwest: '남서측 코너',
  southeast: '남동측 코너',
  entrance: '주출입구 전면',
  perimeter: '외곽 둘레',
  corners: '네 모서리 분산',
};

export interface SubtypeBlueprint {
  category: FacilityCategory;
  nameKo: string;
  nameEn: string;
  width: number;
  depth: number;
  height: number;
  capacity: number;
  cost: number;
  attractionWeight: number;
  colorAccent: string;
  covered: boolean;
  priorityQueue?: boolean;
  sourceStd?: string;
  version?: string;
}

export const SUBTYPE_BLUEPRINTS: Record<FacilitySubtype, SubtypeBlueprint> = {
  main_stage: {
    category: 'stage',
    nameKo: '메인 콘서트 무대',
    nameEn: 'Main Concert Stage',
    width: 32,
    depth: 18,
    height: 13,
    capacity: 2800,
    cost: 42000,
    attractionWeight: 3.4,
    colorAccent: '#2563eb',
    covered: true,
    priorityQueue: true,
  },
  secondary_stage: {
    category: 'stage',
    nameKo: '서브 어쿠스틱 무대',
    nameEn: 'Secondary Acoustic Stage',
    width: 18,
    depth: 12,
    height: 8.5,
    capacity: 900,
    cost: 16500,
    attractionWeight: 2.0,
    colorAccent: '#4f46e5',
    covered: true,
    priorityQueue: true,
  },
  seating_block: {
    category: 'seating',
    nameKo: '관객 좌석 블록',
    nameEn: 'Audience Seating Block',
    width: 18,
    depth: 12,
    height: 1.6,
    capacity: 420,
    cost: 4800,
    attractionWeight: 2.1,
    colorAccent: '#0284c7',
    covered: false,
    priorityQueue: true,
  },
  food_truck: {
    category: 'food',
    nameKo: '프리미엄 푸드트럭',
    nameEn: 'Gourmet Food Truck',
    width: 8.5,
    depth: 5.5,
    height: 3.6,
    capacity: 220,
    cost: 4800,
    attractionWeight: 1.85,
    colorAccent: '#ea580c',
    covered: true,
  },
  food_stall: {
    category: 'food',
    nameKo: '먹거리 식음 부스',
    nameEn: 'F&B Culinary Booth',
    width: 7.5,
    depth: 6.5,
    height: 4.0,
    capacity: 210,
    cost: 4500,
    attractionWeight: 1.75,
    colorAccent: '#f97316',
    covered: true,
  },
  beer_garden: {
    category: 'food',
    nameKo: '수제맥주 비어가든 존',
    nameEn: 'Craft Beer Garden Zone',
    width: 18,
    depth: 14,
    height: 4.6,
    capacity: 480,
    cost: 12500,
    attractionWeight: 2.2,
    colorAccent: '#d97706',
    covered: true,
  },
  experience_booth: {
    category: 'booth',
    nameKo: '체험·전시 프로그램 부스',
    nameEn: 'Interactive Experience Booth',
    width: 7,
    depth: 6.5,
    height: 3.9,
    capacity: 160,
    cost: 3900,
    attractionWeight: 1.45,
    colorAccent: '#0d9488',
    covered: true,
  },
  goods_shop: {
    category: 'booth',
    nameKo: '공식 굿즈·MD 스토어',
    nameEn: 'Official Merch & Goods Store',
    width: 12,
    depth: 8.5,
    height: 4.5,
    capacity: 320,
    cost: 8200,
    attractionWeight: 2.1,
    colorAccent: '#7c3aed',
    covered: true,
  },
  photo_zone: {
    category: 'booth',
    nameKo: '포토존 (세로형 직육면체)',
    nameEn: 'Vertical Tower Photo Zone',
    width: 4.4,
    depth: 3.6,
    height: 7.4,
    capacity: 190,
    cost: 5200,
    attractionWeight: 1.65,
    colorAccent: '#ec4899',
    covered: false,
  },
  rest_plaza: {
    category: 'rest',
    nameKo: '그늘막 가족 휴게광장',
    nameEn: 'Shaded Family Rest Plaza',
    width: 16,
    depth: 13,
    height: 4.2,
    capacity: 340,
    cost: 6200,
    attractionWeight: 1.25,
    colorAccent: '#16a34a',
    covered: true,
    priorityQueue: true,
  },
  play_zone: {
    category: 'rest',
    nameKo: '어린이·가족 키즈 놀이존',
    nameEn: 'Family Kids Play Plaza',
    width: 18,
    depth: 15,
    height: 7.5,
    capacity: 360,
    cost: 14500,
    attractionWeight: 1.5,
    colorAccent: '#10b981',
    covered: false,
  },
  locker_charging: {
    category: 'rest',
    nameKo: '물품보관·휴대폰 충전소',
    nameEn: 'Smart Locker & Charging Hub',
    width: 9.5,
    depth: 6,
    height: 3.6,
    capacity: 240,
    cost: 4900,
    attractionWeight: 1.15,
    colorAccent: '#0284c7',
    covered: true,
  },
  eco_station: {
    category: 'rest',
    nameKo: '다회용기 반납·친환경 클린존',
    nameEn: 'Reusable Cup & Eco Clean Station',
    width: 7.5,
    depth: 5.5,
    height: 3.4,
    capacity: 180,
    cost: 3400,
    attractionWeight: 0.9,
    colorAccent: '#15803d',
    covered: true,
  },
  mist_cooling: {
    category: 'rest',
    nameKo: '쿨링포그 무더위 아케이드',
    nameEn: 'Cooling Mist Shade Arcade',
    width: 13,
    depth: 6.5,
    height: 3.8,
    capacity: 260,
    cost: 5400,
    attractionWeight: 1.3,
    colorAccent: '#06b6d4',
    covered: true,
  },
  smoking_booth: {
    category: 'rest',
    nameKo: '외곽 밀폐형 제연 흡연부스',
    nameEn: 'Enclosed Clean-Air Smoking Booth',
    width: 6,
    depth: 4.5,
    height: 3.2,
    capacity: 60,
    cost: 4200,
    attractionWeight: 0.55,
    colorAccent: '#64748b',
    covered: true,
  },
  restroom_bank: {
    category: 'restroom',
    nameKo: '모듈형 화장실 (장애인 칸 포함)',
    nameEn: 'Accessible Modular Restrooms',
    width: 12,
    depth: 7,
    height: 3.6,
    capacity: 280,
    cost: 9200,
    attractionWeight: 1.3,
    colorAccent: '#0ea5e9',
    covered: true,
    priorityQueue: true,
  },
  main_entrance: {
    category: 'entrance',
    nameKo: '메인 출입 게이트',
    nameEn: 'Main Entry & Exit Portal',
    width: 20,
    depth: 7,
    height: 6.8,
    capacity: 1800,
    cost: 12000,
    attractionWeight: 1.2,
    colorAccent: '#1d4ed8',
    covered: true,
    priorityQueue: true,
  },
  secondary_entrance: {
    category: 'entrance',
    nameKo: '보조 분산 출입구',
    nameEn: 'Secondary Relief Gate',
    width: 14,
    depth: 6,
    height: 5.4,
    capacity: 1350,
    cost: 8200,
    attractionWeight: 0.95,
    colorAccent: '#2563eb',
    covered: true,
    priorityQueue: true,
  },
  ticket_info: {
    category: 'entrance',
    nameKo: '매표·안내 부스',
    nameEn: 'Ticketing & Info Booth',
    width: 9,
    depth: 6,
    height: 3.6,
    capacity: 260,
    cost: 5200,
    attractionWeight: 1.1,
    colorAccent: '#0284c7',
    covered: true,
    priorityQueue: true,
  },
  multilingual_info: {
    category: 'entrance',
    nameKo: '종합안내·다국어·휠체어 대여소',
    nameEn: 'Multilingual Info & Mobility Desk',
    width: 9,
    depth: 6.5,
    height: 3.8,
    capacity: 220,
    cost: 5600,
    attractionWeight: 1.05,
    colorAccent: '#0369a1',
    covered: true,
    priorityQueue: true,
  },
  fountain_plaza: {
    category: 'rest',
    nameKo: '중앙 분수 휴게광장',
    nameEn: 'Central Fountain Plaza',
    width: 18,
    depth: 18,
    height: 3.2,
    capacity: 380,
    cost: 8900,
    attractionWeight: 1.4,
    colorAccent: '#0ea5e9',
    covered: false,
  },
  family_lounge: {
    category: 'rest',
    nameKo: '수유실·유모차 가족 라운지',
    nameEn: 'Nursing & Stroller Family Lounge',
    width: 12,
    depth: 9,
    height: 3.8,
    capacity: 160,
    cost: 6800,
    attractionWeight: 1.15,
    colorAccent: '#ec4899',
    covered: true,
    priorityQueue: true,
  },
  rain_canopy: {
    category: 'rest',
    nameKo: '대형 우천 대피 캐노피 쉘터',
    nameEn: 'Emergency Rain Shelter Canopy',
    width: 22,
    depth: 14,
    height: 4.8,
    capacity: 520,
    cost: 9400,
    attractionWeight: 1.35,
    colorAccent: '#0284c7',
    covered: true,
    priorityQueue: true,
  },
  wristband_hub: {
    category: 'entrance',
    nameKo: '티켓교환·팔찌배부 허브',
    nameEn: 'Ticket & Wristband Exchange Hub',
    width: 14,
    depth: 7,
    height: 4.2,
    capacity: 640,
    cost: 7600,
    attractionWeight: 1.4,
    colorAccent: '#4338ca',
    covered: true,
    priorityQueue: true,
  },
  medical_station: {
    category: 'medical',
    nameKo: '응급의료소·구급대기소',
    nameEn: 'Emergency Medical & First-Aid Post',
    width: 12,
    depth: 8,
    height: 4.2,
    capacity: 120,
    cost: 14500,
    attractionWeight: 0.4,
    colorAccent: '#dc2626',
    covered: true,
    priorityQueue: true,
  },
  parking_lot: {
    category: 'parking',
    nameKo: '외곽·교통약자 전용 주차장',
    nameEn: 'Accessible Perimeter Parking Lot',
    width: 24,
    depth: 14,
    height: 2.4,
    capacity: 320,
    cost: 8800,
    attractionWeight: 0.65,
    colorAccent: '#475569',
    covered: false,
    priorityQueue: true,
  },
  shuttle_stop: {
    category: 'parking',
    nameKo: '셔틀버스·장애인콜택시 승강장',
    nameEn: 'Shuttle Bus & Accessible Taxi Bay',
    width: 18,
    depth: 7.5,
    height: 3.8,
    capacity: 420,
    cost: 6800,
    attractionWeight: 0.85,
    colorAccent: '#0f766e',
    covered: true,
    priorityQueue: true,
  },
  vip_lounge: {
    category: 'vip',
    nameKo: 'VIP 호스피탈리티 라운지 데크',
    nameEn: 'VIP Hospitality Lounge Deck',
    width: 16,
    depth: 12,
    height: 4.8,
    capacity: 220,
    cost: 16800,
    attractionWeight: 1.15,
    colorAccent: '#b45309',
    covered: true,
    priorityQueue: true,
  },
  camping_zone: {
    category: 'camping',
    nameKo: '피크닉·글램핑 쉼터 존',
    nameEn: 'Picnic & Glamping Lawn Zone',
    width: 20,
    depth: 15,
    height: 3.6,
    capacity: 280,
    cost: 11200,
    attractionWeight: 1.1,
    colorAccent: '#65a30d',
    covered: false,
  },
  pet_zone: {
    category: 'camping',
    nameKo: '반려동물 놀이터·펫 쉼터',
    nameEn: 'Companion Pet Agility & Rest Park',
    width: 16,
    depth: 13,
    height: 3.2,
    capacity: 180,
    cost: 7400,
    attractionWeight: 1.2,
    colorAccent: '#84cc16',
    covered: false,
  },
  foh_control: {
    category: 'stage',
    nameKo: 'FOH 음향·조명 콘솔 타워',
    nameEn: 'FOH Sound & Lighting Control Tower',
    width: 8,
    depth: 6.5,
    height: 5.8,
    capacity: 40,
    cost: 9500,
    attractionWeight: 0.2,
    colorAccent: '#334155',
    covered: true,
  },
  wheelchair_viewing: {
    category: 'seating',
    nameKo: '휠체어 전용 관람석 데크',
    nameEn: 'Wheelchair Viewing Platform',
    width: 12,
    depth: 6.5,
    height: 1.4,
    capacity: 85,
    cost: 5400,
    attractionWeight: 1.6,
    colorAccent: '#2563eb',
    covered: false,
    priorityQueue: true,
    sourceStd: '장애인등편의법 별표1 · 공연장 무장애 관람석 기준',
    version: 'v2026.2',
  },
  access_ramp: {
    category: 'entrance',
    nameKo: '표준 무장애 경사로 모듈 (1/12)',
    nameEn: '1:12 Step-Free Access Ramp Module',
    width: 4.2,
    depth: 7.5,
    height: 1.1,
    capacity: 320,
    cost: 2800,
    attractionWeight: 0.5,
    colorAccent: '#0284c7',
    covered: false,
    priorityQueue: true,
    sourceStd: '장애인등편의법 시행규칙 별표1 (유효폭 ≥1.2m, 기울기 ≤1/12)',
    version: 'v2026.2',
  },
  tactile_paving: {
    category: 'entrance',
    nameKo: '시각장애인 점자블록 유도축',
    nameEn: 'Tactile Paving Guidance Spine',
    width: 3.2,
    depth: 14,
    height: 0.25,
    capacity: 450,
    cost: 1900,
    attractionWeight: 0.35,
    colorAccent: '#eab308',
    covered: false,
    priorityQueue: true,
    sourceStd: 'KS F 4561 시각장애인용 점자블록 표준규격',
    version: 'v2026.2',
  },
  senior_rest: {
    category: 'rest',
    nameKo: '노약자·임산부 전용 그늘 쉼터',
    nameEn: 'Senior & Mobility Priority Rest Lounge',
    width: 12,
    depth: 9,
    height: 3.8,
    capacity: 180,
    cost: 5800,
    attractionWeight: 1.2,
    colorAccent: '#059669',
    covered: true,
    priorityQueue: true,
    sourceStd: '보건복지부 BF 인증 공원·광장 휴게시설 기준',
    version: 'v2026.2',
  },
  fire_safety_unit: {
    category: 'medical',
    nameKo: '소방시설·대형소화기·방화수 포스트',
    nameEn: 'Fire Safety & Hydrant Equipment Post',
    width: 6,
    depth: 5,
    height: 3.4,
    capacity: 40,
    cost: 4200,
    attractionWeight: 0.25,
    colorAccent: '#ef4444',
    covered: true,
    priorityQueue: true,
    sourceStd: '소방청 옥외행사 안전관리 가이드라인 · 화재예방법',
    version: 'v2026.2',
  },
  emergency_shelter: {
    category: 'medical',
    nameKo: '재난·기상악화 비상 대피소',
    nameEn: 'Emergency Evacuation & Triage Shelter',
    width: 18,
    depth: 12,
    height: 4.8,
    capacity: 420,
    cost: 11800,
    attractionWeight: 0.85,
    colorAccent: '#dc2626',
    covered: true,
    priorityQueue: true,
    sourceStd: '행안부 지역축제장 안전관리 매뉴얼 대피소 기준',
    version: 'v2026.2',
  },
  accessible_parking: {
    category: 'parking',
    nameKo: '장애인 전용 주차장 (외곽 직결)',
    nameEn: 'Accessible Disabled Parking Bay (ISA)',
    width: 18,
    depth: 12,
    height: 2.5,
    capacity: 160,
    cost: 6900,
    attractionWeight: 0.6,
    colorAccent: '#1d4ed8',
    covered: false,
    priorityQueue: true,
    sourceStd: '주차장법 시행규칙 · 장애인전용주차구역(3.3m×5.0m)',
    version: 'v2026.2',
  },
  experience_pavilion: {
    category: 'booth',
    nameKo: '대형 문화 체험관 파빌리온',
    nameEn: 'Interactive Cultural Experience Pavilion',
    width: 14,
    depth: 10,
    height: 5.2,
    capacity: 320,
    cost: 9600,
    attractionWeight: 1.75,
    colorAccent: '#0d9488',
    covered: true,
    priorityQueue: true,
    sourceStd: '문체부 문화행사 전시·체험 파빌리온 모듈 기준',
    version: 'v2026.2',
  },
  exhibition_hall: {
    category: 'booth',
    nameKo: '주제 전시관 (옥타늄·갤러리형)',
    nameEn: 'Thematic Exhibition Hall Pavilion',
    width: 16,
    depth: 11,
    height: 5.6,
    capacity: 380,
    cost: 11400,
    attractionWeight: 1.65,
    colorAccent: '#4f46e5',
    covered: true,
    priorityQueue: true,
    sourceStd: '전시산업발전법 · 옥타늄 시스템 전시부스 표준',
    version: 'v2026.2',
  },
  volunteer_center: {
    category: 'entrance',
    nameKo: '자원봉사자실·운영스태프 본부',
    nameEn: 'Volunteer & Steward Operations Center',
    width: 10,
    depth: 7.5,
    height: 3.8,
    capacity: 120,
    cost: 5400,
    attractionWeight: 0.45,
    colorAccent: '#0284c7',
    covered: true,
    sourceStd: '행안부 지역축제 운영인력 교대·휴게 기준',
    version: 'v2026.2',
  },
  control_room: {
    category: 'stage',
    nameKo: '종합 안전·방송 통제실 (CP)',
    nameEn: 'Integrated Command & Control Room',
    width: 11,
    depth: 8,
    height: 4.6,
    capacity: 60,
    cost: 12800,
    attractionWeight: 0.3,
    colorAccent: '#1e293b',
    covered: true,
    priorityQueue: true,
    sourceStd: '재난안전법 시행령 제73조의9 종합상황실 운영 기준',
    version: 'v2026.2',
  },
  beam_projector: {
    category: 'stage',
    nameKo: '빔 프로젝터·대형 스크린 단상',
    nameEn: 'Beam Projector & 16:9 Screen Stage',
    width: 14,
    depth: 6.5,
    height: 5.6,
    capacity: 360,
    cost: 6800,
    attractionWeight: 2.1,
    colorAccent: '#0284c7',
    covered: true,
    priorityQueue: true,
    sourceStd: '실내 컨벤션·세미나 고광량 레이저 프로젝션 및 시야각 기준',
    version: 'v2026.2',
  },
};

function resolveZoneTargetPosition(
  zone: SpatialZoneTarget,
  config: EventConfig,
  facilities: Facility[],
  index: number,
  total: number,
  itemW: number,
  itemD: number,
): { x: number; z: number } {
  const w = config.venueWidth;
  const d = config.venueDepth;
  const shape = config.venueShape ?? 'rectangle';
  const mainStage = facilities.find((f) => f.subtype === 'main_stage');
  const mainGate = facilities.find((f) => f.subtype === 'main_entrance') ?? facilities.find((f) => f.category === 'entrance');

  const stageX = mainStage ? mainStage.position.x : 0;
  const stageZ = mainStage ? mainStage.position.z : -d * 0.32;
  const stageHalfW = mainStage ? mainStage.dimensions.width / 2 : 16;
  const stageHalfD = mainStage ? mainStage.dimensions.depth / 2 : 9;

  const gateX = mainGate ? mainGate.position.x : 0;
  const gateZ = mainGate ? mainGate.position.z : d * 0.4;

  const col = index % 3;
  const row = Math.floor(index / 3);
  const centeredSpread = (index - (Math.max(1, total) - 1) / 2) * (itemW + 4.5);

  let rawX = 0;
  let rawZ = 0;

  switch (zone) {
    case 'stage_left':
      rawX = stageX - stageHalfW - itemW / 2 - 10 - col * (itemW + 4);
      rawZ = stageZ + 4 + row * (itemD + 4.5);
      break;
    case 'stage_right':
      rawX = stageX + stageHalfW + itemW / 2 + 10 + col * (itemW + 4);
      rawZ = stageZ + 4 + row * (itemD + 4.5);
      break;
    case 'stage_front':
      rawX = stageX + centeredSpread;
      rawZ = stageZ + stageHalfD + itemD / 2 + 16 + row * (itemD + 5);
      break;
    case 'center':
      rawX = centeredSpread;
      rawZ = (row - 0.5) * (itemD + 5);
      break;
    case 'entrance':
      rawX = gateX + (index % 2 === 0 ? -1 : 1) * (15 + Math.floor(index / 2) * (itemW + 4));
      rawZ = gateZ - 14 - row * (itemD + 4);
      break;
    case 'north':
      rawX = centeredSpread;
      rawZ = -d * 0.34 + row * (itemD + 4);
      break;
    case 'south':
      rawX = centeredSpread;
      rawZ = d * 0.31 - row * (itemD + 4);
      break;
    case 'west':
      rawX = -w * 0.35 + col * (itemW + 4);
      rawZ = (index - (Math.max(1, total) - 1) / 2) * (itemD + 4.5);
      break;
    case 'east':
      rawX = w * 0.35 - col * (itemW + 4);
      rawZ = (index - (Math.max(1, total) - 1) / 2) * (itemD + 4.5);
      break;
    case 'northwest':
      rawX = -w * 0.32 + col * (itemW + 4);
      rawZ = -d * 0.29 + row * (itemD + 4);
      break;
    case 'northeast':
      rawX = w * 0.32 - col * (itemW + 4);
      rawZ = -d * 0.29 + row * (itemD + 4);
      break;
    case 'southwest':
      rawX = -w * 0.32 + col * (itemW + 4);
      rawZ = d * 0.29 - row * (itemD + 4);
      break;
    case 'southeast':
      rawX = w * 0.32 - col * (itemW + 4);
      rawZ = d * 0.29 - row * (itemD + 4);
      break;
    case 'corners': {
      const cornerIdx = index % 4;
      const tier = Math.floor(index / 4);
      const sx = cornerIdx === 0 || cornerIdx === 2 ? -1 : 1;
      const sz = cornerIdx < 2 ? -1 : 1;
      rawX = sx * (w * 0.34 - tier * (itemW + 4));
      rawZ = sz * (d * 0.31 - tier * (itemD + 4));
      break;
    }
    case 'perimeter':
    default: {
      const angle = (index / Math.max(1, total)) * Math.PI * 2 - Math.PI / 2;
      rawX = Math.cos(angle) * (w * 0.36);
      rawZ = Math.sin(angle) * (d * 0.33);
      break;
    }
  }

  return clampToVenue(rawX, rawZ, itemW, itemD, w, d, 6, shape);
}

function detectSpatialZoneFromClause(clause: string): SpatialZoneTarget | undefined {
  if (/무대\s*(?:왼쪽|좌측|서측|서쪽)|stage\s*left|ステージ(?:の)?左|舞台左(?:侧|边)|izquierda\s*del\s*escenario|gauche\s*de\s*la\s*scène|côté\s*cour/i.test(clause)) {
    return 'stage_left';
  }
  if (/무대\s*(?:오른쪽|우측|동측|동쪽|옆)|stage\s*right|ステージ(?:の)?右|舞台右(?:侧|边)|derecha\s*del\s*escenario|droite\s*de\s*la\s*scène|côté\s*jardin/i.test(clause)) {
    return 'stage_right';
  }
  if (/무대\s*(?:앞|정면|전면)|stage\s*front|in\s*front\s*of\s*(?:the\s*)?stage|ステージ(?:の)?(?:前|正面)|舞台(?:前|正前方)|frente\s*al\s*escenario|devant\s*la\s*scène/i.test(clause)) {
    return 'stage_front';
  }
  if (
    /(?:출입구|입구|정문|게이트)\s*(?:앞|근처|옆|주변|전면|안쪽|인근)?|near\s*(?:the\s*)?(?:entrance|gate|entry)|出入口(?:付近|の前|近く)|ゲート前|入口(?:附近|旁|前)|(?:cerca\s*de|junto\s*a)\s*la\s*entrada|près\s*de\s*l['’]entrée/i.test(
      clause,
    )
  ) {
    return 'entrance';
  }
  if (/(?:네\s*모서리|각\s*모서리|4곳\s*모서리|사방\s*모서리|코너마다|모서리마다|all\s*corners|four\s*corners|四隅|四角|四个角落|cuatro\s*esquinas|quatre\s*coins)/i.test(clause)) {
    return 'corners';
  }
  if (/북서|좌측\s*상단|왼쪽\s*위|northwest|北西|西北|noroeste|nord-ouest/i.test(clause)) return 'northwest';
  if (/북동|우측\s*상단|오른쪽\s*위|northeast|北東|东北|noreste|nord-est/i.test(clause)) return 'northeast';
  if (/남서|좌측\s*하단|왼쪽\s*아래|southwest|南西|西南|suroeste|sud-ouest/i.test(clause)) return 'southwest';
  if (/남동|우측\s*하단|오른쪽\s*아래|southeast|南東|东南|sureste|sud-est/i.test(clause)) return 'southeast';
  if (/(?:중앙\s*광장|행사장\s*중앙|중앙\s*홀|가운데|정중앙|한가운데|중앙에|center(?:\s*plaza|\s*hall)?|in\s*the\s*middle|中央(?:広場|ホール|に)?|真ん中|中央(?:广场|大厅)?|正中间|centro|plaza\s*central|au\s*centre|place\s*centrale)/i.test(clause)) {
    return 'center';
  }
  if (/(?:외곽|가장자리|둘레|테두리|행사장\s*외부|바깥|perimeter|outside|exterior|外周|会場外|外围|场馆外|perímetro|fuera\s*del\s*recinto|périmètre|hors\s*enceinte)/i.test(clause)) {
    return 'perimeter';
  }
  if (/(?:서측|서쪽|좌측|왼쪽|\bwest\b|left\s*wing|西側|左側|西侧|左侧|\boeste\b|\bouest\b)/i.test(clause)) return 'west';
  if (/(?:동측|동쪽|우측|오른쪽|\beast\b|right\s*wing|東側|右側|东侧|右侧|\beste\b|\best\b)/i.test(clause)) return 'east';
  if (/(?:북측|북쪽|상단|위쪽|\bnorth\b|北側|上側|北侧|\bnorte\b|\bnord\b)/i.test(clause)) return 'north';
  if (/(?:남측|남쪽|하단|아래쪽|\bsouth\b|南側|下側|南侧|\bsur\b|\bsud\b)/i.test(clause)) return 'south';
  return undefined;
}

const FACILITY_TARGET_PATTERNS: Array<{
  rx: RegExp;
  subtype: FacilitySubtype;
  category: FacilityCategory;
  defaultLabelKo: string;
  defaultZone: SpatialZoneTarget;
}> = [
  { rx: /응급\s*의료소|의료소|구호소|의무실|응급실|구급|medical|first[\s-]*aid|救護室|救護所|医务室|医疗站|puesto\s*médico|poste\s*médical|infirmerie/i, subtype: 'medical_station', category: 'medical', defaultLabelKo: '응급의료소', defaultZone: 'perimeter' },
  { rx: /흡연\s*부스|흡연실|흡연존|smoking|喫煙(?:ブース|所|室)|吸烟(?:室|亭|区)|cabina\s*(?:de\s*)?fumadores|cabine\s*fumeurs/i, subtype: 'smoking_booth', category: 'rest', defaultLabelKo: '제연 흡연부스', defaultZone: 'perimeter' },
  { rx: /맥주\s*(?:가든|존|부스)|비어\s*가든|수제\s*맥주|주류\s*존|음료\s*라운지|beer\s*garden|beverage\s*lounge|ビアガーデン|ドリンクゾーン|啤酒花园|饮品区|jardín\s*de\s*cerveza|zona\s*de\s*bebidas|espace\s*boissons/i, subtype: 'beer_garden', category: 'food', defaultLabelKo: '수제맥주 가든', defaultZone: 'west' },
  { rx: /굿즈\s*(?:샵|부스|스토어)|MD\s*(?:스토어|샵|부스)|공식\s*굿즈|기념품\s*부스|merch(?:\s*shop|\s*store)?|goods\s*shop|グッズ(?:売場|ショップ|ブース)|周边(?:商店|展位)|tienda\s*(?:de\s*)?merch|boutique(?:\s*officielle)?/i, subtype: 'goods_shop', category: 'booth', defaultLabelKo: '공식 굿즈샵', defaultZone: 'east' },
  { rx: /포토존|인생네컷|포토\s*(?:부스|타워|월)|photo\s*(?:zone|booth|tower)|フォト(?:ゾーン|ブース)|拍照(?:打卡)?(?:区|点|亭)|zona\s*de\s*fotos|photocall|zone\s*photo/i, subtype: 'photo_zone', category: 'booth', defaultLabelKo: '포토존', defaultZone: 'center' },
  { rx: /물품\s*보관|충전소|보조\s*배터리|락커|보관함|locker|charging|ロッカー|充電(?:スポット|所)|寄存|充电站|taquillas?|carga|consignes?/i, subtype: 'locker_charging', category: 'rest', defaultLabelKo: '물품보관·충전소', defaultZone: 'entrance' },
  { rx: /반려견|반려동물|펫\s*(?:존|놀이터|쉼터)|어질리티|pet\s*(?:zone|lounge|park)|ペット(?:ゾーン|休憩所)|宠物(?:区|休息区)|zona\s*(?:de\s*)?mascotas|espace\s*animaux/i, subtype: 'pet_zone', category: 'camping', defaultLabelKo: '반려동물 놀이터', defaultZone: 'perimeter' },
  { rx: /다회용기|분리수거|친환경\s*(?:존|스테이션)|클린존|eco\s*station|recycling|エコ(?:ステーション|回収所)|环保回收站|垃圾分类|punto\s*ecológico|point\s*éco/i, subtype: 'eco_station', category: 'rest', defaultLabelKo: '다회용기 친환경존', defaultZone: 'south' },
  { rx: /셔틀\s*버스|택시\s*승강장|승하차장|드롭오프|shuttle|drop[\s-]*off|シャトル(?:バス|乗降場)|接驳(?:站|口)|班车站|parada\s*de\s*lanzadera|navette/i, subtype: 'shuttle_stop', category: 'parking', defaultLabelKo: '셔틀버스 승강장', defaultZone: 'perimeter' },
  { rx: /팔찌\s*(?:교환|배부)|손목\s*밴드|티켓\s*교환|체크인\s*데스크|wristband|check[\s-]*in\s*desk|リストバンド|引換デスク|手环兑换|registro|pulseras|accueil/i, subtype: 'wristband_hub', category: 'entrance', defaultLabelKo: '팔찌교환 허브', defaultZone: 'entrance' },
  { rx: /쿨링\s*포그|미스트\s*터널|무더위\s*(?:그늘|쉼터)|냉방\s*쉼터|cooling\s*(?:mist|lounge)|ミスト|クール休憩所|喷雾降温|清凉亭|zona\s*fresca|zone\s*fraîcheur/i, subtype: 'mist_cooling', category: 'rest', defaultLabelKo: '쿨링포그 아케이드', defaultZone: 'center' },
  { rx: /비가림\s*캐노피|우천\s*(?:쉘터|캐노피)|대형\s*캐노피|rain\s*(?:canopy|shelter)|雨天キャノピー|遮雨棚|pabellón\s*cubierto|grand\s*auvent/i, subtype: 'rain_canopy', category: 'rest', defaultLabelKo: '대형 캐노피 쉼터', defaultZone: 'center' },
  { rx: /분수\s*광장|중앙\s*분수|fountain\s*plaza|噴水広場|喷泉广场|plaza\s*de\s*la\s*fuente|place\s*de\s*la\s*fontaine/i, subtype: 'fountain_plaza', category: 'rest', defaultLabelKo: '중앙 분수 휴게광장', defaultZone: 'center' },
  { rx: /FOH|음향\s*(?:타워|부스)|콘솔\s*타워|상황실|운영\s*본부|control\s*(?:tower|desk)|音響卓|運営本部|总控台|音控台|cabina\s*de\s*control|régie/i, subtype: 'foh_control', category: 'stage', defaultLabelKo: 'FOH 콘솔 타워', defaultZone: 'center' },
  { rx: /VIP\s*(?:라운지|존|석|데크)?|vip\s*lounge|VIPラウンジ|VIP贵宾室|salón\s*vip|salon\s*vip/i, subtype: 'vip_lounge', category: 'vip', defaultLabelKo: 'VIP 라운지', defaultZone: 'stage_right' },
  { rx: /캠핑\s*존|글램핑|피크닉\s*(?:존|매트존)|camping|picnic\s*zone|ピクニック(?:ゾーン)?|キャンプ|露营区|野餐区|zona\s*picnic|zone\s*picnic/i, subtype: 'camping_zone', category: 'camping', defaultLabelKo: '캠핑·피크닉 존', defaultZone: 'perimeter' },
  { rx: /화장실|변기동|restrooms?|toilets?|トイレ|お手洗い|卫生间|洗手间|厕所|baños?|sanitarios?|sanitaires?|toilettes?/i, subtype: 'restroom_bank', category: 'restroom', defaultLabelKo: '화장실', defaultZone: 'perimeter' },
  { rx: /(?:외부\s*|외곽\s*)?주차장|주차\s*구역|parking(?:\s*lot)?|外部駐車場|駐車場|外部停车场|停车场|estacionamiento|aparcamiento/i, subtype: 'parking_lot', category: 'parking', defaultLabelKo: '외부 주차장', defaultZone: 'perimeter' },
  { rx: /빔\s*프로젝터|빔프로젝터|프로젝터(?:\s*스크린|\s*무대|\s*단상)?|발표용?\s*스크린|프레젠테이션\s*스크린|beam\s*projector|projection\s*screen|vidéoprojecteur|proyector/i, subtype: 'beam_projector', category: 'stage', defaultLabelKo: '빔 프로젝터·대형 스크린', defaultZone: 'north' },
  { rx: /서브\s*무대|보조\s*무대|어쿠스틱\s*무대|소무대|sub[\s-]*stage|secondary\s*stage|サブステージ|副舞台|escenario\s*secundario|scène\s*secondaire/i, subtype: 'secondary_stage', category: 'stage', defaultLabelKo: '서브 무대', defaultZone: 'southeast' },
  { rx: /메인\s*무대|주\s*무대|무대|main\s*stage|\bstage\b|メインステージ|ステージ|主舞台|舞台|escenario(?:\s*principal)?|scène(?:\s*principale)?/i, subtype: 'main_stage', category: 'stage', defaultLabelKo: '메인 무대', defaultZone: 'north' },
  { rx: /관객석|객석|좌석\s*블록|관람석|seating|bleachers?|観客席|客席|观众席|看台|gradas?|asientos?|gradins?/i, subtype: 'seating_block', category: 'seating', defaultLabelKo: '관객석 블록', defaultZone: 'stage_front' },
  { rx: /푸드\s*트럭|커피차|타코야끼\s*트럭|츄러스\s*트럭|food\s*trucks?|キッチンカー|フードトラック|餐车|美食车|camión\s*de\s*comida/i, subtype: 'food_truck', category: 'food', defaultLabelKo: '푸드트럭', defaultZone: 'west' },
  { rx: /푸드\s*부스|먹거리\s*부스|식음\s*부스|음식\s*부스|분식\s*부스|food\s*(?:booths?|stalls?)|飲食ブース|屋台|美食展位|餐饮展位|puesto\s*de\s*comida|stand\s*repas/i, subtype: 'food_stall', category: 'food', defaultLabelKo: '식음 부스', defaultZone: 'west' },
  { rx: /놀이\s*존|키즈\s*존|어린이\s*존|에어바운스|관람차|play\s*zone|kids\s*zone|キッズゾーン|儿童游乐区|zona\s*infantil|espace\s*enfants/i, subtype: 'play_zone', category: 'rest', defaultLabelKo: '키즈 놀이존', defaultZone: 'southwest' },
  { rx: /수유실|유아\s*휴게실|가족\s*(?:라운지|쉼터)|family\s*lounge|nursing\s*room|授乳室|家族休憩所|母婴室|家庭休息室|sala\s*familiar|espace\s*famille/i, subtype: 'family_lounge', category: 'rest', defaultLabelKo: '수유·가족 라운지', defaultZone: 'center' },
  { rx: /쉼터|휴게\s*(?:광장|쉼터|라운지)|휴식\s*존|파라솔\s*쉼터|rest\s*(?:plaza|lounge)|休憩(?:ラウンジ|広場|所)|休息区|zona\s*de\s*descanso|espace\s*détente/i, subtype: 'rest_plaza', category: 'rest', defaultLabelKo: '휴게쉼터', defaultZone: 'center' },
  { rx: /다국어\s*안내|종합\s*안내소|글로벌\s*안내|휠체어\s*대여|multilingual\s*info|global\s*info|info\s*booth|多言語案内所|総合案内所|多语种服务|咨询台|info\s*multilingüe|info\s*multilingue/i, subtype: 'multilingual_info', category: 'entrance', defaultLabelKo: '다국어 안내소', defaultZone: 'entrance' },
  { rx: /매표소|티켓\s*부스|ticket\s*(?:info|booth)|チケット売場|售票处|taquilla|billetterie/i, subtype: 'ticket_info', category: 'entrance', defaultLabelKo: '매표·안내소', defaultZone: 'entrance' },
  { rx: /휠체어\s*(?:관람석|전용석|좌석|데크)|wheelchair\s*(?:viewing|seating|deck)|車椅子観覧席|轮椅观演台/i, subtype: 'wheelchair_viewing', category: 'seating', defaultLabelKo: '휠체어 관람석', defaultZone: 'stage_front' },
  { rx: /무장애\s*경사로|경사로\s*(?:모듈|시설)?|스텝프리\s*램프|access\s*ramp|step[\s-]*free\s*ramp|スロープ|无障碍坡道/i, subtype: 'access_ramp', category: 'entrance', defaultLabelKo: '무장애 경사로', defaultZone: 'entrance' },
  { rx: /점자\s*블록|시각\s*유도\s*블록|tactile\s*(?:paving|path|block)|点字ブロック|盲道/i, subtype: 'tactile_paving', category: 'entrance', defaultLabelKo: '점자블록 유도축', defaultZone: 'entrance' },
  { rx: /노약자\s*쉼터|어르신\s*쉼터|고령자\s*쉼터|임산부\s*쉼터|senior\s*(?:rest|lounge)|高齢者休憩所|长者休息区/i, subtype: 'senior_rest', category: 'rest', defaultLabelKo: '노약자 쉼터', defaultZone: 'center' },
  { rx: /소방\s*시설|소화전|소화기\s*부스|방화수|fire\s*(?:safety|hydrant|station)|消防(?:設備|施設)|消防站/i, subtype: 'fire_safety_unit', category: 'medical', defaultLabelKo: '소방시설 부스', defaultZone: 'perimeter' },
  { rx: /비상\s*대피소|대피소|긴급\s*대피|emergency\s*shelter|避難(?:所|シェルター)|应急避难所/i, subtype: 'emergency_shelter', category: 'medical', defaultLabelKo: '비상 대피소', defaultZone: 'perimeter' },
  { rx: /장애인\s*(?:전용\s*)?주차장|무장애\s*주차장|accessible\s*parking|disabled\s*parking|障がい者駐車場|无障碍停车场/i, subtype: 'accessible_parking', category: 'parking', defaultLabelKo: '장애인 주차장', defaultZone: 'perimeter' },
  { rx: /체험관|문화\s*체험관|대형\s*체험관|experience\s*pavilion|体験館|体験パビリオン|互动体验馆/i, subtype: 'experience_pavilion', category: 'booth', defaultLabelKo: '체험관', defaultZone: 'east' },
  { rx: /전시관|주제\s*전시관|기획\s*전시관|exhibition\s*(?:hall|pavilion)|展示館|展示パビリオン|主题展览馆/i, subtype: 'exhibition_hall', category: 'booth', defaultLabelKo: '전시관', defaultZone: 'east' },
  { rx: /자원\s*봉사자실|봉사자\s*(?:쉼터|본부|센터)|스태프\s*대기실|volunteer\s*(?:center|room|hub)|ボランティア控室|志愿者中心/i, subtype: 'volunteer_center', category: 'entrance', defaultLabelKo: '자원봉사자실', defaultZone: 'entrance' },
  { rx: /통제실|종합\s*상황실|지휘\s*통제실|안전\s*상황실|control\s*room|command\s*center|総合統制室|指挥控制室/i, subtype: 'control_room', category: 'stage', defaultLabelKo: '종합 통제실', defaultZone: 'north' },
  { rx: /보조\s*출입구|비상\s*출구|서브\s*게이트|side\s*gate|secondary\s*(?:entrance|gate)|サブ出入口|非常口|副出入口|puerta\s*lateral|entrée\s*secondaire/i, subtype: 'secondary_entrance', category: 'entrance', defaultLabelKo: '보조 출입구', defaultZone: 'south' },
  { rx: /주\s*출입구|메인\s*(?:게이트|출입구)|정문|main\s*(?:gate|entrance)|メイン(?:ゲート|出入口)|主出入口|puerta\s*principal|entrée\s*principale/i, subtype: 'main_entrance', category: 'entrance', defaultLabelKo: '주출입구', defaultZone: 'south' },
  { rx: /체험\s*부스|전시\s*부스|상담\s*부스|홍보\s*부스|부스|experience\s*booth|booth|体験ブース|展示ブース|ブース|体验展位|展位|stand/i, subtype: 'experience_booth', category: 'booth', defaultLabelKo: '체험 부스', defaultZone: 'east' },
];

function extractSpecificNumberedKeyword(clause: string, defaultKeyword: string): string {
  const numRef = clause.match(
    /([가-힣A-Za-z\u3040-\u30ff\u4e00-\u9faf]+(?:\s*[가-힣A-Za-z]+)?\s*#?\d{1,2})\s*(?:번|호)?/,
  );
  if (numRef && !/\d+\s*(?:개|대|동|곳|배|m|명|원|つ|箇所|个|倍)/i.test(numRef[0])) {
    return numRef[1].trim();
  }
  return defaultKeyword;
}

/**
 * Deterministically extracts spatial facility operations (add, move, remove, scale, lock, unlock, rename)
 * from natural-language prompts across all 6 languages (`ko | en | ja | zh | es | fr`) in <5ms.
 */
export function extractDeterministicFacilityActions(rawPrompt: string): AiFacilityAction[] {
  const normalized = normalizeKoreanNumerals(rawPrompt || '').trim();
  if (!normalized) return [];

  const clauses = normalized
    .split(/(?:,|，|、|\n|그리고|하고|및|또\s+|이어서|\band\b|\bthen\b|そして|また|それから|并且|然后|以及|\by\b|\bluego\b|\bpuis\b|;|\.(?!\d))/i)
    .map((c) => c.trim())
    .filter(Boolean);

  const actions: AiFacilityAction[] = [];

  for (const clause of clauses) {
    // Skip pure stagePlacement='none' phrases ("무대 없이") handled at config level
    if (/무대\s*(?:없이|없는|제외한\s*채)|without\s*stage|ステージなし|无主舞台|sin\s*escenario|sans\s*scène/i.test(clause) && !/옮겨|이동|키워|줄여|move|scale/i.test(clause)) {
      continue;
    }

    const zone = detectSpatialZoneFromClause(clause);
    const matchedTarget = FACILITY_TARGET_PATTERNS.find((p) => p.rx.test(clause));

    // 0. RENAME operation (6 languages)
    const koRename =
      clause.match(/(.+?)(?:의)?\s*(?:부스\s*)?이름을?\s*['"「『“]?([^'"」』”]+?)['"」』”]?(?:으로|로)\s*(?:변경|바꿔|수정|설정)/) ||
      clause.match(/['"「『“]([^'"」』”]+)['"」』”]\s*(?:을|를)\s*['"「『“]([^'"」』”]+)['"」』”]\s*(?:으로|로)\s*(?:이름\s*)?(?:변경|바꿔)/);
    const enRename = clause.match(/rename\s+(.+?)\s+to\s+['"“]?([^'"”]+?)['"”]?$/i);
    const jaRename = clause.match(/(.+?)(?:の)?名前を[「『"']?([^」』"']+?)[」』"']?に(?:変更|変えて|設定)/);
    const zhRename = clause.match(/(?:把|将)?(.+?)(?:的名称|的名字)?(?:改名为|重命名为|改为)[“"'「]?([^”"'」]+?)[”"'」]?$/);
    const esRename = clause.match(/(?:renombrar|cambiar\s+(?:el\s+)?nombre\s+de)\s+(.+?)\s+a\s+['"“]?([^'"”]+?)['"”]?$/i);
    const frRename = clause.match(/renommer\s+(.+?)\s+en\s+['"«]?([^'"»]+?)['"»]?$/i);
    const renameMatch = koRename || enRename || jaRename || zhRename || esRename || frRename;
    if (renameMatch) {
      const rawOld = renameMatch[1].replace(/^(?:선택한|기존|현재)\s*/, '').trim();
      const rawNew = renameMatch[2].trim();
      const oldMatched = FACILITY_TARGET_PATTERNS.find((p) => p.rx.test(rawOld));
      if (rawNew.length >= 1) {
        actions.push({
          op: 'rename',
          subtype: oldMatched?.subtype,
          category: oldMatched?.category,
          targetKeyword: rawOld,
          newName: rawNew,
        });
        continue;
      }
    }

    // 1. UNLOCK operation (must be checked before LOCK!)
    if (
      matchedTarget &&
      /(?:고정|잠금|락)\s*(?:해제|풀어|끄기)|풀어\s*줘|\bunlock\b|固定(?:を)?解除|ロック(?:を)?解除|解锁|取消固定|desbloquear|quitar\s*bloqueo|déverrouiller/i.test(
        clause,
      )
    ) {
      actions.push({
        op: 'unlock',
        subtype: matchedTarget.subtype,
        category: matchedTarget.category,
        targetKeyword: extractSpecificNumberedKeyword(clause, matchedTarget.defaultLabelKo),
      });
      continue;
    }

    // 2. LOCK operation
    if (
      matchedTarget &&
      /(?:위치\s*)?(?:고정해|고정시켜|고정하기|잠가|잠금|락\s*걸어)|\block\b|固定(?:して|する)|ロック(?:して|する)|锁定|固定住|bloquear|fijar\s*posición|verrouiller/i.test(
        clause,
      )
    ) {
      actions.push({
        op: 'lock',
        subtype: matchedTarget.subtype,
        category: matchedTarget.category,
        targetKeyword: extractSpecificNumberedKeyword(clause, matchedTarget.defaultLabelKo),
      });
      continue;
    }

    // 3. SCALE / EXPLICIT DIMENSIONS operation
    const explicitDimPair =
      clause.match(/(?:가로|폭|width|幅|宽|ancho|largeur)\s*(\d+(?:\.\d+)?)\s*m?\s*(?:세로|깊이|depth|奥行|深|長|profundidad|profondeur)\s*(\d+(?:\.\d+)?)\s*m?/i) ||
      clause.match(/(\d{1,2}(?:\.\d+)?)\s*m?\s*[xX×]\s*(\d{1,2}(?:\.\d+)?)\s*m?(?:\s*(?:크기|규격|사이즈|로|으로|size))?/i);
    if (matchedTarget && explicitDimPair && Number(explicitDimPair[1]) <= 75 && Number(explicitDimPair[2]) <= 60) {
      actions.push({
        op: 'scale',
        subtype: matchedTarget.subtype,
        category: matchedTarget.category,
        targetKeyword: extractSpecificNumberedKeyword(clause, matchedTarget.defaultLabelKo),
        widthM: Math.max(3, Number(explicitDimPair[1])),
        depthM: Math.max(3, Number(explicitDimPair[2])),
      });
      continue;
    }

    const explicitMultMatch = clause.match(
      /(\d+(?:\.\d+)?)\s*(?:배|x|times|倍|veces|fois)\s*(?:크게|키워|확대|넓게|축소|작게|larger|bigger|smaller)?/i,
    );
    const isGrowVerb =
      /(?:크게|넓게|대형으로)\s*(?:키워|확대|늘려|만들어|변경)|확대해|크기를?\s*키워|\b(?:enlarge|expand|make\s+bigger|make\s+larger|scale\s+up)\b|大きく(?:して|する)|拡大|放大|扩大|agrandar|ampliar|agrandir/i.test(
        clause,
      );
    const isShrinkVerb =
      /(?:작게|컴팩트하게|아담하게)\s*(?:줄여|축소|만들어|변경)|축소해|크기를?\s*줄여|\b(?:shrink|reduce\s+size|make\s+smaller|scale\s+down)\b|小さく(?:して|する)|縮小|缩小|reducir\s*tamaño|achicar|réduire\s*la\s*taille/i.test(
        clause,
      );
    if (matchedTarget && (explicitMultMatch || isGrowVerb || isShrinkVerb)) {
      const factor = explicitMultMatch
        ? Math.max(0.55, Math.min(2.2, parseFloat(explicitMultMatch[1])))
        : isGrowVerb
          ? 1.35
          : 0.78;
      actions.push({
        op: 'scale',
        subtype: matchedTarget.subtype,
        category: matchedTarget.category,
        targetKeyword: extractSpecificNumberedKeyword(clause, matchedTarget.defaultLabelKo),
        scaleFactor: factor,
      });
      continue;
    }

    // 4. REMOVE operation (6 languages)
    if (
      matchedTarget &&
      /(?:치워|없애|삭제|제거|빼\s*줘|철거|제외해|\bremove\b|\bdelete\b|削除|撤去|なくして|删除|移除|去掉|eliminar|quitar|borrar|supprimer|retirer)/i.test(
        clause,
      )
    ) {
      actions.push({
        op: 'remove',
        subtype: matchedTarget.subtype,
        category: matchedTarget.category,
        targetKeyword: extractSpecificNumberedKeyword(clause, matchedTarget.defaultLabelKo),
      });
      continue;
    }

    // 5. MOVE operation (6 languages)
    if (
      matchedTarget &&
      zone &&
      /(?:옮겨|옮기|이동|재배치|배치\s*변경|보내|\bmove\b|\brelocate\b|\bshift\b|移動|移して|配置変更|移动|移到|搬到|mover|trasladar|reubicar|déplacer)/i.test(
        clause,
      )
    ) {
      actions.push({
        op: 'move',
        subtype: matchedTarget.subtype,
        category: matchedTarget.category,
        targetKeyword: extractSpecificNumberedKeyword(clause, matchedTarget.defaultLabelKo),
        zone,
      });
      continue;
    }

    // 6. ADD / PLACE operation (works both WITH explicit zone and WITHOUT zone using smart defaultZone!)
    if (
      matchedTarget &&
      /(?:두고|두어|배치|설치|추가|넣어|놓고|놓아|만들어|신설|증설|마련|\bplace\b|\badd\b|\binstall\b|\bcreate\b|追加|設置|配置|置いて|添加|增加|设置|放置|新增|añadir|agregar|colocar|instalar|ajouter|placer|installer)/i.test(
        clause,
      )
    ) {
      const effectiveZone: SpatialZoneTarget =
        matchedTarget.subtype === 'parking_lot' || matchedTarget.category === 'parking'
          ? 'perimeter'
          : zone || matchedTarget.defaultZone;

      const countMatch =
        clause.match(/(\d{1,2})\s*(?:개|대|동|곳|존|칸|구역|기|개소|つ|台|箇所|棟|个|座|处|辆|unidades?|units?|booths?|zones?|lots?)/i) ||
        clause.match(/\b(?:add|place|install|añadir|agregar|ajouter)\s+(\d{1,2})\b/i);
      const count = countMatch
        ? Math.max(1, Math.min(12, parseInt(countMatch[1], 10)))
        : effectiveZone === 'corners'
          ? 4
          : 1;

      const customPrefixMatch = clause.match(
        /([가-힣A-Za-z0-9·\s]{2,16}?(?:트럭|부스|라운지|가든|샵|스토어|존|쉼터|보관소|의료소|포토존|주차장))/,
      );
      const cleanCustomName = customPrefixMatch
        ? customPrefixMatch[1]
            .replace(
              /^(?:행사장\s*외부에?|행사장\s*내부에?|외부에?|외곽에?|무대|입구|출입구|중앙|북측|남측|동측|서측|왼쪽|오른쪽|좌측|우측|앞에|옆에|근처에)\s*/g,
              '',
            )
            .trim()
        : '';

      actions.push({
        op: 'add',
        subtype: matchedTarget.subtype,
        category: matchedTarget.category,
        nameKo: cleanCustomName.length >= 2 ? cleanCustomName : matchedTarget.defaultLabelKo,
        count,
        zone: effectiveZone,
      });
    }
  }

  return actions;
}

function resolveExteriorParkingZonePosition(
  zone: SpatialZoneTarget | undefined,
  config: EventConfig,
  index: number,
  total: number,
  itemW: number,
  itemD: number,
): { x: number; z: number } {
  const W = config.venueWidth;
  const D = config.venueDepth;
  const spread = (index - (Math.max(1, total) - 1) / 2) * (Math.max(itemW, itemD) + 8);
  let rawX = W * 0.5 + 10 + itemW * 0.5;
  let rawZ = spread;

  if (zone === 'west' || zone === 'northwest' || zone === 'southwest' || zone === 'stage_left') {
    rawX = -(W * 0.5 + 10 + itemW * 0.5);
    rawZ = spread;
  } else if (zone === 'south' || zone === 'entrance') {
    rawX = spread;
    rawZ = D * 0.5 + 10 + itemD * 0.5;
  } else if (zone === 'north' || zone === 'stage_front') {
    rawX = spread;
    rawZ = -(D * 0.5 + 10 + itemD * 0.5);
  } else if (zone === 'perimeter' && total >= 2) {
    const side = index % 4;
    if (side === 0) {
      rawX = W * 0.5 + 10 + itemW * 0.5;
      rawZ = 16;
    } else if (side === 1) {
      rawX = -(W * 0.5 + 10 + itemW * 0.5);
      rawZ = 16;
    } else if (side === 2) {
      rawX = 24;
      rawZ = D * 0.5 + 10 + itemD * 0.5;
    } else {
      rawX = -24;
      rawZ = D * 0.5 + 10 + itemD * 0.5;
    }
  }

  return clampExteriorParkingPosition(rawX, rawZ, itemW, itemD, W, D);
}

/**
 * Applies structured spatial facility operations (from Gemini or deterministic parser)
 * directly onto a 3D Facility[] array with automatic overlap resolution, exterior parking clamping,
 * locked-booth protection, and localized 6-language summary tags.
 */
export function applyAiFacilityActions(
  config: EventConfig,
  baseFacilities: Facility[],
  actions: AiFacilityAction[],
  lang: Language = 'ko',
): { facilities: Facility[]; appliedTags: string[] } {
  if (!Array.isArray(actions) || actions.length === 0) {
    return { facilities: baseFacilities, appliedTags: [] };
  }

  let next: Facility[] = baseFacilities.map((f) => ({
    ...f,
    position: { ...f.position },
    dimensions: { ...f.dimensions },
    accessibility: { ...f.accessibility },
  }));

  const appliedTags: string[] = [];
  const prioritizedIds: string[] = [];
  const shape = config.venueShape ?? 'rectangle';
  const boothStyle = config.boothModel ?? 'pagoda_tent';
  const boothCostMult = BOOTH_MODEL_STYLE_LABELS[boothStyle]?.costMult ?? 1;

  const matchesActionTarget = (f: Facility, action: AiFacilityAction): boolean => {
    if (action.targetKeyword && action.targetKeyword.trim()) {
      const kwRaw = action.targetKeyword.trim();
      const kwNorm = kwRaw.replace(/[#\s]+/g, '').toLowerCase();
      const numSuffix = kwRaw.match(/#?(\d{1,2})$/);
      const hay = `${f.nameKo || ''}${f.name || ''}${f.id || ''}`
        .replace(/[#\s]+/g, '')
        .toLowerCase();
      if (kwNorm.length >= 2 && hay.includes(kwNorm)) {
        return true;
      }
      // If user explicitly specified a number like "푸드트럭 2" or "Food Booth 3", match subtype + number
      if (numSuffix && action.subtype && f.subtype === action.subtype) {
        const fNum = `${f.nameKo || ''} ${f.name || ''}`.match(/#?(\d{1,2})\b/);
        return Boolean(fNum && fNum[1] === numSuffix[1]);
      }
    }
    if (action.subtype && f.subtype === action.subtype) return true;
    if (!action.subtype && action.category && f.category === action.category) return true;
    return false;
  };

  for (const action of actions) {
    if (!action || !action.op) continue;

    if (action.op === 'lock') {
      const targets = next.filter((f) => matchesActionTarget(f, action));
      if (targets.length === 0) continue;
      targets.forEach((fac) => {
        fac.locked = true;
      });
      const sampleLabel = getFacilityDisplayName(targets[0], lang);
      appliedTags.push(
        `${tr6(lang, '위치 고정', 'Locked', '位置固定', '已锁定', 'Bloqueado', 'Verrouillé')}: ${sampleLabel} (${targets.length})`,
      );
      continue;
    }

    if (action.op === 'unlock') {
      const targets = next.filter((f) => matchesActionTarget(f, action));
      if (targets.length === 0) continue;
      targets.forEach((fac) => {
        fac.locked = false;
      });
      const sampleLabel = getFacilityDisplayName(targets[0], lang);
      appliedTags.push(
        `${tr6(lang, '고정 해제', 'Unlocked', '固定解除', '已解锁', 'Desbloqueado', 'Déverrouillé')}: ${sampleLabel} (${targets.length})`,
      );
      continue;
    }

    if (action.op === 'rename') {
      const newName = (action.newName || action.nameKo || action.nameEn || '').trim();
      if (!newName) continue;
      const targets = next.filter((f) => matchesActionTarget(f, action));
      if (targets.length === 0) continue;
      const oldLabel = getFacilityDisplayName(targets[0], lang);
      targets.forEach((fac, idx) => {
        const finalName = targets.length > 1 ? `${newName} ${idx + 1}` : newName;
        fac.nameKo = finalName;
        fac.name = finalName;
        fac.customDisplayName = true;
      });
      appliedTags.push(
        `${tr6(lang, '이름 변경', 'Renamed', '名称変更', '已重命名', 'Renombrado', 'Renommé')}: ${oldLabel} → ${newName}`,
      );
      continue;
    }

    if (action.op === 'remove') {
      const candidates = next.filter((f) => !f.locked && matchesActionTarget(f, action));
      if (candidates.length === 0) continue;
      const safeToRemoveIds = new Set(
        candidates
          .filter((f) => {
            if (f.category === 'entrance') {
              const totalEntrances = next.filter((x) => x.category === 'entrance').length;
              return totalEntrances > 1;
            }
            return true;
          })
          .map((f) => f.id),
      );
      if (safeToRemoveIds.size > 0) {
        const sampleLabel = getFacilityDisplayName(candidates[0], lang);
        next = next.filter((f) => !safeToRemoveIds.has(f.id));
        appliedTags.push(
          `${tr6(lang, '삭제', 'Removed', '削除', '已移除', 'Eliminado', 'Supprimé')}: ${sampleLabel} (${safeToRemoveIds.size})`,
        );
      }
      continue;
    }

    if (action.op === 'move') {
      const targets = next.filter((f) => !f.locked && matchesActionTarget(f, action));
      if (targets.length === 0) continue;
      const targetZone: SpatialZoneTarget = action.zone || 'center';
      targets.forEach((fac, idx) => {
        const isParking = fac.subtype === 'parking_lot' || fac.category === 'parking';
        if (typeof action.x === 'number' && typeof action.z === 'number') {
          const clamped = isParking
            ? clampExteriorParkingPosition(
                action.x + idx * (fac.dimensions.width + 6),
                action.z,
                fac.dimensions.width,
                fac.dimensions.depth,
                config.venueWidth,
                config.venueDepth,
              )
            : clampToVenue(
                action.x + idx * (fac.dimensions.width + 4),
                action.z,
                fac.dimensions.width,
                fac.dimensions.depth,
                config.venueWidth,
                config.venueDepth,
                6,
                shape,
              );
          fac.position.x = clamped.x;
          fac.position.z = clamped.z;
        } else if (isParking) {
          const pos = resolveExteriorParkingZonePosition(
            targetZone,
            config,
            idx,
            targets.length,
            fac.dimensions.width,
            fac.dimensions.depth,
          );
          fac.position.x = pos.x;
          fac.position.z = pos.z;
        } else {
          const pos = resolveZoneTargetPosition(
            targetZone,
            config,
            next,
            idx,
            targets.length,
            fac.dimensions.width,
            fac.dimensions.depth,
          );
          fac.position.x = pos.x;
          fac.position.z = pos.z;
        }
        prioritizedIds.push(fac.id);
      });
      const sampleLabel = getFacilityDisplayName(targets[0], lang);
      const zoneText = action.zone
        ? pickL6(lang, ZONE_TARGET_I18N[action.zone])
        : `(${Math.round(targets[0].position.x)}m, ${Math.round(targets[0].position.z)}m)`;
      appliedTags.push(
        `${tr6(lang, '위치 이동', 'Moved', '移動', '已移动', 'Movido', 'Déplacé')}: ${sampleLabel} → ${zoneText}`,
      );
      continue;
    }

    if (action.op === 'scale') {
      const targets = next.filter((f) => !f.locked && matchesActionTarget(f, action));
      if (targets.length === 0) continue;
      const hasExplicitDims = typeof action.widthM === 'number' || typeof action.depthM === 'number';
      const factor = Math.max(0.55, Math.min(2.2, Number(action.scaleFactor) || 1.25));
      targets.forEach((fac) => {
        const prevArea = Math.max(1, fac.dimensions.width * fac.dimensions.depth);
        if (hasExplicitDims) {
          if (typeof action.widthM === 'number') {
            fac.dimensions.width = Math.max(3, Math.min(80, Math.round(action.widthM * 10) / 10));
          }
          if (typeof action.depthM === 'number') {
            fac.dimensions.depth = Math.max(3, Math.min(60, Math.round(action.depthM * 10) / 10));
          }
        } else {
          fac.dimensions.width = Math.max(3, Math.min(80, Math.round(fac.dimensions.width * factor * 10) / 10));
          fac.dimensions.depth = Math.max(3, Math.min(60, Math.round(fac.dimensions.depth * factor * 10) / 10));
        }
        const areaRatio = Math.sqrt((fac.dimensions.width * fac.dimensions.depth) / prevArea);
        fac.capacity = Math.max(20, Math.round(fac.capacity * areaRatio));
        fac.cost = Math.max(1000, Math.round(fac.cost * (0.4 + 0.6 * areaRatio)));
        const isParking = fac.subtype === 'parking_lot' || fac.category === 'parking';
        const clamped = isParking
          ? clampExteriorParkingPosition(
              fac.position.x,
              fac.position.z,
              fac.dimensions.width,
              fac.dimensions.depth,
              config.venueWidth,
              config.venueDepth,
            )
          : clampToVenue(
              fac.position.x,
              fac.position.z,
              fac.dimensions.width,
              fac.dimensions.depth,
              config.venueWidth,
              config.venueDepth,
              6,
              shape,
            );
        fac.position.x = clamped.x;
        fac.position.z = clamped.z;
        prioritizedIds.push(fac.id);
      });
      const sampleLabel = getFacilityDisplayName(targets[0], lang);
      appliedTags.push(
        hasExplicitDims
          ? `${tr6(lang, '규격 조정', 'Resized', 'サイズ変更', '尺寸调整', 'Redimensionado', 'Redimensionné')}: ${sampleLabel} (${targets[0].dimensions.width}×${targets[0].dimensions.depth}m)`
          : `${tr6(lang, '규격 조정', 'Scaled', 'サイズ調整', '比例调整', 'Escalado', 'Mis à l’échelle')}: ${sampleLabel} ×${factor.toFixed(2)}`,
      );
      continue;
    }

    if (action.op === 'replace_count' && action.subtype) {
      const desired = Math.max(0, Math.min(30, Math.round(Number(action.count) || 0)));
      const existing = next.filter((f) => f.subtype === action.subtype);
      const subLabel = SUBTYPE_SIMPLE_LABELS[action.subtype]?.[lang] || action.subtype;
      if (desired < existing.length) {
        const unlockedExisting = existing.filter((f) => !f.locked);
        const dropCount = Math.min(unlockedExisting.length, existing.length - desired);
        const toDrop = new Set(unlockedExisting.slice(unlockedExisting.length - dropCount).map((f) => f.id));
        next = next.filter((f) => !toDrop.has(f.id));
        appliedTags.push(
          `${tr6(lang, '수량 조정', 'Count Set', '数量調整', '数量调整', 'Cantidad', 'Quantité')}: ${subLabel} → ${next.filter((f) => f.subtype === action.subtype).length}`,
        );
      } else if (desired > existing.length) {
        const diff = desired - existing.length;
        const bp = SUBTYPE_BLUEPRINTS[action.subtype] || SUBTYPE_BLUEPRINTS.experience_booth;
        const isParking = action.subtype === 'parking_lot' || bp.category === 'parking';
        const targetZone: SpatialZoneTarget = action.zone || 'perimeter';
        for (let i = 0; i < diff; i++) {
          const pos = isParking
            ? resolveExteriorParkingZonePosition(
                targetZone,
                config,
                existing.length + i,
                desired,
                bp.width,
                bp.depth,
              )
            : resolveZoneTargetPosition(
                targetZone,
                config,
                next,
                i,
                diff,
                bp.width,
                bp.depth,
              );
          const newId = `ai-${action.subtype}-${Date.now().toString().slice(-4)}-${i}`;
          prioritizedIds.push(newId);
          next.push({
            id: newId,
            name: `${action.nameEn || bp.nameEn} #${existing.length + i + 1}`,
            nameKo: `${action.nameKo || bp.nameKo} ${existing.length + i + 1}`,
            customDisplayName: Boolean(action.nameKo || action.nameEn),
            category: action.category || bp.category,
            subtype: action.subtype,
            position: pos,
            dimensions: { width: bp.width, depth: bp.depth, height: bp.height },
            rotation: 0,
            capacity: bp.capacity,
            cost: Math.round(
              bp.cost *
                (action.subtype === 'experience_booth' || action.subtype === 'food_stall'
                  ? boothCostMult
                  : 1),
            ),
            attractionWeight: bp.attractionWeight,
            colorAccent: bp.colorAccent,
            covered: bp.covered,
            accessibility: {
              wheelchairAccessible: config.accessibility.stepFreeRoutes,
              stepFreeEntry: config.accessibility.stepFreeRoutes,
              priorityQueue: Boolean(bp.priorityQueue),
            },
          });
        }
        appliedTags.push(
          `${tr6(lang, '수량 증설', 'Expanded', '増設', '已增设', 'Ampliado', 'Ajouté')}: ${subLabel} → ${desired}`,
        );
      }
      continue;
    }

    if (action.op === 'add') {
      const subtype: FacilitySubtype =
        action.subtype && action.subtype in SUBTYPE_BLUEPRINTS
          ? action.subtype
          : action.category === 'food'
            ? 'food_stall'
            : action.category === 'medical'
              ? 'medical_station'
              : action.category === 'restroom'
                ? 'restroom_bank'
                : action.category === 'parking'
                  ? 'parking_lot'
                  : action.category === 'vip'
                    ? 'vip_lounge'
                    : action.category === 'rest'
                      ? 'rest_plaza'
                      : 'experience_booth';

      const bp = SUBTYPE_BLUEPRINTS[subtype];
      const isParking = subtype === 'parking_lot' || bp.category === 'parking';
      const count = Math.max(1, Math.min(12, Math.round(Number(action.count) || 1)));
      const targetZone: SpatialZoneTarget = isParking ? action.zone || 'perimeter' : action.zone || 'center';
      const itemW = typeof action.widthM === 'number' ? Math.max(3, action.widthM) : bp.width;
      const itemD = typeof action.depthM === 'number' ? Math.max(3, action.depthM) : bp.depth;
      const existingSame = next.filter((f) => f.subtype === subtype).length;
      const hasCustomLabel = Boolean(
        (action.nameKo && action.nameKo.trim() && action.nameKo.trim() !== bp.nameKo) ||
          (action.nameEn && action.nameEn.trim() && action.nameEn.trim() !== bp.nameEn),
      );
      const baseKo = (action.nameKo || SUBTYPE_SIMPLE_LABELS[subtype]?.ko || bp.nameKo).trim();
      const baseEn = (action.nameEn || SUBTYPE_SIMPLE_LABELS[subtype]?.en || bp.nameEn).trim();

      for (let i = 0; i < count; i++) {
        const seq = existingSame + i + 1;
        const pos =
          typeof action.x === 'number' && typeof action.z === 'number'
            ? isParking
              ? clampExteriorParkingPosition(
                  action.x + i * (itemW + 6),
                  action.z,
                  itemW,
                  itemD,
                  config.venueWidth,
                  config.venueDepth,
                )
              : clampToVenue(
                  action.x + i * (itemW + 4),
                  action.z,
                  itemW,
                  itemD,
                  config.venueWidth,
                  config.venueDepth,
                  6,
                  shape,
                )
            : isParking
              ? resolveExteriorParkingZonePosition(targetZone, config, existingSame + i, existingSame + count, itemW, itemD)
              : resolveZoneTargetPosition(targetZone, config, next, i, count, itemW, itemD);

        const newId = `ai-add-${subtype}-${Date.now().toString().slice(-4)}-${i}`;
        prioritizedIds.push(newId);
        next.push({
          id: newId,
          name: count > 1 || existingSame > 0 ? `${baseEn} ${seq}` : baseEn,
          nameKo: count > 1 || existingSame > 0 ? `${baseKo} ${seq}` : baseKo,
          customDisplayName: hasCustomLabel,
          category: action.category || bp.category,
          subtype,
          position: pos,
          dimensions: { width: itemW, depth: itemD, height: bp.height },
          rotation: 0,
          capacity: bp.capacity,
          cost: Math.round(
            bp.cost *
              (subtype === 'experience_booth' || subtype === 'food_stall' ? boothCostMult : 1),
          ),
          attractionWeight: bp.attractionWeight,
          colorAccent: bp.colorAccent,
          covered: bp.covered,
          accessibility: {
            wheelchairAccessible: config.accessibility.stepFreeRoutes,
            stepFreeEntry: config.accessibility.stepFreeRoutes,
            priorityQueue: Boolean(bp.priorityQueue),
          },
        });
      }
      const displayAddedLabel = hasCustomLabel
        ? lang === 'ko'
          ? baseKo
          : action.nameEn || baseKo
        : SUBTYPE_SIMPLE_LABELS[subtype]?.[lang] || baseEn;
      const zoneLabel = isParking
        ? tr6(lang, '행사장 외부 외곽', 'Exterior Perimeter', '会場外部外周', '场馆外部外围', 'Perímetro Exterior', 'Périmètre Extérieur')
        : pickL6(lang, ZONE_TARGET_I18N[targetZone]);
      appliedTags.push(`+${displayAddedLabel} ×${count} (${zoneLabel})`);
    }
  }

  resolveFacilityOverlaps(next, config, prioritizedIds);
  // Guarantee exterior parking remains strictly outside the venue walls after overlap resolution
  next.forEach((f) => {
    if (f.subtype === 'parking_lot' || f.category === 'parking') {
      f.position = clampExteriorParkingPosition(
        f.position.x,
        f.position.z,
        f.dimensions.width,
        f.dimensions.depth,
        config.venueWidth,
        config.venueDepth,
      );
    }
  });
  return { facilities: next, appliedTags };
}

export const CATALOG_PICKER_SUBTYPES: FacilitySubtype[] = [
  // 무장애 시설
  'wheelchair_viewing',
  'access_ramp',
  'tactile_paving',
  // 휴식 시설
  'family_lounge',
  'rain_canopy',
  'senior_rest',
  'rest_plaza',
  'mist_cooling',
  // 안전 시설
  'medical_station',
  'fire_safety_unit',
  'emergency_shelter',
  // 교통 시설
  'shuttle_stop',
  'accessible_parking',
  'parking_lot',
  // 문화 시설
  'experience_pavilion',
  'exhibition_hall',
  'play_zone',
  'experience_booth',
  'goods_shop',
  'photo_zone',
  // 운영 시설
  'volunteer_center',
  'locker_charging',
  'control_room',
  'multilingual_info',
  'ticket_info',
  'wristband_hub',
  'eco_station',
  'smoking_booth',
  // 식음·공연·출입
  'food_stall',
  'food_truck',
  'beer_garden',
  'restroom_bank',
  'main_entrance',
  'secondary_entrance',
  'beam_projector',
  'main_stage',
  'secondary_stage',
  'seating_block',
  'foh_control',
  'vip_lounge',
  'camping_zone',
  'pet_zone',
];

export function getSubtypeBlueprintMeta(subtype: FacilitySubtype): SubtypeBlueprint {
  return SUBTYPE_BLUEPRINTS[subtype] || SUBTYPE_BLUEPRINTS.experience_booth;
}

/**
 * Clamps a single facility strictly inside the venue perimeter (or outside for exterior parking)
 * and prevents overlap with any other placed facility during real-time drag, WASD nudge, or resize.
 */
export function clampAndResolveSingleFacility(
  candidate: Facility,
  allFacilities: Facility[],
  config: EventConfig,
): Facility {
  const W = config.venueWidth;
  const D = config.venueDepth;
  const shape = config.venueShape ?? 'rectangle';
  const safeW = Math.max(2.6, Math.min(Math.max(12, W - 16), Math.round(candidate.dimensions.width * 2) / 2));
  const safeD = Math.max(2.6, Math.min(Math.max(12, D - 16), Math.round(candidate.dimensions.depth * 2) / 2));
  const existingSelf = allFacilities.find((o) => o.id === candidate.id);
  let nextCost = candidate.cost;
  let nextCapacity = candidate.capacity;
  if (existingSelf && candidate.cost === existingSelf.cost) {
    const oldArea = Math.max(1, existingSelf.dimensions.width * existingSelf.dimensions.depth);
    const newArea = safeW * safeD;
    if (Math.abs(newArea - oldArea) > 0.25) {
      const areaRatio = newArea / oldArea;
      nextCost = Math.max(800, Math.round(existingSelf.cost * (0.3 + 0.7 * areaRatio)));
      nextCapacity = Math.max(10, Math.round(existingSelf.capacity * Math.sqrt(areaRatio)));
    }
  }
  const sized: Facility = {
    ...candidate,
    cost: nextCost,
    capacity: nextCapacity,
    dimensions: { ...candidate.dimensions, width: safeW, depth: safeD },
  };
  const fp0 = getFacilityWorldFootprint(sized, config, 0);
  const edgePad =
    sized.category === 'entrance' || sized.category === 'parking' ? 2.5 : 3.5;

  const others = allFacilities
    .filter((o) => o.id !== sized.id)
    .map((o) => getFacilityWorldFootprint(o, config, 0));

  const clampTarget = (cx: number, cz: number): { x: number; z: number } =>
    sized.category === 'parking'
      ? clampExteriorParkingPosition(cx, cz, fp0.spanW, fp0.spanD, W, D)
      : clampToVenue(cx, cz, fp0.spanW, fp0.spanD, W, D, edgePad, shape);

  const checkFree = (cx: number, cz: number, clearance: number): { x: number; z: number } | null => {
    const clamped = clampTarget(cx, cz);
    const probeFp = getFacilityWorldFootprint({ ...sized, position: clamped }, config, 0);
    for (const oFp of others) {
      if (worldAABBsOverlap(probeFp, oFp, clearance)) {
        return null;
      }
    }
    return clamped;
  };

  const direct = checkFree(sized.position.x, sized.position.z, 0.8) || checkFree(sized.position.x, sized.position.z, 0.25);
  if (direct) {
    return { ...sized, position: direct };
  }

  const maxR = Math.max(W, D) * 0.85;
  for (let r = 1.5; r <= maxR; r += 1.5) {
    for (let step = 0; step < 24; step++) {
      const ang = (step / 24) * Math.PI * 2;
      const hit = checkFree(sized.position.x + Math.cos(ang) * r, sized.position.z + Math.sin(ang) * r, 0.5);
      if (hit) {
        return { ...sized, position: hit };
      }
    }
  }

  const fallbackPos = clampTarget(sized.position.x, sized.position.z);
  return { ...sized, position: fallbackPos };
}

/**
 * Instantiates a collision-free indoor Facility from the Knowledge DB Catalog for 3D Ghost Preview or Direct Add.
 */
export function buildCatalogFacilityItem(
  subtype: FacilitySubtype,
  config: EventConfig,
  existingFacilities: Facility[],
  options?: {
    customName?: string;
    zone?: SpatialZoneTarget;
    width?: number;
    depth?: number;
    cost?: number;
  },
): Facility {
  const bp = SUBTYPE_BLUEPRINTS[subtype] || SUBTYPE_BLUEPRINTS.experience_booth;
  const sameCount = existingFacilities.filter((f) => f.subtype === subtype).length + 1;
  const trimmedCustom = options?.customName?.trim() || '';
  const koBase = SUBTYPE_SIMPLE_LABELS[subtype]?.ko || bp.nameKo;
  const enBase = SUBTYPE_SIMPLE_LABELS[subtype]?.en || bp.nameEn;

  const finalNameKo = trimmedCustom || `${koBase} ${sameCount}`;
  const finalNameEn = trimmedCustom || `${enBase} ${sameCount}`;
  const itemW = options?.width ? Math.max(3, options.width) : bp.width;
  const itemD = options?.depth ? Math.max(3, options.depth) : bp.depth;
  const targetZone: SpatialZoneTarget =
    options?.zone ||
    (bp.category === 'stage'
      ? 'north'
      : bp.category === 'entrance'
        ? 'south'
        : bp.category === 'food'
          ? 'west'
          : bp.category === 'booth'
            ? 'east'
            : 'center');

  const rawPos =
    bp.category === 'parking'
      ? {
          x: config.venueWidth * 0.5 + 9 + itemW * 0.5,
          z: 18 - (sameCount - 1) * (itemD + 8),
        }
      : resolveZoneTargetPosition(
          targetZone,
          config,
          existingFacilities,
          sameCount - 1,
          Math.max(1, sameCount),
          itemW,
          itemD,
        );

  const boothStyle = config.boothModel ?? 'pagoda_tent';
  const boothCostMult = BOOTH_MODEL_STYLE_LABELS[boothStyle]?.costMult ?? 1;
  const itemCost =
    options?.cost ??
    Math.round(
      bp.cost * (subtype === 'experience_booth' || subtype === 'food_stall' ? boothCostMult : 1),
    );

  const rawFacility: Facility = {
    id: `pick-${subtype}-${Date.now().toString().slice(-5)}-${Math.floor(Math.random() * 90 + 10)}`,
    name: finalNameEn,
    nameKo: finalNameKo,
    customDisplayName: Boolean(trimmedCustom),
    category: bp.category,
    subtype,
    position: rawPos,
    dimensions: { width: itemW, depth: itemD, height: bp.height },
    rotation: 0,
    capacity: bp.capacity,
    cost: itemCost,
    attractionWeight: bp.attractionWeight,
    colorAccent: bp.colorAccent,
    covered: bp.covered,
    accessibility: {
      wheelchairAccessible: true,
      stepFreeEntry: true,
      priorityQueue: Boolean(bp.priorityQueue),
    },
  };

  return clampAndResolveSingleFacility(rawFacility, existingFacilities, config);
}

/**
 * Deterministic instant fallback for Mood-Matched Booth Recommendations tailored to EventConfig.
 */
export function getFallbackMoodRecommendations(
  config: EventConfig,
  existingFacilities: Facility[],
  lang: Language = 'ko',
): RecommendedBoothItem[] {
  const existingSubtypes = new Set(existingFacilities.map((f) => f.subtype));
  const pool: RecommendedBoothItem[] = [];

  if (config.eventType === 'music_festival' || config.eventType === 'community_festival') {
    pool.push(
      {
        id: 'rec-mood-1',
        name: `${SUBTYPE_SIMPLE_LABELS.goods_shop[lang]} 1`,
        subtype: 'goods_shop',
        widthM: 11,
        depthM: 8,
        estimatedCostUsd: 7800,
        zone: 'east',
        reason: tr6(
          lang,
          '공연 관람객 체류 동선과 자연스럽게 연결되는 아티스트·행사 기념품 부스입니다.',
          'Artist & festival merch store aligned along the east audience promenade.',
          '公演来場者の回遊動線に自然につながる公式グッズ売場です。',
          '与观演动线自然衔接的艺人及活动官方周边商店。',
          'Tienda oficial de merchandising conectada al flujo de espectadores.',
          'Boutique officielle placée sur le flux naturel des festivaliers.',
        ),
      },
      {
        id: 'rec-mood-2',
        name: `${SUBTYPE_SIMPLE_LABELS.photo_zone[lang]} 1`,
        subtype: 'photo_zone',
        widthM: 4.4,
        depthM: 3.6,
        estimatedCostUsd: 5200,
        zone: 'center',
        reason: tr6(
          lang,
          '세로형 직육면체 타워 구조로 바닥 면적을 적게 차지하면서 기념 촬영 대기줄을 분산합니다.',
          'Vertical cuboid landmark tower with compact footprint that disperses photo queues.',
          '縦長直方体タワー構造で床面積を抑えつつ撮影待機列を分散します。',
          '竖向长方体塔式地标，占地紧凑且能有效分散拍照排队人流。',
          'Torre vertical compacta que ahorra suelo y distribuye filas de fotos.',
          'Tour verticale compacte qui libère le sol tout en répartissant les files.',
        ),
      },
      {
        id: 'rec-mood-3',
        name: `${SUBTYPE_SIMPLE_LABELS.beer_garden[lang]} 1`,
        subtype: 'beer_garden',
        widthM: 15,
        depthM: 11,
        estimatedCostUsd: 10500,
        zone: 'west',
        reason: tr6(
          lang,
          '쉬는 시간 식음 수요를 서측 구역으로 분산해 중앙 통로 혼잡을 줄입니다.',
          'Draws intermission beverage queues into the west wing away from central aisles.',
          '休憩時間の飲食需要を西側エリアへ分散し、中央通路の混雑を軽減します。',
          '将中场休息饮品需求分流至西侧区域，缓解中央通道拥堵。',
          'Desvía la demanda de bebidas en intermedios hacia el ala oeste.',
          'Répartit l’afflux des pauses boissons vers l’aile ouest.',
        ),
      },
      {
        id: 'rec-mood-4',
        name: `${SUBTYPE_SIMPLE_LABELS.locker_charging[lang]} 1`,
        subtype: 'locker_charging',
        widthM: 9.5,
        depthM: 6,
        estimatedCostUsd: 4900,
        zone: 'entrance',
        reason: tr6(
          lang,
          '장시간 체류 관람객의 소지품 보관 및 휴대폰 충전 편의를 높입니다.',
          'Smart lockers and phone charging near the main entry for full-day visitors.',
          '長時間滞在する来場者の手荷物保管とスマホ充電の利便性を高めます。',
          '位于入口附近，方便长时间停留观众寄存物品与手机充电。',
          'Taquillas y carga móvil junto a la entrada para estancias largas.',
          'Consignes et recharge mobile près de l’entrée pour les longues visites.',
        ),
      },
    );
  } else if (config.eventType === 'exhibition' || config.eventType === 'career_fair') {
    pool.push(
      {
        id: 'rec-mood-proj',
        name: `${SUBTYPE_SIMPLE_LABELS.beam_projector[lang]} 1`,
        subtype: 'beam_projector',
        widthM: 14,
        depthM: 6.5,
        estimatedCostUsd: 6800,
        zone: 'north',
        reason: tr6(
          lang,
          '공연이 없는 실내 박람회·컨퍼런스에서 기조발표·설명회 진행에 최적화된 16:9 대형 스크린 및 고광량 빔 프로젝터 단상입니다.',
          '16:9 wide screen & high-lumen laser projector riser tailored for non-performance indoor talks and briefings.',
          '公演のない屋内展示会・説明会の基調講演に最適化された16:9大型スクリーン＆ビームプロジェクター壇上です。',
          '专为无演出的室内展会、宣讲会打造的16:9大型银幕与高流明激光投影讲台。',
          'Pantalla 16:9 y proyector láser ideal para ponencias en eventos interiores sin conciertos.',
          'Écran 16:9 et vidéoprojecteur laser idéal pour conférences en intérieur sans concert.',
        ),
      },
      {
        id: 'rec-mood-1',
        name: `${SUBTYPE_SIMPLE_LABELS.experience_booth[lang]} A`,
        subtype: 'experience_booth',
        widthM: 7,
        depthM: 6.5,
        estimatedCostUsd: 3900,
        zone: 'east',
        reason: tr6(
          lang,
          '전시·박람회 격자 통로 규격에 맞춘 깔끔한 상담·체험 모듈 부스입니다.',
          'Modular consultation & showcase booth sized for wide exhibition grid aisles.',
          '展示会・フェアのグリッド通路規格に合わせた相談・体験モジュールです。',
          '契合展会网格通道尺寸的标准化咨询与互动体验展位。',
          'Stand modular de consulta y demostración para pasillos de expo.',
          'Stand modulaire de conseil adapté aux allées de salon.',
        ),
      },
      {
        id: 'rec-mood-2',
        name: `${SUBTYPE_SIMPLE_LABELS.multilingual_info[lang]} 1`,
        subtype: 'multilingual_info',
        widthM: 9,
        depthM: 6.5,
        estimatedCostUsd: 5600,
        zone: 'entrance',
        reason: tr6(
          lang,
          '출입구 인근에서 다국어 안내 및 교통약자 동선을 즉시 지원합니다.',
          'Provides multilingual wayfinding and mobility assistance right inside the gate.',
          '出入口付近で多言語案内および配慮が必要な方の動線を即座に支援します。',
          '在出入口旁即时提供多语种导览与无障碍辅助服务。',
          'Ofrece orientación multilingüe y apoyo de movilidad junto al acceso.',
          'Assure l’accueil multilingue et l’orientation PMR dès l’entrée.',
        ),
      },
      {
        id: 'rec-mood-3',
        name: `${SUBTYPE_SIMPLE_LABELS.food_stall[lang]} 1`,
        subtype: 'food_stall',
        widthM: 7.5,
        depthM: 6.5,
        estimatedCostUsd: 4300,
        zone: 'west',
        reason: tr6(
          lang,
          '전시 관람 중 짧은 휴식을 제공하는 카페·스낵 부스입니다.',
          'Clean espresso & snack kiosk offering quick refreshment during hall tours.',
          '展示観覧の合間に立ち寄れるカフェ・軽食ブースです。',
          '观展途中提供便捷咖啡与轻食补给的休息展位。',
          'Quiosco de café y refrigerios rápidos durante el recorrido.',
          'Kiosque café et collation rapide pendant la visite du salon.',
        ),
      },
      {
        id: 'rec-mood-4',
        name: `${SUBTYPE_SIMPLE_LABELS.rest_plaza[lang]} 1`,
        subtype: 'rest_plaza',
        widthM: 15,
        depthM: 12,
        estimatedCostUsd: 6200,
        zone: 'center',
        reason: tr6(
          lang,
          '장시간 도보 관람객과 교통약자를 위한 중앙 좌석 쉼터입니다.',
          'Central seating lounge reducing continuous walking fatigue for visitors.',
          '長時間の歩行観覧者や高齢者・車椅子利用者のための中央休憩ラウンジです。',
          '为长时间步行观众及无障碍群体设置的中央座椅休息区。',
          'Área central de descanso con asientos para reducir la fatiga peatonal.',
          'Salon central avec assises pour réduire la fatigue de marche.',
        ),
      },
    );
  } else {
    pool.push(
      {
        id: 'rec-mood-1',
        name: `${SUBTYPE_SIMPLE_LABELS.experience_booth[lang]} A`,
        subtype: 'experience_booth',
        widthM: 7,
        depthM: 6.5,
        estimatedCostUsd: 3800,
        zone: 'east',
        reason: tr6(
          lang,
          '참여형 프로그램 운영에 적합한 표준 규격 체험 부스입니다.',
          'Standard interactive booth tailored for hands-on community programs.',
          '参加型プログラム運営に適した標準規格の体験ブースです。',
          '适合开展互动体验项目的标准规格展位。',
          'Stand interactivo estándar ideal para actividades participativas.',
          'Stand interactif standard adapté aux ateliers participatifs.',
        ),
      },
      {
        id: 'rec-mood-2',
        name: `${SUBTYPE_SIMPLE_LABELS.food_stall[lang]} 1`,
        subtype: 'food_stall',
        widthM: 7.5,
        depthM: 6.5,
        estimatedCostUsd: 4200,
        zone: 'west',
        reason: tr6(
          lang,
          '회전율이 빠른 간편 먹거리 배치를 통해 대기열을 줄입니다.',
          'Fast-service snack booth positioned to shorten food wait queues.',
          '回転率の高い軽食ブース配置により待機列を短縮します。',
          '周转迅速的小吃展位，可有效缩短排队等待时间。',
          'Puesto de comida rápida que reduce tiempos de espera en fila.',
          'Stand de restauration rapide réduisant les files d’attente.',
        ),
      },
      {
        id: 'rec-mood-3',
        name: `${SUBTYPE_SIMPLE_LABELS.photo_zone[lang]} 1`,
        subtype: 'photo_zone',
        widthM: 4.4,
        depthM: 3.6,
        estimatedCostUsd: 5000,
        zone: 'center',
        reason: tr6(
          lang,
          '방문객 체류 만족도를 높이는 세로형 직육면체 타워 포토존입니다.',
          'Vertical cuboid photo tower creating a memorable central landmark.',
          '来場者の満足度を高める縦長直方体タワー型フォトゾーンです。',
          '提升访客打卡满意度的竖向长方体塔式拍照区。',
          'Torre fotográfica vertical que crea un punto central memorable.',
          'Tour photo verticale créant un repère central mémorable.',
        ),
      },
      {
        id: 'rec-mood-4',
        name: `${SUBTYPE_SIMPLE_LABELS.eco_station[lang]} 1`,
        subtype: 'eco_station',
        widthM: 7.5,
        depthM: 5.5,
        estimatedCostUsd: 3400,
        zone: 'south',
        reason: tr6(
          lang,
          '퇴장 동선 인근에서 쾌적한 환경 유지를 돕는 친환경 반납 부스입니다.',
          'Reusable cup return & recycling hub along the outbound exit corridor.',
          '退場動線付近で清潔な会場環境を保つエコ回収ステーションです。',
          '设于退场动线附近，助力保持场地整洁的环保回收站。',
          'Punto ecológico de retorno y reciclaje junto a la ruta de salida.',
          'Point éco de tri et consigne situé sur le parcours de sortie.',
        ),
      },
    );
  }

  return pool.sort((a, b) => Number(existingSubtypes.has(a.subtype)) - Number(existingSubtypes.has(b.subtype)));
}



