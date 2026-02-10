-- Fix deal_quotes: set total_billing_tax_jpy = total_billing_jpy * 1.1 (10% tax)
UPDATE deal_quotes
SET total_billing_tax_jpy = total_billing_jpy * 1.1
WHERE total_billing_tax_jpy IS NULL AND total_billing_jpy IS NOT NULL;
