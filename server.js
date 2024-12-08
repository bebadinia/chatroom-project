const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Enable JSON body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Add this to track session details
const activeSessions = new Map(); // Change from Set to Map to store username with session

// Add this to track active users
const activeUsers = new Set();

// Simulated RFID tag database
const rfidTags = 
{
    'tag1': 
    {
        password: 'pass1',
        username: 'Ben',
        encryptionKey: 'K9x#mP2$vL5nQ8wR3@jB7hC4tF6yN9pZ' // Simulate reading from the tag
    },
    'tag2': 
    {
        password: 'pass2',
        username: 'Anthony',
        encryptionKey: 'K9x#mP2$vL5nQ8wR3@jB7hC4tF6yN9pZ' // Simulate reading from the tag
    },
    'tag3': 
    {
        password: 'pass3',
        username: 'Andres',
        encryptionKey: 'K9x#mP2$vL5nQ8wR3@jB7hC4tF6yN9pZ' // Simulate reading from the tag
    }
};

// Route for RFID tag login pages
app.get('/login/:tagId', (req, res) => 
    {
        const tagId = req.params.tagId;
    
        if (rfidTags[tagId]) 
        {
            res.sendFile(path.join(__dirname, 'public', 'login.html'));
        } 
        else 
        {
            res.status(404).send('Invalid RFID tag');
        }
    });

// Handle login verification
app.post('/verify/:tagId', (req, res) => 
    {
        const tagId = req.params.tagId;
        const { password } = req.body;

        console.log('Verification attempt for:', { tagId, username: rfidTags[tagId]?.username });
        console.log('Currently active users:', Array.from(activeUsers));

         // Check if user exists and is already active
        if (rfidTags[tagId]) 
        {
            if (activeUsers.has(rfidTags[tagId].username))
            {
                console.log('Rejected: User already logged in');
                res.status(403).json(
                    {
                        success: false,
                        message: 'This user is already logged in'
                    });
                return;
            }
        }


        console.log('Received verification request:', { tagId, password }); // Debug log

        // Check password
        if (rfidTags[tagId].password === password) //(rfidTags[tagId] && rfidTags[tagId].password === password) 
        {
            const sessionId = Math.random().toString(36).substring(7);
            activeSessions.set(sessionId, rfidTags[tagId].username);
            activeUsers.add(rfidTags[tagId].username);
            console.log('Session created:', { sessionId, username: rfidTags[tagId].username });

            res.json(
                {
                    success: true,
                    username: rfidTags[tagId].username,
                    sessionId: sessionId
                });
        } 
        else 
        {
            console.log('Failed verification attempt');

            res.status(401).json(
                {
                    success: false,
                    message: 'Invalid password'
                });
        }
    });

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

// Store connected clients
const clients = new Map();

// WebSocket connection handling (same as before)
wss.on('connection', (ws, req) => 
    {
        const sessionId = new URL(req.url, 'http://localhost').searchParams.get('session');
        console.log('WebSocket connection attempt:', { sessionId });

        if (sessionId && activeSessions.has(sessionId)) 
        {
            console.log('Valid WebSocket connection');
            const username = activeSessions.get(sessionId);
            clients.set(ws, { username, sessionId });
            

            // Broadcast join message
            const joinMessage = JSON.stringify(
                {
                    type: 'join',
                    username: username
                });
        
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
                    const outbound = JSON.stringify(
                        {
                            type: 'message',
                            text: data.text,
                            sender: data.sender
                        });
                    
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


        ws.on('close', () => 
            {
                const clientInfo = clients.get(ws);
                
                if (clientInfo) 
                {

                    activeUsers.delete(clientInfo.username);

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
            });
    });

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => 
    {
        console.log(`Server running on port ${PORT}`);
    });
