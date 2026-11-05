import React, { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronRight,
  ClipboardCheck,
  Copy,
  FileText,
  Lock,
  MapPin,
  PanelRightClose,
  RotateCw,
  Trash2,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DENSITY_REFERENCE_PROFILES,
  getProfileTierBadgeText,
} from '../engine/evidenceBase';
import { buildFacilityPlacementRationale } from '../engine/facilityPlacementRationale';
import {
  evaluateStatutoryAndEightDomains,
  getFacilityAssetMetadata,
} from '../engine/knowledgeDatabase';
import {
  FacilityClearanceAudit,
  getFacilityLocalBounds,
} from '../engine/layoutGenerator';
import {
  formatCurrency,
  getFacilityDisplayName,
} from '../engine/presets';
import { CATEGORY_SIMPLE_LABELS, tUi } from '../i18n/translations';
import {
  DensityReferenceProfileId,
  EventConfig,
  Facility,
  FieldCalibrationSample,
  KnowledgeFocusContext,
  Language,
  LayoutMetricsSummary,
  PersonaEvaluation,
  Recommendation,
  SimulationAssumptions,
  SimulationSnapshot,
  SpatialSafetyAudit,
  StatutorySafetyChecklistState,
  VisitorPersonaId,
  WeatherScenarioId,
  XaiExplanation,
} from '../types/festival';
import { tr6 } from '../i18n/localeCatalog';

interface RightSidebarProps {
  language: Language;
  config: EventConfig;
  facilities: Facility[];
  selectedFacility: Facility | null;
  onCloseSelection: () => void;
  onUpdateFacility: (updated: Facility) => void;
  onDuplicateFacility: (facility: Facility) => void;
  onDeleteFacility: (id: string) => void;
  onSelectFacilityById: (id: string) => void;
  snapshot: SimulationSnapshot;
  summary: LayoutMetricsSummary;
  safetyAudit: SpatialSafetyAudit;
  clearanceAudit?: FacilityClearanceAudit;
  assumptions: SimulationAssumptions;
  onChangeAssumptions: (next: SimulationAssumptions) => void;
  personas: PersonaEvaluation[];
  activePersonaId: VisitorPersonaId | null;
  onSelectPersona: (id: VisitorPersonaId | null) => void;
  onUpgradePersona: (id: VisitorPersonaId) => void;
  xaiReport: XaiExplanation;
  onOpenXaiReportView: () => void;
  recommendations: Recommendation[];
  onApplyRecommendation: (actionType: NonNullable<Recommendation['actionType']>) => void;
  checklist: StatutorySafetyChecklistState;
  calibration: FieldCalibrationSample;
  weatherScenario: WeatherScenarioId;
  onOpenKnowledgeBaseView: () => void;
  onOpenKnowledgeWithContext?: (ctx: KnowledgeFocusContext) => void;
  onCollapse?: () => void;
}

const FacilityCadFootprintSvg: React.FC<{
  facility: Facility;
  config: EventConfig;
  frontQueueM: number;
  isKo: boolean;
}> = ({ facility, config, frontQueueM, isKo }) => {
  const W = Math.max(4, facility.dimensions.width);
  const D = Math.max(4, facility.dimensions.depth);
  const local = getFacilityLocalBounds(facility, config);
  const hasRamp =
    config.accessibility.stepFreeRoutes &&
    facility.accessibility.wheelchairAccessible &&
    facility.category !== 'parking' &&
    facility.subtype !== 'fountain_plaza';

  const envMinX = Math.min(local.minX, -W / 2) - 1.5;
  const envMaxX = Math.max(local.maxX, W / 2) + 1.5;
  const envMinZ = Math.min(local.minZ, -D / 2) - 1.5;
  const envMaxZ = Math.max(local.maxZ, D / 2 + Math.min(6, frontQueueM)) + 1.5;

  const spanX = Math.max(8, envMaxX - envMinX);
  const spanZ = Math.max(8, envMaxZ - envMinZ);
  const svgW = 264;
  const svgH = 124;
  const padX = 24;
  const padY = 16;
  const scale = Math.min((svgW - padX * 2) / spanX, (svgH - padY * 2) / spanZ);

  const cx = svgW / 2 - ((envMinX + envMaxX) / 2) * scale;
  const cy = svgH / 2 - ((envMinZ + envMaxZ) / 2) * scale;
  const tx = (x: number) => cx + x * scale;
  const tz = (z: number) => cy + z * scale;

  const bodyX = tx(-W / 2);
  const bodyY = tz(-D / 2);
  const bodyW = W * scale;
  const bodyH = D * scale;

  const queueDepth = Math.min(5.5, Math.max(1.2, frontQueueM));
  const queueY = tz(D / 2);
  const queueH = queueDepth * scale;

  const rotDeg = Math.round((((facility.rotation * 180) / Math.PI) % 360 + 360) % 360);

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="w-full h-[124px] rounded-md bg-slate-900 border border-slate-800 select-none"
      role="img"
      aria-label={isKo ? '시설 평면 제원 도면' : 'Facility CAD Plan Blueprint'}
    >
      <defs>
        <pattern id="cadMinorGrid" width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M 12 0 L 0 0 0 12" fill="none" stroke="#1e293b" strokeWidth="0.7" />
        </pattern>
      </defs>
      <rect width={svgW} height={svgH} fill="url(#cadMinorGrid)" />
      <rect
        x={tx(local.minX)}
        y={tz(local.minZ)}
        width={(local.maxX - local.minX) * scale}
        height={(local.maxZ - local.minZ) * scale}
        fill="rgba(56, 189, 248, 0.07)"
        stroke="#38bdf8"
        strokeWidth="0.9"
        strokeDasharray="3 2"
        rx="2"
      />
      {frontQueueM > 0 && facility.category !== 'parking' && (
        <g>
          <rect
            x={tx(-W * 0.44)}
            y={queueY}
            width={W * 0.88 * scale}
            height={queueH}
            fill="rgba(251, 191, 36, 0.12)"
            stroke="#fbbf24"
            strokeWidth="0.9"
            strokeDasharray="2.5 2"
          />
          <text
            x={tx(0)}
            y={Math.min(svgH - 4, queueY + queueH / 2 + 3)}
            textAnchor="middle"
            fill="#fcd34d"
            fontSize="7.5"
            fontFamily="monospace"
          >
            {isKo ? `전면 대기 +${frontQueueM}m` : `Queue +${frontQueueM}m`}
          </text>
        </g>
      )}
      <rect
        x={bodyX}
        y={bodyY}
        width={bodyW}
        height={bodyH}
        fill="rgba(37, 99, 235, 0.28)"
        stroke="#60a5fa"
        strokeWidth="1.4"
        rx="2"
      />
      {hasRamp && (
        <rect
          x={tx(-Math.min(1.6, W * 0.22))}
          y={tz(D / 2)}
          width={Math.min(3.2, W * 0.44) * scale}
          height={Math.max(4, 1.8 * scale)}
          fill="#10b981"
          stroke="#fde047"
          strokeWidth="0.9"
        />
      )}
      <text
        x={tx(0)}
        y={Math.max(10, bodyY - 4)}
        textAnchor="middle"
        fill="#e2e8f0"
        fontSize="8.5"
        fontFamily="monospace"
        fontWeight="bold"
      >
        {W}m × {D}m (H {facility.dimensions.height}m)
      </text>
      <text x={svgW - 6} y={12} textAnchor="end" fill="#94a3b8" fontSize="8" fontFamily="monospace">
        {rotDeg}°
      </text>
    </svg>
  );
};

export const RightSidebar: React.FC<RightSidebarProps> = ({
  language,
  config,
  facilities,
  selectedFacility,
  onCloseSelection,
  onUpdateFacility,
  onDuplicateFacility,
  onDeleteFacility,
  onSelectFacilityById,
  snapshot,
  summary,
  safetyAudit,
  clearanceAudit,
  assumptions,
  onChangeAssumptions,
  personas,
  activePersonaId,
  onSelectPersona,
  onUpgradePersona,
  xaiReport,
  onOpenXaiReportView,
  recommendations,
  onApplyRecommendation,
  checklist,
  calibration,
  weatherScenario,
  onOpenKnowledgeBaseView,
  onOpenKnowledgeWithContext,
  onCollapse,
}) => {
  const [activeRightTab, setActiveRightTab] = useState<'overview' | 'rules' | 'inclusive'>('overview');
  const [draft, setDraft] = useState<Facility | null>(selectedFacility);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setDraft(selectedFacility);
    setSavedFlash(false);
  }, [selectedFacility]);

  const ui = tUi(language);
  const isKo = language === 'ko';
  const tierInfo = getProfileTierBadgeText(summary.moisSafetyTier, assumptions.densityProfile);
  const profileMeta = DENSITY_REFERENCE_PROFILES[assumptions.densityProfile];
  const ruleWarnCount = safetyAudit.ruleChecks.filter((r) => r.status !== 'pass').length;
  const lockedCount = facilities.filter((f) => f.locked).length;

  const placementRationale = selectedFacility
    ? buildFacilityPlacementRationale(selectedFacility, config, facilities, language)
    : null;

  const selectedAssetMeta = selectedFacility
    ? getFacilityAssetMetadata(selectedFacility, config, snapshot)
    : null;

  const domainSummary = evaluateStatutoryAndEightDomains(
    config,
    facilities,
    snapshot,
    summary,
    safetyAudit,
    checklist,
    calibration,
    weatherScenario,
  );

  const handleSaveFacilityEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const halfW = config.venueWidth / 2 - 4;
    const halfD = config.venueDepth / 2 - 4;
    const clamped: Facility = {
      ...draft,
      position: draft.locked
        ? { ...selectedFacility!.position }
        : {
            x: Math.max(-halfW, Math.min(halfW, Number(draft.position.x) || 0)),
            z: Math.max(-halfD, Math.min(halfD, Number(draft.position.z) || 0)),
          },
      dimensions: draft.locked
        ? { ...selectedFacility!.dimensions }
        : {
            width: Math.max(3, Math.min(80, Number(draft.dimensions.width) || 7)),
            depth: Math.max(3, Math.min(80, Number(draft.dimensions.depth) || 7)),
            height: draft.dimensions.height,
          },
      capacity: Math.max(10, Number(draft.capacity) || 100),
    };
    onUpdateFacility(clamped);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1400);
  };

  const handleToggleLock = () => {
    if (!selectedFacility) return;
    const nextLocked = !selectedFacility.locked;
    const updated: Facility = { ...selectedFacility, locked: nextLocked };
    setDraft(updated);
    onUpdateFacility(updated);
  };

  return (
    <aside className="w-[330px] shrink-0 bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden no-print">
      {selectedFacility && draft ? (
        /* SELECTED BOOTH INSPECTOR: SIMPLE NAME, LOCK/UNLOCK, POSITION & SIZE, COLLAPSIBLE RATIONALE */
        <div className="flex flex-col h-full overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span>
                  {CATEGORY_SIMPLE_LABELS[selectedFacility.category]?.[language] ||
                    selectedFacility.category}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  ({Math.round(selectedFacility.position.x)}m, {Math.round(selectedFacility.position.z)}m)
                </span>
              </div>
              <h2 className="text-sm font-bold text-slate-900 truncate mt-0.5">
                {getFacilityDisplayName(selectedFacility, language)}
              </h2>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onCloseSelection}
                title={isKo ? '선택 해제' : 'Deselect'}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              {onCollapse && (
                <button
                  type="button"
                  onClick={onCollapse}
                  aria-label="Collapse Right Sidebar"
                  className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <form
            onSubmit={handleSaveFacilityEdit}
            className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs"
          >
            {/* 1. Prominent Booth Lock / Unlock Toggle */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleToggleLock}
                className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-semibold transition-colors cursor-pointer ${
                  selectedFacility.locked
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                }`}
              >
                {selectedFacility.locked ? (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>{ui.unlockBoothBtn}</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>{ui.lockBoothBtn}</span>
                  </>
                )}
              </button>

              {selectedFacility.locked && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                  {ui.lockedNotice}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  const nextExcluded = !selectedFacility.budgetExcluded;
                  const updated: Facility = {
                    ...selectedFacility,
                    budgetExcluded: nextExcluded,
                  };
                  setDraft(updated);
                  onUpdateFacility(updated);
                }}
                className={`w-full flex items-center justify-between gap-2 py-2 px-3 rounded-lg font-semibold transition-colors cursor-pointer border ${
                  selectedFacility.budgetExcluded
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <span>
                  {selectedFacility.budgetExcluded
                    ? tr6(
                        language,
                        '기존 부스 · 예산 제외됨 (다시 포함)',
                        'Existing Booth · Excluded (Include)',
                        '既存ブース・予算除外中（再計上）',
                        '既有设施·已排除预算（恢复计入）',
                        'Existente · Excluido (Incluir)',
                        'Existant · Exclu (Réinclure)',
                      )
                    : tr6(
                        language,
                        '기존 행사장 부스 예산에서 제거',
                        'Exclude Existing Booth from Budget',
                        '既存会場ブースとして予算から除外',
                        '作为场馆既有展位从预算中移除',
                        'Excluir del presupuesto (existente)',
                        'Exclure du budget (existant)',
                      )}
                </span>
                <span className="font-mono text-[11px] tabular-nums">
                  {selectedFacility.budgetExcluded
                    ? formatCurrency(0, language)
                    : formatCurrency(selectedFacility.cost, language)}
                </span>
              </button>
            </div>

            {/* 2. Simple Booth Name Input */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {ui.boothNameInputLabel}
              </label>
              <input
                type="text"
                value={draft.customDisplayName ? draft.name : getFacilityDisplayName(draft, language)}
                onChange={(e) => {
                  const val = e.target.value;
                  setDraft({
                    ...draft,
                    name: val,
                    nameKo: val,
                    customDisplayName: true,
                  });
                }}
                placeholder={ui.customBoothNamePlaceholder}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* 3. Position & Dimensions (disabled while locked) */}
            <div className={`space-y-3 ${selectedFacility.locked ? 'opacity-55 pointer-events-none' : ''}`}>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    X (m)
                  </label>
                  <input
                    type="number"
                    step={0.5}
                    disabled={Boolean(selectedFacility.locked)}
                    value={Math.round(draft.position.x * 2) / 2}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        position: { ...draft.position, x: Number(e.target.value) },
                      })
                    }
                    className="w-full px-2.5 py-1.5 font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Z (m)
                  </label>
                  <input
                    type="number"
                    step={0.5}
                    disabled={Boolean(selectedFacility.locked)}
                    value={Math.round(draft.position.z * 2) / 2}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        position: { ...draft.position, z: Number(e.target.value) },
                      })
                    }
                    className="w-full px-2.5 py-1.5 font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {ui.widthM}
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={80}
                    step={0.5}
                    disabled={Boolean(selectedFacility.locked)}
                    value={draft.dimensions.width}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        dimensions: { ...draft.dimensions, width: Number(e.target.value) },
                      })
                    }
                    className="w-full px-2.5 py-1.5 font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {ui.depthM}
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={80}
                    step={0.5}
                    disabled={Boolean(selectedFacility.locked)}
                    value={draft.dimensions.depth}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        dimensions: { ...draft.dimensions, depth: Number(e.target.value) },
                      })
                    }
                    className="w-full px-2.5 py-1.5 font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 mb-1">
                  <span>{isKo ? '회전 각도' : 'Orientation'}</span>
                  <span className="font-mono tabular-nums">
                    {Math.round(((draft.rotation * 180) / Math.PI + 360) % 360)}°
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[0, 90, 180, 270].map((deg) => {
                    const rad = (deg * Math.PI) / 180;
                    const active =
                      Math.round((((draft.rotation * 180) / Math.PI) % 360 + 360) % 360) === deg;
                    return (
                      <button
                        key={deg}
                        type="button"
                        disabled={Boolean(selectedFacility.locked)}
                        onClick={() => setDraft({ ...draft, rotation: rad })}
                        className={`flex items-center justify-center gap-1 py-1 rounded border font-mono text-[11px] cursor-pointer ${
                          active
                            ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>{deg}°</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  {isKo ? '수용 인원' : 'Capacity'} ({ui.paxUnit})
                </label>
                <input
                  type="number"
                  min={10}
                  step={10}
                  value={draft.capacity}
                  onChange={(e) => setDraft({ ...draft, capacity: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-700">
                    {isKo ? '예상 비용' : 'Est. Cost'}
                  </label>
                  <span className="text-[11px] font-mono font-bold text-blue-700 tabular-nums">
                    {formatCurrency(draft.cost, language)}
                  </span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    min={0}
                    step={language === 'ko' ? 10 : 500}
                    value={
                      language === 'ko'
                        ? Math.round((draft.cost * 1350) / 10000)
                        : language === 'ja'
                          ? Math.round((draft.cost * 150) / 10000)
                          : language === 'zh'
                            ? Math.round(draft.cost * 7.2)
                            : language === 'es' || language === 'fr'
                              ? Math.round(draft.cost * 0.92)
                              : Math.round(draft.cost)
                    }
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      if (raw < 0 || isNaN(raw)) return;
                      let nextUsd = raw;
                      if (language === 'ko') {
                        nextUsd = Math.round((raw * 10000) / 1350);
                      } else if (language === 'ja') {
                        nextUsd = Math.round((raw * 10000) / 150);
                      } else if (language === 'zh') {
                        nextUsd = Math.round(raw / 7.2);
                      } else if (language === 'es' || language === 'fr') {
                        nextUsd = Math.round(raw / 0.92);
                      }
                      setDraft({ ...draft, cost: nextUsd });
                    }}
                    className="w-full px-2.5 py-1.5 font-mono tabular-nums rounded-md bg-slate-50 border border-slate-200 pr-12 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="absolute right-2.5 text-xs font-semibold text-slate-500 pointer-events-none select-none">
                    {language === 'ko'
                      ? '만원'
                      : language === 'ja'
                        ? '万円'
                        : language === 'zh'
                          ? 'CNY'
                          : language === 'es' || language === 'fr'
                            ? 'EUR'
                            : 'USD'}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  {language === 'ko'
                    ? `입력: ${Math.round((draft.cost * 1350) / 10000).toLocaleString()}만원`
                    : `Input: ${formatCurrency(draft.cost, language)}`}
                </div>
              </div>
            </div>

            {/* Barrier-Free Ramp Toggle */}
            <label className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200 cursor-pointer text-slate-800">
              <input
                type="checkbox"
                checked={
                  draft.accessibility.wheelchairAccessible && config.accessibility.stepFreeRoutes
                }
                onChange={(e) => {
                  const checked = e.target.checked;
                  const nextFacility: Facility = {
                    ...draft,
                    accessibility: {
                      ...draft.accessibility,
                      wheelchairAccessible: checked,
                      stepFreeEntry: checked,
                    },
                  };
                  setDraft(nextFacility);
                  onUpdateFacility(nextFacility);
                }}
                className="mt-0.5 rounded border-slate-300 text-emerald-600"
              />
              <div>
                <div className="font-semibold text-slate-900">
                  {isKo
                    ? '무단차 경사로·저상 카운터 적용'
                    : 'Step-Free Ramp & Lowered Counter'}
                </div>
                <div className="text-[10px] text-slate-600">
                  {isKo
                    ? '사회적 약자(휠체어·전동차·유모차) 접근 설비를 즉시 반영합니다.'
                    : 'Renders sloped ramp, handrails, and accessible counter.'}
                </div>
              </div>
            </label>

            {/* Primary Save / Duplicate / Delete Actions */}
            <div className="pt-1 space-y-2">
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors cursor-pointer"
              >
                {savedFlash ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{ui.appliedBadge}</span>
                  </>
                ) : (
                  <span>{ui.saveChangesBtn}</span>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onDuplicateFacility(selectedFacility)}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{ui.duplicateBtn}</span>
                </button>
                <button
                  type="button"
                  disabled={Boolean(selectedFacility.locked)}
                  onClick={() => onDeleteFacility(selectedFacility.id)}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:pointer-events-none font-medium cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{ui.deleteBtn}</span>
                </button>
              </div>
            </div>

            {/* Concise Live Crowd & Clearance Status */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] text-slate-500">
                    {isKo ? '현재 체류 / 수용량' : 'Occupancy / Cap'}
                  </div>
                  <div className="text-xs font-mono font-semibold text-slate-900 tabular-nums">
                    {(snapshot.facilityOccupancy[selectedFacility.id] || 0).toLocaleString()} /{' '}
                    {selectedFacility.capacity.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">
                    {isKo ? '예상 대기 인원' : 'Est. Queue'}
                  </div>
                  <div className="text-xs font-mono font-semibold text-slate-900 tabular-nums">
                    {(snapshot.facilityQueues[selectedFacility.id] || 0).toLocaleString()}{' '}
                    {ui.paxUnit}
                  </div>
                </div>
              </div>

              {clearanceAudit && clearanceAudit.byFacilityId[selectedFacility.id] && (
                <div className="pt-1 border-t border-slate-200 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-emerald-700">
                    {clearanceAudit.byFacilityId[selectedFacility.id].clearanceM < 0
                      ? isKo
                        ? '인접 간섭 감지됨'
                        : 'Overlap detected'
                      : isKo
                        ? '부스·기물 중첩 0건'
                        : 'Zero Overlap'}
                  </span>
                  {clearanceAudit.byFacilityId[selectedFacility.id].nearestId && (
                    <span className="font-mono tabular-nums text-slate-600">
                      {isKo ? '최단 이격 ' : 'Nearest '}
                      {clearanceAudit.byFacilityId[selectedFacility.id].clearanceM}m
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Collapsible CAD Blueprint, Utility Specs & Statutory Rationale */}
            <details className="group rounded-lg border border-slate-200 bg-slate-50 p-3">
              <summary className="flex items-center justify-between cursor-pointer font-semibold text-slate-800 list-none">
                <span>{ui.detailsToggle}</span>
                <ChevronRight className="w-4 h-4 text-slate-500 transition-transform group-open:rotate-90" />
              </summary>

              <div className="pt-3 mt-2 border-t border-slate-200 space-y-3">
                {selectedAssetMeta && (
                  <div className="space-y-2">
                    <FacilityCadFootprintSvg
                      facility={selectedFacility}
                      config={config}
                      frontQueueM={selectedAssetMeta.clearance.frontQueueM}
                      isKo={isKo}
                    />
                    <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px] tabular-nums">
                      <div className="p-2 rounded bg-white border border-slate-200">
                        <div className="font-sans text-slate-500">
                          {isKo ? '전력 · 급배수' : 'Power / Water'}
                        </div>
                        <div className="font-semibold text-slate-900 mt-0.5">
                          {selectedAssetMeta.utilities.electricityKw}kW ·{' '}
                          {selectedAssetMeta.utilities.waterRequired
                            ? isKo
                              ? '급배수 필요'
                              : 'Water'
                            : isKo
                              ? '무급수'
                              : 'Dry'}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-white border border-slate-200">
                        <div className="font-sans text-slate-500">
                          {isKo ? '권장 운영 인력' : 'Staff Needed'}
                        </div>
                        <div className="font-semibold text-slate-900 mt-0.5">
                          {selectedAssetMeta.operations.staffRequired}
                          {isKo ? '명' : ' staff'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {placementRationale && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1 font-semibold text-slate-900">
                      <MapPin className="w-3.5 h-3.5 text-blue-600" />
                      <span>
                        {isKo ? placementRationale.zoneLabelKo : placementRationale.zoneLabelEn}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {isKo
                        ? placementRationale.whyHereSummaryKo
                        : placementRationale.whyHereSummaryEn}
                    </p>
                    {placementRationale.publicStandards.slice(0, 2).map((std, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded bg-white border border-slate-200 text-[10px] text-slate-600 leading-relaxed"
                      >
                        <div className="font-semibold text-slate-900">
                          {isKo ? std.agencyKo : std.agencyEn} ·{' '}
                          {isKo ? std.documentTitleKo : std.documentTitleEn}
                        </div>
                        <div className="mt-0.5">
                          {isKo ? std.appliedReasonKo : std.appliedReasonEn}
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenKnowledgeWithContext && selectedFacility) {
                          onOpenKnowledgeWithContext({
                            id: `facility-${selectedFacility.id}`,
                            title: `${getFacilityDisplayName(selectedFacility, language)} — ${tr6(
                              language,
                              '상세 산출 근거 및 적용 법령',
                              'Calculation Basis & Statutory Rules',
                              '算出根拠・適用法令',
                              '详细测算依据与适用法规',
                              'Base de cálculo y normativa',
                              'Base de calcul et réglementation',
                            )}`,
                            subtitle: `${selectedFacility.dimensions.width}×${selectedFacility.dimensions.depth}×${selectedFacility.dimensions.height}m · (${Math.round(selectedFacility.position.x)}m, ${Math.round(selectedFacility.position.z)}m)`,
                            highlights: [
                              isKo
                                ? placementRationale.whyHereSummaryKo
                                : placementRationale.whyHereSummaryEn,
                              selectedAssetMeta?.source.notes || '',
                            ].filter(Boolean),
                            formulaNotes: selectedAssetMeta
                              ? [
                                  `점유면적 = ${selectedAssetMeta.geometry.lengthM}m × ${selectedAssetMeta.geometry.widthM}m = ${selectedAssetMeta.geometry.footprintM2}m² (전면 대기버퍼 +${selectedAssetMeta.clearance.frontQueueM}m)`,
                                  `전력 ${selectedAssetMeta.utilities.electricityKw}kW · 필요인력 ${selectedAssetMeta.operations.staffRequired}명 · 서비스율(μ) ${selectedAssetMeta.operations.serviceRatePerMinMu}/분`,
                                ]
                              : [],
                            statutoryRefs: placementRationale.publicStandards.map((std) =>
                              isKo
                                ? `${std.agencyKo} · ${std.documentTitleKo}: ${std.appliedReasonKo}`
                                : `${std.agencyEn} · ${std.documentTitleEn}: ${std.appliedReasonEn}`,
                            ),
                          });
                        } else {
                          onOpenKnowledgeBaseView();
                        }
                      }}
                      className="w-full py-1.5 px-2.5 rounded-md bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-semibold text-[11px] flex items-center justify-between cursor-pointer"
                    >
                      <span>
                        {tr6(
                          language,
                          '상세 산출 근거 및 법령 기준 보기',
                          'View Full Calculation & Legal Basis',
                          '詳細な算出根拠・法令基準を見る',
                          '查看详细测算依据与法规标准',
                          'Ver base de cálculo y normativa',
                          'Voir calcul détaillé et normes',
                        )}
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  </div>
                )}
              </div>
            </details>
          </form>
        </div>
      ) : (
        /* SCORE-FREE OVERVIEW, PLACED BOOTHS LIST, EXPLICIT RULES & INCLUSIVE PERSONAS */
        <div className="flex flex-col h-full overflow-hidden">
          <div className="p-2.5 border-b border-slate-200 shrink-0 space-y-2">
            <div className="flex items-center gap-1.5">
              <div className="flex-1 grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setActiveRightTab('overview');
                    onSelectPersona(null);
                  }}
                  className={`flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    activeRightTab === 'overview'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart3 className="w-3 h-3 shrink-0" />
                  <span className="truncate">{isKo ? '요약·부스' : 'Summary & Booths'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRightTab('rules')}
                  className={`flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    activeRightTab === 'rules'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ClipboardCheck className="w-3 h-3 shrink-0" />
                  <span className="truncate">
                    {isKo
                      ? `안전규칙${ruleWarnCount > 0 ? `(${ruleWarnCount})` : ''}`
                      : `Rules${ruleWarnCount > 0 ? `(${ruleWarnCount})` : ''}`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRightTab('inclusive')}
                  className={`flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    activeRightTab === 'inclusive'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3 h-3 shrink-0" />
                  <span className="truncate">{isKo ? '사회적 약자' : 'Accessibility'}</span>
                </button>
              </div>

              {onCollapse && (
                <button
                  type="button"
                  onClick={onCollapse}
                  aria-label="Collapse Right Sidebar"
                  className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
            {activeRightTab === 'overview' ? (
              <>
                {/* 1. 핵심 실내 공간·밀도 요약 */}
                <section className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      {isKo ? '핵심 실내 공간·밀도 요약' : 'Core Indoor Spatial Metrics'}
                    </span>
                    <span className="text-[11px] font-semibold text-blue-700">
                      {isKo ? tierInfo.ko : tierInfo.en}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 font-mono tabular-nums">
                    <div className="p-2 rounded-lg bg-white border border-slate-200">
                      <div className="text-[10px] font-sans text-slate-500">
                        {isKo ? '순수 보행 가용면적' : 'Walkable Area'}
                      </div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5">
                        {summary.usableAreaSqm.toLocaleString()} m²
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200">
                      <div className="text-[10px] font-sans text-slate-500">
                        {isKo ? '배치 부스 · 고정됨' : 'Booths · Locked'}
                      </div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5">
                        {facilities.length} · {lockedCount}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200">
                      <div className="text-[10px] font-sans text-slate-500">
                        {isKo ? '가용 예산' : 'Available Budget'}
                      </div>
                      <div className="text-sm font-bold text-blue-700 mt-0.5">
                        {formatCurrency(config.budget, language)}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200">
                      <div className="text-[10px] font-sans text-slate-500">
                        {isKo ? '피크 밀도' : 'Peak Density'}
                      </div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5">
                        {snapshot.peakDensity.toFixed(2)} p/m²
                      </div>
                    </div>
                  </div>
                </section>

                {/* 2. 배치된 부스·시설 목록 */}
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      {isKo
                        ? `배치된 부스·시설 목록 (${facilities.length})`
                        : `Placed Booths & Elements (${facilities.length})`}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {isKo ? '클릭 시 편집 · 자물쇠 고정' : 'Click to edit · Lock'}
                    </span>
                  </div>

                  {facilities.length === 0 ? (
                    <div className="p-3 rounded-lg border border-dashed border-slate-300 text-[11px] text-slate-500 text-center leading-relaxed">
                      {ui.emptyVenueHint}
                    </div>
                  ) : (
                    <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white">
                      {facilities.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 hover:bg-slate-50"
                        >
                          <button
                            type="button"
                            onClick={() => onSelectFacilityById(f.id)}
                            className="flex-1 min-w-0 text-left cursor-pointer"
                          >
                            <div className="font-medium text-slate-800 truncate">
                              {getFacilityDisplayName(f, language)}
                            </div>
                            <div className="text-[10px] font-mono tabular-nums text-slate-500">
                              {f.dimensions.width}×{f.dimensions.depth}m · ({Math.round(f.position.x)}
                              m, {Math.round(f.position.z)}m)
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateFacility({ ...f, locked: !f.locked })}
                            title={f.locked ? ui.unlockBoothBtn : ui.lockBoothBtn}
                            className={`p-1.5 rounded cursor-pointer transition-colors ${
                              f.locked
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {f.locked ? (
                              <Lock className="w-3.5 h-3.5" />
                            ) : (
                              <Unlock className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* 3. 동선·혼잡 개선 제안 (세부 항목 포함) */}
                <section className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      {isKo ? '동선·혼잡 개선 제안' : 'Actionable Flow & Congestion Improvements'}
                    </span>
                    <span className="text-[10px] font-mono tabular-nums text-slate-500">
                      {recommendations.length}{isKo ? '건 제안' : ' items'}
                    </span>
                  </div>

                  {recommendations.length === 0 ? (
                    <div className="p-3 rounded-lg border border-dashed border-slate-300 text-[11px] text-slate-500 text-center">
                      {isKo ? '현재 도안에 추가 개선 제안이 없습니다.' : 'No additional recommendations.'}
                    </div>
                  ) : (
                    recommendations.map((rec) => {
                      const title = isKo && rec.titleKo ? rec.titleKo : rec.title;
                      const rationale = isKo && rec.rationaleKo ? rec.rationaleKo : rec.rationale;
                      const actLabel = isKo && rec.actionLabelKo ? rec.actionLabelKo : rec.actionLabel;
                      const categoryLabel =
                        rec.category === 'Safety'
                          ? (isKo ? '안전 관리' : 'Safety')
                          : rec.category === 'Congestion'
                            ? (isKo ? '혼잡 완화' : 'Congestion')
                            : rec.category === 'Accessibility'
                              ? (isKo ? '포용적 접근성' : 'Accessibility')
                              : rec.category === 'Operations'
                                ? (isKo ? '운영 효율' : 'Operations')
                                : (isKo ? '예산 최적화' : 'Budget');
                      const severityColor =
                        rec.severity === 'high'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : rec.severity === 'medium'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200';

                      return (
                        <div
                          key={rec.id}
                          className="p-3 rounded-xl border border-slate-200 bg-white space-y-2"
                        >
                          <div className="flex items-center justify-between gap-1.5 text-[10px] font-semibold">
                            <span className={`px-2 py-0.5 rounded border ${severityColor}`}>
                              {rec.severity === 'high'
                                ? (isKo ? '긴급 제안' : 'High Priority')
                                : rec.severity === 'medium'
                                  ? (isKo ? '권장 개선' : 'Medium')
                                  : (isKo ? '일반 참고' : 'Low')}
                            </span>
                            <span className="text-slate-500">{categoryLabel}</span>
                          </div>

                          <div className="font-bold text-slate-900 text-xs leading-snug">{title}</div>

                          <p className="text-[11px] text-slate-600 leading-relaxed">{rationale}</p>

                          {rec.metricTrigger && (
                            <div className="p-2 rounded-md bg-slate-50 border border-slate-100 font-mono text-[10px] text-slate-700 tabular-nums">
                              <span className="font-sans font-semibold text-slate-500">
                                {isKo ? '진단 조건: ' : 'Trigger: '}
                              </span>
                              {rec.metricTrigger}
                            </div>
                          )}

                          {rec.evidenceCitation && (
                            <div className="text-[10px] text-slate-500 leading-relaxed border-l-2 border-blue-400 pl-2 py-0.5">
                              {rec.evidenceCitation}
                            </div>
                          )}

                          {rec.actionType && actLabel && (
                            <button
                              type="button"
                              onClick={() => onApplyRecommendation(rec.actionType!)}
                              className="w-full flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition-colors cursor-pointer mt-1"
                            >
                              <span>{actLabel}</span>
                              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </section>
              </>
            ) : activeRightTab === 'rules' ? (
              /* TAB 2: EXPLICIT SPATIAL RULES & ASSUMPTIONS */
              <div className="space-y-3.5">
                <section className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900">
                    {isKo ? '순수 보행 가용면적 · 참고 수용량' : 'Net Walkable Area & Ref Capacity'}
                  </div>
                  <div className="grid grid-cols-2 gap-2 font-mono tabular-nums text-[11px]">
                    <div className="p-2 rounded bg-white border border-slate-200">
                      <div className="text-[10px] font-sans text-slate-500">
                        {isKo ? '보행 가용면적' : 'Net Area'}
                      </div>
                      <div className="font-bold text-slate-900 mt-0.5">
                        {safetyAudit.usableAreaSqm.toLocaleString()} m²
                      </div>
                    </div>
                    <div className="p-2 rounded bg-white border border-slate-200">
                      <div className="text-[10px] font-sans text-slate-500">
                        {isKo ? '참고 수용량' : 'Ref Capacity'}
                      </div>
                      <div className="font-bold text-blue-700 mt-0.5">
                        {safetyAudit.referenceCapacity.toLocaleString()} {ui.paxUnit}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-white border border-slate-200">
                      <div className="text-[10px] font-sans text-slate-500">
                        {isKo ? '가용 예산' : 'Available Budget'}
                      </div>
                      <div className="font-bold text-blue-700 mt-0.5">
                        {formatCurrency(config.budget, language)}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-white border border-slate-200">
                      <div className="text-[10px] font-sans text-slate-500">
                        {isKo ? '배치 비용' : 'Est. Cost'}
                      </div>
                      <div className="font-bold text-slate-900 mt-0.5">
                        {formatCurrency(summary.estimatedCost, language)}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-2">
                  {safetyAudit.ruleChecks.map((chk) => (
                    <div
                      key={chk.id}
                      onClick={() => {
                        if (chk.affectedFacilityIds[0]) {
                          onSelectFacilityById(chk.affectedFacilityIds[0]);
                        }
                      }}
                      className="p-2.5 rounded-lg border border-slate-200 bg-white space-y-1 cursor-pointer hover:border-blue-400"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900 text-[11px]">
                          {isKo ? chk.titleKo : chk.titleEn}
                        </span>
                        <span
                          className={`text-[10px] font-bold ${
                            chk.status === 'pass'
                              ? 'text-emerald-700'
                              : chk.status === 'caution'
                                ? 'text-amber-700'
                                : 'text-red-700'
                          }`}
                        >
                          {chk.status === 'pass'
                            ? isKo
                              ? '충족'
                              : 'Pass'
                            : chk.status === 'caution'
                              ? isKo
                                ? '관찰'
                                : 'Watch'
                              : isKo
                                ? '보완'
                                : 'Action'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {isKo ? chk.detailKo : chk.detailEn}
                      </p>
                    </div>
                  ))}
                </section>
              </div>
            ) : (
              /* TAB 3: SCORE-FREE INCLUSIVE ACCESSIBILITY DIAGNOSTICS */
              <section className="space-y-3">
                <div>
                  <h2 className="font-bold text-slate-900">
                    {isKo
                      ? '사회적 약자 동선·접근성 점검 (전용 퇴장로 연동)'
                      : 'Priority Access & Step-Free Egress Diagnostics'}
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    {isKo
                      ? '항목 클릭 시 3D 실내 공간에서 관련 무장애 시설이 강조됩니다.'
                      : 'Click a group to highlight its accessible facilities in 3D.'}
                  </p>
                </div>

                <div className="space-y-2">
                  {personas.map((p) => {
                    const isSelected = activePersonaId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => onSelectPersona(isSelected ? null : p.id)}
                        className={`p-3 rounded-xl border transition-colors cursor-pointer space-y-1.5 ${
                          isSelected
                            ? 'bg-emerald-50/70 border-emerald-400'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900">
                            {isKo ? p.labelKo : p.labelEn}
                          </span>
                          <span className="text-[10px] font-mono tabular-nums text-emerald-700 font-semibold">
                            {isKo ? '무장애 설비' : 'Step-Free'} {p.facilityCoveragePct}%
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {isKo ? p.keyFindingKo : p.keyFindingEn}
                        </p>

                        <div className="flex items-center justify-between pt-1 text-[10px] font-mono tabular-nums text-slate-500">
                          <span>
                            {isKo
                              ? `연속 보행거리 ${p.maxContinuousWalkM}m`
                              : `Max walk ${p.maxContinuousWalkM}m`}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpgradePersona(p.id);
                            }}
                            className="px-2 py-1 rounded bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-700 font-sans text-[11px] font-semibold text-slate-800 cursor-pointer"
                          >
                            {isKo ? p.upgradeActionLabelKo : p.upgradeActionLabelEn}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
