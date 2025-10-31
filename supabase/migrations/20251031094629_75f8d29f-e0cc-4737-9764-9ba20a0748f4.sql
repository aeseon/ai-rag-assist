-- Create storage bucket for medical device submissions
INSERT INTO storage.buckets (id, name, public)
VALUES ('submissions', 'submissions', false);

-- Storage policies for submissions bucket
CREATE POLICY "Users can view their own submission files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'submissions' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can upload their own submission files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'submissions' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own submission files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'submissions' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins can view all submission files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'submissions' AND
    has_role(auth.uid(), 'admin')
  );