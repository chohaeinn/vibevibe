import React, { useState } from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
} from 'lucide-react';
import { DENSITY_REFERENCE_PROFILES } from '../engine/evidenceBase';
import { EVENT_PHASES } from '../engine/presets';
import { EVENT_PHASE_I18N, pickL6, tr6 } from '../i18n/localeCatalog';
import { tUi } from '../i18n/translations';
import {
  DensityReferenceProfileId,
  Language,
  SimulationPlayState,
  SimulationSnapshot,
} from '../types/festival';

interface SimulationTimelineDockProps {
  language: Language;
  snapshot: SimulationSnapshot;
  densityProfile?: DensityReferenceProfileId;
  simPlayState: SimulationPlayState;
  onPlayPause: () => void;
  onStop: () => void;
  onRestart: () => void;
  simSpeed: number;
  onChangeSpeed: (speed: number) => void;
  onScrubProgress: (progress: number) => void;
  heatmapVisible: boolean;
  onToggleHeatmap: () => void;
  hasFacilities: boolean;
  isNonPerformanceEvent?: boolean;
}

const TIMELINE_EXTRA: Record<
  Language,
  {
    hideTimeline: string;
    heatmap: string;
    peakDensity: string;
    densityScale: string;
    frozenNote: string;
    unit: string;
  }
> = {
  ko: {
    hideTimeline: '타임라인 접기',
    heatmap: '혼잡 히트맵',
    peakDensity: '피크 밀도',
    densityScale: '밀도 구간(명/m²):',
    frozenNote: '현재 위치 고정됨',
    unit: '명/m²',
  },
  en: {
    hideTimeline: 'Hide Timeline',
    heatmap: 'Heatmap',
    peakDensity: 'Peak Density',
    densityScale: 'Density (p/m²):',
    frozenNote: 'Positions frozen',
    unit: 'p/m²',
  },
  ja: {
    hideTimeline: 'タイムラインを閉じる',
    heatmap: 'ヒートマップ',
    peakDensity: 'ピーク密度',
    densityScale: '密度区間(人/m²):',
    frozenNote: '現在位置で一時停止中',
    unit: '人/m²',
  },
  zh: {
    hideTimeline: '收起时间轴',
    heatmap: '热力图',
    peakDensity: '峰值密度',
    densityScale: '密度区间(人/m²):',
    frozenNote: '当前位置已冻结',
    unit: '人/m²',
  },
  es: {
    hideTimeline: 'Ocultar línea',
    heatmap: 'Mapa de calor',
    peakDensity: 'Densidad pico',
    densityScale: 'Densidad (p/m²):',
    frozenNote: 'Posición congelada',
    unit: 'p/m²',
  },
  fr: {
    hideTimeline: 'Masquer la barre',
    heatmap: 'Carte thermique',
    peakDensity: 'Densité max',
    densityScale: 'Densité (p/m²):',
    frozenNote: 'Positions figées',
    unit: 'p/m²',
  },
};

export const SimulationTimelineDock: React.FC<SimulationTimelineDockProps> = ({
  language,
  snapshot,
  densityProfile = 'mois_2024_main_table',
  simPlayState,
  onPlayPause,
  onStop,
  onRestart,
  simSpeed,
  onChangeSpeed,
  onScrubProgress,
  heatmapVisible,
  onToggleHeatmap,
  hasFacilities,
  isNonPerformanceEvent = false,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const ui = tUi(language);
  const extra = TIMELINE_EXTRA[language] || TIMELINE_EXTRA.ko;
  const prof =
    DENSITY_REFERENCE_PROFILES[densityProfile] || DENSITY_REFERENCE_PROFILES.mois_2024_main_table;

  const getPhaseShort = (phaseId: SimulationSnapshot['phase']['id']) => {
    if (phaseId === 'headline_show' && isNonPerformanceEvent) {
      return tr6(
        language,
        '메인 세션 피크',
        'Session Peak',
        'メインセッション',
        '主会议高峰',
        'Pico sesión',
        'Pic session',
      );
    }
    return pickL6(language, EVENT_PHASE_I18N[phaseId].short);
  };

  const getPhaseFull = (phaseId: SimulationSnapshot['phase']['id']) => {
    if (phaseId === 'headline_show' && isNonPerformanceEvent) {
      return tr6(
        language,
        '메인 발표·빔 프로젝터 세션 피크',
        'Main Presentation & Projector Session Peak',
        'メイン発表・プロジェクターセッションピーク',
        '主发表与投影演示高峰时段',
        'Pico de presentación principal con proyector',
        'Pic de session principale avec vidéoprojecteur',
      );
    }
    return pickL6(language, EVENT_PHASE_I18N[phaseId].label);
  };

  const speedOptions: Array<{ value: number; label: string }> = [
    { value: 0.5, label: ui.speedSlow },
    { value: 1.0, label: ui.speedNormal },
    { value: 1.8, label: ui.speedFast },
  ];

  const isPlaying = simPlayState === 'playing';
  const isPaused = simPlayState === 'paused';

  const statusText =
    simPlayState === 'playing'
      ? ui.simPlaying
      : simPlayState === 'paused'
        ? ui.simPaused
        : ui.simStopped;

  const statusTone =
    simPlayState === 'playing'
      ? 'text-emerald-700'
      : simPlayState === 'paused'
        ? 'text-amber-700'
        : 'text-slate-600';

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[min(900px,95%)] flex flex-col items-center pointer-events-none">
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="pointer-events-auto flex items-center gap-1.5 px-3 py-1 bg-white border border-b-0 border-slate-200 rounded-t-lg text-[11px] font-medium text-slate-600 hover:text-slate-900 shadow-xs cursor-pointer whitespace-nowrap"
      >
        {collapsed ? (
          <>
            <ChevronUp className="w-3.5 h-3.5" />
            <span className="tabular-nums">
              {`${statusText} · ${snapshot.currentTimeLabel} · ${getPhaseShort(
                snapshot.phase.id,
              )}`}
            </span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5" />
            <span>{extra.hideTimeline}</span>
          </>
        )}
      </button>

      {!collapsed && (
        <div className="pointer-events-auto w-full bg-white border border-slate-200 rounded-xl shadow-md px-4 py-3 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Transport Controls: Play/Pause | Stop | Restart | 3 Calibrated Speed Tiers */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`text-[11px] font-bold px-1.5 whitespace-nowrap ${statusTone}`}>
                {statusText}
              </span>

              <button
                type="button"
                disabled={!hasFacilities}
                onClick={onPlayPause}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? ui.btnPause : ui.btnPlay}</span>
              </button>

              <button
                type="button"
                disabled={!hasFacilities || simPlayState === 'stopped'}
                onClick={onStop}
                title={ui.btnStop}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-45 text-slate-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>{ui.btnStop}</span>
              </button>

              <button
                type="button"
                disabled={!hasFacilities}
                onClick={onRestart}
                title={ui.btnRestart}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-45 text-slate-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{ui.btnRestart}</span>
              </button>

              <div className="ml-0.5 flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg">
                {speedOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChangeSpeed(opt.value)}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      Math.abs(simSpeed - opt.value) < 0.05
                        ? 'bg-white text-slate-900 font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-mono font-semibold text-slate-900 text-sm tabular-nums">
                {snapshot.currentTimeLabel}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-slate-800 whitespace-nowrap">
                {getPhaseFull(snapshot.phase.id)}
              </span>
              {isPaused && (
                <span className="text-[11px] text-amber-700 font-medium whitespace-nowrap">
                  ({extra.frozenNote})
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onToggleHeatmap}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                heatmapVisible
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {heatmapVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{extra.heatmap}</span>
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <input
              type="range"
              min={0}
              max={1000}
              disabled={!hasFacilities}
              value={Math.round(snapshot.progress * 1000)}
              onChange={(e) => onScrubProgress(Number(e.target.value) / 1000)}
              aria-label="Simulation Timeline Scrubber"
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="grid grid-cols-6 gap-1">
              {EVENT_PHASES.map((ph) => {
                const isCurrent = snapshot.phase.id === ph.id;
                const midProgress = (ph.progressRange[0] + ph.progressRange[1]) / 2;
                return (
                  <button
                    key={ph.id}
                    type="button"
                    disabled={!hasFacilities}
                    onClick={() => onScrubProgress(midProgress)}
                    title={pickL6(language, EVENT_PHASE_I18N[ph.id].desc)}
                    className={`px-2 py-1 rounded text-[11px] font-medium truncate transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    {getPhaseShort(ph.id)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 text-[11px] text-slate-600">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-medium text-slate-700">{extra.densityScale}</span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <span className="w-2.5 h-2.5 rounded-xs bg-green-500" />
                <span>{`≤${prof.cautionStart}`}</span>
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <span className="w-2.5 h-2.5 rounded-xs bg-yellow-400" />
                <span>{`${prof.cautionStart}–${prof.warningStart}`}</span>
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <span className="w-2.5 h-2.5 rounded-xs bg-orange-500" />
                <span>{`${prof.warningStart}–${prof.dangerStart}`}</span>
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <span className="w-2.5 h-2.5 rounded-xs bg-red-600" />
                <span>{`≥${prof.dangerStart}`}</span>
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-slate-700 tabular-nums">
              <span>
                {extra.peakDensity}: {snapshot.peakDensity.toFixed(2)} {extra.unit}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-sans truncate max-w-[180px]">
                {snapshot.mostCongestedZone}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
