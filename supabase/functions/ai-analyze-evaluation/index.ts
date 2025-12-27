import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { evaluation_id, prompt_key = 'evaluation_analysis' } = await req.json();

    if (!evaluation_id) {
      return new Response(
        JSON.stringify({ error: 'evaluation_id مطلوب' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing evaluation: ${evaluation_id}`);

    // Fetch evaluation with answers
    const { data: evaluation, error: evalError } = await supabaseAdmin
      .from('evaluations')
      .select(`
        *,
        evaluation_answers(
          *,
          kpi_template_questions(question_text, answer_type, weight)
        )
      `)
      .eq('id', evaluation_id)
      .single();

    if (evalError || !evaluation) {
      console.error('Evaluation fetch error:', evalError);
      return new Response(
        JSON.stringify({ error: 'لم يتم العثور على التقييم' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch prompt settings
    const { data: promptSettings } = await supabaseAdmin
      .from('ai_prompts')
      .select('*')
      .eq('prompt_key', prompt_key)
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get active AI provider
    const { data: providers } = await supabaseAdmin
      .from('ai_provider_settings')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true });

    // Build evaluation summary for AI
    const evaluationSummary = buildEvaluationSummary(evaluation);

    // Default prompts
    const systemPrompt = promptSettings?.system_memory || 
      `أنت محلل تقييمات أداء متخصص. قم بتحليل التقييم وتقديم:
      1. ملخص موجز (3-4 جمل) يصلح لعرضه للموظف
      2. نقاط القوة الرئيسية
      3. مجالات التحسين
      4. توصيات تطويرية
      كن إيجابياً ومهنياً ولا تذكر أي معلومات عن هوية المقيم.`;

    const userPrompt = promptSettings?.prompt_text?.replace('{{evaluation_data}}', evaluationSummary) ||
      `قم بتحليل التقييم التالي:\n\n${evaluationSummary}`;

    let aiResult = null;
    let providerUsed = 'lovable_ai';
    let success = false;
    let errorMessage: string | null = null;

    // Try Lovable AI first
    if (lovableApiKey) {
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
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          aiResult = data.choices?.[0]?.message?.content;
          success = true;
          console.log('Lovable AI analysis successful');
        } else if (response.status === 429 || response.status === 402) {
          console.log('Lovable AI rate limited, trying fallback...');
          providerUsed = 'fallback';
        } else {
          const errText = await response.text();
          console.error('Lovable AI error:', response.status, errText);
          errorMessage = errText;
        }
      } catch (err: unknown) {
        console.error('Lovable AI request failed:', err);
        errorMessage = err instanceof Error ? err.message : 'Unknown error';
      }
    }

    // Fallback to configured providers if Lovable AI fails
    if (!success && providers && providers.length > 0) {
      for (const provider of providers) {
        if (provider.usage_limit && provider.usage_count >= provider.usage_limit) {
          console.log(`Provider ${provider.provider_name} at usage limit`);
          continue;
        }

        try {
          // This is a placeholder - in production, configure actual fallback providers
          console.log(`Trying fallback provider: ${provider.provider_name}`);
          providerUsed = provider.provider_name;
          
          // For now, generate a basic summary without AI
          if (!success) {
            aiResult = generateBasicSummary(evaluation);
            success = true;
            console.log('Using basic summary as fallback');
          }
          break;
        } catch (err) {
          console.error(`Provider ${provider.provider_name} failed:`, err);
          continue;
        }
      }
    }

    // Final fallback: basic summary
    if (!success) {
      aiResult = generateBasicSummary(evaluation);
      providerUsed = 'basic_fallback';
      success = true;
    }

    const responseTime = Date.now() - startTime;

    // Log AI usage
    await supabaseAdmin
      .from('ai_usage_log')
      .insert({
        provider_name: providerUsed,
        prompt_key: prompt_key,
        success: success,
        response_time_ms: responseTime,
        error_message: errorMessage,
      });

    // Update evaluation with AI analysis
    const { error: updateError } = await supabaseAdmin
      .from('evaluations')
      .update({
        ai_summary: aiResult,
        ai_analyzed_at: new Date().toISOString(),
      })
      .eq('id', evaluation_id);

    if (updateError) {
      console.error('Failed to update evaluation with AI summary:', updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        ai_summary: aiResult,
        provider: providerUsed,
        response_time_ms: responseTime,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('AI analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : 'خطأ في تحليل التقييم';
    
    // Log failure
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    
    await supabaseAdmin
      .from('ai_usage_log')
      .insert({
        provider_name: 'error',
        prompt_key: 'evaluation_analysis',
        success: false,
        response_time_ms: Date.now() - startTime,
        error_message: errorMessage,
      });

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildEvaluationSummary(evaluation: any): string {
  let summary = `الدرجة الإجمالية: ${evaluation.total_score || 'غير محسوبة'}\n\n`;
  summary += `نوع التقييم: ${evaluation.evaluation_type}\n`;
  summary += `الحالة: ${evaluation.status}\n\n`;
  summary += `الإجابات:\n`;

  if (evaluation.evaluation_answers) {
    for (const answer of evaluation.evaluation_answers) {
      const question = answer.kpi_template_questions;
      if (question) {
        summary += `- ${question.question_text}: `;
        if (answer.numeric_value !== null) {
          summary += `${answer.numeric_value}`;
        } else if (answer.choice_value) {
          summary += answer.choice_value;
        } else if (answer.text_value) {
          summary += answer.text_value;
        }
        summary += ` (الوزن: ${question.weight}%)\n`;
      }
    }
  }

  return summary;
}

function generateBasicSummary(evaluation: any): string {
  const score = evaluation.total_score || 0;
  let rating = 'جيد';
  
  if (score >= 90) rating = 'ممتاز';
  else if (score >= 80) rating = 'جيد جداً';
  else if (score >= 70) rating = 'جيد';
  else if (score >= 60) rating = 'مقبول';
  else rating = 'يحتاج تحسين';

  return `التقييم العام: ${rating}\n\n` +
    `حصل الموظف على درجة ${score}% في هذا التقييم. ` +
    `نوصي بمواصلة التطوير والتحسين المستمر في جميع المجالات.`;
}
