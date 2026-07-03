-- Brew Guide Supabase 数据库初始化脚本

-- ==================== 表结构 ====================

-- 咖啡豆表
CREATE TABLE IF NOT EXISTS coffee_beans (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER DEFAULT 1,
  PRIMARY KEY (id, user_id)
);

-- 冲煮笔记表
CREATE TABLE IF NOT EXISTS brewing_notes (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER DEFAULT 1,
  PRIMARY KEY (id, user_id)
);

-- 自定义器具表
CREATE TABLE IF NOT EXISTS custom_equipments (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER DEFAULT 1,
  PRIMARY KEY (id, user_id)
);

-- 自定义方案表（id = equipmentId，每个器具一个方案集合）
CREATE TABLE IF NOT EXISTS custom_methods (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER DEFAULT 1,
  PRIMARY KEY (id, user_id)
);

-- 用户设置表
CREATE TABLE IF NOT EXISTS user_settings (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

-- ==================== 索引 ====================

CREATE INDEX IF NOT EXISTS idx_coffee_beans_user_id ON coffee_beans(user_id);
CREATE INDEX IF NOT EXISTS idx_coffee_beans_active ON coffee_beans(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_brewing_notes_user_id ON brewing_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_brewing_notes_active ON brewing_notes(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_custom_equipments_user_id ON custom_equipments(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_equipments_active ON custom_equipments(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_custom_methods_user_id ON custom_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_methods_active ON custom_methods(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- ==================== Data API 权限 ====================

-- 个人自建 Supabase 项目使用 anon key 访问 Data API，需要显式授权。
GRANT USAGE ON SCHEMA public TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.coffee_beans,
  public.brewing_notes,
  public.custom_equipments,
  public.custom_methods,
  public.user_settings
TO anon;

-- ==================== RLS 策略 ====================

ALTER TABLE coffee_beans ENABLE ROW LEVEL SECURITY;
ALTER TABLE brewing_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_equipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on coffee_beans" ON coffee_beans;
DROP POLICY IF EXISTS "Allow all on brewing_notes" ON brewing_notes;
DROP POLICY IF EXISTS "Allow all on custom_equipments" ON custom_equipments;
DROP POLICY IF EXISTS "Allow all on custom_methods" ON custom_methods;
DROP POLICY IF EXISTS "Allow all on user_settings" ON user_settings;

CREATE POLICY "Allow all on coffee_beans" ON coffee_beans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on brewing_notes" ON brewing_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on custom_equipments" ON custom_equipments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on custom_methods" ON custom_methods FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on user_settings" ON user_settings FOR ALL USING (true) WITH CHECK (true);

-- ==================== Realtime 实时同步配置 ====================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'coffee_beans',
    'brewing_notes',
    'custom_equipments',
    'custom_methods',
    'user_settings'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication p
      JOIN pg_publication_rel pr ON p.oid = pr.prpubid
      JOIN pg_class c ON c.oid = pr.prrelid
      WHERE p.pubname = 'supabase_realtime'
        AND c.relname = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
    END IF;
  END LOOP;
END $$;

-- 设置 replica identity 为 FULL，确保 UPDATE/DELETE 事件包含完整数据
ALTER TABLE coffee_beans REPLICA IDENTITY FULL;
ALTER TABLE brewing_notes REPLICA IDENTITY FULL;
ALTER TABLE custom_equipments REPLICA IDENTITY FULL;
ALTER TABLE custom_methods REPLICA IDENTITY FULL;
ALTER TABLE user_settings REPLICA IDENTITY FULL;
