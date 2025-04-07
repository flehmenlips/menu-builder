let sectionCounter = 0;
let itemCounter = 0;
let spacerCounter = 0;

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
    sectionDiv.dataset.type = 'section';

    // Add move buttons
    const moveButtons = document.createElement('div');
    moveButtons.className = 'move-buttons';
    
    const moveUpBtn = document.createElement('button');
    moveUpBtn.className = 'move-btn move-up';
    moveUpBtn.innerHTML = '↑';
    moveUpBtn.addEventListener('click', () => moveElement(sectionId, 'up'));
    
    const moveDownBtn = document.createElement('button');
    moveDownBtn.className = 'move-btn move-down';
    moveDownBtn.innerHTML = '↓';
    moveDownBtn.addEventListener('click', () => moveElement(sectionId, 'down'));
    
    moveButtons.appendChild(moveUpBtn);
    moveButtons.appendChild(moveDownBtn);
    sectionDiv.appendChild(moveButtons);

    // Create section header
    const header = document.createElement('div');
    header.className = 'section-header';
    
    // Create section name field container
    const nameFieldContainer = document.createElement('div');
    nameFieldContainer.className = 'section-name-container';
    
    // Add label for section name
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Menu Section Title';
    nameLabel.className = 'section-name-label';
    nameFieldContainer.appendChild(nameLabel);
    
    // Common section names for dropdown
    const commonSectionNames = [
        'Appetizers',
        'Salads',
        'Soups',
        'Pastas',
        'Main Courses',
        'Entrées',
        'Desserts',
        'Wine',
        'Beverages',
        'Sides',
        'Specials',
        'Breakfast',
        'Lunch',
        'Dinner',
        'Cocktails',
        'Beer'
    ];
    
    // Create section name select
    const nameSelect = document.createElement('select');
    nameSelect.className = 'section-name';
    
    // Add empty option as placeholder
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = 'Select a section or add custom';
    placeholderOption.disabled = !data.name; // Disable placeholder if we have a value
    placeholderOption.selected = !data.name; // Select placeholder if no value
    nameSelect.appendChild(placeholderOption);
    
    // Add common section options
    commonSectionNames.forEach(sectionName => {
        const option = document.createElement('option');
        option.value = sectionName;
        option.textContent = sectionName;
        option.selected = data.name === sectionName;
        nameSelect.appendChild(option);
    });
    
    // Add custom option
    const customOption = document.createElement('option');
    customOption.value = 'custom';
    customOption.textContent = '+ Add Custom Section';
    nameSelect.appendChild(customOption);
    
    // If we have a custom name, add it as an option and select it
    if (data.name && !commonSectionNames.includes(data.name)) {
        const customNameOption = document.createElement('option');
        customNameOption.value = data.name;
        customNameOption.textContent = data.name;
        customNameOption.selected = true;
        nameSelect.insertBefore(customNameOption, customOption);
    }
    
    // Handle custom section selection
    nameSelect.addEventListener('change', function() {
        if (this.value === 'custom') {
            const customName = prompt('Enter custom section name:');
            if (customName) {
                // Check if option already exists
                let exists = false;
                for (let i = 0; i < this.options.length; i++) {
                    if (this.options[i].value === customName) {
                        exists = true;
                        this.value = customName;
                        break;
                    }
                }
                
                // Add new option if doesn't exist
                if (!exists) {
                    const newOption = document.createElement('option');
                    newOption.value = customName;
                    newOption.textContent = customName;
                    this.insertBefore(newOption, customOption);
                    this.value = customName;
                }
            } else {
                // If user cancels, revert to previous selection or placeholder
                this.value = data.name || '';
            }
        }
        
        // Update preview when section name changes
        updatePreview();
        markUnsavedChanges();
    });
    
    nameFieldContainer.appendChild(nameSelect);
    header.appendChild(nameFieldContainer);

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

    // Focus the select if there's no name
    if (!data.name) nameSelect.focus();

    activeToggle.addEventListener('change', function() {
        sectionDiv.classList.toggle('inactive', !this.checked);
        updatePreview();
    });

    if (!activeToggle.checked) sectionDiv.classList.add('inactive');

    if (data.items) {
        data.items.forEach(itemData => addItem(sectionId, itemData));
    }

    updateProgress();
    updatePreview();
    markUnsavedChanges();
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

    // Create field containers for better organization
    const nameContainer = document.createElement('div');
    nameContainer.className = 'field-container';
    
    const descContainer = document.createElement('div');
    descContainer.className = 'field-container';
    
    const priceContainer = document.createElement('div');
    priceContainer.className = 'field-container';

    // Item name label and input
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Item Name';
    nameLabel.className = 'field-label';
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'item-name';
    nameInput.placeholder = 'Item Name';
    nameInput.value = data.name || '';
    
    nameContainer.appendChild(nameLabel);
    nameContainer.appendChild(nameInput);

    // Item description label and textarea
    const descLabel = document.createElement('label');
    descLabel.textContent = 'Description';
    descLabel.className = 'field-label';
    
    const descInput = document.createElement('textarea');
    descInput.className = 'item-desc';
    descInput.placeholder = 'Description';
    descInput.value = data.description || '';
    descInput.rows = 3;
    
    descContainer.appendChild(descLabel);
    descContainer.appendChild(descInput);

    // Item price label and input
    const priceLabel = document.createElement('label');
    priceLabel.textContent = 'Price';
    priceLabel.className = 'field-label';
    
    const priceInput = document.createElement('input');
    priceInput.type = 'text';
    priceInput.className = 'item-price';
    priceInput.placeholder = 'Price';
    priceInput.value = data.price || '';
    
    priceContainer.appendChild(priceLabel);
    priceContainer.appendChild(priceInput);

    // Active toggle in a container
    const activeToggleContainer = document.createElement('div');
    activeToggleContainer.className = 'active-toggle-container';
    
    const activeToggle = document.createElement('input');
    activeToggle.type = 'checkbox';
    activeToggle.className = 'active-toggle';
    activeToggle.id = `active-${itemId}`;
    activeToggle.checked = data.active !== false && data.active !== 0;

    const activeLabel = document.createElement('label');
    activeLabel.textContent = 'Active';
    activeLabel.htmlFor = `active-${itemId}`;
    
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

    // Action container for active toggle and controls
    const actionContainer = document.createElement('div');
    actionContainer.className = 'action-container';
    actionContainer.appendChild(activeToggleContainer);
    actionContainer.appendChild(controlsContainer);

    // Add all elements to item div
    itemDiv.appendChild(nameContainer);
    itemDiv.appendChild(descContainer);
    itemDiv.appendChild(priceContainer);
    itemDiv.appendChild(actionContainer);

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
    markUnsavedChanges();
}

// Delete a section
function deleteSection(sectionId) {
    if (confirm('Are you sure you want to delete this section?')) {
        document.getElementById(sectionId).remove();
        updateProgress();
        updatePreview();
        markUnsavedChanges();
    }
}

// Delete an item
function deleteItem(itemId) {
    if (confirm('Are you sure you want to delete this item?')) {
        document.getElementById(itemId).remove();
        updateProgress();
        updatePreview();
        markUnsavedChanges();
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
    showDecimals: true
};

// Function to properly encode special characters
function encodeSpecialChars(text) {
    if (!text) return '';
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

    // Get all elements and sort them by their current order
    let elements = Array.from(document.getElementById('sections').children)
        .map(element => ({
            element,
            type: element.dataset.type || 'section',
            isActive: !element.classList.contains('inactive')
        }))
        .filter(item => item.isActive);

    elements.forEach((item, index) => {
        if (item.type === 'spacer') {
            // Add a spacer to the preview
            const spacerElement = item.element;
            const spacerHeight = spacerElement.querySelector('.spacer-size').value;
            const spacerUnit = spacerElement.querySelector('.spacer-unit-select').value;
            
            const spacerDiv = document.createElement('div');
            spacerDiv.className = 'menu-spacer';
            spacerDiv.style.height = `${spacerHeight}${spacerUnit}`;
            
            menuContent.appendChild(spacerDiv);
        } else {
            // Handle section
            const section = item.element;
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
                    const nameInput = item.querySelector('.item-name');
                    const descInput = item.querySelector('.item-desc');
                    const priceInput = item.querySelector('.item-price');
                    
                    const itemName = nameInput ? nameInput.value : '';
                    const itemDesc = descInput ? descInput.value : '';
                    const itemPrice = priceInput ? priceInput.value : '';

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
                const isLastSection = index === elements.length - 1;
                const isNextElementSpacer = !isLastSection && elements[index + 1].type === 'spacer';
                
                if (config.showSectionDividers && 
                    !isLastSection && 
                    !isNextElementSpacer &&
                    !isAtColumnBreak(sectionElement)) {
                    const divider = document.createElement('hr');
                    divider.className = 'section-divider';
                    menuContent.appendChild(divider);
                }
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

// Generate HTML function
function generateHTML(forPrint = false) {
    // Get menu data
    const title = encodeSpecialChars(document.getElementById('title').value);
    const subtitle = encodeSpecialChars(document.getElementById('subtitle').value);
    const fontFamily = document.getElementById('font-select').value;
    const layout = document.getElementById('layout-select').value;
    
    // Get all elements and filter out inactive ones
    const elements = Array.from(document.getElementById('sections').children)
        .map(element => ({
            element,
            type: element.dataset.type || 'section',
            isActive: !element.classList.contains('inactive')
        }))
        .filter(item => item.isActive);
    
    // Generate HTML for elements (sections and spacers)
    const generateElementsHTML = (elementItems) => {
        let htmlContent = '';
        
        elementItems.forEach((item, index) => {
            if (item.type === 'spacer') {
                // Generate HTML for spacer
                const spacerElement = item.element;
                const spacerHeight = spacerElement.querySelector('.spacer-size').value;
                const spacerUnit = spacerElement.querySelector('.spacer-unit-select').value;
                
                htmlContent += `
                    <tr>
                        <td colspan="2" style="height: ${spacerHeight}${spacerUnit};"></td>
                    </tr>
                `;
            } else {
                // Generate HTML for section
                const section = item.element;
                const sectionName = section.querySelector('.section-name').value;
                if (sectionName) {
                    htmlContent += `
                        <tr class="section-header">
                            <td colspan="2"><h2>${encodeSpecialChars(sectionName)}</h2></td>
                        </tr>
                    `;
                    
                    // Get items in the section and sort them
                    const items = Array.from(section.querySelectorAll('.item-card:not(.inactive)'))
                        .map(item => ({
                            element: item,
                            order: Array.from(item.parentNode.children).indexOf(item)
                        }))
                        .sort((a, b) => a.order - b.order)
                        .map(item => item.element);
                        
                    items.forEach(item => {
                        const nameInput = item.querySelector('.item-name');
                        const descInput = item.querySelector('.item-desc');
                        const priceInput = item.querySelector('.item-price');
                        
                        const itemName = nameInput ? nameInput.value : '';
                        const itemDesc = descInput ? descInput.value : '';
                        const itemPrice = priceInput ? priceInput.value : '';
                        
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
                            
                            // Add item HTML
                            htmlContent += `
                                <tr class="menu-item">
                                    <td class="item-info">
                                        <div class="item-name">${encodeSpecialChars(itemName)}</div>
                                        ${itemDesc ? `<div class="item-description">${encodeSpecialChars(itemDesc)}</div>` : ''}
                                    </td>
                                    <td class="item-price">${formattedPrice}</td>
                                </tr>
                            `;
                        }
                    });
                    
                    // Add section divider if it's not the last section
                    const isLastSection = index === elementItems.length - 1;
                    const isNextElementSpacer = !isLastSection && elementItems[index + 1].type === 'spacer';
                    
                    if (config.showSectionDividers && !isLastSection && !isNextElementSpacer) {
                        htmlContent += `
                            <tr class="section-divider">
                                <td colspan="2"><hr /></td>
                            </tr>
                        `;
                    }
                }
            }
        });
        
        return htmlContent;
    };
    
    // Generate HTML for left column
    let leftColumnHTML = generateElementsHTML(elements.slice(0, Math.ceil(elements.length / 2)));
    
    // Generate HTML for right column if two-column layout
    let rightColumnHTML = '';
    if (layout === 'split') {
        rightColumnHTML = generateElementsHTML(elements.slice(Math.ceil(elements.length / 2)));
    }
    
    // Create the final HTML with table layout
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${encodeSpecialChars(title || 'Menu')}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=${fontFamily.replace(' ', '+')}&display=swap');
                
                @page {
                    size: letter;
                    margin: 0.5in;
                }
                
                body {
                    font-family: '${fontFamily}', serif;
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
                    
                    /* Fix for blank page issue */
                    html, body {
                        overflow: hidden;
                        page-break-after: avoid;
                    }
                    
                    .menu-content {
                        page-break-before: avoid;
                        page-break-after: avoid;
                    }
                }
            </style>
        </head>
        <body>
            <button class="print-button" onclick="printMenu()">Print Menu</button>
            <div class="menu-container">
                ${title ? `<h1>${encodeSpecialChars(title)}</h1>` : ''}
                ${subtitle ? `<h2>${encodeSpecialChars(subtitle)}</h2>` : ''}
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
                
                // Improved print function
                function printMenu() {
                    // Wait for fonts to load
                    document.fonts.ready.then(function() {
                        // Hide UI elements for printing
                        const printButton = document.querySelector('.print-button');
                        if (printButton) {
                            printButton.style.display = 'none';
                        }
                        
                        // Print after a small delay to ensure everything is rendered
                        setTimeout(function() {
                            window.print();
                            
                            // Show UI elements again after printing
                            if (printButton) {
                                printButton.style.display = 'block';
                            }
                        }, 300);
                    });
                }
                
                ${forPrint ? 'window.onload = function() { printMenu(); };' : ''}
            </script>
        </body>
        </html>
    `;

    // Open in a new tab
    const newTab = window.open();
    newTab.document.write(html);
    newTab.document.close();
}

// Add variable to track unsaved changes
let hasUnsavedChanges = false;
let initialState = null;

// Function to mark changes as unsaved
function markUnsavedChanges() {
    // Only mark as unsaved if different from initial state
    const currentState = getMenuState();
    if (initialState && JSON.stringify(currentState) !== JSON.stringify(initialState)) {
        hasUnsavedChanges = true;
    }
}

// Function to get current menu state for comparison
function getMenuState() {
    const elements = Array.from(document.getElementById('sections').children)
        .map((element, index) => {
            const elementType = element.dataset.type || 'section';

            if (elementType === 'spacer') {
                return {
                    type: 'spacer',
                    size: element.querySelector('.spacer-size').value,
                    unit: element.querySelector('.spacer-unit-select').value
                };
            } else {
                return {
                    type: 'section',
                    name: element.querySelector('.section-name').value,
                    active: element.querySelector('.active-toggle').checked,
                    items: Array.from(element.querySelectorAll('.item-card'))
                        .map(item => ({
                            name: item.querySelector('.item-name').value,
                            description: item.querySelector('.item-desc').value,
                            price: item.querySelector('.item-price').value,
                            active: item.querySelector('.active-toggle').checked
                        }))
                };
            }
        });

    return {
        name: document.getElementById('menu-name').value,
        title: document.getElementById('title').value,
        subtitle: document.getElementById('subtitle').value,
        font: document.getElementById('font-select').value,
        layout: document.getElementById('layout-select').value,
        showDollarSign: config.showDollarSign,
        showDecimals: config.showDecimals,
        showSectionDividers: config.showSectionDividers,
        elements: elements
    };
}

// Function to mark changes as saved
function markChangesSaved() {
    hasUnsavedChanges = false;
    initialState = getMenuState();
}

// Function to check if there are unsaved changes and confirm action
function confirmIfUnsavedChanges(action) {
    if (hasUnsavedChanges) {
        return confirm('You have unsaved changes. Are you sure you want to proceed?');
    }
    return true;
}

// Function to load a menu by name
async function loadMenu(menuName) {
    if (!menuName) {
        alert('Please select a menu to load');
        return false;
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
            
            // Update configuration controls
            document.getElementById('show-dollar-sign').checked = config.showDollarSign;
            document.getElementById('show-decimals').checked = config.showDecimals;
            document.getElementById('show-dividers').checked = config.showSectionDividers;

            document.getElementById('sections').innerHTML = '';
            
            // Handle both new format (with elements) and old format (with sections)
            if (menuData.elements) {
                // Sort elements by position
                const sortedElements = [...menuData.elements].sort((a, b) => a.position - b.position);
                
                // Add each element based on its type
                sortedElements.forEach(element => {
                    if (element.type === 'spacer') {
                        addSpacer({
                            size: element.size,
                            unit: element.unit
                        });
                    } else if (element.type === 'section') {
                        // Sort items by position
                        if (element.items) {
                            element.items = [...element.items].sort((a, b) => a.position - b.position);
                        }
                        addSection({
                            name: element.name,
                            active: element.active,
                            items: element.items
                        });
                    }
                });
            } else if (menuData.sections) {
                // Legacy format support
                // Sort sections by position
                const sortedSections = [...menuData.sections].sort((a, b) => a.position - b.position);
                sortedSections.forEach(section => {
                    // Sort items by position
                    if (section.items) {
                        section.items = [...section.items].sort((a, b) => a.position - b.position);
                    }
                    addSection(section);
                });
            }

            updatePreview();
            
            // Initialize the state after loading
            setTimeout(() => {
                markChangesSaved();
            }, 100);
            
            return true;
        } else {
            const error = await response.json();
            alert(`Error loading menu: ${error.error}`);
            return false;
        }
    } catch (error) {
        alert('Error loading menu. Please try again.');
        console.error('Error:', error);
        return false;
    }
}

// Save menu
document.getElementById('save-menu').addEventListener('click', async () => {
    const menuName = document.getElementById('menu-name').value;
    if (!menuName) {
        alert('Please enter a menu name');
        return;
    }

    // Get all elements (sections and spacers) in their current order
    const elements = Array.from(document.getElementById('sections').children)
        .map((element, index) => {
            const elementType = element.dataset.type || 'section';

            if (elementType === 'spacer') {
                return {
                    type: 'spacer',
                    size: element.querySelector('.spacer-size').value,
                    unit: element.querySelector('.spacer-unit-select').value,
                    position: index
                };
            } else {
                return {
                    type: 'section',
                    name: element.querySelector('.section-name').value,
                    active: element.querySelector('.active-toggle').checked,
                    items: Array.from(element.querySelectorAll('.item-card'))
                        .map((item, itemIndex) => ({
                            name: item.querySelector('.item-name').value,
                            description: item.querySelector('.item-desc').value,
                            price: item.querySelector('.item-price').value,
                            active: item.querySelector('.active-toggle').checked,
                            position: itemIndex
                        })),
                    position: index
                };
            }
        });

    const menuData = {
        name: menuName,
        title: document.getElementById('title').value,
        subtitle: document.getElementById('subtitle').value,
        font: document.getElementById('font-select').value,
        layout: document.getElementById('layout-select').value,
        showDollarSign: config.showDollarSign,
        showDecimals: config.showDecimals,
        showSectionDividers: config.showSectionDividers,
        elements: elements
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
            markChangesSaved();
        } else {
            const error = await response.json();
            alert(`Error saving menu: ${error.error}`);
        }
    } catch (error) {
        alert('Error saving menu. Please try again.');
        console.error('Error:', error);
    }
});

// New Menu button
const newMenuBtn = document.getElementById('new-menu');
if (newMenuBtn) {
    newMenuBtn.addEventListener('click', () => {
        if (confirmIfUnsavedChanges()) {
            clearMenu();
        }
    });
}

// Function to clear the current menu
function clearMenu() {
    document.getElementById('menu-name').value = '';
    document.getElementById('title').value = '';
    document.getElementById('subtitle').value = '';
    document.getElementById('font-select').value = 'Playfair Display';
    document.getElementById('layout-select').value = 'single';
    document.getElementById('sections').innerHTML = '';
    loadFont('Playfair Display');
    
    // Reset menu select
    document.getElementById('menu-select').value = '';
    
    // Update preview
    updatePreview();
    
    // Mark as saved (no changes to save yet)
    markChangesSaved();
}

// Add duplicate menu functionality
document.getElementById('duplicate-menu').addEventListener('click', async () => {
    const menuName = document.getElementById('menu-select').value;
    if (!menuName) {
        alert('Please select a menu to duplicate');
        return;
    }

    // Prompt for new name
    const newMenuName = prompt('Enter name for the duplicated menu:', `${menuName} - Copy`);
    if (!newMenuName) return; // User cancelled

    try {
        // First load the menu to duplicate
        const response = await fetch(`/api/menus/${menuName}`);
        if (!response.ok) {
            const error = await response.json();
            alert(`Error duplicating menu: ${error.error}`);
            return;
        }
        
        const menuData = await response.json();
        
        // Create a new menu with the same data but new name
        const duplicatedMenu = {
            name: newMenuName,
            title: menuData.title || '',
            subtitle: menuData.subtitle || '',
            font: menuData.font || 'Playfair Display',
            layout: menuData.layout || 'single',
            showDollarSign: menuData.show_dollar_sign !== undefined ? menuData.show_dollar_sign : true,
            showDecimals: menuData.show_decimals !== undefined ? menuData.show_decimals : true,
            showSectionDividers: menuData.show_section_dividers !== undefined ? menuData.show_section_dividers : true,
            elements: menuData.elements || menuData.sections?.map(s => ({...s, type: 'section'})) || []
        };
        
        // Save the duplicated menu
        const saveResponse = await fetch('/api/menus', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(duplicatedMenu)
        });
        
        if (saveResponse.ok) {
            await updateMenuSelect();
            alert(`Menu duplicated as "${newMenuName}"`);
            
            // Select the new menu in the dropdown
            const menuSelect = document.getElementById('menu-select');
            menuSelect.value = newMenuName;
            
            // Load the duplicated menu
            await loadMenu(newMenuName);
        } else {
            const error = await saveResponse.json();
            alert(`Error creating duplicated menu: ${error.error}`);
        }
    } catch (error) {
        alert('Error duplicating menu. Please try again.');
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
                // Clear the current menu if we just deleted it
                if (document.getElementById('menu-name').value === menuName) {
                    document.getElementById('menu-name').value = '';
                    document.getElementById('sections').innerHTML = '';
                    document.getElementById('title').value = '';
                    document.getElementById('subtitle').value = '';
                    updatePreview();
                }
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

// Move any element (section or spacer) up or down
function moveElement(elementId, direction) {
    const element = document.getElementById(elementId);
    const container = document.getElementById('sections');
    const currentIndex = Array.from(container.children).indexOf(element);
    
    if (direction === 'up' && currentIndex > 0) {
        container.insertBefore(element, container.children[currentIndex - 1]);
    } else if (direction === 'down' && currentIndex < container.children.length - 1) {
        container.insertBefore(element, container.children[currentIndex + 1].nextSibling);
    }
    
    updatePreview();
    markUnsavedChanges();
}

// Update the moveSection function to use moveElement
function moveSection(sectionId, direction) {
    moveElement(sectionId, direction);
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
        markUnsavedChanges();
    });

    document.getElementById('show-decimals').addEventListener('change', (e) => {
        config.showDecimals = e.target.checked;
        updatePreview();
        markUnsavedChanges();
    });

    document.getElementById('show-dividers').addEventListener('change', (e) => {
        config.showSectionDividers = e.target.checked;
        updatePreview();
        markUnsavedChanges();
    });
    
    // Add section button
    document.getElementById('add-section').addEventListener('click', () => addSection());
    
    // Font and layout event listeners
    document.getElementById('font-select').addEventListener('change', (e) => {
        loadFont(e.target.value);
        markUnsavedChanges();
    });
    
    document.getElementById('layout-select').addEventListener('change', () => {
        updatePreview();
        markUnsavedChanges();
    });
    
    // Add spacer button
    document.getElementById('add-spacer').addEventListener('click', () => addSpacer());
    
    // Generate HTML button
    document.getElementById('generate-html').addEventListener('click', () => generateHTML(false));
    
    // Print menu button in preview section
    document.getElementById('print-menu-btn').addEventListener('click', () => generateHTML(true));
    
    // Initialize menu select
    updateMenuSelect();
    
    // Allow clicking anywhere in section header to toggle collapse
    document.addEventListener('click', function(e) {
        const sectionHeader = e.target.closest('.section-header');
        if (sectionHeader && !e.target.closest('input, button')) {
            const sectionId = sectionHeader.closest('.section-card').id;
            toggleSection(sectionId);
        }
    });
    
    // Auto-load menu when selected from dropdown
    document.getElementById('menu-select').addEventListener('change', async (e) => {
        if (e.target.value) {
            if (confirmIfUnsavedChanges()) {
                await loadMenu(e.target.value);
            } else {
                // Revert selection if user cancels
                setTimeout(() => {
                    e.target.value = document.getElementById('menu-name').value || '';
                }, 100);
            }
        }
    });
    
    // Track changes in input fields
    document.body.addEventListener('input', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            markUnsavedChanges();
        }
    });
    
    // Track changes when sections or items are added/deleted
    const mutationObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && mutation.target.id === 'sections') {
                markUnsavedChanges();
            }
        });
    });
    
    mutationObserver.observe(document.getElementById('sections'), { childList: true, subtree: true });

    // Initialize the state
    setTimeout(() => {
        markChangesSaved();
    }, 100);
});

// Add a spacer element
function addSpacer(data = {}) {
    const spacerId = `spacer-${spacerCounter++}`;
    const spacerDiv = document.createElement('div');
    spacerDiv.className = 'spacer-card spacer-expanded';
    spacerDiv.id = spacerId;
    spacerDiv.dataset.type = 'spacer';

    // Add move buttons
    const moveButtons = document.createElement('div');
    moveButtons.className = 'move-buttons';
    
    const moveUpBtn = document.createElement('button');
    moveUpBtn.className = 'move-btn move-up';
    moveUpBtn.innerHTML = '↑';
    moveUpBtn.addEventListener('click', () => moveElement(spacerId, 'up'));
    
    const moveDownBtn = document.createElement('button');
    moveDownBtn.className = 'move-btn move-down';
    moveDownBtn.innerHTML = '↓';
    moveDownBtn.addEventListener('click', () => moveElement(spacerId, 'down'));
    
    moveButtons.appendChild(moveUpBtn);
    moveButtons.appendChild(moveDownBtn);
    spacerDiv.appendChild(moveButtons);

    // Create spacer header
    const spacerHeader = document.createElement('div');
    spacerHeader.className = 'spacer-header';

    // Create toggle button for collapsing/expanding
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'spacer-toggle-btn';
    toggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
    toggleBtn.title = 'Toggle Spacer';
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSpacer(spacerId);
    });

    // Create spacer size input
    const sizeLabel = document.createElement('label');
    sizeLabel.textContent = 'Height:';

    const sizeInput = document.createElement('input');
    sizeInput.type = 'number';
    sizeInput.className = 'spacer-size';
    sizeInput.min = '1';
    sizeInput.max = '500';
    sizeInput.value = data.size || '30';

    // Create unit select
    const unitSelect = document.createElement('select');
    unitSelect.className = 'spacer-unit-select';
    
    const pxOption = document.createElement('option');
    pxOption.value = 'px';
    pxOption.textContent = 'px';
    
    const ptOption = document.createElement('option');
    ptOption.value = 'pt';
    ptOption.textContent = 'pt';
    
    const inOption = document.createElement('option');
    inOption.value = 'in';
    inOption.textContent = 'in';
    
    unitSelect.appendChild(pxOption);
    unitSelect.appendChild(ptOption);
    unitSelect.appendChild(inOption);
    
    if (data.unit) {
        unitSelect.value = data.unit;
    }

    // Create delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-sm btn-secondary';
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.title = 'Delete Spacer';
    deleteBtn.addEventListener('click', () => deleteSpacer(spacerId));

    // Create preview area
    const spacerPreview = document.createElement('div');
    spacerPreview.className = 'spacer-preview';
    
    // Set initial height based on input value and unit
    updateSpacerPreview(spacerPreview, sizeInput.value, unitSelect.value);

    // Add event listeners for size and unit changes
    sizeInput.addEventListener('input', () => {
        updateSpacerPreview(spacerPreview, sizeInput.value, unitSelect.value);
        updatePreview();
    });
    
    unitSelect.addEventListener('change', () => {
        updateSpacerPreview(spacerPreview, sizeInput.value, unitSelect.value);
        updatePreview();
    });

    // Create controls container
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'controls';
    controlsContainer.appendChild(deleteBtn);

    // Create spacer content area (for collapsible content)
    const spacerContent = document.createElement('div');
    spacerContent.className = 'spacer-content';

    // Assemble the spacer
    spacerHeader.appendChild(toggleBtn);
    spacerHeader.appendChild(sizeLabel);
    spacerHeader.appendChild(sizeInput);
    spacerHeader.appendChild(unitSelect);
    spacerHeader.appendChild(controlsContainer);

    spacerContent.appendChild(spacerHeader);

    // Create collapsed view (just shows a preview of the spacer)
    const collapsedView = document.createElement('div');
    collapsedView.className = 'spacer-collapsed-view';
    collapsedView.innerHTML = '<i class="fas fa-arrows-alt-v"></i> Spacer';
    collapsedView.addEventListener('click', () => toggleSpacer(spacerId));

    spacerDiv.appendChild(collapsedView);
    spacerDiv.appendChild(spacerContent);
    spacerDiv.appendChild(spacerPreview);

    // Add to sections container
    document.getElementById('sections').appendChild(spacerDiv);

    updatePreview();
    markUnsavedChanges();
}

// Toggle spacer collapse/expand
function toggleSpacer(spacerId) {
    const spacer = document.getElementById(spacerId);
    const isCollapsed = spacer.classList.contains('spacer-collapsed');
    const toggleBtn = spacer.querySelector('.spacer-toggle-btn');
    
    if (isCollapsed) {
        spacer.classList.remove('spacer-collapsed');
        spacer.classList.add('spacer-expanded');
        toggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
    } else {
        spacer.classList.remove('spacer-expanded');
        spacer.classList.add('spacer-collapsed');
        toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
    }
}

// Update spacer preview based on size and unit
function updateSpacerPreview(previewElement, size, unit) {
    // Convert size to pixels for preview (rough approximation)
    let heightInPx = size;
    if (unit === 'pt') {
        heightInPx = size * 1.33; // Approximate pt to px
    } else if (unit === 'in') {
        heightInPx = size * 96; // Approximate inches to px (96dpi)
    }
    
    previewElement.style.height = `${heightInPx * 0.3}px`; // Scale down for preview
}

// Delete a spacer
function deleteSpacer(spacerId) {
    if (confirm('Are you sure you want to delete this spacer?')) {
        document.getElementById(spacerId).remove();
        updatePreview();
    }
} 