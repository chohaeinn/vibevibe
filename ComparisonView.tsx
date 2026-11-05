import React from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw,
  FileText,
  Check,
  Lock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  CandidateLayout,
  EventConfig,
  Facility,
  KnowledgeFocusContext,
  Language,
  LayoutComparison,
} from '../types/festival';
import {
  BOOTH_MODEL_STYLE_LABELS,
  DEFAULT_FLOOR_SETTINGS,
  formatCurrency,
  INDOOR_FLOOR_PRESETS,
  MOIS_SAFETY_TIER_LABELS,
  OUTDOOR_FLOOR_PRESETS,
} from '../engine/presets';
import { densityUnitLabel } from '../engine/evidenceBase';
import {
  BOOTH_MODEL_STYLE_I18N,
  tr6,
  VENUE_LAYOUT_MODEL_I18N,
} from '../i18n/localeCatalog';
import { tUi } from '../i18n/translations';

interface ComparisonViewProps {
  language: Language;
  config: EventConfig;
  comparison: LayoutComparison;
  candidates: CandidateLayout[];
  approvedCandidateId: 'A' | 'B' | 'C' | 'D' | null;
  activeLayoutMode: 'original' | 'optimized';
  onPreviewCandidateIn3D: (candidate: CandidateLayout) => void;
  onApproveCandidate: (candidate: CandidateLayout) => void;
  onRegenerateCandidates: () => void;
  onOpenXaiReport: () => void;
  onOpenKnowledgeWithContext?: (ctx: KnowledgeFocusContext) => void;
  onActivateIn3D: (mode: 'original' | 'optimized') => void;
  onPromoteOptimizedToBaseline: () => void;
  onResolveBudgetOverrun?: () => void;
  onRaiseBudgetToCost?: (targetCostUsd: number) => void;
  onBackToWorkspace: () => void;
}

const VenueFootprintSvg: React.FC<{
  widthM: number;
  depthM: number;
  facilities: Facility[];
  baselineFacilities?: Facility[];
  floorConfig?: Pick<EventConfig, 'venueEnvironment' | 'floorSettings'>;
  highlightIds?: Set<string>;
  compact?: boolean;
}> = ({
  widthM,
  depthM,
  facilities,
  baselineFacilities,
  floorConfig,
  highlightIds,
  compact = false,
}) => {
  const halfW = widthM / 2;
  const halfD = depthM / 2;
  const gridStep = 20;
  const vLines: number[] = [];
  const hLines: number[] = [];
  for (let x = -Math.floor(halfW / gridStep) * gridStep; x <= halfW; x += gridStep) {
    vLines.push(x);
  }
  for (let z = -Math.floor(halfD / gridStep) * gridStep; z <= halfD; z += gridStep) {
    hLines.push(z);
  }

  let minBoxX = -halfW - 10;
  let maxBoxX = halfW + 10;
  let minBoxZ = -halfD - 10;
  let maxBoxZ = halfD + 10;
  for (const f of facilities) {
    const isRot90 = Math.abs(Math.sin(f.rotation)) > 0.7;
    const fw = isRot90 ? f.dimensions.depth : f.dimensions.width;
    const fd = isRot90 ? f.dimensions.width : f.dimensions.depth;
    minBoxX = Math.min(minBoxX, f.position.x - fw / 2 - 6);
    maxBoxX = Math.max(maxBoxX, f.position.x + fw / 2 + 6);
    minBoxZ = Math.min(minBoxZ, f.position.z - fd / 2 - 6);
    maxBoxZ = Math.max(maxBoxZ, f.position.z + fd / 2 + 6);
  }

  const envType = floorConfig?.venueEnvironment ?? 'indoor';
  const floorSettings = floorConfig?.floorSettings ?? DEFAULT_FLOOR_SETTINGS;
  const floorFill =
    floorSettings.mode === 'color'
      ? floorSettings.customColor || '#f8fafc'
      : envType === 'outdoor'
        ? OUTDOOR_FLOOR_PRESETS[floorSettings.outdoorPreset]?.previewHex || '#dcfce7'
        : INDOOR_FLOOR_PRESETS[floorSettings.indoorPreset]?.previewHex || '#f8fafc';

  const hasCustomImage =
    floorSettings.mode === 'image' && Boolean(floorSettings.customImageUrl?.trim());

  const baselineMap = new Map<string, Facility>();
  if (baselineFacilities) {
    for (const bf of baselineFacilities) {
      baselineMap.set(bf.id, bf);
    }
  }

  return (
    <svg
      viewBox={`${minBoxX} ${minBoxZ} ${maxBoxX - minBoxX} ${maxBoxZ - minBoxZ}`}
      className={`w-full ${compact ? 'h-44' : 'h-64'} bg-slate-100 rounded-lg border border-slate-200`}
    >
      <defs>
        <marker
          id="dispArrowHead"
          viewBox="0 0 8 8"
          refX="6"
          refY="4"
          markerWidth="4.5"
          markerHeight="4.5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 7 4 L 0 7 z" fill="#059669" />
        </marker>
      </defs>

      {/* Venue Floor Slab + Optional Custom Image + Meter Grid */}
      <rect
        x={-halfW}
        y={-halfD}
        width={widthM}
        height={depthM}
        rx={3}
        fill={floorFill}
        stroke={envType === 'outdoor' ? '#15803d' : '#64748b'}
        strokeWidth={1.6}
        strokeDasharray={envType === 'outdoor' ? '5 3' : undefined}
      />
      {hasCustomImage && (
        <image
          href={floorSettings.customImageUrl}
          x={-halfW}
          y={-halfD}
          width={widthM}
          height={depthM}
          preserveAspectRatio="xMidYMid slice"
          opacity={0.85}
        />
      )}
      {floorSettings.showGrid &&
        vLines.map((x) => (
          <line
            key={`vx-${x}`}
            x1={x}
            y1={-halfD}
            x2={x}
            y2={halfD}
            stroke="#cbd5e1"
            strokeOpacity={0.65}
            strokeWidth={0.6}
          />
        ))}
      {floorSettings.showGrid &&
        hLines.map((z) => (
          <line
            key={`hz-${z}`}
            x1={-halfW}
            y1={z}
            x2={halfW}
            y2={z}
            stroke="#cbd5e1"
            strokeOpacity={0.65}
            strokeWidth={0.6}
          />
        ))}

      {/* Dedicated Perimeter Step-Free Egress Loop Hint */}
      <rect
        x={-halfW + 7}
        y={-halfD + 7}
        width={Math.max(10, widthM - 14)}
        height={Math.max(10, depthM - 14)}
        rx={2}
        fill="none"
        stroke="#0d9488"
        strokeWidth={1.1}
        strokeDasharray="4 3"
        strokeOpacity={0.55}
      />

      {/* Exterior Parking Connector Crosswalks */}
      {facilities
        .filter((f) => f.category === 'parking')
        .map((pf) => {
          const nearX = Math.max(-halfW, Math.min(halfW, pf.position.x));
          const nearZ = Math.max(-halfD, Math.min(halfD, pf.position.z));
          return (
            <line
              key={`conn-${pf.id}`}
              x1={pf.position.x}
              y1={pf.position.z}
              x2={nearX}
              y2={nearZ}
              stroke="#64748b"
              strokeWidth={4}
              strokeDasharray="2.5 2"
            />
          );
        })}

      {/* Ghost Origin Outlines & Relocation Vectors for Dispersed Layout */}
      {baselineFacilities &&
        facilities.map((f) => {
          const orig = baselineMap.get(f.id);
          if (!orig) return null;
          const dist = Math.hypot(f.position.x - orig.position.x, f.position.z - orig.position.z);
          if (dist < 1.5) return null;
          const origRot90 = Math.abs(Math.sin(orig.rotation)) > 0.7;
          const ow = origRot90 ? orig.dimensions.depth : orig.dimensions.width;
          const od = origRot90 ? orig.dimensions.width : orig.dimensions.depth;
          return (
            <g key={`vec-${f.id}`}>
              <rect
                x={orig.position.x - ow / 2}
                y={orig.position.z - od / 2}
                width={ow}
                height={od}
                rx={1.2}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={1}
                strokeDasharray="2.2 1.8"
              />
              <line
                x1={orig.position.x}
                y1={orig.position.z}
                x2={f.position.x}
                y2={f.position.z}
                stroke="#059669"
                strokeWidth={1.6}
                strokeDasharray="3 2"
                markerEnd="url(#dispArrowHead)"
              />
            </g>
          );
        })}

      {facilities.map((f) => {
        const isRot90 = Math.abs(Math.sin(f.rotation)) > 0.7;
        const w = isRot90 ? f.dimensions.depth : f.dimensions.width;
        const d = isRot90 ? f.dimensions.width : f.dimensions.depth;
        const isChanged = highlightIds?.has(f.id);

        return (
          <g key={f.id}>
            {isChanged && !compact && (
              <rect
                x={f.position.x - w / 2 - 1.3}
                y={f.position.z - d / 2 - 1.3}
                width={w + 2.6}
                height={d + 2.6}
                rx={2.2}
                fill="rgba(16, 185, 129, 0.16)"
                stroke="#059669"
                strokeWidth={1.3}
              />
            )}
            <rect
              x={f.position.x - w / 2}
              y={f.position.z - d / 2}
              width={w}
              height={d}
              rx={1.5}
              fill={f.colorAccent || '#2563eb'}
              fillOpacity={0.9}
              stroke={f.locked ? '#d97706' : isChanged ? '#065f46' : '#ffffff'}
              strokeWidth={f.locked || isChanged ? 1.8 : 0.9}
            />
          </g>
        );
      })}
    </svg>
  );
};

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  language,
  config,
  comparison,
  candidates,
  approvedCandidateId,
  activeLayoutMode,
  onPreviewCandidateIn3D,
  onApproveCandidate,
  onRegenerateCandidates,
  onOpenXaiReport,
  onOpenKnowledgeWithContext,
  onActivateIn3D,
  onPromoteOptimizedToBaseline,
  onBackToWorkspace,
}) => {
  const ui = tUi(language);
  const dUnit = densityUnitLabel(language);
  const { originalMetrics: orig, optimizedMetrics: opt } = comparison;
  const maxPlanCost = Math.max(orig.estimatedCost, opt.estimatedCost);
  const isBudgetExceeded = maxPlanCost > config.budget;

  const changedIds = new Set<string>();
  let resizedCount = 0;
  for (const ofac of comparison.optimizedFacilities) {
    const match = comparison.originalFacilities.find((x) => x.id === ofac.id);
    const moved =
      !match ||
      Math.hypot(match.position.x - ofac.position.x, match.position.z - ofac.position.z) > 1.5;
    const areaChanged =
      match &&
      Math.abs(
        match.dimensions.width * match.dimensions.depth -
          ofac.dimensions.width * ofac.dimensions.depth,
      ) > 0.5;
    if (areaChanged) resizedCount += 1;
    if (moved || areaChanged) {
      changedIds.add(ofac.id);
    }
  }

  const metricRows = [
    {
      id: 'area',
      label: tr6(
        language,
        '순수 보행 가용 면적',
        'Net Walkable Area',
        '純歩行可能面積',
        '净步行可用面积',
        'Área peatonal neta',
        'Surface piétonne nette',
      ),
      before: `${orig.usableAreaSqm.toLocaleString()} m²`,
      after: `${opt.usableAreaSqm.toLocaleString()} m²`,
      deltaNum: opt.usableAreaSqm - orig.usableAreaSqm,
      unit: ' m²',
      lowerIsBetter: false,
    },
    {
      id: 'density',
      label: tr6(
        language,
        '모의 피크 군중 밀도',
        'Modeled Peak Density',
        'ピーク群衆密度',
        '模拟峰值人群密度',
        'Densidad pico modelada',
        'Densité de pointe modélisée',
      ),
      before: `${orig.peakDensity.toFixed(2)} ${dUnit}`,
      after: `${opt.peakDensity.toFixed(2)} ${dUnit}`,
      deltaNum: Number((opt.peakDensity - orig.peakDensity).toFixed(2)),
      unit: ` ${dUnit}`,
      lowerIsBetter: true,
    },
    {
      id: 'wait',
      label: tr6(
        language,
        '예상 평균 서비스 대기시간',
        'Estimated Avg Wait Time',
        '推定平均待機時間',
        '预计平均服务等待时间',
        'Tiempo medio de espera',
        'Temps d’attente moyen',
      ),
      before: `${orig.avgWaitMinutes}${tr6(language, '분', ' min', '分', '分钟', ' min', ' min')}`,
      after: `${opt.avgWaitMinutes}${tr6(language, '분', ' min', '分', '分钟', ' min', ' min')}`,
      deltaNum: Number((opt.avgWaitMinutes - orig.avgWaitMinutes).toFixed(1)),
      unit: `${tr6(language, '분', ' min', '分', '分钟', ' min', ' min')} (${comparison.waitTimeDeltaPct}%)`,
      lowerIsBetter: true,
    },
    {
      id: 'walk',
      label: tr6(
        language,
        '평균 보행 이동거리',
        'Average Walking Distance',
        '平均歩行移動距離',
        '平均步行距离',
        'Distancia media a pie',
        'Distance moyenne de marche',
      ),
      before: `${orig.avgWalkingDistanceM} m`,
      after: `${opt.avgWalkingDistanceM} m`,
      deltaNum: opt.avgWalkingDistanceM - orig.avgWalkingDistanceM,
      unit: ' m',
      lowerIsBetter: true,
    },
    {
      id: 'bottleneck',
      label: tr6(
        language,
        '예측 병목 혼잡 구역 수',
        'Modeled Bottlenecks',
        '予測ボトルネック箇所',
        '预测瓶颈拥堵区域数',
        'Cuellos de botella',
        'Goulots d’étranglement',
      ),
      before: `${orig.modeledBottlenecks}${tr6(language, '곳', '', '箇所', '处', '', '')}`,
      after: `${opt.modeledBottlenecks}${tr6(language, '곳', '', '箇所', '处', '', '')}`,
      deltaNum: opt.modeledBottlenecks - orig.modeledBottlenecks,
      unit: tr6(language, '곳', '', '箇所', '处', '', ''),
      lowerIsBetter: true,
    },
    {
      id: 'cost',
      label: tr6(
        language,
        '예상 시설 설치비 (면적 연동)',
        'Area-Linked Est. Cost',
        '推定施設設置費（面積連動）',
        '预计设施安装费（面积联动）',
        'Costo estimado (según área)',
        'Coût estimé (lié à la surface)',
      ),
      before: `${formatCurrency(orig.estimatedCost, language)} (${orig.budgetUsagePct}%)`,
      after: `${formatCurrency(opt.estimatedCost, language)} (${opt.budgetUsagePct}%)`,
      deltaNum: opt.estimatedCost - orig.estimatedCost,
      unit: ' COST',
      lowerIsBetter: true,
    },
  ];

  const chartData = candidates.map((c) => ({
    name: `Layout ${c.id}`,
    PeakDensityX10: Number((c.metrics.peakDensity * 10).toFixed(1)),
    AvgWaitMin: c.metrics.avgWaitMinutes,
    Bottlenecks: c.metrics.modeledBottlenecks,
  }));

  const activeNotes =
    language === 'ko' ? comparison.optimizationNotesKo : comparison.optimizationNotes;
  const lockedCount = comparison.originalFacilities.filter((f) => f.locked).length;

  const handleJumpCandidateBasis = (cand: CandidateLayout) => {
    if (!onOpenKnowledgeWithContext) return;
    const layoutName =
      VENUE_LAYOUT_MODEL_I18N[cand.configOverride.venueLayoutModel ?? 'standard']?.[language] ||
      cand.configOverride.venueLayoutModel ||
      'standard';
    const boothStyle =
      BOOTH_MODEL_STYLE_I18N[cand.configOverride.boothModel ?? 'pagoda_tent']?.[language] ||
      BOOTH_MODEL_STYLE_LABELS[cand.configOverride.boothModel ?? 'pagoda_tent']?.en ||
      'pagoda';

    onOpenKnowledgeWithContext({
      id: `candidate-${cand.id}`,
      candidateId: cand.id,
      title: `${language === 'ko' ? cand.nameKo : cand.nameEn} — ${tr6(
        language,
        '산출 근거 및 관련 법령 기준',
        'Calculation Formulas & Statutory Grounds',
        '算出根拠および関連法令基準',
        '测算依据与相关法规标准',
        'Base de cálculo y criterios legales',
        'Base de calcul et critères réglementaires',
      )}`,
      subtitle: `${layoutName} · ${boothStyle} · ${cand.facilities.length}${tr6(
        language,
        '개 시설',
        ' units',
        '施設',
        '个设施',
        ' unidades',
        ' unités',
      )} · ${formatCurrency(cand.metrics.estimatedCost, language)} (${cand.metrics.budgetUsagePct}%)`,
      highlights: language === 'ko' ? cand.highlightsKo : cand.highlightsEn,
      formulaNotes: [
        `순수 보행 가용면적(${cand.metrics.usableAreaSqm.toLocaleString()}m²) = 총 부지(${cand.metrics.venueAreaSqm.toLocaleString()}m²) − 시설·전면대기 점유면적(${cand.metrics.occupiedAreaSqm.toLocaleString()}m²)`,
        `모의 피크 밀도 ${cand.metrics.peakDensity.toFixed(2)} ${dUnit} (5m×5m 국소 격자 최대 밀집 셀 기준) · 평균 서비스 대기 ${cand.metrics.avgWaitMinutes}분`,
        `설치비 산정식: Σ [표준 단가 × (고정 골조비 30% + 부스 점유면적 비례비 70%)] = ${formatCurrency(cand.metrics.estimatedCost, language)} (가용 예산 ${formatCurrency(config.budget, language)} 대비 ${cand.metrics.budgetUsagePct}%)`,
      ],
      statutoryRefs: [
        '재난 및 안전관리 기본법 시행령 제73조의9 (지역축제 안전관리계획 수립 및 비상차로 확보)',
        '행정안전부 지역축제장 안전관리 매뉴얼 (주 보행통로·비상진입로 최소 3.5m+ 확보 및 출입구 분산)',
        '장애인·노인·임산부 등의 편의증진 보장에 관한 법률 시행규칙 별표 1 (경사로 ≤1/12, 회전반경 Ø1.8m)',
        '군중안전 밀도 참고 기준 (Fruin LoS / UK Green Guide: 여유 ≤2.0 · 주의 2.1~4.0 · 위험 ≥4.5명/㎡)',
      ],
    });
  };

  const handleJumpDispersionBasis = () => {
    if (!onOpenKnowledgeWithContext) return;
    onOpenKnowledgeWithContext({
      id: 'dispersion-before-after',
      title: tr6(
        language,
        '분산 재배치 대안 — 면적·밀도·설치비 산출 근거 및 법령 기준',
        'Dispersed Alternative — Area, Density & Cost Calculation Grounds',
        '分散再配置案 — 面積・密度・設置費の算出根拠と法令基準',
        '分散重排方案 — 面积、密度与安装费测算依据及法规标准',
        'Alternativa dispersa — Base de cálculo de área, densidad y costo',
        'Alternative dispersée — Base de calcul surface, densité et coût',
      ),
      subtitle: `${orig.usableAreaSqm.toLocaleString()}m² → ${opt.usableAreaSqm.toLocaleString()}m² · ${formatCurrency(orig.estimatedCost, language)} → ${formatCurrency(opt.estimatedCost, language)}`,
      highlights: activeNotes,
      formulaNotes: [
        `보행 가용면적 변화: ${orig.usableAreaSqm.toLocaleString()}m² → ${opt.usableAreaSqm.toLocaleString()}m² (${opt.usableAreaSqm - orig.usableAreaSqm >= 0 ? '+' : ''}${(opt.usableAreaSqm - orig.usableAreaSqm).toLocaleString()}m²)`,
        `면적 연동 설치비 공식: 개별 부스 설치비 = 기준 단가 × [0.30(기본 설비) + 0.70 × (조정 후 면적 ÷ 기준 면적)] → ${formatCurrency(orig.estimatedCost, language)} → ${formatCurrency(opt.estimatedCost, language)}`,
        `이격·분산 재배치 부스 ${changedIds.size}개 (치수 최적화 ${resizedCount}개 포함 · 잠금 부스 ${lockedCount}개 원위치 보존)`,
      ],
      statutoryRefs: [
        '행정안전부 지역축제장 안전관리 매뉴얼: 중앙 병목 방지를 위한 동·서 윙 회랑 분산 및 비상통로(≥5.8m) 관통',
        '장애인등편의법 시행규칙 별표 1: 외곽 순환 무장애 동선 및 휠체어 교행·회전 유효폭 확보',
        isBudgetExceeded
          ? `예산 검토 항목: 현재 최대 설치비(${formatCurrency(maxPlanCost, language)})가 가용 예산(${formatCurrency(config.budget, language)})을 초과하여 아래 예산 대안 조치가 권장됩니다.`
          : `예산 검토 항목: 가용 예산(${formatCurrency(config.budget, language)}) 범위 내 적정 편성 확인`,
      ],
    });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-[1280px] mx-auto space-y-6">
        {/* Top Header (Subtitle removed per user feedback) */}
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
                '다목적 공간 후보안 (Layout A~D) 및 전·후 비교',
                'Multi-Purpose Space Candidates (Layouts A–D) & Comparison',
                '多目的空間候補案（Layout A〜D）および前後比較',
                '多目标空间候选方案（Layout A~D）与前后对比',
                'Candidatos espaciales (Layouts A–D) y comparación',
                'Options d’aménagement (Layouts A–D) et comparaison',
              )}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRegenerateCandidates}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
              <span>
                {tr6(
                  language,
                  '후보안 재생성 (배치·외관 변경)',
                  'Regenerate Candidates',
                  '候補案を再生成',
                  '重新生成候选方案',
                  'Regenerar candidatos',
                  'Régénérer les options',
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={onOpenXaiReport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-xs font-semibold text-blue-800 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>{ui.navXaiReport}</span>
            </button>
            <button
              type="button"
              onClick={onPromoteOptimizedToBaseline}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white cursor-pointer"
            >
              <span>
                {tr6(
                  language,
                  '분산 재배치안을 현재 도안으로 확정',
                  'Apply Dispersed as Baseline',
                  '分散再配置案を現在の図面に確定',
                  '将分散重排案设为当前基准',
                  'Aplicar diseño disperso como base',
                  'Valider le plan dispersé comme base',
                )}
              </span>
            </button>
          </div>
        </div>

        {/* Multi-Objective Candidate Explorer: Layout A, B, C, D */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">
              {tr6(
                language,
                '후보안 A · B · C · D (새 도안 단독 3D 미리보기 지원)',
                'Candidates A · B · C · D (Clean New-Blueprint 3D Preview)',
                '候補案 A・B・C・D（新規図面単独3Dプレビュー対応）',
                '候选方案 A · B · C · D（支持新图纸独立3D预览）',
                'Candidatos A · B · C · D (Vista previa 3D en plano limpio)',
                'Options A · B · C · D (Aperçu 3D sur plan vierge)',
              )}
            </h2>
            <div className="flex items-center gap-3 text-xs">
              {lockedCount > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-800 font-semibold">
                  <Lock className="w-3.5 h-3.5" />
                  <span>
                    {tr6(
                      language,
                      `고정 부스 ${lockedCount}개 보존됨`,
                      `${lockedCount} locked preserved`,
                      `固定ブース${lockedCount}件維持`,
                      `已保留${lockedCount}个锁定展位`,
                      `${lockedCount} stands fijados`,
                      `${lockedCount} stands verrouillés`,
                    )}
                  </span>
                </span>
              )}
              {approvedCandidateId && (
                <span className="font-semibold text-emerald-700">
                  {tr6(
                    language,
                    `적용된 후보안: Layout ${approvedCandidateId}`,
                    `Applied: Layout ${approvedCandidateId}`,
                    `適用中: Layout ${approvedCandidateId}`,
                    `已应用: Layout ${approvedCandidateId}`,
                    `Aplicado: Layout ${approvedCandidateId}`,
                    `Appliqué : Layout ${approvedCandidateId}`,
                  )}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {candidates.map((cand) => {
              const isApproved = approvedCandidateId === cand.id;
              const tier = MOIS_SAFETY_TIER_LABELS[cand.metrics.moisSafetyTier];
              const highlights = language === 'ko' ? cand.highlightsKo : cand.highlightsEn;
              const reflected =
                (language === 'ko' ? cand.reflectedConditionsKo : cand.reflectedConditionsEn) || [];

              return (
                <div
                  key={cand.id}
                  className={`bg-white rounded-xl border p-4 flex flex-col justify-between space-y-3 ${
                    isApproved ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">
                          {language === 'ko' ? cand.nameKo : cand.nameEn}
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                          {language === 'ko' ? cand.focusKo : cand.focusEn}
                        </p>
                      </div>
                      <span className="text-[11px] font-mono font-semibold text-slate-600 shrink-0 tabular-nums">
                        {cand.facilities.length}
                        {tr6(language, '개 시설', ' units', '施設', '个', ' uds.', ' unités')}
                      </span>
                    </div>

                    {/* Distinct per-candidate reflected conditions (own actual cost, topology, booth style) */}
                    {reflected.length > 0 && (
                      <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-100 text-[10.5px] text-blue-800 font-medium leading-relaxed tabular-nums">
                        {reflected.join(' · ')}
                      </div>
                    )}

                    <VenueFootprintSvg
                      widthM={cand.configOverride.venueWidth}
                      depthM={cand.configOverride.venueDepth}
                      facilities={cand.facilities}
                      floorConfig={cand.configOverride}
                      compact
                    />

                    {/* Key Physical Metrics Grid including distinct installation cost */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-100 text-[11px] tabular-nums">
                      <div>
                        <div className="text-slate-400">
                          {tr6(language, '피크 밀도', 'Density', 'ピーク密度', '峰值密度', 'Densidad', 'Densité')}
                        </div>
                        <div className={`font-mono font-semibold ${tier.colorClass}`}>
                          {cand.metrics.peakDensity.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">
                          {tr6(language, '평균 대기', 'Avg Wait', '平均待機', '平均等待', 'Espera', 'Attente')}
                        </div>
                        <div className="font-mono font-semibold text-slate-900">
                          {cand.metrics.avgWaitMinutes}
                          {tr6(language, '분', 'm', '分', '分', 'm', 'm')}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">
                          {tr6(language, '예상 설치비', 'Est. Cost', '推定設置費', '预计安装费', 'Costo est.', 'Coût est.')}
                        </div>
                        <div
                          className={`font-mono font-semibold ${
                            cand.metrics.budgetUsagePct > 100 ? 'text-amber-700' : 'text-slate-900'
                          }`}
                        >
                          {formatCurrency(cand.metrics.estimatedCost, language)}
                        </div>
                      </div>
                    </div>

                    <ul className="space-y-1 text-[11px] text-slate-600 list-disc pl-4 leading-snug">
                      {highlights.slice(0, 3).map((h, idx) => (
                        <li key={idx}>{h}</li>
                      ))}
                    </ul>

                    {onOpenKnowledgeWithContext && (
                      <button
                        type="button"
                        onClick={() => handleJumpCandidateBasis(cand)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline pt-0.5 cursor-pointer"
                      >
                        <span>
                          {tr6(
                            language,
                            '상세 산출 근거 및 법령 기준 보기',
                            'View Calculation & Statutory Basis',
                            '詳細な算出根拠・法令基準を見る',
                            '查看详细测算依据与法规标准',
                            'Ver base de cálculo y normativa',
                            'Voir calcul détaillé et normes',
                          )}
                        </span>
                        <ArrowUpRight className="w-3 h-3 shrink-0" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onPreviewCandidateIn3D(cand)}
                      className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-[11px] font-semibold text-blue-800 cursor-pointer"
                    >
                      <Eye className="w-3 h-3 text-blue-600 shrink-0" />
                      <span className="truncate">
                        {tr6(
                          language,
                          '새 도안 3D 보기',
                          '3D New Preview',
                          '新規3Dプレビュー',
                          '新图纸3D预览',
                          'Vista 3D limpia',
                          'Aperçu 3D vierge',
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onApproveCandidate(cand)}
                      className={`inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold cursor-pointer ${
                        isApproved
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      {isApproved && <Check className="w-3 h-3" />}
                      <span>{isApproved ? ui.appliedBadge : ui.applyCandidateBtn}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Side-by-Side Before & After 2D Spatial Footprints with Relocation Vectors */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {tr6(
                    language,
                    '현재 기준 도안',
                    'Current Baseline Layout',
                    '現在の基準図面',
                    '当前基准图纸',
                    'Plano base actual',
                    'Plan de base actuel',
                  )}
                </h2>
                <p className="text-xs text-slate-500 font-mono tabular-nums">
                  {`${orig.totalFacilities}${tr6(language, '개 시설', ' facilities', '施設', '个设施', ' instalaciones', ' installations')} · ${orig.usableAreaSqm.toLocaleString()}m² · ${orig.peakDensity.toFixed(2)} ${dUnit} · ${formatCurrency(orig.estimatedCost, language)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onActivateIn3D('original');
                  onBackToWorkspace();
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer shrink-0 ${
                  activeLayoutMode === 'original'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {activeLayoutMode === 'original'
                  ? tr6(language, '3D 표시 중', 'Active in 3D', '3D表示中', '3D显示中', 'Activo en 3D', 'Actif en 3D')
                  : tr6(language, '3D로 보기', 'View in 3D', '3Dで見る', '在3D中查看', 'Ver en 3D', 'Voir en 3D')}
              </button>
            </div>
            <VenueFootprintSvg
              widthM={config.venueWidth}
              depthM={config.venueDepth}
              facilities={comparison.originalFacilities}
              floorConfig={config}
            />
          </div>

          <div className="bg-white border border-emerald-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {tr6(
                    language,
                    '분산 재배치 대안 (혼잡 완화 · 이동 벡터 표시)',
                    'Dispersed Alternative (Relocation Vectors Shown)',
                    '分散再配置案（混雑緩和・移動ベクトル表示）',
                    '分散重排替代方案（缓解拥堵·显示移动路径）',
                    'Alternativa dispersa (vectores de reubicación)',
                    'Alternative dispersée (vecteurs de déplacement)',
                  )}
                </h2>
                <p className="text-xs text-emerald-800 font-mono tabular-nums">
                  {`${opt.totalFacilities}${tr6(language, '개 시설', ' facilities', '施設', '个设施', ' instalaciones', ' installations')} · ${opt.usableAreaSqm.toLocaleString()}m² · ${opt.peakDensity.toFixed(2)} ${dUnit} · ${formatCurrency(opt.estimatedCost, language)}`}
                  {changedIds.size > 0 &&
                    tr6(
                      language,
                      ` · 재배치·면적조정 ${changedIds.size}개`,
                      ` · ${changedIds.size} relocated/resized`,
                      ` · 再配置${changedIds.size}件`,
                      ` · 重排调整${changedIds.size}个`,
                      ` · ${changedIds.size} ajustados`,
                      ` · ${changedIds.size} ajustés`,
                    )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onActivateIn3D('optimized');
                  onBackToWorkspace();
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer shrink-0 ${
                  activeLayoutMode === 'optimized'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                {activeLayoutMode === 'optimized'
                  ? tr6(language, '3D 표시 중', 'Active in 3D', '3D表示中', '3D显示中', 'Activo en 3D', 'Actif en 3D')
                  : tr6(language, '분산 3D로 보기', 'View Diff in 3D', '分散3Dで見る', '查看3D重排对比', 'Ver 3D disperso', 'Voir 3D dispersé')}
              </button>
            </div>
            <VenueFootprintSvg
              widthM={config.venueWidth}
              depthM={config.venueDepth}
              facilities={comparison.optimizedFacilities}
              baselineFacilities={comparison.originalFacilities}
              floorConfig={config}
              highlightIds={changedIds}
            />
            <div className="text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
              <span>
                {tr6(
                  language,
                  '회색 점선: 기존 부스 위치 · 초록 화살표: 외곽 회랑 분산 이동 경로 (3D 뷰에서도 초록 패드·이동선으로 표시)',
                  'Dashed gray = prior footprint · Emerald arrows = dispersion path (also highlighted in 3D)',
                  '灰色点線＝元の位置・緑矢印＝外周回廊への分散移動経路（3Dでも緑パッドと移動線で表示）',
                  '灰色虚线=原位置 · 绿色箭头=向外侧走廊分散移动路径（3D视图同步高亮显示）',
                  'Gris punteado = posición previa · Flechas verdes = ruta de dispersión (también visible en 3D)',
                  'Gris pointillé = position initiale · Flèches vertes = trajectoire de dispersion (aussi visible en 3D)',
                )}
              </span>
              {onOpenKnowledgeWithContext && (
                <button
                  type="button"
                  onClick={handleJumpDispersionBasis}
                  className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  <span>
                    {tr6(
                      language,
                      '전·후 산출 근거 및 법령 기준 보기',
                      'View Before/After Legal & Calc Basis',
                      '前後算出根拠・法令基準を見る',
                      '查看前后测算与法规依据',
                      'Ver base legal antes/después',
                      'Voir base légale avant/après',
                    )}
                  </span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quantitative Physical Comparison Table & Candidate Operational BarChart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                {tr6(
                  language,
                  '핵심 물리·운영 지표 전·후 비교',
                  'Physical & Operational Metric Deltas',
                  '主要物理・運営指標の前後比較',
                  '核心物理与运营指标前后对比',
                  'Comparación de métricas físicas y operativas',
                  'Comparaison des indicateurs physiques et opérationnels',
                )}
              </h2>
              {isBudgetExceeded && onOpenKnowledgeWithContext && (
                <button
                  type="button"
                  onClick={handleJumpDispersionBasis}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-md cursor-pointer"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>
                    {tr6(
                      language,
                      '예산 초과 대안 배치 바로가기 (표준 요소 DB)',
                      'Open Budget Overrun Remedies (DB)',
                      '予算超過の代替配置へ移動',
                      '前往预算超支替代配置（标准库）',
                      'Ir a alternativas de presupuesto',
                      'Voir solutions de dépassement budget',
                    )}
                  </span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">
                      {tr6(language, '물리 지표', 'Metric', '指標', '物理指标', 'Métrica', 'Indicateur')}
                    </th>
                    <th className="py-2.5 px-4 font-medium text-right">
                      {tr6(language, '현재 도안', 'Current', '現在図面', '当前图纸', 'Actual', 'Actuel')}
                    </th>
                    <th className="py-2.5 px-4 font-medium text-right">
                      {tr6(language, '분산 대안', 'Dispersed', '分散案', '分散方案', 'Disperso', 'Dispersé')}
                    </th>
                    <th className="py-2.5 px-4 font-medium text-right">
                      {tr6(language, '변화량', 'Delta', '変化量', '变化量', 'Cambio', 'Écart')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                  {metricRows.map((row) => {
                    const isZero = row.deltaNum === 0;
                    const isPositiveOutcome = row.lowerIsBetter
                      ? row.deltaNum < 0
                      : row.deltaNum > 0;
                    const deltaFormatted =
                      row.unit === ' COST'
                        ? `${row.deltaNum >= 0 ? '+' : '-'}${formatCurrency(Math.abs(row.deltaNum), language)}`
                        : `${row.deltaNum > 0 ? '+' : ''}${row.deltaNum}${row.unit}`;

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-sans font-medium text-slate-800">
                          {row.label}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600">{row.before}</td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-900">
                          {row.after}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-semibold ${
                            isZero
                              ? 'text-slate-400'
                              : isPositiveOutcome
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                          }`}
                        >
                          {isZero
                            ? tr6(language, '변동 없음', 'No change', '変化なし', '无变化', 'Sin cambio', 'Aucun écart')
                            : deltaFormatted}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-600 leading-relaxed">
              {tr6(
                language,
                `설치비 면적 연동 산식: 부스별 기본 골조·설비비(30%) + 점유면적 비례 시공비(70%)가 적용되어, 순수 보행 가용면적이 ${orig.usableAreaSqm.toLocaleString()}m² → ${opt.usableAreaSqm.toLocaleString()}m²로 넓어질 때 축소된 시설 점유면적만큼 설치비가 자동 절감됩니다.`,
                `Area-linked cost formula: 30% fixed rig base + 70% footprint-proportional cost. Expanding walkable area (${orig.usableAreaSqm.toLocaleString()}m² → ${opt.usableAreaSqm.toLocaleString()}m²) proportionally reduces booth installation cost.`,
                `設置費の面積連動式：基本骨組30%＋占有面積比例70%を適用し、歩行可能面積の拡大に伴い設置費も連動して削減されます。`,
                `安装费面积联动公式：采用30%固定骨架费+70%占地面积比例施工费，净步行面积扩大时设施占地缩减部分自动降低安装费。`,
                `Fórmula de costo vinculada al área: 30% base fija + 70% proporcional a la huella ocupada.`,
                `Formule de coût liée à la surface : 30 % base fixe + 70 % proportionnel à l’emprise au sol.`,
              )}
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 flex flex-col">
            <h2 className="text-sm font-bold text-slate-900 mb-2">
              {tr6(
                language,
                '후보안 A~D 대기시간·혼잡지표 비교',
                'Candidates A–D Wait Time & Congestion',
                '候補案 A〜D 待機時間・混雑指標比較',
                '候选方案 A~D 等待时间与拥堵指标对比',
                'Comparación A–D de espera y congestión',
                'Comparaison A–D attente et densité',
              )}
            </h2>
            <div className="flex-1 min-h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip
                    contentStyle={{ fontSize: '12px', borderRadius: '8px', borderColor: '#e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar
                    dataKey="AvgWaitMin"
                    name={tr6(language, '평균 대기(분)', 'Avg Wait (min)', '平均待機(分)', '平均等待(分)', 'Espera (min)', 'Attente (min)')}
                    fill="#2563eb"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="PeakDensityX10"
                    name={tr6(language, '피크밀도(×10)', 'Peak Density (×10)', 'ピーク密度(×10)', '峰值密度(×10)', 'Densidad (×10)', 'Densité (×10)')}
                    fill="#0d9488"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Collapsible Optimization Modification Log */}
        <details className="bg-white border border-slate-200 rounded-xl p-4 group">
          <summary className="flex items-center justify-between gap-2 cursor-pointer list-none">
            <div className="flex items-center gap-2">
              {comparison.improved ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-slate-500" />
              )}
              <span className="text-sm font-bold text-slate-900">
                {tr6(
                  language,
                  '분산 재배치 상세 변경 로그 보기',
                  'View Dispersion Adjustment Log',
                  '分散再配置の詳細変更ログを見る',
                  '查看分散重排详细变更日志',
                  'Ver registro detallado de ajustes',
                  'Voir le journal détaillé des ajustements',
                )}
              </span>
            </div>
            <span className="text-xs text-blue-600 font-semibold">{ui.detailsToggle}</span>
          </summary>
          <ul className="mt-3 space-y-1.5 text-xs text-slate-700 list-disc pl-5">
            {activeNotes.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
          {onOpenKnowledgeWithContext && (
            <div className="mt-3 pt-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={handleJumpDispersionBasis}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
              >
                <span>
                  {tr6(
                    language,
                    '상세 산출 근거 및 관련 법령 기준 모아보기 (표준 요소 DB 상단 고정)',
                    'Open Full Calculation & Legal Grounds Pinned at Top of Knowledge DB',
                    '詳細な算出根拠・関連法令基準を知識DB上部に固定表示',
                    '在标准知识库顶部固定查看详细测算依据与相关法规',
                    'Abrir base legal y de cálculo fijada arriba en la BD',
                    'Ouvrir la base légale et de calcul épinglée en haut de la BD',
                  )}
                </span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </details>
      </div>
    </div>
  );
};
