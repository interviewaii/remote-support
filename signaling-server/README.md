# Interview Assistance - Remote Desktop Signaling Server

This server handles WebRTC signaling for the remote assistance feature.

## Setup

1. Install dependencies:
```bash
cd signaling-server
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Run locally:
```bash
npm start
```

## Deployment to Render.com

### One-Click Deploy (Recommended)

1. Push this folder to a GitHub repository
2. Go to [render.com](https://render.com) and sign up
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Build Command**: `cd signaling-server && npm install`
   - **Start Command**: `cd signaling-server && npm start`
   - **Environment Variables**: Add from `.env.example`

### Manual Deploy

1. Install Render CLI:
```bash
npm install -g render-cli
```

2. Login and deploy:
```bash
render login
render deploy
```

## Environment Variables

- `PORT`: Server port (default: 3000)
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins
- `SESSION_TIMEOUT_HOURS`: Session expiry time (default: 4)
- `SESSION_SECRET`: Secret for session management

## API Endpoints

### Health Check
```
GET /health
```

### Create Session
```
POST /api/session/create
Response: { sessionId: "ABC12345", expiresIn: 14400000 }
```

### Get Session Info
```
GET /api/session/:id
Response: { id, status, created, viewerCount }
```

## Socket.io Events

### Sender Events
- `join-as-sender` - Join session as screen sharer
- `viewer-joined` - Notified when viewer connects
- `viewer-left` - Notified when viewer disconnects
- `control-event` - Receive mouse/keyboard events from viewer

### Viewer Events
- `join-as-viewer` - Join session to view/control
- `sender-disconnected` - Notified when sender leaves
- `session-expired` - Session timeout

### Signaling Events (Bidirectional)
- `offer` - WebRTC offer
- `answer` - WebRTC answer
- `ice-candidate` - ICE candidate exchange

## License

GPL-3.0
