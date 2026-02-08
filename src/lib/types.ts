// ============================================================================
// BAO Flow Type Definitions
// Based on: supabase/migrations/010_rebuild_schema.sql
// ============================================================================

// ============================================================================
// Enums & Constants
// ============================================================================

export type MasterStatus =
  | 'M01' | 'M02' | 'M03' | 'M04' | 'M05'
  | 'M06' | 'M07' | 'M08' | 'M09' | 'M10'
  | 'M11' | 'M12' | 'M13' | 'M14' | 'M15'
  | 'M16' | 'M17' | 'M18' | 'M19' | 'M20'
  | 'M21' | 'M22' | 'M23' | 'M24' | 'M25'

export type StatusPhase = '見積もり' | '発注・支払い' | '製造' | '出荷・納品'

export type StatusColor = 'pending' | 'confirmed' | 'warning' | 'active' | 'shipping'

export interface StatusConfig {
  label: string
  phase: StatusPhase
  color: StatusColor
  nextAction?: string
}

export const MASTER_STATUS_CONFIG: Record<MasterStatus, StatusConfig> = {
  M01: { label: '見積もり依頼受付', phase: '見積もり', color: 'pending', nextAction: '営業確認・工場選定' },
  M02: { label: '営業確認・工場選定中', phase: '見積もり', color: 'pending', nextAction: '工場に見積もり依頼を送信' },
  M03: { label: '工場見積もり依頼送信済み', phase: '見積もり', color: 'pending', nextAction: '工場からの回答を待つ' },
  M04: { label: '工場回答待ち', phase: '見積もり', color: 'pending', nextAction: '工場からの回答を待つ' },
  M05: { label: '工場回答受領・原価計算完了', phase: '見積もり', color: 'pending', nextAction: 'クライアントに見積もりを提示' },
  M06: { label: 'クライアントへ見積もり提示', phase: '見積もり', color: 'pending', nextAction: 'クライアントの検討を待つ' },
  M07: { label: 'クライアント検討中', phase: '見積もり', color: 'pending', nextAction: 'クライアントの回答を待つ' },
  M08: { label: 'クライアント修正依頼', phase: '見積もり', color: 'warning', nextAction: '見積もりを再調整' },
  M09: { label: '見積もり再調整中', phase: '見積もり', color: 'pending', nextAction: '見積もりを再提示' },
  M10: { label: '見積もり再提示', phase: '見積もり', color: 'pending', nextAction: 'クライアントの承認を待つ' },
  M11: { label: 'クライアント承認', phase: '発注・支払い', color: 'confirmed', nextAction: '請求書を発行' },
  M12: { label: '請求書発行', phase: '発注・支払い', color: 'warning', nextAction: 'クライアントの入金を待つ' },
  M13: { label: 'クライアント入金待ち', phase: '発注・支払い', color: 'warning', nextAction: 'クライアントの入金を待つ' },
  M14: { label: 'クライアント入金確認', phase: '発注・支払い', color: 'confirmed', nextAction: '工場へ前払い' },
  M15: { label: '工場へ前払い', phase: '発注・支払い', color: 'warning', nextAction: '工場の入金確認を待つ' },
  M16: { label: '工場入金確認・製造開始待ち', phase: '製造', color: 'pending', nextAction: '製造開始を待つ' },
  M17: { label: '製造開始', phase: '製造', color: 'active', nextAction: '製造の進捗を確認' },
  M18: { label: '製造中', phase: '製造', color: 'active', nextAction: '製造の進捗を確認' },
  M19: { label: '製造完了・検品', phase: '製造', color: 'active', nextAction: '残金支払いまたは発送準備' },
  M20: { label: '工場残金支払い', phase: '出荷・納品', color: 'warning', nextAction: '発送準備' },
  M21: { label: '発送準備・パッキングリスト作成', phase: '出荷・納品', color: 'shipping', nextAction: '発送' },
  M22: { label: '発送済み', phase: '出荷・納品', color: 'shipping', nextAction: '輸送の追跡' },
  M23: { label: '輸送中', phase: '出荷・納品', color: 'shipping', nextAction: '到着を待つ' },
  M24: { label: '到着・検品', phase: '出荷・納品', color: 'shipping', nextAction: '納品完了' },
  M25: { label: '納品完了', phase: '出荷・納品', color: 'confirmed' },
}

export type WinProbability = 'very_high' | 'high' | 'medium' | 'low' | 'won' | 'lost'

export type AIMode = 'assist' | 'auto' | 'manual'

export type DeliveryType = 'direct' | 'logistics_center'

export type QuoteStatus = 'drafting' | 'presented' | 'approved' | 'rejected' | 'revising'

export type SampleStatus = 'requested' | 'manufacturing' | 'shipping' | 'arrived' | 'ok' | 'revision_needed'

export type PaymentType = 'advance' | 'balance' | 'full'

export type PaymentMethod = 'wise' | 'alibaba_cc' | 'bank_transfer'

export type PaymentStatus = 'unpaid' | 'paid'

export type FactoryAssignmentStatus = 'requesting' | 'responded' | 'selected' | 'not_selected'

export type ShippingMethod = 'sea' | 'air' | 'partial_air'

export type Incoterm = 'exw' | 'ddp' | 'dpu' | 'fob' | 'cif'

export type DocumentType = 'quotation' | 'invoice' | 'delivery_note' | 'inventory_cert' | 'storage_invoice'

export type TransactionDirection = 'in' | 'out'

export type UserRole = 'admin' | 'sales' | 'client' | 'factory'

export type StaleReason = 'factory_no_response' | 'client_no_response' | 'sales_action_needed' | 'payment_pending'

// ============================================================================
// Database Table Types
// ============================================================================

export interface Profile {
  id: string
  role: UserRole
  display_name: string | null
  email: string | null
  avatar_url: string | null
  language_preference: string
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  company_name: string
  brand_name: string | null
  contact_name: string | null
  contact_role: string | null
  industry: string | null
  company_size: string | null
  phone: string | null
  email: string | null
  address: string | null
  default_delivery_address: string | null
  default_sample_cost_rate: number
  uses_storage_service: boolean
  storage_rate_config: Record<string, unknown> | null
  assigned_sales_ids: string[] | null
  total_transaction_amount: number
  total_order_count: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Factory {
  id: string
  contact_name: string | null
  factory_name: string
  rating: number | null
  specialties: string[] | null
  quality: string | null
  price_level: string | null
  response_speed: string | null
  politeness: string | null
  contact_method: string | null
  address: string | null
  bank_info: Record<string, unknown> | null
  default_payment_terms: string | null
  default_payment_method: PaymentMethod | null
  excel_template_id: string | null
  avg_response_days: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Deal {
  id: string
  deal_code: string
  deal_name: string | null
  client_id: string | null
  sales_user_id: string | null
  master_status: MasterStatus
  win_probability: WinProbability
  deal_group_id: string | null
  parent_deal_id: string | null
  delivery_type: DeliveryType
  ai_mode: AIMode
  last_activity_at: string
  created_at: string
  updated_at: string
}

export interface DealSpecification {
  id: string
  deal_id: string
  product_category: string | null
  product_name: string | null
  height_mm: number | null
  width_mm: number | null
  depth_mm: number | null
  diameter_mm: number | null
  bottom_diameter_mm: number | null
  capacity_ml: number | null
  size_notes: string | null
  material_category: string | null
  material_thickness: string | null
  material_notes: string | null
  printing_method: string | null
  print_colors: string | null
  print_sides: string | null
  printing_notes: string | null
  processing_list: string[] | null
  lamination: string | null
  processing_notes: string | null
  attachments_list: string[] | null
  attachment_notes: string | null
  reference_images: string[] | null
  existing_quote_file: string | null
  specification_memo: string | null
  created_at: string
  updated_at: string
}

export interface DealDesignFile {
  id: string
  deal_id: string
  file_url: string
  file_name: string | null
  file_type: string | null
  version_number: number
  comment: string | null
  uploaded_by_user_id: string | null
  is_final: boolean
  created_at: string
  updated_at: string
}

export interface DealFactoryAssignment {
  id: string
  deal_id: string
  factory_id: string
  is_competitive_quote: boolean
  status: FactoryAssignmentStatus
  created_at: string
  updated_at: string
}

export interface DealQuote {
  id: string
  deal_id: string
  factory_id: string | null
  version: number
  quantity: number | null
  factory_unit_price_usd: number | null
  plate_fee_usd: number
  other_fees_usd: number
  total_cost_usd: number | null
  unit_cost_usd: number | null
  cost_ratio: number | null
  exchange_rate: number | null
  selling_price_usd: number | null
  selling_price_jpy: number | null
  total_billing_jpy: number | null
  total_billing_tax_jpy: number | null
  moq: number | null
  status: QuoteStatus
  source_type: string | null
  source_file_url: string | null
  created_at: string
  updated_at: string
}

export interface DealShippingOption {
  id: string
  deal_quote_id: string
  shipping_method: ShippingMethod | null
  incoterm: Incoterm | null
  shipping_cost_usd: number | null
  shipping_days: number | null
  is_selected: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DealSchedule {
  id: string
  deal_id: string
  factory_id: string | null
  sample_production_days: number | null
  mass_production_days: number | null
  desired_delivery_date: string | null
  calculated_order_deadline: string | null
  payment_due_date: string | null
  created_at: string
  updated_at: string
}

export interface DealSample {
  id: string
  deal_id: string
  round_number: number
  sample_production_fee_usd: number | null
  sample_shipping_fee_usd: number | null
  plate_fee_usd: number
  subtotal_usd: number | null
  subtotal_jpy: number | null
  sample_status: SampleStatus
  feedback_memo: string | null
  created_at: string
  updated_at: string
}

export interface DealSampleSummary {
  id: string
  deal_id: string
  total_sample_cost_jpy: number
  client_cost_rate: number
  client_charge_jpy: number
  company_charge_jpy: number
  created_at: string
  updated_at: string
}

export interface DealFactoryPayment {
  id: string
  deal_id: string
  factory_id: string | null
  payment_type: PaymentType
  payment_method: PaymentMethod | null
  amount_usd: number | null
  amount_jpy: number | null
  fee_amount: number
  status: PaymentStatus
  due_date: string | null
  paid_at: string | null
  trigger_condition: string | null
  created_at: string
  updated_at: string
}

export interface DealShipping {
  id: string
  deal_id: string
  delivery_address: string | null
  delivery_type: DeliveryType | null
  selected_shipping_option_id: string | null
  packing_info: Record<string, unknown> | null
  tracking_number: string | null
  tracking_url: string | null
  food_inspection_required: boolean
  food_inspection_cost: number | null
  logistics_notified_at: string | null
  created_at: string
  updated_at: string
}

export interface DealActuals {
  id: string
  deal_id: string
  actual_product_cost: number | null
  actual_shipping_cost: number | null
  actual_inspection_cost: number | null
  actual_wise_fee: number | null
  actual_alibaba_fee: number | null
  actual_total: number | null
  actual_sample_cost: number | null
  profit: number | null
  created_at: string
  updated_at: string
}

export interface DealStatusHistory {
  id: string
  deal_id: string
  from_status: MasterStatus | null
  to_status: MasterStatus
  changed_by: string | null
  note: string | null
  changed_at: string
}

export interface Transaction {
  id: string
  contract_number: string | null
  client_or_factory_id: string | null
  deal_ids: string[] | null
  direction: TransactionDirection
  user_id: string | null
  status: string
  payment_method: string | null
  fee_amount: number | null
  billing_status: string | null
  amount_jpy: number | null
  occurred_at: string | null
  due_date: string | null
  invoice_file_url: string | null
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  deal_id: string | null
  document_type: DocumentType
  document_number: string | null
  file_url: string | null
  version: number
  created_at: string
  updated_at: string
}

export interface StaleAlert {
  id: string
  deal_id: string
  stale_since: string
  stale_reason: StaleReason | null
  is_resolved: boolean
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface SystemSettings {
  id: string
  default_exchange_rate: number
  default_tax_rate: number
  wise_fee_config: {
    conversion_fee_rate: number
    swift_fee_usd: number
  } | null
  alibaba_cc_fee_rate: number
  company_info: Record<string, unknown> | null
  invoice_registration_number: string | null
  company_stamp_image: string | null
  bank_accounts: Record<string, unknown>[] | null
  default_sample_cost_rate: number
  invoice_notes_template: string | null
  stale_alert_threshold_days: number
  food_inspection_config: Record<string, unknown> | null
  logistics_center_info: Record<string, unknown> | null
  logistics_email_template: string | null
  shipment_instruction_template: string | null
  storage_billing_method: string | null
  created_at: string
  updated_at: string
}

export interface ProductRegistry {
  id: string
  product_code: string | null
  product_name: string
  category: string | null
  material: string | null
  hs_code: string | null
  tariff_rate: number | null
  factory_id: string | null
  registration_number: string | null
  test_report_id: string | null
  is_registered: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface TestReport {
  id: string
  report_number: string | null
  testing_agency: string | null
  testing_agency_type: 'foreign_public' | 'domestic_registered' | null
  applicant: string | null
  product_name: string | null
  material: string | null
  manufacturer_factory_id: string | null
  test_date: string | null
  conclusion: string | null
  report_pdf_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PriceRecord {
  id: string
  factory_id: string | null
  product_type: string | null
  material: string | null
  size: string | null
  printing: string | null
  quantity: number | null
  unit_price_usd: number | null
  deal_id: string | null
  recorded_at: string
  created_at: string
  updated_at: string
}

// ============================================================================
// Relation Types
// ============================================================================

export interface DealFactoryAssignmentWithFactory extends DealFactoryAssignment {
  factory?: Factory
}

export interface DealQuoteWithShippingOptions extends DealQuote {
  shipping_options?: DealShippingOption[]
  factory?: Factory
}

export interface DealWithRelations extends Deal {
  client?: Client
  factory_assignments?: DealFactoryAssignmentWithFactory[]
  specifications?: DealSpecification
  quotes?: DealQuoteWithShippingOptions[]
  samples?: DealSample[]
  payments?: DealFactoryPayment[]
  design_files?: DealDesignFile[]
  status_history?: DealStatusHistory[]
  shipping?: DealShipping
}

// ============================================================================
// Form Types
// ============================================================================

export interface CreateDealInput {
  deal_name?: string
  client_id: string
  delivery_type?: DeliveryType
  ai_mode?: AIMode
}

export interface UpdateDealInput {
  deal_name?: string
  client_id?: string
  master_status?: MasterStatus
  win_probability?: WinProbability
  delivery_type?: DeliveryType
  ai_mode?: AIMode
  expected_delivery?: string
}

export interface CreateClientInput {
  company_name: string
  brand_name?: string
  contact_name?: string
  contact_role?: string
  industry?: string
  phone?: string
  email?: string
  address?: string
  default_delivery_address?: string
  default_sample_cost_rate?: number
  notes?: string
}

export interface UpdateClientInput extends Partial<CreateClientInput> {}

export interface CreateFactoryInput {
  factory_name: string
  contact_name?: string
  address?: string
  specialties?: string[]
  rating?: number
  quality?: string
  price_level?: string
  response_speed?: string
  default_payment_terms?: string
  default_payment_method?: PaymentMethod
  notes?: string
}

export interface UpdateFactoryInput extends Partial<CreateFactoryInput> {}

export interface CreateQuoteInput {
  deal_id: string
  factory_id: string
  quantity: number
  factory_unit_price_usd: number
  plate_fee_usd?: number
  other_fees_usd?: number
  cost_ratio?: number
  exchange_rate?: number
}

export interface UpdateQuoteInput extends Partial<CreateQuoteInput> {
  status?: QuoteStatus
}

export interface CreatePaymentInput {
  deal_id: string
  factory_id?: string
  payment_type: PaymentType
  payment_method?: PaymentMethod
  amount_usd?: number
  amount_jpy?: number
  due_date?: string
  trigger_condition?: string
}

export interface UpdatePaymentInput extends Partial<CreatePaymentInput> {
  status?: PaymentStatus
  paid_at?: string
}

export interface CreateSampleInput {
  deal_id: string
  sample_production_fee_usd?: number
  sample_shipping_fee_usd?: number
  plate_fee_usd?: number
}

export interface UpdateSampleInput extends Partial<CreateSampleInput> {
  sample_status?: SampleStatus
  feedback_memo?: string
}

// ============================================================================
// Dashboard Types
// ============================================================================

export interface DashboardKPIs {
  monthlySales: number
  progressRate: number
  activeDeals: number
  monthlyCompletedDeals: number
}

export interface PipelineData {
  phase: StatusPhase
  count: number
  deals: Deal[]
}

export interface StaleAlertWithDeal extends StaleAlert {
  deal: Deal & { client?: Client }
}

export interface PaymentAlertData {
  payment: DealFactoryPayment
  deal: Deal
  factory?: Factory
  daysUntilDue: number
}
