# Menu Builder

A dynamic web application for creating, editing, and generating professional restaurant menus.

## Features

- Create and edit menu sections and items
- Drag-and-drop reordering of sections and items
- Configuration options for price formatting (with/without dollar signs and decimals)
- Multiple layout options (single column, two columns)
- Font selection for consistent styling
- Print-ready output with proper formatting
- Special character support for international menu items
- Save and load menu configurations

## Installation

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
node server/server.js
```

4. Access the application at:
```
http://localhost:3000/Menu_Builder-V4.html
```

## Usage

1. Add sections to your menu using the "Add Section" button
2. Add items to each section with the "Add Item" button
3. Enter names, descriptions, and prices for your menu items
4. Configure display options using the checkboxes at the top
5. Preview your menu in real-time on the right side
6. Save your menu with a unique name
7. Generate a printable HTML version using the "Generate HTML" button

## Technologies

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Database: JSON file-based storage

## License

MIT 