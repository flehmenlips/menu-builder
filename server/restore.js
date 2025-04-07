/**
 * Menu Data Restoration Utility
 * 
 * This script helps restore menu data from recovery files
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database path
const dbPath = path.join(__dirname, '../data/menus.db');

// Create a connection to the database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        process.exit(1);
    }
    console.log('Connected to the menu database.');
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Ensure spacers table exists
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
        console.log('Ensured spacers table exists.');
    }
});

// Function to restore a menu from a recovery file
async function restoreMenu(recoveryFilePath) {
    try {
        // Read the recovery file
        const fileData = fs.readFileSync(recoveryFilePath, 'utf8');
        const menuData = JSON.parse(fileData);
        
        console.log(`Restoring menu '${menuData.name}' from recovery file...`);
        
        // Check if menu exists
        const existingMenu = await getMenu(menuData.name);
        
        if (existingMenu) {
            console.log(`Menu '${menuData.name}' already exists. Updating...`);
            await updateMenu(
                menuData.name,
                menuData.title,
                menuData.subtitle,
                menuData.font,
                menuData.layout,
                menuData.show_dollar_sign,
                menuData.show_decimals,
                menuData.show_section_dividers,
                menuData.elements
            );
        } else {
            console.log(`Creating new menu '${menuData.name}'...`);
            await createMenu(
                menuData.name,
                menuData.title,
                menuData.subtitle,
                menuData.font,
                menuData.layout,
                menuData.show_dollar_sign,
                menuData.show_decimals,
                menuData.show_section_dividers,
                menuData.elements
            );
        }
        
        console.log(`Menu '${menuData.name}' restored successfully!`);
        return true;
    } catch (error) {
        console.error('Error restoring menu:', error);
        return false;
    }
}

// Helper function to get a specific menu
function getMenu(name) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM menus WHERE name = ?', [name], (err, menu) => {
            if (err) reject(err);
            else resolve(menu);
        });
    });
}

// Create a new menu
const createMenu = async (name, title, subtitle, font, layout, showDollarSign, showDecimals, showSectionDividers, elements) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO menus (name, title, subtitle, font, layout, show_dollar_sign, show_decimals, show_section_dividers) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [name, title, subtitle, font, layout, showDollarSign, showDecimals, showSectionDividers],
            async function(err) {
                if (err) reject(err);
                else {
                    try {
                        if (elements && Array.isArray(elements)) {
                            await Promise.all(
                                elements.map(async (element) => {
                                    if (element.type === 'section') {
                                        return createSection(name, element, element.position);
                                    } else if (element.type === 'spacer') {
                                        return createSpacer(name, element, element.position);
                                    }
                                })
                            );
                        }
                        resolve(true);
                    } catch (error) {
                        reject(error);
                    }
                }
            }
        );
    });
};

// Create a section
const createSection = async (menuName, section, position) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO sections (menu_name, name, active, position) VALUES (?, ?, ?, ?)',
            [menuName, section.name, section.active, position],
            async function(err) {
                if (err) reject(err);
                else {
                    try {
                        if (section.items && Array.isArray(section.items)) {
                            await Promise.all(
                                section.items.map((item, index) => createItem(this.lastID, item, index))
                            );
                        }
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                }
            }
        );
    });
};

// Create an item
const createItem = async (sectionId, item, position) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO items (section_id, name, description, price, active, position) VALUES (?, ?, ?, ?, ?, ?)',
            [sectionId, item.name, item.description, item.price, item.active, position],
            function(err) {
                if (err) reject(err);
                else resolve();
            }
        );
    });
};

// Create a spacer
const createSpacer = async (menuName, spacer, position) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO spacers (menu_name, size, unit, position) VALUES (?, ?, ?, ?)',
            [menuName, spacer.size || '30', spacer.unit || 'px', position],
            function(err) {
                if (err) reject(err);
                else resolve();
            }
        );
    });
};

// Update an existing menu
const updateMenu = async (name, title, subtitle, font, layout, showDollarSign, showDecimals, showSectionDividers, elements) => {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE menus SET title = ?, subtitle = ?, font = ?, layout = ?, show_dollar_sign = ?, show_decimals = ?, show_section_dividers = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?',
            [title, subtitle, font, layout, showDollarSign, showDecimals, showSectionDividers, name],
            async function(err) {
                if (err) reject(err);
                else if (this.changes === 0) resolve(false);
                else {
                    try {
                        // Delete existing sections and items
                        await deleteSections(name);
                        await deleteSpacers(name);
                        
                        // Create new elements
                        if (elements && Array.isArray(elements)) {
                            await Promise.all(
                                elements.map(async (element) => {
                                    if (element.type === 'section') {
                                        return createSection(name, element, element.position);
                                    } else if (element.type === 'spacer') {
                                        return createSpacer(name, element, element.position);
                                    }
                                })
                            );
                        }
                        
                        resolve(true);
                    } catch (error) {
                        reject(error);
                    }
                }
            }
        );
    });
};

// Delete sections for a menu
const deleteSections = (menuName) => {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM sections WHERE menu_name = ?', [menuName], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

// Delete spacers for a menu
const deleteSpacers = (menuName) => {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM spacers WHERE menu_name = ?', [menuName], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

// List recovery files
function listRecoveryFiles() {
    const recoveryDir = path.join(__dirname, '../recovery');
    if (!fs.existsSync(recoveryDir)) {
        console.log('No recovery directory found.');
        return [];
    }
    
    const files = fs.readdirSync(recoveryDir)
        .filter(file => file.endsWith('.json'))
        .map(file => ({
            fileName: file,
            fullPath: path.join(recoveryDir, file)
        }));
    
    console.log('Available recovery files:');
    files.forEach((file, index) => {
        console.log(`${index + 1}. ${file.fileName}`);
    });
    
    return files;
}

// Main function
async function main() {
    try {
        // Get recovery file from command line args
        const recoveryFilePath = process.argv[2];
        
        if (recoveryFilePath) {
            // Restore a specific menu from the provided file
            console.log(`Attempting to restore from file: ${recoveryFilePath}`);
            await restoreMenu(recoveryFilePath);
        } else {
            // List all recovery files
            const files = listRecoveryFiles();
            
            if (files.length === 0) {
                console.log('No recovery files found.');
                return;
            }
            
            // Auto-restore the most recent file
            console.log(`\nAuto-restoring the latest file: ${files[files.length - 1].fileName}`);
            await restoreMenu(files[files.length - 1].fullPath);
        }
    } catch (error) {
        console.error('Restoration error:', error);
    } finally {
        // Close the database
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            } else {
                console.log('Database connection closed.');
            }
        });
    }
}

// Run the main function
main(); 