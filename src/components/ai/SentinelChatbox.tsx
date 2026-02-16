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
  User, CheckCircle, XCircle, AlertTriangle, Sparkles
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
  '/compliance-reports': 'تقارير الامتثال',
};

export const SentinelChatbox = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
          a.audit_id === auditId ? { ...a, status: approved ? 'approved' : 'rejected' } : a
        )
      })));

      toast.success(approved ? 'تمت الموافقة على العملية' : 'تم رفض العملية');
    } catch (e: any) {
      toast.error('فشل في تحديث حالة الموافقة');
    }
  }, [user]);

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

      if (!response.ok) {
        throw new Error('فشل في الاتصال بالخادم');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No stream available');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let approvals: ApprovalCard[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7);
            continue;
          }
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const eventLine = lines[lines.indexOf(line) - 1];
              const eventType = eventLine?.startsWith('event: ') ? eventLine.slice(7) : 'unknown';

              if (eventType === 'token') {
                fullText += data.text;
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: fullText } : m
                ));
              } else if (eventType === 'thinking') {
                // Show thinking status
              } else if (eventType === 'tool_call') {
                fullText += `\n\n🔧 *جاري تنفيذ: ${data.tool}...*\n`;
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: fullText } : m
                ));
              } else if (eventType === 'observation') {
                // Tool result received, AI will continue
              } else if (eventType === 'approval_needed') {
                approvals.push({
                  audit_id: data.audit_id,
                  tool_key: data.tool_key,
                  tool_name: data.tool_name,
                  params: data.params,
                  status: 'pending',
                });
              } else if (eventType === 'done') {
                if (data.full_response && !fullText) {
                  fullText = data.full_response;
                }
                if (data.pending_approvals?.length > 0) {
                  approvals = data.pending_approvals.map((a: any) => ({ ...a, status: 'pending' }));
                }
              } else if (eventType === 'error') {
                fullText += `\n\n⚠️ ${data.message}`;
              }
            } catch (e) {
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

  // Floating button when closed
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
          <Bot className="h-5 w-5" />
          <span className="font-semibold text-sm">Sentinel AI</span>
          <Badge variant="outline" className="text-[10px] border-primary-foreground/30 text-primary-foreground/80">
            {currentPage}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
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
              <div className="text-center text-muted-foreground py-8 px-4">
                <Bot className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium text-sm">مرحباً! أنا Sentinel AI</p>
                <p className="text-xs mt-1">مستشارك الذكي للموارد البشرية والامتثال</p>
                <div className="mt-4 space-y-1.5 text-xs text-right">
                  <p className="text-muted-foreground/70">جرّب أن تسألني:</p>
                  {[
                    'ما هي العناصر المنتهية قريباً؟',
                    'أعطني إحصائيات الأداء',
                    'حلل المخاطر الحالية',
                  ].map((q, i) => (
                    <button key={i} onClick={() => { setInput(q); }}
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
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1.5 [&>ul]:my-1 [&>h3]:text-sm [&>h3]:mt-2">
                          <ReactMarkdown>{msg.content || (msg.isStreaming ? '...' : '')}</ReactMarkdown>
                          {msg.isStreaming && <Loader2 className="h-3 w-3 animate-spin inline-block mr-1" />}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>

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
                      <pre className="text-[10px] bg-muted/50 p-1.5 rounded overflow-x-auto mb-2 max-h-20">
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
                ref={inputRef}
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
