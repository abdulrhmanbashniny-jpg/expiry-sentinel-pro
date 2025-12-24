import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ScoreResult {
  reference_id: string;
  reference_name: string;
  score_type: 'department' | 'category' | 'person' | 'global';
  total_items: number;
  on_time_items: number;
  late_items: number;
  avg_delay_days: number;
  score: number;
}

function calculateScore(onTime: number, total: number, avgDelay: number = 0, riskLevel: string = 'medium'): number {
  if (total === 0) return 100;
  
  // Base score from on-time percentage
  let score = (onTime / total) * 100;
  
  // Penalty for average delay
  if (avgDelay > 0) {
    score -= Math.min(avgDelay * 2, 20); // Max 20 points penalty
  }
  
  // Risk level multiplier for late items
  const riskMultiplier = riskLevel === 'high' ? 1.5 : riskLevel === 'low' ? 0.5 : 1;
  const latePenalty = ((total - onTime) / total) * 10 * riskMultiplier;
  score -= latePenalty;
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { period_type = 'monthly' } = await req.json().catch(() => ({}));
    
    console.log(`Calculating compliance scores for period: ${period_type}`);
    
    // Calculate date range
    const now = new Date();
    let periodStart: Date;
    let periodEnd = new Date(now);
    
    switch (period_type) {
      case 'weekly':
        periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() - 7);
        break;
      case 'yearly':
        periodStart = new Date(now.getFullYear(), 0, 1);
        break;
      case 'monthly':
      default:
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }
    
    const periodStartStr = periodStart.toISOString().split('T')[0];
    const periodEndStr = periodEnd.toISOString().split('T')[0];
    
    console.log(`Period: ${periodStartStr} to ${periodEndStr}`);
    
    // Fetch all items within the period
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select(`
        id,
        title,
        expiry_date,
        status,
        owner_department,
        responsible_person,
        category_id,
        category:categories(id, name, risk_level),
        updated_at
      `)
      .gte('expiry_date', periodStartStr)
      .lte('expiry_date', periodEndStr);
    
    if (itemsError) {
      throw new Error(`Failed to fetch items: ${itemsError.message}`);
    }
    
    console.log(`Found ${items?.length || 0} items in period`);
    
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No items found in period',
        scores: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const today = new Date();
    const scores: ScoreResult[] = [];
    
    // Calculate by Department
    const deptStats: Record<string, { total: number; onTime: number; late: number; delayDays: number[] }> = {};
    
    // Calculate by Category
    const catStats: Record<string, { total: number; onTime: number; late: number; delayDays: number[]; risk: string; name: string }> = {};
    
    // Calculate by Person
    const personStats: Record<string, { total: number; onTime: number; late: number; delayDays: number[] }> = {};
    
    // Global stats
    let globalTotal = 0;
    let globalOnTime = 0;
    let globalLate = 0;
    const globalDelays: number[] = [];
    
    for (const item of items) {
      const expiryDate = new Date(item.expiry_date);
      const isLate = item.status === 'expired' || (expiryDate < today && item.status !== 'archived');
      
      // Calculate delay days if late
      let delayDays = 0;
      if (isLate) {
        const resolvedDate = item.status === 'archived' ? new Date(item.updated_at) : today;
        delayDays = Math.max(0, Math.ceil((resolvedDate.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24)));
      }
      
      globalTotal++;
      if (isLate) {
        globalLate++;
        globalDelays.push(delayDays);
      } else {
        globalOnTime++;
      }
      
      // Department stats
      const dept = item.owner_department || 'غير محدد';
      if (!deptStats[dept]) deptStats[dept] = { total: 0, onTime: 0, late: 0, delayDays: [] };
      deptStats[dept].total++;
      if (isLate) {
        deptStats[dept].late++;
        deptStats[dept].delayDays.push(delayDays);
      } else {
        deptStats[dept].onTime++;
      }
      
      // Category stats
      const catId = item.category_id || 'uncategorized';
      const catName = (item.category as any)?.name || 'بدون فئة';
      const catRisk = (item.category as any)?.risk_level || 'medium';
      if (!catStats[catId]) catStats[catId] = { total: 0, onTime: 0, late: 0, delayDays: [], risk: catRisk, name: catName };
      catStats[catId].total++;
      if (isLate) {
        catStats[catId].late++;
        catStats[catId].delayDays.push(delayDays);
      } else {
        catStats[catId].onTime++;
      }
      
      // Person stats
      const person = item.responsible_person || 'غير محدد';
      if (!personStats[person]) personStats[person] = { total: 0, onTime: 0, late: 0, delayDays: [] };
      personStats[person].total++;
      if (isLate) {
        personStats[person].late++;
        personStats[person].delayDays.push(delayDays);
      } else {
        personStats[person].onTime++;
      }
    }
    
    // Calculate averages and scores
    const avgDelay = (delays: number[]) => delays.length > 0 ? delays.reduce((a, b) => a + b, 0) / delays.length : 0;
    
    // Global score
    scores.push({
      reference_id: 'global',
      reference_name: 'النظام الكلي',
      score_type: 'global',
      total_items: globalTotal,
      on_time_items: globalOnTime,
      late_items: globalLate,
      avg_delay_days: avgDelay(globalDelays),
      score: calculateScore(globalOnTime, globalTotal, avgDelay(globalDelays))
    });
    
    // Department scores
    for (const [dept, stats] of Object.entries(deptStats)) {
      scores.push({
        reference_id: dept,
        reference_name: dept,
        score_type: 'department',
        total_items: stats.total,
        on_time_items: stats.onTime,
        late_items: stats.late,
        avg_delay_days: avgDelay(stats.delayDays),
        score: calculateScore(stats.onTime, stats.total, avgDelay(stats.delayDays))
      });
    }
    
    // Category scores
    for (const [catId, stats] of Object.entries(catStats)) {
      scores.push({
        reference_id: catId,
        reference_name: stats.name,
        score_type: 'category',
        total_items: stats.total,
        on_time_items: stats.onTime,
        late_items: stats.late,
        avg_delay_days: avgDelay(stats.delayDays),
        score: calculateScore(stats.onTime, stats.total, avgDelay(stats.delayDays), stats.risk)
      });
    }
    
    // Person scores (only for people with 3+ items)
    for (const [person, stats] of Object.entries(personStats)) {
      if (stats.total >= 3) {
        scores.push({
          reference_id: person,
          reference_name: person,
          score_type: 'person',
          total_items: stats.total,
          on_time_items: stats.onTime,
          late_items: stats.late,
          avg_delay_days: avgDelay(stats.delayDays),
          score: calculateScore(stats.onTime, stats.total, avgDelay(stats.delayDays))
        });
      }
    }
    
    // Insert scores into database
    const scoreRecords = scores.map(s => ({
      reference_id: s.reference_id,
      reference_name: s.reference_name,
      score_type: s.score_type,
      period_type,
      period_start: periodStartStr,
      period_end: periodEndStr,
      score: s.score,
      total_items: s.total_items,
      on_time_items: s.on_time_items,
      late_items: s.late_items,
      avg_delay_days: Math.round(s.avg_delay_days * 10) / 10,
      calculated_at: new Date().toISOString()
    }));
    
    const { error: insertError } = await supabase
      .from('compliance_scores')
      .insert(scoreRecords);
    
    if (insertError) {
      console.error('Failed to insert scores:', insertError);
      throw new Error(`Failed to save scores: ${insertError.message}`);
    }
    
    console.log(`Successfully saved ${scores.length} score records`);
    
    return new Response(JSON.stringify({
      success: true,
      period_type,
      period_start: periodStartStr,
      period_end: periodEndStr,
      scores_count: scores.length,
      global_score: scores.find(s => s.score_type === 'global')?.score || 0,
      scores
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('Calculate scores error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error?.message || 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
