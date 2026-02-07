# 🖥️ Remote Desktop Assistance Feature

## Quick Start Guide

### What is this?
Remote assistance allows a **trusted helper** to view and control your screen during interview preparation sessions. Think of it like AnyDesk or TeamViewer, but built into your interview app!

### Key Features
- ✅ **Session-based**: Generate a unique 8-character ID to share
- ✅ **Full remote control**: Helper can see and control your mouse/keyboard
- ✅ **Secure**: You control when to start/stop, see who's connected
- ✅ **Auto-disconnect**: Sessions end when you close the app
- ✅ **Cross-platform**: Works on Windows, Mac, and Linux

---

## Getting Started

### Step 1: Deploy the Signaling Server

The signaling server coordinates connections between you and helpers.

#### Option A: Deploy to Render.com (Recommended - Free)

1. Create account at [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Root Directory**: `signaling-server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     ```
     PORT=3000
     ALLOWED_ORIGINS=http://localhost:*,https://*.github.io,app://
     SESSION_TIMEOUT_HOURS=4
     ```
5. Click "Create Web Service"
6. Copy the deployed URL (e.g., `https://your-app.onrender.com`)

#### Option B: Run Locally (Testing Only)

```bash
cd signaling-server
npm install
npm start
```

Server runs on `http://localhost:3000`

---

### Step 2: Update Your App Configuration

1. Open your interview app
2. Go to **Settings** → **Remote Assistance** tab
3. Click "Enable Remote Assistance"
4. Start a session to get your Session ID

---

### Step 3: Helper Connects

#### Web Viewer (Easiest)

1. Deploy the viewer app to GitHub Pages:
   ```bash
   # In your repository root
   git add viewer/
   git commit -m "Add remote assistance viewer"
   git push origin main
   ```

2. Enable GitHub Pages:
   - Go to repository **Settings** → **Pages**
   - Source: Deploy from branch `main`
   - Folder: `/` (root)
   - Save

3. Share the viewer URL with your helper:
   ```
   https://YOUR-USERNAME.github.io/YOUR-REPO/viewer/index.html
   ```

4. Helper enters your Session ID and connects

#### Desktop Viewer (Alternative)

Helper can clone this repo and open `viewer/index.html` directly in their browser.

---

## Usage

### For You (Sender)

1. **Start Session**:
   - Open app → Remote Assistance tab
   - Click "Start Session"
   - Copy the 8-character Session ID

2. **Share ID**:
   - Send the Session ID to your helper (WhatsApp, Email, etc.)
   - Share the viewer URL

3. **During Session**:
   - You'll see who's connected
   - Helper can control your screen
   - You can disconnect anytime

4. **End Session**:
   - Click "Stop Session" button
   - Or close the app (auto-disconnects)

### For Helper (Viewer)

1. Open the viewer website
2. Enter the 8-character Session ID
3. Click "Connect"
4. You can now see and control the sender's screen

---

## Security & Privacy

- 🔒 **Session IDs expire** after 4 hours
- 🔒 **You control access** - only people with your ID can connect
- 🔒 **Visible tracking** - you always see who's connected
- 🔒 **One-click disconnect** - stop access instantly
- 🔒 **Auto-cleanup** - sessions end when app closes

---

## Troubleshooting

### "Cannot connect to signaling server"
- Check if your signaling server is running
- Update the server URL in app settings
- Check firewall/network settings

### "Session not found"
- Session ID might be expired (4 hour limit)
- Start a new session

### "Remote control not working"
- Make sure both users have stable internet
- Try restarting the session
- Check if input permissions are granted

### "Viewer can't see my screen"
- Check screen capture permissions (macOS/Linux)
- Make sure WebRTC isn't blocked by firewall
- Try different browser (Chrome/Firefox recommended)

---

## Configuration Files

### Main App
- `src/remote/RemoteAssistanceManager.js` - Session management
- `src/remote/InputSimulator.js` - Mouse/keyboard control
- `src/components/views/RemoteAssistanceView.js` - UI

### Signaling Server
- `signaling-server/index.js` - WebSocket server
- `signaling-server/.env` - Configuration

### Viewer App
- `viewer/index.html` - Viewer interface
- `viewer/viewer.js` - WebRTC client

---

## Advanced Configuration

### Change Session Timeout

Edit `signaling-server/.env`:
```bash
SESSION_TIMEOUT_HOURS=2  # Change from 4 to 2 hours
```

### Custom Signaling Server URL

In your app, update:
```javascript
const serverUrl = 'https://your-custom-server.com';
```

### TURN Server (For Restrictive Networks)

If WebRTC connections fail due to firewall/NAT:

1. Sign up for free TURN server at [Twilio](https://www.twilio.com/stun-turn)
2. Update `RemoteAssistanceManager.js`:
   ```javascript
   iceServers: [
       { urls: 'stun:stun.l.google.com:19302' },
       {
           urls: 'turn:YOUR-TURN-SERVER',
           username: 'YOUR-USERNAME',
           credential: 'YOUR-PASSWORD'
       }
   ]
   ```

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review server logs (`signaling-server/`)
3. Check browser console for errors

---

## License

GPL-3.0 - Same as the main interview app
