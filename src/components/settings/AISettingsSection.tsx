import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Brain, Shield, TrendingUp, MessageSquare, FileText, Bell, Briefcase, Users, Save, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

const AGENT_ITEMS = [
  { key: 'auditor', name: 'وكيل التدقيق', description: 'يفحص التواريخ والبيانات المفقودة', icon: Shield, color: 'text-blue-600' },
  { key: 'predictor', name: 'وكيل التنبؤ', description: 'يتنبأ بمخاطر انتهاء الوثائق', icon: TrendingUp, color: 'text-amber-600' },
  { key: 'communicator', name: 'وكيل التواصل', description: 'يصيغ رسائل تذكير احترافية', icon: MessageSquare, color: 'text-green-600' },
];

const MODULE_ITEMS = [
  { key: 'reminders', name: 'التذكيرات', icon: Bell },
  { key: 'contracts', name: 'العقود', icon: Briefcase },
  { key: 'evaluations', name: 'التقييمات', icon: FileText },
  { key: 'departments', name: 'الأقسام', icon: Users },
];

const TONE_OPTIONS = [
  { value: 'professional', label: 'رسمي (Professional)' },
  { value: 'friendly', label: 'ودّي (Friendly)' },
  { value: 'urgent', label: 'عاجل (Urgent)' },
];

export default function AISettingsSection() {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['ai-agent-configs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_agent_configs').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: settingsData } = useQuery({
    queryKey: ['ai-system-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'ai_settings')
        .maybeSingle();
      if (error) throw error;
      return (data?.value as Record<string, any>) || {};
    },
  });

  const [agentStates, setAgentStates] = useState<Record<string, boolean>>({});
  const [moduleStates, setModuleStates] = useState<Record<string, boolean>>({
    reminders: true, contracts: true, evaluations: true, departments: true,
  });
  const [tone, setTone] = useState('professional');

  useEffect(() => {
    if (agents) {
      const states: Record<string, boolean> = {};
      agents.forEach(a => { states[a.agent_key] = a.is_active ?? false; });
      setAgentStates(states);
    }
  }, [agents]);

  useEffect(() => {
    if (settingsData) {
      if (settingsData.modules) setModuleStates(settingsData.modules);
      if (settingsData.tone) setTone(settingsData.tone);
    }
  }, [settingsData]);

  const toggleAgent = useMutation({
    mutationFn: async ({ key, active }: { key: string; active: boolean }) => {
      const { error } = await supabase
        .from('ai_agent_configs')
        .update({ is_active: active })
        .eq('agent_key', key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-configs'] });
      queryClient.invalidateQueries({ queryKey: ['ai-agents-status'] });
    },
  });

  const handleAgentToggle = (key: string) => {
    const newState = !agentStates[key];
    setAgentStates(prev => ({ ...prev, [key]: newState }));
    toggleAgent.mutate({ key, active: newState });
  };

  const handleModuleToggle = (key: string) => {
    setModuleStates(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'ai_settings',
          value: { modules: moduleStates, tone } as any,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });
      if (error) throw error;
      toast.success('تم حفظ إعدادات الذكاء الاصطناعي');
      queryClient.invalidateQueries({ queryKey: ['ai-system-settings'] });
    } catch (err: any) {
      toast.error(err.message || 'فشل الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  if (agentsLoading) {
    return (
      <Card><CardContent className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </CardContent></Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          إعدادات Sentinel AI
        </CardTitle>
        <CardDescription>تحكم في الوكلاء والوحدات ونبرة التواصل</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Agent Toggles */}
        <div>
          <h4 className="text-sm font-semibold mb-3">الوكلاء المتخصصون</h4>
          <div className="space-y-3">
            {AGENT_ITEMS.map(agent => (
              <div key={agent.key} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <agent.icon className={`h-5 w-5 ${agent.color}`} />
                  <div>
                    <Label className="text-sm font-medium">{agent.name}</Label>
                    <p className="text-xs text-muted-foreground">{agent.description}</p>
                  </div>
                </div>
                <Switch
                  checked={agentStates[agent.key] ?? false}
                  onCheckedChange={() => handleAgentToggle(agent.key)}
                />
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Module Scoping */}
        <div>
          <h4 className="text-sm font-semibold mb-3">نطاق معالجة الذكاء الاصطناعي</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {MODULE_ITEMS.map(mod => (
              <div key={mod.key} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <mod.icon className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm">{mod.name}</Label>
                </div>
                <Switch
                  checked={moduleStates[mod.key] ?? false}
                  onCheckedChange={() => handleModuleToggle(mod.key)}
                />
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Tone Selection */}
        <div>
          <h4 className="text-sm font-semibold mb-3">نبرة التواصل</h4>
          <Select value={tone} onValueChange={setTone}>
            <SelectTrigger className="w-full sm:w-[300px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TONE_OPTIONS.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">يؤثر على أسلوب رسائل التذكير والردود</p>
        </div>

        <Button onClick={handleSaveSettings} disabled={isSaving} className="w-full sm:w-auto">
          {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
          حفظ الإعدادات
        </Button>
      </CardContent>
    </Card>
  );
}
