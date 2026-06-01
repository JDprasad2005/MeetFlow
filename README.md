# MeetFlow — Premium Video Conferencing Solution

MeetFlow is a security-first, premium video-conferencing web application built with a cozy, comfortable, slate-and-teal aesthetic interface. Inspired by Google Meet and Zoom, it prioritizes roomy layouts, quiet accents, standard WebRTC structures, and server-side compliance routines.

---

## 🛠️ Key Architectural Deliverables

1. **Elegant Home Dashboard**: Create instant sessions, input schedules, manage upcoming agendas, and parse active room coordinates.
2. **Device Setup Preview**: Real-time webcam (`getUserMedia`) testing, mute preferences, security passcode inputs, and access controls.
3. **Conference Suite**:
   - Dynamic Participant Grid & Active Speaker indicators.
   - Interactive Group Chat with copyable balloons, unread message badges, and system audit logs.
   - Live conference timers, popover emoji reaction dispatchers, and screen-sharing simulations.
   - Acoustic audio synthesizers for system chimes (Join, Leave, Mute Toggle, and Reactions).
4. **SSE Real-Time Sync Channel**: Lightweight Server-Sent Events (SSE) server routing which guarantees zero extra third-party SDK dependencies for standard usage.

---

## 🔑 Environment Secrets & API Setup

To run MeetFlow in a production environment, configure the following parameters in your `.env` or system variables:

```bash
# General Server URL Address 
APP_URL="https://your-domain.com"

# Choose a secure token seed for JWT and room tokens if utilizing Daily.co
JWT_SECRET="generate-a-secure-pass-seed-here"
ROOM_TOKEN_SECRET="generate-another-secure-pass-seed-here"

# WebRTC Rooms Token Provider (Daily.co recommended for customized production suites)
DAILY_API_KEY="your_daily_api_key_here"

# Database Connection URI 
DATABASE_URL="your-postgresql-or-firestore-uri-if-active"

# Application Title Branding
NEXT_PUBLIC_APP_NAME="MeetFlow"
```

### Running Locally

To boot the MeetFlow server framework in development mode with live server synchronization:

```bash
# 1. Install base project packages
npm install

# 2. Boot development Express & Vite middleware server
npm run dev

# 3. Create static distribution compiles
npm run build

# 4. Start production ready application
npm run start
```
