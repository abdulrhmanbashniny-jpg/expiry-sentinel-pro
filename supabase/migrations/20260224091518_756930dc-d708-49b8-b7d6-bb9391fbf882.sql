
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Create knowledge embeddings table
CREATE TABLE public.knowledge_embeddings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  source_file TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  embedding vector(768),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, source_file, chunk_index)
);

-- Enable RLS
ALTER TABLE public.knowledge_embeddings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Knowledge: Admin SELECT"
ON public.knowledge_embeddings FOR SELECT
USING (is_admin_or_higher(auth.uid()));

CREATE POLICY "Knowledge: System Admin manage"
ON public.knowledge_embeddings FOR ALL
USING (is_system_admin(auth.uid()));

-- Similarity search function
CREATE OR REPLACE FUNCTION public.match_knowledge(
  query_embedding vector(768),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  source_file TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ke.id,
    ke.source_file,
    ke.content,
    ke.metadata,
    1 - (ke.embedding <=> query_embedding) AS similarity
  FROM knowledge_embeddings ke
  WHERE
    (p_tenant_id IS NULL OR ke.tenant_id IS NULL OR ke.tenant_id = p_tenant_id)
    AND 1 - (ke.embedding <=> query_embedding) > match_threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Index for fast similarity search
CREATE INDEX idx_knowledge_embeddings_embedding ON public.knowledge_embeddings
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Indexes for queries
CREATE INDEX idx_knowledge_source ON public.knowledge_embeddings(source_file);
CREATE INDEX idx_knowledge_tenant ON public.knowledge_embeddings(tenant_id);
