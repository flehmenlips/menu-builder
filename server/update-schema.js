const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize database
const db = new sqlite3.Database(path.join(__dirname, '../data/menus.db'));

// Enable foreign keys support
db.run('PRAGMA foreign_keys = ON');

console.log('Starting database schema update...');

// Add new columns to menus table for logo and styling
db.serialize(() => {
    console.log('Adding logo columns to menus table...');
    const alterQueries = [
        'ALTER TABLE menus ADD COLUMN logo_path TEXT',
        'ALTER TABLE menus ADD COLUMN logo_position TEXT DEFAULT "top"',
        'ALTER TABLE menus ADD COLUMN logo_size TEXT DEFAULT "200"',
        'ALTER TABLE menus ADD COLUMN logo_offset TEXT DEFAULT "0"',
        'ALTER TABLE menus ADD COLUMN background_color TEXT DEFAULT "#ffffff"',
        'ALTER TABLE menus ADD COLUMN text_color TEXT DEFAULT "#000000"',
        'ALTER TABLE menus ADD COLUMN accent_color TEXT DEFAULT "#333333"'
    ];
    
    let completedQueries = 0;
    
    alterQueries.forEach(query => {
        db.run(query, function(err) {
            if (err) {
                // SQLite will error if column already exists, we can safely ignore this
                if (!err.message.includes('duplicate column name')) {
                    console.error('Error adding column:', err.message);
                } else {
                    console.log('Column already exists, skipping');
                }
            } else {
                console.log('Added column successfully:', query);
            }
            
            completedQueries++;
            if (completedQueries === alterQueries.length) {
                console.log('Schema update completed');
                db.close(() => {
                    console.log('Database connection closed');
                });
            }
        });
    });
}); 