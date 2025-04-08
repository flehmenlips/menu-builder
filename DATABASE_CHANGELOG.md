# Database Schema Changelog

This file tracks changes made to the database schema (`server/database.js`).

---

**Date:** 2025-04-07 (Approx)
**Version:** v2.0.1
**Description:** Add `user_id` column to `menus` table to enable user-specific menu data. Assign existing menus to admin user (ID 2).
**SQL (Conceptual):**
```sql
ALTER TABLE menus ADD COLUMN user_id INTEGER;
UPDATE menus SET user_id = 2 WHERE user_id IS NULL;
```

---

**Date:** 2025-04-07 (Approx)
**Version:** v2.0.1
**Description:** Add `company_profiles` table to store user-specific company/profile information. Logic added to `auth.js` to create default profile on registration. Manually inserted rows for users 2 and 3.
**SQL (Conceptual):**
```sql
CREATE TABLE IF NOT EXISTS company_profiles (
    user_id INTEGER PRIMARY KEY,
    company_name TEXT,
    address TEXT,
    phone TEXT,
    email TEXT, 
    website TEXT,
    logo_path TEXT,
    primary_color TEXT,
    secondary_color TEXT,
    accent_color TEXT,
    default_font TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
-- Manual/Registration Inserts:
-- INSERT INTO company_profiles (user_id, company_name, email) VALUES (?, ?, ?); 
```

---

**Date:** 2025-04-07 (Approx)
**Version:** v2.0.1
**Description:** Add `content_blocks` table for managing site content via admin panel.
**SQL (Conceptual):**
```sql
CREATE TABLE IF NOT EXISTS content_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    content_type TEXT DEFAULT 'text',
    section TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

**Date:** 2025-04-07 (Approx)
**Version:** v2.0.1
**Description:** Add `sessions` table to store user session tokens generated during login.
**SQL (Conceptual):**
```sql
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_session_token ON sessions (token);
CREATE INDEX IF NOT EXISTS idx_session_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_session_expires ON sessions (expires_at);
```

--- 