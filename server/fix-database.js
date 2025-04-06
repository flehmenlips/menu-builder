const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize database
const db = new sqlite3.Database(path.join(__dirname, '../data/menus.db'));

// Enable foreign keys support
db.run('PRAGMA foreign_keys = ON');

async function fixDatabase() {
    console.log('Starting database cleanup...');

    // First, list all menus
    db.all('SELECT name FROM menus', [], (err, menus) => {
        if (err) {
            console.error('Error fetching menus:', err);
            return;
        }

        const menuNames = menus.map(menu => menu.name);
        console.log('Existing menus:', menuNames);

        // List all sections with menu names
        db.all('SELECT DISTINCT menu_name FROM sections', [], (err, sections) => {
            if (err) {
                console.error('Error fetching section menu names:', err);
                return;
            }

            const sectionMenus = sections.map(section => section.menu_name);
            console.log('Sections reference these menus:', sectionMenus);

            // Find orphaned menus (sections that refer to non-existent menus)
            const orphanedMenus = sectionMenus.filter(menu => !menuNames.includes(menu));
            console.log('Orphaned menus (referenced in sections but not in menus table):', orphanedMenus);

            if (orphanedMenus.length > 0) {
                // Delete orphaned sections
                orphanedMenus.forEach(menuName => {
                    console.log(`Deleting sections for orphaned menu: ${menuName}`);
                    db.run('DELETE FROM sections WHERE menu_name = ?', [menuName], function(err) {
                        if (err) {
                            console.error(`Error deleting sections for menu ${menuName}:`, err);
                        } else {
                            console.log(`Deleted ${this.changes} sections for menu ${menuName}`);
                        }
                    });
                });
            } else {
                console.log('No orphaned sections found.');
            }

            // Check for empty menu names
            if (menuNames.includes('')) {
                console.log('Found empty menu name, deleting...');
                db.run('DELETE FROM menus WHERE name = ""', function(err) {
                    if (err) {
                        console.error('Error deleting empty menu:', err);
                    } else {
                        console.log(`Deleted ${this.changes} empty menu entries`);
                    }
                });
            }

            // Fix orphaned items
            cleanupOrphanedItems();
        });
    });
}

function cleanupOrphanedItems() {
    console.log('Checking for orphaned items...');
    
    // Get all valid section IDs
    db.all('SELECT id FROM sections', [], (err, sections) => {
        if (err) {
            console.error('Error fetching sections:', err);
            return;
        }
        
        const sectionIds = sections.map(section => section.id);
        console.log(`Valid section IDs: ${sectionIds.length} sections`);
        
        // Find orphaned items (reference non-existent sections)
        db.all('SELECT id, section_id FROM items', [], (err, items) => {
            if (err) {
                console.error('Error fetching items:', err);
                return;
            }
            
            const orphanedItems = items.filter(item => !sectionIds.includes(item.section_id));
            console.log(`Found ${orphanedItems.length} orphaned items`);
            
            if (orphanedItems.length > 0) {
                // Delete orphaned items
                const orphanedItemIds = orphanedItems.map(item => item.id);
                const placeholders = orphanedItemIds.map(() => '?').join(',');
                
                db.run(`DELETE FROM items WHERE id IN (${placeholders})`, orphanedItemIds, function(err) {
                    if (err) {
                        console.error('Error deleting orphaned items:', err);
                    } else {
                        console.log(`Deleted ${this.changes} orphaned items`);
                    }
                    
                    // Final integrity check
                    finalIntegrityCheck();
                });
            } else {
                console.log('No orphaned items found.');
                finalIntegrityCheck();
            }
        });
    });
}

function finalIntegrityCheck() {
    // Verify foreign key integrity
    db.get('PRAGMA foreign_key_check', (err, result) => {
        if (err) {
            console.error('Error checking foreign key integrity:', err);
            return;
        }

        if (result) {
            console.log('Foreign key violations found:', result);
        } else {
            console.log('No foreign key violations found.');
        }

        console.log('Database cleanup complete.');
        db.close();
    });
}

fixDatabase(); 