-- Add highlight fields to analysis_issues table
ALTER TABLE analysis_issues
ADD COLUMN submission_highlight text,
ADD COLUMN regulation_highlight text;

COMMENT ON COLUMN analysis_issues.submission_highlight IS 'Highlighted text from the submission document that relates to this issue';
COMMENT ON COLUMN analysis_issues.regulation_highlight IS 'Highlighted text from regulations that serves as the basis for this issue';