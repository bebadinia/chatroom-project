// Import required packages
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Initialize database connection
const db = new sqlite3.Database('rfid.db');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware setup
app.use(express.json()); // For parsing JSON bodies
app.use(express.urlencoded({ extended: true })); // For parsing URL-encoded bodies
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from /public

// Session and user management
const activeSessions = new Map(); // Stores session ID -> username mapping
const activeUsers = new Set(); // Tracks currently logged in users
const clients = new Map(); // Stores WebSocket connections



// ----------ROUTE HANDLERS----------

// Handle RFID tag login requests
app.get('/login/:tagId', (req, res) => 
{
        const tagId = req.params.tagId;

        // Check if tag exists in database
        db.get('SELECT tag_id FROM rfid_tags WHERE tag_id = ?', [tagId], (err, tag) =>
        {
            if (err) 
            {
                console.error('Database error:', err);
                return res.status(500).send('Server error');
            }

            if (tag) 
            {
                res.sendFile(path.join(__dirname, 'public', 'login.html'));
            } 
            else 
            {  
                res.status(404).send('Invalid RFID tag');
            }
        });
});

// Handle Login Verification
app.post('/verify/:tagId', (req, res) => 
{
        const tagId = req.params.tagId;
        const { password } = req.body;
        
        
        // Query the database for this tag
        db.get('SELECT username, password, encryption_key FROM rfid_tags WHERE tag_id = ?', [tagId], (err, tag) => 
        {
            console.log('Verification attempt for:', { tagId, username: tag?.username });
            console.log('Currently active users:', Array.from(activeUsers));

            // Handle database errors
            if (err) 
            {
                console.error('Database error:', err);
                
                return res.status(500).json({ 
                    success: false, 
                    message: 'Server error' 
                });
            }

            // Check if tag exists
            if (!tag) 
            {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Invalid RFID tag' 
                });
            }

            // Check if user exists and is already active to prevent multiple logins
            if (activeUsers.has(tag.username))
            {
                console.log('Rejected: User already logged in');
                res.status(403).json({
                    success: false,
                    message: 'This user is already logged in'
                });
                return;
            }

            // Verify password
            if (tag.password === password)
            {
                // Create new session
                const sessionId = Math.random().toString(36).substring(7);
                activeSessions.set(sessionId, tag.username);
                activeUsers.add(tag.username);

                console.log('Session created:', { sessionId, username: tag.username }); // Log session creation

                 // Send success response with session info
                res.json({
                    success: true,
                    username: tag.username,
                    sessionId: sessionId,
                    encryptionKey: tag.encryption_key // Send key with successful login
                });
            } 
            else 
            {
                console.log('Failed verification attempt');

                res.status(401).json({
                    success: false,
                    message: 'Invalid password'
                });
            }
    });
});

// Protect chat page access with session ID
app.get('/chat.html', (req, res) => 
{
    const sessionId = req.query.session;

    console.log('Chat access attempt:', { sessionId });
    console.log('Active sessions:', Array.from(activeSessions.keys()));

    if (sessionId && activeSessions.has(sessionId)) 
    {
        console.log('Valid session, granting access');
        res.sendFile(path.join(__dirname, 'public', 'chat.html'));
    } 
    else 
    {
        console.log('Unauthorized access attempt');
        res.status(401).send('Unauthorized Access: This chat room can only be accessed through proper RFID authentication.');
    }
});



// ----------WEBSOCKET HANDLING----------

// Handle new WebSocket connections
wss.on('connection', (ws, req) => 
{
    const sessionId = new URL(req.url, 'http://localhost').searchParams.get('session');
    console.log('WebSocket connection attempt:', { sessionId });

    // Verify session
    if (sessionId && activeSessions.has(sessionId)) 
    {
        console.log('Valid WebSocket connection');
        const username = activeSessions.get(sessionId);
        clients.set(ws, { username, sessionId });
   

        // Broadcast join message
        const joinMessage = JSON.stringify({
            type: 'join',
            username: username
        });
        console.log('User joined:', username); // Log join
        
        clients.forEach((client, clientWs) => 
        {
            if (clientWs.readyState === WebSocket.OPEN) 
            {
                clientWs.send(joinMessage);
            }
        });
    } 
    else 
    {
            console.log('Invalid WebSocket connection attempt');
            ws.close();
            return;
    }

    // Handle incoming messages
    ws.on('message', (message) => 
    {
        try 
        {
            const clientInfo = clients.get(ws);

            if (!clientInfo) 
            {
                console.log('Message from unauthorized client');
                return;
            }

            const data = JSON.parse(message);

            // Log the encrypted message
            console.log('Encrypted Message received:', {
                                                from: clientInfo.username,
                                                encryptedText: data.encryptedText, // This will show the encrypted data
                                                time: new Date().toLocaleTimeString()
                                            });


            const outgoingMessage = {
                                        type: 'message',
                                        encryptedText: data.encryptedText, // Passing encrypted data
                                        sender: data.sender,
                                    };

            const outbound = JSON.stringify(outgoingMessage);
            
            // Broadcast encrypted message        
            clients.forEach((client, clientWs) => 
            {
                if (clientWs.readyState === WebSocket.OPEN) 
                {
                                
                    clientWs.send(outbound);
                }
            });
        } 
        catch (error) 
        {
            console.error('Error processing message:', error);
        }
    });

    // Handle disconnections
    ws.on('close', () => 
    {
        const clientInfo = clients.get(ws);
                
        if (clientInfo) 
        {
            // Clean up user data
            activeUsers.delete(clientInfo.username);
            console.log('User left:', clientInfo.username); // Log leave

            // Broadcast leave message
            const leaveMessage = JSON.stringify(
            {
                type: 'leave',
                username: clientInfo.username
            });
                    
            clients.forEach((client, clientWs) => 
            {
                if (clientWs.readyState === WebSocket.OPEN) 
                {
                    clientWs.send(leaveMessage);
                }
            });
        }

        console.log('Client disconnected:', clientInfo);
        clients.delete(ws);
        activeSessions.delete(clientInfo.sessionId);
    });
});



// ----------START SERVER----------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => 
{
    console.log(`Server running on port ${PORT}`);
});
