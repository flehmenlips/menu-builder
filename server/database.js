const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize database - THIS IS THE SINGLE CONNECTION
const db = new sqlite3.Database(path.join(__dirname, '../data/menus.db'), (err) => {
    if (err) {
        console.error("FATAL ERROR opening database:", err.message);
        // Consider exiting if DB can't open?
        // process.exit(1);
    } else {
        console.log("Database connection opened successfully.");
    }
});

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

    // --- ADDED: Create content_blocks table ---
    db.run(`
        CREATE TABLE IF NOT EXISTS content_blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            identifier TEXT UNIQUE NOT NULL,      -- Unique key for fetching public content
            title TEXT NOT NULL,
            content TEXT,
            content_type TEXT DEFAULT 'text',   -- e.g., text, html, image_url
            section TEXT NOT NULL,            -- Section identifier (e.g., 'homepage_hero', 'faq')
            order_index INTEGER DEFAULT 0,    -- Order within a section
            is_active INTEGER DEFAULT 1,      -- 1 for active, 0 for inactive
            metadata TEXT,                    -- Store additional JSON data if needed
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // --- ADDED: Create sessions table ---
    db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,       -- The session token itself
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
    // Create index for faster session lookup
    db.run(`CREATE INDEX IF NOT EXISTS idx_session_token ON sessions (token)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_session_user ON sessions (user_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_session_expires ON sessions (expires_at)`);
});

// --- One-time data updates (Run AFTER tables are definitely created) ---
console.log("Running one-time data updates after table serialization...");
// Add user_id column to menus if it doesn't exist
db.run("ALTER TABLE menus ADD COLUMN user_id INTEGER", [], (err) => {
    if (err && !err.message.includes('duplicate column name')) {
        console.error(" Error adding user_id column to menus:", err);
    } else {
        if (!err) console.log(" Added user_id column to menus table (or it already existed).");
        // Assign ownerless menus to admin user (ID 2) - run AFTER alter attempt
        db.run('UPDATE menus SET user_id = 2 WHERE user_id IS NULL', [], function(updateErr) { // Use function() to get this.changes
            if (updateErr) {
                console.error(" Error updating ownerless menus:", updateErr);
            } else if (this.changes > 0) {
                console.log(` Assigned ${this.changes} ownerless menus to admin user (ID 2).`);
            } else {
                console.log(" No ownerless menus found to assign.");
            }
        });
    }
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
        db.get('SELECT * FROM menus WHERE name = ? AND user_id = ?', [name, userId], async (err, menu) => {
            if (err) return reject(new Error(`DB error checking ownership: ${err.message}`));
            if (!menu) return reject(new Error('Menu not found or user not authorized.'));

            const setClauses = [];
            const params = [];
            const fieldMapping = { showDollarSign: 'show_dollar_sign', /* ... other mappings ... */ };

            for (const key in updates) {
                if (key === 'elements') continue;
                const dbColumn = fieldMapping[key] || key;
                let value = updates[key];
                if (key === 'logoSize') value = String(value !== undefined ? value : menu.logo_size);
                if (key === 'logoOffset') value = String(value !== undefined ? value : (menu.logo_offset || '0'));
                if (value !== undefined) { setClauses.push(`${dbColumn} = ?`); params.push(value); }
            }

            if (setClauses.length > 0) {
                setClauses.push('updated_at = CURRENT_TIMESTAMP');
                params.push(name); params.push(userId);
                const sql = `UPDATE menus SET ${setClauses.join(', ')} WHERE name = ? AND user_id = ?`;
                await new Promise((res, rej) => {
                    db.run(sql, params, function(err) {
                        if (err) return rej(new Error(`Error updating fields: ${err.message}`));
                        if (this.changes === 0) return rej(new Error('Update failed, zero rows changed.'));
                        res();
                    });
                });
            } else if (!updates.elements) {
                 console.log("No fields or elements to update for menu:", name);
                 return resolve(menu); // Return current menu if nothing changed
            }

            try {
                 if (updates.elements && Array.isArray(updates.elements)) {
                    await deleteSections(name);
                    await deleteSpacers(name);
                    await Promise.all(updates.elements.map((el, i) => el.type === 'spacer' ? createSpacer(name, el, el.position ?? i) : createSection(name, el, el.position ?? i)));
                 }
                const updatedMenu = await getMenuByNameAndUser(name, userId);
                resolve(updatedMenu);
            } catch (elementError) {
                reject(new Error(`Error processing elements: ${elementError.message}`));
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

const getMenuByNameAndUser = (name, userId) => {
    return new Promise(async (resolve, reject) => {
        db.get('SELECT * FROM menus WHERE name = ? AND user_id = ?', [name, userId], async (err, menu) => {
            if (err) return reject(err);
            if (!menu) return resolve(null);
            try {
                const sections = await getSections(name);
                const spacers = await getSpacers(name);
                const elements = [...sections.map(s => ({...s, type: 'section'})), ...spacers.map(s => ({...s, type: 'spacer'}))].sort((a, b) => a.position - b.position);
                menu.elements = elements;
                resolve(menu);
            } catch (fetchErr) { reject(fetchErr); }
        });
    });
};

const deleteMenuByNameAndUser = (name, userId) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT id FROM menus WHERE name = ? AND user_id = ?', [name, userId], (err, menu) => {
            if (err) return reject(new Error(`DB error checking ownership: ${err.message}`));
            if (!menu) return reject(new Error('Menu not found or not authorized.'));
            
            // Assuming CASCADE delete handles sections/items/spacers
            db.run('DELETE FROM menus WHERE name = ? AND user_id = ?', [name, userId], function(err) {
                if (err) return reject(new Error(`Error deleting menu: ${err.message}`));
                if (this.changes === 0) return reject(new Error('Deletion failed, zero rows changed.'));
                resolve(true);
            });
        });
    });
};

const duplicateMenu = (sourceName, newName, userId) => {
    return new Promise(async (resolve, reject) => {
        try {
            const sourceMenu = await getMenuByNameAndUser(sourceName, userId);
            if (!sourceMenu) return reject(new Error('Source menu not found or user not authorized.'));
            const existingMenu = await getMenuByNameAndUser(newName, userId);
            if (existingMenu) return reject(new Error('Duplicate name exists for this user.'));

            const { id, created_at, updated_at, elements, ...sourceData } = sourceMenu;
            const newMenuData = { ...sourceData, name: newName, user_id: userId }; // Ensure correct name & user

            const columns = Object.keys(newMenuData).join(', ');
            const placeholders = Object.keys(newMenuData).map(() => '?').join(', ');
            const values = Object.values(newMenuData);

            await new Promise((res, rej) => {
                 db.run(`INSERT INTO menus (${columns}) VALUES (${placeholders})`, values, function(err) {
                     if (err) return rej(new Error(`DB error inserting duplicate: ${err.message}`));
                     res();
                 });
            });
            
            if (elements && Array.isArray(elements)) {
                await Promise.all(elements.map((el, i) => el.type === 'spacer' ? createSpacer(newName, el, el.position ?? i) : createSection(newName, el, el.position ?? i)));
            }

            const completeNewMenu = await getMenuByNameAndUser(newName, userId);
            resolve(completeNewMenu);
        } catch (error) {
            console.error(`Error duplicating menu for user ${userId}:`, error);
            try { await deleteMenuByNameAndUser(newName, userId).catch(() => {}); } finally { reject(error); }
        }
    });
};

// Ensure module.exports is present and correct
module.exports = {
    db, // Export the connection object itself
    getAllMenus,
    getMenu, // Original getter
    getMenuByNameAndUser, // User-specific getter
    createMenu,
    updateMenu, 
    deleteMenuByNameAndUser, // User-specific delete
    getMenusByUserId,
    duplicateMenu, 
    // Include other necessary exports if they existed before the deletion
    getSections, 
    getItems, 
    getSpacers,
    deleteSections,
    deleteSpacers 
};