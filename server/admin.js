const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Use the shared pool from database.js instead
const { pool, query } = require('./database');

// Admin module configuration
const BCRYPT_SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'menu-builder-secret-key';

// Helper function to get settings - REWRITE FOR POSTGRES
async function getSetting(key) {
    try {
        const result = await query('SELECT setting_value FROM site_settings WHERE setting_key = $1', [key]);
        return result.rows.length > 0 ? result.rows[0].setting_value : null;
    } catch (err) {
        console.error(`Error getting setting '${key}':`, err);
        throw err;
    }
}

// Helper function to update settings - REWRITE FOR POSTGRES
async function updateSetting(key, value) {
    try {
        const result = await query(
            'UPDATE site_settings SET setting_value = $1, updated_at = CURRENT_TIMESTAMP WHERE setting_key = $2',
            [value, key]
        );
        return result.rowCount; // Number of rows affected
    } catch (err) {
        console.error(`Error updating setting '${key}':`, err);
        throw err;
    }
}

// Admin setup - creates the first admin user - REWRITE FOR POSTGRES
async function setupAdmin(name, email, password, setupKey) {
    let client; // Declare client outside try/catch/finally
    try {
        // First check if any admin users exist
        const adminCheckResult = await query('SELECT COUNT(*) as count FROM users WHERE is_admin = true');
        if (adminCheckResult.rows[0].count > 0) {
            throw new Error('Admin already exists');
        }

        // Verify setup key (Assuming site_settings table exists)
        const correctKey = await getSetting('setup_key');
        console.log('Setup key check:', { provided: setupKey, correct: correctKey });
        if (setupKey !== correctKey && setupKey !== 'admin-setup-123') { // Keep fallback for initial setup?
            throw new Error('Invalid setup key');
        }

        // Create admin user within a transaction
        client = await pool.connect();
        await client.query('BEGIN');

        const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
        console.log('Creating admin user with email:', email);

        // Insert User
        const insertUserQuery = `
            INSERT INTO users (name, email, password_hash, is_admin, role, created_at) 
            VALUES ($1, $2, $3, true, 'SUPER_ADMIN', CURRENT_TIMESTAMP)
            RETURNING id, organization_id; -- Assuming organization setup happens elsewhere or needs admin org
        `;
        const userResult = await client.query(insertUserQuery, [name || 'Admin', email, hash]);
        const userId = userResult.rows[0].id;
        // Note: organization_id might be NULL initially if not handled here
        console.log('Admin user created with ID:', userId);

        // Create JWT token
        const token = jwt.sign(
            { userId: userId, email, isAdmin: true, role: 'SUPER_ADMIN' }, // Include role
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Store session
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        await client.query(
            'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [userId, token, expiresAt.toISOString()]
        );

        // Update setup key to prevent reuse
        const newSetupKey = Math.random().toString(36).substring(2, 15) +
                         Math.random().toString(36).substring(2, 15);
        await updateSetting('setup_key', newSetupKey); // Use the async helper

        await client.query('COMMIT');

        return {
            id: userId,
            name: name || 'Admin',
            email,
            token,
            is_admin: true,
            role: 'SUPER_ADMIN'
        };

    } catch (err) {
        console.error('Admin setup error:', err);
        if (client) await client.query('ROLLBACK'); // Rollback if transaction started
        if (err.message?.includes('duplicate key value violates unique constraint "users_email_key"')) {
             throw new Error('Email already exists');
        }
        throw err; // Re-throw other errors
    } finally {
        if (client) client.release();
    }
}

// Check if admin setup is needed - REWRITE FOR POSTGRES
async function checkAdminSetup() {
    try {
        const result = await query('SELECT COUNT(*) as count FROM users WHERE is_admin = true');
        return { needsSetup: result.rows[0].count === 0 };
    } catch (err) {
        console.error('Error checking admin setup:', err);
        throw err;
    }
}

// Get all users with pagination - REWRITE FOR POSTGRES
async function getUsers(page = 1, limit = 20, search = '') {
    try {
        const offset = (page - 1) * limit;
        let countQuery = 'SELECT COUNT(*) as total FROM users';
        let dataQuery = `
            SELECT id, name, email, created_at, last_login, subscription_status, 
                   subscription_end_date, is_admin, role, organization_id
            FROM users
        `;
        const params = [];
        let paramIndex = 1;

        if (search) {
            const searchCondition = ` WHERE name ILIKE $${paramIndex} OR email ILIKE $${paramIndex + 1}`;
            countQuery += searchCondition;
            dataQuery += searchCondition;
            params.push(`%${search}%`, `%${search}%`);
            paramIndex += 2;
        }

        // Get total count
        const countResult = await query(countQuery, params);
        const total = parseInt(countResult.rows[0].total, 10);
        const totalPages = Math.ceil(total / limit);

        // Get users for current page
        dataQuery += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);
        const usersResult = await query(dataQuery, params);

        return {
            users: usersResult.rows,
            page,
            limit,
            total,
            totalPages
        };
    } catch (err) {
        console.error('Error getting users:', err);
        throw err;
    }
}

// Get a single user by ID - REWRITE FOR POSTGRES (Assuming Profile Fetch is Separate)
async function getUserById(userId) {
    try {
        const userResult = await query(
            `SELECT id, name, email, created_at, last_login, subscription_status, 
                   subscription_end_date, is_admin, role, organization_id
             FROM users WHERE id = $1`,
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            throw new Error('User not found');
        }
        
        // Let profile fetching be handled separately if needed by the caller
        // const profileResult = await query('SELECT * FROM company_profiles WHERE user_id = $1', [userId]);
        
        return { 
            user: userResult.rows[0],
            // company_profile: profileResult.rows.length > 0 ? profileResult.rows[0] : null
        };
    } catch (err) {
        console.error(`Error getting user by ID ${userId}:`, err);
        throw err;
    }
}

// Create a new user - REWRITE FOR POSTGRES
async function createUser(userData) {
    let client;
    try {
        const password = userData.password || Math.random().toString(36).substring(2, 15);
        const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
        
        // Need organization_id. Let's assume it's passed or create a new org?
        // For now, assume it's passed in userData.organization_id
        if (!userData.organization_id) {
            // Maybe create a default org? Requires more complex logic.
            throw new Error('Organization ID is required to create a user.');
        }

        client = await pool.connect();
        await client.query('BEGIN');

        const insertUserQuery = `
            INSERT INTO users (
                name, email, password_hash, is_admin, role, subscription_status, 
                subscription_end_date, organization_id, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
            RETURNING id;
        `;
        const userParams = [
            userData.name,
            userData.email,
            hash,
            userData.is_admin === true, // Ensure boolean
            userData.role || 'USER', // Default to USER
            userData.subscription_status || 'free',
            userData.subscription_end_date || null,
            userData.organization_id
        ];
        const userResult = await client.query(insertUserQuery, userParams);
        const userId = userResult.rows[0].id;

        // If company profile data provided, create it
        if (userData.company_name) {
            const insertProfileQuery = `
                INSERT INTO company_profiles (
                    user_id, company_name, address, phone, email, website, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `;
            const profileParams = [
                userId,
                userData.company_name,
                userData.address || null,
                userData.phone || null,
                userData.company_email || userData.email, // Use company email or user email
                userData.website || null
            ];
            await client.query(insertProfileQuery, profileParams);
        }

        await client.query('COMMIT');

        // Fetch and return the newly created user
        const newUser = await getUserById(userId);
        return newUser.user; // Return just the user object

    } catch (err) {
        console.error('Error creating user:', err);
        if (client) await client.query('ROLLBACK');
         if (err.message?.includes('duplicate key value violates unique constraint "users_email_key"')) {
             throw new Error('Email already exists');
        }
        throw err;
    } finally {
        if (client) client.release();
    }
}

// Update an existing user - REWRITE FOR POSTGRES
async function updateUser(userId, userData) {
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const setClauses = [];
        const params = [userId]; // Start params with userId for WHERE clause
        let paramIndex = 2; // Start parameter index after userId

        // --- Update User Table --- 
        const userUpdates = {};
        if (userData.name !== undefined) userUpdates.name = userData.name;
        if (userData.email !== undefined) userUpdates.email = userData.email;
        if (userData.is_admin !== undefined) userUpdates.is_admin = userData.is_admin === true;
        if (userData.role !== undefined) userUpdates.role = userData.role;
        if (userData.subscription_status !== undefined) userUpdates.subscription_status = userData.subscription_status;
        if (userData.subscription_end_date !== undefined) userUpdates.subscription_end_date = userData.subscription_end_date;

        // Handle password separately
        if (userData.password) {
            userUpdates.password_hash = await bcrypt.hash(userData.password, BCRYPT_SALT_ROUNDS);
        }

        for (const [key, value] of Object.entries(userUpdates)) {
            setClauses.push(`${key} = $${paramIndex++}`);
            params.push(value);
        }

        if (setClauses.length > 0) {
            const updateUserSql = `UPDATE users SET ${setClauses.join(', ')} WHERE id = $1`;
            await client.query(updateUserSql, params);
        }

        // --- Update Company Profile Table --- 
        const profileUpdates = {};
        if (userData.company_name !== undefined) profileUpdates.company_name = userData.company_name;
        if (userData.address !== undefined) profileUpdates.address = userData.address;
        if (userData.phone !== undefined) profileUpdates.phone = userData.phone;
        // Use company_email if provided, otherwise don't update profile email field
        if (userData.company_email !== undefined) profileUpdates.email = userData.company_email;
        if (userData.website !== undefined) profileUpdates.website = userData.website;
        // Logo/Colors might be handled separately
        if (userData.logo_path !== undefined) profileUpdates.logo_path = userData.logo_path;
        if (userData.primary_color !== undefined) profileUpdates.primary_color = userData.primary_color;
        if (userData.secondary_color !== undefined) profileUpdates.secondary_color = userData.secondary_color;
        if (userData.accent_color !== undefined) profileUpdates.accent_color = userData.accent_color;
        if (userData.default_font !== undefined) profileUpdates.default_font = userData.default_font;

        if (Object.keys(profileUpdates).length > 0) {
            // Use INSERT ... ON CONFLICT (user_id) DO UPDATE to handle creation/update
            const profileColumns = Object.keys(profileUpdates).join(', ');
            const profileValues = Object.values(profileUpdates);
            const valuePlaceholders = profileValues.map((_, i) => `$${i + 2}`).join(', '); // $1 is user_id
            const updateSet = Object.keys(profileUpdates).map(k => `${k} = EXCLUDED.${k}`).join(', ');

            const upsertProfileSql = `
                INSERT INTO company_profiles (user_id, ${profileColumns}, updated_at) 
                VALUES ($1, ${valuePlaceholders}, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id) 
                DO UPDATE SET ${updateSet}, updated_at = CURRENT_TIMESTAMP;
            `;
            await client.query(upsertProfileSql, [userId, ...profileValues]);
        }

        await client.query('COMMIT');

        // Fetch and return updated user data
        const updatedUser = await getUserById(userId);
        return updatedUser.user; // Return user object

    } catch (err) {
        console.error(`Error updating user ${userId}:`, err);
        if (client) await client.query('ROLLBACK');
        if (err.message?.includes('duplicate key value violates unique constraint "users_email_key"')) {
             throw new Error('Email already exists');
        }
        throw err;
    } finally {
        if (client) client.release();
    }
}

// Delete a user - REWRITE FOR POSTGRES
async function deleteUser(userId) {
    // Note: company_profiles and sessions have ON DELETE CASCADE
    // Menus have ON DELETE SET NULL for user_id
    try {
        const result = await query('DELETE FROM users WHERE id = $1', [userId]);
        if (result.rowCount === 0) {
            throw new Error('User not found for deletion');
        }
        console.log(`User ${userId} deleted successfully.`);
        return { message: 'User deleted successfully' };
    } catch (err) {
        console.error(`Error deleting user ${userId}:`, err);
        throw err;
    }
}

// Get user stats - REWRITE FOR POSTGRES
async function getUserStats() {
    try {
        const totalResult = await query('SELECT COUNT(*) as count FROM users');
        const proResult = await query("SELECT COUNT(*) as count FROM users WHERE subscription_status <> 'free' AND subscription_status <> '' AND subscription_status IS NOT NULL");
        const newThisMonthResult = await query("SELECT COUNT(*) as count FROM users WHERE created_at >= date_trunc('month', CURRENT_DATE)");
        
        return {
            count: parseInt(totalResult.rows[0].count, 10),
            proCount: parseInt(proResult.rows[0].count, 10),
            newThisMonth: parseInt(newThisMonthResult.rows[0].count, 10)
        };
    } catch (err) {
        console.error('Error getting user stats:', err);
        throw err;
    }
}

// Get menu stats - REWRITE FOR POSTGRES
async function getMenuStats() {
    try {
        // Needs refinement - total menus across all orgs? 
        const totalResult = await query('SELECT COUNT(*) as count FROM menus');
        return {
            count: parseInt(totalResult.rows[0].count, 10)
        };
    } catch (err) {
        console.error('Error getting menu stats:', err);
        throw err;
    }
}

// Get plans - REWRITE FOR POSTGRES (assuming plans table exists)
async function getPlans(includeInactive = false) {
    try {
        let sql = 'SELECT * FROM subscription_plans';
        const params = [];
        if (!includeInactive) {
            sql += ' WHERE is_active = true';
        }
        sql += ' ORDER BY price ASC';
        const result = await query(sql, params);
        return result.rows;
    } catch (err) {
        console.error('Error getting plans:', err);
        // Consider returning empty array or re-throwing based on expected behavior
        // Check if table exists first?
        if (err.message.includes('relation "subscription_plans" does not exist')) {
             console.warn('Subscription plans table not found.');
             return []; // Return empty if table missing
        }
        throw err;
    }
}

// Get plan by ID - REWRITE FOR POSTGRES
async function getPlanById(planId) {
    try {
        const result = await query('SELECT * FROM subscription_plans WHERE id = $1', [planId]);
        if (result.rows.length === 0) {
            throw new Error('Plan not found');
        }
        return result.rows[0];
    } catch (err) {
        console.error(`Error getting plan by ID ${planId}:`, err);
         if (err.message.includes('relation "subscription_plans" does not exist')) {
             console.warn('Subscription plans table not found.');
             throw new Error('Plan feature not available.'); 
        }
        throw err;
    }
}

// Create plan - REWRITE FOR POSTGRES
async function createPlan(planData) {
    try {
        const { name, description, price, interval, features, stripe_plan_id, is_active } = planData;
        const sql = `
            INSERT INTO subscription_plans 
            (name, description, price, interval, features, stripe_plan_id, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING *
        `;
        const params = [
            name, description, price,
            interval, JSON.stringify(features || []), // Store features as JSONB
            stripe_plan_id, is_active === true
        ];
        const result = await query(sql, params);
        return result.rows[0];
    } catch (err) {
        console.error('Error creating plan:', err);
        if (err.message.includes('relation "subscription_plans" does not exist')) {
             console.warn('Subscription plans table not found.');
             throw new Error('Plan feature not available.'); 
        }
        throw err;
    }
}

// Update plan - REWRITE FOR POSTGRES
async function updatePlan(planId, planData) {
    try {
        const setClauses = [];
        const params = [planId];
        let paramIndex = 2;

        if (planData.name !== undefined) { setClauses.push(`name = $${paramIndex++}`); params.push(planData.name); }
        if (planData.description !== undefined) { setClauses.push(`description = $${paramIndex++}`); params.push(planData.description); }
        if (planData.price !== undefined) { setClauses.push(`price = $${paramIndex++}`); params.push(planData.price); }
        if (planData.interval !== undefined) { setClauses.push(`interval = $${paramIndex++}`); params.push(planData.interval); }
        if (planData.features !== undefined) { setClauses.push(`features = $${paramIndex++}`); params.push(JSON.stringify(planData.features)); }
        if (planData.stripe_plan_id !== undefined) { setClauses.push(`stripe_plan_id = $${paramIndex++}`); params.push(planData.stripe_plan_id); }
        if (planData.is_active !== undefined) { setClauses.push(`is_active = $${paramIndex++}`); params.push(planData.is_active === true); }

        if (setClauses.length === 0) {
            // No fields to update, maybe just return existing plan?
            return getPlanById(planId);
        }

        setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
        const sql = `UPDATE subscription_plans SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`;
        
        const result = await query(sql, params);
        if (result.rows.length === 0) {
             throw new Error('Plan not found for update');
        }
        return result.rows[0];

    } catch (err) {
        console.error(`Error updating plan ${planId}:`, err);
         if (err.message.includes('relation "subscription_plans" does not exist')) {
             console.warn('Subscription plans table not found.');
             throw new Error('Plan feature not available.'); 
        }
        throw err;
    }
}

// Delete plan - REWRITE FOR POSTGRES
async function deletePlan(planId) {
    try {
        // Optional: Check if any users are subscribed to this plan before deleting?
        const result = await query('DELETE FROM subscription_plans WHERE id = $1', [planId]);
        if (result.rowCount === 0) {
             throw new Error('Plan not found for deletion');
        }
        console.log(`Plan ${planId} deleted successfully.`);
        return { message: 'Plan deleted successfully' };
    } catch (err) {
        console.error(`Error deleting plan ${planId}:`, err);
        if (err.message.includes('relation "subscription_plans" does not exist')) {
             console.warn('Subscription plans table not found.');
             throw new Error('Plan feature not available.'); 
        }
        throw err;
    }
}

// Site settings - assuming these are global, not per-org
// Get all settings - REWRITE FOR POSTGRES
async function getAllSettings() {
    try {
        const result = await query('SELECT setting_key, setting_value FROM site_settings');
        const settings = {};
        result.rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });
        return settings;
    } catch (err) {
        console.error('Error getting all settings:', err);
         // Check if table exists
         if (err.message.includes('relation "site_settings" does not exist')) {
             console.warn('site_settings table not found.');
             return {}; // Return empty if table missing
         }
        throw err;
    }
}

// Update settings - REWRITE FOR POSTGRES
async function updateSettings(settingsData) {
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        for (const [key, value] of Object.entries(settingsData)) {
            // Use INSERT ... ON CONFLICT DO UPDATE (upsert)
            const sql = `
                INSERT INTO site_settings (setting_key, setting_value, updated_at) 
                VALUES ($1, $2, CURRENT_TIMESTAMP)
                ON CONFLICT (setting_key) 
                DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP;
            `;
            await client.query(sql, [key, value]);
        }

        await client.query('COMMIT');
        return getAllSettings(); // Return updated settings

    } catch (err) {
        console.error('Error updating settings:', err);
        if (client) await client.query('ROLLBACK');
        if (err.message.includes('relation "site_settings" does not exist')) {
             console.warn('site_settings table not found.');
             throw new Error('Settings feature not available.'); 
        }
        throw err;
    } finally {
        if (client) client.release();
    }
}

// Get specific public settings (NEW)
async function getPublicSettings(keys) {
    if (!Array.isArray(keys) || keys.length === 0) {
        return {};
    }
    try {
        // Use parameterized query to avoid SQL injection
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN (${placeholders})`;
        const result = await query(sql, keys);
        
        const settings = {};
        result.rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });
        // Ensure all requested keys are present, even if null
        keys.forEach(key => {
             if (!settings.hasOwnProperty(key)) {
                 settings[key] = null; // Or a default value
             }
        });
        return settings;
    } catch (err) {
        console.error('Error getting public settings:', err);
        // Check if table exists
        if (err.message.includes('relation "site_settings" does not exist')) {
            console.warn('site_settings table not found.');
             const nullSettings = {};
             keys.forEach(key => { nullSettings[key] = null; });
             return nullSettings; // Return nulls if table missing
        }
        throw err;
    }
}

// Export functions
module.exports = {
    setupAdmin,
    checkAdminSetup,
    getUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    getUserStats,
    getMenuStats,
    getPlans,
    getPlanById,
    createPlan,
    updatePlan,
    deletePlan,
    getAllSettings,
    updateSettings,
    getPublicSettings,
}; 