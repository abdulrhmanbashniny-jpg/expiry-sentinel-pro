import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Bot, Send, X, Minimize2, Maximize2, Loader2,
  User, CheckCircle, XCircle, AlertTriangle, Sparkles,
  Shield, TrendingUp, MessageSquare, ThumbsDown, RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  pending_approvals?: ApprovalCard[];
  isStreaming?: boolean;
  agent?: string;
}

interface ApprovalCard {
  audit_id: string;
  tool_key: string;
  tool_name: string;
  params: Record<string, any>;
  status?: 'pending' | 'approved' | 'rejected';
}

const PAGE_LABELS: Record<string, string> = {
  '/': 'لوحة المعلومات',
  '/items': 'العناصر',
  '/contracts': 'العقود',
  '/departments': 'الأقسام',
  '/evaluations': 'التقييمات',
  '/reminders': 'التذكيرات',
  '/reminder-rules': 'قواعد التذكير',
  '/compliance-reports': 'تقارير الامتثال',
  '/categories': 'التصنيفات',
  '/recipients': 'المستلمين',
  '/audit-log': 'سجل التدقيق',
  '/settings': 'الإعدادات',
  '/user-management': 'إدارة المستخدمين',
  '/team-management': 'إدارة الفرق',
  '/escalation-dashboard': 'لوحة التصعيد',
};

const AGENT_CONFIG: Record<string, { icon: typeof Bot; label: string; color: string }> = {
  auditor: { icon: Shield, label: 'وكيل التدقيق', color: 'text-orange-500' },
  predictor: { icon: TrendingUp, label: 'وكيل التنبؤ', color: 'text-blue-500' },
  communicator: { icon: MessageSquare, label: 'وكيل التواصل', color: 'text-green-500' },
  sentinel: { icon: Bot, label: 'Sentinel AI', color: 'text-primary' },
};

export const SentinelChatbox = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string>('sentinel');
  const [feedbackMsgId, setFeedbackMsgId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentPage = PAGE_LABELS[location.pathname] || location.pathname;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleApproval = useCallback(async (auditId: string, approved: boolean) => {
    try {
      await supabase.from('ai_audit_trail').update({
        status: approved ? 'approved' : 'rejected',
        approved_at: approved ? new Date().toISOString() : null,
        approved_by: user?.id,
        rejection_reason: approved ? null : 'رفض من المستخدم',
      }).eq('id', auditId);

      setMessages(prev => prev.map(msg => ({
        ...msg,
        pending_approvals: msg.pending_approvals?.map(a =>
          a.audit_id === auditId ? { ...a, status: approved ? 'approved' as const : 'rejected' as const } : a
        )
      })));

      toast.success(approved ? 'تمت الموافقة على العملية' : 'تم رفض العملية');
    } catch {
      toast.error('فشل في تحديث حالة الموافقة');
    }
  }, [user]);

  const submitFeedback = useCallback(async (msgId: string) => {
    if (!feedbackText.trim() || !user) return;
    
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    try {
      await supabase.from('ai_feedback_log').insert({
        user_id: user.id,
        original_output: msg.content.substring(0, 500),
        user_correction: feedbackText.trim(),
        correction_type: 'content',
        is_applied: true,
      });
      toast.success('تم حفظ الملاحظة. سيتعلم Sentinel من تصحيحك.');
      setFeedbackMsgId(null);
      setFeedbackText('');
    } catch {
      toast.error('فشل في حفظ الملاحظة');
    }
  }, [feedbackText, messages, user]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const assistantId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-orchestrator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          message: userMsg.content,
          page_context: currentPage,
        }),
      });

      if (!response.ok) throw new Error('فشل في الاتصال بالخادم');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No stream available');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let approvals: ApprovalCard[] = [];
      let detectedAgent = 'sentinel';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7);
            continue;
          }
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (currentEvent) {
                case 'agent':
                  detectedAgent = data.agent || 'sentinel';
                  setActiveAgent(detectedAgent);
                  setMessages(prev => prev.map(m =>
                    m.id === assistantId ? { ...m, agent: detectedAgent } : m
                  ));
                  break;
                case 'token':
                  fullText += data.text;
                  setMessages(prev => prev.map(m =>
                    m.id === assistantId ? { ...m, content: fullText } : m
                  ));
                  break;
                case 'tool_call':
                  fullText += `\n\n🔧 *${data.tool}...*\n`;
                  setMessages(prev => prev.map(m =>
                    m.id === assistantId ? { ...m, content: fullText } : m
                  ));
                  break;
                case 'approval_needed':
                  approvals.push({
                    audit_id: data.audit_id,
                    tool_key: data.tool_key,
                    tool_name: data.tool_name,
                    params: data.params,
                    status: 'pending',
                  });
                  break;
                case 'done':
                  if (data.full_response && !fullText) fullText = data.full_response;
                  if (data.pending_approvals?.length > 0) {
                    approvals = data.pending_approvals.map((a: any) => ({ ...a, status: 'pending' as const }));
                  }
                  if (data.agent) detectedAgent = data.agent;
                  break;
                case 'error':
                  fullText += `\n\n⚠️ ${data.message}`;
                  break;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantId ? {
          ...m,
          content: fullText || 'لم أتمكن من معالجة طلبك. يرجى المحاولة مرة أخرى.',
          isStreaming: false,
          pending_approvals: approvals.length > 0 ? approvals : undefined,
          agent: detectedAgent,
        } : m
      ));

    } catch (error: any) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? {
          ...m,
          content: `⚠️ ${error.message || 'حدث خطأ'}`,
          isStreaming: false,
        } : m
      ));
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, currentPage]);

  if (!user) return null;

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-50 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 transition-all hover:scale-110"
        size="icon"
      >
        <Sparkles className="h-6 w-6" />
      </Button>
    );
  }

  const AgentIcon = AGENT_CONFIG[activeAgent]?.icon || Bot;

  return (
    <Card className={cn(
      "fixed z-50 shadow-2xl border-primary/20 flex flex-col transition-all duration-300",
      isMinimized
        ? "bottom-6 left-6 w-80 h-14"
        : "bottom-6 left-6 w-[420px] h-[600px] max-h-[80vh]"
    )} dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-primary text-primary-foreground rounded-t-lg">
        <div className="flex items-center gap-2">
          <AgentIcon className="h-5 w-5" />
          <span className="font-semibold text-sm">
            {AGENT_CONFIG[activeAgent]?.label || 'Sentinel AI'}
          </span>
          <Badge variant="outline" className="text-[10px] border-primary-foreground/30 text-primary-foreground/80">
            {currentPage}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => { setMessages([]); setActiveAgent('sentinel'); }}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => setIsMinimized(!isMinimized)}>
            {isMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => setIsOpen(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <ScrollArea className="flex-1 p-3" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-6 px-4">
                <Bot className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium text-sm">مرحباً! أنا Sentinel AI</p>
                <p className="text-xs mt-1 mb-1">نظام ذكي متخصص في إدارة الوثائق والتذكيرات</p>
                
                {/* Agent cards */}
                <div className="grid grid-cols-3 gap-1.5 mt-3 mb-3">
                  {Object.entries(AGENT_CONFIG).filter(([k]) => k !== 'sentinel').map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <div key={key} className="flex flex-col items-center gap-1 p-2 rounded-md bg-muted/50 text-[10px]">
                        <Icon className={cn("h-4 w-4", config.color)} />
                        <span>{config.label}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-1.5 text-xs text-right">
                  <p className="text-muted-foreground/70">جرّب:</p>
                  {[
                    'افحص تناسق التواريخ في جميع العناصر',
                    'توقع أشهر الخطر القادمة',
                    'صِغ رسالة تذكير للعقود المنتهية قريباً',
                    'أعطني ملخص شامل للنظام',
                  ].map((q, i) => (
                    <button key={i} onClick={() => setInput(q)}
                      className="block w-full text-right px-3 py-1.5 rounded-md bg-muted/50 hover:bg-muted transition-colors text-foreground">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {messages.map(msg => (
                <div key={msg.id}>
                  {/* Agent indicator */}
                  {msg.role === 'assistant' && msg.agent && msg.agent !== 'sentinel' && (
                    <div className="flex items-center gap-1 mb-1 mr-9">
                      {(() => {
                        const cfg = AGENT_CONFIG[msg.agent];
                        const Icon = cfg?.icon || Bot;
                        return (
                          <>
                            <Icon className={cn("h-3 w-3", cfg?.color)} />
                            <span className={cn("text-[10px] font-medium", cfg?.color)}>{cfg?.label}</span>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  <div className={cn("flex gap-2", msg.role === 'user' ? 'flex-row-reverse' : '')}>
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                      msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    )}>
                      {msg.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                    </div>
                    <div className={cn(
                      "max-w-[85%] rounded-lg p-2.5 text-sm",
                      msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    )}>
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1.5 [&>ul]:my-1 [&>h3]:text-sm [&>h3]:mt-2 [&>table]:text-xs">
                          <ReactMarkdown>{msg.content || (msg.isStreaming ? '...' : '')}</ReactMarkdown>
                          {msg.isStreaming && <Loader2 className="h-3 w-3 animate-spin inline-block mr-1" />}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>

                  {/* Feedback button for assistant messages */}
                  {msg.role === 'assistant' && !msg.isStreaming && msg.content && (
                    <div className="mr-9 mt-1">
                      {feedbackMsgId === msg.id ? (
                        <div className="flex gap-1.5 items-end">
                          <Textarea
                            value={feedbackText}
                            onChange={e => setFeedbackText(e.target.value)}
                            placeholder="ما التصحيح المطلوب؟"
                            className="text-xs min-h-[32px] h-8 resize-none flex-1"
                            rows={1}
                          />
                          <Button size="sm" className="h-8 text-[10px]" onClick={() => submitFeedback(msg.id)}>حفظ</Button>
                          <Button size="sm" variant="ghost" className="h-8 text-[10px]" onClick={() => setFeedbackMsgId(null)}>إلغاء</Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setFeedbackMsgId(msg.id)}
                          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ThumbsDown className="h-3 w-3" />
                          <span>تصحيح</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Action Cards */}
                  {msg.pending_approvals?.map(approval => (
                    <div key={approval.audit_id} className="mt-2 mr-9 border rounded-lg p-3 bg-card shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        <span className="text-xs font-medium">طلب موافقة</span>
                        <Badge variant={approval.status === 'approved' ? 'default' : approval.status === 'rejected' ? 'destructive' : 'secondary'} className="text-[10px]">
                          {approval.status === 'approved' ? 'تمت الموافقة' : approval.status === 'rejected' ? 'مرفوض' : 'بانتظار الموافقة'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{approval.tool_name}</p>
                      <pre className="text-[10px] bg-muted/50 p-1.5 rounded overflow-x-auto mb-2 max-h-20" dir="ltr">
                        {JSON.stringify(approval.params, null, 2)}
                      </pre>
                      {approval.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleApproval(approval.audit_id, true)}>
                            <CheckCircle className="h-3 w-3" /> موافقة
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={() => handleApproval(approval.audit_id, false)}>
                            <XCircle className="h-3 w-3" /> رفض
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="اسأل Sentinel AI..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={isLoading}
                className="flex-1 min-h-[40px] max-h-[100px] resize-none text-sm"
                rows={1}
              />
              <Button onClick={sendMessage} disabled={isLoading || !input.trim()} size="icon" className="h-10 w-10 shrink-0">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};
