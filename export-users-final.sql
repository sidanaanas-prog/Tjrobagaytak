-- ======================================================
--   تصدير مستخدمين Gaytak للنقل إلى Neon DB
--   العدد: 13 مستخدم
--   تنفيذ: psql "<DATABASE_URL>" -f export-users.sql
-- ======================================================

INSERT INTO users (id, name, email, phone, password_hash, avatar, role, banned, created_at, streak_count) VALUES
  ('3d5f3bdb-7827-4342-9f9d-37a8a8d7c275', 'Test User', '3d5f3bdb-7827-4342-9f9d-37a8a8d7c275@gaytak.phone', '+966500000001', 'ee25cbfe-651a-4d9b-9583-6895ff7ecbfe', NULL, 'user', false, '2026-05-17T01:35:06.795Z', 0),
  ('907febf0-f7e0-4bd9-af93-3bea7c66cfb0', 'مستخدم Gaytak', '907febf0-f7e0-4bd9-af93-3bea7c66cfb0@gaytak.phone', '+966550000003', '91743c71-b822-4825-97a2-c5feb82c0efd', NULL, 'user', false, '2026-05-16T22:59:36.651Z', 0),
  ('e6db6d87-9d6b-4964-95ce-17463a19ced4', 'مستخدم Gaytak', 'e6db6d87-9d6b-4964-95ce-17463a19ced4@gaytak.phone', '+966550000002', 'c4fa4578-59e0-4af9-8e8d-3c7692677456', NULL, 'user', false, '2026-05-16T18:07:08.957Z', 0),
  ('756ccada-b9fc-4daa-8a98-78e0fe155480', 'Test User', '756ccada-b9fc-4daa-8a98-78e0fe155480@gaytak.phone', '+966550000001', '640225d9-ce4a-4e38-bd84-117ef045b7ac', NULL, 'user', false, '2026-05-16T17:59:43.306Z', 0),
  ('0d1f5f42-6bdc-41c4-aac5-d764f4c51522', 'Test User', '0d1f5f42-6bdc-41c4-aac5-d764f4c51522@gaytak.phone', '+966551234567', 'f340f917-2dcb-45bf-81ae-16b67602b255', NULL, 'user', false, '2026-05-16T17:54:37.985Z', 0),
  ('18fb480d-0ba6-43a2-8f2f-d22e4302833f', 'اختبار', '18fb480d-0ba6-43a2-8f2f-d22e4302833f@gaytak.phone', '+213551234567', 'daa2eec4-4fab-4f9f-8e86-977d080b13d0', NULL, 'user', false, '2026-04-17T13:45:39.303Z', 0),
  ('91c33a58-b564-42f3-a4b9-c5ddc0dc0bbc', 'الجماني الحسين', '91c33a58-b564-42f3-a4b9-c5ddc0dc0bbc@gaytak.phone', '+213673890650', '3a610c1e-6d56-4c5a-be1e-c44916a6a9a9', NULL, 'user', false, '2026-04-15T13:26:12.628Z', 0),
  ('8e471271-0680-4993-bd37-c0d13634ebef', 'سيدي', '8e471271-0680-4993-bd37-c0d13634ebef@gaytak.phone', '+213657968423', '4d27edee-3b18-4b2c-a83b-4f2e0d92d948', NULL, 'user', false, '2026-04-14T22:15:41.689Z', 0),
  ('fde52f27-3707-4277-bb5c-1bde3b3138dc', '‪Sidana Lahbib‬‏', 'Sidanasidana672@gmail.Com', NULL, '$2b$10$g2N5cJyp.SYHdnwTdlCOuOL9qS9WSjwBauDExVYci93BeHggn6VVC', NULL, 'user', false, '2026-04-14T14:23:49.300Z', 0),
  ('ab75fcf1-f742-472d-940f-38e85984fad1', 'Sara Ahmed', 'sara@example.com', NULL, '$2b$10$dummyhash1', NULL, 'user', false, '2026-04-14T08:18:32.861Z', 0),
  ('9ca6954c-fdf9-4aea-bc22-0fad2a46464a', 'Khalid Nasser', 'khalid@example.com', NULL, '$2b$10$dummyhash2', NULL, 'user', false, '2026-04-14T08:18:32.861Z', 0),
  ('60634661-45b9-4f0e-88f9-780f4d75ac98', 'Layla Hassan', 'layla@example.com', NULL, '$2b$10$dummyhash3', NULL, 'user', false, '2026-04-14T08:18:32.861Z', 0),
  ('e0757f35-e7d4-4c07-ae0b-339252aecfa6', 'مدير Gaytak', 'admin@gaytak.com', NULL, '$2b$10$P101QaB3l6r9TwLqot5ATOAJGk.qRdKKzjBBmgs2zZPm1IkYHBacG', NULL, 'admin', false, '2026-04-14T08:18:10.023Z', 0);

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  password_hash = EXCLUDED.password_hash;

