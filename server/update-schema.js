const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure the data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Connect to database
const db = new sqlite3.Database(path.join(__dirname, 'data/menus.db'));

console.log('Starting database schema update...');

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Run all migrations in a transaction
db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // 0. First create the menus table if it doesn't exist
    console.log('Creating menus table if not exists...');
    db.run(`
        CREATE TABLE IF NOT EXISTS menus (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            title TEXT,
            subtitle TEXT,
            font TEXT DEFAULT 'Playfair Display',
            layout TEXT DEFAULT 'single',
            show_dollar_sign INTEGER DEFAULT 1,
            show_decimals INTEGER DEFAULT 1,
            show_section_dividers INTEGER DEFAULT 1,
            logo_path TEXT,
            logo_position TEXT DEFAULT 'top',
            logo_size INTEGER DEFAULT 200,
            logo_offset INTEGER DEFAULT 0,
            background_color TEXT DEFAULT '#ffffff',
            text_color TEXT DEFAULT '#000000',
            accent_color TEXT DEFAULT '#333333',
            user_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            elements TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `, err => {
        if (err) console.error('Error creating menus table:', err);
    });
    
    // 1. Drop and recreate users table to ensure correct schema
    console.log('Dropping users table if exists...');
    db.run(`DROP TABLE IF EXISTS users`, err => {
        if (err) console.error('Error dropping users table:', err);
        
        console.log('Creating users table...');
        db.run(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP,
                profile_image TEXT,
                is_admin INTEGER DEFAULT 0,
                subscription_status TEXT DEFAULT 'free',
                subscription_end_date TIMESTAMP,
                signup_source TEXT,
                stripe_customer_id TEXT
            )
        `, err => {
            if (err) console.error('Error creating users table:', err);
        });
    });
    
    // 2. Drop and recreate company_profiles table
    console.log('Dropping company_profiles table if exists...');
    db.run(`DROP TABLE IF EXISTS company_profiles`, err => {
        if (err) console.error('Error dropping company_profiles table:', err);
        
        console.log('Creating company_profiles table...');
        db.run(`
            CREATE TABLE company_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL,
                company_name TEXT,
                address TEXT,
                city TEXT,
                state TEXT,
                zip TEXT,
                phone TEXT,
                logo_path TEXT,
                website TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `, err => {
            if (err) console.error('Error creating company_profiles table:', err);
        });
    });
    
    // 3. Drop and recreate sessions table
    console.log('Dropping sessions table if exists...');
    db.run(`DROP TABLE IF EXISTS sessions`, err => {
        if (err) console.error('Error dropping sessions table:', err);
        
        console.log('Creating sessions table...');
        db.run(`
            CREATE TABLE sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token TEXT NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `, err => {
            if (err) console.error('Error creating sessions table:', err);
        });
    });
    
    // 4. Create site_settings table for website customization
    console.log('Dropping site_settings table if exists...');
    db.run(`DROP TABLE IF EXISTS site_settings`, err => {
        if (err) console.error('Error dropping site_settings table:', err);
        
        console.log('Creating site_settings table...');
        db.run(`
            CREATE TABLE site_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                setting_key TEXT UNIQUE NOT NULL,
                setting_value TEXT,
                setting_group TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `, err => {
            if (err) console.error('Error creating site_settings table:', err);
            
            // Insert default settings
            const defaultSettings = [
                ['site_name', 'Menu Builder Pro', 'general'],
                ['site_tagline', 'Create Beautiful Restaurant Menus in Minutes', 'general'],
                ['primary_color', '#4a6bfa', 'appearance'],
                ['secondary_color', '#f97316', 'appearance'],
                ['enable_signups', '1', 'registration'],
                ['enable_free_trial', '1', 'registration'],
                ['free_trial_days', '14', 'registration'],
                ['contact_email', 'support@menubuilder.pro', 'general'],
                ['setup_key', 'admin-setup-123', 'security'] // Default setup key (should be changed)
            ];
            
            const stmt = db.prepare(`
                INSERT INTO site_settings (setting_key, setting_value, setting_group)
                VALUES (?, ?, ?)
            `);
            
            defaultSettings.forEach(setting => {
                stmt.run(setting[0], setting[1], setting[2]);
            });
            
            stmt.finalize();
            console.log('Default site settings created');
        });
    });
    
    // 5. Create subscription_plans table
    console.log('Dropping subscription_plans table if exists...');
    db.run(`DROP TABLE IF EXISTS subscription_plans`, err => {
        if (err) console.error('Error dropping subscription_plans table:', err);
        
        console.log('Creating subscription_plans table...');
        db.run(`
            CREATE TABLE subscription_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                display_name TEXT NOT NULL,
                price_monthly REAL NOT NULL,
                price_yearly REAL NOT NULL,
                features TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `, err => {
            if (err) console.error('Error creating subscription_plans table:', err);
            
            // Insert default plans
            const defaultPlans = [
                ['free', 'Free', 0, 0, JSON.stringify([
                    '2 Menu Templates', 
                    'Basic Customization', 
                    'Up to 3 Saved Menus', 
                    'PDF Export'
                ]), 1],
                ['pro', 'Pro', 9.99, 99.99, JSON.stringify([
                    'All Templates',
                    'Advanced Customization',
                    'Unlimited Saved Menus',
                    'PDF & High Res Export',
                    'Logo Integration', 
                    'Premium Support'
                ]), 1],
                ['business', 'Business', 19.99, 199.99, JSON.stringify([
                    'Everything in Pro',
                    'Multi-Location Support',
                    'QR Code Menu Integration',
                    'API Access',
                    'Team Collaboration',
                    'Priority Support'
                ]), 1]
            ];
            
            defaultPlans.forEach(([name, display_name, price_monthly, price_yearly, features, is_active]) => {
                db.run(`INSERT OR IGNORE INTO subscription_plans 
                        (name, display_name, price_monthly, price_yearly, features, is_active) 
                        VALUES (?, ?, ?, ?, ?, ?)`, 
                    [name, display_name, price_monthly, price_yearly, features, is_active], 
                    err => {
                        if (err) console.error(`Error inserting default plan ${name}:`, err);
                    }
                );
            });
        });
    });
    
    // 6. Create content_blocks table if it doesn't exist
    console.log('Dropping content_blocks table if exists...');
    db.run(`DROP TABLE IF EXISTS content_blocks`, err => {
        if (err) console.error('Error dropping content_blocks table:', err);
        
        console.log('Creating content_blocks table...');
        db.run(`
            CREATE TABLE IF NOT EXISTS content_blocks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                identifier TEXT NOT NULL UNIQUE,
                section TEXT NOT NULL,
                content TEXT,
                content_type TEXT DEFAULT 'text',
                order_index INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `, err => {
            if (err) {
                console.error('Error creating content_blocks table:', err);
            } else {
                console.log('Content blocks table created or already exists');
                
                // Insert default content blocks if none exist
                db.get('SELECT COUNT(*) as count FROM content_blocks', (err, row) => {
                    if (err) {
                        console.error('Error checking content blocks:', err);
                        return;
                    }
                    
                    if (row.count === 0) {
                        const defaultContent = [
                            // General site settings content
                            {
                                identifier: 'site_name',
                                title: 'Site Name',
                                content: 'Menu Builder Pro',
                                content_type: 'text',
                                section: 'general',
                                order_index: 1
                            },
                            {
                                identifier: 'site_tagline',
                                title: 'Site Tagline',
                                content: 'Create Beautiful Restaurant Menus in Minutes',
                                content_type: 'text',
                                section: 'general',
                                order_index: 2
                            },
                            {
                                identifier: 'hero_tagline',
                                title: 'Hero Tagline',
                                content: 'Design, customize, and download professional-quality menus with our easy-to-use platform. No design skills required.',
                                content_type: 'text',
                                section: 'general',
                                order_index: 3
                            },
                            {
                                identifier: 'logo_path',
                                title: 'Logo Path',
                                content: '/uploads/default-logo.svg',
                                content_type: 'image',
                                section: 'general',
                                order_index: 4
                            }
                        ];
                        
                        const stmt = db.prepare(`
                            INSERT INTO content_blocks (
                                identifier, title, content, content_type, section, 
                                order_index, is_active, metadata
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        `);
                        
                        defaultContent.forEach(item => {
                            stmt.run(
                                item.identifier,
                                item.title,
                                item.content,
                                item.content_type,
                                item.section,
                                item.order_index,
                                1,
                                item.metadata || null
                            );
                        });
                        
                        stmt.finalize();
                        console.log('Default content blocks created');
                    }
                });
            }
        });
    });
    
    // Create logs table
    db.run(`
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            level TEXT NOT NULL,
            message TEXT NOT NULL,
            source TEXT,
            user_id INTEGER,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);
    
    // Commit all changes
    db.run('COMMIT', err => {
        if (err) {
            console.error('Error committing changes:', err);
            db.run('ROLLBACK');
        } else {
            console.log('Database schema update completed successfully!');
        }
        
        // Close the database connection
        db.close(err => {
            if (err) console.error('Error closing database:', err);
        });
    });
}); 