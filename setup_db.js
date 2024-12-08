const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('rfid.db');

// Initialize database table
db.serialize(() => 
{
    
    // Create table
    db.run(`CREATE TABLE IF NOT EXISTS rfid_tags (
                tag_id TEXT PRIMARY KEY,
                password TEXT,
                username TEXT,
                encryption_key TEXT
            )`);

    // Insert initial data
    const tags = [
        ['tag1', 'pass1', 'Ben', 'K9x#mP2$vL5nQ8wR3@jB7hC4tF6yN9pZ'],
        ['tag2', 'pass2', 'Anthony', 'K9x#mP2$vL5nQ8wR3@jB7hC4tF6yN9pZ'],
        ['tag3', 'pass3', 'Andres', 'K9x#mP2$vL5nQ8wR3@jB7hC4tF6yN9pZ']
    ];

    const stmt = db.prepare('INSERT OR REPLACE INTO rfid_tags VALUES (?, ?, ?, ?)');
    tags.forEach(tag => 
    {
        stmt.run(tag);
    });
    stmt.finalize();

    console.log('Database setup complete!');
});

db.close();