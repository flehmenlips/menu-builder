const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Initialize database
const db = new sqlite3.Database(path.join(__dirname, '../data/menus.db'));

// JWT secret for signing tokens
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret'; // In production, use environment variable

// Salt rounds for bcrypt
const SALT_ROUNDS = 10;

// Token expiration (24 hours)
const TOKEN_EXPIRATION = '24h';

// Register a new user
const registerUser = async (email, password) => {
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
                const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
                
                // Insert new user
                db.run(
                    'INSERT INTO users (email, password_hash) VALUES (?, ?)',
                    [email, passwordHash],
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
                    'INSERT INTO sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)',
                    [user.id, sessionToken, expiresAt.toISOString()],
                    (err) => {
                        if (err) {
                            return reject(err);
                        }
                        
                        resolve({
                            userId: user.id,
                            email: user.email,
                            token,
                            sessionToken,
                            expiresAt: expiresAt.toISOString()
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
        db.get('SELECT id, email, created_at, last_login FROM users WHERE id = ?', [userId], (err, user) => {
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

// Verify session token
const verifySession = (sessionToken) => {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT * FROM sessions WHERE session_token = ? AND expires_at > CURRENT_TIMESTAMP',
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

// Log out user (invalidate session)
const logoutUser = (sessionToken) => {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM sessions WHERE session_token = ?', [sessionToken], function(err) {
            if (err) {
                return reject(err);
            }
            
            resolve({ success: true });
        });
    });
};

module.exports = {
    registerUser,
    loginUser,
    getUserById,
    getCompanyProfile,
    updateCompanyProfile,
    verifyToken,
    verifySession,
    logoutUser
}; 