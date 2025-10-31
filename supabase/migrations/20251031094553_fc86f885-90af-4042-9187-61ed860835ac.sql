-- Fix search_path for search_similar_regulations function
CREATE OR REPLACE FUNCTION public.search_similar_regulations(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  regulation_id uuid,
  content text,
  similarity float
)
LANGUAGE sql 
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    regulation_chunks.id,
    regulation_chunks.regulation_id,
    regulation_chunks.content,
    1 - (regulation_chunks.embedding <=> query_embedding) as similarity
  FROM regulation_chunks
  WHERE 1 - (regulation_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY regulation_chunks.embedding <=> query_embedding
  LIMIT match_count;
$$;