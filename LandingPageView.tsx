import React from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Language } from '../types/festival';

interface LandingPageViewProps {
  language: Language;
  onNavigate: (section: any) => void;
  onLogin: () => void;
  isLoggedIn: boolean;
  username?: string;
  role?: string;
}

const featureItems = [
  {
    number: '01',
    title: '행사 정보 입력',
    description: '장소·방문객·예산과 필요한 시설을 정리합니다.',
    image: '/images/feature-event-info.jpg',
    alt: '행사장 도면을 함께 검토하는 기획자',
    destination: 'workspace',
  },
  {
    number: '02',
    title: '3D 공간 배치',
    description: '시설 위치와 공간 구성을 입체적으로 검토합니다.',
    image: '/images/feature-3d-layout.jpg',
    alt: '전시 행사장의 부스와 동선을 보여주는 전경',
    destination: 'workspace',
  },
  {
    number: '03',
    title: '운영 분석',
    description: '모델 기반 동선과 시설 분석으로 검토 지점을 확인합니다.',
    image: '/images/feature-operations.jpg',
    alt: '행사장 방문객 흐름을 살펴보는 운영 담당자',
    destination: 'analytics',
  },
  {
    number: '04',
    title: '보고서 작성',
    description: '현재 설계와 연결된 검토 보고서를 내려받습니다.',
    image: '/images/feature-report.jpg',
    alt: '행사 운영 분석 자료와 차트를 검토하는 모습',
    destination: 'xai_report',
  },
] as const;

export const LandingPageView: React.FC<LandingPageViewProps> = ({ onNavigate }) => {
  const startDesign = () => onNavigate('workspace');

  return (
    <main className="eventon-landing min-h-screen w-full overflow-x-hidden bg-[#f4f7f6] text-[#1d3554]">
      {/* Main visual */}
      <section className="eventon-hero relative flex min-h-[620px] items-center overflow-hidden">
        <div className="eventon-hero-photo absolute inset-0" aria-hidden="true" />
        <div className="eventon-hero-shade absolute inset-0" aria-hidden="true" />

        <div className="relative z-10 mx-auto w-full max-w-[1840px] px-7 py-20 sm:px-10 lg:px-16">
          <div className="max-w-[700px]">
            <p className="mb-6 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#dce8eb] sm:text-xs">
              Event Planning Workspace
            </p>
            <h1 className="mb-6 text-[clamp(2.55rem,4.1vw,4.45rem)] font-black leading-[1.12] tracking-[-0.055em] text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.18)]">
              좋은 행사의 시작,<br />
              명확한 설계에서.
            </h1>
            <p className="mb-16 text-base font-medium tracking-[-0.02em] text-[#e0e6e9] sm:text-lg">
              행사 기획부터 공간 배치까지, Event ON.
            </p>
            <button
              type="button"
              onClick={startDesign}
              className="group inline-flex min-h-[56px] items-center gap-3 rounded-[4px] bg-[#27879a] px-7 py-4 text-sm font-bold text-white shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#1d7183] hover:shadow-[0_16px_34px_rgba(0,0,0,0.24)] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60 active:translate-y-0"
            >
              설계 시작하기
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </button>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-white/20" />
      </section>

      {/* Feature overview */}
      <section className="eventon-features px-6 py-20 sm:px-10 sm:py-24 lg:px-14 lg:py-[92px]">
        <div className="mx-auto max-w-[1804px]">
          <div className="mb-12 text-center sm:mb-[54px]">
            <p className="mb-8 text-[10px] font-bold uppercase tracking-[0.28em] text-[#247e8e] sm:text-[11px]">
              Our Features
            </p>
            <h2 className="mb-7 text-[clamp(1.8rem,2.35vw,2.55rem)] font-extrabold leading-tight tracking-[-0.055em] text-[#1d3554]">
              행사 기획의 모든 과정, 한곳에서.
            </h2>
            <p className="text-sm font-medium tracking-[-0.025em] text-[#71849a] sm:text-[15px]">
              아이디어를 정리하고, 공간을 설계하고, 운영을 검토하세요.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-x-7 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
            {featureItems.map((item) => (
              <button
                key={item.number}
                type="button"
                onClick={() => onNavigate(item.destination)}
                className="group min-w-0 text-left focus:outline-none focus-visible:rounded-md focus-visible:ring-4 focus-visible:ring-[#27879a]/30"
                aria-label={`${item.title} 화면으로 이동`}
              >
                <div className="relative mb-6 aspect-[1.88/1] overflow-hidden rounded-[3px] bg-[#e3e9e8]">
                  <img
                    src={item.image}
                    alt={item.alt}
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.045]"
                    loading="eager"
                  />
                  <span className="absolute inset-0 bg-[#10253c]/0 transition-colors duration-300 group-hover:bg-[#10253c]/10" />
                  <span className="absolute bottom-3 right-3 flex h-8 w-8 translate-y-2 items-center justify-center rounded-full bg-white/95 text-[#247e8e] opacity-0 shadow-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>
                <div className="mb-3 text-[10px] font-semibold tracking-[0.08em] text-[#287f8e]">{item.number}</div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-[20px] font-extrabold tracking-[-0.045em] text-[#203b5d] sm:text-[21px]">
                    {item.title}
                  </h3>
                  <ArrowUpRight className="h-[17px] w-[17px] shrink-0 text-[#91a2b2] opacity-0 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" />
                </div>
                <p className="text-[13px] leading-[1.8] tracking-[-0.025em] text-[#71849a] sm:text-sm">
                  {item.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e2e9e7] bg-[#f4f7f6] px-6 py-7 text-center text-[11px] tracking-[0.04em] text-[#8a9a9e]">
        EVENT ON · PLAN SMART. RUN BETTER.
      </footer>
    </main>
  );
};
