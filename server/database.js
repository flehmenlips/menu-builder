const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize database
const db = new sqlite3.Database(path.join(__dirname, '../data/menus.db'));

// Enable foreign keys support
db.run('PRAGMA foreign_keys = ON');

// Create tables
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS menus (
            name TEXT PRIMARY KEY,
            title TEXT,
            subtitle TEXT,
            font TEXT,
            layout TEXT,
            show_dollar_sign INTEGER DEFAULT 1,
            show_decimals INTEGER DEFAULT 1,
            show_section_dividers INTEGER DEFAULT 1,
            wrap_special_chars INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS sections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            menu_name TEXT,
            name TEXT,
            active INTEGER DEFAULT 1,
            position INTEGER,
            FOREIGN KEY (menu_name) REFERENCES menus(name) ON DELETE CASCADE
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            section_id INTEGER,
            name TEXT,
            description TEXT,
            price TEXT,
            active INTEGER DEFAULT 1,
            position INTEGER,
            FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS spacers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            menu_name TEXT,
            size TEXT,
            unit TEXT,
            position INTEGER,
            FOREIGN KEY (menu_name) REFERENCES menus(name) ON DELETE CASCADE
        )
    `);
});

// Database functions
const getAllMenus = () => {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM menus ORDER BY created_at DESC', (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const getMenu = async (name) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM menus WHERE name = ?', [name], async (err, menu) => {
            if (err) reject(err);
            else if (!menu) resolve(null);
            else {
                try {
                    // Get all elements (sections and spacers)
                    const sections = await getSections(name);
                    const spacers = await getSpacers(name);
                    
                    // Combine sections and spacers into elements array
                    const elements = [...sections.map(s => ({...s, type: 'section'})), 
                                     ...spacers.map(s => ({...s, type: 'spacer'}))]
                                     .sort((a, b) => a.position - b.position);

                    // Return complete menu object
                    resolve({
                        ...menu,
                        sections, // Keep for backward compatibility
                        elements // New format
                    });
                } catch (error) {
                    reject(error);
                }
            }
        });
    });
};

const getSections = async (menuName) => {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM sections WHERE menu_name = ? ORDER BY position', [menuName], async (err, sections) => {
            if (err) reject(err);
            else {
                try {
                    for (const section of sections) {
                        const items = await getItems(section.id);
                        section.items = items;
                    }
                    resolve(sections);
                } catch (error) {
                    reject(error);
                }
            }
        });
    });
};

const getItems = async (sectionId) => {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM items WHERE section_id = ? ORDER BY position', [sectionId], (err, items) => {
            if (err) reject(err);
            else resolve(items);
        });
    });
};

const getSpacers = async (menuName) => {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM spacers WHERE menu_name = ? ORDER BY position', [menuName], (err, spacers) => {
            if (err) reject(err);
            else resolve(spacers || []);
        });
    });
};

const createMenu = async (name, title, subtitle, font, layout, showDollarSign, showDecimals, showSectionDividers, elements) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO menus (name, title, subtitle, font, layout, show_dollar_sign, show_decimals, show_section_dividers) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [name, title, subtitle, font, layout, showDollarSign, showDecimals, showSectionDividers],
            async function(err) {
                if (err) reject(err);
                else {
                    try {
                        // Create elements with additional validation
                        if (elements && Array.isArray(elements)) {
                            // Filter out any undefined or invalid elements before mapping
                            const validElements = elements.filter(element => 
                                element && typeof element === 'object' && element.type
                            );
                            
                            if (validElements.length === 0) {
                                console.warn(`Warning: No valid elements found for menu "${name}"`);
                            }
                            
                            await Promise.all(
                                validElements.map(async (element, index) => {
                                    try {
                                        if (element.type === 'section') {
                                            return createSection(name, element, element.position || index);
                                        } else if (element.type === 'spacer') {
                                            return createSpacer(name, element, element.position || index);
                                        } else {
                                            console.warn(`Skipping element with unknown type: ${element.type}`);
                                            return Promise.resolve();
                                        }
                                    } catch (error) {
                                        console.error(`Error processing element at index ${index}:`, error);
                                        return Promise.resolve(); // Continue with other elements
                                    }
                                })
                            );
                        } else {
                            console.warn(`No elements array provided for menu "${name}"`);
                        }
                        
                        const menu = await getMenu(name);
                        resolve(menu);
                    } catch (error) {
                        reject(error);
                    }
                }
            }
        );
    });
};

const createSection = async (menuName, section, position) => {
    return new Promise((resolve, reject) => {
        // Add validation for required fields
        if (!section || !section.name) {
            console.warn('Invalid section data: missing name');
            return resolve(); // Skip this section but don't fail
        }

        const active = section.active === undefined ? 1 : section.active;
        
        db.run(
            'INSERT INTO sections (menu_name, name, active, position) VALUES (?, ?, ?, ?)',
            [menuName, section.name, active, position],
            async function(err) {
                if (err) {
                    console.error('Error creating section:', err);
                    return resolve(); // Don't reject, just log and continue
                }
                
                try {
                    // Only process items if they exist
                    if (section.items && Array.isArray(section.items)) {
                        // Filter out invalid items
                        const validItems = section.items.filter(item => 
                            item && typeof item === 'object' && item.name
                        );
                        
                        if (validItems.length > 0) {
                            await Promise.all(
                                validItems.map((item, index) => {
                                    try {
                                        return createItem(this.lastID, item, index);
                                    } catch (error) {
                                        console.error(`Error creating item at index ${index}:`, error);
                                        return Promise.resolve(); // Continue with other items
                                    }
                                })
                            );
                        }
                    }
                    resolve();
                } catch (error) {
                    console.error('Error processing section items:', error);
                    resolve(); // Don't reject, just log and continue
                }
            }
        );
    });
};

const createItem = async (sectionId, item, position) => {
    return new Promise((resolve, reject) => {
        // Add validation for required fields
        if (!item || !item.name) {
            console.warn('Invalid item data: missing name');
            return resolve(); // Skip this item but don't fail
        }

        // Set default values for optional properties
        const description = item.description || '';
        const price = item.price || '';
        const active = item.active === undefined ? 1 : item.active;
        
        db.run(
            'INSERT INTO items (section_id, name, description, price, active, position) VALUES (?, ?, ?, ?, ?, ?)',
            [sectionId, item.name, description, price, active, position],
            function(err) {
                if (err) {
                    console.error('Error creating item:', err);
                    resolve(); // Don't reject, just log and continue
                } else {
                    resolve();
                }
            }
        );
    });
};

const createSpacer = async (menuName, spacer, position) => {
    return new Promise((resolve, reject) => {
        // Add validation for required fields
        if (!spacer) {
            console.warn('Invalid spacer data: missing spacer object');
            return resolve(); // Skip this spacer but don't fail
        }

        // Set default values for required properties
        const size = spacer.size || '30';
        const unit = spacer.unit || 'px';
        
        db.run(
            'INSERT INTO spacers (menu_name, size, unit, position) VALUES (?, ?, ?, ?)',
            [menuName, size, unit, position],
            function(err) {
                if (err) {
                    console.error('Error creating spacer:', err);
                    resolve(); // Don't reject, just log and continue
                } else {
                    resolve();
                }
            }
        );
    });
};

const updateMenu = async (name, title, subtitle, font, layout, showDollarSign, showDecimals, showSectionDividers, elements) => {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE menus SET title = ?, subtitle = ?, font = ?, layout = ?, show_dollar_sign = ?, show_decimals = ?, show_section_dividers = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?',
            [title, subtitle, font, layout, showDollarSign, showDecimals, showSectionDividers, name],
            async function(err) {
                if (err) reject(err);
                else if (this.changes === 0) resolve(null);
                else {
                    try {
                        // Delete existing sections, items, and spacers
                        await deleteSections(name);
                        await deleteSpacers(name);
                        
                        // Create new elements - with additional validation
                        if (elements && Array.isArray(elements)) {
                            // Filter out any undefined or invalid elements before mapping
                            const validElements = elements.filter(element => 
                                element && typeof element === 'object' && element.type
                            );
                            
                            if (validElements.length === 0) {
                                console.warn(`Warning: No valid elements found for menu "${name}"`);
                            }
                            
                            await Promise.all(
                                validElements.map(async (element, index) => {
                                    try {
                                        if (element.type === 'section') {
                                            return createSection(name, element, element.position || index);
                                        } else if (element.type === 'spacer') {
                                            return createSpacer(name, element, element.position || index);
                                        } else {
                                            console.warn(`Skipping element with unknown type: ${element.type}`);
                                            return Promise.resolve();
                                        }
                                    } catch (error) {
                                        console.error(`Error processing element at index ${index}:`, error);
                                        return Promise.resolve(); // Continue with other elements
                                    }
                                })
                            );
                        } else {
                            console.warn(`No elements array provided for menu "${name}"`);
                        }
                        
                        const menu = await getMenu(name);
                        resolve(menu);
                    } catch (error) {
                        reject(error);
                    }
                }
            }
        );
    });
};

const deleteSections = (menuName) => {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM sections WHERE menu_name = ?', [menuName], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

const deleteSpacers = (menuName) => {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM spacers WHERE menu_name = ?', [menuName], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

const deleteMenu = (name) => {
    return new Promise((resolve, reject) => {
        // First ensure that sections are deleted
        db.run('DELETE FROM sections WHERE menu_name = ?', [name], (sectionErr) => {
            if (sectionErr) {
                reject(sectionErr);
                return;
            }
            
            // Then delete the menu
            db.run('DELETE FROM menus WHERE name = ?', [name], function(err) {
                if (err) reject(err);
                else resolve(this.changes > 0);
            });
        });
    });
};

module.exports = {
    getAllMenus,
    getMenu,
    createMenu,
    updateMenu,
    deleteMenu
}; 