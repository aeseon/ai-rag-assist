-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create table for storing regulation document chunks with embeddings
CREATE TABLE IF NOT EXISTS public.regulation_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_id UUID REFERENCES public.regulations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(768),
  chunk_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for medical device submissions
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for storing submission document chunks with embeddings
CREATE TABLE IF NOT EXISTS public.submission_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES public.submissions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(768),
  chunk_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for analysis results
CREATE TABLE IF NOT EXISTS public.analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES public.submissions(id) ON DELETE CASCADE,
  overall_status TEXT NOT NULL CHECK (overall_status IN ('compliant', 'non_compliant', 'needs_review')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for individual analysis issues
CREATE TABLE IF NOT EXISTS public.analysis_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_result_id UUID REFERENCES public.analysis_results(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('error', 'warning', 'info')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,
  suggestion TEXT,
  regulation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.regulation_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_issues ENABLE ROW LEVEL SECURITY;

-- RLS policies for regulation_chunks (admins can manage, all authenticated users can read)
CREATE POLICY "Authenticated users can view regulation chunks"
  ON public.regulation_chunks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert regulation chunks"
  ON public.regulation_chunks FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete regulation chunks"
  ON public.regulation_chunks FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- RLS policies for submissions
CREATE POLICY "Users can view their own submissions"
  ON public.submissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own submissions"
  ON public.submissions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own submissions"
  ON public.submissions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own submissions"
  ON public.submissions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all submissions"
  ON public.submissions FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- RLS policies for submission_chunks
CREATE POLICY "Users can view their own submission chunks"
  ON public.submission_chunks FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.submissions
    WHERE submissions.id = submission_chunks.submission_id
    AND submissions.user_id = auth.uid()
  ));

CREATE POLICY "System can insert submission chunks"
  ON public.submission_chunks FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS policies for analysis_results
CREATE POLICY "Users can view their own analysis results"
  ON public.analysis_results FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.submissions
    WHERE submissions.id = analysis_results.submission_id
    AND submissions.user_id = auth.uid()
  ));

CREATE POLICY "System can insert analysis results"
  ON public.analysis_results FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view all analysis results"
  ON public.analysis_results FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- RLS policies for analysis_issues
CREATE POLICY "Users can view their own analysis issues"
  ON public.analysis_issues FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.analysis_results ar
    JOIN public.submissions s ON s.id = ar.submission_id
    WHERE ar.id = analysis_issues.analysis_result_id
    AND s.user_id = auth.uid()
  ));

CREATE POLICY "System can insert analysis issues"
  ON public.analysis_issues FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS regulation_chunks_embedding_idx ON public.regulation_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS submission_chunks_embedding_idx ON public.submission_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create trigger for submissions updated_at
CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to search similar regulation chunks
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
LANGUAGE sql STABLE
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