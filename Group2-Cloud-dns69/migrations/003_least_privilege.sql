-- ============================================================
--  003_least_privilege.sql — แยกสิทธิ์ระดับฐานข้อมูล
--
--  app tier ห้ามใช้ master user ของ RDS
--  ถ้าแอปถูกเจาะ ผู้โจมตีได้แค่ CRUD — DROP TABLE, สร้าง user, แก้ audit log ไม่ได้
--
--  ก่อนรัน: เปลี่ยน 'CHANGE_ME' ให้ตรงกับรหัสที่จะเก็บใน Secrets Manager
--  ชื่อ database ในบรรทัด GRANT CONNECT ต้องตรงกับของจริง (ค่าตั้งต้น dns69)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dns69_app') THEN
    CREATE ROLE dns69_app LOGIN PASSWORD 'CHANGE_ME';
  END IF;
END $$;

GRANT CONNECT ON DATABASE dns69 TO dns69_app;
GRANT USAGE ON SCHEMA public TO dns69_app;

GRANT SELECT                         ON faculties   TO dns69_app;
GRANT SELECT, INSERT, UPDATE         ON app_users   TO dns69_app;
GRANT SELECT, INSERT, UPDATE         ON matches     TO dns69_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON predictions TO dns69_app;
GRANT SELECT, INSERT                 ON audit_logs  TO dns69_app;   -- เขียนได้ แก้/ลบไม่ได้
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dns69_app;

-- ตั้งใจไม่ให้สิทธิ์ DELETE บน app_users และ matches
-- ปิดบัญชีด้วย is_active = false แทนการลบ เพื่อรักษาประวัติคำทาย
