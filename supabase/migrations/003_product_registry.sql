-- Create update_updated_at_column function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Product registry for tracking product items and price history
CREATE TABLE product_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_code TEXT UNIQUE NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT,
  material TEXT,
  typical_size TEXT,
  typical_quantity INTEGER,
  min_order_quantity INTEGER,
  factory_id UUID REFERENCES factories(id),
  last_price_cny NUMERIC(12,2),
  last_price_date DATE,
  average_price_cny NUMERIC(12,2),
  price_history JSONB DEFAULT '[]'::jsonb, -- Array of {date, price_cny, quantity, deal_id}
  lead_time_days INTEGER,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_product_registry_product_code ON product_registry(product_code);
CREATE INDEX idx_product_registry_factory ON product_registry(factory_id);
CREATE INDEX idx_product_registry_category ON product_registry(category);

-- RLS policies
ALTER TABLE product_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view products" ON product_registry
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create products" ON product_registry
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update products" ON product_registry
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete products" ON product_registry
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Trigger to update updated_at
CREATE TRIGGER update_product_registry_updated_at
  BEFORE UPDATE ON product_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
