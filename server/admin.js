const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Database connection
const db = new sqlite3.Database(path.join(__dirname, 'data/menus.db'));

// Admin module configuration
const BCRYPT_SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'menu-builder-secret-key';

// Helper function to get settings
function getSetting(key) {
    return new Promise((resolve, reject) => {
        db.get('SELECT setting_value FROM site_settings WHERE setting_key = ?', [key], (err, row) => {
            if (err) return reject(err);
            resolve(row ? row.setting_value : null);
        });
    });
}

// Helper function to update settings
function updateSetting(key, value) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE site_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?',
            [value, key],
            function(err) {
                if (err) return reject(err);
                resolve(this.changes);
            }
        );
    });
}

// Admin setup - creates the first admin user
function setupAdmin(name, email, password, setupKey) {
    return new Promise((resolve, reject) => {
        // First check if any admin users exist
        db.get('SELECT COUNT(*) as count FROM users WHERE is_admin = 1', (err, row) => {
            if (err) {
                console.error('Error checking admin count:', err);
                return reject(err);
            }
            
            if (row.count > 0) {
                return reject(new Error('Admin already exists'));
            }
            
            // Verify setup key
            getSetting('setup_key')
                .then(correctKey => {
                    console.log('Setup key check:', { provided: setupKey, correct: correctKey });
                    
                    // For security in production, remove this fallback
                    // and only use the database key
                    if (setupKey !== correctKey && setupKey !== 'admin-setup-123') {
                        return reject(new Error('Invalid setup key'));
                    }
                    
                    // Create admin user
                    bcrypt.hash(password, BCRYPT_SALT_ROUNDS, (err, hash) => {
                        if (err) {
                            console.error('Password hash error:', err);
                            return reject(err);
                        }
                        
                        console.log('Creating admin user with email:', email);
                        
                        db.run(
                            'INSERT INTO users (name, email, password_hash, is_admin, created_at) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)',
                            [name || 'Admin', email, hash],
                            function(err) {
                                if (err) {
                                    console.error('Admin creation error:', err);
                                    if (err.message.includes('UNIQUE constraint failed')) {
                                        return reject(new Error('Email already exists'));
                                    }
                                    return reject(err);
                                }
                                
                                const userId = this.lastID;
                                console.log('Admin user created with ID:', userId);
                                
                                // Create JWT token
                                const token = jwt.sign(
                                    { userId: userId, email, isAdmin: true },
                                    JWT_SECRET,
                                    { expiresIn: '7d' }
                                );
                                
                                // Store session
                                const expiresAt = new Date();
                                expiresAt.setDate(expiresAt.getDate() + 7);
                                
                                db.run(
                                    'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
                                    [userId, token, expiresAt.toISOString()],
                                    (err) => {
                                        if (err) {
                                            console.error('Session creation error:', err);
                                            return reject(err);
                                        }
                                        
                                        // Update setup key to prevent reuse
                                        const newSetupKey = Math.random().toString(36).substring(2, 15) + 
                                                         Math.random().toString(36).substring(2, 15);
                                        
                                        updateSetting('setup_key', newSetupKey)
                                            .then(() => {
                                                resolve({
                                                    id: userId,
                                                    name: name || 'Admin',
                                                    email,
                                                    token,
                                                    is_admin: true
                                                });
                                            })
                                            .catch(err => {
                                                console.error('Setup key update error:', err);
                                                // Still resolve even if we can't update the setup key
                                                resolve({
                                                    id: userId,
                                                    name: name || 'Admin',
                                                    email,
                                                    token,
                                                    is_admin: true
                                                });
                                            });
                                    }
                                );
                            }
                        );
                    });
                })
                .catch(err => {
                    console.error('Setup key fetch error:', err);
                    reject(err);
                });
        });
    });
}

// Check if admin setup is needed
function checkAdminSetup() {
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM users WHERE is_admin = 1', (err, row) => {
            if (err) return reject(err);
            resolve({ needsSetup: row.count === 0 });
        });
    });
}

// Get all users with pagination
function getUsers(page = 1, limit = 20, search = '') {
    return new Promise((resolve, reject) => {
        const offset = (page - 1) * limit;
        let query = `
            SELECT id, name, email, created_at, last_login, subscription_status, subscription_end_date, is_admin
            FROM users
        `;
        
        const params = [];
        
        if (search) {
            query += ' WHERE name LIKE ? OR email LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }
        
        // Get total count
        db.get(`SELECT COUNT(*) as total FROM users ${search ? 'WHERE name LIKE ? OR email LIKE ?' : ''}`, 
            search ? [`%${search}%`, `%${search}%`] : [], 
            (err, countRow) => {
                if (err) return reject(err);
                
                const total = countRow.total;
                const totalPages = Math.ceil(total / limit);
                
                // Get users for current page
                query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
                params.push(limit, offset);
                
                db.all(query, params, (err, rows) => {
                    if (err) return reject(err);
                    
                    resolve({
                        users: rows,
                        page,
                        limit,
                        total,
                        totalPages
                    });
                });
            }
        );
    });
}

// Get a single user by ID
function getUserById(userId) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT id, name, email, created_at, last_login, subscription_status, 
                   subscription_end_date, is_admin, stripe_customer_id
             FROM users WHERE id = ?`,
            [userId],
            (err, row) => {
                if (err) return reject(err);
                if (!row) return reject(new Error('User not found'));
                
                // Get company profile if exists
                db.get(
                    'SELECT * FROM company_profiles WHERE user_id = ?',
                    [userId],
                    (err, profileRow) => {
                        if (err) return reject(err);
                        
                        resolve({
                            user: row,
                            company_profile: profileRow || null
                        });
                    }
                );
            }
        );
    });
}

// Create a new user
function createUser(userData) {
    return new Promise((resolve, reject) => {
        // Generate a random password if none provided
        const password = userData.password || Math.random().toString(36).substring(2, 15);
        
        bcrypt.hash(password, BCRYPT_SALT_ROUNDS, (err, hash) => {
            if (err) return reject(err);
            
            db.run(
                `INSERT INTO users (
                    name, email, password_hash, is_admin, subscription_status, 
                    subscription_end_date, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [
                    userData.name,
                    userData.email,
                    hash,
                    userData.is_admin ? 1 : 0,
                    userData.subscription_status || 'free',
                    userData.subscription_end_date || null
                ],
                function(err) {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint failed')) {
                            return reject(new Error('Email already exists'));
                        }
                        return reject(err);
                    }
                    
                    const userId = this.lastID;
                    
                    // If company profile data provided, create it
                    if (userData.company_name) {
                        db.run(
                            `INSERT INTO company_profiles (
                                user_id, company_name, address, phone, website, created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                            [
                                userId,
                                userData.company_name,
                                userData.address || null,
                                userData.phone || null,
                                userData.website || null
                            ],
                            (err) => {
                                if (err) return reject(err);
                                
                                getUserById(userId)
                                    .then(resolve)
                                    .catch(reject);
                            }
                        );
                    } else {
                        getUserById(userId)
                            .then(resolve)
                            .catch(reject);
                    }
                }
            );
        });
    });
}

// Update an existing user
function updateUser(userId, userData) {
    return new Promise((resolve, reject) => {
        // Check if user exists
        getUserById(userId)
            .then(existingData => {
                const updates = [];
                const params = [];
                
                if (userData.name !== undefined) {
                    updates.push('name = ?');
                    params.push(userData.name);
                }
                
                if (userData.email !== undefined) {
                    updates.push('email = ?');
                    params.push(userData.email);
                }
                
                if (userData.is_admin !== undefined) {
                    updates.push('is_admin = ?');
                    params.push(userData.is_admin ? 1 : 0);
                }
                
                if (userData.subscription_status !== undefined) {
                    updates.push('subscription_status = ?');
                    params.push(userData.subscription_status);
                }
                
                if (userData.subscription_end_date !== undefined) {
                    updates.push('subscription_end_date = ?');
                    params.push(userData.subscription_end_date);
                }
                
                if (userData.password) {
                    bcrypt.hash(userData.password, BCRYPT_SALT_ROUNDS, (err, hash) => {
                        if (err) return reject(err);
                        
                        updates.push('password_hash = ?');
                        params.push(hash);
                        
                        completeUpdate();
                    });
                } else {
                    completeUpdate();
                }
                
                function completeUpdate() {
                    if (updates.length === 0) {
                        return resolve(existingData);
                    }
                    
                    params.push(userId);
                    
                    db.run(
                        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
                        params,
                        function(err) {
                            if (err) {
                                if (err.message.includes('UNIQUE constraint failed')) {
                                    return reject(new Error('Email already exists'));
                                }
                                return reject(err);
                            }
                            
                            // Update company profile if data provided
                            if (userData.company_name !== undefined) {
                                db.get('SELECT * FROM company_profiles WHERE user_id = ?', [userId], (err, row) => {
                                    if (err) return reject(err);
                                    
                                    if (row) {
                                        // Update existing profile
                                        const profileUpdates = [];
                                        const profileParams = [];
                                        
                                        if (userData.company_name !== undefined) {
                                            profileUpdates.push('company_name = ?');
                                            profileParams.push(userData.company_name);
                                        }
                                        
                                        if (userData.address !== undefined) {
                                            profileUpdates.push('address = ?');
                                            profileParams.push(userData.address);
                                        }
                                        
                                        if (userData.phone !== undefined) {
                                            profileUpdates.push('phone = ?');
                                            profileParams.push(userData.phone);
                                        }
                                        
                                        if (userData.website !== undefined) {
                                            profileUpdates.push('website = ?');
                                            profileParams.push(userData.website);
                                        }
                                        
                                        if (profileUpdates.length > 0) {
                                            profileUpdates.push('updated_at = CURRENT_TIMESTAMP');
                                            profileParams.push(userId);
                                            
                                            db.run(
                                                `UPDATE company_profiles SET ${profileUpdates.join(', ')} WHERE user_id = ?`,
                                                profileParams,
                                                (err) => {
                                                    if (err) return reject(err);
                                                    
                                                    getUserById(userId)
                                                        .then(resolve)
                                                        .catch(reject);
                                                }
                                            );
                                        } else {
                                            getUserById(userId)
                                                .then(resolve)
                                                .catch(reject);
                                        }
                                    } else {
                                        // Create new profile
                                        db.run(
                                            `INSERT INTO company_profiles (
                                                user_id, company_name, address, phone, website, created_at, updated_at
                                            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                                            [
                                                userId,
                                                userData.company_name,
                                                userData.address || null,
                                                userData.phone || null,
                                                userData.website || null
                                            ],
                                            (err) => {
                                                if (err) return reject(err);
                                                
                                                getUserById(userId)
                                                    .then(resolve)
                                                    .catch(reject);
                                            }
                                        );
                                    }
                                });
                            } else {
                                getUserById(userId)
                                    .then(resolve)
                                    .catch(reject);
                            }
                        }
                    );
                }
            })
            .catch(reject);
    });
}

// Delete a user
function deleteUser(userId) {
    return new Promise((resolve, reject) => {
        // First check if user exists
        getUserById(userId)
            .then(userData => {
                if (userData.user.is_admin) {
                    // Count admins to prevent deleting the last admin
                    db.get('SELECT COUNT(*) as count FROM users WHERE is_admin = 1', (err, row) => {
                        if (err) return reject(err);
                        
                        if (row.count <= 1) {
                            return reject(new Error('Cannot delete the last admin user'));
                        }
                        
                        performDelete();
                    });
                } else {
                    performDelete();
                }
                
                function performDelete() {
                    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
                        if (err) return reject(err);
                        
                        resolve({ success: true, deleted: this.changes > 0 });
                    });
                }
            })
            .catch(reject);
    });
}

// Get site statistics for dashboard
function getUserStats() {
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
            if (err) return reject(err);
            
            const totalUsers = row.count;
            
            db.get('SELECT COUNT(*) as count FROM users WHERE subscription_status != "free"', (err, row) => {
                if (err) return reject(err);
                
                const proUsers = row.count;
                
                // Get new users this month
                const now = new Date();
                const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                
                db.get(
                    'SELECT COUNT(*) as count FROM users WHERE created_at >= ?',
                    [firstDayOfMonth.toISOString()],
                    (err, row) => {
                        if (err) return reject(err);
                        
                        resolve({
                            count: totalUsers,
                            proCount: proUsers,
                            newThisMonth: row.count
                        });
                    }
                );
            });
        });
    });
}

// Get menu statistics for dashboard
function getMenuStats() {
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM menus', (err, row) => {
            if (err) return reject(err);
            
            resolve({
                count: row.count
            });
        });
    });
}

// Get all subscription plans
function getPlans(includeInactive = false) {
    return new Promise((resolve, reject) => {
        let query = 'SELECT * FROM subscription_plans';
        
        if (!includeInactive) {
            query += ' WHERE is_active = 1';
        }
        
        query += ' ORDER BY price_monthly ASC';
        
        db.all(query, (err, rows) => {
            if (err) return reject(err);
            
            // Parse features JSON
            rows.forEach(plan => {
                try {
                    plan.features = JSON.parse(plan.features || '[]');
                } catch (e) {
                    plan.features = [];
                }
            });
            
            resolve(rows);
        });
    });
}

// Get a single plan by ID
function getPlanById(planId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM subscription_plans WHERE id = ?', [planId], (err, row) => {
            if (err) return reject(err);
            if (!row) return reject(new Error('Plan not found'));
            
            // Parse features JSON
            try {
                row.features = JSON.parse(row.features || '[]');
            } catch (e) {
                row.features = [];
            }
            
            resolve(row);
        });
    });
}

// Create a subscription plan
function createPlan(planData) {
    return new Promise((resolve, reject) => {
        // Serialize features to JSON
        const features = JSON.stringify(planData.features || []);
        
        db.run(
            `INSERT INTO subscription_plans (
                name, display_name, price_monthly, price_yearly, features, is_active,
                created_at, modified_at
            ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
                planData.name,
                planData.display_name,
                planData.price_monthly || 0,
                planData.price_yearly || 0,
                features,
                planData.is_active ? 1 : 0
            ],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return reject(new Error('Plan name already exists'));
                    }
                    return reject(err);
                }
                
                getPlanById(this.lastID)
                    .then(resolve)
                    .catch(reject);
            }
        );
    });
}

// Update a subscription plan
function updatePlan(planId, planData) {
    return new Promise((resolve, reject) => {
        // Check if plan exists
        getPlanById(planId)
            .then(() => {
                const updates = [];
                const params = [];
                
                if (planData.name !== undefined) {
                    updates.push('name = ?');
                    params.push(planData.name);
                }
                
                if (planData.display_name !== undefined) {
                    updates.push('display_name = ?');
                    params.push(planData.display_name);
                }
                
                if (planData.price_monthly !== undefined) {
                    updates.push('price_monthly = ?');
                    params.push(planData.price_monthly);
                }
                
                if (planData.price_yearly !== undefined) {
                    updates.push('price_yearly = ?');
                    params.push(planData.price_yearly);
                }
                
                if (planData.is_active !== undefined) {
                    updates.push('is_active = ?');
                    params.push(planData.is_active ? 1 : 0);
                }
                
                if (planData.features !== undefined) {
                    updates.push('features = ?');
                    params.push(JSON.stringify(planData.features));
                }
                
                if (updates.length === 0) {
                    return getPlanById(planId).then(resolve).catch(reject);
                }
                
                updates.push('modified_at = CURRENT_TIMESTAMP');
                params.push(planId);
                
                db.run(
                    `UPDATE subscription_plans SET ${updates.join(', ')} WHERE id = ?`,
                    params,
                    function(err) {
                        if (err) {
                            if (err.message.includes('UNIQUE constraint failed')) {
                                return reject(new Error('Plan name already exists'));
                            }
                            return reject(err);
                        }
                        
                        getPlanById(planId)
                            .then(resolve)
                            .catch(reject);
                    }
                );
            })
            .catch(reject);
    });
}

// Delete a subscription plan
function deletePlan(planId) {
    return new Promise((resolve, reject) => {
        // First check if plan exists
        getPlanById(planId)
            .then(plan => {
                // Check if any users are using this plan
                db.get(
                    'SELECT COUNT(*) as count FROM users WHERE subscription_status = ?',
                    [plan.name],
                    (err, row) => {
                        if (err) return reject(err);
                        
                        if (row.count > 0) {
                            return reject(new Error(`Cannot delete plan that has ${row.count} active users`));
                        }
                        
                        db.run('DELETE FROM subscription_plans WHERE id = ?', [planId], function(err) {
                            if (err) return reject(err);
                            
                            resolve({ success: true, deleted: this.changes > 0 });
                        });
                    }
                );
            })
            .catch(reject);
    });
}

// Get all site settings
function getAllSettings() {
    return new Promise((resolve, reject) => {
        db.all('SELECT setting_key, setting_value, setting_group FROM site_settings', (err, rows) => {
            if (err) return reject(err);
            
            // Convert to object keyed by setting_key
            const settings = {};
            rows.forEach(row => {
                settings[row.setting_key] = row.setting_value;
            });
            
            resolve(settings);
        });
    });
}

// Update multiple settings at once
function updateSettings(settingsData) {
    return new Promise((resolve, reject) => {
        // Create array of promises to update each setting
        const promises = Object.keys(settingsData).map(key => {
            return updateSetting(key, settingsData[key]);
        });
        
        Promise.all(promises)
            .then(() => getAllSettings())
            .then(resolve)
            .catch(reject);
    });
}

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
    updateSettings
}; 