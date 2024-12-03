const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Request logging middleware
// This is Express middleware - it runs for every HTTP request to your server
app.use((req, res, next) => {
    // Create a timestamp in ISO format (e.g., "2024-12-02T15:30:45.123Z")
    const timestamp = new Date().toISOString();
    
    // Log the timestamp, HTTP method (GET, POST, etc), and the URL path
    // Example: [2024-12-02T15:30:45.123Z] GET /index.html
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    
    // Log all HTTP headers from the request
    // Headers might include things like:
    // - User-Agent (browser info)
    // - Cookie
    // - Accept-Language
    console.log('Headers:', req.headers);
    
    // Log URL query parameters
    // For example, if URL is "/chat?room=123&user=john"
    // req.query would be { room: "123", user: "john" }
    console.log('Query Parameters:', req.query);
    
    // If there's a request body (like in POST requests), log it
    // This might contain form data or JSON data sent by the client
    if (req.body) {
        console.log('Body:', req.body);
    }
    
    // Print a separator line for clearer log reading
    console.log('-------------------');
    
    // next() tells Express to continue to the next middleware or route handler
    // Without this, the request would hang!
    next();
});

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Store connected clients with additional info
const clients = new Map();

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] New WebSocket connection from ${clientIp}`);
    
    // Store client info
    clients.set(ws, {
        ip: clientIp,
        connectTime: timestamp,
        messageCount: 0
    });

    // Log current number of connections
    console.log(`Active connections: ${clients.size}`);

    // Send welcome message
    ws.send(JSON.stringify({
        type: 'message',
        text: 'Welcome to the chat!',
        sender: 'Server'
    }));

    // Handle incoming messages
    ws.on('message', (message) => {
        try {
            const timestamp = new Date().toISOString();
            const data = JSON.parse(message);
            
            // Update client message count
            const clientInfo = clients.get(ws);
            clientInfo.messageCount++;
            
            // Log message details
            console.log(`[${timestamp}] Message received:`);
            console.log('From IP:', clientInfo.ip);
            console.log('Sender:', data.sender);
            console.log('Message:', data.text);
            console.log('Total messages from this client:', clientInfo.messageCount);
            console.log('-------------------');

            // Broadcast message to all connected clients
            broadcast({
                type: 'message',
                text: data.text,
                sender: data.sender,
                timestamp: timestamp
            });
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    // Handle client disconnection
    ws.on('close', () => {
        const timestamp = new Date().toISOString();
        const clientInfo = clients.get(ws);
        console.log(`[${timestamp}] Client disconnected:`);
        console.log('IP:', clientInfo.ip);
        console.log('Connection duration:', getTimeDifference(clientInfo.connectTime));
        console.log('Total messages sent:', clientInfo.messageCount);
        console.log('-------------------');
        
        clients.delete(ws);
        console.log(`Remaining active connections: ${clients.size}`);
    });
});

// Broadcast message to all connected clients
function broadcast(message) {
    const outbound = JSON.stringify(message);
    clients.forEach((clientInfo, client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(outbound);
        }
    });
}

// Utility function to calculate time difference
function getTimeDifference(startTime) {
    const start = new Date(startTime);
    const end = new Date();
    const diff = end - start;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

// Add basic server statistics endpoint
app.get('/stats', (req, res) => {
    const stats = {
        activeConnections: clients.size,
        clientDetails: Array.from(clients.entries()).map(([_, info]) => ({
            ip: info.ip,
            connectTime: info.connectTime,
            messageCount: info.messageCount
        }))
    };
    res.json(stats);
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Server started at ${new Date().toISOString()}`);
    console.log('-------------------');
});