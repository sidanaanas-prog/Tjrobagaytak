-- ======================================================
--   تصدير مستخدمين Gaytak للنقل إلى Neon DB
--   العدد: 13 مستخدم
--   تنفيذ: psql "<DATABASE_URL>" -f export-users.sql
--   ملاحظة: الصور الشخصية ليست منقولة (يمكن إعادة رفعها)
-- ======================================================

INSERT INTO users (id, name, email, phone, avatar, role, banned, created_at) VALUES
  ('3d5f3bdb-7827-4342-9f9d-37a8a8d7c275', 'Test User', '3d5f3bdb-7827-4342-9f9d-37a8a8d7c275@gaytak.phone', '+966500000001', NULL, 'user', false, '2026-05-17T01:35:06.795Z'),
  ('907febf0-f7e0-4bd9-af93-3bea7c66cfb0', 'مستخدم Gaytak', '907febf0-f7e0-4bd9-af93-3bea7c66cfb0@gaytak.phone', '+966550000003', NULL, 'user', false, '2026-05-16T22:59:36.651Z'),
  ('e6db6d87-9d6b-4964-95ce-17463a19ced4', 'مستخدم Gaytak', 'e6db6d87-9d6b-4964-95ce-17463a19ced4@gaytak.phone', '+966550000002', NULL, 'user', false, '2026-05-16T18:07:08.957Z'),
  ('756ccada-b9fc-4daa-8a98-78e0fe155480', 'Test User', '756ccada-b9fc-4daa-8a98-78e0fe155480@gaytak.phone', '+966550000001', NULL, 'user', false, '2026-05-16T17:59:43.306Z'),
  ('0d1f5f42-6bdc-41c4-aac5-d764f4c51522', 'Test User', '0d1f5f42-6bdc-41c4-aac5-d764f4c51522@gaytak.phone', '+966551234567', NULL, 'user', false, '2026-05-16T17:54:37.985Z'),
  ('18fb480d-0ba6-43a2-8f2f-d22e4302833f', 'اختبار', '18fb480d-0ba6-43a2-8f2f-d22e4302833f@gaytak.phone', '+213551234567', NULL, 'user', false, '2026-04-17T13:45:39.303Z'),
  ('91c33a58-b564-42f3-a4b9-c5ddc0dc0bbc', 'الجماني الحسين', '91c33a58-b564-42f3-a4b9-c5ddc0dc0bbc@gaytak.phone', '+213673890650', NULL, 'user', false, '2026-04-15T13:26:12.628Z'),
  ('8e471271-0680-4993-bd37-c0d13634ebef', 'سيدي', '8e471271-0680-4993-bd37-c0d13634ebef@gaytak.phone', '+213657968423', NULL, 'user', false, '2026-04-14T22:15:41.689Z'),
  ('fde52f27-3707-4277-bb5c-1bde3b3138dc', '‪Sidana Lahbib‬‏', 'Sidanasidana672@gmail.Com', NULL, NULL, 'user', false, '2026-04-14T14:23:49.300Z'),
  ('ab75fcf1-f742-472d-940f-38e85984fad1', 'Sara Ahmed', 'sara@example.com', NULL, NULL, 'user', false, '2026-04-14T08:18:32.861Z'),
  ('9ca6954c-fdf9-4aea-bc22-0fad2a46464a', 'Khalid Nasser', 'khalid@example.com', NULL, NULL, 'user', false, '2026-04-14T08:18:32.861Z'),
  ('60634661-45b9-4f0e-88f9-780f4d75ac98', 'Layla Hassan', 'layla@example.com', NULL, NULL, 'user', false, '2026-04-14T08:18:32.861Z'),
  ('e0757f35-e7d4-4c07-ae0b-339252aecfa6', 'مدير Gaytak', 'admin@gaytak.com', NULL, NULL, 'admin', false, '2026-04-14T08:18:10.023Z');

-- إذا كان هناك مستخدم موجود مسبقاً بنفس الـ ID:
-- ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone;

