# BAOFlow Database Schema (Actual)

> 追加復帰コードが参照するローカル未リリース台帳は042/043/047のSQL定義に基づく。本番適用は未確認。`wizard_requests`: request_id uuid PK / user_id uuid NOT NULL / operation text NOT NULL / payload jsonb NOT NULL / result jsonb NULL / created_at timestamptz NOT NULL。`rfq_creation_requests`: request_id uuid PK / created_by uuid NOT NULL / payload jsonb NOT NULL / result jsonb NOT NULL / created_at timestamptz NOT NULL。`document_issue_requests`: request_id uuid PK / created_by uuid NOT NULL / payload jsonb NOT NULL / document_id uuid NOT NULL / created_at timestamptz NOT NULL。RFQ payload案件キーは`deal`、wizard/帳票は`deal_id`。SELECTは本人かつstaffに限定し、帳票はdocument_idからdocumentsを参照する。リリース前に実DBの型/RLS/grantを確認する。

> **Auto-generated: 2026-02-12**
> This file contains the actual database schema from Supabase.
> **Always reference this file when writing code that interacts with the database.**

## Tables

### ai_action_logs
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| deal_id | uuid | YES | null |
| action_type | text | YES | null |
| action_detail | jsonb | YES | null |
| ai_mode | USER-DEFINED | YES | null |
| requires_review | boolean | YES | false |
| reviewed_by | uuid | YES | null |
| reviewed_at | timestamptz | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### catalog_items
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| category | text | YES | null |
| product_type_ja | text | YES | null |
| product_type_en | text | YES | null |
| description_ja | text | YES | null |
| description_en | text | YES | null |
| available_sizes | ARRAY | YES | null |
| available_colors | ARRAY | YES | null |
| material_display | text | YES | null |
| material_technical | text | YES | null |
| options | ARRAY | YES | null |
| custom_print_available | boolean | YES | true |
| moq_estimate | integer | YES | null |
| price_range | text | YES | null |
| images | ARRAY | YES | null |
| is_visible | boolean | YES | true |
| is_featured | boolean | YES | false |
| sort_order | integer | YES | 0 |
| internal_notes | text | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### chat_messages
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| room_id | uuid | NO | null |
| user_id | uuid | YES | null |
| content_original | text | YES | null |
| content_translated | text | YES | null |
| original_language | text | YES | null |
| source | text | YES | null |
| is_system_message | boolean | YES | false |
| is_template_message | boolean | YES | false |
| is_ai_generated | boolean | YES | false |
| attachments | ARRAY | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### chat_rooms
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| deal_id | uuid | YES | null |
| room_type | USER-DEFINED | NO | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### clients
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| company_name | text | NO | null |
| brand_name | text | YES | null |
| contact_name | text | YES | null |
| contact_role | text | YES | null |
| industry | text | YES | null |
| company_size | text | YES | null |
| phone | text | YES | null |
| email | text | YES | null |
| address | text | YES | null |
| default_delivery_address | text | YES | null |
| default_sample_cost_rate | numeric | YES | 0.5 |
| uses_storage_service | boolean | YES | false |
| storage_rate_config | jsonb | YES | null |
| assigned_sales_ids | ARRAY | YES | null |
| total_transaction_amount | numeric | YES | 0 |
| total_order_count | integer | YES | 0 |
| notes | text | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### deal_actuals
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| deal_id | uuid | NO | null |
| actual_product_cost | numeric | YES | null |
| actual_shipping_cost | numeric | YES | null |
| actual_inspection_cost | numeric | YES | null |
| actual_wise_fee | numeric | YES | null |
| actual_alibaba_fee | numeric | YES | null |
| actual_total | numeric | YES | null |
| actual_sample_cost | numeric | YES | null |
| profit | numeric | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### deal_design_files
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| deal_id | uuid | NO | null |
| file_url | text | NO | null |
| file_name | text | YES | null |
| file_type | text | YES | null |
| version_number | integer | NO | 1 |
| comment | text | YES | null |
| uploaded_by_user_id | uuid | YES | null |
| is_final | boolean | YES | false |
| status | text | YES | 'draft' |
| submitted_at | timestamptz | YES | null |
| reviewed_at | timestamptz | YES | null |
| reviewer_notes | text | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### deal_factory_assignments
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| deal_id | uuid | NO | null |
| factory_id | uuid | NO | null |
| is_competitive_quote | boolean | YES | false |
| status | USER-DEFINED | YES | 'requesting' |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### deal_factory_payments
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| deal_id | uuid | NO | null |
| factory_id | uuid | YES | null |
| payment_type | USER-DEFINED | NO | null |
| payment_method | USER-DEFINED | YES | null |
| amount_usd | numeric | YES | null |
| amount_jpy | numeric | YES | null |
| fee_amount | numeric | YES | 0 |
| status | USER-DEFINED | YES | 'unpaid' |
| due_date | date | YES | null |
| paid_at | timestamptz | YES | null |
| trigger_condition | text | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### deal_groups
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| client_id | uuid | YES | null |
| sales_user_id | uuid | YES | null |
| notes | text | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### deal_items
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| deal_id | uuid | NO | null |
| product_name | text | NO | null |
| specs | text | YES | null |
| quantity | integer | NO | null |
| unit_price_cny | numeric | YES | null |
| notes | text | YES | null |
| sort_order | integer | NO | 0 |
| created_at | timestamptz | NO | now() |

### deal_packing_lists
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| deal_id | uuid | NO | null |
| carton_number | integer | YES | null |
| total_cartons | integer | YES | null |
| product_id_range | text | YES | null |
| quantity_in_carton | integer | YES | null |
| weight_kg | numeric | YES | null |
| uploaded_file_url | text | YES | null |
| label_pdf_url | text | YES | null |
| status | USER-DEFINED | YES | 'draft' |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### deal_quotes
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| deal_id | uuid | NO | null |
| factory_id | uuid | YES | null |
| version | integer | NO | 1 |
| quantity | integer | YES | null |
| factory_unit_price_usd | numeric | YES | null |
| plate_fee_usd | numeric | YES | 0 |
| other_fees_usd | numeric | YES | 0 |
| total_cost_usd | numeric | YES | null |
| unit_cost_usd | numeric | YES | null |
| cost_ratio | numeric | YES | null |
| exchange_rate | numeric | YES | null |
| selling_price_usd | numeric | YES | null |
| selling_price_jpy | numeric | YES | null |
| total_billing_jpy | numeric | YES | null |
| total_billing_tax_jpy | numeric | YES | null |
| moq | integer | YES | null |
| status | USER-DEFINED | YES | 'drafting' |
| source_type | text | YES | null |
| source_file_url | text | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### deal_sample_summary
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| deal_id | uuid | NO | null |
| total_sample_cost_jpy | numeric | YES | 0 |
| client_cost_rate | numeric | YES | 0.5 |
| client_charge_jpy | numeric | YES | 0 |
| company_charge_jpy | numeric | YES | 0 |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### deal_samples
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| deal_id | uuid | NO | null |
| round_number | integer | NO | 1 |
| sample_production_fee_usd | numeric | YES | null |
| sample_shipping_fee_usd | numeric | YES | null |
| plate_fee_usd | numeric | YES | 0 |
| subtotal_usd | numeric | YES | null |
| subtotal_jpy | numeric | YES | null |
| sample_status | USER-DEFINED | YES | 'requested' |
| feedback_memo | text | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### deal_schedule
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| deal_id | uuid | NO | null |
| factory_id | uuid | YES | null |
| sample_production_days | integer | YES | null |
| mass_production_days | integer | YES | null |
| desired_delivery_date | date | YES | null |
| calculated_order_deadline | date | YES | null |
| payment_due_date | date | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### deal_shipping
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| deal_id | uuid | NO | null |
| delivery_address | text | YES | null |
| delivery_type | USER-DEFINED | YES | null |
| selected_shipping_option_id | uuid | YES | null |
| packing_info | jsonb | YES | null |
| tracking_number | text | YES | null |
| tracking_url | text | YES | null |
| food_inspection_required | boolean | YES | false |
| food_inspection_cost | numeric | YES | null |
| logistics_notified_at | timestamptz | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### deal_shipping_options
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| deal_quote_id | uuid | NO | null |
| shipping_method | USER-DEFINED | YES | null |
| incoterm | USER-DEFINED | YES | null |
| shipping_cost_usd | numeric | YES | null |
| shipping_days | integer | YES | null |
| is_selected | boolean | YES | false |
| notes | text | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### deal_specifications
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| deal_id | uuid | NO | null |
| product_category | text | YES | null |
| product_name | text | YES | null |
| height_mm | numeric | YES | null |
| width_mm | numeric | YES | null |
| depth_mm | numeric | YES | null |
| diameter_mm | numeric | YES | null |
| bottom_diameter_mm | numeric | YES | null |
| capacity_ml | numeric | YES | null |
| size_notes | text | YES | null |
| material_category | text | YES | null |
| material_thickness | text | YES | null |
| material_notes | text | YES | null |
| printing_method | text | YES | null |
| print_colors | text | YES | null |
| print_sides | text | YES | null |
| printing_notes | text | YES | null |
| processing_list | ARRAY | YES | null |
| lamination | text | YES | null |
| processing_notes | text | YES | null |
| attachments_list | ARRAY | YES | null |
| attachment_notes | text | YES | null |
| reference_images | ARRAY | YES | null |
| existing_quote_file | text | YES | null |
| specification_memo | text | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### deal_status_history
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| deal_id | uuid | NO | null |
| from_status | USER-DEFINED | YES | null |
| to_status | USER-DEFINED | NO | null |
| changed_by | uuid | YES | null |
| note | text | YES | null |
| changed_at | timestamptz | NO | now() |

### deals
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| deal_code | text | NO | null |
| deal_name | text | YES | null |
| client_id | uuid | YES | null |
| sales_user_id | uuid | YES | null |
| master_status | USER-DEFINED | NO | 'M01' |
| win_probability | USER-DEFINED | YES | 'medium' |
| deal_group_id | uuid | YES | null |
| parent_deal_id | uuid | YES | null |
| delivery_type | USER-DEFINED | YES | 'direct' |
| ai_mode | USER-DEFINED | YES | 'assist' |
| last_activity_at | timestamptz | YES | now() |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### design_files
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| deal_id | uuid | NO | null |
| file_name | text | NO | null |
| file_url | text | NO | null |
| file_type | text | YES | null |
| file_size | integer | YES | null |
| version | integer | YES | 1 |
| is_final | boolean | YES | false |
| notes | text | YES | null |
| uploaded_by | uuid | YES | null |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

### documents
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| deal_id | uuid | YES | null |
| document_type | USER-DEFINED | NO | null |
| document_number | text | YES | null |
| file_url | text | YES | null |
| version | integer | YES | 1 |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### factories
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| contact_name | text | YES | null |
| factory_name | text | NO | null |
| rating | numeric | YES | null |
| specialties | ARRAY | YES | null |
| quality | text | YES | null |
| price_level | text | YES | null |
| response_speed | text | YES | null |
| politeness | text | YES | null |
| contact_method | text | YES | null |
| address | text | YES | null |
| bank_info | jsonb | YES | null |
| default_payment_terms | text | YES | null |
| default_payment_method | USER-DEFINED | YES | null |
| excel_template_id | text | YES | null |
| avg_response_days | integer | YES | null |
| notes | text | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### inventory_items
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| client_id | uuid | YES | null |
| deal_id | uuid | YES | null |
| product_name | text | YES | null |
| product_specs | text | YES | null |
| current_stock | integer | YES | 0 |
| storage_location | text | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |
| safety_stock | integer | YES | 0 |

### inventory_movements
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| inventory_item_id | uuid | NO | null |
| movement_type | USER-DEFINED | NO | null |
| quantity | integer | NO | null |
| balance_after | integer | YES | null |
| source_type | text | YES | null |
| source_id | uuid | YES | null |
| notes | text | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### logistics_agents
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| name | text | NO | null |
| name_en | text | YES | null |
| agent_type | USER-DEFINED | YES | null |
| services | ARRAY | YES | null |
| rate_cards | jsonb | YES | null |
| contact_info | jsonb | YES | null |
| is_primary | boolean | YES | false |
| notes | text | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### logistics_notifications
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| deal_id | uuid | YES | null |
| inventory_item_id | uuid | YES | null |
| notification_type | text | YES | null |
| email_sent_at | timestamptz | YES | null |
| email_content | text | YES | null |
| confirmed_at | timestamptz | YES | null |
| carton_count | integer | YES | null |
| total_weight | numeric | YES | null |
| estimated_arrival | date | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### message_templates
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| category | text | YES | null |
| content_ja | text | YES | null |
| content_zh | text | YES | null |
| content_en | text | YES | null |
| created_by | uuid | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### notifications
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | YES | null |
| deal_id | uuid | YES | null |
| type | USER-DEFINED | YES | null |
| status | USER-DEFINED | YES | 'pending' |
| content | text | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### price_records
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| factory_id | uuid | YES | null |
| product_type | text | YES | null |
| material | text | YES | null |
| size | text | YES | null |
| printing | text | YES | null |
| quantity | integer | YES | null |
| unit_price_usd | numeric | YES | null |
| deal_id | uuid | YES | null |
| recorded_at | timestamptz | NO | now() |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |
| product_category | text | YES | null |
| shipping_usd | numeric | YES | 0 |

### product_registry
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| product_code | text | YES | null |
| product_name | text | NO | null |
| category | text | YES | null |
| material | text | YES | null |
| hs_code | text | YES | null |
| tariff_rate | numeric | YES | null |
| factory_id | uuid | YES | null |
| registration_number | text | YES | null |
| test_report_id | uuid | YES | null |
| is_registered | boolean | YES | false |
| notes | text | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### profiles
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | null |
| role | USER-DEFINED | NO | 'sales' |
| display_name | text | YES | null |
| email | text | YES | null |
| avatar_url | text | YES | null |
| language_preference | text | YES | 'ja' |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |
| client_id | uuid | YES | null |
| factory_id | uuid | YES | null |

### shipment_order_items
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| shipment_order_id | uuid | NO | null |
| inventory_item_id | uuid | NO | null |
| quantity | integer | NO | null |
| picked_quantity | integer | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### shipment_orders
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| order_code | text | NO | null |
| client_id | uuid | YES | null |
| status | USER-DEFINED | YES | 'received' |
| requested_at | timestamptz | YES | now() |
| desired_ship_date | date | YES | null |
| delivery_address | text | YES | null |
| shipping_fee | numeric | YES | null |
| tracking_number | text | YES | null |
| tracking_url | text | YES | null |
| logistics_notified_at | timestamptz | YES | null |
| shipped_at | timestamptz | YES | null |
| delivered_at | timestamptz | YES | null |
| notes | text | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### stale_alerts
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| deal_id | uuid | NO | null |
| stale_since | timestamptz | NO | now() |
| stale_reason | USER-DEFINED | YES | null |
| is_resolved | boolean | YES | false |
| resolved_at | timestamptz | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### storage_billing
051 local candidate（本番未適用、実source SQLをPGliteで検証）：nullable `snapshot jsonb` / `request_id uuid UNIQUE` / `created_by uuid FK profiles`を追加。client_id・billing_month非nullの組はUNIQUE。既存行を補完しない。auth SELECTはstaffとclient自社、直接INSERT/UPDATE/DELETE/TRUNCATEは禁止、staff限定issue_storage_invoiceで作成する。

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| client_id | uuid | YES | null |
| billing_month | text | YES | null |
| storage_fee | numeric | YES | null |
| handling_fee_in | numeric | YES | null |
| handling_fee_out | numeric | YES | null |
| total_amount | numeric | YES | null |
| invoice_document_id | uuid | YES | null |
| status | USER-DEFINED | YES | 'calculated' |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### system_settings
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| default_exchange_rate | numeric | YES | 155.0 |
| default_tax_rate | numeric | YES | 10 |
| wise_fee_config | jsonb | YES | null |
| alibaba_cc_fee_rate | numeric | YES | 2.99 |
| company_info | jsonb | YES | null |
| invoice_registration_number | text | YES | null |
| company_stamp_image | text | YES | null |
| bank_accounts | ARRAY | YES | null |
| default_sample_cost_rate | numeric | YES | 0.5 |
| invoice_notes_template | text | YES | null |
| stale_alert_threshold_days | integer | YES | 7 |
| food_inspection_config | jsonb | YES | null |
| logistics_center_info | jsonb | YES | null |
| logistics_email_template | text | YES | null |
| shipment_instruction_template | text | YES | null |
| storage_billing_method | text | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### test_reports
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| report_number | text | YES | null |
| testing_agency | text | YES | null |
| testing_agency_type | USER-DEFINED | YES | null |
| applicant | text | YES | null |
| product_name | text | YES | null |
| material | text | YES | null |
| manufacturer_factory_id | uuid | YES | null |
| test_date | date | YES | null |
| conclusion | text | YES | null |
| report_pdf_url | text | YES | null |
| notes | text | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### transactions
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| contract_number | text | YES | null |
| client_or_factory_id | uuid | YES | null |
| deal_ids | ARRAY | YES | null |
| direction | USER-DEFINED | NO | null |
| user_id | uuid | YES | null |
| status | text | YES | 'pending' |
| payment_method | text | YES | null |
| fee_amount | numeric | YES | null |
| billing_status | text | YES | null |
| amount_jpy | numeric | YES | null |
| occurred_at | timestamptz | YES | null |
| due_date | date | YES | null |
| invoice_file_url | text | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### deals (Sprint 10 追加カラム)
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| waiting_on | text | NO | 'us' | -- us / client / factory / none

### inventory_items (Sprint 10)
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| client_id | uuid | YES | null |
| deal_id | uuid | YES | null |
| product_id | uuid | YES | null |
| item_name | text | NO | null |
| item_code | text | YES | null |
| spec_note | text | YES | null |
| unit | text | NO | '個' |
| quantity_on_hand | integer | NO | 0 |
| cartons_on_hand | integer | YES | null |
| warehouse_name | text | YES | null |
| location_note | text | YES | null |
| thumbnail_url | text | YES | null |
| first_arrived_at | date | YES | null |
| note | text | YES | null |
| created_by | uuid | YES | null |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### inventory_transactions (Sprint 10)
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| item_id | uuid | NO | null |
| tx_type | text | NO | null | -- inbound / outbound / adjust
| quantity_delta | integer | NO | null | -- 符号つき増減
| occurred_on | date | NO | CURRENT_DATE |
| deal_id | uuid | YES | null |
| destination | text | YES | null |
| note | text | YES | null |
| created_by | uuid | YES | null |
| created_at | timestamptz | NO | now() |


## ローカル候補048〜050のschema確認 (2026-09-30)

以下は実顧客データを使わず、001〜037のsource schemaに038〜050を適用したPGliteのcatalogから取得。本番適用済みを意味しない。029/030/034/037以降のカラムと、新RPCが使う列の参照台帳。各SQL自体を正典とする。

### deal_product_variants (候補source schema)

`id` (uuid, not null), `product_id` (uuid, not null), `variant_label` (text, not null), `variant_order` (integer, not null), `width_mm` (numeric, nullable), `height_mm` (numeric, nullable), `depth_mm` (numeric, nullable), `material` (text, nullable), `color_description` (text, nullable), `pantone_colors` (text, nullable), `processing` (text, nullable), `other_notes` (text, nullable), `print_color_count` (text, nullable), `print_method` (text, nullable), `pcs_per_carton` (integer, nullable), `carton_width_cm` (numeric, nullable), `carton_height_cm` (numeric, nullable), `carton_depth_cm` (numeric, nullable), `gross_weight_kg` (numeric, nullable), `production_lead_days` (integer, nullable), `shipping_lead_days` (integer, nullable), `food_inspection_days` (integer, nullable), `shipping_address` (text, nullable), `is_selected` (boolean, not null), `created_at` (timestamp with time zone, not null), `updated_at` (timestamp with time zone, not null)。

### deal_products (候補source schema)

`id` (uuid, not null), `deal_id` (uuid, not null), `product_no` (integer, not null), `description` (text, not null), `factory_staff_code` (text, nullable), `production_process` (text, nullable), `food_grade_status` (text, nullable), `food_inspection_status` (text, nullable), `product_memo` (text, nullable), `is_selected` (boolean, not null), `created_at` (timestamp with time zone, not null), `updated_at` (timestamp with time zone, not null), `shipping_address_label` (text, nullable), `shipping_address_full` (text, nullable), `shipping_recipient_name` (text, nullable), `shipping_phone` (text, nullable), `shipping_address_id` (uuid, nullable), `thumbnail_url` (text, nullable), `category_l1` (text, nullable), `category_l2` (text, nullable), `category_l3` (text, nullable)。

### deal_quotes (候補source schema)

`id` (uuid, not null), `deal_id` (uuid, not null), `factory_id` (uuid, nullable), `version` (integer, not null), `quantity` (integer, nullable), `factory_unit_price_usd` (numeric, nullable), `plate_fee_usd` (numeric, nullable), `other_fees_usd` (numeric, nullable), `total_cost_usd` (numeric, nullable), `unit_cost_usd` (numeric, nullable), `cost_ratio` (numeric, nullable), `exchange_rate` (numeric, nullable), `selling_price_usd` (numeric, nullable), `selling_price_jpy` (numeric, nullable), `total_billing_jpy` (numeric, nullable), `total_billing_tax_jpy` (numeric, nullable), `moq` (integer, nullable), `status` (USER-DEFINED, nullable), `source_type` (text, nullable), `source_file_url` (text, nullable), `created_at` (timestamp with time zone, not null), `updated_at` (timestamp with time zone, not null), `spec_id` (uuid, nullable), `variant_id` (uuid, nullable), `shipping_weight_kg` (numeric, nullable), `volumetric_weight_kg` (numeric, nullable), `actual_weight_total_kg` (numeric, nullable), `china_freight_yuan` (numeric, nullable), `china_freight_usd` (numeric, nullable), `domestic_china_freight_usd` (numeric, nullable), `pantone_color_fee_usd` (numeric, nullable), `food_inspection_fee_yuan` (numeric, nullable), `sample_cost_usd` (numeric, nullable), `sample_shipping_usd` (numeric, nullable), `yuan_to_usd_rate` (numeric, nullable), `incoterm` (text, nullable), `packing_info_text` (text, nullable), `sample_production_days` (integer, nullable), `sample_shipping_days` (integer, nullable), `factory_calculated_freight_usd` (numeric, nullable), `factory_response` (jsonb, nullable)。

2026-10-01 第3段ローカル候補（本番未適用）: deal_quotes.pricing_snapshot jsonb nullable。quote_status実enumはdrafting/presented/approved/rejected/revising。quote_pricing_requests: request_id uuid PK、created_by uuid、deal_id uuid、payload jsonb、quote_id uuid、created_at timestamptz。quote_cost_lines: id uuid PK、quote_id uuid、line_key/kind/name/currency text、amount/amount_usd numeric。新migrationとCODEX_PRICING_STAGE3_RELEASE_GATE.md参照。

### deals (候補source schema)

`id` (uuid, not null), `deal_code` (text, not null), `deal_name` (text, nullable), `client_id` (uuid, nullable), `sales_user_id` (uuid, nullable), `master_status` (USER-DEFINED, not null), `win_probability` (USER-DEFINED, nullable), `deal_group_id` (uuid, nullable), `parent_deal_id` (uuid, nullable), `delivery_type` (USER-DEFINED, nullable), `ai_mode` (USER-DEFINED, nullable), `last_activity_at` (timestamp with time zone, nullable), `created_at` (timestamp with time zone, not null), `updated_at` (timestamp with time zone, not null), `simple_status` (USER-DEFINED, not null), `visibility` (text, not null), `client_name_text` (text, nullable), `desired_delivery_date` (date, nullable), `memo` (text, nullable), `use_client_master` (boolean, not null), `shipping_method_1` (text, nullable), `contract_number` (text, nullable), `contract_signed_at` (timestamp with time zone, nullable), `column_widths` (jsonb, not null), `archived_at` (timestamp with time zone, nullable), `archived_by` (uuid, nullable), `archive_reason` (text, nullable), `archive_note` (text, nullable), `tags` (ARRAY, not null), `waiting_on` (text, not null), `brand_text` (text, nullable)。

### external_forms (候補source schema)

`id` (uuid, not null), `form_type` (text, not null), `token` (text, not null), `related_id` (uuid, nullable), `status` (text, not null), `expires_at` (timestamp with time zone, nullable), `submitted_at` (timestamp with time zone, nullable), `submitted_by_email` (text, nullable), `submission_ip` (text, nullable), `submission_user_agent` (text, nullable), `cancelled_at` (timestamp with time zone, nullable), `cancelled_by` (uuid, nullable), `created_by` (uuid, nullable), `context` (jsonb, nullable), `submission_data` (jsonb, nullable), `created_at` (timestamp with time zone, not null)。

### factories (候補source schema)

`id` (uuid, not null), `contact_name` (text, nullable), `factory_name` (text, not null), `rating` (numeric, nullable), `specialties` (ARRAY, nullable), `quality` (text, nullable), `price_level` (text, nullable), `response_speed` (text, nullable), `politeness` (text, nullable), `contact_method` (text, nullable), `address` (text, nullable), `bank_info` (jsonb, nullable), `default_payment_terms` (text, nullable), `default_payment_method` (USER-DEFINED, nullable), `excel_template_id` (text, nullable), `avg_response_days` (integer, nullable), `notes` (text, nullable), `created_at` (timestamp with time zone, not null), `updated_at` (timestamp with time zone, not null), `name_cn` (text, nullable), `contact_phone` (text, nullable), `contact_email` (text, nullable), `wechat` (text, nullable), `payment_terms` (text, nullable), `incoterm` (text, nullable), `lead_time_range` (text, nullable), `quality_stars` (integer, nullable), `delivery_stars` (integer, nullable), `price_stars` (integer, nullable), `since` (date, nullable), `catalog_files` (jsonb, not null), `self_registered_at` (timestamp with time zone, nullable), `self_registration_form_id` (uuid, nullable), `basic_info_completed` (boolean, not null)。

### rfq_answer_imports (候補source schema)

`invitation_id` (uuid, not null), `factory_id` (uuid, not null), `created_by` (uuid, not null), `imported_at` (timestamp with time zone, not null), `answer` (jsonb, not null), `quote_ids` (ARRAY, not null)。

### rfq_email_receipts (候補source schema)

`invitation_id` (uuid, not null), `attempt_id` (uuid, not null), `actor_id` (uuid, not null), `status` (text, not null), `provider_message_id` (text, nullable), `started_at` (timestamp with time zone, not null), `finished_at` (timestamp with time zone, nullable)。

### rfq_factory_invitations (候補source schema)

`id` (uuid, not null), `rfq_id` (uuid, not null), `factory_id` (uuid, nullable), `factory_name_pending` (text, nullable), `factory_email_pending` (text, nullable), `external_form_id` (uuid, nullable), `invitation_sent_at` (timestamp with time zone, nullable), `responded_at` (timestamp with time zone, nullable), `created_at` (timestamp with time zone, not null)。

### rfq_requests (候補source schema)

`id` (uuid, not null), `deal_id` (uuid, not null), `product_ids` (ARRAY, not null), `rfq_number` (text, not null), `request_message` (text, nullable), `status` (text, not null), `response_deadline` (date, nullable), `created_by` (uuid, nullable), `created_at` (timestamp with time zone, not null), `updated_at` (timestamp with time zone, not null)。

### document_email_receipts（051ローカル候補・本番未適用）

`document_id` uuid PK/FK documents、`actor_id` uuid not null FK profiles、`attempt_id` uuid not null unique、`status` text not null（attempting/accepted/unknown/rejected）、`provider_message_id` text nullable、`started_at` timestamptz not null、`finished_at` timestamptz nullable。staff SELECTのみ、直接書込撤回。staff限定 `issue_storage_invoice` / `claim_storage_invoice_email` / `finish_storage_invoice_email` は原子的発行・永久送信予約・同actor結果確定を担う。051 SQLを正典とし、既存取引の推測補完はしない。

本番反映：2026-09-30、038〜051 sourceをworkflow_release_038_051/version20260930150639で一括適用。052は内部8RPCのanon個別EXECUTE撤回のみ。受入記録/本番migration履歴を照合する。将来internal owner table default ACLは変更していない。

## 未適用ローカル候補：sample_ledger_v1（20261001111822）

本番schemaではない。新導線はmigration承認/適用後だけ公開する。既存deal_samples/deal_sample_summaryは変更しない。

- sample_rounds: id, deal_id, product_id, variant_id, factory_id, round_number, quantity, due_date, note, status, created_by, created_at。
- sample_estimates: id, round_id, kind, carrier, amount, currency, basis, created_by, created_at。概算だけを保持し請求対象外。
- sample_costs: id, round_id, kind, carrier, estimate, amount, currency, fx, customer_charge_jpy, basis, confirmed_by, confirmed_at, voided_at, void_reason。
- sample_payments: id, round_id, amount, currency, paid_on, reference, created_by, created_at。
- sample_invoices: id, deal_id, document_number, snapshot, status, previous_invoice_id, cancellation_reason, cancelled_at, created_by, created_at。
- sample_invoice_lines: id, invoice_id, cost_id, released_at。有効割当cost_idに部分unique。
- sample_requests: id, created_by, deal_id, operation, payload, result, created_at。本人staff SELECTのみ。
- sample_mail_receipts: invoice_id, attempt_id, created_by, payload, status, provider_id, created_at, finished_at。

全表RLS、authenticated SELECT/staff限定、直接write/TRUNCATEなし。型・nullable・check・FKの正本は候補migration。preview_sample_invoice、sample_command、claim_sample_email、finish_sample_emailはstaff専用RPC。

### 第4段 顧客承認・実着金（ローカル候補・本番未適用）

正本 `20261001121648_client_settlement_v1.sql`。既存列は変えず、新表7つを追加する。
- client_document_packets: id/document_id/deal_id/client_id、document_type、snapshot（顧客向け原価除外版）、approval_packet_id、status、cancel_reason/cancelled_at、created_by/created_at。
- client_document_links: id、packet_id、token、expires_at、revoked_at、created_by/created_at。staff SELECTのみ。顧客は認証済み自社scopeのRPCでのみ検証する。
- client_document_responses: packet_id、decision、note、created_by/created_at。
- client_payment_reports: id、packet_id、created_by、amount_jpy bigint、paid_on date、reference、status、review_note、created_at。
- client_payment_receipts: id、report_id、packet_id、amount_jpy bigint、received_on date、bank_reference unique、confirmed_by/created_at。staff SELECTのみ。
- client_finance_requests: id、created_by、operation、payload、result、created_at。本人SELECTのみ。
- client_document_mail_receipts: packet_id、attempt_id、payload、status、created_by、provider_id、created_at/finished_at。

全表RLS、直接write/TRUNCATEなし。顧客SELECTは自社packet・自分のreport/requestだけ。顧客context RPCはclient本人の自社有効版のみ。公開token単独では認証不可。顧客回答/申告とstaff実着金/工程反映を別commandにする。issued documentsの未来snapshotには既存deals.client_idを含める（legacy補完なし）。

### 第5段 工場最終条件・支払記録・着金確認（ローカル候補）

`20261001130755_factory_production_v1.sql`が型/FK/checkの正本。本番未適用。
- factory_final_terms: id/order_id/version、total_usd numeric(20,4)、payment_mode、upfront_usd numeric(20,4)、balance_due、lead_days、bank_snapshot（factories.bank_info原文/更新日時/source/factory_id）、note、created_by/created_at。
- factory_terms_agreements: order_id PK、terms_id、bank_evidence、note、approved_by/approved_at。staff SELECTのみ。factory contextでは同意版ID/時刻だけ返す。
- factory_transfer_reports: id/order_id/terms_id、amount_usd numeric(20,4)、sent_on、reference unique、created_by/created_at。
- factory_bank_acknowledgments: id/report_id/order_id、amount_usd numeric(20,4)、received_on、bank_reference、created_by/created_at。order_id+bank_reference unique。
- factory_production_starts: order_id PK、terms_id、started_on、expected_completion_on、note、created_by/created_at。
- factory_workflow_requests: id、order_id、created_by、operation、payload、result、created_at。本人staff/本人自社factory操作のSELECTのみ。

全表immutable/RLS/直接write・TRUNCATEなし。staffとfactory自社に限定（agreement内部照合情報はstaffのみ）。factory_order_context、factory_workflow_commandはauthenticated EXECUTE/実行時roleとfactory_id照合、anon/PUBLICなし。既存PO銀行情報を推測補完しない。既存USD PO総額の変更は新採用見積/発注へ戻し、支払条件で原価を無言変更しない。

### 第6段 QC（ローカル候補・本番未適用）

`20261001134525_factory_qc_v1.sql`が正本。
- factory_qc_assets: id UUID（保存要求と同一）、order_id、kind、object_path unique、mime、byte_size bigint、sha256、created_by/created_at。
- factory_qc_submissions: id/order_id/version、completed_on、quantity（全PO数量）、asset_ids UUID[]、note、created_by/created_at。
- factory_qc_reviews: id/order_id/submission_id unique、decision、note、created_by/created_at。
- factory_qc_requests: id/order_id/created_by、operation、payload、result、created_at。本人staff/本人factory操作のみSELECT。

全表immutable/RLS/直接write・TRUNCATEなし、staffと自社factoryのみ。factory_qc_context/commandはauthenticated実行時scopeチェック、匿名/PUBLICなし。新private bucket factory-qc（PNG/JPEG/MP4、50MiB以下、order UUID/asset UUIDの保存先）。factory自社・製造開始済みのINSERTだけ、staff/factory自社SELECT、UPDATE/DELETEなし。画像/動画閲覧はauth/RLS/ファイルhash照合後の60秒署名URL。既存public deal-imagesを変更しない。

localhostで実確認したstorage.objects列はid UUID、bucket_id/name text、owner UUID、created_at/updated_at/last_accessed_at timestamptz、metadata jsonb、path_tokens ARRAY、version text、owner_id text、user_metadata jsonb、archived_at timestamptz、is_delete_marker/is_versioned boolean。登録はStorage API保存済みのowner_id/metadata.mimetype・size/user_metadata.sha256を照合する。SQLでobject metadata行を作らない。

## 第7段ローカル候補：輸出配送（本番未適用）

既存PO id/deal_id/factory_id/quantity/status/snapshot.variant_id、profiles id/role/client_id/display_name、deal_products shipping_address_full/shipping_recipient_name/shipping_phone、clients default_delivery_address/company_name/email、logistics_partners id/partner_kind/company_name/address/is_active/contact_email、system_settings company_info_phase1を使用する。既存inboundはBAO倉庫入庫台帳なので輸出台帳へ流用しない。

新shipment_plans: id UUID, order_id/deal_id/client_id/factory_id UUID, quantity integer, logistics_actor_id/partner_id UUID, snapshot JSONB, created_by UUID, created_at timestamptz。
shipment_milestones: id/plan_id/created_by UUID, kind/source/note/tracking_number text, occurred_at/created_at timestamptz。
shipment_customer_receipts: id/plan_id/created_by UUID, quantity integer, received_on date, note text, created_at timestamptz。
shipment_delivery_documents: id/plan_id UUID, document_number text UNIQUE, snapshot JSONB, created_by UUID, created_at timestamptz。
shipment_workflow_requests: id UUID, order_id UUID, created_by UUID, operation text, payload/result JSONB, created_at timestamptz。
shipment_mail_receipts: id UUID, plan_id UUID, event_key text UNIQUE, payload JSONB, status text, provider_id text nullable, created_by UUID, created_at/finished_at timestamptz。

第8段ローカル候補 `20261001162000_client_payment_conditions_v1.sql` は新表/カラムなし。既存 client_document_packets.snapshot の payment_conditions に mode / balance_due / upfront_jpy / shipment_required_jpy / total_jpy / rounding を保存する。既存 client_payment_receipts.packet_id / amount_jpy と顧客承認版を参照して発注/発送の必要着金を確認。paid は合意前払条件成立を表し、実全額着金はreceipt合計とpaid_in_fullで別判定する。

第9段ローカル候補 `20261001170000_partial_factory_qc_v1.sql`: factory_qc_reviews.rejection_scope text NOT NULL DEFAULT all CHECK(all,new_quantity) を追加。factory_qc_submissions.quantity は累計完工数量。factory_purchase_orders.id/quantity、factory_production_starts.order_id、shipment_plans.order_id/quantity、inbound_shipments.id/purchase_order_id/status、inbound_shipment_items.id/shipment_id/expected_quantity を参照して承認累計と配送/倉庫予約量を照合する。新tableなし、上書き/削除禁止を維持。

## Stage10 訂正・再共有候補（本番未適用）
`20261001180000_client_document_corrections_v1.sql` は新表/カラムなし。
client_document_packets.snapshot に payment_origin_packet_ids / replaces_packet_id / reissue_kind を保存。
client_finance_requests.operation は record_refund / reserve_document_resend / finish_document_resend を追加し、payload の packet_id / amount_jpy / refunded_on / bank_reference / reason / mail_payload / attempt_id と result の refund_jpy / net_jpy / previous_attempt_id / status / provider_id を使用。銀行事実・再送予約は既存の不変リクエスト履歴へ追記。
同じUUIDの再送予約は初回だけ claimed=true、再実行は claimed=false。外部送信を再実行する根拠に保存済みresultを使わない。

## Stage11 再価格承認候補（本番未適用）
新表/カラムなし。client_document_packets.snapshot に reprices_invoice_id / payment_carry_jpy を追加し、reissue_kind=customer_reapproved_price の新請求へ既存系列のpayment_origin_packet_idsを保存。client_finance_requests.operation=reissue_priced_invoice、payloadのapproval_packet_id / payment_allocation_confirmedを使用。respond_quoteのpayloadにpayment_carry_confirmed、publish_documentにreprice_invoice_id / reprice_confirmed / reasonを追加。staff_client_finance_summaryに document_type/status/current_price/decision/upfront_jpy を既存データから投影。client_finance_contextにcurrent_priceを投影する。元の着金・旧版・顧客回答は更新/削除しない。
