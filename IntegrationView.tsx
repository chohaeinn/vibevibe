import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Copy,
  Check,
  Download,
  FolderOpen,
  Trash2,
  FileCode2,
  Archive,
  GitBranch,
} from 'lucide-react';
import { Language, SavedProjectPayload } from '../types/festival';

interface SourceFileEntry {
  path: string;
  sizeBytes: number;
  content: string;
}

interface IntegrationViewProps {
  language: Language;
  currentPayload: SavedProjectPayload;
  savedProjects: Array<{ key: string; name: string; savedAt: string; payload: SavedProjectPayload }>;
  onLoadSavedProject: (payload: SavedProjectPayload) => void;
  onDeleteSavedProject: (key: string) => void;
  onExportJson: () => void;
  onBackToWorkspace: () => void;
}

export const IntegrationView: React.FC<IntegrationViewProps> = ({
  language,
  currentPayload,
  savedProjects,
  onLoadSavedProject,
  onDeleteSavedProject,
  onExportJson,
  onBackToWorkspace,
}) => {
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedSource, setCopiedSource] = useState(false);
  const [copiedGitCmd, setCopiedGitCmd] = useState(false);
  const [sourceFiles, setSourceFiles] = useState<SourceFileEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('src/App.tsx');
  const [loadingFiles, setLoadingFiles] = useState<boolean>(true);

  const isKo = language === 'ko';
  const jsonPreview = JSON.stringify(currentPayload, null, 2);

  useEffect(() => {
    let active = true;
    setLoadingFiles(true);
    fetch('/api/source/files')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('offline'))))
      .then((data: { files?: SourceFileEntry[] }) => {
        if (!active) return;
        const list = data.files || [];
        setSourceFiles(list);
        if (list.length > 0 && !list.some((f) => f.path === 'src/App.tsx')) {
          setSelectedPath(list[0].path);
        }
      })
      .catch(() => {
        if (!active) return;
        setSourceFiles([]);
      })
      .finally(() => {
        if (active) setLoadingFiles(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedFile = sourceFiles.find((f) => f.path === selectedPath) || sourceFiles[0] || null;

  const handleCopyJson = () => {
    navigator.clipboard?.writeText(jsonPreview).then(() => {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 1600);
    });
  };

  const handleCopySelectedSource = () => {
    if (!selectedFile) return;
    navigator.clipboard?.writeText(selectedFile.content).then(() => {
      setCopiedSource(true);
      setTimeout(() => setCopiedSource(false), 1600);
    });
  };

  const gitUploadCommands = `git init
git branch -M main
git add .
git commit -m "feat: initial commit of INCLUSE AI Festival Designer"
git remote add origin https://github.com/YOUR_USERNAME/incluse-festival-designer.git
git push -u origin main`;

  const handleCopyGitCommands = () => {
    navigator.clipboard?.writeText(gitUploadCommands).then(() => {
      setCopiedGitCmd(true);
      setTimeout(() => setCopiedGitCmd(false), 1600);
    });
  };

  const handleDownloadSingleFile = (entry: SourceFileEntry) => {
    const filename = entry.path.split('/').pop() || 'code.txt';
    const blob = new Blob([entry.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const architectureLayers = isKo
    ? [
        {
          layer: '1. Frontend & 3D Digital Twin',
          stack: 'React 19 · TypeScript · Three.js (InstancedMesh) · Recharts · Tailwind CSS',
          desc: '아이소메트릭 3D 행사장 시각화, 최대 1,000+ 에이전트 실시간 군중 렌더링, KDE 혼잡 히트맵, 시설 클릭 편집 및 돌발상황 제어',
        },
        {
          layer: '2. Generative AI & API Server',
          stack: 'Express (server.ts) · Gemini API (/api/ai/parse-brief, /api/ai/xai-report) · Python Bridge',
          desc: '자연어 행사 기획안 구조화 파싱, 설명 가능한 AI(XAI) 안전·포용 설계 근거 생성 및 오프라인 결정론적 폴백 보장',
        },
        {
          layer: '3. Crowd Simulation & Multi-Objective Engine',
          stack: 'crowdSimulation.ts · analyticsEngine.ts · simulation.py (NumPy KDE)',
          desc: '6단계 시간대별 보행 동선 시뮬레이션, 행안부 다중운집 안전기준 검증, 다목적 후보안(Layout A~D) 탐색 및 실시간 재배치',
        },
        {
          layer: '4. Inclusive Accessibility & XAI Reporting',
          stack: '5대 교통약자 진단 엔진 · A4 @media print PDF · JSON Schema v1.1.0',
          desc: '휠체어·유모차·어린이·고령자·외국인 접근성 정량 평가, A4 인쇄용 검증 리포트 및 Streamlit 양방향 JSON 연동',
        },
      ]
    : [
        {
          layer: '1. Frontend & 3D Digital Twin',
          stack: 'React 19 · TypeScript · Three.js (InstancedMesh) · Recharts · Tailwind CSS',
          desc: 'Interactive isometric 3D venue, InstancedMesh crowd agents, 48×36 KDE heatmap, raycasted editing, and contingency overlays.',
        },
        {
          layer: '2. Generative AI & API Server',
          stack: 'Express (server.ts) · Gemini API (/api/ai/parse-brief, /api/ai/xai-report) · Python Bridge',
          desc: 'Natural-language event brief parser and Explainable AI safety/inclusion report endpoints with deterministic client fallback.',
        },
        {
          layer: '3. Crowd Simulation & Multi-Objective Engine',
          stack: 'crowdSimulation.ts · analyticsEngine.ts · simulation.py (NumPy KDE)',
          desc: '6-phase agent movement, MoIS crowd safety tier validation, Pareto Layouts A–D, and real-time contingency re-optimization.',
        },
        {
          layer: '4. Inclusive Accessibility & XAI Reporting',
          stack: '5 Visitor Persona Evaluator · A4 Print PDF · JSON Schema v1.1.0',
          desc: 'Quantitative scoring for wheelchairs, strollers, children, seniors, and international visitors + Streamlit JSON sync.',
        },
      ];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-[1280px] mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={onBackToWorkspace}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline mb-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isKo ? '3D 디지털 트윈 작업공간 복귀' : 'Return to 3D Digital Twin'}</span>
            </button>
            <h1 className="text-xl font-bold text-slate-900">
              {isKo
                ? '전체 생성 코드 파일 다운로드 센터 · 아키텍처 및 JSON 스키마'
                : 'Source Code Download Center, System Architecture & JSON Schema'}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              {isKo
                ? '제작된 전체 소스코드(React + Three.js + Express AI 서버 + Python Streamlit)를 ZIP 압축파일 또는 개별 코드 파일로 즉시 다운로드할 수 있습니다.'
                : 'Download the complete React + Three.js + Express + Python Streamlit codebase as a ZIP archive or inspect and download individual files.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/incluse-ai-festival-designer-source.zip"
              download="incluse-ai-festival-designer-source.zip"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>
                {isKo ? 'GitHub 표준 소스코드 (.zip)' : 'GitHub Clean Source (.zip)'}
              </span>
            </a>

            <a
              href="/incluse-ai-festival-designer-with-dist.zip"
              download="incluse-ai-festival-designer-with-dist.zip"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {isKo
                  ? 'GitHub + Streamlit Cloud 배포용 (dist 포함 .zip)'
                  : 'GitHub + Streamlit Cloud Bundle (.zip)'}
              </span>
            </a>
          </div>
        </div>

        {/* GitHub Repository Upload & Streamlit Cloud Quick-Start Card */}
        <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">
                {isKo
                  ? 'GitHub 저장소 업로드 & Streamlit Community Cloud 연동 패키지 안내'
                  : 'GitHub Repository Upload & Streamlit Community Cloud Guide'}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleCopyGitCommands}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              {copiedGitCmd ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>
                {copiedGitCmd
                  ? isKo
                    ? 'Git 명령어 복사됨'
                    : 'Copied Git Commands'
                  : isKo
                  ? 'Git 푸시 명령어 복사'
                  : 'Copy Git Push Commands'}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-900">
                  {isKo
                    ? '1) GitHub 표준 소스코드 (.zip)'
                    : '1) GitHub Clean Source (.zip)'}
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {isKo
                    ? 'node_modules·빌드 산출물을 제외한 순수 소스 33개 파일(.gitignore, .env.example, .github/workflows/ci.yml, README.md, src/, server.ts, streamlit_app.py, simulation.py)로 구성되어 GitHub에 바로 커밋·푸시할 수 있습니다.'
                    : 'Clean 33-file repository (.gitignore, .env.example, GitHub Actions CI, README.md, React/Three.js, Express, and Python files) ready for git push.'}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200 space-y-1.5">
                <div className="font-bold text-blue-950">
                  {isKo
                    ? '2) GitHub + Streamlit Cloud 배포용 (.zip)'
                    : '2) GitHub + Streamlit Cloud Bundle (.zip)'}
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed">
                  {isKo
                    ? '미리 컴파일된 3D 번들(dist/)이 포함되고 .gitignore에서도 dist/가 허용되어 있어, GitHub에 올린 뒤 share.streamlit.io에서 streamlit_app.py만 지정하면 Node 빌드 없이 3D 디지털 트윈이 즉시 실행됩니다.'
                    : 'Includes pre-built dist/ with dist-friendly .gitignore so Streamlit Community Cloud renders the 3D Digital Twin out of the box.'}
                </p>
              </div>
            </div>

            <div className="lg:col-span-5 p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto flex items-center">
              <pre className="leading-relaxed">{gitUploadCommands}</pre>
            </div>
          </div>
        </section>

        {/* Interactive Source Code File Explorer & Individual File Downloader */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">
                {isKo
                  ? `개별 소스코드 파일 탐색기 및 다운로드 (${sourceFiles.length}개 파일)`
                  : `Project Source Files Explorer (${sourceFiles.length} files)`}
              </h2>
            </div>

            {selectedFile && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-500">
                  {selectedFile.path} · {(selectedFile.sizeBytes / 1024).toFixed(1)} KB
                </span>
                <button
                  type="button"
                  onClick={handleCopySelectedSource}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  {copiedSource ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedSource ? (isKo ? '복사됨' : 'Copied') : isKo ? '코드 복사' : 'Copy Code'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadSingleFile(selectedFile)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isKo ? '이 파일만 다운로드' : 'Download File'}</span>
                </button>
              </div>
            )}
          </div>

          {loadingFiles ? (
            <div className="p-6 text-xs text-slate-500 font-mono">
              {isKo ? '소스코드 파일 목록을 불러오는 중...' : 'Loading project source files...'}
            </div>
          ) : sourceFiles.length === 0 ? (
            <div className="p-6 text-xs text-slate-600">
              {isKo
                ? '상단의 [전체 소스코드 다운로드 (.zip)] 버튼을 클릭하면 모든 코드 파일을 한 번에 내려받을 수 있습니다.'
                : 'Use the Download Full Source (.zip) button above to download all project files.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[420px] max-h-[520px]">
              {/* Left File Tree List */}
              <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 overflow-y-auto divide-y divide-slate-100 max-h-[520px]">
                {sourceFiles.map((file) => {
                  const isSelected = selectedFile?.path === file.path;
                  return (
                    <div
                      key={file.path}
                      className={`flex items-center justify-between px-3.5 py-2 text-xs transition-colors ${
                        isSelected
                          ? 'bg-blue-50 text-blue-900 font-semibold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedPath(file.path)}
                        className="flex-1 text-left font-mono text-[11px] truncate pr-2 cursor-pointer"
                      >
                        {file.path}
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-slate-400">
                          {(file.sizeBytes / 1024).toFixed(1)}K
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDownloadSingleFile(file)}
                          title={isKo ? `${file.path} 다운로드` : `Download ${file.path}`}
                          className="p-1 rounded hover:bg-blue-100 text-slate-500 hover:text-blue-700 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Code Viewer */}
              <div className="lg:col-span-8 bg-slate-900 text-slate-100 overflow-auto max-h-[520px]">
                <pre className="p-4 text-[11px] font-mono leading-relaxed">
                  {selectedFile?.content || ''}
                </pre>
              </div>
            </div>
          )}
        </section>

        {/* 4-Layer INCLUSE Architecture Overview */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">
            {isKo
              ? '생성형 AI 기반 행사 자동 설계 플랫폼 (INCLUSE) 4계층 기술 구조'
              : 'INCLUSE 4-Layer Platform Architecture'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {architectureLayers.map((item) => (
              <div
                key={item.layer}
                className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5"
              >
                <div className="text-xs font-bold text-slate-900">{item.layer}</div>
                <div className="text-[11px] font-mono text-blue-700">{item.stack}</div>
                <p className="text-[11px] text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Saved Local Projects Manager & Streamlit Commands */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <h2 className="text-sm font-bold text-slate-900">
                {isKo ? '브라우저 저장 프로젝트 목록' : 'Saved Browser Projects'}
              </h2>
              {savedProjects.length === 0 ? (
                <p className="text-xs text-slate-500 leading-relaxed">
                  {isKo
                    ? '아직 저장된 프로젝트가 없습니다. 좌측 사이드바 하단의 [저장] 버튼을 누르면 현재 3D 행사장 설계와 평가 결과가 이곳에 보관됩니다.'
                    : 'No saved snapshots yet. Click Save in the left configuration sidebar to store venue layouts locally.'}
                </p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {savedProjects.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between px-3 py-2.5 bg-white hover:bg-slate-50 text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-slate-900 truncate">{item.name}</div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {new Date(item.savedAt).toLocaleString()} ·{' '}
                          {item.payload.facilities.length}
                          {isKo ? '개 시설' : ' facilities'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onLoadSavedProject(item.payload);
                            onBackToWorkspace();
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold cursor-pointer"
                        >
                          <FolderOpen className="w-3 h-3" />
                          <span>{isKo ? '불러오기' : 'Load'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSavedProject(item.key)}
                          title={isKo ? '저장본 삭제' : 'Delete saved snapshot'}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-xs text-slate-700">
              <h2 className="text-sm font-bold text-slate-900">
                {isKo
                  ? '다운로드 후 로컬 실행 방법 (Node.js / Streamlit)'
                  : 'Local Execution After Downloading'}
              </h2>
              <div className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] space-y-1 overflow-x-auto">
                <div># 1. 압축 해제 후 웹 + AI 서버 실행 (http://localhost:3000)</div>
                <div>npm install &amp;&amp; npm run dev</div>
                <div className="pt-1"># 2. Python Streamlit 통합 대시보드 실행</div>
                <div>npm run build</div>
                <div>pip install -r requirements.txt</div>
                <div>streamlit run streamlit_app.py</div>
              </div>
            </div>
          </div>

          {/* Live JSON Schema Inspector */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-900">
                {isKo
                  ? '현재 행사장 디지털 트윈 JSON 데이터 (v1.1.0)'
                  : 'Live Venue & Simulation JSON Payload (v1.1.0)'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer"
                >
                  {copiedJson ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedJson ? (isKo ? '복사됨' : 'Copied') : isKo ? 'JSON 복사' : 'Copy JSON'}</span>
                </button>
                <button
                  type="button"
                  onClick={onExportJson}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-white cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>{isKo ? 'JSON 저장' : 'Save JSON'}</span>
                </button>
              </div>
            </div>
            <pre className="p-4 text-[11px] font-mono text-slate-800 bg-slate-50 overflow-auto max-h-[420px] leading-relaxed">
              {jsonPreview}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
