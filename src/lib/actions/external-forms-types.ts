// Pure types for external-forms action — kept outside 'use server' so client
// components can import safely (避ける RSC manifest issue, 確立した運用慣習)。

export type ExternalFormType =
  | 'client_self_registration'
  | 'factory_self_registration'
  | 'rfq_response'

export type ExternalFormStatus = 'pending' | 'submitted' | 'expired' | 'cancelled'

export interface ExternalFormRow {
  id: string
  form_type: ExternalFormType
  token: string
  related_id: string | null
  status: ExternalFormStatus
  expires_at: string | null
  submitted_at: string | null
  submitted_by_email: string | null
  submission_ip: string | null
  submission_user_agent: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  context: Record<string, unknown> | null
  submission_data: Record<string, unknown> | null
  created_by: string | null
  created_at: string
}

export interface ClientAddressInput {
  label: string
  recipient_name?: string | null
  postal_code?: string | null
  address_line1: string
  address_line2?: string | null
  phone?: string | null
  email?: string | null
  is_default?: boolean
  notes?: string | null
}

export interface ClientSelfRegistrationPayload {
  company_name: string
  short_name?: string | null
  industry?: string | null
  contact_name?: string | null
  contact_role?: string | null
  phone?: string | null
  email?: string | null
  tax_id?: string | null
  payment_terms?: string | null
  tax_rate?: number | null
  addresses: ClientAddressInput[]
}

export interface FactorySelfRegistrationPayload {
  factory_name: string
  name_cn?: string | null
  contact_name?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  wechat?: string | null
  address?: string | null
  specialties?: string[]
  payment_terms?: string | null
  incoterm?: string | null
  lead_time_range?: string | null
  bank_info_text?: string | null
  notes?: string | null
}

export interface RfqResponseProductLine {
  product_id: string
  variant_id?: string | null
  unit_price_usd?: number | null
  moq?: number | null
  pcs_per_carton?: number | null
  carton_w_cm?: number | null
  carton_h_cm?: number | null
  carton_d_cm?: number | null
  gross_weight_kg?: number | null
  production_lead_days?: number | null
  notes?: string | null
}

export interface RfqResponsePayload {
  factory_email?: string | null
  payment_terms?: string | null
  general_notes?: string | null
  products: RfqResponseProductLine[]
}
