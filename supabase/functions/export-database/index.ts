import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// List of all tables to export
const TABLES_TO_EXPORT = [
  'admin_conversations',
  'ai_prompts',
  'ai_provider_settings',
  'ai_usage_log',
  'categories',
  'compliance_reports',
  'compliance_scores',
  'conversation_logs',
  'delegation_audit_log',
  'delegations',
  'departments',
  'evaluation_answers',
  'evaluation_appeals',
  'evaluation_audit_log',
  'evaluation_cycles',
  'evaluation_revisions',
  'evaluations',
  'integrations',
  'item_recipients',
  'item_status_log',
  'items',
  'kpi_template_axes',
  'kpi_template_questions',
  'kpi_templates',
  'login_history',
  'notification_log',
  'password_audit_log',
  'profiles',
  'published_results',
  'recipients',
  'reminder_rules',
  'security_settings',
  'settings',
  'team_members',
  'user_department_scopes',
  'user_import_logs',
  'user_roles',
]

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting database export...')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Use service role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const exportData: Record<string, any[]> = {}
    const errors: string[] = []

    // Export each table
    for (const tableName of TABLES_TO_EXPORT) {
      console.log(`Exporting table: ${tableName}`)
      
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
      
      if (error) {
        console.error(`Error exporting ${tableName}:`, error.message)
        errors.push(`${tableName}: ${error.message}`)
        exportData[tableName] = []
      } else {
        exportData[tableName] = data || []
        console.log(`Exported ${data?.length || 0} rows from ${tableName}`)
      }
    }

    const exportResult = {
      exportedAt: new Date().toISOString(),
      projectId: Deno.env.get('SUPABASE_PROJECT_ID') || 'lovable-cloud',
      tables: exportData,
      summary: Object.entries(exportData).map(([table, rows]) => ({
        table,
        rowCount: rows.length
      })),
      errors: errors.length > 0 ? errors : undefined
    }

    console.log('Export completed successfully')
    console.log('Summary:', exportResult.summary)

    return new Response(
      JSON.stringify(exportResult, null, 2),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="database-export-${new Date().toISOString().split('T')[0]}.json"`
        } 
      }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Export failed:', errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
