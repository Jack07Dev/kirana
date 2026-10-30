-- Common Indian FMCG catalog seed (kirana)
INSERT INTO catalog (name_en, name_hi, brand, category, unit, default_mrp, barcode, store_types) VALUES
-- Staples
('Aashirvaad Atta 5kg', 'आशीर्वाद आटा 5kg', 'Aashirvaad', 'staples', 'pack', 280, '8901262200123', ARRAY['kirana']::store_type[]),
('Fortune Sunflower Oil 1L', 'फॉर्च्यून सूरजमुखी तेल 1L', 'Fortune', 'staples', 'L', 145, '8901030865123', ARRAY['kirana']::store_type[]),
('Tata Salt 1kg', 'टाटा नमक 1kg', 'Tata', 'staples', 'kg', 28, '8901262010012', ARRAY['kirana']::store_type[]),
('India Gate Basmati 1kg', 'इंडिया गेट बासमती 1kg', 'India Gate', 'staples', 'kg', 165, '8906001234567', ARRAY['kirana']::store_type[]),
('Toor Dal 1kg', 'तूर दाल 1kg', NULL, 'staples', 'kg', 140, NULL, ARRAY['kirana']::store_type[]),
('Sugar 1kg', 'चीनी 1kg', NULL, 'staples', 'kg', 45, NULL, ARRAY['kirana']::store_type[]),
('MDH Garam Masala 100g', 'एमडीएच गरम मसाला 100g', 'MDH', 'staples', 'pack', 72, '8901052001012', ARRAY['kirana']::store_type[]),
('Everest Turmeric 200g', 'एवरेस्ट हल्दी 200g', 'Everest', 'staples', 'pack', 58, '8901058845123', ARRAY['kirana']::store_type[]),

-- Dairy
('Amul Taaza Milk 500ml', 'अमूल ताज़ा दूध 500ml', 'Amul', 'dairy', 'ml', 28, '8901262123456', ARRAY['kirana']::store_type[]),
('Amul Butter 100g', 'अमूल बटर 100g', 'Amul', 'dairy', 'pack', 58, '8901262100456', ARRAY['kirana']::store_type[]),
('Amul Cheese Cubes 200g', 'अमूल चीज़ क्यूब्स 200g', 'Amul', 'dairy', 'pack', 125, '8901262100789', ARRAY['kirana']::store_type[]),
('Mother Dairy Curd 400g', 'मदर डेयरी दही 400g', 'Mother Dairy', 'dairy', 'pack', 35, '8901030867890', ARRAY['kirana']::store_type[]),
('Amul Fresh Cream 250ml', 'अमूल फ्रेश क्रीम 250ml', 'Amul', 'dairy', 'ml', 65, '8901262100999', ARRAY['kirana']::store_type[]),

-- Snacks
('Parle-G 800g', 'पारले-जी 800g', 'Parle', 'snacks', 'pack', 70, '8901262011111', ARRAY['kirana']::store_type[]),
('Britannia Good Day 200g', 'ब्रिटानिया गुड डे 200g', 'Britannia', 'snacks', 'pack', 40, '8901063123456', ARRAY['kirana']::store_type[]),
('Lays Classic Salted 52g', 'लेज़ क्लासिक साल्टेड 52g', 'Lays', 'snacks', 'pack', 20, '8901491101234', ARRAY['kirana']::store_type[]),
('Kurkure Masala Munch 90g', 'कुरकुरे मसाला मंच 90g', 'Kurkure', 'snacks', 'pack', 20, '8901491105678', ARRAY['kirana']::store_type[]),
('Haldirams Bhujia 400g', 'हल्दीराम भुजिया 400g', 'Haldirams', 'snacks', 'pack', 110, '8901552001234', ARRAY['kirana']::store_type[]),
('Maggi 2-Minute Noodles 70g', 'मैगी 2-मिनट नूडल्स 70g', 'Maggi', 'snacks', 'pack', 14, '8901058000123', ARRAY['kirana']::store_type[]),

-- Beverages
('Tata Tea Gold 500g', 'टाटा टी गोल्ड 500g', 'Tata Tea', 'beverages', 'pack', 310, '8901262205555', ARRAY['kirana']::store_type[]),
('Nescafe Classic 50g', 'नेस्काफे क्लासिक 50g', 'Nescafe', 'beverages', 'pack', 165, '8901058849999', ARRAY['kirana']::store_type[]),
('Real Fruit Juice 1L', 'रियल फ्रूट जूस 1L', 'Real', 'beverages', 'L', 110, '8901030890123', ARRAY['kirana']::store_type[]),
('Coca Cola 750ml', 'कोका कोला 750ml', 'Coca Cola', 'beverages', 'ml', 40, '8901764112345', ARRAY['kirana']::store_type[]),
('Bisleri Water 1L', 'बिसलेरी पानी 1L', 'Bisleri', 'beverages', 'L', 20, '8906001239999', ARRAY['kirana']::store_type[]),

-- Personal Care
('Colgate Strong Teeth 200g', 'कोलगेट स्ट्रॉन्ग टीथ 200g', 'Colgate', 'personal_care', 'pack', 110, '8901314001234', ARRAY['kirana']::store_type[]),
('Lifebuoy Soap 125g', 'लाइफबॉय साबुन 125g', 'Lifebuoy', 'personal_care', 'pcs', 35, '8901030800123', ARRAY['kirana']::store_type[]),
('Clinic Plus Shampoo 180ml', 'क्लिनिक प्लस शैम्पू 180ml', 'Clinic Plus', 'personal_care', 'ml', 95, '8901030800456', ARRAY['kirana']::store_type[]),
('Dettol Handwash 200ml', 'डेटॉल हैंडवॉश 200ml', 'Dettol', 'personal_care', 'ml', 99, '8901314156789', ARRAY['kirana']::store_type[]),

-- Household
('Surf Excel 1kg', 'सर्फ एक्सेल 1kg', 'Surf Excel', 'household', 'kg', 220, '8901030812345', ARRAY['kirana']::store_type[]),
('Vim Dishwash Bar 300g', 'विम डिशवॉश बार 300g', 'Vim', 'household', 'pcs', 45, '8901030856789', ARRAY['kirana']::store_type[]),
('Harpic Toilet Cleaner 500ml', 'हारपिक टॉयलेट क्लीनर 500ml', 'Harpic', 'household', 'ml', 95, '8901314199999', ARRAY['kirana']::store_type[]),
('Good Knight Refill 45ml', 'गुड नाइट रिफिल 45ml', 'Good Knight', 'household', 'ml', 80, '8901314111111', ARRAY['kirana']::store_type[]);
