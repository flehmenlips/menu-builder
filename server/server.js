const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const db = require('./database');
const auth = require('./auth');
const admin = require('./admin');
const content = require('./content');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'menu-builder-secret-key';
const PORT = process.env.PORT || 4000;

const app = express();

// Initialize database connection
const dbConnection = new sqlite3.Database(path.join(__dirname, 'data/menus.db'));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
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
      // Get user from database using auth module
      const user = await auth.getUserById(decoded.userId);
      
      // Store user in request object
      req.user = {
        id: user.id,
        email: user.email,
        is_admin: user.is_admin === 1
      };
      
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
app.use(express.static(path.join(__dirname, '..', 'public')));
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
app.get('/api/admin/exists', (req, res) => {
    // Reverted to direct DB query as auth.adminExists doesn't exist
    dbConnection.get('SELECT COUNT(*) as count FROM users WHERE is_admin = 1', [], (err, result) => {
        if (err) {
            console.error('Error checking if admin exists:', err);
            return res.status(500).json({ error: 'Server error checking admin status' });
        }
        const adminExists = result ? result.count > 0 : false;
        console.log('Admin exists check:', adminExists, result);
        res.json({ exists: adminExists });
    });
});

// Admin login Route (Needs to be public)
app.post('/api/admin/login', (req, res) => {
    const { email, password } = req.body;
    
    console.log('Admin login attempt:', { email });
    
    if (!email || !password) {
        console.log('Admin login failed: Missing email or password');
        return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // First check if user exists
    dbConnection.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) {
            console.error('Error during admin login:', err);
            return res.status(500).json({ error: 'Server error during login' });
        }
        
        if (!user) {
            console.log('Admin login failed: User not found');
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
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
        bcrypt.compare(password, user.password_hash, (err, isMatch) => {
            if (err) {
                console.error('Error comparing passwords:', err);
                return res.status(500).json({ error: 'Server error during login - bcrypt error' });
            }
            
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
        });
    });
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
app.post('/api/profile/logo', authenticateUser, upload.single('logo'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ 
            success: false, 
            error: 'No file uploaded or invalid file type' 
        });
    }
    
    try {
        // Return the path to the uploaded logo
        const logoPath = `/uploads/logos/${req.file.filename}`;
        console.log('Company logo uploaded successfully, path:', logoPath);
        
        // Update the user's company profile with the logo path
        await auth.updateCompanyProfile(req.user.id, { logo_path: logoPath });
        
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

// Existing API Routes (now with authentication where needed)
app.get('/api/menus', authenticateUser, async (req, res) => {
    try {
        // Get menus only for the authenticated user
        const menus = await db.getMenusByUserId(req.user.id);
        res.json(menus);
    } catch (error) {
        console.error('Error fetching menus for user:', req.user.id, error);
        res.status(500).json({ error: 'Error fetching menus' });
    }
});

app.get('/api/menus/:name', authenticateUser, async (req, res) => {
    try {
        const menuName = req.params.name;
        // Fetch the menu and ensure it belongs to the user
        const menu = await db.getMenuByNameAndUser(menuName, req.user.id);
        if (!menu) {
            // Return 404 whether menu doesn't exist or doesn't belong to user
            return res.status(404).json({ error: 'Menu not found' });
        }
        res.json(menu);
    } catch (error) {
        console.error('Error fetching menu:', req.params.name, 'for user:', req.user.id, error);
        res.status(500).json({ error: 'Error fetching menu' });
    }
});

app.delete('/api/menus/:name', authenticateUser, async (req, res) => {
    try {
        const menuName = req.params.name;
        // First, check if the menu exists and belongs to the user
        const menu = await db.getMenuByNameAndUser(menuName, req.user.id);
        
        if (!menu) {
            return res.status(404).json({ error: 'Menu not found or not authorized' });
        }
        
        // If check passes, proceed with deletion
        await db.deleteMenuByNameAndUser(menuName, req.user.id);
        res.json({ message: 'Menu deleted successfully' });
    } catch (error) {
        console.error('Error deleting menu:', req.params.name, 'for user:', req.user.id, error);
        res.status(500).json({ error: 'Error deleting menu' });
    }
});

// Upload logo endpoint
app.post('/api/upload-logo', upload.single('logo'), (req, res) => {
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
        // Add user_id to the menu data
        req.body.user_id = req.user.id;
        
        // Extract menu data from request body
        const { 
            name, title, subtitle, font, layout, 
            showDollarSign, showDecimals, showSectionDividers, elements,
            logoPath, logoPosition, logoSize, logoOffset,
            backgroundColor, textColor, accentColor 
        } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Menu name is required' });
        }
        
        // Check if menu already exists
        const existingMenu = await db.getMenu(name);
        if (existingMenu) {
            return res.status(409).json({ error: 'Menu name already exists' });
        }
        
        // Validate input data with safe defaults
        if (!elements) {
            console.warn(`Creating menu "${name}" with missing elements`);
            req.body.elements = [];
        }
        
        if (!Array.isArray(req.body.elements)) {
            console.warn(`Creating menu "${name}" with non-array elements. Converting to array.`);
            req.body.elements = [];
        }
        
        try {
            const menu = await db.createMenu(
                name, 
                title || '', 
                subtitle || '', 
                font || 'Playfair Display', 
                layout || 'single', 
                showDollarSign === undefined ? true : showDollarSign, 
                showDecimals === undefined ? true : showDecimals, 
                showSectionDividers === undefined ? true : showSectionDividers, 
                req.body.elements,
                logoPath || null,
                logoPosition || 'top',
                logoSize || '200',
                logoOffset || '0',
                backgroundColor || '#ffffff',
                textColor || '#000000',
                accentColor || '#333333',
                req.user.id // Add user ID to associate menu with user
            );
            
            res.status(201).json(menu);
        } catch (error) {
            console.error('Error creating menu:', error);
            res.status(500).json({ error: 'Error creating menu' });
        }
    } catch (error) {
        console.error('Unexpected error in POST /api/menus:', error);
        res.status(500).json({ error: 'Unexpected error creating menu' });
    }
});

app.put('/api/menus/:name', authenticateUser, async (req, res) => {
    try {
        const menuName = req.params.name;
        // First, check if the menu exists and belongs to the user
        const menu = await db.getMenuByNameAndUser(menuName, req.user.id);

        if (!menu) {
             return res.status(404).json({ error: 'Menu not found or not authorized' });
        }

        // Extract menu data from request body
        const { 
            title, subtitle, font, layout, 
            showDollarSign, showDecimals, showSectionDividers, elements,
            logoPath, logoPosition, logoSize, logoOffset,
            backgroundColor, textColor, accentColor 
        } = req.body;
        
        // Validate input data
        const updatedElements = Array.isArray(elements) ? elements : [];
        if (!Array.isArray(elements)) {
            console.warn(`Updating menu "${menuName}" with non-array elements. Using empty array.`);
        }
        
        // Proceed with the update, ensuring db.updateMenu uses user_id check
        const updatedMenu = await db.updateMenu(
            menuName, // Original name to find the menu
            req.user.id, // User ID for authorization check
            {
                // Pass updated fields, ensuring db function handles them
                title, subtitle, font, layout, 
                showDollarSign, showDecimals, showSectionDividers, 
                elements: updatedElements,
                logoPath, logoPosition, logoSize, logoOffset,
                backgroundColor, textColor, accentColor
            }
        ); 
        
        res.json(updatedMenu);
    } catch (error) {
        console.error('Error updating menu:', req.params.name, 'for user:', req.user.id, error);
        res.status(500).json({ error: 'Error updating menu' });
    }
});

// Duplicate a menu
app.post('/api/menus/:name/duplicate', authenticateUser, async (req, res) => {
    try {
        const sourceName = req.params.name;
        const { newName } = req.body;
        
        if (!newName) {
            return res.status(400).json({ error: 'New menu name is required' });
        }
        
        // Check if source menu exists AND belongs to user
        const sourceMenu = await db.getMenuByNameAndUser(sourceName, req.user.id);
        if (!sourceMenu) {
            return res.status(404).json({ error: 'Source menu not found or not authorized' });
        }
        
        // Check if target name already exists FOR THIS USER
        const existingMenu = await db.getMenuByNameAndUser(newName, req.user.id);
        if (existingMenu) {
            return res.status(409).json({ error: 'New menu name already exists for this user' });
        }
        
        // Pass user ID to the duplicate function
        const newMenu = await db.duplicateMenu(sourceName, newName, req.user.id);
        res.status(201).json(newMenu);
    } catch (error) {
        console.error('Error duplicating menu:', req.params.name, 'for user:', req.user.id, error);
        res.status(500).json({ error: 'Error duplicating menu' });
    }
});

// Admin Routes
app.post('/api/admin/setup', (req, res) => {
  const { name, email, password, confirmPassword, setupKey } = req.body;
  
  // Validate input
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }
  
  // Check if admin already exists
  dbConnection.get('SELECT COUNT(*) as count FROM users WHERE is_admin = 1', [], (err, result) => {
    if (err) {
      console.error('Error checking for existing admin:', err);
      return res.status(500).json({ error: 'Server error' });
    }
    
    if (result.count > 0) {
      return res.status(400).json({ error: 'An admin account already exists' });
    }
    
    // Check setup key if provided
    if (setupKey) {
      dbConnection.get('SELECT value FROM site_settings WHERE name = "admin_setup_key"', [], (err, setting) => {
        if (err) {
          console.error('Error checking setup key:', err);
          return res.status(500).json({ error: 'Server error' });
        }
        
        if (!setting || setting.value !== setupKey) {
          return res.status(401).json({ error: 'Invalid setup key' });
        }
        
        // Proceed with creating admin account
        createAdminAccount();
      });
    } else {
      // If no admin exists and no setup key is required, proceed
      createAdminAccount();
    }
  });
  
  function createAdminAccount() {
    // Hash password
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        console.error('Error hashing password:', err);
        return res.status(500).json({ error: 'Server error during account creation' });
      }
      
      // Create the admin user
      const sql = `
        INSERT INTO users 
        (name, email, password_hash, is_admin, created_at)
        VALUES (?, ?, ?, 1, datetime('now'))
      `;
      
      dbConnection.run(sql, [name, email, hash], function(err) {
        if (err) {
          console.error('Error creating admin account:', err);
          return res.status(500).json({ error: 'Server error during account creation' });
        }
        
        // Generate JWT token
        const token = jwt.sign(
          { userId: this.lastID, email: email, isAdmin: true },
          JWT_SECRET,
          { expiresIn: '24h' }
        );
        
        // Return success
        return res.json({
          success: true,
          message: 'Admin account created successfully',
          id: this.lastID,
          name,
          email,
          is_admin: true,
          token
        });
      });
    });
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
app.get('/api/admin/settings', authorizeAdmin, (req, res) => {
  dbConnection.all('SELECT * FROM site_settings ORDER BY setting_group, setting_key', [], (err, rows) => {
    if (err) {
      console.error('Error fetching settings:', err);
      return res.status(500).json({ error: 'Failed to fetch settings' });
    }
    
    res.json(rows);
  });
});

app.post('/api/admin/settings', authorizeAdmin, (req, res) => {
  const settings = req.body;
  
  // Start a transaction to update all settings
  dbConnection.run('BEGIN TRANSACTION', err => {
    if (err) {
      console.error('Error starting transaction:', err);
      return res.status(500).json({ error: 'Server error' });
    }
    
    const stmt = dbConnection.prepare(`
      UPDATE site_settings 
      SET setting_value = ?, updated_at = datetime('now')
      WHERE setting_key = ?
    `);
    
    let hasError = false;
    
    // Update each setting
    Object.keys(settings).forEach(key => {
      stmt.run(settings[key], key, err => {
        if (err) {
          console.error(`Error updating setting ${key}:`, err);
          hasError = true;
        }
      });
    });
    
    stmt.finalize();
    
    if (hasError) {
      dbConnection.run('ROLLBACK');
      return res.status(500).json({ error: 'Failed to update one or more settings' });
    }
    
    dbConnection.run('COMMIT', err => {
      if (err) {
        console.error('Error committing transaction:', err);
        dbConnection.run('ROLLBACK');
        return res.status(500).json({ error: 'Failed to save settings' });
      }
      
      res.json({ success: true, message: 'Settings updated successfully' });
    });
  });
});

// Upload logo
app.post('/api/admin/settings/logo', authorizeAdmin, upload.single('logo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No logo file provided' });
  }
  
  const logoPath = `/uploads/${req.file.filename}`;
  
  // Update the logo_path setting
  dbConnection.run(`
    UPDATE site_settings 
    SET setting_value = ?, updated_at = datetime('now')
    WHERE setting_key = 'logo_path'
  `, [logoPath], function(err) {
    if (err) {
      console.error('Error updating logo path:', err);
      return res.status(500).json({ error: 'Failed to update logo path' });
    }
    
    // If the setting doesn't exist, create it
    if (this.changes === 0) {
      dbConnection.run(`
        INSERT INTO site_settings (setting_key, setting_value, setting_group, created_at, updated_at)
        VALUES ('logo_path', ?, 'appearance', datetime('now'), datetime('now'))
      `, [logoPath], err => {
        if (err) {
          console.error('Error inserting logo path:', err);
          return res.status(500).json({ error: 'Failed to insert logo path' });
        }
        
        res.json({ success: true, logo_path: logoPath });
      });
    } else {
      res.json({ success: true, logo_path: logoPath });
    }
  });
});

// Delete logo
app.delete('/api/admin/settings/logo', authorizeAdmin, (req, res) => {
  // Get current logo path
  dbConnection.get('SELECT setting_value FROM site_settings WHERE setting_key = ?', ['logo_path'], (err, row) => {
    if (err) {
      console.error('Error getting logo path:', err);
      return res.status(500).json({ error: 'Failed to get logo path' });
    }
    
    // If logo exists, delete the file
    if (row && row.setting_value) {
      const logoFilePath = path.join(__dirname, '..', 'public', row.setting_value);
      
      // Delete file if it exists
      if (fs.existsSync(logoFilePath)) {
        try {
          fs.unlinkSync(logoFilePath);
        } catch (err) {
          console.error('Error deleting logo file:', err);
          // Continue even if file deletion fails
        }
      }
      
      // Update setting to empty
      dbConnection.run(`
        UPDATE site_settings 
        SET setting_value = '', updated_at = datetime('now')
        WHERE setting_key = 'logo_path'
      `, err => {
        if (err) {
          console.error('Error clearing logo path:', err);
          return res.status(500).json({ error: 'Failed to clear logo path' });
        }
        
        res.json({ success: true, message: 'Logo removed successfully' });
      });
    } else {
      // No logo to delete
      res.json({ success: true, message: 'No logo to remove' });
    }
  });
});

// Upload favicon
app.post('/api/admin/settings/favicon', authorizeAdmin, upload.single('favicon'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No favicon file provided' });
  }
  
  // Copy the file to public/favicon.ico
  const faviconPath = '/favicon.ico';
  const faviconFilePath = path.join(__dirname, '..', 'public', faviconPath);
  
  fs.copyFile(req.file.path, faviconFilePath, err => {
    if (err) {
      console.error('Error copying favicon:', err);
      return res.status(500).json({ error: 'Failed to update favicon' });
    }
    
    // Update the favicon_path setting
    dbConnection.run(`
      UPDATE site_settings 
      SET setting_value = ?, updated_at = datetime('now')
      WHERE setting_key = 'favicon_path'
    `, [faviconPath], function(err) {
      if (err) {
        console.error('Error updating favicon path:', err);
        return res.status(500).json({ error: 'Failed to update favicon path' });
      }
      
      // If the setting doesn't exist, create it
      if (this.changes === 0) {
        dbConnection.run(`
          INSERT INTO site_settings (setting_key, setting_value, setting_group, created_at, updated_at)
          VALUES ('favicon_path', ?, 'appearance', datetime('now'), datetime('now'))
        `, [faviconPath], err => {
          if (err) {
            console.error('Error inserting favicon path:', err);
            return res.status(500).json({ error: 'Failed to insert favicon path' });
          }
          
          res.json({ success: true, favicon_path: faviconPath });
        });
      } else {
        res.json({ success: true, favicon_path: faviconPath });
      }
    });
  });
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
app.get('/api/admin/content', authorizeAdmin, async (req, res) => {
    try {
        const allContent = await content.getAllContent();
        res.json(allContent);
    } catch (error) {
        console.error('Error fetching all content:', error);
        res.status(500).json({ error: 'Failed to fetch content blocks' });
    }
});

app.get('/api/admin/content/sections', authorizeAdmin, async (req, res) => {
    try {
        const sections = await content.getContentSections();
        res.json(sections);
    } catch (error) {
        console.error('Error fetching content sections:', error);
        res.status(500).json({ error: 'Failed to fetch content sections' });
    }
});

app.get('/api/admin/content/section/:section', authorizeAdmin, async (req, res) => {
    try {
        const section = req.params.section;
        const sectionContent = await content.getContentBySection(section);
        res.json(sectionContent);
    } catch (error) {
        console.error('Error fetching section content:', error);
        res.status(500).json({ error: 'Failed to fetch section content' });
    }
});

app.get('/api/admin/content/:id', authorizeAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        const contentBlock = await content.getContentById(id);
        res.json(contentBlock);
    } catch (error) {
        console.error('Error fetching content block:', error);
        
        if (error.message === 'Content block not found') {
            return res.status(404).json({ error: 'Content block not found' });
        }
        
        res.status(500).json({ error: 'Failed to fetch content block' });
    }
});

app.post('/api/admin/content', authorizeAdmin, async (req, res) => {
    try {
        const contentData = req.body;
        const newContent = await content.createContent(contentData, req.user.id);
        res.status(201).json(newContent);
    } catch (error) {
        console.error('Error creating content block:', error);
        
        if (error.message.includes('Content identifier already exists')) {
            return res.status(400).json({ error: 'Content identifier already exists' });
        }
        
        if (error.message.includes('Identifier and section are required')) {
            return res.status(400).json({ error: 'Identifier and section are required fields' });
        }
        
        res.status(500).json({ error: 'Failed to create content block' });
    }
});

app.put('/api/admin/content/:id', authorizeAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        const contentData = req.body;
        const updatedContent = await content.updateContent(id, contentData, req.user.id);
        res.json(updatedContent);
    } catch (error) {
        console.error('Error updating content block:', error);
        
        if (error.message === 'Content block not found') {
            return res.status(404).json({ error: 'Content block not found' });
        }
        
        res.status(500).json({ error: 'Failed to update content block' });
    }
});

app.delete('/api/admin/content/:id', authorizeAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        const result = await content.deleteContent(id);
        res.json(result);
    } catch (error) {
        console.error('Error deleting content block:', error);
        
        if (error.message === 'Content block not found') {
            return res.status(404).json({ error: 'Content block not found' });
        }
        
        res.status(500).json({ error: 'Failed to delete content block' });
    }
});

// File upload for content images
const contentImageStorage = multer.diskStorage({
    destination: function(req, file, cb) {
        const uploadDir = path.join(__dirname, '../public/uploads/content');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
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

// **** CONTENT MANAGEMENT ROUTES ****
// Get all content blocks
app.get('/api/admin/content', authenticateUser, authorizeAdmin, (req, res) => {
    dbConnection.all('SELECT * FROM content_blocks ORDER BY section, order_index', [], (err, rows) => {
        if (err) {
            console.error('Error fetching content blocks:', err);
            return res.status(500).json({ error: 'Failed to fetch content blocks' });
        }
        
        // Parse metadata JSON for each row
        const content = rows.map(row => {
            try {
                if (row.metadata) {
                    row.metadata = JSON.parse(row.metadata);
                } else {
                    row.metadata = {};
                }
            } catch (e) {
                row.metadata = {};
            }
            return row;
        });
        
        res.json(content);
    });
});

// Get content blocks by section
app.get('/api/admin/content/section/:section', authenticateUser, authorizeAdmin, (req, res) => {
    const { section } = req.params;
    
    dbConnection.all('SELECT * FROM content_blocks WHERE section = ? ORDER BY order_index', [section], (err, rows) => {
        if (err) {
            console.error('Error fetching content blocks by section:', err);
            return res.status(500).json({ error: 'Failed to fetch content blocks' });
        }
        
        // Parse metadata JSON for each row
        const content = rows.map(row => {
            try {
                if (row.metadata) {
                    row.metadata = JSON.parse(row.metadata);
                } else {
                    row.metadata = {};
                }
            } catch (e) {
                row.metadata = {};
            }
            return row;
        });
        
        res.json(content);
    });
});

// Get all distinct sections
app.get('/api/admin/content/sections', authenticateUser, authorizeAdmin, (req, res) => {
    dbConnection.all('SELECT DISTINCT section FROM content_blocks ORDER BY section', [], (err, rows) => {
        if (err) {
            console.error('Error fetching content sections:', err);
            return res.status(500).json({ error: 'Failed to fetch content sections' });
        }
        
        const sections = rows.map(row => row.section);
        res.json(sections);
    });
});

// Get a specific content block
app.get('/api/admin/content/:id', authenticateUser, authorizeAdmin, (req, res) => {
    const { id } = req.params;
    
    dbConnection.get('SELECT * FROM content_blocks WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('Error fetching content block:', err);
            return res.status(500).json({ error: 'Failed to fetch content block' });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Content block not found' });
        }
        
        // Parse metadata JSON
        try {
            if (row.metadata) {
                row.metadata = JSON.parse(row.metadata);
            } else {
                row.metadata = {};
            }
        } catch (e) {
            row.metadata = {};
        }
        
        res.json(row);
    });
});

// Create a new content block
app.post('/api/admin/content', authenticateUser, authorizeAdmin, (req, res) => {
    const { identifier, title, content, content_type, section, order_index, is_active, metadata } = req.body;
    
    // Validate required fields
    if (!identifier || !title || !section) {
        return res.status(400).json({ error: 'Identifier, title, and section are required' });
    }
    
    // Check if identifier already exists
    dbConnection.get('SELECT id FROM content_blocks WHERE identifier = ?', [identifier], (err, row) => {
        if (err) {
            console.error('Error checking content identifier:', err);
            return res.status(500).json({ error: 'Failed to check content identifier' });
        }
        
        if (row) {
            return res.status(400).json({ error: 'Content identifier already exists' });
        }
        
        // Convert metadata to JSON string
        const metadataString = metadata ? JSON.stringify(metadata) : null;
        
        const sql = `
            INSERT INTO content_blocks 
            (identifier, title, content, content_type, section, order_index, is_active, metadata, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `;
        
        dbConnection.run(sql, [
            identifier,
            title,
            content || '',
            content_type || 'text',
            section,
            order_index || 0,
            is_active ? 1 : 0,
            metadataString
        ], function(err) {
            if (err) {
                console.error('Error creating content block:', err);
                return res.status(500).json({ error: 'Failed to create content block' });
            }
            
            res.json({ 
                id: this.lastID,
                message: 'Content block created successfully' 
            });
        });
    });
});

// Update a content block
app.put('/api/admin/content/:id', authenticateUser, authorizeAdmin, (req, res) => {
    const { id } = req.params;
    const { title, content, content_type, section, order_index, is_active, metadata } = req.body;
    
    // Validate required fields
    if (!title || !section) {
        return res.status(400).json({ error: 'Title and section are required' });
    }
    
    // Convert metadata to JSON string
    const metadataString = metadata ? JSON.stringify(metadata) : null;
    
    const sql = `
        UPDATE content_blocks 
        SET title = ?, content = ?, content_type = ?, section = ?, order_index = ?, is_active = ?, metadata = ?, updated_at = datetime('now')
        WHERE id = ?
    `;
    
    dbConnection.run(sql, [
        title,
        content || '',
        content_type || 'text',
        section,
        order_index || 0,
        is_active ? 1 : 0,
        metadataString,
        id
    ], function(err) {
        if (err) {
            console.error('Error updating content block:', err);
            return res.status(500).json({ error: 'Failed to update content block' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Content block not found' });
        }
        
        res.json({ message: 'Content block updated successfully' });
    });
});

// Delete a content block
app.delete('/api/admin/content/:id', authenticateUser, authorizeAdmin, (req, res) => {
    const { id } = req.params;
    
    dbConnection.run('DELETE FROM content_blocks WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('Error deleting content block:', err);
            return res.status(500).json({ error: 'Failed to delete content block' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Content block not found' });
        }
        
        res.json({ message: 'Content block deleted successfully' });
    });
});

// Upload content image
app.post('/api/admin/content/upload-image', authenticateUser, authorizeAdmin, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
    }
    
    // Generate URL for the uploaded image
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const imageUrl = `${baseUrl}/uploads/${req.file.filename}`;
    
    res.json({ 
        url: imageUrl,
        message: 'Image uploaded successfully' 
    });
});

// Get public content by identifier
app.get('/api/content/:identifier', (req, res) => {
    const { identifier } = req.params;
    
    dbConnection.get('SELECT * FROM content_blocks WHERE identifier = ? AND is_active = 1', [identifier], (err, row) => {
        if (err) {
            console.error('Error fetching content block:', err);
            return res.status(500).json({ error: 'Failed to fetch content' });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Content not found' });
        }
        
        // Parse metadata JSON
        try {
            if (row.metadata) {
                row.metadata = JSON.parse(row.metadata);
            } else {
                row.metadata = {};
            }
        } catch (e) {
            row.metadata = {};
        }
        
        res.json(row);
    });
});

// Get all public content by section
app.get('/api/content/section/:section', (req, res) => {
    const section = req.params.section;
    
    dbConnection.all('SELECT * FROM content_blocks WHERE section = ?', [section], (err, rows) => {
        if (err) {
            console.error('Error fetching content:', err);
            return res.status(500).json({ error: 'Failed to fetch content' });
        }
        
        res.json(rows || []);
    });
});

// Get a specific content item by identifier
app.get('/api/content/:identifier', (req, res) => {
    const identifier = req.params.identifier;
    
    dbConnection.get('SELECT * FROM content_blocks WHERE identifier = ?', [identifier], (err, row) => {
        if (err) {
            console.error('Error fetching content:', err);
            return res.status(500).json({ error: 'Failed to fetch content' });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Content not found' });
        }
        
        res.json(row);
    });
});

// Apply standard user authentication to relevant /api/ routes
app.use('/api/menus', authenticateUser); // Protect menu routes
app.use('/api/profile', authenticateUser); // Protect profile routes
// Add user dashboard stats route protection
app.use('/api/user/dashboard-stats', authenticateUser);
// Add other routes needing standard auth here

// --- Protected Routes --- 

// NEW: Endpoint to get user-specific dashboard stats
app.get('/api/user/dashboard-stats', async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch total menus count for the user
        const menuCountResult = await new Promise((resolve, reject) => {
            dbConnection.get('SELECT COUNT(*) as count FROM menus WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        const totalMenus = menuCountResult ? menuCountResult.count : 0;

        // Fetch active menus count (assuming an 'is_active' or similar column exists, otherwise just use total)
        // For now, let's just use total count as active count placeholder
        const activeMenus = totalMenus; 

        // Placeholder values for views and storage - implement later if needed
        const menuViews = 0; 
        const storageUsed = 0; // e.g., calculate based on logo sizes or menu data

        // Placeholder for recent activity - implement later if needed
        const recentActivity = [
            // { description: 'Menu "My Cafe Menu" updated', timestamp: new Date() },
            // { description: 'Profile updated', timestamp: new Date() }
        ];

        res.json({
            totalMenus,
            activeMenus,
            menuViews,
            storageUsed,
            recentActivity
        });

    } catch (error) {
        console.error(`Error fetching dashboard stats for user ${req.user.id}:`, error);
        res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 