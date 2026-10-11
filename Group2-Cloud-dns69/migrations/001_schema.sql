-- ============================================================
--  001_schema.sql — โครงสร้างฐานข้อมูล DNS69
--  รันด้วย master user ของ RDS (หรือ postgres บนเครื่องตัวเอง)
-- ============================================================

-- ── คณะ ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS faculties (
  code      VARCHAR(10)  PRIMARY KEY,
  name_th   VARCHAR(100) NOT NULL,
  short_th  VARCHAR(30)  NOT NULL,
  color     CHAR(7)      NOT NULL,          -- สีประจำคณะ เช่น #8B1E2D
  text_on   CHAR(7)      NOT NULL DEFAULT '#FFFFFF'
);

-- ── ผู้ใช้ ──────────────────────────────────────────────────
-- รวมข้อมูลล็อกอินกับโปรไฟล์ไว้ตารางเดียวเพราะโปรเจกต์เล็ก
-- แต่ password_hash ไม่เคยถูก SELECT ออกไปนอก auth.routes.ts
CREATE TABLE IF NOT EXISTS app_users (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email          VARCHAR(255) NOT NULL,
  password_hash  TEXT         NOT NULL,            -- bcrypt เท่านั้น
  display_name   VARCHAR(40)  NOT NULL,
  faculty_code   VARCHAR(10)  NOT NULL REFERENCES faculties(code),
  role           VARCHAR(10)  NOT NULL DEFAULT 'student'
                 CHECK (role IN ('student','admin')),
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_users_email ON app_users (LOWER(email));

-- ── แมตช์ ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  id           SERIAL       PRIMARY KEY,
  home_code    VARCHAR(10)  NOT NULL REFERENCES faculties(code),
  away_code    VARCHAR(10)  NOT NULL REFERENCES faculties(code),
  kickoff_at   TIMESTAMPTZ  NOT NULL,              -- เวลาปิดรับคำทาย
  result_home  SMALLINT     CHECK (result_home BETWEEN 0 AND 30),
  result_away  SMALLINT     CHECK (result_away BETWEEN 0 AND 30),
  settled_at   TIMESTAMPTZ,
  settled_by   UUID         REFERENCES app_users(id),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_teams_differ   CHECK (home_code <> away_code),
  -- ผลต้องมีครบทั้งสองฝั่งหรือไม่มีเลย
  CONSTRAINT chk_result_pair    CHECK ((result_home IS NULL) = (result_away IS NULL)),
  CONSTRAINT chk_settled_pair   CHECK ((result_home IS NULL) = (settled_at IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_matches_kickoff ON matches (kickoff_at);

-- ── คำทาย ───────────────────────────────────────────────────
-- PRIMARY KEY (user_id, match_id) = หนึ่งคนทายได้ครั้งเดียวต่อแมตช์
-- ถ้าส่งซ้ำ API จะใช้ ON CONFLICT ... DO UPDATE แก้คำทายเดิม
CREATE TABLE IF NOT EXISTS predictions (
  user_id     UUID        NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  match_id    INT         NOT NULL REFERENCES matches(id)   ON DELETE CASCADE,
  pred_home   SMALLINT    NOT NULL CHECK (pred_home BETWEEN 0 AND 20),
  pred_away   SMALLINT    NOT NULL CHECK (pred_away BETWEEN 0 AND 20),
  points      SMALLINT,                             -- NULL จนกว่าแมตช์จะมีผล
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, match_id)
);
CREATE INDEX IF NOT EXISTS idx_predictions_match ON predictions (match_id);

-- ── บันทึกการกระทำของแอดมิน ─────────────────────────────────
-- app tier เขียนได้อย่างเดียว แก้หรือลบไม่ได้ (ดู 003)
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL    PRIMARY KEY,
  actor_id    UUID         REFERENCES app_users(id) ON DELETE SET NULL,
  action      VARCHAR(60)  NOT NULL,
  entity      VARCHAR(40),
  entity_id   TEXT,
  detail      JSONB,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at DESC);
