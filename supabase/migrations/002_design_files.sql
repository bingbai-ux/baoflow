-- Design files table for managing design assets per deal
CREATE TABLE design_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT, -- 'ai', 'pdf', 'png', 'jpg', etc.
  file_size INTEGER,
  version INTEGER DEFAULT 1,
  is_final BOOLEAN DEFAULT FALSE,
  notes TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_design_files_deal_id ON design_files(deal_id);
CREATE INDEX idx_design_files_is_final ON design_files(is_final);

-- RLS policies
ALTER TABLE design_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view design files" ON design_files
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create design files" ON design_files
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update design files" ON design_files
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete design files" ON design_files
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Trigger to update updated_at
CREATE TRIGGER update_design_files_updated_at
  BEFORE UPDATE ON design_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
