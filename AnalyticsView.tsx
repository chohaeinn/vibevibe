import React, { useState } from 'react';
import {
  ArrowLeft,
  Search,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  RotateCcw,
  MinusCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  EventConfig,
  Facility,
  FieldCalibrationSample,
  Language,
  LayoutMetricsSummary,
  Recommendation,
  SimulationAssumptions,
  SimulationSnapshot,
  SpatialSafetyAudit,
} from '../types/festival';
import {
  densityUnitLabel,
  getLocalizedDensityProfile,
} from '../engine/evidenceBase';
import { computeCrowdRecord11_2 } from '../engine/knowledgeDatabase';
import {
  formatCurrency,
  getFacilityDisplayName,
} from '../engine/presets';
import { tr6 } from '../i18n/localeCatalog';
import { CATEGORY_SIMPLE_LABELS, CONTINGENCY_MULTILANG, tUi } from '../i18n/translations';

interface AnalyticsViewProps {
  language: Language;
  config: EventConfig;
  facilities: Facility[];
  snapshot: SimulationSnapshot;
  summary: LayoutMetricsSummary;
  safetyAudit: SpatialSafetyAudit;
  assumptions: SimulationAssumptions;
  onChangeAssumptions: (next: SimulationAssumptions) => void;
  calibration: FieldCalibrationSample;
  onChangeCalibration: (next: FieldCalibrationSample) => void;
  onScrubProgress?: (progress: number) => void;
  recommendations?: Recommendation[];
  onApplyRecommendation?: (actionType: NonNullable<Recommendation['actionType']>) => void;
  onToggleBudgetExcluded?: (id: string) => void;
  onInspectFacilityIn3D: (id: string) => void;
  onBackToWorkspace: () => void;
}

const SNAPSHOT_PRESETS: Array<{
  progress: number;
  time: string;
  ko: string;
  en: string;
  ja: string;
  zh: string;
  es: string;
  fr: string;
}> = [
  {
    progress: 0.04,
    time: '10:00',
    ko: '개장 입장',
    en: 'Opening',
    ja: '開場入場',
    zh: '开场入场',
    es: 'Apertura',
    fr: 'Ouverture',
  },
  {
    progress: 0.36,
    time: '14:30',
    ko: '낮 부스 체험',
    en: 'Midday Booths',
    ja: '昼ブース体験',
    zh: '午间展位体验',
    es: 'Stands mediodía',
    fr: 'Stands midi',
  },
  {
    progress: 0.78,
    time: '19:30',
    ko: '피크 메인 공연',
    en: 'Headline Peak',
    ja: 'ピーク公演',
    zh: '主演出高峰',
    es: 'Pico principal',
    fr: 'Pic spectacle',
  },
  {
    progress: 0.94,
    time: '21:30',
    ko: '폐장 집중 퇴장',
    en: 'Closing Egress',
    ja: '閉場一斉退場',
    zh: '散场集中退场',
    es: 'Salida cierre',
    fr: 'Sortie finale',
  },
];

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  language,
  config,
  facilities,
  snapshot,
  summary,
  safetyAudit,
  assumptions,
  onChangeAssumptions,
  calibration,
  onScrubProgress,
  recommendations = [],
  onApplyRecommendation,
  onToggleBudgetExcluded,
  onInspectFacilityIn3D,
  onBackToWorkspace,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const ui = tUi(language);
  const dUnit = densityUnitLabel(language);
  const prof = getLocalizedDensityProfile(assumptions.densityProfile, language);
  const crowdRecord = computeCrowdRecord11_2(config, snapshot, calibration, language);
  const isNonPerformanceEvent =
    config.stagePlacement === 'projector_screen' ||
    config.stagePlacement === 'none' ||
    (!facilities.some((f) => f.subtype === 'main_stage') &&
      (facilities.some((f) => f.subtype === 'beam_projector') ||
        config.eventType === 'exhibition' ||
        config.eventType === 'career_fair'));
  const excludedBudgetCount = facilities.filter((f) => f.budgetExcluded).length;

  const filteredFacilities = facilities.filter((f) => {
    const q = searchTerm.toLowerCase();
    const disp = getFacilityDisplayName(f, language).toLowerCase();
    return (
      disp.includes(q) ||
      f.name.toLowerCase().includes(q) ||
      (f.nameKo && f.nameKo.toLowerCase().includes(q)) ||
      f.category.toLowerCase().includes(q)
    );
  });

  const openGates = safetyAudit.gateFlows.filter((g) => !g.isClosedInScenario);
  const maxGateLoadPct = openGates.reduce((m, g) => Math.max(m, g.loadRatioPct), 0);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-[1260px] mx-auto space-y-6">
        {/* Concise Header + Self-Explanatory Simulation Time-Point Selector */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={onBackToWorkspace}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline mb-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{ui.navWorkspace}</span>
            </button>
            <h1 className="text-xl font-bold text-slate-900">
              {tr6(
                language,
                '동선·밀도 분석',
                'Flow & Density Analytics',
                '動線・密度分析',
                '动线与密度分析',
                'Análisis de flujo y densidad',
                'Analyse des flux et densités',
              )}
            </h1>
          </div>

          {/* Explains clearly why a time-point & planning assumption are shown, with 1-click jump */}
          <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 text-xs text-slate-700">
              <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="font-semibold">
                {tr6(
                  language,
                  '분석 기준 시간대:',
                  'Snapshot Time:',
                  '分析基準時間帯:',
                  '当前分析时间点:',
                  'Hora analizada:',
                  'Heure analysée :',
                )}
              </span>
              <span className="font-mono font-bold text-blue-700 tabular-nums">
                {snapshot.currentTimeLabel}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-[11px] text-slate-500">
                {CONTINGENCY_MULTILANG[snapshot.contingency]?.[language] || snapshot.contingency}
              </span>
            </div>

            {onScrubProgress && (
              <div className="flex flex-wrap items-center gap-1">
                {SNAPSHOT_PRESETS.map((preset) => {
                  const isCurrent = Math.abs(snapshot.progress - preset.progress) < 0.09;
                  const label =
                    preset.progress === 0.78 && isNonPerformanceEvent
                      ? tr6(
                          language,
                          '피크 메인 세션',
                          'Main Session Peak',
                          'メインセッション',
                          '主会议高峰',
                          'Pico sesión',
                          'Pic session',
                        )
                      : tr6(
                          language,
                          preset.ko,
                          preset.en,
                          preset.ja,
                          preset.zh,
                          preset.es,
                          preset.fr,
                        );
                  return (
                    <button
                      key={preset.time}
                      type="button"
                      onClick={() => onScrubProgress(preset.progress)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer tabular-nums ${
                        isCurrent
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {preset.time} {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Crowd Counting Separation Strip */}
        <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {tr6(
                  language,
                  '방문객 집계 4분리 (일일 누적 연인원 ≠ 현재 동시 재실 인원)',
                  'Separated Attendance Accounting (Daily Cumulative vs. Simultaneous)',
                  '来場者集計4分離（1日累計延べ人数 ≠ 現在同時滞留人数）',
                  '访客统计四分离（单日累计人次 ≠ 当前同时在场人数）',
                  'Conteo separado (acumulado diario ≠ ocupación simultánea)',
                  'Comptage séparé (cumul journalier ≠ présence simultanée)',
                )}
              </h2>
              <p className="text-xs text-slate-500">
                {tr6(
                  language,
                  '선택한 분석 시간대의 기획 시뮬레이션 추정치이며, 순수 보행 가용면적 기준으로 동시 재실 밀도를 산정합니다.',
                  'Planning simulation estimates at the selected time-point, computing simultaneous density over net walkable area.',
                  '選択した時間帯の企画シミュレーション推定値であり、純歩行可能面積基準で同時密度を算出します。',
                  '所选时间点的规划模拟估算值，基于净步行可用面积计算同时在场密度。',
                  'Estimación de simulación en la hora seleccionada sobre el área peatonal neta.',
                  'Estimation de simulation à l’heure choisie sur la surface piétonne nette.',
                )}
              </p>
            </div>
            <span className="text-xs font-mono text-slate-600 tabular-nums">
              {tr6(language, '순수 가용면적', 'Net Usable Area', '純有効面積', '净可用面积', 'Área útil neta', 'Surface utile nette')}: {summary.usableAreaSqm.toLocaleString()}m²
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs tabular-nums">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="font-sans text-[11px] text-slate-500">
                {tr6(language, '하루 누적 방문객 (연인원)', 'Est. Daily Cumulative', '1日累計来場者', '单日累计访客', 'Acumulado diario', 'Cumul journalier')}
              </div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {crowdRecord.dailyCumulativeVisitors.toLocaleString()} {ui.paxUnit}
              </div>
              <div className="font-sans text-[10px] text-slate-500">
                {tr6(language, '회전율 반영 누적치 (밀도 산정 제외)', 'Turnover-adjusted total', '回転率反映累計（密度算出除外）', '含周转率累计（不计入瞬时密度）', 'Total con rotación', 'Total avec rotation')}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200">
              <div className="font-sans text-[11px] text-blue-800 font-semibold">
                {tr6(
                  language,
                  `현재 동시 재실 (${snapshot.currentTimeLabel})`,
                  `Simultaneous (${snapshot.currentTimeLabel})`,
                  `同時滞留 (${snapshot.currentTimeLabel})`,
                  `当前同时在场 (${snapshot.currentTimeLabel})`,
                  `Simultáneos (${snapshot.currentTimeLabel})`,
                  `Simultanés (${snapshot.currentTimeLabel})`,
                )}
              </div>
              <div className="text-base font-bold text-blue-900 mt-0.5">
                {crowdRecord.simultaneousOccupancy.toLocaleString()} {ui.paxUnit}
              </div>
              <div className="font-sans text-[10px] text-blue-700">
                {tr6(
                  language,
                  `피크 목표 ${crowdRecord.peakTargetSimultaneous.toLocaleString()}명 기준`,
                  `Peak target ${crowdRecord.peakTargetSimultaneous.toLocaleString()}`,
                  `ピーク目標 ${crowdRecord.peakTargetSimultaneous.toLocaleString()}名`,
                  `峰值目标 ${crowdRecord.peakTargetSimultaneous.toLocaleString()}人`,
                  `Meta pico ${crowdRecord.peakTargetSimultaneous.toLocaleString()}`,
                  `Cible pic ${crowdRecord.peakTargetSimultaneous.toLocaleString()}`,
                )}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="font-sans text-[11px] text-slate-500">
                {tr6(language, '15분 유입 / 유출', '15-min Inflow / Outflow', '15分流入 / 流出', '15分钟流入 / 流出', 'Entrada / Salida 15m', 'Entrées / Sorties 15m')}
              </div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                +{crowdRecord.arrivals15m.toLocaleString()} / -{crowdRecord.departures15m.toLocaleString()} {ui.paxUnit}
              </div>
              <div className="font-sans text-[10px] text-slate-500">
                {tr6(language, '시간대 단계 연동 유출입량', 'Schedule-linked flow', '時間帯連動の入退場数', '按日程阶段联动进出量', 'Flujo según horario', 'Flux lié au programme')}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="font-sans text-[11px] text-slate-500">
                {tr6(language, '권역별 체류 분포', 'Zone Occupancy Split', 'ゾーン別滞留内訳', '各分区停留分布', 'Ocupación por zona', 'Répartition par zone')}
              </div>
              <div className="text-xs font-bold text-slate-900 mt-1">
                {tr6(language, '무대', 'Stage', '舞台', '舞台', 'Esc.', 'Scène')}{' '}
                {crowdRecord.zoneOccupancy.stageAndSeating.toLocaleString()} ·{' '}
                {tr6(language, '푸드', 'Food', '飲食', '餐饮', 'Comida', 'F&B')}{' '}
                {crowdRecord.zoneOccupancy.foodAndRest.toLocaleString()} ·{' '}
                {tr6(language, '부스', 'Booth', 'ブース', '展位', 'Stands', 'Stands')}{' '}
                {crowdRecord.zoneOccupancy.boothsAndCorridors.toLocaleString()}
              </div>
              <div className="font-sans text-[10px] text-slate-500 truncate">
                {crowdRecord.countMethod}
              </div>
            </div>
          </div>
        </section>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
            <h2 className="text-sm font-bold text-slate-900">
              {tr6(
                language,
                `시간대별 피크 밀도 추이 (${prof.sourceLocation})`,
                `Time-of-Day Peak Density (${prof.sourceLocation})`,
                `時間帯別ピーク密度推移（${prof.sourceLocation}）`,
                `分时段峰值密度趋势（${prof.sourceLocation}）`,
                `Curva de densidad pico (${prof.sourceLocation})`,
                `Courbe de densité de pointe (${prof.sourceLocation})`,
              )}
            </h2>
            <p className="text-xs text-slate-500">
              {tr6(
                language,
                `여유 ≤${prof.cautionStart}, 주의 ${prof.warningStart}~, 위험 ≥${prof.dangerStart} ${dUnit} 참고선 표시`,
                `Reference bands: Comfort ≤${prof.cautionStart}, Caution ${prof.warningStart}+, High-Risk ≥${prof.dangerStart} ${dUnit}`,
                `余裕 ≤${prof.cautionStart}、注意 ${prof.warningStart}〜、危険 ≥${prof.dangerStart} ${dUnit}`,
                `参考线：舒适 ≤${prof.cautionStart}，注意 ${prof.warningStart}~，高风险 ≥${prof.dangerStart} ${dUnit}`,
                `Bandas: Cómodo ≤${prof.cautionStart}, Precaución ${prof.warningStart}+, Riesgo ≥${prof.dangerStart} ${dUnit}`,
                `Seuils : Confort ≤${prof.cautionStart}, Vigilance ${prof.warningStart}+, Risque ≥${prof.dangerStart} ${dUnit}`,
              )}
            </p>
            <div className="h-64 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={snapshot.timelineSeries}
                  margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="timeLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ fontSize: '12px', borderRadius: '8px', borderColor: '#e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <ReferenceLine
                    y={prof.cautionStart}
                    stroke="#059669"
                    strokeDasharray="3 3"
                    label={{
                      value: `${prof.cautionStart}`,
                      position: 'insideTopLeft',
                      fill: '#047857',
                      fontSize: 10,
                    }}
                  />
                  <ReferenceLine
                    y={prof.warningStart}
                    stroke="#d97706"
                    strokeDasharray="4 4"
                    label={{
                      value: `${prof.warningStart}`,
                      position: 'insideTopRight',
                      fill: '#b45309',
                      fontSize: 10,
                    }}
                  />
                  <ReferenceLine
                    y={prof.dangerStart}
                    stroke="#dc2626"
                    strokeDasharray="4 4"
                    label={{
                      value: `${prof.dangerStart}`,
                      position: 'insideBottomRight',
                      fill: '#b91c1c',
                      fontSize: 10,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="peakDensity"
                    name={tr6(language, `국소 피크 밀도 (${dUnit})`, `Localized Peak (${dUnit})`, `局所ピーク密度 (${dUnit})`, `局部峰值密度 (${dUnit})`, `Pico local (${dUnit})`, `Pic local (${dUnit})`)}
                    stroke="#dc2626"
                    strokeWidth={2.2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgDensity"
                    name={tr6(language, `활성 구역 평균 (${dUnit})`, `Active Avg (${dUnit})`, `活動区域平均 (${dUnit})`, `活跃区平均 (${dUnit})`, `Promedio activo (${dUnit})`, `Moyenne active (${dUnit})`)}
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 가장 고밀도 요소 표시 (Concise Highest-Density Element) */}
            {(() => {
              const isKo = language === 'ko';
              const topBottleneck = snapshot.bottlenecks[0];
              const topFacility = snapshot.mostCongestedFacilityId
                ? facilities.find((f) => f.id === snapshot.mostCongestedFacilityId)
                : topBottleneck
                ? facilities.find((f) => f.id === topBottleneck.facilityId)
                : null;
              const topFacilityName = topFacility
                ? getFacilityDisplayName(topFacility, language)
                : topBottleneck
                ? topBottleneck.facilityName
                : snapshot.mostCongestedZone || (isKo ? '메인 무대 전면' : 'Main Stage Front');
              const topQueue = topFacility
                ? (snapshot.facilityQueues[topFacility.id] || topBottleneck?.estimatedQueue || 0)
                : (topBottleneck?.estimatedQueue || 0);

              return (
                <div className="pt-2.5 mt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                    <span>
                      {tr6(
                        language,
                        '가장 고밀도 요소',
                        'Highest-Density Element',
                        '最高密度要素',
                        '最高密度要素',
                        'Elemento de mayor densidad',
                        'Élément le plus dense',
                      )}
                      :
                    </span>
                    <span className="text-slate-900 font-bold">{topFacilityName}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono tabular-nums text-slate-600">
                    <span>
                      {tr6(language, '피크 밀도', 'Peak', 'ピーク密度', '峰值密度', 'Pico', 'Pic')}:{' '}
                      <strong className="text-red-600">
                        {snapshot.peakDensity.toFixed(2)} {dUnit}
                      </strong>
                    </span>
                    {topQueue > 0 && (
                      <span>
                        {tr6(language, '예상 대기', 'Est. Queue', '予想待ち', '预计排队', 'Espera', 'Attente')}:{' '}
                        <strong className="text-slate-900">
                          ~{topQueue}
                          {tr6(language, '명', ' pax', '名', '人', ' pers.', ' pers.')}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
            <h2 className="text-sm font-bold text-slate-900">
              {tr6(
                language,
                '시간대별 권역 수요 이동 비중 (%)',
                'Zone Demand Shift by Schedule Phase (%)',
                '時間帯別ゾーン需要推移（%）',
                '各时段分区客流占比（%）',
                'Demanda por zona según horario (%)',
                'Répartition par zone selon l’horaire (%)',
              )}
            </h2>
            <p className="text-xs text-slate-500">
              {tr6(
                language,
                '공연 직전 집결, 직후 식음·화장실 이동, 폐장 퇴장 등 전환 구간의 쏠림을 점검합니다.',
                'Highlights crowd surges across stage, food, and booth zones during schedule transitions.',
                '開演前の集結、終演後の飲食・トイレ移動、閉場退場などの集中を確認します。',
                '检查演出前集结、演出后餐饮如厕转移及散场退场等转换时段的客流集中情况。',
                'Muestra cambios de demanda entre escenario, comida y stands.',
                'Montre les transferts de foule entre scène, restauration et stands.',
              )}
            </p>
            <div className="h-64 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={snapshot.timelineSeries}
                  margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="timeLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ fontSize: '12px', borderRadius: '8px', borderColor: '#e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar
                    dataKey="stageZoneShare"
                    name={tr6(language, '무대·관람석 %', 'Stage & Seating %', '舞台・観客席 %', '舞台观演区 %', 'Escenario %', 'Scène %')}
                    stackId="a"
                    fill="#2563eb"
                  />
                  <Bar
                    dataKey="foodZoneShare"
                    name={tr6(language, '푸드·휴게존 %', 'Food & Rest %', '飲食・休憩 %', '餐饮休息区 %', 'Comida %', 'Restauration %')}
                    stackId="a"
                    fill="#f97316"
                  />
                  <Bar
                    dataKey="boothZoneShare"
                    name={tr6(language, '체험부스 %', 'Booths %', '体験ブース %', '体验展位 %', 'Stands %', 'Stands %')}
                    stackId="a"
                    fill="#0d9488"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Zone-Differentiated Crowd Mechanics */}
        <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {tr6(
                language,
                '구역별 군중 거동 분리 진단 (광장 체류 · 통로 교행 · 출입구 유출)',
                'Zone-Differentiated Crowd Mechanics (Plaza · Corridors · Portals)',
                '区域別群衆挙動の分離診断（広場滞留・通路交錯・出入口流出）',
                '分区人群行为独立诊断（广场驻留·通道交织·出入口疏散）',
                'Diagnóstico por tipo de zona (plaza · pasillos · accesos)',
                'Diagnostic différencié par zone (esplanade · allées · accès)',
              )}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {safetyAudit.zoneProfiles.map((zp) => (
              <div
                key={zp.zoneId}
                className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    {language === 'ko' ? zp.zoneNameKo : zp.zoneNameEn}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-blue-700 tabular-nums">
                    {zp.peakDensity.toFixed(2)} {dUnit}
                  </span>
                </div>
                <div className="text-[11px] font-medium text-slate-700">
                  {language === 'ko' ? zp.modelRepresentationKo : zp.modelRepresentationEn}
                </div>
                <div className="text-[11px] font-mono text-slate-600 tabular-nums">
                  {tr6(
                    language,
                    `이동속도: ${zp.assumedSpeedMps} m/s`,
                    `Speed: ${zp.assumedSpeedMps} m/s`,
                    `移動速度: ${zp.assumedSpeedMps} m/s`,
                    `移动速度: ${zp.assumedSpeedMps} m/s`,
                    `Velocidad: ${zp.assumedSpeedMps} m/s`,
                    `Vitesse : ${zp.assumedSpeedMps} m/s`,
                  )}
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {zp.dwellCharacteristicKo}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Actionable Flow & Gate Recommendations (Exterior Transit Capacity removed per user request) */}
        <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {tr6(
                  language,
                  '동선·출입구 개선 추천 사항 목록 (시뮬레이션 비교 연동)',
                  'Flow & Gate Improvement Recommendations (Simulation-Linked)',
                  '動線・出入口改善の推奨リスト（シミュレーション比較連動）',
                  '动线与出入口优化建议列表（联动模拟对比）',
                  'Recomendaciones de flujo y accesos (vinculadas a simulación)',
                  'Recommandations flux et accès (liées à la simulation)',
                )}
              </h2>
              <p className="text-xs text-slate-500">
                {tr6(
                  language,
                  `개방 출입구 ${openGates.length}곳 · 최대 부하율 ${maxGateLoadPct}% · 평시 개방 ${safetyAudit.scenarioEgressComparisonSec.nominalOpenSec}초 vs 현재 조건 ${safetyAudit.scenarioEgressComparisonSec.currentAssumptionsSec}초`,
                  `Open gates: ${openGates.length} · Max gate load: ${maxGateLoadPct}% · Nominal ${safetyAudit.scenarioEgressComparisonSec.nominalOpenSec}s vs Current ${safetyAudit.scenarioEgressComparisonSec.currentAssumptionsSec}s`,
                  `開放出入口 ${openGates.length}箇所・最大負荷率 ${maxGateLoadPct}%（通常 ${safetyAudit.scenarioEgressComparisonSec.nominalOpenSec}秒 vs 現在 ${safetyAudit.scenarioEgressComparisonSec.currentAssumptionsSec}秒）`,
                  `开放出入口 ${openGates.length}处 · 最大负荷率 ${maxGateLoadPct}%（全开 ${safetyAudit.scenarioEgressComparisonSec.nominalOpenSec}秒 vs 当前 ${safetyAudit.scenarioEgressComparisonSec.currentAssumptionsSec}秒）`,
                  `Accesos abiertos: ${openGates.length} · Carga máx.: ${maxGateLoadPct}%`,
                  `Accès ouverts : ${openGates.length} · Charge max. : ${maxGateLoadPct}%`,
                )}
              </p>
            </div>

            <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={assumptions.closedPrimaryGate}
                onChange={(e) =>
                  onChangeAssumptions({ ...assumptions, closedPrimaryGate: e.target.checked })
                }
                className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
              />
              <span>
                {tr6(
                  language,
                  '출입구 1곳 폐쇄 시뮬레이션',
                  'Simulate 1 Gate Closed',
                  '出入口1箇所閉鎖を試す',
                  '模拟关闭1处出入口',
                  'Simular 1 acceso cerrado',
                  'Simuler 1 accès fermé',
                )}
              </span>
            </label>
          </div>

          <div className="space-y-2.5">
            {recommendations.map((rec) => {
              const title = language === 'ko' && rec.titleKo ? rec.titleKo : rec.title;
              const rationale =
                language === 'ko' && rec.rationaleKo ? rec.rationaleKo : rec.rationale;
              const actionLabel =
                language === 'ko' && rec.actionLabelKo ? rec.actionLabelKo : rec.actionLabel;
              const isHigh = rec.severity === 'high';

              return (
                <div
                  key={rec.id}
                  className={`p-3 rounded-lg border space-y-1.5 ${
                    isHigh
                      ? 'bg-amber-50/60 border-amber-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      {isHigh ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      )}
                      <span>{title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0 tabular-nums">
                      {rec.metricTrigger}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{rationale}</p>

                  {rec.actionType && actionLabel && onApplyRecommendation && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => onApplyRecommendation(rec.actionType!)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-blue-50 border border-slate-300 hover:border-blue-400 text-[11px] font-semibold text-blue-700 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{actionLabel}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Facility Inventory, Existing Booth Budget Exclusion & Live Occupancy Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  {tr6(
                    language,
                    `3D 배치 시설 명세 및 체류·대기 현황 (${filteredFacilities.length} / ${summary.totalFacilities}개)`,
                    `3D Facility Schedule & Modeled Load (${filteredFacilities.length} of ${summary.totalFacilities})`,
                    `3D配置施設明細および滞留・待機状況（${filteredFacilities.length} / ${summary.totalFacilities}件）`,
                    `3D设施清单与实时停留·排队状态（${filteredFacilities.length} / ${summary.totalFacilities}个）`,
                    `Inventario de instalaciones 3D y carga (${filteredFacilities.length} / ${summary.totalFacilities})`,
                    `Inventaire 3D des installations et charge (${filteredFacilities.length} / ${summary.totalFacilities})`,
                  )}
                </h2>
                <span className="text-[11px] font-mono font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded tabular-nums">
                  {tr6(
                    language,
                    `예산 합계 ${formatCurrency(summary.estimatedCost, language)}${excludedBudgetCount > 0 ? ` (기존 시설 ${excludedBudgetCount}개 제외됨)` : ''}`,
                    `Budget Total ${formatCurrency(summary.estimatedCost, language)}${excludedBudgetCount > 0 ? ` (${excludedBudgetCount} existing excluded)` : ''}`,
                    `予算合計 ${formatCurrency(summary.estimatedCost, language)}${excludedBudgetCount > 0 ? `（既存${excludedBudgetCount}件除外）` : ''}`,
                    `预算合计 ${formatCurrency(summary.estimatedCost, language)}${excludedBudgetCount > 0 ? `（已排除${excludedBudgetCount}个既有设施）` : ''}`,
                    `Total presupuesto ${formatCurrency(summary.estimatedCost, language)}${excludedBudgetCount > 0 ? ` (${excludedBudgetCount} excl.)` : ''}`,
                    `Total budget ${formatCurrency(summary.estimatedCost, language)}${excludedBudgetCount > 0 ? ` (${excludedBudgetCount} excl.)` : ''}`,
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {tr6(
                  language,
                  '행을 클릭하면 3D 화면에서 해당 시설로 이동하며, 이미 행사장에 있는 상설 부스·시설은 [예산에서 제거] 버튼으로 설치비 산정에서 제외할 수 있습니다.',
                  'Click any row to edit in 3D, or exclude pre-existing on-site booths from the installation budget.',
                  '行をクリックで3D編集へ移動します。会場に既存のブースは「予算から除外」で設置費から外せます。',
                  '点击任意行可在3D中定位编辑；场馆原有展位可点击“移出预算”不计入搭建费用。',
                  'Haga clic en una fila para editar en 3D o excluya del presupuesto las instalaciones ya existentes.',
                  'Cliquez sur une ligne pour modifier en 3D ou excluez du budget les stands déjà présents sur site.',
                )}
              </p>
            </div>

            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={tr6(
                  language,
                  '시설명 또는 분류 검색...',
                  'Filter by facility or category...',
                  '施設名または分類で検索...',
                  '搜索设施名称或类别...',
                  'Buscar instalación o categoría...',
                  'Filtrer par nom ou catégorie...',
                )}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-medium">
                    {tr6(language, '시설명', 'Facility Name', '施設名', '设施名称', 'Instalación', 'Installation')}
                  </th>
                  <th className="py-2.5 px-4 font-medium">
                    {tr6(language, '분류', 'Category', '分類', '类别', 'Categoría', 'Catégorie')}
                  </th>
                  <th className="py-2.5 px-4 font-medium text-right">
                    {tr6(language, '3D 좌표 (X, Z)', 'Coords (X, Z)', '3D座標 (X, Z)', '3D坐标 (X, Z)', 'Coord. (X, Z)', 'Coord. (X, Z)')}
                  </th>
                  <th className="py-2.5 px-4 font-medium text-right">
                    {tr6(language, '규격', 'Footprint', '寸法', '尺寸', 'Dimensiones', 'Dimensions')}
                  </th>
                  <th className="py-2.5 px-4 font-medium text-right">
                    {tr6(language, '수용량', 'Unit Cap', '収容数', '容量', 'Capacidad', 'Capacité')}
                  </th>
                  <th className="py-2.5 px-4 font-medium text-right">
                    {tr6(
                      language,
                      `체류 (${snapshot.currentTimeLabel})`,
                      `Load (${snapshot.currentTimeLabel})`,
                      `滞留 (${snapshot.currentTimeLabel})`,
                      `在场 (${snapshot.currentTimeLabel})`,
                      `Carga (${snapshot.currentTimeLabel})`,
                      `Charge (${snapshot.currentTimeLabel})`,
                    )}
                  </th>
                  <th className="py-2.5 px-4 font-medium text-right">
                    {tr6(language, '대기열', 'Queue', '待機列', '排队', 'Cola', 'File')}
                  </th>
                  <th className="py-2.5 px-4 font-medium text-right">
                    {tr6(language, '설치 비용', 'Cost', '設置費', '安装费用', 'Costo', 'Coût')}
                  </th>
                  <th className="py-2.5 px-4 font-medium text-right">
                    {tr6(language, '예산 반영', 'Budget', '予算反映', '预算计入', 'Presupuesto', 'Budget')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {filteredFacilities.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center font-sans text-slate-500">
                      {tr6(
                        language,
                        `"${searchTerm}" 검색 결과가 없습니다.`,
                        `No facilities match "${searchTerm}".`,
                        `「${searchTerm}」に一致する施設がありません。`,
                        `未找到匹配“${searchTerm}”的设施。`,
                        `Sin resultados para "${searchTerm}".`,
                        `Aucun résultat pour « ${searchTerm} ».`,
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredFacilities.map((f) => {
                    const occ = snapshot.facilityOccupancy[f.id] || 0;
                    const q = snapshot.facilityQueues[f.id] || 0;
                    const isExcluded = Boolean(f.budgetExcluded);
                    return (
                      <tr
                        key={f.id}
                        onClick={() => onInspectFacilityIn3D(f.id)}
                        className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${
                          isExcluded ? 'bg-slate-50/70' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4 font-sans font-semibold text-slate-900">
                          <span>{getFacilityDisplayName(f, language)}</span>
                          {isExcluded && (
                            <span className="ml-1.5 inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                              {tr6(language, '기존 시설', 'Existing', '既存施設', '既有设施', 'Existente', 'Existant')}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-sans text-slate-600">
                          {CATEGORY_SIMPLE_LABELS[f.category]?.[language] || f.category}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-600">
                          ({Math.round(f.position.x)}, {Math.round(f.position.z)})
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-600">
                          {f.dimensions.width}m × {f.dimensions.depth}m
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-800">
                          {f.capacity.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-slate-900">
                          {occ.toLocaleString()}
                        </td>
                        <td
                          className={`py-2.5 px-4 text-right ${
                            q > 40 ? 'text-red-700 font-semibold' : 'text-slate-600'
                          }`}
                        >
                          {q}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {isExcluded ? (
                            <div className="flex flex-col items-end leading-tight">
                              <span className="font-bold text-emerald-700">
                                {formatCurrency(0, language)}
                              </span>
                              <span className="text-[10px] text-slate-400 line-through">
                                {formatCurrency(f.cost, language)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-700">{formatCurrency(f.cost, language)}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right font-sans">
                          {onToggleBudgetExcluded && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleBudgetExcluded(f.id);
                              }}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                                isExcluded
                                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-white hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-300 hover:border-red-300'
                              }`}
                            >
                              {isExcluded ? (
                                <>
                                  <RotateCcw className="w-3 h-3" />
                                  <span>
                                    {tr6(
                                      language,
                                      '예산 다시 포함',
                                      'Include Again',
                                      '予算に再計上',
                                      '重新计入预算',
                                      'Incluir de nuevo',
                                      'Réinclure',
                                    )}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <MinusCircle className="w-3 h-3" />
                                  <span>
                                    {tr6(
                                      language,
                                      '예산에서 제거',
                                      'Exclude Budget',
                                      '予算から除外',
                                      '移出预算',
                                      'Excluir costo',
                                      'Exclure du budget',
                                    )}
                                  </span>
                                </>
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
