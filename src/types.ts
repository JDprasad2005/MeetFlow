/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Participant {
  id: string;
  name: string;
  role: 'host' | 'participant';
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
  isHandRaised: boolean;
  joinedAt: string;
  isApproved?: boolean; // Set to false if in waiting room
  isWaiting?: boolean; // True if waiting in the lobby
  speaking?: boolean;
  networkQuality?: 'excellent' | 'good' | 'poor';
}

export interface MeetingMessage {
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

export interface MeetingRoom {
  id: string; // abc-defg-hij
  title: string;
  passcode: string | null;
  hostName: string;
  isLocked: boolean;
  createdAt: string;
  scheduledTime: string | null; // Null for instant meetings
  scheduledDuration?: number; // in minutes
  timezone?: string;
  recurringPattern?: 'none' | 'daily' | 'weekly' | 'monthly';
  upcoming?: boolean;
  isWaitingRoomEnabled?: boolean;
  isScreenShareDisabledForParticipants?: boolean;
}

export interface UserPreferences {
  name: string;
  cameraEnabled: boolean;
  micEnabled: boolean;
  cameraDeviceId: string;
  micDeviceId: string;
  speakerDeviceId: string;
  virtualBackground?: 'none' | 'blur' | 'office' | 'sunset' | 'indigo';
}

export interface MeetingPoll {
  id: string;
  question: string;
  options: { text: string; votes: number }[];
  votedUserIds: Record<string, number>; // userId -> optionIndex
  isActive: boolean;
}

export interface WhiteboardStroke {
  id: string;
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

export interface BreakoutRoom {
  id: string;
  name: string;
  participants: string[]; // list of participant IDs
}
