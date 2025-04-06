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
        
        // Validate input data
        if (!elements) {
            return res.status(400).json({ error: 'Menu elements are missing' });
        }
        
        if (!Array.isArray(elements)) {
            return res.status(400).json({ error: 'Menu elements must be an array' });
        }
        
        // Validate each element has the required properties
        for (const element of elements) {
            if (!element.type) {
                return res.status(400).json({ error: 'Each element must have a type property' });
            }
            
            if (element.type === 'section' && !element.name) {
                return res.status(400).json({ error: 'Each section must have a name property' });
            }
            
            if (element.type === 'spacer' && (!element.size || !element.unit)) {
                return res.status(400).json({ error: 'Each spacer must have size and unit properties' });
            }
        }
        
        const menu = await db.createMenu(
            name, 
            title, 
            subtitle, 
            font, 
            layout, 
            showDollarSign, 
            showDecimals, 
            showSectionDividers, 
            elements
        );
        
        res.status(201).json(menu);
    } catch (error) {
        console.error('Error creating menu:', error);
        res.status(500).json({ error: `Failed to create menu: ${error.message}` });
    }
});

app.put('/api/menus/:name', async (req, res) => {
    try {
        const { title, subtitle, font, layout, showDollarSign, showDecimals, showSectionDividers, elements } = req.body;
        const menuName = req.params.name;
        
        // Validate input data
        if (!elements) {
            return res.status(400).json({ error: 'Menu elements are missing' });
        }
        
        if (!Array.isArray(elements)) {
            return res.status(400).json({ error: 'Menu elements must be an array' });
        }
        
        // Validate each element has the required properties
        for (const element of elements) {
            if (!element.type) {
                return res.status(400).json({ error: 'Each element must have a type property' });
            }
            
            if (element.type === 'section' && !element.name) {
                return res.status(400).json({ error: 'Each section must have a name property' });
            }
            
            if (element.type === 'spacer' && (!element.size || !element.unit)) {
                return res.status(400).json({ error: 'Each spacer must have size and unit properties' });
            }
        }
        
        const menu = await db.updateMenu(
            menuName, 
            title, 
            subtitle, 
            font, 
            layout, 
            showDollarSign, 
            showDecimals, 
            showSectionDividers, 
            elements
        );
        
        if (!menu) {
            return res.status(404).json({ error: 'Menu not found' });
        }
        
        res.json(menu);
    } catch (error) {
        console.error('Error updating menu:', error);
        res.status(500).json({ error: `Failed to update menu: ${error.message}` });
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