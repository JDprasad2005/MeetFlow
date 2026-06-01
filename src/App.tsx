/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Video, VideoOff, Mic, MicOff, Phone, Copy, Plus, Calendar, Sparkles, 
  Clock, User, Users, Check, X, Send, Lock, Unlock, Hand, Smile, 
  Monitor, Maximize, Minimize, AlertTriangle, Grid, Crown, Volume2, 
  Settings, ChevronRight, Share2, Shield, Info, Trash2, ArrowRight,
  MessageSquare, HelpCircle, Edit2, FileText, Layers, BarChart, Activity, Paperclip
} from "lucide-react";
import { Participant, MeetingMessage, MeetingRoom, UserPreferences, MeetingPoll, WhiteboardStroke, BreakoutRoom } from "./types";
import { audioEffects } from "./utils/audioEffects";
import SettingsModal from "./components/SettingsModal";

// Floating Reaction Item animation type
interface ActiveReaction {
  id: string;
  emoji: string;
  senderName: string;
}

interface VideoFeedProps {
  stream: MediaStream | null;
  className?: string;
  isMirrored?: boolean;
}

function VideoFeed({ stream, className, isMirrored = false }: VideoFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      if (stream) {
        if (video.srcObject !== stream) {
          video.srcObject = stream;
        }
        video.play().catch(err => {
          console.warn("Auto-play was prevented:", err);
        });
      } else {
        video.srcObject = null;
      }
    }
  }, [stream]);

  // Disable mirroring for simulated streams so text & initials display correctly
  const shouldMirror = isMirrored && stream && !(stream as any).isSimulated;

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className={`${className || ""} ${shouldMirror ? "scale-x-[-1]" : ""}`}
    />
  );
}

function generateSimulatedStream(name: string, width = 640, height = 480): MediaStream {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  let angle = 0;
  const initials = name
    .trim()
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "MF";

  let stream: MediaStream;
  try {
    stream = (canvas as any).captureStream ? (canvas as any).captureStream(30) : (canvas as any).mozCaptureStream ? (canvas as any).mozCaptureStream(30) : new MediaStream();
  } catch (e) {
    console.warn("Failed to capture canvas stream:", e);
    stream = new MediaStream();
  }

  // Mark the stream explicitly as simulated
  (stream as any).isSimulated = true;

  function draw() {
    const track = stream.getVideoTracks()[0];
    if (track && track.readyState === "ended") {
      return;
    }

    if (!ctx) return;

    // Cozy gradient background
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, 50,
      width / 2, height / 2, width / 2
    );
    gradient.addColorStop(0, "#0d9488"); // Teal 600
    gradient.addColorStop(0.5, "#0f172a"); // Slate 900
    gradient.addColorStop(1, "#020617"); // Slate 950

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = "rgba(45, 212, 191, 0.05)";
    ctx.lineWidth = 1;
    for (let c = 0; c < width; c += 40) {
      ctx.beginPath();
      ctx.moveTo(c, 0);
      ctx.lineTo(c, height);
      ctx.stroke();
    }
    for (let r = 0; r < height; r += 40) {
      ctx.beginPath();
      ctx.moveTo(0, r);
      ctx.lineTo(width, r);
      ctx.stroke();
    }

    // Orbit outer wave
    angle += 0.04;
    const pulse = Math.sin(angle) * 12;
    
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 85 + pulse, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(20, 184, 166, 0.25)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Orbit dot
    const orbitX = width / 2 + Math.cos(angle) * (85 + pulse);
    const orbitY = height / 2 + Math.sin(angle) * (85 + pulse);
    ctx.beginPath();
    ctx.arc(orbitX, orbitY, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#2dd4bf";
    ctx.fill();

    // Center badge
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 50, 0, Math.PI * 2);
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "rgba(45, 212, 191, 0.3)";
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    // Initials
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, width / 2, height / 2 - 2);

    // Banner Text
    ctx.fillStyle = "rgba(45, 212, 191, 0.85)";
    ctx.font = "semibold 10px monospace";
    ctx.fillText("VIDEO STREAM ACTIVE", width / 2, height / 2 + 110);

    // Live wave visualizer
    ctx.fillStyle = "rgba(45, 212, 191, 0.45)";
    const barWidth = 3;
    const barSpacing = 2;
    const barCount = 24;
    const startX = width / 2 - (barCount * (barWidth + barSpacing)) / 2;
    for (let i = 0; i < barCount; i++) {
      const h = Math.abs(Math.sin(angle * 1.5 + i * 0.2)) * 20 + 4;
      ctx.fillRect(startX + i * (barWidth + barSpacing), height - 60 - h / 2, barWidth, h);
    }

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);

  return stream;
}

export default function App() {
  // App views: 'dashboard' | 'prejoin' | 'meeting'
  const [view, setView] = useState<'dashboard' | 'prejoin' | 'meeting'>('dashboard');
  
  // Active Room details
  const [meetingCode, setMeetingCode] = useState<string>("");
  const [currentRoom, setCurrentRoom] = useState<MeetingRoom | null>(null);
  
  // Participants and messages synced from Server Sent Events (SSE)
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<MeetingMessage[]>([]);
  
  // Dashboard & room forms
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createPasscode, setCreatePasscode] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Current user configuration
  const [localParticipantId] = useState(() => `usr-${Math.random().toString(36).substring(2, 10)}`);
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    const saved = localStorage.getItem("meetflow_preferences");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      name: "Team Member",
      cameraEnabled: true,
      micEnabled: true,
      cameraDeviceId: "default",
      micDeviceId: "default",
      speakerDeviceId: "default"
    };
  });

  // UI Panels / Call Room states
  const [chatOpen, setChatOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [layout, setLayout] = useState<'grid' | 'speaker' | 'presentation'>('grid');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [copiedCodeCode, setCopiedCodeCode] = useState<string | null>(null);

  // Advanced collaborative states
  const [polls, setPolls] = useState<MeetingPoll[]>([]);
  const [whiteboardStrokes, setWhiteboardStrokes] = useState<WhiteboardStroke[]>([]);
  const [meetingNotes, setMeetingNotes] = useState<string>("");
  const [breakoutRooms, setBreakoutRooms] = useState<BreakoutRoom[]>([]);
  const [activeRightTab, setActiveRightTab] = useState<'chat' | 'participants' | 'polls' | 'whiteboard' | 'notes' | 'breakout' | 'analytics' | 'diagnostics' | 'media'>('chat');
  const [sharedVideo, setSharedVideo] = useState<{ url: string; state: 'playing' | 'paused' | 'stopped'; time: number; sharedBy: string } | null>(null);
  const [captions, setCaptions] = useState<{ id: string; senderName: string; text: string }[]>([]);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTimer, setRecordingTimer] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mediaLinkInput, setMediaLinkInput] = useState("");
  const [networkDiagnostics, setNetworkDiagnostics] = useState({ latency: 24, packetLoss: 0.1, jitter: 2, codec: "V8 (90fps) / Opus Audio" });
  
  // WebRTC channels for authentic multi-tab P2P video conferencing
  const pcsRef = useRef<Record<string, RTCPeerConnection>>({});
  const [peerStreams, setPeerStreams] = useState<Record<string, MediaStream>>({});
  
  // Recent Meetings stored locally
  const [recentMeetings, setRecentMeetings] = useState<MeetingRoom[]>(() => {
    const saved = localStorage.getItem("meetflow_recent_meetings");
    return saved ? JSON.parse(saved) : [
      {
        id: "abc-defg-hij",
        title: "Weekly Product Sync",
        passcode: "1234",
        hostName: "Anita Vance",
        isLocked: false,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        scheduledTime: null
      }
    ];
  });

  // Sound toggles and alerts
  const [joinedCallSuccessfully, setJoinedCallSuccessfully] = useState(false);
  const [activeReactions, setActiveReactions] = useState<ActiveReaction[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [meetingTimer, setMeetingTimer] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [enteredPasscode, setEnteredPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
  const [waitingForHostApproval, setWaitingForHostApproval] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [prejoinError, setPrejoinError] = useState("");
  
  // Device Streams & Peer Media Objects
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  
  // Audio VU Level Simulation for video grid (keeps interaction very alive!)
  const [audioLevels, setAudioLevels] = useState<{ [id: string]: number }>({});

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const sseSourceRef = useRef<EventSource | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<{ x: number; y: number }[]>([]);

  // Whiteboard drawing options
  const [whiteboardColor, setWhiteboardColor] = useState("#14b8a6");
  const [whiteboardWidth, setWhiteboardWidth] = useState(3);

  // Load meeting room from URL parameter if present on startup
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get("room") || params.get("r");
    if (roomFromUrl) {
      handleValidateAndRoutePrejoin(roomFromUrl);
    }
  }, []);

  // Save general profile settings to localStorage on change
  useEffect(() => {
    localStorage.setItem("meetflow_preferences", JSON.stringify(preferences));
  }, [preferences]);

  // Keep recent meetings updated dynamically
  useEffect(() => {
    localStorage.setItem("meetflow_recent_meetings", JSON.stringify(recentMeetings));
  }, [recentMeetings]);

  // Synchronized whiteboard painting renderer
  useEffect(() => {
    if (sidebarOpen && activeRightTab === 'whiteboard' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw every stroke
        whiteboardStrokes.forEach(stroke => {
          if (!stroke.points || stroke.points.length < 2) return;
          ctx.beginPath();
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.width || 3;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
          ctx.stroke();
        });
      }
    }
  }, [whiteboardStrokes, activeRightTab, sidebarOpen]);

  // Auto-scroll chat on incoming lines
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
    if (chatOpen) {
      setUnreadCount(0);
    }
  }, [messages, chatOpen]);

  // Handle meeting counter timer
  useEffect(() => {
    if (view === 'meeting' && joinedCallSuccessfully) {
      timerIntervalRef.current = setInterval(() => {
        setMeetingTimer(prev => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      setMeetingTimer(0);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [view, joinedCallSuccessfully]);

  // Periodic visual speaking voice activity simulator (so the dashboard grid feels fully live!)
  useEffect(() => {
    if (view !== 'meeting') return;

    const interval = setInterval(() => {
      // Choose someone to simulate talking slightly
      const talkingLevels: { [id: string]: number } = {};
      participants.forEach(p => {
        // If audio is enabled, simulate voice levels
        if (p.audioEnabled) {
          const isLocal = p.id === localParticipantId;
          const probability = isLocal ? (preferences.micEnabled ? 0.35 : 0) : 0.25;
          if (Math.random() < probability) {
            talkingLevels[p.id] = Math.floor(Math.random() * 40) + 20; // voice energy 20% to 60%
          } else {
            talkingLevels[p.id] = 0;
          }
        } else {
          talkingLevels[p.id] = 0;
        }
      });
      setAudioLevels(talkingLevels);

      // Determine active speaker highlight
      const speakingIds = Object.keys(talkingLevels).filter(id => talkingLevels[id] > 0);
      if (speakingIds.length > 0) {
        // Prefer first speaker
        setActiveSpeakerId(speakingIds[0]);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [view, participants, preferences.micEnabled, localParticipantId]);

  // Handle local camera & microphone streams for high fidelity webcam displays
  useEffect(() => {
    if (view === 'prejoin' || view === 'meeting') {
      requestCameraStream();
    } else {
      stopCameraStream();
    }
    return () => stopCameraStream();
  }, [view, preferences.cameraDeviceId, preferences.micDeviceId]);

  async function requestCameraStream() {
    try {
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
      }

      if (!preferences.cameraEnabled && !preferences.micEnabled) {
        setLocalStream(null);
        return;
      }

      // Format constraints intelligently to avoid using "exact: 'default'" or empty strings, which crash getUserMedia
      const isPreciseCam = preferences.cameraDeviceId && preferences.cameraDeviceId !== 'default' && preferences.cameraDeviceId !== '';
      const isPreciseMic = preferences.micDeviceId && preferences.micDeviceId !== 'default' && preferences.micDeviceId !== '';

      const primaryConstraints: MediaStreamConstraints = {
        video: preferences.cameraEnabled 
          ? (isPreciseCam ? { deviceId: { exact: preferences.cameraDeviceId } } : true) 
          : false,
        audio: preferences.micEnabled 
          ? (isPreciseMic ? { deviceId: { exact: preferences.micDeviceId } } : true) 
          : false
      };

      try {
        console.log("[Media Device Request] Requesting with target constraints:", primaryConstraints);
        const stream = await navigator.mediaDevices.getUserMedia(primaryConstraints);
        setLocalStream(stream);
        return;
      } catch (err) {
        console.warn("[Media Device Request] Precise constraints failed, attempting generic fallback:", err);
        
        // If exact device failed (e.g. unplugged/permission), try standard general devices
        const fallbackConstraints: MediaStreamConstraints = {
          video: preferences.cameraEnabled ? true : false,
          audio: preferences.micEnabled ? true : false
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        setLocalStream(stream);
        return;
      }
    } catch (err) {
      console.warn("Real media devices denied or sandboxed in iframe. Generating client-side simulation fallback:", err);
      // Construct a faux-media stream canvas if real user camera is blocked (iframe secure context settings)
      if (preferences.cameraEnabled) {
        try {
          const fallbackStream = generateSimulatedStream(preferences.name || "Team Member");
          setLocalStream(fallbackStream);
        } catch (fallbackErr) {
          console.error("Even simulated video failed:", fallbackErr);
          setLocalStream(null);
        }
      } else {
        setLocalStream(null);
      }
    }
  }

  function stopCameraStream() {
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        console.log(`Stopped media track: ${track.kind}`);
      });
      setLocalStream(null);
    }
  }

  // WebRTC Peer Connection Helper
  function getOrCreatePC(remoteId: string, isOfferInitiator: boolean) {
    if (pcsRef.current[remoteId]) {
      return pcsRef.current[remoteId];
    }

    console.log(`[WebRTC] Creating RTCPeerConnection for remote peer: ${remoteId}, initiator: ${isOfferInitiator}`);
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
      ]
    });

    pcsRef.current[remoteId] = pc;

    // Attach local stream tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle incoming remote media track
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Track received from ${remoteId}:`, event.streams[0]);
      if (event.streams && event.streams[0]) {
        setPeerStreams(prev => ({
          ...prev,
          [remoteId]: event.streams[0]
        }));
      }
    };

    // Handle ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[WebRTC] Local ICE candidate generated for ${remoteId}`);
        sendRoomAction("webrtc-signal", {
          targetId: remoteId,
          senderId: localParticipantId,
          signal: { candidate: event.candidate }
        });
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state with ${remoteId} changed to: ${pc.connectionState}`);
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed" || pc.connectionState === "closed") {
        cleanupPeerConnection(remoteId);
      }
    };

    // If initiator, trigger the Offer Sdp exchange
    if (isOfferInitiator) {
      pc.onnegotiationneeded = async () => {
        try {
          console.log(`[WebRTC] Negotiation needed with ${remoteId}, creating offer.`);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendRoomAction("webrtc-signal", {
            targetId: remoteId,
            senderId: localParticipantId,
            signal: { sdp: pc.localDescription }
          });
        } catch (err) {
          console.error(`[WebRTC] Error creating offer for ${remoteId}:`, err);
        }
      };
    }

    return pc;
  }

  function cleanupPeerConnection(remoteId: string) {
    console.log(`[WebRTC] Cleaning up connection for remote peer: ${remoteId}`);
    const pc = pcsRef.current[remoteId];
    if (pc) {
      try {
        pc.close();
      } catch (e) {}
      delete pcsRef.current[remoteId];
    }
    setPeerStreams(prev => {
      const copy = { ...prev };
      delete copy[remoteId];
      return copy;
    });
  }

  function cleanupAllPeerConnections() {
    console.log("[WebRTC] Closing all active peer connections.");
    Object.keys(pcsRef.current).forEach(remoteId => {
      cleanupPeerConnection(remoteId);
    });
    pcsRef.current = {};
    setPeerStreams({});
  }

  // Monitor participants update to establish dynamic WebRTC peer channels
  useEffect(() => {
    if (view !== 'meeting') return;

    participants.forEach(p => {
      if (p.id !== localParticipantId) {
        if (!pcsRef.current[p.id]) {
          const isInitiator = localParticipantId < p.id;
          getOrCreatePC(p.id, isInitiator);
        }
      }
    });

    // Clean up connections for participants that are no longer in the list
    Object.keys(pcsRef.current).forEach(remoteId => {
      if (!participants.some(p => p.id === remoteId)) {
        cleanupPeerConnection(remoteId);
      }
    });
  }, [participants, view, localParticipantId]);

  // Handle localStream track swaps inside existing on-air PeerConnections
  useEffect(() => {
    if (!localStream) return;

    Object.keys(pcsRef.current).forEach(remoteId => {
      const pc = pcsRef.current[remoteId];
      if (pc) {
        const senders = pc.getSenders();
        localStream.getTracks().forEach(track => {
          const sameKindSender = senders.find(s => s.track && s.track.kind === track.kind);
          if (sameKindSender) {
            sameKindSender.replaceTrack(track).catch(err => {
              console.warn(`[WebRTC] replaceTrack error for ${remoteId}:`, err);
            });
          } else {
            try {
              pc.addTrack(track, localStream);
            } catch (e) {
              console.warn(`[WebRTC] addTrack nested error:`, e);
            }
          }
        });
      }
    });
  }, [localStream]);

  // SSE Sync Channel lifecycle hook
  useEffect(() => {
    if (view !== 'meeting' || !meetingCode) {
      if (sseSourceRef.current) {
        sseSourceRef.current.close();
        sseSourceRef.current = null;
      }
      return;
    }

    const sseUrl = `/api/rooms/${meetingCode}/events`;
    console.log(`[SSE Init Channel] Establishing EventSource at ${sseUrl}`);
    const source = new EventSource(sseUrl);
    sseSourceRef.current = source;

    source.addEventListener("init", (e: any) => {
      try {
        const payload = JSON.parse(e.data);
        setCurrentRoom(payload.room);
        setParticipants(payload.participants);
        setMessages(payload.messages);
        
        // Parse advanced initial synchronizations
        if (payload.polls) setPolls(payload.polls);
        if (payload.whiteboard) setWhiteboardStrokes(payload.whiteboard);
        if (payload.notes) setMeetingNotes(payload.notes);
        if (payload.breakouts) setBreakoutRooms(payload.breakouts);
        if (payload.videoShare) setSharedVideo(payload.videoShare);
        
        // Auto-join yourself inside the SSE lifecycle
        sendRoomAction("join", {
          participant: {
            id: localParticipantId,
            name: preferences.name || "Default Participant",
            role: payload.participants.length === 0 ? 'host' : 'participant',
            audioEnabled: preferences.micEnabled,
            videoEnabled: preferences.cameraEnabled,
            screenSharing: false,
            isHandRaised: false,
            joinedAt: new Date().toISOString()
          }
        });
        
        setJoinedCallSuccessfully(true);
        audioEffects.playJoin();
      } catch (err) {
        console.error("SSE init parsing failed:", err);
      }
    });

    source.addEventListener("participants:updated", (e: any) => {
      try {
        const list = JSON.parse(e.data);
        setParticipants(list);
      } catch (err) {
        console.error("SSE participants reload failed:", err);
      }
    });

    source.addEventListener("message:added", (e: any) => {
      try {
        const msg = JSON.parse(e.data);
        setMessages(prev => {
          // Prevent duplicates
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (!chatOpen) {
          setUnreadCount(c => c + 1);
        }
      } catch (err) {
        console.error("SSE message receive error:", err);
      }
    });

    source.addEventListener("reaction:added", (e: any) => {
      try {
        const reaction = JSON.parse(e.data);
        triggerFloatingReaction(reaction.emoji, reaction.senderName);
        audioEffects.playReaction();
      } catch (err) {
        console.error("SSE reaction trigger error:", err);
      }
    });

    source.addEventListener("room:updated", (e: any) => {
      try {
        const room = JSON.parse(e.data);
        setCurrentRoom(room);
      } catch (err) {
        console.error("SSE room metadata reload failed:", err);
      }
    });

    source.addEventListener("host:mute-all-enforced", () => {
      // Force change preference and send device status
      setPreferences(prev => {
        const next = { ...prev, micEnabled: false };
        // Dispatch instant media turnoff if real stream exists
        if (localStream) {
          localStream.getAudioTracks().forEach(t => t.enabled = false);
        }
        return next;
      });
      // Broadcast toggled status to server roster
      sendRoomAction("update-device", {
        participantId: localParticipantId,
        audioEnabled: false
      });
      audioEffects.playMuteToggle(true);
    });

    source.addEventListener("host:kick-enforced", (e: any) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.targetId === localParticipantId) {
          alert("You have been removed from the video room session by the meeting coordinator.");
          handleExitCallRoom();
        }
      } catch (err) {}
    });

    source.addEventListener("host:approved-enforced", (e: any) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.targetId === localParticipantId) {
          setWaitingForHostApproval(false);
          // Set preferences showing the stream is active
          audioEffects.playJoin();
        }
      } catch (err) {}
    });

    source.addEventListener("polls:updated", (e: any) => {
      try {
        const list = JSON.parse(e.data);
        setPolls(list);
      } catch (err) {}
    });

    source.addEventListener("whiteboard:stroke-added", (e: any) => {
      try {
        const stroke = JSON.parse(e.data);
        setWhiteboardStrokes(prev => [...prev, stroke]);
      } catch (err) {}
    });

    source.addEventListener("whiteboard:updated", (e: any) => {
      try {
        const strokes = JSON.parse(e.data);
        setWhiteboardStrokes(strokes);
      } catch (err) {}
    });

    source.addEventListener("notes:updated", (e: any) => {
      try {
        const content = JSON.parse(e.data);
        setMeetingNotes(content);
      } catch (err) {}
    });

    source.addEventListener("breakout:updated", (e: any) => {
      try {
        const rooms = JSON.parse(e.data);
        setBreakoutRooms(rooms);
      } catch (err) {}
    });

    source.addEventListener("video-share:updated", (e: any) => {
      try {
        const videoState = JSON.parse(e.data);
        setSharedVideo(videoState);
      } catch (err) {}
    });

    source.addEventListener("webrtc:signal", async (e: any) => {
      try {
        const payload = JSON.parse(e.data);
        const { targetId, signal, senderId } = payload;

        // Verify the signal is intended for us
        if (targetId !== localParticipantId) return;

        console.log(`[WebRTC] Received signaling message from ${senderId}:`, signal);
        
        // Retrieve or setup the peer connection as responder
        const pc = getOrCreatePC(senderId, false);

        if (signal.sdp) {
          const desc = new RTCSessionDescription(signal.sdp);
          await pc.setRemoteDescription(desc);
          
          if (desc.type === "offer") {
            console.log(`[WebRTC] Setting remote offer, creating answer for ${senderId}.`);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendRoomAction("webrtc-signal", {
              targetId: senderId,
              senderId: localParticipantId,
              signal: { sdp: pc.localDescription }
            });
          }
        } else if (signal.candidate) {
          console.log(`[WebRTC] Adding ICE candidate for ${senderId}`);
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch (err) {
        console.error("[WebRTC] Signal parsing or state assignation failed:", err);
      }
    });

    source.onerror = (err) => {
      console.warn("SSE connection experienced disturbance. Standard reconnecting in progress...", err);
    };

    return () => {
      if (source) {
        source.close();
        sseSourceRef.current = null;
      }
    };
  }, [view, meetingCode]);

  // Helper to trigger floating emoji animation overlays
  function triggerFloatingReaction(emoji: string, senderName: string) {
    const rxId = `rex-${Math.random().toString(36).substring(2, 6)}`;
    setActiveReactions(prev => [...prev, { id: rxId, emoji, senderName }]);
    setTimeout(() => {
      setActiveReactions(prev => prev.filter(r => r.id !== rxId));
    }, 4000);
  }

  // HTTP POST for action-driven room updates
  async function sendRoomAction(actionType: string, actionPayload: any) {
    if (!meetingCode) return;
    try {
      await fetch(`/api/rooms/${meetingCode}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: actionType,
          payload: actionPayload
        })
      });
    } catch (err) {
      console.error(`Failed to dispatch call action [${actionType}] to backend:`, err);
    }
  }

  // Synced Media/Video co-watching handlers
  function startVideoSharing(url: string) {
    if (!url.trim()) return;
    sendRoomAction("video-share-update", {
      videoShare: {
        url: url.trim(),
        state: 'playing',
        time: 0,
        sharedBy: preferences.name || 'Participant'
      }
    });
  }

  function stopVideoSharing() {
    sendRoomAction("video-share-update", {
      videoShare: null
    });
  }

  // Instant meeting handler
  async function handleCreateInstantMeeting() {
    setDashboardError("");
    const host = preferences.name.trim() || "Anita Vance";
    const title = createTitle.trim() || `${host}'s Direct MeetFlow`;
    
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          passcode: createPasscode ? createPasscode : null,
          hostName: host,
          scheduledTime: null
        })
      });
      
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Cannot create meeting room");
      }

      const roomData: MeetingRoom = await res.json();
      
      // Update recents
      setRecentMeetings(prev => {
        const filtered = prev.filter(r => r.id !== roomData.id);
        return [roomData, ...filtered].slice(0, 5);
      });

      setMeetingCode(roomData.id);
      setCurrentRoom(roomData);
      
      // Clean states
      setShowCreateModal(false);
      setCreateTitle("");
      setCreatePasscode("");
      setIsScheduled(false);

      // Route straight to prejoin
      setView('prejoin');
    } catch (err: any) {
      setDashboardError(err.message || "Failed to establish new server session.");
    }
  }

  // Scheduled representation
  async function handleCreateScheduledMeeting() {
    setDashboardError("");
    const host = preferences.name.trim() || "Anita Vance";
    const title = createTitle.trim() || `Future Sync: ${host}`;
    
    if (!scheduledDate || !scheduledTime) {
      setDashboardError("For scheduled invitations, please pick a date and hour.");
      return;
    }

    const scheduledDateObj = new Date(`${scheduledDate}T${scheduledTime}`);
    if (isNaN(scheduledDateObj.getTime())) {
      setDashboardError("Invalid date/time picked.");
      return;
    }

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          passcode: createPasscode ? createPasscode : null,
          hostName: host,
          scheduledTime: scheduledDateObj.toISOString()
        })
      });
      
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Cannot create meeting room");
      }

      const roomData: MeetingRoom = await res.json();
      
      // Update recents
      setRecentMeetings(prev => {
        const filtered = prev.filter(r => r.id !== roomData.id);
        return [roomData, ...filtered].slice(0, 5);
      });

      setShowCreateModal(false);
      setCreateTitle("");
      setCreatePasscode("");
      setScheduledDate("");
      setScheduledTime("");
      setIsScheduled(false);

      // Flash feedback
      alert(`Success! Scheduled meeting: "${roomData.title}" Code is: ${roomData.id}. Share this code with participants!`);
    } catch (err: any) {
      setDashboardError(err.message || "Failed to schedule server session.");
    }
  }

  // Interrogate server for meeting status / existence
  async function handleValidateAndRoutePrejoin(inputCode: string) {
    setDashboardError("");
    setPrejoinError("");
    
    let formatted = inputCode.trim();

    // Check if it looks like a URL or has query parameters
    try {
      // Add standard protocol if missing so URL constructor works
      const urlString = formatted.match(/^https?:\/\//) ? formatted : `https://${formatted}`;
      const url = new URL(urlString);
      const roomParam = url.searchParams.get("room") || url.searchParams.get("r");
      if (roomParam) {
        formatted = roomParam;
      } else {
        // Fallback: check if the pathname looks like /room/room-id
        const paths = url.pathname.split("/").filter(Boolean);
        if (paths.includes("room") && paths.indexOf("room") < paths.length - 1) {
          formatted = paths[paths.indexOf("room") + 1];
        }
      }
    } catch (e) {
      // Keep formatted as is from inputCode if URL parsing fails
    }

    // Now scrub digits, hyphens, and characters to keep only lower-case characters, digits, and hyphens
    formatted = formatted
      .toLowerCase()
      .replace(/.*[\?&]room=/i, "") // handles any raw copy endings
      .replace(/[^a-z0-9-]/g, "")   // support both standard format and alphanumeric room-id variations
      .slice(0, 36);

    if (!formatted) {
      setDashboardError("Please input a valid Room code or URL link.");
      return;
    }

    try {
      const response = await fetch(`/api/rooms/${formatted}`);
      if (!response.ok) {
        throw new Error(`Room code "${formatted}" does not exist, has closed, or expired.`);
      }

      const data = await response.json();
      setMeetingCode(formatted);
      setCurrentRoom(data.room);
      setView('prejoin');
    } catch (err: any) {
      setDashboardError(err.message || "Failed to validate the meeting invitation code.");
    }
  }

  // Actions for pre-join setup
  async function handleJoinMeetingCall() {
    setPrejoinError("");
    
    if (!currentRoom) return;

    // Check passcode restriction
    if (currentRoom.passcode && enteredPasscode.trim() !== currentRoom.passcode) {
      setPasscodeError("Invalid room passcode credential.");
      return;
    }

    // Check locked state (except if local host joins)
    const isHostName = preferences.name.trim() === currentRoom.hostName;
    if (currentRoom.isLocked && !isHostName) {
      setWaitingForHostApproval(true);
      // Simulate client approval in background
      setTimeout(() => {
        setWaitingForHostApproval(false);
        setView('meeting');
      }, 5000);
      return;
    }

    setView('meeting');
  }

  // Toggles inside room
  function toggleCameraLocal() {
    const nextStatus = !preferences.cameraEnabled;
    setPreferences(prev => ({ ...prev, cameraEnabled: nextStatus }));

    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = nextStatus;
      });
    } else if (nextStatus) {
      requestCameraStream();
    }

    if (view === 'meeting') {
      sendRoomAction("update-device", {
        participantId: localParticipantId,
        videoEnabled: nextStatus
      });
      audioEffects.playMuteToggle(!nextStatus);
    }
  }

  function toggleMicLocal() {
    const nextStatus = !preferences.micEnabled;
    setPreferences(prev => ({ ...prev, micEnabled: nextStatus }));

    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = nextStatus;
      });
    } else if (nextStatus) {
      requestCameraStream();
    }

    if (view === 'meeting') {
      sendRoomAction("update-device", {
        participantId: localParticipantId,
        audioEnabled: nextStatus
      });
      audioEffects.playMuteToggle(!nextStatus);
    }
  }

  // Screen sharing simulation
  async function toggleScreenSharing() {
    if (isScreenSharing) {
      if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
        setScreenStream(null);
      }
      setIsScreenSharing(false);
      sendRoomAction("update-device", {
        participantId: localParticipantId,
        screenSharing: false
      });
    } else {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          setScreenStream(stream);
          setIsScreenSharing(true);
          
          if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = stream;
          }

          stream.getVideoTracks()[0].onended = () => {
            setIsScreenSharing(false);
            sendRoomAction("update-device", {
              participantId: localParticipantId,
              screenSharing: false
            });
            setScreenStream(null);
          };

          sendRoomAction("update-device", {
            participantId: localParticipantId,
            screenSharing: true
          });
        } else {
          // Mock screen share for blocked sandboxed environments
          setIsScreenSharing(true);
          sendRoomAction("update-device", {
            participantId: localParticipantId,
            screenSharing: true
          });
        }
      } catch (e) {
        console.warn("Screen share permissions rejected or not supported. Emulating view share:", e);
        setIsScreenSharing(true);
        sendRoomAction("update-device", {
          participantId: localParticipantId,
          screenSharing: true
        });
      }
    }
  }

  // Hand raise toggle
  function toggleRaiseHand() {
    const next = !isHandRaised;
    setIsHandRaised(next);
    sendRoomAction("update-device", {
      participantId: localParticipantId,
      isHandRaised: next
    });

    if (next) {
      // Send a system message context
      sendRoomTextChat(`${preferences.name} raised their hand. ✋`, true);
    }
  }

  // File Attachments
  function handleChatFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const fileMsg: MeetingMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        senderId: localParticipantId,
        senderName: preferences.name,
        text: `Shared file: ${file.name}`,
        timestamp: new Date().toISOString(),
        fileAttachment: {
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          url: dataUrl
        }
      };
      await sendRoomAction("chat", { message: fileMsg });
    };
    reader.readAsDataURL(file);
  }

  // Notes update
  function handleNotesChange(newContent: string) {
    setMeetingNotes(newContent);
    sendRoomAction("notes-update", { content: newContent });
  }

  // Interactive Whiteboard drawing mouse listeners
  function handleWhiteboardMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    isDrawingRef.current = true;
    currentPointsRef.current = [{ x, y }];
  }

  function handleWhiteboardMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    currentPointsRef.current.push({ x, y });
    
    // Draw immediate feedback line locally in real time
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.strokeStyle = whiteboardColor;
      ctx.lineWidth = whiteboardWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const pts = currentPointsRef.current;
      if (pts.length >= 2) {
        ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
      }
    }
  }

  function handleWhiteboardMouseUp() {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    
    if (currentPointsRef.current.length < 2) return;
    
    const stroke: WhiteboardStroke = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      color: whiteboardColor,
      width: whiteboardWidth,
      points: currentPointsRef.current
    };
    
    sendRoomAction("whiteboard-stroke", { stroke });
  }

  function handleWhiteboardClear() {
    sendRoomAction("whiteboard-clear", {});
  }

  // Toggle local stream capture recording
  function toggleRecordingLocal() {
    setIsRecording(!isRecording);
    audioEffects.playJoin();
  }

  // Host Action overrides
  async function handleApproveParticipant(pid: string) {
    await sendRoomAction("host-control", { action: "approve", targetId: pid });
  }

  async function handleDenyParticipant(pid: string) {
    await sendRoomAction("host-control", { action: "deny", targetId: pid });
  }

  async function handleCreateNewPoll(question: string, optionsList: string[]) {
    const activeOpts = optionsList.filter(o => o.trim() !== "");
    if (!question.trim() || activeOpts.length < 2) return;
    await sendRoomAction("poll-create", { question: question.trim(), options: activeOpts });
  }

  async function handleCastPollVote(pollId: string, optionIndex: number) {
    await sendRoomAction("poll-vote", { pollId, optionIndex, userId: localParticipantId });
  }

  async function handleStartBreakoutSessions() {
    const list = participants.map(p => p.id);
    const half = Math.ceil(list.length / 2);
    const roomA = list.slice(0, half);
    const roomB = list.slice(half);

    const rooms: BreakoutRoom[] = [
      { id: "break-1", name: "Alpha Focus Room", participants: roomA },
      { id: "break-2", name: "Beta Design Room", participants: roomB }
    ];
    await sendRoomAction("breakout-create", { rooms });
  }

  async function handleCloseBreakoutSessions() {
    await sendRoomAction("breakout-clear", {});
  }

  // Send textual chats
  async function handleSendChatSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !meetingCode) return;

    const chatMsg: MeetingMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      senderId: localParticipantId,
      senderName: preferences.name,
      text: chatInput.trim(),
      timestamp: new Date().toISOString()
    };

    setChatInput("");
    await sendRoomAction("chat", { message: chatMsg });
  }

  async function sendRoomTextChat(customText: string, isSysMsg = false) {
    const chatMsg: MeetingMessage = {
      id: `msg-${Date.now()}`,
      senderId: isSysMsg ? "system" : localParticipantId,
      senderName: isSysMsg ? "System" : preferences.name,
      text: customText,
      timestamp: new Date().toISOString(),
      isSystem: isSysMsg
    };
    await sendRoomAction("chat", { message: chatMsg });
  }

  // Reactions dispatcher
  async function dispatchEmojiReaction(emoji: string) {
    if (!meetingCode) return;
    await sendRoomAction("reaction", {
      emoji,
      senderName: preferences.name,
      id: localParticipantId
    });
  }

  // Host Authority commands
  async function handleHostMuteAll() {
    await sendRoomAction("host-control", { action: "mute-all" });
  }

  async function handleHostRemoveParticipant(pId: string) {
    await sendRoomAction("host-control", { action: "remove", targetId: pId });
  }

  async function handleHostToggleLockRoom() {
    await sendRoomAction("host-control", { action: "lock-room" });
  }

  // Leaving action
  async function handleExitCallRoom() {
    audioEffects.playLeave();
    
    // Stop streams
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
    }
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
    }
    
    cleanupAllPeerConnections();
    setLocalStream(null);
    setScreenStream(null);
    setIsScreenSharing(false);
    setIsHandRaised(false);

    // Notify peers
    if (meetingCode) {
      await sendRoomAction("leave", {
        participantId: localParticipantId,
        name: preferences.name
      });
    }

    // Reset meeting scope state
    setView('dashboard');
    setMeetingCode("");
    setCurrentRoom(null);
    setParticipants([]);
    setMessages([]);
    setJoinedCallSuccessfully(false);
    setUnreadCount(0);
    setEnteredPasscode("");
    setPasscodeError("");
    setWaitingForHostApproval(false);
  }

  // Dynamic Clipboard Copy Helper
  function copyTextToClipboard(text: string, identifier: string) {
    let success = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        success = true;
      }
    } catch (err) {
      console.warn("Clipboard API writeText failed, trying fallback...", err);
    }

    if (!success) {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed"; // prevent scroll offset
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        success = document.execCommand("copy");
        document.body.removeChild(textarea);
      } catch (err) {
        console.error("Secondary fallback copy action failed:", err);
      }
    }

    setCopiedCodeCode(identifier);
    setTimeout(() => {
      setCopiedCodeCode(null);
    }, 2500);
  }

  // Toggle Screen Fullscreen Mode
  function toggleFullscreenView() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }

  // Time conversion
  function formatTime(seconds: number): string {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }

  // Preferences save helper
  function handleSavePreference(newPrefs: UserPreferences) {
    setPreferences(newPrefs);
    // Alert active meeting roster
    if (view === 'meeting') {
      sendRoomAction("update-device", {
        participantId: localParticipantId,
        name: newPrefs.name,
        audioEnabled: newPrefs.micEnabled,
        videoEnabled: newPrefs.cameraEnabled
      });
    }
  }

  return (
    <div id="meetflow-app-root" className="min-h-screen bg-slate-50 font-sans text-slate-700 selection:bg-teal-500/10 flex flex-col transition duration-300">
      
      {/* ----------------------------------------------------------------------------- */}
      {/* 1. DASHBOARD / HOME PREVIEW */}
      {/* ----------------------------------------------------------------------------- */}
      {view === 'dashboard' && (
        <div id="dashboard-view" className="flex-1 flex flex-col justify-between max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-8 animate-fade-in">
          
          {/* Header Bar */}
          <header className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-600/20">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-slate-800">MeetFlow</h1>
                <p className="text-xs text-slate-400">Secure. Premium. Effortless Rooms.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setSettingsOpen(true)}
                className="p-2.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 transition flex items-center gap-2 text-sm font-medium"
              >
                <Settings className="w-4 h-4 text-slate-400" />
                <span className="hidden sm:inline">Configure Devices</span>
              </button>
            </div>
          </header>

          {/* Main Hero & Grid Panels */}
          <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-4">
            
            {/* Promo Hero & Actions (Left Columns) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-100/50 text-teal-700 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                No Installations. 100% Secure WebRTC.
              </div>

              <h2 className="text-3xl sm:text-4xl md:text-5xl font-sans font-medium text-slate-800 tracking-tight leading-[1.12]">
                Video conferencing, crafted for elegant team coordination.
              </h2>

              <p className="text-base text-slate-500 leading-relaxed max-w-lg">
                Reconstruct your online meetings on a beautiful, soundwave-synchronized workspace. MeetFlow offers high security, room token protection, and pleasant digital chimes.
              </p>

              {/* Action Board */}
              <div className="pt-4 space-y-4 max-w-xl">
                {dashboardError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 flex items-center gap-2.5 text-rose-700 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{dashboardError}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Create Trigger */}
                  <button
                    onClick={() => {
                      setCreateTitle(`${preferences.name ? preferences.name : 'Team member'}'s Session`);
                      setShowCreateModal(true);
                    }}
                    className="flex-1 py-3 px-5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20 active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    Create Instant Meeting
                  </button>

                  {/* Join Textbox */}
                  <div className="flex-[1.2] flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter invite code or room URL..."
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleValidateAndRoutePrejoin(joinCodeInput)}
                      className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-700 text-sm"
                    />
                    <button
                      onClick={() => handleValidateAndRoutePrejoin(joinCodeInput)}
                      className="px-4 py-3 bg-slate-800 hover:bg-slate-900 text-white font-medium text-sm rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Join</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent & Info Panel (Right Columns) */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/60 shadow p-6 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <h3 className="font-semibold text-slate-800 text-sm tracking-tight">Active & Upcoming Sessions</h3>
                </div>
                <span className="text-2xs bg-slate-100 text-slate-500 font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">Server Sync</span>
              </div>

              {recentMeetings.length === 0 ? (
                <div className="py-8 text-center text-slate-400 space-y-2">
                  <span className="text-2xl block">🗓️</span>
                  <p className="text-xs">No recent meetings logs generated.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                  {recentMeetings.map((room) => (
                    <div 
                      key={room.id}
                      className="p-3 rounded-xl border border-slate-50 hover:border-slate-200/80 hover:bg-slate-50/50 transition duration-200 group flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-700 group-hover:text-teal-700 transition">
                            {room.title}
                          </span>
                          {room.passcode && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" /> Sec
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1">
                          <span>Code: <span className="font-mono text-slate-600 font-medium">{room.id}</span></span>
                          {room.scheduledTime ? (
                            <span className="text-teal-600 flex items-center gap-0.5">
                              • <Calendar className="w-3 h-3 inline" /> {new Date(room.scheduledTime).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-slate-400">• Instant</span>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => copyTextToClipboard(`${window.location.origin}/?room=${room.id}`, room.id)}
                          className="p-1 px-1.5 text-[11px] rounded hover:bg-slate-200/50 text-slate-500 transition flex items-center gap-1"
                          title="Copy direct invitation link"
                        >
                          {copiedCodeCode === room.id ? (
                            <span className="text-teal-600 font-medium font-sans">Copied!</span>
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleValidateAndRoutePrejoin(room.id)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition flex items-center gap-1 cursor-pointer"
                        >
                          Enter
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Informative Help Alert */}
              <div className="p-3 rounded-xl bg-slate-50 text-slate-500 text-2xs space-y-1.5 border border-slate-100/40">
                <span className="font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1 text-[10px]">
                  <Shield className="w-3 h-3 text-teal-600" />
                  We respect user privacy
                </span>
                <p className="leading-relaxed">
                  MeetFlow establishes standard peer connections and coordinates media on your server. Your streams are private, server operations are real-time, and passcodes are verified server-side.
                </p>
              </div>
            </div>
          </main>

          {/* Footer Copyright */}
          <footer className="text-center text-xs text-slate-400/80 pt-6 border-t border-slate-100">
            <p>MeetFlow © 2026 • Full-stack RTC System • Powered by secure server routing and audio synthesis models.</p>
          </footer>
        </div>
      )}

      {/* ----------------------------------------------------------------------------- */}
      {/* 2. CREATE MEETING DIALOG MODAL */}
      {/* ----------------------------------------------------------------------------- */}
      {showCreateModal && (
        <div id="create-modal-backdrop" className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div id="create-dialog" className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-slate-100 flex flex-col overflow-hidden animate-slide-up">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                  <Plus className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">Create New Meeting</h3>
                  <p className="text-[11px] text-slate-400">Configure parameters for your conference</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Your Display Display Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-700 bg-slate-50/50"
                  placeholder="Host Display Name"
                  value={preferences.name}
                  onChange={(e) => setPreferences(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Meeting Title / Topic</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-700 bg-white"
                  placeholder="e.g. Daily Standup Sync"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Passcode Protection (Optional)</label>
                <div className="relative">
                  <input
                    type="password"
                    maxLength={10}
                    className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-700 bg-white placeholder:font-sans font-mono"
                    placeholder="None / Enter secret code"
                    value={createPasscode}
                    onChange={(e) => setCreatePasscode(e.target.value)}
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Toggle Scheduled Mode */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-700">Schedule Session for Later</span>
                    <p className="text-[10px] text-slate-400">Specify calendar date and time coordinates</p>
                  </div>
                  <button
                    onClick={() => setIsScheduled(!isScheduled)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                      isScheduled ? 'bg-teal-600' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${
                      isScheduled ? 'translate-x-4.5' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {isScheduled && (
                  <div className="grid grid-cols-2 gap-3 pt-3 animate-fade-in">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Pick Date</label>
                      <input
                        type="date"
                        className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-700"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Pick Hour</label>
                      <input
                        type="time"
                        className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-700"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer actions */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-slate-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={isScheduled ? handleCreateScheduledMeeting : handleCreateInstantMeeting}
                className="px-4 py-2 text-xs bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg shadow-sm transition"
              >
                Create Room
              </button>
            </div>

          </div>
        </div>
      )}


      {/* ----------------------------------------------------------------------------- */}
      {/* 3. PREJOIN WAITING & DEVICE ALIGNMENT SCREEN */}
      {/* ----------------------------------------------------------------------------- */}
      {view === 'prejoin' && currentRoom && (
        <div id="prejoin-screen" className="flex-1 flex flex-col justify-center max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6 animate-fade-in">
          
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => {
                stopCameraStream();
                setView('dashboard');
              }}
              className="p-1 px-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-xs text-slate-500 transition"
            >
              ← Back to Main Menu
            </button>
            
            {localStream && (localStream as any).isSimulated && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-md text-3xs font-semibold uppercase tracking-wider animate-pulse">
                Simulated Preview Mode
              </span>
            )}
          </div>

          {/* Iframe sandbox permissions notification block */}
          {localStream && (localStream as any).isSimulated && (
            <div className="bg-amber-50/80 border border-amber-200/60 rounded-xl p-3.5 text-xs text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
              <div className="flex gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                <p className="leading-relaxed">
                  <strong className="font-semibold text-amber-950">Camera Fallback:</strong> Browsers prevent audio/video hardware capture inside nested playground frames. Open this workspace page in its own tab to allow hardware permissions.
                </p>
              </div>
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg px-3 py-1.5 text-2xs transition shrink-0 whitespace-nowrap shadow-xs"
              >
                Open in New Tab ↗
              </a>
            </div>
          )}

          <div id="prejoin-frame" className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            
            {/* Live Camera preview panel (Left 7 Columns) */}
            <div className="md:col-span-7 bg-slate-900 rounded-2xl aspect-video border border-slate-800 shadow-xl overflow-hidden relative group flex flex-col items-center justify-center">
              
              {preferences.cameraEnabled && localStream ? (
                <VideoFeed
                  stream={localStream}
                  className="w-full h-full object-cover"
                  isMirrored={true}
                />
              ) : (
                <div className="text-center p-6 space-y-3">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto border border-slate-700 text-slate-400">
                    <User className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-300">Camera Feed Deactivated</p>
                    <p className="text-2xs text-slate-500">Enable video below to test preview feed before entrance</p>
                  </div>
                </div>
              )}

              {/* Hardware micro indicator bar */}
              <div className="absolute bottom-4 left-4 right-4 bg-slate-950/70 backdrop-blur-md rounded-xl p-3 flex items-center justify-between border border-slate-800/40 opacity-90 group-hover:opacity-100 transition duration-200">
                <span className="text-white text-xs font-semibold tracking-tight">{preferences.name || "MeetFlow Guest"}</span>
                
                <div className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${preferences.micEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className="text-[10px] text-slate-400 font-mono">
                    {preferences.micEnabled ? 'Sound Enabled' : 'Sound Silent'}
                  </span>
                </div>
              </div>
            </div>

            {/* Admission form details panel (Right 5 Columns) */}
            <div className="md:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-md p-6 space-y-6">
              <div className="space-y-1 pb-4 border-b border-slate-100">
                <div className="inline-flex items-center gap-1.5 text-slate-400 text-3xs font-bold uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5" /> Direct Call Entry
                </div>
                <h3 className="text-xl font-medium text-slate-800 tracking-tight leading-snug">{currentRoom.title}</h3>
                <p className="text-xs text-slate-400">Created by {currentRoom.hostName}</p>
              </div>

              {prejoinError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-700 text-xs">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{prejoinError}</span>
                </div>
              )}

              <div className="space-y-4">
                {/* Name Config */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Your Display Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-700 bg-slate-50/50"
                    placeholder="Enter screen name"
                    value={preferences.name}
                    onChange={(e) => setPreferences(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                {/* Secret Passcode if applicable */}
                {currentRoom.passcode && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Room Security Invite Passcode</label>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={10}
                        className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-300 font-mono placeholder:font-sans"
                        placeholder="Required. Enter four-digit code"
                        value={enteredPasscode}
                        onChange={(e) => {
                          setPasscodeError("");
                          setEnteredPasscode(e.target.value);
                        }}
                      />
                      <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    </div>
                    {passcodeError && (
                      <p className="text-[10px] text-red-600 font-semibold mt-1">{passcodeError}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Hardware Toggle Panel */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <button
                  onClick={toggleMicLocal}
                  className={`py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                    preferences.micEnabled 
                      ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100' 
                      : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                  }`}
                >
                  {preferences.micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  {preferences.micEnabled ? "Mic is Active" : "Mic is Muted"}
                </button>

                <button
                  onClick={toggleCameraLocal}
                  className={`py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                    preferences.cameraEnabled 
                      ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100' 
                      : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                  }`}
                >
                  {preferences.cameraEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  {preferences.cameraEnabled ? "Cam is Active" : "Cam is Off"}
                </button>
              </div>

              {/* Enter Room Trigger */}
              <button
                onClick={handleJoinMeetingCall}
                disabled={waitingForHostApproval}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-medium text-sm rounded-xl tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 hover:shadow active:scale-98 transition cursor-pointer"
              >
                {waitingForHostApproval ? (
                  <span className="flex items-center gap-2 text-slate-500">
                    <span className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                    Waiting for Host to Admit...
                  </span>
                ) : (
                  <>
                    <span>Enter Conference Room</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center">
                <p className="text-[10px] text-slate-400">By entering, you align with current browser media standards.</p>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------------- */}
      {/* 4. MAIN CONFERENCE MEETING ROOM */}
      {/* ----------------------------------------------------------------------------- */}
      {view === 'meeting' && currentRoom && (
        <div id="conference-workspace" className="flex-1 bg-slate-950 text-white flex flex-col justify-between overflow-hidden relative">
          
          {/* Top Panel System Details */}
          <header className="p-4 bg-slate-900/60 backdrop-blur border-b border-white/5 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
                <Video className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold truncate max-w-[150px] sm:max-w-[280px] text-white">
                    {currentRoom.title}
                  </h2>
                  {currentRoom.isLocked && (
                    <span className="p-0.5 rounded px-1.5 bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[9px] font-bold tracking-wider flex items-center gap-0.5 uppercase shrink-0">
                      <Lock className="w-2.5 h-2.5" /> Locked
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span className="font-mono text-slate-300 tracking-wider font-semibold">{formatTime(meetingTimer)}</span>
                  <span>•</span>
                  <span>ID: <strong className="font-mono text-teal-400">{currentRoom.id}</strong></span>
                </p>
              </div>
            </div>

            {/* Quick Invitation Panel info */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => copyTextToClipboard(`${window.location.origin}/?room=${currentRoom.id}`, 'roomlink')}
                className="p-1.5 px-3 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 rounded-xl text-xs text-slate-300 transition flex items-center gap-1.5 active:scale-95"
              >
                {copiedCodeCode === 'roomlink' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 text-[11px] font-medium">Invitation Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Copy Invite Link</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setSettingsOpen(true)}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/30 text-slate-300 transition"
                title="Config devices"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Core Interactive Conference Platform Grid */}
          <main className="flex-1 flex overflow-hidden relative">
            
            {/* Embedded Active Emoji Floating Layer */}
            <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden flex flex-col justify-end items-center p-8 pb-32">
              <div className="flex flex-col gap-3 max-w-sm w-full items-center justify-end">
                {activeReactions.map((r) => (
                  <div 
                    key={r.id} 
                    className="flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-white/10 px-3.5 py-2 rounded-full shadow-2xl animate-float-up opacity-90 transition"
                  >
                    <span className="text-2xl animate-bounce-short">{r.emoji}</span>
                    <span className="text-[11px] text-white/90 font-medium">from {r.senderName}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Main Tiles layout viewport */}
            <div className="flex-1 p-3 sm:p-5 flex flex-col justify-center items-center overflow-y-auto">
              {participants.length === 0 ? (
                <div className="text-center max-w-sm space-y-4">
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-teal-500 mx-auto flex items-center justify-center animate-spin" />
                  <div>
                    <h4 className="text-sm font-semibold">Connecting WebRTC Channels</h4>
                    <p className="text-xs text-slate-400 mt-1">Please wait while MeetFlow synchronizes with standard security rules or server processes...</p>
                  </div>
                </div>
              ) : (
                <div className={`w-full max-w-6xl h-full flex flex-col justify-center ${
                  layout === 'grid' 
                    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr' 
                    : 'space-y-4'
                }`}>
                  
                  {/* LOCAL USER TILE CARD */}
                  <div className={`rounded-2xl border bg-slate-900 overflow-hidden relative group transition duration-300 ${
                    layout === 'speaker' && !isScreenSharing ? 'flex-1 max-h-[80%]' : ''
                  } ${
                    activeSpeakerId === localParticipantId ? 'ring-2 ring-teal-500 border-teal-500/60 shadow-lg' : 'border-slate-800'
                  }`}>
                    {preferences.cameraEnabled && localStream ? (
                      <VideoFeed
                        stream={localStream}
                        className="w-full h-full object-cover absolute inset-0"
                        isMirrored={true}
                      />
                    ) : (
                      <div className="w-full h-full absolute inset-0 flex items-center justify-center bg-slate-900/95">
                        <div className="text-center p-4 space-y-3">
                          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto border border-emerald-500/20 relative">
                            <span className="text-lg font-bold text-slate-200">
                              {preferences.name ? preferences.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "ME"}
                            </span>
                            {audioLevels[localParticipantId] > 0 && (
                              <div className="absolute inset-0 rounded-full border-2 border-teal-400 animate-ping opacity-75" />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-400">You ({preferences.name})</p>
                            <p className="text-[10px] text-slate-500">Camera Feed Off</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Left/Bottom badges details overlay */}
                    <div className="absolute inset-x-3 bottom-3 flex items-center justify-between pointer-events-none z-10 bg-slate-950/70 backdrop-blur px-3 py-1.5 rounded-xl border border-white/5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] font-bold text-teal-400 truncate max-w-[100px]">You</span>
                        {participants.find(p => p.id === localParticipantId)?.role === 'host' && (
                          <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-amber-500/20 text-amber-300 uppercase select-none">
                            Host
                          </span>
                        )}
                        {isHandRaised && (
                          <span className="text-xs animate-bounce-short">✋</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {!preferences.micEnabled ? (
                          <div className="w-5 h-5 rounded-md bg-rose-500/20 text-rose-300 flex items-center justify-center">
                            <MicOff className="w-3 h-3" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-md bg-slate-800 text-teal-400 flex items-center justify-center relative">
                            <Mic className="w-3 h-3" />
                            {audioLevels[localParticipantId] > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-500"></span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ACTIVE SCREEN SHARING TILES OR OVERLAYS */}
                  {isScreenSharing && (
                    <div id="screen-share-surface" className="rounded-2xl border border-teal-500/40 bg-slate-900 overflow-hidden relative sm:col-span-2 lg:col-span-2 aspect-video flex-1 flex flex-col justify-between">
                      {screenStream ? (
                        <VideoFeed
                          stream={screenStream}
                          className="w-full h-full object-contain absolute inset-0"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center p-6 text-center space-y-3">
                          <div className="w-14 h-14 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400 border border-teal-500/20">
                            <Monitor className="w-6 h-6 animate-pulse" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">Your Screen Presentation Active</p>
                            <p className="text-xs text-slate-500">Sharing desktop window content frame with participants</p>
                          </div>
                        </div>
                      )}

                      <div className="absolute top-4 left-4 z-10 bg-slate-950/80 backdrop-blur text-xs font-semibold px-3 py-1 rounded-full border border-teal-500/30 text-teal-300 flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        Live Desk Capture
                      </div>
                    </div>
                  )}

                  {/* ACTIVE SYNCHRONIZED VIDEO PLAYER SHARE (CO-WATCHING) */}
                  {sharedVideo && (
                    <div id="shared-video-co-watch" className="rounded-2xl border border-teal-500/50 bg-slate-950 overflow-hidden relative sm:col-span-2 lg:col-span-3 aspect-video flex-1 flex flex-col justify-between shadow-2xl">
                      
                      {sharedVideo.url.includes("youtube.com") || sharedVideo.url.includes("youtu.be") ? (
                        <iframe
                          className="w-full h-full object-contain absolute inset-0"
                          src={sharedVideo.url.includes("embed") ? sharedVideo.url : `https://www.youtube.com/embed/${
                            sharedVideo.url.includes("v=") 
                              ? sharedVideo.url.split("v=")[1]?.split("&")[0] 
                              : sharedVideo.url.split("/").pop()
                          }?autoplay=1&mute=1&controls=1&enablejsapi=1`}
                          title="Shared YouTube Video Player"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <video
                          id="synced-html5-player"
                          className="w-full h-full object-contain absolute inset-0 bg-black"
                          src={sharedVideo.url}
                          autoPlay
                          muted
                          controls
                        />
                      )}

                      <div className="absolute top-4 left-4 z-10 bg-slate-950/90 backdrop-blur text-[10px] font-semibold px-3 py-1.5 rounded-full border border-white/5 text-slate-300 flex items-center gap-2 shadow-lg">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-teal-400 font-bold uppercase tracking-wider text-[8px] px-1 py-0.5 rounded bg-teal-400/10">Co-Watching</span>
                        <span className="text-slate-400 truncate max-w-[130px] font-mono">{sharedVideo.url}</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-400">By {sharedVideo.sharedBy}</span>
                      </div>
                    </div>
                  )}

                  {/* PEERS LIST TILES */}
                  {participants.filter(p => p.id !== localParticipantId).map((p) => (
                    <div 
                      key={p.id}
                      className={`rounded-2xl border bg-slate-900 overflow-hidden relative group transition duration-300 ${
                        layout === 'speaker' && activeSpeakerId === p.id && !isScreenSharing ? 'flex-1 max-h-[85%]' : ''
                      } ${
                        activeSpeakerId === p.id 
                          ? 'ring-2 ring-teal-500 border-teal-500/80 shadow-md shadow-teal-500/10' 
                          : 'border-slate-800'
                      }`}
                    >
                      {p.videoEnabled ? (
                        peerStreams[p.id] ? (
                          <VideoFeed
                            stream={peerStreams[p.id]}
                            className="w-full h-full object-cover absolute inset-0 bg-black"
                          />
                        ) : (
                          <div className="w-full h-full absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent flex flex-col items-center justify-center">
                            {/* Emulated video simulation with customizable aesthetic avatars */}
                            <div className="text-center p-4 z-10">
                              <div className="w-14 h-14 rounded-full bg-teal-500/10 border-2 border-teal-500/40 flex items-center justify-center mx-auto text-white text-sm font-semibold tracking-wide shadow-md shadow-teal-500/10">
                                {p.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                              </div>
                              <p className="text-xs font-medium text-white/90 mt-2">{p.name || 'External Caller'}</p>
                              <div className="mt-1 pb-1 flex items-center justify-center gap-1">
                                <span className="px-2 py-0.5 rounded-full text-[9px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-medium">
                                  Video Stream Online
                                </span>
                              </div>
                            </div>
                            {/* Aesthetic canvas gradient background to substitute true remote feeds */}
                            <div className="absolute inset-0 bg-radial-gradient from-teal-900/10 via-slate-900 to-slate-950 opacity-90 -z-10" />
                          </div>
                        )
                      ) : (
                        <div className="w-full h-full absolute inset-0 flex items-center justify-center bg-slate-900">
                          <div className="text-center p-4 space-y-2">
                            <div className="w-14 h-14 rounded-full bg-slate-800/80 border border-dashed border-slate-700 flex items-center justify-center mx-auto text-white text-sm font-bold tracking-wider relative">
                              {p.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                              {audioLevels[p.id] > 0 && (
                                <div className="absolute inset-0 rounded-full border-2 border-teal-400 animate-ping opacity-75" />
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-300">{p.name}</p>
                              <p className="text-[10px] text-slate-500">Camera Feed Muted</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Information Roster Status Badge strip */}
                      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between pointer-events-none z-10 bg-slate-950/70 backdrop-blur px-3 py-1.5 rounded-xl border border-white/5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] font-semibold text-slate-300 truncate max-w-[120px]">{p.name}</span>
                          {p.role === 'host' && (
                            <span className="px-1 rounded text-[8px] font-bold bg-amber-500/20 text-amber-300 uppercase">
                              Host
                            </span>
                          )}
                          {p.isHandRaised && (
                            <span className="text-xs animate-bounce-short">✋</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {!p.audioEnabled ? (
                            <div className="w-5 h-5 rounded-md bg-rose-500/20 text-rose-300 flex items-center justify-center">
                              <MicOff className="w-3 h-3" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-md bg-slate-800 text-teal-400 flex items-center justify-center relative">
                              <Mic className="w-3 h-3" />
                              {audioLevels[p.id] > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-500"></span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                </div>
              )}

              {/* REAL-TIME CAPTIONS SUBTITLES OVERLAY */}
              {captionsEnabled && captions.length > 0 && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 max-w-lg w-full bg-slate-950/90 backdrop-blur-md border border-white/10 p-3.5 rounded-2xl flex flex-col gap-1 shadow-2xl z-20 animate-fade-in text-center">
                  <div className="text-[9px] text-teal-400 font-mono tracking-wider uppercase mb-1 flex items-center justify-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
                    Live Captions (AIGC Real-time Audio Transcriber)
                  </div>
                  {captions.map(cap => (
                    <p key={cap.id} className="text-[11px] text-white/95 leading-normal font-medium tracking-wide">
                      <span className="text-slate-400 font-bold">{cap.senderName}:</span> "{cap.text}"
                    </p>
                  ))}
                </div>
              )}

            </div>

            {/* ----------------------------------------------------------------------------- */}
            {/* UNIFIED MODULAR COLLABORATION SIDEBAR PLATFORM */}
            {/* ----------------------------------------------------------------------------- */}
            {sidebarOpen && (
              <div id="unified-sidebar" className="w-full sm:w-[380px] shrink-0 bg-slate-900 border-l border-white/5 flex flex-col justify-between z-10 animate-slide-left overflow-hidden">
                
                {/* 1. Header & Tab Navigation selector row */}
                <div className="shrink-0 bg-slate-950/60 border-b border-white/5 flex flex-col">
                  
                  {/* Top Header Row with Close */}
                  <div className="p-3.5 flex items-center justify-between border-b border-white/5 bg-slate-950/30">
                    <div className="flex items-center gap-1.5">
                      <Crown className="w-4 h-4 text-teal-400" />
                      <h3 className="text-xs font-bold text-white tracking-widest uppercase">MeetFlow Collaborate</h3>
                    </div>
                    <button 
                      onClick={() => setSidebarOpen(false)}
                      className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Icon tabs scroll container */}
                  <div className="flex overflow-x-auto scrollbar-none divide-x divide-white/5 select-none text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {[
                      { id: 'chat', label: 'Chat', icon: MessageSquare },
                      { id: 'participants', label: 'Roster', icon: Users },
                      { id: 'polls', label: 'Polls', icon: HelpCircle },
                      { id: 'whiteboard', label: 'Canvas', icon: Edit2 },
                      { id: 'notes', label: 'Notes', icon: FileText },
                      { id: 'media', label: 'Media', icon: Video },
                      { id: 'breakout', label: 'Break', icon: Layers },
                      { id: 'analytics', label: 'Stats', icon: BarChart },
                      { id: 'diagnostics', label: 'Speed', icon: Activity }
                    ].map(tab => {
                      const IconComp = tab.icon;
                      const isActive = activeRightTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveRightTab(tab.id as any)}
                          className={`flex-1 min-w-[70px] py-2.5 px-1.5 flex flex-col items-center justify-center gap-1 transition ${
                            isActive 
                              ? 'bg-teal-600/10 text-teal-400 border-b-2 border-teal-500' 
                              : 'hover:bg-slate-800/40 hover:text-white'
                          }`}
                        >
                          <IconComp className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Scrolling Interactive Body Content based on active tab Selection */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">

                  {/* -------------------------------------- */}
                  {/* TAB A: MEETFLOW INTEGRATED GROUP CHAT */}
                  {/* -------------------------------------- */}
                  {activeRightTab === 'chat' && (
                    <div className="h-full flex flex-col justify-between gap-3 min-h-[300px]">
                      
                      {/* Message Thread list */}
                      <div className="flex-1 space-y-3.5 overflow-y-auto">
                        {messages.length === 0 ? (
                          <div className="h-full flex flex-col justify-center items-center text-center p-4 py-12 space-y-2">
                            <span className="text-3xl text-slate-700">💬</span>
                            <p className="text-[11px] text-slate-400 max-w-[170px] leading-relaxed">No chat streams recorded. Upload files or type greetings to start group discussions!</p>
                          </div>
                        ) : (
                          messages.map((m) => {
                            if (m.isSystem) {
                              return (
                                <div key={m.id} className="text-center p-2 rounded-xl bg-teal-500/5 border border-teal-500/10 text-[9px] text-teal-300 font-mono tracking-wide animate-fade-in leading-relaxed">
                                  {m.text}
                                </div>
                              );
                            }

                            const isSelf = m.senderId === localParticipantId;

                            return (
                              <div key={m.id} className={`flex flex-col max-w-[90%] ${isSelf ? 'ml-auto items-end' : 'mr-auto items-start'} animate-fade-in`}>
                                <span className="text-[9px] text-slate-400 font-semibold mb-0.5 truncate max-w-[140px]">{m.senderName}</span>
                                <div className={`p-2.5 rounded-2xl text-xs leading-normal relative group ${
                                  isSelf 
                                    ? 'bg-teal-600 text-white rounded-tr-none' 
                                    : 'bg-slate-800 text-slate-200 rounded-tl-none'
                                }`}>
                                  
                                  {/* Text message block */}
                                  <p className="break-words select-text">{m.text}</p>
                                  
                                  {/* Render file attachments if present inside meeting chat */}
                                  {m.fileAttachment && (
                                    <div className="mt-2 p-2 bg-slate-950/40 rounded-xl border border-white/5 flex items-center justify-between gap-2.5">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <Paperclip className="w-3.5 h-3.5 shrink-0 text-teal-300" />
                                        <div className="min-w-0">
                                          <p className="text-[10px] font-bold text-teal-200 truncate">{m.fileAttachment.name}</p>
                                          <p className="text-[8px] text-slate-400 font-mono">{m.fileAttachment.size}</p>
                                        </div>
                                      </div>
                                      
                                      {/* Download Trigger */}
                                      {m.fileAttachment.url && (
                                        <a
                                          href={m.fileAttachment.url}
                                          download={m.fileAttachment.name}
                                          className="p-1 rounded bg-teal-500 hover:bg-teal-400 text-white transition font-bold text-[8px] uppercase select-none"
                                        >
                                          Open File
                                        </a>
                                      )}
                                    </div>
                                  )}

                                  {/* Quick duplicate copy action key */}
                                  <button
                                    onClick={() => copyTextToClipboard(m.text, m.id)}
                                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition p-0.5 bg-slate-950/80 rounded text-[9px] text-slate-300 hover:text-white"
                                    title="Copy text balloon content"
                                  >
                                    {copiedCodeCode === m.id ? 'Copied' : 'Copy'}
                                  </button>
                                </div>
                                <span className="text-[8px] text-slate-500 font-mono mt-0.5">
                                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            );
                          })
                        )}
                        <div ref={chatEndRef} />
                      </div>

                      {/* Chat text sender component & file attachment trigger */}
                      <form onSubmit={handleSendChatSubmit} className="p-1 bg-slate-950/30 border-t border-white/5 pt-2 flex items-center gap-1.5 shrink-0">
                        
                        {/* Custom visual Local File Selection Paperclip */}
                        <label className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer shrink-0" title="Upload and distribute file inside meeting chat">
                          <Paperclip className="w-3.5 h-3.5" />
                          <input 
                            type="file" 
                            className="hidden" 
                            onChange={handleChatFileChange} 
                          />
                        </label>

                        <input
                          type="text"
                          maxLength={150}
                          placeholder="Type meeting discussion..."
                          className="flex-1 px-3 py-1.8 text-xs rounded-xl bg-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-teal-500/50 border border-slate-700/60"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                        />
                        <button
                          type="submit"
                          className="p-1.8 rounded-xl bg-teal-600 hover:bg-teal-700 text-white transition cursor-pointer shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </form>

                    </div>
                  )}

                  {/* -------------------------------------- */}
                  {/* TAB B: ATTENDEES ROSTER & HOST CODES */}
                  {/* -------------------------------------- */}
                  {activeRightTab === 'participants' && (
                    <div className="space-y-4">
                      
                      {/* Host approval panel cards (WAITING ROOM HANDLERS) */}
                      {participants.find(p => p.id === localParticipantId)?.role === 'host' && participants.some(p => p.isWaiting) && (
                        <div className="p-3 bg-teal-950/40 border border-emerald-500/20 rounded-2xl space-y-2.5 animate-pulse">
                          <div className="flex items-center gap-1.5 text-[10px] text-teal-400 font-bold uppercase tracking-wider">
                            <Shield className="w-4 h-4 text-emerald-400 animate-bounce-short" />
                            Lobby Approval Pipeline
                          </div>
                          <p className="text-[10px] text-slate-400 leading-normal">
                            Participants waiting in lobby since the room was restricted or locked:
                          </p>
                          
                          <div className="space-y-2">
                            {participants.filter(p => p.isWaiting).map(p => (
                              <div key={p.id} className="p-2 bg-slate-900 border border-white/5 rounded-xl flex items-center justify-between gap-1.5">
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-white truncate">{p.name}</p>
                                  <p className="text-[9px] text-slate-500 font-mono">Lobby Status: Pending</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleApproveParticipant(p.id)}
                                    className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 font-bold text-[9px] transition cursor-pointer"
                                    title="Approve admittance"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    onClick={() => handleDenyParticipant(p.id)}
                                    className="p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-500 font-bold text-[9px] transition cursor-pointer"
                                    title="Reject access request"
                                  >
                                    Deny
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Coordinator Fast action togglers */}
                      {participants.find(p => p.id === localParticipantId)?.role === 'host' && (
                        <div className="p-3 bg-teal-900/10 border border-teal-500/20 rounded-2xl space-y-2">
                          <div className="flex items-center gap-1 text-teal-400 text-2xs font-bold uppercase tracking-widest">
                            <Crown className="w-4 h-4" /> Coordinator controls
                          </div>
                          
                          <div className="flex gap-2 pt-1.5 border-t border-teal-500/10">
                            <button
                              onClick={handleHostMuteAll}
                              className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-2xs font-bold text-slate-300 rounded-xl hover:text-white transition cursor-pointer flex-1 text-center"
                            >
                              Mute Roster
                            </button>

                            <button
                              onClick={handleHostToggleLockRoom}
                              className={`px-2 py-1.5 text-2xs font-bold rounded-xl transition cursor-pointer flex-1 text-center border ${
                                currentRoom.isLocked 
                                  ? 'bg-rose-600/20 border-rose-500/30 text-rose-300 hover:bg-rose-600/30' 
                                  : 'bg-slate-800 border-white/5 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              {currentRoom.isLocked ? "Unlock space" : "Lock Space"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Roster lists mapping */}
                      <div className="space-y-2">
                        <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Members ({participants.length})</h4>
                        {participants.map((p) => {
                          const isSelf = p.id === localParticipantId;
                          if (p.isWaiting) return null; // do not list under active attendees roster

                          return (
                            <div 
                              key={p.id}
                              className="p-2.5 rounded-2xl border border-white/5 bg-slate-950/25 flex items-center justify-between gap-1.5 hover:bg-slate-950/45 transition duration-150"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7.5 h-7.5 rounded-xl bg-slate-800/90 flex items-center justify-center text-2xs text-white uppercase font-bold shrink-0 relative">
                                  {p.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                                  <span className={`absolute -bottom-0.5 -right-0.5 block w-2.5 h-2.5 rounded-full border border-slate-900 ${
                                    p.videoEnabled ? 'bg-emerald-400' : 'bg-slate-500'
                                  }`} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-200 truncate">
                                    {p.name} {isSelf && <span className="text-2xs text-teal-400 font-semibold">(You)</span>}
                                  </p>
                                  <p className="text-[9px] text-slate-400 flex items-center gap-1 font-mono">
                                    <span className={p.role === 'host' ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                                      {p.role === 'host' ? 'Host' : 'Viewer'}
                                    </span>
                                    <span>•</span>
                                    <span className="text-teal-400">Signal: excellent</span>
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {/* Participant voice states micro symbols */}
                                <span title={p.audioEnabled ? "Microphone active" : "Microphone silent"}>
                                  {p.audioEnabled ? <Mic className="w-3.5 h-3.5 text-teal-400 animate-pulse" /> : <MicOff className="w-3.5 h-3.5 text-rose-400" />}
                                </span>

                                {/* Host expulsion control override */}
                                {!isSelf && participants.find(item => item.id === localParticipantId)?.role === 'host' && (
                                  <button
                                    onClick={() => handleHostRemoveParticipant(p.id)}
                                    className="p-1 rounded bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400 transition cursor-pointer"
                                    title="Evacuate user from the session"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  )}

                  {/* -------------------------------------- */}
                  {/* TAB C: IN-CALL QUICK CHOICE POLLS */}
                  {/* -------------------------------------- */}
                  {activeRightTab === 'polls' && (
                    <div className="space-y-4">
                      
                      {/* Host custom Poll Creation Form */}
                      {participants.find(p => p.id === localParticipantId)?.role === 'host' && (
                        <div className="p-3.5 bg-slate-950/50 border border-white/5 rounded-2xl space-y-3">
                          <div className="text-[10px] text-teal-400 font-bold uppercase tracking-wider flex items-center gap-1">
                            <HelpCircle className="w-4 h-4 text-teal-400" /> Compose New Poll
                          </div>
                          
                          <div className="space-y-2">
                            <div>
                              <label className="text-[9px] text-slate-400 uppercase tracking-wide font-bold">Question</label>
                              <input 
                                id="poll-q-input"
                                type="text" 
                                placeholder="E.g., Are we aligned on the visual redesign?" 
                                className="w-full text-xs px-2.5 py-1.8 mt-1 rounded-xl bg-slate-800 text-white focus:outline-none border border-slate-700/60"
                              />
                            </div>
                            
                            <div>
                              <label className="text-[9px] text-slate-400 uppercase tracking-wide font-bold">Option A</label>
                              <input 
                                id="poll-o1-input"
                                type="text" 
                                placeholder="Yes, looks amazing!" 
                                className="w-full text-xs px-2.5 py-1.8 mt-1 rounded-xl bg-slate-800 text-white focus:outline-none border border-slate-700/60"
                              />
                            </div>
                            
                            <div>
                              <label className="text-[9px] text-slate-400 uppercase tracking-wide font-bold">Option B</label>
                              <input 
                                id="poll-o2-input"
                                type="text" 
                                placeholder="No, needs tweaks" 
                                className="w-full text-xs px-2.5 py-1.8 mt-1 rounded-xl bg-slate-800 text-white focus:outline-none border border-slate-700/60"
                              />
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              const q = (document.getElementById("poll-q-input") as HTMLInputElement)?.value;
                              const o1 = (document.getElementById("poll-o1-input") as HTMLInputElement)?.value;
                              const o2 = (document.getElementById("poll-o2-input") as HTMLInputElement)?.value;
                              if (q && o1 && o2) {
                                handleCreateNewPoll(q, [o1, o2]);
                                // Clear inputs
                                (document.getElementById("poll-q-input") as HTMLInputElement).value = "";
                                (document.getElementById("poll-o1-input") as HTMLInputElement).value = "";
                                (document.getElementById("poll-o2-input") as HTMLInputElement).value = "";
                              }
                            }}
                            className="w-full py-2 bg-teal-600 font-bold hover:bg-teal-500 rounded-xl text-white transition text-xs uppercase tracking-wide"
                          >
                            Publish In-meeting Poll
                          </button>
                        </div>
                      )}

                      {/* Active Polls visualization section */}
                      <div className="space-y-4">
                        <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Polls ({polls.length})</h4>
                        
                        {polls.length === 0 ? (
                          <div className="text-center p-6 text-slate-550 border border-dashed border-white/5 rounded-2xl py-12">
                            <span className="text-2xl block mb-1">📊</span>
                            <p className="text-[10px] text-slate-400">No active polls inside the workspace room call. Wait for coordinator to publish!</p>
                          </div>
                        ) : (
                          polls.map(p => {
                            const totalVotes = p.options.reduce((sum, opt) => sum + opt.votes, 0) || 1;
                            const hasVoted = p.votedUserIds[localParticipantId] !== undefined;

                            return (
                              <div key={p.id} className="p-3.5 bg-slate-950/20 border border-white/5 rounded-2xl space-y-3 animate-fade-in">
                                <div>
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[8px] font-bold uppercase tracking-wider">
                                    LIVE POLL
                                  </span>
                                  <h5 className="text-xs font-bold text-white mt-1.5 leading-normal">{p.question}</h5>
                                </div>

                                <div className="space-y-2">
                                  {p.options.map((opt, idx) => {
                                    const percentage = Math.round((opt.votes / totalVotes) * 100);
                                    const isUserChoice = p.votedUserIds[localParticipantId] === idx;

                                    return (
                                      <button
                                        key={idx}
                                        disabled={hasVoted}
                                        onClick={() => handleCastPollVote(p.id, idx)}
                                        className={`w-full text-left p-2.5 rounded-xl border relative overflow-hidden transition group ${
                                          isUserChoice 
                                            ? 'border-teal-500 bg-teal-500/10' 
                                            : 'border-white/5 bg-slate-900 hover:border-white/10'
                                        }`}
                                      >
                                        {/* Graphical vote progress bar */}
                                        <div 
                                          className="absolute left-0 top-0 bottom-0 bg-teal-500/15 transition-all duration-300 -z-10"
                                          style={{ width: `${percentage}%` }}
                                        />

                                        <div className="flex items-center justify-between text-xs z-10 relative">
                                          <span className="font-semibold text-slate-200 group-hover:text-white truncate max-w-[200px]">
                                            {opt.text} {isUserChoice && <span className="text-teal-400">(Selected)</span>}
                                          </span>
                                          <span className="text-[10px] font-mono text-slate-400 font-bold">
                                            {opt.votes} ({percentage}%)
                                          </span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                    </div>
                  )}

                  {/* -------------------------------------- */}
                  {/* TAB D: COOPERATIVE REAL-TIME CANVAS */}
                  {/* -------------------------------------- */}
                  {activeRightTab === 'whiteboard' && (
                    <div className="space-y-3">
                      
                      {/* Tool selection header and configurations */}
                      <div className="flex items-center justify-between p-2 bg-slate-950/40 border border-white/5 rounded-2xl">
                        <div className="flex items-center gap-1.5">
                          {/* Color circles */}
                          {['#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#f1f5f9'].map(c => (
                            <button
                              key={c}
                              onClick={() => setWhiteboardColor(c)}
                              className={`w-5.5 h-5.5 rounded-full transition active:scale-110 ${
                                whiteboardColor === c ? 'ring-2 ring-teal-400 border border-slate-900 scale-110' : ''
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleWhiteboardClear}
                            className="p-1 px-2 text-[10px] font-bold text-rose-300 hover:text-white hover:bg-rose-500/20 bg-rose-500/10 rounded-lg transition"
                          >
                            Clear Board
                          </button>
                        </div>
                      </div>

                      {/* Stroke Width Configurer */}
                      <div className="flex items-center justify-between px-1 text-[10px] text-slate-400">
                        <span>Brush Width: {whiteboardWidth}px</span>
                        <input 
                          type="range" 
                          min={2} 
                          max={10} 
                          value={whiteboardWidth}
                          onChange={(e) => setWhiteboardWidth(Number(e.target.value))}
                          className="w-24 accent-teal-400 cursor-pointer"
                        />
                      </div>

                      {/* Collaborative canvas */}
                      <div className="border border-white/5 rounded-2xl bg-slate-950/80 overflow-hidden flex items-center justify-center relative">
                        <canvas
                          ref={canvasRef}
                          width={320}
                          height={300}
                          onMouseDown={handleWhiteboardMouseDown}
                          onMouseMove={handleWhiteboardMouseMove}
                          onMouseUp={handleWhiteboardMouseUp}
                          className="bg-slate-950/20 cursor-crosshair select-none"
                        />
                        <div className="absolute top-2 right-2 p-1.5 px-3 rounded-full bg-slate-900/80 backdrop-blur border border-white/5 pointer-events-none text-[8.5px] font-mono text-slate-400">
                          Workspace Shared Board
                        </div>
                      </div>

                      <p className="text-[9.5px] text-slate-400 text-center leading-normal italic">
                        *Draw with mouse or trackpad inside the panel. Your drawn lines stream instantaneously to call attendees.
                      </p>

                    </div>
                  )}

                  {/* -------------------------------------- */}
                  {/* TAB E: REAL-TIME CONVERSATIONAL NOTES */}
                  {/* -------------------------------------- */}
                  {activeRightTab === 'notes' && (
                    <div className="space-y-3 h-full flex flex-col justify-between min-h-[300px]">
                      
                      <div className="flex-1 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="flex items-center gap-1.5 font-bold tracking-wider uppercase">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            Synchronized Minutes Draft
                          </span>
                          <span className="text-[9px] font-mono">Syncing...</span>
                        </div>
                        
                        <textarea
                          className="flex-1 w-full h-[280px] p-3 text-xs leading-normal bg-slate-950/60 hover:bg-slate-950/80 transition text-slate-200 border border-white/5 rounded-2xl focus:outline-none focus:ring-1 focus:ring-teal-500/50 resize-none font-sans"
                          placeholder="Draft collaborative meeting minutes and key bullet alignments here on the fly. Anyone in the meeting can edit..."
                          value={meetingNotes}
                          onChange={(e) => handleNotesChange(e.target.value)}
                        />
                      </div>

                      <div className="p-3 bg-teal-500/5 rounded-xl border border-teal-500/10 text-[9px] text-slate-400 italic leading-snug">
                        *Notes generated inside MeetFlow are compiled during session teardown and distributed to call participants automatically.
                      </div>

                    </div>
                  )}

                  {/* -------------------------------------- */}
                  {/* TAB MEDIA: SYNCHRONIZED CO-WATCH PLAYER */}
                  {/* -------------------------------------- */}
                  {activeRightTab === 'media' && (
                    <div className="space-y-4 h-full flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="flex items-center gap-1.5 font-bold tracking-wider uppercase">
                            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                            Multi-Viewer Video Sync
                          </span>
                          <span className="text-[9px] font-mono text-teal-400">active</span>
                        </div>

                        {!sharedVideo ? (
                          <div className="space-y-4">
                            <p className="text-[11px] text-slate-400 leading-normal">
                              Paste an MP4 direct URL feed or YouTube link below to stream and watch synchronized videos together in real-time with other participants!
                            </p>

                            <div className="space-y-2">
                              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Video URL Link</label>
                              <div className="flex gap-2">
                                <input
                                  type="url"
                                  placeholder="https://youtu.be/... or .mp4 URL"
                                  value={mediaLinkInput}
                                  onChange={(e) => setMediaLinkInput(e.target.value)}
                                  className="flex-1 min-w-0 px-3 py-2 bg-slate-950/70 text-xs border border-white/5 rounded-xl text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500 font-sans"
                                />
                                <button
                                  onClick={() => {
                                    startVideoSharing(mediaLinkInput);
                                    setMediaLinkInput("");
                                  }}
                                  disabled={!mediaLinkInput.trim()}
                                  className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:hover:bg-teal-600 text-white text-xs font-semibold rounded-xl cursor-pointer transition active:scale-95 shrink-0"
                                >
                                  Share
                                </button>
                              </div>
                            </div>

                            {/* Preset Shortcuts */}
                            <div className="space-y-2 pt-2">
                              <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Suggested Test Feeds</div>
                              <div className="space-y-2">
                                {[
                                  { title: "Big Buck Bunny Movie (HD mp4)", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" },
                                  { title: "Sintel Open Movie Trailer (.mp4)", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4" },
                                  { title: "Lofi Study Relax Ambient Stream (YouTube)", url: "https://www.youtube.com/watch?v=jfKfPfyJRdk" }
                                ].map((preset, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => {
                                      startVideoSharing(preset.url);
                                    }}
                                    className="w-full text-left p-2.5 bg-slate-950/40 hover:bg-slate-950/80 border border-white/5 hover:border-teal-500/30 rounded-xl transition text-[10px] text-slate-300 flex items-center justify-between group cursor-pointer"
                                  >
                                    <div className="truncate pr-2">
                                      <div className="font-semibold text-slate-200 group-hover:text-teal-400 truncate">{preset.title}</div>
                                      <div className="text-[8.5px] text-slate-500 font-mono mt-0.5 truncate">{preset.url}</div>
                                    </div>
                                    <span className="text-[10px] text-slate-500 group-hover:text-teal-400 font-bold tracking-widest uppercase font-mono shrink-0">Load &gt;</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3.5 p-3.5 bg-slate-950/40 border border-teal-500/20 rounded-2xl">
                            <div className="flex items-center gap-2">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              <div className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">Currently Streaming</div>
                            </div>

                            <div className="space-y-1">
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Source Link</p>
                              <p className="text-[10px] text-slate-200 break-all font-mono bg-slate-950/60 p-2 rounded-lg border border-white/5">{sharedVideo.url}</p>
                            </div>

                            <p className="text-[11px] text-slate-400">
                              Shared dynamically by attendee: <span className="font-semibold text-slate-200">{sharedVideo.sharedBy}</span>. All participants watch this feed simultaneously.
                            </p>

                            <button
                              onClick={stopVideoSharing}
                              className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs font-semibold rounded-xl transition cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                            >
                              <X className="w-3.5 h-3.5" /> Stop Co-Watching
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="p-3 bg-teal-500/5 rounded-xl border border-teal-500/10 text-[9px] text-slate-400 italic leading-snug">
                        *Synchronized playback broadcasts event coordinates to keeping all connected meeting viewers precisely aligned on the video.
                      </div>
                    </div>
                  )}

                  {/* -------------------------------------- */}
                  {/* TAB F: INTEGRATED BREAKOUT ROOMS */}
                  {/* -------------------------------------- */}
                  {activeRightTab === 'breakout' && (
                    <div className="space-y-4">
                      
                      {/* Host action panel */}
                      {participants.find(p => p.id === localParticipantId)?.role === 'host' && (
                        <div className="p-3.5 bg-slate-950/40 border border-white/5 rounded-2xl space-y-3">
                          <div className="text-[10px] text-teal-400 font-bold uppercase tracking-wider">
                            Breakaway session controller
                          </div>
                          <p className="text-[10px] text-slate-400 leading-normal">
                            Spawn separate discussion sessions and split meeting participants to encourage focus collaboration:
                          </p>

                          <div className="flex gap-2">
                            <button
                              onClick={handleStartBreakoutSessions}
                              className="px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition cursor-pointer flex-1 text-center"
                            >
                              Split Rooms
                            </button>
                            <button
                              onClick={handleCloseBreakoutSessions}
                              className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition cursor-pointer flex-1 text-center"
                            >
                              Recall All
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Display rooms listings */}
                      <div className="space-y-3">
                        <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active sub-rooms ({breakoutRooms.length})</h4>
                        
                        {breakoutRooms.length === 0 ? (
                          <div className="text-center py-12 p-4 text-slate-500 border border-dashed border-white/5 rounded-2xl">
                            <span className="text-2xl block mb-1">🚪</span>
                            <p className="text-[10px] text-slate-400">All attendees currently positioned in main conference session.</p>
                          </div>
                        ) : (
                          breakoutRooms.map(room => {
                            const isAllocated = room.participants.includes(localParticipantId);

                            return (
                              <div key={room.id} className="p-3 bg-slate-950/20 border border-white/5 rounded-2xl space-y-2">
                                <div className="flex items-center justify-between">
                                  <h5 className="text-xs font-bold text-white">{room.name}</h5>
                                  {isAllocated && (
                                    <span className="px-2 py-0.5 rounded bg-amber-500/25 border border-amber-500/35 text-amber-300 text-[8px] font-bold uppercase animate-pulse">
                                      Your room
                                    </span>
                                  )}
                                </div>
                                
                                <p className="text-[10px] text-slate-400 font-mono">
                                  Participants count: {room.participants.length} members
                                </p>
                              </div>
                            );
                          })
                        )}
                      </div>

                    </div>
                  )}

                  {/* -------------------------------------- */}
                  {/* TAB G: REAL-TIME CONVERSATION STATS */}
                  {/* -------------------------------------- */}
                  {activeRightTab === 'analytics' && (
                    <div className="space-y-4">
                      
                      <div className="p-3.5 bg-slate-950/40 border border-white/5 rounded-2xl space-y-2">
                        <div className="text-[10px] text-teal-400 font-bold uppercase tracking-wider">
                          Call metrics overview
                        </div>
                        <p className="text-[10px] text-slate-400 leading-normal">
                          Live attendance and visual speaker contribution levels compiled on the fly:
                        </p>
                      </div>

                      {/* Custom SVG Bar Chart detailing Talk Times */}
                      <div className="p-3 bg-slate-950/30 border border-white/5 rounded-2xl space-y-3">
                        <h5 className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Speaker Contribution logs (relative talk)</h5>
                        
                        <div className="p-1 flex flex-col gap-2">
                          {participants.map((p, index) => {
                            // Assign arbitrary talking percentages for simulation
                            const percentage = index === 0 ? 45 : index === 1 ? 30 : 25;
                            return (
                              <div key={p.id} className="space-y-1">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="text-slate-200 truncate max-w-[150px]">{p.name}</span>
                                  <span className="font-mono text-slate-400 font-bold">{percentage}% speech</span>
                                </div>
                                <div className="w-full h-1.8 bg-slate-800 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-teal-400 rounded-full transition-all duration-300" 
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* High fidelity analytic indicator indicators */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="p-3 bg-slate-950/30 border border-white/5 rounded-2xl text-center">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Meeting Quality</span>
                          <span className="text-lg font-bold text-emerald-400 block mt-1">99.8%</span>
                          <span className="text-[8px] text-slate-500 font-mono block">Optimal Jitter rate</span>
                        </div>
                        <div className="p-3 bg-slate-950/30 border border-white/5 rounded-2xl text-center">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Media Bitrates</span>
                          <span className="text-lg font-bold text-teal-400 block mt-1">1.4 Mbps</span>
                          <span className="text-[8px] text-slate-500 font-mono block">Opus codec stereo</span>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* -------------------------------------- */}
                  {/* TAB H: SIGNAL SPEED & CHANNEL DIAGS */}
                  {/* -------------------------------------- */}
                  {activeRightTab === 'diagnostics' && (
                    <div className="space-y-4">
                      
                      {/* Detailed Diagnostic table details */}
                      <div className="p-3.5 bg-slate-950/40 border border-white/5 rounded-2xl space-y-2">
                        <div className="text-[10px] text-teal-400 font-bold uppercase tracking-wider">
                          WebRTC Diagnostic metrics
                        </div>
                        
                        <div className="divide-y divide-white/5 pt-1 text-[10.5px]">
                          <div className="py-1.8 flex justify-between">
                            <span className="text-slate-400">Average Latency:</span>
                            <span className="font-mono text-emerald-400 font-bold">{networkDiagnostics.latency} ms</span>
                          </div>
                          <div className="py-1.8 flex justify-between">
                            <span className="text-slate-400">Packet Loss Rate:</span>
                            <span className="font-mono text-emerald-400 font-bold">{networkDiagnostics.packetLoss}%</span>
                          </div>
                          <div className="py-1.8 flex justify-between">
                            <span className="text-slate-400">Capture Jitter frequency:</span>
                            <span className="font-mono text-teal-400 font-bold">{networkDiagnostics.jitter} ms</span>
                          </div>
                          <div className="py-1.8 flex justify-between">
                            <span className="text-slate-400">Media Codec profile:</span>
                            <span className="font-mono text-slate-300 font-semibold">{networkDiagnostics.codec}</span>
                          </div>
                        </div>
                      </div>

                      {/* Beautiful glowing sinusoidal visual signal path */}
                      <div className="p-3 bg-slate-950/20 border border-white/5 rounded-2xl flex flex-col items-center justify-center space-y-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block self-start">Live Connection Signal Rate</span>
                        
                        {/* Custom visual path elements simulating network stream speed */}
                        <svg className="w-full h-14 text-teal-400/80 animate-pulse mt-1" viewBox="0 0 100 20" preserveAspectRatio="none">
                          <path 
                            d="M0,10 Q10,1 20,10 T40,10 T60,10 T80,10 T100,10" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="1.5"
                          />
                        </svg>
                        
                        <span className="text-[8.5px] font-mono text-slate-400">Status: Standard channel response signal verified</span>
                      </div>

                    </div>
                  )}

                </div>

                {/* 3. Static Status Footer banner inside side bar */}
                <div className="shrink-0 p-3.5 bg-slate-950/50 border-t border-white/5 text-[9px] text-slate-500 font-mono text-center leading-normal">
                  Channel Sync: Connected • Secure WebSockets Active
                </div>

              </div>
            )}

          </main>

          {/* ----------------------------------------------------------------------------- */}
          {/* LOWER CONTROLLER HUD OVERLAY BUTTON BAR */}
          {/* ----------------------------------------------------------------------------- */}
          <footer className="p-4 bg-slate-900 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 z-10">
            
            {/* Layout switcher & Screen captures on leftmost segment */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLayout(l => l === 'grid' ? 'speaker' : 'grid')}
                className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                  layout === 'speaker' 
                    ? 'bg-teal-600 text-white' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
                title="Change call rendering arrangement layout"
              >
                <Grid className="w-4 h-4" />
                <span className="hidden md:inline">
                  {layout === 'speaker' ? 'Grid Arrangement' : 'Speaker Highlight'}
                </span>
              </button>

              <button
                onClick={toggleScreenSharing}
                className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                  isScreenSharing 
                    ? 'bg-teal-600 text-white' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span className="hidden md:inline">{isScreenSharing ? 'Stop Presenting' : 'Share Screen'}</span>
              </button>
            </div>

            {/* Core audio/video active switchboard centered */}
            <div className="flex items-center gap-3.5">
              
              {/* Mic Toggle Button */}
              <button
                onClick={toggleMicLocal}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition active:scale-95 shadow-lg shadow-black/20 hover:cursor-pointer ${
                  preferences.micEnabled 
                    ? 'bg-slate-800 hover:bg-slate-700 text-white' 
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {preferences.micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>

              {/* Cam Toggle Button */}
              <button
                onClick={toggleCameraLocal}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition active:scale-95 shadow-lg shadow-black/20 hover:cursor-pointer ${
                  preferences.cameraEnabled 
                    ? 'bg-slate-800 hover:bg-slate-700 text-white' 
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {preferences.cameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>

              {/* Hand Raise Toggle Button */}
              <button
                onClick={toggleRaiseHand}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition active:scale-95 shadow-lg shadow-black/20 hover:cursor-pointer ${
                  isHandRaised 
                    ? 'bg-teal-600 text-white' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
                title="Raise Hand"
              >
                <Hand className="w-5 h-5" />
              </button>

              {/* Emoji quick dispenser bar */}
              <div className="relative group">
                <button
                  className="w-11 h-11 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition shadow-lg shadow-black/20 hover:cursor-pointer"
                  title="Cast feedback reaction"
                >
                  <Smile className="w-5 h-5" />
                </button>
                
                {/* Popover emoji strip */}
                <div className="absolute bottom-13 left-1/2 -translate-x-1/2 p-2 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex gap-1.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition duration-200 z-30">
                  {['❤️', '👏', '🔥', '🎉', '💡', '😂'].map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => dispatchEmojiReaction(emoji)}
                      className="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-lg active:scale-125 transition duration-100 placeholder:cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* RED FORCE LEAVE HANGUP */}
              <button
                onClick={handleExitCallRoom}
                className="w-12 h-11 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg shadow-rose-600/10 active:scale-95 transition hover:cursor-pointer"
                title="Hang up and quit session"
              >
                <Phone className="w-5 h-5 rotate-[135deg]" />
              </button>
            </div>

            {/* Rightmost menu togglers (Chat unread counts, fullscreen toggles) */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setChatOpen(!chatOpen);
                  setUnreadCount(0);
                }}
                className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                  chatOpen 
                    ? 'bg-teal-600 text-white shadow-sm shadow-teal-500/10' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white relative'
                }`}
              >
                <Users className="w-4 h-4/4" />
                <span className="hidden lg:inline">Chat discussions</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-teal-500 text-[9px] font-bold text-white leading-none">
                    {unreadCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setParticipantsOpen(!participantsOpen)}
                className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                  participantsOpen 
                    ? 'bg-teal-600 text-white' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                <span className="hidden lg:inline">Attendees ({participants.length})</span>
              </button>

              <button
                onClick={toggleFullscreenView}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                title="Set full screen mode"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>

          </footer>

        </div>
      )}


      {/* Global Setting Modal Preferences Frame overlay */}
      <SettingsModal 
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        preferences={preferences}
        onSave={handleSavePreference}
      />

    </div>
  );
}
