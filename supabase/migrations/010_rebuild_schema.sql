-- ============================================================================
-- BAO Flow Database Schema Rebuild
-- Based on: BAOFlow_要件定義書_v3_2.md Section 6
-- Created: 2026-02-08
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP ALL EXISTING OBJECTS
-- ============================================================================

-- Drop all triggers first
DO $$
DECLARE
    trigger_rec RECORD;
BEGIN
    FOR trigger_rec IN
        SELECT tgname, relname
        FROM pg_trigger
        JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
        WHERE NOT tgisinternal
        AND relnamespace = 'public'::regnamespace
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I CASCADE',
                       trigger_rec.tgname, trigger_rec.relname);
    END LOOP;
END $$;

-- Drop all functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS generate_deal_code() CASCADE;
DROP FUNCTION IF EXISTS generate_shipment_order_code() CASCADE;

-- Drop all tables (in reverse dependency order)
DROP TABLE IF EXISTS price_records CASCADE;
DROP TABLE IF EXISTS test_reports CASCADE;
DROP TABLE IF EXISTS product_registry CASCADE;
DROP TABLE IF EXISTS logistics_agents CASCADE;
DROP TABLE IF EXISTS storage_billing CASCADE;
DROP TABLE IF EXISTS logistics_notifications CASCADE;
DROP TABLE IF EXISTS shipment_order_items CASCADE;
DROP TABLE IF EXISTS shipment_orders CASCADE;
DROP TABLE IF EXISTS inventory_movements CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS ai_action_logs CASCADE;
DROP TABLE IF EXISTS stale_alerts CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS message_templates CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_rooms CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS deal_actuals CASCADE;
DROP TABLE IF EXISTS deal_packing_lists CASCADE;
DROP TABLE IF EXISTS deal_shipping CASCADE;
DROP TABLE IF EXISTS deal_factory_payments CASCADE;
DROP TABLE IF EXISTS deal_sample_summary CASCADE;
DROP TABLE IF EXISTS deal_samples CASCADE;
DROP TABLE IF EXISTS deal_schedule CASCADE;
DROP TABLE IF EXISTS deal_shipping_options CASCADE;
DROP TABLE IF EXISTS deal_quotes CASCADE;
DROP TABLE IF EXISTS deal_factory_assignments CASCADE;
DROP TABLE IF EXISTS deal_design_files CASCADE;
DROP TABLE IF EXISTS deal_specifications CASCADE;
DROP TABLE IF EXISTS deals CASCADE;
DROP TABLE IF EXISTS deal_groups CASCADE;
DROP TABLE IF EXISTS factories CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS catalog_items CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS deal_status_history CASCADE;
DROP TABLE IF EXISTS payments CASCADE;

-- Drop all custom types
DROP TYPE IF EXISTS master_status CASCADE;
DROP TYPE IF EXISTS win_probability CASCADE;
DROP TYPE IF EXISTS ai_mode CASCADE;
DROP TYPE IF EXISTS delivery_type CASCADE;
DROP TYPE IF EXISTS quote_status CASCADE;
DROP TYPE IF EXISTS sample_status CASCADE;
DROP TYPE IF EXISTS payment_type CASCADE;
DROP TYPE IF EXISTS payment_method CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS factory_assignment_status CASCADE;
DROP TYPE IF EXISTS shipping_method CASCADE;
DROP TYPE IF EXISTS incoterm CASCADE;
DROP TYPE IF EXISTS document_type CASCADE;
DROP TYPE IF EXISTS chat_room_type CASCADE;
DROP TYPE IF EXISTS stale_reason CASCADE;
DROP TYPE IF EXISTS movement_type CASCADE;
DROP TYPE IF EXISTS shipment_order_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS notification_type CASCADE;
DROP TYPE IF EXISTS notification_status CASCADE;
DROP TYPE IF EXISTS billing_status CASCADE;
DROP TYPE IF EXISTS transaction_direction CASCADE;
DROP TYPE IF EXISTS logistics_agent_type CASCADE;
DROP TYPE IF EXISTS testing_agency_type CASCADE;
DROP TYPE IF EXISTS packing_status CASCADE;

-- ============================================================================
-- STEP 2: CREATE ENUM TYPES
-- ============================================================================

-- Master status: M01-M25 (25 steps)
CREATE TYPE master_status AS ENUM (
  'M01', -- 見積もり依頼受付
  'M02', -- 営業確認・工場選定中
  'M03', -- 工場見積もり依頼送信済み
  'M04', -- 工場回答待ち
  'M05', -- 工場回答受領・原価計算完了
  'M06', -- クライアントへ見積もり提示
  'M07', -- クライアント検討中
  'M08', -- クライアント修正依頼
  'M09', -- 見積もり再調整中
  'M10', -- 見積もり再提示
  'M11', -- クライアント承認
  'M12', -- 請求書発行
  'M13', -- クライアント入金待ち
  'M14', -- クライアント入金確認
  'M15', -- 工場へ前払い（半金 or 全額）
  'M16', -- 工場入金確認・製造開始待ち
  'M17', -- 製造開始
  'M18', -- 製造中（進捗%）
  'M19', -- 製造完了・検品
  'M20', -- 工場残金支払い（該当する場合）
  'M21', -- 発送準備・パッキングリスト作成
  'M22', -- 発送済み（トラッキング番号発行）
  'M23', -- 輸送中
  'M24', -- 到着・検品（直接納品 or ロジセンター入庫）
  'M25'  -- 納品完了
);

CREATE TYPE win_probability AS ENUM (
  'very_high',
  'high',
  'medium',
  'low',
  'won'
);

CREATE TYPE ai_mode AS ENUM (
  'assist',
  'auto'
);

CREATE TYPE delivery_type AS ENUM (
  'direct',
  'logistics_center'
);

CREATE TYPE quote_status AS ENUM (
  'drafting',
  'presented',
  'approved',
  'rejected',
  'revising'
);

CREATE TYPE sample_status AS ENUM (
  'requested',
  'manufacturing',
  'shipping',
  'arrived',
  'ok',
  'revision_needed'
);

CREATE TYPE payment_type AS ENUM (
  'advance',
  'balance',
  'full'
);

CREATE TYPE payment_method AS ENUM (
  'wise',
  'alibaba_cc',
  'bank_transfer'
);

CREATE TYPE payment_status AS ENUM (
  'unpaid',
  'paid'
);

CREATE TYPE factory_assignment_status AS ENUM (
  'requesting',
  'responded',
  'selected',
  'not_selected'
);

CREATE TYPE shipping_method AS ENUM (
  'sea',
  'air',
  'partial_air'
);

CREATE TYPE incoterm AS ENUM (
  'exw',
  'ddp',
  'dpu',
  'fob',
  'cif'
);

CREATE TYPE document_type AS ENUM (
  'quotation',
  'invoice',
  'delivery_note',
  'inventory_cert',
  'storage_invoice'
);

CREATE TYPE chat_room_type AS ENUM (
  'client_sales',
  'sales_factory',
  'internal'
);

CREATE TYPE stale_reason AS ENUM (
  'factory_no_response',
  'client_no_response',
  'sales_action_needed',
  'payment_pending'
);

CREATE TYPE movement_type AS ENUM (
  'incoming',
  'outgoing'
);

CREATE TYPE shipment_order_status AS ENUM (
  'received',
  'approved',
  'instruction_sent',
  'shipped',
  'delivered'
);

CREATE TYPE user_role AS ENUM (
  'admin',
  'sales',
  'client',
  'factory'
);

CREATE TYPE notification_type AS ENUM (
  'email',
  'chat',
  'dashboard'
);

CREATE TYPE notification_status AS ENUM (
  'pending',
  'sent',
  'read'
);

CREATE TYPE billing_status AS ENUM (
  'calculated',
  'invoiced',
  'paid'
);

CREATE TYPE transaction_direction AS ENUM (
  'in',
  'out'
);

CREATE TYPE logistics_agent_type AS ENUM (
  'forwarder',
  'customs_broker',
  'all_in_one'
);

CREATE TYPE testing_agency_type AS ENUM (
  'foreign_public',
  'domestic_registered'
);

CREATE TYPE packing_status AS ENUM (
  'draft',
  'confirmed'
);

-- ============================================================================
-- STEP 3: CREATE TABLES
-- ============================================================================

-- ---------------------------------------------------------------------------
-- User & Authentication
-- ---------------------------------------------------------------------------

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'sales',
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  language_preference TEXT DEFAULT 'ja',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Client Master
-- ---------------------------------------------------------------------------

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  brand_name TEXT,
  contact_name TEXT,
  contact_role TEXT,
  industry TEXT,
  company_size TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  default_delivery_address TEXT,
  default_sample_cost_rate DECIMAL(5,4) DEFAULT 0.5, -- 0.0 to 1.0
  uses_storage_service BOOLEAN DEFAULT FALSE,
  storage_rate_config JSONB, -- pallet/carton rates
  assigned_sales_ids UUID[],
  total_transaction_amount DECIMAL(15,2) DEFAULT 0,
  total_order_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Factory Master
-- ---------------------------------------------------------------------------

CREATE TABLE factories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name TEXT,
  factory_name TEXT NOT NULL,
  rating DECIMAL(2,1), -- 1.0 to 5.0
  specialties TEXT[], -- array of specialties
  quality TEXT,
  price_level TEXT,
  response_speed TEXT,
  politeness TEXT,
  contact_method TEXT,
  address TEXT,
  bank_info JSONB,
  default_payment_terms TEXT, -- e.g., '50% advance, 50% balance'
  default_payment_method payment_method,
  excel_template_id TEXT,
  avg_response_days INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Deal Groups (Batch Request)
-- ---------------------------------------------------------------------------

CREATE TABLE deal_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  sales_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Deals (Main)
-- ---------------------------------------------------------------------------

CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_code TEXT UNIQUE NOT NULL, -- PF-YYYYMM-NNN
  deal_name TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  sales_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  master_status master_status NOT NULL DEFAULT 'M01',
  win_probability win_probability DEFAULT 'medium',
  deal_group_id UUID REFERENCES deal_groups(id) ON DELETE SET NULL,
  parent_deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  delivery_type delivery_type DEFAULT 'direct',
  ai_mode ai_mode DEFAULT 'assist',
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Deal Specifications
-- ---------------------------------------------------------------------------

CREATE TABLE deal_specifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  product_category TEXT,
  product_name TEXT,
  height_mm DECIMAL(10,2),
  width_mm DECIMAL(10,2),
  depth_mm DECIMAL(10,2),
  diameter_mm DECIMAL(10,2),
  bottom_diameter_mm DECIMAL(10,2),
  capacity_ml DECIMAL(10,2),
  size_notes TEXT,
  material_category TEXT,
  material_thickness TEXT,
  material_notes TEXT,
  printing_method TEXT,
  print_colors TEXT,
  print_sides TEXT,
  printing_notes TEXT,
  processing_list TEXT[], -- deboss, emboss, foil, etc.
  lamination TEXT,
  processing_notes TEXT,
  attachments_list TEXT[], -- valve, zipper, etc.
  attachment_notes TEXT,
  reference_images TEXT[],
  existing_quote_file TEXT,
  specification_memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Deal Design Files (Version Control)
-- ---------------------------------------------------------------------------

CREATE TABLE deal_design_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  version_number INTEGER NOT NULL DEFAULT 1,
  comment TEXT,
  uploaded_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_final BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Deal Factory Assignments
-- ---------------------------------------------------------------------------

CREATE TABLE deal_factory_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  factory_id UUID NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  is_competitive_quote BOOLEAN DEFAULT FALSE,
  status factory_assignment_status DEFAULT 'requesting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(deal_id, factory_id)
);

-- ---------------------------------------------------------------------------
-- Deal Quotes
-- ---------------------------------------------------------------------------

CREATE TABLE deal_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  factory_id UUID REFERENCES factories(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  quantity INTEGER,
  factory_unit_price_usd DECIMAL(12,4),
  plate_fee_usd DECIMAL(12,2) DEFAULT 0,
  other_fees_usd DECIMAL(12,2) DEFAULT 0,
  total_cost_usd DECIMAL(15,2),
  unit_cost_usd DECIMAL(12,4),
  cost_ratio DECIMAL(4,3), -- 0.400 to 0.700
  exchange_rate DECIMAL(8,2),
  selling_price_usd DECIMAL(12,4),
  selling_price_jpy DECIMAL(12,2),
  total_billing_jpy DECIMAL(15,2),
  total_billing_tax_jpy DECIMAL(15,2),
  moq INTEGER,
  status quote_status DEFAULT 'drafting',
  source_type TEXT, -- 'manual' or 'excel_parsed'
  source_file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Deal Shipping Options
-- ---------------------------------------------------------------------------

CREATE TABLE deal_shipping_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_quote_id UUID NOT NULL REFERENCES deal_quotes(id) ON DELETE CASCADE,
  shipping_method shipping_method,
  incoterm incoterm,
  shipping_cost_usd DECIMAL(12,2),
  shipping_days INTEGER,
  is_selected BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Deal Schedule
-- ---------------------------------------------------------------------------

CREATE TABLE deal_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  factory_id UUID REFERENCES factories(id) ON DELETE SET NULL,
  sample_production_days INTEGER,
  mass_production_days INTEGER,
  desired_delivery_date DATE,
  calculated_order_deadline DATE,
  payment_due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Deal Samples (Multiple Rounds)
-- ---------------------------------------------------------------------------

CREATE TABLE deal_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL DEFAULT 1,
  sample_production_fee_usd DECIMAL(12,2),
  sample_shipping_fee_usd DECIMAL(12,2),
  plate_fee_usd DECIMAL(12,2) DEFAULT 0, -- First round only
  subtotal_usd DECIMAL(12,2),
  subtotal_jpy DECIMAL(12,2),
  sample_status sample_status DEFAULT 'requested',
  feedback_memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Deal Sample Summary (Per Deal)
-- ---------------------------------------------------------------------------

CREATE TABLE deal_sample_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL UNIQUE REFERENCES deals(id) ON DELETE CASCADE,
  total_sample_cost_jpy DECIMAL(15,2) DEFAULT 0,
  client_cost_rate DECIMAL(5,4) DEFAULT 0.5,
  client_charge_jpy DECIMAL(15,2) DEFAULT 0,
  company_charge_jpy DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Deal Factory Payments
-- ---------------------------------------------------------------------------

CREATE TABLE deal_factory_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  factory_id UUID REFERENCES factories(id) ON DELETE SET NULL,
  payment_type payment_type NOT NULL,
  payment_method payment_method,
  amount_usd DECIMAL(12,2),
  amount_jpy DECIMAL(15,2),
  fee_amount DECIMAL(12,2) DEFAULT 0, -- Wise/Alibaba fees
  status payment_status DEFAULT 'unpaid',
  due_date DATE,
  paid_at TIMESTAMPTZ,
  trigger_condition TEXT, -- e.g., 'on_order', 'on_production_complete'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Deal Shipping (Actual Delivery Info)
-- ---------------------------------------------------------------------------

CREATE TABLE deal_shipping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL UNIQUE REFERENCES deals(id) ON DELETE CASCADE,
  delivery_address TEXT,
  delivery_type delivery_type,
  selected_shipping_option_id UUID REFERENCES deal_shipping_options(id) ON DELETE SET NULL,
  packing_info JSONB, -- weight_kg, carton_size, carton_count, cbm
  tracking_number TEXT,
  tracking_url TEXT,
  food_inspection_required BOOLEAN DEFAULT FALSE,
  food_inspection_cost DECIMAL(12,2),
  logistics_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Deal Packing Lists
-- ---------------------------------------------------------------------------

CREATE TABLE deal_packing_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  carton_number INTEGER,
  total_cartons INTEGER,
  product_id_range TEXT,
  quantity_in_carton INTEGER,
  weight_kg DECIMAL(8,2),
  uploaded_file_url TEXT,
  label_pdf_url TEXT,
  status packing_status DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Deal Actuals (Actual Costs & Profit)
-- ---------------------------------------------------------------------------

CREATE TABLE deal_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL UNIQUE REFERENCES deals(id) ON DELETE CASCADE,
  actual_product_cost DECIMAL(15,2),
  actual_shipping_cost DECIMAL(15,2),
  actual_inspection_cost DECIMAL(15,2),
  actual_wise_fee DECIMAL(12,2),
  actual_alibaba_fee DECIMAL(12,2),
  actual_total DECIMAL(15,2),
  actual_sample_cost DECIMAL(15,2), -- Reference only
  profit DECIMAL(15,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Deal Status History
-- ---------------------------------------------------------------------------

CREATE TABLE deal_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  from_status master_status,
  to_status master_status NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  note TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Transactions (Cash In/Out Management)
-- ---------------------------------------------------------------------------

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number TEXT,
  client_or_factory_id UUID, -- Either client_id or factory_id
  deal_ids UUID[], -- Can be linked to multiple deals
  direction transaction_direction NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  fee_amount DECIMAL(12,2),
  billing_status TEXT,
  amount_jpy DECIMAL(15,2),
  occurred_at TIMESTAMPTZ,
  due_date DATE,
  invoice_file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  document_type document_type NOT NULL,
  document_number TEXT,
  file_url TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Chat Rooms
-- ---------------------------------------------------------------------------

CREATE TABLE chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  room_type chat_room_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Chat Messages
-- ---------------------------------------------------------------------------

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content_original TEXT,
  content_translated TEXT,
  original_language TEXT, -- 'ja', 'zh', 'en'
  source TEXT, -- 'app' or 'email'
  is_system_message BOOLEAN DEFAULT FALSE,
  is_template_message BOOLEAN DEFAULT FALSE,
  is_ai_generated BOOLEAN DEFAULT FALSE,
  attachments TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Message Templates
-- ---------------------------------------------------------------------------

CREATE TABLE message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT,
  content_ja TEXT,
  content_zh TEXT,
  content_en TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  type notification_type,
  status notification_status DEFAULT 'pending',
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Stale Alerts
-- ---------------------------------------------------------------------------

CREATE TABLE stale_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  stale_since TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stale_reason stale_reason,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- AI Action Logs
-- ---------------------------------------------------------------------------

CREATE TABLE ai_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  action_type TEXT,
  action_detail JSONB,
  ai_mode ai_mode,
  requires_review BOOLEAN DEFAULT FALSE,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Inventory Items
-- ---------------------------------------------------------------------------

CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  product_name TEXT,
  product_specs TEXT,
  current_stock INTEGER DEFAULT 0,
  storage_location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Inventory Movements
-- ---------------------------------------------------------------------------

CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  movement_type movement_type NOT NULL,
  quantity INTEGER NOT NULL,
  balance_after INTEGER,
  source_type TEXT, -- 'deal', 'shipment_order', 'manual'
  source_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Shipment Orders (CO-NECT Replacement)
-- ---------------------------------------------------------------------------

CREATE TABLE shipment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code TEXT UNIQUE NOT NULL, -- SO-YYYYMMDD-NNN
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  status shipment_order_status DEFAULT 'received',
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  desired_ship_date DATE,
  delivery_address TEXT,
  shipping_fee DECIMAL(12,2),
  tracking_number TEXT,
  tracking_url TEXT,
  logistics_notified_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Shipment Order Items
-- ---------------------------------------------------------------------------

CREATE TABLE shipment_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_order_id UUID NOT NULL REFERENCES shipment_orders(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  picked_quantity INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Logistics Notifications
-- ---------------------------------------------------------------------------

CREATE TABLE logistics_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  notification_type TEXT, -- 'incoming', 'confirmation'
  email_sent_at TIMESTAMPTZ,
  email_content TEXT,
  confirmed_at TIMESTAMPTZ,
  carton_count INTEGER,
  total_weight DECIMAL(10,2),
  estimated_arrival DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Storage Billing
-- ---------------------------------------------------------------------------

CREATE TABLE storage_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  billing_month TEXT, -- 'YYYY-MM'
  storage_fee DECIMAL(12,2),
  handling_fee_in DECIMAL(12,2),
  handling_fee_out DECIMAL(12,2),
  total_amount DECIMAL(12,2),
  invoice_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  status billing_status DEFAULT 'calculated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Catalog Items
-- ---------------------------------------------------------------------------

CREATE TABLE catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT,
  product_type_ja TEXT,
  product_type_en TEXT,
  description_ja TEXT,
  description_en TEXT,
  available_sizes TEXT[],
  available_colors TEXT[],
  material_display TEXT,
  material_technical TEXT,
  options TEXT[],
  custom_print_available BOOLEAN DEFAULT TRUE,
  moq_estimate INTEGER,
  price_range TEXT,
  images TEXT[],
  is_visible BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- System Settings
-- ---------------------------------------------------------------------------

CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default_exchange_rate DECIMAL(8,2) DEFAULT 155.0,
  default_tax_rate DECIMAL(5,2) DEFAULT 10,
  wise_fee_config JSONB,
  alibaba_cc_fee_rate DECIMAL(5,2) DEFAULT 2.99,
  company_info JSONB,
  invoice_registration_number TEXT, -- T+13 digits
  company_stamp_image TEXT,
  bank_accounts JSONB[], -- Array of bank account objects
  default_sample_cost_rate DECIMAL(5,4) DEFAULT 0.5,
  invoice_notes_template TEXT,
  stale_alert_threshold_days INTEGER DEFAULT 7,
  food_inspection_config JSONB,
  logistics_center_info JSONB,
  logistics_email_template TEXT,
  shipment_instruction_template TEXT,
  storage_billing_method TEXT, -- 'mid_month_avg' or 'end_of_month'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Product Registry (品目登録台帳)
-- ---------------------------------------------------------------------------

CREATE TABLE product_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code TEXT UNIQUE,
  product_name TEXT NOT NULL,
  category TEXT,
  material TEXT,
  hs_code TEXT,
  tariff_rate DECIMAL(5,2),
  factory_id UUID REFERENCES factories(id) ON DELETE SET NULL,
  registration_number TEXT,
  test_report_id UUID, -- Will reference test_reports
  is_registered BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Test Reports (試験成績書台帳)
-- ---------------------------------------------------------------------------

CREATE TABLE test_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number TEXT,
  testing_agency TEXT,
  testing_agency_type testing_agency_type,
  applicant TEXT,
  product_name TEXT,
  material TEXT,
  manufacturer_factory_id UUID REFERENCES factories(id) ON DELETE SET NULL,
  test_date DATE,
  conclusion TEXT, -- 'pass' or 'fail'
  report_pdf_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key to product_registry for test_report_id
ALTER TABLE product_registry
  ADD CONSTRAINT fk_test_report
  FOREIGN KEY (test_report_id) REFERENCES test_reports(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Logistics Agents (物流エージェント)
-- ---------------------------------------------------------------------------

CREATE TABLE logistics_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  agent_type logistics_agent_type,
  services TEXT[], -- pickup, export_customs, shipping, etc.
  rate_cards JSONB, -- Weight-based pricing
  contact_info JSONB,
  is_primary BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Price Records (価格データ自動蓄積)
-- ---------------------------------------------------------------------------

CREATE TABLE price_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id UUID REFERENCES factories(id) ON DELETE CASCADE,
  product_type TEXT,
  material TEXT,
  size TEXT,
  printing TEXT,
  quantity INTEGER,
  unit_price_usd DECIMAL(12,4),
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 4: CREATE INDEXES
-- ============================================================================

-- Profiles
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);

-- Clients
CREATE INDEX idx_clients_company_name ON clients(company_name);
CREATE INDEX idx_clients_email ON clients(email);

-- Factories
CREATE INDEX idx_factories_factory_name ON factories(factory_name);
CREATE INDEX idx_factories_rating ON factories(rating);

-- Deal Groups
CREATE INDEX idx_deal_groups_client_id ON deal_groups(client_id);
CREATE INDEX idx_deal_groups_sales_user_id ON deal_groups(sales_user_id);

-- Deals
CREATE INDEX idx_deals_client_id ON deals(client_id);
CREATE INDEX idx_deals_sales_user_id ON deals(sales_user_id);
CREATE INDEX idx_deals_master_status ON deals(master_status);
CREATE INDEX idx_deals_deal_group_id ON deals(deal_group_id);
CREATE INDEX idx_deals_parent_deal_id ON deals(parent_deal_id);
CREATE INDEX idx_deals_deal_code ON deals(deal_code);
CREATE INDEX idx_deals_created_at ON deals(created_at DESC);
CREATE INDEX idx_deals_last_activity_at ON deals(last_activity_at DESC);

-- Deal Specifications
CREATE INDEX idx_deal_specifications_deal_id ON deal_specifications(deal_id);

-- Deal Design Files
CREATE INDEX idx_deal_design_files_deal_id ON deal_design_files(deal_id);
CREATE INDEX idx_deal_design_files_uploaded_by ON deal_design_files(uploaded_by_user_id);

-- Deal Factory Assignments
CREATE INDEX idx_deal_factory_assignments_deal_id ON deal_factory_assignments(deal_id);
CREATE INDEX idx_deal_factory_assignments_factory_id ON deal_factory_assignments(factory_id);

-- Deal Quotes
CREATE INDEX idx_deal_quotes_deal_id ON deal_quotes(deal_id);
CREATE INDEX idx_deal_quotes_factory_id ON deal_quotes(factory_id);

-- Deal Shipping Options
CREATE INDEX idx_deal_shipping_options_deal_quote_id ON deal_shipping_options(deal_quote_id);

-- Deal Schedule
CREATE INDEX idx_deal_schedule_deal_id ON deal_schedule(deal_id);
CREATE INDEX idx_deal_schedule_factory_id ON deal_schedule(factory_id);

-- Deal Samples
CREATE INDEX idx_deal_samples_deal_id ON deal_samples(deal_id);

-- Deal Sample Summary
CREATE INDEX idx_deal_sample_summary_deal_id ON deal_sample_summary(deal_id);

-- Deal Factory Payments
CREATE INDEX idx_deal_factory_payments_deal_id ON deal_factory_payments(deal_id);
CREATE INDEX idx_deal_factory_payments_factory_id ON deal_factory_payments(factory_id);
CREATE INDEX idx_deal_factory_payments_status ON deal_factory_payments(status);

-- Deal Shipping
CREATE INDEX idx_deal_shipping_deal_id ON deal_shipping(deal_id);

-- Deal Packing Lists
CREATE INDEX idx_deal_packing_lists_deal_id ON deal_packing_lists(deal_id);

-- Deal Actuals
CREATE INDEX idx_deal_actuals_deal_id ON deal_actuals(deal_id);

-- Deal Status History
CREATE INDEX idx_deal_status_history_deal_id ON deal_status_history(deal_id);
CREATE INDEX idx_deal_status_history_changed_at ON deal_status_history(changed_at DESC);

-- Transactions
CREATE INDEX idx_transactions_client_or_factory_id ON transactions(client_or_factory_id);
CREATE INDEX idx_transactions_direction ON transactions(direction);
CREATE INDEX idx_transactions_occurred_at ON transactions(occurred_at DESC);

-- Documents
CREATE INDEX idx_documents_deal_id ON documents(deal_id);
CREATE INDEX idx_documents_document_type ON documents(document_type);

-- Chat Rooms
CREATE INDEX idx_chat_rooms_deal_id ON chat_rooms(deal_id);
CREATE INDEX idx_chat_rooms_room_type ON chat_rooms(room_type);

-- Chat Messages
CREATE INDEX idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- Notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_deal_id ON notifications(deal_id);
CREATE INDEX idx_notifications_status ON notifications(status);

-- Stale Alerts
CREATE INDEX idx_stale_alerts_deal_id ON stale_alerts(deal_id);
CREATE INDEX idx_stale_alerts_is_resolved ON stale_alerts(is_resolved);

-- AI Action Logs
CREATE INDEX idx_ai_action_logs_deal_id ON ai_action_logs(deal_id);

-- Inventory Items
CREATE INDEX idx_inventory_items_client_id ON inventory_items(client_id);
CREATE INDEX idx_inventory_items_deal_id ON inventory_items(deal_id);

-- Inventory Movements
CREATE INDEX idx_inventory_movements_inventory_item_id ON inventory_movements(inventory_item_id);
CREATE INDEX idx_inventory_movements_created_at ON inventory_movements(created_at DESC);

-- Shipment Orders
CREATE INDEX idx_shipment_orders_client_id ON shipment_orders(client_id);
CREATE INDEX idx_shipment_orders_status ON shipment_orders(status);

-- Shipment Order Items
CREATE INDEX idx_shipment_order_items_shipment_order_id ON shipment_order_items(shipment_order_id);
CREATE INDEX idx_shipment_order_items_inventory_item_id ON shipment_order_items(inventory_item_id);

-- Logistics Notifications
CREATE INDEX idx_logistics_notifications_deal_id ON logistics_notifications(deal_id);
CREATE INDEX idx_logistics_notifications_inventory_item_id ON logistics_notifications(inventory_item_id);

-- Storage Billing
CREATE INDEX idx_storage_billing_client_id ON storage_billing(client_id);
CREATE INDEX idx_storage_billing_billing_month ON storage_billing(billing_month);

-- Product Registry
CREATE INDEX idx_product_registry_factory_id ON product_registry(factory_id);
CREATE INDEX idx_product_registry_test_report_id ON product_registry(test_report_id);

-- Test Reports
CREATE INDEX idx_test_reports_manufacturer_factory_id ON test_reports(manufacturer_factory_id);

-- Logistics Agents
CREATE INDEX idx_logistics_agents_agent_type ON logistics_agents(agent_type);

-- Price Records
CREATE INDEX idx_price_records_factory_id ON price_records(factory_id);
CREATE INDEX idx_price_records_deal_id ON price_records(deal_id);
CREATE INDEX idx_price_records_recorded_at ON price_records(recorded_at DESC);

-- ============================================================================
-- STEP 5: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE factories ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_design_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_factory_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_shipping_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_sample_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_factory_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_shipping ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_packing_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE stale_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_records ENABLE ROW LEVEL SECURITY;

-- Phase 1: Internal tool - authenticated users have full access
-- Full policies will be implemented in later phases

CREATE POLICY "authenticated_full_access" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON factories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON deal_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON deals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON deal_specifications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON deal_design_files FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON deal_factory_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON deal_quotes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON deal_shipping_options FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON deal_schedule FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON deal_samples FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON deal_sample_summary FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON deal_factory_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON deal_shipping FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON deal_packing_lists FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON deal_actuals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON deal_status_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON chat_rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON chat_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON message_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON stale_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON ai_action_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON inventory_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON inventory_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON shipment_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON shipment_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON logistics_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON storage_billing FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON catalog_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON system_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON product_registry FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON test_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON logistics_agents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON price_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- STEP 6: CREATE FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables with updated_at column
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND column_name = 'updated_at'
        AND table_name NOT LIKE 'pg_%'
    LOOP
        EXECUTE format('
            CREATE TRIGGER update_%I_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column()
        ', t, t);
    END LOOP;
END $$;

-- Handle new user trigger (create profile on signup)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'sales'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- STEP 7: INSERT INITIAL DATA
-- ============================================================================

-- Insert default system settings
INSERT INTO system_settings (
  id,
  default_exchange_rate,
  default_tax_rate,
  wise_fee_config,
  alibaba_cc_fee_rate,
  company_info,
  stale_alert_threshold_days,
  bank_accounts,
  logistics_center_info
) VALUES (
  gen_random_uuid(),
  155.0,
  10,
  '{"conversion_fee_rate": 0.007, "swift_fee_usd": 10.0}'::jsonb,
  2.99,
  '{"name": "kokon inc.", "address": "", "phone": "", "email": ""}'::jsonb,
  7,
  ARRAY['{"bank_name": "楽天銀行", "branch_name": "第一営業支店", "account_type": "普通", "account_number": "7427422", "account_holder": "", "is_default": true}'::jsonb],
  '{"name": "株式会社サンキューコーポレーション", "facility": "八王子ロジスティックスセンター", "address": "〒192-0375 東京都八王子市鑓水2-175-1", "contact_person": "茂手木様", "email": "ec@0999.co.jp", "phone": "042-674-0999"}'::jsonb
);

-- ============================================================================
-- SCHEMA REBUILD COMPLETE
-- ============================================================================
