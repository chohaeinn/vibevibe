const ExtendedFacilityBlueprintSvg: React.FC<{
  subtype: FacilitySubtype;
  width: number;
  depth: number;
  height: number;
  codeLabel: string;
}> = ({ width, depth, height, codeLabel }) => {
  const svgW = 320;
  const svgH = 180;
  const padding = 20;
  const viewW = (svgW - padding * 3) / 2;
  const viewH = (svgH - padding * 3) / 2;

  const maxDim = Math.max(width, depth, height);
  const scale = (Math.min(viewW / maxDim, viewH / maxDim)) * 0.82;

  const drawCADView = (x: number, y: number, w: number, h: number, viewName: string, dimW: number, dimH: number) => {
    const sw = w * scale;
    const sh = h * scale;
    const cx = x + viewW / 2 - sw / 2;
    const cy = y + viewH / 2 - sh / 2;

    return (
      <g>
        {/* Background Grid for the view */}
        <rect x={x} y={y} width={viewW} height={viewH} fill="none" stroke="#f1f5f9" strokeWidth="0.5" />
        
        {/* Main Structural Outline */}
        <rect
          x={cx}
          y={cy}
          width={sw}
          height={sh}
          fill="none"
          stroke="black"
          strokeWidth="1.5"
        />
        
        {/* Interior Technical Detail Lines (Truss/Frame look) */}
        <line x1={cx} y1={cy} x2={cx + sw} y2={cy + sh} stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={cx + sw} y1={cy} x2={cx} y2={cy + sh} stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={cx + sw / 2} y1={cy} x2={cx + sw / 2} y2={cy + sh} stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2 1" />
        <line x1={cx} y1={cy + sh / 2} x2={cx + sw} y2={cy + sh / 2} stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2 1" />

        {/* Horizontal Dimension Line */}
        <g>
          <line x1={cx} y1={cy - 6} x2={cx + sw} y2={cy - 6} stroke="#64748b" strokeWidth="0.8" />
          <line x1={cx} y1={cy - 9} x2={cx} y2={cy - 3} stroke="#64748b" strokeWidth="0.8" />
          <line x1={cx + sw} y1={cy - 9} x2={cx + sw} y2={cy - 3} stroke="#64748b" strokeWidth="0.8" />
          <text x={cx + sw / 2} y={cy - 10} textAnchor="middle" fontSize="7" fontWeight="bold" fill="#475569" fontFamily="monospace">{dimW}m</text>
        </g>

        {/* Vertical Dimension Line */}
        <g>
          <line x1={cx - 6} y1={cy} x2={cx - 6} y2={cy + sh} stroke="#64748b" strokeWidth="0.8" />
          <line x1={cx - 9} y1={cy} x2={cx - 3} y2={cy} stroke="#64748b" strokeWidth="0.8" />
          <line x1={cx - 9} y1={cy + sh} x2={cx - 3} y2={cy + sh} stroke="#64748b" strokeWidth="0.8" />
          <text 
            x={cx - 10} 
            y={cy + sh / 2} 
            textAnchor="middle" 
            fontSize="7" 
            fontWeight="bold" 
            fill="#475569" 
            fontFamily="monospace"
            transform={`rotate(-90, ${cx - 10}, ${cy + sh / 2})`}
          >
            {dimH}m
          </text>
        </g>
        
        {/* View Label */}
        <text x={x + 4} y={y + 10} fontSize="8" fontWeight="900" fill="#94a3b8" letterSpacing="0.1em">{viewName}</text>
      </g>
    );
  };

  return (
    <div className="w-full h-44 bg-white border-b border-slate-200 overflow-hidden shrink-0 flex items-center justify-center select-none p-1">
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full bg-white shadow-inner">
        <defs>
          <pattern id="cadGridSmall" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 8 0 L 0 0 0 8" fill="none" stroke="#f8fafc" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={svgW} height={svgH} fill="url(#cadGridSmall)" />
        <rect width={svgW} height={svgH} fill="none" stroke="#e2e8f0" strokeWidth="1" />
        
        {/* TOP VIEW (Top-Left) */}
        {drawCADView(padding, padding, width, depth, 'TOP VIEW', width, depth)}
        
        {/* FRONT VIEW (Top-Right) */}
        {drawCADView(padding * 2 + viewW, padding, width, height, 'FRONT VIEW', width, height)}
        
        {/* SIDE VIEW (Bottom-Left) */}
        {drawCADView(padding, padding * 2 + viewH, depth, height, 'SIDE VIEW', depth, height)}
        
        {/* Professional Engineering Stamp (Bottom-Right) */}
        <g transform={`translate(${padding * 2 + viewW}, ${padding * 2 + viewH})`}>
          <rect width={viewW} height={viewH} fill="white" stroke="#334155" strokeWidth="1.2" />
          <line x1="0" y1={viewH * 0.4} x2={viewW} y2={viewH * 0.4} stroke="#e2e8f0" strokeWidth="0.8" />
          
          <text x={viewW / 2} y={12} textAnchor="middle" fontSize="6" fontWeight="bold" fill="#64748b">PROJECT TITLE / DRAWING NO.</text>
          <text x={viewW / 2} y={24} textAnchor="middle" fontSize="10" fontWeight="900" fill="#1e293b">{codeLabel}</text>
          
          <text x={6} y={viewH - 18} fontSize="5" fill="#94a3b8">SCALE: 1:1 SYNC</text>
          <text x={6} y={viewH - 12} fontSize="5" fill="#94a3b8">VER: 2026.11.05</text>
          <text x={6} y={viewH - 6} fontSize="5" fill="#94a3b8">AUTH: EVENT ON AI</text>
          
          <g transform={`translate(${viewW - 25}, ${viewH - 25})`}>
             <circle cx="10" cy="10" r="10" fill="none" stroke="#315be8" strokeWidth="0.5" strokeDasharray="1 1" />
             <text x="10" y="13" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#315be8">ON</text>
          </g>
        </g>

        {/* Crosshair separators */}
        <line x1={padding * 1.5 + viewW} y1={padding} x2={padding * 1.5 + viewW} y2={svgH - padding} stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="4 4" />
        <line x1={padding} y1={padding * 1.5 + viewH} x2={svgW - padding} y2={padding * 1.5 + viewH} stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="4 4" />
      </svg>
    </div>
  );
};

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({
  language,
  config,
  facilities,
  snapshot,
  summary,
  safetyAudit,
  calibration,
  checklist,
  onChangeChecklist,
  weatherScenario,
  onChangeWeatherScenario,
  onSpawnReferenceFacility,
  onPreviewReferenceFacility,
  focusedContext,
  onClearFocusedContext,
  onResolveBudgetOverrun,
  onRaiseBudgetToCost,
  candidates = [],
  onApplyCandidate,
  onBackToWorkspace,
}) => {
  const [activeTab, setActiveTab] = useState<'assets' | 'statutory' | 'ops_weather' | 'rag_schema'>(
    focusedContext ? 'statutory' : 'assets',
  );
  const [selectedCatFilter, setSelectedCatFilter] = useState<string>('all');
  const [selectedSampleFacilityId, setSelectedSampleFacilityId] = useState<string>(
    facilities[0]?.id || '',
  );

  useEffect(() => {
    if (focusedContext) {
      setActiveTab('statutory');
    }
  }, [focusedContext]);

  const ui = tUi(language);
  const isKo = language === 'ko';

  const domainEval = useMemo(
    () =>
      evaluateStatutoryAndEightDomains(
        config,
        facilities,
        snapshot,
        summary,
        safetyAudit,
        checklist,
        calibration,
        weatherScenario,
        language,
      ),
    [
      config,
      facilities,
      snapshot,
      summary,
      safetyAudit,
      checklist,
      calibration,
      weatherScenario,
      language,
    ],
  );

  const densityFormula = useMemo(
    () => computePeakDensityFormulaBreakdown(config, facilities, snapshot, summary),
    [config, facilities, snapshot, summary],
  );

  const bfAudit = useMemo(
    () => computeQuantitativeBarrierFreeAudit(config, facilities),
    [config, facilities],
  );

  const crowdRecord11_2 = useMemo(
    () => computeCrowdRecord11_2(config, snapshot, calibration, language),
    [config, snapshot, calibration, language],
  );

  const sampleFacility = useMemo(
    () => facilities.find((f) => f.id === selectedSampleFacilityId) || facilities[0] || null,
    [facilities, selectedSampleFacilityId],
  );

  const sampleAssetJson = useMemo(
    () =>
      sampleFacility ? getFacilityAssetMetadata(sampleFacility, config, snapshot, language) : null,
    [sampleFacility, config, snapshot, language],
  );

  const budgetCandidateD = useMemo(
    () => candidates.find((c) => c.id === 'D') || candidates[candidates.length - 1] || null,
    [candidates],
  );

  const isBudgetExceeded = summary.estimatedCost > config.budget;

  const handleDownloadCsv = (csvType: StandardCsvType) => {
    const content = generateRecommendedCsvContent(
      csvType,
      config,
      facilities,
      snapshot,
      summary,
      safetyAudit,
      checklist,
      calibration,
    );
    const bomContent = `\uFEFF${content}`;
    const blob = new Blob([bomContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.eventName.replace(/\s+/g, '_')}_${csvType}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const verdictBadgeClass =
    domainEval.verdict === 'high'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
      : domainEval.verdict === 'medium'
        ? 'bg-blue-50 border-blue-200 text-blue-900'
        : domainEval.verdict === 'low_assumption'
          ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-rose-50 border-rose-200 text-rose-900';

  const getReviewStatus = (
    key: keyof Omit<StatutorySafetyChecklistState, 'reviewStatuses'>,
  ): StatutoryReviewStatus => {
    const explicit = checklist.reviewStatuses?.[key];
    if (explicit) return explicit;
    return checklist[key] ? 'verified' : 'pending_review';
  };

  const handleChangeReviewStatus = (
    key: keyof Omit<StatutorySafetyChecklistState, 'reviewStatuses'>,
    status: StatutoryReviewStatus,
  ) => {
    const boolVal = status === 'verified' || status === 'not_applicable';
    onChangeChecklist({
      ...checklist,
      [key]: boolVal,
      reviewStatuses: {
        ...(checklist.reviewStatuses || {}),
        [key]: status,
      },
    });
  };

  const filteredExtendedCategories =
    selectedCatFilter === 'all'
      ? EXTENDED_CATALOG_CATEGORIES
      : EXTENDED_CATALOG_CATEGORIES.filter((c) => c.id === selectedCatFilter);

  const statutoryChecklistRows: Array<{
    key: keyof Omit<StatutorySafetyChecklistState, 'reviewStatuses'>;
    labelKo: string;
    labelEn: string;
    autoConditionKo: string;
    evidenceDocKo: string;
  }> = [
    {
      key: 'safetyManagementPlanPrepared',
      labelKo: '지역축제 안전관리계획서 수립 및 비상연락망 조직도 편성',
      labelEn: 'Statutory Safety Management Plan & Emergency Command Org Chart',
      autoConditionKo:
        config.expectedAttendance >= 1000
          ? `자동판별: 순간 최대 ${config.expectedAttendance.toLocaleString()}명 (≥1,000명 법정 의무 대상)`
          : `자동판별: 순간 최대 ${config.expectedAttendance.toLocaleString()}명 (권고 적용)`,
      evidenceDocKo: '안전관리계획서 본문, 안전관리요원 배치도, 비상연락망 표',
    },
    {
      key: 'localGovFirePoliceConsulted',
      labelKo: '관할 지자체·소방서·경찰서·의료기관 사전 안전협의 및 심의',
      labelEn: 'Local Gov, Fire, Police & EMS Pre-Event Safety Consultation',
      autoConditionKo: domainEval.requiresStatutorySafetyPlan
        ? '자동판별: 재난안전법 시행령 제73조의9 사전협의 대상'
        : '자동판별: 자율 사전 안전협의 권장',
      evidenceDocKo: '안전정책실무조정위원회 심의 의견서, 소방·구급차 진입로 협의록',
    },
    {
      key: 'usesFirePyroOilOrGas',
      labelKo: '발전기(석유류)·푸드트럭 조리가스·특수효과 화기 사용 안전조치',
      labelEn: 'Generator Fuel, Food-Truck Gas & Pyro Fire Safety Isolation',
      autoConditionKo: `자동판별: 전력 ${domainEval.utilitiesSummary.peakPowerWithMarginKw}kW (발전기 ${domainEval.utilitiesSummary.recommendedGeneratorUnits}기) · 식음시설 배치됨`,
      evidenceDocKo: '가스안전공사·전기안전공사 점검필증, 소화기·방화펜스 배치 사진',
    },
    {
      key: 'stage1PlanningChecked',
      labelKo: '행안부 매뉴얼 1단계(기획): 순수 가용면적 기반 적정 수용인원 검증',
      labelEn: 'MoIS Stage 1 (Planning): Net Walkable Area Capacity Verification',
      autoConditionKo: `자동판별: 순수 가용면적 ${summary.usableAreaSqm.toLocaleString()}m² / 참고 수용량 ${summary.referenceCapacity.toLocaleString()}명`,
      evidenceDocKo: '부지 실측 도면, 시설 점유 제외 순수 보행면적 산출표',
    },
    {
      key: 'stage2PreEventInspectionDone',
      labelKo: '행안부 매뉴얼 2단계(개최 전): 무대 트러스·전기·경사로 합동 현장점검',
      labelEn: 'MoIS Stage 2 (Pre-Event): Joint Structural, Electrical & Ramp Inspection',
      autoConditionKo: '자동판별: 개장 D-1 유관기관 합동점검 필수',
      evidenceDocKo: '개최 전 합동 안전점검 결과표 및 시정조치 완료 보고서',
    },
    {
      key: 'stage3LiveOpsManualReady',
      labelKo: '행안부 매뉴얼 3단계(운영 중): 병목 구역 안전요원 배치·밀집도 상시 관제',
      labelEn: 'MoIS Stage 3 (Live Ops): Bottleneck Steward Posts & Density Monitoring',
      autoConditionKo: `자동판별: 피크 밀도 ${snapshot.peakDensity.toFixed(2)}명/m² · 운영인력 약 ${domainEval.utilitiesSummary.totalStaffRequired}명`,
      evidenceDocKo: '구간별 안전요원 근무편성표, 일방통행 유도선 운영 매뉴얼',
    },
    {
      key: 'stage4EgressDispersalPlanReady',
      labelKo: '행안부 매뉴얼 4단계(종료 시): 시차 분산 퇴장 및 관람객 완전 퇴장 후 철거',
      labelEn: 'MoIS Stage 4 (Egress): Staggered Exit & Post-Clearance Teardown',
      autoConditionKo: `자동판별: 출입구 ${config.entranceCount}곳 · 외부 수송 연계 확인 필요`,
      evidenceDocKo: '종료 안내방송 시나리오, 출구 개방 전환 및 철거차량 통제 계획',
    },
    {
      key: 'stage5IncidentResponseReady',
      labelKo: '행안부 매뉴얼 5단계(사고 대응): 공연 즉시 중단 권한 및 구급차 전용차로',
      labelEn: 'MoIS Stage 5 (Incident): Show-Stop Protocol & Dedicated Ambulance Lane',
      autoConditionKo: '자동판별: 전 행사 필수 비상 프로토콜',
      evidenceDocKo: '비상 공연중단 지휘체계표, 응급의료소~외부도로 이송 동선도',
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-[1320px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
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
                '표준 요소 DB · 법령·산출 근거 검증 스튜디오',
                'Standard Element DB & Statutory Verification Studio',
                '標準要素DB・法令・算出根拠検証スタジオ',
                '标准要素数据库与法规·测算依据验证工作室',
                'BD de elementos estándar y verificación legal',
                'Base d’éléments standards et vérification réglementaire',
              )}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              {tr6(
                language,
                '42종 표준 시설 규격(3D 모델 1:1 일치 · 출처/버전 관리)과 후보안별 세부 산출식·법령 이행상태·악천후·D-30~D+3 공정을 통합 관리합니다.',
                'Unifies 42 1:1-synced 3D standard elements, explicit calculation formulas, statutory status tracking, weather matrix, and D-30 to D+3 schedule.',
                '42種の標準施設規格（3Dモデル1:1同期・出典バージョン管理）と算出式・法令履行状況・悪天候・D-30〜D+3工程を統合管理します。',
                '统一管理42种1:1同步3D标准设施规格、候选方案详细计算公式、法规履行状态、恶劣天气矩阵及D-30~D+3全周期工序。',
                'Integra 42 elementos 3D sincronizados 1:1, fórmulas explícitas, estado legal, clima adverso y cronograma D-30 a D+3.',
                'Réunit 42 éléments 3D synchronisés 1:1, formules explicites, suivi légal, météo défavorable et planning J-30 à J+3.',
              )}
            </p>
          </div>

          <a
            href="/assets/aistudio/AI_event_venue_design_reference_guide_d59b1ce2.pdf"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:border-blue-500 text-xs font-semibold text-slate-800 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
            <span>
              {tr6(
                language,
                '원본 설계 기준 가이드 PDF',
                'Reference Guide PDF',
                '設計基準ガイドPDF',
                '原始设计指南 PDF',
                'Guía de referencia PDF',
                'Guide de référence PDF',
              )}
            </span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        </div>

        {/* TOP-PINNED CONTEXTUAL CALCULATION & STATUTORY GROUNDS PANEL (Triggered from ComparisonView / RightSidebar) */}
        {focusedContext && (
          <section className="bg-blue-50/90 border border-blue-300 rounded-xl p-4 space-y-3 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-800 bg-white px-2.5 py-0.5 rounded border border-blue-200 mb-1">
                  <Calculator className="w-3.5 h-3.5 text-blue-600" />
                  <span>
                    {tr6(
                      language,
                      '선택 항목 맞춤 산출 근거 및 적용 법령 (상단 고정됨)',
                      'Pinned Calculation Formulas & Applicable Legal Basis',
                      '選択項目の算出根拠および適用法令（上部固定）',
                      '所选项专属测算依据与适用法规（顶部固定）',
                      'Base de cálculo y normativa aplicable (fijado arriba)',
                      'Base de calcul et normes applicables (épinglé en haut)',
                    )}
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-900">{focusedContext.title}</h2>
                {focusedContext.subtitle && (
                  <p className="text-xs font-mono text-blue-900 mt-0.5 tabular-nums">
                    {focusedContext.subtitle}
                  </p>
                )}
              </div>

              {onClearFocusedContext && (
                <button
                  type="button"
                  onClick={onClearFocusedContext}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-blue-200 text-xs font-semibold text-slate-700 cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{tr6(language, '고정 해제', 'Dismiss', '閉じる', '关闭固定', 'Cerrar', 'Fermer')}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs">
              {focusedContext.formulaNotes && focusedContext.formulaNotes.length > 0 && (
                <div className="p-3 rounded-lg bg-white border border-blue-200 space-y-1.5">
                  <div className="font-bold text-slate-900">
                    {tr6(language, '1. 세부 수치 산출 공식', '1. Explicit Calculation Formulas', '1. 数値算出式', '1. 详细数值计算公式', '1. Fórmulas de cálculo', '1. Formules de calcul')}
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-700 font-mono text-[11px] leading-relaxed tabular-nums">
                    {focusedContext.formulaNotes.map((fn, i) => (
                      <li key={i}>{fn}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="p-3 rounded-lg bg-white border border-blue-200 space-y-1.5">
                <div className="font-bold text-slate-900">
                  {tr6(language, '2. 반영된 핵심 공간 설계 근거', '2. Applied Spatial Design Grounds', '2. 空間設計の根拠', '2. 空间设计核心依据', '2. Fundamentos espaciales', '2. Fondements spatiaux')}
                </div>
                <ul className="list-disc pl-4 space-y-1 text-slate-700 leading-relaxed">
                  {focusedContext.highlights.map((hl, i) => (
                    <li key={i}>{hl}</li>
                  ))}
                </ul>
              </div>

              {focusedContext.statutoryRefs && focusedContext.statutoryRefs.length > 0 && (
                <div className="p-3 rounded-lg bg-white border border-blue-200 space-y-1.5">
                  <div className="font-bold text-slate-900">
                    {tr6(language, '3. 직접 연결된 법령·매뉴얼 조항', '3. Linked Statutory Clauses', '3. 関連法令・マニュアル条項', '3. 关联法规与手册条款', '3. Normativa vinculada', '3. Textes réglementaires liés')}
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-blue-900 font-medium leading-relaxed">
                    {focusedContext.statutoryRefs.map((sr, i) => (
                      <li key={i}>{sr}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Non-Averaged Overall Confidence Verdict Banner */}
        <div
          className={`p-4 rounded-xl border ${verdictBadgeClass} flex flex-wrap items-start justify-between gap-4`}
        >
          <div className="space-y-1 max-w-4xl">
            <div className="text-sm font-bold">{domainEval.verdictTitleKo}</div>
            <p className="text-xs opacity-90 leading-relaxed">{domainEval.verdictReasonKo}</p>
          </div>
          <div className="flex items-center gap-4 shrink-0 font-mono text-xs tabular-nums">
            <span className="font-semibold">
              {tr6(
                language,
                `총 전력 ${domainEval.utilitiesSummary.peakPowerWithMarginKw}kW (발전기 ${domainEval.utilitiesSummary.recommendedGeneratorUnits}기)`,
                `Peak Power ${domainEval.utilitiesSummary.peakPowerWithMarginKw}kW (${domainEval.utilitiesSummary.recommendedGeneratorUnits} gen)`,
                `総電力 ${domainEval.utilitiesSummary.peakPowerWithMarginKw}kW`,
                `总电力 ${domainEval.utilitiesSummary.peakPowerWithMarginKw}kW`,
                `Potencia ${domainEval.utilitiesSummary.peakPowerWithMarginKw}kW`,
                `Puissance ${domainEval.utilitiesSummary.peakPowerWithMarginKw}kW`,
              )}
            </span>
            <span aria-hidden="true" className="opacity-40">
              ·
            </span>
            <span className="font-semibold">
              {tr6(
                language,
                `운영인력 약 ${domainEval.utilitiesSummary.totalStaffRequired}명`,
                `~${domainEval.utilitiesSummary.totalStaffRequired} Staff`,
                `運営人員 約${domainEval.utilitiesSummary.totalStaffRequired}名`,
                `运营人力 约${domainEval.utilitiesSummary.totalStaffRequired}人`,
                `~${domainEval.utilitiesSummary.totalStaffRequired} personal`,
                `~${domainEval.utilitiesSummary.totalStaffRequired} agents`,
              )}
            </span>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('assets')}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'assets'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>
              {tr6(
                language,
                '확장 표준 시설 카탈로그 (6대 신규 카테고리 · 42종 규격)',
                'Expanded Standard Catalog (6 New Categories · 42 Specs)',
                '拡張標準施設カタログ（6新規カテゴリ・42種規格）',
                '扩展标准设施目录（6大新增类别·42种规格）',
                'Catálogo estándar ampliado (6 categorías · 42 tipos)',
                'Catalogue standard étendu (6 catégories · 42 types)',
              )}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('statutory')}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'statutory'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>
              {tr6(
                language,
                '산출 공식 · 법령 이행검증 · 정량 무장애 · 예산 대안',
                'Formulas, Statutory Status, Barrier-Free & Budget Remedies',
                '算出式・法令履行・定量バリアフリー・予算代替案',
                '计算公式·法规核验·定量无障碍·预算替代方案',
                'Fórmulas, estado legal, accesibilidad y presupuesto',
                'Formules, statut légal, accessibilité PMR et budget',
              )}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ops_weather')}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'ops_weather'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <CloudRain className="w-3.5 h-3.5" />
            <span>
              {tr6(
                language,
                '평시·악천후 6종 대응 · 디데이 12단계 공정 (D-30~D+3)',
                'Clear vs. Severe Weather & 12-Stage D-Day Schedule (D-30~D+3)',
                '平常・悪天候6種対応・D-Day 12段階工程（D-30〜D+3）',
                '平时与6类恶劣天气应对 · D-Day 12阶段工序（D-30~D+3）',
                'Clima normal/adverso y cronograma 12 etapas (D-30~D+3)',
                'Météo normale/extrême et planning 12 étapes (J-30~J+3)',
              )}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rag_schema')}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'rag_schema'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>
              {tr6(
                language,
                '5계층 RAG · 표준 JSON/8종 CSV · 공공데이터',
                '5-Layer RAG, Standard JSON & 8 CSV Exports',
                '5階層RAG・標準JSON/8種CSV・公共データ',
                '5层RAG·标准JSON/8种CSV·公共数据门户',
                'RAG 5 capas, JSON estándar y 8 CSV',
                'RAG 5 couches, JSON standard et 8 CSV',
              )}
            </span>
          </button>
        </div>

        {/* TAB 1: 6 NEW FACILITY CATEGORIES (18 ITEMS) + 6 DB IMPROVEMENT PILLARS + 11 CAD SHEETS */}
        {activeTab === 'assets' && (
          <div className="space-y-6">


            {/* 1A. 6 Extended Facility Categories (Barrier-Free, Rest, Safety, Traffic, Culture, Ops) */}
            <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    {tr6(
                      language,
                      '6대 확장 표준 시설 카테고리 (무장애 · 휴식 · 안전 · 교통 · 문화 · 운영 — 3D 모델·DB 규격 1:1 동기화)',
                      '6 Expanded Standard Categories (Barrier-Free, Rest, Safety, Traffic, Culture, Ops — 1:1 DB-3D Sync)',
                      '6大拡張標準施設カテゴリ（バリアフリー・休憩・安全・交通・文化・運営 — 3D・DB 1:1同期）',
                      '6大扩展标准设施类别（无障碍·休息·安全·交通·文化·运营 — 3D模型与数据库1:1同步）',
                      '6 categorías estándar ampliadas (sincronización 1:1 modelo 3D y BD)',
                      '6 catégories standards étendues (synchronisation 1:1 modèle 3D et BD)',
                    )}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {tr6(
                      language,
                      '단일 규격 원본(SUBTYPE_BLUEPRINTS v2026.2)에서 3D 메쉬 치수·단가·전력·통신·조도·출처를 동시에 생성하여 화면 크기와 DB 치수 불일치를 원천 차단합니다.',
                      'Driven by a single SUBTYPE_BLUEPRINTS v2026.2 registry so 3D geometry, cost, utilities, source, and version never diverge.',
                      '単一規格原票（SUBTYPE_BLUEPRINTS v2026.2）から3D形状・単価・電力・通信・照度・出典を一括生成し不一致を防ぎます。',
                      '由单一规格源（SUBTYPE_BLUEPRINTS v2026.2）统一驱动3D网格尺寸、造价、水电网照度与出处版本，杜绝模型与数据不一致。',
                      'Impulsado por SUBTYPE_BLUEPRINTS v2026.2 para garantizar coincidencia exacta entre 3D y BD.',
                      'Piloté par SUBTYPE_BLUEPRINTS v2026.2 pour garantir l’exactitude 1:1 entre 3D et BD.',
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedCatFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                      selectedCatFilter === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tr6(language, '전체 (6대 분류·17종)', 'All (17)', 'すべて', '全部', 'Todos', 'Tous')}
                  </button>
                  {EXTENDED_CATALOG_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCatFilter(cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                        selectedCatFilter === cat.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {isKo ? cat.titleKo : cat.titleEn}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {filteredExtendedCategories.map((cat) => (
                  <div key={cat.id} className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                          {isKo ? cat.titleKo : cat.titleEn}
                        </span>
                        <span className="text-xs text-slate-600">{cat.summaryKo}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {cat.items.map((item) => {
                        const bp = SUBTYPE_BLUEPRINTS[item.subtype];
                        const inSceneCount = facilities.filter(
                          (f) => f.subtype === item.subtype,
                        ).length;
                        const itemLabel =
                          SUBTYPE_SIMPLE_LABELS[item.subtype]?.[language] || item.subtype;

                        return (
                          <div
                            key={`${cat.id}-${item.subtype}`}
                            className="rounded-xl border border-slate-200 bg-slate-50/70 overflow-hidden flex flex-col justify-between"
                          >
                            <ExtendedFacilityBlueprintSvg
                              subtype={item.subtype}
                              width={bp.width}
                              depth={bp.depth}
                              height={bp.height}
                              codeLabel={itemLabel}
                            />

                            <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                              <div className="space-y-1.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="text-xs font-bold text-slate-900">
                                      {itemLabel}
                                    </div>
                                    <div className="text-[10px] font-mono text-emerald-700 font-semibold mt-0.5 tabular-nums">
                                      {bp.width}×{bp.depth}×{bp.height}m · 1:1 3D일치 ·{' '}
                                      {bp.version || 'v2026.2'}
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700 shrink-0 tabular-nums">
                                    {tr6(
                                      language,
                                      `현장 ${inSceneCount}개`,
                                      `${inSceneCount} placed`,
                                      `配置 ${inSceneCount}`,
                                      `已设 ${inSceneCount}`,
                                      `${inSceneCount} en plano`,
                                      `${inSceneCount} posés`,
                                    )}
                                  </span>
                                </div>

                                <p className="text-[11px] text-slate-700 leading-relaxed">
                                  {isKo ? item.roleKo : item.roleEn}
                                </p>

                                {/* Expanded Operational Conditions (Power, Water, Network, Lux, Staff, Cost) */}
                                <div className="grid grid-cols-2 gap-1 pt-1 text-[10px] font-mono text-slate-600 tabular-nums">
                                  <div className="bg-white px-2 py-1 rounded border border-slate-200">
                                    ⚡ {item.powerKw}kW · {item.waterRequired ? '급배수' : '무급수'} ·{' '}
                                    {item.networkRequired ? '통신망' : '단독'}
                                  </div>
                                  <div className="bg-white px-2 py-1 rounded border border-slate-200">
                                    💡 ≥{item.lightingLuxMin}lux · 👤 {item.staffRequired}명 ·{' '}
                                    {formatCurrency(bp.cost, language)}
                                  </div>
                                </div>

                                <div className="text-[10px] text-slate-500 leading-snug">
                                  <span className="font-semibold text-slate-700">근거/출처: </span>
                                  {bp.sourceStd || item.legalBasisKo}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-1.5 pt-1">
                                {onPreviewReferenceFacility && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onPreviewReferenceFacility(
                                        item.subtype,
                                        item.defaultZone,
                                        itemLabel,
                                      )
                                    }
                                    className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border border-slate-300 bg-white hover:border-blue-500 hover:text-blue-700 text-[11px] font-semibold text-slate-700 cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3 text-blue-600" />
                                    <span>
                                      {tr6(language, '새 도안 3D 보기', '3D Preview', '3D確認', '3D预览', 'Vista 3D', 'Aperçu 3D')}
                                    </span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSpawnReferenceFacility(
                                      item.subtype,
                                      item.defaultZone,
                                      itemLabel,
                                    )
                                  }
                                  className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>
                                    {tr6(language, '현장 즉시 배치', 'Place Now', '即時配置', '立即放置', 'Colocar', 'Placer')}
                                  </span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 1B. Standard DB 6 Structural Limitations -> Architectural Solutions Table */}
            <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {tr6(
                    language,
                    '표준 요소 DB 6대 구조적 한계 분석 및 엔진 개선 적용 명세',
                    '6 Structural DB Limitations & Applied Engine Architecture Upgrades',
                    '標準要素DBの6大構造課題とエンジン改善適用明細',
                    '标准要素数据库6大结构局限分析与引擎升级明细',
                    '6 mejoras estructurales aplicadas a la base de datos estándar',
                    '6 améliorations structurelles appliquées à la base standard',
                  )}
                </h2>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">기존 문제점</th>
                      <th className="py-2.5 px-3 font-semibold">발생 이유</th>
                      <th className="py-2.5 px-3 font-semibold">INCLUSE 적용 개선 아키텍처</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {DB_SIX_IMPROVEMENT_PILLARS.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                          {row.problemKo}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{row.reasonKo}</td>
                        <td className="py-2.5 px-3 font-medium text-blue-800">{row.solutionKo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: EXPLICIT FORMULAS, STATUTORY STATUS DROPDOWNS, QUANTITATIVE BARRIER-FREE & BUDGET REMEDIES */}
        {activeTab === 'statutory' && (
          <div className="space-y-6">
            {/* 2A. Explicit Peak Congestion Density (e.g. 3.64 p/m²) & Walkable Area Formula Breakdown */}
            <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-bold text-slate-900">
                    {tr6(
                      language,
                      `핵심 수치 산정 조건 및 공식 명세 (현재 국소 피크 혼잡도 ${densityFormula.peakDensityValue.toFixed(2)}명/㎡ 산출 근거)`,
                      `Explicit Metric Calculation Conditions & Formulas (Peak Density ${densityFormula.peakDensityValue.toFixed(2)} p/m²)`,
                      `主要数値の算出条件および計算式明細（現在ピーク密度 ${densityFormula.peakDensityValue.toFixed(2)}人/㎡）`,
                      `核心数值测算条件与公式明细（当前局部峰值密度 ${densityFormula.peakDensityValue.toFixed(2)}人/㎡）`,
                      `Condiciones y fórmulas explícitas de cálculo (${densityFormula.peakDensityValue.toFixed(2)} p/m²)`,
                      `Conditions et formules explicites de calcul (${densityFormula.peakDensityValue.toFixed(2)} pers./m²)`,
                    )}
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded tabular-nums">
                  기준시각 {densityFormula.timeLabel} ({densityFormula.phaseLabelKo})
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="font-sans text-[11px] text-slate-500">1. 순수 보행 가용면적</div>
                  <div className="text-sm font-bold text-slate-900">
                    {densityFormula.usableAreaSqm.toLocaleString()} m²
                  </div>
                  <div className="font-sans text-[10px] text-slate-600">
                    총 부지 {densityFormula.grossAreaSqm.toLocaleString()}m² − 시설·대기 점유{' '}
                    {densityFormula.occupiedAreaSqm.toLocaleString()}m² ({densityFormula.facilityCount}개)
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="font-sans text-[11px] text-slate-500">2. 동시 재실 및 대기열 인원</div>
                  <div className="text-sm font-bold text-slate-900">
                    재실 {densityFormula.simultaneousPax.toLocaleString()}명 (대기{' '}
                    {densityFormula.queueTotalPax.toLocaleString()}명)
                  </div>
                  <div className="font-sans text-[10px] text-slate-600">
                    피크 목표 {densityFormula.targetPeakPax.toLocaleString()}명 · 전체 평균밀도{' '}
                    {densityFormula.avgNetDensity}명/m²
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 space-y-1">
                  <div className="font-sans text-[11px] text-blue-800 font-semibold">
                    3. 국소 피크 혼잡도 (최대 셀)
                  </div>
                  <div className="text-sm font-bold text-blue-900">
                    {densityFormula.peakDensityValue.toFixed(2)} 명/m²
                  </div>
                  <div className="font-sans text-[10px] text-blue-800">
                    {densityFormula.gridResolutionDesc} 내 약 {densityFormula.estimatedHotspotPax}명 집중
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="font-sans text-[11px] text-slate-500">4. 최우선 집중 관리 지점</div>
                  <div className="font-sans text-xs font-bold text-slate-900 truncate">
                    {densityFormula.hotspotFacilityName}
                  </div>
                  <div className="font-sans text-[10px] text-slate-600">
                    전체 평균({densityFormula.avgNetDensity}명/m²)으로 가리지 않고 국소 피크로 판정
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 text-slate-100 text-[11px] font-mono space-y-1 leading-relaxed">
                <div>산출 공식: {densityFormula.formulaText}</div>
                <div className="text-slate-300 font-sans">{densityFormula.sourceText}</div>
              </div>
            </section>

            {/* 2B. Budget Overrun Concrete Alternative Remedies (Relocated from ComparisonView & Linked to Actions) */}
            <section
              className={`rounded-xl border p-4 space-y-3 ${
                isBudgetExceeded
                  ? 'bg-amber-50/90 border-amber-300'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    {isBudgetExceeded ? (
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    <span>
                      {isBudgetExceeded
                        ? tr6(
                            language,
                            `예산 초과 감지: 예상 설치비(${formatCurrency(summary.estimatedCost, language)})가 가용 예산(${formatCurrency(config.budget, language)})을 ${formatCurrency(summary.estimatedCost - config.budget, language)} 초과`,
                            `Budget Overrun: Cost (${formatCurrency(summary.estimatedCost, language)}) exceeds Budget (${formatCurrency(config.budget, language)})`,
                            `予算超過：設置費（${formatCurrency(summary.estimatedCost, language)}）が予算を超過`,
                            `预算超支：预计安装费（${formatCurrency(summary.estimatedCost, language)}）超出可用预算`,
                            `Presupuesto excedido: costo (${formatCurrency(summary.estimatedCost, language)}) supera el límite`,
                            `Dépassement budgétaire : coût (${formatCurrency(summary.estimatedCost, language)}) supérieur au budget`,
                          )
                        : tr6(
                            language,
                            `예산 적정성 검증 통과: 예상 설치비 ${formatCurrency(summary.estimatedCost, language)} / 가용 예산 ${formatCurrency(config.budget, language)} (${summary.budgetUsagePct}%)`,
                            `Within Budget: ${formatCurrency(summary.estimatedCost, language)} of ${formatCurrency(config.budget, language)} (${summary.budgetUsagePct}%)`,
                            `予算内適合：設置費 ${formatCurrency(summary.estimatedCost, language)}（${summary.budgetUsagePct}%）`,
                            `符合预算：预计安装费 ${formatCurrency(summary.estimatedCost, language)}（${summary.budgetUsagePct}%）`,
                            `Dentro del presupuesto: ${formatCurrency(summary.estimatedCost, language)} (${summary.budgetUsagePct}%)`,
                            `Conforme au budget : ${formatCurrency(summary.estimatedCost, language)} (${summary.budgetUsagePct}%)`,
                          )}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {tr6(
                      language,
                      '고정(잠금) 부스와 필수 무장애·응급·화장실 설비는 유지한 채 선택 부스 규격·외관을 조정하거나 실속형 대안 도안으로 즉시 전환할 수 있습니다.',
                      'Preserves locked booths and mandatory safety/accessible facilities while fitting optional booths within budget or switching to economy Layout D.',
                      '固定ブースと必須安全・バリアフリー設備を維持したまま予算内自動調整または堅実型候補案Dへ切り替えられます。',
                      '保留锁定展位及必备安全无障碍设施，可一键缩减可选展位至预算内或切换至经济型方案D。',
                      'Conserva stands bloqueados e instalaciones esenciales ajustando el resto al presupuesto.',
                      'Conserve les stands verrouillés et équipements essentiels tout en ajustant le plan au budget.',
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {onResolveBudgetOverrun && (
                    <button
                      type="button"
                      onClick={() => {
                        onResolveBudgetOverrun();
                        onBackToWorkspace();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                    >
                      {tr6(
                        language,
                        '예산 한도 내 자동 맞춤 배치',
                        'Auto-Fit Layout to Budget',
                        '予算内に自動調整配置',
                        '自动调整至预算限额内',
                        'Ajustar diseño al presupuesto',
                        'Ajuster automatiquement au budget',
                      )}
                    </button>
                  )}
                  {budgetCandidateD && onApplyCandidate && (
                    <button
                      type="button"
                      onClick={() => onApplyCandidate(budgetCandidateD)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer tabular-nums"
                    >
                      {tr6(
                        language,
                        `실속형 Layout D 적용 (${formatCurrency(budgetCandidateD.metrics.estimatedCost, language)})`,
                        `Apply Economy Layout D (${formatCurrency(budgetCandidateD.metrics.estimatedCost, language)})`,
                        `堅実型 Layout D 適用 (${formatCurrency(budgetCandidateD.metrics.estimatedCost, language)})`,
                        `应用经济型 Layout D (${formatCurrency(budgetCandidateD.metrics.estimatedCost, language)})`,
                        `Aplicar Layout D (${formatCurrency(budgetCandidateD.metrics.estimatedCost, language)})`,
                        `Appliquer Layout D (${formatCurrency(budgetCandidateD.metrics.estimatedCost, language)})`,
                      )}
                    </button>
                  )}
                  {isBudgetExceeded && onRaiseBudgetToCost && (
                    <button
                      type="button"
                      onClick={() =>
                        onRaiseBudgetToCost(
                          Math.ceil((summary.estimatedCost * 1.03) / 1000) * 1000,
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold cursor-pointer tabular-nums"
                    >
                      {tr6(
                        language,
                        `${formatCurrency(Math.ceil((summary.estimatedCost * 1.03) / 1000) * 1000, language)}(으)로 예산 상향`,
                        'Raise Budget to Match',
                        '予算を引き上げる',
                        '上调可用预算',
                        'Ampliar presupuesto',
                        'Augmenter le budget',
                      )}
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* 2C. Quantitative Barrier-Free Engineering Audit (Beyond ON/OFF Switches) */}
            <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      {tr6(
                        language,
                        '정량적 무장애(Barrier-Free) 물리 규격 검증 및 부족 시설 원클릭 보완',
                        'Quantitative Barrier-Free Physical Audit & 1-Click Facility Completion',
                        '定量的バリアフリー物理規格検証および不足施設のワンクリック補完',
                        '定量无障碍物理规格核验与缺失设施一键补齐',
                        'Auditoría cuantitativa de accesibilidad universal',
                        'Audit quantitatif d’accessibilité universelle PMR',
                      )}
                    </h2>
                    <p className="text-xs text-slate-500">
                      단순 ON/OFF 스위치가 아닌 실제 통로 유효폭·경사로 기울기·연속 보행거리·전용 시설 수량을 정량 계측합니다.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { subtype: 'wheelchair_viewing' as const, zone: 'stage_front' as const, label: '+ 휠체어 관람석' },
                    { subtype: 'access_ramp' as const, zone: 'entrance' as const, label: '+ 경사로' },
                    { subtype: 'tactile_paving' as const, zone: 'center' as const, label: '+ 점자블록' },
                    { subtype: 'senior_rest' as const, zone: 'southwest' as const, label: '+ 노약자 쉼터' },
                    { subtype: 'accessible_parking' as const, zone: 'south' as const, label: '+ 장애인 주차장' },
                  ].map((btn) => (
                    <button
                      key={btn.subtype}
                      type="button"
                      onClick={() =>
                        onSpawnReferenceFacility(
                          btn.subtype,
                          btn.zone,
                          SUBTYPE_SIMPLE_LABELS[btn.subtype][language],
                        )
                      }
                      className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-[11px] font-semibold cursor-pointer"
                    >
                      + {SUBTYPE_SIMPLE_LABELS[btn.subtype][language]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 text-xs font-mono tabular-nums">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="font-sans text-[11px] text-slate-500">무단차 접근 적용률</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {bfAudit.stepFreeRatePct}% ({bfAudit.accessibleCount}/{bfAudit.totalInsideCount})
                  </div>
                  <div className="font-sans text-[10px] text-emerald-700 mt-0.5">
                    경사로 {bfAudit.rampSlopeSpec}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="font-sans text-[11px] text-slate-500">통로 유효폭 · 회전반경</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {bfAudit.corridorClearWidthM}m (Ø1.8m{' '}
                    {bfAudit.turningRadiusPass ? '충족' : '미달'})
                  </div>
                  <div className="font-sans text-[10px] text-slate-500 mt-0.5">
                    양방향 휠체어 교행 기준 ≥1.8m
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="font-sans text-[11px] text-slate-500">무휴식 연속 보행거리</div>
                  <div
                    className={`text-sm font-bold mt-0.5 ${
                      bfAudit.walkRestPass ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    최장 {bfAudit.maxContinuousWalkM}m
                  </div>
                  <div className="font-sans text-[10px] text-slate-500 mt-0.5">
                    노약자 권장 간격 ≤65m ({bfAudit.walkRestPass ? '적합' : '쉼터 추가 권장'})
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="font-sans text-[11px] text-slate-500">장애인주차 ↔ 주출입구</div>
                  <div
                    className={`text-sm font-bold mt-0.5 ${
                      bfAudit.parkingDistPass ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {bfAudit.parkingToGateDistM}m
                  </div>
                  <div className="font-sans text-[10px] text-slate-500 mt-0.5">
                    권장 최단거리 ≤55m 직결
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="font-sans text-[11px] text-slate-500">무장애 전용시설 수량</div>
                  <div className="text-xs font-bold text-slate-900 mt-1">
                    관람석 {bfAudit.wheelchairViewingCount} · 경사로 {bfAudit.rampUnitCount} · 점자{' '}
                    {bfAudit.tactileCount}
                  </div>
                  <div className="font-sans text-[10px] text-slate-500 mt-0.5">
                    무장애 화장실 {bfAudit.accessibleWcCount}동
                  </div>
                </div>
              </div>
            </section>

            {/* 2D. Statutory Applicability + Evidence Docs + 4-Stage Status Dropdowns & 8-Domain Matrix */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    {tr6(
                      language,
                      '법령 적용조건 자동판별 · 필수 증빙서류 · 4단계 이행상태 관리',
                      'Auto-Detected Statutory Triggers, Required Docs & 4-Stage Review Status',
                      '法令適用条件の自動判別・必須証憑書類・4段階履行状態管理',
                      '法规适用条件自动判别·必备证明文件·4阶段履行状态管理',
                      'Detección legal automática, documentos requeridos y estado en 4 etapas',
                      'Conditions légales auto-détectées, pièces requises et suivi en 4 étapes',
                    )}
                  </h2>
                  <p className="text-slate-500 mt-0.5">
                    체크박스만으로는 확인하기 어려운 법적 적용 조건과 증빙서류를 분리하고, 각 항목의 검토·협의·이행 완료 상태를 기록합니다.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {statutoryChecklistRows.map((row) => {
                    const statusVal = getReviewStatus(row.key);
                    return (
                      <div
                        key={row.key}
                        className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="font-bold text-slate-900 flex-1 min-w-[200px]">
                            {isKo ? row.labelKo : row.labelEn}
                          </div>
                          <select
                            value={statusVal}
                            onChange={(e) =>
                              handleChangeReviewStatus(
                                row.key,
                                e.target.value as StatutoryReviewStatus,
                              )
                            }
                            className={`px-2 py-1 rounded border text-[11px] font-semibold cursor-pointer ${
                              statusVal === 'verified'
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                : statusVal === 'in_consultation'
                                  ? 'bg-blue-50 border-blue-300 text-blue-900'
                                  : statusVal === 'not_applicable'
                                    ? 'bg-slate-100 border-slate-300 text-slate-600'
                                    : 'bg-amber-50 border-amber-300 text-amber-900'
                            }`}
                          >
                            <option value="pending_review">사전검토 대기</option>
                            <option value="in_consultation">유관기관 협의중</option>
                            <option value="verified">서류·점검 완료</option>
                            <option value="not_applicable">해당 없음</option>
                          </select>
                        </div>
                        <div className="text-[11px] font-medium text-blue-800">
                          {row.autoConditionKo}
                        </div>
                        <div className="text-[10.5px] text-slate-600">
                          <span className="font-semibold text-slate-700">필수 확인 증빙: </span>
                          {row.evidenceDocKo}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 8-Domain Non-Averaged Verification Matrix */}
              <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    {tr6(
                      language,
                      '8대 설계·분석 영역 독립 검증표 (비평균 판정 원칙)',
                      '8-Domain Independent Evidence Matrix (Non-Averaged)',
                      '8大設計・分析領域の独立検証表（非平均判定原則）',
                      '8大设计与分析领域独立验证表（禁止平均分掩盖风险）',
                      'Matriz independiente de 8 dominios (sin promedios)',
                      'Matrice indépendante en 8 domaines (sans moyenne)',
                    )}
                  </h2>
                  <p className="text-xs text-slate-500">
                    실제 수치·법령 기준(`OFFICIAL`)과 시뮬레이션 가정(`ASSUMPTION`)을 구분하여 8개 영역을 독립 진단합니다.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 pr-2 font-semibold">영역</th>
                        <th className="py-2 px-2 font-semibold">산출 수치·근거 및 한계</th>
                        <th className="py-2 px-2 font-semibold">구분</th>
                        <th className="py-2 pl-2 font-semibold">판정</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {domainEval.domains.map((d) => {
                        const rel = RELIABILITY_LABEL_META[d.reliabilityLabel];
                        return (
                          <tr key={d.domainId} className="align-top">
                            <td className="py-2.5 pr-2 font-bold text-slate-900 whitespace-nowrap">
                              <div>{isKo ? d.domainKo : d.domainEn}</div>
                              <div className="text-[10px] font-normal text-slate-500 mt-0.5 max-w-[130px] whitespace-normal">
                                {d.coreQuestionKo}
                              </div>
                            </td>
                            <td className="py-2.5 px-2 space-y-1">
                              <div className="font-mono text-[11px] text-slate-800 tabular-nums">
                                {d.evidenceDataKo}
                              </div>
                              <div className="text-slate-700">{d.judgmentKo}</div>
                              <div className="text-[10px] text-slate-500">한계: {d.limitNoteKo}</div>
                            </td>
                            <td className="py-2.5 px-2 whitespace-nowrap">
                              <span
                                className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${rel.toneClass}`}
                              >
                                {d.reliabilityLabel}
                              </span>
                            </td>
                            <td className="py-2.5 pl-2 whitespace-nowrap">
                              <span
                                className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${
                                  d.status === 'pass'
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                    : d.status === 'review'
                                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                                      : 'bg-rose-50 border-rose-200 text-rose-800'
                                }`}
                              >
                                {d.status === 'pass'
                                  ? '적합'
                                  : d.status === 'review'
                                    ? '보완 권고'
                                    : '판정 보류'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* TAB 3: CLEAR VS SEVERE WEATHER MATRIX + EXPANDED 12-STAGE D-DAY SCHEDULE (D-30 ~ D+3) */}
        {activeTab === 'ops_weather' && (
          <div className="space-y-6">
            {/* Utility Load Summary Cards */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>총 피크 전력 부하 (예비율 25%)</span>
                </div>
                <div className="text-lg font-mono font-bold text-slate-900 tabular-nums">
                  {domainEval.utilitiesSummary.peakPowerWithMarginKw} kW
                </div>
                <div className="text-[11px] text-slate-500">
                  권장 방음형 발전기 {domainEval.utilitiesSummary.recommendedGeneratorUnits}기 · 안전펜스 격리
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
                <div className="text-xs font-semibold text-slate-500">급수 · 오수 인입 대상 시설</div>
                <div className="text-lg font-mono font-bold text-slate-900 tabular-nums">
                  급수 {domainEval.utilitiesSummary.waterFacilityCount} / 오수{' '}
                  {domainEval.utilitiesSummary.wastewaterFacilityCount}개소
                </div>
                <div className="text-[11px] text-slate-500">
                  화장실 수거차량·식음 급수 라인 외곽 도로 인접 배치
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
                <div className="text-xs font-semibold text-slate-500">다회용기 · 폐기물 분리수거함</div>
                <div className="text-lg font-mono font-bold text-slate-900 tabular-nums">
                  최소 {domainEval.utilitiesSummary.recommendedWasteBins}개소 권장
                </div>
                <div className="text-[11px] text-slate-500">
                  푸드존·출입구 주변 집중 배치 및 중간 수거 동선 분리
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
                <div className="text-xs font-semibold text-slate-500">시설 운영·안전 최소 필요 인력</div>
                <div className="text-lg font-mono font-bold text-slate-900 tabular-nums">
                  약 {domainEval.utilitiesSummary.totalStaffRequired}명
                </div>
                <div className="text-[11px] text-slate-500">
                  교대 휴식 인원(1.25배) 및 야간 퇴장 유도 요원 별도 가산 권장
                </div>
              </div>
            </section>

            {/* Clear (Normal) vs Severe Weather Comparison Matrix + 1-Click Mitigation Placement */}
            <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    {tr6(
                      language,
                      '평시(맑음) vs 5대 악천후·야간 시나리오 통합 대조 및 대비 시설 원클릭 배치',
                      'Normal (Clear) vs. 5 Severe Weather & Night Scenarios Matrix + 1-Click Mitigation',
                      '平常（晴天）vs 5大悪天候・夜間シナリオ対照表および対策施設ワンクリック配置',
                      '平时（晴天）与5类恶劣天气·夜间情景对照矩阵及应对设施一键配置',
                      'Matriz comparativa de clima normal vs. 5 escenarios adversos',
                      'Matrice comparative météo normale vs. 5 scénarios extrêmes',
                    )}
                  </h2>
                  <p className="text-xs text-slate-500">
                    평시 운영 기준과 우천·강풍·폭염·한파·야간 악천후 발생 시 보행 영향 및 필수 물리 대책을 나란히 대조하고 3D 시뮬레이션과 연동합니다.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { subtype: 'rain_canopy' as const, zone: 'center' as const },
                    { subtype: 'emergency_shelter' as const, zone: 'perimeter' as const },
                    { subtype: 'fire_safety_unit' as const, zone: 'west' as const },
                    { subtype: 'medical_station' as const, zone: 'east' as const },
                  ].map((item) => (
                    <button
                      key={item.subtype}
                      type="button"
                      onClick={() =>
                        onSpawnReferenceFacility(
                          item.subtype,
                          item.zone,
                          SUBTYPE_SIMPLE_LABELS[item.subtype][language],
                        )
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-[11px] font-semibold cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{SUBTYPE_SIMPLE_LABELS[item.subtype][language]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">기상 시나리오</th>
                      <th className="py-2.5 px-3 font-semibold">발령 기준</th>
                      <th className="py-2.5 px-3 font-semibold">군중·보행 변화</th>
                      <th className="py-2.5 px-3 font-semibold">필수 공간·안전 조치</th>
                      <th className="py-2.5 px-3 font-semibold text-right">3D 시뮬레이션</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(Object.keys(WEATHER_SCENARIO_GUIDES) as WeatherScenarioId[]).map((id) => {
                      const g = WEATHER_SCENARIO_GUIDES[id];
                      const active = weatherScenario === id;
                      return (
                        <tr
                          key={id}
                          className={active ? 'bg-blue-50/60' : 'hover:bg-slate-50/70'}
                        >
                          <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                            {g.nameKo}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                            {g.triggerConditionKo}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{g.crowdImpactKo}</td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {g.requiredDesignActionsKo.slice(0, 2).join(' · ')}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onChangeWeatherScenario(id, g.linkedContingency)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                                active
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-white border border-slate-300 hover:border-blue-500 text-slate-700'
                              }`}
                            >
                              {active && <Check className="w-3 h-3" />}
                              <span>{active ? '적용 중' : '시나리오 적용'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Expanded 12-Stage D-Day Master Schedule (D-30 to D+3) */}
            <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-bold text-slate-900">
                    {tr6(
                      language,
                      `설치·점검·본행사·철거 12단계 디데이(D-Day) 마스터 공정표 (D-30 ~ D+3, 총 ${SETUP_TEARDOWN_SCHEDULE_7_STEPS.length}단계)`,
                      `12-Stage D-Day Master Schedule (D-30 to D+3 — Planning, Inspection, Live Ops & Teardown)`,
                      `設営・点検・本番・撤去 12段階 D-Day マスター工程表（D-30〜D+3）`,
                      `搭建·联检·正式运营·撤场 12阶段 D-Day 主控工序表（D-30 ~ D+3）`,
                      `Cronograma maestro de 12 etapas D-Day (D-30 a D+3)`,
                      `Planning directeur J-Day en 12 étapes (J-30 à J+3)`,
                    )}
                  </h2>
                </div>
                <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded tabular-nums">
                  D-30 → D-21 → D-14 → D-7 → D-5 → D-3 → D-2 → D-1 → D-Day(3구간) → D+3
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                {SETUP_TEARDOWN_SCHEDULE_7_STEPS.map((st) => {
                  const dBadge = st.phaseKo.split(' · ')[0] || `Step ${st.step}`;
                  const phaseRest = st.phaseKo.split(' · ').slice(1).join(' · ') || st.phaseKo;
                  return (
                    <div
                      key={st.step}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-2"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-[11px] font-bold tabular-nums">
                            {dBadge}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                            #{String(st.step).padStart(2, '0')} / {SETUP_TEARDOWN_SCHEDULE_7_STEPS.length}
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 leading-snug">{phaseRest}</div>
                        <p className="text-slate-700 leading-relaxed text-[11.5px]">{st.detailKo}</p>
                      </div>
                      <div className="pt-1.5 border-t border-slate-200/80 text-[10.5px] font-mono text-blue-700">
                        동선·통제 원칙: {st.vehicleNoteKo}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* TAB 4: 5-LAYER RAG, STANDARD JSON (11-1/11-2), 8 CSV DOWNLOADS & PUBLIC PORTALS */}
        {activeTab === 'rag_schema' && (
          <div className="space-y-6">
            <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {tr6(
                    language,
                    '표준 8종 CSV 데이터셋 즉시 내보내기',
                    '8 Standardized CSV Dataset Exports',
                    '標準8種CSVデータセット出力',
                    '8种标准CSV数据集一键导出',
                    'Exportación de 8 datasets CSV estándar',
                    'Export des 8 jeux de données CSV standards',
                  )}
                </h2>
                <p className="text-xs text-slate-500">
                  현재 3D 행사장의 시설 제원·전력·대기열(λ, μ, c)·시간대별 재실 인원·안전점검표를 표준 CSV로 추출합니다.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {CSV_EXPORT_ITEMS.map((item) => (
                  <button
                    key={item.file}
                    type="button"
                    onClick={() => handleDownloadCsv(item.file)}
                    className="p-3 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-left space-y-1.5 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-blue-700">{item.file}</span>
                      <Download className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      {isKo ? item.descKo : item.descEn}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    3D 자산 메타데이터 표준 JSON (1:1 치수·출처·버전 포함)
                  </h3>
                  <select
                    value={sampleFacility?.id || ''}
                    onChange={(e) => setSelectedSampleFacilityId(e.target.value)}
                    className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md"
                  >
                    {facilities.map((f) => (
                      <option key={f.id} value={f.id}>
                        {getFacilityDisplayName(f, language)} ({f.id})
                      </option>
                    ))}
                  </select>
                </div>
                <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto max-h-72">
                  {JSON.stringify(sampleAssetJson, null, 2)}
                </pre>
              </section>

              <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    방문객 집계 분리 레코드 JSON (누적 vs 15분 입퇴장 vs 동시 재실)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    구간 말 재실 인원 = 구간 시작 재실 인원 + 입장 인원 - 퇴장 인원 원칙 적용
                  </p>
                </div>
                <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto max-h-72">
                  {JSON.stringify(crowdRecord11_2, null, 2)}
                </pre>
              </section>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    5계층 지식베이스(RAG) + 수치 규칙 엔진 결합 구조
                  </h3>
                </div>
                <div className="space-y-2.5 text-xs">
                  {RAG_FIVE_LAYERS.map((l) => (
                    <div
                      key={l.layerId}
                      className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1"
                    >
                      <div className="font-bold text-slate-900">
                        {l.layerId} · {l.nameKo}
                      </div>
                      <p className="text-slate-700">{l.roleKo}</p>
                      <div className="text-[10px] text-blue-700">주요 출처: {l.sourcesKo}</div>
                      <div className="text-[10px] text-slate-500">검증 원칙: {l.cautionKo}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    공식 법령·공공데이터 8대 수집 포털 및 AI 15대 설계 준칙
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {OFFICIAL_PUBLIC_DATA_SOURCES.map((src) => (
                    <a
                      key={src.id}
                      href={src.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 rounded-lg bg-slate-50 hover:bg-blue-50/60 border border-slate-200 space-y-1 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold text-blue-700">{src.categoryKo}</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {src.checkedDate}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 leading-snug">{src.titleKo}</div>
                      <p className="text-[11px] text-slate-600 leading-snug">{src.usageKo}</p>
                    </a>
                  ))}
                </div>

                <details className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                  <summary className="font-bold text-slate-900 cursor-pointer">
                    AI 설계·대화·XAI 엔진에 주입된 15대 근거 기반 시스템 준칙 보기
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-[11px] text-slate-700 leading-relaxed">
                    {EVIDENCE_GROUNDED_15_RULES_PROMPT}
                  </pre>
                </details>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
