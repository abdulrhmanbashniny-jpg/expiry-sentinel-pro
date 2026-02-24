import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GITHUB_REPO = 'abdulrhmanbashniny-jpg/expiry-sentinel-pro';
const GITHUB_API = 'https://api.github.com';

// Files to ingest from the repo
const KNOWLEDGE_PATHS = [
  'DOCUMENTATION.md',
  'INTEGRATIONS.md',
  'docs/API.md',
  'docs/DASHBOARD_AND_REPORTS.md',
  'docs/DEPLOYMENT.md',
  'docs/ESCALATION_SYSTEM.md',
  'docs/MULTI_TENANT.md',
  'docs/ESCALATION_IMPLEMENTATION_GUIDE.md',
];

function chunkText(text: string, maxChunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  const lines = text.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    if (currentChunk.length + line.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      // Keep overlap
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.floor(overlap / 5));
      currentChunk = overlapWords.join(' ') + '\n' + line;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

async function generateEmbedding(text: string): Promise<number[]> {
  // Use Lovable AI Gateway to generate embeddings via a chat completion
  // We'll use a simple approach: ask the model to produce a semantic representation
  // For production, use a dedicated embedding model. Here we create a deterministic
  // pseudo-embedding from text features for MVP.
  
  const embedding: number[] = new Array(768).fill(0);
  const words = text.toLowerCase().split(/\s+/);
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    for (let j = 0; j < word.length && j < 768; j++) {
      const charCode = word.charCodeAt(j);
      const idx = (i * 7 + j * 13 + charCode) % 768;
      embedding[idx] += charCode / 1000;
    }
  }
  
  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  return embedding;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('=== Knowledge Ingestion Started ===');
  const startTime = Date.now();
  let totalChunks = 0;
  let newChunks = 0;
  let updatedChunks = 0;
  let errors = 0;

  try {
    const body = await req.json().catch(() => ({}));
    const customPaths = body.paths || KNOWLEDGE_PATHS;

    for (const filePath of customPaths) {
      try {
        console.log(`Fetching: ${filePath}`);
        
        // Fetch file from GitHub
        const response = await fetch(
          `${GITHUB_API}/repos/${GITHUB_REPO}/contents/${filePath}`,
          {
            headers: {
              'Accept': 'application/vnd.github.v3.raw',
              'User-Agent': 'ExpiySentinel-KnowledgeBot',
            },
          }
        );

        if (!response.ok) {
          console.error(`Failed to fetch ${filePath}: ${response.status}`);
          errors++;
          continue;
        }

        const content = await response.text();
        const chunks = chunkText(content);
        
        console.log(`  ${filePath}: ${chunks.length} chunks`);

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const contentHash = simpleHash(chunk);
          
          // Check if chunk already exists with same hash
          const { data: existing } = await supabase
            .from('knowledge_embeddings')
            .select('id, content_hash')
            .eq('source_file', filePath)
            .eq('chunk_index', i)
            .is('tenant_id', null)
            .maybeSingle();

          if (existing?.content_hash === contentHash) {
            // Skip unchanged chunk
            continue;
          }

          const embedding = await generateEmbedding(chunk);

          const record = {
            tenant_id: null,
            source_file: filePath,
            chunk_index: i,
            content: chunk,
            content_hash: contentHash,
            metadata: {
              file_type: filePath.endsWith('.md') ? 'markdown' : 'text',
              char_count: chunk.length,
              word_count: chunk.split(/\s+/).length,
            },
            embedding: `[${embedding.join(',')}]`,
            updated_at: new Date().toISOString(),
          };

          if (existing) {
            await supabase
              .from('knowledge_embeddings')
              .update(record)
              .eq('id', existing.id);
            updatedChunks++;
          } else {
            await supabase
              .from('knowledge_embeddings')
              .insert(record);
            newChunks++;
          }
          totalChunks++;
        }

        // Clean up old chunks beyond current count
        const { data: oldChunks } = await supabase
          .from('knowledge_embeddings')
          .select('id')
          .eq('source_file', filePath)
          .is('tenant_id', null)
          .gte('chunk_index', chunks.length);

        if (oldChunks && oldChunks.length > 0) {
          await supabase
            .from('knowledge_embeddings')
            .delete()
            .in('id', oldChunks.map(c => c.id));
        }

      } catch (fileError) {
        console.error(`Error processing ${filePath}:`, fileError);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`=== Knowledge Ingestion Complete: ${totalChunks} chunks (${newChunks} new, ${updatedChunks} updated, ${errors} errors) in ${duration}ms ===`);

    // Log automation run
    await supabase.from('automation_runs').insert({
      job_type: 'knowledge_ingestion',
      status: errors > 0 ? 'partial' : 'success',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      items_processed: customPaths.length,
      items_success: customPaths.length - errors,
      items_failed: errors,
      results: {
        total_chunks: totalChunks,
        new_chunks: newChunks,
        updated_chunks: updatedChunks,
        files_processed: customPaths.length,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Knowledge base synced: ${totalChunks} chunks processed`,
        total_chunks: totalChunks,
        new_chunks: newChunks,
        updated_chunks: updatedChunks,
        errors,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Knowledge ingestion error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
