const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize database
const db = new sqlite3.Database(path.join(__dirname, '../data/menus.db'));

// Create tables
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS menus (
            name TEXT PRIMARY KEY,
            title TEXT,
            subtitle TEXT,
            font TEXT,
            layout TEXT,
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
            FOREIGN KEY (menu_name) REFERENCES menus(name) ON DELETE CASCADE
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            section_id INTEGER,
            name TEXT,
            description TEXT,
            price REAL,
            active BOOLEAN DEFAULT 1,
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

const getSections = (menuName) => {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM sections WHERE menu_name = ?', [menuName], async (err, sections) => {
            if (err) reject(err);
            else {
                try {
                    const sectionsWithItems = await Promise.all(
                        sections.map(async (section) => {
                            const items = await getItems(section.id);
                            return { ...section, items };
                        })
                    );
                    resolve(sectionsWithItems);
                } catch (error) {
                    reject(error);
                }
            }
        });
    });
};

const getItems = (sectionId) => {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM items WHERE section_id = ?', [sectionId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const createMenu = async (name, title, subtitle, font, layout, sections) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO menus (name, title, subtitle, font, layout) VALUES (?, ?, ?, ?, ?)',
            [name, title, subtitle, font, layout],
            async function(err) {
                if (err) reject(err);
                else {
                    try {
                        await Promise.all(
                            sections.map(section => createSection(name, section))
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

const createSection = async (menuName, section) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO sections (menu_name, name, active) VALUES (?, ?, ?)',
            [menuName, section.name, section.active],
            async function(err) {
                if (err) reject(err);
                else {
                    try {
                        await Promise.all(
                            section.items.map(item => createItem(this.lastID, item))
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

const createItem = (sectionId, item) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO items (section_id, name, description, price, active) VALUES (?, ?, ?, ?, ?)',
            [sectionId, item.name, item.description, item.price, item.active],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
};

const updateMenu = async (name, title, subtitle, font, layout, sections) => {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE menus SET title = ?, subtitle = ?, font = ?, layout = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?',
            [title, subtitle, font, layout, name],
            async function(err) {
                if (err) reject(err);
                else if (this.changes === 0) resolve(null);
                else {
                    try {
                        // Delete existing sections and items
                        await deleteSections(name);
                        // Create new sections and items
                        await Promise.all(
                            sections.map(section => createSection(name, section))
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
        db.run('DELETE FROM menus WHERE name = ?', [name], function(err) {
            if (err) reject(err);
            else resolve(this.changes > 0);
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