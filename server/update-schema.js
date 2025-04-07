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
            elements TEXT
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
                profile_image TEXT
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
                user_id INTEGER UNIQUE,
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
                FOREIGN KEY (user_id) REFERENCES users(id)
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `, err => {
            if (err) console.error('Error creating sessions table:', err);
        });
    });
    
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