-- Add citations and additional RAG-related fields to analysis_issues table
ALTER TABLE public.analysis_issues
ADD COLUMN IF NOT EXISTS citations JSONB,
ADD COLUMN IF NOT EXISTS issue_code TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index on issue_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_analysis_issues_issue_code 
ON public.analysis_issues(issue_code);

-- Create GIN index on citations JSONB column for efficient queries
CREATE INDEX IF NOT EXISTS idx_analysis_issues_citations 
ON public.analysis_issues USING GIN (citations);

-- Add comment for documentation
COMMENT ON COLUMN public.analysis_issues.citations IS 'RAG citations array with detailed regulation references including doc_id, section_path, snippet, and relevance score';
COMMENT ON COLUMN public.analysis_issues.issue_code IS 'Unique identifier for the issue type (e.g., missing_regulatory_data, sterile_conflict)';
COMMENT ON COLUMN public.analysis_issues.notes IS 'Additional context or special considerations for the issue';