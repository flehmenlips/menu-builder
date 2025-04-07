const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const db = require('./database');
const auth = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../public/uploads/logos');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Set up multer for handling file uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function(req, file, cb) {
        // Create unique filename with original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'logo-' + uniqueSuffix + ext);
    }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|svg)$/)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 1024 * 1024 * 5 // 5MB max file size
    }
});

// Authentication middleware
const authenticateUser = async (req, res, next) => {
    try {
        // Check for auth token in cookies or Authorization header
        const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
        const sessionToken = req.cookies.session || req.headers['x-session-token'];

        if (!token && !sessionToken) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        let userId;

        // Verify session token (more secure)
        if (sessionToken) {
            try {
                const session = await auth.verifySession(sessionToken);
                userId = session.user_id;
            } catch (error) {
                // If session is invalid, try JWT
                if (!token) {
                    return res.status(401).json({ error: 'Session expired. Please log in again.' });
                }
            }
        }

        // Verify JWT token as fallback
        if (!userId && token) {
            try {
                const decoded = await auth.verifyToken(token);
                userId = decoded.userId;
            } catch (error) {
                return res.status(401).json({ error: 'Invalid token. Please log in again.' });
            }
        }

        // Get user details
        const user = await auth.getUserById(userId);
        req.user = user;
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(401).json({ error: 'Authentication failed' });
    }
};

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Serve the landing page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Serve the menu builder application
app.get('/menu-builder', (req, res) => {
    res.redirect('/Menu_Builder.html');
});

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        const user = await auth.registerUser(email, password);
        
        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: user.id,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        
        if (error.message === 'User already exists') {
            return res.status(409).json({ error: 'User already exists' });
        }
        
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        const result = await auth.loginUser(email, password);
        
        // Set HTTP-only cookies for security
        res.cookie('token', result.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
        
        res.cookie('session', result.sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
        
        res.json({
            message: 'Login successful',
            user: {
                id: result.userId,
                email: result.email
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
app.get('/api/menus', async (req, res) => {
    try {
        // If user is authenticated, get only their menus, otherwise get all public menus
        if (req.user) {
            const menus = await db.getMenusByUserId(req.user.id);
            res.json(menus);
        } else {
            const menus = await db.getAllMenus();
            res.json(menus);
        }
    } catch (error) {
        res.status(500).json({ error: 'Error fetching menus' });
    }
});

app.get('/api/menus/:name', async (req, res) => {
    try {
        const menu = await db.getMenu(req.params.name);
        if (!menu) {
            return res.status(404).json({ error: 'Menu not found' });
        }
        res.json(menu);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching menu' });
    }
});

app.delete('/api/menus/:name', async (req, res) => {
    try {
        const menuName = req.params.name;
        const menu = await db.getMenu(menuName);
        
        if (!menu) {
            return res.status(404).json({ error: 'Menu not found' });
        }
        
        await db.deleteMenu(menuName);
        res.json({ message: 'Menu deleted successfully' });
    } catch (error) {
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

app.put('/api/menus/:name', async (req, res) => {
    try {
        // Extract menu data from request body
        const { 
            title, subtitle, font, layout, 
            showDollarSign, showDecimals, showSectionDividers, elements,
            logoPath, logoPosition, logoSize, logoOffset,
            backgroundColor, textColor, accentColor 
        } = req.body;
        const menuName = req.params.name;
        
        // Validate input data
        if (!elements) {
            console.warn(`Attempting to update menu "${menuName}" with missing elements`);
            // Instead of returning an error, we'll proceed with an empty elements array
            req.body.elements = [];
        }
        
        if (!Array.isArray(req.body.elements)) {
            console.warn(`Updating menu "${menuName}" with non-array elements. Converting to array.`);
            req.body.elements = [];
        }
        
        try {
            const menu = await db.updateMenu(
                menuName,
                title,
                subtitle,
                font,
                layout,
                showDollarSign,
                showDecimals,
                showSectionDividers,
                req.body.elements,
                logoPath,
                logoPosition,
                logoSize,
                logoOffset,
                backgroundColor,
                textColor,
                accentColor
            );
            
            res.json(menu);
        } catch (error) {
            console.error('Error updating menu:', error);
            res.status(500).json({ error: 'Error updating menu' });
        }
    } catch (error) {
        console.error('Unexpected error in PUT /api/menus/:name:', error);
        res.status(500).json({ error: 'Unexpected error updating menu' });
    }
});

// Duplicate a menu
app.post('/api/menus/:name/duplicate', async (req, res) => {
    try {
        const sourceName = req.params.name;
        const { newName } = req.body;
        
        if (!newName) {
            return res.status(400).json({ error: 'New menu name is required' });
        }
        
        // Check if source menu exists
        const sourceMenu = await db.getMenu(sourceName);
        if (!sourceMenu) {
            return res.status(404).json({ error: 'Source menu not found' });
        }
        
        // Check if target name already exists
        const existingMenu = await db.getMenu(newName);
        if (existingMenu) {
            return res.status(409).json({ error: 'New menu name already exists' });
        }
        
        const newMenu = await db.duplicateMenu(sourceName, newName);
        res.status(201).json(newMenu);
    } catch (error) {
        console.error('Error duplicating menu:', error);
        res.status(500).json({ error: 'Error duplicating menu' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 