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
        const { name, title, subtitle, font, layout, sections } = req.body;
        const newMenu = await db.createMenu(name, title, subtitle, font, layout, sections);
        res.status(201).json(newMenu);
    } catch (error) {
        res.status(500).json({ error: 'Error creating menu' });
    }
});

app.put('/api/menus/:name', async (req, res) => {
    try {
        const { title, subtitle, font, layout, sections } = req.body;
        const updatedMenu = await db.updateMenu(req.params.name, title, subtitle, font, layout, sections);
        if (updatedMenu) {
            res.json(updatedMenu);
        } else {
            res.status(404).json({ error: 'Menu not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error updating menu' });
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