export type deal_status =
  | 'draft'
  | 'quoting'
  | 'quoted'
  | 'spec_confirmed'
  | 'sample_requested'
  | 'sample_approved'
  | 'payment_pending'
  | 'deposit_paid'
  | 'in_production'
  | 'production_done'
  | 'inspection'
  | 'shipping'
  | 'customs'
  | 'delivered'
  | 'invoice_sent'
  | 'payment_received'
  | 'completed'
  | 'cancelled'
  | 'on_hold'

export interface Profile {
  id: string
  role: string
  display_name: string
  email: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Factory {
  id: string
  name: string
  country: string
  city: string | null
  specialties: string[] | null
  payment_terms: string | null
  contact_name: string | null
  contact_email: string | null
  contact_wechat: string | null
  rating: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Deal {
  id: string
  deal_number: string
  client_id: string | null
  factory_id: string | null
  assignee_id: string | null
  status: deal_status
  product_name: string
  material: string | null
  size: string | null
  quantity: number | null
  unit_price_cny: number | null
  exchange_rate: number | null
  shipping_method: string | null
  estimated_delivery: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined fields
  clients?: Client
  factories?: Factory
  profiles?: Profile
}

export interface DealStatusHistory {
  id: string
  deal_id: string
  from_status: deal_status | null
  to_status: deal_status
  changed_by: string | null
  note: string | null
  changed_at: string
  profiles?: Profile
}

export type PaymentType = 'deposit' | 'balance' | 'full'
export type PaymentMethodType = 'wise' | 'alibaba' | 'bank_transfer'
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Payment {
  id: string
  deal_id: string
  payment_type: PaymentType
  payment_method: PaymentMethodType
  amount_cny: number | null
  amount_jpy: number | null
  exchange_rate: number | null
  reference_number: string | null
  status: PaymentStatus
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined fields
  deals?: Deal
}
