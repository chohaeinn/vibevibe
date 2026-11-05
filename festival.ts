export type Language = 'ko' | 'en' | 'ja' | 'zh' | 'es' | 'fr';

export type SimulationPlayState = 'stopped' | 'playing' | 'paused';

export type DeviceControlMode = 'laptop' | 'tablet';

export type WorkflowStageId = 'conditions' | 'booths' | 'ai_collab' | 'simulation';

export type EventType =
  | 'music_festival'
  | 'school_festival'
  | 'sports_event'
  | 'exhibition'
  | 'career_fair'
  | 'community_festival'
  | 'flea_market';

export type DesignObjective =
  | 'safety_first'
  | 'congestion_reduction'
  | 'accessibility_inclusion'
  | 'visitor_engagement'
  | 'operational_efficiency'
  | 'budget_efficiency';

export type ContingencyScenario =
  | 'normal'
  | 'rain'
  | 'surge'
  | 'stage_delay'
  | 'medical_emergency';

export type VisitorPersonaId =
  | 'wheelchair'
  | 'stroller'
  | 'children'
  | 'seniors'
  | 'foreigner';

export type MoisSafetyTier = 'safe' | 'caution' | 'warning' | 'danger';

/**
 * Explicit density reference profiles reflecting the exact differences inside
 * MoIS (행정안전부, 2024.9) Crowd Safety Management Guidelines [1].
 */
export type DensityReferenceProfileId =
  | 'mois_2024_main_table'
  | 'mois_2024_page10_note'
  | 'indoor_narrow_conservative';

/**
 * Epistemic model state distinction per Esri (2026.7) [13] & Report Section 08/10:
 * Distinguishes 3D layout visualization, uncalibrated assumption-based simulation,
 * and field-observation compared models.
 */
export type ModelVerificationStatus =
  | 'layout_only'
  | 'assumption_sim'
  | 'field_calibrated';

export interface SimulationAssumptions {
  densityProfile: DensityReferenceProfileId;
  /** Route & steward guidance compliance rate (0.50 - 1.00), per Nishida et al. (2023) [3] & CrowdLogo [8] */
  guidanceComplianceRate: number;
  /** Free inflow vs. upstream holding-zone throttling, per Seongsu-dong case [1] */
  inflowControlMode: 'free' | 'holding';
  /** Simulates 1 primary gate blocked/closed during peak egress, per Turin Piazza San Carlo [8] */
  closedPrimaryGate: boolean;
  /** External subway/bus/parking hourly dispersal capacity (pax/hr), per Mojiko [3] & Seoul Fireworks [16] */
  externalTransitCapacityPerHour: number;
}

export interface FieldCalibrationSample {
  enabled: boolean;
  locationLabel: string;
  observedExitFlowPerMin: number;
  observedPeakDensity: number;
}

export type FacilityCategory =
  | 'stage'
  | 'seating'
  | 'food'
  | 'booth'
  | 'rest'
  | 'restroom'
  | 'entrance'
  | 'medical'
  | 'parking'
  | 'vip'
  | 'camping';

export type FacilitySubtype =
  | 'main_stage'
  | 'secondary_stage'
  | 'foh_control'
  | 'seating_block'
  | 'food_truck'
  | 'food_stall'
  | 'beer_garden'
  | 'experience_booth'
  | 'goods_shop'
  | 'photo_zone'
  | 'rest_plaza'
  | 'fountain_plaza'
  | 'play_zone'
  | 'family_lounge'
  | 'rain_canopy'
  | 'locker_charging'
  | 'eco_station'
  | 'mist_cooling'
  | 'smoking_booth'
  | 'restroom_bank'
  | 'main_entrance'
  | 'secondary_entrance'
  | 'ticket_info'
  | 'multilingual_info'
  | 'wristband_hub'
  | 'medical_station'
  | 'parking_lot'
  | 'shuttle_stop'
  | 'vip_lounge'
  | 'camping_zone'
  | 'pet_zone'
  | 'wheelchair_viewing'
  | 'access_ramp'
  | 'tactile_paving'
  | 'senior_rest'
  | 'fire_safety_unit'
  | 'emergency_shelter'
  | 'accessible_parking'
  | 'experience_pavilion'
  | 'exhibition_hall'
  | 'volunteer_center'
  | 'control_room'
  | 'beam_projector';

export type VenueBoundaryShape =
  | 'rectangle'
  | 'circle_arena'
  | 'fan_amphitheater'
  | 'linear_park'
  | 'courtyard_campus'
  | 'expo_hall';

export type StagePlacementMode =
  | 'north_end'
  | 'center_360'
  | 'twin_stages'
  | 'runway_keynote'
  | 'projector_screen'
  | 'none';

export type VenueLayoutModel =
  | 'standard'
  | 'circular_plaza'
  | 'u_courtyard'
  | 'boulevard_grid'
  | 'cluster_village'
  | 'radial_fan'
  | 'diagonal_avenue'
  | 'waterside_promenade';

export type BoothModelStyle =
  | 'pagoda_tent'
  | 'modern_container'
  | 'open_canopy'
  | 'wooden_pavilion'
  | 'geodesic_dome'
  | 'expo_shell'
  | 'parasol_table'
  | 'inflatable_air';

export type CustomZoneHint =
  | 'north'
  | 'south'
  | 'east'
  | 'west'
  | 'center'
  | 'entrance'
  | 'perimeter';

export interface CustomRequestedFacilitySpec {
  nameKo: string;
  nameEn?: string;
  category: FacilityCategory;
  subtype: FacilitySubtype;
  count: number;
  zoneHint?: CustomZoneHint;
  width?: number;
  depth?: number;
}

export interface AccessibilitySettings {
  stepFreeRoutes: boolean;
  accessibleRestrooms: boolean;
  accessibleParking: boolean;
  wideCorridors: boolean;
}

export interface RequiredFacilitiesConfig {
  vipZone: boolean;
  campingArea: boolean;
  extraMedical: boolean;
  playRestZone: boolean;
}

export type VenueEnvironmentType = 'indoor' | 'outdoor';

export type VenueFloorMode = 'preset' | 'color' | 'image';

export type IndoorFloorPresetId =
  | 'epoxy_light'
  | 'expo_carpet'
  | 'wood_parquet'
  | 'polished_dark';

export type OutdoorFloorPresetId =
  | 'natural_lawn'
  | 'stone_plaza'
  | 'asphalt_street'
  | 'clay_campus';

export interface VenueFloorSettings {
  mode: VenueFloorMode;
  indoorPreset: IndoorFloorPresetId;
  outdoorPreset: OutdoorFloorPresetId;
  customColor: string;
  customImageUrl: string;
  imageFit: 'repeat' | 'cover';
  showGrid: boolean;
}

export interface EventConfig {
  eventName: string;
  eventType: EventType;
  venueEnvironment?: VenueEnvironmentType;
  floorSettings?: VenueFloorSettings;
  venueWidth: number; // X axis in meters (e.g., 200)
  venueDepth: number; // Z axis in meters (e.g., 150)
  expectedAttendance: number;
  startTime: string; // e.g., "10:00"
  endTime: string;   // e.g., "22:00"
  budget: number;    // in USD (1 USD ≈ 1,350 KRW for KRW display)
  objective: DesignObjective;
  venueShape?: VenueBoundaryShape;
  stagePlacement?: StagePlacementMode;
  venueLayoutModel?: VenueLayoutModel;
  boothModel?: BoothModelStyle;
  seatingBlockCount?: number;
  foodBoothCount: number;
  experienceBoothCount: number;
  entranceCount: number;
  restroomCount?: number;
  medicalCount?: number;
  parkingCount?: number;
  subStageCount?: number;
  customElements?: CustomRequestedFacilitySpec[];
  requiredFacilities: RequiredFacilitiesConfig;
  accessibility: AccessibilitySettings;
  seed: number;
}

export interface Facility {
  id: string;
  name: string;
  nameKo?: string;
  category: FacilityCategory;
  subtype: FacilitySubtype;
  position: {
    x: number;
    z: number;
  };
  dimensions: {
    width: number;
    depth: number;
    height: number;
  };
  rotation: number; // radians around Y
  capacity: number;
  cost: number;
  attractionWeight: number; // 0.1 to 3.0
  colorAccent: string;
  covered?: boolean;
  accessibility: {
    wheelchairAccessible: boolean;
    stepFreeEntry: boolean;
    priorityQueue: boolean;
  };
  notes?: string;
  locked?: boolean;
  customDisplayName?: boolean;
  /** Existing venue booth/facility already present on site — excluded from installation budget ($0) */
  budgetExcluded?: boolean;
}

export interface LayerVisibility {
  stage: boolean;
  seating: boolean;
  food: boolean;
  booth: boolean;
  rest: boolean;
  restroom: boolean;
  entrance: boolean;
  medical: boolean;
  parking: boolean;
  vip: boolean;
  camping: boolean;
  landscaping: boolean;
  crowd: boolean;
  heatmap: boolean;
  pedestrianRoutes: boolean;
  evacuationRoutes: boolean;
  labels: boolean;
}

export type CameraViewMode = 'isometric' | 'top' | 'perspective';

export type EventPhaseId =
  | 'arrival'
  | 'afternoon_booths'
  | 'pre_show'
  | 'headline_show'
  | 'intermission'
  | 'egress';

export interface EventPhaseInfo {
  id: EventPhaseId;
  label: string;
  labelKo: string;
  shortLabel: string;
  shortLabelKo: string;
  progressRange: [number, number]; // 0.0 to 1.0
  description: string;
  descriptionKo: string;
}

export interface BottleneckAlert {
  facilityId: string;
  facilityName: string;
  category: FacilityCategory;
  peakDensity: number; // persons / m^2
  estimatedQueue: number; // people waiting
  utilizationRatio: number; // 0 to 2+
}

export interface TimelinePoint {
  timeLabel: string;
  progress: number;
  phaseId?: EventPhaseId;
  phaseLabel: string;
  phaseLabelKo?: string;
  peakDensity: number;
  avgDensity: number;
  activeVisitors: number;
  totalQueued: number;
  stageZoneShare: number;
  foodZoneShare: number;
  boothZoneShare: number;
}

export type AgentRole =
  | 'general'
  | 'staff'
  | 'wheelchair_user'
  | 'scooter_user'
  | 'stroller_family'
  | 'visually_impaired'
  | 'pet_owner';

export interface CrowdRoleCounts {
  general: number;
  staff: number;
  mobilityAssisted: number;
  companionPets: number;
}

export interface SimulationSnapshot {
  progress: number; // 0 to 1
  currentTimeLabel: string;
  phase: EventPhaseInfo;
  contingency: ContingencyScenario;
  activeAgentCount: number;
  simulatedScaleFactor: number; // real attendees represented per 3D agent
  peakDensity: number; // persons / m^2
  avgActiveDensity: number; // persons / m^2 in occupied cells
  mostCongestedZone: string;
  mostCongestedFacilityId?: string;
  bottlenecks: BottleneckAlert[];
  facilityOccupancy: Record<string, number>;
  facilityQueues: Record<string, number>;
  gridCols: number;
  gridRows: number;
  densityGrid: Float32Array; // persons / m^2 per cell
  timelineSeries: TimelinePoint[];
  roleCounts?: CrowdRoleCounts;
}

export interface AnalysisScores {
  safety: number;              // 0-100
  accessibility: number;       // 0-100
  crowdFlow: number;           // 0-100
  distributionBalance: number; // 0-100
  operationalEfficiency: number; // 0-100
  budgetEfficiency: number;    // 0-100
  overall: number;             // 0-100 weighted by objective
}

export interface PersonaEvaluation {
  id: VisitorPersonaId;
  labelKo: string;
  labelEn: string;
  score: number; // 0-100
  maxContinuousWalkM: number;
  facilityCoveragePct: number;
  status: 'optimal' | 'needs_attention';
  keyFindingKo: string;
  keyFindingEn: string;
  upgradeActionLabelKo: string;
  upgradeActionLabelEn: string;
  highlightFacilityIds: string[];
}

export interface Recommendation {
  id: string;
  severity: 'high' | 'medium' | 'low';
  category: 'Safety' | 'Congestion' | 'Accessibility' | 'Operations' | 'Budget';
  title: string;
  titleKo?: string;
  rationale: string;
  rationaleKo?: string;
  metricTrigger: string;
  evidenceCitation?: string;
  actionType?:
    | 'optimize_layout'
    | 'add_entrance'
    | 'add_food_booths'
    | 'enable_accessibility'
    | 'add_medical'
    | 'reoptimize_contingency'
    | 'resolve_budget_overrun';
  actionLabel?: string;
  actionLabelKo?: string;
}

export interface SpatialRuleCheckItem {
  id: string;
  status: 'pass' | 'caution' | 'warning';
  titleKo: string;
  titleEn: string;
  detailKo: string;
  detailEn: string;
  citationKo: string;
  citationEn: string;
  affectedFacilityIds: string[];
}

export interface GateFlowAnalysis {
  gateId: string;
  gateNameKo: string;
  gateNameEn: string;
  effectiveWidthM: number;
  isClosedInScenario: boolean;
  designThroughputPerMin: number;
  estimatedPeakDemandPerMin: number;
  loadRatioPct: number;
}

export interface ZoneDifferentiatedAnalysis {
  zoneId: 'plaza_high_density' | 'promenade_corridor' | 'portal_transition';
  zoneNameKo: string;
  zoneNameEn: string;
  modelRepresentationKo: string;
  modelRepresentationEn: string;
  assumedSpeedMps: number;
  peakDensity: number;
  dwellCharacteristicKo: string;
  citation: string;
}

export interface SpatialSafetyAudit {
  verificationStatus: ModelVerificationStatus;
  occupiedAreaSqm: number;
  usableAreaSqm: number;
  referenceDensityPerSqm: number;
  referenceCapacity: number;
  ruleChecks: SpatialRuleCheckItem[];
  gateFlows: GateFlowAnalysis[];
  zoneProfiles: ZoneDifferentiatedAnalysis[];
  stewardPosts: Array<{
    locationKo: string;
    locationEn: string;
    roleKo: string;
    roleEn: string;
    facilityId?: string;
  }>;
  externalTransit: {
    peakOutboundPerHour: number;
    externalCapacityPerHour: number;
    loadRatioPct: number;
    estimatedSpillbackQueue: number;
    status: 'pass' | 'caution' | 'warning';
  };
  scenarioEgressComparisonSec: {
    nominalOpenSec: number;
    currentAssumptionsSec: number;
  };
  calibrationError: {
    enabled: boolean;
    modeledExitFlowPerMin: number;
    observedExitFlowPerMin: number;
    flowMae: number;
    densityAbsDiff: number;
    calibrationFactor: number;
  };
}

export interface LiteratureSourceEntry {
  refNo: string;
  level: 'A' | 'A*' | 'B' | 'C_excluded' | 'D_excluded';
  authorsAndYear: string;
  title: string;
  correctionNoteKo: string;
  appliedModuleKo: string;
}

export interface LayoutMetricsSummary {
  totalFacilities: number;
  totalCapacity: number;
  venueAreaSqm: number;
  occupiedAreaSqm: number;
  usableAreaSqm: number;
  referenceDensityStandard: number;
  referenceCapacity: number;
  peakDensity: number;
  moisSafetyTier: MoisSafetyTier;
  avgWalkingDistanceM: number;
  avgWaitMinutes: number;
  modeledBottlenecks: number;
  facilityUtilizationPct: number;
  estimatedCost: number;
  budgetUsagePct: number;
  scores: AnalysisScores;
}

export interface LayoutComparison {
  originalConfig: EventConfig;
  originalFacilities: Facility[];
  originalMetrics: LayoutMetricsSummary;
  optimizedFacilities: Facility[];
  optimizedMetrics: LayoutMetricsSummary;
  waitTimeDeltaPct: number;
  optimizationNotes: string[];
  optimizationNotesKo: string[];
  improved: boolean;
}

export interface CandidateLayout {
  id: 'A' | 'B' | 'C' | 'D';
  nameKo: string;
  nameEn: string;
  focusKo: string;
  focusEn: string;
  objective: DesignObjective;
  facilities: Facility[];
  configOverride: EventConfig;
  metrics: LayoutMetricsSummary;
  waitTimeDeltaPct: number;
  evaluatedVariations: number;
  highlightsKo: string[];
  highlightsEn: string[];
  reflectedConditionsKo?: string[];
  reflectedConditionsEn?: string[];
}

export interface GhostPreviewState {
  mode: 'element' | 'candidate' | 'ai_diff';
  title: string;
  subtitle?: string;
  facilities: Facility[];
  configOverride?: EventConfig;
  candidateId?: 'A' | 'B' | 'C' | 'D';
  proposalId?: string;
}

export interface PendingAiProposal {
  id: string;
  promptText: string;
  summaryText: string;
  diffTags: string[];
  beforeFacilityCount: number;
  afterFacilityCount: number;
  lockedPreservedCount: number;
  nextConfig: EventConfig;
  nextFacilities: Facility[];
  prevConfig?: EventConfig;
  prevFacilities?: Facility[];
  autoApplied?: boolean;
  status: 'pending' | 'applied' | 'cancelled' | 'undone';
}

export interface RecommendedBoothItem {
  id: string;
  subtype: FacilitySubtype;
  zone: SpatialZoneTarget;
  name: string;
  reason: string;
  estimatedCostUsd: number;
  widthM: number;
  depthM: number;
}

export interface XaiExplanation {
  executiveSummary: string;
  safetyComplianceVerdict: string;
  placementRationales: string[];
  inclusiveDesignHighlights: string[];
  contingencyProtocol: string;
  source: 'gemini' | 'heuristic';
  generatedAt: string;
}

export type SpatialZoneTarget =
  | 'stage_left'
  | 'stage_right'
  | 'stage_front'
  | 'center'
  | 'north'
  | 'south'
  | 'east'
  | 'west'
  | 'northwest'
  | 'northeast'
  | 'southwest'
  | 'southeast'
  | 'entrance'
  | 'perimeter'
  | 'corners';

export interface AiFacilityAction {
  op: 'add' | 'move' | 'remove' | 'scale' | 'replace_count' | 'lock' | 'unlock' | 'rename';
  subtype?: FacilitySubtype;
  category?: FacilityCategory;
  targetKeyword?: string;
  nameKo?: string;
  nameEn?: string;
  newName?: string;
  count?: number;
  zone?: SpatialZoneTarget;
  x?: number;
  z?: number;
  scaleFactor?: number;
  widthM?: number;
  depthM?: number;
}

export type ChatArchitectRole =
  | 'spatial_architect'
  | 'safety_auditor'
  | 'inclusive_specialist';

export type ChatModelTier = 'fast' | 'general';

export interface ArchitectChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  personaRole?: ChatArchitectRole;
  modelUsed?: string;
  appliedTags?: string[];
  followUpSuggestions?: string[];
  proposalId?: string;
}

export interface ParsedBriefResult {
  eventName: string;
  eventType: EventType;
  venueEnvironment?: VenueEnvironmentType;
  floorMode?: VenueFloorMode;
  indoorFloorPreset?: IndoorFloorPresetId;
  outdoorFloorPreset?: OutdoorFloorPresetId;
  floorCustomColor?: string;
  showFloorGrid?: boolean;
  venueWidth: number;
  venueDepth: number;
  expectedAttendance: number;
  budget: number;
  objective: DesignObjective;
  venueShape?: VenueBoundaryShape;
  stagePlacement?: StagePlacementMode;
  venueLayoutModel?: VenueLayoutModel;
  boothModel?: BoothModelStyle;
  seatingBlockCount?: number;
  foodBoothCount: number;
  experienceBoothCount: number;
  entranceCount: number;
  restroomCount?: number;
  medicalCount?: number;
  parkingCount?: number;
  subStageCount?: number;
  customElements?: CustomRequestedFacilitySpec[];
  clearCustomElements?: boolean;
  facilityActions?: AiFacilityAction[];
  contingency?: ContingencyScenario;
  vipZone?: boolean;
  campingArea?: boolean;
  extraMedical?: boolean;
  playRestZone?: boolean;
  stepFreeRoutes?: boolean;
  wideCorridors?: boolean;
  accessibleRestrooms?: boolean;
  accessibleParking?: boolean;
  extractedSummary: string;
}

export interface SavedProjectPayload {
  schemaVersion: '1.1.0' | '1.0.0';
  savedAt: string;
  config: EventConfig;
  facilities: Facility[];
  activeLayoutMode: 'original' | 'optimized';
  contingency?: ContingencyScenario;
  assumptions?: SimulationAssumptions;
  optimizedFacilities: Facility[] | null;
  metricsSummary: LayoutMetricsSummary;
  personas?: PersonaEvaluation[];
}

/**
 * 5-Tier Data Reliability Labels (PDF Reference Guide Section 1-3, p.2)
 */
export type DataReliabilityLabel =
  | 'OFFICIAL'
  | 'OBSERVED'
  | 'ESTIMATED'
  | 'ASSUMPTION'
  | 'MISSING';

/**
 * Non-averaged Overall Design Confidence Verdict (PDF Section 10-3, p.12)
 */
export type DesignConfidenceVerdict =
  | 'high'
  | 'medium'
  | 'low_assumption'
  | 'indeterminate_expert_required';

/**
 * 6 Weather & Environmental Scenarios (PDF Section 9-1, p.11)
 */
export type WeatherScenarioId =
  | 'clear'
  | 'rain'
  | 'strong_wind'
  | 'heatwave'
  | 'cold_wave'
  | 'night_ops';

export type StatutoryReviewStatus =
  | 'not_applicable'
  | 'pending_review'
  | 'in_consultation'
  | 'verified';

export interface KnowledgeFocusContext {
  id: string;
  title: string;
  subtitle?: string;
  candidateId?: 'A' | 'B' | 'C' | 'D';
  highlights: string[];
  formulaNotes?: string[];
  statutoryRefs?: string[];
}

/**
 * Statutory & Ministry Safety Management Checklist (PDF Section 2, p.3)
 */
export interface StatutorySafetyChecklistState {
  usesMountainOrWaterSurface: boolean;
  usesFirePyroOilOrGas: boolean;
  safetyManagementPlanPrepared: boolean;
  localGovFirePoliceConsulted: boolean;
  stage1PlanningChecked: boolean;
  stage2PreEventInspectionDone: boolean;
  stage3LiveOpsManualReady: boolean;
  stage4EgressDispersalPlanReady: boolean;
  stage5IncidentResponseReady: boolean;
  reviewStatuses?: Record<string, StatutoryReviewStatus>;
}

export interface EightDomainVerificationItem {
  domainId:
    | 'space'
    | 'flow'
    | 'accessibility'
    | 'congestion'
    | 'operations'
    | 'safety'
    | 'budget'
    | 'environment';
  domainKo: string;
  domainEn: string;
  coreQuestionKo: string;
  evidenceDataKo: string;
  reliabilityLabel: DataReliabilityLabel;
  status: 'pass' | 'review' | 'hold';
  judgmentKo: string;
  limitNoteKo: string;
}

/**
 * Standardized 3D Asset Metadata Schema (PDF Section 1-2 Layer E & Section 11-1, p.2 & p.13)
 */
export interface FacilityAssetMetadata {
  assetId: string;
  category: FacilityCategory;
  subtype: FacilitySubtype;
  nameKo: string;
  referenceSheetId: string;
  referenceImageUrl: string;
  geometry: {
    lengthM: number;
    widthM: number;
    heightM: number;
    footprintM2: number;
  };
  clearance: {
    frontQueueM: number;
    sideM: number;
    rearM: number;
    serviceVehicleAccess: boolean;
  };
  accessibility: {
    wheelchairAccess: boolean;
    rampRequired: boolean;
    minRouteWidthM: number;
  };
  utilities: {
    electricityKw: number;
    waterRequired: boolean;
    wastewaterRequired: boolean;
    wasteStreams: number;
    soundLevelNoteKo: string;
    networkRequired?: boolean;
    lightingLuxMin?: number;
  };
  operations: {
    openTime: string;
    closeTime: string;
    serviceTimeSec: number;
    parallelServersC: number;
    serviceRatePerMinMu: number;
    arrivalRatePerMinLambda: number;
    staffRequired: number;
    queueAreaM2: number;
    emergencyRoleKo?: string;
  };
  cost: {
    unitCostKrw: number;
    costUnit: string;
    includesSetup: boolean;
    includesStaff: boolean;
    includesPower: boolean;
    priceReliability: DataReliabilityLabel;
  };
  source: {
    label: DataReliabilityLabel;
    referenceTitle: string;
    version?: string;
    checkedDate: string;
    notes: string;
    modelSyncVerified?: boolean;
  };
}


