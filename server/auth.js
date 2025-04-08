const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Import the shared database pool/query function
const { pool, query } = require('./database'); 

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'menu-builder-secret-key';
const BCRYPT_SALT_ROUNDS = 10;
const TOKEN_EXPIRATION = '24h';

// Register a new user (PG version with Org)
const registerUser = async (name, email, password) => {
    // Check if email already exists
    const checkUser = await query('SELECT email FROM users WHERE email = $1', [email]);
    if (checkUser.rows.length > 0) {
        throw new Error('User already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Create Organization
        const orgName = `${name || email.split('@')[0]}'s Organization`; // Default org name
        const insertOrgQuery = 'INSERT INTO organizations (name) VALUES ($1) RETURNING id';
        const orgResult = await client.query(insertOrgQuery, [orgName]);
        const orgId = orgResult.rows[0].id;
        console.log(`Created organization "${orgName}" with ID: ${orgId}`);

        // 2. Insert new user, linking to Org and setting role
        const userRole = 'TENANT_ADMIN'; // First user is admin of their org
        const insertUserQuery = 'INSERT INTO users (name, email, password_hash, organization_id, role) VALUES ($1, $2, $3, $4, $5) RETURNING id';
        const userResult = await client.query(insertUserQuery, [name, email, passwordHash, orgId, userRole]);
        const userId = userResult.rows[0].id;
        console.log(`User created with ID: ${userId}, OrgID: ${orgId}, Role: ${userRole}`);

        // 3. Create default company profile
        const insertProfileQuery = 'INSERT INTO company_profiles (user_id, company_name, email) VALUES ($1, $2, $3)';
        await client.query(insertProfileQuery, [userId, orgName, email]); // Use Org name for profile too
        console.log(`Created default profile for user ${userId}`);

        await client.query('COMMIT');
        return { id: userId, name, email, organization_id: orgId, role: userRole }; // Return user info including org and role

    } catch (e) {
        await client.query('ROLLBACK');
        console.error(`Failed registration transaction for user ${email}:`, e);
        if (e.code === '23505') { throw new Error('User registration failed (duplicate email).'); }
        throw new Error('User registration failed.'); 
    } finally {
        client.release();
    }
};

// Login user (PG version)
const loginUser = async (email, password) => {
    // Find user by email, including org and role
    const userQuery = 'SELECT id, name, email, password_hash, is_admin, organization_id, role FROM users WHERE email = $1';
    const userResult = await query(userQuery, [email]);
    if (userResult.rows.length === 0) {
        throw new Error('Invalid credentials');
    }
    const user = userResult.rows[0];

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
        throw new Error('Invalid credentials');
    }

    // Update last login time (fire and forget - don't wait)
    query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id])
        .catch(err => console.error(`Failed to update last_login for user ${user.id}:`, err));

    // Generate JWT (including org and role)
    const tokenPayload = {
         userId: user.id, 
         email: user.email, 
         isAdmin: user.is_admin, 
         orgId: user.organization_id, // Added orgId
         role: user.role // Added role
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });

    // Generate, store, and return session token/details
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1); // 1 day

    await query('INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)', [user.id, sessionToken, expiresAt.toISOString()]);

    // Return necessary info, including org and role
    return {
        userId: user.id,
        name: user.name,
        email: user.email,
        is_admin: user.is_admin,
        organization_id: user.organization_id, // Added
        role: user.role, // Added
        token, 
        sessionToken 
    };
};

// Get user by ID (PG version - include org and role)
const getUserById = async (userId) => {
    const sql = 'SELECT id, name, email, is_admin, organization_id, role, created_at, last_login FROM users WHERE id = $1';
    const result = await query(sql, [userId]);
    if (result.rows.length === 0) {
        throw new Error('User not found');
    }
    return result.rows[0];
};

// Get company profile by user ID (PG version)
const getCompanyProfile = async (userId) => {
    const result = await query('SELECT * FROM company_profiles WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) {
        // Instead of erroring, maybe return null or an empty object?
        // Let's return null for now, route handler can decide how to respond.
        console.warn(`No company profile found for user_id: ${userId}`);
        return null; 
        // throw new Error('Company profile not found'); // Previous behaviour
    }
    return result.rows[0];
};

// Update company profile (PG version)
const updateCompanyProfile = async (userId, profileData) => {
    console.log(`[DB updateCompanyProfile] Called for user ${userId}. Received Raw Data:`, profileData);
    
    // Destructure using the keys sent from the frontend - Exclude email
    const {
        company_name = null, 
        company_address = null, 
        company_phone = null,   
       // company_email = null,   // Excluded
        company_website = null, 
        logo_path = null,       
        primary_color = null,   
        secondary_color = null, 
        accent_color = null,    
        default_font = null     
    } = profileData;

    // Construct the query using correct DB column names - Exclude email
    const updateQuery = `
        UPDATE company_profiles SET 
            company_name = $1, 
            address = $2, 
            phone = $3, 
           -- email = $4, 
            website = $4, 
            logo_path = $5, 
            primary_color = $6, 
            secondary_color = $7, 
            accent_color = $8, 
            default_font = $9,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $10 -- Adjust parameter indices
    `;
    // Build params array - Exclude email
    const params = [
        company_name,    // $1
        company_address, // $2
        company_phone,   // $3
       // company_email,   // $4
        company_website, // $4 (index adjusted)
        logo_path,       // $5
        primary_color,   // $6
        secondary_color, // $7
        accent_color,    // $8
        default_font,    // $9
        userId           // $10
    ];
    
    console.log(`[DB updateCompanyProfile] Built Query: ${updateQuery.replace(/\s+/g, ' ').trim()}`);
    console.log(`[DB updateCompanyProfile] Built Params:`, params);

    try {
        const result = await query(updateQuery, params);
        console.log(`[DB updateCompanyProfile] Update result rowCount: ${result.rowCount}`);

        if (result.rowCount === 0) {
             // This might happen if the user_id doesn't exist, which shouldn't occur for a logged-in user
             console.error(`[DB updateCompanyProfile] Profile update for user ${userId} affected 0 rows. Profile may not exist!`);
             throw new Error('Company profile could not be updated (User ID not found?).');
        }

        console.log(`[DB updateCompanyProfile] Fetching updated profile for user ${userId}`);
        // Refetch to confirm changes
        const updatedProfile = await getCompanyProfile(userId);
        console.log(`[DB updateCompanyProfile] Returning updated profile:`, updatedProfile);
        return updatedProfile; 

    } catch (error) {
         console.error(`[DB updateCompanyProfile] Error during query execution or refetch for user ${userId}:`, error);
         // Re-throw a more specific error if possible
         throw new Error(`Failed to update profile: ${error.message}`); 
    }
};

// Verify JWT token (No DB change needed)
const verifyToken = (token) => { /* ... same logic ... */ };

// Verify if a user is an admin (PG version)
const isAdmin = async (userId) => {
    const result = await query('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
         throw new Error('User not found');
    }
    return result.rows[0].is_admin === true; // Check boolean
};

// Logout user (PG version - delete session)
const logoutUser = async (sessionToken) => {
     if (!sessionToken) return { success: true, message: 'No session token provided' }; // Handle case where cookie might be missing
    const result = await query('DELETE FROM sessions WHERE token = $1', [sessionToken]);
    return { success: result.rowCount > 0, message: result.rowCount > 0 ? 'Logged out successfully' : 'Session not found' };
};

// --- Admin functions (Refactored for PG) --- 

// Create admin user (Assumes first-time setup or specific logic)
const createAdminUser = async (name, email, password) => {
    // Check if admin already exists
    const checkAdmin = await query('SELECT COUNT(*) as count FROM users WHERE is_admin = true');
    if (checkAdmin.rows[0].count > 0) {
        throw new Error('Admin user already exists');
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Insert new admin user
        const insertUserQuery = 'INSERT INTO users (name, email, password_hash, is_admin) VALUES ($1, $2, $3, true) RETURNING id';
        const userResult = await client.query(insertUserQuery, [name, email, passwordHash]);
        const userId = userResult.rows[0].id;
        console.log(`Admin User created with ID: ${userId}`);

        // Create default company profile for admin
        const insertProfileQuery = 'INSERT INTO company_profiles (user_id, company_name, email) VALUES ($1, $2, $3)';
        // Use a distinct default name for admin profile
        await client.query(insertProfileQuery, [userId, 'Platform Administration', email]); 
        console.log(`Created default profile for admin user ${userId}`);

        await client.query('COMMIT');
        return { id: userId, name, email, is_admin: true };

    } catch (e) {
        await client.query('ROLLBACK');
        console.error(`Failed admin user creation transaction for ${email}:`, e);
        if (e.code === '23505') { 
             throw new Error('Admin creation failed (duplicate email).');
        }
        throw new Error('Admin creation failed.'); 
    } finally {
        client.release();
    }
};

// Get all users (admin only)
const getAllUsers = async (page = 1, limit = 20, searchTerm = '') => {
    const offset = (page - 1) * limit;
    let countQuery = 'SELECT COUNT(*) as count FROM users';
    let dataQuery = 'SELECT id, name, email, created_at, last_login, subscription_status, is_admin FROM users';
    const params = [];
    let placeholderIndex = 1;

    if (searchTerm) {
        const searchCondition = ` WHERE name ILIKE $${placeholderIndex} OR email ILIKE $${placeholderIndex}`; // Use ILIKE for case-insensitive
        countQuery += searchCondition;
        dataQuery += searchCondition;
        params.push(`%${searchTerm}%`);
        placeholderIndex++;
    }

    dataQuery += ` ORDER BY created_at DESC LIMIT $${placeholderIndex++} OFFSET $${placeholderIndex++}`;
    params.push(limit, offset);

    // Execute both queries
    const countResult = await query(countQuery, searchTerm ? [params[0]] : []); // Only need search term for count
    const dataResult = await query(dataQuery, params);

    const totalUsers = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalUsers / limit);

    return {
        users: dataResult.rows,
        total: totalUsers,
        page,
        limit,
        totalPages
    };
};

// Update user (admin only)
const updateUser = async (userId, userData) => {
    const { name, email, is_admin, subscription_status, subscription_end_date } = userData;

    // Check if user exists first (optional but good practice)
    const checkUser = await query('SELECT email FROM users WHERE id = $1', [userId]);
    if (checkUser.rows.length === 0) {
        throw new Error('User not found');
    }
    const currentUserEmail = checkUser.rows[0].email;

    // Check for email conflict if email is being changed
    if (email && email !== currentUserEmail) {
         const conflictCheck = await query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
         if (conflictCheck.rows.length > 0) {
             throw new Error('Email is already in use by another user');
         }
    }

    // Build update query dynamically
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name !== undefined) { updates.push(`name = $${paramIndex++}`); params.push(name); }
    if (email !== undefined) { updates.push(`email = $${paramIndex++}`); params.push(email); }
    if (is_admin !== undefined) { updates.push(`is_admin = $${paramIndex++}`); params.push(Boolean(is_admin)); } // Ensure boolean
    if (subscription_status !== undefined) { updates.push(`subscription_status = $${paramIndex++}`); params.push(subscription_status); }
    if (subscription_end_date !== undefined) { updates.push(`subscription_end_date = $${paramIndex++}`); params.push(subscription_end_date); }

    if (updates.length === 0) {
        console.warn(`updateUser called for user ${userId} with no changes.`);
        return getUserById(userId); // Return current user data if no updates
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`); // Add updated_at
    params.push(userId); // Add userId for the WHERE clause

    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, email, created_at, last_login, subscription_status, is_admin`;
    const result = await query(sql, params);

    if (result.rowCount === 0) {
         throw new Error('User update failed (user not found or no changes made)');
    }
    return result.rows[0]; // Return updated user data
};

// Delete user (admin only)
const deleteUser = async (userId) => {
    // Note: Foreign key ON DELETE CASCADE should handle related profiles, sessions, menus?
    // Verify this in your table definitions.
    const result = await query('DELETE FROM users WHERE id = $1', [userId]);
    if (result.rowCount === 0) {
        throw new Error('User not found');
    }
    return { success: true, message: 'User deleted successfully' };
};

// --- Site Settings functions NEED Refactoring for PG --- 
const getSiteSettings = async () => { /* Needs PG rewrite */ };
const updateSiteSettings = async (settings) => { /* Needs PG rewrite */ };

// --- Subscription Plan functions NEED Refactoring for PG --- 
const getSubscriptionPlans = async (activeOnly = true) => { /* Needs PG rewrite */ };
// ... etc ...

module.exports = {
    registerUser,
    loginUser,
    getUserById,
    getCompanyProfile, 
    updateCompanyProfile,
    verifyToken,
    isAdmin,
    logoutUser,
    // Export refactored admin functions
    createAdminUser,
    getAllUsers,
    updateUser,
    deleteUser,
    // --- Add other refactored functions once done ---
    // getSiteSettings,
    // updateSiteSettings,
    // getSubscriptionPlans,
}; 