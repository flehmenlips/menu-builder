# Menu Builder Pro

A professional application for restaurants and food businesses to create beautiful, customizable menus.

## Features

- **User Authentication**: Secure registration and login system
- **Professional Dashboard**: Create, edit, and manage multiple menus
- **Customizable Templates**: Choose from various layouts and styles
- **Logo Integration**: Upload and position your restaurant logo
- **Advanced Styling**: Customize colors, fonts, and spacing
- **Print-Ready Output**: Generate high-quality PDFs for printing
- **Responsive Design**: Works on desktop and mobile devices

## Technical Implementation

### Frontend
- HTML5, CSS3, and JavaScript (ES6+)
- Responsive design with CSS Grid and Flexbox
- Font Awesome icons
- HTML2PDF for PDF generation

### Backend
- Node.js with Express
- SQLite database for menu storage
- User authentication with JWT tokens and bcrypt
- File uploads for logo management
- Company profile management

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Clone the repository:
```
git clone https://github.com/yourusername/menu-builder.git
cd menu-builder
```

2. Install dependencies:
```
npm install
```

3. Start the server:
```
cd server
node server.js
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

## Project Structure

- `/public` - Frontend assets and HTML files
  - `/images` - Logo and image assets
  - `index.html` - Landing page
  - `login.html` - User login
  - `register.html` - User registration
  - `Menu_Builder.html` - Loader page
  - `Menu_Builder-V4.html` - Main application

- `/server` - Backend code
  - `server.js` - Express application
  - `database.js` - Database operations
  - `auth.js` - Authentication module

## Application Features

### Landing Page
- Professional marketing site with features, pricing, and testimonials
- Call-to-action for sign-up and login

### Authentication
- Secure user registration with email validation
- Password strength requirements
- Login with session management
- Profile and company details management

### Menu Builder
- Intuitive interface for creating menus
- Section management with drag-and-drop capability
- Menu item customization with prices and descriptions
- Real-time preview
- Settings for logo placement, colors, and typography
- Print-ready output

## Future Enhancements

- Template gallery with pre-designed menu templates
- QR code generation for digital menu access
- Multi-language support
- Team collaboration features
- Integrations with restaurant POS systems
- Mobile app for menu management on-the-go

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

Made with ❤️ by Your Company 