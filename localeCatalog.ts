import {
  BoothModelStyle,
  ChatArchitectRole,
  ContingencyScenario,
  DataReliabilityLabel,
  DensityReferenceProfileId,
  EventPhaseId,
  EventType,
  IndoorFloorPresetId,
  Language,
  LayerVisibility,
  MoisSafetyTier,
  OutdoorFloorPresetId,
  SpatialZoneTarget,
  StagePlacementMode,
  VenueBoundaryShape,
  VenueLayoutModel,
  WeatherScenarioId,
} from '../types/festival';

export type L6 = Record<Language, string>;

/**
 * Compile-time checked 6-language string selector.
 * Guarantees zero missing translations or silent Korean/English fallbacks.
 */
export function tr6(
  lang: Language,
  ko: string,
  en: string,
  ja: string,
  zh: string,
  es: string,
  fr: string,
): string {
  switch (lang) {
    case 'ko':
      return ko;
    case 'en':
      return en;
    case 'ja':
      return ja;
    case 'zh':
      return zh;
    case 'es':
      return es;
    case 'fr':
      return fr;
    default:
      return en;
  }
}

export function pickL6(lang: Language, map: L6): string {
  return map[lang] ?? map.en;
}

export function getLocaleCode(lang: Language): string {
  switch (lang) {
    case 'ko':
      return 'ko-KR';
    case 'ja':
      return 'ja-JP';
    case 'zh':
      return 'zh-CN';
    case 'es':
      return 'es-ES';
    case 'fr':
      return 'fr-FR';
    default:
      return 'en-US';
  }
}

export const EVENT_PRESET_NAME_I18N: Record<EventType, L6> = {
  music_festival: {
    ko: '2026 봄 뮤직 & 컬처 페스티벌',
    en: '2026 Spring Music & Culture Festival',
    ja: '2026 春のミュージック＆カルチャーフェス',
    zh: '2026 春季音乐与文化节',
    es: 'Festival de Música y Cultura Primavera 2026',
    fr: 'Festival Musique & Culture Printemps 2026',
  },
  school_festival: {
    ko: '건양고 한솔 대동제 (표준안)',
    en: 'Campus Hansol Youth Festival',
    ja: 'キャンパス青春学園祭（標準案）',
    zh: '校园青春文化节（标准方案）',
    es: 'Festival Estudiantil Universitario',
    fr: 'Festival Étudiant du Campus',
  },
  sports_event: {
    ko: '시민 한마음 체육대회 & 팬 빌리지',
    en: 'Civic Sports Meet & Fan Village',
    ja: '市民スポーツ大会＆ファンビレッジ',
    zh: '市民运动会与球迷村',
    es: 'Encuentro Deportivo Ciudadano y Fan Village',
    fr: 'Rencontre Sportive Citoyenne & Fan Village',
  },
  exhibition: {
    ko: '미래 모빌리티 & AI 문화 박람회',
    en: 'Future Mobility & Culture Expo',
    ja: '未来モビリティ＆文化エキスポ',
    zh: '未来出行与文化博览会',
    es: 'Expo de Movilidad Futura y Cultura',
    fr: 'Expo Mobilité du Futur & Culture',
  },
  career_fair: {
    ko: '청년 진로·직업체험 박람회',
    en: 'Youth Career & Job Fair',
    ja: '青年キャリア・職業体験フェア',
    zh: '青年职业体验与招聘博览会',
    es: 'Feria Juvenil de Empleo y Vocación',
    fr: 'Salon Jeunesse Emploi & Orientation',
  },
  community_festival: {
    ko: '로컬 문화예술 & 농특산물 한마당',
    en: 'Local Arts & Harvest Community Fair',
    ja: '地域文化芸術＆特産品フェスティバル',
    zh: '地方文化艺术与特产盛会',
    es: 'Feria Comunitaria de Arte y Productos Locales',
    fr: 'Fête Communautaire des Arts & Terroirs',
  },
  flea_market: {
    ko: '한강 수변 수공예 & 나이트 플리마켓',
    en: 'Riverside Craft & Night Flea Market',
    ja: 'リバーサイド手芸＆ナイトフリーマーケット',
    zh: '滨水手作与夜间跳蚤市场',
    es: 'Mercado Nocturno y Artesanal Ribereño',
    fr: 'Marché Nocturne & Artisanal au Bord de l’Eau',
  },
};

const KNOWN_DEFAULT_EVENT_NAMES = new Set<string>([
  '2026 올림픽공원 봄 뮤직 페스티벌',
  '건양고 한솔 대동제 (INCLUSE 표준안)',
  ...Object.values(EVENT_PRESET_NAME_I18N).flatMap((m) => Object.values(m)),
]);

export function isKnownPresetEventName(name: string): boolean {
  const trimmed = (name || '').trim();
  return !trimmed || KNOWN_DEFAULT_EVENT_NAMES.has(trimmed);
}

export const VENUE_SHAPE_I18N: Record<VenueBoundaryShape, L6> = {
  rectangle: {
    ko: '표준 직사각형 광장형 (시청·공원광장)',
    en: 'Standard Rectangular Plaza',
    ja: '標準長方形プラザ型（公園・広場）',
    zh: '标准矩形广场型（市政·公园广场）',
    es: 'Plaza Rectangular Estándar',
    fr: 'Place Rectangulaire Standard',
  },
  circle_arena: {
    ko: '원형·타원형 아레나 광장형 (돔·원형마당)',
    en: 'Circular / Oval Arena Bowl',
    ja: '円形・楕円アリーナ広場型（ドーム）',
    zh: '圆形·椭圆形竞技场型（穹顶广场）',
    es: 'Arena Circular / Ovalada',
    fr: 'Arène Circulaire / Ovale',
  },
  fan_amphitheater: {
    ko: '부채꼴 노천극장·음악당형 (방사형 관람)',
    en: 'Fan-Shaped Amphitheater',
    ja: '扇形野外音楽堂・劇場型（放射観覧）',
    zh: '扇形露天剧场型（放射式观演）',
    es: 'Anfiteatro en Abanico',
    fr: 'Amphithéâtre en Éventail',
  },
  linear_park: {
    ko: '수변·스트리트 선형 공원형 (거리축제)',
    en: 'Linear Riverfront / Street Promenade',
    ja: '水辺・ストリート線形公園型',
    zh: '滨水·街道线性公园型',
    es: 'Paseo Lineal Ribereño / Urbano',
    fr: 'Promenade Linéaire Urbaine / Quai',
  },
  courtyard_campus: {
    ko: '대학 운동장·트랙 코트야드형 (캠퍼스)',
    en: 'Campus Track & Courtyard Field',
    ja: '大学グラウンド・中庭型（学園祭）',
    zh: '高校操场·庭院型（校园节）',
    es: 'Patio y Pista Universitaria',
    fr: 'Terrain & Cour de Campus',
  },
  expo_hall: {
    ko: '컨벤션·박람회 전시장 홀형 (COEX·KINTEX형)',
    en: 'Convention & Exhibition Hall',
    ja: 'コンベンション展示ホール型',
    zh: '会展博览中心展厅型',
    es: 'Pabellón de Convenciones y Expo',
    fr: 'Hall de Convention & Exposition',
  },
};

export const STAGE_PLACEMENT_I18N: Record<StagePlacementMode, L6> = {
  north_end: {
    ko: '북측 메인 엔드스테이지 (표준 콘서트형)',
    en: 'North-End Main Stage (Standard)',
    ja: '北側メインエンドステージ（標準コンサート型）',
    zh: '北侧主端舞台（标准演唱会型）',
    es: 'Escenario Principal Norte (Estándar)',
    fr: 'Scène Principale Nord (Standard)',
  },
  center_360: {
    ko: '중앙 360° 아레나 스테이지 (사방 관람형)',
    en: 'Center 360° In-The-Round Stage',
    ja: '中央360°アリーナステージ（全方向観覧型）',
    zh: '中央360°环绕舞台（四面观演型）',
    es: 'Escenario Central 360°',
    fr: 'Scène Centrale 360°',
  },
  twin_stages: {
    ko: '듀얼 트윈 스테이지 (좌·우 교차 주무대형)',
    en: 'Dual Twin Main Stages',
    ja: 'デュアルツインステージ（左右交互型）',
    zh: '双主舞台（左右交替演出型）',
    es: 'Escenarios Principales Gemelos',
    fr: 'Double Scène Principale Jumelée',
  },
  runway_keynote: {
    ko: 'T자형 돌출 런웨이 스테이지 (키노트·패션쇼)',
    en: 'T-Shape Thrust Runway Stage',
    ja: 'T字型ランウェイステージ（基調講演・ショー）',
    zh: 'T字延伸T台舞台（主题演讲·走秀）',
    es: 'Escenario con Pasarela en T',
    fr: 'Scène avec Podium en T',
  },
  projector_screen: {
    ko: '빔 프로젝터·대형 스크린 (비공연 실내 발표형)',
    en: 'Beam Projector & Screen (Non-Performance Indoor)',
    ja: 'ビームプロジェクター・スクリーン（公演なし屋内行事）',
    zh: '投影仪与大型银幕（无演出室内活动）',
    es: 'Proyector y Pantalla (Interior sin Concierto)',
    fr: 'Vidéoprojecteur & Écran (Intérieur sans Concert)',
  },
  none: {
    ko: '무대 없음 (순수 마켓·박람회·전시 중심)',
    en: 'No Main Stage (Market / Expo Focus)',
    ja: 'ステージなし（マーケット・展示中心）',
    zh: '无主舞台（市集·展览中心）',
    es: 'Sin Escenario Principal (Mercado / Expo)',
    fr: 'Sans Scène Principale (Marché / Expo)',
  },
};

export const VENUE_LAYOUT_MODEL_I18N: Record<VenueLayoutModel, L6> = {
  standard: {
    ko: '표준 중앙축·광장형 (Standard Axial)',
    en: 'Standard Axial Plaza',
    ja: '標準中央軸・広場型',
    zh: '标准中轴广场型',
    es: 'Plaza Axial Estándar',
    fr: 'Place Axiale Standard',
  },
  circular_plaza: {
    ko: '원형·방사형 아레나 (Circular Arena)',
    en: 'Circular Radial Arena',
    ja: '円形・放射状アリーナ型',
    zh: '圆形放射状竞技场型',
    es: 'Arena Radial Circular',
    fr: 'Arène Radiale Circulaire',
  },
  u_courtyard: {
    ko: 'ㄷ자형 중정·코트야드 (U-Courtyard)',
    en: 'U-Shape Courtyard',
    ja: 'コの字型コートヤード（中庭型）',
    zh: 'U型合院广场型',
    es: 'Patio en Forma de U',
    fr: 'Cour en Forme de U',
  },
  boulevard_grid: {
    ko: '격자·스트리트 대로형 (Boulevard Grid)',
    en: 'Boulevard Street Grid',
    ja: 'グリッド・ストリート大通り型',
    zh: '网格大道街区型',
    es: 'Cuadrícula de Bulevar',
    fr: 'Grille de Boulevard',
  },
  cluster_village: {
    ko: '권역별 빌리지 클러스터형 (Village Pods)',
    en: 'Clustered Village Pods',
    ja: 'ゾーン別ビレッジクラスター型',
    zh: '分区村落组团型',
    es: 'Aldeas Agrupadas por Zonas',
    fr: 'Villages Thématiques Groupés',
  },
  radial_fan: {
    ko: '부채꼴 아크·노천극장형 (Radial Fan Arcs)',
    en: 'Radial Amphitheater Arcs',
    ja: '扇形アーク・野外劇場型',
    zh: '扇形弧线露天剧场型',
    es: 'Arcos Radiales de Anfiteatro',
    fr: 'Arcs Radiaux d’Amphithéâtre',
  },
  diagonal_avenue: {
    ko: '대각선 X-크로스 애비뉴형 (Diagonal Cross)',
    en: 'Diagonal X-Cross Avenue',
    ja: '対角線Xクロスアベニュー型',
    zh: '对角X型交叉大道型',
    es: 'Avenida Diagonal en Cruz X',
    fr: 'Avenue Diagonale en Croix X',
  },
  waterside_promenade: {
    ko: '수변·가로 프롬나드 선형 (Linear Promenade)',
    en: 'Linear Waterside Promenade',
    ja: '水辺・プロムナード線形',
    zh: '滨水长廊线性布局',
    es: 'Paseo Lineal Ribereño',
    fr: 'Promenade Linéaire au Bord de l’Eau',
  },
};

export const BOOTH_MODEL_STYLE_I18N: Record<BoothModelStyle, L6> = {
  pagoda_tent: {
    ko: '파고다·몽골 뾰족텐트형 (표준)',
    en: 'Peaked Pagoda Tent (Std)',
    ja: 'パゴダ尖塔テント型（標準）',
    zh: '尖顶宝塔帐篷型（标准）',
    es: 'Carpa Pagoda en Punta (Estándar)',
    fr: 'Tente Pagode Pointue (Standard)',
  },
  modern_container: {
    ko: '모던 팝업 컨테이너형 (+18%)',
    en: 'Modern Pop-Up Container (+18%)',
    ja: 'モダンポップアップコンテナ型（+18%）',
    zh: '现代快闪集装箱型（+18%）',
    es: 'Contenedor Pop-Up Moderno (+18%)',
    fr: 'Conteneur Pop-Up Moderne (+18%)',
  },
  open_canopy: {
    ko: '경량 폴딩 캐노피형 (-22%)',
    en: 'Lightweight Open Canopy (-22%)',
    ja: '軽量オープンキャノピー型（-22%）',
    zh: '轻便折叠遮阳棚型（-22%）',
    es: 'Toldo Plegable Ligero (-22%)',
    fr: 'Auvent Pliant Léger (-22%)',
  },
  wooden_pavilion: {
    ko: '친환경 목조 파빌리온형 (+12%)',
    en: 'Timber Eco-Pavilion (+12%)',
    ja: 'エコ木造パビリオン型（+12%）',
    zh: '生态木构展亭型（+12%）',
    es: 'Pabellón Ecológico de Madera (+12%)',
    fr: 'Pavillon Éco en Bois (+12%)',
  },
  geodesic_dome: {
    ko: '지오데식 돔·에어돔형 (+24%)',
    en: 'Geodesic Dome Pod (+24%)',
    ja: 'ジオデシックドーム型（+24%）',
    zh: '测地线球幕舱型（+24%）',
    es: 'Domo Geodésico (+24%)',
    fr: 'Dôme Géodésique (+24%)',
  },
  expo_shell: {
    ko: '옥타늄 박람회 시스템부스형 (-8%)',
    en: 'Octanorm Expo Shell Booth (-8%)',
    ja: '展示会システムブース型（-8%）',
    zh: '标准会展铝料展位型（-8%）',
    es: 'Stand Modular de Expo (-8%)',
    fr: 'Stand Modulaire d’Exposition (-8%)',
  },
  parasol_table: {
    ko: '원형 마켓 파라솔·테이블형 (-30%)',
    en: 'Market Parasol & Bistro Booth (-30%)',
    ja: 'マーケットパラソル＆テーブル型（-30%）',
    zh: '市集遮阳伞桌椅型（-30%）',
    es: 'Sombrilla y Mesa de Mercado (-30%)',
    fr: 'Parasol & Table de Marché (-30%)',
  },
  inflatable_air: {
    ko: '대형 에어아치·에어텐트형 (+8%)',
    en: 'Inflatable Air-Arch Pavilion (+8%)',
    ja: '大型エアアーチ・エアテント型（+8%）',
    zh: '充气拱门帐篷型（+8%）',
    es: 'Pabellón Inflable Air-Arch (+8%)',
    fr: 'Pavillon Gonflable Air-Arch (+8%)',
  },
};

export const INDOOR_FLOOR_I18N: Record<IndoorFloorPresetId, L6> = {
  epoxy_light: {
    ko: '실내 에폭시 라이트그레이 (기본)',
    en: 'Indoor Light Epoxy Hall (Default)',
    ja: '屋内ライトグレー・エポキシ床（標準）',
    zh: '室内浅灰环氧地坪（默认）',
    es: 'Epoxi Claro Interior (Predet.)',
    fr: 'Sol Époxy Clair Intérieur (Défaut)',
  },
  expo_carpet: {
    ko: '실내 컨벤션 카펫 타일 (블루슬레이트)',
    en: 'Convention Carpet Tile (Blue Slate)',
    ja: '屋内コンベンション・カーペットタイル',
    zh: '室内会展地毯砖（蓝灰）',
    es: 'Moqueta Modular de Convenciones',
    fr: 'Moquette Modulaire de Salon',
  },
  wood_parquet: {
    ko: '실내 체육관·다목적 우드 마루',
    en: 'Indoor Hardwood Parquet Floor',
    ja: '屋内多目的ウッドパーケット床',
    zh: '室内体育馆·多功能木地板',
    es: 'Parquet de Madera Multiusos',
    fr: 'Parquet Bois Polyvalent Intérieur',
  },
  polished_dark: {
    ko: '실내 다크 폴리싱 콘크리트',
    en: 'Dark Polished Concrete Floor',
    ja: '屋内ダークポリッシュ・コンクリート',
    zh: '室内深色抛光混凝土地面',
    es: 'Hormigón Pulido Oscuro Interior',
    fr: 'Béton Ciré Sombre Intérieur',
  },
};

export const OUTDOOR_FLOOR_I18N: Record<OutdoorFloorPresetId, L6> = {
  natural_lawn: {
    ko: '실외 천연 잔디광장 (기본)',
    en: 'Outdoor Natural Park Lawn (Default)',
    ja: '屋外天然芝生広場（標準）',
    zh: '室外天然草坪广场（默认）',
    es: 'Césped Natural Exterior (Predet.)',
    fr: 'Pelouse Naturelle Extérieure (Défaut)',
  },
  stone_plaza: {
    ko: '실외 화강석 광장 보도블록',
    en: 'Outdoor Granite Stone Plaza',
    ja: '屋外御影石・石畳プラザ',
    zh: '室外花岗岩铺装广场',
    es: 'Plaza Exterior de Piedra Granítica',
    fr: 'Parvis Extérieur en Pierre Granit',
  },
  asphalt_street: {
    ko: '실외 스트리트 아스팔트 광장',
    en: 'Outdoor Urban Asphalt Plaza',
    ja: '屋外ストリート・アスファルト広場',
    zh: '室外城市沥青街区广场',
    es: 'Explanada Urbana de Asfalto',
    fr: 'Esplanade Urbaine en Asphalte',
  },
  clay_campus: {
    ko: '실외 운동장 마사토·트랙',
    en: 'Outdoor Campus Sand & Track',
    ja: '屋外グラウンド真砂土・トラック',
    zh: '室外操场沙土与跑道',
    es: 'Campo Exterior de Tierra y Pista',
    fr: 'Terrain Sablé & Piste Extérieure',
  },
};

export const EVENT_PHASE_I18N: Record<
  EventPhaseId,
  { label: L6; short: L6; desc: L6 }
> = {
  arrival: {
    label: {
      ko: '개장 및 방문객 입장',
      en: 'Gates Open & Arrival',
      ja: '開場・来場者入場',
      zh: '开场与观众入场',
      es: 'Apertura y Llegada',
      fr: 'Ouverture & Arrivées',
    },
    short: {
      ko: '입장 시간',
      en: 'Arrival',
      ja: '入場',
      zh: '入场期',
      es: 'Llegada',
      fr: 'Arrivée',
    },
    desc: {
      ko: '주출입구·매표소·외부 주차장 연결 동선을 통해 방문객이 집중 유입되는 구간입니다.',
      en: 'Visitors enter steadily via main gates, ticket hubs, and exterior parking walkways.',
      ja: 'メインゲート・案内所・外部駐車場連絡路から来場者が流入する時間帯です。',
      zh: '观众经主出入口、票务中心与外部停车场步道集中流入的时段。',
      es: 'Flujo de entrada por accesos principales, taquillas y estacionamiento exterior.',
      fr: 'Entrée des visiteurs par les portes principales, billetteries et parkings extérieurs.',
    },
  },
  afternoon_booths: {
    label: {
      ko: '체험부스 및 광장 관람',
      en: 'Experience Booths & Plaza',
      ja: '体験ブース・広場観覧',
      zh: '体验展位与广场游览',
      es: 'Stands de Experiencia y Plaza',
      fr: 'Stands d’Expérience & Place',
    },
    short: {
      ko: '부스 체험',
      en: 'Booths',
      ja: 'ブース体験',
      zh: '展位体验',
      es: 'Stands',
      fr: 'Stands',
    },
    desc: {
      ko: '체험·전시 부스, 수직 포토존, 가족 쉼터, 푸드존으로 관람객이 고르게 분산됩니다.',
      en: 'Balanced exploration across experience booths, vertical photo zones, lounges, and food stalls.',
      ja: '体験・展示ブース、フォトゾーン、休憩エリア、フードゾーンへ均一に分散します。',
      zh: '观众均匀分布于互动展位、立式拍照区、家庭休息区与餐饮区。',
      es: 'Circulación equilibrada entre stands interactivos, zonas de fotos, descanso y comida.',
      fr: 'Exploration équilibrée entre stands, zones photo verticales, espaces repos et restauration.',
    },
  },
  pre_show: {
    label: {
      ko: '메인 무대 집결',
      en: 'Main Stage Gathering',
      ja: 'メインステージ集結',
      zh: '主舞台集结',
      es: 'Concentración en Escenario',
      fr: 'Rassemblement Scène',
    },
    short: {
      ko: '무대 집결',
      en: 'Gathering',
      ja: 'ステージ集結',
      zh: '舞台集结',
      es: 'Reunión',
      fr: 'Afflux Scène',
    },
    desc: {
      ko: '외곽 광장 및 부스 구역에서 메인 무대와 객석 구역으로 유입이 증가합니다.',
      en: 'Steady inward movement from outer booths toward the main stage and seating blocks.',
      ja: '外周ブースからメインステージおよび客席エリアへ人の流れが集中します。',
      zh: '人流由外围展位向主舞台及观众席稳步汇聚。',
      es: 'Movimiento progresivo desde los stands hacia el escenario principal y gradas.',
      fr: 'Flux régulier depuis les stands périphériques vers la scène principale et les gradins.',
    },
  },
  headline_show: {
    label: {
      ko: '메인 피크 공연',
      en: 'Headline Performance',
      ja: 'メインピーク公演',
      zh: '主舞台高峰演出',
      es: 'Actuación Principal Pico',
      fr: 'Spectacle Principal de Pointe',
    },
    short: {
      ko: '피크 공연',
      en: 'Peak Show',
      ja: 'ピーク公演',
      zh: '高峰演出',
      es: 'Show Pico',
      fr: 'Pic Scène',
    },
    desc: {
      ko: '메인 무대 전면 안전구역과 관객석에 최대 인파가 밀집하는 피크 시간대입니다.',
      en: 'Peak crowd concentration across the main stage front buffer, seating, and VIP deck.',
      ja: 'メインステージ前方安全ゾーンと客席に最大人数が集まるピーク時間帯です。',
      zh: '主舞台前安全缓冲区、看台与贵宾区达到最高人流密度的时段。',
      es: 'Máxima concentración frente al escenario principal, gradas y terraza VIP.',
      fr: 'Concentration maximale devant la scène principale, dans les gradins et l’espace VIP.',
    },
  },
  intermission: {
    label: {
      ko: '휴식 시간 (푸드·화장실 피크)',
      en: 'Intermission — Food & Restrooms',
      ja: '休憩時間（飲食・トイレピーク）',
      zh: '中场休息（餐饮·洗手间高峰）',
      es: 'Intermedio — Comida y Baños',
      fr: 'Entracte — Restauration & WC',
    },
    short: {
      ko: '휴식·식음',
      en: 'Intermission',
      ja: '休憩・飲食',
      zh: '中场休息',
      es: 'Intermedio',
      fr: 'Entracte',
    },
    desc: {
      ko: '공연 직후 푸드트럭·매점·화장실로 대기열이 급증하는 병목 취약 구간입니다.',
      en: 'Rapid surge from stage areas toward food trucks, stalls, and restroom queues.',
      ja: '公演直後にフードトラック・売店・トイレの待機列が急増する時間帯です。',
      zh: '演出刚结束时餐饮车、摊位及洗手间排队迅速增加的瓶颈敏感时段。',
      es: 'Aumento rápido de filas en food trucks, puestos y sanitarios tras el espectáculo.',
      fr: 'Afflux rapide vers les food trucks, stands repas et sanitaires juste après le concert.',
    },
  },
  egress: {
    label: {
      ko: '폐장 및 분리 퇴장',
      en: 'Closing & Split Egress',
      ja: '閉場・分散退場',
      zh: '闭场与分流退场',
      es: 'Cierre y Salida Escalonada',
      fr: 'Fermeture & Sortie Séparée',
    },
    short: {
      ko: '퇴장 분산',
      en: 'Egress',
      ja: '退場',
      zh: '退场疏散',
      es: 'Salida',
      fr: 'Sortie',
    },
    desc: {
      ko: '일반 방문객 퇴장 동선과 교통약자 전용 외곽 완만 퇴장 동선이 분리 운영됩니다.',
      en: 'General visitors exit via main gates while mobility-priority guests use dedicated step-free perimeter lanes.',
      ja: '一般退場動線と配慮が必要な来場者専用の外周バリアフリー退場動線を分離運用します。',
      zh: '普通观众退场路线与无障碍关怀群体专用外围平缓退场通道分离运行。',
      es: 'Salida general separada de la ruta perimetral sin escalones para movilidad prioritaria.',
      fr: 'Sortie générale séparée du couloir périphérique sans marche dédié aux publics prioritaires.',
    },
  },
};

export const CONTINGENCY_I18N: Record<
  ContingencyScenario,
  { label: L6; short: L6; desc: L6 }
> = {
  normal: {
    label: {
      ko: '정상 운영 (기본 시나리오)',
      en: 'Normal Operations',
      ja: '通常運営（基本シナリオ）',
      zh: '正常运行（基准场景）',
      es: 'Operación Normal',
      fr: 'Fonctionnement Normal',
    },
    short: {
      ko: '정상 운영',
      en: 'Normal',
      ja: '通常運営',
      zh: '正常运行',
      es: 'Normal',
      fr: 'Normal',
    },
    desc: {
      ko: '기상 및 방문객 유입이 계획 범위 내에서 운영되는 표준 시뮬레이션 상태입니다.',
      en: 'Standard operations under planned weather and visitor arrival curves.',
      ja: '気象および来場者流入が計画範囲内で推移する標準状態です。',
      zh: '天气与客流在计划范围内平稳运行的标准仿真状态。',
      es: 'Operación estándar con clima y flujo de visitantes dentro de lo previsto.',
      fr: 'Exploitation standard avec météo et afflux conformes aux prévisions.',
    },
  },
  rain: {
    label: {
      ko: '우천 돌발상황 (지붕·비가림 집중)',
      en: 'Sudden Rainstorm',
      ja: '急な降雨（屋根・テント集中）',
      zh: '突发降雨（向遮雨设施集中）',
      es: 'Lluvia Repentina',
      fr: 'Averse Soudaine',
    },
    short: {
      ko: '우천 발생',
      en: 'Rainstorm',
      ja: '降雨発生',
      zh: '突发降雨',
      es: 'Lluvia',
      fr: 'Pluie',
    },
    desc: {
      ko: '체류객이 지붕형 부스·캐노피로 빠르게 이동하며 평균 보행 속도가 18% 감소합니다.',
      en: 'Visitors move toward covered booths and canopies while walking speed drops by 18%.',
      ja: '来場者が屋根付きブースやキャノピーへ集まり、歩行速度が約18%低下します。',
      zh: '观众迅速向有顶展位与遮雨棚聚集，平均步行速度下降约18%。',
      es: 'Los asistentes buscan carpas cubiertas mientras la velocidad peatonal baja un 18%.',
      fr: 'Les visiteurs rejoignent les stands couverts et la vitesse de marche baisse de 18 %.',
    },
  },
  surge: {
    label: {
      ko: '방문객 급증 (+35% 초과 유입)',
      en: 'Attendance Surge (+35%)',
      ja: '来場者急増（+35%超過流入）',
      zh: '客流激增（+35%超额涌入）',
      es: 'Aumento de Aforo (+35%)',
      fr: 'Pic d’Affluence (+35 %)',
    },
    short: {
      ko: '방문객 급증',
      en: 'Crowd Surge',
      ja: '来場者急増',
      zh: '客流激增',
      es: 'Sobreaforo',
      fr: 'Suraffluence',
    },
    desc: {
      ko: '예상 인원 대비 35% 초과 유입이 발생하여 주출입구와 식음 구역 대기열이 증가합니다.',
      en: 'Unexpected +35% attendance surge increasing gate and food corridor queues.',
      ja: '想定比+35%の流入が発生し、メインゲートと飲食エリアの待機列が増加します。',
      zh: '超出预期35%的客流涌入，导致主出入口与餐饮走廊排队显著上升。',
      es: 'Entrada imprevista de +35% de público que incrementa las colas en accesos y comida.',
      fr: 'Hausse imprévue de +35 % des entrées sollicitant fortement les portes et zones repas.',
    },
  },
  stage_delay: {
    label: {
      ko: '메인 공연 지연 (부스·화장실 체류 증가)',
      en: 'Main Stage Schedule Delay',
      ja: 'ステージ進行遅延（ブース滞留増）',
      zh: '主舞台演出延误（展位·洗手间滞留增加）',
      es: 'Retraso en Escenario Principal',
      fr: 'Retard Scène Principale',
    },
    short: {
      ko: '공연 지연',
      en: 'Stage Delay',
      ja: '公演遅延',
      zh: '演出延误',
      es: 'Retraso',
      fr: 'Retard Scène',
    },
    desc: {
      ko: '무대 일정 조정으로 관람객이 식음·체험 부스 및 화장실 구역으로 분산 체류합니다.',
      en: 'Schedule shift redistributes waiting audiences back toward food booths and restrooms.',
      ja: 'ステージ進行調整により観客が飲食・体験ブースおよびトイレ周辺へ滞留します。',
      zh: '舞台日程推迟使观众回流至餐饮、互动展位与洗手间区域停留。',
      es: 'El ajuste de horario redirige al público hacia puestos de comida y sanitarios.',
      fr: 'Le décalage horaire redirige le public vers les stands de restauration et sanitaires.',
    },
  },
  medical_emergency: {
    label: {
      ko: '응급환자 발생 (비상 구급통로 확보)',
      en: 'Medical Emergency Dispatch',
      ja: '救急対応発生（緊急通路確保）',
      zh: '突发医疗急救（清空应急救护通道）',
      es: 'Emergencia Médica (Vía Libre)',
      fr: 'Urgence Médicale (Couloir Secours)',
    },
    short: {
      ko: '응급 대응',
      en: 'Medical Alert',
      ja: '救急対応',
      zh: '医疗急救',
      es: 'Alerta Médica',
      fr: 'Secours',
    },
    desc: {
      ko: '응급환자 이송을 위해 중앙 비상 통로와 의무실 직결 경로를 우선 확보합니다.',
      en: 'Prioritizes central emergency ambulance spine clearance directly to the Medical Post.',
      ja: '傷病者搬送のため中央緊急通路と救護室への直結ルートを優先確保します。',
      zh: '为转运急症伤员，立即优先管控并清空中央应急救护通道与医疗站连线。',
      es: 'Despeja prioritariamente el corredor central de ambulancias hacia el puesto médico.',
      fr: 'Dégage en priorité l’axe central d’ambulance relié directement au poste médical.',
    },
  },
};

export const MOIS_TIER_I18N: Record<MoisSafetyTier, L6> = {
  safe: {
    ko: '혼잡 낮음 (여유)',
    en: 'Low Congestion (Clear)',
    ja: '混雑低（ゆとり）',
    zh: '低拥挤（宽裕）',
    es: 'Congestión Baja (Fluido)',
    fr: 'Faible Densité (Fluide)',
  },
  caution: {
    ko: '완충·관찰 구간',
    en: 'Moderate Observation',
    ja: '緩衝・観察区間',
    zh: '缓冲观察区间',
    es: 'Rango de Observación',
    fr: 'Zone d’Observation',
  },
  warning: {
    ko: '주의 구간 (대기열 관리)',
    en: 'Caution (Queue Control)',
    ja: '注意区間（待機列管理）',
    zh: '注意区间（排队管控）',
    es: 'Precaución (Gestión de Filas)',
    fr: 'Vigilance (Gestion Files)',
  },
  danger: {
    ko: '밀집 위험 (유입 조절)',
    en: 'High Density (Throttle Inflow)',
    ja: '密集危険（流入制限）',
    zh: '高密风险（限制流入）',
    es: 'Alta Densidad (Regular Flujo)',
    fr: 'Forte Densité (Réguler Flux)',
  },
};

export const DENSITY_PROFILE_I18N: Record<
  DensityReferenceProfileId,
  { name: L6; source: L6; note: L6 }
> = {
  mois_2024_main_table: {
    name: {
      ko: '개방 광장 표준 기준 (여유 ≤2 · 주의 3~4 · 위험 ≥5명/㎡)',
      en: 'Open Plaza Standard (Low <=2, Caution 3–4, High >=5 p/m²)',
      ja: '開放広場標準基準（ゆとり≤2・注意3〜4・危険≥5人/㎡）',
      zh: '开放广场标准基准（宽裕≤2 · 注意3~4 · 危险≥5人/㎡）',
      es: 'Estándar Plaza Abierta (Bajo <=2, Precaución 3–4, Alto >=5 p/m²)',
      fr: 'Standard Place Ouverte (Fluide <=2, Vigilance 3–4, Risque >=5 p/m²)',
    },
    source: {
      ko: '개방형 관람·이동 공간 표준 밀도 구간',
      en: 'Open plaza & walkway reference density intervals',
      ja: '開放型観覧・歩行空間の標準密度区分',
      zh: '开放式观演与步行空间标准密度区间',
      es: 'Intervalos de densidad de referencia en plazas abiertas',
      fr: 'Intervalles de densité de référence pour esplanades ouvertes',
    },
    note: {
      ko: '2명/㎡ 이하에서는 자유 보행이 가능하나 3~4명/㎡부터 신체 접촉이 잦아지고 5명/㎡ 이상에서는 군중 압력이 급증합니다.',
      en: 'Below 2 p/m² allows free walking; at 3–4 p/m² body contact restricts pacing; above 5 p/m² crowd pressure rises sharply.',
      ja: '2人/㎡以下は自由歩行が可能ですが、3〜4人/㎡で接触が増え、5人/㎡以上では群衆圧力が急上昇します。',
      zh: '2人/㎡以下可自由步行，3~4人/㎡起身体接触频繁，5人/㎡以上人群推挤压力骤增。',
      es: 'Menos de 2 p/m² permite paso libre; a 3–4 p/m² aumenta el contacto; sobre 5 p/m² crece la presión.',
      fr: 'Sous 2 p/m² la marche est libre ; à 3–4 p/m² les contacts augmentent ; dès 5 p/m² la poussée s’intensifie.',
    },
  },
  mois_2024_page10_note: {
    name: {
      ko: '고밀도 관측 경보 기준 (여유 2~3 · 주의 3~5 · 위험 ≥6명/㎡)',
      en: 'High-Density Monitoring Alert (2–3 / 3–5 / >=6 p/m²)',
      ja: '高密度観測警報基準（2〜3 / 3〜5 / ≥6人/㎡）',
      zh: '高密度监测预警基准（2~3 / 3~5 / ≥6人/㎡）',
      es: 'Alerta de Monitoreo de Alta Densidad (2–3 / 3–5 / >=6 p/m²)',
      fr: 'Seuil d’Alerte Capteurs Haute Densité (2–3 / 3–5 / >=6 p/m²)',
    },
    source: {
      ko: '관측·모니터링 경보 단계용 밀도 구간',
      en: 'Monitoring sensor alert threshold intervals',
      ja: '現場混雑センサー警報段階用の密度区分',
      zh: '现场客流监测预警分级密度区间',
      es: 'Umbrales de alerta de sensores de monitoreo',
      fr: 'Intervalles d’alerte pour capteurs de suivi de foule',
    },
    note: {
      ko: '현장 혼잡 계측 체계에서 사용하는 경보 단계 기준으로, 엄격한 기준과 평균 내지 않고 별도 프로파일로 비교합니다.',
      en: 'Sensor alert thresholds kept as a distinct comparison profile rather than averaging different standards.',
      ja: '現場計測警報用の基準であり、厳格な基準と平均せず別プロファイルとして比較します。',
      zh: '用于现场监测报警的阈值区间，不与严格标准简单平均，作为独立方案对比。',
      es: 'Umbrales de alerta mantenidos por separado sin promediar distintos criterios operativos.',
      fr: 'Seuils d’alerte capteurs conservés séparément sans moyennage artificiel.',
    },
  },
  indoor_narrow_conservative: {
    name: {
      ko: '실내·협소 연결통로 보수 기준 (여유 ≤1.5 · 주의 2.5 · 위험 ≥4명/㎡)',
      en: 'Indoor & Narrow Corridor Conservative (<=1.5 / 2.5 / >=4 p/m²)',
      ja: '屋内・狭小通路保守基準（≤1.5 / 2.5 / ≥4人/㎡）',
      zh: '室内·狭窄通道保守基准（≤1.5 / 2.5 / ≥4人/㎡）',
      es: 'Conservador Interior y Pasillos Estrechos (<=1.5 / 2.5 / >=4 p/m²)',
      fr: 'Prudent Intérieur & Couloirs Étroits (<=1,5 / 2,5 / >=4 p/m²)',
    },
    source: {
      ko: '양측 벽면·난간으로 회피가 제한된 실내·협소 구간 기준',
      en: 'Wall- or barrier-bounded indoor & narrow corridor intervals',
      ja: '両側が壁や柵で囲まれた屋内・狭小通路向け基準',
      zh: '两侧受墙体或护栏限制的室内及狭窄连接通道基准',
      es: 'Criterio para salas interiores y pasillos delimitados por muros o vallas',
      fr: 'Référence pour halls intérieurs et couloirs bordés de murs ou barrières',
    },
    note: {
      ko: '양옆이 벽·부스로 막힌 실내 통로에서는 측면 회피 공간이 제한되므로 더 낮은 밀도에서 선제 관리합니다.',
      en: 'Bounded indoor aisles limit lateral escape, requiring earlier inflow management at lower densities.',
      ja: '壁やブースに挟まれた屋内通路は側方回避が限られるため、より低い密度から先行管理します。',
      zh: '受墙体与展位夹持的室内通道侧向避让受限，因此需在更低密度下提前调控。',
      es: 'En pasillos interiores acotados el escape lateral es limitado, exigiendo control preventivo.',
      fr: 'Dans les allées intérieures encadrées, le dégagement latéral est limité et requiert un contrôle anticipé.',
    },
  },
};

export const LAYER_LABEL_I18N: Record<keyof LayerVisibility, L6> = {
  stage: {
    ko: '무대 및 공연 구역',
    en: 'Stages & Performance',
    ja: 'ステージ・公演エリア',
    zh: '舞台与演出区',
    es: 'Escenarios y Actuación',
    fr: 'Scènes & Spectacle',
  },
  seating: {
    ko: '관객석 및 스탠딩 블록',
    en: 'Audience Seating Blocks',
    ja: '客席・観覧ブロック',
    zh: '观众看台与观演区',
    es: 'Bloques de Gradas y Público',
    fr: 'Gradins & Blocs Public',
  },
  food: {
    ko: '푸드트럭 및 식음 부스',
    en: 'Food Trucks & F&B Stalls',
    ja: 'フードトラック・飲食ブース',
    zh: '餐饮车与美食摊位',
    es: 'Food Trucks y Gastronomía',
    fr: 'Food Trucks & Restauration',
  },
  booth: {
    ko: '체험·전시·포토존 부스',
    en: 'Experience, Merch & Photo Booths',
    ja: '体験・物販・フォトゾーン',
    zh: '互动·周边·立式拍照区',
    es: 'Stands Interactivos y Zona Foto',
    fr: 'Stands Expérience & Zone Photo',
  },
  rest: {
    ko: '휴게 쉼터 · 가족 · 우천그늘막',
    en: 'Rest Plazas & Shade Canopies',
    ja: '休憩広場・ファミリー・日除け',
    zh: '休息广场·母婴区·遮阳避雨棚',
    es: 'Descanso Familiar y Sombras',
    fr: 'Aires de Repos & Auvents',
  },
  restroom: {
    ko: '화장실 (장애인 전용 포함)',
    en: 'Restrooms (incl. Accessible)',
    ja: 'トイレ（多目的トイレ含む）',
    zh: '洗手间（含无障碍专用间）',
    es: 'Sanitarios (incl. Accesibles)',
    fr: 'Sanitaires (dont PMR)',
  },
  entrance: {
    ko: '출입구 게이트 및 안내소',
    en: 'Gates & Info Desks',
    ja: '出入口ゲート・案内所',
    zh: '出入口大门与问询处',
    es: 'Puertas de Acceso e Info',
    fr: 'Portes d’Accès & Accueil',
  },
  medical: {
    ko: '응급의료 부스 (의무실)',
    en: 'First Aid & Medical Posts',
    ja: '救護・医療ブース',
    zh: '应急医疗救护站',
    es: 'Puestos Médicos y Primeros Auxilios',
    fr: 'Postes de Secours Médical',
  },
  parking: {
    ko: '외부 주차장 (행사장 외곽)',
    en: 'Exterior Parking Lots',
    ja: '外部駐車場（会場外周）',
    zh: '外部停车场（场馆外围）',
    es: 'Estacionamiento Exterior',
    fr: 'Parkings Extérieurs',
  },
  vip: {
    ko: 'VIP 라운지 데크',
    en: 'VIP Lounge Deck',
    ja: 'VIPラウンジデッキ',
    zh: 'VIP贵宾休息露台',
    es: 'Terraza Lounge VIP',
    fr: 'Salon Terrasse VIP',
  },
  camping: {
    ko: '피크닉 · 반려동물 구역',
    en: 'Picnic & Pet Zones',
    ja: 'ピクニック・ペット同伴ゾーン',
    zh: '野餐露营与宠物友好区',
    es: 'Zona de Picnic y Mascotas',
    fr: 'Zone Pique-nique & Animaux',
  },
  landscaping: {
    ko: '실내외 조명 · 안전 소품',
    en: 'Lighting & Safety Micro-Props',
    ja: '照明・安全誘導備品',
    zh: '照明与现场安全微设施',
    es: 'Iluminación y Elementos Viales',
    fr: 'Éclairage & Balisage Sécurité',
  },
  crowd: {
    ko: '실시간 방문객 에이전트',
    en: 'Live Visitor Agents',
    ja: 'リアルタイム来場者エージェント',
    zh: '实时访客智能体',
    es: 'Visitantes en Tiempo Real',
    fr: 'Visiteurs en Temps Réel',
  },
  heatmap: {
    ko: '혼잡도 바닥 히트맵',
    en: 'Crowd Density Heatmap',
    ja: '混雑度フロアヒートマップ',
    zh: '地面拥挤度热力图',
    es: 'Mapa de Calor de Densidad',
    fr: 'Carte Thermique de Densité',
  },
  pedestrianRoutes: {
    ko: '보행 및 교통약자 전용 퇴장동선',
    en: 'Walkways & Priority Access Egress',
    ja: '一般歩行動線＆配慮者専用退場路',
    zh: '步行流线与无障碍专用退场通道',
    es: 'Rutas Peatonales y Salida Accesible',
    fr: 'Allées & Sortie Dédiée PMR',
  },
  evacuationRoutes: {
    ko: '비상 대피 및 구급차 통로',
    en: 'Emergency & Ambulance Lanes',
    ja: '非常避難・救急車通路',
    zh: '紧急疏散与救护车通道',
    es: 'Vías de Evacuación y Ambulancia',
    fr: 'Voies d’Évacuation & Ambulance',
  },
  labels: {
    ko: '시설 이름표 및 혼잡 배지',
    en: 'Booth Labels & Queue Badges',
    ja: '施設ラベル・混雑バッジ',
    zh: '展位名称与排队徽标',
    es: 'Etiquetas de Stands y Filas',
    fr: 'Étiquettes des Stands & Files',
  },
};

export const ZONE_TARGET_I18N: Record<SpatialZoneTarget, L6> = {
  center: {
    ko: '중앙 홀',
    en: 'Center Floor',
    ja: '中央フロア',
    zh: '中央大厅',
    es: 'Zona Central',
    fr: 'Zone Centrale',
  },
  north: {
    ko: '북측(무대쪽)',
    en: 'North (Stage Side)',
    ja: '北側（ステージ側）',
    zh: '北侧（舞台方向）',
    es: 'Norte (Escenario)',
    fr: 'Nord (Côté Scène)',
  },
  south: {
    ko: '남측(출입구쪽)',
    en: 'South (Gate Side)',
    ja: '南側（ゲート側）',
    zh: '南侧（大门方向）',
    es: 'Sur (Accesos)',
    fr: 'Sud (Côté Portes)',
  },
  east: {
    ko: '동측 구역',
    en: 'East Wing',
    ja: '東側エリア',
    zh: '东侧区域',
    es: 'Ala Este',
    fr: 'Aile Est',
  },
  west: {
    ko: '서측 구역',
    en: 'West Wing',
    ja: '西側エリア',
    zh: '西侧区域',
    es: 'Ala Oeste',
    fr: 'Aile Ouest',
  },
  northwest: {
    ko: '북서 코너',
    en: 'Northwest Corner',
    ja: '北西コーナー',
    zh: '西北角',
    es: 'Esquina Noroeste',
    fr: 'Coin Nord-Ouest',
  },
  northeast: {
    ko: '북동 코너',
    en: 'Northeast Corner',
    ja: '北東コーナー',
    zh: '东北角',
    es: 'Esquina Noreste',
    fr: 'Coin Nord-Est',
  },
  southwest: {
    ko: '남서 코너',
    en: 'Southwest Corner',
    ja: '南西コーナー',
    zh: '西南角',
    es: 'Esquina Suroeste',
    fr: 'Coin Sud-Ouest',
  },
  southeast: {
    ko: '남동 코너',
    en: 'Southeast Corner',
    ja: '南東コーナー',
    zh: '东南角',
    es: 'Esquina Sureste',
    fr: 'Coin Sud-Est',
  },
  stage_left: {
    ko: '무대 좌측',
    en: 'Stage Left',
    ja: 'ステージ左側',
    zh: '舞台左侧',
    es: 'Izquierda del Escenario',
    fr: 'Côté Jardin Scène',
  },
  stage_right: {
    ko: '무대 우측',
    en: 'Stage Right',
    ja: 'ステージ右側',
    zh: '舞台右侧',
    es: 'Derecha del Escenario',
    fr: 'Côté Cour Scène',
  },
  stage_front: {
    ko: '무대 전면',
    en: 'Stage Front',
    ja: 'ステージ前方',
    zh: '舞台正前方',
    es: 'Frente al Escenario',
    fr: 'Devant la Scène',
  },
  entrance: {
    ko: '주출입구 인근',
    en: 'Near Main Gate',
    ja: 'メインゲート付近',
    zh: '主入口附近',
    es: 'Junto al Acceso Principal',
    fr: 'Près de l’Entrée Principale',
  },
  perimeter: {
    ko: '외곽 통로변',
    en: 'Outer Perimeter',
    ja: '外周プロムナード沿い',
    zh: '外围环廊沿线',
    es: 'Perímetro Exterior',
    fr: 'Pourtour Périphérique',
  },
  corners: {
    ko: '사방 모서리',
    en: 'Four Corners',
    ja: '四隅コーナー',
    zh: '四角区域',
    es: 'Cuatro Esquinas',
    fr: 'Quatre Coins',
  },
};

export const CHAT_ROLE_I18N: Record<
  ChatArchitectRole,
  { label: L6; badge: L6 }
> = {
  spatial_architect: {
    label: {
      ko: '공간 설계 AI',
      en: 'Spatial Architect AI',
      ja: '空間設計 AI',
      zh: '空间规划 AI',
      es: 'IA Arquitecta Espacial',
      fr: 'IA Architecte Spatial',
    },
    badge: {
      ko: '배치 · 동선 · 바닥/주차',
      en: 'Layout · Floor · Parking',
      ja: '配置・床材・外部駐車',
      zh: '布局 · 地面 · 外部停车',
      es: 'Diseño · Suelo · Parking',
      fr: 'Plan · Sol · Parking',
    },
  },
  safety_auditor: {
    label: {
      ko: '안전·병목 점검 AI',
      en: 'Safety & Flow Auditor',
      ja: '安全・混雑監査 AI',
      zh: '安全与瓶颈审计 AI',
      es: 'IA Auditora de Seguridad',
      fr: 'IA Audit Sécurité & Flux',
    },
    badge: {
      ko: '밀집 · 비상통로',
      en: 'Density · Egress',
      ja: '密度・非常導線',
      zh: '密度 · 应急疏散',
      es: 'Densidad · Evacuación',
      fr: 'Densité · Évacuation',
    },
  },
  inclusive_specialist: {
    label: {
      ko: '교통약자 동선 AI',
      en: 'Accessibility Specialist',
      ja: 'バリアフリー動線 AI',
      zh: '无障碍关怀流线 AI',
      es: 'IA de Accesibilidad',
      fr: 'IA Accessibilité PMR',
    },
    badge: {
      ko: '무장애 · 전용 퇴장로',
      en: 'Step-Free · Priority Egress',
      ja: '段差解消・専用退場路',
      zh: '无台阶 · 专用退场道',
      es: 'Sin Escalones · Salida',
      fr: 'Sans Marche · Sortie PMR',
    },
  },
};

export const CHAT_QUICK_STARTERS_I18N: Record<Language, string[]> = {
  ko: [
    '실외 잔디 행사장으로 전환하고 외부 주차장 2곳 설치해줘',
    '세로형 포토존 2개를 중앙 광장에 추가하고 메인 무대는 고정해줘',
    '푸드트럭을 동·서 양쪽으로 분산해 대기줄 병목을 줄여줘',
    '휠체어·전동차·유모차 전용 완만 퇴장 동선과 가족 쉼터를 보강해줘',
    '실내 우드 마루 바닥으로 바꾸고 체험부스 3개 추가해줘',
  ],
  en: [
    'Switch to an outdoor lawn venue and add 2 exterior parking lots',
    'Add 2 vertical cuboid photo zones in the center and lock Main Stage',
    'Split food trucks across East and West wings to cut queue bottlenecks',
    'Reinforce step-free perimeter egress for wheelchairs & strollers + family lounge',
    'Change floor to indoor wood parquet and add 3 experience booths',
  ],
  ja: [
    '屋外の天然芝生会場に切り替えて外部駐車場を2か所追加して',
    '縦長の直方体フォトゾーンを中央に2つ追加し、メインステージを固定して',
    'フードトラックを東西に分散配置して待機列の混雑を減らして',
    '車椅子・ベビーカー専用の外周退場ルートとファミリー休憩所を強化して',
    '屋内の木目パーケット床に変更して体験ブースを3つ追加して',
  ],
  zh: [
    '切换为室外天然草坪场地并在外围增设2处外部停车场',
    '在中央广场新增2个竖向长方体拍照区并锁定主舞台',
    '将餐饮车分散到东西两侧以缓解排队拥堵',
    '加强轮椅·代步车·婴儿车专用平缓退场通道并增设家庭休息区',
    '将地面改为室内木地板并新增3个互动体验展位',
  ],
  es: [
    'Cambiar a recinto exterior con césped y añadir 2 estacionamientos exteriores',
    'Añadir 2 zonas de fotos verticales en el centro y fijar el escenario principal',
    'Distribuir los food trucks al este y oeste para reducir filas',
    'Reforzar la salida sin escalones para sillas de ruedas y carriolas + sala familiar',
    'Cambiar el suelo a parquet interior y añadir 3 stands de experiencia',
  ],
  fr: [
    'Passer en site extérieur sur pelouse et ajouter 2 parkings extérieurs',
    'Ajouter 2 zones photo verticales au centre et verrouiller la scène principale',
    'Répartir les food trucks à l’est et à l’ouest pour réduire les files',
    'Renforcer la sortie sans marche PMR/poussettes et ajouter un salon famille',
    'Changer le sol en parquet bois intérieur et ajouter 3 stands d’expérience',
  ],
};

export const SAMPLE_BRIEFS_I18N: Record<
  Language,
  Array<{ label: string; text: string }>
> = {
  ko: [
    {
      label: '실내 박람회 7,500명',
      text: '미래 모빌리티 실내 박람회 7,500명, 190x150m 실내 컨벤션 카펫 바닥, 예산 2억 5천만원, 체험부스 12개, 포토존 2개, 푸드부스 4개, 외부 주차장 2개, 무장애 통로 적용',
    },
    {
      label: '야외 뮤직페스티벌 1만명',
      text: '실외 봄 뮤직 페스티벌 10,000명, 200x150m 천연 잔디 바닥, 예산 3억원, 푸드트럭 6개 동서 분산, 포토존 2개, 의무실 2개, 외부 주차장 2개, 휠체어·유모차 무장애 동선',
    },
    {
      label: '캠퍼스 축제 3,500명',
      text: '대학 청춘 대동제 3,500명, 160x130m 실외 마사토 운동장, 예산 1억원, 동아리 체험부스 10개, 푸드트럭 5개, 수직 포토존 2개, 외부 주차장 1개',
    },
  ],
  en: [
    {
      label: 'Indoor Expo 7,500',
      text: 'Future Mobility Indoor Expo 7500 visitors, 190x150m indoor carpet floor, budget $185000, 12 experience booths, 2 photo zones, 4 food stalls, 2 exterior parking lots, step-free wide corridors',
    },
    {
      label: 'Outdoor Music 10k',
      text: 'Outdoor Spring Music Festival 10000 visitors, 200x150m natural lawn, budget $240000, 6 food trucks split east/west, 2 vertical photo zones, 2 medical posts, 2 exterior parking lots',
    },
    {
      label: 'Campus Fair 3,500',
      text: 'University Youth Festival 3500 visitors, 160x130m outdoor campus ground, budget $80000, 10 club booths, 5 food trucks, 2 photo zones, 1 exterior parking lot',
    },
  ],
  ja: [
    {
      label: '屋内エキスポ 7,500名',
      text: '未来モビリティ屋内展示会 7500名、190x150m 屋内カーペット床、体験ブース12個、フォトゾーン2個、飲食ブース4個、外部駐車場2か所、バリアフリー広幅通路',
    },
    {
      label: '屋外音楽フェス 1万名',
      text: '屋外ミュージックフェスティバル 10000名、200x150m 天然芝生、フードトラック6台を東西分散、フォトゾーン2個、救護室2か所、外部駐車場2か所',
    },
    {
      label: '学園祭 3,500名',
      text: '大学キャンパス学園祭 3500名、160x130m 屋外グラウンド床、体験ブース10個、フードトラック5台、フォトゾーン2個、外部駐車場1か所',
    },
  ],
  zh: [
    {
      label: '室内博览会 7,500人',
      text: '未来科技室内博览会 7500人，190x150m 室内会展地毯地面，互动展位12个，立式拍照区2个，餐饮摊位4个，外部停车场2处，无障碍宽通道',
    },
    {
      label: '室外音乐节 1万人',
      text: '室外春季音乐节 10000人，200x150m 天然草坪地面，6辆餐饮车东西分散，拍照区2个，医疗站2处，外部停车场2处，轮椅婴儿车无障碍流线',
    },
    {
      label: '校园文化节 3,500人',
      text: '大学青春校园节 3500人，160x130m 室外操场地面，社团体验展位10个，餐饮车5辆，立式拍照区2个，外部停车场1处',
    },
  ],
  es: [
    {
      label: 'Expo Interior 7.500',
      text: 'Expo Interior de Innovación 7500 asistentes, 190x150m suelo interior de moqueta, 12 stands de experiencia, 2 zonas de fotos, 4 puestos de comida, 2 estacionamientos exteriores, pasillos accesibles',
    },
    {
      label: 'Festival Exterior 10k',
      text: 'Festival Musical al Aire Libre 10000 asistentes, 200x150m césped natural, 6 food trucks al este y oeste, 2 zonas de fotos, 2 puestos médicos, 2 estacionamientos exteriores',
    },
    {
      label: 'Festival Campus 3.500',
      text: 'Festival Universitario 3500 asistentes, 160x130m campo exterior, 10 stands estudiantiles, 5 food trucks, 2 zonas de fotos, 1 estacionamiento exterior',
    },
  ],
  fr: [
    {
      label: 'Salon Intérieur 7 500',
      text: 'Salon Innovation Intérieur 7500 visiteurs, 190x150m moquette salon, 12 stands d’expérience, 2 zones photo, 4 stands repas, 2 parkings extérieurs, allées larges PMR',
    },
    {
      label: 'Festival Plein Air 10k',
      text: 'Festival Musical Extérieur 10000 visiteurs, 200x150m pelouse naturelle, 6 food trucks est/ouest, 2 zones photo verticales, 2 postes médicaux, 2 parkings extérieurs',
    },
    {
      label: 'Fête Campus 3 500',
      text: 'Festival Étudiant 3500 visiteurs, 160x130m terrain extérieur, 10 stands associatifs, 5 food trucks, 2 zones photo, 1 parking extérieur',
    },
  ],
};

export const DEFAULT_AI_PROMPT_I18N: L6 = {
  ko: '실내 다목적 문화 페스티벌 10,000명, 200x150m 에폭시 바닥, 푸드트럭 5개 동서 분산, 체험부스 6개, 수직 포토존 1개, 외부 주차장 1개, 교통약자 전용 퇴장동선 적용',
  en: 'Indoor culture & music festival 10,000 visitors, 200x150m epoxy floor, 5 food trucks dispersed, 6 experience booths, 1 vertical photo zone, 1 exterior parking lot, priority step-free egress',
  ja: '屋内多目的カルチャーフェス 10,000名、200x150m エポキシ床、フードトラック5台分散、体験ブース6個、縦型フォトゾーン1個、外部駐車場1か所、配慮者専用退場動線',
  zh: '室内多功能文化音乐节 10,000人，200x150m 环氧地面，5辆餐饮车分散布局，6个体验展位，1个竖向拍照区，1处外部停车场，无障碍专用退场流线',
  es: 'Festival cultural interior 10.000 visitantes, 200x150m suelo epoxi, 5 food trucks distribuidos, 6 stands interactivos, 1 zona de fotos vertical, 1 parking exterior, salida accesible dedicada',
  fr: 'Festival culturel intérieur 10 000 visiteurs, 200x150m sol époxy, 5 food trucks répartis, 6 stands d’expérience, 1 zone photo verticale, 1 parking extérieur, sortie dédiée sans marche',
};

export const WELCOME_CHAT_MESSAGE_I18N: L6 = {
  ko: '안녕하세요! 행사장 공간 설계 AI입니다. 현재 실내/실외 환경, 바닥 재질·색상, 부스 배치(고정 부스 보호), 수직형 포토존, 외부 주차장, 교통약자 전용 퇴장 동선을 실시간으로 인식하고 있습니다.\n\n예: "실외 잔디 바닥으로 바꾸고 외부 주차장 2개 추가해줘", "중앙에 포토존 2개 배치하고 메인 무대 고정해줘", "푸드트럭 1 이름을 타코 트럭으로 변경해줘"처럼 말씀해 주세요.',
  en: 'Hello! I am your Venue Spatial Architect AI. I track your live indoor/outdoor setting, floor material & color, booth placements (preserving locked booths), vertical cuboid photo zones, exterior parking lots, and dedicated step-free egress lanes.\n\nTry: "Switch to outdoor lawn and add 2 exterior parking lots", "Add 2 photo zones in the center and lock Main Stage", or "Rename Food Truck 1 to Taco Truck".',
  ja: 'こんにちは！会場空間設計AIです。現在の屋内・屋外設定、床材・カラー、ブース配置（固定ブース保護）、縦長フォトゾーン、外部駐車場、配慮者専用退場動線をリアルタイムで把握しています。\n\n例：「屋外の天然芝生に変えて外部駐車場を2か所追加して」「中央にフォトゾーンを2つ追加してメインステージを固定して」と話しかけてください。',
  zh: '您好！我是场馆空间规划 AI。我已实时同步当前的室内/室外环境、地面材质与颜色、展位布局（自动保护锁定展位）、竖向长方体拍照区、场外停车场以及无障碍专用退场通道。\n\n您可以直接输入：“切换为室外草坪并增加2个外部停车场”、“在中央增加2个拍照区并锁定主舞台”或“把餐饮车1改名为塔可餐车”。',
  es: '¡Hola! Soy tu IA Arquitecta del Recinto. Reconozco en tiempo real el entorno interior/exterior, material y color del suelo, stands (respetando los fijados), zonas de fotos verticales, estacionamientos exteriores y rutas de salida sin escalones.\n\nPrueba: "Cambia a césped exterior y añade 2 estacionamientos exteriores" o "Añade 2 zonas de fotos en el centro y fija el escenario principal".',
  fr: 'Bonjour ! Je suis votre IA Architecte d’Espace. Je suis en temps réel le mode intérieur/extérieur, le revêtement et la couleur du sol, les stands (en protégeant les stands verrouillés), les zones photo verticales, les parkings extérieurs et les sorties PMR sans marche.\n\nEssayez : « Passe en pelouse extérieure et ajoute 2 parkings extérieurs » ou « Ajoute 2 zones photo au centre et verrouille la scène principale ».',
};

export const RELIABILITY_BADGE_I18N: Record<
  DataReliabilityLabel,
  { badge: L6; meaning: L6; meta: L6 }
> = {
  OFFICIAL: {
    badge: {
      ko: 'OFFICIAL · 공식 법령·매뉴얼',
      en: 'OFFICIAL · Statutory Manual',
      ja: 'OFFICIAL · 公式法令・指針',
      zh: 'OFFICIAL · 官方规范手册',
      es: 'OFFICIAL · Norma Oficial',
      fr: 'OFFICIAL · Norme Officielle',
    },
    meaning: {
      ko: '법령·정부 안전 매뉴얼·공식 통계 포털 원문 기준',
      en: 'Directly grounded in statutory regulations, safety manuals, and official portals',
      ja: '法令・政府安全マニュアル・公式統計ポータルの原文基準',
      zh: '依据国家法规、政府安全手册及官方统计门户原文标准',
      es: 'Basado directamente en reglamentos legales, manuales oficiales y estadísticas públicas',
      fr: 'Fondé directement sur les textes réglementaires, manuels officiels et portails publics',
    },
    meta: {
      ko: '기관명, 문서명, 발행일, 조문·표 번호',
      en: 'Agency, document title, publication date, clause/table no.',
      ja: '機関名・文書名・発行日・条文番号',
      zh: '机构名称、文件名称、发布日期、条款表号',
      es: 'Organismo, documento, fecha y artículo/tabla',
      fr: 'Organisme, titre, date de publication et article',
    },
  },
  OBSERVED: {
    badge: {
      ko: 'OBSERVED · 현장 실측·관측',
      en: 'OBSERVED · Field Measured',
      ja: 'OBSERVED · 現地実測値',
      zh: 'OBSERVED · 现场实测值',
      es: 'OBSERVED · Medición Real',
      fr: 'OBSERVED · Mesure Terrain',
    },
    meaning: {
      ko: '실제 행사 게이트 계측·유동인구·결산 관측값',
      en: 'Measured gate counts, footfall telemetry, and audited settlement records',
      ja: '実際のゲート計測・流動人口・決算観測データ',
      zh: '实际门禁计数、客流遥测与决算观测数据',
      es: 'Conteos reales en puertas, telemetría peatonal y liquidaciones auditadas',
      fr: 'Comptages réels aux portes, flux mesurés et bilans vérifiés',
    },
    meta: {
      ko: '행사명, 연도, 측정 위치, 계측 방법',
      en: 'Event name, year, sensor location, measurement method',
      ja: 'イベント名・年度・測定位置・計測手法',
      zh: '活动名称、年份、测量位置与计量方法',
      es: 'Evento, año, punto de medición y método',
      fr: 'Événement, année, point de mesure et méthode',
    },
  },
  ESTIMATED: {
    badge: {
      ko: 'ESTIMATED · 산식 추정치',
      en: 'ESTIMATED · Formula Derived',
      ja: 'ESTIMATED · 算式推定値',
      zh: 'ESTIMATED · 公式推算值',
      es: 'ESTIMATED · Estimación Analítica',
      fr: 'ESTIMATED · Calcul Estimé',
    },
    meaning: {
      ko: '유효 가용면적·대기행렬(λ, μ, c) 산식으로 계산한 값',
      en: 'Computed from net walkable area and queuing formulas (λ, μ, c)',
      ja: '純歩行可能面積・待ち行列式（λ, μ, c）から算出した推定値',
      zh: '基于净通行面积与排队论公式（λ, μ, c）计算的推算值',
      es: 'Calculado mediante área neta caminable y fórmulas de colas (λ, μ, c)',
      fr: 'Calculé via la surface nette praticable et les formules de file (λ, μ, c)',
    },
    meta: {
      ko: '추정 산식, 입력 변수, 불확실성 범위',
      en: 'Formula, input parameters, uncertainty bounds',
      ja: '推定算式・入力変数・変動幅',
      zh: '推算公式、输入变量与不确定范围',
      es: 'Fórmula, variables de entrada y margen',
      fr: 'Formule, variables d’entrée et marge d’incertitude',
    },
  },
  ASSUMPTION: {
    badge: {
      ko: 'ASSUMPTION · 시뮬레이션 가정값',
      en: 'ASSUMPTION · Planning Default',
      ja: 'ASSUMPTION · 計画仮定値',
      zh: 'ASSUMPTION · 规划假设值',
      es: 'ASSUMPTION · Supuesto de Plan',
      fr: 'ASSUMPTION · Hypothèse Simulation',
    },
    meaning: {
      ko: '기획 단계 기본 가정값 (실제 견적·법적 확정값 아님, 수정 가능)',
      en: 'Editable planning-stage assumption (not a legal approval or final vendor quote)',
      ja: '企画段階の初期仮定値（法的確定・正式見積ではなく編集可能）',
      zh: '策划阶段可编辑默认假设值（非法律审批或最终报价）',
      es: 'Supuesto editable de planificación (no sustituye cotización ni aprobación legal)',
      fr: 'Hypothèse de planification modifiable (hors devis ferme ou homologation)',
    },
    meta: {
      ko: '가정 사유, 기본값 범위, 사용자 수정 여부',
      en: 'Rationale, baseline range, user override status',
      ja: '仮定理由・初期範囲・編集有無',
      zh: '假设依据、默认范围与用户修改状态',
      es: 'Motivo, rango base y edición del usuario',
      fr: 'Justification, plage de base et modification utilisateur',
    },
  },
  MISSING: {
    badge: {
      ko: 'MISSING · 현장 자료 미입력',
      en: 'MISSING · Field Data Pending',
      ja: 'MISSING · 現地資料未入力',
      zh: 'MISSING · 待补充现场资料',
      es: 'MISSING · Datos Pendientes',
      fr: 'MISSING · Données Manquantes',
    },
    meaning: {
      ko: '관할기관 협의·실측 자료 미입력으로 판정 보류된 항목',
      en: 'Held pending local authority consultation or site survey input',
      ja: '関係機関協議・実測データが未入力のため判定保留の項目',
      zh: '尚未录入主管部门协商或现场实测资料而暂缓判定的项目',
      es: 'En espera de consulta con autoridades locales o levantamiento en sitio',
      fr: 'En attente de concertation officielle ou de relevé sur site',
    },
    meta: {
      ko: '필요 자료 목록, 판정 보류 여부',
      en: 'Required documents list, hold status',
      ja: '必要資料リスト・判定保留状態',
      zh: '所需资料清单与暂缓判定状态',
      es: 'Documentación requerida y estado en pausa',
      fr: 'Pièces requises et statut en attente',
    },
  },
};

export const WEATHER_SCENARIO_I18N: Record<
  WeatherScenarioId,
  { name: L6; trigger: L6; impact: L6; actions: Record<Language, string[]> }
> = {
  clear: {
    name: {
      ko: '평시 맑음 (기준 기상)',
      en: 'Standard Clear Weather',
      ja: '通常晴天（基準気象）',
      zh: '晴朗常态（基准气象）',
      es: 'Clima Despejado Estándar',
      fr: 'Temps Clair Standard',
    },
    trigger: {
      ko: '기온 18~25°C, 풍속 4m/s 미만, 강수 없음',
      en: '18–25°C, wind < 4 m/s, zero precipitation',
      ja: '気温18〜25°C、風速4m/s未満、降水なし',
      zh: '气温18~25°C，风速低于4m/s，无降水',
      es: '18–25°C, viento < 4 m/s, sin precipitación',
      fr: '18–25 °C, vent < 4 m/s, aucune précipitation',
    },
    impact: {
      ko: '광장·체험부스·푸드존 전반에 고른 체류 분포 형성',
      en: 'Balanced dwell distribution across plazas, experience booths, and food zones',
      ja: '広場・体験ブース・フードゾーン全体に均一な滞在分布を形成',
      zh: '广场、互动展位与餐饮区整体呈现均衡停留分布',
      es: 'Distribución equilibrada en plazas, stands de experiencia y zonas gastronómicas',
      fr: 'Répartition homogène sur l’esplanade, les stands d’animation et l’espace repas',
    },
    actions: {
      ko: [
        '주 동선 유효폭 및 대기열 경계선(바리케이드·유도선) 기본 유지',
        '공연 전환기(입장·종료 직후) 화장실·식음 병목 집중 모니터링',
      ],
      en: [
        'Maintain primary corridor clear width and queue stanchion boundaries',
        'Monitor restroom and food queue surges during pre/post-show transitions',
      ],
      ja: [
        '主要通路の有効幅および待機列バリケード境界を維持',
        '公演前後の転換時間帯におけるトイレ・飲食待機列を重点監視',
      ],
      zh: [
        '保持主通道有效净宽与排队护栏边界线',
        '重点监控演出前后转换期洗手间与餐饮区排队峰值',
      ],
      es: [
        'Mantener el ancho libre de pasillos principales y vallas de fila',
        'Supervisar picos en baños y comida antes y después de las funciones',
      ],
      fr: [
        'Maintenir la largeur utile des allées principales et le balisage des files',
        'Surveiller les pics aux sanitaires et stands repas lors des transitions spectacle',
      ],
    },
  },
  rain: {
    name: {
      ko: '우천·집중호우 시나리오',
      en: 'Rain & Wet Surface',
      ja: '降雨・濡れ路面シナリオ',
      zh: '降雨与湿滑地面场景',
      es: 'Lluvia y Suelo Mojado',
      fr: 'Pluie & Sol Humide',
    },
    trigger: {
      ko: '강수 발생 및 바닥 미끄럼·배수 주의',
      en: 'Active rainfall, umbrella crowding, and wet floor slip risk',
      ja: '降水発生および傘使用・床面滑りリスク上昇',
      zh: '出现降雨、雨伞占用空间扩大及地面湿滑风险上升',
      es: 'Precipitación activa, uso de paraguas y riesgo de suelo resbaladizo',
      fr: 'Pluie active, encombrement des parapluies et risque de glissade',
    },
    impact: {
      ko: '비가림 캐노피·지붕형 부스로 밀집 증가 및 보행 속도 18% 저하',
      en: 'Rapid clustering under covered canopies/booths and 18% slower walking speed',
      ja: '屋根付きキャノピーやブースへの密集増加と歩行速度18%低下',
      zh: '人群快速向遮雨棚与有顶展位聚集，步行速度降低约18%',
      es: 'Concentración rápida bajo carpas cubiertas y caída del 18% en velocidad peatonal',
      fr: 'Regroupement rapide sous les auvents couverts et baisse de 18 % de la vitesse de marche',
    },
    actions: {
      ko: [
        '대형 우천 대피 캐노피(rain_canopy) 확충 및 물고임 구간 분전반 이격',
        '경사로·출입구 미끄럼 방지 매트 및 우천용 누전차단·케이블 프로텍터 점검',
      ],
      en: [
        'Add large rain shelter canopies and keep power distribution clear of puddles',
        'Install non-slip mats on ramps/gates and inspect waterproof cable ramps',
      ],
      ja: [
        '大型雨天退避キャノピーを増設し、水たまり箇所から分電盤を離隔',
        'スロープ・出入口の滑り止めマットおよび漏電遮断器・ケーブル保護を点検',
      ],
      zh: [
        '增设大型避雨天幕并将配电箱远离低洼积水点',
        '铺设坡道与出入口防滑垫，检查防水过线桥与漏电保护器',
      ],
      es: [
        'Ampliar carpas refugio de lluvia y alejar cuadros eléctricos de charcos',
        'Colocar alfombras antideslizantes en rampas/puertas y revisar pasacables estancos',
      ],
      fr: [
        'Renforcer les grands auvents abris-pluie et isoler les coffrets électriques',
        'Poser des tapis antidérapants sur rampes/portes et vérifier les passe-câbles étanches',
      ],
    },
  },
  strong_wind: {
    name: {
      ko: '강풍·돌풍 시나리오',
      en: 'Strong Wind & Gusts',
      ja: '強風・突風シナリオ',
      zh: '强风与阵风场景',
      es: 'Viento Fuerte y Ráfagas',
      fr: 'Vent Fort & Rafales',
    },
    trigger: {
      ko: '순간풍속 주의 구간 진입',
      en: 'Peak wind gusts approaching temporary tent limits',
      ja: '瞬間風速が仮設テント注意基準に接近',
      zh: '瞬时阵风接近临时帐篷与充气设施安全上限',
      es: 'Ráfagas de viento cercanas al límite de carpas temporales',
      fr: 'Rafales approchant les limites des structures temporaires',
    },
    impact: {
      ko: '텐트·에어바운스·배너 전도 위험으로 일시 운영 중지 및 동선 우회',
      en: 'Temporary suspension of air-bounce/tall banners and rerouted pedestrian flow',
      ja: 'テント・エア遊具・バナー転倒防止のため一時休止および動線迂回',
      zh: '帐篷、充气游乐设施与高耸旗帜存在倾覆风险，需暂停开放并引导绕行',
      es: 'Suspensión preventiva de inflables/banderolas altas y desvío peatonal',
      fr: 'Arrêt préventif des structures gonflables/oriflammes et déviation des flux',
    },
    actions: {
      ko: [
        '천막·캐노피·포토존 하부 웨이트 고정 보강 및 강풍 시 하강 기준 적용',
        '에어바운스 놀이존 즉시 송풍 중단·퇴거 및 무대 음향 타워 풍하중 확인',
      ],
      en: [
        'Reinforce ballast weights on tents, canopies, and tall photo zones',
        'Deflate inflatable play zones immediately and verify stage rigging wind loads',
      ],
      ja: [
        'テント・キャノピー・縦型フォトゾーンのウェイト固定を強化',
        'エア遊具の送風停止・退避手順とステージトラス風荷重を確認',
      ],
      zh: [
        '加固帐篷、天幕及立式拍照区底部配重锚固',
        '立即执行充气游乐区停风清场规程并复核舞台吊挂风荷载',
      ],
      es: [
        'Reforzar lastres en carpas, toldos y tótems verticales de fotos',
        'Desinflar zonas infantiles de inmediato y verificar carga de viento en escenario',
      ],
      fr: [
        'Renforcer le lestage des tentes, auvents et totems photo verticaux',
        'Dégonfler immédiatement les jeux gonflables et contrôler la prise au vent scénique',
      ],
    },
  },
  heatwave: {
    name: {
      ko: '폭염·고온 시나리오',
      en: 'Heatwave & High WBGT',
      ja: '猛暑・高温シナリオ',
      zh: '高温热浪场景',
      es: 'Ola de Calor y Alta Temperatura',
      fr: 'Canicule & Forte Chaleur',
    },
    trigger: {
      ko: '체감온도 31°C 이상 및 온열질환 주의',
      en: 'Heat index >= 31°C with elevated heat-stress exposure',
      ja: '暑さ指数上昇・体感31°C以上の高温環境',
      zh: '体感温度31°C以上，热射病风险上升',
      es: 'Sensación térmica >= 31°C y exposición solar intensa',
      fr: 'Température ressentie >= 31 °C et fort stress thermique',
    },
    impact: {
      ko: '그늘막·쿨링포그·음료 부스 대기 급증 및 어르신·어린이 휴식 수요 증가',
      en: 'Surging demand at shade canopies, mist arches, beverage booths, and first-aid cooling',
      ja: '日除け・ミスト・飲料ブースへの集中および高齢者・子どもの休憩需要増加',
      zh: '遮阳棚、喷雾降温门、饮品展位排队激增，老人儿童降温休息需求上升',
      es: 'Alta demanda en sombras, arcos nebulizadores, bebidas y puestos médicos',
      fr: 'Forte affluence sous les ombrières, arches brumisantes, boissons et postes médicaux',
    },
    actions: {
      ko: [
        '그늘막(rain_canopy), 파라솔 쉼터(rest_plaza), 쿨링포그(mist_cooling) 증설',
        '의무실 냉방 전력 확보 및 온열질환 이송 통로 상시 개방',
      ],
      en: [
        'Add shade canopies, parasol rest plazas, and walk-through cooling mist arches',
        'Ensure medical tent HVAC power and unobstructed ambulance extraction lanes',
      ],
      ja: [
        '日除けキャノピー・パラソル休憩所・冷却ミストアーチを増設',
        '救護室の冷房電源確保と救急搬送ルートの常時開放を維持',
      ],
      zh: [
        '增设遮阳天幕、遮阳伞休息区与喷雾降温走廊',
        '保障医疗站空调供电并保持救护车转运通道畅通',
      ],
      es: [
        'Añadir toldos de sombra, plazas con sombrillas y arcos de niebla fría',
        'Asegurar climatización en puesto médico y vía libre de ambulancia',
      ],
      fr: [
        'Ajouter ombrières tendues, places parasols et arches de brumisation',
        'Garantir la climatisation du poste médical et le couloir ambulance dégagé',
      ],
    },
  },
  cold_wave: {
    name: {
      ko: '저온·야간 한기 시나리오',
      en: 'Cold Snap & Chilly Night',
      ja: '低温・夜間冷え込みシナリオ',
      zh: '低温与夜间寒潮场景',
      es: 'Baja Temperatura Nocturna',
      fr: 'Fraîcheur & Nuit Froide',
    },
    trigger: {
      ko: '야간 기온 하강 및 난방 부하 증가',
      en: 'Evening temperature drop increasing heater & warm-drink demand',
      ja: '夜間の気温低下および暖房・温飲料需要増加',
      zh: '夜间气温骤降，取暖设备与热饮需求上升',
      es: 'Descenso térmico nocturno y mayor uso de calefactores',
      fr: 'Chute thermique nocturne et hausse des besoins en chauffage',
    },
    impact: {
      ko: '방풍형 부스·온음료 대기 집중 및 전열기 사용에 따른 전력·화기 점검 필요',
      en: 'Longer queues at warm beverage stalls and higher electrical load from heaters',
      ja: '防風テント・温飲料ブースへの集中および暖房器具による電力負荷上昇',
      zh: '防风展位与热饮区排队增加，电暖器与燃气取暖带来更高电力消防负荷',
      es: 'Concentración en carpas cortaviento y mayor carga eléctrica por calefacción',
      fr: 'Concentration vers les tentes coupe-vent et charge électrique accrue des chauffages',
    },
    actions: {
      ko: [
        '방풍 가림막 쉼터 확보 및 전기 난방기 추가 전력(kW) 여유율 반영',
        '화기·난방기 주변 소화기 비치 및 안전 이격거리 점검',
      ],
      en: [
        'Provide wind-shielded rest lounges and include heater kW margin in generator sizing',
        'Verify fire extinguishers and safe clearance around all heating appliances',
      ],
      ja: [
        '防風シェルター休憩所を確保し、電気暖房の追加電力(kW)を反映',
        '暖房器具周辺の消火器配置と可燃物離隔距離を点検',
      ],
      zh: [
        '增设防风休息区并将电暖设备负荷纳入发电机余量核算',
        '核查取暖器具周边灭火器配置与可燃物安全间距',
      ],
      es: [
        'Habilitar refugios cortaviento y sumar margen eléctrico (kW) para calefactores',
        'Verificar extintores y distancias de seguridad junto a equipos térmicos',
      ],
      fr: [
        'Prévoir des abris coupe-vent et intégrer la puissance (kW) des chauffages',
        'Vérifier la présence d’extincteurs et les distances de sécurité incendie',
      ],
    },
  },
  night_ops: {
    name: {
      ko: '야간 공연·폐장 퇴장 시나리오',
      en: 'Nighttime Show & Mass Egress',
      ja: '夜間公演・一斉退場シナリオ',
      zh: '夜间演出与集中退场场景',
      es: 'Función Nocturna y Salida Masiva',
      fr: 'Spectacle Nocturne & Sortie Massive',
    },
    trigger: {
      ko: '일몰 이후 조도 저하 + 폐장 시간대 대규모 퇴장',
      en: 'Post-sunset low ambient light combined with end-of-show mass departure',
      ja: '日没後の照度低下＋終演直後の大規模退場',
      zh: '日落后照度下降叠加散场时段大规模离场',
      es: 'Baja iluminación nocturna combinada con salida masiva al cierre',
      fr: 'Baisse de luminosité nocturne combinée au départ massif en fin de soirée',
    },
    impact: {
      ko: '시야가 좁아진 상태에서 출입구·외부 주차장·셔틀 정류장으로 퇴장 인파 집중',
      en: 'Outbound surges toward gates, exterior parking lots, and shuttle bays under night visibility',
      ja: '視認性が下がる中、出入口ゲート・外部駐車場・シャトル乗場へ退場者が集中',
      zh: '夜间视野受限下，退场人流向出入口、外部停车场与接驳车站集中',
      es: 'Flujo intenso hacia puertas, estacionamiento exterior y lanzaderas con menor visibilidad',
      fr: 'Fort afflux vers les portes, parkings extérieurs et navettes sous visibilité réduite',
    },
    actions: {
      ko: [
        '출입구·경사로·화장실·외부 주차장 연결로 조명타워 및 발광 유도 사인 강화',
        '교통약자 전용 완만 퇴장 동선 분리 운영 및 시차 퇴장 안내',
      ],
      en: [
        'Boost floodlight towers and illuminated signage along gates, ramps, and parking links',
        'Operate dedicated step-free priority egress lanes and staggered exit announcements',
      ],
      ja: [
        '出入口・スロープ・外部駐車場連絡路の投光照明と発光誘導サインを強化',
        '配慮者専用バリアフリー退場路の分離運用と時差退場アナウンスを実施',
      ],
      zh: [
        '加强出入口、坡道、洗手间及外部停车场连廊投光灯塔与发光导向标识',
        '严格分流无障碍专用平缓退场通道并实施分批错峰退场广播',
      ],
      es: [
        'Reforzar torres de iluminación y señalética luminosa en puertas, rampas y parking',
        'Operar carriles exclusivos sin escalones y salida escalonada por zonas',
      ],
      fr: [
        'Renforcer les mâts d’éclairage et la signalétique lumineuse vers portes et parkings',
        'Maintenir le couloir de sortie sans marche PMR et annoncer des sorties échelonnées',
      ],
    },
  },
};
