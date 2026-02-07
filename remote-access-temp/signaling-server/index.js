const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// CORS configuration for cross-origin requests
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'app://'];

const io = socketIo(server, {
    cors: {
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps or Electron)
            if (!origin) return callback(null, true);

            // Check if origin matches allowed patterns
            const isAllowed = allowedOrigins.some(pattern => {
                if (pattern.includes('*')) {
                    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                    return regex.test(origin);
                }
                return pattern === origin;
            });

            if (isAllowed) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ['GET', 'POST'],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

app.use(cors());
app.use(express.json());

// Session storage (in-memory for now, use Redis in production)
const sessions = new Map();
const connections = new Map();

// Generate session ID (8 character alphanumeric)
function generateSessionId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
    let id = '';
    for (let i = 0; i < 8; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        activeSessions: sessions.size,
        activeConnections: connections.size
    });
});

// Create session endpoint
app.post('/api/session/create', (req, res) => {
    const sessionId = generateSessionId();
    const session = {
        id: sessionId,
        created: Date.now(),
        sender: null,
        viewers: [],
        status: 'waiting'
    };

    sessions.set(sessionId, session);

    // Auto-cleanup after timeout
    const timeout = parseInt(process.env.SESSION_TIMEOUT_HOURS || 4) * 60 * 60 * 1000;
    setTimeout(() => {
        if (sessions.has(sessionId)) {
            const session = sessions.get(sessionId);
            // Disconnect all participants
            if (session.sender) {
                io.to(session.sender).emit('session-expired');
            }
            session.viewers.forEach(viewer => {
                io.to(viewer).emit('session-expired');
            });
            sessions.delete(sessionId);
            console.log(`Session ${sessionId} expired and cleaned up`);
        }
    }, timeout);

    res.json({ sessionId, expiresIn: timeout });
});

// Get session info
app.get('/api/session/:id', (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
        id: session.id,
        status: session.status,
        created: session.created,
        viewerCount: session.viewers.length
    });
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join session as sender
    socket.on('join-as-sender', ({ sessionId }) => {
        const session = sessions.get(sessionId);

        if (!session) {
            socket.emit('error', { message: 'Session not found' });
            return;
        }

        if (session.sender) {
            socket.emit('error', { message: 'Session already has a sender' });
            return;
        }

        // Register sender
        session.sender = socket.id;
        session.status = 'active';
        socket.join(sessionId);
        connections.set(socket.id, { sessionId, role: 'sender' });

        socket.emit('joined-as-sender', { sessionId });
        console.log(`Sender joined session: ${sessionId}`);
    });

    // Join session as viewer
    socket.on('join-as-viewer', ({ sessionId, viewerName }) => {
        const session = sessions.get(sessionId);

        if (!session) {
            socket.emit('error', { message: 'Session not found' });
            return;
        }

        if (!session.sender) {
            socket.emit('error', { message: 'Sender not connected yet' });
            return;
        }

        // Add viewer
        session.viewers.push(socket.id);
        socket.join(sessionId);
        connections.set(socket.id, { sessionId, role: 'viewer', name: viewerName || 'Anonymous' });

        // Notify sender about new viewer
        io.to(session.sender).emit('viewer-joined', {
            viewerId: socket.id,
            viewerName: viewerName || 'Anonymous',
            timestamp: Date.now()
        });

        socket.emit('joined-as-viewer', { sessionId });
        console.log(`Viewer ${viewerName || socket.id} joined session: ${sessionId}`);
    });

    // WebRTC signaling: offer
    socket.on('offer', ({ sessionId, offer, target }) => {
        if (target) {
            io.to(target).emit('offer', { offer, from: socket.id });
        } else {
            socket.to(sessionId).emit('offer', { offer, from: socket.id });
        }
    });

    // WebRTC signaling: answer
    socket.on('answer', ({ sessionId, answer, target }) => {
        if (target) {
            io.to(target).emit('answer', { answer, from: socket.id });
        } else {
            socket.to(sessionId).emit('answer', { answer, from: socket.id });
        }
    });

    // WebRTC signaling: ICE candidate
    socket.on('ice-candidate', ({ sessionId, candidate, target }) => {
        if (target) {
            io.to(target).emit('ice-candidate', { candidate, from: socket.id });
        } else {
            socket.to(sessionId).emit('ice-candidate', { candidate, from: socket.id });
        }
    });

    // Control events (mouse, keyboard)
    socket.on('control-event', ({ sessionId, event }) => {
        const session = sessions.get(sessionId);
        if (session && session.sender) {
            io.to(session.sender).emit('control-event', {
                event,
                from: socket.id
            });
        }
    });

    // Disconnect viewer
    socket.on('disconnect-viewer', ({ sessionId }) => {
        handleDisconnect(socket.id, sessionId);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        const connection = connections.get(socket.id);
        if (connection) {
            handleDisconnect(socket.id, connection.sessionId);
        }
        console.log(`Client disconnected: ${socket.id}`);
    });
});

function handleDisconnect(socketId, sessionId) {
    const connection = connections.get(socketId);
    if (!connection) return;

    const session = sessions.get(sessionId);
    if (!session) return;

    if (connection.role === 'sender') {
        // Sender disconnected - notify all viewers and close session
        session.viewers.forEach(viewerId => {
            io.to(viewerId).emit('sender-disconnected');
        });
        sessions.delete(sessionId);
        console.log(`Session ${sessionId} closed - sender disconnected`);
    } else if (connection.role === 'viewer') {
        // Viewer disconnected - remove from session and notify sender
        session.viewers = session.viewers.filter(id => id !== socketId);
        if (session.sender) {
            io.to(session.sender).emit('viewer-left', {
                viewerId: socketId,
                viewerName: connection.name,
                timestamp: Date.now()
            });
        }
        console.log(`Viewer ${connection.name} left session: ${sessionId}`);
    }

    connections.delete(socketId);
}

// Cleanup old sessions periodically
setInterval(() => {
    const now = Date.now();
    const timeout = parseInt(process.env.SESSION_TIMEOUT_HOURS || 4) * 60 * 60 * 1000;

    for (const [sessionId, session] of sessions.entries()) {
        if (now - session.created > timeout) {
            // Notify participants
            if (session.sender) {
                io.to(session.sender).emit('session-expired');
            }
            session.viewers.forEach(viewer => {
                io.to(viewer).emit('session-expired');
            });

            sessions.delete(sessionId);
            console.log(`Cleaned up expired session: ${sessionId}`);
        }
    }
}, 60000); // Check every minute

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Signaling server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});
