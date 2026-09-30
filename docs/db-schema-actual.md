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
