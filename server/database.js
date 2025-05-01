const path = require('path');
// Remove SQLite, add PG
const { Pool } = require('pg'); 
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Load .env from root

// --- PostgreSQL Connection Pool (Exported Directly) ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Enable SSL for Render connections - Render requires it.
    // Adjust based on NODE_ENV or URL content if needed for local non-SSL DBs
    ssl: process.env.DATABASE_URL?.includes('render.com') 
         ? { rejectUnauthorized: false } 
         : (process.env.NODE_ENV === 'development' ? false : { rejectUnauthorized: false })
});

pool.on('connect', () => {
    console.log('PostgreSQL connected successfully via pool.'); // Log connection via pool
});

// --- Database Initialization Function ---
const initializeDatabase = async () => {
    console.log('Initializing database schema for multi-tenancy...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Wrap schema creation in transaction

        // Organizations Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS organizations (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                subscription_plan_id INTEGER, -- Nullable for now
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                -- Add constraint for plan ID later if needed
            )
        `);
        console.log('Table organizations checked/created.');

        // Users Table - Add organization_id and role
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                organization_id INTEGER, -- Initially allow NULL for migration
                name TEXT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT,
                is_admin BOOLEAN DEFAULT false, -- Keep for Super Admin?
                role TEXT NOT NULL DEFAULT 'USER', -- Default role
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMPTZ,
                subscription_status TEXT DEFAULT 'free',
                subscription_end_date TIMESTAMPTZ,
                reset_token TEXT,
                reset_token_expires TIMESTAMPTZ
                -- Add FK constraint after migration
            )
        `);
         // Add columns if they don't exist (idempotent)
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id INTEGER`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'USER'`);
        console.log('Table users checked/created/altered.');

        // Company Profiles Table (already references users.id)
        await client.query(`
            CREATE TABLE IF NOT EXISTS company_profiles (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
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
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Table company_profiles checked/created.');

        // Menus Table - Add organization_id
        await client.query(`
            CREATE TABLE IF NOT EXISTS menus (
                id SERIAL PRIMARY KEY,
                organization_id INTEGER, -- Initially allow NULL for migration
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, 
                name TEXT NOT NULL, 
                title TEXT,
                subtitle TEXT,
                font TEXT,
                layout TEXT,
                show_dollar_sign BOOLEAN DEFAULT true,
                show_decimals BOOLEAN DEFAULT true,
                show_section_dividers BOOLEAN DEFAULT true,
                wrap_special_chars BOOLEAN DEFAULT true,
                logo_path TEXT,
                logo_position TEXT DEFAULT 'top',
                logo_size TEXT DEFAULT '200',
                logo_offset TEXT DEFAULT '0',
                background_color TEXT DEFAULT '#ffffff',
                text_color TEXT DEFAULT '#000000',
                accent_color TEXT DEFAULT '#333333',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (organization_id, name) -- Menu name unique within an org
                 -- Add FK constraint after migration
            )
        `);
         // Add column if it doesn't exist (idempotent)
        await client.query(`ALTER TABLE menus ADD COLUMN IF NOT EXISTS organization_id INTEGER`);
        console.log('Table menus checked/created/altered.');

        // Sections Table (references menus.id)
        await client.query(`
            CREATE TABLE IF NOT EXISTS sections (
                id SERIAL PRIMARY KEY,
                menu_id INTEGER REFERENCES menus(id) ON DELETE CASCADE,
                name TEXT,
                active BOOLEAN DEFAULT true,
                position INTEGER
            )
        `);
        console.log('Table sections checked/created.');

        // Items Table (references sections.id)
        await client.query(`
            CREATE TABLE IF NOT EXISTS items (
                id SERIAL PRIMARY KEY,
                section_id INTEGER REFERENCES sections(id) ON DELETE CASCADE,
                name TEXT,
                description TEXT,
                price TEXT,
                active BOOLEAN DEFAULT true,
                position INTEGER
            )
        `);
        console.log('Table items checked/created.');

        // Spacers Table (references menus.id)
        await client.query(`
            CREATE TABLE IF NOT EXISTS spacers (
                id SERIAL PRIMARY KEY,
                menu_id INTEGER REFERENCES menus(id) ON DELETE CASCADE, 
                size TEXT,
                unit TEXT,
                position INTEGER
            )
        `);
        console.log('Table spacers checked/created.');

        // Content Blocks Table (No change needed for multi-tenancy phase 1)
        await client.query(`
            CREATE TABLE IF NOT EXISTS content_blocks (
                id SERIAL PRIMARY KEY,
                identifier TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL,
                content TEXT,
                content_type TEXT DEFAULT 'text',
                section TEXT NOT NULL,
                order_index INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                metadata JSONB, -- Use JSONB for metadata
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Table content_blocks checked/created.');

        // Sessions Table (references users.id)
        await client.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token TEXT UNIQUE NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Table sessions checked/created.');

        // Indexes 
        // ... (existing indexes are likely okay, add FK indexes later) ...
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_org ON users (organization_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_menus_org ON menus (organization_id)`);
        console.log('Indexes checked/created.');
        
        // Commit schema changes
        await client.query('COMMIT');
        console.log('Database schema initialization transaction committed.');

    } catch (err) {
        // Rollback on error
        await client.query('ROLLBACK');
        console.error('ERROR initializing database schema transaction:', err);
        throw err; // Re-throw error to prevent server start potentially
    } finally {
        client.release(); 
        console.log(' InitializeDatabase: Released client.');
    }
};

// --- Database Migration Function ---
const runDataMigration = async () => {
    console.log('Running data migration for multi-tenancy...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if foreign key constraints already exist
        const constraintCheckQuery = `
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE constraint_name IN ('fk_user_organization', 'fk_menu_organization')
        `;
        const constraintResult = await client.query(constraintCheckQuery);
        const existingConstraints = constraintResult.rows.map(row => row.constraint_name);
        
        // Add Foreign Key constraints AFTER ensuring columns exist and data is potentially migrated
        console.log('Adding foreign key constraints...');
        
        // Only add constraints if they don't already exist
        if (!existingConstraints.includes('fk_user_organization')) {
            console.log(' - Adding fk_user_organization constraint');
            await client.query(`ALTER TABLE users ADD CONSTRAINT fk_user_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED`);
        } else {
            console.log(' - fk_user_organization constraint already exists, skipping');
        }
        
        if (!existingConstraints.includes('fk_menu_organization')) {
            console.log(' - Adding fk_menu_organization constraint');
            await client.query(`ALTER TABLE menus ADD CONSTRAINT fk_menu_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED`);
        } else {
            console.log(' - fk_menu_organization constraint already exists, skipping');
        }
        
        // Find users needing migration
        const usersToMigrateResult = await client.query('SELECT id, name, email FROM users WHERE organization_id IS NULL');
        const usersToMigrate = usersToMigrateResult.rows;
        console.log(`Found ${usersToMigrate.length} users to migrate.`);

        for (const user of usersToMigrate) {
            console.log(` Migrating user ID: ${user.id}, Email: ${user.email}`);
            // Create organization for the user
            const orgName = `${user.name || user.email.split('@')[0]}'s Organization`;
            const insertOrgQuery = 'INSERT INTO organizations (name) VALUES ($1) RETURNING id';
            const orgResult = await client.query(insertOrgQuery, [orgName]);
            const newOrgId = orgResult.rows[0].id;
            console.log(`  - Created organization "${orgName}" with ID: ${newOrgId}`);

            // Update user with org ID and role
            const updateUserQuery = 'UPDATE users SET organization_id = $1, role = $2 WHERE id = $3';
            await client.query(updateUserQuery, [newOrgId, 'TENANT_ADMIN', user.id]);
            console.log(`  - Updated user ${user.id} with organization_id=${newOrgId}, role=TENANT_ADMIN`);

            // Update user's menus with org ID
            const updateMenusQuery = 'UPDATE menus SET organization_id = $1 WHERE user_id = $2 AND organization_id IS NULL';
            const menuUpdateResult = await client.query(updateMenusQuery, [newOrgId, user.id]);
            console.log(`  - Updated ${menuUpdateResult.rowCount} menus for user ${user.id} with organization_id=${newOrgId}`);
        }

        // Check if NOT NULL constraints need to be added
        const columnCheckQuery = `
            SELECT column_name, is_nullable
            FROM information_schema.columns
            WHERE table_name IN ('users', 'menus')
            AND column_name = 'organization_id'
        `;
        const columnResult = await client.query(columnCheckQuery);
        const nullableColumns = columnResult.rows.filter(row => row.is_nullable === 'YES');
        
        if (nullableColumns.length > 0) {
            console.log('Setting organization_id columns to NOT NULL...');
            // Only add NOT NULL constraints if they don't already exist
            for (const column of nullableColumns) {
                const tableName = column.table_name;
                console.log(` - Setting ${tableName}.organization_id to NOT NULL`);
                await client.query(`ALTER TABLE ${tableName} ALTER COLUMN organization_id SET NOT NULL`);
            }
        } else {
            console.log('All organization_id columns are already NOT NULL, skipping');
        }

        await client.query('COMMIT');
        console.log('Data migration transaction committed successfully.');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('ERROR during data migration transaction:', err);
        // Decide if this should prevent startup
    } finally {
        client.release();
        console.log('Migration script: Released client.');
    }
};

// Run initialization and migration
const setupDatabase = async () => {
    await initializeDatabase();
    await runDataMigration();
};

// Call setup on load
setupDatabase();

// --- Database Functions (using pool.query or query helper) ---

// Fetch all menus (potentially for admin? or public? - needs scoping)
const getAllMenus = async () => {
    const result = await pool.query('SELECT * FROM menus ORDER BY created_at DESC');
    return result.rows;
};

// Fetch all menus for a specific ORGANIZATION
const getMenusByOrgId = async (orgId) => {
    const query = 'SELECT * FROM menus WHERE organization_id = $1 ORDER BY created_at DESC';
    const result = await pool.query(query, [orgId]);
    return result.rows;
};

// Helper to fetch sections/items/spacers for a menu ID
const getMenuElements = async (menuId) => {
    const sectionsQuery = 'SELECT * FROM sections WHERE menu_id = $1 ORDER BY position';
    const sectionsResult = await pool.query(sectionsQuery, [menuId]);
    const sections = sectionsResult.rows;

    for (const section of sections) {
        const itemsQuery = 'SELECT * FROM items WHERE section_id = $1 ORDER BY position';
        const itemsResult = await pool.query(itemsQuery, [section.id]);
        section.items = itemsResult.rows;
    }

    const spacersQuery = 'SELECT * FROM spacers WHERE menu_id = $1 ORDER BY position';
    const spacersResult = await pool.query(spacersQuery, [menuId]);
    const spacers = spacersResult.rows;

    // Combine and sort
    const elements = [
        ...sections.map(s => ({ ...s, type: 'section' })),
        ...spacers.map(s => ({ ...s, type: 'spacer' })),
    ].sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));
    
    return elements;
};

// Get a specific menu by NAME and ORGANIZATION_ID
const getMenuByNameAndOrg = async (name, orgId) => {
    const menuQuery = 'SELECT * FROM menus WHERE name = $1 AND organization_id = $2';
    const menuResult = await pool.query(menuQuery, [name, orgId]);
    if (menuResult.rows.length === 0) return null; 
    const menu = menuResult.rows[0];
    menu.elements = await getMenuElements(menu.id);
    return menu;
};

// Get a menu by ID (scope to org? Maybe not needed if ID is unique)
const getMenuById = async (menuId) => {
    const menuQuery = 'SELECT * FROM menus WHERE id = $1';
    const menuResult = await pool.query(menuQuery, [menuId]);
    if (menuResult.rows.length === 0) return null;
    const menu = menuResult.rows[0];
    menu.elements = await getMenuElements(menu.id);
    return menu;
};

// Create Menu (includes orgId)
const createMenu = async (name, title, subtitle, font, layout, showDollarSign, showDecimals, showSectionDividers, elements, logoPath, logoPosition, logoSize, logoOffset, backgroundColor, textColor, accentColor, userId, orgId) => {
    console.log(`[DB createMenu] Starting transaction for menu: ${name}, user: ${userId}`);
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); 
        console.log(`[DB createMenu] BEGIN transaction`);

        const insertMenuQuery = `
            INSERT INTO menus (
                name, title, subtitle, font, layout, 
                show_dollar_sign, show_decimals, show_section_dividers,
                logo_path, logo_position, logo_size, logo_offset,
                background_color, text_color, accent_color, user_id, organization_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING id;
        `;
        const menuParams = [
            name, title ?? '', subtitle ?? '', font ?? 'Playfair Display', layout ?? 'single',
            showDollarSign !== false, showDecimals !== false, showSectionDividers !== false, // Defaults true
            logoPath, logoPosition ?? 'top', String(logoSize ?? '200'), String(logoOffset ?? '0'),
            backgroundColor ?? '#ffffff', textColor ?? '#000000', accentColor ?? '#333333',
            userId, orgId
        ];
        console.log(`[DB createMenu] Running INSERT INTO menus...`);
        const menuResult = await client.query(insertMenuQuery, menuParams);
        const menuId = menuResult.rows[0].id;
        console.log(`[DB createMenu] Menu row inserted. New menu ID: ${menuId}`);

        if (elements && Array.isArray(elements)) {
            console.log(`[DB createMenu] Processing ${elements.length} elements...`);
            for (const [index, element] of elements.entries()) {
                const position = element.position ?? index;
                if (element.type === 'spacer') {
                    console.log(`[DB createMenu]   - Creating spacer at position ${position}`);
                    await createSpacer(client, menuId, element, position);
                } else {
                    console.log(`[DB createMenu]   - Creating section "${element.name}" at position ${position}`);
                    await createSection(client, menuId, element, position);
                }
            }
             console.log(`[DB createMenu] Finished processing elements.`);
        }

        console.log(`[DB createMenu] Committing transaction...`);
        await client.query('COMMIT'); 
        console.log(`[DB createMenu] Transaction COMMITTED.`);
        
        console.log(`[DB createMenu] Fetching final created menu by ID ${menuId}`);
        const finalMenu = await getMenuById(menuId); 
        console.log(`[DB createMenu] Successfully created and fetched menu: ${name}`);
        return finalMenu; 

    } catch (e) {
        console.error(`[DB createMenu] *** ERROR in transaction for menu: ${name}. Rolling back... ***`, e);
        await client.query('ROLLBACK'); 
        console.log(`[DB createMenu] Transaction ROLLED BACK.`);
        throw e; 
    } finally {
        client.release();
         console.log(`[DB createMenu] Client released.`);
    }
};

// Create Section (takes PG client for transaction)
const createSection = async (client, menuId, section, position) => {
    if (!section || !section.name) {
        console.warn('Invalid section data passed to createSection');
        return;
    }
    const insertSectionQuery = 'INSERT INTO sections (menu_id, name, active, position) VALUES ($1, $2, $3, $4) RETURNING id';
    const sectionResult = await client.query(insertSectionQuery, [menuId, section.name, section.active !== false, position]);
    const sectionId = sectionResult.rows[0].id;

    if (section.items && Array.isArray(section.items)) {
        for (const [index, item] of section.items.entries()) {
            if (item && typeof item === 'object' && item.name) {
                await createItem(client, sectionId, item, item.position ?? index);
            }
        }
    }
};

// Create Item (takes PG client for transaction)
const createItem = async (client, sectionId, item, position) => {
    if (!item || !item.name) {
        console.warn('Invalid item data passed to createItem');
        return;
    }
    const insertItemQuery = 'INSERT INTO items (section_id, name, description, price, active, position) VALUES ($1, $2, $3, $4, $5, $6)';
    await client.query(insertItemQuery, [sectionId, item.name, item.description ?? '', item.price ?? '', item.active !== false, position]);
};

// Create Spacer (takes PG client for transaction)
const createSpacer = async (client, menuId, spacer, position) => {
    if (!spacer) {
        console.warn('Invalid spacer data passed to createSpacer');
        return;
    }
    const insertSpacerQuery = 'INSERT INTO spacers (menu_id, size, unit, position) VALUES ($1, $2, $3, $4)';
    await client.query(insertSpacerQuery, [menuId, spacer.size ?? '30', spacer.unit ?? 'px', position]);
};

// Update Menu (includes orgId check)
const updateMenu = async (name, orgId, userId, updates) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Verify ownership by ORG ID
        const checkResult = await client.query('SELECT id FROM menus WHERE name = $1 AND organization_id = $2', [name, orgId]);
        if (checkResult.rows.length === 0) {
            throw new Error('Menu not found or user not authorized.');
        }
        const menuId = checkResult.rows[0].id;

        // Update basic menu fields
        const setClauses = [];
        const params = [];
        let paramIndex = 1;
        const fieldMapping = { title: 'title', subtitle: 'subtitle', font: 'font', layout: 'layout', showDollarSign: 'show_dollar_sign', showDecimals: 'show_decimals', showSectionDividers: 'show_section_dividers', logoPath: 'logo_path', logoPosition: 'logo_position', logoSize: 'logo_size', logoOffset: 'logo_offset', backgroundColor: 'background_color', textColor: 'text_color', accentColor: 'accent_color' };

        for (const key in updates) {
            if (key === 'elements') continue;
            const dbColumn = fieldMapping[key];
            if (!dbColumn) { console.warn(`updateMenu: Skipping unknown field ${key}`); continue; }
            let value = updates[key];
            if (key === 'logoSize') value = String(value ?? '');
            if (key === 'logoOffset') value = String(value ?? '0');
            if (value !== undefined) { setClauses.push(`${dbColumn} = $${paramIndex++}`); params.push(value); }
        }

        // Update user_id to reflect last editor
        if (!updates.user_id) { // Only add if not explicitly provided in updates
             updates.user_id = userId; // Add last editor implicitly
        }

        if (setClauses.length > 0) {
            setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
            params.push(menuId); // For WHERE id = $N
            const updateSql = `UPDATE menus SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`;
            await client.query(updateSql, params);
        }

        // Update elements if provided
        if (updates.elements && Array.isArray(updates.elements)) {
            // Delete old elements first (within transaction)
            await client.query('DELETE FROM items WHERE section_id IN (SELECT id FROM sections WHERE menu_id = $1)', [menuId]);
            await client.query('DELETE FROM sections WHERE menu_id = $1', [menuId]);
            await client.query('DELETE FROM spacers WHERE menu_id = $1', [menuId]);

            // Create new elements
            for (const [index, element] of updates.elements.entries()) {
                const position = element.position ?? index;
                if (element.type === 'spacer') {
                    await createSpacer(client, menuId, element, position);
                } else {
                    await createSection(client, menuId, element, position);
                }
            }
        }

        await client.query('COMMIT');
        return getMenuById(menuId); // Return updated menu

    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error in updateMenu transaction:", e);
        throw e;
    } finally {
        client.release();
    }
};

// Delete Menu (checks orgId)
const deleteMenuByNameAndOrg = async (name, orgId) => {
     const checkResult = await pool.query('SELECT id FROM menus WHERE name = $1 AND organization_id = $2', [name, orgId]);
     if (checkResult.rows.length === 0) {
         throw new Error('Menu not found or user not authorized.');
     }
     const menuId = checkResult.rows[0].id;
     const deleteResult = await pool.query('DELETE FROM menus WHERE id = $1', [menuId]);
     return deleteResult.rowCount > 0;
};

// Duplicate Menu (uses orgId)
const duplicateMenu = async (sourceName, newName, userId, orgId) => {
     const client = await pool.connect();
     try {
        await client.query('BEGIN');
        // Verify source belongs to org
        const sourceMenu = await getMenuByNameAndOrg(sourceName, orgId); 
        if (!sourceMenu) throw new Error('Source menu not found or not authorized.');
        // Check if new name exists in org
        const checkExistingQuery = 'SELECT id FROM menus WHERE name = $1 AND organization_id = $2';
        const existingResult = await client.query(checkExistingQuery, [newName, orgId]);
        if (existingResult.rows.length > 0) throw new Error('Duplicate name exists for org.');

        // Copy sourceMenu data
        const { id, created_at, updated_at, elements, ...sourceData } = sourceMenu;
        // Assign new name, current user as creator, and SAME org ID
        const newMenuData = { ...sourceData, name: newName, user_id: userId, organization_id: orgId }; 

        // Insert new menu row
        const columns = Object.keys(newMenuData).join(', ');
        const valuePlaceholders = Object.keys(newMenuData).map((_, i) => `$${i + 1}`).join(', ');
        const values = Object.values(newMenuData);
        const insertMenuQuery = `INSERT INTO menus (${columns}) VALUES (${valuePlaceholders}) RETURNING id`;
        const menuResult = await client.query(insertMenuQuery, values);
        const newMenuId = menuResult.rows[0].id;

        // Duplicate elements
        if (elements && Array.isArray(elements)) {
            for (const [index, element] of elements.entries()) {
                const position = element.position ?? index;
                if (element.type === 'spacer') {
                    await createSpacer(client, newMenuId, element, position);
                } else {
                    await createSection(client, newMenuId, element, position);
                }
            }
        }

        await client.query('COMMIT');
        return getMenuById(newMenuId); 
     } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error in duplicateMenu transaction:", e);
        throw e;
     } finally {
        client.release();
     }
};

// Export the pool, query helper, init function, and other DB functions
module.exports = {
    pool, 
    query: (text, params) => pool.query(text, params),
    setupDatabase, // Export the main setup function
    getAllMenus, 
    getMenusByOrgId, // Renamed
    getMenuById,
    getMenuByNameAndOrg, // Renamed
    createMenu,
    updateMenu, 
    deleteMenuByNameAndOrg, // Renamed
    duplicateMenu,
    // Add other necessary exports here if they were refactored
};