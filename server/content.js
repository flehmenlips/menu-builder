const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database connection
const db = new sqlite3.Database(path.join(__dirname, 'data/menus.db'));

// Get all content blocks
function getAllContent() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM content_blocks ORDER BY section, order_index', (err, rows) => {
            if (err) return reject(err);
            
            // Parse metadata JSON
            rows.forEach(row => {
                try {
                    if (row.metadata) {
                        row.metadata = JSON.parse(row.metadata);
                    } else {
                        row.metadata = {};
                    }
                } catch (e) {
                    row.metadata = {};
                }
            });
            
            resolve(rows);
        });
    });
}

// Get content blocks by section
function getContentBySection(section) {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT * FROM content_blocks WHERE section = ? ORDER BY order_index',
            [section],
            (err, rows) => {
                if (err) return reject(err);
                
                // Parse metadata JSON
                rows.forEach(row => {
                    try {
                        if (row.metadata) {
                            row.metadata = JSON.parse(row.metadata);
                        } else {
                            row.metadata = {};
                        }
                    } catch (e) {
                        row.metadata = {};
                    }
                });
                
                resolve(rows);
            }
        );
    });
}

// Get a single content block by ID
function getContentById(id) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM content_blocks WHERE id = ?', [id], (err, row) => {
            if (err) return reject(err);
            if (!row) return reject(new Error('Content block not found'));
            
            // Parse metadata JSON
            try {
                if (row.metadata) {
                    row.metadata = JSON.parse(row.metadata);
                } else {
                    row.metadata = {};
                }
            } catch (e) {
                row.metadata = {};
            }
            
            resolve(row);
        });
    });
}

// Get a single content block by identifier
function getContentByIdentifier(identifier) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM content_blocks WHERE identifier = ?', [identifier], (err, row) => {
            if (err) return reject(err);
            if (!row) return reject(new Error('Content block not found'));
            
            // Parse metadata JSON
            try {
                if (row.metadata) {
                    row.metadata = JSON.parse(row.metadata);
                } else {
                    row.metadata = {};
                }
            } catch (e) {
                row.metadata = {};
            }
            
            resolve(row);
        });
    });
}

// Update content block
function updateContent(id, data, userId) {
    return new Promise((resolve, reject) => {
        getContentById(id)
            .then(content => {
                const updates = [];
                const params = [];
                
                if (data.title !== undefined) {
                    updates.push('title = ?');
                    params.push(data.title);
                }
                
                if (data.content !== undefined) {
                    updates.push('content = ?');
                    params.push(data.content);
                }
                
                if (data.content_type !== undefined) {
                    updates.push('content_type = ?');
                    params.push(data.content_type);
                }
                
                if (data.section !== undefined) {
                    updates.push('section = ?');
                    params.push(data.section);
                }
                
                if (data.order_index !== undefined) {
                    updates.push('order_index = ?');
                    params.push(data.order_index);
                }
                
                if (data.is_active !== undefined) {
                    updates.push('is_active = ?');
                    params.push(data.is_active ? 1 : 0);
                }
                
                if (data.metadata !== undefined) {
                    updates.push('metadata = ?');
                    
                    // Convert metadata to JSON string
                    let metadataStr;
                    try {
                        metadataStr = JSON.stringify(data.metadata);
                    } catch (e) {
                        metadataStr = '{}';
                    }
                    
                    params.push(metadataStr);
                }
                
                if (updates.length === 0) {
                    return resolve(content);
                }
                
                updates.push('modified_at = CURRENT_TIMESTAMP');
                
                if (userId) {
                    updates.push('created_by = ?');
                    params.push(userId);
                }
                
                params.push(id);
                
                db.run(
                    `UPDATE content_blocks SET ${updates.join(', ')} WHERE id = ?`,
                    params,
                    function(err) {
                        if (err) return reject(err);
                        
                        getContentById(id)
                            .then(resolve)
                            .catch(reject);
                    }
                );
            })
            .catch(reject);
    });
}

// Create new content block
function createContent(data, userId) {
    return new Promise((resolve, reject) => {
        // Validate required fields
        if (!data.identifier || !data.section) {
            return reject(new Error('Identifier and section are required'));
        }
        
        // Check if identifier already exists
        db.get('SELECT id FROM content_blocks WHERE identifier = ?', [data.identifier], (err, row) => {
            if (err) return reject(err);
            
            if (row) {
                return reject(new Error('Content identifier already exists'));
            }
            
            // Convert metadata to JSON string if provided
            let metadataStr = null;
            if (data.metadata) {
                try {
                    metadataStr = JSON.stringify(data.metadata);
                } catch (e) {
                    metadataStr = '{}';
                }
            }
            
            db.run(
                `INSERT INTO content_blocks (
                    identifier, title, content, content_type, section, order_index, 
                    is_active, metadata, created_at, modified_at, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)`,
                [
                    data.identifier,
                    data.title || data.identifier,
                    data.content || '',
                    data.content_type || 'text',
                    data.section,
                    data.order_index || 0,
                    data.is_active === false ? 0 : 1,
                    metadataStr,
                    userId || null
                ],
                function(err) {
                    if (err) return reject(err);
                    
                    getContentById(this.lastID)
                        .then(resolve)
                        .catch(reject);
                }
            );
        });
    });
}

// Delete content block
function deleteContent(id) {
    return new Promise((resolve, reject) => {
        getContentById(id)
            .then(() => {
                db.run('DELETE FROM content_blocks WHERE id = ?', [id], function(err) {
                    if (err) return reject(err);
                    
                    resolve({ success: true, deleted: this.changes > 0 });
                });
            })
            .catch(reject);
    });
}

// Get content sections (distinct section names)
function getContentSections() {
    return new Promise((resolve, reject) => {
        db.all('SELECT DISTINCT section FROM content_blocks ORDER BY section', (err, rows) => {
            if (err) return reject(err);
            
            const sections = rows.map(row => row.section);
            resolve(sections);
        });
    });
}

// Get public content for the website
function getPublicContent() {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT identifier, content, content_type, section, metadata FROM content_blocks WHERE is_active = 1 ORDER BY section, order_index',
            (err, rows) => {
                if (err) return reject(err);
                
                // Parse metadata JSON
                rows.forEach(row => {
                    try {
                        if (row.metadata) {
                            row.metadata = JSON.parse(row.metadata);
                        } else {
                            row.metadata = {};
                        }
                    } catch (e) {
                        row.metadata = {};
                    }
                });
                
                // Convert to an object keyed by identifier for easier access
                const contentObj = {};
                rows.forEach(row => {
                    contentObj[row.identifier] = {
                        content: row.content,
                        type: row.content_type,
                        section: row.section,
                        metadata: row.metadata
                    };
                });
                
                // Also group content by section
                const contentBySection = {};
                rows.forEach(row => {
                    if (!contentBySection[row.section]) {
                        contentBySection[row.section] = [];
                    }
                    contentBySection[row.section].push({
                        identifier: row.identifier,
                        content: row.content,
                        type: row.content_type,
                        metadata: row.metadata
                    });
                });
                
                resolve({
                    content: contentObj,
                    sections: contentBySection
                });
            }
        );
    });
}

module.exports = {
    getAllContent,
    getContentBySection,
    getContentById,
    getContentByIdentifier,
    updateContent,
    createContent,
    deleteContent,
    getContentSections,
    getPublicContent
}; 