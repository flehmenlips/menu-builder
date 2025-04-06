const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Connect to the database
const dbPath = path.join(dataDir, 'menus.db');
const db = new sqlite3.Database(dbPath);

// Enable foreign keys support
db.run('PRAGMA foreign_keys = ON');

console.log('Starting database migration...');

// Add new columns to menus table
db.serialize(() => {
    console.log('Adding configuration columns to menus table...');
    const menuAlterQueries = [
        'ALTER TABLE menus ADD COLUMN show_dollar_sign BOOLEAN DEFAULT 1',
        'ALTER TABLE menus ADD COLUMN show_decimals BOOLEAN DEFAULT 1',
        'ALTER TABLE menus ADD COLUMN show_section_dividers BOOLEAN DEFAULT 1',
        'ALTER TABLE menus ADD COLUMN wrap_special_chars BOOLEAN DEFAULT 1'
    ];
    
    menuAlterQueries.forEach(query => {
        db.run(query, function(err) {
            if (err) {
                // SQLite will error if column already exists, we can safely ignore this
                if (!err.message.includes('duplicate column name')) {
                    console.error('Error adding column:', err.message);
                }
            }
        });
    });
    
    console.log('Adding position columns to sections and items tables...');
    // Add position column to sections table
    db.run('ALTER TABLE sections ADD COLUMN position INTEGER DEFAULT 0', function(err) {
        if (err) {
            // SQLite will error if column already exists, we can safely ignore this
            if (!err.message.includes('duplicate column name')) {
                console.error('Error adding position to sections:', err.message);
            }
        }
    });
    
    // Add position column to items table
    db.run('ALTER TABLE items ADD COLUMN position INTEGER DEFAULT 0', function(err) {
        if (err) {
            // SQLite will error if column already exists, we can safely ignore this
            if (!err.message.includes('duplicate column name')) {
                console.error('Error adding position to items:', err.message);
            }
        }
    });
    
    // Change price column to TEXT type
    console.log('Changing price column in items table to TEXT type...');
    
    // Since SQLite doesn't support ALTER COLUMN, we need to:
    // 1. Create a new table with the desired schema
    // 2. Copy data from the old table
    // 3. Drop the old table
    // 4. Rename the new table
    
    db.run(`
        CREATE TABLE IF NOT EXISTS items_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            section_id INTEGER,
            name TEXT,
            description TEXT,
            price TEXT,
            active BOOLEAN DEFAULT 1,
            position INTEGER DEFAULT 0,
            FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
        )
    `, function(err) {
        if (err) {
            console.error('Error creating new items table:', err.message);
            return;
        }
        
        // Copy data from the old table to the new one
        db.run(`
            INSERT INTO items_new (id, section_id, name, description, price, active, position)
            SELECT id, section_id, name, description, price, active, COALESCE(position, 0) FROM items
        `, function(err) {
            if (err) {
                console.error('Error copying data to new items table:', err.message);
                return;
            }
            
            // Drop the old table
            db.run('DROP TABLE items', function(err) {
                if (err) {
                    console.error('Error dropping old items table:', err.message);
                    return;
                }
                
                // Rename the new table
                db.run('ALTER TABLE items_new RENAME TO items', function(err) {
                    if (err) {
                        console.error('Error renaming new items table:', err.message);
                        return;
                    }
                    
                    console.log('Successfully migrated items table with TEXT price field.');
                });
            });
        });
    });
    
    // Assign position values to existing records
    console.log('Updating position values for existing sections and items...');
    
    // Get all menus
    db.all('SELECT name FROM menus', [], (err, menus) => {
        if (err) {
            console.error('Error fetching menus:', err.message);
            return;
        }
        
        menus.forEach(menu => {
            // Get sections for this menu
            db.all('SELECT id FROM sections WHERE menu_name = ?', [menu.name], (err, sections) => {
                if (err) {
                    console.error(`Error fetching sections for menu ${menu.name}:`, err.message);
                    return;
                }
                
                // Update positions for sections
                sections.forEach((section, index) => {
                    db.run('UPDATE sections SET position = ? WHERE id = ?', [index, section.id]);
                    
                    // Update positions for items in this section
                    db.all('SELECT id FROM items WHERE section_id = ?', [section.id], (err, items) => {
                        if (err) {
                            console.error(`Error fetching items for section ${section.id}:`, err.message);
                            return;
                        }
                        
                        items.forEach((item, itemIndex) => {
                            db.run('UPDATE items SET position = ? WHERE id = ?', [itemIndex, item.id]);
                        });
                    });
                });
            });
        });
    });

    // Check if spacers table exists
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='spacers'", (err, row) => {
        if (err) {
            console.error('Error checking for spacers table:', err);
            return;
        }

        // If spacers table doesn't exist, create it
        if (!row) {
            console.log('Creating spacers table...');
            db.run(`CREATE TABLE IF NOT EXISTS spacers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                menu_name TEXT,
                size TEXT,
                unit TEXT,
                position INTEGER,
                FOREIGN KEY (menu_name) REFERENCES menus(name) ON DELETE CASCADE
            )`, (err) => {
                if (err) {
                    console.error('Error creating spacers table:', err);
                } else {
                    console.log('Spacers table created successfully');
                }
            });
        } else {
            console.log('Spacers table already exists');
        }

        // Check if wrap_special_chars column exists in menus table
        db.get("PRAGMA table_info(menus)", (err, rows) => {
            if (err) {
                console.error('Error checking menus table schema:', err);
                return;
            }

            // Remove wrap_special_chars column from existing menus
            console.log('Updating menus table to match new schema...');
            // SQLite doesn't support DROP COLUMN, so we need to recreate the table
            db.run(`
                BEGIN TRANSACTION;
                
                -- Create new table without wrap_special_chars
                CREATE TABLE IF NOT EXISTS menus_new (
                    name TEXT PRIMARY KEY,
                    title TEXT,
                    subtitle TEXT,
                    font TEXT,
                    layout TEXT,
                    show_dollar_sign INTEGER DEFAULT 1,
                    show_decimals INTEGER DEFAULT 1,
                    show_section_dividers INTEGER DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                -- Copy data from old table to new table
                INSERT INTO menus_new(name, title, subtitle, font, layout, 
                      show_dollar_sign, show_decimals, show_section_dividers, 
                      created_at, updated_at)
                SELECT name, title, subtitle, font, layout, 
                      show_dollar_sign, show_decimals, show_section_dividers, 
                      created_at, updated_at 
                FROM menus;
                
                -- Drop old table
                DROP TABLE menus;
                
                -- Rename new table to old table name
                ALTER TABLE menus_new RENAME TO menus;
                
                COMMIT;
            `, (err) => {
                if (err) {
                    console.error('Error updating menus table:', err);
                } else {
                    console.log('Menus table updated successfully');
                }
            });
        });
    });
});

// Wait for all operations to complete
setTimeout(() => {
    console.log('Database migration completed.');
    db.close();
}, 5000); 