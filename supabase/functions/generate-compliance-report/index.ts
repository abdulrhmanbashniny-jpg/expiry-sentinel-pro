import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

async function generateAISummary(reportData: any): Promise<string> {
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `أنت محلل بيانات متخصص في تقارير الامتثال. اكتب ملخصاً تحليلياً مختصراً (5-7 جمل) بالعربية.
ركز على:
1. أسوأ الأقسام/الفئات أداءً
2. أكثر أنواع المعاملات تأخيراً
3. اتجاه الأداء (تحسن/تراجع)
4. توصيات عملية محددة`
          },
          {
            role: 'user',
            content: `حلل هذه البيانات واكتب ملخصاً:
${JSON.stringify(reportData, null, 2)}`
          }
        ],
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content || 'لم يتم إنشاء ملخص';
  } catch (error) {
    console.error('AI summary error:', error);
    return 'تعذر إنشاء ملخص تحليلي';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { report_type = 'monthly', send_notification = false } = await req.json().catch(() => ({}));
    
    console.log(`Generating ${report_type} compliance report`);
    
    // Calculate date range
    const now = new Date();
    let periodStart: Date;
    let periodEnd = new Date(now);
    let reportTitle: string;
    
    switch (report_type) {
      case 'weekly':
        periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() - 7);
        reportTitle = `التقرير الأسبوعي - ${periodStart.toLocaleDateString('ar-SA')} إلى ${periodEnd.toLocaleDateString('ar-SA')}`;
        break;
      case 'yearly':
        periodStart = new Date(now.getFullYear(), 0, 1);
        reportTitle = `التقرير السنوي - ${now.getFullYear()}`;
        break;
      case 'monthly':
      default:
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        reportTitle = `التقرير الشهري - ${now.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' })}`;
        break;
    }
    
    const periodStartStr = periodStart.toISOString().split('T')[0];
    const periodEndStr = periodEnd.toISOString().split('T')[0];
    
    // First, calculate fresh scores
    const calculateResponse = await supabase.functions.invoke('calculate-compliance-scores', {
      body: { period_type: report_type }
    });
    
    if (calculateResponse.error) {
      console.error('Failed to calculate scores:', calculateResponse.error);
    }
    
    // Fetch latest scores
    const { data: scores } = await supabase
      .from('compliance_scores')
      .select('*')
      .eq('period_type', report_type)
      .eq('period_start', periodStartStr)
      .order('created_at', { ascending: false });
    
    // Fetch items statistics
    const { data: items } = await supabase
      .from('items')
      .select(`
        id,
        title,
        expiry_date,
        status,
        owner_department,
        responsible_person,
        category:categories(name, risk_level)
      `)
      .gte('expiry_date', periodStartStr)
      .lte('expiry_date', periodEndStr);
    
    // Fetch delay reasons from notification_log
    const { data: notifications } = await supabase
      .from('notification_log')
      .select('delay_reason, item_id')
      .not('delay_reason', 'is', null)
      .gte('created_at', periodStart.toISOString());
    
    // Build report data
    const globalScore = scores?.find(s => s.score_type === 'global');
    const departmentScores = scores?.filter(s => s.score_type === 'department') || [];
    const categoryScores = scores?.filter(s => s.score_type === 'category') || [];
    const personScores = scores?.filter(s => s.score_type === 'person') || [];
    
    // Find worst performers
    const worstDepartments = [...departmentScores].sort((a, b) => a.score - b.score).slice(0, 3);
    const worstCategories = [...categoryScores].sort((a, b) => a.score - b.score).slice(0, 3);
    const worstPersons = [...personScores].sort((a, b) => a.score - b.score).slice(0, 5);
    
    // Analyze delay reasons
    const delayReasons: Record<string, number> = {};
    notifications?.forEach(n => {
      if (n.delay_reason) {
        delayReasons[n.delay_reason] = (delayReasons[n.delay_reason] || 0) + 1;
      }
    });
    
    // High risk items that are late
    const highRiskLate = items?.filter(i => 
      (i.category as any)?.risk_level === 'high' && 
      (i.status === 'expired' || new Date(i.expiry_date) < now)
    ) || [];
    
    const reportData = {
      period: { start: periodStartStr, end: periodEndStr, type: report_type },
      summary: {
        global_score: globalScore?.score || 0,
        total_items: globalScore?.total_items || 0,
        on_time_items: globalScore?.on_time_items || 0,
        late_items: globalScore?.late_items || 0,
        avg_delay_days: globalScore?.avg_delay_days || 0
      },
      departments: {
        total: departmentScores.length,
        best: [...departmentScores].sort((a, b) => b.score - a.score).slice(0, 3),
        worst: worstDepartments
      },
      categories: {
        total: categoryScores.length,
        worst: worstCategories,
        high_risk_late: highRiskLate.length
      },
      persons: {
        total: personScores.length,
        worst: worstPersons
      },
      delay_reasons: delayReasons,
      high_risk_alerts: highRiskLate.map(i => ({
        title: i.title,
        expiry_date: i.expiry_date,
        responsible: i.responsible_person
      }))
    };
    
    // Generate AI summary
    console.log('Generating AI analysis...');
    const aiAnalysis = await generateAISummary(reportData);
    
    // Build summary text
    const summaryText = `📊 ${reportTitle}

الدرجة الكلية: ${reportData.summary.global_score}/100 ${reportData.summary.global_score >= 80 ? '🟢' : reportData.summary.global_score >= 60 ? '🟡' : '🔴'}

📋 إجمالي المعاملات: ${reportData.summary.total_items}
✅ في الوقت: ${reportData.summary.on_time_items}
❌ متأخرة: ${reportData.summary.late_items}
⏱️ متوسط التأخير: ${reportData.summary.avg_delay_days} يوم

⚠️ تنبيهات عالية الخطورة: ${reportData.high_risk_alerts.length}

📉 أسوأ الأقسام:
${worstDepartments.map((d, i) => `${i + 1}. ${d.reference_name}: ${d.score}%`).join('\n')}

📁 أسوأ الفئات:
${worstCategories.map((c, i) => `${i + 1}. ${c.reference_name}: ${c.score}%`).join('\n')}`;
    
    // Save report
    const { data: report, error: saveError } = await supabase
      .from('compliance_reports')
      .insert({
        title: reportTitle,
        report_type,
        period_start: periodStartStr,
        period_end: periodEndStr,
        report_data: reportData,
        summary_text: summaryText,
        ai_analysis: aiAnalysis
      })
      .select()
      .single();
    
    if (saveError) {
      throw new Error(`Failed to save report: ${saveError.message}`);
    }
    
    console.log(`Report saved with ID: ${report.id}`);
    
    // Send notification if requested
    if (send_notification) {
      // Get admin telegram IDs
      const { data: admins } = await supabase
        .from('profiles')
        .select('telegram_user_id, user_id')
        .not('telegram_user_id', 'is', null);
      
      for (const admin of admins || []) {
        // Check if admin
        const { data: role } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', admin.user_id)
          .single();
        
        if (role && ['admin', 'system_admin'].includes(role.role)) {
          try {
            await supabase.functions.invoke('send-telegram', {
              body: {
                chat_id: admin.telegram_user_id,
                message: `${summaryText}\n\n📝 تحليل AI:\n${aiAnalysis}`
              }
            });
            console.log(`Report sent to admin: ${admin.user_id}`);
          } catch (e) {
            console.error(`Failed to send to admin ${admin.user_id}:`, e);
          }
        }
      }
      
      // Update sent_at
      await supabase
        .from('compliance_reports')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', report.id);
    }
    
    return new Response(JSON.stringify({
      success: true,
      report_id: report.id,
      title: reportTitle,
      global_score: reportData.summary.global_score,
      summary_text: summaryText,
      ai_analysis: aiAnalysis
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('Generate report error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error?.message || 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
