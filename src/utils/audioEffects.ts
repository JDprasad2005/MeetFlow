/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Synthesize pleasant acoustic system chimes using Web Audio API
class AudioSynthesizer {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
  }

  private playTone(freq: number, duration: number, type: OscillatorType = "sine", gainVal: number = 0.15) {
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gainNode.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio Context playback failed (user interaction might be required first).", e);
    }
  }

  playJoin() {
    this.playTone(440, 0.1, "sine", 0.12);
    setTimeout(() => {
      this.playTone(554.37, 0.12, "sine", 0.12);
    }, 80);
    setTimeout(() => {
      this.playTone(659.25, 0.2, "sine", 0.15);
    }, 160);
  }

  playLeave() {
    this.playTone(587.33, 0.12, "sine", 0.12);
    setTimeout(() => {
      this.playTone(493.88, 0.12, "sine", 0.12);
    }, 90);
    setTimeout(() => {
      this.playTone(392.00, 0.25, "sine", 0.12);
    }, 180);
  }

  playMuteToggle(muted: boolean) {
    if (muted) {
      this.playTone(220, 0.08, "triangle", 0.1);
      setTimeout(() => {
        this.playTone(180, 0.12, "triangle", 0.12);
      }, 70);
    } else {
      this.playTone(330, 0.08, "triangle", 0.1);
      setTimeout(() => {
        this.playTone(415.3, 0.12, "triangle", 0.12);
      }, 70);
    }
  }

  playReaction() {
    // Elegant soft sweet ping for popping reactions
    this.playTone(783.99, 0.18, "sine", 0.06);
    setTimeout(() => {
      this.playTone(987.77, 0.18, "sine", 0.06);
    }, 60);
  }
}

export const audioEffects = new AudioSynthesizer();
