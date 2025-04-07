const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

// Initialize database
const db = new sqlite3.Database(path.join(__dirname, '../data/menus.db'));

// Enable foreign keys support
db.run('PRAGMA foreign_keys = ON');

console.log('Starting user schema creation...');

// Create users table
db.serialize(() => {
    // Users table - stores basic authentication info
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Error creating users table:', err);
        } else {
            console.log('Users table created or already exists');
        }
    });

    // Company profiles table - stores global settings for a user
    db.run(`
        CREATE TABLE IF NOT EXISTS company_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            company_name TEXT,
            address TEXT,
            phone TEXT,
            email TEXT,
            website TEXT,
            logo_path TEXT,
            primary_color TEXT DEFAULT '#000000',
            secondary_color TEXT DEFAULT '#ffffff',
            accent_color TEXT DEFAULT '#333333',
            default_font TEXT DEFAULT 'Playfair Display',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) {
            console.error('Error creating company_profiles table:', err);
        } else {
            console.log('Company profiles table created or already exists');
        }
    });

    // Modify menus table to associate with users
    db.run(`
        ALTER TABLE menus ADD COLUMN user_id INTEGER DEFAULT NULL
    `, (err) => {
        if (err) {
            // In SQLite, we can't check for column existence easily before adding
            if (!err.message.includes('duplicate column name')) {
                console.error('Error adding user_id to menus table:', err);
            } else {
                console.log('user_id column already exists in menus table');
            }
        } else {
            console.log('Added user_id column to menus table');
        }
    });

    // Create sessions table for managing user sessions
    db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            session_token TEXT UNIQUE NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) {
            console.error('Error creating sessions table:', err);
        } else {
            console.log('Sessions table created or already exists');
        }
    });

    console.log('Schema setup completed. Database is ready for user accounts.');
    
    // Close the database connection
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed');
        }
    });
}); 