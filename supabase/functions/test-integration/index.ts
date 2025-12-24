import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

// Authentication helper
async function verifyAuth(req: Request) {
  // 1) مفتاح داخلي للاستدعاءات الخلفية
  const internalKey = req.headers.get('x-internal-key');
  const expectedKey = Deno.env.get('INTERNAL_FUNCTION_KEY');
  
  if (internalKey && expectedKey && internalKey === expectedKey) {
    return { user: { id: 'internal-system' }, error: null };
  }

  // 2) JWT من Supabase Auth
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, error: 'Missing authorization header' };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, error: 'Unauthorized' };
  }
  return { user, error: null };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const { user, error: authError } = await verifyAuth(req);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { integration_key } = await req.json();
    
    console.log(`Testing integration: ${integration_key}, by user: ${user.id}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get integration config
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('key', integration_key)
      .single();

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'التكامل غير موجود',
          code: 'NOT_FOUND'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = integration.config as Record<string, any>;
    let result: { success: boolean; message: string; details?: any };

    switch (integration_key) {
      case 'telegram':
        result = await testTelegram(config);
        break;
      case 'whatsapp':
        result = await testWhatsApp(config);
        break;
      case 'n8n':
        result = await testN8n(config);
        break;
      case 'ai_assistant':
        result = await testAI(config);
        break;
      default:
        result = { success: false, message: 'نوع تكامل غير معروف' };
    }

    console.log(`Integration test result for ${integration_key}:`, result);

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error('Error in test-integration:', error);
    const errorMessage = error instanceof Error ? error.message : 'حدث خطأ في النظام';
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: errorMessage,
        code: 'INTERNAL_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============ Test Functions ============

async function testTelegram(config: Record<string, any>): Promise<{ success: boolean; message: string; details?: any }> {
  const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = config.default_chat_id;

  if (!TELEGRAM_BOT_TOKEN) {
    return { 
      success: false, 
      message: 'لم يتم تكوين Bot Token في الإعدادات السرية',
      details: { missing: 'TELEGRAM_BOT_TOKEN secret' }
    };
  }

  if (!chatId) {
    return { 
      success: false, 
      message: 'يرجى إدخال Default Chat ID في إعدادات التكامل',
      details: { missing: 'default_chat_id' }
    };
  }

  try {
    // Test by getting bot info
    const botInfoUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`;
    const botResponse = await fetch(botInfoUrl);
    const botResult = await botResponse.json();

    if (!botResult.ok) {
      return { 
        success: false, 
        message: `Bot Token غير صالح: ${botResult.description}`,
        details: botResult
      };
    }

    // Send test message
    const testMessage = `✅ اختبار اتصال ناجح!
    
🤖 Bot: @${botResult.result.username}
📅 التاريخ: ${new Date().toLocaleString('ar-SA')}

HR Expiry Reminder System`;

    const sendUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const sendResponse = await fetch(sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: testMessage,
        parse_mode: 'HTML',
      }),
    });

    const sendResult = await sendResponse.json();

    if (!sendResult.ok) {
      return { 
        success: false, 
        message: `فشل إرسال الرسالة: ${sendResult.description}`,
        details: { error_code: sendResult.error_code }
      };
    }

    return { 
      success: true, 
      message: `تم الاتصال بنجاح! Bot: @${botResult.result.username}`,
      details: {
        bot_username: botResult.result.username,
        message_id: sendResult.result.message_id
      }
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { 
      success: false, 
      message: `خطأ في الاتصال: ${errorMessage}`,
      details: { error: errorMessage }
    };
  }
}

async function testWhatsApp(config: Record<string, any>): Promise<{ success: boolean; message: string; details?: any }> {
  const apiBaseUrl = config.api_base_url;
  const accessToken = config.access_token;
  const phoneNumberId = config.phone_number_id;

  if (!apiBaseUrl) {
    return { 
      success: false, 
      message: 'يرجى إدخال API Base URL (مثال: https://app.appslink.io/api/v1)',
      details: { missing: 'api_base_url' }
    };
  }

  if (!accessToken) {
    return { 
      success: false, 
      message: 'يرجى إدخال Access Token / API Key',
      details: { missing: 'access_token' }
    };
  }

  // Validate URL format
  const cleanBaseUrl = apiBaseUrl.replace(/\/$/, '');
  if (!cleanBaseUrl.startsWith('http://') && !cleanBaseUrl.startsWith('https://')) {
    return {
      success: false,
      message: 'API Base URL يجب أن يبدأ بـ http:// أو https://',
      details: { invalid: 'api_base_url format' }
    };
  }

  try {
    console.log('Testing WhatsApp/AppsLink connection:', { apiBaseUrl: cleanBaseUrl, hasToken: !!accessToken });

    // Try multiple possible endpoints that AppsLink might have
    const possibleEndpoints = [
      '/instance/info',
      '/instance/status', 
      '/account/info',
      '/me',
      '/check'
    ];

    let lastResponse: Response | null = null;
    let lastError: string | null = null;

    for (const endpoint of possibleEndpoints) {
      try {
        const testUrl = `${cleanBaseUrl}${endpoint}`;
        console.log(`Trying endpoint: ${testUrl}`);

        const response = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'x-api-key': accessToken, // Some APIs use this header instead
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        lastResponse = response;
        const contentType = response.headers.get('content-type') || '';

        // Check if response is HTML (wrong endpoint)
        if (contentType.includes('text/html')) {
          console.log(`Endpoint ${endpoint} returned HTML, skipping...`);
          continue;
        }

        // Try to parse as JSON
        const responseText = await response.text();
        
        // Check if it looks like HTML
        if (responseText.trim().startsWith('<!') || responseText.trim().startsWith('<html')) {
          console.log(`Endpoint ${endpoint} returned HTML content, skipping...`);
          continue;
        }

        // Try to parse as JSON
        try {
          const data = JSON.parse(responseText);
          
          if (response.ok) {
            return { 
              success: true, 
              message: 'تم الاتصال بـ AppsLink بنجاح!',
              details: { endpoint, data }
            };
          } else if (response.status === 401 || response.status === 403) {
            return {
              success: false,
              message: 'Access Token غير صالح أو منتهي الصلاحية',
              details: { status: response.status, error: data }
            };
          }
        } catch {
          // Not valid JSON
          lastError = responseText.substring(0, 100);
          continue;
        }
      } catch (endpointError) {
        console.log(`Error testing endpoint ${endpoint}:`, endpointError);
        continue;
      }
    }

    // If no endpoint worked, verify the base URL is reachable
    try {
      const baseResponse = await fetch(cleanBaseUrl, {
        method: 'HEAD',
        headers: { 'Accept': 'application/json' },
      });

      if (baseResponse.ok || baseResponse.status < 500) {
        return { 
          success: true, 
          message: 'API يمكن الوصول إليه. تأكد من صحة الـ Base URL وجرب الإرسال الفعلي.',
          details: { 
            note: 'لم يتم العثور على endpoint للتحقق، لكن الـ API قابل للوصول',
            suggestion: 'تأكد أن Base URL ينتهي بـ /api/v1 أو المسار الصحيح حسب توثيق AppsLink'
          }
        };
      }
    } catch {
      // Base URL not reachable
    }

    return { 
      success: false, 
      message: 'لم يتم العثور على API صالح. تأكد من صحة Base URL (مثال: https://app.appslink.io/api/v1)',
      details: { 
        tried_endpoints: possibleEndpoints,
        last_error: lastError,
        suggestion: 'تحقق من توثيق AppsLink للحصول على المسار الصحيح للـ API'
      }
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('WhatsApp test error:', error);
    return { 
      success: false, 
      message: `خطأ في الاتصال: ${errorMessage}`,
      details: { error: errorMessage }
    };
  }
}

async function testN8n(config: Record<string, any>): Promise<{ success: boolean; message: string; details?: any }> {
  const baseUrl = config.base_url;
  const apiKey = config.api_key;
  const internalKey = config.internal_key;

  if (!baseUrl) {
    return { 
      success: false, 
      message: 'يرجى إدخال Base URL لـ n8n',
      details: { missing: 'base_url' }
    };
  }

  if (!internalKey) {
    return { 
      success: false, 
      message: 'يرجى إدخال Internal Function Key للمصادقة مع Edge Functions',
      details: { missing: 'internal_key' }
    };
  }

  try {
    // Check if n8n is reachable
    const healthUrl = `${baseUrl.replace(/\/$/, '')}/healthz`;
    
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: apiKey ? {
        'X-N8N-API-KEY': apiKey,
      } : {},
    });

    if (response.ok) {
      // Verify internal key matches our secret
      const expectedKey = Deno.env.get('INTERNAL_FUNCTION_KEY');
      const keyMatch = internalKey === expectedKey;
      
      return { 
        success: true, 
        message: keyMatch 
          ? 'تم الاتصال بـ n8n بنجاح والمفتاح الداخلي صحيح!'
          : 'تم الاتصال بـ n8n لكن المفتاح الداخلي غير مطابق',
        details: { 
          n8n_reachable: true,
          internal_key_valid: keyMatch
        }
      };
    }

    // n8n might not have healthz endpoint
    if (response.status === 404) {
      return { 
        success: true, 
        message: 'تم التحقق من الاتصال الأساسي بـ n8n',
        details: { note: 'healthz endpoint not available, but base URL is reachable' }
      };
    }

    return { 
      success: false, 
      message: `فشل الاتصال بـ n8n: ${response.status}`,
      details: { status: response.status }
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { 
      success: false, 
      message: `خطأ في الاتصال: ${errorMessage}`,
      details: { error: errorMessage }
    };
  }
}

async function testAI(config: Record<string, any>): Promise<{ success: boolean; message: string; details?: any }> {
  const provider = config.provider || 'lovable';
  const model = config.model || 'google/gemini-2.5-flash';
  const apiKey = config.api_key;

  // For Lovable AI, use the internal API
  if (provider === 'lovable') {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    if (!lovableApiKey) {
      return { 
        success: false, 
        message: 'لم يتم تكوين LOVABLE_API_KEY في الإعدادات السرية',
        details: { missing: 'LOVABLE_API_KEY secret' }
      };
    }

    try {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: 'أنت مساعد ذكي. أجب بكلمة واحدة فقط.' },
            { role: 'user', content: 'قل "مرحبا"' }
          ],
          max_tokens: 10,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { 
          success: false, 
          message: `فشل الاتصال: ${error.substring(0, 100)}`,
          details: { status: response.status }
        };
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content;

      return { 
        success: true, 
        message: `تم الاتصال بنجاح! الموديل: ${model}`,
        details: { 
          model: model,
          test_reply: reply
        }
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { 
        success: false, 
        message: `خطأ في الاتصال: ${errorMessage}`,
        details: { error: errorMessage }
      };
    }
  }

  // For OpenAI
  if (provider === 'openai') {
    if (!apiKey) {
      return { 
        success: false, 
        message: 'يرجى إدخال OpenAI API Key',
        details: { missing: 'api_key' }
      };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: [
            { role: 'user', content: 'Say "hello" in one word' }
          ],
          max_tokens: 10,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { 
          success: false, 
          message: `فشل الاتصال: ${error.error?.message || 'Unknown error'}`,
          details: error
        };
      }

      return { 
        success: true, 
        message: `تم الاتصال بـ OpenAI بنجاح! الموديل: ${model}`,
        details: { model }
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { 
        success: false, 
        message: `خطأ في الاتصال: ${errorMessage}`,
        details: { error: errorMessage }
      };
    }
  }

  // For Anthropic
  if (provider === 'anthropic') {
    if (!apiKey) {
      return { 
        success: false, 
        message: 'يرجى إدخال Anthropic API Key',
        details: { missing: 'api_key' }
      };
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model || 'claude-3-5-haiku-latest',
          max_tokens: 10,
          messages: [
            { role: 'user', content: 'Say "hello" in one word' }
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { 
          success: false, 
          message: `فشل الاتصال: ${error.error?.message || 'Unknown error'}`,
          details: error
        };
      }

      return { 
        success: true, 
        message: `تم الاتصال بـ Anthropic بنجاح! الموديل: ${model}`,
        details: { model }
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { 
        success: false, 
        message: `خطأ في الاتصال: ${errorMessage}`,
        details: { error: errorMessage }
      };
    }
  }

  return { 
    success: false, 
    message: 'مزود غير معروف',
    details: { provider }
  };
}
