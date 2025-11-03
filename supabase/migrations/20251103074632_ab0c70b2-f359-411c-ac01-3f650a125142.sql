-- Add regulation metadata fields to analysis_issues table
ALTER TABLE analysis_issues
ADD COLUMN regulation_id uuid REFERENCES regulations(id),
ADD COLUMN regulation_title text,
ADD COLUMN regulation_category text,
ADD COLUMN regulation_version text,
ADD COLUMN regulation_effective_date date,
ADD COLUMN regulation_status text,
ADD COLUMN has_text_content boolean DEFAULT true,
ADD COLUMN no_text_reason text;