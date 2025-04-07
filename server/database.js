const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize database
const db = new sqlite3.Database(path.join(__dirname, '../data/menus.db'));

// Enable foreign keys support
db.run('PRAGMA foreign_keys = ON');

// Create tables
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            is_admin INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP,
            subscription_status TEXT DEFAULT 'free',
            subscription_end_date TIMESTAMP,
            reset_token TEXT,
            reset_token_expires TIMESTAMP
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS company_profiles (
            user_id INTEGER PRIMARY KEY,
            company_name TEXT,
            address TEXT,
            phone TEXT,
            email TEXT, 
            website TEXT,
            logo_path TEXT,
            primary_color TEXT,
            secondary_color TEXT,
            accent_color TEXT,
            default_font TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

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
            logo_path TEXT,
            logo_position TEXT DEFAULT 'top',
            logo_size TEXT DEFAULT '200',
            logo_offset TEXT DEFAULT '0',
            background_color TEXT DEFAULT '#ffffff',
            text_color TEXT DEFAULT '#000000',
            accent_color TEXT DEFAULT '#333333',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            user_id INTEGER
        )
    `);

    // --- One-time data update --- 
    // Add user_id column if it doesn't exist (SQLite specific)
    db.run("ALTER TABLE menus ADD COLUMN user_id INTEGER", [], (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            // Ignore error if column already exists, log others
            console.error("Error adding user_id column to menus:", err);
        } else if (!err) {
            console.log("Added user_id column to menus table.");
        } 
        // Always attempt to assign ownerless menus after trying to add the column
        db.run('UPDATE menus SET user_id = 2 WHERE user_id IS NULL', [], (updateErr) => {
            if (updateErr) {
                console.error("Error updating ownerless menus:", updateErr);
            } else {
                console.log("Assigned ownerless menus to admin user (ID 2).");
            }
        });
    });

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

const getMenusByUserId = (userId) => {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM menus WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const createMenu = async (name, title, subtitle, font, layout, showDollarSign, showDecimals, showSectionDividers, elements, logoPath, logoPosition, logoSize, logoOffset, backgroundColor, textColor, accentColor, userId) => {
    return new Promise((resolve, reject) => {
        // Ensure logoSize is stored as a string
        const logoSizeValue = logoSize ? String(logoSize) : '200';
        // Ensure logoOffset is stored as a string
        const logoOffsetValue = logoOffset ? String(logoOffset) : '0';
        
        db.run(
            `INSERT INTO menus (
                name, title, subtitle, font, layout, 
                show_dollar_sign, show_decimals, show_section_dividers,
                logo_path, logo_position, logo_size, logo_offset,
                background_color, text_color, accent_color,
                user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name, title, subtitle, font, layout, 
                showDollarSign, showDecimals, showSectionDividers,
                logoPath, logoPosition, logoSizeValue, logoOffsetValue,
                backgroundColor, textColor, accentColor,
                userId
            ],
            async function(err) {
                if (err) {
                    console.error('Error creating menu:', err);
                    reject(err);
                } else {
                    try {
                        // Process elements (sections and spacers)
                        if (elements && Array.isArray(elements)) {
                            await Promise.all(
                                elements.map(async (element, index) => {
                                    // Use index as position if not specified
                                    const position = element.position !== undefined ? element.position : index;
                                    
                                    if (element.type === 'spacer') {
                                        await createSpacer(name, element, position);
                                    } else {
                                        // Default to section type if not specified
                                        await createSection(name, element, position);
                                    }
                                })
                            );
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

const updateMenu = (name, userId, updates) => {
    return new Promise((resolve, reject) => {
        // First, verify ownership
        db.get('SELECT * FROM menus WHERE name = ? AND user_id = ?', [name, userId], async (err, menu) => {
            if (err) {
                return reject(new Error(`Database error checking menu ownership: ${err.message}`));
            }
            if (!menu) {
                return reject(new Error('Menu not found or user not authorized to update.'));
            }

            // Prepare the SET clause dynamically
            const setClauses = [];
            const params = [];
            
            // Map frontend keys to DB columns if necessary, handle specific values
            const fieldMapping = {
                showDollarSign: 'show_dollar_sign',
                showDecimals: 'show_decimals',
                showSectionDividers: 'show_section_dividers',
                logoPath: 'logo_path',
                logoPosition: 'logo_position',
                logoSize: 'logo_size',
                logoOffset: 'logo_offset',
                backgroundColor: 'background_color',
                textColor: 'text_color',
                accentColor: 'accent_color',
                // Add other direct mappings
                title: 'title',
                subtitle: 'subtitle',
                font: 'font',
                layout: 'layout'
            };

            for (const key in updates) {
                if (key === 'elements') continue; // Handle elements separately

                const dbColumn = fieldMapping[key] || key; // Use mapping or key itself
                let value = updates[key];

                // Ensure logoSize/Offset are strings
                if (key === 'logoSize') value = String(value !== undefined ? value : menu.logo_size);
                if (key === 'logoOffset') value = String(value !== undefined ? value : (menu.logo_offset || '0'));

                if (value !== undefined) { // Only update if value is provided
                    setClauses.push(`${dbColumn} = ?`);
                    params.push(value);
                }
            }

            if (setClauses.length === 0 && !updates.elements) {
                // No fields to update besides potentially elements
                 console.log("No basic fields to update for menu:", name);
                 // Still need to process elements if provided
            } else if (setClauses.length > 0){
                 // Add timestamp and WHERE clause params
                setClauses.push('updated_at = CURRENT_TIMESTAMP');
                params.push(name); // For WHERE name = ?
                params.push(userId); // For WHERE user_id = ?

                const sql = `UPDATE menus SET ${setClauses.join(', ')} WHERE name = ? AND user_id = ?`;
                
                // Run the update for basic fields
                await new Promise((res, rej) => {
                    db.run(sql, params, function(err) {
                        if (err) return rej(new Error(`Error updating menu fields: ${err.message}`));
                        if (this.changes === 0) return rej(new Error('Menu update failed, zero rows changed.'));
                        console.log("Updated basic fields for menu:", name);
                        res();
                    });
                });
            }

            // --- Process Elements --- 
            try {
                 if (updates.elements && Array.isArray(updates.elements)) {
                    console.log("Processing element updates for menu:", name);
                    // Delete existing sections and spacers for this menu
                    await deleteSections(name); // Assumes these only delete for the given menu_name
                    await deleteSpacers(name);
                    
                    // Create new elements
                    await Promise.all(
                        updates.elements.map(async (element, index) => {
                            const position = element.position !== undefined ? element.position : index;
                            if (element.type === 'spacer') {
                                await createSpacer(name, element, position);
                            } else {
                                await createSection(name, element, position);
                            }
                        })
                    );
                     console.log("Finished processing element updates for menu:", name);
                 }

                // Fetch and return the fully updated menu
                const updatedMenu = await getMenuByNameAndUser(name, userId);
                resolve(updatedMenu);
            } catch (elementError) {
                 console.error("Error processing elements during update:", elementError);
                reject(new Error(`Error processing elements during update: ${elementError.message}`));
            }
        });
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

const deleteMenu = (name, userId) => {
    return new Promise((resolve, reject) => {
        // First check if menu exists and belongs to the user
        db.get('SELECT * FROM menus WHERE name = ? AND (user_id = ? OR user_id IS NULL)', [name, userId], (err, menu) => {
            if (err) {
                return reject(err);
            }
            
            if (!menu) {
                return resolve(false);
            }
            
            // Delete the menu
            db.run('DELETE FROM menus WHERE name = ?', [name], function(err) {
                if (err) reject(err);
                else resolve(true);
            });
        });
    });
};

// Get a specific menu by name ONLY if it belongs to the user
const getMenuByNameAndUser = (name, userId) => {
    return new Promise(async (resolve, reject) => {
        db.get('SELECT * FROM menus WHERE name = ? AND user_id = ?', [name, userId], async (err, menu) => {
            if (err) {
                return reject(err);
            }
            if (!menu) {
                return resolve(null); // Menu not found or doesn't belong to user
            }
            
            // If menu found, fetch its sections, items, and spacers
            try {
                const sections = await getSections(name);
                const spacers = await getSpacers(name);

                const elements = [];
                let sectionIndex = 0;
                let spacerIndex = 0;

                // Combine sections and spacers based on position
                while (sectionIndex < sections.length || spacerIndex < spacers.length) {
                    const sectionPos = sections[sectionIndex]?.position ?? Infinity;
                    const spacerPos = spacers[spacerIndex]?.position ?? Infinity;

                    if (sectionPos <= spacerPos) {
                        elements.push({ ...sections[sectionIndex], type: 'section' });
                        sectionIndex++;
                    } else {
                        elements.push({ ...spacers[spacerIndex], type: 'spacer' });
                        spacerIndex++;
                    }
                }

                menu.elements = elements;
                resolve(menu);
            } catch (fetchErr) {
                reject(fetchErr);
            }
        });
    });
};

// Delete a menu only if it belongs to the user
const deleteMenuByNameAndUser = (name, userId) => {
    return new Promise((resolve, reject) => {
        // First, verify ownership
        db.get('SELECT id FROM menus WHERE name = ? AND user_id = ?', [name, userId], (err, menu) => {
            if (err) {
                return reject(new Error(`Database error checking menu ownership: ${err.message}`));
            }
            if (!menu) {
                // Menu doesn't exist or doesn't belong to the user
                return reject(new Error('Menu not found or user not authorized to delete.'));
            }
            
            // Proceed with deletion (cascade handled by DB schema or manual deletes)
            // Assuming sections/items/spacers are deleted via cascade or manually elsewhere if needed
            db.run('DELETE FROM menus WHERE name = ? AND user_id = ?', [name, userId], function(err) {
                if (err) {
                    return reject(new Error(`Error deleting menu: ${err.message}`));
                }
                if (this.changes === 0) {
                    // Should not happen if the GET succeeded, but good practice to check
                    return reject(new Error('Menu deletion failed, zero rows changed.'));
                }
                resolve(true); // Indicate success
            });
        });
    });
};

// Duplicate a menu for a specific user
const duplicateMenu = (sourceName, newName, userId) => {
    return new Promise(async (resolve, reject) => {
        try {
            // 1. Verify ownership of the source menu
            const sourceMenu = await getMenuByNameAndUser(sourceName, userId);
            if (!sourceMenu) {
                return reject(new Error('Source menu not found or user not authorized.'));
            }

            // 2. Check if the new name already exists for the user
            const existingMenu = await getMenuByNameAndUser(newName, userId);
            if (existingMenu) {
                return reject(new Error('Duplicate menu name already exists for this user.'));
            }

            // 3. Create the new menu entry (copying properties)
            // Exclude fields that should be new (id, created_at, updated_at)
            // Explicitly set user_id
            const newMenuData = {
                name: newName,
                title: sourceMenu.title,
                subtitle: sourceMenu.subtitle,
                font: sourceMenu.font,
                layout: sourceMenu.layout,
                show_dollar_sign: sourceMenu.show_dollar_sign,
                show_decimals: sourceMenu.show_decimals,
                show_section_dividers: sourceMenu.show_section_dividers,
                logo_path: sourceMenu.logo_path,
                logo_position: sourceMenu.logo_position,
                logo_size: sourceMenu.logo_size,
                logo_offset: sourceMenu.logo_offset,
                background_color: sourceMenu.background_color,
                text_color: sourceMenu.text_color,
                accent_color: sourceMenu.accent_color,
                user_id: userId
            };

            const columns = Object.keys(newMenuData).join(', ');
            const placeholders = Object.keys(newMenuData).map(() => '?').join(', ');
            const values = Object.values(newMenuData);

            await new Promise((res, rej) => {
                 db.run(`INSERT INTO menus (${columns}) VALUES (${placeholders})`, values, function(err) {
                     if (err) return rej(new Error(`Error inserting duplicated menu: ${err.message}`));
                     res(this.lastID); // Resolve with the new menu's ID (though we use name)
                 });
            });
            
            // 4. Duplicate elements (sections, items, spacers)
            if (sourceMenu.elements && Array.isArray(sourceMenu.elements)) {
                await Promise.all(
                    sourceMenu.elements.map(async (element, index) => {
                        const position = element.position !== undefined ? element.position : index;
                        if (element.type === 'spacer') {
                            // Need to adjust createSpacer if it relies on auto-increment ID
                            await createSpacer(newName, element, position);
                        } else { 
                            // Need to adjust createSection/createItem if they rely on auto-increment IDs
                            // This might require fetching the new section ID after creation
                            await createSection(newName, element, position);
                        }
                    })
                );
            }

            // 5. Fetch and return the complete new menu
            const completeNewMenu = await getMenuByNameAndUser(newName, userId);
            resolve(completeNewMenu);

        } catch (error) {
            console.error(`Error duplicating menu '${sourceName}' to '${newName}' for user ${userId}:`, error);
            // Attempt to clean up the potentially partially created new menu entry
            try {
                await deleteMenuByNameAndUser(newName, userId).catch(() => {}); // Ignore cleanup error
            } finally {
                reject(error); // Reject with the original error
            }
        }
    });
};

module.exports = {
    getAllMenus,
    getMenu,
    getMenuByNameAndUser,
    createMenu,
    updateMenu,
    deleteMenuByNameAndUser,
    getMenusByUserId,
    duplicateMenu
}; 