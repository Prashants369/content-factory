import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;

function initializeDatabase(): Database.Database | null {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const instance = new Database(path.join(dataDir, 'factory.db'));
    instance.pragma('journal_mode = WAL');
    instance.pragma('foreign_keys = ON');

    // Initialize core tables
    instance.exec(`
      CREATE TABLE IF NOT EXISTS influencers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        niche TEXT NOT NULL,
        lookbook_prompt TEXT,
        base_image_path TEXT,
        dna_json TEXT,
        avatar_image_path TEXT,
        generated_image_path TEXT,
        image_status TEXT DEFAULT 'none',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        influencer_id TEXT,
        post_date TIMESTAMP,
        viral_hook TEXT,
        image_prompt TEXT,
        caption TEXT,
        affiliate_link TEXT,
        media_path TEXT,
        status TEXT DEFAULT 'Idea',
        FOREIGN KEY(influencer_id) REFERENCES influencers(id)
      );

      CREATE TABLE IF NOT EXISTS influencer_images (
        id TEXT PRIMARY KEY,
        influencer_id TEXT NOT NULL,
        image_path TEXT NOT NULL,
        image_type TEXT DEFAULT 'content',
        angle TEXT,
        expression TEXT,
        prompt_used TEXT,
        workflow_used TEXT,
        is_avatar INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(influencer_id) REFERENCES influencers(id)
      );

      CREATE TABLE IF NOT EXISTS comfyui_jobs (
        prompt_id TEXT PRIMARY KEY,
        influencer_id TEXT,
        image_type TEXT DEFAULT 'content',
        angle TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS platform_accounts (
        id TEXT PRIMARY KEY,
        influencer_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        account_name TEXT,
        account_id TEXT,
        access_token TEXT,
        ig_business_account_id TEXT,
        fb_page_id TEXT,
        enabled INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(influencer_id) REFERENCES influencers(id)
      );

      CREATE TABLE IF NOT EXISTS custom_workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        base_template TEXT NOT NULL,
        config_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS brand_kits (
        id TEXT PRIMARY KEY,
        influencer_id TEXT NOT NULL,
        primary_color TEXT DEFAULT '#8b5cf6',
        secondary_color TEXT DEFAULT '#06b6d4',
        font_family TEXT DEFAULT 'Inter',
        voice_tone TEXT DEFAULT 'Professional',
        signature_catchphrase TEXT,
        target_audience_desc TEXT,
        brand_values TEXT,
        logo_path TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(influencer_id) REFERENCES influencers(id)
      );
    `);

    // ── Agent & Control Center tables ─────────────────────────────────────────
    instance.exec(`
      CREATE TABLE IF NOT EXISTS api_credentials (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS agent_tasks (
        id           TEXT PRIMARY KEY,
        agent_type   TEXT NOT NULL,
        influencer_id TEXT,
        payload      TEXT,
        result       TEXT,
        status       TEXT DEFAULT 'pending',
        priority     INTEGER DEFAULT 5,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS influencer_memory (
        id            TEXT PRIMARY KEY,
        influencer_id TEXT NOT NULL,
        memory_type   TEXT NOT NULL,
        content       TEXT,
        importance    REAL DEFAULT 0.5,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(influencer_id) REFERENCES influencers(id)
      );

      CREATE TABLE IF NOT EXISTS launcher_log(
        id         TEXT PRIMARY KEY,
        service    TEXT NOT NULL,
        action     TEXT NOT NULL,
        pid        INTEGER,
        exit_code  INTEGER,
        log_tail   TEXT,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Safe migrations for existing DBs — posts fields
    const postMigrations = [
      `ALTER TABLE posts ADD COLUMN caption TEXT`,
      `ALTER TABLE posts ADD COLUMN image_prompt TEXT`,
      `ALTER TABLE posts ADD COLUMN engagement_strategy TEXT`,
      `ALTER TABLE posts ADD COLUMN music_suggestion TEXT`,
      `ALTER TABLE posts ADD COLUMN video_hook_variations TEXT`,
      `ALTER TABLE posts ADD COLUMN monetization_angle TEXT`,
      `ALTER TABLE posts ADD COLUMN ig_post_id TEXT`,
      `ALTER TABLE posts ADD COLUMN ig_permalink TEXT`,
      `ALTER TABLE posts ADD COLUMN ig_likes INTEGER DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN ig_comments INTEGER DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN ig_reach INTEGER DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN ig_impressions INTEGER DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN ig_saves INTEGER DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN ig_shares INTEGER DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN ig_video_views INTEGER DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN ig_engagement_rate REAL DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN scheduled_at TIMESTAMP`,
      `ALTER TABLE posts ADD COLUMN posted_at TIMESTAMP`,
      `ALTER TABLE posts ADD COLUMN autopost_enabled INTEGER DEFAULT 0`,
      `ALTER TABLE posts ADD COLUMN platform TEXT DEFAULT 'instagram'`,
      `ALTER TABLE posts ADD COLUMN hashtags TEXT`,
      `ALTER TABLE posts ADD COLUMN n8n_execution_id TEXT`,
    ];

    for (const sql of postMigrations) {
      try { instance.exec(sql); } catch { /* column already exists */ }
    }

    // Influencer-level migrations
    const influencerMigrations = [
      `ALTER TABLE influencers ADD COLUMN dna_json TEXT`,
      `ALTER TABLE influencers ADD COLUMN generated_image_path TEXT`,
      `ALTER TABLE influencers ADD COLUMN image_status TEXT DEFAULT 'none'`,
      `ALTER TABLE influencers ADD COLUMN avatar_image_path TEXT`,
      `ALTER TABLE influencers ADD COLUMN ig_followers INTEGER DEFAULT 0`,
      `ALTER TABLE influencers ADD COLUMN ig_total_posts INTEGER DEFAULT 0`,
      `ALTER TABLE influencers ADD COLUMN ig_avg_reach INTEGER DEFAULT 0`,
      `ALTER TABLE influencers ADD COLUMN ig_avg_engagement REAL DEFAULT 0`,
      `ALTER TABLE influencers ADD COLUMN ig_last_synced TIMESTAMP`,
    ];

    for (const sql of influencerMigrations) {
      try { instance.exec(sql); } catch { /* column already exists */ }
    }

    return instance;
  } catch (err) {
    console.error('[DB] Failed to initialize database:', err);
    return null;
  }
}

// Initialize on first import
db = initializeDatabase();

// Helper: returns db or throws a safe error
export function getDb(): Database.Database {
  if (!db) {
    // Try to re-initialize
    db = initializeDatabase();
    if (!db) {
      throw new Error('Database unavailable. Check data directory permissions.');
    }
  }
  return db;
}

// Safe wrapper that returns null instead of throwing
export function getDbSafe(): Database.Database | null {
  if (!db) {
    db = initializeDatabase();
  }
  return db;
}

// Proxy wrapper: defers null checks to first actual use
const dbProxy: Database.Database = new Proxy({} as Database.Database, {
  get(_target, prop) {
    const actual = getDb();
    const val = (actual as any)[prop];
    return typeof val === 'function' ? val.bind(actual) : val;
  }
});

export default dbProxy;
