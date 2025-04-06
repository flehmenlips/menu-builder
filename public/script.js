document.addEventListener('DOMContentLoaded', () => {
    const menuItemsContainer = document.getElementById('menuItems');
    const menuItemForm = document.getElementById('menuItemForm');
    const addItemBtn = document.getElementById('addItemBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    let editingItemId = null;

    // Fetch and display menu items
    async function fetchMenuItems() {
        try {
            const response = await fetch('/api/menu-items');
            const items = await response.json();
            displayMenuItems(items);
        } catch (error) {
            console.error('Error fetching menu items:', error);
        }
    }

    // Display menu items in the UI
    function displayMenuItems(items) {
        menuItemsContainer.innerHTML = '';
        items.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'menu-item';
            itemElement.innerHTML = `
                <div>
                    <h3>${item.name}</h3>
                    <p>${item.description}</p>
                    <p>$${item.price.toFixed(2)}</p>
                    <span class="category">${item.category}</span>
                </div>
                <div class="item-actions">
                    <button onclick="editItem('${item.id}')" class="btn">Edit</button>
                    <button onclick="deleteItem('${item.id}')" class="btn btn-cancel">Delete</button>
                </div>
            `;
            menuItemsContainer.appendChild(itemElement);
        });
    }

    // Handle form submission
    menuItemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('itemName').value,
            description: document.getElementById('itemDescription').value,
            price: parseFloat(document.getElementById('itemPrice').value),
            category: document.getElementById('itemCategory').value
        };

        try {
            const url = editingItemId ? `/api/menu-items/${editingItemId}` : '/api/menu-items';
            const method = editingItemId ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                menuItemForm.reset();
                editingItemId = null;
                fetchMenuItems();
            }
        } catch (error) {
            console.error('Error saving menu item:', error);
        }
    });

    // Edit menu item
    window.editItem = async (id) => {
        try {
            const response = await fetch(`/api/menu-items/${id}`);
            const item = await response.json();
            
            document.getElementById('itemName').value = item.name;
            document.getElementById('itemDescription').value = item.description;
            document.getElementById('itemPrice').value = item.price;
            document.getElementById('itemCategory').value = item.category;
            
            editingItemId = id;
        } catch (error) {
            console.error('Error fetching menu item:', error);
        }
    };

    // Delete menu item
    window.deleteItem = async (id) => {
        if (confirm('Are you sure you want to delete this item?')) {
            try {
                const response = await fetch(`/api/menu-items/${id}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    fetchMenuItems();
                }
            } catch (error) {
                console.error('Error deleting menu item:', error);
            }
        }
    };

    // Cancel editing
    cancelBtn.addEventListener('click', () => {
        menuItemForm.reset();
        editingItemId = null;
    });

    // Initial fetch of menu items
    fetchMenuItems();
}); 