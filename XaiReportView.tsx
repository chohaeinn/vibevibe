import React from 'react';
import {
  ArrowLeft,
  BookOpen,
  ClipboardCheck,
  Download,
  Lock,
  Printer,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  ContingencyScenario,
  EventConfig,
  Facility,
  Language,
  LayoutComparison,
  LayoutMetricsSummary,
  MoisSafetyTier,
  PersonaEvaluation,
  SimulationAssumptions,
  SpatialSafetyAudit,
  XaiExplanation,
} from '../types/festival';
import {
  DENSITY_REFERENCE_PROFILES,
  getProfileTierBadgeText,
  VERIFIED_LITERATURE_REGISTRY,
} from '../engine/evidenceBase';
import {
  CONTINGENCY_INFO,
  formatCurrency,
  getFacilityDisplayName,
} from '../engine/presets';
import {
  EVENT_TYPE_MULTILANG,
  OBJECTIVE_MULTILANG,
  tUi,
} from '../i18n/translations';

interface XaiReportViewProps {
  language: Language;
  config: EventConfig;
  facilities: Facility[];
  summary: LayoutMetricsSummary;
  safetyAudit: SpatialSafetyAudit;
  assumptions: SimulationAssumptions;
  comparison: LayoutComparison;
  personas: PersonaEvaluation[];
  contingency: ContingencyScenario;
  xaiReport: XaiExplanation;
  isGeneratingAiXai: boolean;
  onRequestGeminiXai: () => void;
  onDownloadReportHtml: () => void;
  onBackToWorkspace: () => void;
}

const MOIS_TIERS_ORDER: Array<{
  tier: MoisSafetyTier;
  actionKo: string;
  actionEn: string;
}> = [
  {
    tier: 'safe',
    actionKo: '설정한 가정상 혼잡 상대적 낮음 · 기본 안내 및 상시 모니터링 유지',
    actionEn: 'Low modeled congestion; maintain baseline guidance and monitoring',
  },
  {
    tier: 'caution',
    actionKo: '완충 관찰 구간 · 주요 교차로 안내요원 배치 및 일방향 유도선 점검',
    actionEn: 'Buffer observation range; deploy junction stewards and check lanes',
  },
  {
    tier: 'warning',
    actionKo: '주의 참고구간 · 보조 분산 게이트 개방 및 인기 부스 대기줄 분리',
    actionEn: 'Caution range; open relief gates and separate vendor queues',
  },
  {
    tier: 'danger',
    actionKo: '위험 참고구간 · 대기구역 유입 제한 가동, 비상통로 확보 및 재배치 검토',
    actionEn: 'High-risk range; throttle inflow, clear emergency spine, re-layout',
  },
];

export const XaiReportView: React.FC<XaiReportViewProps> = ({
  language,
  config,
  facilities,
  summary,
  safetyAudit,
  assumptions,
  comparison,
  personas,
  contingency,
  xaiReport,
  isGeneratingAiXai,
  onRequestGeminiXai,
  onDownloadReportHtml,
  onBackToWorkspace,
}) => {
  const ui = tUi(language);
  const isKo = language === 'ko';
  const profileMeta = DENSITY_REFERENCE_PROFILES[assumptions.densityProfile];
  const tierInfo = getProfileTierBadgeText(summary.moisSafetyTier, assumptions.densityProfile);
  const contInfo = CONTINGENCY_INFO[contingency];
  const lockedCount = facilities.filter((f) => f.locked).length;

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100 p-6">
      <div className="max-w-[1060px] mx-auto space-y-5">
        {/* Top Action Bar (hidden when printing A4 PDF) */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-5 py-3.5 no-print">
          <div>
            <button
              type="button"
              onClick={onBackToWorkspace}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline mb-0.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{ui.navWorkspace}</span>
            </button>
            <h1 className="text-base font-bold text-slate-900">
              {isKo
                ? '실내 행사장 설계 근거(XAI) · 무장애 퇴장 동선 및 물리 규칙 검증 리포트'
                : 'Indoor Venue Design Rationale (XAI) & Step-Free Egress Audit Report'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRequestGeminiXai}
              disabled={isGeneratingAiXai}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 disabled:opacity-60 text-xs font-semibold text-blue-800 cursor-pointer"
            >
              {isGeneratingAiXai ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span>
                {isGeneratingAiXai
                  ? isKo
                    ? 'AI 근거 갱신 중...'
                    : 'Refreshing...'
                  : isKo
                    ? 'AI 설명 문장 갱신'
                    : 'Refresh AI Summary'}
              </span>
            </button>

            <button
              type="button"
              onClick={onDownloadReportHtml}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>{isKo ? '리포트 저장 (.html)' : 'Download (.html)'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrintPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isKo ? 'PDF 인쇄' : 'Print PDF'}</span>
            </button>
          </div>
        </div>

        {/* Printable A4 Report Sheet */}
        <article className="print-container bg-white border border-slate-200 rounded-xl p-8 space-y-6 text-slate-900">
          {/* Document Header */}
          <header className="border-b-2 border-slate-900 pb-5 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-[11px] font-mono uppercase tracking-wider text-blue-700 font-semibold">
                INCLUSE · INDOOR VENUE SPATIAL & ACCESSIBILITY REPORT
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                {config.eventName}
              </h2>
              <p className="text-xs text-slate-600">
                {EVENT_TYPE_MULTILANG[config.eventType]?.[language] || config.eventType} ·{' '}
                {OBJECTIVE_MULTILANG[config.objective]?.[language] || config.objective} ·{' '}
                {isKo ? contInfo.labelKo : contInfo.labelEn}
              </p>
            </div>

            <div className="text-right font-mono text-xs text-slate-600 space-y-0.5 tabular-nums">
              <div className="font-sans font-bold text-slate-900">
                {safetyAudit.verificationStatus === 'field_calibrated'
                  ? isKo
                    ? '[현장 관측값 보정 비교됨]'
                    : '[Field-Observation Compared]'
                  : isKo
                    ? '[가정 기반 시뮬레이션]'
                    : '[Assumption-Based Simulation]'}
              </div>
              <div>
                {`${config.venueWidth}m × ${config.venueDepth}m (${summary.usableAreaSqm.toLocaleString()}m²)`}
              </div>
              <div>
                {`${config.expectedAttendance.toLocaleString()} / ${summary.referenceCapacity.toLocaleString()} ${ui.paxUnit}`}
              </div>
              {lockedCount > 0 && (
                <div className="text-amber-700 font-sans font-semibold">
                  <Lock className="inline w-3 h-3 mr-1" />
                  {isKo ? `고정 부스 ${lockedCount}개` : `${lockedCount} locked booths`}
                </div>
              )}
            </div>
          </header>

          {/* Concise Headline Physical KPIs (Zero arbitrary /100 scores) */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              {isKo
                ? '1. 핵심 실내 면적 · 밀도 · 예산 요약'
                : '1. Core Indoor Space, Crowd Density & Budget Summary'}
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 border border-slate-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200 tabular-nums">
              <div className="p-3.5">
                <div className="text-[11px] text-slate-500">
                  {isKo ? '순수 보행 가용 면적' : 'Net Walkable Area'}
                </div>
                <div className="text-xl font-mono font-bold text-slate-900 mt-1">
                  {summary.usableAreaSqm.toLocaleString()} m²
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {isKo
                    ? `전체 ${summary.venueAreaSqm.toLocaleString()}m² 중`
                    : `Of ${summary.venueAreaSqm.toLocaleString()}m²`}
                </div>
              </div>

              <div className="p-3.5">
                <div className="text-[11px] text-slate-500">
                  {isKo ? '참고 수용 인원' : 'Reference Capacity'}
                </div>
                <div className="text-xl font-mono font-bold text-blue-700 mt-1">
                  {summary.referenceCapacity.toLocaleString()} {ui.paxUnit}
                </div>
                <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                  @{summary.referenceDensityStandard} p/m²
                </div>
              </div>

              <div className="p-3.5">
                <div className="text-[11px] text-slate-500">
                  {isKo ? '모의 피크 밀도' : 'Modeled Peak Density'}
                </div>
                <div className={`text-xl font-mono font-bold mt-1 ${tierInfo.colorClass}`}>
                  {summary.peakDensity.toFixed(2)} {isKo ? '명/m²' : 'p/m²'}
                </div>
                <div className="text-[11px] font-medium text-slate-700 mt-0.5">
                  {isKo ? tierInfo.ko : tierInfo.en}
                </div>
              </div>

              <div className="p-3.5">
                <div className="text-[11px] text-slate-500">
                  {isKo ? '평균 대기 / 예산 사용' : 'Avg Wait / Budget'}
                </div>
                <div className="text-xl font-mono font-bold text-slate-900 mt-1">
                  {summary.avgWaitMinutes}
                  {isKo ? '분' : 'm'} · {summary.budgetUsagePct}%
                </div>
                <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                  {formatCurrency(summary.estimatedCost, language)}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed">
              {xaiReport.executiveSummary}
            </div>
          </section>

          {/* Section 2: Density Reference Table */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>
                  {isKo
                    ? '2. 군중 밀도 참고 구간 및 안전 판정'
                    : '2. Crowd Density Thresholds & Safety Verdict'}
                </span>
              </h3>
              <span className="text-[11px] font-mono text-slate-500">
                {isKo ? profileMeta.nameKo : profileMeta.nameEn}
              </span>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              {xaiReport.safetyComplianceVerdict}
            </p>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 font-semibold">{isKo ? '밀도 구간' : 'Range'}</th>
                    <th className="py-2 px-3 font-semibold">{isKo ? '임계 기준' : 'Threshold'}</th>
                    <th className="py-2 px-3 font-semibold">{isKo ? '운영 점검 사항' : 'Operational Action'}</th>
                    <th className="py-2 px-3 font-semibold text-right">{isKo ? '현재 상태' : 'Current'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {MOIS_TIERS_ORDER.map((row) => {
                    const info = getProfileTierBadgeText(row.tier, assumptions.densityProfile);
                    const active = summary.moisSafetyTier === row.tier;
                    return (
                      <tr key={row.tier} className={active ? 'bg-blue-50/70 font-semibold' : ''}>
                        <td className={`py-2 px-3 ${info.colorClass}`}>
                          {isKo ? info.ko : info.en}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-700">{info.threshold}</td>
                        <td className="py-2 px-3 text-slate-700">
                          {isKo ? row.actionKo : row.actionEn}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {active ? `${summary.peakDensity.toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 3: 6 Explicit Rule Checks */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <ClipboardCheck className="w-4 h-4 text-blue-600" />
              <span>
                {isKo
                  ? '3. 6대 물리·동선·출구 유효폭 규칙 검사'
                  : '3. Explicit Spatial, Queue & Exit Width Checks'}
              </span>
            </h3>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 font-semibold">{isKo ? '검증 항목' : 'Rule Check'}</th>
                    <th className="py-2 px-3 font-semibold text-center">{isKo ? '판정' : 'Status'}</th>
                    <th className="py-2 px-3 font-semibold">{isKo ? '핵심 결과' : 'Diagnostic'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {safetyAudit.ruleChecks.map((chk) => (
                    <tr key={chk.id}>
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        {isKo ? chk.titleKo : chk.titleEn}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold">
                        <span
                          className={
                            chk.status === 'pass'
                              ? 'text-emerald-700'
                              : chk.status === 'caution'
                                ? 'text-amber-700'
                                : 'text-red-700'
                          }
                        >
                          {chk.status === 'pass'
                            ? isKo
                              ? '충족'
                              : 'PASS'
                            : chk.status === 'caution'
                              ? isKo
                                ? '관찰'
                                : 'WATCH'
                              : isKo
                                ? '보완'
                                : 'ACTION'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-700">
                        {isKo ? chk.detailKo : chk.detailEn}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 4: Placement Rationale & Physical Before/After Deltas (Score-Free) */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              {isKo
                ? '4. 공간 배치 핵심 근거 및 분산 재배치 물리 비교'
                : '4. Placement Rationale & Physical Before/After Comparison'}
            </h3>

            <ul className="space-y-1.5 text-xs text-slate-800 list-disc pl-5 leading-relaxed">
              {xaiReport.placementRationales.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 font-semibold">{isKo ? '물리 비교 항목' : 'Physical Metric'}</th>
                    <th className="py-2 px-3 font-semibold text-right">{isKo ? '현재 도안' : 'Current'}</th>
                    <th className="py-2 px-3 font-semibold text-right">{isKo ? '분산 재배치안' : 'Dispersed'}</th>
                    <th className="py-2 px-3 font-semibold text-right">{isKo ? '변화량' : 'Delta'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                  <tr>
                    <td className="py-2 px-3 font-sans font-medium text-slate-800">
                      {isKo ? '순수 보행 가용 면적' : 'Net Walkable Area'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {comparison.originalMetrics.usableAreaSqm.toLocaleString()} m²
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-900">
                      {comparison.optimizedMetrics.usableAreaSqm.toLocaleString()} m²
                    </td>
                    <td className="py-2 px-3 text-right text-slate-700">
                      {comparison.optimizedMetrics.usableAreaSqm -
                        comparison.originalMetrics.usableAreaSqm}{' '}
                      m²
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-sans font-medium text-slate-800">
                      {isKo ? '모의 피크 밀도' : 'Modeled Peak Density'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {comparison.originalMetrics.peakDensity.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-900">
                      {comparison.optimizedMetrics.peakDensity.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-700 font-semibold">
                      {(
                        comparison.optimizedMetrics.peakDensity -
                        comparison.originalMetrics.peakDensity
                      ).toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-sans font-medium text-slate-800">
                      {isKo ? '예상 평균 대기시간' : 'Estimated Avg Wait'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {comparison.originalMetrics.avgWaitMinutes} {isKo ? '분' : 'min'}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-900">
                      {comparison.optimizedMetrics.avgWaitMinutes} {isKo ? '분' : 'min'}
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-700 font-semibold">
                      {comparison.waitTimeDeltaPct}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 5: Priority Access & Inclusive Personas Audit (Score-Free) */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              {isKo
                ? '5. 사회적 약자 통합 동선 및 이용자별 보행·무장애 검증'
                : '5. Priority Access Egress & Inclusive Visitor Diagnostics'}
            </h3>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 font-semibold">{isKo ? '이용자 그룹' : 'Visitor Group'}</th>
                    <th className="py-2 px-3 font-semibold text-right">{isKo ? '최대 연속 보행거리' : 'Max Walk'}</th>
                    <th className="py-2 px-3 font-semibold text-right">{isKo ? '무장애 설비 적용률' : 'Step-Free Coverage'}</th>
                    <th className="py-2 px-3 font-semibold">{isKo ? '검증 소견' : 'Diagnostic Finding'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {personas.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        {isKo ? p.labelKo : p.labelEn}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-700">
                        {p.maxContinuousWalkM}m
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-700">
                        {p.facilityCoveragePct}%
                      </td>
                      <td className="py-2 px-3 text-slate-700">
                        {isKo ? p.keyFindingKo : p.keyFindingEn}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Collapsible Detailed Literature & Facility Schedule */}
          <details className="border border-slate-200 rounded-lg p-4 bg-slate-50/60">
            <summary className="flex items-center justify-between cursor-pointer list-none text-xs font-bold text-slate-900">
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span>{ui.detailsToggle}</span>
              </span>
              <span className="text-blue-600 font-medium">
                {isKo ? `시설 좌표 ${facilities.length}개 · 군중역학 근거` : `${facilities.length} coords & references`}
              </span>
            </summary>

            <div className="mt-4 space-y-4">
              <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-2.5 font-semibold">{isKo ? '부스·시설명' : 'Facility'}</th>
                      <th className="py-2 px-2.5 font-semibold text-right">{isKo ? '실내 좌표' : 'Coords'}</th>
                      <th className="py-2 px-2.5 font-semibold text-right">{isKo ? '규격' : 'Size'}</th>
                      <th className="py-2 px-2.5 font-semibold text-center">{isKo ? '고정' : 'Locked'}</th>
                      <th className="py-2 px-2.5 font-semibold text-right">{isKo ? '비용' : 'Cost'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                    {facilities.map((f) => (
                      <tr key={f.id}>
                        <td className="py-1.5 px-2.5 font-sans font-medium text-slate-900">
                          {getFacilityDisplayName(f, language)}
                        </td>
                        <td className="py-1.5 px-2.5 text-right text-slate-600">
                          ({Math.round(f.position.x)}m, {Math.round(f.position.z)}m)
                        </td>
                        <td className="py-1.5 px-2.5 text-right text-slate-600">
                          {f.dimensions.width}m × {f.dimensions.depth}m
                        </td>
                        <td className="py-1.5 px-2.5 text-center font-sans text-slate-700">
                          {f.locked ? 'ON' : '—'}
                        </td>
                        <td className="py-1.5 px-2.5 text-right text-slate-700">
                          {formatCurrency(f.cost, language)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-2.5 font-semibold">Ref</th>
                      <th className="py-2 px-2.5 font-semibold">{isKo ? '핵심 원리' : 'Principle'}</th>
                      <th className="py-2 px-2.5 font-semibold">{isKo ? '적용 모듈' : 'Module'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {VERIFIED_LITERATURE_REGISTRY.filter((s) => s.level !== 'C_excluded').map((src) => (
                      <tr key={src.refNo}>
                        <td className="py-2 px-2.5 font-mono font-bold whitespace-nowrap">{src.refNo}</td>
                        <td className="py-2 px-2.5">
                          <div className="font-semibold text-slate-900">{src.authorsAndYear}</div>
                          <div className="text-slate-600">{src.correctionNoteKo}</div>
                        </td>
                        <td className="py-2 px-2.5 text-slate-800 font-medium">{src.appliedModuleKo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        </article>
      </div>
    </div>
  );
};
