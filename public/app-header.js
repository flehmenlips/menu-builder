// Define API Base URL (Replace with process.env in build step or config later)
const API_BASE_URL = '/api'; 

document.addEventListener('DOMContentLoaded', function() {
    // Handle user dropdown functionality
    const userDropdown = document.querySelector('.user-dropdown');
    const userDropdownToggle = document.querySelector('.user-dropdown-toggle');
    
    if (userDropdownToggle) {
        userDropdownToggle.addEventListener('click', function(e) {
            e.preventDefault();
            userDropdown.classList.toggle('active');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!userDropdown.contains(e.target)) {
                userDropdown.classList.remove('active');
            }
        });
    }
    
    // Mobile sidebar toggle
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (mobileMenuToggle && sidebar) {
        mobileMenuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('mobile-visible');
        });
    }
    
    // Handle logout functionality
    const logoutBtn = document.getElementById('logout-btn');
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Show confirmation dialog
            if (confirm('Are you sure you want to log out?')) {
                // Send logout request to the server
                fetch(`${API_BASE_URL}/auth/logout`, {
                    method: 'POST',
                    credentials: 'include'
                })
                .then(response => response.json())
                .then(data => {
                    // Clear local storage
                    localStorage.removeItem('user');
                    
                    // Redirect to login page
                    window.location.href = '/login.html';
                })
                .catch(error => {
                    console.error('Logout error:', error);
                    // Still redirect to login page even if there's an error
                    localStorage.removeItem('user');
                    window.location.href = '/login.html';
                });
            }
        });
    }
    
    // Support button functionality
    const supportBtn = document.getElementById('contact-support');
    
    if (supportBtn) {
        supportBtn.addEventListener('click', function() {
            // Show support modal or redirect to support page
            alert('Support functionality would be implemented here. For now, please email support@menubuilder.pro');
        });
    }
    
    // Check authentication status
    function checkAuthStatus() {
        // Get user from localStorage
        const userString = localStorage.getItem('user'); // Use 'user' key
        const user = userString ? JSON.parse(userString) : null; // Parse the stored string
        console.log("app-header: checkAuthStatus - User from localStorage:", user);
        
        // If no user is found in localStorage, redirect to login page
        if (!user) {
            console.log("app-header: No user in localStorage, redirecting to login.html");
            window.location.href = '/login.html';
            return; // Stop execution
        }
        
        // If user exists locally, verify with server to ensure session is still valid
        console.log("app-header: User found locally, verifying with server...");
        fetch(`${API_BASE_URL}/auth/verify`, {
            method: 'GET',
            credentials: 'include' // Send cookies
        })
        .then(response => {
             console.log("app-header: /auth/verify response status:", response.status);
             if (!response.ok) {
                 // Handle non-200 responses gracefully before trying to parse JSON
                 throw new Error(`Verification failed with status: ${response.status}`);
             }
             return response.json();
         })
        .then(data => {
             console.log("app-header: /auth/verify response data:", data);
            if (!data.loggedIn) { // Check 'loggedIn' property
                // If not authenticated server-side, clear local user and redirect
                console.log("app-header: Server verification failed, clearing user and redirecting to login.html");
                localStorage.removeItem('user');
                window.location.href = '/login.html';
            } else {
                // Server confirms user is logged in. Update header.
                // Use the potentially updated user data from the verify response
                 console.log("app-header: Server verification successful. Updating header.");
                updateUserInfo(data.user || user); 
                // Store potentially updated user data back in localStorage, PRESERVING TOKEN
                if (data.user) {
                    // Get the current full user object (including token) from storage
                    const currentUserData = JSON.parse(localStorage.getItem('user') || '{}');
                    // Create the updated object: merge new details, keep existing token
                    const updatedUserData = {
                         ...currentUserData, // Keep existing properties (like token)
                         ...data.user       // Overwrite with fresh details from verify endpoint
                    };
                    // Save the merged object back
                    localStorage.setItem('user', JSON.stringify(updatedUserData));
                    console.log('app-header: Updated localStorage user data, preserving token:', updatedUserData);
                }
            }
        })
        .catch(error => {
            console.error('app-header: Authentication verification error:', error);
            // Optional: Decide if redirect should happen on network error
            // For now, we allow the app to load using local data, might be stale.
             console.log("app-header: Verification error, proceeding with potentially stale local user data.");
             updateUserInfo(user); // Update header with local data on error
        });
    }
    
    // Update user info in header
    function updateUserInfo(user) {
        console.log('[updateUserInfo] Received user:', user); // DEBUGGING
        const root = this.shadowRoot || document; 

        const userNameElement = root.querySelector('.user-name'); 
        const accountMenu = root.querySelector('.user-dropdown'); // The main dropdown container
        const loginButton = root.querySelector('.login-button');
        const dropdownMenuDiv = root.querySelector('.user-dropdown-menu'); // The div containing the links
        console.log('[updateUserInfo] Found dropdownMenuDiv:', dropdownMenuDiv); // DEBUGGING

        // --- START: Remove existing dynamic items --- 
        const existingAdminLink = root.querySelector('#admin-link-a');
        const existingAdminIndicator = root.querySelector('#admin-indicator');
        const existingAdminSeparator = root.querySelector('#admin-separator');
        
        if (existingAdminLink) existingAdminLink.remove();
        if (existingAdminIndicator) existingAdminIndicator.remove();
        if (existingAdminSeparator) existingAdminSeparator.remove();
        // --- END: Remove existing dynamic items --- 

        if (user) {
            if (userNameElement) userNameElement.textContent = user.name || user.email || 'My Account';
            if (accountMenu) accountMenu.style.display = 'block'; // Show dropdown toggle area
            if (loginButton) loginButton.style.display = 'none';

            // Update static links if necessary (href might not change)
            const profileLink = root.querySelector('#profile-link');
            const subscriptionLink = root.querySelector('#subscription-link');
            const logoutLink = root.querySelector('#logout-btn'); // Use correct ID
            console.log('[updateUserInfo] Found logoutLink (logout-btn):', logoutLink); // DEBUGGING

            if(profileLink) profileLink.href = 'user.html#profile'; 
            if(subscriptionLink) subscriptionLink.href = 'user.html#billing';

            const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN' || user.is_admin === true;
            console.log(`[updateUserInfo] isAdmin check based on role ('${user.role}') or is_admin ('${user.is_admin}'):`, isAdmin); // DEBUGGING

            if (isAdmin && dropdownMenuDiv) { // Check dropdownMenuDiv now
                // --- START: Add Admin/Super Admin Indicator --- 
                const indicatorDiv = document.createElement('div'); // Use div
                indicatorDiv.id = 'admin-indicator';
                indicatorDiv.textContent = user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin';
                // Simple styling, adjust as needed
                indicatorDiv.style.padding = '4px 16px 8px 16px'; 
                indicatorDiv.style.color = '#6c757d'; 
                indicatorDiv.style.fontSize = '0.8em';
                indicatorDiv.style.textAlign = 'center';
                indicatorDiv.style.borderBottom = '1px solid #eee';

                // Insert indicator at the top
                dropdownMenuDiv.insertBefore(indicatorDiv, dropdownMenuDiv.firstChild);
                // --- END: Add Admin/Super Admin Indicator --- 

                // --- START: Add Admin Panel Link --- 
                const adminLink = document.createElement('a'); // Use <a>
                adminLink.id = 'admin-link-a'; 
                adminLink.href = '/admin.html';
                adminLink.textContent = 'Admin Panel';
                adminLink.className = 'dropdown-item'; // Assuming you have styling for this class

                const separatorDiv = document.createElement('div'); // Use div for separator
                separatorDiv.id = 'admin-separator';
                // Use a standard divider class if available (like Bootstrap's dropdown-divider) or simple hr
                separatorDiv.innerHTML = '<hr style="margin: 4px 0; border-color: #eee;">'; 
                // Alternatively: separatorDiv.className = 'dropdown-divider'; 

                if (logoutLink) {
                    dropdownMenuDiv.insertBefore(separatorDiv, logoutLink);
                    dropdownMenuDiv.insertBefore(adminLink, logoutLink);
                } else {
                    // Fallback if logout link isn't found
                    dropdownMenuDiv.appendChild(separatorDiv);
                    dropdownMenuDiv.appendChild(adminLink);
                }
                 // --- END: Add Admin Panel Link --- 
            }

        } else {
            // Handle logged-out state
            if (userNameElement) userNameElement.textContent = '';
            if (accountMenu) accountMenu.style.display = 'none';
            if (loginButton) loginButton.style.display = 'inline-block';
        }
    }
    
    // Logout function needs to clear 'user' key
    async function logout() { // Assuming this is called by an event listener
        console.log('Logging out...');
        try {
            await fetch(`${API_BASE_URL}/auth/logout`, { 
                method: 'POST', 
                credentials: 'include' 
            });
        } catch (error) {
            console.error('Server logout failed:', error);
            // Proceed with client-side cleanup anyway
        } finally {
            localStorage.removeItem('user');  // Clear the 'user' key
            localStorage.removeItem('userToken'); // Clear the old key too just in case
            updateUserInfo(null);
            console.log('Client-side logout complete, redirecting to login.html');
            window.location.href = '/login.html'; 
        }
    }

    // Ensure logout button listener calls the new logout function
    const logoutLink = this.shadowRoot?.getElementById('logout-link') || document.getElementById('logout-link'); // Find logout link/button
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }

    // Initialize
    checkAuthStatus();
    
    // Load user profile image if available
    function loadUserProfileImage() {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        const userAvatar = document.querySelector('.user-avatar');
        
        if (user && user.profileImage && userAvatar) {
            // Replace icon with image
            userAvatar.innerHTML = `<img src="${user.profileImage}" alt="Profile" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        }
    }
    
    loadUserProfileImage();
}); 