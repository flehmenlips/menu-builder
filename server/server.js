const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

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
        if (menu) {
            res.json(menu);
        } else {
            res.status(404).json({ error: 'Menu not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error fetching menu' });
    }
});

app.post('/api/menus', async (req, res) => {
    try {
        const { name, title, subtitle, font, layout, showDollarSign, showDecimals, showSectionDividers, elements } = req.body;
        
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
                req.body.elements
            );
            
            res.status(201).json(menu);
        } catch (dbError) {
            console.error('Database error creating menu:', dbError);
            
            // Check if the menu was created despite errors
            try {
                const createdMenu = await db.getMenu(name);
                if (createdMenu) {
                    res.status(500).json({ 
                        error: `Menu partially created, but encountered an error: ${dbError.message}`,
                        menu: createdMenu 
                    });
                } else {
                    res.status(500).json({ error: `Failed to create menu: ${dbError.message}` });
                }
            } catch (secondError) {
                res.status(500).json({ error: `Failed to create menu: ${dbError.message}` });
            }
        }
    } catch (error) {
        console.error('Error in create endpoint:', error);
        res.status(500).json({ error: `Unexpected error creating menu: ${error.message}` });
    }
});

app.put('/api/menus/:name', async (req, res) => {
    try {
        const { title, subtitle, font, layout, showDollarSign, showDecimals, showSectionDividers, elements } = req.body;
        const menuName = req.params.name;
        
        // Validate input data
        if (!elements) {
            console.warn(`Attempting to update menu "${menuName}" with missing elements`);
            // Instead of returning an error, we'll proceed with an empty elements array
            req.body.elements = [];
        }
        
        if (!Array.isArray(req.body.elements)) {
            console.warn(`Attempting to update menu "${menuName}" with non-array elements. Converting to array.`);
            // Convert to an empty array if not already an array
            req.body.elements = [];
        }
        
        try {
            const menu = await db.updateMenu(
                menuName, 
                title || '', 
                subtitle || '', 
                font || 'Playfair Display', 
                layout || 'single', 
                showDollarSign === undefined ? true : showDollarSign, 
                showDecimals === undefined ? true : showDecimals, 
                showSectionDividers === undefined ? true : showSectionDividers, 
                req.body.elements
            );
            
            if (!menu) {
                return res.status(404).json({ error: 'Menu not found' });
            }
            
            res.json(menu);
        } catch (dbError) {
            console.error('Database error updating menu:', dbError);
            
            // Still try to get the menu to return something to the client
            try {
                const existingMenu = await db.getMenu(menuName);
                if (existingMenu) {
                    res.status(500).json({ 
                        error: `Menu partially updated, but encountered an error: ${dbError.message}`,
                        menu: existingMenu 
                    });
                } else {
                    res.status(500).json({ error: `Failed to update menu: ${dbError.message}` });
                }
            } catch (secondError) {
                res.status(500).json({ error: `Failed to update menu: ${dbError.message}` });
            }
        }
    } catch (error) {
        console.error('Error in update endpoint:', error);
        res.status(500).json({ error: `Unexpected error updating menu: ${error.message}` });
    }
});

app.delete('/api/menus/:name', async (req, res) => {
    try {
        const success = await db.deleteMenu(req.params.name);
        if (success) {
            res.status(204).send();
        } else {
            res.status(404).json({ error: 'Menu not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error deleting menu' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 