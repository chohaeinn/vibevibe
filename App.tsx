import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  Globe,
  LayoutDashboard,
  MessageSquare,
  Zap,
} from 'lucide-react';
import {
  buildDeterministicXaiReport,
  buildLayoutComparison,
  evaluateInclusivePersonas,
  evaluateVenueLayout,
  generateMultiObjectiveCandidates,
  generateRuleBasedRecommendations,
} from './engine/analyticsEngine';
import { CrowdSimulator } from './engine/crowdSimulation';
import {
  densityUnitLabel,
  getLocalizedDensityProfile,
  getLocalizedLiteratureRegistry,
  getProfileTierBadgeText,
  runExplicitSpatialSafetyAudit,
} from './engine/evidenceBase';
import { DEFAULT_STATUTORY_CHECKLIST } from './engine/knowledgeDatabase';
import {
  applyAiFacilityActions,
  applyInclusivePersonaUpgrade,
  buildCatalogFacilityItem,
  clampAndResolveSingleFacility,
  clampExteriorParkingPosition,
  computeFacilityClearanceAudit,
  enforceZeroFacilityOverlap,
  extractDeterministicFacilityActions,
  fitLayoutToBudget,
  generateVenueLayout,
  getFallbackMoodRecommendations,
  mergeExplicitPromptOverrides,
  parseBriefDeterministically,
  reoptimizeForContingency,
  validateEventConfig,
} from './engine/layoutGenerator';
import {
  BOOTH_MODEL_STYLE_LABELS,
  DEFAULT_EVENT_CONFIG,
  DEFAULT_FACILITIES,
  DEFAULT_FIELD_CALIBRATION,
  DEFAULT_FLOOR_SETTINGS,
  DEFAULT_LAYER_VISIBILITY,
  DEFAULT_SIMULATION_ASSUMPTIONS,
  EVENT_TYPE_PRESETS,
  formatCurrency,
  getEffectiveFacilityCost,
  getFacilityDisplayName,
} from './engine/presets';
import {
  DEFAULT_AI_PROMPT_I18N,
  EVENT_PRESET_NAME_I18N,
  getLocaleCode,
  INDOOR_FLOOR_I18N,
  isKnownPresetEventName,
  OUTDOOR_FLOOR_I18N,
  pickL6,
  STAGE_PLACEMENT_I18N,
  tr6,
  VENUE_LAYOUT_MODEL_I18N,
  VENUE_SHAPE_I18N,
  WELCOME_CHAT_MESSAGE_I18N,
} from './i18n/localeCatalog';
import { LANGUAGE_OPTIONS, SUBTYPE_SIMPLE_LABELS, tUi } from './i18n/translations';
import {
  AiFacilityAction,
  ArchitectChatMessage,
  BoothModelStyle,
  CandidateLayout,
  ChatArchitectRole,
  ChatModelTier,
  ContingencyScenario,
  CustomRequestedFacilitySpec,
  DesignObjective,
  DeviceControlMode,
  EventConfig,
  EventType,
  Facility,
  FacilitySubtype,
  FieldCalibrationSample,
  GhostPreviewState,
  KnowledgeFocusContext,
  Language,
  LayerVisibility,
  ParsedBriefResult,
  PendingAiProposal,
  Recommendation,
  RecommendedBoothItem,
  SavedProjectPayload,
  SimulationAssumptions,
  SimulationPlayState,
  SimulationSnapshot,
  SpatialZoneTarget,
  StagePlacementMode,
  StatutorySafetyChecklistState,
  VenueBoundaryShape,
  VenueLayoutModel,
  VisitorPersonaId,
  WeatherScenarioId,
  WorkflowStageId,
  XaiExplanation,
} from './types/festival';
import { AnalyticsView } from './components/AnalyticsView';
import { BottomSummaryBar } from './components/BottomSummaryBar';
import { ComparisonView } from './components/ComparisonView';
import { IntegrationView } from './components/IntegrationView';
import { KnowledgeBaseView } from './components/KnowledgeBaseView';
import { LeftSidebar } from './components/LeftSidebar';
import { RightSidebar } from './components/RightSidebar';
import { SimulationTimelineDock } from './components/SimulationTimelineDock';
import { ThreeVenueCanvas } from './components/ThreeVenueCanvas';
import { XaiReportView } from './components/XaiReportView';
import { LandingPageView } from './components/LandingPageView';

type NavSection =
  | 'landing'
  | 'workspace'
  | 'comparison'
  | 'analytics'
  | 'knowledge_db'
  | 'xai_report'
  | 'integration';

const STORAGE_PREFIX = 'ai_festival_designer_proj_';

const VALID_EVENT_TYPES: EventType[] = [
  'music_festival',
  'school_festival',
  'sports_event',
  'exhibition',
  'career_fair',
  'community_festival',
  'flea_market',
];

const VALID_OBJECTIVES: DesignObjective[] = [
  'safety_first',
  'congestion_reduction',
  'accessibility_inclusion',
  'visitor_engagement',
  'operational_efficiency',
  'budget_efficiency',
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

const VALID_VENUE_SHAPES: VenueBoundaryShape[] = [
  'rectangle',
  'circle_arena',
  'fan_amphitheater',
  'linear_park',
  'courtyard_campus',
  'expo_hall',
];

const VALID_STAGE_PLACEMENTS: StagePlacementMode[] = [
  'north_end',
  'center_360',
  'twin_stages',
  'runway_keynote',
  'projector_screen',
  'none',
];

declare global {
  interface Window {
    __STREAMLIT_INITIAL_PAYLOAD__?: {
      config?: Partial<EventConfig>;
      facilities?: Facility[];
      contingency?: ContingencyScenario;
    };
  }
}

export default function App() {
  const initialBootstrap = useMemo(() => {
    const ext = window.__STREAMLIT_INITIAL_PAYLOAD__;
    const cfg: EventConfig = ext?.config
      ? { ...DEFAULT_EVENT_CONFIG, ...ext.config }
      : DEFAULT_EVENT_CONFIG;
    const facs: Facility[] =
      ext?.facilities && Array.isArray(ext.facilities) && ext.facilities.length > 0
        ? ext.facilities
        : DEFAULT_FACILITIES;
    const cont: ContingencyScenario = ext?.contingency || 'normal';
    return { cfg, facs, cont };
  }, []);

  const [language, setLanguage] = useState<Language>('ko');
  const [activeNav, setActiveNav] = useState<NavSection>('landing');
  const [workflowStage, setWorkflowStage] = useState<WorkflowStageId>('conditions');
  const [config, setConfig] = useState<EventConfig>(initialBootstrap.cfg);
  const [originalFacilities, setOriginalFacilities] = useState<Facility[]>(initialBootstrap.facs);
  const [activeLayoutMode, setActiveLayoutMode] = useState<'original' | 'optimized'>('original');
  const [contingency, setContingency] = useState<ContingencyScenario>(initialBootstrap.cont);
  const [visibility, setVisibility] = useState<LayerVisibility>(DEFAULT_LAYER_VISIBILITY);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [activePersonaId, setActivePersonaId] = useState<VisitorPersonaId | null>(null);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(true);
  const [leftSidebarTab, setLeftSidebarTab] = useState<'chat' | 'setup' | 'layers'>('setup');
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(true);
  const [isNewPlanModalOpen, setIsNewPlanModalOpen] = useState<boolean>(false);

  // Simple auth simulation from Python code
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('김다온');
  const [userRole, setUserRole] = useState('기획자');

  // Device Control Mode (auto-detected with manual switch)
  const [deviceMode, setDeviceMode] = useState<DeviceControlMode>(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
      ? 'tablet'
      : 'laptop',
  );
  const userOverrodeDeviceRef = useRef<boolean>(false);

  useEffect(() => {
    const onPointerDownGlobal = (ev: PointerEvent) => {
      if (!userOverrodeDeviceRef.current && ev.pointerType === 'pen') {
        setDeviceMode('tablet');
      }
    };
    window.addEventListener('pointerdown', onPointerDownGlobal, { passive: true });
    return () => window.removeEventListener('pointerdown', onPointerDownGlobal);
  }, []);

  const handleChangeDeviceMode = useCallback((mode: DeviceControlMode) => {
    userOverrodeDeviceRef.current = true;
    setDeviceMode(mode);
  }, []);

  // 3D Ghost Preview state (candidate, catalog element, or AI diff proposal)
  const [ghostPreview, setGhostPreview] = useState<GhostPreviewState | null>(null);
  const [focusedKnowledgeContext, setFocusedKnowledgeContext] =
    useState<KnowledgeFocusContext | null>(null);

  const handleOpenKnowledgeWithContext = useCallback((ctx: KnowledgeFocusContext) => {
    setFocusedKnowledgeContext(ctx);
    setActiveNav('knowledge_db');
  }, []);

  // Mood-Matched AI Booth Recommendations
  const [recommendedBooths, setRecommendedBooths] = useState<RecommendedBoothItem[]>(() =>
    getFallbackMoodRecommendations(initialBootstrap.cfg, initialBootstrap.facs, 'ko'),
  );
  const [isRecommendingBooths, setIsRecommendingBooths] = useState<boolean>(false);

  // Natural-Language Brief Parser state
  const [aiPrompt, setAiPrompt] = useState<string>(DEFAULT_AI_PROMPT_I18N.ko);
  const lastAppliedPromptRef = useRef<string>(aiPrompt.trim());
  const [isParsingBrief, setIsParsingBrief] = useState<boolean>(false);
  const [aiBriefSummary, setAiBriefSummary] = useState<string | null>(null);
  const [appliedPromptChanges, setAppliedPromptChanges] = useState<string[]>([]);

  // Multi-Turn AI Spatial Co-Design Chat + Before/After Confirmation Proposals + Auto-Apply
  const [chatRole, setChatRole] = useState<ChatArchitectRole>('spatial_architect');
  const [chatModelTier, setChatModelTier] = useState<ChatModelTier>('fast');
  const [autoApplyChat, setAutoApplyChat] = useState<boolean>(false);
  const [isChatSending, setIsChatSending] = useState<boolean>(false);
  const [pendingProposals, setPendingProposals] = useState<Record<string, PendingAiProposal>>({});
  const [chatMessages, setChatMessages] = useState<ArchitectChatMessage[]>(() => [
    {
      id: 'welcome-architect',
      role: 'model',
      personaRole: 'spatial_architect',
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      text: WELCOME_CHAT_MESSAGE_I18N.ko,
    },
  ]);

  // Multi-objective Candidates & XAI Report state
  const [candidateSeedOffset, setCandidateSeedOffset] = useState<number>(0);
  const [approvedCandidateId, setApprovedCandidateId] = useState<'A' | 'B' | 'C' | 'D' | null>(
    null,
  );
  const [aiXaiOverride, setAiXaiOverride] = useState<XaiExplanation | null>(null);
  const [isGeneratingAiXai, setIsGeneratingAiXai] = useState<boolean>(false);

  // Simulation Transport State: MUST start 'stopped' (progress = 0) on load!
  const [simPlayState, setSimPlayState] = useState<SimulationPlayState>('stopped');
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [assumptions, setAssumptions] = useState<SimulationAssumptions>(
    DEFAULT_SIMULATION_ASSUMPTIONS,
  );
  const [calibration, setCalibration] = useState<FieldCalibrationSample>(DEFAULT_FIELD_CALIBRATION);
  const [checklist, setChecklist] = useState<StatutorySafetyChecklistState>(
    DEFAULT_STATUTORY_CHECKLIST,
  );
  const [weatherScenario, setWeatherScenario] = useState<WeatherScenarioId>('clear');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saveStatusMessage, setSaveStatusMessage] = useState<string | null>(null);
  const [savedProjectsVersion, setSavedProjectsVersion] = useState(0);

  const ui = tUi(language);
  const localeCode = getLocaleCode(language);

  // Synchronize default prompts, preset event name, welcome chat, and fallback recommendations when switching language
  useEffect(() => {
    setAiPrompt((prev) =>
      Object.values(DEFAULT_AI_PROMPT_I18N).includes(prev)
        ? DEFAULT_AI_PROMPT_I18N[language]
        : prev,
    );
    setChatMessages((prev) =>
      prev.map((m) =>
        m.id === 'welcome-architect'
          ? {
              ...m,
              text: WELCOME_CHAT_MESSAGE_I18N[language],
              timestamp: new Date().toLocaleTimeString(getLocaleCode(language), {
                hour: '2-digit',
                minute: '2-digit',
              }),
            }
          : m,
      ),
    );
    setConfig((prev) =>
      isKnownPresetEventName(prev.eventName)
        ? { ...prev, eventName: EVENT_PRESET_NAME_I18N[prev.eventType][language] }
        : prev,
    );
    setRecommendedBooths(getFallbackMoodRecommendations(config, originalFacilities, language));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const comparison = useMemo(
    () =>
      buildLayoutComparison(config, originalFacilities, 0.64, contingency, assumptions, language),
    [config, originalFacilities, contingency, assumptions, language],
  );

  const activeFacilities =
    activeLayoutMode === 'optimized' ? comparison.optimizedFacilities : originalFacilities;

  const activeEffectiveConfig = useMemo<EventConfig>(() => {
    if (activeLayoutMode === 'optimized') {
      return {
        ...config,
        accessibility: {
          ...config.accessibility,
          stepFreeRoutes: true,
          wideCorridors: true,
        },
      };
    }
    return config;
  }, [config, activeLayoutMode]);

  // Persistent CrowdSimulator instance starting at progress = 0 ('stopped')
  const simulatorRef = useRef<CrowdSimulator>(
    new CrowdSimulator(activeEffectiveConfig, activeFacilities, contingency, assumptions),
  );

  const [snapshot, setSnapshot] = useState<SimulationSnapshot>(() => {
    simulatorRef.current.seekToProgress(0);
    return simulatorRef.current.getSnapshot();
  });

  useEffect(() => {
    const keepProgress =
      simPlayState === 'stopped' ? 0 : simulatorRef.current.getSnapshot().progress;
    simulatorRef.current.rebuild(
      activeEffectiveConfig,
      activeFacilities,
      keepProgress,
      contingency,
      assumptions,
    );
    setSnapshot(simulatorRef.current.getSnapshot());
  }, [activeEffectiveConfig, activeFacilities, contingency, assumptions, simPlayState]);

  useEffect(() => {
    setAiXaiOverride(null);
  }, [activeEffectiveConfig, activeFacilities, contingency, assumptions, language]);

  // Refresh default mood-matched recommendations when eventType changes
  useEffect(() => {
    setRecommendedBooths(getFallbackMoodRecommendations(config, originalFacilities, language));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.eventType]);

  const summary = useMemo(
    () => evaluateVenueLayout(activeEffectiveConfig, activeFacilities, snapshot, assumptions),
    [activeEffectiveConfig, activeFacilities, snapshot, assumptions],
  );

  const safetyAudit = useMemo(
    () =>
      runExplicitSpatialSafetyAudit(
        activeEffectiveConfig,
        activeFacilities,
        snapshot,
        assumptions,
        calibration,
        language,
      ),
    [activeEffectiveConfig, activeFacilities, snapshot, assumptions, calibration, language],
  );

  const personas = useMemo(
    () => evaluateInclusivePersonas(activeEffectiveConfig, activeFacilities, language),
    [activeEffectiveConfig, activeFacilities, language],
  );

  const clearanceAudit = useMemo(
    () => computeFacilityClearanceAudit(activeFacilities, activeEffectiveConfig),
    [activeFacilities, activeEffectiveConfig],
  );

  const candidates = useMemo<CandidateLayout[]>(() => {
    const seededCfg: EventConfig = {
      ...config,
      seed: (config.seed + candidateSeedOffset) & 0x7fffffff,
    };
    return generateMultiObjectiveCandidates(seededCfg, originalFacilities, language);
  }, [config, originalFacilities, candidateSeedOffset, language]);

  const deterministicXai = useMemo(
    () =>
      buildDeterministicXaiReport(
        activeEffectiveConfig,
        summary,
        comparison,
        personas,
        contingency,
        language,
        assumptions,
      ),
    [activeEffectiveConfig, summary, comparison, personas, contingency, language, assumptions],
  );

  const xaiReport = aiXaiOverride || deterministicXai;

  const recommendations = useMemo(
    () =>
      generateRuleBasedRecommendations(
        activeEffectiveConfig,
        activeFacilities,
        snapshot,
        summary,
        language,
      ),
    [activeEffectiveConfig, activeFacilities, snapshot, summary, language],
  );

  const selectedFacility = useMemo(
    () => activeFacilities.find((f) => f.id === selectedFacilityId) ?? null,
    [activeFacilities, selectedFacilityId],
  );

  const highlightedFacilityIds = useMemo(() => {
    if (!activePersonaId) return [];
    const found = personas.find((p) => p.id === activePersonaId);
    return found ? found.highlightFacilityIds : [];
  }, [activePersonaId, personas]);

  const savedProjects = useMemo(() => {
    void savedProjectsVersion;
    const list: Array<{
      key: string;
      name: string;
      savedAt: string;
      payload: SavedProjectPayload;
    }> = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw) as SavedProjectPayload;
            if (parsed?.config?.eventName && Array.isArray(parsed.facilities)) {
              list.push({
                key,
                name: parsed.config.eventName,
                savedAt: parsed.savedAt,
                payload: parsed,
              });
            }
          }
        }
      }
    } catch {
      // Ignore storage restrictions
    }
    return list.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }, [savedProjectsVersion]);

  const flashStatus = useCallback((msg: string) => {
    setSaveStatusMessage(msg);
    window.setTimeout(() => {
      setSaveStatusMessage((cur) => (cur === msg ? null : cur));
    }, 3200);
  }, []);

  // Configuration Change Handler (preserves locked booths!)
  const handleChangeConfig = useCallback(
    (updater: (prev: EventConfig) => EventConfig) => {
      const currentEffective = activeEffectiveConfig;
      const next = updater(currentEffective);
      setValidationErrors(validateEventConfig(next, language));

      const accChanged =
        currentEffective.accessibility.stepFreeRoutes !== next.accessibility.stepFreeRoutes ||
        currentEffective.accessibility.wideCorridors !== next.accessibility.wideCorridors ||
        currentEffective.accessibility.accessibleRestrooms !==
          next.accessibility.accessibleRestrooms ||
        currentEffective.accessibility.accessibleParking !== next.accessibility.accessibleParking;

      const prevLayout = currentEffective.venueLayoutModel ?? 'standard';
      const nextLayout = next.venueLayoutModel ?? 'standard';
      const prevShape = currentEffective.venueShape ?? 'rectangle';
      const nextShape = next.venueShape ?? 'rectangle';
      const prevStageMode = currentEffective.stagePlacement ?? 'north_end';
      const nextStageMode = next.stagePlacement ?? 'north_end';
      const prevBooth = currentEffective.boothModel ?? 'pagoda_tent';
      const nextBooth = next.boothModel ?? 'pagoda_tent';
      const customElementsChanged =
        JSON.stringify(currentEffective.customElements ?? []) !==
        JSON.stringify(next.customElements ?? []);

      const structuralLayoutChanged =
        prevLayout !== nextLayout ||
        prevShape !== nextShape ||
        prevStageMode !== nextStageMode ||
        customElementsChanged ||
        currentEffective.venueWidth !== next.venueWidth ||
        currentEffective.venueDepth !== next.venueDepth ||
        currentEffective.foodBoothCount !== next.foodBoothCount ||
        currentEffective.experienceBoothCount !== next.experienceBoothCount ||
        currentEffective.seatingBlockCount !== next.seatingBlockCount ||
        currentEffective.entranceCount !== next.entranceCount ||
        currentEffective.restroomCount !== next.restroomCount ||
        currentEffective.medicalCount !== next.medicalCount ||
        currentEffective.parkingCount !== next.parkingCount ||
        currentEffective.subStageCount !== next.subStageCount ||
        currentEffective.requiredFacilities.vipZone !== next.requiredFacilities.vipZone ||
        currentEffective.requiredFacilities.campingArea !== next.requiredFacilities.campingArea ||
        currentEffective.requiredFacilities.extraMedical !== next.requiredFacilities.extraMedical ||
        currentEffective.requiredFacilities.playRestZone !== next.requiredFacilities.playRestZone;

      if (structuralLayoutChanged) {
        // If user intentionally started a blank plan (0 facilities) and only resizes width/depth, keep it blank!
        const onlyScaleChanged =
          originalFacilities.length === 0 &&
          prevLayout === nextLayout &&
          prevShape === nextShape &&
          prevStageMode === nextStageMode &&
          !customElementsChanged &&
          currentEffective.foodBoothCount === next.foodBoothCount &&
          currentEffective.experienceBoothCount === next.experienceBoothCount;

        if (!onlyScaleChanged) {
          const regenerated = generateVenueLayout(next, originalFacilities);
          setOriginalFacilities(regenerated);
          setActiveLayoutMode('original');
          setApprovedCandidateId(null);
          setSelectedFacilityId(null);
        }
      } else if (prevBooth !== nextBooth) {
        const prevMult = BOOTH_MODEL_STYLE_LABELS[prevBooth]?.costMult ?? 1;
        const nextMult = BOOTH_MODEL_STYLE_LABELS[nextBooth]?.costMult ?? 1;
        const ratio = prevMult > 0 ? nextMult / prevMult : 1;
        const baseFacs =
          activeLayoutMode === 'optimized' ? comparison.optimizedFacilities : originalFacilities;
        setOriginalFacilities(
          baseFacs.map((f) =>
            !f.locked && (f.subtype === 'experience_booth' || f.subtype === 'food_stall')
              ? { ...f, cost: Math.round(f.cost * ratio) }
              : f,
          ),
        );
        if (activeLayoutMode === 'optimized') {
          setActiveLayoutMode('original');
        }
      } else if (accChanged) {
        const baseFacs =
          activeLayoutMode === 'optimized' ? comparison.optimizedFacilities : originalFacilities;
        if (currentEffective.accessibility.stepFreeRoutes !== next.accessibility.stepFreeRoutes) {
          const enableRamps = next.accessibility.stepFreeRoutes;
          setOriginalFacilities(
            baseFacs.map((f) => ({
              ...f,
              accessibility: {
                ...f.accessibility,
                wheelchairAccessible: enableRamps,
                stepFreeEntry: enableRamps,
              },
            })),
          );
        }
        if (activeLayoutMode === 'optimized') {
          setActiveLayoutMode('original');
        }
      }

      setConfig(next);
    },
    [
      activeEffectiveConfig,
      activeLayoutMode,
      comparison.optimizedFacilities,
      language,
      originalFacilities,
    ],
  );

  const handleQuickToggleAccessibility = useCallback(
    (key: 'stepFreeRoutes' | 'wideCorridors' | 'accessibleRestrooms' | 'accessibleParking') => {
      handleChangeConfig((prev) => ({
        ...prev,
        accessibility: {
          ...prev.accessibility,
          [key]: !prev.accessibility[key],
        },
      }));
    },
    [handleChangeConfig],
  );

  const handleChangeExteriorParkingCount = useCallback(
    (rawCount: number) => {
      const targetCount = Math.max(0, Math.min(4, Math.round(rawCount)));
      const base =
        activeLayoutMode === 'optimized' ? comparison.optimizedFacilities : originalFacilities;
      const nonParking = base.filter((f) => f.category !== 'parking');
      const existingParking = base.filter((f) => f.category === 'parking');
      const lockedParking = existingParking.filter((f) => f.locked);
      const unlockedParking = existingParking.filter((f) => !f.locked);

      const W = activeEffectiveConfig.venueWidth;
      const D = activeEffectiveConfig.venueDepth;
      const exteriorSpecs = [
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

      const keptParking: Facility[] = [...lockedParking];
      for (const up of unlockedParking) {
        if (keptParking.length < targetCount) {
          keptParking.push(up);
        }
      }
      while (keptParking.length < targetCount) {
        const idx = keptParking.length;
        const spec = exteriorSpecs[idx % exteriorSpecs.length];
        const pos = clampExteriorParkingPosition(spec.x, spec.z, spec.w, spec.d, W, D);
        keptParking.push({
          id: `parking-exterior-${idx + 1}-${Date.now().toString().slice(-3)}`,
          name: spec.name,
          nameKo: spec.nameKo,
          category: 'parking',
          subtype: 'parking_lot',
          position: pos,
          dimensions: { width: spec.w, depth: spec.d, height: 2.4 },
          rotation: 0,
          capacity: Math.round(spec.w * spec.d * 0.35),
          cost: 9200,
          attractionWeight: 0.7,
          colorAccent: '#475569',
          covered: false,
          accessibility: {
            wheelchairAccessible: true,
            stepFreeEntry: true,
            priorityQueue: true,
          },
          notes: '행사장 외부 공간에 설치되어 주출입구 무단차 보행 연결로와 이어지는 외부 주차장입니다.',
        });
      }

      const nextCfg: EventConfig = {
        ...activeEffectiveConfig,
        parkingCount: targetCount,
      };
      const resolved = enforceZeroFacilityOverlap([...nonParking, ...keptParking], nextCfg);
      setConfig(nextCfg);
      setOriginalFacilities(resolved);
      setActiveLayoutMode('original');
      if (targetCount > 0) {
        setVisibility((prev) => ({ ...prev, parking: true }));
      }
    },
    [activeEffectiveConfig, activeLayoutMode, comparison.optimizedFacilities, originalFacilities],
  );

  const handleSelectEventTypePreset = useCallback(
    (type: EventType) => {
      const preset = EVENT_TYPE_PRESETS[type] || {};
      const defaultEnvForType =
        type === 'exhibition' || type === 'career_fair'
          ? 'indoor'
          : type === 'sports_event' || type === 'flea_market'
            ? 'outdoor'
            : (config.venueEnvironment ?? 'indoor');
      const nextCfg: EventConfig = {
        ...DEFAULT_EVENT_CONFIG,
        ...preset,
        eventName: EVENT_PRESET_NAME_I18N[type][language],
        eventType: type,
        venueEnvironment: defaultEnvForType,
        floorSettings: config.floorSettings ?? DEFAULT_FLOOR_SETTINGS,
        parkingCount: preset.parkingCount ?? 1,
        seed: Date.now() & 0x7fffffff,
      };
      setConfig(nextCfg);
      setValidationErrors([]);
      setActiveLayoutMode('original');
      setApprovedCandidateId(null);
      setSelectedFacilityId(null);
      setGhostPreview(null);
      const lockedOnly = originalFacilities.filter((f) => f.locked);
      if (type === 'music_festival' && lockedOnly.length === 0) {
        setOriginalFacilities(DEFAULT_FACILITIES);
      } else {
        setOriginalFacilities(generateVenueLayout(nextCfg, lockedOnly));
      }
    },
    [config.floorSettings, config.venueEnvironment, language, originalFacilities],
  );

  // Pure or Committing Brief Parser & Spatial Action Executor
  const applyParsedBrief = useCallback(
    (
      parsed: ParsedBriefResult,
      sourceLabel: string,
      rawPromptText?: string,
      baselineConfigOverride?: EventConfig,
      baselineFacilitiesOverride?: Facility[],
      silentFlash?: boolean,
      commitChanges = true,
    ): {
      diffTags: string[];
      nextCfg: EventConfig;
      facilities: Facility[];
      nextContingency?: ContingencyScenario;
    } => {
      const baseCfg = baselineConfigOverride ?? config;
      const baseFacs = baselineFacilitiesOverride ?? activeFacilities;

      const eventType: EventType = VALID_EVENT_TYPES.includes(parsed.eventType)
        ? parsed.eventType
        : baseCfg.eventType;
      const objective: DesignObjective = VALID_OBJECTIVES.includes(parsed.objective)
        ? parsed.objective
        : baseCfg.objective;
      const venueLayoutModel: VenueLayoutModel =
        parsed.venueLayoutModel && VALID_VENUE_MODELS.includes(parsed.venueLayoutModel)
          ? parsed.venueLayoutModel
          : baseCfg.venueLayoutModel ?? 'standard';
      const boothModel: BoothModelStyle =
        parsed.boothModel && VALID_BOOTH_MODELS.includes(parsed.boothModel)
          ? parsed.boothModel
          : baseCfg.boothModel ?? 'pagoda_tent';
      const venueShape: VenueBoundaryShape =
        parsed.venueShape && VALID_VENUE_SHAPES.includes(parsed.venueShape)
          ? parsed.venueShape
          : baseCfg.venueShape ?? 'rectangle';
      const stagePlacement: StagePlacementMode =
        parsed.stagePlacement && VALID_STAGE_PLACEMENTS.includes(parsed.stagePlacement)
          ? parsed.stagePlacement
          : baseCfg.stagePlacement ?? 'north_end';

      let nextCustomElements: CustomRequestedFacilitySpec[] = parsed.clearCustomElements
        ? []
        : [...(baseCfg.customElements ?? [])];
      let customElementsChanged = Boolean(parsed.clearCustomElements);

      if (Array.isArray(parsed.customElements) && parsed.customElements.length > 0) {
        customElementsChanged = true;
        for (const incoming of parsed.customElements) {
          if (!incoming || !incoming.nameKo || !incoming.subtype) continue;
          const sanitized: CustomRequestedFacilitySpec = {
            nameKo: String(incoming.nameKo).slice(0, 36),
            nameEn: String(incoming.nameEn || incoming.nameKo).slice(0, 44),
            category: incoming.category,
            subtype: incoming.subtype,
            count: Math.max(1, Math.min(12, Math.round(Number(incoming.count) || 1))),
            zoneHint: incoming.zoneHint,
          };
          const existIdx = nextCustomElements.findIndex(
            (c) =>
              (c.subtype !== 'experience_booth' &&
                c.subtype !== 'food_stall' &&
                c.subtype === sanitized.subtype) ||
              c.nameKo.replace(/\s+/g, '') === sanitized.nameKo.replace(/\s+/g, ''),
          );
          if (existIdx >= 0) {
            nextCustomElements[existIdx] = sanitized;
          } else {
            nextCustomElements.push(sanitized);
          }
        }
      }
      nextCustomElements = nextCustomElements.slice(0, 14);

      const prevFloor = baseCfg.floorSettings ?? DEFAULT_FLOOR_SETTINGS;
      const nextFloor = {
        ...prevFloor,
        mode: parsed.floorMode ?? prevFloor.mode,
        indoorPreset: parsed.indoorFloorPreset ?? prevFloor.indoorPreset,
        outdoorPreset: parsed.outdoorFloorPreset ?? prevFloor.outdoorPreset,
        customColor: parsed.floorCustomColor ?? prevFloor.customColor,
        showGrid: parsed.showFloorGrid ?? prevFloor.showGrid,
      };
      const nextEnv =
        parsed.venueEnvironment === 'indoor' || parsed.venueEnvironment === 'outdoor'
          ? parsed.venueEnvironment
          : (baseCfg.venueEnvironment ?? 'indoor');

      let nextCfg: EventConfig = {
        ...baseCfg,
        eventName: (parsed.eventName || baseCfg.eventName).slice(0, 60),
        eventType,
        venueEnvironment: nextEnv,
        floorSettings: nextFloor,
        venueWidth: Math.max(80, Math.min(360, Math.round(parsed.venueWidth ?? baseCfg.venueWidth))),
        venueDepth: Math.max(80, Math.min(300, Math.round(parsed.venueDepth ?? baseCfg.venueDepth))),
        expectedAttendance: Math.max(
          200,
          Math.min(50000, Math.round(parsed.expectedAttendance ?? baseCfg.expectedAttendance)),
        ),
        budget: Math.max(100, Math.min(100000000, Math.round(parsed.budget ?? baseCfg.budget))),
        objective,
        venueShape,
        stagePlacement,
        venueLayoutModel,
        boothModel,
        foodBoothCount: Math.max(
          0,
          Math.min(24, Math.round(parsed.foodBoothCount ?? baseCfg.foodBoothCount)),
        ),
        experienceBoothCount: Math.max(
          0,
          Math.min(40, Math.round(parsed.experienceBoothCount ?? baseCfg.experienceBoothCount)),
        ),
        seatingBlockCount:
          parsed.seatingBlockCount !== undefined
            ? Math.max(0, Math.min(6, Math.round(parsed.seatingBlockCount)))
            : stagePlacement === 'none'
              ? 0
              : baseCfg.seatingBlockCount,
        entranceCount: Math.max(
          1,
          Math.min(6, Math.round(parsed.entranceCount ?? baseCfg.entranceCount)),
        ),
        restroomCount:
          parsed.restroomCount !== undefined
            ? Math.max(1, Math.min(8, Math.round(parsed.restroomCount)))
            : baseCfg.restroomCount,
        medicalCount:
          parsed.medicalCount !== undefined
            ? Math.max(1, Math.min(4, Math.round(parsed.medicalCount)))
            : baseCfg.medicalCount,
        parkingCount:
          parsed.parkingCount !== undefined
            ? Math.max(0, Math.min(4, Math.round(parsed.parkingCount)))
            : baseCfg.parkingCount ?? 0,
        subStageCount:
          parsed.subStageCount !== undefined
            ? Math.max(0, Math.min(2, Math.round(parsed.subStageCount)))
            : baseCfg.subStageCount,
        customElements: nextCustomElements,
        requiredFacilities: {
          vipZone: parsed.vipZone ?? baseCfg.requiredFacilities.vipZone,
          campingArea: parsed.campingArea ?? baseCfg.requiredFacilities.campingArea,
          extraMedical: parsed.extraMedical ?? baseCfg.requiredFacilities.extraMedical,
          playRestZone: parsed.playRestZone ?? baseCfg.requiredFacilities.playRestZone,
        },
        accessibility: {
          stepFreeRoutes: parsed.stepFreeRoutes ?? baseCfg.accessibility.stepFreeRoutes,
          wideCorridors: parsed.wideCorridors ?? baseCfg.accessibility.wideCorridors,
          accessibleRestrooms:
            parsed.accessibleRestrooms ?? baseCfg.accessibility.accessibleRestrooms,
          accessibleParking: parsed.accessibleParking ?? baseCfg.accessibility.accessibleParking,
        },
        seed: (Date.now() + 3571) & 0x7fffffff,
      };

      const detActions = rawPromptText ? extractDeterministicFacilityActions(rawPromptText) : [];
      const geminiActions = Array.isArray(parsed.facilityActions) ? parsed.facilityActions : [];
      const customAddedSubtypes = new Set((parsed.customElements || []).map((ce) => ce.subtype));

      const combinedActions: AiFacilityAction[] = [];
      for (const ga of geminiActions) {
        if (ga.op === 'add' && ga.subtype && customAddedSubtypes.has(ga.subtype)) continue;
        combinedActions.push(ga);
      }
      for (const da of detActions) {
        if (da.op === 'add' && da.subtype && customAddedSubtypes.has(da.subtype)) continue;
        const alreadyPresent = combinedActions.some(
          (ga) =>
            ga.op === da.op &&
            (ga.subtype === da.subtype ||
              (ga.targetKeyword &&
                da.targetKeyword &&
                ga.targetKeyword.toLowerCase() === da.targetKeyword.toLowerCase())),
        );
        if (!alreadyPresent) {
          combinedActions.push(da);
        }
      }

      const structuralChanged =
        nextCfg.eventType !== baseCfg.eventType ||
        nextCfg.venueWidth !== baseCfg.venueWidth ||
        nextCfg.venueDepth !== baseCfg.venueDepth ||
        (nextCfg.venueShape ?? 'rectangle') !== (baseCfg.venueShape ?? 'rectangle') ||
        (nextCfg.stagePlacement ?? 'north_end') !== (baseCfg.stagePlacement ?? 'north_end') ||
        (nextCfg.venueLayoutModel ?? 'standard') !== (baseCfg.venueLayoutModel ?? 'standard') ||
        nextCfg.foodBoothCount !== baseCfg.foodBoothCount ||
        nextCfg.experienceBoothCount !== baseCfg.experienceBoothCount ||
        nextCfg.seatingBlockCount !== baseCfg.seatingBlockCount ||
        nextCfg.entranceCount !== baseCfg.entranceCount ||
        nextCfg.restroomCount !== baseCfg.restroomCount ||
        nextCfg.medicalCount !== baseCfg.medicalCount ||
        nextCfg.parkingCount !== baseCfg.parkingCount ||
        nextCfg.subStageCount !== baseCfg.subStageCount ||
        nextCfg.requiredFacilities.vipZone !== baseCfg.requiredFacilities.vipZone ||
        nextCfg.requiredFacilities.campingArea !== baseCfg.requiredFacilities.campingArea ||
        nextCfg.requiredFacilities.extraMedical !== baseCfg.requiredFacilities.extraMedical ||
        nextCfg.requiredFacilities.playRestZone !== baseCfg.requiredFacilities.playRestZone ||
        customElementsChanged;

      let workingFacilities: Facility[];
      if (structuralChanged) {
        workingFacilities = generateVenueLayout(nextCfg, baseFacs);
      } else {
        const prevBoothMult =
          BOOTH_MODEL_STYLE_LABELS[baseCfg.boothModel ?? 'pagoda_tent']?.costMult ?? 1;
        const nextBoothMult =
          BOOTH_MODEL_STYLE_LABELS[nextCfg.boothModel ?? 'pagoda_tent']?.costMult ?? 1;
        const boothRatio = prevBoothMult > 0 ? nextBoothMult / prevBoothMult : 1;
        workingFacilities = baseFacs.map((f) => ({
          ...f,
          position: { ...f.position },
          dimensions: { ...f.dimensions },
          cost:
            !f.locked &&
            (nextCfg.boothModel ?? 'pagoda_tent') !== (baseCfg.boothModel ?? 'pagoda_tent') &&
            (f.subtype === 'experience_booth' || f.subtype === 'food_stall')
              ? Math.round(f.cost * boothRatio)
              : f.cost,
          accessibility: {
            ...f.accessibility,
            wheelchairAccessible:
              nextCfg.accessibility.stepFreeRoutes !== baseCfg.accessibility.stepFreeRoutes
                ? nextCfg.accessibility.stepFreeRoutes
                : f.accessibility.wheelchairAccessible,
            stepFreeEntry:
              nextCfg.accessibility.stepFreeRoutes !== baseCfg.accessibility.stepFreeRoutes
                ? nextCfg.accessibility.stepFreeRoutes
                : f.accessibility.stepFreeEntry,
          },
        }));
      }

      const spatialResult = applyAiFacilityActions(
        nextCfg,
        workingFacilities,
        combinedActions,
        language,
      );
      let generated = spatialResult.facilities;

      const validContingencies: ContingencyScenario[] = [
        'normal',
        'rain',
        'surge',
        'stage_delay',
        'medical_emergency',
      ];
      let nextContingency: ContingencyScenario | undefined;
      const rawCont = String(parsed.contingency || '');
      if (rawCont === 'crowd_surge') {
        nextContingency = 'surge';
      } else if (validContingencies.includes(rawCont as ContingencyScenario)) {
        nextContingency = rawCont as ContingencyScenario;
      }

      if (nextContingency && nextContingency !== contingency && nextContingency !== 'normal') {
        const reopt = reoptimizeForContingency(nextCfg, generated, nextContingency);
        generated = reopt.facilities;
        nextCfg = reopt.updatedConfig;
      }

      const rawCost = generated.reduce((s, f) => s + getEffectiveFacilityCost(f), 0);
      const promptMentionsFit =
        rawPromptText &&
        /이내|맞춰|절감|초과\s*안|초과하지|예산\s*안|within\s*budget|fit\s*budget|予算内|预算内|presupuesto|budget/i.test(
          rawPromptText,
        );

      let extraNote = '';
      if (rawCost > nextCfg.budget && (objective === 'budget_efficiency' || promptMentionsFit)) {
        const fitted = fitLayoutToBudget(nextCfg, generated);
        generated = fitted.facilities;
        nextCfg = fitted.updatedConfig;
        extraNote = tr6(
          language,
          ` (예산 ${formatCurrency(nextCfg.budget, language)} 이내 자동 맞춤)`,
          ` (Auto-fitted within ${formatCurrency(nextCfg.budget, language)})`,
          ` (予算 ${formatCurrency(nextCfg.budget, language)} 以内に自動調整)`,
          ` (自动调整至预算 ${formatCurrency(nextCfg.budget, language)} 以内)`,
          ` (Ajustado automáticamente dentro de ${formatCurrency(nextCfg.budget, language)})`,
          ` (Ajusté automatiquement dans ${formatCurrency(nextCfg.budget, language)})`,
        );
      }

      const diffTags: string[] = [];
      if (nextCfg.eventName !== baseCfg.eventName) {
        diffTags.push(
          `${tr6(language, '행사명', 'Event', 'イベント名', '活动名', 'Evento', 'Événement')}: ${nextCfg.eventName}`,
        );
      }
      if ((nextCfg.venueEnvironment ?? 'indoor') !== (baseCfg.venueEnvironment ?? 'indoor')) {
        const envLabel =
          nextCfg.venueEnvironment === 'outdoor'
            ? tr6(language, '실외 행사장', 'Outdoor', '屋外会場', '室外场地', 'Exterior', 'Extérieur')
            : tr6(language, '실내 행사장', 'Indoor', '屋内会場', '室内场地', 'Interior', 'Intérieur');
        diffTags.push(
          `${tr6(language, '환경', 'Venue', '環境', '环境', 'Entorno', 'Environnement')}: ${envLabel}`,
        );
      }
      if (
        nextFloor.mode !== prevFloor.mode ||
        nextFloor.indoorPreset !== prevFloor.indoorPreset ||
        nextFloor.outdoorPreset !== prevFloor.outdoorPreset ||
        nextFloor.customColor !== prevFloor.customColor
      ) {
        const floorLabel =
          nextFloor.mode === 'color'
            ? nextFloor.customColor
            : nextEnv === 'outdoor'
              ? pickL6(language, OUTDOOR_FLOOR_I18N[nextFloor.outdoorPreset])
              : pickL6(language, INDOOR_FLOOR_I18N[nextFloor.indoorPreset]);
        diffTags.push(
          `${tr6(language, '바닥', 'Floor', '床面', '地面', 'Suelo', 'Sol')}: ${floorLabel}`,
        );
      }
      if ((nextCfg.venueShape ?? 'rectangle') !== (baseCfg.venueShape ?? 'rectangle')) {
        diffTags.push(
          `${tr6(language, '평면', 'Shape', '平面', '平面', 'Planta', 'Plan')}: ${pickL6(language, VENUE_SHAPE_I18N[nextCfg.venueShape ?? 'rectangle'])}`,
        );
      }
      if ((nextCfg.stagePlacement ?? 'north_end') !== (baseCfg.stagePlacement ?? 'north_end')) {
        diffTags.push(
          `${tr6(language, '무대', 'Stage', 'ステージ', '舞台', 'Escenario', 'Scène')}: ${pickL6(language, STAGE_PLACEMENT_I18N[nextCfg.stagePlacement ?? 'north_end'])}`,
        );
      }
      if ((nextCfg.venueLayoutModel ?? 'standard') !== (baseCfg.venueLayoutModel ?? 'standard')) {
        diffTags.push(
          `${tr6(language, '배열', 'Layout', '配列', '布局', 'Diseño', 'Disposition')}: ${pickL6(language, VENUE_LAYOUT_MODEL_I18N[nextCfg.venueLayoutModel ?? 'standard'])}`,
        );
      }
      if (nextCfg.venueWidth !== baseCfg.venueWidth || nextCfg.venueDepth !== baseCfg.venueDepth) {
        diffTags.push(
          `${tr6(language, '규격', 'Size', '寸法', '尺寸', 'Tamaño', 'Taille')}: ${nextCfg.venueWidth}m×${nextCfg.venueDepth}m`,
        );
      }
      if (nextCfg.expectedAttendance !== baseCfg.expectedAttendance) {
        diffTags.push(
          `${tr6(language, '방문객', 'Visitors', '来場者', '访客', 'Visitantes', 'Visiteurs')}: ${nextCfg.expectedAttendance.toLocaleString()}`,
        );
      }
      if (nextCfg.budget !== baseCfg.budget) {
        diffTags.push(
          `${tr6(language, '예산', 'Budget', '予算', '预算', 'Presupuesto', 'Budget')}: ${formatCurrency(nextCfg.budget, language)}`,
        );
      }
      if (nextCfg.foodBoothCount !== baseCfg.foodBoothCount) {
        diffTags.push(
          `${tr6(language, '음식부스', 'Food', '飲食ブース', '餐饮展位', 'Comida', 'Restauration')}: ${baseCfg.foodBoothCount}→${nextCfg.foodBoothCount}`,
        );
      }
      if (nextCfg.experienceBoothCount !== baseCfg.experienceBoothCount) {
        diffTags.push(
          `${tr6(language, '체험부스', 'Booths', '体験ブース', '体验展位', 'Stands', 'Stands')}: ${baseCfg.experienceBoothCount}→${nextCfg.experienceBoothCount}`,
        );
      }
      if ((nextCfg.parkingCount ?? 0) !== (baseCfg.parkingCount ?? 0)) {
        diffTags.push(
          `${tr6(language, '외부 주차장', 'Exterior Parking', '屋外駐車場', '外部停车场', 'Parking ext.', 'Parking ext.')}: ${baseCfg.parkingCount ?? 0}→${nextCfg.parkingCount ?? 0}`,
        );
      }
      if (parsed.customElements && parsed.customElements.length > 0) {
        for (const ce of parsed.customElements) {
          const ceLabel =
            SUBTYPE_SIMPLE_LABELS[ce.subtype]?.[language] ||
            (language === 'ko' ? ce.nameKo : ce.nameEn || ce.nameKo);
          diffTags.push(`+${ceLabel} ×${ce.count}`);
        }
      }
      for (const sTag of spatialResult.appliedTags) {
        if (!diffTags.includes(sTag)) diffTags.push(sTag);
      }
      if (diffTags.length === 0) {
        diffTags.push(
          tr6(
            language,
            `총 ${generated.length}개 시설 배치`,
            `${generated.length} facilities placed`,
            `計 ${generated.length} 施設を配置`,
            `共布置 ${generated.length} 个设施`,
            `${generated.length} instalaciones ubicadas`,
            `${generated.length} installations placées`,
          ),
        );
      }

      if (!commitChanges) {
        return { diffTags, nextCfg, facilities: generated, nextContingency };
      }

      if (nextContingency && nextContingency !== contingency) {
        setContingency(nextContingency);
      }

      setVisibility((prev) => {
        const nextVis = { ...prev };
        for (const f of generated) {
          const catKey = f.category as keyof LayerVisibility;
          if (catKey in nextVis) nextVis[catKey] = true;
        }
        return nextVis;
      });

      if (rawPromptText !== undefined) {
        lastAppliedPromptRef.current = rawPromptText.trim();
      }
      setAppliedPromptChanges(diffTags);
      setConfig(nextCfg);
      setOriginalFacilities(generated);
      setActiveLayoutMode('original');
      setApprovedCandidateId(null);
      setSelectedFacilityId(null);
      setGhostPreview(null);
      setValidationErrors([]);
      setAiBriefSummary(`${parsed.extractedSummary}${extraNote}`);
      setActiveNav('workspace');
      if (!silentFlash) {
        flashStatus(
          `[${sourceLabel}] ${diffTags.slice(0, 4).join(' · ')} (${generated.length})`,
        );
      }
      return { diffTags, nextCfg, facilities: generated, nextContingency };
    },
    [activeFacilities, config, contingency, flashStatus, language],
  );

  const handleRunAiBriefParser = useCallback(async () => {
    const trimmed = aiPrompt.trim();
    if (!trimmed) return;

    const baselineCfg = config;
    const baselineFacs = activeFacilities;
    setIsParsingBrief(true);

    const instantPreview = parseBriefDeterministically(trimmed, baselineCfg, language);
    const instantResult = applyParsedBrief(
      instantPreview,
      tr6(language, '즉시 반영', 'Instant', '即時反映', '即时应用', 'Instantáneo', 'Instantané'),
      trimmed,
      baselineCfg,
      baselineFacs,
      true,
      true,
    );

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch('/api/ai/parse-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed, currentConfig: baselineCfg, language }),
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);

      if (response.ok) {
        const json = (await response.json()) as {
          data?: ParsedBriefResult;
          modelUsed?: string;
        };
        if (json?.data) {
          const merged = mergeExplicitPromptOverrides(trimmed, baselineCfg, json.data);
          merged.facilityActions = json.data.facilityActions;
          merged.contingency = json.data.contingency;
          applyParsedBrief(
            merged,
            'AI Brief',
            trimmed,
            baselineCfg,
            baselineFacs,
            false,
            true,
          );
          setIsParsingBrief(false);
          return;
        }
      }

      flashStatus(`${instantResult.diffTags.slice(0, 4).join(' · ')}`);
    } catch {
      window.clearTimeout(timeoutId);
      flashStatus(`${instantResult.diffTags.slice(0, 4).join(' · ')}`);
    } finally {
      setIsParsingBrief(false);
    }
  }, [activeFacilities, aiPrompt, applyParsedBrief, config, flashStatus, language]);

  // AI Co-Design Chat Handler -> Creates PendingAiProposal + 3D Ghost Preview (or Auto-Applies with 1-click Undo)
  const handleSendChatMessage = useCallback(
    async (userMessage: string) => {
      const trimmed = userMessage.trim();
      if (!trimmed || isChatSending) return;

      const baselineCfg = activeEffectiveConfig;
      const baselineFacs = activeFacilities;
      const lockedPreservedCount = baselineFacs.filter((f) => f.locked).length;
      const nowStr = new Date().toLocaleTimeString(localeCode, {
        hour: '2-digit',
        minute: '2-digit',
      });

      const userTurn: ArchitectChatMessage = {
        id: `chat-u-${Date.now()}`,
        role: 'user',
        text: trimmed,
        timestamp: nowStr,
      };

      const historyForApi = chatMessages
        .filter((m) => m.id !== 'welcome-architect')
        .slice(-12)
        .map((m) => ({ role: m.role, text: m.text }));

      setChatMessages((prev) => [...prev, userTurn]);
      setIsChatSending(true);

      const commitAutoProposal = (proposal: PendingAiProposal, nextCont?: ContingencyScenario) => {
        setConfig(proposal.nextConfig);
        setOriginalFacilities(proposal.nextFacilities);
        setActiveLayoutMode('original');
        setSelectedFacilityId(null);
        if (nextCont && nextCont !== contingency) {
          setContingency(nextCont);
        }
        setVisibility((prev) => {
          const nextVis = { ...prev };
          for (const f of proposal.nextFacilities) {
            const catKey = f.category as keyof LayerVisibility;
            if (catKey in nextVis) nextVis[catKey] = true;
          }
          return nextVis;
        });
        setGhostPreview(null);
        flashStatus(
          tr6(
            language,
            `AI 변경사항 즉시 반영됨: ${proposal.diffTags.slice(0, 3).join(' · ')}`,
            `Auto-applied AI update: ${proposal.diffTags.slice(0, 3).join(' · ')}`,
            `AI変更を即時反映: ${proposal.diffTags.slice(0, 3).join(' · ')}`,
            `已自动应用AI修改: ${proposal.diffTags.slice(0, 3).join(' · ')}`,
            `Cambio IA aplicado automáticamente: ${proposal.diffTags.slice(0, 3).join(' · ')}`,
            `Modification IA appliquée automatiquement : ${proposal.diffTags.slice(0, 3).join(' · ')}`,
          ),
        );
      };

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 13500);

      try {
        const facilitiesSummary = baselineFacs.slice(0, 48).map((f) => ({
          name: getFacilityDisplayName(f, language),
          subtype: f.subtype,
          category: f.category,
          x: Math.round(f.position.x),
          z: Math.round(f.position.z),
          w: f.dimensions.width,
          d: f.dimensions.depth,
          locked: Boolean(f.locked),
        }));

        const metricsSummary = {
          peakDensity: Number(summary.peakDensity.toFixed(2)),
          usableAreaSqm: summary.usableAreaSqm,
          referenceCapacity: summary.referenceCapacity,
          avgWaitMinutes: summary.avgWaitMinutes,
          estimatedCostUsd: summary.estimatedCost,
          budgetUsd: baselineCfg.budget,
          totalFacilities: baselineFacs.length,
          lockedFacilities: lockedPreservedCount,
          contingency,
        };

        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            history: historyForApi,
            role: chatRole,
            modelTier: chatModelTier,
            currentConfig: baselineCfg,
            facilitiesSummary,
            metricsSummary,
            language,
          }),
          signal: controller.signal,
        });
        window.clearTimeout(timeoutId);

        if (response.ok) {
          const json = (await response.json()) as {
            reply?: string;
            modelUsed?: string;
            shouldUpdateLayout?: boolean;
            contingency?: ContingencyScenario;
            configPatch?: Partial<ParsedBriefResult>;
            facilityActions?: AiFacilityAction[];
            followUpSuggestions?: string[];
          };

          const detSpatial = extractDeterministicFacilityActions(trimmed);
          const patch = (json.configPatch || json) as Partial<ParsedBriefResult>;
          const baseFloor = baselineCfg.floorSettings ?? DEFAULT_FLOOR_SETTINGS;

          const baseParsed: ParsedBriefResult = {
            eventName: patch.eventName ?? baselineCfg.eventName,
            eventType: patch.eventType ?? baselineCfg.eventType,
            venueEnvironment: patch.venueEnvironment ?? baselineCfg.venueEnvironment,
            floorMode: patch.floorMode ?? baseFloor.mode,
            indoorFloorPreset: patch.indoorFloorPreset ?? baseFloor.indoorPreset,
            outdoorFloorPreset: patch.outdoorFloorPreset ?? baseFloor.outdoorPreset,
            floorCustomColor: patch.floorCustomColor ?? baseFloor.customColor,
            showFloorGrid: patch.showFloorGrid ?? baseFloor.showGrid,
            venueWidth: patch.venueWidth ?? baselineCfg.venueWidth,
            venueDepth: patch.venueDepth ?? baselineCfg.venueDepth,
            expectedAttendance: patch.expectedAttendance ?? baselineCfg.expectedAttendance,
            budget: patch.budget ?? baselineCfg.budget,
            objective: patch.objective ?? baselineCfg.objective,
            venueShape: patch.venueShape ?? baselineCfg.venueShape,
            stagePlacement: patch.stagePlacement ?? baselineCfg.stagePlacement,
            venueLayoutModel: patch.venueLayoutModel ?? baselineCfg.venueLayoutModel,
            boothModel: patch.boothModel ?? baselineCfg.boothModel,
            seatingBlockCount: patch.seatingBlockCount ?? baselineCfg.seatingBlockCount,
            foodBoothCount: patch.foodBoothCount ?? baselineCfg.foodBoothCount,
            experienceBoothCount:
              patch.experienceBoothCount ?? baselineCfg.experienceBoothCount,
            entranceCount: patch.entranceCount ?? baselineCfg.entranceCount,
            restroomCount: patch.restroomCount ?? baselineCfg.restroomCount,
            medicalCount: patch.medicalCount ?? baselineCfg.medicalCount,
            parkingCount: patch.parkingCount ?? baselineCfg.parkingCount ?? 0,
            subStageCount: patch.subStageCount ?? baselineCfg.subStageCount,
            vipZone: patch.vipZone ?? baselineCfg.requiredFacilities.vipZone,
            campingArea: patch.campingArea ?? baselineCfg.requiredFacilities.campingArea,
            extraMedical: patch.extraMedical ?? baselineCfg.requiredFacilities.extraMedical,
            playRestZone: patch.playRestZone ?? baselineCfg.requiredFacilities.playRestZone,
            stepFreeRoutes: patch.stepFreeRoutes ?? baselineCfg.accessibility.stepFreeRoutes,
            wideCorridors: patch.wideCorridors ?? baselineCfg.accessibility.wideCorridors,
            accessibleRestrooms:
              patch.accessibleRestrooms ?? baselineCfg.accessibility.accessibleRestrooms,
            accessibleParking:
              patch.accessibleParking ?? baselineCfg.accessibility.accessibleParking,
            clearCustomElements: patch.clearCustomElements,
            customElements: patch.customElements,
            facilityActions: json.facilityActions,
            contingency: json.contingency,
            extractedSummary: json.reply || trimmed,
          };

          const merged = mergeExplicitPromptOverrides(trimmed, baselineCfg, baseParsed);
          merged.facilityActions = json.facilityActions;
          merged.contingency = json.contingency;

          const hasAnyConfigDiff =
            merged.venueEnvironment !== baselineCfg.venueEnvironment ||
            merged.floorMode !== baseFloor.mode ||
            merged.indoorFloorPreset !== baseFloor.indoorPreset ||
            merged.outdoorFloorPreset !== baseFloor.outdoorPreset ||
            merged.floorCustomColor !== baseFloor.customColor ||
            merged.showFloorGrid !== baseFloor.showGrid ||
            merged.venueWidth !== baselineCfg.venueWidth ||
            merged.venueDepth !== baselineCfg.venueDepth ||
            merged.expectedAttendance !== baselineCfg.expectedAttendance ||
            merged.budget !== baselineCfg.budget ||
            merged.foodBoothCount !== baselineCfg.foodBoothCount ||
            merged.experienceBoothCount !== baselineCfg.experienceBoothCount ||
            merged.parkingCount !== (baselineCfg.parkingCount ?? 0) ||
            merged.entranceCount !== baselineCfg.entranceCount ||
            merged.restroomCount !== baselineCfg.restroomCount ||
            merged.medicalCount !== baselineCfg.medicalCount ||
            merged.venueShape !== baselineCfg.venueShape ||
            merged.stagePlacement !== baselineCfg.stagePlacement ||
            merged.venueLayoutModel !== baselineCfg.venueLayoutModel ||
            merged.boothModel !== baselineCfg.boothModel ||
            merged.stepFreeRoutes !== baselineCfg.accessibility.stepFreeRoutes ||
            merged.wideCorridors !== baselineCfg.accessibility.wideCorridors ||
            merged.accessibleRestrooms !== baselineCfg.accessibility.accessibleRestrooms ||
            merged.accessibleParking !== baselineCfg.accessibility.accessibleParking ||
            Boolean(merged.customElements && merged.customElements.length > 0);

          const isPureDiagnosticQuestion =
            /[?？]$/.test(trimmed) &&
            !json.shouldUpdateLayout &&
            !(json.facilityActions && json.facilityActions.length > 0) &&
            detSpatial.length === 0 &&
            !hasAnyConfigDiff &&
            !json.contingency;

          let proposalId: string | undefined;

          if (
            !isPureDiagnosticQuestion &&
            (json.shouldUpdateLayout ||
              (json.facilityActions && json.facilityActions.length > 0) ||
              detSpatial.length > 0 ||
              hasAnyConfigDiff ||
              Boolean(json.contingency))
          ) {
            const proposed = applyParsedBrief(
              merged,
              'AI Proposal',
              trimmed,
              baselineCfg,
              baselineFacs,
              true,
              false,
            );

            proposalId = `prop-${Date.now()}`;
            const proposal: PendingAiProposal = {
              id: proposalId,
              promptText: trimmed,
              summaryText: json.reply || trimmed,
              diffTags: proposed.diffTags,
              beforeFacilityCount: baselineFacs.length,
              afterFacilityCount: proposed.facilities.length,
              lockedPreservedCount,
              prevConfig: baselineCfg,
              prevFacilities: baselineFacs,
              nextConfig: proposed.nextCfg,
              nextFacilities: proposed.facilities,
              autoApplied: autoApplyChat,
              status: autoApplyChat ? 'applied' : 'pending',
            };

            setPendingProposals((prev) => ({ ...prev, [proposal.id]: proposal }));
            if (autoApplyChat) {
              commitAutoProposal(proposal, proposed.nextContingency);
            } else {
              setGhostPreview({
                mode: 'ai_diff',
                title: ui.aiProposalPendingTitle,
                subtitle: proposed.diffTags.slice(0, 3).join(' · '),
                facilities: proposed.facilities,
                configOverride: proposed.nextCfg,
                proposalId: proposal.id,
              });
            }
          }

          const replyTurn: ArchitectChatMessage = {
            id: `chat-m-${Date.now() + 1}`,
            role: 'model',
            personaRole: chatRole,
            modelUsed: json.modelUsed || 'gemini-3.1-flash-lite',
            text:
              json.reply ||
              tr6(
                language,
                '요청하신 변경안을 준비했습니다. 전·후 비교 카드와 3D 미리보기를 확인한 뒤 적용해 주세요.',
                'Prepared your requested layout proposal. Review the 3D preview and confirm to apply.',
                'ご要望の変更案を準備しました。3Dプレビューと前後比較カードを確認して適用してください。',
                '已准备好您的布局修改方案。请查看3D预览与前后对比卡片后确认应用。',
                'Propuesta de diseño preparada. Revise la vista previa 3D y confirme para aplicar.',
                'Proposition d’aménagement prête. Vérifiez l’aperçu 3D et confirmez pour appliquer.',
              ),
            proposalId,
            followUpSuggestions: Array.isArray(json.followUpSuggestions)
              ? json.followUpSuggestions.slice(0, 3)
              : undefined,
            timestamp: new Date().toLocaleTimeString(localeCode, {
              hour: '2-digit',
              minute: '2-digit',
            }),
          };

          setChatMessages((prev) => [...prev, replyTurn]);
          setIsChatSending(false);
          return;
        }
      } catch {
        window.clearTimeout(timeoutId);
      }

      // Deterministic Fallback Proposal (supports all 6 languages + Auto-Apply / Undo)
      const fallbackParsed = parseBriefDeterministically(trimmed, baselineCfg, language);
      const proposed = applyParsedBrief(
        fallbackParsed,
        'AI Fallback Proposal',
        trimmed,
        baselineCfg,
        baselineFacs,
        true,
        false,
      );
      const proposalId = `prop-fb-${Date.now()}`;
      const proposal: PendingAiProposal = {
        id: proposalId,
        promptText: trimmed,
        summaryText: fallbackParsed.extractedSummary,
        diffTags: proposed.diffTags,
        beforeFacilityCount: baselineFacs.length,
        afterFacilityCount: proposed.facilities.length,
        lockedPreservedCount,
        prevConfig: baselineCfg,
        prevFacilities: baselineFacs,
        nextConfig: proposed.nextCfg,
        nextFacilities: proposed.facilities,
        autoApplied: autoApplyChat,
        status: autoApplyChat ? 'applied' : 'pending',
      };
      setPendingProposals((prev) => ({ ...prev, [proposal.id]: proposal }));
      if (autoApplyChat) {
        commitAutoProposal(proposal, proposed.nextContingency);
      } else {
        setGhostPreview({
          mode: 'ai_diff',
          title: ui.aiProposalPendingTitle,
          subtitle: proposed.diffTags.slice(0, 3).join(' · '),
          facilities: proposed.facilities,
          configOverride: proposed.nextCfg,
          proposalId: proposal.id,
        });
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: `chat-m-fb-${Date.now()}`,
          role: 'model',
          personaRole: chatRole,
          text: fallbackParsed.extractedSummary,
          proposalId,
          timestamp: new Date().toLocaleTimeString(localeCode, {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
      setIsChatSending(false);
    },
    [
      activeEffectiveConfig,
      activeFacilities,
      applyParsedBrief,
      autoApplyChat,
      chatMessages,
      chatModelTier,
      chatRole,
      contingency,
      flashStatus,
      isChatSending,
      language,
      localeCode,
      summary,
      ui.aiProposalPendingTitle,
    ],
  );

  const handlePreviewProposal = useCallback(
    (proposal: PendingAiProposal) => {
      setGhostPreview({
        mode: 'ai_diff',
        title: ui.aiProposalPendingTitle,
        subtitle: proposal.diffTags.slice(0, 3).join(' · '),
        facilities: proposal.nextFacilities,
        configOverride: proposal.nextConfig,
        proposalId: proposal.id,
      });
      setActiveNav('workspace');
    },
    [ui.aiProposalPendingTitle],
  );

  const handleApplyProposal = useCallback(
    (proposalId: string) => {
      const prop = pendingProposals[proposalId];
      if (!prop || prop.status !== 'pending') return;

      const snapshotCfg = prop.prevConfig ?? activeEffectiveConfig;
      const snapshotFacs = prop.prevFacilities ?? activeFacilities;

      setConfig(prop.nextConfig);
      setOriginalFacilities(prop.nextFacilities);
      setActiveLayoutMode('original');
      setSelectedFacilityId(null);
      setVisibility((prev) => {
        const nextVis = { ...prev };
        for (const f of prop.nextFacilities) {
          const catKey = f.category as keyof LayerVisibility;
          if (catKey in nextVis) nextVis[catKey] = true;
        }
        return nextVis;
      });
      setPendingProposals((prev) => ({
        ...prev,
        [proposalId]: {
          ...prop,
          prevConfig: snapshotCfg,
          prevFacilities: snapshotFacs,
          status: 'applied',
        },
      }));
      setGhostPreview((cur) => (cur?.proposalId === proposalId ? null : cur));
      flashStatus(
        tr6(
          language,
          `AI 제안 변경사항(${prop.afterFacilityCount}개 시설)이 도안에 적용되었습니다.`,
          `Applied AI proposal (${prop.afterFacilityCount} facilities).`,
          `AI提案の変更（${prop.afterFacilityCount}施設）を図面に適用しました。`,
          `已将AI建议（${prop.afterFacilityCount}个设施）应用到方案。`,
          `Propuesta IA aplicada (${prop.afterFacilityCount} instalaciones).`,
          `Proposition IA appliquée (${prop.afterFacilityCount} installations).`,
        ),
      );
    },
    [activeEffectiveConfig, activeFacilities, flashStatus, language, pendingProposals],
  );

  const handleUndoProposal = useCallback(
    (proposalId: string) => {
      const prop = pendingProposals[proposalId];
      if (!prop || prop.status !== 'applied' || !prop.prevConfig || !prop.prevFacilities) return;

      setConfig(prop.prevConfig);
      setOriginalFacilities(prop.prevFacilities);
      setActiveLayoutMode('original');
      setSelectedFacilityId(null);
      setGhostPreview(null);
      setPendingProposals((prev) => ({
        ...prev,
        [proposalId]: { ...prop, status: 'undone' },
      }));
      flashStatus(
        tr6(
          language,
          'AI 적용 전 도안 상태로 되돌렸습니다.',
          'Restored floor plan prior to AI change.',
          'AI変更前の図面状態に戻しました。',
          '已恢复至AI修改前的方案状态。',
          'Se restauró el plano previo al cambio de IA.',
          'Plan restauré à l’état précédant la modification IA.',
        ),
      );
    },
    [flashStatus, language, pendingProposals],
  );

  const handleCancelProposal = useCallback((proposalId: string) => {
    setPendingProposals((prev) => {
      const cur = prev[proposalId];
      if (!cur) return prev;
      return { ...prev, [proposalId]: { ...cur, status: 'cancelled' } };
    });
    setGhostPreview((cur) => (cur?.proposalId === proposalId ? null : cur));
  }, []);

  const handleResetChat = useCallback(() => {
    setPendingProposals({});
    setGhostPreview((cur) => (cur?.mode === 'ai_diff' ? null : cur));
    setChatMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'model',
        personaRole: chatRole,
        timestamp: new Date().toLocaleTimeString(localeCode, {
          hour: '2-digit',
          minute: '2-digit',
        }),
        text: tr6(
          language,
          '대화가 초기화되었습니다. 현재 도안(고정 부스 포함)을 유지한 채 새로운 변경을 요청하실 수 있습니다.',
          'Chat reset. Your current floor plan and locked booths remain intact.',
          'チャットをリセットしました。現在の図面と固定ブースを維持したまま新しい変更を依頼できます。',
          '对话已重置。当前平面图与锁定展位保持不变，您可以继续提出新修改。',
          'Chat reiniciado. Su plano actual y los stands fijados permanecen intactos.',
          'Discussion réinitialisée. Votre plan actuel et les stands verrouillés sont conservés.',
        ),
      },
    ]);
  }, [chatRole, language, localeCode]);

  // Mood-Matched AI Booth Recommendations (/api/ai/recommend-booths + resilient fallback)
  const handleRequestBoothRecommendations = useCallback(async () => {
    setIsRecommendingBooths(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch('/api/ai/recommend-booths', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: activeEffectiveConfig,
          existingFacilities: activeFacilities.map((f) => ({
            subtype: f.subtype,
            name: getFacilityDisplayName(f, language),
          })),
          language,
        }),
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);
      if (res.ok) {
        const json = (await res.json()) as {
          items?: Array<{
            subtype: FacilitySubtype;
            zone: SpatialZoneTarget;
            name: string;
            reason: string;
            estimatedCostUsd: number;
            widthM: number;
            depthM: number;
          }>;
        };
        if (Array.isArray(json.items) && json.items.length > 0) {
          setRecommendedBooths(
            json.items.map((it, idx) => ({
              id: `ai-rec-${Date.now()}-${idx}`,
              subtype: it.subtype,
              zone: it.zone || 'center',
              name: it.name,
              reason: it.reason,
              estimatedCostUsd: Number(it.estimatedCostUsd) || 4500,
              widthM: Number(it.widthM) || 7.5,
              depthM: Number(it.depthM) || 6.5,
            })),
          );
          setIsRecommendingBooths(false);
          return;
        }
      }
      setRecommendedBooths(
        getFallbackMoodRecommendations(activeEffectiveConfig, activeFacilities, language),
      );
    } catch {
      window.clearTimeout(timeoutId);
      setRecommendedBooths(
        getFallbackMoodRecommendations(activeEffectiveConfig, activeFacilities, language),
      );
    } finally {
      setIsRecommendingBooths(false);
    }
  }, [activeEffectiveConfig, activeFacilities, language]);

  // Individual Catalog Element & Mood Recommendation 3D Preview / Direct Add
  const handlePreviewCatalogElement = useCallback(
    (subtype: FacilitySubtype, zone: SpatialZoneTarget, customName: string) => {
      const item = buildCatalogFacilityItem(subtype, activeEffectiveConfig, activeFacilities, {
        customName,
        zone,
      });
      setGhostPreview({
        mode: 'element',
        title: `${getFacilityDisplayName(item, language)} (${item.dimensions.width}×${item.dimensions.depth}m)`,
        facilities: [item],
      });
      setActiveNav('workspace');
    },
    [activeEffectiveConfig, activeFacilities, language],
  );

  const handleAddCatalogElement = useCallback(
    (subtype: FacilitySubtype, zone: SpatialZoneTarget, customName: string) => {
      const base =
        activeLayoutMode === 'optimized' ? comparison.optimizedFacilities : originalFacilities;
      const item = buildCatalogFacilityItem(subtype, activeEffectiveConfig, base, {
        customName,
        zone,
      });
      const updated = enforceZeroFacilityOverlap([...base, item], activeEffectiveConfig, [item.id]);
      setOriginalFacilities(updated);
      setActiveLayoutMode('original');
      setVisibility((prev) => ({
        ...prev,
        [item.category]: true,
      }));
      setGhostPreview(null);
      setSelectedFacilityId(item.id);
      setIsRightSidebarOpen(true);
      setActiveNav('workspace');
      const disp = getFacilityDisplayName(item, language);
      flashStatus(
        tr6(
          language,
          `'${disp}' 부스가 도안에 추가되었습니다.`,
          `Added "${disp}" to floor plan.`,
          `「${disp}」を図面に追加しました。`,
          `已将“${disp}”添加至平面图。`,
          `Se añadió "${disp}" al plano.`,
          `« ${disp} » ajouté au plan.`,
        ),
      );
    },
    [
      activeEffectiveConfig,
      activeLayoutMode,
      comparison.optimizedFacilities,
      flashStatus,
      language,
      originalFacilities,
    ],
  );

  const handlePreviewRecommendedBooth = useCallback(
    (rec: RecommendedBoothItem) => {
      const item = buildCatalogFacilityItem(
        rec.subtype,
        activeEffectiveConfig,
        activeFacilities,
        {
          customName: rec.name,
          zone: rec.zone,
          width: rec.widthM,
          depth: rec.depthM,
          cost: rec.estimatedCostUsd,
        },
      );
      setGhostPreview({
        mode: 'element',
        title: `${rec.name} (${rec.widthM}×${rec.depthM}m)`,
        subtitle: rec.reason,
        facilities: [item],
      });
      setActiveNav('workspace');
    },
    [activeEffectiveConfig, activeFacilities],
  );

  const handleAddRecommendedBooth = useCallback(
    (rec: RecommendedBoothItem) => {
      const base =
        activeLayoutMode === 'optimized' ? comparison.optimizedFacilities : originalFacilities;
      const item = buildCatalogFacilityItem(rec.subtype, activeEffectiveConfig, base, {
        customName: rec.name,
        zone: rec.zone,
        width: rec.widthM,
        depth: rec.depthM,
        cost: rec.estimatedCostUsd,
      });
      const updated = enforceZeroFacilityOverlap([...base, item], activeEffectiveConfig, [item.id]);
      setOriginalFacilities(updated);
      setActiveLayoutMode('original');
      setVisibility((prev) => ({ ...prev, [item.category]: true }));
      setGhostPreview(null);
      setSelectedFacilityId(item.id);
      setIsRightSidebarOpen(true);
      setActiveNav('workspace');
      flashStatus(
        tr6(
          language,
          `추천 부스 '${rec.name}'이(가) 추가되었습니다.`,
          `Added recommended booth "${rec.name}".`,
          `おすすめブース「${rec.name}」を追加しました。`,
          `已添加推荐展位“${rec.name}”。`,
          `Stand recomendado "${rec.name}" añadido.`,
          `Stand recommandé « ${rec.name} » ajouté.`,
        ),
      );
    },
    [
      activeEffectiveConfig,
      activeLayoutMode,
      comparison.optimizedFacilities,
      flashStatus,
      language,
      originalFacilities,
    ],
  );

  // Candidate 3D Ghost Preview & Apply
  const handlePreviewCandidateIn3D = useCallback(
    (candidate: CandidateLayout) => {
      setGhostPreview({
        mode: 'candidate',
        title: language === 'ko' ? candidate.nameKo : candidate.nameEn,
        subtitle: language === 'ko' ? candidate.focusKo : candidate.focusEn,
        facilities: candidate.facilities,
        configOverride: candidate.configOverride,
        candidateId: candidate.id,
      });
      setActiveNav('workspace');
    },
    [language],
  );

  const handleApproveCandidate = useCallback(
    (candidate: CandidateLayout) => {
      setConfig(candidate.configOverride);
      setOriginalFacilities(candidate.facilities);
      setActiveLayoutMode('original');
      setApprovedCandidateId(candidate.id);
      setSelectedFacilityId(null);
      setGhostPreview(null);
      setActiveNav('workspace');
      const candLabel = language === 'ko' ? candidate.nameKo : candidate.nameEn;
      flashStatus(
        tr6(
          language,
          `${candLabel}이(가) 도안에 적용되었습니다.`,
          `Applied ${candLabel}.`,
          `${candLabel}を図面に適用しました。`,
          `已应用 ${candLabel}。`,
          `Se aplicó ${candLabel}.`,
          `${candLabel} appliqué au plan.`,
        ),
      );
    },
    [flashStatus, language],
  );

  // Confirm / Cancel 3D Ghost Preview Banner
  const handleConfirmGhostPreview = useCallback(() => {
    if (!ghostPreview) return;

    if (ghostPreview.mode === 'ai_diff' && ghostPreview.proposalId) {
      handleApplyProposal(ghostPreview.proposalId);
      return;
    }

    if (ghostPreview.mode === 'candidate') {
      if (ghostPreview.configOverride) setConfig(ghostPreview.configOverride);
      setOriginalFacilities(ghostPreview.facilities);
      setActiveLayoutMode('original');
      if (ghostPreview.candidateId) setApprovedCandidateId(ghostPreview.candidateId);
      setSelectedFacilityId(null);
      setGhostPreview(null);
      return;
    }

    if (ghostPreview.mode === 'element' && ghostPreview.facilities.length > 0) {
      const base =
        activeLayoutMode === 'optimized' ? comparison.optimizedFacilities : originalFacilities;
      const item = ghostPreview.facilities[0];
      const updated = enforceZeroFacilityOverlap([...base, item], activeEffectiveConfig, [item.id]);
      setOriginalFacilities(updated);
      setActiveLayoutMode('original');
      setVisibility((prev) => ({ ...prev, [item.category]: true }));
      setSelectedFacilityId(item.id);
      setIsRightSidebarOpen(true);
      setGhostPreview(null);
    }
  }, [
    activeEffectiveConfig,
    activeLayoutMode,
    comparison.optimizedFacilities,
    ghostPreview,
    handleApplyProposal,
    originalFacilities,
  ]);

  const handleCancelGhostPreview = useCallback(() => {
    setGhostPreview(null);
  }, []);

  // Direct 3D Floor Booth Manipulation (Drag, Alt+Wheel Resize, WASD Nudge) with Lock Protection
  const handleMoveFacility = useCallback(
    (id: string, x: number, z: number) => {
      const base =
        activeLayoutMode === 'optimized' ? comparison.optimizedFacilities : originalFacilities;
      const found = base.find((f) => f.id === id);
      if (!found || found.locked) return;
      const snapped: Facility = {
        ...found,
        position: {
          x: Math.round(x * 2) / 2,
          z: Math.round(z * 2) / 2,
        },
      };
      const resolved = clampAndResolveSingleFacility(snapped, base, activeEffectiveConfig);
      setOriginalFacilities(base.map((f) => (f.id === id ? resolved : f)));
      if (activeLayoutMode === 'optimized') setActiveLayoutMode('original');
    },
    [activeEffectiveConfig, activeLayoutMode, comparison.optimizedFacilities, originalFacilities],
  );

  const handleResizeFacility = useCallback(
    (id: string, deltaW: number, deltaD: number) => {
      const base =
        activeLayoutMode === 'optimized' ? comparison.optimizedFacilities : originalFacilities;
      const found = base.find((f) => f.id === id);
      if (!found || found.locked) return;
      const resized: Facility = {
        ...found,
        dimensions: {
          ...found.dimensions,
          width: Math.max(3, Math.min(80, found.dimensions.width + deltaW)),
          depth: Math.max(3, Math.min(80, found.dimensions.depth + deltaD)),
        },
      };
      const resolved = clampAndResolveSingleFacility(resized, base, activeEffectiveConfig);
      setOriginalFacilities(base.map((f) => (f.id === id ? resolved : f)));
      if (activeLayoutMode === 'optimized') setActiveLayoutMode('original');
    },
    [activeEffectiveConfig, activeLayoutMode, comparison.optimizedFacilities, originalFacilities],
  );

  const handleNudgeFacility = useCallback(
    (id: string, dx: number, dz: number) => {
      const base =
        activeLayoutMode === 'optimized' ? comparison.optimizedFacilities : originalFacilities;
      const found = base.find((f) => f.id === id);
      if (!found || found.locked) return;
      const nudged: Facility = {
        ...found,
        position: {
          x: found.position.x + dx,
          z: found.position.z + dz,
        },
      };
      const resolved = clampAndResolveSingleFacility(nudged, base, activeEffectiveConfig);
      setOriginalFacilities(base.map((f) => (f.id === id ? resolved : f)));
      if (activeLayoutMode === 'optimized') setActiveLayoutMode('original');
    },
    [activeEffectiveConfig, activeLayoutMode, comparison.optimizedFacilities, originalFacilities],
  );

  // Simulation Transport Controls (Separated Stop, Play/Pause Freeze, Restart)
  const handlePlayPause = useCallback(() => {
    setSimPlayState((prev) => {
      if (prev === 'playing') return 'paused';
      if (prev === 'stopped' && simulatorRef.current.getSnapshot().progress >= 0.99) {
        simulatorRef.current.seekToProgress(0);
        setSnapshot(simulatorRef.current.getSnapshot());
      }
      return 'playing';
    });
  }, []);

  const handleStopSim = useCallback(() => {
    setSimPlayState('stopped');
    simulatorRef.current.seekToProgress(0);
    setSnapshot(simulatorRef.current.getSnapshot());
  }, []);

  const handleRestartSim = useCallback(() => {
    simulatorRef.current.seekToProgress(0);
    setSnapshot(simulatorRef.current.getSnapshot());
    setSimPlayState('playing');
  }, []);

  const handleScrubProgress = useCallback((progress: number) => {
    simulatorRef.current.seekToProgress(progress);
    setSnapshot(simulatorRef.current.getSnapshot());
    setSimPlayState((prev) => (prev === 'stopped' && progress > 0 ? 'paused' : prev));
  }, []);

  // Explainable AI (XAI) Rationale Generator (Score-Free)
  const handleRequestGeminiXai = useCallback(async () => {
    setIsGeneratingAiXai(true);
    try {
      const response = await fetch('/api/ai/xai-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: activeEffectiveConfig,
          summary,
          comparisonSummary: {
            originalDensity: comparison.originalMetrics.peakDensity,
            optimizedDensity: comparison.optimizedMetrics.peakDensity,
            waitTimeDeltaPct: comparison.waitTimeDeltaPct,
          },
          personas: personas.map((p) => ({
            persona: language === 'ko' ? p.labelKo : p.labelEn,
            coveragePct: p.facilityCoveragePct,
            finding: language === 'ko' ? p.keyFindingKo : p.keyFindingEn,
          })),
          contingency,
          assumptions,
          language,
        }),
      });
      if (response.ok) {
        const json = await response.json();
        if (json?.report) {
          setAiXaiOverride({
            ...json.report,
            source: 'gemini',
            generatedAt: new Date().toLocaleTimeString(localeCode),
          });
          setIsGeneratingAiXai(false);
          return;
        }
      }
      setAiXaiOverride({
        ...deterministicXai,
        generatedAt: new Date().toLocaleTimeString(localeCode),
      });
    } catch {
      setAiXaiOverride({
        ...deterministicXai,
        generatedAt: new Date().toLocaleTimeString(localeCode),
      });
    } finally {
      setIsGeneratingAiXai(false);
    }
  }, [
    activeEffectiveConfig,
    assumptions,
    comparison,
    contingency,
    deterministicXai,
    language,
    localeCode,
    personas,
    summary,
  ]);

  const handleGenerateDesign = useCallback(() => {
    const errors = validateEventConfig(config, language);
    setValidationErrors(errors);
    if (errors.length > 0) {
      setActiveNav('workspace');
      return;
    }
    const nextCfg = { ...config, seed: (config.seed + 7919) & 0x7fffffff };
    setConfig(nextCfg);
    const generated = generateVenueLayout(nextCfg, originalFacilities);
    setOriginalFacilities(generated);
    setActiveLayoutMode('original');
    setApprovedCandidateId(null);
    setSelectedFacilityId(null);
    setGhostPreview(null);
    setActiveNav('workspace');
    flashStatus(
      tr6(
        language,
        `조건 기반 자동 배치가 완료되었습니다 (${generated.length}개 시설, 고정 부스 유지).`,
        `Generated ${generated.length}-facility layout (locked booths preserved).`,
        `条件に基づく自動配置が完了しました（${generated.length}施設、固定ブース維持）。`,
        `已完成基于条件的自动布局（${generated.length}个设施，保留锁定展位）。`,
        `Diseño automático completado (${generated.length} instalaciones, stands fijados conservados).`,
        `Disposition automatique générée (${generated.length} installations, stands verrouillés conservés).`,
      ),
    );
  }, [config, flashStatus, language, originalFacilities]);

  const handleResetDesign = useCallback(() => {
    setConfig({
      ...DEFAULT_EVENT_CONFIG,
      eventName: EVENT_PRESET_NAME_I18N[DEFAULT_EVENT_CONFIG.eventType][language],
    });
    setOriginalFacilities(DEFAULT_FACILITIES);
    setActiveLayoutMode('original');
    setContingency('normal');
    setAssumptions(DEFAULT_SIMULATION_ASSUMPTIONS);
    setCalibration(DEFAULT_FIELD_CALIBRATION);
    setApprovedCandidateId(null);
    setActivePersonaId(null);
    setVisibility(DEFAULT_LAYER_VISIBILITY);
    setSelectedFacilityId(null);
    setGhostPreview(null);
    setValidationErrors([]);
    setSimPlayState('stopped');
    simulatorRef.current.seekToProgress(0);
    setSnapshot(simulatorRef.current.getSnapshot());
    flashStatus(
      tr6(
        language,
        '표준 초기 도안으로 복원되었습니다.',
        'Restored default venue layout.',
        '標準初期図面に復元しました。',
        '已恢复为标准初始方案。',
        'Se restauró el diseño predeterminado.',
        'Plan standard par défaut restauré.',
      ),
    );
  }, [flashStatus, language]);

  const handleToggleVisibility = useCallback((key: keyof LayerVisibility) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSetAllVisibility = useCallback((visible: boolean) => {
    setVisibility({
      stage: true,
      seating: visible,
      food: visible,
      booth: visible,
      rest: visible,
      restroom: visible,
      entrance: true,
      medical: visible,
      parking: false,
      vip: visible,
      camping: visible,
      landscaping: false,
      crowd: true,
      heatmap: visible,
      pedestrianRoutes: true,
      evacuationRoutes: false,
      labels: visible,
    });
  }, []);

  const mutateFacilities = useCallback(
    (mutator: (current: Facility[]) => Facility[], priorityIds: string[] = []) => {
      const base =
        activeLayoutMode === 'optimized' ? comparison.optimizedFacilities : originalFacilities;
      const updated = enforceZeroFacilityOverlap(
        mutator(base),
        activeEffectiveConfig,
        priorityIds,
      );
      setOriginalFacilities(updated);
      if (activeLayoutMode === 'optimized') {
        setActiveLayoutMode('original');
      }
    },
    [activeEffectiveConfig, activeLayoutMode, comparison.optimizedFacilities, originalFacilities],
  );

  const handleUpdateFacility = useCallback(
    (updatedFacility: Facility) => {
      if (
        updatedFacility.accessibility.wheelchairAccessible &&
        !activeEffectiveConfig.accessibility.stepFreeRoutes
      ) {
        setConfig((prev) => ({
          ...prev,
          accessibility: { ...prev.accessibility, stepFreeRoutes: true },
        }));
      }
      mutateFacilities(
        (list) => list.map((f) => (f.id === updatedFacility.id ? updatedFacility : f)),
        [updatedFacility.id],
      );
    },
    [activeEffectiveConfig.accessibility.stepFreeRoutes, mutateFacilities],
  );

  const handleDuplicateFacility = useCallback(
    (source: Facility) => {
      const newId = `${source.category}-${Date.now().toString().slice(-4)}`;
      const baseLabel = SUBTYPE_SIMPLE_LABELS[source.subtype]?.[language] || source.name;
      const copy: Facility = {
        ...source,
        id: newId,
        locked: false,
        name: `${baseLabel} (2)`,
        nameKo: `${source.nameKo || baseLabel} (2)`,
        position: {
          x: Math.min(config.venueWidth / 2 - 8, source.position.x + source.dimensions.width + 4),
          z: source.position.z,
        },
        dimensions: { ...source.dimensions },
        accessibility: { ...source.accessibility },
      };
      mutateFacilities((list) => [...list, copy], [newId]);
      setSelectedFacilityId(newId);
    },
    [config.venueWidth, language, mutateFacilities],
  );

  const handleDeleteFacility = useCallback(
    (id: string) => {
      const base =
        activeLayoutMode === 'optimized' ? comparison.optimizedFacilities : originalFacilities;
      const target = base.find((f) => f.id === id);
      if (target?.locked) return;
      mutateFacilities((list) => list.filter((f) => f.id !== id));
      setSelectedFacilityId(null);
    },
    [activeLayoutMode, comparison.optimizedFacilities, mutateFacilities, originalFacilities],
  );

  const handleReoptimizeContingency = useCallback(() => {
    const result = reoptimizeForContingency(
      activeEffectiveConfig,
      activeFacilities,
      contingency,
    );
    setConfig(result.updatedConfig);
    setOriginalFacilities(result.facilities);
    setActiveLayoutMode('original');
    if (contingency === 'medical_emergency') {
      setVisibility((prev) => ({ ...prev, evacuationRoutes: true }));
    }
    flashStatus(
      language === 'ko'
        ? result.actionSummaryKo
        : language === 'en'
          ? result.actionSummaryEn
          : tr6(
              language,
              result.actionSummaryKo,
              result.actionSummaryEn,
              `シナリオ対応レイアウトを適用しました（${result.facilities.length}施設）。`,
              `已应用突发情景响应布局（${result.facilities.length}个设施）。`,
              `Se aplicó la adaptación operativa (${result.facilities.length} instalaciones).`,
              `Adaptation opérationnelle appliquée (${result.facilities.length} installations).`,
            ),
    );
  }, [activeEffectiveConfig, activeFacilities, contingency, flashStatus, language]);

  const handleUpgradePersona = useCallback(
    (personaId: VisitorPersonaId) => {
      const result = applyInclusivePersonaUpgrade(
        activeEffectiveConfig,
        activeFacilities,
        personaId,
      );
      setConfig(result.updatedConfig);
      setOriginalFacilities(result.facilities);
      setActiveLayoutMode('original');
      setActivePersonaId(personaId);
      flashStatus(
        language === 'ko'
          ? result.messageKo
          : language === 'en'
            ? result.messageEn
            : tr6(
                language,
                result.messageKo,
                result.messageEn,
                'バリアフリー・社会的弱者配慮設備を図面に自動補完しました。',
                '已将无障碍及弱势访客关怀设施自动补充至方案。',
                'Se añadieron automáticamente mejoras de accesibilidad universal al plano.',
                'Améliorations d’accessibilité universelle ajoutées au plan.',
              ),
      );
    },
    [activeEffectiveConfig, activeFacilities, flashStatus, language],
  );

  const handleResolveBudgetOverrun = useCallback(() => {
    const targetFacilities =
      activeLayoutMode === 'optimized' ? comparison.optimizedFacilities : originalFacilities;
    const fitted = fitLayoutToBudget(activeEffectiveConfig, targetFacilities);
    setConfig(fitted.updatedConfig);
    setOriginalFacilities(fitted.facilities);
    setActiveLayoutMode('original');
    setSelectedFacilityId(null);
    const newTotal = fitted.facilities.reduce((sum, f) => sum + getEffectiveFacilityCost(f), 0);
    flashStatus(
      tr6(
        language,
        `예산 내 자동 맞춤 완료: 총 ${formatCurrency(newTotal, language)}`,
        `Fitted within budget: ${formatCurrency(newTotal, language)}`,
        `予算内に自動調整しました: 計 ${formatCurrency(newTotal, language)}`,
        `已自动调整至预算内: 共 ${formatCurrency(newTotal, language)}`,
        `Ajustado al presupuesto: ${formatCurrency(newTotal, language)}`,
        `Ajusté au budget : ${formatCurrency(newTotal, language)}`,
      ),
    );
  }, [
    activeEffectiveConfig,
    activeLayoutMode,
    comparison.optimizedFacilities,
    flashStatus,
    language,
    originalFacilities,
  ]);

  const handleToggleFacilityBudgetExcluded = useCallback(
    (id: string) => {
      const base =
        activeLayoutMode === 'optimized' ? comparison.optimizedFacilities : originalFacilities;
      const target = base.find((f) => f.id === id);
      if (!target) return;
      const nextExcluded = !target.budgetExcluded;
      const updated = base.map((f) =>
        f.id === id ? { ...f, budgetExcluded: nextExcluded } : f,
      );
      setOriginalFacilities(updated);
      if (activeLayoutMode === 'optimized') {
        setActiveLayoutMode('original');
      }
      const dispName = getFacilityDisplayName(target, language);
      flashStatus(
        nextExcluded
          ? tr6(
              language,
              `'${dispName}'을(를) 기존 행사장 시설로 처리하여 예산에서 제외했습니다.`,
              `Excluded existing facility '${dispName}' from installation budget.`,
              `「${dispName}」を既存会場設備として予算から除外しました。`,
              `已将“${dispName}”作为场馆既有设施从预算中移除。`,
              `Se excluyó '${dispName}' del presupuesto (instalación existente).`,
              `'${dispName}' exclu du budget (équipement existant).`,
            )
          : tr6(
              language,
              `'${dispName}'을(를) 설치 예산에 다시 포함했습니다.`,
              `Re-included '${dispName}' in installation budget.`,
              `「${dispName}」を設営予算に再計上しました。`,
              `已将“${dispName}”重新计入搭建预算。`,
              `Se volvió a incluir '${dispName}' en el presupuesto.`,
              `'${dispName}' réinclus dans le budget.`,
            ),
      );
    },
    [
      activeLayoutMode,
      comparison.optimizedFacilities,
      flashStatus,
      language,
      originalFacilities,
    ],
  );

  const handleRaiseBudgetToCost = useCallback(
    (explicitTargetUsd?: number) => {
      const targetUsd =
        explicitTargetUsd ??
        Math.ceil(
          (Math.max(summary.estimatedCost, comparison.optimizedMetrics.estimatedCost) * 1.03) /
            1000,
        ) * 1000;
      const clamped = Math.max(10000, Math.min(900000, targetUsd));
      setConfig((prev) => ({ ...prev, budget: clamped }));
      flashStatus(
        tr6(
          language,
          `가용 예산이 ${formatCurrency(clamped, language)}(으)로 상향되었습니다.`,
          `Raised budget to ${formatCurrency(clamped, language)}.`,
          `利用可能予算を ${formatCurrency(clamped, language)} に引き上げました。`,
          `已将可用预算上调至 ${formatCurrency(clamped, language)}。`,
          `Presupuesto ampliado a ${formatCurrency(clamped, language)}.`,
          `Budget augmenté à ${formatCurrency(clamped, language)}.`,
        ),
      );
    },
    [comparison.optimizedMetrics.estimatedCost, flashStatus, language, summary.estimatedCost],
  );

  const handleChangeWeatherScenario = useCallback(
    (nextWeather: WeatherScenarioId, linkedContingency: ContingencyScenario) => {
      setWeatherScenario(nextWeather);
      setContingency(linkedContingency);
    },
    [],
  );

  const handleSpawnReferenceFacility = useCallback(
    (subtype: FacilitySubtype, zone: SpatialZoneTarget, labelKo: string) => {
      handleAddCatalogElement(subtype, zone, labelKo);
    },
    [handleAddCatalogElement],
  );

  const handleApplyRecommendation = useCallback(
    (actionType: NonNullable<Recommendation['actionType']>) => {
      if (actionType === 'resolve_budget_overrun') {
        handleResolveBudgetOverrun();
        return;
      }
      if (actionType === 'reoptimize_contingency') {
        handleReoptimizeContingency();
        return;
      }
      if (actionType === 'optimize_layout') {
        setActiveLayoutMode('optimized');
        return;
      }
      if (actionType === 'add_entrance') {
        handleAddCatalogElement(
          'secondary_entrance',
          'south',
          SUBTYPE_SIMPLE_LABELS.secondary_entrance[language],
        );
        return;
      }
      if (actionType === 'add_food_booths') {
        handleAddCatalogElement(
          'food_stall',
          'east',
          SUBTYPE_SIMPLE_LABELS.food_stall[language],
        );
        return;
      }
      if (actionType === 'enable_accessibility') {
        setConfig((prev) => ({
          ...prev,
          accessibility: {
            stepFreeRoutes: true,
            accessibleRestrooms: true,
            accessibleParking: true,
            wideCorridors: true,
          },
        }));
        mutateFacilities((list) =>
          list.map((f) => ({
            ...f,
            accessibility: {
              ...f.accessibility,
              wheelchairAccessible: true,
              stepFreeEntry: true,
            },
          })),
        );
        return;
      }
      if (actionType === 'add_medical') {
        handleAddCatalogElement(
          'medical_station',
          'west',
          SUBTYPE_SIMPLE_LABELS.medical_station[language],
        );
      }
    },
    [
      handleAddCatalogElement,
      handleReoptimizeContingency,
      handleResolveBudgetOverrun,
      language,
      mutateFacilities,
    ],
  );

  const handleRegenerateCandidates = useCallback(() => {
    setCandidateSeedOffset((prev) => prev + 997);
    setApprovedCandidateId(null);
    flashStatus(
      tr6(
        language,
        '배치 모형·부스 외관·시설 구성을 변경하여 후보안 A~D를 새로 생성했습니다.',
        'Regenerated Layouts A–D with distinct spatial topologies, booth styles, and counts.',
        '配置モデル・ブース外観・施設構成を変更して候補案A〜Dを再生成しました。',
        '已切换空间拓扑、展位外观与设施数量，重新生成候选方案 A~D。',
        'Se regeneraron las opciones A–D con nuevas topologías, estilos y cantidades.',
        'Options A–D régénérées avec de nouvelles topologies, styles et quantités.',
      ),
    );
  }, [flashStatus, language]);

  // Score-Free Standalone HTML Report Download (6-Language Localized)
  const handleDownloadReportHtml = useCallback(() => {
    const profileMeta = getLocalizedDensityProfile(assumptions.densityProfile, language);
    const tier = getProfileTierBadgeText(summary.moisSafetyTier, assumptions.densityProfile, language);
    const litList = getLocalizedLiteratureRegistry(language);
    const dUnit = densityUnitLabel(language);
    const htmlContent = `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="utf-8" />
  <title>${config.eventName} — INCLUSE Spatial Design & Safety Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Noto Sans KR", "Noto Sans JP", "Noto Sans SC", sans-serif; color: #0f172a; max-width: 960px; margin: 32px auto; padding: 0 24px; line-height: 1.6; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    h2 { font-size: 16px; margin-top: 28px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; }
    .meta { font-size: 12px; color: #475569; margin-bottom: 12px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
    .kpi { border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; }
    .kpi-label { font-size: 11px; color: #64748b; }
    .kpi-val { font-size: 18px; font-weight: 700; font-family: monospace; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${config.eventName}</h1>
  <div class="meta">${config.venueWidth}m × ${config.venueDepth}m (${summary.venueAreaSqm.toLocaleString()}m²) · ${tr6(language, '순수 가용면적', 'Net Usable Area', '純有効面積', '净可用面积', 'Área útil neta', 'Surface utile nette')} ${summary.usableAreaSqm.toLocaleString()}m² · ${ui.attendanceLabel} ${config.expectedAttendance.toLocaleString()} ${ui.paxUnit}</div>
  <div class="kpis">
    <div class="kpi"><div class="kpi-label">${tr6(language, '순수 가용면적', 'Net Usable Area', '純有効面積', '净可用面积', 'Área útil neta', 'Surface utile nette')}</div><div class="kpi-val">${summary.usableAreaSqm.toLocaleString()} m²</div></div>
    <div class="kpi"><div class="kpi-label">${tr6(language, '참고 수용량', 'Reference Capacity', '参考収容人数', '参考容量', 'Capacidad de ref.', 'Capacité de réf.')}</div><div class="kpi-val">${summary.referenceCapacity.toLocaleString()} ${ui.paxUnit}</div></div>
    <div class="kpi"><div class="kpi-label">${tr6(language, '피크 밀도', 'Peak Density', 'ピーク密度', '峰值密度', 'Densidad pico', 'Densité max.')} (${profileMeta.name})</div><div class="kpi-val">${summary.peakDensity.toFixed(2)} ${dUnit} (${language === 'ko' ? tier.ko : tier.en})</div></div>
    <div class="kpi"><div class="kpi-label">${tr6(language, '평균 대기 · 예상 설치비', 'Avg Wait · Est. Cost', '平均待機 · 概算設営費', '平均等待 · 预计搭建费', 'Espera media · Costo est.', 'Attente moy. · Coût est.')}</div><div class="kpi-val">${summary.avgWaitMinutes} · ${formatCurrency(summary.estimatedCost, language)}</div></div>
  </div>
  <h2>1. ${tr6(language, '핵심 공간 판정 요약', 'Executive Spatial Verdict', '空間判定サマリー', '核心空间判定摘要', 'Resumen espacial ejecutivo', 'Synthèse spatiale')}</h2>
  <p>${xaiReport.executiveSummary}</p>
  <p>${xaiReport.safetyComplianceVerdict}</p>
  <h2>2. ${tr6(language, '안전·법령 기준 점검', 'Safety & Statutory Rules', '安全・法令基準点検', '安全与法规标准核查', 'Reglas de seguridad y normativa', 'Règles de sécurité et normes')}</h2>
  <table>
    <thead><tr><th>${tr6(language, '상태', 'Status', '状態', '状态', 'Estado', 'Statut')}</th><th>${tr6(language, '검증 항목', 'Rule Check', '検証項目', '核查项目', 'Regla', 'Règle')}</th><th>${tr6(language, '상세 판정', 'Detail', '詳細判定', '详细判定', 'Detalle', 'Détail')}</th><th>${tr6(language, '적용 근거', 'Basis', '適用根拠', '依据', 'Base', 'Base')}</th></tr></thead>
    <tbody>${safetyAudit.ruleChecks.map((r) => `<tr><td>${r.status.toUpperCase()}</td><td>${language === 'ko' ? r.titleKo : r.titleEn}</td><td>${language === 'ko' ? r.detailKo : r.detailEn}</td><td>${language === 'ko' ? r.citationKo : r.citationEn}</td></tr>`).join('')}</tbody>
  </table>
  <h2>3. ${tr6(language, '무장애·교통약자 동선 평가', 'Inclusive Accessibility Audit', 'バリアフリー・配慮動線評価', '无障碍关怀流线评估', 'Auditoría de accesibilidad', 'Audit d’accessibilité')}</h2>
  <table>
    <thead><tr><th>${tr6(language, '이용자 계층', 'Visitor Group', '利用者区分', '访客群体', 'Grupo visitante', 'Groupe visiteur')}</th><th>${tr6(language, '무장애 적용률', 'Coverage', 'バリアフリー率', '无障碍覆盖率', 'Cobertura', 'Couverture')}</th><th>${tr6(language, '연속 보행거리', 'Max Walk', '連続歩行距離', '连续步行距离', 'Tramo máx.', 'Marche max.')}</th><th>${tr6(language, '검증 소견', 'Finding', '所見', '核查结论', 'Hallazgo', 'Constat')}</th></tr></thead>
    <tbody>${personas.map((p) => `<tr><td>${language === 'ko' ? p.labelKo : p.labelEn}</td><td>${p.facilityCoveragePct}%</td><td>${p.maxContinuousWalkM}m</td><td>${language === 'ko' ? p.keyFindingKo : p.keyFindingEn}</td></tr>`).join('')}</tbody>
  </table>
  <h2>4. ${tr6(language, '배치 시설 명세', 'Placed Facility Schedule', '配置施設明細', '已布置设施清单', 'Inventario de instalaciones', 'Inventaire des installations')} (${activeFacilities.length})</h2>
  <table>
    <thead><tr><th>${tr6(language, '시설명', 'Name', '施設名', '设施名称', 'Nombre', 'Nom')}</th><th>${tr6(language, '고정', 'Locked', '固定', '锁定', 'Fijo', 'Verrouillé')}</th><th>(X,Z)</th><th>${tr6(language, '규격', 'Size', '寸法', '尺寸', 'Tamaño', 'Dimensions')}</th><th>${tr6(language, '수용량', 'Cap.', '収容', '容量', 'Cap.', 'Cap.')}</th><th>${tr6(language, '예상 설치비', 'Est. Cost', '概算設営費', '预计搭建费', 'Costo est.', 'Coût est.')}</th></tr></thead>
    <tbody>${activeFacilities.map((f) => `<tr><td>${getFacilityDisplayName(f, language)}</td><td>${f.locked ? ui.lockBoothBtn : '-'}</td><td>(${Math.round(f.position.x)}m, ${Math.round(f.position.z)}m)</td><td>${f.dimensions.width}m×${f.dimensions.depth}m</td><td>${f.capacity.toLocaleString()}</td><td>${f.budgetExcluded ? `${formatCurrency(0, language)} (${tr6(language, '기존 시설 제외', 'Excluded', '既存除外', '既有排除', 'Excluido', 'Exclu')})` : formatCurrency(f.cost, language)}</td></tr>`).join('')}</tbody>
  </table>
  <h2>5. ${tr6(language, '참고 문헌 및 안전 매뉴얼', 'References & Safety Manuals', '参考文献・安全マニュアル', '参考文献与安全手册', 'Referencias y manuales', 'Références et manuels')}</h2>
  <table>
    <thead><tr><th>#</th><th>${tr6(language, '자료명', 'Reference', '資料名', '文献名称', 'Referencia', 'Référence')}</th><th>${tr6(language, '적용 내용', 'Applied Scope', '適用内容', '应用范围', 'Alcance', 'Portée')}</th></tr></thead>
    <tbody>${litList.map((s) => `<tr><td>${s.refNo}</td><td><strong>${s.authorsAndYear}</strong> — ${s.title}</td><td>${s.appliedModuleKo}</td></tr>`).join('')}</tbody>
  </table>
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.eventName.replace(/\s+/g, '_')}_INCLUSE_Report.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [
    activeFacilities,
    assumptions.densityProfile,
    config,
    language,
    personas,
    safetyAudit.ruleChecks,
    summary,
    ui,
    xaiReport,
  ]);

  const currentProjectPayload = useMemo<SavedProjectPayload>(
    () => ({
      schemaVersion: '1.1.0',
      savedAt: new Date().toISOString(),
      config: activeEffectiveConfig,
      facilities: activeFacilities,
      activeLayoutMode,
      contingency,
      assumptions,
      optimizedFacilities: comparison.optimizedFacilities,
      metricsSummary: summary,
      personas,
    }),
    [
      activeEffectiveConfig,
      activeFacilities,
      activeLayoutMode,
      assumptions,
      comparison.optimizedFacilities,
      contingency,
      personas,
      summary,
    ],
  );

  const handleSaveProject = useCallback(() => {
    try {
      const slug = config.eventName
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]+/g, '_')
        .slice(0, 32);
      const key = `${STORAGE_PREFIX}${slug || 'venue'}`;
      localStorage.setItem(key, JSON.stringify(currentProjectPayload));
      setSavedProjectsVersion((v) => v + 1);
      flashStatus(
        tr6(
          language,
          `'${config.eventName}' 도안이 저장되었습니다.`,
          `Saved "${config.eventName}".`,
          `「${config.eventName}」の図面を保存しました。`,
          `已保存“${config.eventName}”方案。`,
          `Proyecto "${config.eventName}" guardado.`,
          `Projet « ${config.eventName} » enregistré.`,
        ),
      );
    } catch {
      flashStatus(
        tr6(
          language,
          '저장에 실패했습니다.',
          'Unable to save project.',
          '保存に失敗しました。',
          '保存失败。',
          'No se pudo guardar.',
          'Échec de l’enregistrement.',
        ),
      );
    }
  }, [config.eventName, currentProjectPayload, flashStatus, language]);

  // Blank Plan Creation Handlers ("새 도안 만들기")
  const executeClearToBlankPlan = useCallback(() => {
    setOriginalFacilities([]);
    setActiveLayoutMode('original');
    setGhostPreview(null);
    setSelectedFacilityId(null);
    setApprovedCandidateId(null);
    setActivePersonaId(null);
    setConfig((prev) => ({
      ...prev,
      foodBoothCount: 0,
      experienceBoothCount: 0,
      parkingCount: 0,
      customElements: [],
    }));
    setSimPlayState('stopped');
    simulatorRef.current.seekToProgress(0);
    setSnapshot(simulatorRef.current.getSnapshot());
    setIsNewPlanModalOpen(false);
    setActiveNav('workspace');
    setIsLeftSidebarOpen(true);
    setLeftSidebarTab('setup');
    flashStatus(ui.emptyVenueHint);
  }, [flashStatus, ui.emptyVenueHint]);

  const handleSaveAndStartNewPlan = useCallback(() => {
    handleSaveProject();
    executeClearToBlankPlan();
  }, [executeClearToBlankPlan, handleSaveProject]);

  const handleExportJson = useCallback(() => {
    const jsonStr = JSON.stringify(currentProjectPayload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = config.eventName
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, '-')
      .replace(/^-|-$/g, '');
    a.href = url;
    a.download = `${slug || 'incluse-indoor-plan'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [config.eventName, currentProjectPayload]);

  const handleImportJson = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          if (parsed?.config && Array.isArray(parsed.facilities)) {
            const nextCfg = { ...DEFAULT_EVENT_CONFIG, ...parsed.config };
            setConfig(nextCfg);
            setOriginalFacilities(enforceZeroFacilityOverlap(parsed.facilities, nextCfg));
            if (parsed.contingency) setContingency(parsed.contingency);
            if (parsed.assumptions) {
              setAssumptions({ ...DEFAULT_SIMULATION_ASSUMPTIONS, ...parsed.assumptions });
            }
            setActiveLayoutMode('original');
            setSelectedFacilityId(null);
            setGhostPreview(null);
            setValidationErrors([]);
            const importedTitle = parsed.config.eventName || file.name;
            flashStatus(
              tr6(
                language,
                `'${importedTitle}' 도안을 불러왔습니다.`,
                `Imported "${importedTitle}".`,
                `「${importedTitle}」を読み込みました。`,
                `已导入“${importedTitle}”。`,
                `Se importó "${importedTitle}".`,
                `« ${importedTitle} » importé.`,
              ),
            );
          }
        } catch {
          setValidationErrors([
            tr6(
              language,
              'JSON 파일을 해석할 수 없습니다.',
              'Could not parse JSON file.',
              'JSONファイルを解析できませんでした。',
              '无法解析JSON文件。',
              'No se pudo analizar el archivo JSON.',
              'Impossible d’analyser le fichier JSON.',
            ),
          ]);
        }
      };
      reader.readAsText(file);
    },
    [flashStatus, language],
  );

  const handleLoadSavedProject = useCallback(
    (payload: SavedProjectPayload) => {
      const nextCfg = { ...DEFAULT_EVENT_CONFIG, ...payload.config };
      setConfig(nextCfg);
      setOriginalFacilities(enforceZeroFacilityOverlap(payload.facilities, nextCfg));
      if (payload.contingency) setContingency(payload.contingency);
      if (payload.assumptions) {
        setAssumptions({ ...DEFAULT_SIMULATION_ASSUMPTIONS, ...payload.assumptions });
      }
      setActiveLayoutMode('original');
      setSelectedFacilityId(null);
      setGhostPreview(null);
      setValidationErrors([]);
      setActiveNav('workspace');
    },
    [],
  );

  const handleDeleteSavedProject = useCallback((key: string) => {
    try {
      localStorage.removeItem(key);
      setSavedProjectsVersion((v) => v + 1);
    } catch {
      // Ignore
    }
  }, []);

  const handleSelectWorkflowStage = (stage: WorkflowStageId) => {
    setWorkflowStage(stage);
    setActiveNav('workspace');
    if (stage === 'conditions' || stage === 'booths') {
      setIsLeftSidebarOpen(true);
      setLeftSidebarTab('setup');
    } else if (stage === 'ai_collab') {
      setIsLeftSidebarOpen(true);
      setLeftSidebarTab('chat');
    } else if (stage === 'simulation') {
      setVisibility((prev) => ({ ...prev, crowd: true, pedestrianRoutes: true }));
    }
  };

  if (activeNav === 'landing') {
    return (
      <LandingPageView
        language={language}
        onNavigate={(section) => setActiveNav(section)}
        onLogin={() => setIsLoggedIn(!isLoggedIn)}
        isLoggedIn={isLoggedIn}
        username={username}
        role={userRole}
      />
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden font-sans selection:bg-blue-100 selection:text-blue-900 no-print">
      {/* Score-Free Navigation Top Bar */}
      <header className="h-14 bg-slate-900 text-white shrink-0 z-40 px-4 flex items-center justify-between no-print shadow-md">
        <div className="flex items-center gap-6 h-full">
          <button
            type="button"
            onClick={() => setActiveNav('landing')}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity cursor-pointer h-full"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
              <Zap className="w-5 h-5 fill-white text-white" />
            </div>
            <div>
              <div className="text-sm font-black tracking-tighter leading-none text-white">Event ON</div>
              <div className="text-[9px] font-bold opacity-50 uppercase tracking-[0.1em] text-white">Space Lab</div>
            </div>
          </button>

          <nav className="flex items-center h-full gap-1">
            {[
              { id: 'workspace' as const, label: ui.navWorkspace, icon: LayoutDashboard },
              { id: 'comparison' as const, label: ui.navCandidates, icon: Globe },
              { id: 'analytics' as const, label: ui.navAnalytics, icon: FilePlus2 },
              { id: 'knowledge_db' as const, label: ui.navKnowledge, icon: MessageSquare },
              { id: 'xai_report' as const, label: ui.navXaiReport, icon: ChevronRight },
              { id: 'integration' as const, label: ui.navDownload, icon: ChevronLeft },
            ].map((item) => {
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveNav(item.id);
                    setFocusedKnowledgeContext(null);
                  }}
                  className={`h-full px-4 flex items-center gap-2 text-xs font-bold transition-all relative group cursor-pointer ${
                    active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>{item.label}</span>
                  {active && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-t-full shadow-[0_-4px_10px_rgba(59,130,246,0.5)]" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 no-print">
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
              {LANGUAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => setLanguage(opt.code as Language)}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    language === opt.code
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.nativeLabel}
                </button>
              ))}
            </div>
          </div>

          <div className="h-8 w-px bg-slate-800 mx-1" />

          <button
            type="button"
            onClick={handleSaveProject}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20 active:scale-95 cursor-pointer"
          >
            <span>{ui.saveProjectBtn}</span>
          </button>
        </div>
      </header>

      {/* 4-Stage Guided Design Workflow Strip (Workspace Only) */}
      {activeNav === 'workspace' && (
        <div className="h-9 shrink-0 bg-slate-50 border-b border-slate-200 px-5 flex items-center justify-between gap-4 text-xs overflow-x-auto no-print">
          <div className="flex items-center gap-2">
            {(['conditions', 'booths', 'ai_collab', 'simulation'] as WorkflowStageId[]).map(
              (stId, idx) => {
                const stMeta = ui.workflowStages[stId];
                const isActive = workflowStage === stId;
                return (
                  <React.Fragment key={stId}>
                    {idx > 0 && <span className="text-slate-300">→</span>}
                    <button
                      type="button"
                      onClick={() => handleSelectWorkflowStage(stId)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 text-white font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      <span className="text-[10px] opacity-80">{stMeta.step}</span>
                      <span>{stMeta.label}</span>
                    </button>
                  </React.Fragment>
                );
              },
            )}
          </div>
          <div className="hidden md:block text-[11px] font-mono tabular-nums text-slate-500 shrink-0">
            {config.venueWidth}m × {config.venueDepth}m · {activeFacilities.length}{' '}
            {tr6(language, '개 배치됨', 'placed', '配置済み', '已布置', 'ubicadas', 'placées')}
          </div>
        </div>
      )}

      {/* Main View Port */}
      {activeNav === 'workspace' && (
        <div className="flex-1 flex overflow-hidden relative">
          {isLeftSidebarOpen && (
            <LeftSidebar
              language={language}
              config={activeEffectiveConfig}
              onChangeConfig={handleChangeConfig}
              onChangeExteriorParkingCount={handleChangeExteriorParkingCount}
              onSelectEventTypePreset={handleSelectEventTypePreset}
              onRequestNewPlan={() => setIsNewPlanModalOpen(true)}
              aiPrompt={aiPrompt}
              onChangeAiPrompt={setAiPrompt}
              onRunAiBriefParser={handleRunAiBriefParser}
              isParsingBrief={isParsingBrief}
              aiBriefSummary={aiBriefSummary}
              appliedPromptChanges={appliedPromptChanges}
              contingency={contingency}
              onChangeContingency={setContingency}
              onReoptimizeContingency={handleReoptimizeContingency}
              visibility={visibility}
              onToggleVisibility={handleToggleVisibility}
              onSetAllVisibility={handleSetAllVisibility}
              onGenerateDesign={handleGenerateDesign}
              onResetDesign={handleResetDesign}
              onSaveProject={handleSaveProject}
              onExportJson={handleExportJson}
              onImportJson={handleImportJson}
              validationErrors={validationErrors}
              saveStatusMessage={saveStatusMessage}
              estimatedCost={summary.estimatedCost}
              onResolveBudgetOverrun={handleResolveBudgetOverrun}
              onRaiseBudgetToCost={() => handleRaiseBudgetToCost()}
              onCollapse={() => setIsLeftSidebarOpen(false)}
              activeTab={leftSidebarTab}
              onChangeActiveTab={(tab) => {
                setLeftSidebarTab(tab);
                if (tab === 'chat') setWorkflowStage('ai_collab');
                else if (tab === 'setup') setWorkflowStage('booths');
              }}
              candidates={candidates}
              approvedCandidateId={approvedCandidateId}
              onPreviewCandidate={handlePreviewCandidateIn3D}
              onApplyCandidate={handleApproveCandidate}
              onPreviewCatalogElement={handlePreviewCatalogElement}
              onAddCatalogElement={handleAddCatalogElement}
              recommendedBooths={recommendedBooths}
              isRecommendingBooths={isRecommendingBooths}
              onRequestBoothRecommendations={handleRequestBoothRecommendations}
              onPreviewRecommendedBooth={handlePreviewRecommendedBooth}
              onAddRecommendedBooth={handleAddRecommendedBooth}
              chatMessages={chatMessages}
              pendingProposals={pendingProposals}
              onPreviewProposal={handlePreviewProposal}
              onApplyProposal={handleApplyProposal}
              onUndoProposal={handleUndoProposal}
              onCancelProposal={handleCancelProposal}
              autoApplyChat={autoApplyChat}
              onChangeAutoApplyChat={setAutoApplyChat}
              chatRole={chatRole}
              onChangeChatRole={setChatRole}
              chatModelTier={chatModelTier}
              onChangeChatModelTier={setChatModelTier}
              isChatSending={isChatSending}
              onSendChatMessage={handleSendChatMessage}
              onResetChat={handleResetChat}
            />
          )}

          <main className="flex-1 min-w-0 relative h-full">
            <button
              type="button"
              onClick={() => setIsLeftSidebarOpen((open) => !open)}
              aria-label={isLeftSidebarOpen ? 'Collapse Left Sidebar' : 'Expand Left Sidebar'}
              className={`absolute left-0 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center border border-l-0 border-slate-300 rounded-r-lg shadow-sm transition-colors cursor-pointer no-print ${
                isLeftSidebarOpen
                  ? 'w-5 h-14 bg-white text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                  : 'px-2 py-3 bg-white text-slate-800 hover:text-blue-700 hover:bg-blue-50 gap-1 font-semibold text-xs'
              }`}
            >
              {isLeftSidebarOpen ? (
                <ChevronLeft className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-blue-600" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsRightSidebarOpen((open) => !open)}
              aria-label={isRightSidebarOpen ? 'Collapse Right Sidebar' : 'Expand Right Sidebar'}
              className={`absolute right-0 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center border border-r-0 border-slate-300 rounded-l-lg shadow-sm transition-colors cursor-pointer no-print ${
                isRightSidebarOpen
                  ? 'w-5 h-14 bg-white text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                  : 'px-2 py-3 bg-white text-slate-800 hover:text-blue-700 hover:bg-blue-50 gap-1 font-semibold text-xs'
              }`}
            >
              {isRightSidebarOpen ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronLeft className="w-3.5 h-3.5 text-blue-600" />
              )}
            </button>

            <ThreeVenueCanvas
              language={language}
              config={activeEffectiveConfig}
              facilities={activeFacilities}
              baselineFacilities={originalFacilities}
              onSwitchLayoutMode={(mode) => {
                setActiveLayoutMode(mode);
                setSelectedFacilityId(null);
              }}
              visibility={visibility}
              onToggleVisibility={handleToggleVisibility}
              onQuickToggleAccessibility={handleQuickToggleAccessibility}
              roleCounts={snapshot.roleCounts}
              selectedFacilityId={selectedFacilityId}
              highlightedFacilityIds={highlightedFacilityIds}
              onSelectFacility={(id) => {
                setSelectedFacilityId(id);
                if (id) {
                  setIsRightSidebarOpen(true);
                }
              }}
              onMoveFacility={handleMoveFacility}
              onResizeFacility={handleResizeFacility}
              onNudgeFacility={handleNudgeFacility}
              ghostPreview={ghostPreview}
              onConfirmGhostPreview={handleConfirmGhostPreview}
              onCancelGhostPreview={handleCancelGhostPreview}
              deviceMode={deviceMode}
              onChangeDeviceMode={handleChangeDeviceMode}
              simulatorRef={simulatorRef}
              isPlaying={simPlayState === 'playing'}
              simSpeed={simSpeed}
              simProgress={snapshot.progress}
              contingency={contingency}
              onChangeContingency={setContingency}
              onReoptimizeContingency={handleReoptimizeContingency}
              onSnapshotUpdate={setSnapshot}
              activeLayoutBadge={activeLayoutMode}
              isLeftSidebarOpen={isLeftSidebarOpen}
              onToggleLeftSidebar={() => setIsLeftSidebarOpen((open) => !open)}
              isRightSidebarOpen={isRightSidebarOpen}
              onToggleRightSidebar={() => setIsRightSidebarOpen((open) => !open)}
              onRequestNewPlan={() => setIsNewPlanModalOpen(true)}
              onResetDesign={handleResetDesign}
            >
              <SimulationTimelineDock
                language={language}
                snapshot={snapshot}
                densityProfile={assumptions.densityProfile}
                simPlayState={simPlayState}
                onPlayPause={handlePlayPause}
                onStop={handleStopSim}
                onRestart={handleRestartSim}
                simSpeed={simSpeed}
                onChangeSpeed={setSimSpeed}
                onScrubProgress={handleScrubProgress}
                heatmapVisible={visibility.heatmap}
                onToggleHeatmap={() => handleToggleVisibility('heatmap')}
                hasFacilities={activeFacilities.length > 0}
                isNonPerformanceEvent={
                  activeEffectiveConfig.stagePlacement === 'projector_screen' ||
                  activeEffectiveConfig.stagePlacement === 'none' ||
                  (!activeFacilities.some((f) => f.subtype === 'main_stage') &&
                    activeFacilities.some((f) => f.subtype === 'beam_projector'))
                }
              />
            </ThreeVenueCanvas>
          </main>

          {isRightSidebarOpen && (
            <RightSidebar
              language={language}
              config={activeEffectiveConfig}
              facilities={activeFacilities}
              selectedFacility={selectedFacility}
              onCloseSelection={() => setSelectedFacilityId(null)}
              onUpdateFacility={handleUpdateFacility}
              onDuplicateFacility={handleDuplicateFacility}
              onDeleteFacility={handleDeleteFacility}
              onSelectFacilityById={(id) => {
                setSelectedFacilityId(id);
                setIsRightSidebarOpen(true);
              }}
              snapshot={snapshot}
              summary={summary}
              safetyAudit={safetyAudit}
              clearanceAudit={clearanceAudit}
              assumptions={assumptions}
              onChangeAssumptions={setAssumptions}
              personas={personas}
              activePersonaId={activePersonaId}
              onSelectPersona={setActivePersonaId}
              onUpgradePersona={handleUpgradePersona}
              xaiReport={xaiReport}
              onOpenXaiReportView={() => setActiveNav('xai_report')}
              onOpenKnowledgeBaseView={() => setActiveNav('knowledge_db')}
              onOpenKnowledgeWithContext={handleOpenKnowledgeWithContext}
              checklist={checklist}
              calibration={calibration}
              weatherScenario={weatherScenario}
              recommendations={recommendations}
              onApplyRecommendation={handleApplyRecommendation}
              onCollapse={() => setIsRightSidebarOpen(false)}
            />
          )}
        </div>
      )}

      {activeNav === 'comparison' && (
        <ComparisonView
          language={language}
          config={config}
          comparison={comparison}
          candidates={candidates}
          approvedCandidateId={approvedCandidateId}
          activeLayoutMode={activeLayoutMode}
          onPreviewCandidateIn3D={handlePreviewCandidateIn3D}
          onApproveCandidate={handleApproveCandidate}
          onRegenerateCandidates={handleRegenerateCandidates}
          onOpenXaiReport={() => setActiveNav('xai_report')}
          onOpenKnowledgeWithContext={handleOpenKnowledgeWithContext}
          onActivateIn3D={(mode) => {
            setActiveLayoutMode(mode);
            setSelectedFacilityId(null);
          }}
          onPromoteOptimizedToBaseline={() => {
            setOriginalFacilities(comparison.optimizedFacilities);
            setConfig((prev) => ({
              ...prev,
              accessibility: {
                ...prev.accessibility,
                stepFreeRoutes: true,
                wideCorridors: true,
              },
            }));
            setActiveLayoutMode('original');
            setSelectedFacilityId(null);
            setActiveNav('workspace');
          }}
          onResolveBudgetOverrun={handleResolveBudgetOverrun}
          onRaiseBudgetToCost={(targetUsd) => handleRaiseBudgetToCost(targetUsd)}
          onBackToWorkspace={() => setActiveNav('workspace')}
        />
      )}

      {activeNav === 'analytics' && (
        <AnalyticsView
          language={language}
          config={activeEffectiveConfig}
          facilities={activeFacilities}
          snapshot={snapshot}
          summary={summary}
          safetyAudit={safetyAudit}
          assumptions={assumptions}
          onChangeAssumptions={setAssumptions}
          calibration={calibration}
          onChangeCalibration={setCalibration}
          onScrubProgress={handleScrubProgress}
          recommendations={recommendations}
          onApplyRecommendation={handleApplyRecommendation}
          onToggleBudgetExcluded={handleToggleFacilityBudgetExcluded}
          onInspectFacilityIn3D={(id) => {
            setSelectedFacilityId(id);
            setActiveNav('workspace');
          }}
          onBackToWorkspace={() => setActiveNav('workspace')}
        />
      )}

      {activeNav === 'knowledge_db' && (
        <KnowledgeBaseView
          language={language}
          config={activeEffectiveConfig}
          facilities={activeFacilities}
          snapshot={snapshot}
          summary={summary}
          safetyAudit={safetyAudit}
          calibration={calibration}
          checklist={checklist}
          onChangeChecklist={setChecklist}
          weatherScenario={weatherScenario}
          onChangeWeatherScenario={handleChangeWeatherScenario}
          onSpawnReferenceFacility={handleSpawnReferenceFacility}
          onPreviewReferenceFacility={handlePreviewCatalogElement}
          focusedContext={focusedKnowledgeContext}
          onClearFocusedContext={() => setFocusedKnowledgeContext(null)}
          onResolveBudgetOverrun={handleResolveBudgetOverrun}
          onRaiseBudgetToCost={(targetUsd) => handleRaiseBudgetToCost(targetUsd)}
          candidates={candidates}
          onApplyCandidate={handleApproveCandidate}
          onBackToWorkspace={() => setActiveNav('workspace')}
        />
      )}

      {activeNav === 'xai_report' && (
        <XaiReportView
          language={language}
          config={activeEffectiveConfig}
          facilities={activeFacilities}
          summary={summary}
          safetyAudit={safetyAudit}
          assumptions={assumptions}
          comparison={comparison}
          personas={personas}
          contingency={contingency}
          xaiReport={xaiReport}
          isGeneratingAiXai={isGeneratingAiXai}
          onRequestGeminiXai={handleRequestGeminiXai}
          onDownloadReportHtml={handleDownloadReportHtml}
          onBackToWorkspace={() => setActiveNav('workspace')}
        />
      )}

      {activeNav === 'integration' && (
        <IntegrationView
          language={language}
          currentPayload={currentProjectPayload}
          savedProjects={savedProjects}
          onLoadSavedProject={handleLoadSavedProject}
          onDeleteSavedProject={handleDeleteSavedProject}
          onExportJson={handleExportJson}
          onBackToWorkspace={() => setActiveNav('workspace')}
        />
      )}

      {/* Custom React Confirmation Modal for "New Blank Plan" ("새 도안 만들기") */}
      {isNewPlanModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4">
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-slate-900">
                {ui.newBlueprintModalTitle}
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                {ui.newBlueprintModalDesc}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveAndStartNewPlan}
                className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                {ui.saveAndNewBtn}
              </button>
              <button
                type="button"
                onClick={executeClearToBlankPlan}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                {ui.discardAndNewBtn}
              </button>
              <button
                type="button"
                onClick={() => setIsNewPlanModalOpen(false)}
                className="w-full py-2 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
              >
                {ui.cancelBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
