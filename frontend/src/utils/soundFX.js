// Web Audio API Synthesizer for 5 aesthetic UI sound profiles & notification chimes (zero external audio file dependencies)

export const SOUND_PROFILES = [
  { id: 'creamy', label: 'Creamy Thock' },
  { id: 'mechanical', label: 'Mechanical Switch' },
  { id: 'bubble', label: 'Soft Bubble Pop' },
  { id: 'woodblock', label: 'Minimal Wood Block' },
  { id: 'chime', label: 'Aesthetic Chime' },
];

class SoundFXEngine {
  constructor() {
    this.audioCtx = null;
    this.enabled = true;
    this.volume = 0.5; // 0.0 to 1.0
    this.profile = 'creamy'; // 'creamy' | 'mechanical' | 'bubble' | 'woodblock' | 'chime'
    this.userStatus = 'online';

    try {
      const savedEnabled = localStorage.getItem('socratic_sound_fx') || localStorage.getItem('studymatch_sound_fx');
      if (savedEnabled !== null) {
        this.enabled = JSON.parse(savedEnabled);
      }

      const savedVol = localStorage.getItem('socratic_sound_volume');
      if (savedVol !== null) {
        this.volume = Math.max(0, Math.min(1, JSON.parse(savedVol)));
      }

      const savedProf = localStorage.getItem('socratic_sound_profile');
      if (savedProf !== null) {
        this.profile = JSON.parse(savedProf);
      }
    } catch {
      this.enabled = true;
      this.volume = 0.5;
      this.profile = 'creamy';
    }
  }

  setUserStatus(status) {
    this.userStatus = status;
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setSoundEnabled(enable) {
    this.enabled = enable;
    try {
      localStorage.setItem('socratic_sound_fx', JSON.stringify(enable));
    } catch {
      // Ignore storage error
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('socratic_sound_volume', JSON.stringify(this.volume));
    } catch {
      // Ignore storage error
    }
  }

  setSoundProfile(profileId) {
    this.profile = profileId;
    try {
      localStorage.setItem('socratic_sound_profile', JSON.stringify(profileId));
    } catch {
      // Ignore storage error
    }
  }

  playSoftClick() {
    if (!this.enabled || this.volume <= 0) return;
    try {
      this.initContext();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const masterVol = this.volume;

      if (this.profile === 'creamy') {
        // 1. Creamy Thock (Warm sine wave pitch drop 320Hz -> 80Hz)
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.04);

        gain.gain.setValueAtTime(0.2 * masterVol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.04);
      } else if (this.profile === 'mechanical') {
        // 2. Mechanical Switch (Crisp dual triangle pulse 1200Hz -> 180Hz)
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.03);

        gain.gain.setValueAtTime(0.25 * masterVol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.03);
      } else if (this.profile === 'bubble') {
        // 3. Soft Bubble Pop (Resonant pitch pop 220Hz -> 480Hz -> 160Hz)
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(480, now + 0.02);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.05);

        gain.gain.setValueAtTime(0.22 * masterVol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.05);
      } else if (this.profile === 'woodblock') {
        // 4. Minimal Wood Block (Organic wood tap 700Hz -> 300Hz)
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(700, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.035);

        gain.gain.setValueAtTime(0.28 * masterVol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.035);
      } else if (this.profile === 'chime') {
        // 5. Aesthetic Chime (High metallic glass tick 1050Hz -> 850Hz)
        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';

        osc1.frequency.setValueAtTime(1050, now);
        osc2.frequency.setValueAtTime(1318.5, now); // E6 harmonic

        gain.gain.setValueAtTime(0.18 * masterVol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.06);
        osc2.stop(now + 0.06);
      }
    } catch {
      // Ignore web audio exceptions
    }
  }

  playNotification() {
    if (!this.enabled || this.volume <= 0 || this.userStatus === 'dnd') return;
    try {
      this.initContext();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const masterVol = this.volume;

      // Gentle dual-tone chime (E5 -> G5)
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(659.25, now); // E5
      osc2.frequency.setValueAtTime(783.99, now + 0.08); // G5

      gain.gain.setValueAtTime(0.2 * masterVol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc1.start(now);
      osc1.stop(now + 0.15);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.35);
    } catch {
      // Ignore audio errors
    }
  }

  playSuccess() {
    if (!this.enabled || this.volume <= 0 || this.userStatus === 'dnd') return;
    try {
      this.initContext();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const masterVol = this.volume;

      // Upward 3-note major arpeggio chime (C5 -> E5 -> G5)
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.07); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.14); // G5

      gain.gain.setValueAtTime(0.22 * masterVol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.45);
    } catch {
      // Ignore audio errors
    }
  }

  playPublishChime() {
    if (!this.enabled || this.volume <= 0 || this.userStatus === 'dnd') return;
    try {
      this.initContext();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const masterVol = this.volume;

      // Cute ascending sparkle chime (G5 -> C6 -> E6)
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const osc3 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc3.type = 'triangle';

      osc1.frequency.setValueAtTime(783.99, now);        // G5
      osc2.frequency.setValueAtTime(1046.50, now + 0.08); // C6
      osc3.frequency.setValueAtTime(1318.51, now + 0.16); // E6

      gain.gain.setValueAtTime(0.25 * masterVol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc1.connect(gain);
      osc2.connect(gain);
      osc3.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc1.start(now);
      osc1.stop(now + 0.12);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.22);
      osc3.start(now + 0.16);
      osc3.stop(now + 0.5);
    } catch {
      // Ignore audio errors
    }
  }
}

export const soundFX = new SoundFXEngine();
