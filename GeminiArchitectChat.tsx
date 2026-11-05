import React, { useEffect, useRef, useState } from 'react';
import {
  Accessibility,
  ArrowUp,
  Check,
  Compass,
  Eye,
  Lock,
  RotateCcw,
  ShieldCheck,
  Undo2,
  X,
  Zap,
} from 'lucide-react';
import { tUi } from '../i18n/translations';
import {
  CHAT_QUICK_STARTERS_I18N,
  CHAT_ROLE_I18N,
  pickL6,
  tr6,
} from '../i18n/localeCatalog';
import {
  ArchitectChatMessage,
  ChatArchitectRole,
  ChatModelTier,
  Language,
  PendingAiProposal,
} from '../types/festival';

interface GeminiArchitectChatProps {
  language: Language;
  messages: ArchitectChatMessage[];
  pendingProposals: Record<string, PendingAiProposal>;
  onPreviewProposal: (proposal: PendingAiProposal) => void;
  onApplyProposal: (proposalId: string) => void;
  onCancelProposal: (proposalId: string) => void;
  onUndoProposal?: (proposalId: string) => void;
  autoApply?: boolean;
  onChangeAutoApply?: (next: boolean) => void;
  role: ChatArchitectRole;
  onChangeRole: (role: ChatArchitectRole) => void;
  modelTier: ChatModelTier;
  onChangeModelTier: (tier: ChatModelTier) => void;
  isSending: boolean;
  onSendMessage: (text: string) => void;
  onResetChat: () => void;
}

const ROLE_OPTIONS: Array<{
  id: ChatArchitectRole;
  Icon: React.FC<{ className?: string }>;
}> = [
  { id: 'spatial_architect', Icon: Compass },
  { id: 'safety_auditor', Icon: ShieldCheck },
  { id: 'inclusive_specialist', Icon: Accessibility },
];

export const GeminiArchitectChat: React.FC<GeminiArchitectChatProps> = ({
  language,
  messages,
  pendingProposals,
  onPreviewProposal,
  onApplyProposal,
  onCancelProposal,
  onUndoProposal,
  autoApply = false,
  onChangeAutoApply,
  role,
  onChangeRole,
  modelTier,
  onChangeModelTier,
  isSending,
  onSendMessage,
  onResetChat,
}) => {
  const [draft, setDraft] = useState('');
  const threadEndRef = useRef<HTMLDivElement>(null);
  const ui = tUi(language);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isSending, pendingProposals]);

  const starters = CHAT_QUICK_STARTERS_I18N[language] || CHAT_QUICK_STARTERS_I18N.en;

  const handleSubmit = () => {
    const trimmed = draft.trim();
    if (!trimmed || isSending) return;
    setDraft('');
    onSendMessage(trimmed);
  };

  const titleStr = tr6(
    language,
    'AI 공간 협업 대화',
    'AI Spatial Co-Design Chat',
    'AI 空間協業チャット',
    'AI 空间协同设计对话',
    'Chat de Co-Diseño Espacial IA',
    'Chat de Co-Conception Spatiale IA',
  );
  const hintStr = autoApply
    ? tr6(
        language,
        '즉시 반영 모드 켜짐: 요청한 변경이 도안에 바로 적용되며 언제든 되돌릴 수 있습니다.',
        'Instant Apply ON: Requested edits apply directly to the floor plan with 1-click Undo.',
        '即時反映オン：リクエストした変更が直ちに図面へ適用され、いつでも元に戻せます。',
        '即时应用已开启：修改请求将直接应用至平面图，并支持一键撤销。',
        'Aplicación instantánea ACTIVA: los cambios se aplican directo al plano con opción de deshacer.',
        'Application directe ACTIVE : les modifications s’appliquent immédiatement avec annulation en 1 clic.',
      )
    : tr6(
        language,
        '변경 제안은 즉시 덮어쓰지 않고 3D 미리보기와 전·후 비교 확인 후 적용됩니다.',
        'Layout edits show a 3D preview & before/after summary before applying.',
        '配置変更は即時上書きせず、3Dプレビューと前後比較を確認してから適用されます。',
        '布局修改不会直接覆盖，先提供3D预览与前后对比确认后再应用。',
        'Los cambios muestran vista previa 3D y resumen antes/después antes de aplicarse.',
        'Les modifications affichent un aperçu 3D avant/après avant d’être appliquées.',
      );
  const placeholderStr = tr6(
    language,
    '예: 입구 근처에 포토존 2개 추가 / 실외 잔디 바닥으로 변경 / 외부 주차장 2개 설치',
    'e.g., Add 2 photo zones near entrance / Switch to outdoor lawn floor / Set 2 exterior parking lots',
    '例：入口近くにフォトゾーン2つ追加 / 屋外芝生フロアに変更 / 外部駐車場を2箇所設置',
    '例如：在入口附近增加2个立式拍照区 / 切换为室外草坪地面 / 设置2处外部停车场',
    'Ej.: Añade 2 zonas de fotos en la entrada / Cambia a césped exterior / Instala 2 parkings exteriores',
    'Ex. : Ajouter 2 zones photo à l’entrée / Passer en pelouse extérieure / Installer 2 parkings extérieurs',
  );
  const resetStr = tr6(language, '초기화', 'Reset', 'リセット', '重置', 'Reiniciar', 'Réinitialiser');
  const youStr = tr6(language, '사용자', 'You', 'あなた', '您', 'Tú', 'Vous');
  const computingStr = tr6(
    language,
    '설계 변경안을 계산하고 있습니다...',
    'Computing spatial layout proposal...',
    '空間レイアウト変更案を計算しています...',
    '正在计算空间布局方案...',
    'Calculando propuesta espacial...',
    'Calcul de la proposition spatiale...',
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      {/* Top Role Persona, Auto-Apply & Model Selector Bar */}
      <div className="px-3.5 pt-3 pb-2.5 border-b border-slate-200 space-y-2 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-xs font-bold text-slate-900">{titleStr}</h2>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{hintStr}</p>
          </div>
          <button
            type="button"
            onClick={onResetChat}
            className="flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{resetStr}</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
          {ROLE_OPTIONS.map((opt) => {
            const Icon = opt.Icon;
            const active = opt.id === role;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeRole(opt.id)}
                className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3 h-3 shrink-0" />
                <span className="truncate">{pickL6(language, CHAT_ROLE_I18N[opt.id].label)}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
          {onChangeAutoApply && (
            <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoApply}
                onChange={(e) => onChangeAutoApply(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span>
                {tr6(
                  language,
                  '즉시 도안 반영',
                  'Auto-Apply',
                  '即時反映',
                  '即时应用',
                  'Auto-aplicar',
                  'Application auto',
                )}
              </span>
            </label>
          )}

          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md ml-auto">
            <button
              type="button"
              onClick={() => onChangeModelTier('fast')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                modelTier === 'fast'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-2.5 h-2.5 text-amber-500" />
              <span>
                {tr6(language, '빠른 설계', 'Fast', '高速設計', '快速设计', 'Rápido', 'Rapide')}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onChangeModelTier('general')}
              className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                modelTier === 'general'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>
                {tr6(language, '상세 자문', 'Detailed', '詳細助言', '深度顾问', 'Detallado', 'Détaillé')}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Multi-Turn Conversation Thread */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 bg-slate-50/50">
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const roleKey = msg.personaRole ?? role;
          const roleLabel = pickL6(language, CHAT_ROLE_I18N[roleKey].label);
          const isLatestModel = !isUser && idx === messages.length - 1;
          const proposal = msg.proposalId ? pendingProposals[msg.proposalId] : undefined;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1 px-0.5">
                <span className="font-semibold text-slate-700">
                  {isUser ? youStr : roleLabel}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{msg.timestamp}</span>
              </div>

              <div
                className={`max-w-[96%] rounded-lg px-3 py-2.5 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-800'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.text}</p>

                {/* Before/After Confirmation Card for Proposed 3D Layout Edits */}
                {!isUser && proposal && (
                  <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-900">
                        {proposal.status === 'applied'
                          ? tr6(
                              language,
                              '반영된 도안 변경 내역',
                              'Applied Layout Changes',
                              '適用済みの図面変更',
                              '已应用的平面修改',
                              'Cambios Aplicados al Plano',
                              'Modifications Appliquées au Plan',
                            )
                          : ui.aiProposalPendingTitle}
                      </span>
                      <span className="font-mono text-[10px] text-slate-600 tabular-nums">
                        {proposal.beforeFacilityCount} → {proposal.afterFacilityCount}
                      </span>
                    </div>

                    {proposal.diffTags.length > 0 && (
                      <div className="text-[11px] text-slate-700 leading-snug">
                        {proposal.diffTags.join(' · ')}
                      </div>
                    )}

                    {proposal.lockedPreservedCount > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-amber-800 font-medium">
                        <Lock className="w-3 h-3 shrink-0" />
                        <span>
                          {tr6(
                            language,
                            `고정된 부스 ${proposal.lockedPreservedCount}개 위치·크기 보존됨`,
                            `${proposal.lockedPreservedCount} locked booth(s) preserved unchanged`,
                            `固定されたブース ${proposal.lockedPreservedCount}基の位置・サイズを維持`,
                            `已保留 ${proposal.lockedPreservedCount} 个锁定展位的位置与尺寸`,
                            `${proposal.lockedPreservedCount} stand(s) bloqueado(s) conservado(s)`,
                            `${proposal.lockedPreservedCount} stand(s) verrouillé(s) conservé(s)`,
                          )}
                        </span>
                      </div>
                    )}

                    {proposal.status === 'pending' ? (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => onPreviewProposal(proposal)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white hover:bg-slate-100 border border-slate-300 text-[11px] font-semibold text-slate-800 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Eye className="w-3 h-3 text-emerald-600" />
                          <span>{ui.aiProposalPreviewBtn}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onApplyProposal(proposal.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Check className="w-3 h-3" />
                          <span>{ui.aiProposalApplyBtn}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onCancelProposal(proposal.id)}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-slate-200 hover:bg-slate-100 text-[11px] font-medium text-slate-600 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <X className="w-3 h-3" />
                          <span>{ui.aiProposalCancelBtn}</span>
                        </button>
                      </div>
                    ) : proposal.status === 'applied' ? (
                      <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {tr6(
                              language,
                              '도안에 반영됨',
                              'Applied to floor plan',
                              '図面に反映済み',
                              '已应用至平面图',
                              'Aplicado al plano',
                              'Appliqué au plan',
                            )}
                          </span>
                        </div>
                        {onUndoProposal && proposal.prevFacilities && (
                          <button
                            type="button"
                            onClick={() => onUndoProposal(proposal.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-[10px] font-semibold text-slate-700 cursor-pointer"
                          >
                            <Undo2 className="w-3 h-3" />
                            <span>
                              {tr6(
                                language,
                                '이전 상태로 되돌리기',
                                'Undo',
                                '元に戻す',
                                '撤销更改',
                                'Deshacer',
                                'Annuler',
                              )}
                            </span>
                          </button>
                        )}
                      </div>
                    ) : proposal.status === 'undone' ? (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 pt-0.5">
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>
                          {tr6(
                            language,
                            '이전 도안 상태로 되돌렸습니다.',
                            'Reverted to previous floor plan.',
                            '変更前の図面状態に戻しました。',
                            '已恢复至修改前的平面状态。',
                            'Se restauró el plano anterior.',
                            'Plan précédent restauré.',
                          )}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 pt-0.5">
                        <X className="w-3.5 h-3.5" />
                        <span>
                          {tr6(
                            language,
                            '제안된 변경사항이 취소되었습니다.',
                            'Proposal dismissed.',
                            '変更提案を取り消しました。',
                            '已取消该修改建议。',
                            'Propuesta descartada.',
                            'Proposition ignorée.',
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isLatestModel &&
                !isSending &&
                msg.followUpSuggestions &&
                msg.followUpSuggestions.length > 0 && (
                  <div className="mt-2 w-full space-y-1">
                    <div className="flex flex-col gap-1">
                      {msg.followUpSuggestions.slice(0, 3).map((sug, sIdx) => (
                        <button
                          key={`${msg.id}-sug-${sIdx}`}
                          type="button"
                          onClick={() => onSendMessage(sug)}
                          className="text-left px-2.5 py-1.5 rounded-md bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-[11px] text-slate-700 hover:text-blue-800 transition-colors cursor-pointer leading-snug"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          );
        })}

        {isSending && (
          <div className="flex flex-col items-start">
            <div className="text-[10px] text-slate-500 mb-1 px-0.5">
              {pickL6(language, CHAT_ROLE_I18N[role].label)}
            </div>
            <div className="rounded-lg px-3 py-2.5 bg-white border border-slate-200 text-xs text-slate-600">
              {computingStr}
            </div>
          </div>
        )}

        {messages.length <= 1 && !isSending && (
          <div className="pt-1 space-y-1.5">
            <div className="flex flex-col gap-1.5">
              {starters.map((st, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSendMessage(st)}
                  className="text-left px-2.5 py-2 rounded-md bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-[11px] text-slate-700 hover:text-blue-800 transition-colors cursor-pointer leading-snug"
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={threadEndRef} />
      </div>

      {/* Bottom Multi-Turn Composer */}
      <div className="p-3 border-t border-slate-200 bg-white shrink-0 space-y-1.5">
        <div className="relative">
          <textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={placeholderStr}
            className="w-full pl-2.5 pr-10 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
          />
          <button
            type="button"
            disabled={!draft.trim() || isSending}
            onClick={handleSubmit}
            aria-label="Send message"
            className="absolute right-2 bottom-2.5 p-1.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white transition-colors cursor-pointer"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
