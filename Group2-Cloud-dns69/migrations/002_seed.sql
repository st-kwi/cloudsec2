-- ============================================================
--  002_seed.sql — ข้อมูลตั้งต้น: คณะ 6 คณะ + แมตช์ตัวอย่าง
--  เวลาแมตช์คิดจาก NOW() ตอนที่รัน จึงมีแมตช์ที่ใกล้ปิดรับให้ทดสอบเสมอ
-- ============================================================

INSERT INTO faculties (code, name_th, short_th, color, text_on) VALUES
  ('eng', 'วิศวกรรมศาสตร์',     'วิศวะ',    '#8B1E2D', '#FFFFFF'),
  ('sci', 'วิทยาศาสตร์',        'วิทยา',    '#E4B000', '#1A1400'),
  ('med', 'แพทยศาสตร์',         'แพทย์',    '#1E7B4A', '#FFFFFF'),
  ('bus', 'บริหารธุรกิจ',        'บริหาร',   '#1F5FA8', '#FFFFFF'),
  ('com', 'นิเทศศาสตร์',        'นิเทศ',    '#8E3B8C', '#FFFFFF'),
  ('arc', 'สถาปัตยกรรมศาสตร์',  'สถาปัตย์', '#B5532B', '#FFFFFF')
ON CONFLICT (code) DO NOTHING;

-- เพิ่มแมตช์ตัวอย่างเฉพาะตอนที่ตารางยังว่าง (รันซ้ำได้ไม่ซ้ำข้อมูล)
INSERT INTO matches (home_code, away_code, kickoff_at)
SELECT * FROM (VALUES
  ('med', 'bus', NOW() + INTERVAL '30 minutes'),
  ('arc', 'com', NOW() + INTERVAL '3 hours'),
  ('eng', 'sci', NOW() + INTERVAL '1 day'),
  ('sci', 'arc', NOW() + INTERVAL '2 days'),
  ('bus', 'eng', NOW() + INTERVAL '3 days')
) AS v(home_code, away_code, kickoff_at)
WHERE NOT EXISTS (SELECT 1 FROM matches);
