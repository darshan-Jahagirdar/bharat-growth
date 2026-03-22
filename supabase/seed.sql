-- =============================================================================
-- BharatGrowth — Seed Data for 3 Pilot Shops
-- =============================================================================
-- Shop 1: Ganesh Tyres      — Regular GST, 18% slab
-- Shop 2: Bikaner Sweets    — Composition Scheme (Bill of Supply)
-- Shop 3: Trends Boutique   — Regular GST, mixed 5%/18% slabs
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- SHOPS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO shops (id, business_name, legal_name, gstin, pan, gst_type, business_type, address_line_1, city, state_code, pincode, phone) VALUES
-- Ganesh Tyres: Regular GST dealer in Maharashtra
('a0000000-0000-0000-0000-000000000001',
 'Ganesh Tyres', 'Ganesh Tyres & Auto Services', '27AAPFG1234A1Z5', 'AAPFG1234A',
 'regular', 'tyre_shop',
 '45, MG Road, Shivaji Nagar', 'Pune', '27', '411005', '+919876543210'),

-- Bikaner Sweets: Composition scheme (no tax breakup on bills)
('a0000000-0000-0000-0000-000000000002',
 'Bikaner Sweets', 'Bikaner Sweets & Namkeen', '09BBRPS5678B1ZX', 'BBRPS5678B',
 'composition', 'sweet_stall',
 '12, Chowk Bazaar, Aminabad', 'Lucknow', '09', '226001', '+919123456789'),

-- Trends Boutique: Regular GST, garments (mixed 5%/18%)
('a0000000-0000-0000-0000-000000000003',
 'Trends Boutique', 'Trends Fashion Pvt Ltd', '29AADCT9876C1ZP', 'AADCT9876C',
 'regular', 'garment_store',
 '78, Commercial Street', 'Bengaluru', '29', '560001', '+919988776655');

-- ─────────────────────────────────────────────────────────────────────────────
-- PRODUCTS — Ganesh Tyres (HSN 4011: New rubber tyres, 28% GST)
-- Note: Most tyres are 28%, tubes are 28%, accessories 18%
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO products (id, shop_id, name, sku, hsn_code, gst_rate_percent, unit_price_paise, selling_price_paise, unit, category, vertical_attrs) VALUES
('b0000000-0000-0000-0000-000000000001',
 'a0000000-0000-0000-0000-000000000001',
 'CEAT Milaze 155/80 R13', 'CEAT-MIL-15580R13', '40111000', 28,
 320000, 350000, 'piece', 'Car Tyres',
 '{"brand": "CEAT", "size": "155/80 R13", "type": "tubeless", "vehicle_type": "hatchback"}'),

('b0000000-0000-0000-0000-000000000002',
 'a0000000-0000-0000-0000-000000000001',
 'MRF ZVTV 185/65 R15', 'MRF-ZVTV-18565R15', '40111000', 28,
 480000, 520000, 'piece', 'Car Tyres',
 '{"brand": "MRF", "size": "185/65 R15", "type": "tubeless", "vehicle_type": "sedan"}'),

('b0000000-0000-0000-0000-000000000003',
 'a0000000-0000-0000-0000-000000000001',
 'Apollo Actigrip R4 3.00-18', 'APL-AG-R4-30018', '40114000', 28,
 180000, 210000, 'piece', 'Bike Tyres',
 '{"brand": "Apollo", "size": "3.00-18", "type": "tube", "vehicle_type": "motorcycle"}'),

('b0000000-0000-0000-0000-000000000004',
 'a0000000-0000-0000-0000-000000000001',
 'MRF Tube 3.00-18', 'MRF-TUBE-30018', '40131000', 28,
 25000, 30000, 'piece', 'Tubes',
 '{"brand": "MRF", "size": "3.00-18", "type": "tube", "vehicle_type": "motorcycle"}'),

('b0000000-0000-0000-0000-000000000005',
 'a0000000-0000-0000-0000-000000000001',
 'Tyre Valve Cap Set (4 pcs)', 'ACC-VALVE-CAP-4', '40169990', 18,
 5000, 8000, 'set', 'Accessories',
 '{"brand": "Generic", "size": "universal"}'),

('b0000000-0000-0000-0000-000000000006',
 'a0000000-0000-0000-0000-000000000001',
 'Wheel Alignment Service', 'SVC-ALIGN', '99871990', 18,
 50000, 60000, 'piece', 'Services',
 '{}'),

('b0000000-0000-0000-0000-000000000007',
 'a0000000-0000-0000-0000-000000000001',
 'JK Tyre Ultima Neo 165/80 R14', 'JK-ULT-16580R14', '40111000', 28,
 350000, 380000, 'piece', 'Car Tyres',
 '{"brand": "JK Tyre", "size": "165/80 R14", "type": "tubeless", "vehicle_type": "sedan"}'),

('b0000000-0000-0000-0000-000000000008',
 'a0000000-0000-0000-0000-000000000001',
 'Bridgestone B290 175/65 R14', 'BRI-B290-17565R14', '40111000', 28,
 520000, 560000, 'piece', 'Car Tyres',
 '{"brand": "Bridgestone", "size": "175/65 R14", "type": "tubeless", "vehicle_type": "sedan"}');

-- ─────────────────────────────────────────────────────────────────────────────
-- PRODUCTS — Bikaner Sweets (Composition scheme — gst_rate stored but NOT shown on bill)
-- HSN 1704/2106 for sweets, 0%/5% for unbranded food items
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO products (id, shop_id, name, sku, hsn_code, gst_rate_percent, unit_price_paise, selling_price_paise, unit, category, vertical_attrs) VALUES
('c0000000-0000-0000-0000-000000000001',
 'a0000000-0000-0000-0000-000000000002',
 'Kaju Katli', 'BIK-KAJUKATLI', '17049090', 5,
 80000, 80000, 'kg', 'Mithai',
 '{"weight_g": 1000, "is_perishable": true, "shelf_life_days": 7}'),

('c0000000-0000-0000-0000-000000000002',
 'a0000000-0000-0000-0000-000000000002',
 'Rasgulla (Tin)', 'BIK-RASGULLA-TIN', '17049090', 5,
 25000, 25000, 'piece', 'Mithai',
 '{"weight_g": 500, "is_perishable": true, "shelf_life_days": 15}'),

('c0000000-0000-0000-0000-000000000003',
 'a0000000-0000-0000-0000-000000000002',
 'Gulab Jamun', 'BIK-GULABJAMUN', '17049090', 5,
 40000, 40000, 'kg', 'Mithai',
 '{"weight_g": 1000, "is_perishable": true, "shelf_life_days": 5}'),

('c0000000-0000-0000-0000-000000000004',
 'a0000000-0000-0000-0000-000000000002',
 'Soan Papdi', 'BIK-SOANPAPDI', '17049090', 5,
 30000, 30000, 'kg', 'Mithai',
 '{"weight_g": 1000, "is_perishable": false, "shelf_life_days": 30}'),

('c0000000-0000-0000-0000-000000000005',
 'a0000000-0000-0000-0000-000000000002',
 'Bikaneri Bhujia', 'BIK-BHUJIA', '21069099', 12,
 22000, 22000, 'kg', 'Namkeen',
 '{"weight_g": 1000, "is_perishable": false, "shelf_life_days": 60}'),

('c0000000-0000-0000-0000-000000000006',
 'a0000000-0000-0000-0000-000000000002',
 'Motichoor Laddu', 'BIK-MOTICHOOR', '17049090', 5,
 50000, 50000, 'kg', 'Mithai',
 '{"weight_g": 1000, "is_perishable": true, "shelf_life_days": 4}'),

('c0000000-0000-0000-0000-000000000007',
 'a0000000-0000-0000-0000-000000000002',
 'Samosa (per piece)', 'BIK-SAMOSA', '21069099', 5,
 1500, 1500, 'piece', 'Snacks',
 '{"weight_g": 80, "is_perishable": true, "shelf_life_days": 1}'),

('c0000000-0000-0000-0000-000000000008',
 'a0000000-0000-0000-0000-000000000002',
 'Paneer Tikka Roll', 'BIK-PTROLL', '21069099', 5,
 6000, 6000, 'piece', 'Snacks',
 '{"weight_g": 200, "is_perishable": true, "shelf_life_days": 1}');

-- ─────────────────────────────────────────────────────────────────────────────
-- PRODUCTS — Trends Boutique (Garments: ≤₹1000 → 5%, >₹1000 → 12%)
-- HSN 6109 (T-shirts), 6204 (suits), 6203 (trousers)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO products (id, shop_id, name, sku, hsn_code, gst_rate_percent, unit_price_paise, selling_price_paise, unit, category, vertical_attrs) VALUES
('d0000000-0000-0000-0000-000000000001',
 'a0000000-0000-0000-0000-000000000003',
 'Men''s Cotton T-Shirt (Round Neck)', 'TRN-MCTS-RN', '61091000', 5,
 45000, 59900, 'piece', 'Men - Topwear',
 '{"size": "M", "color": "Navy Blue", "fabric": "Cotton", "gender": "men"}'),

('d0000000-0000-0000-0000-000000000002',
 'a0000000-0000-0000-0000-000000000003',
 'Men''s Cotton T-Shirt (V-Neck)', 'TRN-MCTS-VN', '61091000', 5,
 50000, 69900, 'piece', 'Men - Topwear',
 '{"size": "L", "color": "Black", "fabric": "Cotton", "gender": "men"}'),

('d0000000-0000-0000-0000-000000000003',
 'a0000000-0000-0000-0000-000000000003',
 'Women''s Silk Saree (Kanchipuram)', 'TRN-WSS-KANCHI', '50071090', 12,
 800000, 1200000, 'piece', 'Women - Ethnic',
 '{"size": "Free", "color": "Red & Gold", "fabric": "Silk", "gender": "women"}'),

('d0000000-0000-0000-0000-000000000004',
 'a0000000-0000-0000-0000-000000000003',
 'Men''s Slim Fit Chinos', 'TRN-MCH-SLIM', '62034200', 12,
 120000, 149900, 'piece', 'Men - Bottomwear',
 '{"size": "32", "color": "Khaki", "fabric": "Cotton Stretch", "gender": "men"}'),

('d0000000-0000-0000-0000-000000000005',
 'a0000000-0000-0000-0000-000000000003',
 'Women''s Kurti (Anarkali)', 'TRN-WK-ANRK', '62042200', 5,
 60000, 89900, 'piece', 'Women - Ethnic',
 '{"size": "M", "color": "Teal", "fabric": "Rayon", "gender": "women"}'),

('d0000000-0000-0000-0000-000000000006',
 'a0000000-0000-0000-0000-000000000003',
 'Kids Cotton Frock', 'TRN-KCF', '62044200', 5,
 30000, 49900, 'piece', 'Kids',
 '{"size": "5-6Y", "color": "Pink", "fabric": "Cotton", "gender": "kids"}'),

('d0000000-0000-0000-0000-000000000007',
 'a0000000-0000-0000-0000-000000000003',
 'Men''s Formal Blazer', 'TRN-MFB', '62033200', 18,
 350000, 499900, 'piece', 'Men - Formal',
 '{"size": "40", "color": "Charcoal", "fabric": "Polyester Wool Blend", "gender": "men"}'),

('d0000000-0000-0000-0000-000000000008',
 'a0000000-0000-0000-0000-000000000003',
 'Women''s Palazzo Pants', 'TRN-WPP', '62046200', 5,
 40000, 59900, 'piece', 'Women - Bottomwear',
 '{"size": "M", "color": "Maroon", "fabric": "Rayon", "gender": "women"}');

-- ─────────────────────────────────────────────────────────────────────────────
-- CUSTOMERS (3 per shop — diverse segments)
-- ─────────────────────────────────────────────────────────────────────────────

-- Ganesh Tyres customers
INSERT INTO customers (id, shop_id, phone_number, name, segment, total_spent_paise, visit_count, dpdp_data_consent, dpdp_marketing_consent) VALUES
('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
 '+919876500001', 'Rajesh Sharma', 'vip', 15200000, 12, true, true),
('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
 '+919876500002', 'Priya Deshmukh', 'regular', 5600000, 4, true, false),
('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
 '+919876500003', 'Amit Patil', 'new', 0, 0, true, true);

-- Bikaner Sweets customers
INSERT INTO customers (id, shop_id, phone_number, name, segment, total_spent_paise, visit_count, dpdp_data_consent, dpdp_marketing_consent) VALUES
('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002',
 '+919123400001', 'Sunita Gupta', 'vip', 4500000, 45, true, true),
('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002',
 '+919123400002', 'Deepak Verma', 'regular', 1200000, 8, true, true),
('e0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002',
 '+919123400003', 'Meena Devi', 'dormant', 300000, 2, true, false);

-- Trends Boutique customers
INSERT INTO customers (id, shop_id, phone_number, name, segment, total_spent_paise, visit_count, dpdp_data_consent, dpdp_marketing_consent) VALUES
('e0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000003',
 '+919988700001', 'Kavitha Nair', 'vip', 8900000, 15, true, true),
('e0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000003',
 '+919988700002', 'Mohammed Rizwan', 'regular', 3200000, 6, true, false),
('e0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000003',
 '+919988700003', 'Anita Reddy', 'new', 0, 0, false, false);

-- ─────────────────────────────────────────────────────────────────────────────
-- CONSENT LOGS (DPDP Act 2026 — initial consent records)
-- ─────────────────────────────────────────────────────────────────────────────

-- Ganesh Tyres consents
INSERT INTO consent_logs (shop_id, customer_id, purpose, status, consent_method, metadata) VALUES
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
 'data_collection', 'granted', 'in_app', '{"language": "hi"}'),
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
 'whatsapp_marketing', 'granted', 'whatsapp_opt_in', '{"template": "loyalty_opt_in_v1"}'),
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002',
 'data_collection', 'granted', 'in_app', '{"language": "en"}'),

-- Bikaner Sweets consents
('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000004',
 'data_collection', 'granted', 'verbal_recorded', '{"language": "hi"}'),
('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000004',
 'whatsapp_marketing', 'granted', 'whatsapp_opt_in', '{"template": "festival_offers_v1"}'),
('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000005',
 'data_collection', 'granted', 'in_app', '{"language": "hi"}'),
('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000005',
 'whatsapp_marketing', 'granted', 'sms', '{}'),

-- Trends Boutique consents
('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000007',
 'data_collection', 'granted', 'in_app', '{"language": "en"}'),
('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000007',
 'whatsapp_marketing', 'granted', 'whatsapp_opt_in', '{"template": "new_arrivals_v1"}');

-- ─────────────────────────────────────────────────────────────────────────────
-- INVENTORY (sample stock for each shop)
-- ─────────────────────────────────────────────────────────────────────────────

-- Ganesh Tyres inventory
INSERT INTO inventory (shop_id, product_id, quantity_in_stock, reorder_level, cost_price_paise, location, supplier_name, supplier_phone) VALUES
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 24, 5, 280000, 'Rack A1', 'CEAT Ltd Distributor', '+912012345678'),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 12, 3, 420000, 'Rack A2', 'MRF Zone Dealer', '+912087654321'),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 30, 10, 150000, 'Rack B1', 'Apollo Tyres Dist', '+912011112222'),
('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', 50, 15, 18000, 'Rack B2', 'MRF Zone Dealer', '+912087654321');

-- Bikaner Sweets inventory (with expiry dates — critical!)
INSERT INTO inventory (shop_id, product_id, batch_number, quantity_in_stock, reorder_level, cost_price_paise, expiry_date, manufacturing_date, location) VALUES
('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'KK-20260322', 5.000, 2, 55000, '2026-03-29', '2026-03-22', 'Display Counter'),
('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 'GJ-20260322', 8.000, 3, 25000, '2026-03-27', '2026-03-22', 'Display Counter'),
('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004', 'SP-20260315', 15.000, 5, 20000, '2026-04-14', '2026-03-15', 'Storage Room'),
('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000005', 'BH-20260320', 20.000, 5, 15000, '2026-05-19', '2026-03-20', 'Storage Room');

-- Trends Boutique inventory
INSERT INTO inventory (shop_id, product_id, quantity_in_stock, reorder_level, cost_price_paise, location, supplier_name) VALUES
('a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 45, 10, 30000, 'Shelf M-1', 'Mumbai Textiles'),
('a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 8, 2, 600000, 'Premium Rack', 'Kanchipuram Weavers Co-op'),
('a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000005', 30, 8, 40000, 'Shelf W-1', 'Jaipur Prints Wholesale'),
('a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000007', 6, 2, 250000, 'Formal Section', 'Raymond Authorized Dealer');

-- ─────────────────────────────────────────────────────────────────────────────
-- LOYALTY LEDGER (sample points for VIP customers)
-- ─────────────────────────────────────────────────────────────────────────────

-- Rajesh Sharma (Ganesh Tyres VIP) — 1520 points earned from ₹1,52,000 spent
INSERT INTO loyalty_ledger (shop_id, customer_id, entry_type, points, running_balance, description) VALUES
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
 'earn', 520, 520, 'Purchase — 2 CEAT Milaze tyres'),
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
 'earn', 1000, 1520, 'Purchase — 2 MRF ZVTV tyres + alignment'),
('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
 'redeem', -200, 1320, 'Redeemed for valve cap set');

-- Sunita Gupta (Bikaner Sweets VIP) — frequent buyer
INSERT INTO loyalty_ledger (shop_id, customer_id, entry_type, points, running_balance, description) VALUES
('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000004',
 'earn', 45, 45, 'Purchase — Kaju Katli 1kg'),
('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000004',
 'earn', 80, 125, 'Purchase — Rasgulla + Motichoor Laddu'),
('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000004',
 'earn', 50, 175, 'Birthday bonus — 50 bonus points'),
('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000004',
 'redeem', -100, 75, 'Redeemed for 500g Soan Papdi');

-- Kavitha Nair (Trends Boutique VIP)
INSERT INTO loyalty_ledger (shop_id, customer_id, entry_type, points, running_balance, description) VALUES
('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000007',
 'earn', 1200, 1200, 'Purchase — Kanchipuram Silk Saree'),
('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000007',
 'earn', 500, 1700, 'Purchase — Blazer + Chinos'),
('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000007',
 'redeem', -300, 1400, 'Redeemed — ₹300 off Kurti purchase');

-- =============================================================================
-- END OF SEED DATA
-- =============================================================================
