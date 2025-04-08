const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const dbSetup = require('./database');
const { pool, query, setupDatabase, ...dbFunctions } = require('./database');
const auth = require('./auth');
const admin = require('./admin');
const content = require('./content');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
require('dotenv').config();

// --- DIAGNOSTIC LOGGING --- 
console.log("\n--- DEBUG: Checking imported DB components ---");
console.log(`Type of imported pool: ${typeof pool}`);
console.log(`Type of imported query function: ${typeof query}`);
console.log(`Type of imported dbFunctions: ${typeof dbFunctions}`);
console.log("--- END DEBUG ---\n");
// --- END DIAGNOSTIC LOGGING ---

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'menu-builder-secret-key';
const PORT = process.env.PORT || 4000;

const app = express();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
const logosDir = path.join(uploadsDir, 'logos'); // Define logos subdir path
const contentDir = path.join(uploadsDir, 'content'); // Define content subdir path

if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`Created uploads directory: ${uploadsDir}`);
}
if (!fs.existsSync(logosDir)){
    fs.mkdirSync(logosDir, { recursive: true });
    console.log(`Created logos subdirectory: ${logosDir}`);
}
if (!fs.existsSync(contentDir)){
    fs.mkdirSync(contentDir, { recursive: true });
     console.log(`Created content subdirectory: ${contentDir}`);
}

// Configure multer storage for LOGOS
const logoStorage = multer.diskStorage({ // Renamed from storage
    destination: function(req, file, cb) {
        cb(null, logosDir); // Save directly into logos subdir
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'logo-' + uniqueSuffix + ext); // Prefix with logo-
    }
});

const logoUpload = multer({ // Renamed from upload
    storage: logoStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function(req, file, cb) {
        // Accept images only
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|svg|ico)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

// Configure multer storage for CONTENT images
const contentImageStorage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, contentDir);
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'content-' + uniqueSuffix + ext);
    }
});

const contentImageUpload = multer({
    storage: contentImageStorage,
    fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|svg)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max
    }
});

// Authentication middleware
const authenticateUser = async (req, res, next) => {
  try {
    // Get token from Authorization header or cookies
    let token = null;
    
    if (req.headers.authorization) {
      // Format: "Bearer TOKEN"
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    try {
      // Get user from database using auth module (now includes org & role)
      const user = await auth.getUserById(decoded.userId);
      
      // Store user info in request object
      req.user = {
        id: user.id,
        email: user.email,
        is_admin: user.is_admin === true, // Check boolean
        organization_id: user.organization_id, // Added
        role: user.role // Added
      };
      console.log('authenticateUser: User authenticated:', req.user); // Log authenticated user info
      next();
    } catch (dbError) {
      console.error('Database error during authentication:', dbError);
      return res.status(401).json({ error: 'Authentication failed' });
    }
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Admin authorization middleware
const authorizeAdmin = (req, res, next) => {
  // This middleware should be used after authenticateUser
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin privileges required' });
  }
  
  next();
};

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));
// ADDED: Serve static files from public/uploads directory under /uploads path
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// --- Public Auth Routes --- 
// NEW: Endpoint for checking login status (used by main app header)
app.get('/api/auth/verify', async (req, res) => {
    console.log("GET /api/auth/verify: Request received.");
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.substring(7);
         console.log("GET /api/auth/verify: Token found in Authorization header.");
    } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
         console.log("GET /api/auth/verify: Token found in cookie.");
    } else {
         console.log("GET /api/auth/verify: No token found in header or cookie.");
    }

    if (!token) {
        console.log("GET /api/auth/verify: Responding { loggedIn: false } (no token).");
        return res.json({ loggedIn: false });
    }

    try {
        // Verify the token
        console.log("GET /api/auth/verify: Verifying token...");
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log("GET /api/auth/verify: Token decoded:", decoded);
        
        // Optionally fetch basic user details if needed by the header
        const user = await auth.getUserById(decoded.userId);
        console.log("GET /api/auth/verify: Fetched user from DB:", user);
        
        if (!user) {
             console.log("GET /api/auth/verify: User not found in DB for decoded ID. Responding { loggedIn: false }.");
             return res.json({ loggedIn: false }); // User in token doesn't exist
        }

        // Return success with minimal user info
        const responseData = {
            loggedIn: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                is_admin: user.is_admin === 1 // Include admin status if header needs it
            }
        };
        console.log("GET /api/auth/verify: Responding with success:", responseData);
        res.json(responseData);
    } catch (error) {
        // Token invalid or other error
        console.error('GET /api/auth/verify: CAUGHT ERROR:', error.message); 
        res.clearCookie('token'); // Clear potentially bad cookie
        console.log("GET /api/auth/verify: Responding { loggedIn: false } (error).");
        return res.json({ loggedIn: false });
    }
});

// --- Public Admin Routes (No Auth Required) ---

// Check if admin exists (needed before login/setup)
app.get('/api/admin/exists', async (req, res) => {
    try {
        // Use the imported query function
        const result = await query('SELECT COUNT(*) as count FROM users WHERE is_admin = true');
        const adminExists = result.rows[0].count > 0;
        console.log('Admin exists check:', adminExists, result.rows[0]);
        res.json({ exists: adminExists });
    } catch (err) {
        console.error('Error checking if admin exists:', err);
        res.status(500).json({ error: 'Server error checking admin status' });
    }
});

// Admin login Route (Needs to be public)
app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;
    
    console.log('Admin login attempt:', { email });
    
    if (!email || !password) {
        console.log('Admin login failed: Missing email or password');
        return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // First check if user exists
    try {
        // Use the imported query function
        const userResult = await query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            console.log('Admin login failed: User not found');
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const user = userResult.rows[0];
        
        console.log('User found:', { 
            id: user.id, 
            email: user.email, 
            is_admin: user.is_admin,
            has_password: !!user.password_hash,
            password_hash_length: user.password_hash ? user.password_hash.length : 0
        });
        
        // Check if user is admin
        if (user.is_admin !== 1) {
            console.log('Admin login failed: User is not an admin');
            return res.status(401).json({ error: 'User does not have admin privileges' });
        }
        
        // Check password - ensure password and hash are valid before comparing
        if (!password || !user.password_hash) {
            console.error('Invalid password or hash for comparison');
            return res.status(500).json({ error: 'Server error during login - missing data' });
        }
        
        // Compare passwords
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            console.log('Admin login failed: Password mismatch');
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        console.log('Admin login successful:', { id: user.id, email: user.email });
        
        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email, isAdmin: user.is_admin === 1 },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        // Set HTTP-only cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
        
        // Return user data and token
        return res.json({
            id: user.id,
            name: user.name, // Ensure name is included if available
            email: user.email,
            is_admin: user.is_admin === 1,
            token
        });
    } catch (err) {
        console.error('Error during admin login:', err);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Apply authentication and admin authorization to all OTHER /api/admin routes
app.use('/api/admin', authenticateUser, authorizeAdmin);

// --- Protected Admin Routes (Auth Required from middleware above) ---
// Example: Get stats (already defined later, just showing the structure)
// app.get('/api/admin/stats/users', ...) 

// Serve the landing page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Serve the menu builder application
app.get('/menu-builder', (req, res) => {
    res.redirect('/Menu_Builder-V4.html');
});

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        // Register user
        const user = await auth.registerUser(name || email.split('@')[0], email, password);
        
        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        // Set secure cookie with the token
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
        
        // Send response
        res.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            },
            token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: error.message || 'Registration failed' });
    }
});

// User login Route (Public)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        // Use the existing loginUser function from auth module
        const result = await auth.loginUser(email, password); 
        
        // Set HTTP-only cookie for JWT
        res.cookie('token', result.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000, 
            path: '/' 
        });
        
        // Return user data in the response body (using direct properties from result)
        res.json({
            message: 'Login successful',
            user: {
                id: result.userId,         
                name: result.name,     // Use result.name
                email: result.email,    // Use result.email
                is_admin: result.is_admin // Use result.is_admin
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        if (error.message === 'Invalid credentials') {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/auth/logout', async (req, res) => {
    try {
        const sessionToken = req.cookies.session;
        
        if (sessionToken) {
            await auth.logoutUser(sessionToken);
        }
        
        // Clear cookies
        res.clearCookie('token');
        res.clearCookie('session');
        
        res.json({ message: 'Logout successful' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// User Profile Routes
app.get('/api/profile', authenticateUser, async (req, res) => {
    try {
        const profile = await auth.getCompanyProfile(req.user.id);
        res.json(profile);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Error fetching company profile' });
    }
});

app.put('/api/profile', authenticateUser, async (req, res) => {
    try {
        const profile = await auth.updateCompanyProfile(req.user.id, req.body);
        res.json(profile);
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Error updating company profile' });
    }
});

// Upload company logo
app.post('/api/profile/logo', authenticateUser, logoUpload.single('logo'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ 
            success: false, 
            error: 'No file uploaded or invalid file type' 
        });
    }
    
    try {
        const logoPath = `/uploads/logos/${req.file.filename}`; 
        const userId = req.user.id;
        console.log(`POST /api/profile/logo: User ${userId} uploaded ${logoPath}`);

        // 1. Fetch current profile data
        console.log(` -> Fetching current profile for user ${userId}`);
        const currentProfile = await auth.getCompanyProfile(userId);
        if (!currentProfile) {
             // Handle case where profile doesn't exist yet, maybe create one?
             // For now, assume it exists based on registration logic.
             console.error(` -> Profile not found for user ${userId} during logo update!`);
             throw new Error('Profile not found');
        }
        console.log(` -> Current profile fetched.`);

        // 2. Create updated data object, preserving existing values
        const updatedProfileData = {
            ...currentProfile, // Spread existing data
            logo_path: logoPath // Overwrite only the logo path
        };
        // Ensure keys match what updateCompanyProfile expects (e.g., company_address)
        // We might need a mapping function if keys differ significantly

        // 3. Update the profile with the merged data
        console.log(` -> Calling updateCompanyProfile for user ${userId} with merged data`);
        const updatedProfileResult = await auth.updateCompanyProfile(userId, updatedProfileData);
        console.log(` -> updateCompanyProfile result:`, updatedProfileResult);

        // Check if the save was actually successful in the DB result
        if (!updatedProfileResult || updatedProfileResult.logo_path !== logoPath) {
             console.error('!!! Logo path failed to save/verify in DB after upload !!!');
             // Decide on appropriate response - upload worked, DB update failed
              return res.json({ 
                 success: true, // Upload itself succeeded
                 logoPath: logoPath,
                 warning: 'Logo uploaded but failed to update profile record.' 
            });
        }

        res.json({ 
            success: true, 
            logoPath: logoPath // Return the path for preview
        });

    } catch (error) {
        console.error('Error processing logo upload and updating profile:', error);
        res.status(500).json({
            success: false,
            error: 'Server error processing upload'
        });
    }
});

// Existing API Routes (now with authentication where needed)
app.get('/api/menus', authenticateUser, async (req, res) => {
    try {
        // Use orgId from authenticated user
        const menus = await dbFunctions.getMenusByOrgId(req.user.organization_id);
        res.json(menus);
    } catch (error) { 
        console.error(`Error fetching menus for org: ${req.user.organization_id}`, error);
        res.status(500).json({ error: 'Error fetching menus' }); 
    }
});

app.get('/api/menus/:name', authenticateUser, async (req, res) => {
    const menuName = req.params.name;
    const orgId = req.user.organization_id; // Use orgId
    const userId = req.user.id; // Keep userId for logging maybe
    console.log(`GET /api/menus/:name - Request for menu: "${menuName}" by user: ${userId}, org: ${orgId}`);
    try {
        const menu = await dbFunctions.getMenuByNameAndOrg(menuName, orgId); // Use org-scoped function
        console.log(` -> dbFunctions.getMenuByNameAndOrg returned: ${menu ? 'Menu found' : 'Menu NOT found'}`);
        if (!menu) {
            console.log(` <- Responding 404 Not Found`);
            return res.status(404).json({ error: 'Menu not found' });
        }
        console.log(` <- Responding 200 OK with menu data`);
        res.json(menu);
    } catch (error) {
        console.error(`*** ERROR in GET /api/menus/:name for menu "${menuName}", org ${orgId}:`, error);
        res.status(500).json({ error: 'Error fetching menu data' }); 
    }
});

app.delete('/api/menus/:name', authenticateUser, async (req, res) => {
    const menuName = req.params.name;
    const orgId = req.user.organization_id; // Use orgId
    console.log(`DELETE /api/menus/:name - Request for menu: "${menuName}", org: ${orgId}`);
    try {
        // Deletion function now checks org internally
        const deleted = await dbFunctions.deleteMenuByNameAndOrg(menuName, orgId);
        if (!deleted) { // Should throw error if not found/authorized
             return res.status(404).json({ error: 'Menu not found or not authorized' });
        }
        res.json({ message: 'Menu deleted successfully' });
    } catch (error) {
        console.error(`*** ERROR in DELETE /api/menus/:name for menu "${menuName}", org ${orgId}:`, error);
         if (error.message.includes('not found or user not authorized')) {
             return res.status(404).json({ error: 'Menu not found or not authorized' });
         }
        res.status(500).json({ error: 'Error deleting menu' });
    }
});

// Upload logo endpoint
app.post('/api/upload-logo', logoUpload.single('logo'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ 
            success: false, 
            error: 'No file uploaded or invalid file type' 
        });
    }
    
    try {
        // Return the path to the uploaded logo
        const logoPath = `/uploads/logos/${req.file.filename}`;
        console.log('Logo uploaded successfully, path:', logoPath);
        
        res.json({ 
            success: true, 
            logoPath: logoPath
        });
    } catch (error) {
        console.error('Error in logo upload:', error);
        res.status(500).json({
            success: false,
            error: 'Server error processing upload'
        });
    }
});

// Secure menu routes with authentication
app.post('/api/menus', authenticateUser, async (req, res) => {
    try {
        const userId = req.user.id; 
        const orgId = req.user.organization_id; 
        // Destructure all expected fields from req.body
        const { 
            name, title, subtitle, font, layout, 
            showDollarSign, showDecimals, showSectionDividers, elements, 
            logoPath, logoPosition, logoSize, logoOffset, 
            backgroundColor, textColor, accentColor 
        } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Menu name is required' });
        }
        
        // Check if menu already exists FOR THIS ORG
        const existingMenu = await dbFunctions.getMenuByNameAndOrg(name, orgId);
        if (existingMenu) { 
            return res.status(409).json({ error: 'Menu name already exists' }); 
        }
        
        // Call createMenu with all destructured fields and orgId/userId
        const menu = await dbFunctions.createMenu(
            name, title, subtitle, font, layout, 
            showDollarSign, showDecimals, showSectionDividers, elements, 
            logoPath, logoPosition, logoSize, logoOffset, 
            backgroundColor, textColor, accentColor, 
            userId, // Pass userId
            orgId  // Pass orgId
        );
        res.status(201).json(menu);

    } catch (error) { 
         console.error(`*** ERROR in POST /api/menus for org ${req?.user?.organization_id}:`, error); 
         res.status(500).json({ error: 'Unexpected error creating menu' }); 
     } 
});

app.put('/api/menus/:name', authenticateUser, async (req, res) => {
    try {
        const menuName = req.params.name;
        const orgId = req.user.organization_id; // Get orgId
        const userId = req.user.id; // Get userId for last editor
        const updateData = req.body;

        // Update function now checks org internally
        const updatedMenu = await dbFunctions.updateMenu(menuName, orgId, userId, updateData);
        
        res.json(updatedMenu);
    } catch (error) {
         console.error(`*** ERROR in PUT /api/menus/:name for menu "${req.params.name}", org ${req?.user?.organization_id}:`, error);
         if (error.message.includes('not found or user not authorized')) {
             return res.status(404).json({ error: 'Menu not found or not authorized' });
         }
        res.status(500).json({ error: 'Error updating menu' });
    }
});

// Duplicate a menu
app.post('/api/menus/:name/duplicate', authenticateUser, async (req, res) => {
    try {
        const sourceName = req.params.name;
        const { newName } = req.body;
        const userId = req.user.id;
        const orgId = req.user.organization_id; // Get orgId
        
        if (!newName) {
            return res.status(400).json({ error: 'New menu name is required' });
        }
        
        // Duplicate function now handles org check
        const newMenu = await dbFunctions.duplicateMenu(sourceName, newName, userId, orgId);
        res.status(201).json(newMenu);
    } catch (error) {
        console.error('Error duplicating menu:', req.params.name, 'for user:', req.user.id, error);
        res.status(500).json({ error: 'Error duplicating menu' });
    }
});

// Admin Routes
app.post('/api/admin/setup', async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;
  if (!name || !email || !password || password !== confirmPassword) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  try {
    const checkAdmin = await query('SELECT COUNT(*) as count FROM users WHERE is_admin = true');
    if (checkAdmin.rows[0].count > 0) {
      return res.status(400).json({ error: 'An admin account already exists' });
    }
    // Use the refactored auth function (assuming it handles profile creation)
    // This might need a specific admin creation function if logic differs.
    const adminUser = await auth.registerUser(name, email, password); 
    // Manually set admin flag AFTER creation if registerUser doesn't handle it
    await query('UPDATE users SET is_admin = true WHERE id = $1', [adminUser.id]);
    // Need to also log this user in / return appropriate response
    res.status(201).json({ message: 'Admin created', user: adminUser }); // Simplify response
  } catch (error) { 
    console.error('Error in admin setup:', error); 
    res.status(500).json({ error: error.message || 'Server error' }); 
  }
});

app.get('/api/admin/check', async (req, res) => {
    try {
        const result = await admin.checkAdminSetup();
        res.json(result);
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({ error: 'Failed to check admin status' });
    }
});

// Admin user management
app.get('/api/admin/users', authorizeAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        
        const users = await admin.getUsers(page, limit, search);
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.get('/api/admin/users/:userId', authorizeAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await admin.getUserById(userId);
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        
        if (error.message === 'User not found') {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

app.post('/api/admin/users', authorizeAdmin, async (req, res) => {
    try {
        const userData = req.body;
        const user = await admin.createUser(userData);
        res.status(201).json(user);
    } catch (error) {
        console.error('Error creating user:', error);
        
        if (error.message.includes('Email already exists')) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        
        res.status(500).json({ error: 'Failed to create user' });
    }
});

app.put('/api/admin/users/:userId', authorizeAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;
        const userData = req.body;
        const user = await admin.updateUser(userId, userData);
        res.json(user);
    } catch (error) {
        console.error('Error updating user:', error);
        
        if (error.message === 'User not found') {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (error.message.includes('Email already exists')) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        
        res.status(500).json({ error: 'Failed to update user' });
    }
});

app.delete('/api/admin/users/:userId', authorizeAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;
        const result = await admin.deleteUser(userId);
        res.json(result);
    } catch (error) {
        console.error('Error deleting user:', error);
        
        if (error.message === 'User not found') {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (error.message.includes('Cannot delete the last admin')) {
            return res.status(400).json({ error: 'Cannot delete the last admin user' });
        }
        
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Admin stats
app.get('/api/admin/stats/users', authorizeAdmin, async (req, res) => {
    try {
        const stats = await admin.getUserStats();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({ error: 'Failed to fetch user statistics' });
    }
});

app.get('/api/admin/stats/menus', authorizeAdmin, async (req, res) => {
    try {
        const stats = await admin.getMenuStats();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching menu stats:', error);
        res.status(500).json({ error: 'Failed to fetch menu statistics' });
    }
});

// Admin subscription plans
app.get('/api/admin/plans', authorizeAdmin, async (req, res) => {
    try {
        const includeInactive = req.query.includeInactive === 'true';
        const plans = await admin.getPlans(includeInactive);
        res.json(plans);
    } catch (error) {
        console.error('Error fetching plans:', error);
        res.status(500).json({ error: 'Failed to fetch plans' });
    }
});

app.get('/api/admin/plans/:planId', authorizeAdmin, async (req, res) => {
    try {
        const planId = req.params.planId;
        const plan = await admin.getPlanById(planId);
        res.json(plan);
    } catch (error) {
        console.error('Error fetching plan:', error);
        
        if (error.message === 'Plan not found') {
            return res.status(404).json({ error: 'Plan not found' });
        }
        
        res.status(500).json({ error: 'Failed to fetch plan' });
    }
});

app.post('/api/admin/plans', authorizeAdmin, async (req, res) => {
    try {
        const planData = req.body;
        const plan = await admin.createPlan(planData);
        res.status(201).json(plan);
    } catch (error) {
        console.error('Error creating plan:', error);
        
        if (error.message.includes('Plan name already exists')) {
            return res.status(400).json({ error: 'Plan name already exists' });
        }
        
        res.status(500).json({ error: 'Failed to create plan' });
    }
});

app.put('/api/admin/plans/:planId', authorizeAdmin, async (req, res) => {
    try {
        const planId = req.params.planId;
        const planData = req.body;
        const plan = await admin.updatePlan(planId, planData);
        res.json(plan);
    } catch (error) {
        console.error('Error updating plan:', error);
        
        if (error.message === 'Plan not found') {
            return res.status(404).json({ error: 'Plan not found' });
        }
        
        if (error.message.includes('Plan name already exists')) {
            return res.status(400).json({ error: 'Plan name already exists' });
        }
        
        res.status(500).json({ error: 'Failed to update plan' });
    }
});

app.delete('/api/admin/plans/:planId', authorizeAdmin, async (req, res) => {
    try {
        const planId = req.params.planId;
        const result = await admin.deletePlan(planId);
        res.json(result);
    } catch (error) {
        console.error('Error deleting plan:', error);
        
        if (error.message === 'Plan not found') {
            return res.status(404).json({ error: 'Plan not found' });
        }
        
        if (error.message.includes('Cannot delete plan that has')) {
            return res.status(400).json({ error: error.message });
        }
        
        res.status(500).json({ error: 'Failed to delete plan' });
    }
});

// Admin settings
app.get('/api/admin/settings', authorizeAdmin, async (req, res) => {
  try {
    const result = await query('SELECT * FROM site_settings ORDER BY setting_group, setting_key');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.put('/api/admin/settings', authorizeAdmin, async (req, res) => {
  const settings = req.body;
  const client = await pool.connect(); // Get client from pool
  try {
    await client.query('BEGIN');
    for (const [key, value] of Object.entries(settings)) {
      const updateResult = await client.query(
        'UPDATE site_settings SET setting_value = $1, updated_at = CURRENT_TIMESTAMP WHERE setting_key = $2',
        [value, key]
      );
      if (updateResult.rowCount === 0) { // Setting didn't exist, insert it
        await client.query(
          'INSERT INTO site_settings (setting_key, setting_value, setting_group) VALUES ($1, $2, $3)', // Infer group?
          [key, value, 'general'] // Assume general group for new settings
        );
      }
    }
    await client.query('COMMIT');
    // Fetch updated settings to return
    const updatedSettings = await query('SELECT * FROM site_settings ORDER BY setting_group, setting_key');
    res.json(updatedSettings.rows);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  } finally {
    client.release();
  }
});

// Logo/Favicon routes (Refactored for PG)
app.post('/api/admin/settings/logo', authorizeAdmin, logoUpload.single('logo'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const logoPath = `/uploads/${req.file.filename}`;
    try {
         // Use UPSERT logic for PG
         await query(`
             INSERT INTO site_settings (setting_key, setting_value, setting_group) 
             VALUES ('logo_path', $1, 'appearance')
             ON CONFLICT (setting_key) DO UPDATE SET 
               setting_value = EXCLUDED.setting_value,
               updated_at = CURRENT_TIMESTAMP
         `, [logoPath]);
        res.json({ success: true, logoPath });
    } catch (error) {
        console.error('Error updating logo path:', error);
        res.status(500).json({ error: 'Failed to update logo path' });
    }
});
app.delete('/api/admin/settings/logo', authorizeAdmin, async (req, res) => {
    try {
        await query('UPDATE site_settings SET setting_value = $1 WHERE setting_key = $2', ['', 'logo_path']);
        // Optionally delete file from disk here
        res.json({ success: true });
    } catch (error) {
        console.error('Error clearing logo path:', error);
        res.status(500).json({ error: 'Failed to clear logo path' });
    }
});
app.post('/api/admin/settings/favicon', authorizeAdmin, logoUpload.single('favicon'), async (req, res) => {
     if (!req.file) return res.status(400).json({ error: 'No file' });
    const faviconPath = `/uploads/${req.file.filename}`;
     try {
         await query(`
             INSERT INTO site_settings (setting_key, setting_value, setting_group) 
             VALUES ('favicon_path', $1, 'appearance')
             ON CONFLICT (setting_key) DO UPDATE SET 
               setting_value = EXCLUDED.setting_value,
               updated_at = CURRENT_TIMESTAMP
         `, [faviconPath]);
        res.json({ success: true, faviconPath });
    } catch (error) {
        console.error('Error updating favicon path:', error);
        res.status(500).json({ error: 'Failed to update favicon path' });
    }
});

// Content Management Routes
app.get('/api/content', async (req, res) => {
    try {
        const publicContent = await content.getPublicContent();
        res.json(publicContent);
    } catch (error) {
        console.error('Error fetching public content:', error);
        res.status(500).json({ error: 'Failed to fetch content' });
    }
});

// Admin Content Management Routes
app.get('/api/admin/content', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
      const result = await query('SELECT * FROM content_blocks ORDER BY section, order_index');
      res.json(result.rows);
    } catch (error) {
        console.error('Error fetching content blocks:', error);
        res.status(500).json({ error: 'Failed to fetch content blocks' });
    }
});

app.get('/api/admin/content/sections', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
      const result = await query('SELECT DISTINCT section FROM content_blocks ORDER BY section');
      res.json(result.rows.map(r => r.section)); // Return array of strings
    } catch (error) {
        console.error('Error fetching content sections:', error);
        res.status(500).json({ error: 'Failed to fetch content sections' });
    }
});

app.get('/api/admin/content/section/:section', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
      const result = await query('SELECT * FROM content_blocks WHERE section = $1 ORDER BY order_index', [req.params.section]);
      res.json(result.rows);
    } catch (error) {
        console.error('Error fetching content blocks by section:', error);
        res.status(500).json({ error: 'Failed to fetch content blocks' });
    }
});

app.get('/api/admin/content/:id', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
      const result = await query('SELECT * FROM content_blocks WHERE id = $1', [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching content block:', error);
        res.status(500).json({ error: 'Failed to fetch content block' });
    }
});

app.post('/api/admin/content', authenticateUser, authorizeAdmin, async (req, res) => {
    const { identifier, title, content, content_type, section, order_index, is_active, metadata } = req.body;
     try {
         // Add identifier uniqueness check if needed before insert
        const sql = 'INSERT INTO content_blocks (identifier, title, content, content_type, section, order_index, is_active, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *';
        const params = [identifier, title, content, content_type, section, order_index, is_active, metadata];
        const result = await query(sql, params);
        res.status(201).json(result.rows[0]);
     } catch (error) {
        console.error('Error creating content block:', error);
        res.status(500).json({ error: 'Failed to create content block' });
    }
});

app.put('/api/admin/content/:id', authenticateUser, authorizeAdmin, async (req, res) => {
    const { identifier, title, content, content_type, section, order_index, is_active, metadata } = req.body;
     try {
        const sql = 'UPDATE content_blocks SET identifier=$1, title=$2, content=$3, content_type=$4, section=$5, order_index=$6, is_active=$7, metadata=$8, updated_at=CURRENT_TIMESTAMP WHERE id=$9 RETURNING *';
        const params = [identifier, title, content, content_type, section, order_index, is_active, metadata, req.params.id];
        const result = await query(sql, params);
         if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
     } catch (error) {
        console.error('Error updating content block:', error);
        res.status(500).json({ error: 'Failed to update content block' });
    }
});

app.delete('/api/admin/content/:id', authenticateUser, authorizeAdmin, async (req, res) => {
    try {
      const result = await query('DELETE FROM content_blocks WHERE id = $1', [req.params.id]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
      res.status(204).send(); // No content on successful delete
    } catch (error) {
        console.error('Error deleting content block:', error);
        res.status(500).json({ error: 'Failed to delete content block' });
    }
});

// Use contentImageUpload for its specific route
app.post('/api/admin/content/upload-image', authorizeAdmin, contentImageUpload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }
        
        const imageUrl = `/uploads/content/${req.file.filename}`;
        
        res.json({
            success: true,
            url: imageUrl,
            filename: req.file.filename
        });
    } catch (error) {
        console.error('Error uploading content image:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// Public Content Routes (Refactored for PG)
app.get('/api/content/:identifier', async (req, res) => {
    try {
      const result = await query('SELECT * FROM content_blocks WHERE identifier = $1 AND is_active = true', [req.params.identifier]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
       res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching content block:', error);
        res.status(500).json({ error: 'Failed to fetch content' });
    }
});

app.get('/api/content/section/:section', async (req, res) => {
    try {
      const result = await query('SELECT * FROM content_blocks WHERE section = $1 AND is_active = true ORDER BY order_index', [req.params.section]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching content:', error);
        res.status(500).json({ error: 'Failed to fetch content' });
    }
});

// Apply standard user authentication to relevant /api/ routes
app.use('/api/menus', authenticateUser); // Protect menu routes
app.use('/api/profile', authenticateUser); // Protect profile routes
// Add user dashboard stats route protection
app.use('/api/user/dashboard-stats', authenticateUser);
// Add other routes needing standard auth here

// --- Protected Routes --- 

// NEW: Endpoint to get user-specific dashboard stats (PG Version)
app.get('/api/user/dashboard-stats', async (req, res) => {
    try {
        const userId = req.user.id;
        const menuCountResult = await query('SELECT COUNT(*) as count FROM menus WHERE user_id = $1', [userId]);
        const totalMenus = menuCountResult.rows[0].count || 0;
        // ... (rest of stats, potentially using more query calls) ...
        res.json({ totalMenus, /* ... other stats ... */ });
    } catch (error) {
        console.error(`Error fetching dashboard stats for user ${req.user.id}:`, error);
        res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }
});

// Initialize DB and Start Server
const startServer = async () => {
  try {
    console.log("Calling setupDatabase()...");
    await setupDatabase(); // Correctly call the imported setup function
    console.log("setupDatabase() completed.");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
      console.error("Failed to initialize database or start server:", err);
      process.exit(1); 
  }
};

startServer(); 