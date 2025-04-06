let sectionCounter = 0;
let itemCounter = 0;

// Load Google Fonts dynamically
function loadFont(font) {
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${font.replace(' ', '+')}&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    document.getElementById('menu-preview').style.fontFamily = `'${font}', serif`;
}

// Add a new section
function addSection(data = {}) {
    const sectionId = `section-${sectionCounter++}`;
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'section-card section-expanded';
    sectionDiv.id = sectionId;

    // Add move buttons
    const moveButtons = document.createElement('div');
    moveButtons.className = 'move-buttons';
    
    const moveUpBtn = document.createElement('button');
    moveUpBtn.className = 'move-btn move-up';
    moveUpBtn.innerHTML = '↑';
    moveUpBtn.addEventListener('click', () => moveSection(sectionId, 'up'));
    
    const moveDownBtn = document.createElement('button');
    moveDownBtn.className = 'move-btn move-down';
    moveDownBtn.innerHTML = '↓';
    moveDownBtn.addEventListener('click', () => moveSection(sectionId, 'down'));
    
    moveButtons.appendChild(moveUpBtn);
    moveButtons.appendChild(moveDownBtn);
    sectionDiv.appendChild(moveButtons);

    // Create section header
    const header = document.createElement('div');
    header.className = 'section-header';
    
    // Create section name input
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'section-name';
    nameInput.placeholder = 'Section Name';
    nameInput.value = data.name || '';

    // Create active toggle container
    const activeToggleContainer = document.createElement('div');
    activeToggleContainer.className = 'active-toggle-container';
    
    const activeToggle = document.createElement('input');
    activeToggle.type = 'checkbox';
    activeToggle.className = 'active-toggle';
    activeToggle.checked = data.active !== false && data.active !== 0;
    
    const activeLabel = document.createElement('label');
    activeLabel.textContent = 'Active';
    
    activeToggleContainer.appendChild(activeToggle);
    activeToggleContainer.appendChild(activeLabel);

    // Create section controls container
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'section-controls';
    
    // Create toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'section-toggle-btn';
    toggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
    toggleBtn.title = 'Toggle Section';
    toggleBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleSection(sectionId);
    });
    
    // Create add item button
    const addItemBtn = document.createElement('button');
    addItemBtn.className = 'btn btn-sm btn-primary';
    addItemBtn.innerHTML = '<i class="fas fa-plus"></i> Add Item';
    addItemBtn.addEventListener('click', () => addItem(sectionId));
    
    // Create delete section button
    const deleteSectionBtn = document.createElement('button');
    deleteSectionBtn.className = 'btn btn-sm btn-secondary';
    deleteSectionBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
    deleteSectionBtn.addEventListener('click', () => deleteSection(sectionId));
    
    // Add elements to header
    header.appendChild(nameInput);
    header.appendChild(activeToggleContainer);
    
    controlsContainer.appendChild(toggleBtn);
    controlsContainer.appendChild(addItemBtn);
    controlsContainer.appendChild(deleteSectionBtn);
    
    header.appendChild(controlsContainer);
    
    // Create section content
    const sectionContent = document.createElement('div');
    sectionContent.className = 'section-content';

    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'items';
    sectionContent.appendChild(itemsDiv);

    sectionDiv.appendChild(header);
    sectionDiv.appendChild(sectionContent);

    document.getElementById('sections').appendChild(sectionDiv);

    if (!data.name) nameInput.focus();

    activeToggle.addEventListener('change', function() {
        sectionDiv.classList.toggle('inactive', !this.checked);
        updatePreview();
    });

    if (!activeToggle.checked) sectionDiv.classList.add('inactive');

    if (data.items) {
        data.items.forEach(itemData => addItem(sectionId, itemData));
        console.log('Loading section:', data.name, 'active:', data.active);
        data.items.forEach(item => {
            console.log('Loading item:', item.name, 'active:', item.active);
        });
    }

    updateProgress();
    updatePreview();
}

// Toggle section collapse/expand
function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    const isCollapsed = section.classList.contains('section-collapsed');
    const toggleBtn = section.querySelector('.section-toggle-btn');
    
    if (isCollapsed) {
        section.classList.remove('section-collapsed');
        section.classList.add('section-expanded');
        toggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
    } else {
        section.classList.remove('section-expanded');
        section.classList.add('section-collapsed');
        toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
    }
}

// Allow clicking anywhere in section header to toggle collapse
document.addEventListener('click', function(e) {
    const sectionHeader = e.target.closest('.section-header');
    if (sectionHeader && !e.target.closest('input, button')) {
        const sectionId = sectionHeader.closest('.section-card').id;
        toggleSection(sectionId);
    }
});

// Add a new item to a section
function addItem(sectionId, data = {}) {
    const itemId = `item-${itemCounter++}`;
    const itemDiv = document.createElement('div');
    itemDiv.className = 'item-card';
    itemDiv.id = itemId;

    // Add move buttons
    const moveButtons = document.createElement('div');
    moveButtons.className = 'move-buttons';
    
    const moveUpBtn = document.createElement('button');
    moveUpBtn.className = 'move-btn move-up';
    moveUpBtn.innerHTML = '↑';
    moveUpBtn.addEventListener('click', () => moveItem(itemId, 'up'));
    
    const moveDownBtn = document.createElement('button');
    moveDownBtn.className = 'move-btn move-down';
    moveDownBtn.innerHTML = '↓';
    moveDownBtn.addEventListener('click', () => moveItem(itemId, 'down'));
    
    moveButtons.appendChild(moveUpBtn);
    moveButtons.appendChild(moveDownBtn);
    itemDiv.appendChild(moveButtons);

    // Item name input
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'item-name';
    nameInput.placeholder = 'Item Name';
    nameInput.value = data.name || '';

    // Item description input
    const descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.className = 'item-desc';
    descInput.placeholder = 'Description';
    descInput.value = data.description || '';

    // Item price input
    const priceInput = document.createElement('input');
    priceInput.type = 'text';
    priceInput.className = 'item-price';
    priceInput.placeholder = 'Price';
    priceInput.value = data.price || '';

    // Active toggle in a container
    const activeToggleContainer = document.createElement('div');
    activeToggleContainer.className = 'active-toggle-container';
    
    const activeToggle = document.createElement('input');
    activeToggle.type = 'checkbox';
    activeToggle.className = 'active-toggle';
    activeToggle.checked = data.active !== false && data.active !== 0;

    const activeLabel = document.createElement('label');
    activeLabel.textContent = 'Active';
    
    activeToggleContainer.appendChild(activeToggle);
    activeToggleContainer.appendChild(activeLabel);

    // Create controls container
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'controls';

    // Delete item button with icon
    const deleteItemBtn = document.createElement('button');
    deleteItemBtn.className = 'btn btn-sm btn-secondary';
    deleteItemBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteItemBtn.title = 'Delete Item';
    deleteItemBtn.addEventListener('click', () => deleteItem(itemId));
    
    // Add delete button to controls
    controlsContainer.appendChild(deleteItemBtn);

    // Add all elements to item div
    itemDiv.appendChild(nameInput);
    itemDiv.appendChild(descInput);
    itemDiv.appendChild(priceInput);
    itemDiv.appendChild(activeToggleContainer);
    itemDiv.appendChild(controlsContainer);

    // Add to the section's items container
    document.querySelector(`#${sectionId} .items`).appendChild(itemDiv);

    if (!data.name) nameInput.focus();

    activeToggle.addEventListener('change', function() {
        itemDiv.classList.toggle('inactive', !this.checked);
        updatePreview();
    });

    if (!activeToggle.checked) itemDiv.classList.add('inactive');

    updateProgress();
    updatePreview();
}

// Delete a section
function deleteSection(sectionId) {
    if (confirm('Are you sure you want to delete this section?')) {
        document.getElementById(sectionId).remove();
        updateProgress();
        updatePreview();
    }
}

// Delete an item
function deleteItem(itemId) {
    if (confirm('Are you sure you want to delete this item?')) {
        document.getElementById(itemId).remove();
        updateProgress();
        updatePreview();
    }
}

// Update the progress indicator
function updateProgress() {
    const sections = document.querySelectorAll('.section-card');
    const totalItems = Array.from(sections).reduce((total, section) => {
        return total + section.querySelectorAll('.item-card').length;
    }, 0);

    const completedItems = Array.from(sections).reduce((total, section) => {
        return total + section.querySelectorAll('.item-card:not(.inactive)').length;
    }, 0);

    const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
    document.getElementById('progress').textContent = `Progress: ${Math.round(progress)}%`;
}

// Update configuration options
let config = {
    showDollarSign: true,
    showSectionDividers: true,
    wrapSpecialChars: true,
    showDecimals: true
};

// Function to properly encode special characters
function encodeSpecialChars(text) {
    if (!config.wrapSpecialChars) return text;
    return text
        .replace(/é/g, '&eacute;')
        .replace(/è/g, '&egrave;')
        .replace(/ê/g, '&ecirc;')
        .replace(/ë/g, '&euml;')
        .replace(/à/g, '&agrave;')
        .replace(/â/g, '&acirc;')
        .replace(/ä/g, '&auml;')
        .replace(/î/g, '&icirc;')
        .replace(/ï/g, '&iuml;')
        .replace(/ô/g, '&ocirc;')
        .replace(/ö/g, '&ouml;')
        .replace(/ù/g, '&ugrave;')
        .replace(/û/g, '&ucirc;')
        .replace(/ü/g, '&uuml;')
        .replace(/ç/g, '&ccedil;')
        .replace(/É/g, '&Eacute;')
        .replace(/È/g, '&Egrave;')
        .replace(/Ê/g, '&Ecirc;')
        .replace(/Ë/g, '&Euml;')
        .replace(/À/g, '&Agrave;')
        .replace(/Â/g, '&Acirc;')
        .replace(/Ä/g, '&Auml;')
        .replace(/Î/g, '&Icirc;')
        .replace(/Ï/g, '&Iuml;')
        .replace(/Ô/g, '&Ocirc;')
        .replace(/Ö/g, '&Ouml;')
        .replace(/Ù/g, '&Ugrave;')
        .replace(/Û/g, '&Ucirc;')
        .replace(/Ü/g, '&Uuml;')
        .replace(/Ç/g, '&Ccedil;');
}

// Update the preview function
function updatePreview() {
    const preview = document.getElementById('menu-preview');
    preview.innerHTML = '';

    const title = encodeSpecialChars(document.getElementById('title').value);
    const subtitle = encodeSpecialChars(document.getElementById('subtitle').value);
    const layout = document.getElementById('layout-select').value;

    if (title) {
        const titleElement = document.createElement('h1');
        titleElement.innerHTML = title;
        preview.appendChild(titleElement);
    }

    if (subtitle) {
        const subtitleElement = document.createElement('h2');
        subtitleElement.innerHTML = subtitle;
        preview.appendChild(subtitleElement);
    }

    const menuContent = document.createElement('div');
    menuContent.className = 'menu-content';

    // Get all sections and sort them by their current order
    const sections = Array.from(document.querySelectorAll('.section-card:not(.inactive)'))
        .map(section => ({
            element: section,
            order: Array.from(section.parentNode.children).indexOf(section)
        }))
        .sort((a, b) => a.order - b.order)
        .map(item => item.element);

    sections.forEach((section, index) => {
        const sectionName = section.querySelector('.section-name').value;
        if (sectionName) {
            const sectionElement = document.createElement('div');
            sectionElement.className = 'menu-section';

            const sectionTitle = document.createElement('h3');
            sectionTitle.innerHTML = encodeSpecialChars(sectionName);
            sectionElement.appendChild(sectionTitle);

            // Get all items and sort them by their current order
            const items = Array.from(section.querySelectorAll('.item-card:not(.inactive)'))
                .map(item => ({
                    element: item,
                    order: Array.from(item.parentNode.children).indexOf(item)
                }))
                .sort((a, b) => a.order - b.order)
                .map(item => item.element);

            items.forEach(item => {
                const itemName = item.querySelector('.item-name').value;
                const itemDesc = item.querySelector('.item-desc').value;
                const itemPrice = item.querySelector('.item-price').value;

                if (itemName) {
                    const itemElement = document.createElement('div');
                    itemElement.className = 'menu-item';

                    const namePrice = document.createElement('div');
                    namePrice.className = 'name-price';

                    const nameSpan = document.createElement('span');
                    nameSpan.innerHTML = encodeSpecialChars(itemName);
                    namePrice.appendChild(nameSpan);

                    if (itemPrice) {
                        const priceSpan = document.createElement('span');
                        
                        // Format price, handling both numeric and text values
                        let formattedPrice = itemPrice;
                        
                        // Check if the price is a valid number
                        if (!isNaN(parseFloat(itemPrice)) && isFinite(itemPrice)) {
                            const price = parseFloat(itemPrice);
                            formattedPrice = config.showDecimals ? price.toFixed(2) : Math.round(price);
                        }
                        
                        // Add dollar sign if configured
                        if (config.showDollarSign && !itemPrice.includes('$')) {
                            formattedPrice = '$' + formattedPrice;
                        }
                        
                        priceSpan.textContent = formattedPrice;
                        namePrice.appendChild(priceSpan);
                    }

                    itemElement.appendChild(namePrice);

                    if (itemDesc) {
                        const descElement = document.createElement('p');
                        descElement.innerHTML = encodeSpecialChars(itemDesc);
                        itemElement.appendChild(descElement);
                    }

                    sectionElement.appendChild(itemElement);
                }
            });

            menuContent.appendChild(sectionElement);

            // Only add divider if:
            // 1. Dividers are enabled
            // 2. This is not the last section
            // 3. The next section is not at the start of a new column
            if (config.showSectionDividers && 
                index < sections.length - 1 && 
                !isAtColumnBreak(sectionElement)) {
                const divider = document.createElement('hr');
                divider.className = 'section-divider';
                menuContent.appendChild(divider);
            }
        }
    });

    if (layout === 'split') {
        menuContent.classList.add('two-columns');
    } else if (layout === 'two-per-page') {
        const wrapper = document.createElement('div');
        wrapper.className = 'two-per-page';
        const menu1 = menuContent.cloneNode(true);
        const menu2 = menuContent.cloneNode(true);
        menu1.className = 'menu';
        menu2.className = 'menu';
        wrapper.appendChild(menu1);
        wrapper.appendChild(menu2);
        preview.appendChild(wrapper);
        return;
    }

    preview.appendChild(menuContent);
}

// Helper function to check if an element is at a column break
function isAtColumnBreak(element) {
    const rect = element.getBoundingClientRect();
    const nextElement = element.nextElementSibling;
    if (!nextElement) return false;
    
    const nextRect = nextElement.getBoundingClientRect();
    return nextRect.top > rect.bottom;
}

// Update the PDF generation
document.getElementById('generate-pdf').addEventListener('click', () => {
    const element = document.getElementById('menu-preview');
    const opt = {
        margin: 1,
        filename: 'menu.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2,
            useCORS: true,
            letterRendering: true,
            logging: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            windowWidth: 800,
            windowHeight: 1200
        },
        jsPDF: { 
            unit: 'in', 
            format: 'letter', 
            orientation: 'portrait'
        }
    };

    // Create a temporary div with the menu content
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '-9999px';
    tempDiv.style.width = '8.5in';
    tempDiv.style.padding = '1in';
    tempDiv.style.backgroundColor = 'white';
    tempDiv.style.fontFamily = document.getElementById('font-select').value;
    tempDiv.style.fontSize = '16px';
    tempDiv.style.lineHeight = '1.5';
    tempDiv.innerHTML = element.innerHTML;
    document.body.appendChild(tempDiv);

    // Wait for fonts to load
    document.fonts.ready.then(() => {
        // Generate PDF from the temporary div
        html2pdf().set(opt).from(tempDiv).save().then(() => {
            document.body.removeChild(tempDiv);
        }).catch(error => {
            console.error('PDF generation error:', error);
            document.body.removeChild(tempDiv);
        });
    });
});

// Generate HTML function
function generateHTML() {
    // Get menu data
    const menuTitle = document.getElementById('title').value;
    const menuSubtitle = document.getElementById('subtitle').value;
    const selectedFont = document.getElementById('font-select').value;
    const layout = document.getElementById('layout-select').value;
    
    // Get all active sections
    const sections = Array.from(document.querySelectorAll('.section-card:not(.inactive)'))
        .map(section => ({
            element: section,
            order: Array.from(section.parentNode.children).indexOf(section)
        }))
        .sort((a, b) => a.order - b.order)
        .map(item => item.element);
        
    // Create menu content for table-based layout
    let tableContent = '';
    
    // If two-column layout, prepare to split sections
    let leftColumnSections = [];
    let rightColumnSections = [];
    
    if (layout === 'split') {
        // For two columns, split sections evenly
        const midpoint = Math.ceil(sections.length / 2);
        leftColumnSections = sections.slice(0, midpoint);
        rightColumnSections = sections.slice(midpoint);
    } else {
        // For single column, all sections go in the left column
        leftColumnSections = sections;
    }
    
    // Generate HTML for sections in table format
    const generateSectionHTML = (section) => {
        const sectionName = section.querySelector('.section-name').value;
        if (!sectionName) return '';
        
        let sectionHTML = `
            <tr>
                <td colspan="2" style="text-align: center; padding-top: 20px; padding-bottom: 10px;">
                    <h3 style="margin: 0; font-weight: normal; font-size: 16pt;">${encodeSpecialChars(sectionName)}</h3>
                </td>
            </tr>
        `;
        
        // Get all active items
        const items = Array.from(section.querySelectorAll('.item-card:not(.inactive)'))
            .map(item => ({
                element: item,
                order: Array.from(item.parentNode.children).indexOf(item)
            }))
            .sort((a, b) => a.order - b.order)
            .map(item => item.element);
            
        items.forEach(item => {
            const itemName = item.querySelector('.item-name').value;
            const itemDesc = item.querySelector('.item-desc').value;
            const itemPrice = item.querySelector('.item-price').value;
            
            if (itemName) {
                // Format price
                let formattedPrice = '';
                if (itemPrice) {
                    // Check if the price is a valid number
                    if (!isNaN(parseFloat(itemPrice)) && isFinite(itemPrice)) {
                        const price = parseFloat(itemPrice);
                        formattedPrice = config.showDecimals ? price.toFixed(2) : Math.round(price);
                        // Add dollar sign if configured
                        if (config.showDollarSign && !itemPrice.includes('$')) {
                            formattedPrice = '$' + formattedPrice;
                        }
                    } else {
                        // For non-numeric prices, keep as is
                        formattedPrice = itemPrice;
                        // Add dollar sign if configured and not already present
                        if (config.showDollarSign && !itemPrice.includes('$')) {
                            formattedPrice = '$' + formattedPrice;
                        }
                    }
                }
                
                sectionHTML += `
                    <tr>
                        <td style="padding: 5px 10px 5px 0; vertical-align: top;">
                            <strong>${encodeSpecialChars(itemName)}</strong>
                            ${itemDesc ? `<br><span style="font-size: 10pt;">${encodeSpecialChars(itemDesc)}</span>` : ''}
                        </td>
                        <td style="padding: 5px 0; text-align: right; vertical-align: top; white-space: nowrap; width: 50px;">
                            ${formattedPrice}
                        </td>
                    </tr>
                `;
            }
        });
        
        // Add section divider if enabled and not the last section
        if (config.showSectionDividers) {
            sectionHTML += `
                <tr>
                    <td colspan="2" style="padding: 10px 0;">
                        <hr style="border: none; border-top: 1px dashed #ddd; margin: 0;">
                    </td>
                </tr>
            `;
        }
        
        return sectionHTML;
    };
    
    // Generate HTML for left column
    let leftColumnHTML = leftColumnSections.map(generateSectionHTML).join('');
    
    // Generate HTML for right column if two-column layout
    let rightColumnHTML = '';
    if (layout === 'split') {
        rightColumnHTML = rightColumnSections.map(generateSectionHTML).join('');
    }
    
    // Create the final HTML with table layout
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Menu</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=${selectedFont.replace(' ', '+')}&display=swap');
                
                @page {
                    size: letter;
                    margin: 0.5in;
                }
                
                body {
                    font-family: '${selectedFont}', serif;
                    margin: 0;
                    padding: 0;
                    background-color: white;
                    color: #333;
                }
                
                .menu-container {
                    max-width: 7.5in;
                    margin: 0 auto;
                    padding: 0;
                }
                
                h1, h2 {
                    text-align: center;
                    margin: 0.25in 0;
                    font-weight: normal;
                }
                
                h1 {
                    font-size: 24pt;
                    margin-bottom: 0.1in;
                }
                
                h2 {
                    font-size: 18pt;
                    margin-bottom: 0.3in;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                
                .menu-content {
                    width: 100%;
                }
                
                .print-button {
                    display: block;
                    margin: 20px auto;
                    padding: 10px 20px;
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 16px;
                    text-align: center;
                }
                
                .print-button:hover {
                    background-color: #45a049;
                }
                
                @media print {
                    .print-button {
                        display: none;
                    }
                    body {
                        width: 8.5in;
                        height: 11in;
                    }
                    .menu-container {
                        max-width: 7.5in;
                    }
                }
            </style>
        </head>
        <body>
            <button class="print-button" onclick="window.print()">Print Menu</button>
            <div class="menu-container">
                ${menuTitle ? `<h1>${encodeSpecialChars(menuTitle)}</h1>` : ''}
                ${menuSubtitle ? `<h2>${encodeSpecialChars(menuSubtitle)}</h2>` : ''}
                <table class="menu-content">
                    ${layout === 'split' ? `
                        <tr>
                            <td style="width: 50%; padding-right: 0.25in; vertical-align: top;">
                                <table style="width: 100%;">
                                    ${leftColumnHTML}
                                </table>
                            </td>
                            <td style="width: 50%; padding-left: 0.25in; vertical-align: top;">
                                <table style="width: 100%;">
                                    ${rightColumnHTML}
                                </table>
                            </td>
                        </tr>
                    ` : `
                        <tr>
                            <td style="vertical-align: top;">
                                <table style="width: 100%;">
                                    ${leftColumnHTML}
                                </table>
                            </td>
                        </tr>
                    `}
                </table>
            </div>
            <script>
                // Force load fonts before printing
                document.fonts.ready.then(function() {
                    console.log('Fonts loaded');
                });
            </script>
        </body>
        </html>
    `;

    // Create a blob and download the file
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'menu.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Save menu
document.getElementById('save-menu').addEventListener('click', async () => {
    const menuName = document.getElementById('menu-name').value;
    if (!menuName) {
        alert('Please enter a menu name');
        return;
    }

    // Get all sections and sort them by their current order in the DOM
    const sections = Array.from(document.querySelectorAll('.section-card'))
        .map((section, index) => ({
            name: section.querySelector('.section-name').value,
            active: section.querySelector('.active-toggle').checked,
            items: Array.from(section.querySelectorAll('.item-card'))
                .map((item, itemIndex) => ({
                    name: item.querySelector('.item-name').value,
                    description: item.querySelector('.item-desc').value,
                    price: item.querySelector('.item-price').value,
                    active: item.querySelector('.active-toggle').checked,
                    position: itemIndex
                })),
            position: index
        }));

    const menuData = {
        name: menuName,
        title: document.getElementById('title').value,
        subtitle: document.getElementById('subtitle').value,
        font: document.getElementById('font-select').value,
        layout: document.getElementById('layout-select').value,
        showDollarSign: config.showDollarSign,
        showDecimals: config.showDecimals,
        showSectionDividers: config.showSectionDividers,
        wrapSpecialChars: config.wrapSpecialChars,
        sections: sections
    };

    try {
        // Check if this menu name already exists
        const checkResponse = await fetch('/api/menus');
        const existingMenus = await checkResponse.json();
        const menuExists = existingMenus.some(menu => menu.name === menuName);
        
        // Use PUT if updating an existing menu, POST if creating a new one
        const method = menuExists ? 'PUT' : 'POST';
        const url = menuExists ? `/api/menus/${menuName}` : '/api/menus';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(menuData)
        });

        if (response.ok) {
            updateMenuSelect();
            alert('Menu saved successfully!');
        } else {
            const error = await response.json();
            alert(`Error saving menu: ${error.error}`);
        }
    } catch (error) {
        alert('Error saving menu. Please try again.');
        console.error('Error:', error);
    }
});

// Load menu
document.getElementById('load-menu').addEventListener('click', async () => {
    const menuName = document.getElementById('menu-select').value;
    if (!menuName) {
        alert('Please select a menu to load');
        return;
    }

    try {
        const response = await fetch(`/api/menus/${menuName}`);
        if (response.ok) {
            const menuData = await response.json();
            
            // Populate the menu name field
            document.getElementById('menu-name').value = menuData.name;
            
            document.getElementById('title').value = menuData.title || '';
            document.getElementById('subtitle').value = menuData.subtitle || '';
            document.getElementById('font-select').value = menuData.font || 'Playfair Display';
            document.getElementById('layout-select').value = menuData.layout || 'single';
            loadFont(menuData.font || 'Playfair Display');
            
            // Update configuration options
            config.showDollarSign = menuData.show_dollar_sign !== undefined ? menuData.show_dollar_sign : true;
            config.showDecimals = menuData.show_decimals !== undefined ? menuData.show_decimals : true;
            config.showSectionDividers = menuData.show_section_dividers !== undefined ? menuData.show_section_dividers : true;
            config.wrapSpecialChars = menuData.wrap_special_chars !== undefined ? menuData.wrap_special_chars : true;
            
            // Update configuration controls
            document.getElementById('show-dollar-sign').checked = config.showDollarSign;
            document.getElementById('show-decimals').checked = config.showDecimals;
            document.getElementById('show-dividers').checked = config.showSectionDividers;
            document.getElementById('wrap-special-chars').checked = config.wrapSpecialChars;

            document.getElementById('sections').innerHTML = '';
            
            // Sort sections by position
            const sortedSections = [...menuData.sections].sort((a, b) => a.position - b.position);
            sortedSections.forEach(section => {
                // Sort items by position
                if (section.items) {
                    section.items = [...section.items].sort((a, b) => a.position - b.position);
                    console.log('Loading section:', section.name, 'active:', section.active);
                    section.items.forEach(item => {
                        console.log('Loading item:', item.name, 'active:', item.active);
                    });
                }
                addSection(section);
            });

            updatePreview();
        } else {
            const error = await response.json();
            alert(`Error loading menu: ${error.error}`);
        }
    } catch (error) {
        alert('Error loading menu. Please try again.');
        console.error('Error:', error);
    }
});

// Delete menu
document.getElementById('delete-menu').addEventListener('click', async () => {
    const menuName = document.getElementById('menu-select').value;
    if (!menuName) {
        alert('Please select a menu to delete');
        return;
    }

    if (confirm(`Are you sure you want to delete the menu "${menuName}"?`)) {
        try {
            const response = await fetch(`/api/menus/${menuName}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                updateMenuSelect();
                alert('Menu deleted successfully!');
            } else {
                const error = await response.json();
                alert(`Error deleting menu: ${error.error}`);
            }
        } catch (error) {
            alert('Error deleting menu. Please try again.');
            console.error('Error:', error);
        }
    }
});

// Update menu select dropdown
async function updateMenuSelect() {
    try {
        const response = await fetch('/api/menus');
        if (response.ok) {
            const menus = await response.json();
            const select = document.getElementById('menu-select');
            select.innerHTML = '<option value="">Select a menu</option>';
            
            menus.forEach(menu => {
                const option = document.createElement('option');
                option.value = menu.name;
                option.textContent = menu.name;
                select.appendChild(option);
            });
        } else {
            const error = await response.json();
            console.error('Error fetching menus:', error);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Move section up or down
function moveSection(sectionId, direction) {
    const section = document.getElementById(sectionId);
    const sections = document.getElementById('sections');
    const currentIndex = Array.from(sections.children).indexOf(section);
    
    if (direction === 'up' && currentIndex > 0) {
        sections.insertBefore(section, sections.children[currentIndex - 1]);
    } else if (direction === 'down' && currentIndex < sections.children.length - 1) {
        sections.insertBefore(section, sections.children[currentIndex + 1].nextSibling);
    }
    
    updatePreview();
}

// Move item up or down
function moveItem(itemId, direction) {
    const item = document.getElementById(itemId);
    const itemsContainer = item.parentNode;
    const currentIndex = Array.from(itemsContainer.children).indexOf(item);
    
    if (direction === 'up' && currentIndex > 0) {
        itemsContainer.insertBefore(item, itemsContainer.children[currentIndex - 1]);
    } else if (direction === 'down' && currentIndex < itemsContainer.children.length - 1) {
        itemsContainer.insertBefore(item, itemsContainer.children[currentIndex + 1].nextSibling);
    }
    
    updatePreview();
}

// Update configuration controls
function addConfigurationControls() {
    const controls = document.createElement('div');
    controls.className = 'config-controls';
    controls.innerHTML = `
        <div class="config-option">
            <label>
                <input type="checkbox" id="show-dollar-sign" ${config.showDollarSign ? 'checked' : ''}>
                Show Dollar Sign
            </label>
        </div>
        <div class="config-option">
            <label>
                <input type="checkbox" id="show-decimals" ${config.showDecimals ? 'checked' : ''}>
                Show Decimals
            </label>
        </div>
        <div class="config-option">
            <label>
                <input type="checkbox" id="show-dividers" ${config.showSectionDividers ? 'checked' : ''}>
                Show Section Dividers
            </label>
        </div>
        <div class="config-option">
            <label>
                <input type="checkbox" id="wrap-special-chars" ${config.wrapSpecialChars ? 'checked' : ''}>
                Properly Encode Special Characters
            </label>
        </div>
    `;

    document.querySelector('.container').insertBefore(controls, document.getElementById('menu-builder'));

    // Add event listeners for configuration changes
    document.getElementById('show-dollar-sign').addEventListener('change', (e) => {
        config.showDollarSign = e.target.checked;
        updatePreview();
    });

    document.getElementById('show-decimals').addEventListener('change', (e) => {
        config.showDecimals = e.target.checked;
        updatePreview();
    });

    document.getElementById('show-dividers').addEventListener('change', (e) => {
        config.showSectionDividers = e.target.checked;
        updatePreview();
    });

    document.getElementById('wrap-special-chars').addEventListener('change', (e) => {
        config.wrapSpecialChars = e.target.checked;
        updatePreview();
    });
}

// Add print button to preview section
function addPrintButton() {
    const preview = document.getElementById('menu-preview');
    const printButton = document.createElement('button');
    printButton.className = 'btn btn-primary print-btn';
    printButton.textContent = 'Print Menu';
    
    printButton.addEventListener('click', () => {
        // Get current menu settings
        const menuContent = preview.innerHTML;
        const selectedFont = document.getElementById('font-select').value;
        const layout = document.getElementById('layout-select').value;
        
        // Create iframe for printing
        let iframe = document.getElementById('print-frame');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'print-frame';
            iframe.name = 'print-frame';
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);
        }
        
        // Wait for iframe to load before accessing its content
        iframe.onload = function() {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            const head = doc.head;
            const body = doc.body;
            
            // Add meta tag for proper encoding
            const meta = doc.createElement('meta');
            meta.setAttribute('charset', 'UTF-8');
            head.appendChild(meta);
            
            // Add title
            const title = doc.createElement('title');
            title.textContent = 'Menu Print';
            head.appendChild(title);
            
            // Add styles to the iframe
            const style = doc.createElement('style');
            style.textContent = `
                @import url('https://fonts.googleapis.com/css2?family=${selectedFont.replace(' ', '+')}&display=swap');
                
                @page {
                    size: letter;
                    margin: 0.5in;
                }
                
                body {
                    font-family: '${selectedFont}', serif;
                    margin: 0;
                    padding: 0;
                    background-color: white;
                    color: #333;
                }
                
                .menu-content {
                    max-width: 7.5in;
                    margin: 0 auto;
                    padding: 0;
                }
                
                h1, h2, h3 {
                    text-align: center;
                    margin: 0.25in 0;
                    font-weight: normal;
                }
                
                h1 {
                    font-size: 24pt;
                    margin-bottom: 0.25in;
                }
                
                h2 {
                    font-size: 18pt;
                    margin-bottom: 0.25in;
                }
                
                h3 {
                    font-size: 16pt;
                    margin-bottom: 0.25in;
                }
                
                .menu-section {
                    break-inside: avoid;
                    page-break-inside: avoid;
                    margin-bottom: 0.25in;
                }
                
                .menu-item {
                    break-inside: avoid;
                    page-break-inside: avoid;
                    margin-bottom: 0.125in;
                }
                
                .name-price {
                    display: flex;
                    justify-content: space-between;
                    break-inside: avoid;
                    page-break-inside: avoid;
                }
                
                .section-divider {
                    border: none;
                    border-top: 1px dashed #ddd;
                    margin: 0.25in 0;
                    break-inside: avoid;
                    page-break-inside: avoid;
                }
                
                .two-columns {
                    column-count: 2;
                    column-gap: 0.3in;
                    column-fill: balance;
                    height: 9in; /* Ensure columns balance properly */
                }
                
                /* Fix for Firefox */
                @-moz-document url-prefix() {
                    .two-columns {
                        height: auto;
                        max-height: 9in;
                    }
                }
            `;
            head.appendChild(style);
            
            // Set the content
            body.innerHTML = `<div class="menu-content ${layout === 'split' ? 'two-columns' : ''}">${menuContent}</div>`;
            
            // Print after a short delay to ensure styles and fonts are loaded
            setTimeout(() => {
                iframe.contentWindow.print();
            }, 1000);
        };
        
        // Set the iframe source to a blank page
        iframe.src = 'about:blank';
    });
    
    preview.parentNode.insertBefore(printButton, preview);
}

// Document loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize preview button
    document.getElementById('preview-button').addEventListener('click', function() {
        document.querySelector('.preview').scrollIntoView({ behavior: 'smooth' });
    });
    
    // Initialize configuration options from the sidebar
    document.getElementById('show-dollar-sign').addEventListener('change', (e) => {
        config.showDollarSign = e.target.checked;
        updatePreview();
    });

    document.getElementById('show-decimals').addEventListener('change', (e) => {
        config.showDecimals = e.target.checked;
        updatePreview();
    });

    document.getElementById('show-dividers').addEventListener('change', (e) => {
        config.showSectionDividers = e.target.checked;
        updatePreview();
    });

    document.getElementById('wrap-special-chars').addEventListener('change', (e) => {
        config.wrapSpecialChars = e.target.checked;
        updatePreview();
    });
    
    // Add section button
    document.getElementById('add-section').addEventListener('click', () => addSection());
    
    // Font and layout event listeners
    document.getElementById('font-select').addEventListener('change', (e) => loadFont(e.target.value));
    document.getElementById('layout-select').addEventListener('change', updatePreview);
    
    // Add print button
    addPrintButton();
    
    // Initialize menu select
    updateMenuSelect();
    
    // Add event listener for HTML generation button (already in HTML)
    document.getElementById('generate-html').addEventListener('click', generateHTML);
    
    // Allow clicking anywhere in section header to toggle collapse
    document.addEventListener('click', function(e) {
        const sectionHeader = e.target.closest('.section-header');
        if (sectionHeader && !e.target.closest('input, button')) {
            const sectionId = sectionHeader.closest('.section-card').id;
            toggleSection(sectionId);
        }
    });
}); 