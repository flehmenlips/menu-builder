/**
 * Menu Data Recovery Utility
 * 
 * This script attempts to recover any menu data that might be in the database but 
 * inaccessible due to the issues with missing section items
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

// Recovery function for a specific menu
async function recoverMenu(menuName) {
    try {
        // Get the menu record
        const menu = await getMenu(menuName);
        if (!menu) {
            console.log(`Menu '${menuName}' not found.`);
            return null;
        }

        // Get all sections for this menu
        const sections = await getSections(menuName);
        console.log(`Found ${sections.length} sections for menu '${menuName}'`);

        // Get items for each section and add to the section object
        for (const section of sections) {
            section.items = await getItems(section.id) || [];
            section.type = 'section';
            console.log(`Section '${section.name}' has ${section.items.length} items`);
        }

        // Try to get spacers if the table exists
        let spacers = [];
        try {
            spacers = await getSpacers(menuName);
            console.log(`Found ${spacers.length} spacers for menu '${menuName}'`);
            
            // Add type to spacers
            for (const spacer of spacers) {
                spacer.type = 'spacer';
            }
        } catch (error) {
            console.log('Spacers table not found. This is expected for old database versions.');
        }

        // Combine sections and spacers
        const elements = [...sections, ...spacers].sort((a, b) => a.position - b.position);

        // Create recovery data
        const recoveryData = {
            ...menu,
            elements
        };

        // Write to recovery file
        const recoveryDir = path.join(__dirname, '../recovery');
        if (!fs.existsSync(recoveryDir)) {
            fs.mkdirSync(recoveryDir);
        }

        const filename = path.join(recoveryDir, `${menuName}_recovery_${Date.now()}.json`);
        fs.writeFileSync(filename, JSON.stringify(recoveryData, null, 2));
        
        console.log(`Recovery data saved to ${filename}`);
        return recoveryData;
    } catch (error) {
        console.error('Error recovering menu:', error);
        return null;
    }
}

// List all available menus
async function listMenus() {
    try {
        const menus = await getAllMenus();
        console.log('Available menus:');
        menus.forEach(menu => {
            console.log(`- ${menu.name}`);
        });
        return menus;
    } catch (error) {
        console.error('Error listing menus:', error);
        return [];
    }
}

// Helper function to get all menus
function getAllMenus() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM menus ORDER BY name', [], (err, menus) => {
            if (err) reject(err);
            else resolve(menus || []);
        });
    });
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

// Helper function to get sections for a menu
function getSections(menuName) {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM sections WHERE menu_name = ? ORDER BY position', [menuName], (err, sections) => {
            if (err) reject(err);
            else resolve(sections || []);
        });
    });
}

// Helper function to get items for a section
function getItems(sectionId) {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM items WHERE section_id = ? ORDER BY position', [sectionId], (err, items) => {
            if (err) reject(err);
            else resolve(items || []);
        });
    });
}

// Helper function to get spacers for a menu
function getSpacers(menuName) {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM spacers WHERE menu_name = ? ORDER BY position', [menuName], (err, spacers) => {
            if (err) reject(err);
            else resolve(spacers || []);
        });
    });
}

// Main function
async function main() {
    try {
        // Get menu name from command line args
        const menuName = process.argv[2];
        
        if (menuName) {
            // Recover a specific menu
            console.log(`Attempting to recover menu '${menuName}'...`);
            await recoverMenu(menuName);
        } else {
            // List all menus and recover all
            const menus = await listMenus();
            
            console.log('\nRecovering all menus...');
            for (const menu of menus) {
                console.log(`\nRecovering menu '${menu.name}'...`);
                await recoverMenu(menu.name);
            }
        }
        
        console.log('\nRecovery complete!');
    } catch (error) {
        console.error('Recovery error:', error);
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