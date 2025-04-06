const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize database
const db = new sqlite3.Database(path.join(__dirname, '../data/menus.db'));

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
});

// Wait for all operations to complete
setTimeout(() => {
    console.log('Database migration completed.');
    db.close();
}, 5000); 