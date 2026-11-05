import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Car,
  Check,
  ChevronRight,
  Download,
  Eye,
  FilePlus2,
  Image as ImageIcon,
  Layers,
  MessageSquare,
  Palette,
  PanelLeftClose,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Trees,
  Upload,
  Wand2,
} from 'lucide-react';
import { densityUnitLabel } from '../engine/evidenceBase';
import {
  CATALOG_PICKER_SUBTYPES,
  getSubtypeBlueprintMeta,
} from '../engine/layoutGenerator';
import {
  BOOTH_MODEL_STYLE_LABELS,
  DEFAULT_FLOOR_SETTINGS,
  formatCurrency,
  INDOOR_FLOOR_PRESETS,
  OUTDOOR_FLOOR_PRESETS,
} from '../engine/presets';
import {
  BOOTH_MODEL_STYLE_I18N,
  INDOOR_FLOOR_I18N,
  LAYER_LABEL_I18N,
  OUTDOOR_FLOOR_I18N,
  pickL6,
  SAMPLE_BRIEFS_I18N,
  STAGE_PLACEMENT_I18N,
  tr6,
  VENUE_LAYOUT_MODEL_I18N,
  VENUE_SHAPE_I18N,
} from '../i18n/localeCatalog';
import {
  CONTINGENCY_MULTILANG,
  EVENT_TYPE_MULTILANG,
  OBJECTIVE_MULTILANG,
  SUBTYPE_SIMPLE_LABELS,
  tUi,
  VENUE_ENV_FLOOR_STRINGS,
  ZONE_SIMPLE_LABELS,
} from '../i18n/translations';
import {
  ArchitectChatMessage,
  BoothModelStyle,
  CandidateLayout,
  ChatArchitectRole,
  ChatModelTier,
  ContingencyScenario,
  DesignObjective,
  EventConfig,
  EventType,
  FacilitySubtype,
  IndoorFloorPresetId,
  Language,
  LayerVisibility,
  OutdoorFloorPresetId,
  PendingAiProposal,
  RecommendedBoothItem,
  SpatialZoneTarget,
  StagePlacementMode,
  VenueBoundaryShape,
  VenueEnvironmentType,
  VenueFloorMode,
  VenueFloorSettings,
  VenueLayoutModel,
} from '../types/festival';
import { GeminiArchitectChat } from './GeminiArchitectChat';

interface LeftSidebarProps {
  language: Language;
  config: EventConfig;
  onChangeConfig: (updater: (prev: EventConfig) => EventConfig) => void;
  onChangeExteriorParkingCount?: (count: number) => void;
  onSelectEventTypePreset: (type: EventType) => void;
  onRequestNewPlan: () => void;
  aiPrompt: string;
  onChangeAiPrompt: (value: string) => void;
  onRunAiBriefParser: () => void;
  isParsingBrief: boolean;
  aiBriefSummary: string | null;
  appliedPromptChanges?: string[];
  contingency: ContingencyScenario;
  onChangeContingency: (scenario: ContingencyScenario) => void;
  onReoptimizeContingency: () => void;
  visibility: LayerVisibility;
  onToggleVisibility: (key: keyof LayerVisibility) => void;
  onSetAllVisibility: (visible: boolean) => void;
  onGenerateDesign: () => void;
  onResetDesign: () => void;
  onSaveProject: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
  validationErrors: string[];
  saveStatusMessage: string | null;
  estimatedCost?: number;
  onResolveBudgetOverrun?: () => void;
  onRaiseBudgetToCost?: () => void;
  onCollapse?: () => void;
  activeTab?: 'chat' | 'setup' | 'layers';
  onChangeActiveTab?: (tab: 'chat' | 'setup' | 'layers') => void;
  candidates: CandidateLayout[];
  approvedCandidateId: 'A' | 'B' | 'C' | 'D' | null;
  onPreviewCandidate: (cand: CandidateLayout) => void;
  onApplyCandidate: (cand: CandidateLayout) => void;
  onPreviewCatalogElement: (
    subtype: FacilitySubtype,
    zone: SpatialZoneTarget,
    customName: string,
  ) => void;
  onAddCatalogElement: (
    subtype: FacilitySubtype,
    zone: SpatialZoneTarget,
    customName: string,
  ) => void;
  recommendedBooths: RecommendedBoothItem[];
  isRecommendingBooths: boolean;
  onRequestBoothRecommendations: () => void;
  onPreviewRecommendedBooth: (item: RecommendedBoothItem) => void;
  onAddRecommendedBooth: (item: RecommendedBoothItem) => void;
  chatMessages: ArchitectChatMessage[];
  pendingProposals: Record<string, PendingAiProposal>;
  onPreviewProposal: (proposal: PendingAiProposal) => void;
  onApplyProposal: (proposalId: string) => void;
  onUndoProposal?: (proposalId: string) => void;
  onCancelProposal: (proposalId: string) => void;
  autoApplyChat?: boolean;
  onChangeAutoApplyChat?: (next: boolean) => void;
  chatRole: ChatArchitectRole;
  onChangeChatRole: (role: ChatArchitectRole) => void;
  chatModelTier: ChatModelTier;
  onChangeChatModelTier: (tier: ChatModelTier) => void;
  isChatSending: boolean;
  onSendChatMessage: (message: string) => void;
  onResetChat: () => void;
}

const INDOOR_PICKER_ZONES: SpatialZoneTarget[] = [
  'center',
  'west',
  'east',
  'north',
  'south',
  'stage_left',
  'stage_right',
  'entrance',
  'perimeter',
];

const LAYER_ITEMS: Array<{
  key: keyof LayerVisibility;
  group: 'facility' | 'analysis';
}> = [
  { key: 'stage', group: 'facility' },
  { key: 'seating', group: 'facility' },
  { key: 'food', group: 'facility' },
  { key: 'booth', group: 'facility' },
  { key: 'rest', group: 'facility' },
  { key: 'restroom', group: 'facility' },
  { key: 'entrance', group: 'facility' },
  { key: 'parking', group: 'facility' },
  { key: 'medical', group: 'facility' },
  { key: 'vip', group: 'facility' },
  { key: 'camping', group: 'facility' },
  { key: 'crowd', group: 'analysis' },
  { key: 'heatmap', group: 'analysis' },
  { key: 'pedestrianRoutes', group: 'analysis' },
  { key: 'evacuationRoutes', group: 'analysis' },
  { key: 'labels', group: 'analysis' },
];

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  language,
  config,
  onChangeConfig,
  onChangeExteriorParkingCount,
  onSelectEventTypePreset,
  onRequestNewPlan,
  aiPrompt,
  onChangeAiPrompt,
  onRunAiBriefParser,
  isParsingBrief,
  aiBriefSummary,
  appliedPromptChanges,
  contingency,
  onChangeContingency,
  onReoptimizeContingency,
  visibility,
  onToggleVisibility,
  onSetAllVisibility,
  onGenerateDesign,
  onResetDesign,
  onSaveProject,
  onExportJson,
  onImportJson,
  validationErrors,
  saveStatusMessage,
  estimatedCost,
  onResolveBudgetOverrun,
  onRaiseBudgetToCost,
  onCollapse,
  activeTab: controlledTab,
  onChangeActiveTab,
  candidates,
  approvedCandidateId,
  onPreviewCandidate,
  onApplyCandidate,
  onPreviewCatalogElement,
  onAddCatalogElement,
  recommendedBooths,
  isRecommendingBooths,
  onRequestBoothRecommendations,
  onPreviewRecommendedBooth,
  onAddRecommendedBooth,
  chatMessages,
  pendingProposals,
  onPreviewProposal,
  onApplyProposal,
  onUndoProposal,
  onCancelProposal,
  autoApplyChat,
  onChangeAutoApplyChat,
  chatRole,
  onChangeChatRole,
  chatModelTier,
  onChangeChatModelTier,
  isChatSending,
  onSendChatMessage,
  onResetChat,
}) => {
  const [internalTab, setInternalTab] = useState<'chat' | 'setup' | 'layers'>('setup');
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = (next: 'chat' | 'setup' | 'layers') => {
    setInternalTab(next);
    onChangeActiveTab?.(next);
  };

  const [pickerSubtype, setPickerSubtype] = useState<FacilitySubtype>('food_stall');
  const [pickerZone, setPickerZone] = useState<SpatialZoneTarget>('center');
  const [pickerCustomName, setPickerCustomName] = useState<string>('');

  const committedEnv: VenueEnvironmentType = config.venueEnvironment ?? 'indoor';
  const committedFloor: VenueFloorSettings = config.floorSettings ?? DEFAULT_FLOOR_SETTINGS;

  const [draftEnv, setDraftEnv] = useState<VenueEnvironmentType>(committedEnv);
  const [draftFloorMode, setDraftFloorMode] = useState<VenueFloorMode>(committedFloor.mode);
  const [draftIndoorPreset, setDraftIndoorPreset] = useState<IndoorFloorPresetId>(
    committedFloor.indoorPreset,
  );
  const [draftOutdoorPreset, setDraftOutdoorPreset] = useState<OutdoorFloorPresetId>(
    committedFloor.outdoorPreset,
  );
  const [draftColor, setDraftColor] = useState<string>(committedFloor.customColor);
  const [draftImageUrl, setDraftImageUrl] = useState<string>(committedFloor.customImageUrl);
  const [draftImageFit, setDraftImageFit] = useState<'repeat' | 'cover'>(committedFloor.imageFit);
  const [draftShowGrid, setDraftShowGrid] = useState<boolean>(committedFloor.showGrid);
  const [floorAppliedNotice, setFloorAppliedNotice] = useState<boolean>(false);

  useEffect(() => {
    const nextEnv = config.venueEnvironment ?? 'indoor';
    const nextFloor = config.floorSettings ?? DEFAULT_FLOOR_SETTINGS;
    setDraftEnv(nextEnv);
    setDraftFloorMode(nextFloor.mode);
    setDraftIndoorPreset(nextFloor.indoorPreset);
    setDraftOutdoorPreset(nextFloor.outdoorPreset);
    setDraftColor(nextFloor.customColor);
    setDraftImageUrl(nextFloor.customImageUrl);
    setDraftImageFit(nextFloor.imageFit);
    setDraftShowGrid(nextFloor.showGrid);
  }, [config.venueEnvironment, config.floorSettings]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const floorImageInputRef = useRef<HTMLInputElement>(null);
  const ui = tUi(language);
  const efStrings = VENUE_ENV_FLOOR_STRINGS[language] || VENUE_ENV_FLOOR_STRINGS.ko;
  const sampleBriefs = SAMPLE_BRIEFS_I18N[language] || SAMPLE_BRIEFS_I18N.ko;

  const handleSelectVenueEnvironment = (nextEnv: VenueEnvironmentType) => {
    setDraftEnv(nextEnv);
    onChangeConfig((prev) => ({
      ...prev,
      venueEnvironment: nextEnv,
    }));
  };

  const handleApplyFloorSettings = () => {
    const nextFloor: VenueFloorSettings = {
      mode: draftFloorMode,
      indoorPreset: draftIndoorPreset,
      outdoorPreset: draftOutdoorPreset,
      customColor: draftColor || '#f1f5f9',
      customImageUrl: draftImageUrl.trim(),
      imageFit: draftImageFit,
      showGrid: draftShowGrid,
    };
    onChangeConfig((prev) => ({
      ...prev,
      venueEnvironment: draftEnv,
      floorSettings: nextFloor,
    }));
    setFloorAppliedNotice(true);
    window.setTimeout(() => setFloorAppliedNotice(false), 2400);
  };

  const handleFloorImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDraftImageUrl(reader.result);
        setDraftFloorMode('image');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const selectedBlueprint = getSubtypeBlueprintMeta(pickerSubtype);
  const boothStyleMult = BOOTH_MODEL_STYLE_LABELS[config.boothModel ?? 'pagoda_tent']?.costMult ?? 1;
  const pickerEstCostUsd = Math.round(
    selectedBlueprint.cost *
      (pickerSubtype === 'experience_booth' || pickerSubtype === 'food_stall' ? boothStyleMult : 1),
  );

  const isOverBudget = typeof estimatedCost === 'number' && estimatedCost > config.budget;
  const pendingProposalCount = Object.values(pendingProposals).filter(
    (p) => p.status === 'pending',
  ).length;

  return (
    <aside className="w-[336px] shrink-0 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden no-print">
      {/* Top Action Strip: New Blank Plan + Reset + Collapse */}
      <div className="px-3 pt-2.5 pb-2 border-b border-slate-200 shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-1.5">
          <button
            type="button"
            onClick={onRequestNewPlan}
            className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <FilePlus2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{ui.newBlueprintBtn}</span>
          </button>

          <button
            type="button"
            onClick={onResetDesign}
            title={tr6(
              language,
              '표준 초기 도안으로 복원',
              'Restore default template',
              '標準初期図面に復元',
              '恢复标准初始方案',
              'Restaurar plantilla predeterminada',
              'Restaurer le modèle par défaut',
            )}
            className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>
              {tr6(language, '초기 복원', 'Reset', '初期復元', '重置', 'Restaurar', 'Réinit.')}
            </span>
          </button>

          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              title={tr6(
                language,
                '좌측 설정 패널 접기',
                'Collapse Left Sidebar',
                '左パネルを閉じる',
                '收起左侧面板',
                'Contraer panel izquierdo',
                'Réduire le panneau gauche',
              )}
              aria-label="Collapse Left Sidebar"
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Segmented Tab Switcher */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('setup')}
            className={`flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'setup'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{ui.tabSetup}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {ui.tabAiChat}
              {pendingProposalCount > 0 ? ` (${pendingProposalCount})` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('layers')}
            className={`flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'layers'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {ui.tabLayers} ({LAYER_ITEMS.filter((i) => visibility[i.key]).length})
            </span>
          </button>
        </div>
      </div>

      {/* Validation & Save Alerts */}
      {validationErrors.length > 0 && (
        <div className="mx-3 mt-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 space-y-1 shrink-0">
          {validationErrors.map((err, idx) => (
            <p key={idx}>{err}</p>
          ))}
        </div>
      )}

      {saveStatusMessage && (
        <div className="mx-3 mt-2 px-2.5 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 leading-relaxed shrink-0">
          {saveStatusMessage}
        </div>
      )}

      {/* TAB 1: CONCISE CONDITIONS, SCORE-FREE CANDIDATES, ELEMENT PICKER & AI BOOTH RECOMMENDER */}
      {activeTab === 'setup' && (
        <>
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
            <section className="p-3 rounded-xl border border-slate-200 bg-white space-y-3">
              <div className="font-bold text-slate-900 border-b border-slate-100 pb-2">
                {ui.coreConditionsTitle}
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {ui.eventNameLabel}
                  </label>
                  <input
                    type="text"
                    value={config.eventName}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({ ...prev, eventName: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {ui.eventTypeLabel}
                  </label>
                  <select
                    value={config.eventType}
                    onChange={(e) => onSelectEventTypePreset(e.target.value as EventType)}
                    className="w-full px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {(Object.keys(EVENT_TYPE_MULTILANG) as EventType[]).map((t) => (
                      <option key={t} value={t}>
                        {EVENT_TYPE_MULTILANG[t][language]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {tr6(
                      language,
                      '운영 시나리오 (기상·비상 대응)',
                      'Operational Scenario',
                      '運用シナリオ',
                      '运营场景',
                      'Escenario operativo',
                      'Scénario opérationnel',
                    )}
                  </label>
                  <select
                    value={contingency}
                    onChange={(e) => onChangeContingency(e.target.value as ContingencyScenario)}
                    className={`w-full px-2.5 py-1.5 rounded-md border text-xs font-semibold focus:outline-none cursor-pointer transition-colors ${
                      contingency === 'normal'
                        ? 'bg-slate-50 border-slate-200 text-slate-800'
                        : 'bg-amber-100 border-amber-400 text-amber-900'
                    }`}
                  >
                    {(Object.keys(CONTINGENCY_MULTILANG) as ContingencyScenario[]).map((cKey) => (
                      <option key={cKey} value={cKey}>
                        {CONTINGENCY_MULTILANG[cKey][language]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {tr6(
                      language,
                      '무대 · 발표 구성 (실내 비공연 빔 프로젝터 지원)',
                      'Stage / Presentation Setup',
                      'ステージ・発表構成（プロジェクター対応）',
                      '舞台与演示配置（支持室内投影仪）',
                      'Configuración de escenario / proyector',
                      'Configuration scène / vidéoprojecteur',
                    )}
                  </label>
                  <select
                    value={config.stagePlacement ?? 'north_end'}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        stagePlacement: e.target.value as StagePlacementMode,
                      }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {(Object.keys(STAGE_PLACEMENT_I18N) as StagePlacementMode[]).map((mode) => (
                      <option key={mode} value={mode}>
                        {pickL6(language, STAGE_PLACEMENT_I18N[mode])}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      {ui.widthM}
                    </label>
                    <input
                      type="number"
                      min={80}
                      max={360}
                      step={10}
                      value={config.venueWidth}
                      onChange={(e) =>
                        onChangeConfig((prev) => ({
                          ...prev,
                          venueWidth: Math.max(80, Math.min(360, Number(e.target.value) || 160)),
                        }))
                      }
                      className="w-full px-2.5 py-1.5 font-mono tabular-nums rounded-md bg-slate-50 border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      {ui.depthM}
                    </label>
                    <input
                      type="number"
                      min={80}
                      max={300}
                      step={10}
                      value={config.venueDepth}
                      onChange={(e) =>
                        onChangeConfig((prev) => ({
                          ...prev,
                          venueDepth: Math.max(80, Math.min(300, Number(e.target.value) || 130)),
                        }))
                      }
                      className="w-full px-2.5 py-1.5 font-mono tabular-nums rounded-md bg-slate-50 border border-slate-200"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      {ui.attendanceLabel} ({ui.paxUnit})
                    </label>
                    <input
                      type="number"
                      min={200}
                      max={50000}
                      step={200}
                      value={config.expectedAttendance}
                      onChange={(e) =>
                        onChangeConfig((prev) => ({
                          ...prev,
                          expectedAttendance: Math.max(
                            200,
                            Math.min(50000, Number(e.target.value) || 1000),
                          ),
                        }))
                      }
                      className="w-full px-2.5 py-1.5 font-mono tabular-nums rounded-md bg-slate-50 border border-slate-200"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-700">
                        {ui.budgetLabel}
                      </label>
                      <span className="text-[11px] font-mono font-bold text-blue-700 tabular-nums">
                        {formatCurrency(config.budget, language)}
                      </span>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min={1}
                        max={100000000}
                        step={language === 'ko' ? 100 : 5000}
                        value={
                          language === 'ko'
                            ? Math.round((config.budget * 1350) / 10000)
                            : language === 'ja'
                              ? Math.round((config.budget * 150) / 10000)
                              : language === 'zh'
                                ? Math.round(config.budget * 7.2)
                                : language === 'es' || language === 'fr'
                                  ? Math.round(config.budget * 0.92)
                                  : Math.round(config.budget)
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
                          const safeUsd = Math.max(10, Math.min(100000000, nextUsd));
                          onChangeConfig((prev) => ({
                            ...prev,
                            budget: safeUsd,
                          }));
                        }}
                        className="w-full px-2.5 py-1.5 font-mono tabular-nums rounded-md bg-slate-50 border border-slate-200 pr-14 text-sm font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                  </div>
                </div>

                {isOverBudget && (
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 space-y-1.5">
                    <div className="text-[11px] font-semibold text-amber-900 tabular-nums">
                      {tr6(
                        language,
                        `현재 배치 비용(${formatCurrency(estimatedCost || 0, language)})이 설정 예산을 초과했습니다.`,
                        `Placed total (${formatCurrency(estimatedCost || 0, language)}) exceeds budget.`,
                        `配置費用（${formatCurrency(estimatedCost || 0, language)}）が設定予算を超過しています。`,
                        `当前配置费用（${formatCurrency(estimatedCost || 0, language)}）超出设定预算。`,
                        `El costo total (${formatCurrency(estimatedCost || 0, language)}) supera el presupuesto.`,
                        `Le coût total (${formatCurrency(estimatedCost || 0, language)}) dépasse le budget.`,
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {onResolveBudgetOverrun && (
                        <button
                          type="button"
                          onClick={onResolveBudgetOverrun}
                          className="flex-1 py-1 px-2 rounded bg-amber-700 hover:bg-amber-800 text-white text-[11px] font-semibold cursor-pointer"
                        >
                          {tr6(
                            language,
                            '예산 내 자동 맞춤',
                            'Fit to Budget',
                            '予算内に自動調整',
                            '自动匹配预算',
                            'Ajustar al presupuesto',
                            'Ajuster au budget',
                          )}
                        </button>
                      )}
                      {onRaiseBudgetToCost && (
                        <button
                          type="button"
                          onClick={onRaiseBudgetToCost}
                          className="py-1 px-2 rounded bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 text-[11px] font-medium cursor-pointer"
                        >
                          {tr6(
                            language,
                            '예산 상향',
                            'Raise Budget',
                            '予算引き上げ',
                            '上调预算',
                            'Ampliar presupuesto',
                            'Augmenter le budget',
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Barrier-Free Quick Checkboxes */}
                <div className="pt-1 space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-700">
                    {ui.accessibilityQuickTitle}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <label className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-slate-200 bg-slate-50 cursor-pointer text-[11px] text-slate-800">
                      <input
                        type="checkbox"
                        checked={config.accessibility.stepFreeRoutes}
                        onChange={(e) =>
                          onChangeConfig((prev) => ({
                            ...prev,
                            accessibility: {
                              ...prev.accessibility,
                              stepFreeRoutes: e.target.checked,
                            },
                          }))
                        }
                        className="accent-blue-600 rounded"
                      />
                      <span className="truncate">{ui.stepFreeLabel}</span>
                    </label>
                    <label className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-slate-200 bg-slate-50 cursor-pointer text-[11px] text-slate-800">
                      <input
                        type="checkbox"
                        checked={config.accessibility.wideCorridors}
                        onChange={(e) =>
                          onChangeConfig((prev) => ({
                            ...prev,
                            accessibility: {
                              ...prev.accessibility,
                              wideCorridors: e.target.checked,
                            },
                          }))
                        }
                        className="accent-emerald-600 rounded"
                      />
                      <span className="truncate">{ui.wideCorridorsLabel}</span>
                    </label>
                    <label className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-slate-200 bg-slate-50 cursor-pointer text-[11px] text-slate-800">
                      <input
                        type="checkbox"
                        checked={config.accessibility.accessibleRestrooms}
                        onChange={(e) =>
                          onChangeConfig((prev) => ({
                            ...prev,
                            accessibility: {
                              ...prev.accessibility,
                              accessibleRestrooms: e.target.checked,
                            },
                          }))
                        }
                        className="accent-blue-600 rounded"
                      />
                      <span className="truncate">{ui.accessibleRestroomsLabel}</span>
                    </label>
                  </div>
                </div>

                {/* Natural-Language Brief Quick Parser (All 6 Languages) */}
                <details className="group pt-1 border-t border-slate-100">
                  <summary className="flex items-center justify-between cursor-pointer text-[11px] font-semibold text-blue-700 py-1 list-none">
                    <span className="inline-flex items-center gap-1">
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>
                        {tr6(
                          language,
                          '자연어 한 줄로 조건 일괄 입력하기',
                          'Natural-Language Brief Input',
                          '自然言語で条件を一括入力',
                          '自然语言一键输入条件',
                          'Entrada de condiciones en lenguaje natural',
                          'Saisie en langage naturel',
                        )}
                      </span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="pt-2 space-y-2">
                    <textarea
                      rows={3}
                      value={aiPrompt}
                      onChange={(e) => onChangeAiPrompt(e.target.value)}
                      placeholder={tr6(
                        language,
                        '예: 160m×130m 실내 홀, 방문객 3,000명, 예산 9천만 원, 음식부스 6개·체험부스 10개 배치해줘',
                        'e.g., 160x130m indoor hall, 3,000 visitors, 6 food booths, 10 experience booths',
                        '例: 160m×130m屋内ホール、来場者3,000名、飲食6・体験10ブース配置',
                        '例：160m×130m室内展厅，访客3000人，餐饮6个、体验展位10个',
                        'Ej.: Pabellón interior 160×130m, 3.000 visitantes, 6 puestos comida, 10 stands',
                        'Ex. : Hall intérieur 160×130m, 3 000 visiteurs, 6 stands repas, 10 stands exp.',
                      )}
                      className="w-full px-2.5 py-2 rounded-md bg-slate-50 border border-slate-200 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                    <div className="flex flex-wrap gap-1">
                      {sampleBriefs.map((s) => (
                        <button
                          key={s.label}
                          type="button"
                          onClick={() => onChangeAiPrompt(s.text)}
                          className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[10px] text-slate-600 cursor-pointer"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={isParsingBrief || !aiPrompt.trim()}
                      onClick={onRunAiBriefParser}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>
                        {isParsingBrief
                          ? tr6(
                              language,
                              '조건 분석 중...',
                              'Parsing...',
                              '条件解析中...',
                              '正在解析条件...',
                              'Analizando...',
                              'Analyse...',
                            )
                          : tr6(
                              language,
                              '입력 문장으로 조건·도안 반영',
                              'Apply Natural-Language Brief',
                              '入力文で条件・図面を反映',
                              '根据描述更新条件与方案',
                              'Aplicar descripción al diseño',
                              'Appliquer le brief au plan',
                            )}
                      </span>
                    </button>
                    {aiBriefSummary && (
                      <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-2 rounded border border-slate-200">
                        {aiBriefSummary}
                      </p>
                    )}
                    {appliedPromptChanges && appliedPromptChanges.length > 0 && (
                      <p className="text-[10px] font-mono text-blue-700 leading-relaxed">
                        {appliedPromptChanges.join(' · ')}
                      </p>
                    )}
                  </div>
                </details>
              </div>
            </section>

            {/* Section 1B: Indoor vs Outdoor Venue + Floor Surface Selector (Preset / Color / Image -> Apply) + Exterior Parking */}
            <section className="p-3 rounded-xl border border-slate-200 bg-white space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-slate-900">{efStrings.envSectionTitle}</div>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                  {draftEnv === 'indoor' ? efStrings.indoorVenue : efStrings.outdoorVenue}
                </span>
              </div>

              {/* Indoor vs Outdoor Segmented Toggle */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => handleSelectVenueEnvironment('indoor')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    draftEnv === 'indoor'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{efStrings.indoorVenue}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectVenueEnvironment('outdoor')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    draftEnv === 'outdoor'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Trees className="w-3.5 h-3.5 shrink-0" />
                  <span>{efStrings.outdoorVenue}</span>
                </button>
              </div>

              {/* Floor Mode Tabs: Preset | Color | Image */}
              <div className="space-y-2.5 pt-0.5">
                <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-100 rounded-md">
                  <button
                    type="button"
                    onClick={() => setDraftFloorMode('preset')}
                    className={`py-1 px-1.5 rounded text-[11px] font-semibold cursor-pointer ${
                      draftFloorMode === 'preset'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {efStrings.floorModePreset}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftFloorMode('color')}
                    className={`inline-flex items-center justify-center gap-1 py-1 px-1.5 rounded text-[11px] font-semibold cursor-pointer ${
                      draftFloorMode === 'color'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Palette className="w-3 h-3 shrink-0" />
                    <span className="truncate">{efStrings.floorModeColor}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftFloorMode('image')}
                    className={`inline-flex items-center justify-center gap-1 py-1 px-1.5 rounded text-[11px] font-semibold cursor-pointer ${
                      draftFloorMode === 'image'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ImageIcon className="w-3 h-3 shrink-0" />
                    <span className="truncate">{efStrings.floorModeImage}</span>
                  </button>
                </div>

                {/* Mode 1: Indoor / Outdoor Material Presets */}
                {draftFloorMode === 'preset' && (
                  <div className="grid grid-cols-1 gap-1.5">
                    {draftEnv === 'indoor'
                      ? (Object.keys(INDOOR_FLOOR_PRESETS) as IndoorFloorPresetId[]).map((pid) => {
                          const item = INDOOR_FLOOR_PRESETS[pid];
                          const active = draftIndoorPreset === pid;
                          return (
                            <button
                              key={pid}
                              type="button"
                              onClick={() => setDraftIndoorPreset(pid)}
                              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border text-left transition-colors cursor-pointer ${
                                active
                                  ? 'border-blue-600 bg-blue-50/70 text-slate-900 font-semibold'
                                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                              }`}
                            >
                              <span className="inline-flex items-center gap-2 min-w-0">
                                <span
                                  className="w-4 h-4 rounded border border-slate-300 shrink-0"
                                  style={{ backgroundColor: item.previewHex }}
                                />
                                <span className="truncate text-[11px]">
                                  {pickL6(language, INDOOR_FLOOR_I18N[pid])}
                                </span>
                              </span>
                              {active && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                            </button>
                          );
                        })
                      : (Object.keys(OUTDOOR_FLOOR_PRESETS) as OutdoorFloorPresetId[]).map(
                          (pid) => {
                            const item = OUTDOOR_FLOOR_PRESETS[pid];
                            const active = draftOutdoorPreset === pid;
                            return (
                              <button
                                key={pid}
                                type="button"
                                onClick={() => setDraftOutdoorPreset(pid)}
                                className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border text-left transition-colors cursor-pointer ${
                                  active
                                    ? 'border-emerald-600 bg-emerald-50/70 text-slate-900 font-semibold'
                                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                                }`}
                              >
                                <span className="inline-flex items-center gap-2 min-w-0">
                                  <span
                                    className="w-4 h-4 rounded border border-slate-300 shrink-0"
                                    style={{ backgroundColor: item.previewHex }}
                                  />
                                  <span className="truncate text-[11px]">
                                    {pickL6(language, OUTDOOR_FLOOR_I18N[pid])}
                                  </span>
                                </span>
                                {active && (
                                  <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                )}
                              </button>
                            );
                          },
                        )}
                  </div>
                )}

                {/* Mode 2: Custom Floor Color Picker */}
                {draftFloorMode === 'color' && (
                  <div className="space-y-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={draftColor}
                        onChange={(e) => setDraftColor(e.target.value)}
                        aria-label="Floor Color Picker"
                        className="w-9 h-8 rounded border border-slate-300 bg-white cursor-pointer p-0.5 shrink-0"
                      />
                      <input
                        type="text"
                        value={draftColor}
                        onChange={(e) => setDraftColor(e.target.value)}
                        placeholder="#f1f5f9"
                        className="flex-1 px-2.5 py-1.5 rounded-md bg-white border border-slate-200 font-mono text-xs text-slate-900"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[
                        '#f8fafc',
                        '#dbeafe',
                        '#dcfce7',
                        '#fef3c7',
                        '#fce7f3',
                        '#e2e8f0',
                        '#475569',
                      ].map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => setDraftColor(hex)}
                          title={hex}
                          style={{ backgroundColor: hex }}
                          className={`w-6 h-6 rounded border cursor-pointer ${
                            draftColor.toLowerCase() === hex
                              ? 'ring-2 ring-blue-600 border-white'
                              : 'border-slate-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Mode 3: Custom Floor Image Upload or URL */}
                {draftFloorMode === 'image' && (
                  <div className="space-y-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => floorImageInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-[11px] font-semibold cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-blue-600" />
                      <span>{efStrings.uploadImageBtn}</span>
                    </button>
                    <input
                      ref={floorImageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFloorImageFileChange}
                    />
                    <input
                      type="text"
                      value={draftImageUrl.startsWith('data:') ? '' : draftImageUrl}
                      onChange={(e) => setDraftImageUrl(e.target.value)}
                      placeholder={efStrings.imageUrlPlaceholder}
                      className="w-full px-2.5 py-1.5 rounded-md bg-white border border-slate-200 text-[11px] text-slate-900 placeholder:text-slate-400"
                    />
                    {draftImageUrl && (
                      <div className="flex items-center gap-2 p-1.5 rounded bg-white border border-slate-200">
                        <img
                          src={draftImageUrl}
                          alt="Floor preview"
                          className="w-10 h-10 rounded object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0 flex-1 text-[10px] text-slate-600 truncate">
                          {draftImageUrl.startsWith('data:')
                            ? tr6(
                                language,
                                '업로드된 바닥 이미지 준비됨',
                                'Uploaded floor image ready',
                                '床面画像アップロード済み',
                                '地面图片已准备就绪',
                                'Imagen de suelo lista',
                                'Image de sol prête',
                              )
                            : draftImageUrl}
                        </div>
                        <button
                          type="button"
                          onClick={() => setDraftImageUrl('')}
                          className="px-1.5 py-0.5 rounded text-[10px] text-slate-500 hover:bg-slate-100 cursor-pointer"
                        >
                          {tr6(language, '비우기', 'Clear', '消去', '清除', 'Limpiar', 'Effacer')}
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => setDraftImageFit('repeat')}
                        className={`py-1 px-2 rounded border text-[11px] font-medium cursor-pointer ${
                          draftImageFit === 'repeat'
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        {efStrings.fitRepeat}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraftImageFit('cover')}
                        className={`py-1 px-2 rounded border text-[11px] font-medium cursor-pointer ${
                          draftImageFit === 'cover'
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        {efStrings.fitCover}
                      </button>
                    </div>
                  </div>
                )}

                {/* Floor Grid Checkbox + Explicit [바닥 적용] Button */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftShowGrid}
                      onChange={(e) => setDraftShowGrid(e.target.checked)}
                      className="accent-blue-600 rounded cursor-pointer"
                    />
                    <span>{efStrings.showGridLabel}</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleApplyFloorSettings}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{efStrings.applyFloorBtn}</span>
                  </button>
                </div>

                {floorAppliedNotice && (
                  <div className="px-2.5 py-1.5 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-medium text-emerald-800">
                    {efStrings.appliedFloorToast}
                  </div>
                )}
              </div>

              {/* Exterior Parking Installation (Outside Venue Perimeter) */}
              <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-800">
                    <Car className="w-3.5 h-3.5 text-slate-600" />
                    <span>{efStrings.exteriorParkingLabel}</span>
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-blue-700 tabular-nums">
                    {config.parkingCount ?? 1} {efStrings.exteriorParkingLotsUnit}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[0, 1, 2, 3, 4].map((cnt) => {
                    const active = (config.parkingCount ?? 1) === cnt;
                    return (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => {
                          if (onChangeExteriorParkingCount) {
                            onChangeExteriorParkingCount(cnt);
                          } else {
                            onChangeConfig((prev) => ({ ...prev, parkingCount: cnt }));
                          }
                        }}
                        className={`py-1 rounded border text-[11px] font-mono font-semibold cursor-pointer ${
                          active
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {cnt}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>



            {/* Section 3: Individual Knowledge DB Element Picker + Simple Custom Name + 3D Preview */}
            <section className="p-3 rounded-xl border border-slate-200 bg-white space-y-2.5">
              <div>
                <div className="font-bold text-slate-900">{ui.knowledgePickerTitle}</div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  {ui.knowledgePickerDesc}
                </p>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {tr6(
                      language,
                      '추가할 부스·시설 종류 (표준 DB 42종)',
                      'Element Type (42 DB Standards)',
                      '追加するブース・施設種類',
                      '要添加的展位·设施类型',
                      'Tipo de instalación estándar',
                      'Type d’installation standard',
                    )}
                  </label>
                  <select
                    value={pickerSubtype}
                    onChange={(e) => setPickerSubtype(e.target.value as FacilitySubtype)}
                    className="w-full px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-slate-900 cursor-pointer"
                  >
                    {CATALOG_PICKER_SUBTYPES.map((st) => (
                      <option key={st} value={st}>
                        {SUBTYPE_SIMPLE_LABELS[st]?.[language] || st} (
                        {getSubtypeBlueprintMeta(st).width}×{getSubtypeBlueprintMeta(st).depth}m)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      {ui.zoneLabel}
                    </label>
                    <select
                      value={pickerZone}
                      onChange={(e) => setPickerZone(e.target.value as SpatialZoneTarget)}
                      className="w-full px-2 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-slate-900 cursor-pointer"
                    >
                      {INDOOR_PICKER_ZONES.map((z) => (
                        <option key={z} value={z}>
                          {ZONE_SIMPLE_LABELS[z]?.[language] || z}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200 flex flex-col justify-center">
                    <span className="text-[10px] text-slate-500">
                      {tr6(
                        language,
                        '규격 · 예상 비용',
                        'Size · Est. Cost',
                        '寸法・推定費用',
                        '尺寸·预计费用',
                        'Tamaño · Costo est.',
                        'Taille · Coût est.',
                      )}
                    </span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums text-[11px]">
                      {selectedBlueprint.width}×{selectedBlueprint.depth}m ·{' '}
                      {formatCurrency(pickerEstCostUsd, language)}
                    </span>
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    value={pickerCustomName}
                    onChange={(e) => setPickerCustomName(e.target.value)}
                    placeholder={ui.customBoothNamePlaceholder}
                    className="w-full px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      onPreviewCatalogElement(pickerSubtype, pickerZone, pickerCustomName)
                    }
                    className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-md border border-slate-300 bg-white hover:border-blue-500 hover:text-blue-700 font-semibold text-slate-700 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{ui.previewElementBtn}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onAddCatalogElement(pickerSubtype, pickerZone, pickerCustomName);
                      setPickerCustomName('');
                    }}
                    className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{ui.addDirectBtn}</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Section 4: Mood-Matched AI Booth Recommendations */}
            <section className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-slate-900">{ui.aiBoothRecommendTitle}</div>
                <button
                  type="button"
                  disabled={isRecommendingBooths}
                  onClick={onRequestBoothRecommendations}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-semibold cursor-pointer shrink-0"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>
                    {isRecommendingBooths ? ui.aiBoothRecommending : ui.aiBoothRecommendBtn}
                  </span>
                </button>
              </div>

              <div className="space-y-2">
                {recommendedBooths.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{item.name}</span>
                      <span className="text-[10px] font-mono tabular-nums text-slate-500">
                        {ZONE_SIMPLE_LABELS[item.zone]?.[language] || item.zone} · {item.widthM}×
                        {item.depthM}m · {formatCurrency(item.estimatedCostUsd, language)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{item.reason}</p>
                    <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => onPreviewRecommendedBooth(item)}
                        className="flex items-center justify-center gap-1 py-1 px-2 rounded border border-slate-300 bg-white hover:border-blue-500 hover:text-blue-700 text-[11px] font-semibold text-slate-700 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>{ui.previewElementBtn}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onAddRecommendedBooth(item)}
                        className="flex items-center justify-center gap-1 py-1 px-2 rounded bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{ui.addDirectBtn}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 5: Collapsible Advanced Spatial Topology & Counts */}
            <details className="group p-3 rounded-xl border border-slate-200 bg-white">
              <summary className="flex items-center justify-between cursor-pointer font-semibold text-slate-800 list-none">
                <span>{ui.advancedTopologyToggle}</span>
                <ChevronRight className="w-4 h-4 text-slate-500 transition-transform group-open:rotate-90" />
              </summary>

              <div className="pt-3 mt-2 border-t border-slate-100 space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {tr6(
                      language,
                      '평면 경계 형태',
                      'Floor Boundary Shape',
                      '平面境界の形状',
                      '平面边界形状',
                      'Forma del perímetro',
                      'Forme du périmètre',
                    )}
                  </label>
                  <select
                    value={config.venueShape ?? 'rectangle'}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        venueShape: e.target.value as VenueBoundaryShape,
                      }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200 cursor-pointer"
                  >
                    {(Object.keys(VENUE_SHAPE_I18N) as VenueBoundaryShape[]).map((sh) => (
                      <option key={sh} value={sh}>
                        {VENUE_SHAPE_I18N[sh][language]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {tr6(
                      language,
                      '무대 배치 구조',
                      'Stage Placement',
                      'ステージ配置構造',
                      '舞台布局结构',
                      'Disposición del escenario',
                      'Disposition de la scène',
                    )}
                  </label>
                  <select
                    value={config.stagePlacement ?? 'north_end'}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        stagePlacement: e.target.value as StagePlacementMode,
                      }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200 cursor-pointer"
                  >
                    {(Object.keys(STAGE_PLACEMENT_I18N) as StagePlacementMode[]).map((sm) => (
                      <option key={sm} value={sm}>
                        {STAGE_PLACEMENT_I18N[sm][language]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {tr6(
                      language,
                      '부스 배열 방식',
                      'Spatial Layout Model',
                      'ブース配列モデル',
                      '展位排列模式',
                      'Modelo espacial de stands',
                      'Modèle d’implantation',
                    )}
                  </label>
                  <select
                    value={config.venueLayoutModel ?? 'standard'}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        venueLayoutModel: e.target.value as VenueLayoutModel,
                      }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200 cursor-pointer"
                  >
                    {(Object.keys(VENUE_LAYOUT_MODEL_I18N) as VenueLayoutModel[]).map((vm) => (
                      <option key={vm} value={vm}>
                        {VENUE_LAYOUT_MODEL_I18N[vm][language]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {tr6(
                      language,
                      '부스 3D 외관 스타일',
                      '3D Booth Style',
                      'ブース3D外観スタイル',
                      '展位3D外观风格',
                      'Estilo 3D de stands',
                      'Style 3D des stands',
                    )}
                  </label>
                  <select
                    value={config.boothModel ?? 'pagoda_tent'}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        boothModel: e.target.value as BoothModelStyle,
                      }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200 cursor-pointer"
                  >
                    {(Object.keys(BOOTH_MODEL_STYLE_LABELS) as BoothModelStyle[]).map((bm) => (
                      <option key={bm} value={bm}>
                        {BOOTH_MODEL_STYLE_I18N[bm]?.[language] || BOOTH_MODEL_STYLE_LABELS[bm].en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {tr6(
                      language,
                      '우선 설계 목표',
                      'Primary Design Objective',
                      '優先設計目標',
                      '优先设计目标',
                      'Objetivo prioritario',
                      'Objectif prioritaire',
                    )}
                  </label>
                  <select
                    value={config.objective}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        objective: e.target.value as DesignObjective,
                      }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200 cursor-pointer"
                  >
                    {(Object.keys(OBJECTIVE_MULTILANG) as DesignObjective[]).map((obj) => (
                      <option key={obj} value={obj}>
                        {OBJECTIVE_MULTILANG[obj][language]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {tr6(
                      language,
                      '운영·돌발 시나리오',
                      'Operational Scenario',
                      '運営・突発シナリオ',
                      '运营与突发情景',
                      'Escenario operativo',
                      'Scénario opérationnel',
                    )}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={contingency}
                      onChange={(e) =>
                        onChangeContingency(e.target.value as ContingencyScenario)
                      }
                      className="flex-1 px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200 cursor-pointer"
                    >
                      {(Object.keys(CONTINGENCY_MULTILANG) as ContingencyScenario[]).map((c) => (
                        <option key={c} value={c}>
                          {CONTINGENCY_MULTILANG[c][language]}
                        </option>
                      ))}
                    </select>
                    {contingency !== 'normal' && (
                      <button
                        type="button"
                        onClick={onReoptimizeContingency}
                        className="px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold shrink-0 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      {tr6(language, '음식부스 수', 'Food Booths', '飲食ブース数', '餐饮展位数', 'Stands comida', 'Stands F&B')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={24}
                      value={config.foodBoothCount}
                      onChange={(e) =>
                        onChangeConfig((prev) => ({
                          ...prev,
                          foodBoothCount: Math.max(0, Math.min(24, Number(e.target.value) || 0)),
                        }))
                      }
                      className="w-full px-2 py-1 font-mono tabular-nums rounded bg-slate-50 border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      {tr6(language, '체험·전시부스 수', 'Exp. Booths', '体験・展示数', '体验展位数', 'Stands exp.', 'Stands exp.')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={config.experienceBoothCount}
                      onChange={(e) =>
                        onChangeConfig((prev) => ({
                          ...prev,
                          experienceBoothCount: Math.max(
                            0,
                            Math.min(40, Number(e.target.value) || 0),
                          ),
                        }))
                      }
                      className="w-full px-2 py-1 font-mono tabular-nums rounded bg-slate-50 border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      {tr6(language, '출입구 수', 'Gates', '出入口数', '出入口数', 'Accesos', 'Entrées')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={config.entranceCount}
                      onChange={(e) =>
                        onChangeConfig((prev) => ({
                          ...prev,
                          entranceCount: Math.max(1, Math.min(6, Number(e.target.value) || 2)),
                        }))
                      }
                      className="w-full px-2 py-1 font-mono tabular-nums rounded bg-slate-50 border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      {tr6(language, '화장실 수', 'Restrooms', 'トイレ数', '洗手间数', 'Baños', 'Sanitaires')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={config.restroomCount ?? 3}
                      onChange={(e) =>
                        onChangeConfig((prev) => ({
                          ...prev,
                          restroomCount: Math.max(1, Math.min(8, Number(e.target.value) || 2)),
                        }))
                      }
                      className="w-full px-2 py-1 font-mono tabular-nums rounded bg-slate-50 border border-slate-200"
                    />
                  </div>
                </div>
              </div>
            </details>
          </div>

          {/* Setup Footer Actions */}
          <div className="p-3 border-t border-slate-200 bg-slate-50 space-y-2 shrink-0">
            <button
              type="button"
              onClick={onGenerateDesign}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{ui.generateAutoBtn}</span>
            </button>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={onSaveProject}
                className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-medium text-slate-700 cursor-pointer"
              >
                <Save className="w-3 h-3" />
                <span className="truncate">{ui.saveProjectBtn}</span>
              </button>
              <button
                type="button"
                onClick={onExportJson}
                className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-medium text-slate-700 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span className="truncate">{ui.exportJsonBtn}</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-medium text-slate-700 cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                <span className="truncate">{ui.importJsonBtn}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImportJson(f);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* TAB 2: AI CO-DESIGN CHAT WITH BEFORE/AFTER CONFIRMATION */}
      {activeTab === 'chat' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <GeminiArchitectChat
            language={language}
            messages={chatMessages}
            pendingProposals={pendingProposals}
            onPreviewProposal={onPreviewProposal}
            onApplyProposal={onApplyProposal}
            onUndoProposal={onUndoProposal}
            onCancelProposal={onCancelProposal}
            autoApply={autoApplyChat}
            onChangeAutoApply={onChangeAutoApplyChat}
            role={chatRole}
            onChangeRole={onChangeChatRole}
            modelTier={chatModelTier}
            onChangeModelTier={onChangeChatModelTier}
            isSending={isChatSending}
            onSendMessage={onSendChatMessage}
            onResetChat={onResetChat}
          />
        </div>
      )}

      {/* TAB 3: 3D LAYER VISIBILITY */}
      {activeTab === 'layers' && (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-slate-900">
              {tr6(
                language,
                '3D 레이어 표시 제어',
                '3D Layer Visibility',
                '3Dレイヤー表示制御',
                '3D图层显示控制',
                'Visibilidad de capas 3D',
                'Visibilité des calques 3D',
              )}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSetAllVisibility(true)}
                className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-medium text-slate-700 cursor-pointer"
              >
                {tr6(language, '전체 켜기', 'Show All', 'すべて表示', '全部显示', 'Mostrar todo', 'Tout afficher')}
              </button>
              <button
                type="button"
                onClick={() => onSetAllVisibility(false)}
                className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-medium text-slate-700 cursor-pointer"
              >
                {tr6(language, '최소 표시', 'Minimal', '最小表示', '最小显示', 'Mínimo', 'Minimal')}
              </button>
            </div>
          </div>

          {(['facility', 'analysis'] as const).map((grp) => (
            <div key={grp} className="space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-500">
                {grp === 'facility'
                  ? tr6(
                      language,
                      '행사장 시설·부스 요소',
                      'Venue Facilities & Booths',
                      '会場施設・ブース要素',
                      '场地设施与展位要素',
                      'Instalaciones y stands',
                      'Installations et stands',
                    )
                  : tr6(
                      language,
                      '방문객 시뮬레이션·동선',
                      'Crowd & Route Overlays',
                      '来場者シミュレーション・動線',
                      '人流模拟与动线',
                      'Simulación y rutas',
                      'Simulation et itinéraires',
                    )}
              </div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
                {LAYER_ITEMS.filter((item) => item.group === grp).map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 cursor-pointer"
                  >
                    <span className="text-slate-800">
                      {LAYER_LABEL_I18N[item.key]?.[language] || item.key}
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(visibility[item.key])}
                      onChange={() => onToggleVisibility(item.key)}
                      className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
};
