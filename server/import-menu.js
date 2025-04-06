const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const db = require('./database');

async function parsePDF() {
    try {
        // First, delete the existing menu if it exists
        try {
            await db.deleteMenu('2025-04-05-alacarte2');
            console.log('Deleted existing menu');
        } catch (error) {
            console.log('No existing menu to delete');
        }

        // Read the PDF file
        const dataBuffer = fs.readFileSync(path.join(__dirname, '../public/2025-04-05-alacarte2.pdf'));
        const data = await pdf(dataBuffer);
        
        // Split the text into lines
        const lines = data.text.split('\n');
        
        // Initialize menu data
        const menuData = {
            name: '2025-04-05-alacarte2',
            title: 'Coq au Vin | Bistro Menu',
            subtitle: 'Spring 2025',
            font: 'Playfair Display',
            layout: 'single',
            sections: []
        };

        let currentSection = null;
        let currentItems = [];
        let currentItem = null;
        let foundFirstSection = false;

        // Process each line
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip empty lines and the subtitle
            if (!line || line === menuData.subtitle) continue;

            // Check if line is a section header (all caps or contains "MENU" or "Courses")
            if (line.toUpperCase() === line || 
                line.includes('MENU') || 
                line.includes('Courses') ||
                line === 'Appetizers' ||
                line === 'Dessert' ||
                line === 'Wines by the glass') {
                
                foundFirstSection = true;
                
                // Save previous section if exists
                if (currentSection) {
                    if (currentItem) {
                        currentItems.push(currentItem);
                        currentItem = null;
                    }
                    menuData.sections.push({
                        name: currentSection,
                        active: true,
                        items: currentItems
                    });
                    currentItems = [];
                }
                currentSection = line;
            } else if (foundFirstSection) {
                // Try to parse item line
                // Format is: "ItemNamePrice" followed by description on next line
                const priceMatch = line.match(/(\d+)$/);
                if (priceMatch) {
                    // If we have a previous item, save it
                    if (currentItem) {
                        currentItems.push(currentItem);
                    }
                    
                    const price = priceMatch[1];
                    const name = line.slice(0, -price.length).trim();
                    
                    currentItem = {
                        name: name,
                        description: '',
                        price: price,
                        active: true
                    };
                } else if (currentItem && !currentItem.description) {
                    // This is the description for the current item
                    currentItem.description = line;
                }
            }
        }

        // Add the last section
        if (currentSection) {
            if (currentItem) {
                currentItems.push(currentItem);
            }
            menuData.sections.push({
                name: currentSection,
                active: true,
                items: currentItems
            });
        }

        // Log the final menu data
        console.log('Final menu data:', JSON.stringify(menuData, null, 2));

        // Save to database
        await db.createMenu(
            menuData.name,
            menuData.title,
            menuData.subtitle,
            menuData.font,
            menuData.layout,
            menuData.sections
        );

        console.log('Menu imported successfully!');
    } catch (error) {
        console.error('Error importing menu:', error);
    }
}

parsePDF(); 