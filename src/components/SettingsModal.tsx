/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { X, Camera, Mic, Volume2, User, Check, Settings, Sparkles } from "lucide-react";
import { UserPreferences } from "../types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onSave: (prefs: UserPreferences) => void;
}

export default function SettingsModal({ isOpen, onClose, preferences, onSave }: SettingsModalProps) {
  const [name, setName] = useState(preferences.name);
  const [cameraEnabled, setCameraEnabled] = useState(preferences.cameraEnabled);
  const [micEnabled, setMicEnabled] = useState(preferences.micEnabled);
  const [selectedCam, setSelectedCam] = useState(preferences.cameraDeviceId || "default");
  const [selectedMic, setSelectedMic] = useState(preferences.micDeviceId || "default");
  const [selectedSpeaker, setSelectedSpeaker] = useState(preferences.speakerDeviceId || "default");
  const [virtualBg, setVirtualBg] = useState<'none' | 'blur' | 'office' | 'sunset' | 'indigo'>(preferences.virtualBackground || 'none');

  const [activeTab, setActiveTab] = useState<'profile' | 'video' | 'audio' | 'background'>('profile');
  const [availableCams, setAvailableCams] = useState<{ id: string; label: string }[]>([
    { id: "default", label: "Default Integrated Camera (FaceTime HD)" },
    { id: "logitech", label: "Logitech StreamCam Pro (USB)" },
    { id: "virtual", label: "MeetFlow Virtual Camera Filter" }
  ]);
  const [availableMics, setAvailableMics] = useState<{ id: string; label: string }[]>([
    { id: "default", label: "Default Internal Microphone" },
    { id: "yeti", label: "Blue Yeti USB Microphone" },
    { id: "headset", label: "External Broadcast Headset Transmitter" }
  ]);
  const [availableSpeakers, setAvailableSpeakers] = useState<{ id: string; label: string }[]>([
    { id: "default", label: "Default Audio Speaker System" },
    { id: "headphones", label: "Headphones / AirPods Stereo Connection" },
    { id: "monitor", label: "Studio Display Audio Monitors" }
  ]);

  useEffect(() => {
    // Attempt real navigator media device interrogation
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const cams = devices.filter(d => d.kind === 'videoinput').map((d, i) => ({
          id: d.deviceId || `cam-${i}`,
          label: d.label || `Camera Device ${i + 1} (${d.deviceId.slice(0, 5)})`
        }));
        const mics = devices.filter(d => d.kind === 'audioinput').map((d, i) => ({
          id: d.deviceId || `mic-${i}`,
          label: d.label || `Microphone Input ${i + 1} (${d.deviceId.slice(0, 5)})`
        }));
        const speakers = devices.filter(d => d.kind === 'audiooutput').map((d, i) => ({
          id: d.deviceId || `spk-${i}`,
          label: d.label || `Speaker Port ${i + 1} (${d.deviceId.slice(0, 5)})`
        }));

        if (cams.length > 0) setAvailableCams(cams);
        if (mics.length > 0) setAvailableMics(mics);
        if (speakers.length > 0) setAvailableSpeakers(speakers);
      }).catch(err => {
        // Fallback silently if sandboxed in iframe without permission
        console.log("Media device enumeration sandboxed:", err);
      });
    }
  }, []);

  if (!isOpen) return null;

  const handleApply = () => {
    onSave({
      name: name.trim() || "Participant",
      cameraEnabled,
      micEnabled,
      cameraDeviceId: selectedCam,
      micDeviceId: selectedMic,
      speakerDeviceId: selectedSpeaker,
      virtualBackground: virtualBg
    });
    onClose();
  };

  return (
    <div id="settings-modal-backdrop" className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div id="settings-dialog-container" className="bg-white max-w-lg w-full rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-600">
              <Settings className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h2 className="font-sans font-medium text-slate-800 text-lg">Settings & Preferences</h2>
              <p className="text-xs text-slate-400">Configure devices and user profile</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex flex-1 min-h-[300px] flex-col md:flex-row overflow-y-auto">
          {/* Side Nav tabs */}
          <div className="w-full md:w-1/3 bg-slate-50/50 border-r border-slate-100 p-4 space-y-1">
            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2.5 transition ${
                activeTab === 'profile' 
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/10' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <User className="w-4 h-4" />
              UserProfile
            </button>
            <button
              onClick={() => setActiveTab('video')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2.5 transition ${
                activeTab === 'video' 
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/10' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <Camera className="w-4 h-4" />
              Video Settings
            </button>
            <button
              onClick={() => setActiveTab('audio')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2.5 transition ${
                activeTab === 'audio' 
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/10' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <Mic className="w-4 h-4" />
              Audio Settings
            </button>
            <button
              onClick={() => setActiveTab('background')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2.5 transition ${
                activeTab === 'background' 
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/10' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Virtual FX Options
            </button>
          </div>

          {/* Details */}
          <div className="flex-1 p-6 space-y-5">
            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Your Display Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-700 bg-slate-50/50"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Rachel Adams"
                    />
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                <div className="p-4 bg-teal-50 border border-teal-100/40 rounded-xl space-y-2">
                  <h4 className="text-xs font-medium text-teal-800">Why configure a name?</h4>
                  <p className="text-xs text-teal-600/90 leading-normal">
                    This display name will be shown on your video card, in the participant roster, and alongside your chat message logs in active video sessions.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'video' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Camera Hardware Device</label>
                  <select
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-700 bg-white"
                    value={selectedCam}
                    onChange={(e) => setSelectedCam(e.target.value)}
                  >
                    {availableCams.map(cam => (
                      <option key={cam.id} value={cam.id}>{cam.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-slate-700">Start with Video Enabled</p>
                    <p className="text-xs text-slate-400">Join new meetings with camera active</p>
                  </div>
                  <button
                    onClick={() => setCameraEnabled(!cameraEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      cameraEnabled ? 'bg-teal-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${
                        cameraEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'audio' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Microphone Selection</label>
                  <div className="relative">
                    <select
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-700 bg-white"
                      value={selectedMic}
                      onChange={(e) => setSelectedMic(e.target.value)}
                    >
                      {availableMics.map(mic => (
                        <option key={mic.id} value={mic.id}>{mic.label}</option>
                      ))}
                    </select>
                    <Mic className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Audio Output Speaker</label>
                  <div className="relative">
                    <select
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-700 bg-white"
                      value={selectedSpeaker}
                      onChange={(e) => setSelectedSpeaker(e.target.value)}
                    >
                      {availableSpeakers.map(sp => (
                        <option key={sp.id} value={sp.id}>{sp.label}</option>
                      ))}
                    </select>
                    <Volume2 className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-slate-700">Start with Mic Muted</p>
                    <p className="text-xs text-slate-400">Join new rooms with microphone silent</p>
                  </div>
                  <button
                    onClick={() => setMicEnabled(!micEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      micEnabled ? 'bg-teal-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${
                        micEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'background' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Backdrop Filter Effects</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'none', title: 'Normal Cam', desc: 'Hardware default stream', color: 'bg-slate-200 text-slate-700 border-slate-300' },
                      { id: 'blur', title: 'Soft Blur Effect', desc: 'Cinematic layout background', color: 'bg-teal-500/10 text-teal-700 border-teal-200' },
                      { id: 'office', title: 'Corporate Suite', desc: 'Clean modern team office', color: 'bg-blue-500/10 text-blue-700 border-blue-200' },
                      { id: 'sunset', title: 'Sunset Haven', desc: 'Warm relaxing background', color: 'bg-amber-500/10 text-amber-700 border-amber-200' },
                      { id: 'indigo', title: 'Space Aurora', desc: 'Immersive dynamic cosmos', color: 'bg-violet-500/10 text-violet-700 border-violet-200' }
                    ].map(bg => (
                      <button
                        key={bg.id}
                        type="button"
                        onClick={() => setVirtualBg(bg.id as any)}
                        className={`p-3 text-left border rounded-xl transition flex flex-col gap-1 ${bg.color} ${
                          virtualBg === bg.id 
                            ? 'ring-2 ring-teal-500 border-transparent shadow' 
                            : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        <span className="text-xs font-semibold">{bg.title}</span>
                        <span className="text-[10px] opacity-85 leading-normal">{bg.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex gap-2">
                  <span className="text-sm shrink-0">✨</span>
                  <p className="text-[11px] text-amber-700 leading-normal">
                    Virtual backgrounds render local GPU-friendly backdrop styling overlays dynamically during the standard video streaming layout feeds.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3.5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-5 py-2 text-sm text-white bg-teal-600 hover:bg-teal-700 rounded-lg font-medium shadow-sm flex items-center gap-1.5 hover:shadow transition"
          >
            <Check className="w-4 h-4" />
            Apply Settings
          </button>
        </div>

      </div>
    </div>
  );
}
