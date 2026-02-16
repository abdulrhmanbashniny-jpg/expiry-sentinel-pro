import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Brain, Shield, TrendingUp, MessageSquare, Wrench, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const AGENTS = [
  { key: 'auditor', name: 'وكيل التدقيق', nameEn: 'Auditor Agent', icon: Shield, color: 'text-blue-600', bg: 'bg-blue-500/10' },
  { key: 'predictor', name: 'وكيل التنبؤ', nameEn: 'Predictor Agent', icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-500/10' },
  { key: 'communicator', name: 'وكيل التواصل', nameEn: 'Communicator Agent', icon: MessageSquare, color: 'text-green-600', bg: 'bg-green-500/10' },
];

export default function AIStatusDashboard() {
  const { data: tools, isLoading: toolsLoading } = useQuery({
    queryKey: ['ai-tools-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_tool_definitions')
        .select('tool_key, tool_name, tool_name_en, category, is_active, risk_level');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['ai-agents-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agent_configs')
        .select('agent_key, name, name_en, is_active, description');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: usageStats } = useQuery({
    queryKey: ['ai-usage-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_audit_trail')
        .select('id, status, created_at')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      if (error) throw error;
      return {
        total: data?.length || 0,
        successful: data?.filter(d => d.status === 'completed').length || 0,
        pending: data?.filter(d => d.status === 'pending').length || 0,
      };
    },
  });

  const isLoading = toolsLoading || agentsLoading;
  const activeTools = tools?.filter(t => t.is_active) || [];
  const activeAgents = agents?.filter(a => a.is_active) || [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Sentinel AI — لوحة الحالة
        </CardTitle>
        <CardDescription>
          حالة الوكلاء والأدوات المتصلة بمحرك الذكاء الاصطناعي
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold text-primary">{activeAgents.length}</p>
            <p className="text-xs text-muted-foreground">وكلاء نشطون</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold text-primary">{activeTools.length}</p>
            <p className="text-xs text-muted-foreground">أدوات مفعّلة</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold text-primary">{usageStats?.total || 0}</p>
            <p className="text-xs text-muted-foreground">عمليات (24 ساعة)</p>
          </div>
        </div>

        {/* Agents */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Brain className="h-4 w-4" />
            الوكلاء المتخصصون
          </h4>
          <div className="grid gap-2 sm:grid-cols-3">
            {AGENTS.map(agent => {
              const dbAgent = agents?.find(a => a.agent_key === agent.key);
              const isActive = dbAgent?.is_active ?? false;
              return (
                <div key={agent.key} className={`flex items-center gap-3 rounded-lg border p-3 ${isActive ? 'border-primary/20' : 'opacity-60'}`}>
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${agent.bg}`}>
                    <agent.icon className={`h-4 w-4 ${agent.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">{agent.nameEn}</p>
                  </div>
                  {isActive ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tools Grid */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            الأدوات المسجّلة ({tools?.length || 0})
          </h4>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {tools?.map(tool => (
              <div key={tool.tool_key} className="flex items-center gap-2 rounded border px-3 py-2 text-xs">
                {tool.is_active ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                ) : (
                  <XCircle className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                )}
                <span className="font-medium truncate flex-1">{tool.tool_name}</span>
                <Badge variant="outline" className="text-[10px] px-1.5">
                  {tool.risk_level === 'high' ? 'عالي' : tool.risk_level === 'medium' ? 'متوسط' : 'منخفض'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
