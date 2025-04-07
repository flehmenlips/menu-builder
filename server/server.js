const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

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

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Serve the menu builder application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/Menu_Builder-V4.html'));
});

// API Routes
app.get('/api/menus', async (req, res) => {
    try {
        const menus = await db.getAllMenus();
        res.json(menus);
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
    
    // Return the path to the uploaded logo
    const logoPath = `/uploads/logos/${req.file.filename}`;
    res.json({ 
        success: true, 
        logoPath: logoPath
    });
});

app.post('/api/menus', async (req, res) => {
    try {
        // Extract menu data from request body
        const { 
            name, title, subtitle, font, layout, 
            showDollarSign, showDecimals, showSectionDividers, elements,
            logoPath, logoPosition, logoSize, 
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
                logoSize || 'medium',
                backgroundColor || '#ffffff',
                textColor || '#000000',
                accentColor || '#333333'
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
            logoPath, logoPosition, logoSize, 
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