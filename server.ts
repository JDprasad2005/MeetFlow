/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";

// Define server-side interfaces
interface ServerParticipant {
  id: string;
  name: string;
  role: 'host' | 'participant';
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
  isHandRaised: boolean;
  joinedAt: string;
  isApproved?: boolean;
  isWaiting?: boolean;
  speaking?: boolean;
  networkQuality?: 'excellent' | 'good' | 'poor';
}

interface ServerMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isSystem?: boolean;
  fileAttachment?: {
    name: string;
    size: string;
    url?: string;
  };
}

interface ServerRoom {
  id: string;
  title: string;
  passcode: string | null;
  hostName: string;
  isLocked: boolean;
  createdAt: string;
  scheduledTime: string | null;
  scheduledDuration?: number;
  timezone?: string;
  recurringPattern?: 'none' | 'daily' | 'weekly' | 'monthly';
  isWaitingRoomEnabled?: boolean;
  isScreenShareDisabledForParticipants?: boolean;
}

// In-memory data store for rooms, participants, messages, and active SSE handlers
const roomsStore = new Map<string, ServerRoom>();
const participantsStore = new Map<string, ServerParticipant[]>();
const messagesStore = new Map<string, ServerMessage[]>();
const sseClientsStore = new Map<string, express.Response[]>();

// Extended dynamic stores for advanced features
const pollsStore = new Map<string, any[]>();
const whiteboardStore = new Map<string, any[]>();
const notesStore = new Map<string, string>();
const breakoutStore = new Map<string, any[]>();
const videoShareStore = new Map<string, any>();

// Prepopulate some default rooms for demo / listing purposes
const demoRoomId = "abc-defg-hij";
roomsStore.set(demoRoomId, {
  id: demoRoomId,
  title: "Weekly Product Sync",
  passcode: "1234",
  hostName: "Anita Vance",
  isLocked: false,
  createdAt: new Date().toISOString(),
  scheduledTime: null
});
participantsStore.set(demoRoomId, []);
messagesStore.set(demoRoomId, [
  {
    id: "system-init",
    senderId: "system",
    senderName: "MeetFlow",
    text: "Welcome to Weekly Product Sync! Meeting room initialized.",
    timestamp: new Date(Date.now() - 30000).toISOString(),
    isSystem: true
  }
]);

// Helper to generate random readable room IDs: "foo-bar-baz"
function generateRoomId(): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const part = () => Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  return `${part()}-${part()}-${part()}`;
}

// Helper to broadcast event to all SSE clients in a room
function broadcastToRoom(roomId: string, eventName: string, data: any) {
  const clients = sseClientsStore.get(roomId) || [];
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch (err) {
      // client connection likely stale
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // Log API requests
  app.use((req, res, next) => {
    console.log(`[API] ${req.method} ${req.path}`);
    next();
  });

  // ----------------------------------------------------
  // Core API Endpoints
  // ----------------------------------------------------

  // Create a new meeting room
  app.post("/api/rooms", (req, res) => {
    const { title, passcode, hostName, scheduledTime, scheduledDuration, timezone, recurringPattern, isWaitingRoomEnabled } = req.body;

    if (!title || !hostName) {
      return res.status(400).json({ error: "Missing required fields: title and hostName" });
    }

    const roomId = generateRoomId();
    const newRoom: ServerRoom = {
      id: roomId,
      title: title.trim(),
      passcode: passcode ? String(passcode).trim() : null,
      hostName: hostName.trim(),
      isLocked: false,
      createdAt: new Date().toISOString(),
      scheduledTime: scheduledTime ? new Date(scheduledTime).toISOString() : null,
      scheduledDuration: scheduledDuration ? Number(scheduledDuration) : undefined,
      timezone: timezone || "UTC",
      recurringPattern: recurringPattern || "none",
      isWaitingRoomEnabled: isWaitingRoomEnabled === true,
      isScreenShareDisabledForParticipants: false
    };

    roomsStore.set(roomId, newRoom);
    participantsStore.set(roomId, []);
    messagesStore.set(roomId, []);
    pollsStore.set(roomId, []);
    whiteboardStore.set(roomId, []);
    notesStore.set(roomId, "");
    breakoutStore.set(roomId, []);

    console.log(`[Room Created] ID: ${roomId}, Title: "${newRoom.title}", Host: ${newRoom.hostName}`);

    return res.status(201).json(newRoom);
  });

  // Check room status / validate room code
  app.get("/api/rooms/:roomId", (req, res) => {
    const { roomId } = req.params;
    const room = roomsStore.get(roomId);

    if (!room) {
      return res.status(404).json({ error: `Meeting with code "${roomId}" not found.` });
    }

    const activeParticipants = participantsStore.get(roomId) || [];

    return res.json({
      room,
      participantCount: activeParticipants.length
    });
  });

  // Access all active or upcoming scheduled meetings (for dashboard dashboard list)
  app.get("/api/rooms", (req, res) => {
    const list = Array.from(roomsStore.values()).map(room => {
      const activeParticipants = participantsStore.get(room.id) || [];
      return {
        ...room,
        participantCount: activeParticipants.length,
        upcoming: room.scheduledTime ? new Date(room.scheduledTime) > new Date() : false
      };
    });
    return res.json(list);
  });

  // ----------------------------------------------------
  // SSE Real-Time Sync Channel
  // ----------------------------------------------------
  app.get("/api/rooms/:roomId/events", (req, res) => {
    const { roomId } = req.params;
    const room = roomsStore.get(roomId);

    if (!room) {
      res.status(404).end("Room not found");
      return;
    }

    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });

    // Send absolute initial status for reconciliation
    const participants = participantsStore.get(roomId) || [];
    const messages = messagesStore.get(roomId) || [];
    const polls = pollsStore.get(roomId) || [];
    const whiteboard = whiteboardStore.get(roomId) || [];
    const notes = notesStore.get(roomId) || "";
    const breakoutRooms = breakoutStore.get(roomId) || [];

    const initData = {
      room,
      participants,
      messages,
      polls,
      whiteboard,
      notes,
      breakoutRooms,
      breakouts: breakoutRooms,
      videoShare: videoShareStore.get(roomId) || null
    };

    res.write(`event: init\ndata: ${JSON.stringify(initData)}\n\n`);

    // Register SSE subscriber
    let roomClients = sseClientsStore.get(roomId) || [];
    roomClients.push(res);
    sseClientsStore.set(roomId, roomClients);

    // Keep connection alive
    const keepAliveInterval = setInterval(() => {
      res.write(`: ping\n\n`);
    }, 20000);

    req.on("close", () => {
      clearInterval(keepAliveInterval);
      // Remove connection from storage
      const existing = sseClientsStore.get(roomId) || [];
      const updated = existing.filter(c => c !== res);
      sseClientsStore.set(roomId, updated);
      console.log(`[SSE Client Disconnected] Active in ${roomId}: ${updated.length}`);
    });
  });

  // Client broadcast channel (HTTP interactions broadcasted to all SSE peers)
  app.post("/api/rooms/:roomId/actions", (req, res) => {
    const { roomId } = req.params;
    const { type, payload } = req.body; // e.g. type: "join", payload: { participant: ... }

    const room = roomsStore.get(roomId);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    console.log(`[Action] Room: ${roomId}, Type: ${type}`);

    let participants = participantsStore.get(roomId) || [];
    let messages = messagesStore.get(roomId) || [];

    if (type === "join") {
      const p = payload.participant as ServerParticipant;
      
      // Determine if they need approval
      const needsApproval = p.role !== 'host' && (room.isWaitingRoomEnabled || room.isLocked);
      if (needsApproval) {
        p.isWaiting = true;
        p.isApproved = false;
      } else {
        p.isWaiting = false;
        p.isApproved = true;
      }

      // In case we rejoined, scrub previous entries with same id
      participants = participants.filter(item => item.id !== p.id);
      participants.push(p);
      participantsStore.set(roomId, participants);

      // Create system chat message ONLY if they joined directly (and not waiting in lobby)
      if (!needsApproval) {
        const sysMsg: ServerMessage = {
          id: `sys-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          senderId: "system",
          senderName: "System",
          text: `${p.name} joined the meeting.`,
          timestamp: new Date().toISOString(),
          isSystem: true
        };
        messages.push(sysMsg);
        messagesStore.set(roomId, messages);
        broadcastToRoom(roomId, "message:added", sysMsg);
      }

      // Broadcast changes
      broadcastToRoom(roomId, "participants:updated", participants);
    } 
    else if (type === "leave") {
      const { participantId, name } = payload;
      participants = participants.filter(p => p.id !== participantId);
      participantsStore.set(roomId, participants);

      const sysMsg: ServerMessage = {
        id: `sys-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        senderId: "system",
        senderName: "System",
        text: `${name || 'Someone'} left the meeting.`,
        timestamp: new Date().toISOString(),
        isSystem: true
      };
      messages.push(sysMsg);
      messagesStore.set(roomId, messages);

      broadcastToRoom(roomId, "participants:updated", participants);
      broadcastToRoom(roomId, "message:added", sysMsg);
    } 
    else if (type === "update-device") {
      const { participantId, audioEnabled, videoEnabled, screenSharing, isHandRaised } = payload;
      let targetName = "";
      let hasChange = false;

      participants = participants.map(p => {
        if (p.id === participantId) {
          targetName = p.name;
          if (p.audioEnabled !== audioEnabled || p.videoEnabled !== videoEnabled) {
            hasChange = true;
          }
          return {
            ...p,
            audioEnabled: audioEnabled ?? p.audioEnabled,
            videoEnabled: videoEnabled ?? p.videoEnabled,
            screenSharing: screenSharing ?? p.screenSharing,
            isHandRaised: isHandRaised ?? p.isHandRaised
          };
        }
        return p;
      });

      participantsStore.set(roomId, participants);
      broadcastToRoom(roomId, "participants:updated", participants);

      if (hasChange && targetName) {
        // Broadcast light audit systems logs optionally
      }
    } 
    else if (type === "chat") {
      const msg = payload.message as ServerMessage;
      messages.push(msg);
      messagesStore.set(roomId, messages);

      broadcastToRoom(roomId, "message:added", msg);
    } 
    else if (type === "reaction") {
      const { emoji, senderName, id } = payload;
      // reactions are live-only events, no need to persist in messagesStore
      broadcastToRoom(roomId, "reaction:added", { emoji, senderName, id });
    }
    else if (type === "host-control") {
      const { action, targetId } = payload;
      if (action === "mute-all") {
        participants = participants.map(p => {
          if (p.role !== 'host') {
            return { ...p, audioEnabled: false };
          }
          return p;
        });
        participantsStore.set(roomId, participants);

        const sysMsg: ServerMessage = {
          id: `sys-${Date.now()}`,
          senderId: "system",
          senderName: "System",
          text: `The host has muted everyone.`,
          timestamp: new Date().toISOString(),
          isSystem: true
        };
        messages.push(sysMsg);
        messagesStore.set(roomId, messages);

        broadcastToRoom(roomId, "participants:updated", participants);
        broadcastToRoom(roomId, "message:added", sysMsg);
        // Direct event to force-mute all recipient tabs
        broadcastToRoom(roomId, "host:mute-all-enforced", {});
      } 
      else if (action === "remove") {
        participants = participants.filter(p => p.id !== targetId);
        participantsStore.set(roomId, participants);

        const sysMsg: ServerMessage = {
          id: `sys-${Date.now()}`,
          senderId: "system",
          senderName: "System",
          text: `A participant was removed by the host.`,
          timestamp: new Date().toISOString(),
          isSystem: true
        };
        messages.push(sysMsg);
        messagesStore.set(roomId, messages);

        broadcastToRoom(roomId, "participants:updated", participants);
        broadcastToRoom(roomId, "message:added", sysMsg);
        // Direct event to kick specific connection id
        broadcastToRoom(roomId, "host:kick-enforced", { targetId });
      } 
      else if (action === "lock-room") {
        const current = roomsStore.get(roomId);
        if (current) {
          current.isLocked = !current.isLocked;
          roomsStore.set(roomId, current);

          const sysMsg: ServerMessage = {
            id: `sys-${Date.now()}`,
            senderId: "system",
            senderName: "System",
            text: `The meeting room was ${current.isLocked ? "locked" : "unlocked"} by the host.`,
            timestamp: new Date().toISOString(),
            isSystem: true
          };
          messages.push(sysMsg);
          messagesStore.set(roomId, messages);

          broadcastToRoom(roomId, "room:updated", current);
          broadcastToRoom(roomId, "message:added", sysMsg);
        }
      }
      else if (action === "disable-screen-share") {
        const current = roomsStore.get(roomId);
        if (current) {
          current.isScreenShareDisabledForParticipants = !current.isScreenShareDisabledForParticipants;
          roomsStore.set(roomId, current);

          const sysMsg: ServerMessage = {
            id: `sys-${Date.now()}`,
            senderId: "system",
            senderName: "System",
            text: `Participant screen sharing has been ${current.isScreenShareDisabledForParticipants ? "disabled" : "enabled"} by the host.`,
            timestamp: new Date().toISOString(),
            isSystem: true
          };
          messages.push(sysMsg);
          messagesStore.set(roomId, messages);

          broadcastToRoom(roomId, "room:updated", current);
          broadcastToRoom(roomId, "message:added", sysMsg);
        }
      }
      else if (action === "approve") {
        participants = participants.map(p => {
          if (p.id === targetId) {
            return { ...p, isApproved: true, isWaiting: false };
          }
          return p;
        });
        participantsStore.set(roomId, participants);

        const targetP = participants.find(p => p.id === targetId);
        const nameText = targetP ? targetP.name : "A participant";
        const sysMsg: ServerMessage = {
          id: `sys-${Date.now()}`,
          senderId: "system",
          senderName: "System",
          text: `${nameText} was approved by the host and joined the room.`,
          timestamp: new Date().toISOString(),
          isSystem: true
        };
        messages.push(sysMsg);
        messagesStore.set(roomId, messages);

        broadcastToRoom(roomId, "participants:updated", participants);
        broadcastToRoom(roomId, "message:added", sysMsg);
        broadcastToRoom(roomId, "host:approved-enforced", { targetId });
      }
      else if (action === "deny") {
        participants = participants.filter(p => p.id !== targetId);
        participantsStore.set(roomId, participants);

        broadcastToRoom(roomId, "participants:updated", participants);
        broadcastToRoom(roomId, "host:kick-enforced", { targetId });
      }
    }
    else if (type === "poll-create") {
      const { question, options } = payload;
      const polls = pollsStore.get(roomId) || [];
      const newPoll = {
        id: `poll-${Date.now()}`,
        question,
        options: options.map((text: string) => ({ text, votes: 0 })),
        votedUserIds: {},
        isActive: true
      };
      polls.push(newPoll);
      pollsStore.set(roomId, polls);
      broadcastToRoom(roomId, "polls:updated", polls);
    }
    else if (type === "poll-vote") {
      const { pollId, optionIndex, userId } = payload;
      const polls = pollsStore.get(roomId) || [];
      const updatedPolls = polls.map(p => {
        if (p.id === pollId) {
          const votedIndex = p.votedUserIds[userId];
          // If already voted for this same options, return
          if (votedIndex === optionIndex) return p;

          // Copy votedUserIds
          const nextVoted = { ...p.votedUserIds };
          const nextOptions = p.options.map((opt: any, idx: number) => {
            let votes = opt.votes;
            if (idx === optionIndex) votes += 1;
            if (votedIndex !== undefined && idx === votedIndex) votes = Math.max(0, votes - 1);
            return { ...opt, votes };
          });
          nextVoted[userId] = optionIndex;
          return { ...p, options: nextOptions, votedUserIds: nextVoted };
        }
        return p;
      });
      pollsStore.set(roomId, updatedPolls);
      broadcastToRoom(roomId, "polls:updated", updatedPolls);
    }
    else if (type === "poll-toggle") {
      const { pollId } = payload;
      const polls = pollsStore.get(roomId) || [];
      const updatedPolls = polls.map(p => {
        if (p.id === pollId) {
          return { ...p, isActive: !p.isActive };
        }
        return p;
      });
      pollsStore.set(roomId, updatedPolls);
      broadcastToRoom(roomId, "polls:updated", updatedPolls);
    }
    else if (type === "whiteboard-stroke") {
      const { stroke } = payload;
      const strokes = whiteboardStore.get(roomId) || [];
      strokes.push(stroke);
      whiteboardStore.set(roomId, strokes);
      broadcastToRoom(roomId, "whiteboard:stroke-added", stroke);
    }
    else if (type === "whiteboard-clear") {
      whiteboardStore.set(roomId, []);
      broadcastToRoom(roomId, "whiteboard:updated", []);
    }
    else if (type === "notes-update") {
      const { content } = payload;
      notesStore.set(roomId, content);
      broadcastToRoom(roomId, "notes:updated", content);
    }
    else if (type === "breakout-create") {
      const { rooms } = payload; // Array of BreakoutRoom
      breakoutStore.set(roomId, rooms);
      
      const sysMsg: ServerMessage = {
        id: `sys-${Date.now()}`,
        senderId: "system",
        senderName: "System",
        text: `Host has started ${rooms.length} breakout rooms.`,
        timestamp: new Date().toISOString(),
        isSystem: true
      };
      messages.push(sysMsg);
      messagesStore.set(roomId, messages);

      broadcastToRoom(roomId, "breakout:updated", rooms);
      broadcastToRoom(roomId, "message:added", sysMsg);
    }
    else if (type === "breakout-clear") {
      breakoutStore.set(roomId, []);
      const sysMsg: ServerMessage = {
        id: `sys-${Date.now()}`,
        senderId: "system",
        senderName: "System",
        text: `Host has closed all breakout rooms.`,
        timestamp: new Date().toISOString(),
        isSystem: true
      };
      messages.push(sysMsg);
      messagesStore.set(roomId, messages);

      broadcastToRoom(roomId, "breakout:updated", []);
      broadcastToRoom(roomId, "message:added", sysMsg);
    }
    else if (type === "video-share-update") {
      const { videoShare } = payload;
      videoShareStore.set(roomId, videoShare);
      broadcastToRoom(roomId, "video-share:updated", videoShare);
    }
    else if (type === "webrtc-signal") {
      const { targetId, signal, senderId } = payload;
      broadcastToRoom(roomId, "webrtc:signal", { targetId, signal, senderId });
    }

    return res.json({ success: true });
  });

  // ----------------------------------------------------
  // Front-end Server Mounting
  // ----------------------------------------------------

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[MeetFlow Serve] Server matching config starts at http://0.0.0.0:${PORT}`);
  });
}

startServer();
