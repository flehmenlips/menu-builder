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
            show_dollar_sign BOOLEAN DEFAULT 1,
            show_decimals BOOLEAN DEFAULT 1,
            show_section_dividers BOOLEAN DEFAULT 1,
            wrap_special_chars BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS sections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            menu_name TEXT,
            name TEXT,
            active BOOLEAN DEFAULT 1,
            position INTEGER DEFAULT 0,
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
            active BOOLEAN DEFAULT 1,
            position INTEGER DEFAULT 0,
            FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
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
                    const sections = await getSections(name);
                    menu.sections = sections;
                    resolve(menu);
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

const createMenu = async (name, title, subtitle, font, layout, showDollarSign, showDecimals, showSectionDividers, wrapSpecialChars, sections) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO menus (name, title, subtitle, font, layout, show_dollar_sign, show_decimals, show_section_dividers, wrap_special_chars) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name, title, subtitle, font, layout, showDollarSign, showDecimals, showSectionDividers, wrapSpecialChars],
            async function(err) {
                if (err) reject(err);
                else {
                    try {
                        await Promise.all(
                            sections.map((section, index) => createSection(name, section, index))
                        );
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
        db.run(
            'INSERT INTO sections (menu_name, name, active, position) VALUES (?, ?, ?, ?)',
            [menuName, section.name, section.active, position],
            async function(err) {
                if (err) reject(err);
                else {
                    try {
                        await Promise.all(
                            section.items.map((item, index) => createItem(this.lastID, item, index))
                        );
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                }
            }
        );
    });
};

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

const updateMenu = async (name, title, subtitle, font, layout, showDollarSign, showDecimals, showSectionDividers, wrapSpecialChars, sections) => {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE menus SET title = ?, subtitle = ?, font = ?, layout = ?, show_dollar_sign = ?, show_decimals = ?, show_section_dividers = ?, wrap_special_chars = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?',
            [title, subtitle, font, layout, showDollarSign, showDecimals, showSectionDividers, wrapSpecialChars, name],
            async function(err) {
                if (err) reject(err);
                else if (this.changes === 0) resolve(null);
                else {
                    try {
                        // Delete existing sections and items
                        await deleteSections(name);
                        // Create new sections and items with positions
                        await Promise.all(
                            sections.map((section, index) => createSection(name, section, index))
                        );
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