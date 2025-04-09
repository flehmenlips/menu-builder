// Define API Base URL - Updated to be relative
const API_BASE_URL = '/api';

// Global variables
let currentUser = null;

// Add before the DOMContentLoaded event
// Clear stored login data
function clearLoginData() {
    console.log('Clearing stored login data');
    localStorage.removeItem('user');
    
    // Also remove any cookies
    document.cookie.split(";").forEach(function(c) {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
}

// Add initialization flags
let dashboardInitialized = false;
let usersInitialized = false;
let plansInitialized = false;
let contentInitialized = false;
let settingsInitialized = false;
let appearanceInitialized = false;
let globalSettingsInitialized = false; // Flag for new section

// Main admin module
document.addEventListener('DOMContentLoaded', async () => { // Make listener async
    console.log('[DOMContentLoaded] Starting admin auth check...');
    alert('[DOMContentLoaded] Starting admin auth check...'); // Alert 1
    const loggedInUser = await checkAdminAuth(); // Await the result

    if (loggedInUser) {
        console.log("*****************************************************");
        console.log("*** [DOMContentLoaded] checkAdminAuth SUCCEEDED! User:", loggedInUser);
        console.log("*****************************************************");
        
        alert("*****************************************************");
        alert("*** [DOMContentLoaded] checkAdminAuth SUCCEEDED! Proceeding..."); // Alert 2 (after SUCCESS alert from checkAdminAuth)
        
        try {
            alert("[DOMContentLoaded] BEFORE displayUserInfo"); // Alert 3
            displayUserInfo(loggedInUser); 
            alert("[DOMContentLoaded] AFTER displayUserInfo"); // Alert 4
        } catch (e) { alert(`ERROR in displayUserInfo: ${e}`); console.error("ERROR in displayUserInfo:", e); }
        
        try {
            alert("[DOMContentLoaded] BEFORE setupEventListeners"); // Alert 5
            setupEventListeners(loggedInUser); 
            alert("[DOMContentLoaded] AFTER setupEventListeners"); // Alert 6
        } catch (e) { alert(`ERROR in setupEventListeners: ${e}`); console.error("ERROR in setupEventListeners:", e); }
        
        try {
            alert("[DOMContentLoaded] BEFORE navigateToSection"); // Alert 7
            const hash = window.location.hash.substring(1);
            navigateToSection(hash || 'dashboard', loggedInUser); // Restore this call
            alert("[DOMContentLoaded] AFTER navigateToSection"); // Alert 8
        } catch (e) { alert(`ERROR in navigateToSection: ${e}`); console.error("ERROR in navigateToSection:", e); }
        
        alert("[DOMContentLoaded] End of successful block reached."); // Alert 9

    } else {
        console.log("*****************************************************");
        console.log("*** [DOMContentLoaded] checkAdminAuth FAILED or user is not admin (returned null).");
        console.log("*****************************************************");
        alert("*****************************************************");
        alert("*** [DOMContentLoaded] checkAdminAuth FAILED or user is not admin (returned null)."); // Alert 10
    }
});

// ... existing code ...

// Pass user object for consistency
function displayUserInfo(user) {
    const userNameElement = document.getElementById('user-name-display');
    const userEmailElement = document.getElementById('user-email-display'); // Assuming you might add email display

    if (userNameElement) {
        userNameElement.textContent = user.name || user.email; // Display name or email
    }
    // Add logic for userEmailElement if you have one
}

// Pass user object for consistency, especially if needed by listeners
function setupEventListeners(user) {
    // Sidebar navigation links
    const navLinks = document.querySelectorAll('.sidebar-nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const targetSection = this.getAttribute('href').substring(1);
            if (targetSection !== 'logout') { // Handle logout separately if needed
                 e.preventDefault();
                 window.location.hash = targetSection;
                 // Pass user when navigating
                 navigateToSection(targetSection, user);
            } else {
                // Handle logout click if necessary (logout function already exists)
                 // e.g., document.getElementById('logout-btn')?.click();
            }
        });
    });

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        // No need to pass user here as logout function reads localStorage anyway
        logoutBtn.addEventListener('click', logout);
    }

    // Add other event listeners as needed, passing `user` if required by their handlers
}


// Function to navigate between sections and initialize them
// ACCEPTS USER OBJECT
function navigateToSection(section, user) { // Added user parameter
    // Hide all sections
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(s => s.style.display = 'none');

    // Show the target section
    const activeSection = document.getElementById(section);
    if (activeSection) {
        activeSection.style.display = 'block';

        // Update active link in sidebar
        const navLinks = document.querySelectorAll('.sidebar-nav a');
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${section}`) {
                link.classList.add('active');
            }
        });

        // Initialize the section-specific JS, PASSING USER OBJECT
        switch (section) {
            case 'dashboard':
                // Pass user to initDashboard
                initDashboard(user);
                break;
            case 'users':
                // TODO: Update initUsers later
                initUsers(); // Keep original call for now
                break;
            case 'subscription-plans':
                 initSubscriptionPlans(); // Keep original call for now
                 break;
            case 'content':
                 initContentManagement(); // Keep original call for now
                 break;
            case 'settings':
            case 'global-settings': // Handle hash variation
                // TODO: Update initSettings later
                initSettings(user); // Keep original call for now
                // Ensure global settings is shown if that's the specific hash
                if (section === 'global-settings') {
                     const globalSettingsContent = document.getElementById('global-settings-content');
                     if (globalSettingsContent) globalSettingsContent.style.display = 'block';
                     // Potentially hide other setting subsections if needed
                }
                break;
             case 'menu-designs':
                 initMenuDesigns(); // Keep original call for now
                 break;
             // Add cases for other sections as needed
             default:
                 console.warn(`Unknown section requested: ${section}`);
                 // Optionally navigate to dashboard if section unknown
                 // navigateToSection('dashboard', user);
                 break;
        }
    } else {
        console.warn(`Section "${section}" not found. Defaulting to dashboard.`);
        // Default to dashboard, passing user
        navigateToSection('dashboard', user);
    }
}

// ... existing code ...


// Initialize dashboard - ACCEPTS USER OBJECT
function initDashboard(user) { // Added user parameter
    // Fetch dashboard stats, PASSING USER OBJECT
    fetchDashboardStats(user);
}

// Fetch dashboard stats - ACCEPTS USER OBJECT
function fetchDashboardStats(user) { // Added user parameter
    // const user = JSON.parse(localStorage.getItem('user') || 'null'); // REMOVED - Use passed user
    if (!user || !user.token) { // Check passed user object
        console.error('fetchDashboardStats: Auth token not provided via user object.'); // Updated error message
        // Optionally display error on dashboard elements
        const totalUsers = document.getElementById('total-users');
        if(totalUsers) totalUsers.textContent = 'Error';
        const proUsers = document.getElementById('pro-users');
        if(proUsers) proUsers.textContent = 'Error';
        const newUsers = document.getElementById('new-users');
        if(newUsers) newUsers.textContent = 'Error';
        const totalMenus = document.getElementById('total-menus');
        if(totalMenus) totalMenus.textContent = 'Error';
        return;
    }

    // Debug log to confirm token presence
    console.log("fetchDashboardStats: Using token from passed user object.");

    // Fetch total users using the passed user token
    fetch(`${API_BASE_URL}/admin/stats/users`, {
        headers: {
            'Authorization': `Bearer ${user.token}`, // Use passed user token
            'Content-Type': 'application/json'
        },
        credentials: 'include' // Keep credentials if needed for session cookies alongside Bearer
    })
    .then(response => {
        if (response.status === 401) {
             console.error('fetchDashboardStats (Users): Unauthorized (401). Token may be invalid or expired.');
             // Potentially trigger logout or redirect
        }
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.error) throw new Error(data.error);
        const totalUsers = document.getElementById('total-users');
        const proUsers = document.getElementById('pro-users');
        const newUsers = document.getElementById('new-users');

        if (totalUsers) totalUsers.textContent = data.count || 0;
        if (proUsers) proUsers.textContent = data.proCount || 0;
        if (newUsers) newUsers.textContent = data.newThisMonth || 0;
    })
    .catch(error => {
        console.error('Error fetching user stats:', error);
        const totalUsers = document.getElementById('total-users');
        const proUsers = document.getElementById('pro-users');
        const newUsers = document.getElementById('new-users');

        if (totalUsers) totalUsers.textContent = 'Error';
        if (proUsers) proUsers.textContent = 'Error';
        if (newUsers) newUsers.textContent = 'Error';
    });

    // Fetch total menus using the passed user token
    fetch(`${API_BASE_URL}/admin/stats/menus`, {
        headers: {
            'Authorization': `Bearer ${user.token}`, // Use passed user token
            'Content-Type': 'application/json'
        },
        credentials: 'include' // Keep credentials if needed
    })
    .then(response => {
         if (response.status === 401) {
             console.error('fetchDashboardStats (Menus): Unauthorized (401). Token may be invalid or expired.');
             // Potentially trigger logout or redirect
         }
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.error) throw new Error(data.error);
        const totalMenus = document.getElementById('total-menus');
        if (totalMenus) totalMenus.textContent = data.count || 0;
    })
    .catch(error => {
        console.error('Error fetching menu stats:', error);
        const totalMenus = document.getElementById('total-menus');
        if (totalMenus) totalMenus.textContent = 'Error';
    });
}


// Initialize users section - ACCEPTS USER OBJECT
function initUsers(user) { // Changed signature
    // Initialize user search if elements exist
    const searchInput = document.getElementById('users-search');
    const searchBtn = document.getElementById('users-search-btn');

    if (searchInput && searchBtn) {
        searchBtn.addEventListener('click', function() {
            fetchUsers(user, 1, 20, searchInput.value); // Pass user
        });

        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                fetchUsers(user, 1, 20, this.value); // Pass user
            }
        });
    }

    // Initialize add user button if it exists
    const addUserBtn = document.getElementById('add-user-btn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', function() {
            showUserModal(user); // Pass user for context if needed, or just null for Add
        });
    }

    // Initialize user modal
    initUserModal(user); // Pass user

    // Fetch users on load
    fetchUsers(user); // Pass user
}

// Fetch users - ACCEPTS USER OBJECT
function fetchUsers(user, page = 1, limit = 20, search = '') { // Changed signature
    // const user = JSON.parse(localStorage.getItem('user') || 'null'); // REMOVED - Use passed user
    if (!user || !user.token) { // Check passed user
        console.error('fetchUsers: Auth token not provided.'); // Updated error
        const tbody = document.querySelector('#users-table tbody');
         if (tbody) {
             tbody.innerHTML = '<tr><td colspan="7" class="loading-data">Authentication Error</td></tr>';
         }
        return;
    }

    const tbody = document.querySelector('#users-table tbody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-data">Loading users...</td></tr>';
    }

    fetch(`${API_BASE_URL}/admin/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`, {
        headers: {
            'Authorization': `Bearer ${user.token}`, // Use passed user token
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    })
    .then(response => {
         if (!response.ok) {
             // Handle specific auth error (e.g., 401 Unauthorized) maybe redirect?
             if (response.status === 401) {
                  console.error('fetchUsers: Unauthorized access. Token might be invalid.');
                  // Optionally redirect to login: window.location.href = '/login.html';
             }
             throw new Error(`HTTP error! status: ${response.status}`);
         }
        return response.json();
    })
    .then(data => {
        if (data.error) throw new Error(data.error);

        if (tbody) {
            renderUsers(data.users, user); // Pass user to renderUsers if needed for actions
            renderPagination(data.page, data.totalPages, data.total, search, user); // Pass user to pagination if needed
        }
    })
    .catch(error => {
        console.error('Error fetching users:', error);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="loading-data">Error fetching users: ${error.message}</td></tr>`;
        }
    });
}

// Render users table - ACCEPTS USER OBJECT (for actions)
function renderUsers(usersData, user) { // Changed signature (user added)
    const tbody = document.querySelector('#users-table tbody');

    if (!usersData || usersData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-data">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = ''; // Clear existing rows

    usersData.forEach(userData => { // Use different name to avoid conflict with outer scope user
        const tr = document.createElement('tr');

        // Format dates
        const createdDate = new Date(userData.created_at).toLocaleDateString();
        const lastLogin = userData.last_login ? new Date(userData.last_login).toLocaleDateString() : 'Never';

        tr.innerHTML = `
            <td>${userData.id}</td>
            <td>${userData.name || '-'}</td>
            <td>${userData.email}</td>
            <td>${createdDate}</td>
            <td>${lastLogin}</td>
            <td>
                <span class="badge ${userData.subscription_status === 'free' ? 'badge-secondary' : 'badge-primary'}">
                    ${userData.subscription_status || 'Free'}
                </span>
            </td>
            <td>
                <div class="table-actions">
                    <button class="edit-user-btn" data-id="${userData.id}" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-user-btn" data-id="${userData.id}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });

    // Add event listeners to action buttons, passing the main `user` token for auth checks
    document.querySelectorAll('.edit-user-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const userIdToEdit = this.getAttribute('data-id');
            fetchUserDetails(user, userIdToEdit); // Pass authenticated user
        });
    });

    document.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const userIdToDelete = this.getAttribute('data-id');
            if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
                deleteUser(user, userIdToDelete); // Pass authenticated user
            }
        });
    });
}


// Render pagination - ACCEPTS USER OBJECT
function renderPagination(currentPage, totalPages, totalItems, search, user) { // Changed signature
    const pagination = document.getElementById('users-pagination');
    if (!pagination) return;

    const prevBtn = pagination.querySelector('.pagination-prev');
    const nextBtn = pagination.querySelector('.pagination-next');
    const numbersContainer = pagination.querySelector('.pagination-numbers');

    if (!prevBtn || !nextBtn || !numbersContainer) {
        console.error("Pagination elements not found in the DOM.");
        return;
    }

    numbersContainer.innerHTML = ''; // Clear previous numbers

    // Update prev/next buttons state
    prevBtn.classList.toggle('disabled', currentPage <= 1);
    nextBtn.classList.toggle('disabled', currentPage >= totalPages);

    // Clone and replace to remove old listeners
    const prevClone = prevBtn.cloneNode(true);
    const nextClone = nextBtn.cloneNode(true);
    prevBtn.parentNode.replaceChild(prevClone, prevBtn);
    nextBtn.parentNode.replaceChild(nextClone, nextBtn);

    // Add event listeners with the user object
    if (currentPage > 1) {
        prevClone.addEventListener('click', () => fetchUsers(user, currentPage - 1, 20, search)); // Pass user
    }
    if (currentPage < totalPages) {
        nextClone.addEventListener('click', () => fetchUsers(user, currentPage + 1, 20, search)); // Pass user
    }

    // Generate page numbers
    // ... (logic for generating page numbers, ensuring clicks call fetchUsers with user) ...
     for (let i = 1; i <= totalPages; i++) {
         if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
             const pageNum = document.createElement('div');
             pageNum.className = `page-number ${i === currentPage ? 'active' : ''}`;
             pageNum.textContent = i;
             if (i !== currentPage) {
                 pageNum.addEventListener('click', () => fetchUsers(user, i, 20, search)); // Pass user
             }
             numbersContainer.appendChild(pageNum);
         } else if ((i === 2 && currentPage > 3) || (i === totalPages - 1 && currentPage < totalPages - 2)) {
             const ellipsis = document.createElement('div');
             ellipsis.className = 'pagination-ellipsis';
             ellipsis.textContent = '...';
             numbersContainer.appendChild(ellipsis);
         }
     }
}

// Initialize user modal - ACCEPTS USER OBJECT
function initUserModal(user) { // Changed signature
    const modal = document.getElementById('user-modal');
    if (!modal) return;

    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = document.getElementById('user-cancel-btn');
    const saveBtn = document.getElementById('user-save-btn');
    const deleteBtn = document.getElementById('user-delete-btn');

    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    if (cancelBtn) cancelBtn.addEventListener('click', () => modal.classList.remove('active'));

    if (saveBtn) {
        saveBtn.addEventListener('click', () => saveUser(user)); // Pass user
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const userIdToDelete = document.getElementById('user-id')?.value;
            if (userIdToDelete && confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
                deleteUser(user, userIdToDelete); // Pass user
            }
        });
    }
}

// Show user modal for adding/editing - ACCEPTS USER OBJECT
function showUserModal(user, userIdToEdit = null) { // Changed signature
    const modal = document.getElementById('user-modal');
    const title = document.getElementById('user-modal-title');
    const idInput = document.getElementById('user-id');
    const nameInput = document.getElementById('user-name');
    const emailInput = document.getElementById('user-email');
    const planSelect = document.getElementById('user-plan');
    const expiryInput = document.getElementById('user-expiry');
    const adminCheckbox = document.getElementById('user-admin');
    const deleteBtn = document.getElementById('user-delete-btn');
    const form = document.getElementById('user-form');

     if (!modal || !title || !idInput || !deleteBtn || !form) {
          console.error("User modal elements missing.");
          return;
     }

    // Reset form
    form.reset();

    if (userIdToEdit) {
        // Editing existing user
        title.textContent = 'Edit User';
        idInput.value = userIdToEdit;
        deleteBtn.style.display = 'block'; // Show delete button when editing
        fetchUserDetails(user, userIdToEdit); // Pass user
    } else {
        // Adding new user
        title.textContent = 'Add User';
        idInput.value = ''; // Ensure ID is clear
        deleteBtn.style.display = 'none'; // Hide delete button when adding

        // Set default expiry date (optional, could be handled by backend)
        // const expiryDate = new Date();
        // expiryDate.setDate(expiryDate.getDate() + 30);
        // if(expiryInput) expiryInput.value = expiryDate.toISOString().split('T')[0];

        modal.classList.add('active');
    }
}


// Fetch user details - ACCEPTS USER OBJECT
function fetchUserDetails(user, userIdToFetch) { // Changed signature
    // const user = JSON.parse(localStorage.getItem('user') || 'null'); // REMOVED
    if (!user || !user.token) { // Check passed user
        console.error('fetchUserDetails: Auth token not provided.');
        alert('Authentication error. Cannot fetch user details.');
        return;
    }

    fetch(`${API_BASE_URL}/admin/users/${userIdToFetch}`, { // Use userIdToFetch
        headers: {
            'Authorization': `Bearer ${user.token}` // Use passed token
        },
        credentials: 'include'
    })
    .then(response => {
         if (!response.ok) throw new Error(`HTTP error ${response.status}`);
         return response.json();
     })
    .then(data => {
        if (data.error) throw new Error(data.error);

        // Populate form - Ensure elements exist before setting value
        const nameInput = document.getElementById('user-name');
        const emailInput = document.getElementById('user-email');
        const planSelect = document.getElementById('user-plan');
        const expiryInput = document.getElementById('user-expiry');
        const adminCheckbox = document.getElementById('user-admin');
        const modal = document.getElementById('user-modal'); // Get modal element

        if (nameInput) nameInput.value = data.user.name || '';
        if (emailInput) emailInput.value = data.user.email || '';
        if (planSelect) planSelect.value = data.user.subscription_status || 'free';

        if (expiryInput && data.user.subscription_end_date) {
            try {
                 // Safely format date
                 expiryInput.value = new Date(data.user.subscription_end_date).toISOString().split('T')[0];
            } catch (e) {
                 console.error("Error parsing subscription end date:", e);
                 expiryInput.value = ''; // Clear on error
            }
        } else if (expiryInput) {
             expiryInput.value = ''; // Clear if no date provided
        }

        if (adminCheckbox) adminCheckbox.checked = data.user.is_admin === 1;

        // Show modal only if all elements were found and populated
        if (modal && nameInput && emailInput && planSelect && expiryInput && adminCheckbox) {
             modal.classList.add('active');
        } else {
             console.error("Could not populate all user modal fields.");
             alert("Error displaying user details. Some form elements may be missing.");
        }
    })
    .catch(error => {
        console.error('Error fetching user details:', error);
        alert('Error fetching user details: ' + error.message);
        // Optionally close modal or show error within modal
         const modal = document.getElementById('user-modal');
         if(modal) modal.classList.remove('active');
    });
}


// Save user - ACCEPTS USER OBJECT
function saveUser(user) { // Changed signature
    // const user = JSON.parse(localStorage.getItem('user') || 'null'); // REMOVED
     if (!user || !user.token) { // Check passed user
         console.error('saveUser: Auth token not provided.');
         alert('Authentication error. Cannot save user.');
         return;
     }

    // Get form values
    const userId = document.getElementById('user-id')?.value || null; // Use null if empty
    const name = document.getElementById('user-name')?.value;
    const email = document.getElementById('user-email')?.value;
    const password = document.getElementById('user-password')?.value; // Optional: only send if changed
    const plan = document.getElementById('user-plan')?.value;
    const expiry = document.getElementById('user-expiry')?.value;
    const isAdmin = document.getElementById('user-admin')?.checked;

    // Basic validation (optional, more robust validation recommended)
    if (!name || !email || !plan) {
         alert('Please fill in Name, Email, and Plan.');
         return;
    }


    const userData = {
        name,
        email,
        subscription_status: plan,
        subscription_end_date: expiry || null, // Send null if empty
        is_admin: isAdmin ? 1 : 0
    };

    // Only include password if it's being set/changed (and not empty)
    if (password) {
        userData.password = password;
    }

    const method = userId ? 'PUT' : 'POST';
    const url = userId ? `${API_BASE_URL}/admin/users/${userId}` : `${API_BASE_URL}/admin/users`;

    fetch(url, {
        method: method,
        headers: {
            'Authorization': `Bearer ${user.token}`, // Use passed token
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData),
        credentials: 'include'
    })
     .then(response => {
         if (!response.ok) {
             return response.json().then(err => { throw new Error(err.error || `HTTP error ${response.status}`) });
         }
         return response.json();
      })
    .then(data => {
        if (data.error) throw new Error(data.error);

        alert(`User ${userId ? 'updated' : 'added'} successfully!`);
        document.getElementById('user-modal').classList.remove('active');
        fetchUsers(user); // Refresh the user list using the authenticated user
    })
    .catch(error => {
        console.error('Error saving user:', error);
        alert('Error saving user: ' + error.message);
    });
}


// Delete user - ACCEPTS USER OBJECT
function deleteUser(user, userIdToDelete) { // Changed signature
    // const user = JSON.parse(localStorage.getItem('user') || 'null'); // REMOVED
    if (!user || !user.token) { // Check passed user
        console.error('deleteUser: Auth token not provided.');
        alert('Authentication error. Cannot delete user.');
        return;
    }

    if (!userIdToDelete) {
         console.error('deleteUser: No user ID provided.');
         alert('Cannot delete user: User ID is missing.');
         return;
    }


    fetch(`${API_BASE_URL}/admin/users/${userIdToDelete}`, { // Use userIdToDelete
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${user.token}` // Use passed token
        },
        credentials: 'include'
    })
     .then(response => {
         // Check for specific status codes if needed (e.g., 204 No Content)
         if (!response.ok) {
              // Try to parse error json, otherwise use status text
             return response.json().catch(() => null).then(err => {
                 throw new Error(err?.error || response.statusText || `HTTP error ${response.status}`);
             });
         }
         // If DELETE is successful, response might be empty or have minimal content
         return response.text(); // Or response.json() if backend sends confirmation
     })
    .then(() => { // No data expected on successful DELETE usually
        alert('User deleted successfully!');
        // Optionally close modal if open
        const modal = document.getElementById('user-modal');
        if (modal && modal.classList.contains('active')) {
             const modalUserId = document.getElementById('user-id')?.value;
             if (modalUserId === userIdToDelete) {
                  modal.classList.remove('active');
             }
        }
        fetchUsers(user); // Refresh the user list using the authenticated user
    })
    .catch(error => {
        console.error('Error deleting user:', error);
        alert('Error deleting user: ' + error.message);
    });
}

// ... (Keep initSubscriptionPlans, initContentManagement, initMenuDesigns signatures unchanged for now, assume they don't need user or fix later) ...
function initSubscriptionPlans(user) { /* ... requires user ... */ fetchSubscriptionPlans(user); }
function initContentManagement(user) { /* ... requires user ... */ /* fetch content */ }
function initMenuDesigns(user) { /* ... requires user ... */ /* fetch designs */ }


// Initialize settings section - ACCEPTS USER OBJECT
function initSettings(user) { // Added user parameter
    // Initialize global settings subsection, PASSING USER OBJECT
    initGlobalSettings(user);
    // Initialize other settings subsections if they exist and need user object
    // e.g., initProfileSettings(user);
}

// Initialize global settings - ACCEPTS USER OBJECT
function initGlobalSettings(user) { // Added user parameter
    console.log('Initializing Global Settings...');
    const form = document.getElementById('global-settings-form');
    const messageDiv = document.getElementById('global-settings-message');
    const logoPreview = document.getElementById('app-logo-preview');
    const uploadBtn = document.getElementById('upload-app-logo-btn');
    const logoInput = document.getElementById('app-logo-input');
    // Assuming other inputs/buttons might exist for other global settings
    // const appNameInput = document.getElementById('app-name-input');
    // const saveAppNameBtn = document.getElementById('save-app-name-btn');

    if (!form || !messageDiv || !logoPreview || !uploadBtn || !logoInput) {
        console.error('initGlobalSettings: One or more required elements are missing.');
        return;
    }

    // Helper function to display messages within the settings section
    const showMessage = (element, message, type = 'error') => {
        element.textContent = message;
        element.className = `message ${type}`; // Use classes for styling
        element.style.display = 'block';
    };

    // Check for token before proceeding with fetch
    if (!user || !user.token) {
        console.error('initGlobalSettings: Auth token not provided via user object.');
        showMessage(messageDiv, 'Authentication error. Cannot load settings.', 'error');
        logoPreview.style.display = 'none';
        // Disable form elements if needed
        uploadBtn.disabled = true;
        logoInput.disabled = true;
        return;
    }

    // Fetch current settings on load using the passed user token
    fetch(`${API_BASE_URL}/admin/settings`, { // Use ADMIN endpoint for potentially sensitive settings
        headers: {
            'Authorization': `Bearer ${user.token}` // Use passed user token
            // No Content-Type needed for GET
        },
        credentials: 'include' // Keep if necessary
    })
    .then(response => {
        if (response.status === 401) throw new Error('Unauthorized (401)');
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        return response.json();
    })
    .then(data => {
         if (data.settings.app_logo) {
             // Ensure correct URL (handle relative/absolute)
             const logoUrl = data.settings.app_logo;
             logoPreview.src = logoUrl.startsWith('/') ? `${window.location.origin}${logoUrl}` : logoUrl;
             logoPreview.style.display = 'block';
         } else {
             logoPreview.style.display = 'none';
         }
         // Populate other settings fields if they exist
         // if (appNameInput && data.settings.app_name) {
         //     appNameInput.value = data.settings.app_name;
         // }
    })
    .catch(error => {
        console.error('Error fetching current global settings:', error);
        showMessage(messageDiv, `Error loading current settings: ${error.message}`, 'error');
        logoPreview.style.display = 'none'; // Hide preview on error
    });


    // Handle logo upload using the passed user token
    uploadBtn.addEventListener('click', async () => {
        // Check token *again* right before upload attempt
        if (!user || !user.token) {
            console.error('initGlobalSettings (Upload): Auth token missing just before upload.');
            showMessage(messageDiv, 'Authentication error. Please log in again.', 'error');
            return;
        }

        const file = logoInput.files[0];
        if (!file) {
            showMessage(messageDiv, 'Please select a logo file first.', 'error');
            return;
        }

        // Client-side validation (size, type)
        const maxSize = 1 * 1024 * 1024; // 1 MB
        if (file.size > maxSize) {
            showMessage(messageDiv, 'File size exceeds 1MB limit.', 'error');
            return;
        }
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml'];
        if (!allowedTypes.includes(file.type)) {
            showMessage(messageDiv, 'Invalid file type. Please use JPG, PNG, GIF, or SVG.', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('app_logo', file); // Field name matches backend (multer)

        // No need to get user from localStorage here - use the passed 'user' object
        // const loggedInUser = JSON.parse(localStorage.getItem('user') || 'null'); // REMOVED
        // if (!loggedInUser || !loggedInUser.token) { // REMOVED

        // Debug log
        console.log("initGlobalSettings (Upload): Using token from passed user object.");

        try {
            showMessage(messageDiv, 'Uploading logo...', 'info');
            uploadBtn.disabled = true;

            const response = await fetch(`${API_BASE_URL}/admin/settings/app-logo`, {
                method: 'POST',
                headers: {
                    // 'Content-Type' is set automatically by browser for FormData
                    'Authorization': `Bearer ${user.token}` // Use passed user token
                },
                body: formData,
                credentials: 'include' // Keep if necessary
            });

            const data = await response.json();

            if (!response.ok) {
                // Use error message from backend if available, else use status
                const errorMsg = data?.error || `Upload failed with status: ${response.status}`;
                throw new Error(errorMsg);
            }

            // Assuming success returns the new logo URL
            showMessage(messageDiv, 'Logo uploaded successfully!', 'success');
            if (data.logoUrl) {
                const newLogoUrl = data.logoUrl;
                logoPreview.src = newLogoUrl.startsWith('/') ? `${window.location.origin}${newLogoUrl}` : newLogoUrl;
                logoPreview.style.display = 'block';
            }
            logoInput.value = ''; // Clear the file input

        } catch (error) {
            console.error('Error uploading logo:', error);
            showMessage(messageDiv, `Error uploading logo: ${error.message}`, 'error');
        } finally {
            uploadBtn.disabled = false; // Re-enable button
        }
    });


     // Handle saving other settings like App Name (Example)
     if (saveAppNameBtn && appNameInput) {
         saveAppNameBtn.addEventListener('click', async () => {
              const newAppName = appNameInput.value.trim();
              if (!newAppName) {
                   showMessage(messageDiv, 'App Name cannot be empty.', 'error');
                   return;
              }

              if (!user || !user.token) {
                   console.error('initGlobalSettings: No user token found for saving app name.');
                   showMessage(messageDiv, 'Authentication error. Please log in again.', 'error');
                   return;
              }

              try {
                   showMessage(messageDiv, 'Saving App Name...', 'info');
                   saveAppNameBtn.disabled = true;

                   const response = await fetch(`${API_BASE_URL}/admin/settings`, {
                        method: 'PUT',
                        headers: {
                             'Content-Type': 'application/json',
                             'Authorization': `Bearer ${user.token}`
                        },
                        body: JSON.stringify({ app_name: newAppName }),
                        credentials: 'include'
                   });

                   const data = await response.json();

                   if (!response.ok) {
                        throw new Error(data.error || `Save failed with status: ${response.status}`);
                   }

                   showMessage(messageDiv, 'App Name updated successfully!', 'success');

              } catch (error) {
                   console.error('Error saving App Name:', error);
                   showMessage(messageDiv, `Error saving App Name: ${error.message}`, 'error');
              } finally {
                   saveAppNameBtn.disabled = false;
              }
         });
     }

}

// ... rest of admin.js ...

// Initialize login form
function initLoginForm() {
    const loginForm = document.getElementById('admin-login-form');
    if (!loginForm) return;
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('admin-email').value;
        const password = document.getElementById('admin-password').value;
        
        try {
            const response = await fetch(`${API_BASE_URL}/admin/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }
            
            // Store user data
            localStorage.setItem('user', JSON.stringify(data));
            
            // Show admin panel
            const adminPanel = document.getElementById('admin-panel');
            const loginContainer = document.getElementById('admin-login-container');
            if (adminPanel) adminPanel.classList.add('active');
            if (loginContainer) loginContainer.classList.remove('active');
            
            // Initialize ONLY the dashboard and navigation
            initDashboard();
            dashboardInitialized = true;
            initNavigation(); // Re-initialize nav to handle potential hash
            
            // Check user role and show/hide super admin elements
            const loggedInUser = JSON.parse(localStorage.getItem('user'));
            if (loggedInUser && loggedInUser.role === 'SUPER_ADMIN') {
                document.querySelectorAll('.super-admin-only').forEach(el => {
                    el.style.display = ''; // Remove inline style to show elements
                });
            }
            
            // Manually trigger the click for the default/hashed section
            const hash = window.location.hash.substring(1);
            const initialSection = hash || 'dashboard';
            const targetLink = document.querySelector(`.nav-link[data-section="${initialSection}"]`);
            if (targetLink) {
                targetLink.click();
            } else {
                const dashboardLink = document.querySelector('.nav-link[data-section="dashboard"]');
                if (dashboardLink) dashboardLink.click();
            }
            
        } catch (error) {
            console.error('Login error:', error);
            showLoginMessage(error.message, 'error');
        }
    });
}

// Check if admin exists (only called if user is not logged in)
function checkAdminExists() {
    fetch(`${API_BASE_URL}/admin/exists`)
    .then(response => response.json())
    .then(data => {
        if (!data.exists) {
            // No admin -> Need setup. Switch from login view to setup view.
            console.log('checkAdminExists: No admin found, switching to setup view.');
            const loginContainer = document.getElementById('admin-login-container');
            const setupContainer = document.getElementById('admin-setup-container');
            if (loginContainer) loginContainer.classList.remove('active'); 
            if (setupContainer) setupContainer.classList.add('active'); 
        } else {
            // Admin exists -> Login view is already active. Do nothing.
            console.log('checkAdminExists: Admin exists, login view remains active.');
        }
    })
    .catch(error => {
        console.error('Error checking if admin exists:', error);
        // On error, ensure login is active and others are not
        console.log('checkAdminExists: Error occurred, ensuring login view is active.');
        const loginContainer = document.getElementById('admin-login-container');
        const adminPanel = document.getElementById('admin-panel');
        const setupContainer = document.getElementById('admin-setup-container');
        if (loginContainer) loginContainer.classList.add('active');
        if (adminPanel) adminPanel.classList.remove('active');
        if (setupContainer) setupContainer.classList.remove('active');
    });
}

// Show login message
function showLoginMessage(message, type = 'info') {
    const messageDiv = document.getElementById('admin-login-message');
    if (!messageDiv) return;
    
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    // Hide message after 5 seconds
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

// Check if user is logged in as admin - NOW ASYNC
async function checkAdminAuth() { // Make function async
    // Get user from localStorage
    const userJson = localStorage.getItem('user');
    // Revert to console.log
    console.log('[checkAdminAuth] Raw data from localStorage["user"]:', userJson);
    let user = null;
    try {
        user = JSON.parse(userJson || 'null');
        // Revert to console.log
        console.log('[checkAdminAuth] Parsed user object from localStorage:', user);
    } catch (e) {
        console.error("[checkAdminAuth] Error parsing user from localStorage:", e);
        // alert("[checkAdminAuth] Error parsing user from localStorage. Check console."); // Remove alert
        localStorage.removeItem('user'); // Clear invalid data
        window.location.href = '/login.html?admin=true&reason=invalid_storage';
        return null; // Stop execution
    }

    // If no user in localStorage, check if setup is needed or redirect
    if (!user) {
        console.log("[checkAdminAuth] No valid user object parsed. Checking server setup status.");
        // alert("[checkAdminAuth] No valid user object parsed. Will check server setup."); // Remove alert
        // ... (rest of the no-user logic which might also redirect)
        try {
            const response = await fetch(`${API_BASE_URL}/admin/check`, {
                method: 'GET',
                credentials: 'include'
            });
            const data = await response.json();
            // alert(`[checkAdminAuth] Server setup check response: ${JSON.stringify(data)}`); // Remove alert
            if (data.needsSetup) {
                 console.log("checkAdminAuth: Admin setup needed.");
                 // alert("[checkAdminAuth] Admin setup needed. Showing setup form."); // Remove alert
                 showSetupForm();
                 return null;
             } else {
                 console.log("checkAdminAuth: No user and no setup needed. Redirecting to login.");
                 // alert("[checkAdminAuth] No user and no setup needed. Redirecting to login."); // Remove alert
                 window.location.href = '/login.html?admin=true&reason=no_user';
                 return null;
             }
         } catch (error) {
             console.error("checkAdminAuth: Error checking admin setup status:", error);
             // alert("[checkAdminAuth] Error checking server setup status. Redirecting to login. Check console."); // Remove alert
             window.location.href = '/login.html?admin=true&reason=setup_check_error';
             return null;
         }
    }

    // User object exists, use console.log to show the token check specifically
    console.log('[checkAdminAuth] Checking for token in parsed user object. user.token value:', user?.token);

    // User exists in localStorage, now verify token and admin status with the server
    if (!user.token) {
        console.error("[checkAdminAuth] User object parsed from localStorage IS MISSING token property.");
        // alert("[checkAdminAuth] Parsed user object IS MISSING token property. Redirecting to login."); // Remove alert
        localStorage.removeItem('user');
        window.location.href = '/login.html?admin=true&reason=missing_token';
        return null; // Stop execution
    }

    // Token exists, proceed with verification
    console.log('[checkAdminAuth] Token found. Proceeding to verify with /api/auth/verify using token:', user.token);
    // alert(`[checkAdminAuth] Token found. Proceeding to verify with server.`); // Remove alert

    try {
        const response = await fetch(`${API_BASE_URL}/auth/verify`, { // Await fetch
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${user.token}`
            }
        });
        // alert(`[checkAdminAuth] /auth/verify response status: ${response.status}`); // Remove alert

        const data = await response.json(); // Await parsing json
        // alert(`[checkAdminAuth] /auth/verify parsed data:\n${JSON.stringify(data, null, 2)}`); // Remove alert

        // CORRECTED: Check data.loggedIn instead of data.authenticated
        // ADD Explicit check for admin status (true or 1)
        const isAdmin = data.user?.is_admin === true || data.user?.is_admin === 1;
        if (response.status === 401 || !data.loggedIn || !isAdmin) {
            console.log(`checkAdminAuth: Verification failed. Status: ${response.status}, LoggedIn: ${data.loggedIn}, Is Admin Check: ${isAdmin} (User Object: ${JSON.stringify(data.user)})`);
            localStorage.removeItem('user');
            window.location.href = `/login.html?admin=true&reason=${response.status === 401 ? 'unauthorized' : 'not_admin'}`;
            return null; // Indicate failure
        } else {
            // alert('[checkAdminAuth] Verification successful. User is admin. Proceeding to load panel.'); // Remove alert
            console.log("checkAdminAuth: Verification successful. User is admin.");
            hideSetupForm(); // Ensure setup form is hidden if verification succeeds
            // Add FINAL success alert before returning
            alert(`[checkAdminAuth] SUCCESS! Returning user object:\n${JSON.stringify(data.user)}`);
            return data.user;
        }
    } catch (error) {
        // alert(`[checkAdminAuth] Auth verification FETCH FAILED with error: ${error}. REDIRECTING.`); // Remove alert
        console.error('checkAdminAuth: Auth verification fetch error:', error);
        localStorage.removeItem('user');
        window.location.href = '/login.html?admin=true&reason=verify_fetch_error';
        return null; // Indicate failure
    }
}

// Show admin setup form
function showSetupForm() {
    document.getElementById('admin-setup').style.display = 'flex';
    document.querySelector('.admin-layout').style.display = 'none';
}

// Hide admin setup form
function hideSetupForm() {
    document.getElementById('admin-setup').style.display = 'none';
    document.querySelector('.admin-layout').style.display = 'flex';
}

// Initialize setup form
function initSetupForm() {
    const setupForm = document.getElementById('admin-setup-form');
    
    setupForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const name = document.getElementById('setup-name').value;
        const email = document.getElementById('setup-email').value;
        const password = document.getElementById('setup-password').value;
        const confirmPassword = document.getElementById('setup-confirm-password').value;
        const setupKey = document.getElementById('setup-key').value;
        
        // Validate form
        if (!name || !email || !password || !confirmPassword) {
            showSetupMessage('All fields are required', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            showSetupMessage('Passwords do not match', 'error');
            return;
        }
        
        // Show loading state
        const submitBtn = setupForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating Account...';
        
        fetch(`${API_BASE_URL}/admin/setup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password, confirmPassword, setupKey }),
            credentials: 'include'
        })
        .then(response => response.json())
        .then(data => {
            // Reset button
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Save user data to localStorage
            localStorage.setItem('user', JSON.stringify(data));
            
            showSetupMessage('Admin account created successfully! Redirecting...', 'success');
            
            // Redirect to admin panel after 2 seconds
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        })
        .catch(error => {
            // Reset button
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            
            showSetupMessage(error.message, 'error');
        });
    });
}

// Show setup message
function showSetupMessage(message, type = 'info') {
    const messageElement = document.getElementById('setup-message');
    messageElement.textContent = message;
    messageElement.className = `message ${type}`;
    messageElement.style.display = 'block';
    
    // Hide message after 5 seconds
    setTimeout(() => {
        messageElement.style.display = 'none';
    }, 5000);
}

// Initialize navigation
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const loggedInUser = JSON.parse(localStorage.getItem('user')); // Get user info
    
    navLinks.forEach(link => {
        // --- START: Show/Hide Super Admin Link --- 
        if (link.classList.contains('super-admin-only')) {
            if (loggedInUser && loggedInUser.role === 'SUPER_ADMIN') {
                 link.parentElement.style.display = ''; // Show the list item
            } else {
                 link.parentElement.style.display = 'none'; // Hide the list item
            }
        }
        // --- END: Show/Hide Super Admin Link --- 

        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all links
            navLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
            
            // Get section ID
            const sectionId = this.getAttribute('data-section');
            
            // Hide all sections
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });
            
            // Show selected section
            const targetSection = document.getElementById(`${sectionId}-section`);
            if (targetSection) {
                targetSection.classList.add('active');
            }
            
            // Initialize the section ONLY if it hasn't been initialized yet
            switch (sectionId) {
                case 'dashboard':
                    if (!dashboardInitialized) {
                        initDashboard();
                        dashboardInitialized = true;
                    }
                    break;
                case 'users':
                    if (!usersInitialized) {
                        initUsers();
                        usersInitialized = true;
                    }
                    break;
                case 'plans':
                    if (!plansInitialized) {
                        initPlans();
                        plansInitialized = true;
                    }
                    break;
                case 'content':
                    if (!contentInitialized) {
                        initContent();
                        contentInitialized = true;
                    }
                    break;
                case 'settings':
                    if (!settingsInitialized) {
                        initSettings();
                        settingsInitialized = true;
                    }
                    break;
                case 'appearance':
                    if (!appearanceInitialized) {
                        initAppearance();
                        appearanceInitialized = true;
                    }
                    break;
                case 'global-settings': // New case
                    if (!globalSettingsInitialized && loggedInUser?.role === 'SUPER_ADMIN') {
                        initGlobalSettings();
                        globalSettingsInitialized = true;
                    }
                    break;
            }
            
            // Update window hash
            window.location.hash = sectionId;
        });
    });
    
    // Handle initial navigation based on hash
    const hash = window.location.hash.substring(1);
    const initialSection = hash || 'dashboard'; // Default to dashboard
    const targetLink = document.querySelector(`.nav-link[data-section="${initialSection}"]`);
    if (targetLink) {
        targetLink.click(); // This will trigger the section display and initialization
    } else {
        // Fallback if hash points to non-existent section
        const dashboardLink = document.querySelector('.nav-link[data-section="dashboard"]');
        if (dashboardLink) dashboardLink.click();
    }
}

// Handle logout
function handleLogout() {
    fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
    })
    .then(() => {
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    })
    .catch(error => {
        console.error('Logout error:', error);
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    });
}

// Initialize dashboard
function initDashboard() {
    // Fetch dashboard stats
    fetchDashboardStats();
}

// Fetch dashboard stats
function fetchDashboardStats() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user || !user.token) {
        console.error('No user token found');
        return;
    }
    
    // Fetch total users
    fetch(`${API_BASE_URL}/admin/stats/users`, {
        headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Authentication required');
        }
        return response.json();
    })
    .then(data => {
        if (data.error) throw new Error(data.error);
        const totalUsers = document.getElementById('total-users');
        const proUsers = document.getElementById('pro-users');
        const newUsers = document.getElementById('new-users');
        
        if (totalUsers) totalUsers.textContent = data.count || 0;
        if (proUsers) proUsers.textContent = data.proCount || 0;
        if (newUsers) newUsers.textContent = data.newThisMonth || 0;
    })
    .catch(error => {
        console.error('Error fetching user stats:', error);
        const totalUsers = document.getElementById('total-users');
        const proUsers = document.getElementById('pro-users');
        const newUsers = document.getElementById('new-users');
        
        if (totalUsers) totalUsers.textContent = 'Error';
        if (proUsers) proUsers.textContent = 'Error';
        if (newUsers) newUsers.textContent = 'Error';
    });
    
    // Fetch total menus
    fetch(`${API_BASE_URL}/admin/stats/menus`, {
        headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Authentication required');
        }
        return response.json();
    })
    .then(data => {
        if (data.error) throw new Error(data.error);
        const totalMenus = document.getElementById('total-menus');
        if (totalMenus) totalMenus.textContent = data.count || 0;
    })
    .catch(error => {
        console.error('Error fetching menu stats:', error);
        const totalMenus = document.getElementById('total-menus');
        if (totalMenus) totalMenus.textContent = 'Error';
    });
}

// Initialize users section
function initUsers() {
    // Initialize user search if elements exist
    const searchInput = document.getElementById('users-search');
    const searchBtn = document.getElementById('users-search-btn');
    
    if (searchInput && searchBtn) {
        searchBtn.addEventListener('click', function() {
            fetchUsers(1, 20, searchInput.value);
        });
        
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                fetchUsers(1, 20, this.value);
            }
        });
    }
    
    // Initialize add user button if it exists
    const addUserBtn = document.getElementById('add-user-btn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', function() {
            showUserModal();
        });
    }
    
    // Initialize user modal
    initUserModal();
    
    // Fetch users on load
    fetchUsers();
}

// Fetch users
function fetchUsers(page = 1, limit = 20, search = '') {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user || !user.token) {
        console.error('No user token found');
        return;
    }
    
    const tbody = document.querySelector('#users-table tbody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-data">Loading users...</td></tr>';
    }
    
    fetch(`${API_BASE_URL}/admin/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`, {
        headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Authentication required');
        }
        return response.json();
    })
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        if (tbody) {
            renderUsers(data.users);
            renderPagination(data.page, data.totalPages, data.total, search);
        }
    })
    .catch(error => {
        console.error('Error fetching users:', error);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="loading-data">Error: ${error.message}</td></tr>`;
        }
    });
}

// Render users table
function renderUsers(users) {
    const tbody = document.querySelector('#users-table tbody');
    
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-data">No users found</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const tr = document.createElement('tr');
        
        // Format dates
        const createdDate = new Date(user.created_at).toLocaleDateString();
        const lastLogin = user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never';
        
        tr.innerHTML = `
            <td>${user.id}</td>
            <td>${user.name || '-'}</td>
            <td>${user.email}</td>
            <td>${createdDate}</td>
            <td>${lastLogin}</td>
            <td>
                <span class="badge ${user.subscription_status === 'free' ? 'badge-secondary' : 'badge-primary'}">
                    ${user.subscription_status || 'Free'}
                </span>
            </td>
            <td>
                <div class="table-actions">
                    <button class="edit-user-btn" data-id="${user.id}" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-user-btn" data-id="${user.id}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
    
    // Add event listeners to action buttons
    document.querySelectorAll('.edit-user-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.getAttribute('data-id');
            fetchUserDetails(userId);
        });
    });
    
    document.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.getAttribute('data-id');
            
            if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
                deleteUser(userId);
            }
        });
    });
}

// Render pagination
function renderPagination(currentPage, totalPages, totalItems, search) {
    const pagination = document.getElementById('users-pagination');
    if (!pagination) return; // Exit if pagination container doesn't exist

    const prevBtn = pagination.querySelector('.pagination-prev');
    const nextBtn = pagination.querySelector('.pagination-next');
    const numbersContainer = pagination.querySelector('.pagination-numbers');

    // Ensure all elements are found before proceeding
    if (!prevBtn || !nextBtn || !numbersContainer) {
        console.error("Pagination elements not found in the DOM.");
        return;
    }
    
    // Clear previous pagination
    numbersContainer.innerHTML = '';
    
    // Update prev/next buttons
    prevBtn.classList.toggle('disabled', currentPage <= 1);
    nextBtn.classList.toggle('disabled', currentPage >= totalPages);
    
    // Remove previous event listeners
    const prevClone = prevBtn.cloneNode(true);
    const nextClone = nextBtn.cloneNode(true);
    
    prevBtn.parentNode.replaceChild(prevClone, prevBtn);
    nextBtn.parentNode.replaceChild(nextClone, nextBtn);
    
    // Add event listeners
    if (currentPage > 1) {
        prevClone.addEventListener('click', () => fetchUsers(currentPage - 1, 20, search));
    }
    
    if (currentPage < totalPages) {
        nextClone.addEventListener('click', () => fetchUsers(currentPage + 1, 20, search));
    }
    
    // Generate page numbers
    for (let i = 1; i <= totalPages; i++) {
        // Show first, last, current, and 1 page before/after current
        if (i === 1 || i === totalPages || 
            (i >= currentPage - 1 && i <= currentPage + 1)) {
            const pageNum = document.createElement('div');
            pageNum.className = `page-number ${i === currentPage ? 'active' : ''}`;
            pageNum.textContent = i;
            
            // Add event listener
            if (i !== currentPage) {
                pageNum.addEventListener('click', () => fetchUsers(i, 20, search));
            }
            
            numbersContainer.appendChild(pageNum);
        } else if ((i === 2 && currentPage > 3) || 
                  (i === totalPages - 1 && currentPage < totalPages - 2)) {
            // Add ellipsis
            const ellipsis = document.createElement('div');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            numbersContainer.appendChild(ellipsis);
        }
    }
}

// Initialize user modal
function initUserModal() {
    const modal = document.getElementById('user-modal');
    if (!modal) return;
    
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = document.getElementById('user-cancel-btn');
    const saveBtn = document.getElementById('user-save-btn');
    const deleteBtn = document.getElementById('user-delete-btn');
    
    // Close modal
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            modal.classList.remove('active');
        });
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            modal.classList.remove('active');
        });
    }
    
    // Save user
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            saveUser();
        });
    }
    
    // Delete user
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function() {
            const userId = document.getElementById('user-id')?.value;
            
            if (userId && confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
                deleteUser(userId);
            }
        });
    }
}

// Show user modal for adding/editing
function showUserModal(userId = null) {
    const modal = document.getElementById('user-modal');
    const title = document.getElementById('user-modal-title');
    const idInput = document.getElementById('user-id');
    const nameInput = document.getElementById('user-name');
    const emailInput = document.getElementById('user-email');
    const planSelect = document.getElementById('user-plan');
    const expiryInput = document.getElementById('user-expiry');
    const adminCheckbox = document.getElementById('user-admin');
    const deleteBtn = document.getElementById('user-delete-btn');
    
    // Reset form
    document.getElementById('user-form').reset();
    
    if (userId) {
        // Editing existing user
        title.textContent = 'Edit User';
        idInput.value = userId;
        deleteBtn.style.display = 'block';
        
        // Fetch user details
        fetchUserDetails(userId);
    } else {
        // Adding new user
        title.textContent = 'Add User';
        idInput.value = '';
        deleteBtn.style.display = 'none';
        
        // Set default expiry date (30 days from now)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        expiryInput.value = expiryDate.toISOString().split('T')[0];
        
        modal.classList.add('active');
    }
}

// Fetch user details
function fetchUserDetails(userId) {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;
    
    fetch(`${API_BASE_URL}/admin/users/${userId}`, {
        headers: {
            'Authorization': `Bearer ${user.token || ''}`
        },
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        // Populate form
        document.getElementById('user-name').value = data.user.name || '';
        document.getElementById('user-email').value = data.user.email || '';
        document.getElementById('user-plan').value = data.user.subscription_status || 'free';
        
        if (data.user.subscription_end_date) {
            document.getElementById('user-expiry').value = new Date(data.user.subscription_end_date).toISOString().split('T')[0];
        }
        
        document.getElementById('user-admin').checked = data.user.is_admin === 1;
        
        // Show modal
        document.getElementById('user-modal').classList.add('active');
    })
    .catch(error => {
        console.error('Error fetching user details:', error);
        alert('Error fetching user details: ' + error.message);
    });
}

// Save user
function saveUser() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;
    
    const userId = document.getElementById('user-id').value;
    const name = document.getElementById('user-name').value;
    const email = document.getElementById('user-email').value;
    const plan = document.getElementById('user-plan').value;
    const expiry = document.getElementById('user-expiry').value;
    const isAdmin = document.getElementById('user-admin').checked;
    
    // Validate form
    if (!name || !email) {
        alert('Name and email are required');
        return;
    }
    
    const userData = {
        name,
        email,
        subscription_status: plan,
        is_admin: isAdmin
    };
    
    if (expiry) {
        userData.subscription_end_date = new Date(expiry).toISOString();
    }
    
    // Determine if adding or updating
    const method = userId ? 'PUT' : 'POST';
    const url = userId ? `${API_BASE_URL}/admin/users/${userId}` : `${API_BASE_URL}/admin/users`;
    
    fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.token || ''}`
        },
        body: JSON.stringify(userData),
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        // Close modal
        document.getElementById('user-modal').classList.remove('active');
        
        // Refresh users
        fetchUsers();
    })
    .catch(error => {
        console.error('Error saving user:', error);
        alert('Error saving user: ' + error.message);
    });
}

// Delete user
function deleteUser(userId) {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;
    
    fetch(`${API_BASE_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${user.token || ''}`
        },
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        // Close modal if open
        document.getElementById('user-modal').classList.remove('active');
        
        // Refresh users
        fetchUsers();
    })
    .catch(error => {
        console.error('Error deleting user:', error);
        alert('Error deleting user: ' + error.message);
    });
}

// Initialize plans section
function initPlans() {
    // Initialize add plan button if it exists
    const addPlanBtn = document.getElementById('add-plan-btn');
    if (addPlanBtn) {
        addPlanBtn.addEventListener('click', function() {
            showPlanModal();
        });
    }
    
    // Initialize plan modal
    initPlanModal();
    
    // Fetch plans on load
    fetchPlans();
}

// Fetch subscription plans
function fetchPlans() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user || !user.token) {
        console.error('No user token found');
        return;
    }
    
    const plansGrid = document.getElementById('plans-grid');
    if (plansGrid) {
        plansGrid.innerHTML = `
            <div class="plan-card loading">
                <div class="plan-header">
                    <h3>Loading plans...</h3>
                </div>
            </div>
        `;
    }
    
    fetch(`${API_BASE_URL}/admin/plans?includeInactive=true`, {
        headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Authentication required');
        }
        return response.json();
    })
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        if (plansGrid) {
            renderPlans(data);
        }
    })
    .catch(error => {
        console.error('Error fetching plans:', error);
        if (plansGrid) {
            plansGrid.innerHTML = `
                <div class="plan-card loading">
                    <div class="plan-header">
                        <h3>Error: ${error.message}</h3>
                    </div>
                </div>
            `;
        }
    });
}

// Render plans
function renderPlans(plans) {
    const plansGrid = document.getElementById('plans-grid');
    
    if (!plans || plans.length === 0) {
        plansGrid.innerHTML = `
            <div class="plan-card loading">
                <div class="plan-header">
                    <h3>No plans found</h3>
                </div>
            </div>
        `;
        return;
    }
    
    plansGrid.innerHTML = '';
    
    plans.forEach(plan => {
        const planCard = document.createElement('div');
        planCard.className = `plan-card ${plan.is_active ? '' : 'inactive'}`;
        
        // Format features list
        const features = plan.features.map(feature => 
            `<li><i class="fas fa-check"></i> ${feature}</li>`
        ).join('');
        
        planCard.innerHTML = `
            <div class="plan-header">
                <h3>${plan.display_name}</h3>
                ${plan.is_active ? '' : '<span class="inactive-badge">Inactive</span>'}
            </div>
            <div class="plan-body">
                <div class="plan-price">
                    $${plan.price_monthly.toFixed(2)} <span>/ month</span>
                </div>
                <div class="plan-meta">
                    <div><strong>ID:</strong> ${plan.id}</div>
                    <div><strong>Internal Name:</strong> ${plan.name}</div>
                </div>
                <ul class="plan-features">
                    ${features}
                </ul>
            </div>
            <div class="plan-footer">
                <button class="btn btn-outline edit-plan-btn" data-id="${plan.id}">Edit</button>
            </div>
        `;
        
        plansGrid.appendChild(planCard);
    });
    
    // Add event listeners to edit buttons
    document.querySelectorAll('.edit-plan-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const planId = this.getAttribute('data-id');
            showPlanModal(planId);
        });
    });
}

// Initialize plan modal
function initPlanModal() {
    const modal = document.getElementById('plan-modal');
    if (!modal) return; // Exit if modal doesn't exist

    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = document.getElementById('plan-cancel-btn');
    const saveBtn = document.getElementById('plan-save-btn');
    const deleteBtn = document.getElementById('plan-delete-btn');

    // Close modal
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            modal.classList.remove('active');
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            modal.classList.remove('active');
        });
    }

    // Save plan
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            savePlan();
        });
    }

    // Delete plan
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function() {
            const planId = document.getElementById('plan-id')?.value;

            if (planId && confirm('Are you sure you want to delete this plan? This action cannot be undone.')) {
                deletePlan(planId);
            }
        });
    }
}

// Show plan modal for adding/editing
function showPlanModal(planId = null) {
    const modal = document.getElementById('plan-modal');
    const title = document.getElementById('plan-modal-title');
    const idInput = document.getElementById('plan-id');
    const nameInput = document.getElementById('plan-name');
    const displayNameInput = document.getElementById('plan-display-name');
    const monthlyPriceInput = document.getElementById('plan-price-monthly');
    const yearlyPriceInput = document.getElementById('plan-price-yearly');
    const featuresTextarea = document.getElementById('plan-features');
    const activeCheckbox = document.getElementById('plan-active');
    const deleteBtn = document.getElementById('plan-delete-btn');
    
    // Reset form
    document.getElementById('plan-form').reset();
    
    if (planId) {
        // Editing existing plan
        title.textContent = 'Edit Subscription Plan';
        idInput.value = planId;
        deleteBtn.style.display = 'block';
        
        // Fetch plan details
        fetchPlanDetails(planId);
    } else {
        // Adding new plan
        title.textContent = 'Add Subscription Plan';
        idInput.value = '';
        deleteBtn.style.display = 'none';
        
        modal.classList.add('active');
    }
}

// Fetch plan details
function fetchPlanDetails(planId) {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;
    
    fetch(`${API_BASE_URL}/admin/plans/${planId}`, {
        headers: {
            'Authorization': `Bearer ${user.token || ''}`
        },
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        // Populate form
        document.getElementById('plan-name').value = data.name || '';
        document.getElementById('plan-display-name').value = data.display_name || '';
        document.getElementById('plan-price-monthly').value = data.price_monthly || 0;
        document.getElementById('plan-price-yearly').value = data.price_yearly || 0;
        document.getElementById('plan-active').checked = data.is_active === 1;
        
        // Format features as newline-separated text
        if (data.features && Array.isArray(data.features)) {
            document.getElementById('plan-features').value = data.features.join('\n');
        }
        
        // Show modal
        document.getElementById('plan-modal').classList.add('active');
    })
    .catch(error => {
        console.error('Error fetching plan details:', error);
        alert('Error fetching plan details: ' + error.message);
    });
}

// Save plan
function savePlan() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;
    
    const planId = document.getElementById('plan-id').value;
    const name = document.getElementById('plan-name').value;
    const displayName = document.getElementById('plan-display-name').value;
    const monthlyPrice = parseFloat(document.getElementById('plan-price-monthly').value) || 0;
    const yearlyPrice = parseFloat(document.getElementById('plan-price-yearly').value) || 0;
    const featuresText = document.getElementById('plan-features').value;
    const isActive = document.getElementById('plan-active').checked;
    
    // Validate form
    if (!name || !displayName) {
        alert('Name and display name are required');
        return;
    }
    
    // Parse features from textarea (split by newlines and remove empty lines)
    const features = featuresText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    
    const planData = {
        name,
        display_name: displayName,
        price_monthly: monthlyPrice,
        price_yearly: yearlyPrice,
        features,
        is_active: isActive
    };
    
    // Determine if adding or updating
    const method = planId ? 'PUT' : 'POST';
    const url = planId ? `${API_BASE_URL}/admin/plans/${planId}` : `${API_BASE_URL}/admin/plans`;
    
    fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.token || ''}`
        },
        body: JSON.stringify(planData),
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        // Close modal
        document.getElementById('plan-modal').classList.remove('active');
        
        // Refresh plans
        fetchPlans();
    })
    .catch(error => {
        console.error('Error saving plan:', error);
        alert('Error saving plan: ' + error.message);
    });
}

// Delete plan
function deletePlan(planId) {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;
    
    fetch(`${API_BASE_URL}/admin/plans/${planId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${user.token || ''}`
        },
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        // Close modal if open
        document.getElementById('plan-modal').classList.remove('active');
        
        // Refresh plans
        fetchPlans();
    })
    .catch(error => {
        console.error('Error deleting plan:', error);
        alert('Error deleting plan: ' + error.message);
    });
}

// Initialize content management
function initContent() {
    // Initialize content filter
    const sectionFilter = document.getElementById('content-section-filter');
    if (sectionFilter) {
        sectionFilter.addEventListener('change', function() {
            fetchContentBySection(this.value);
        });
    }
    
    // Initialize add content button
    const addContentBtn = document.getElementById('add-content-btn');
    if (addContentBtn) {
        addContentBtn.addEventListener('click', function() {
            showContentModal();
        });
    }
    
    // Initialize content modal
    initContentModal();
    
    // Fetch content sections for filter
    fetchContentSections();
    
    // Fetch all content blocks on load
    fetchContent();
}

// Fetch all content blocks
function fetchContent() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;
    
    const contentList = document.getElementById('content-blocks-list');
    contentList.innerHTML = '<div class="content-loading">Loading content blocks...</div>';
    
    fetch(`${API_BASE_URL}/admin/content`, {
        headers: {
            'Authorization': `Bearer ${user.token || ''}`
        },
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        renderContentBlocks(data);
    })
    .catch(error => {
        console.error('Error fetching content blocks:', error);
        contentList.innerHTML = `<div class="content-loading">Error: ${error.message}</div>`;
    });
}

// Fetch content by section
function fetchContentBySection(section) {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;
    
    const contentList = document.getElementById('content-blocks-list');
    contentList.innerHTML = '<div class="content-loading">Loading content blocks...</div>';
    
    const url = section === 'all' ? `${API_BASE_URL}/admin/content` : `${API_BASE_URL}/admin/content/section/${section}`;
    
    fetch(url, {
        headers: {
            'Authorization': `Bearer ${user.token || ''}`
        },
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        renderContentBlocks(data);
    })
    .catch(error => {
        console.error('Error fetching content blocks:', error);
        contentList.innerHTML = `<div class="content-loading">Error: ${error.message}</div>`;
    });
}

// Fetch content sections for filter
function fetchContentSections() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;
    
    fetch(`${API_BASE_URL}/admin/content/sections`, {
        headers: {
            'Authorization': `Bearer ${user.token || ''}`
        },
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        const sectionFilter = document.getElementById('content-section-filter');
        
        // Keep the "All Sections" option
        const allOption = sectionFilter.querySelector('option[value="all"]');
        sectionFilter.innerHTML = '';
        sectionFilter.appendChild(allOption);
        
        // Add section options
        data.forEach(section => {
            const option = document.createElement('option');
            option.value = section;
            option.textContent = section.charAt(0).toUpperCase() + section.slice(1);
            sectionFilter.appendChild(option);
        });
    })
    .catch(error => {
        console.error('Error fetching content sections:', error);
    });
}

// Render content blocks
function renderContentBlocks(contentBlocks) {
    const contentList = document.getElementById('content-blocks-list');
    
    if (!contentBlocks || contentBlocks.length === 0) {
        contentList.innerHTML = '<div class="content-loading">No content blocks found</div>';
        return;
    }
    
    contentList.innerHTML = '';
    
    contentBlocks.forEach(block => {
        const contentCard = document.createElement('div');
        contentCard.className = 'content-card';
        
        // Add inactive badge if needed
        if (!block.is_active) {
            const inactiveBadge = document.createElement('div');
            inactiveBadge.className = 'content-card-inactive';
            inactiveBadge.textContent = 'Inactive';
            contentCard.appendChild(inactiveBadge);
        }
        
        // Content header
        const header = document.createElement('div');
        header.className = 'content-card-header';
        
        const title = document.createElement('h3');
        title.textContent = block.title || block.identifier;
        
        const badge = document.createElement('span');
        badge.className = `content-card-badge badge-${block.content_type}`;
        badge.textContent = block.content_type.toUpperCase();
        
        header.appendChild(title);
        header.appendChild(badge);
        contentCard.appendChild(header);
        
        // Content body
        const body = document.createElement('div');
        body.className = 'content-card-body';
        
        // Identifier
        const identifierLabel = document.createElement('div');
        identifierLabel.className = 'content-card-label';
        identifierLabel.textContent = 'Identifier';
        
        const identifierValue = document.createElement('div');
        identifierValue.className = 'content-card-value';
        identifierValue.textContent = block.identifier;
        
        body.appendChild(identifierLabel);
        body.appendChild(identifierValue);
        
        // Section
        const sectionLabel = document.createElement('div');
        sectionLabel.className = 'content-card-label';
        sectionLabel.textContent = 'Section';
        
        const sectionValue = document.createElement('div');
        sectionValue.className = 'content-card-value';
        sectionValue.textContent = block.section;
        
        body.appendChild(sectionLabel);
        body.appendChild(sectionValue);
        
        // Preview content based on type
        const contentLabel = document.createElement('div');
        contentLabel.className = 'content-card-label';
        contentLabel.textContent = 'Preview';
        
        const contentValue = document.createElement('div');
        contentValue.className = 'content-card-value';
        
        if (block.content_type === 'image') {
            const imageContainer = document.createElement('div');
            imageContainer.className = 'content-card-image';
            
            const img = document.createElement('img');
            img.src = block.content;
            img.alt = block.title || block.identifier;
            img.onerror = function() {
                this.onerror = null;
                this.src = '';
                this.alt = 'Image not found';
            };
            
            imageContainer.appendChild(img);
            contentValue.appendChild(imageContainer);
        } else {
            const textContainer = document.createElement('div');
            textContainer.className = 'content-card-text';
            textContainer.textContent = block.content;
            contentValue.appendChild(textContainer);
        }
        
        body.appendChild(contentLabel);
        body.appendChild(contentValue);
        contentCard.appendChild(body);
        
        // Content footer
        const footer = document.createElement('div');
        footer.className = 'content-card-footer';
        
        const meta = document.createElement('div');
        meta.className = 'content-card-meta';
        meta.textContent = `Order: ${block.order_index}`;
        
        const actions = document.createElement('div');
        actions.className = 'content-card-actions';
        
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.setAttribute('title', 'Edit');
        editBtn.addEventListener('click', () => showContentModal(block.id));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.setAttribute('title', 'Delete');
        deleteBtn.addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete "${block.title || block.identifier}"?`)) {
                deleteContent(block.id);
            }
        });
        
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        
        footer.appendChild(meta);
        footer.appendChild(actions);
        contentCard.appendChild(footer);
        
        contentList.appendChild(contentCard);
    });
}

// Initialize content modal
function initContentModal() {
    const modal = document.getElementById('content-modal');
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = document.getElementById('content-cancel-btn');
    const saveBtn = document.getElementById('content-save-btn');
    const deleteBtn = document.getElementById('content-delete-btn');
    const contentTypeSelect = document.getElementById('content-type');
    
    // Close modal
    closeBtn.addEventListener('click', function() {
        modal.classList.remove('active');
    });
    
    cancelBtn.addEventListener('click', function() {
        modal.classList.remove('active');
    });
    
    // Save content
    saveBtn.addEventListener('click', function() {
        saveContent();
    });
    
    // Delete content
    deleteBtn.addEventListener('click', function() {
        const contentId = document.getElementById('content-id').value;
        const contentTitle = document.getElementById('content-title').value;
        
        if (confirm(`Are you sure you want to delete "${contentTitle}"?`)) {
            deleteContent(contentId);
        }
    });
    
    // Toggle content type fields
    contentTypeSelect.addEventListener('change', function() {
        toggleContentTypeFields(this.value);
    });
    
    // File upload handling
    const imageFileInput = document.getElementById('content-image-file');
    const imageUrlInput = document.getElementById('content-image-url');
    const imagePreview = document.getElementById('content-preview-img');
    const noImageText = document.getElementById('content-no-image');
    
    imageFileInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            uploadContentImage(file);
        }
    });
    
    imageUrlInput.addEventListener('input', function() {
        const url = this.value;
        if (url) {
            imagePreview.src = url;
            imagePreview.style.display = 'block';
            noImageText.style.display = 'none';
        } else {
            imagePreview.src = '';
            imagePreview.style.display = 'none';
            noImageText.style.display = 'block';
        }
    });
}

// Show content modal for adding/editing
function showContentModal(contentId = null) {
    const modal = document.getElementById('content-modal');
    const title = document.getElementById('content-modal-title');
    const idInput = document.getElementById('content-id');
    const identifierInput = document.getElementById('content-identifier');
    const titleInput = document.getElementById('content-title');
    const sectionSelect = document.getElementById('content-section');
    const typeSelect = document.getElementById('content-type');
    const contentTextArea = document.getElementById('content-text');
    const imageUrlInput = document.getElementById('content-image-url');
    const orderInput = document.getElementById('content-order');
    const activeCheckbox = document.getElementById('content-active');
    const metadataTextArea = document.getElementById('content-metadata');
    const deleteBtn = document.getElementById('content-delete-btn');
    
    // Reset form
    document.getElementById('content-form').reset();
    
    // Reset image preview
    const imagePreview = document.getElementById('content-preview-img');
    const noImageText = document.getElementById('content-no-image');
    imagePreview.src = '';
    imagePreview.style.display = 'none';
    noImageText.style.display = 'block';
    
    if (contentId) {
        // Editing existing content
        title.textContent = 'Edit Content';
        idInput.value = contentId;
        deleteBtn.style.display = 'block';
        
        // Fetch content details
        fetchContentDetails(contentId);
    } else {
        // Adding new content
        title.textContent = 'Add Content';
        idInput.value = '';
        deleteBtn.style.display = 'none';
        
        // Set defaults
        identifierInput.disabled = false;
        activeCheckbox.checked = true;
        orderInput.value = 0;
        
        // Set default content type
        typeSelect.value = 'text';
        toggleContentTypeFields('text');
        
        modal.classList.add('active');
    }
}

// Toggle content type fields
function toggleContentTypeFields(contentType) {
    const textGroup = document.getElementById('content-text-group');
    const imageGroup = document.getElementById('content-image-group');
    
    if (contentType === 'image') {
        textGroup.style.display = 'none';
        imageGroup.style.display = 'block';
    } else {
        textGroup.style.display = 'block';
        imageGroup.style.display = 'none';
    }
}

// Fetch content details
function fetchContentDetails(contentId) {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;
    
    fetch(`${API_BASE_URL}/admin/content/${contentId}`, {
        headers: {
            'Authorization': `Bearer ${user.token || ''}`
        },
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        // Populate form
        document.getElementById('content-identifier').value = data.identifier;
        document.getElementById('content-identifier').disabled = true; // Don't allow changing identifier
        document.getElementById('content-title').value = data.title || '';
        document.getElementById('content-section').value = data.section;
        document.getElementById('content-type').value = data.content_type;
        document.getElementById('content-text').value = data.content || '';
        document.getElementById('content-order').value = data.order_index || 0;
        document.getElementById('content-active').checked = data.is_active === 1;
        
        // Handle content type specific fields
        toggleContentTypeFields(data.content_type);
        
        if (data.content_type === 'image') {
            document.getElementById('content-image-url').value = data.content || '';
            
            const imagePreview = document.getElementById('content-preview-img');
            const noImageText = document.getElementById('content-no-image');
            
            if (data.content) {
                imagePreview.src = data.content;
                imagePreview.style.display = 'block';
                noImageText.style.display = 'none';
            } else {
                imagePreview.src = '';
                imagePreview.style.display = 'none';
                noImageText.style.display = 'block';
            }
        }
        
        // Format metadata JSON if exists
        if (data.metadata && Object.keys(data.metadata).length > 0) {
            document.getElementById('content-metadata').value = JSON.stringify(data.metadata, null, 2);
        } else {
            document.getElementById('content-metadata').value = '';
        }
        
        // Show modal
        document.getElementById('content-modal').classList.add('active');
    })
    .catch(error => {
        console.error('Error fetching content details:', error);
        alert('Error fetching content details: ' + error.message);
    });
}

// Save content
function saveContent() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;
    
    const contentId = document.getElementById('content-id').value;
    const identifier = document.getElementById('content-identifier').value;
    const title = document.getElementById('content-title').value;
    const section = document.getElementById('content-section').value;
    const contentType = document.getElementById('content-type').value;
    const orderIndex = document.getElementById('content-order').value;
    const isActive = document.getElementById('content-active').checked;
    const metadataString = document.getElementById('content-metadata').value;
    
    // Get content based on type
    let content = '';
    if (contentType === 'image') {
        content = document.getElementById('content-image-url').value;
    } else {
        content = document.getElementById('content-text').value;
    }
    
    // Validate form
    if (!identifier || !title || !section) {
        alert('Identifier, title, and section are required');
        return;
    }
    
    // Parse metadata if provided
    let metadata = {};
    if (metadataString.trim()) {
        try {
            metadata = JSON.parse(metadataString);
        } catch (e) {
            alert('Invalid JSON in metadata field');
            return;
        }
    }
    
    const contentData = {
        identifier,
        title,
        content,
        content_type: contentType,
        section,
        order_index: parseInt(orderIndex) || 0,
        is_active: isActive,
        metadata
    };
    
    // Determine if creating or updating
    const method = contentId ? 'PUT' : 'POST';
    const url = contentId ? `${API_BASE_URL}/admin/content/${contentId}` : `${API_BASE_URL}/admin/content`;
    
    fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.token || ''}`
        },
        body: JSON.stringify(contentData),
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        // Close modal
        document.getElementById('content-modal').classList.remove('active');
        
        // Refresh content blocks with current filter
        const sectionFilter = document.getElementById('content-section-filter');
        fetchContentBySection(sectionFilter.value);
    })
    .catch(error => {
        console.error('Error saving content:', error);
        alert('Error saving content: ' + error.message);
    });
}

// Delete content
function deleteContent(contentId) {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;
    
    fetch(`${API_BASE_URL}/admin/content/${contentId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${user.token || ''}`
        },
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        // Close modal if open
        document.getElementById('content-modal').classList.remove('active');
        
        // Refresh content blocks with current filter
        const sectionFilter = document.getElementById('content-section-filter');
        fetchContentBySection(sectionFilter.value);
    })
    .catch(error => {
        console.error('Error deleting content:', error);
        alert('Error deleting content: ' + error.message);
    });
}

// Upload content image
function uploadContentImage(file) {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;
    
    const formData = new FormData();
    formData.append('image', file);
    
    fetch(`${API_BASE_URL}/admin/content/upload-image`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${user.token || ''}`
        },
        body: formData,
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        // Update image URL input and preview
        document.getElementById('content-image-url').value = data.url;
        
        const imagePreview = document.getElementById('content-preview-img');
        const noImageText = document.getElementById('content-no-image');
        
        imagePreview.src = data.url;
        imagePreview.style.display = 'block';
        noImageText.style.display = 'none';
    })
    .catch(error => {
        console.error('Error uploading image:', error);
        alert('Error uploading image: ' + error.message);
    });
}

// Initialize settings section
function initSettings() {
    console.log('Initializing settings section');
    
    // Load current settings
    loadSettings();
    
    // Initialize logo upload
    initLogoUpload();
    
    // Initialize favicon upload
    initFaviconUpload();
    
    // Initialize save settings button
    document.getElementById('save-settings').addEventListener('click', saveSettings);
    
    // Initialize reset settings button
    document.getElementById('reset-settings').addEventListener('click', resetSettings);
}

// Load settings from the server
function loadSettings() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;
    
    fetch(`${API_BASE_URL}/admin/settings`, {
        headers: {
            'Authorization': `Bearer ${user.token || ''}`
        },
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        // Populate form fields with settings
        populateSettingsForm(data);
    })
    .catch(error => {
        console.error('Error loading settings:', error);
        alert('Error loading settings: ' + error.message);
    });
}

// Populate settings form with data
function populateSettingsForm(settings) {
    // App branding
    document.getElementById('site-name').value = getSetting(settings, 'site_name', 'Menu Builder Pro');
    document.getElementById('site-tagline').value = getSetting(settings, 'site_tagline', 'Create Beautiful Restaurant Menus in Minutes');
    
    // Logo preview
    const logoPath = getSetting(settings, 'logo_path', '');
    const logoPreview = document.getElementById('logo-preview');
    const noLogo = document.getElementById('no-logo');
    
    if (logoPath) {
        logoPreview.src = logoPath;
        logoPreview.style.display = 'block';
        noLogo.style.display = 'none';
    } else {
        logoPreview.style.display = 'none';
        noLogo.style.display = 'block';
    }
    
    // Favicon preview
    const faviconPath = getSetting(settings, 'favicon_path', '');
    const faviconPreview = document.getElementById('favicon-preview');
    const noFavicon = document.getElementById('no-favicon');
    
    if (faviconPath) {
        faviconPreview.src = faviconPath;
        faviconPreview.style.display = 'block';
        noFavicon.style.display = 'none';
    } else {
        faviconPreview.src = '/favicon.ico'; // Default favicon
        faviconPreview.style.display = 'block';
        noFavicon.style.display = 'none';
    }
    
    // Contact information
    document.getElementById('contact-email').value = getSetting(settings, 'contact_email', 'support@menubuilder.pro');
    document.getElementById('contact-phone').value = getSetting(settings, 'contact_phone', '');
    
    // Registration settings
    document.getElementById('enable-signups').checked = getSetting(settings, 'enable_signups', '1') === '1';
    document.getElementById('enable-free-trial').checked = getSetting(settings, 'enable_free_trial', '1') === '1';
    document.getElementById('free-trial-days').value = getSetting(settings, 'free_trial_days', '14');
}

// Get setting value with fallback
function getSetting(settings, key, fallback) {
    const setting = settings.find(s => s.setting_key === key);
    return setting ? setting.setting_value : fallback;
}

// Initialize logo upload
function initLogoUpload() {
    const logoFileInput = document.getElementById('logo-file');
    const logoPreview = document.getElementById('logo-preview');
    const noLogo = document.getElementById('no-logo');
    const removeLogoBtn = document.getElementById('remove-logo');
    
    // Handle file selection
    logoFileInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            // Check file size (max 2MB)
            if (this.files[0].size > 2 * 1024 * 1024) {
                alert('Logo file is too large. Maximum size is 2MB.');
                this.value = '';
                return;
            }
            
            uploadLogo(this.files[0]);
        }
    });
    
    // Handle logo removal
    removeLogoBtn.addEventListener('click', function() {
        removeLogo();
    });
}

// Upload logo
function uploadLogo(file) {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;
    
    const formData = new FormData();
    formData.append('logo', file);
    
    fetch(`${API_BASE_URL}/admin/settings/logo`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${user.token || ''}`
        },
        body: formData,
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        // Update logo preview
        const logoPreview = document.getElementById('logo-preview');
        const noLogo = document.getElementById('no-logo');
        
        logoPreview.src = data.logo_path;
        logoPreview.style.display = 'block';
        noLogo.style.display = 'none';
        
        alert('Logo uploaded successfully!');
    })
    .catch(error => {
        console.error('Error uploading logo:', error);
        alert('Error uploading logo: ' + error.message);
    });
}

// Remove logo
function removeLogo() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;
    
    if (!confirm('Are you sure you want to remove the logo?')) {
        return;
    }
    
    fetch(`${API_BASE_URL}/admin/settings/logo`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${user.token || ''}`
        },
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        // Update logo preview
        const logoPreview = document.getElementById('logo-preview');
        const noLogo = document.getElementById('no-logo');
        
        logoPreview.style.display = 'none';
        noLogo.style.display = 'block';
        
        // Clear file input
        document.getElementById('logo-file').value = '';
        
        alert('Logo removed successfully!');
    })
    .catch(error => {
        console.error('Error removing logo:', error);
        alert('Error removing logo: ' + error.message);
    });
}

// Initialize favicon upload
function initFaviconUpload() {
    const faviconFileInput = document.getElementById('favicon-file');
    const faviconPreview = document.getElementById('favicon-preview');
    const noFavicon = document.getElementById('no-favicon');
    
    // Handle file selection
    faviconFileInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            // Check file size (max 1MB)
            if (this.files[0].size > 1 * 1024 * 1024) {
                alert('Favicon file is too large. Maximum size is 1MB.');
                this.value = '';
                return;
            }
            
            uploadFavicon(this.files[0]);
        }
    });
}

// Upload favicon
function uploadFavicon(file) {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;
    
    const formData = new FormData();
    formData.append('favicon', file);
    
    fetch(`${API_BASE_URL}/admin/settings/favicon`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${user.token || ''}`
        },
        body: formData,
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        // Update favicon preview
        const faviconPreview = document.getElementById('favicon-preview');
        const noFavicon = document.getElementById('no-favicon');
        
        faviconPreview.src = data.favicon_path + '?t=' + new Date().getTime(); // Add timestamp to prevent caching
        faviconPreview.style.display = 'block';
        noFavicon.style.display = 'none';
        
        alert('Favicon uploaded successfully!');
    })
    .catch(error => {
        console.error('Error uploading favicon:', error);
        alert('Error uploading favicon: ' + error.message);
    });
}

// Save settings
function saveSettings() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;
    
    const settings = {
        site_name: document.getElementById('site-name').value,
        site_tagline: document.getElementById('site-tagline').value,
        contact_email: document.getElementById('contact-email').value,
        contact_phone: document.getElementById('contact-phone').value,
        enable_signups: document.getElementById('enable-signups').checked ? '1' : '0',
        enable_free_trial: document.getElementById('enable-free-trial').checked ? '1' : '0',
        free_trial_days: document.getElementById('free-trial-days').value
    };
    
    fetch(`${API_BASE_URL}/admin/settings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.token || ''}`
        },
        body: JSON.stringify(settings),
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        alert('Settings saved successfully!');
    })
    .catch(error => {
        console.error('Error saving settings:', error);
        alert('Error saving settings: ' + error.message);
    });
}

// Reset settings form
function resetSettings() {
    if (confirm('Are you sure you want to reset the settings? This will discard any unsaved changes.')) {
        loadSettings();
    }
}

// Initialize appearance section
function initAppearance() {
    // Initialize color pickers
    const primaryColorInput = document.getElementById('primary-color');
    const secondaryColorInput = document.getElementById('secondary-color');
    const primaryColorPreview = document.getElementById('primary-color-preview');
    const secondaryColorPreview = document.getElementById('secondary-color-preview');
    
    primaryColorInput.addEventListener('input', function() {
        primaryColorPreview.style.backgroundColor = this.value;
    });
    
    secondaryColorInput.addEventListener('input', function() {
        secondaryColorPreview.style.backgroundColor = this.value;
    });
    
    // Fetch appearance settings
    fetchAppearanceSettings();
    
    // Initialize save button
    document.getElementById('save-appearance-btn').addEventListener('click', function() {
        saveAppearanceSettings();
    });
}

// Fetch appearance settings
function fetchAppearanceSettings() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;
    
    fetch(`${API_BASE_URL}/admin/settings/appearance`, {
        headers: {
            'Authorization': `Bearer ${user.token || ''}`
        },
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        // Populate form
        document.getElementById('primary-color').value = data.primary_color || '#4a6bfa';
        document.getElementById('secondary-color').value = data.secondary_color || '#f97316';
        
        // Update previews
        document.getElementById('primary-color-preview').style.backgroundColor = data.primary_color || '#4a6bfa';
        document.getElementById('secondary-color-preview').style.backgroundColor = data.secondary_color || '#f97316';
    })
    .catch(error => {
        console.error('Error fetching appearance settings:', error);
        alert('Error fetching appearance settings: ' + error.message);
    });
}

// Save appearance settings
function saveAppearanceSettings() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;
    
    const settings = {
        primary_color: document.getElementById('primary-color').value,
        secondary_color: document.getElementById('secondary-color').value
    };
    
    fetch(`${API_BASE_URL}/admin/settings/appearance`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.token || ''}`
        },
        body: JSON.stringify(settings),
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        alert('Appearance settings saved successfully');
    })
    .catch(error => {
        console.error('Error saving appearance settings:', error);
        alert('Error saving appearance settings: ' + error.message);
    });
}

// --- START: Global Settings Section Logic --- 

function initGlobalSettings() {
    console.log('Initializing Global Settings...');
    fetchCurrentAppSettings(); // Fetch logo initially
    
    const uploadBtn = document.getElementById('upload-app-logo-btn');
    const fileInput = document.getElementById('app-logo-input');
    const messageDiv = document.getElementById('app-logo-message');

    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', async () => {
            const file = fileInput.files[0];
            if (!file) {
                showMessage(messageDiv, 'Please select a logo file first.', 'error');
                return;
            }

            const formData = new FormData();
            formData.append('app_logo', file); // Match the field name expected by multer

            // CORRECTED: Retrieve user token consistently
            const loggedInUser = JSON.parse(localStorage.getItem('user') || 'null');
            if (!loggedInUser || !loggedInUser.token) {
                 console.error('initGlobalSettings: No user token found in localStorage for logo upload.'); // Added log detail
                 showMessage(messageDiv, 'Authentication error. Please log in again.', 'error');
                 return;
            }

            try {
                showMessage(messageDiv, 'Uploading logo...', 'info');
                uploadBtn.disabled = true;

                const response = await fetch(`${API_BASE_URL}/admin/settings/app-logo`, {
                    method: 'POST',
                    headers: {
                        // CORRECTED: Use the retrieved token
                        'Authorization': `Bearer ${loggedInUser.token}`
                        // Content-Type is set automatically for FormData
                    },
                    body: formData
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Upload failed');
                }

                showMessage(messageDiv, 'Logo updated successfully!', 'success');
                // Update preview
                const previewImg = document.getElementById('current-app-logo-preview');
                if (previewImg) {
                    // Add a cache-busting query string
                    previewImg.src = data.logoPath + '?t=' + new Date().getTime(); 
                }
                fileInput.value = ''; // Clear file input

            } catch (error) {
                console.error('Error uploading app logo:', error);
                showMessage(messageDiv, `Error: ${error.message}`, 'error');
            } finally {
                 uploadBtn.disabled = false;
            }
        });
    } else {
        console.error('Could not find logo upload button or file input.');
    }
}

// Fetch current app settings (like logo path)
async function fetchCurrentAppSettings() {
    try {
        const response = await fetch(`${API_BASE_URL}/settings/public`);
        if (!response.ok) {
            throw new Error('Failed to fetch app settings');
        }
        const settings = await response.json();
        
        const previewImg = document.getElementById('current-app-logo-preview');
        if (previewImg) {
            if (settings.app_logo_path) {
                previewImg.src = settings.app_logo_path;
                previewImg.style.display = 'block'; 
            } else {
                previewImg.src = ''; // Clear src if no logo set
                 previewImg.alt = 'No logo set';
                 previewImg.style.display = 'none'; // Hide if no logo
            }
        }
        // Update other global settings display if needed

    } catch (error) {
        console.error('Error fetching current app settings:', error);
        const messageDiv = document.getElementById('app-logo-message');
        if (messageDiv) {
            showMessage(messageDiv, 'Could not load current app settings.', 'error');
        }
    }
}

// Generic message function (if not already defined elsewhere)
function showMessage(element, message, type = 'info') {
    if (!element) return;
    element.textContent = message;
    element.className = `message ${type}`;
    element.style.display = 'block';
    // Optional: Auto-hide after a few seconds
    // setTimeout(() => { element.style.display = 'none'; }, 5000);
}

// --- END: Global Settings Section Logic --- 

// Initialize appearance section 