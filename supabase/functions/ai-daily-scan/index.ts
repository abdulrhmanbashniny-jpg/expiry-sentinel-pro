import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PUBLISHED_APP_URL = 'https://expiry-sentinel-pro.lovable.app';

interface RiskItem {
  id: string;
  title: string;
  ref_number: string | null;
  expiry_date: string;
  days_left: number;
  department_name: string | null;
  category_name: string | null;
  workflow_status: string;
  risk_level: 'critical' | 'high' | 'medium' | 'low';
}

interface AuditIssue {
  item_id: string;
  item_title: string;
  ref_number: string | null;
  issue_type: string;
  description: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('=== AI Daily Scan Started ===');
  const startTime = Date.now();

  try {
    // Get all active tenants
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('is_active', true);

    if (!tenants || tenants.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active tenants' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allResults: Record<string, any> = {};

    for (const tenant of tenants) {
      console.log(`Processing tenant: ${tenant.name} (${tenant.id})`);

      // ─── 1. PREDICT EXPIRY RISK ───
      const now = new Date();
      const thirtyDaysOut = new Date();
      thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

      const { data: expiringItems } = await supabase
        .from('items')
        .select(`
          id, title, ref_number, expiry_date, workflow_status, status,
          category:categories(name),
          department:departments(name)
        `)
        .eq('tenant_id', tenant.id)
        .neq('status', 'archived')
        .lte('expiry_date', thirtyDaysOut.toISOString().split('T')[0])
        .order('expiry_date', { ascending: true });

      const riskItems: RiskItem[] = (expiringItems || []).map((item: any) => {
        const daysLeft = Math.ceil(
          (new Date(item.expiry_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        let risk_level: RiskItem['risk_level'] = 'low';
        if (daysLeft < 0) risk_level = 'critical';
        else if (daysLeft <= 7) risk_level = 'high';
        else if (daysLeft <= 14) risk_level = 'medium';

        return {
          id: item.id,
          title: item.title,
          ref_number: item.ref_number,
          expiry_date: item.expiry_date,
          days_left: daysLeft,
          department_name: item.department?.name || null,
          category_name: item.category?.name || null,
          workflow_status: item.workflow_status || 'new',
          risk_level,
        };
      });

      const criticalItems = riskItems.filter(i => i.risk_level === 'critical');
      const highRiskItems = riskItems.filter(i => i.risk_level === 'high');
      const mediumRiskItems = riskItems.filter(i => i.risk_level === 'medium');

      // ─── 2. AUDIT DATE CONSISTENCY ───
      const auditIssues: AuditIssue[] = [];

      // Check items with no workflow action taken but expiry is near
      const staleItems = riskItems.filter(
        i => i.days_left <= 7 && i.workflow_status === 'new'
      );
      for (const item of staleItems) {
        auditIssues.push({
          item_id: item.id,
          item_title: item.title,
          ref_number: item.ref_number,
          issue_type: 'stale_workflow',
          description: `المعاملة "${item.title}" تنتهي خلال ${item.days_left} يوم ولم يتم اتخاذ أي إجراء`,
        });
      }

      // Check expired items still not finished
      const expiredNotFinished = riskItems.filter(
        i => i.days_left < 0 && !['finished', 'archived'].includes(i.workflow_status)
      );
      for (const item of expiredNotFinished) {
        auditIssues.push({
          item_id: item.id,
          item_title: item.title,
          ref_number: item.ref_number,
          issue_type: 'expired_unfinished',
          description: `المعاملة "${item.title}" منتهية منذ ${Math.abs(item.days_left)} يوم ولم يتم إنهاؤها`,
        });
      }

      // Check contracts expiring soon
      const { data: expiringContracts } = await supabase
        .from('contracts')
        .select('id, title, contract_number, end_date, status')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active')
        .lte('end_date', thirtyDaysOut.toISOString().split('T')[0])
        .gte('end_date', now.toISOString().split('T')[0]);

      for (const contract of expiringContracts || []) {
        const daysLeft = Math.ceil(
          (new Date(contract.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysLeft <= 14) {
          auditIssues.push({
            item_id: contract.id,
            item_title: contract.title,
            ref_number: contract.contract_number,
            issue_type: 'contract_expiring',
            description: `العقد "${contract.title}" ينتهي خلال ${daysLeft} يوم`,
          });
        }
      }

      // ─── 3. STORE RISK PREDICTIONS ───
      for (const item of [...criticalItems, ...highRiskItems].slice(0, 50)) {
        await supabase.from('ai_risk_predictions').upsert(
          {
            tenant_id: tenant.id,
            entity_id: item.id,
            entity_type: 'item',
            risk_level: item.risk_level,
            risk_score: item.risk_level === 'critical' ? 95 : 75,
            confidence_score: 0.9,
            predicted_delay_days: Math.max(0, -item.days_left),
            risk_factors: [
              { factor: 'days_left', value: item.days_left },
              { factor: 'workflow_status', value: item.workflow_status },
            ],
            recommendations: [
              item.days_left < 0
                ? 'يجب اتخاذ إجراء فوري - المعاملة منتهية'
                : `يجب إنهاء المعاملة قبل ${item.days_left} يوم`,
            ],
            analyzed_at: now.toISOString(),
            expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          },
          { onConflict: 'id' }
        );
      }

      // ─── 4. GENERATE DAILY REPORT ───
      const today = now.toISOString().split('T')[0];

      // Build deep links for the report
      const criticalDeepLinks = criticalItems.slice(0, 10).map(i => ({
        title: i.title,
        ref: i.ref_number,
        days: i.days_left,
        url: `${PUBLISHED_APP_URL}/items/${i.id}`,
      }));
      const highRiskDeepLinks = highRiskItems.slice(0, 10).map(i => ({
        title: i.title,
        ref: i.ref_number,
        days: i.days_left,
        url: `${PUBLISHED_APP_URL}/items/${i.id}`,
      }));
      const auditDeepLinks = auditIssues.slice(0, 10).map(a => ({
        title: a.item_title,
        ref: a.ref_number,
        issue: a.description,
        url: a.issue_type === 'contract_expiring'
          ? `${PUBLISHED_APP_URL}/contracts`
          : `${PUBLISHED_APP_URL}/items/${a.item_id}`,
      }));

      const reportData = {
        scan_date: today,
        tenant_id: tenant.id,
        summary: {
          total_expiring_30_days: riskItems.length,
          critical: criticalItems.length,
          high_risk: highRiskItems.length,
          medium_risk: mediumRiskItems.length,
          audit_issues: auditIssues.length,
          contracts_expiring: expiringContracts?.length || 0,
        },
        critical_items: criticalDeepLinks,
        high_risk_items: highRiskDeepLinks,
        audit_issues: auditDeepLinks,
      };

      const summaryText = `📊 تقرير الفحص اليومي - ${today}

🔴 حرج: ${criticalItems.length} معاملة منتهية
🟠 مرتفع: ${highRiskItems.length} معاملة (أقل من 7 أيام)
🟡 متوسط: ${mediumRiskItems.length} معاملة (أقل من 14 يوم)
⚠️ مشكلات تدقيق: ${auditIssues.length}
📋 عقود قريبة الانتهاء: ${expiringContracts?.length || 0}

${criticalItems.length > 0 ? '⚡ أهم المعاملات الحرجة:\n' + criticalItems.slice(0, 5).map(i =>
  `  • ${i.title} (${i.ref_number || '-'}) - منتهية منذ ${Math.abs(i.days_left)} يوم`
).join('\n') : '✅ لا توجد معاملات حرجة'}`;

      await supabase.from('compliance_reports').insert({
        tenant_id: tenant.id,
        title: `تقرير الفحص اليومي الذكي - ${today}`,
        report_type: 'ai_daily_scan',
        period_start: today,
        period_end: today,
        report_data: reportData,
        summary_text: summaryText,
      });

      // ─── 5. SEND IN-APP NOTIFICATIONS TO ADMINS ───
      const { data: adminUsers } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('tenant_id', tenant.id)
        .in('user_id', (
          await supabase
            .from('user_roles')
            .select('user_id')
            .in('role', ['system_admin', 'admin'])
        ).data?.map((r: any) => r.user_id) || []);

      const notificationTitle = `🤖 تقرير Sentinel اليومي - ${criticalItems.length > 0 ? '🔴 يوجد حرج' : '✅ وضع طبيعي'}`;
      const notificationMessage = `${summaryText}\n\n🔗 عرض التقرير الكامل:\n${PUBLISHED_APP_URL}/compliance-reports`;

      for (const admin of adminUsers || []) {
        await supabase.from('in_app_notifications').insert({
          tenant_id: tenant.id,
          user_id: admin.user_id,
          entity_type: 'compliance_report',
          notification_type: 'ai_daily_scan',
          title: notificationTitle,
          message: notificationMessage,
          priority: criticalItems.length > 0 ? 'critical' : 'normal',
          action_url: '/compliance-reports',
        });
      }

      allResults[tenant.id] = reportData.summary;
      console.log(`✅ Tenant ${tenant.name}: ${criticalItems.length} critical, ${highRiskItems.length} high, ${auditIssues.length} issues`);
    }

    const duration = Date.now() - startTime;
    console.log(`=== AI Daily Scan Complete (${duration}ms) ===`);

    // Log automation run
    await supabase.from('automation_runs').insert({
      job_type: 'ai_daily_scan',
      status: 'success',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      items_processed: Object.keys(allResults).length,
      items_success: Object.keys(allResults).length,
      items_failed: 0,
      results: allResults,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `AI Daily Scan complete for ${tenants.length} tenants`,
        results: allResults,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('AI Daily Scan error:', error);

    await supabase.from('automation_runs').insert({
      job_type: 'ai_daily_scan',
      status: 'failed',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
