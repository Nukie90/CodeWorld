class AudioManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.isMuted = false;
        this.initialized = false;

        // Background Music Playlist
        this.bgmTracks = ['/bgm1.mp3', '/bgm2.mp3'];
        this.currentBgmIndex = 0;
        this.bgmAudio = new Audio(this.bgmTracks[this.currentBgmIndex]);
        this.bgmAudio.volume = 0.3;

        // Auto-play the next track when one ends
        this.bgmAudio.addEventListener('ended', () => {
            this.currentBgmIndex = (this.currentBgmIndex + 1) % this.bgmTracks.length;
            this.bgmAudio.src = this.bgmTracks[this.currentBgmIndex];
            if (!this.isMuted) {
                this.bgmAudio.play().catch(e => console.warn("Could not play next track:", e));
            }
        });
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);
            // Default volume is low as requested
            this.masterGain.gain.value = this.isMuted ? 0 : 0.8;
            this.initialized = true;
        } catch (e) {
            console.warn("Web Audio API not supported", e);
        }
    }

    setMuted(muted) {
        this.isMuted = muted;
        if (this.masterGain) {
            // Smoothly ramp volume to avoid clicks for synthesized sounds
            this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.1);
        }
        
        // Mute/unmute the HTML Audio element
        this.bgmAudio.muted = muted;

        // If unmuting and bgm not playing, try to start it
        if (!muted && this.initialized && this.bgmAudio.paused) {
            this.startBackgroundMusic();
        }
    }

    toggleMute() {
        this.setMuted(!this.isMuted);
        return this.isMuted;
    }

    startBackgroundMusic() {
        if (!this.initialized || !this.bgmAudio.paused) return;
        
        this.bgmAudio.play().catch(e => {
            console.warn("Could not play background music (is /bgm.mp3 present in the public folder?):", e);
        });
    }

    playLaserSound() {
        if (!this.initialized || this.isMuted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // High frequency to low (laser pew)
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.15);

        // Volume envelope (reduced peak volume for shooting sound)
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.02, this.ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.15);
    }
}

export const audioManager = new AudioManager();
