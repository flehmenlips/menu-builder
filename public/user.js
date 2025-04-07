// User Portal JavaScript

// Global variables
let currentUser = null;
let authToken = null;

// DOM Elements
const userLoginContainer = document.getElementById('user-login-container');
const userRegisterContainer = document.getElementById('user-register-container');
const userDashboard = document.getElementById('user-dashboard');
const loginForm = document.getElementById('user-login-form');
const registerForm = document.getElementById('user-register-form');
const loginMessage = document.getElementById('login-message');
const registerMessage = document.getElementById('register-message');
const logoutBtn = document.getElementById('logout-btn');
const navLinks = document.querySelectorAll('.nav-link');
const contentSections = document.querySelectorAll('.content-section');

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    console.log('User Portal DOM Loaded - Attempting Auth Verification...');
    // Don't check localStorage['userToken']. Directly try to verify via cookie.
    const loggedIn = await verifyUserToken(); // Await the verification result

    if (loggedIn) {
        console.log('User Portal: Verified. Initializing navigation and loading section.');
        initUserNavigation(); // Initialize navigation
        
        // Determine initial section from hash or default to dashboard
        const initialSectionId = window.location.hash.substring(1) || 'dashboard';
        console.log(`User Portal: Initial section requested: ${initialSectionId}`);
        
        // Find the link and click it to load the section (or handle directly)
        const initialLink = document.querySelector(`.user-nav .nav-link[data-section="${initialSectionId}"]`);
        if (initialLink) {
            console.log(`User Portal: Clicking initial link for ${initialSectionId}`);
            initialLink.click(); // Let the nav handler load the section
        } else {
            console.warn(`User Portal: No nav link found for section '${initialSectionId}'. Loading dashboard as fallback.`);
            const dashboardLink = document.querySelector('.user-nav .nav-link[data-section="dashboard"]');
            if (dashboardLink) dashboardLink.click();
             else showSection('dashboard'); // Direct fallback if link missing
        }

        // Add a small delay to allow rendering/styles to apply after click
        setTimeout(() => {
            console.log("--- DEBUG: Checking element visibility after init ---");
            const dashboard = document.getElementById('user-dashboard');
            const profileSection = document.getElementById('profile-section');
            
            if (dashboard) {
                const dashboardStyle = window.getComputedStyle(dashboard);
                console.log('Dashboard computed display:', dashboardStyle.display);
                console.log('Dashboard has active class:', dashboard.classList.contains('active'));
            } else {
                console.error('Dashboard element not found for visibility check!');
            }

            if (profileSection) {
                const profileStyle = window.getComputedStyle(profileSection);
                console.log('Profile section computed display:', profileStyle.display);
                console.log('Profile section has active class:', profileSection.classList.contains('active'));
            } else {
                 console.error('Profile section element not found for visibility check!');
            }
             console.log("--- END DEBUG ---");
        }, 100); // 100ms delay
    } else {
        console.log('User Portal: Not verified. Login form should be visible.');
        // verifyUserToken should have already shown the login form on failure.
        // We might not need to do anything extra here unless verifyUserToken failed silently.
         if (userLoginContainer && userLoginContainer.classList.contains('active') !== true) {
             console.warn('User Portal: Manually showing login container as verification failed.');
             if (userDashboard) userDashboard.classList.remove('active');
             if (userRegisterContainer) userRegisterContainer.classList.remove('active');
             userLoginContainer.classList.add('active');
         }
    }

    // --- Initialize Handlers --- 
    if(loginForm) loginForm.addEventListener('submit', handleUserLogin);
    if(registerForm) registerForm.addEventListener('submit', handleUserRegistration);
    // Logout button listener should be inside the dashboard scope, maybe added in initUserNavigation?
    // Or ensure it's found only when dashboard is active.
    const logoutBtnElem = document.getElementById('logout-btn');
    if(logoutBtnElem) {
         logoutBtnElem.addEventListener('click', handleLogout); 
         console.log('User Portal: Logout button listener attached.');
    } else {
         console.warn('User Portal: Logout button not found on initial load.');
    }
    
    // Toggle between login and register forms listeners
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').style.display = 'none';
        });
    });

    const createAccountLink = document.getElementById('create-account');
    const backToLoginLink = document.getElementById('back-to-login');

    if(createAccountLink) {
        createAccountLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (userLoginContainer) userLoginContainer.classList.remove('active');
            if (userRegisterContainer) userRegisterContainer.classList.add('active');
        });
    }

    if(backToLoginLink) {
        backToLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (userRegisterContainer) userRegisterContainer.classList.remove('active');
            if (userLoginContainer) userLoginContainer.classList.add('active');
        });
    }
});

// Add this function definition somewhere globally in user.js
function handleUnauthorized() {
    console.error("Handling Unauthorized (401): Clearing token and showing login.");
    localStorage.removeItem('user'); // Clear unified user data
    localStorage.removeItem('userToken'); 
    currentUser = null;
    // Explicitly show login using class, hide others
    if(userDashboard) userDashboard.classList.remove('active');
    if(userRegisterContainer) userRegisterContainer.classList.remove('active');
    if(userLoginContainer) userLoginContainer.classList.add('active');
}

// Functions
async function handleUserLogin(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginMsgElement = document.getElementById('login-message'); 

    try {
        const response = await fetch('/api/auth/login', { 
             method: 'POST',
             headers: {'Content-Type': 'application/json'},
             body: JSON.stringify({ email, password })
        });
        
        const data = await response.json().catch(() => ({})); 

        if (response.ok && data.user) { 
            // Login API success -> Server set cookie. Now verify to update UI.
            console.log("handleUserLogin: Login API successful. Verifying token to show dashboard...");
            // Don't store 'user' here, let verify handle it if needed by header
            // localStorage.setItem('user', JSON.stringify(data.user)); 
            // localStorage.removeItem('userToken'); 
            const loggedIn = await verifyUserToken(); // Let verify show the dashboard
            if (!loggedIn) {
                showMessage(loginMsgElement, 'Verification failed after login attempt.', 'error');
            }
            // NO REDIRECT
        } else {
            const errorMsg = data.error || data.message || 'Login failed or invalid response';
            showMessage(loginMsgElement, errorMsg, 'error');
            console.error("Login failed:", errorMsg);
        }
    } catch (error) {
        showMessage(loginMsgElement, 'An error occurred. Please try again.', 'error');
        console.error('Login error:', error);
    }
}

async function handleUserRegistration(event) {
    event.preventDefault();
    
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (password !== confirmPassword) {
        showMessage(registerMessage, 'Passwords do not match', 'error');
        return;
    }

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage(registerMessage, 'Registration successful! Please login.', 'success');
            userRegisterContainer.classList.remove('active');
            userLoginContainer.classList.add('active');
            if(loginForm) loginForm.reset();
        } else {
            showMessage(registerMessage, data.error || data.message || 'Registration failed', 'error');
        }
    } catch (error) {
        showMessage(registerMessage, 'An error occurred. Please try again.', 'error');
        console.error('Registration error:', error);
    }
}

async function verifyUserToken() { // Removed token parameter
    console.log("verifyUserToken: Starting verification (using cookie)...");
    try {
        const response = await fetch('/api/auth/verify', { 
            method: 'GET',
            credentials: 'include'
        });
        console.log("verifyUserToken: /api/auth/verify status:", response.status);
        const data = await response.json(); 
        console.log("verifyUserToken: /api/auth/verify data:", data);

        if (response.ok && data.loggedIn) {
            console.log("verifyUserToken: SUCCESS - Logged In. User:", data.user);
            currentUser = data.user;
            // localStorage.setItem('userToken', 'loggedIn'); // We don't need this flag anymore
            
            console.log("verifyUserToken: Hiding login, showing dashboard via class...");
            // Use classList to control visibility
            if (userLoginContainer) userLoginContainer.classList.remove('active'); 
            if (userRegisterContainer) userRegisterContainer.classList.remove('active');
            if (userDashboard) userDashboard.classList.add('active'); 
            
            console.log("verifyUserToken: Updating header elements...");
            const userNameElement = document.getElementById('user-name');
            const planBadgeElement = document.getElementById('user-plan-badge');
            if(userNameElement) { userNameElement.textContent = currentUser.name || currentUser.email; }
            if(planBadgeElement) { planBadgeElement.textContent = currentUser.subscription_status || 'Free'; } 

            console.log("verifyUserToken: Verification successful, returning true.");
            return true; // Indicate success
            
        } else {
            console.log('verifyUserToken: FAILED. Showing login via class.');
            localStorage.removeItem('user'); // Clear unified user data
            localStorage.removeItem('userToken'); 
            // Use classList to control visibility
            if (userDashboard) userDashboard.classList.remove('active');
            if (userRegisterContainer) userRegisterContainer.classList.remove('active');
            if (userLoginContainer) userLoginContainer.classList.add('active'); 
            return false; // Indicate failure
        }
    } catch (error) {
        console.error('verifyUserToken: CAUGHT ERROR:', error); 
        localStorage.removeItem('user'); // Clear unified user data
        localStorage.removeItem('userToken'); 
         // Use classList to control visibility
        if (userDashboard) userDashboard.classList.remove('active');
        if (userRegisterContainer) userRegisterContainer.classList.remove('active');
        if (userLoginContainer) userLoginContainer.classList.add('active'); 
        return false; // Indicate failure
    }
}

function handleLogout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
        .catch(err => console.error("Server logout call failed:", err))
        .finally(() => {
            localStorage.removeItem('user'); // Clear the unified user data
            localStorage.removeItem('userToken'); // Clear old flag just in case
            currentUser = null;
            
            // Show login form
            if(userDashboard) userDashboard.classList.remove('active');
            if(userLoginContainer) userLoginContainer.classList.add('active');
            if(userRegisterContainer) userRegisterContainer.classList.remove('active');
            
            if(loginForm) loginForm.reset();
        });
}

function showSection(sectionId) {
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.section === sectionId) {
            link.classList.add('active');
        }
    });

    contentSections.forEach(section => {
        section.classList.remove('active');
        if (section.id === `${sectionId}-section`) {
            section.classList.add('active');
            
            // Load section data / Initialize section JS
            switch(sectionId) {
                case 'dashboard':
                    loadDashboardData();
                    break;
                case 'menus':
                    loadMenusData();
                    break;
                case 'templates':
                    loadTemplatesData();
                    break;
                case 'profile':
                    // Call initProfile, which includes fetching data
                    initProfile(); 
                    break;
                case 'billing':
                    loadBillingData();
                    break;
            }
        }
    });
}

async function loadDashboardData() {
    console.log("Loading dashboard data...");
    try {
        const response = await fetch('/api/user/dashboard-stats', { 
             method: 'GET',
             credentials: 'include'
        });

        if (!response.ok) {
            if (response.status === 401) handleUnauthorized();
            const errorData = await response.json().catch(() => ({ error: 'Failed to fetch dashboard data' }));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
            
        const data = await response.json();
        console.log("Dashboard stats received:", data);
        
        const totalMenusEl = document.getElementById('total-menus');
        const activeMenusEl = document.getElementById('active-menus');
        const menuViewsEl = document.getElementById('menu-views');
        const storageUsedEl = document.getElementById('storage-used');
        const activityListEl = document.getElementById('activity-list');

        if(totalMenusEl) totalMenusEl.textContent = data.totalMenus ?? 0;
        if(activeMenusEl) activeMenusEl.textContent = data.activeMenus ?? 0;
        if(menuViewsEl) menuViewsEl.textContent = data.menuViews ?? 0;
        if(storageUsedEl) storageUsedEl.textContent = `${data.storageUsed ?? 0} MB`;
        
        if (activityListEl) {
            activityListEl.innerHTML = '';
            if (data.recentActivity && data.recentActivity.length > 0) {
                data.recentActivity.forEach(activity => {
                    const activityItem = document.createElement('div');
                    activityItem.className = 'activity-item';
                    activityItem.innerHTML = `
                        <div class="activity-content">
                            <p>${activity.description}</p>
                            <span class="activity-time">${new Date(activity.timestamp).toLocaleString()}</span>
                        </div>
                    `;
                    activityListEl.appendChild(activityItem);
                });
            } else {
                activityListEl.innerHTML = '<div class="activity-item"><div class="activity-content"><p>No recent activity</p></div></div>';
            }
        }

    } catch (error) {
        console.error('loadDashboardData: CAUGHT ERROR:', error);
        const totalMenusEl = document.getElementById('total-menus');
        if(totalMenusEl) totalMenusEl.textContent = 'Error'; 
        const activeMenusEl = document.getElementById('active-menus');
        if(activeMenusEl) activeMenusEl.textContent = 'Error';
        const menuViewsEl = document.getElementById('menu-views');
        if(menuViewsEl) menuViewsEl.textContent = 'Error';
        const storageUsedEl = document.getElementById('storage-used');
        if(storageUsedEl) storageUsedEl.textContent = 'Error';
        const activityListEl = document.getElementById('activity-list');
        if(activityListEl) activityListEl.innerHTML = '<div class="activity-item"><div class="activity-content"><p>Error loading activity</p></div></div>';
    }
}

async function loadMenusData() {
    try {
        const response = await fetch('/api/user/menus', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            const menusGrid = document.getElementById('menus-grid');
            menusGrid.innerHTML = '';

            data.menus.forEach(menu => {
                const menuCard = document.createElement('div');
                menuCard.className = 'menu-card';
                menuCard.innerHTML = `
                    <div class="menu-header">
                        <h3>${menu.name}</h3>
                        <span class="menu-status ${menu.is_published ? 'published' : 'draft'}">
                            ${menu.is_published ? 'Published' : 'Draft'}
                        </span>
                    </div>
                    <div class="menu-info">
                        <p>${menu.description || 'No description'}</p>
                        <p class="menu-stats">
                            <span>Views: ${menu.views}</span>
                            <span>Last Updated: ${new Date(menu.updated_at).toLocaleDateString()}</span>
                        </p>
                    </div>
                    <div class="menu-actions">
                        <button onclick="editMenu(${menu.id})" class="btn-secondary">Edit</button>
                        <button onclick="deleteMenu(${menu.id})" class="btn-danger">Delete</button>
                    </div>
                `;
                menusGrid.appendChild(menuCard);
            });
        }
    } catch (error) {
        console.error('Error loading menus data:', error);
    }
}

async function loadTemplatesData() {
    try {
        const response = await fetch('/api/user/templates', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            const templatesGrid = document.getElementById('templates-grid');
            templatesGrid.innerHTML = '';

            data.templates.forEach(template => {
                const templateCard = document.createElement('div');
                templateCard.className = 'template-card';
                templateCard.innerHTML = `
                    <div class="template-header">
                        <h3>${template.name}</h3>
                        <span class="template-category">${template.category}</span>
                    </div>
                    <div class="template-preview">
                        <img src="${template.preview_url}" alt="${template.name}">
                    </div>
                    <div class="template-actions">
                        <button onclick="useTemplate(${template.id})" class="btn-primary">Use Template</button>
                    </div>
                `;
                templatesGrid.appendChild(templateCard);
            });
        }
    } catch (error) {
        console.error('Error loading templates data:', error);
    }
}

async function loadProfileData() {
    try {
        const response = await fetch('/api/user/profile', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            
            document.getElementById('profile-name').value = data.name;
            document.getElementById('profile-email').value = data.email;
            
            if (data.avatar_url) {
                document.getElementById('avatar-preview').style.display = 'block';
                document.getElementById('avatar-preview').src = data.avatar_url;
                document.getElementById('no-avatar').style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error loading profile data:', error);
    }
}

async function loadBillingData() {
    try {
        const response = await fetch('/api/user/billing', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            
            document.getElementById('current-plan-name').textContent = data.currentPlan.name;
            document.getElementById('current-plan-price').textContent = `$${data.currentPlan.price}/month`;
            
            const featuresList = document.getElementById('plan-features-list');
            featuresList.innerHTML = '';
            data.currentPlan.features.forEach(feature => {
                const li = document.createElement('li');
                li.textContent = feature;
                featuresList.appendChild(li);
            });
            
            const billingTable = document.getElementById('billing-table').getElementsByTagName('tbody')[0];
            billingTable.innerHTML = '';
            
            data.billingHistory.forEach(record => {
                const row = billingTable.insertRow();
                row.innerHTML = `
                    <td>${new Date(record.date).toLocaleDateString()}</td>
                    <td>${record.description}</td>
                    <td>$${record.amount}</td>
                    <td><span class="status ${record.status.toLowerCase()}">${record.status}</span></td>
                `;
            });
        }
    } catch (error) {
        console.error('Error loading billing data:', error);
    }
}

function createNewMenu() {
    document.getElementById('menu-id').value = '';
    document.getElementById('menu-name').value = '';
    document.getElementById('menu-template').value = '';
    document.getElementById('menu-category').value = 'restaurant';
    document.getElementById('menu-description').value = '';
    document.getElementById('menu-published').checked = false;
    
    showModal('menu-editor-modal');
}

async function editMenu(menuId) {
    try {
        const response = await fetch(`/api/user/menus/${menuId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const menu = await response.json();
            
            document.getElementById('menu-id').value = menu.id;
            document.getElementById('menu-name').value = menu.name;
            document.getElementById('menu-template').value = menu.template_id;
            document.getElementById('menu-category').value = menu.category;
            document.getElementById('menu-description').value = menu.description;
            document.getElementById('menu-published').checked = menu.is_published;
            
            showModal('menu-editor-modal');
        }
    } catch (error) {
        console.error('Error loading menu data:', error);
    }
}

async function saveMenu(event) {
    event.preventDefault();
    
    const menuId = document.getElementById('menu-id').value;
    const menuData = {
        name: document.getElementById('menu-name').value,
        template_id: document.getElementById('menu-template').value,
        category: document.getElementById('menu-category').value,
        description: document.getElementById('menu-description').value,
        is_published: document.getElementById('menu-published').checked
    };

    try {
        const response = await fetch(`/api/user/menus/${menuId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(menuData)
        });

        if (response.ok) {
            hideModal('menu-editor-modal');
            loadMenusData();
        } else {
            const data = await response.json();
            showMessage(document.getElementById('menu-editor-modal').querySelector('.message'), data.message, 'error');
        }
    } catch (error) {
        console.error('Error saving menu:', error);
    }
}

async function deleteMenu(menuId) {
    if (!confirm('Are you sure you want to delete this menu?')) {
        return;
    }

    try {
        const response = await fetch(`/api/user/menus/${menuId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            loadMenusData();
        } else {
            const data = await response.json();
            showMessage(document.querySelector('.message'), data.message, 'error');
        }
    } catch (error) {
        console.error('Error deleting menu:', error);
    }
}

async function useTemplate(templateId) {
    try {
        const response = await fetch(`/api/user/templates/${templateId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const template = await response.json();
            
            const menuData = {
                name: `New ${template.name} Menu`,
                template_id: template.id,
                category: template.category,
                description: 'Created from template',
                is_published: false
            };

            const createResponse = await fetch('/api/user/menus', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(menuData)
            });

            if (createResponse.ok) {
                const newMenu = await createResponse.json();
                editMenu(newMenu.id);
            }
        }
    } catch (error) {
        console.error('Error using template:', error);
    }
}

async function saveProfile(event) {
    event.preventDefault();
    
    const profileData = {
        name: document.getElementById('profile-name').value,
        email: document.getElementById('profile-email').value
    };

    const password = document.getElementById('profile-password').value;
    const confirmPassword = document.getElementById('profile-confirm-password').value;

    if (password) {
        if (password !== confirmPassword) {
            showMessage(document.querySelector('.message'), 'Passwords do not match', 'error');
            return;
        }
        profileData.password = password;
    }

    try {
        const response = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(profileData)
        });

        if (response.ok) {
            showMessage(document.querySelector('.message'), 'Profile updated successfully', 'success');
            loadProfileData();
        } else {
            const data = await response.json();
            showMessage(document.querySelector('.message'), data.message, 'error');
        }
    } catch (error) {
        console.error('Error saving profile:', error);
    }
}

async function upgradePlan(planId) {
    try {
        const response = await fetch('/api/user/billing/upgrade', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ plan_id: planId })
        });

        if (response.ok) {
            const data = await response.json();
            window.location.href = data.payment_url;
        } else {
            const data = await response.json();
            showMessage(document.querySelector('.message'), data.message, 'error');
        }
    } catch (error) {
        console.error('Error upgrading plan:', error);
    }
}

function showMessage(element, message, type = 'success') {
    element.textContent = message;
    element.className = `message ${type}`;
    element.style.display = 'block';
    
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function hideModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// File Upload Handlers
// document.getElementById('profile-avatar').addEventListener('change', handleAvatarUpload); // REMOVED - uses old ID

async function handleAvatarUpload(event) {
    // This function might be unused now, consider removing if setupLogoUpload covers it.
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    // TODO: Add API call to upload avatar
    console.log('Avatar upload not implemented yet.');
}

function initProfile() {
    console.log('Initializing profile section');
    fetchProfileData();
    setupProfileForm();
    setupLogoUpload();
}

async function fetchProfileData() {
    console.log('Fetching profile data...');
    const profileForm = document.getElementById('profile-form');
    const profileMessage = document.getElementById('profile-message');
    
    if (!profileForm) {
        console.error('Profile form not found');
        return;
    }

    try {
        const response = await fetch('/api/profile', {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Profile not found. Please complete your profile.');
            } else if (response.status === 401) {
                handleUnauthorized();
                throw new Error('Unauthorized');
            } else {
                 const errorData = await response.json().catch(() => ({ error: 'Failed to fetch profile' }));
                 throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
        }

        const profile = await response.json();
        console.log('Profile data received:', profile);

        // --- DETAILED LOGGING FOR POPULATION --- 
        console.log('Attempting to populate profile form...');
        const elementsToPopulate = [
            { id: 'company-name', prop: 'company_name' },
            { id: 'company-address', prop: 'address' },
            { id: 'company-phone', prop: 'phone' },
            { id: 'company-email', prop: 'email' },
            { id: 'company-website', prop: 'website' },
            { id: 'primary-color', prop: 'primary_color', default: '#4a6cf7' },
            { id: 'secondary-color', prop: 'secondary_color', default: '#6c757d' },
            { id: 'accent-color', prop: 'accent_color', default: '#343a40' },
            { id: 'default-font', prop: 'default_font', default: 'Arial' }
        ];

        elementsToPopulate.forEach(item => {
            const element = profileForm.elements[item.id];
            if (element) {
                const value = profile[item.prop] || item.default || '';
                console.log(` - Populating #${item.id} with value: "${value}" (from profile.${item.prop})`);
                element.value = value;
            } else {
                console.error(` - FAILED to find element with ID: #${item.id}`);
            }
        });

        // Logo preview logic
        const logoPreview = document.getElementById('logo-preview');
        if (logoPreview) {
             console.log(' - Found logo preview element.');
            if (profile.logo_path) {
                 console.log(` - Setting logo preview src to: ${profile.logo_path}`);
                 logoPreview.src = profile.logo_path;
                 logoPreview.style.display = 'block';
            } else {
                 console.log(' - No logo_path found, hiding preview.');
                 logoPreview.style.display = 'none';
            }
        } else {
             console.error(' - FAILED to find logo-preview element!');
        }
        // --- END DETAILED LOGGING --- 
        
        if (profileMessage) profileMessage.textContent = ''; 

    } catch (error) {
        console.error('Error fetching profile:', error);
        if (profileMessage && error.message !== 'Unauthorized') {
             profileMessage.textContent = `Error: ${error.message}`;
             profileMessage.className = 'message error';
        }
    }
}

function setupProfileForm() {
    const profileForm = document.getElementById('profile-form');
    const profileMessage = document.getElementById('profile-message');

    if (!profileForm) return;

    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (profileMessage) profileMessage.textContent = '';

        const formData = new FormData(profileForm);
        const profileData = {};
        formData.forEach((value, key) => {
            profileData[key.replace(/-/g, '_')] = value;
        });

        console.log('Submitting profile data:', profileData);

        try {
            const response = await fetch('/api/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(profileData)
            });

            const result = await response.json();

            if (!response.ok) {
                 if (response.status === 401) handleUnauthorized();
                 throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }
            
            console.log('Profile updated successfully:', result);
            if (profileMessage) {
                profileMessage.textContent = 'Profile updated successfully!';
                profileMessage.className = 'message success';
            }

        } catch (error) {
            console.error('Error updating profile:', error);
             if (profileMessage && !error.message.includes('Unauthorized')) {
                 profileMessage.textContent = `Error: ${error.message}`;
                 profileMessage.className = 'message error';
             }
        }
    });
}

function setupLogoUpload() {
    const logoInput = document.getElementById('company-logo-upload');
    const logoPreview = document.getElementById('logo-preview');
    const profileMessage = document.getElementById('profile-message');

    if (!logoInput || !logoPreview) return;

    logoInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (profileMessage) profileMessage.textContent = 'Uploading logo...'; 
        if (profileMessage) profileMessage.className = 'message';

        const formData = new FormData();
        formData.append('logo', file);

        try {
            const response = await fetch('/api/profile/logo', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                if (response.status === 401) handleUnauthorized();
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }

            if (!result.success) {
                throw new Error(result.error || 'Logo upload failed on server.');
            }

            console.log('Logo uploaded successfully:', result.logoPath);
            logoPreview.src = result.logoPath + '?t=' + new Date().getTime();
            logoPreview.style.display = 'block';
            if (profileMessage) {
                profileMessage.textContent = 'Logo uploaded successfully!';
                profileMessage.className = 'message success';
            }

        } catch (error) {
            console.error('Error uploading logo:', error);
            if (profileMessage && !error.message.includes('Unauthorized')) {
                 profileMessage.textContent = `Logo upload error: ${error.message}`;
                 profileMessage.className = 'message error';
            }
        }
    });
}

function initUserNavigation() {
    const navContainer = document.querySelector('.user-nav');
    if (!navContainer) {
        console.error("User navigation container not found!");
        return;
    }
    const currentNavLinks = navContainer.querySelectorAll('.nav-link');
    if (currentNavLinks.length === 0) {
         console.error("No navigation links found within .user-nav!");
         return;
    }
    
    console.log(`initUserNavigation: Found ${currentNavLinks.length} nav links.`);

    currentNavLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            console.log(`Nav link clicked: ${link.dataset.section}`);
            
            currentNavLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            const sectionId = this.getAttribute('data-section');
            showSection(sectionId);
            
            window.location.hash = sectionId;
        });
    });
} 