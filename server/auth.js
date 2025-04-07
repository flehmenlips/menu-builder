const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Set up database connection
const db = new sqlite3.Database(path.join(__dirname, 'data/menus.db'));

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'menu-builder-secret-key';
const BCRYPT_SALT_ROUNDS = 10;
const TOKEN_EXPIRATION = '24h';

// Register a new user
const registerUser = async (name, email, password) => {
    return new Promise(async (resolve, reject) => {
        try {
            // Check if user already exists
            db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
                if (err) {
                    return reject(err);
                }
                
                if (user) {
                    return reject(new Error('User already exists'));
                }
                
                // Hash password
                const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
                
                // Insert new user
                db.run(
                    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
                    [name, email, passwordHash],
                    function(err) {
                        if (err) {
                            return reject(err);
                        }
                        
                        const userId = this.lastID;
                        
                        // Create empty company profile
                        db.run(
                            'INSERT INTO company_profiles (user_id) VALUES (?)',
                            [userId],
                            function(err) {
                                if (err) {
                                    return reject(err);
                                }
                                
                                resolve({
                                    id: userId,
                                    name,
                                    email
                                });
                            }
                        );
                    }
                );
            });
        } catch (error) {
            reject(error);
        }
    });
};

// Login user
const loginUser = async (email, password) => {
    return new Promise((resolve, reject) => {
        // Find user by email
        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
            if (err) {
                return reject(err);
            }
            
            if (!user) {
                return reject(new Error('Invalid credentials'));
            }
            
            try {
                // Check password
                const passwordMatch = await bcrypt.compare(password, user.password_hash);
                
                if (!passwordMatch) {
                    return reject(new Error('Invalid credentials'));
                }
                
                // Update last login time
                db.run(
                    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                    [user.id]
                );
                
                // Generate JWT
                const token = jwt.sign(
                    { userId: user.id, email: user.email },
                    JWT_SECRET,
                    { expiresIn: TOKEN_EXPIRATION }
                );
                
                // Generate session token
                const sessionToken = crypto.randomBytes(32).toString('hex');
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 1); // 1 day from now
                
                // Store session in database
                db.run(
                    'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
                    [user.id, sessionToken, expiresAt.toISOString()],
                    (err) => {
                        if (err) {
                            return reject(err);
                        }
                        
                        // Resolve with user details and tokens
                        resolve({
                            userId: user.id,
                            name: user.name,
                            email: user.email,
                            is_admin: user.is_admin === 1,
                            token,
                            sessionToken
                        });
                    }
                );
            } catch (error) {
                reject(error);
            }
        });
    });
};

// Get user by ID
const getUserById = (userId) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT id, email, is_admin, created_at, last_login FROM users WHERE id = ?', [userId], (err, user) => {
            if (err) {
                return reject(err);
            }
            
            if (!user) {
                return reject(new Error('User not found'));
            }
            
            resolve(user);
        });
    });
};

// Get company profile by user ID
const getCompanyProfile = (userId) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM company_profiles WHERE user_id = ?', [userId], (err, profile) => {
            if (err) {
                return reject(err);
            }
            
            if (!profile) {
                return reject(new Error('Company profile not found'));
            }
            
            resolve(profile);
        });
    });
};

// Update company profile
const updateCompanyProfile = (userId, profileData) => {
    return new Promise((resolve, reject) => {
        const {
            company_name,
            address,
            phone,
            email,
            website,
            logo_path,
            primary_color,
            secondary_color,
            accent_color,
            default_font
        } = profileData;
        
        db.run(
            `UPDATE company_profiles SET 
                company_name = ?, 
                address = ?, 
                phone = ?, 
                email = ?, 
                website = ?, 
                logo_path = ?, 
                primary_color = ?, 
                secondary_color = ?, 
                accent_color = ?, 
                default_font = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?`,
            [
                company_name,
                address,
                phone,
                email,
                website,
                logo_path,
                primary_color,
                secondary_color,
                accent_color,
                default_font,
                userId
            ],
            function(err) {
                if (err) {
                    return reject(err);
                }
                
                if (this.changes === 0) {
                    return reject(new Error('Company profile not found'));
                }
                
                getCompanyProfile(userId)
                    .then(resolve)
                    .catch(reject);
            }
        );
    });
};

// Verify JWT token middleware
const verifyToken = (token) => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, JWT_SECRET, (err, decoded) => {
            if (err) {
                return reject(err);
            }
            
            resolve(decoded);
        });
    });
};

// Verify if a user is an admin
const isAdmin = (userId) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT is_admin FROM users WHERE id = ?', [userId], (err, row) => {
            if (err) {
                return reject(err);
            }
            
            if (!row) {
                return reject(new Error('User not found'));
            }
            
            resolve(row.is_admin === 1);
        });
    });
};

// Verify session token
const verifySession = (sessionToken) => {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT * FROM sessions WHERE token = ? AND expires_at > CURRENT_TIMESTAMP',
            [sessionToken],
            (err, session) => {
                if (err) {
                    return reject(err);
                }
                
                if (!session) {
                    return reject(new Error('Invalid or expired session'));
                }
                
                resolve(session);
            }
        );
    });
};

// Logout user
const logoutUser = (sessionToken) => {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM sessions WHERE token = ?', [sessionToken], function(err) {
            if (err) {
                return reject(err);
            }
            
            resolve({ success: true, message: 'Logged out successfully' });
        });
    });
};

// Admin-specific functions
// Create admin user (first-time setup)
const createAdminUser = async (name, email, password) => {
    return new Promise(async (resolve, reject) => {
        try {
            // Check if admin already exists
            db.get('SELECT COUNT(*) as count FROM users WHERE is_admin = 1', [], async (err, result) => {
                if (err) {
                    return reject(err);
                }
                
                // If admin already exists, reject
                if (result.count > 0) {
                    return reject(new Error('Admin user already exists'));
                }
                
                // Hash password
                const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
                
                // Insert new admin user
                db.run(
                    'INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, 1)',
                    [name, email, passwordHash],
                    function(err) {
                        if (err) {
                            return reject(err);
                        }
                        
                        const userId = this.lastID;
                        
                        // Create empty company profile for admin
                        db.run(
                            'INSERT INTO company_profiles (user_id, company_name) VALUES (?, ?)',
                            [userId, 'Menu Builder Administration'],
                            function(err) {
                                if (err) {
                                    return reject(err);
                                }
                                
                                resolve({
                                    id: userId,
                                    name,
                                    email,
                                    is_admin: 1
                                });
                            }
                        );
                    }
                );
            });
        } catch (error) {
            reject(error);
        }
    });
};

// Get all users (admin only)
const getAllUsers = (page = 1, limit = 20, searchTerm = '') => {
    return new Promise((resolve, reject) => {
        const offset = (page - 1) * limit;
        let query = 'SELECT id, name, email, created_at, last_login, subscription_status, is_admin FROM users';
        const params = [];
        
        if (searchTerm) {
            query += ' WHERE name LIKE ? OR email LIKE ?';
            params.push(`%${searchTerm}%`, `%${searchTerm}%`);
        }
        
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        
        db.all(query, params, (err, users) => {
            if (err) {
                return reject(err);
            }
            
            // Get total count for pagination
            let countQuery = 'SELECT COUNT(*) as count FROM users';
            if (searchTerm) {
                countQuery += ' WHERE name LIKE ? OR email LIKE ?';
            }
            
            db.get(countQuery, searchTerm ? [`%${searchTerm}%`, `%${searchTerm}%`] : [], (err, result) => {
                if (err) {
                    return reject(err);
                }
                
                resolve({
                    users,
                    total: result.count,
                    page,
                    limit,
                    totalPages: Math.ceil(result.count / limit)
                });
            });
        });
    });
};

// Update user (admin only)
const updateUser = (userId, userData) => {
    return new Promise(async (resolve, reject) => {
        try {
            const { name, email, is_admin, subscription_status, subscription_end_date } = userData;
            
            // Check if user exists
            db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
                if (err) {
                    return reject(err);
                }
                
                if (!user) {
                    return reject(new Error('User not found'));
                }
                
                // Build update query dynamically based on provided fields
                const updates = [];
                const params = [];
                
                if (name !== undefined) {
                    updates.push('name = ?');
                    params.push(name);
                }
                
                if (email !== undefined) {
                    // Check if email is already taken by another user
                    if (email !== user.email) {
                        const existingUser = await new Promise((resolve) => {
                            db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId], (err, result) => {
                                resolve(result);
                            });
                        });
                        
                        if (existingUser) {
                            return reject(new Error('Email is already in use'));
                        }
                        
                        updates.push('email = ?');
                        params.push(email);
                    }
                }
                
                if (is_admin !== undefined) {
                    updates.push('is_admin = ?');
                    params.push(is_admin ? 1 : 0);
                }
                
                if (subscription_status !== undefined) {
                    updates.push('subscription_status = ?');
                    params.push(subscription_status);
                }
                
                if (subscription_end_date !== undefined) {
                    updates.push('subscription_end_date = ?');
                    params.push(subscription_end_date);
                }
                
                // If there are no updates, resolve with the current user
                if (updates.length === 0) {
                    return resolve(user);
                }
                
                // Add user ID to params
                params.push(userId);
                
                // Execute update
                db.run(
                    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
                    params,
                    function(err) {
                        if (err) {
                            return reject(err);
                        }
                        
                        // Get updated user
                        db.get('SELECT id, name, email, created_at, last_login, subscription_status, is_admin FROM users WHERE id = ?', 
                            [userId], (err, updatedUser) => {
                            if (err) {
                                return reject(err);
                            }
                            
                            resolve(updatedUser);
                        });
                    }
                );
            });
        } catch (error) {
            reject(error);
        }
    });
};

// Delete user (admin only)
const deleteUser = (userId) => {
    return new Promise((resolve, reject) => {
        // Check if user exists
        db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
            if (err) {
                return reject(err);
            }
            
            if (!user) {
                return reject(new Error('User not found'));
            }
            
            // Start a transaction
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                // Delete user's menus
                db.run('DELETE FROM menus WHERE user_id = ?', [userId], (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                    }
                    
                    // Delete user's company profile
                    db.run('DELETE FROM company_profiles WHERE user_id = ?', [userId], (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }
                        
                        // Delete user's sessions
                        db.run('DELETE FROM sessions WHERE user_id = ?', [userId], (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject(err);
                            }
                            
                            // Finally, delete the user
                            db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
                                if (err) {
                                    db.run('ROLLBACK');
                                    return reject(err);
                                }
                                
                                db.run('COMMIT');
                                resolve({ success: true, message: 'User deleted successfully' });
                            });
                        });
                    });
                });
            });
        });
    });
};

// Get site settings
const getSiteSettings = () => {
    return new Promise((resolve, reject) => {
        db.all('SELECT setting_key, setting_value FROM site_settings', [], (err, settings) => {
            if (err) {
                return reject(err);
            }
            
            // Convert to an object for easier usage
            const settingsObject = {};
            settings.forEach(setting => {
                settingsObject[setting.setting_key] = setting.setting_value;
            });
            
            resolve(settingsObject);
        });
    });
};

// Update site settings
const updateSiteSettings = (settings) => {
    return new Promise((resolve, reject) => {
        // Start a transaction
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            const promises = Object.entries(settings).map(([key, value]) => {
                return new Promise((resolve, reject) => {
                    db.run(
                        'UPDATE site_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?',
                        [value, key],
                        function(err) {
                            if (err) {
                                return reject(err);
                            }
                            
                            // If setting doesn't exist, insert it
                            if (this.changes === 0) {
                                db.run(
                                    'INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)',
                                    [key, value],
                                    (err) => {
                                        if (err) {
                                            return reject(err);
                                        }
                                        
                                        resolve();
                                    }
                                );
                            } else {
                                resolve();
                            }
                        }
                    );
                });
            });
            
            Promise.all(promises)
                .then(() => {
                    db.run('COMMIT');
                    getSiteSettings()
                        .then(resolve)
                        .catch(reject);
                })
                .catch(err => {
                    db.run('ROLLBACK');
                    reject(err);
                });
        });
    });
};

// Get subscription plans
const getSubscriptionPlans = (activeOnly = true) => {
    return new Promise((resolve, reject) => {
        const query = activeOnly 
            ? 'SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY price_monthly ASC' 
            : 'SELECT * FROM subscription_plans ORDER BY price_monthly ASC';
        
        db.all(query, [], (err, plans) => {
            if (err) {
                return reject(err);
            }
            
            // Parse JSON features
            plans.forEach(plan => {
                try {
                    plan.features = JSON.parse(plan.features);
                } catch (e) {
                    plan.features = [];
                }
            });
            
            resolve(plans);
        });
    });
};

// Update subscription plan
const updateSubscriptionPlan = (planId, planData) => {
    return new Promise((resolve, reject) => {
        const { name, display_name, price_monthly, price_yearly, features, is_active } = planData;
        
        // Check if plan exists
        db.get('SELECT * FROM subscription_plans WHERE id = ?', [planId], (err, plan) => {
            if (err) {
                return reject(err);
            }
            
            if (!plan) {
                return reject(new Error('Subscription plan not found'));
            }
            
            // Serialize features array to JSON
            const featuresJson = typeof features === 'string' ? features : JSON.stringify(features);
            
            // Update the plan
            db.run(
                `UPDATE subscription_plans SET 
                    name = ?, 
                    display_name = ?, 
                    price_monthly = ?, 
                    price_yearly = ?, 
                    features = ?, 
                    is_active = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?`,
                [name || plan.name, 
                 display_name || plan.display_name, 
                 price_monthly !== undefined ? price_monthly : plan.price_monthly, 
                 price_yearly !== undefined ? price_yearly : plan.price_yearly, 
                 featuresJson, 
                 is_active !== undefined ? (is_active ? 1 : 0) : plan.is_active,
                 planId],
                function(err) {
                    if (err) {
                        return reject(err);
                    }
                    
                    // Get updated plan
                    db.get('SELECT * FROM subscription_plans WHERE id = ?', [planId], (err, updatedPlan) => {
                        if (err) {
                            return reject(err);
                        }
                        
                        // Parse features
                        try {
                            updatedPlan.features = JSON.parse(updatedPlan.features);
                        } catch (e) {
                            updatedPlan.features = [];
                        }
                        
                        resolve(updatedPlan);
                    });
                }
            );
        });
    });
};

// Create subscription plan
const createSubscriptionPlan = (planData) => {
    return new Promise((resolve, reject) => {
        const { name, display_name, price_monthly, price_yearly, features, is_active } = planData;
        
        // Check if plan name already exists
        db.get('SELECT id FROM subscription_plans WHERE name = ?', [name], (err, existingPlan) => {
            if (err) {
                return reject(err);
            }
            
            if (existingPlan) {
                return reject(new Error('A plan with this name already exists'));
            }
            
            // Serialize features array to JSON
            const featuresJson = typeof features === 'string' ? features : JSON.stringify(features);
            
            // Insert new plan
            db.run(
                `INSERT INTO subscription_plans 
                    (name, display_name, price_monthly, price_yearly, features, is_active) 
                VALUES (?, ?, ?, ?, ?, ?)`,
                [name, display_name, price_monthly, price_yearly, featuresJson, is_active ? 1 : 0],
                function(err) {
                    if (err) {
                        return reject(err);
                    }
                    
                    const planId = this.lastID;
                    
                    // Get the created plan
                    db.get('SELECT * FROM subscription_plans WHERE id = ?', [planId], (err, newPlan) => {
                        if (err) {
                            return reject(err);
                        }
                        
                        // Parse features
                        try {
                            newPlan.features = JSON.parse(newPlan.features);
                        } catch (e) {
                            newPlan.features = [];
                        }
                        
                        resolve(newPlan);
                    });
                }
            );
        });
    });
};

// Delete subscription plan
const deleteSubscriptionPlan = (planId) => {
    return new Promise((resolve, reject) => {
        // Check if plan exists
        db.get('SELECT * FROM subscription_plans WHERE id = ?', [planId], (err, plan) => {
            if (err) {
                return reject(err);
            }
            
            if (!plan) {
                return reject(new Error('Subscription plan not found'));
            }
            
            // Check if any users are using this plan
            db.get('SELECT COUNT(*) as count FROM users WHERE subscription_status = ?', [plan.name], (err, result) => {
                if (err) {
                    return reject(err);
                }
                
                if (result.count > 0) {
                    return reject(new Error(`Cannot delete plan: ${result.count} users are currently subscribed to this plan`));
                }
                
                // Delete the plan
                db.run('DELETE FROM subscription_plans WHERE id = ?', [planId], function(err) {
                    if (err) {
                        return reject(err);
                    }
                    
                    resolve({ success: true, message: 'Subscription plan deleted successfully' });
                });
            });
        });
    });
};

// Export admin-specific functions
module.exports = {
    registerUser,
    loginUser,
    getUserById,
    getCompanyProfile,
    updateCompanyProfile,
    verifyToken,
    verifySession,
    logoutUser,
    // Admin functions
    isAdmin,
    createAdminUser,
    getAllUsers,
    updateUser,
    deleteUser,
    getSiteSettings,
    updateSiteSettings,
    getSubscriptionPlans,
    updateSubscriptionPlan,
    createSubscriptionPlan,
    deleteSubscriptionPlan
}; 