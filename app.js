// Main App State Controller
function appState() {
  return {
    screen: 'locked', // 'locked' | 'pin' | 'surprise'
    targetDate: '2026-06-17T00:00:00+07:00', // June 17, 2026 Asia/Jakarta
    init() {
      // Check if bypass_timegate is in URL
      const urlParams = new URLSearchParams(window.location.search);
      const bypass = urlParams.has('bypass_timegate') || sessionStorage.getItem('bypass_timegate') === 'true';
      if (bypass) {
        sessionStorage.setItem('bypass_timegate', 'true');
      }

      // Check if already authenticated in this session
      const authenticated = sessionStorage.getItem('authenticated') === 'true';
      const isTimePassed = new Date().getTime() >= new Date(this.targetDate).getTime();

      if (authenticated) {
        this.screen = 'surprise';
      } else if (isTimePassed || bypass) {
        this.screen = 'pin';
      } else {
        this.screen = 'locked';
      }

      // Listen for unlock events
      window.addEventListener('unlocked', () => {
        sessionStorage.setItem('authenticated', 'true');
        this.screen = 'surprise';
      });

      // Listen for lock events
      window.addEventListener('locked-again', () => {
        sessionStorage.removeItem('authenticated');
        sessionStorage.removeItem('bypass_timegate');
        // Clean URL params if any
        if (window.history.pushState) {
          const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname;
          window.history.pushState({ path: newurl }, '', newurl);
        }
        
        // Re-evaluate state
        const timePassed = new Date().getTime() >= new Date(this.targetDate).getTime();
        this.screen = timePassed ? 'pin' : 'locked';
      });

      // Listen for timegate opening
      window.addEventListener('timegate-opened', () => {
        if (this.screen === 'locked') {
          this.screen = 'pin';
        }
      });
    }
  }
}

// Countdown Timer Controller
function countdown(targetDateStr) {
  return {
    target: new Date(targetDateStr).getTime(),
    days: '00',
    hours: '00',
    minutes: '00',
    seconds: '00',
    init() {
      this.update();
      setInterval(() => this.update(), 1000);
    },
    update() {
      const now = new Date().getTime();
      const distance = this.target - now;

      if (distance < 0) {
        window.dispatchEvent(new CustomEvent('timegate-opened'));
        return;
      }

      const d = Math.floor(distance / (1000 * 60 * 60 * 24));
      const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((distance % (1000 * 60)) / 1000);

      this.days = String(d).padStart(2, '0');
      this.hours = String(h).padStart(2, '0');
      this.minutes = String(m).padStart(2, '0');
      this.seconds = String(s).padStart(2, '0');
    }
  }
}

// Sound effects generator using Web Audio API
const synthSound = {
  playClick() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
  },
  playUnlock() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const playTone = (freq, delay, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.06, ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + duration);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + duration);
      };
      playTone(523.25, 0, 0.15); // C5
      playTone(659.25, 0.08, 0.15); // E5
      playTone(783.99, 0.16, 0.15); // G5
      playTone(1046.50, 0.24, 0.3); // C6
    } catch (e) {}
  },
  playError() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
  }
};

// PIN Verification Controller
function pinHandler() {
  return {
    pin: '',
    isShaking: false,
    isUnlocked: false,
    isFadingOut: false,
    press(num) {
      if (this.pin.length < 4 && !this.isUnlocked) {
        synthSound.playClick();
        this.pin += num;
        if (this.pin.length === 4) {
          setTimeout(() => this.submitPin(), 250);
        }
      }
    },
    del() {
      if (this.pin.length > 0 && !this.isUnlocked) {
        synthSound.playClick();
        this.pin = this.pin.slice(0, -1);
      }
    },
    submitPin() {
      if (this.pin === '1706') {
        synthSound.playUnlock();
        this.isUnlocked = true;
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
        // Animate lock opening, scale up, fade out, then transition
        setTimeout(() => {
          this.isFadingOut = true;
        }, 500);
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('unlocked'));
          this.pin = '';
          this.isUnlocked = false;
          this.isFadingOut = false;
        }, 1000);
      } else {
        // Shake and clear state
        synthSound.playError();
        this.isShaking = true;
        if (navigator.vibrate) {
          navigator.vibrate(200);
        }
        setTimeout(() => {
          this.isShaking = false;
          this.pin = '';
        }, 500);
      }
    }
  }
}

// Background Music Controller
function musicPlayer(audioSrc) {
  return {
    src: audioSrc,
    isPlaying: false,
    init() {
      // Try to autoplay immediately when Alpine initializes
      this.play();
      
      // Also attempt to play on first user interaction in case autoplay is blocked by browser
      const playOnInteract = () => {
        this.play();
        window.removeEventListener('click', playOnInteract);
        window.removeEventListener('touchstart', playOnInteract);
      };
      window.addEventListener('click', playOnInteract);
      window.addEventListener('touchstart', playOnInteract);
      
      // Pause background music UI if mixtape starts
      window.addEventListener('bg-music-paused', () => {
        this.isPlaying = false;
      });
    },
    play() {
      const audio = this.$refs.audio;
      if (audio) {
        audio.play().then(() => {
          this.isPlaying = true;
        }).catch(() => {
          this.isPlaying = false;
        });
      }
    },
    toggle() {
      const audio = this.$refs.audio;
      if (audio) {
        if (this.isPlaying) {
          audio.pause();
          this.isPlaying = false;
        } else {
          audio.play();
          this.isPlaying = true;
        }
      }
    }
  }
}
