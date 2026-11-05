import React from 'react';
import { ArrowRight, GitCompare, Lock } from 'lucide-react';
import {
  DensityReferenceProfileId,
  EventConfig,
  Facility,
  Language,
  LayoutComparison,
  LayoutMetricsSummary,
} from '../types/festival';
import { getProfileTierBadgeText } from '../engine/evidenceBase';
import { FacilityClearanceAudit } from '../engine/layoutGenerator';
import { formatCurrency } from '../engine/presets';
import { MOIS_TIER_I18N, pickL6, tr6 } from '../i18n/localeCatalog';
import { tUi } from '../i18n/translations';

interface BottomSummaryBarProps {
  language: Language;
  config: EventConfig;
  facilities?: Facility[];
  summary: LayoutMetricsSummary;
  comparison: LayoutComparison;
  clearanceAudit?: FacilityClearanceAudit;
  densityProfile?: DensityReferenceProfileId;
  activeLayoutMode: 'original' | 'optimized';
  onSwitchLayoutMode: (mode: 'original' | 'optimized') => void;
  onOpenComparisonView: () => void;
  onResolveBudgetOverrun?: () => void;
}

const SUMMARY_LABELS: Record<
  Language,
  {
    usableArea: string;
    facilityCount: string;
    peakDensity: string;
    avgWaitTime: string;
    estimatedCost: string;
    budgetUsage: string;
    beforeAfter: string;
    currentPlan: string;
    dispersedPlan: string;
    autoFit: string;
    minUnit: string;
    densityUnit: string;
  }
> = {
  ko: {
    usableArea: '실내 보행 가용 면적',
    facilityCount: '배치 부스·기물 수',
    peakDensity: '모의 피크 밀도',
    avgWaitTime: '평균 대기시간',
    estimatedCost: '예상 설치 비용',
    budgetUsage: '예산 사용률',
    beforeAfter: '분산 재배치 전·후 비교',
    currentPlan: '현재 도안',
    dispersedPlan: '분산 대안',
    autoFit: '예산 맞춤',
    minUnit: '분',
    densityUnit: '명/m²',
  },
  en: {
    usableArea: 'Net Indoor Area',
    facilityCount: 'Placed Booths',
    peakDensity: 'Peak Density',
    avgWaitTime: 'Avg Wait Time',
    estimatedCost: 'Estimated Cost',
    budgetUsage: 'Budget',
    beforeAfter: 'Before / After Dispersion',
    currentPlan: 'Current',
    dispersedPlan: 'Dispersed',
    autoFit: 'Auto-Fit',
    minUnit: 'min',
    densityUnit: 'p/m²',
  },
  ja: {
    usableArea: '屋内有効面積',
    facilityCount: '配置ブース数',
    peakDensity: 'ピーク密度',
    avgWaitTime: '平均待ち時間',
    estimatedCost: '概算設営費',
    budgetUsage: '予算消化率',
    beforeAfter: '分散再配置の前後比較',
    currentPlan: '現在案',
    dispersedPlan: '分散案',
    autoFit: '予算調整',
    minUnit: '分',
    densityUnit: '人/m²',
  },
  zh: {
    usableArea: '室内可用面积',
    facilityCount: '已布置展位',
    peakDensity: '峰值密度',
    avgWaitTime: '平均等待时间',
    estimatedCost: '预计搭建费',
    budgetUsage: '预算占比',
    beforeAfter: '分散优化前后对比',
    currentPlan: '当前方案',
    dispersedPlan: '分散方案',
    autoFit: '适配预算',
    minUnit: '分',
    densityUnit: '人/m²',
  },
  es: {
    usableArea: 'Área Interior Útil',
    facilityCount: 'Stands Colocados',
    peakDensity: 'Densidad Pico',
    avgWaitTime: 'Espera Media',
    estimatedCost: 'Costo Estimado',
    budgetUsage: 'Presupuesto',
    beforeAfter: 'Antes / Después Dispersión',
    currentPlan: 'Actual',
    dispersedPlan: 'Dispersado',
    autoFit: 'Ajustar',
    minUnit: 'min',
    densityUnit: 'p/m²',
  },
  fr: {
    usableArea: 'Surface Utile',
    facilityCount: 'Stands Placés',
    peakDensity: 'Densité Max',
    avgWaitTime: 'Attente Moy.',
    estimatedCost: 'Coût Estimé',
    budgetUsage: 'Budget',
    beforeAfter: 'Avant / Après Dispersion',
    currentPlan: 'Actuel',
    dispersedPlan: 'Dispersé',
    autoFit: 'Ajuster',
    minUnit: 'min',
    densityUnit: 'p/m²',
  },
};

export const BottomSummaryBar: React.FC<BottomSummaryBarProps> = ({
  language,
  config,
  facilities = [],
  summary,
  comparison,
  clearanceAudit,
  densityProfile = 'mois_2024_main_table',
  activeLayoutMode,
  onSwitchLayoutMode,
  onOpenComparisonView,
  onResolveBudgetOverrun,
}) => {
  const ui = tUi(language);
  const lbl = SUMMARY_LABELS[language] || SUMMARY_LABELS.ko;
  const tierInfo = getProfileTierBadgeText(summary.moisSafetyTier, densityProfile);
  const lockedCount = facilities.filter((f) => f.locked).length;

  return (
    <section className="h-[100px] shrink-0 bg-white border-t border-slate-200 px-5 flex items-center justify-between gap-6 overflow-x-auto no-print">
      {/* Core Physical & Crowd Metrics (Score-Free — Zero arbitrary /100 Planning Score) */}
      <div className="flex items-center divide-x divide-slate-200 shrink-0">
        <div className="pr-4">
          <div className="text-[11px] text-slate-500">{lbl.usableArea}</div>
          <div className="text-lg font-mono font-bold text-slate-900 mt-0.5 tabular-nums">
            {summary.usableAreaSqm.toLocaleString()} m²
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            {`${config.venueWidth}×${config.venueDepth}m · ${
              clearanceAudit
                ? tr6(
                    language,
                    `간섭 ${clearanceAudit.conflictCount}건`,
                    `${clearanceAudit.conflictCount} overlaps`,
                    `干渉 ${clearanceAudit.conflictCount}件`,
                    `冲突 ${clearanceAudit.conflictCount}处`,
                    `${clearanceAudit.conflictCount} solapamientos`,
                    `${clearanceAudit.conflictCount} chevauchements`,
                  )
                : `${summary.venueAreaSqm.toLocaleString()}m²`
            }`}
          </div>
        </div>

        <div className="px-4">
          <div className="text-[11px] text-slate-500">{lbl.facilityCount}</div>
          <div className="text-lg font-mono font-bold text-slate-900 mt-0.5 tabular-nums flex items-center gap-2">
            <span>{summary.totalFacilities}</span>
            {lockedCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-sans font-semibold text-amber-700">
                <Lock className="w-3 h-3" />
                <span>{lockedCount}</span>
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            {tr6(
              language,
              `참고 수용 ${summary.referenceCapacity.toLocaleString()}명`,
              `Ref ${summary.referenceCapacity.toLocaleString()} ${ui.paxUnit}`,
              `参考収容 ${summary.referenceCapacity.toLocaleString()}${ui.paxUnit}`,
              `参考容量 ${summary.referenceCapacity.toLocaleString()}${ui.paxUnit}`,
              `Cap. ref. ${summary.referenceCapacity.toLocaleString()} ${ui.paxUnit}`,
              `Cap. réf. ${summary.referenceCapacity.toLocaleString()} ${ui.paxUnit}`,
            )}
          </div>
        </div>

        <div className="px-4">
          <div className="text-[11px] text-slate-500">{lbl.peakDensity}</div>
          <div className="text-lg font-mono font-bold text-slate-900 mt-0.5 tabular-nums">
            {summary.peakDensity.toFixed(2)} {lbl.densityUnit}
          </div>
          <div className={`text-[11px] font-medium ${tierInfo.colorClass}`}>
            {pickL6(language, MOIS_TIER_I18N[summary.moisSafetyTier])}
          </div>
        </div>

        <div className="px-4">
          <div className="text-[11px] text-slate-500">{lbl.avgWaitTime}</div>
          <div className="text-lg font-mono font-bold text-slate-900 mt-0.5 tabular-nums">
            {summary.avgWaitMinutes} {lbl.minUnit}
          </div>
          <div className="text-[11px] font-mono text-slate-500 tabular-nums">
            {tr6(
              language,
              `평균 보행 ${summary.avgWalkingDistanceM}m`,
              `Walk ${summary.avgWalkingDistanceM}m`,
              `平均歩行 ${summary.avgWalkingDistanceM}m`,
              `平均步行 ${summary.avgWalkingDistanceM}m`,
              `Marcha ${summary.avgWalkingDistanceM}m`,
              `Marche ${summary.avgWalkingDistanceM}m`,
            )}
          </div>
        </div>

        <div className="pl-4">
          <div className="text-[11px] text-slate-500">{lbl.estimatedCost}</div>
          <div className="text-lg font-mono font-bold text-slate-900 mt-0.5 tabular-nums">
            {formatCurrency(summary.estimatedCost, language)}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`text-[11px] font-mono tabular-nums ${
                summary.budgetUsagePct > 100 ? 'text-red-700 font-semibold' : 'text-slate-500'
              }`}
            >
              {lbl.budgetUsage} {summary.budgetUsagePct}%
            </span>
            {summary.budgetUsagePct > 100 && onResolveBudgetOverrun && (
              <button
                type="button"
                onClick={onResolveBudgetOverrun}
                className="px-1.5 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {lbl.autoFit}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right: Before / After Layout Switcher & Multi-Purpose Candidate Explorer */}
      <div className="flex items-center gap-3 pl-4 border-l border-slate-200 shrink-0">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-800">{lbl.beforeAfter}</span>
            <span className="text-slate-400">·</span>
            <span className="font-mono text-[11px] text-slate-600 tabular-nums">
              {lbl.avgWaitTime} {comparison.originalMetrics.avgWaitMinutes}m{' '}
              <ArrowRight className="inline w-3 h-3" />{' '}
              {comparison.optimizedMetrics.avgWaitMinutes}m
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => onSwitchLayoutMode('original')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer tabular-nums ${
                  activeLayoutMode === 'original'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {`${lbl.currentPlan} (${comparison.originalMetrics.totalFacilities})`}
              </button>
              <button
                type="button"
                onClick={() => onSwitchLayoutMode('optimized')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer tabular-nums ${
                  activeLayoutMode === 'optimized'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {`${lbl.dispersedPlan} (${comparison.optimizedMetrics.totalFacilities})`}
              </button>
            </div>

            <button
              type="button"
              onClick={onOpenComparisonView}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-800 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <GitCompare className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>{ui.navCandidates}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
