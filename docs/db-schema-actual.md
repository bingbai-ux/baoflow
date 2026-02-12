# BAOFlow Database Schema (Actual)

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
