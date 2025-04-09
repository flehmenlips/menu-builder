const path = require('path');

// Use the shared pool from database.js instead
const { query } = require('./database');

// Parse metadata JSON helper
function parseMetadata(rows) {
    rows.forEach(row => {
        try {
            row.metadata = row.metadata ? JSON.parse(row.metadata) : {};
        } catch (e) {
            row.metadata = {};
        }
    });
    return rows;
}

// Get all content blocks - REWRITE FOR POSTGRES
async function getAllContent() {
    try {
        const result = await query('SELECT * FROM content_blocks ORDER BY section, order_index');
        return parseMetadata(result.rows);
    } catch (err) {
        console.error('Error getting all content:', err);
        throw err;
    }
}

// Get content blocks by section - REWRITE FOR POSTGRES
async function getContentBySection(section) {
    try {
        const result = await query(
            'SELECT * FROM content_blocks WHERE section = $1 ORDER BY order_index',
            [section]
        );
        return parseMetadata(result.rows);
    } catch (err) {
        console.error(`Error getting content for section '${section}':`, err);
        throw err;
    }
}

// Get a single content block by ID - REWRITE FOR POSTGRES
async function getContentById(id) {
    try {
        const result = await query('SELECT * FROM content_blocks WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            throw new Error('Content block not found');
        }
        return parseMetadata(result.rows)[0]; // Parse and return the single row
    } catch (err) {
        console.error(`Error getting content by ID ${id}:`, err);
        throw err;
    }
}

// Get a single content block by identifier - REWRITE FOR POSTGRES
async function getContentByIdentifier(identifier) {
    try {
        const result = await query('SELECT * FROM content_blocks WHERE identifier = $1', [identifier]);
        if (result.rows.length === 0) {
            throw new Error('Content block not found');
        }
        return parseMetadata(result.rows)[0]; // Parse and return the single row
    } catch (err) {
        console.error(`Error getting content by identifier '${identifier}':`, err);
        throw err;
    }
}

// Update content block - REWRITE FOR POSTGRES
async function updateContent(id, data, userId) { // userId might be for a modified_by field now?
    try {
        const setClauses = [];
        const params = [id]; // For WHERE id = $N
        let paramIndex = 2; // Start after id

        const allowedFields = ['title', 'content', 'content_type', 'section', 'order_index', 'is_active', 'metadata'];

        for (const key of allowedFields) {
            if (data[key] !== undefined) {
                let value = data[key];
                if (key === 'metadata') {
                    try {
                        value = JSON.stringify(value || {});
                    } catch (e) {
                        value = '{}';
                    }
                } else if (key === 'is_active') {
                    value = value === true || value === 1 || value === 'true'; // Ensure boolean
                }
                setClauses.push(`${key} = $${paramIndex++}`);
                params.push(value);
            }
        }

        if (setClauses.length === 0) {
            // No fields to update, return existing content
            return getContentById(id);
        }

        // Add updated_at timestamp
        setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
        // Consider adding modified_by = $N if userId is meant for tracking changes

        const sql = `UPDATE content_blocks SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`;
        const result = await query(sql, params);

        if (result.rows.length === 0) {
             throw new Error('Content block not found for update');
        }
        return parseMetadata(result.rows)[0]; // Parse and return updated row

    } catch (err) {
        console.error(`Error updating content ${id}:`, err);
        throw err;
    }
}

// Create new content block - REWRITE FOR POSTGRES
async function createContent(data, userId) { // userId likely for created_by
    try {
        if (!data.identifier || !data.section) {
            throw new Error('Identifier and section are required');
        }

        let metadataValue = '{}';
        if (data.metadata) {
            try {
                metadataValue = JSON.stringify(data.metadata);
            } catch (e) { /* Ignore error, use default */ }
        }

        const sql = `
            INSERT INTO content_blocks (
                identifier, title, content, content_type, section, order_index,
                is_active, metadata, created_at, updated_at
                -- created_by column missing in original schema, add if needed
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING *
        `;
        const params = [
            data.identifier,
            data.title || data.identifier,
            data.content || '',
            data.content_type || 'text',
            data.section,
            data.order_index || 0,
            data.is_active !== false, // Default to true
            metadataValue,
            // userId || null // Add if created_by exists
        ];

        const result = await query(sql, params);
        return parseMetadata(result.rows)[0]; // Parse and return created row

    } catch (err) {
        console.error('Error creating content:', err);
        if (err.message?.includes('duplicate key value violates unique constraint "content_blocks_identifier_key"')) {
             throw new Error('Content identifier already exists');
        }
        throw err;
    }
}

// Delete content block - REWRITE FOR POSTGRES
async function deleteContent(id) {
    try {
        const result = await query('DELETE FROM content_blocks WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            throw new Error('Content block not found for deletion');
        }
        return { message: 'Content block deleted successfully', deleted: true };
    } catch (err) {
        console.error(`Error deleting content ${id}:`, err);
        throw err;
    }
}

// Get content sections (distinct section names) - REWRITE FOR POSTGRES
async function getContentSections() {
    try {
        const result = await query('SELECT DISTINCT section FROM content_blocks ORDER BY section');
        return result.rows.map(row => row.section);
    } catch (err) {
        console.error('Error getting content sections:', err);
        throw err;
    }
}

// Get public content for the website - REWRITE FOR POSTGRES
async function getPublicContent() {
    try {
        const result = await query(
            'SELECT identifier, content, content_type, section, metadata FROM content_blocks WHERE is_active = true ORDER BY section, order_index'
        );
        const rows = parseMetadata(result.rows);

        // Convert to an object keyed by identifier
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

        return {
            content: contentObj,
            sections: contentBySection
        };

    } catch (err) {
        console.error('Error getting public content:', err);
        throw err;
    }
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