/**
 * Audio Notification Service for Cuidarte Pachuca
 * Generates high-quality, soothing, professional medical sound alerts using the Web Audio API.
 * Does not depend on external MP3 files so it works 100% reliably in any environment.
 */

export type NotificationSoundType =
  | "new_shift"
  | "shift_modified"
  | "medication_5min"
  | "medication_overdue"
  | "shift_starting_soon"
  | "shift_ended_10min"
  | "generic";

class AudioNotificationService {
  private audioCtx: AudioContext | null = null;
  private isSoundEnabled: boolean = true;
  private volume: number = 0.8; // 0.0 to 1.0
  private isInitialized: boolean = false;

  constructor() {
    // Load persisted sound preferences
    try {
      const storedEnabled = localStorage.getItem("cuidarte_sound_enabled");
      if (storedEnabled !== null) {
        this.isSoundEnabled = storedEnabled === "true";
      }
      const storedVol = localStorage.getItem("cuidarte_sound_volume");
      if (storedVol !== null) {
        const parsed = parseFloat(storedVol);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          this.volume = parsed;
        }
      }
    } catch {
      // Ignore localStorage errors
    }

    // Auto-resume audio on first user gesture
    if (typeof window !== "undefined") {
      const unlockAudio = () => {
        this.initAudioContext();
        window.removeEventListener("click", unlockAudio);
        window.removeEventListener("keydown", unlockAudio);
        window.removeEventListener("touchstart", unlockAudio);
      };
      window.addEventListener("click", unlockAudio, { passive: true });
      window.addEventListener("keydown", unlockAudio, { passive: true });
      window.addEventListener("touchstart", unlockAudio, { passive: true });
    }
  }

  private initAudioContext(): AudioContext | null {
    if (!this.audioCtx && typeof window !== "undefined") {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      } catch (err) {
        console.warn("Web Audio API not supported or blocked:", err);
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    this.isInitialized = true;
    return this.audioCtx;
  }

  public setSoundEnabled(enabled: boolean) {
    this.isSoundEnabled = enabled;
    try {
      localStorage.setItem("cuidarte_sound_enabled", String(enabled));
    } catch {}
  }

  public getSoundEnabled(): boolean {
    return this.isSoundEnabled;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem("cuidarte_sound_volume", String(this.volume));
    } catch {}
  }

  public getVolume(): number {
    return this.volume;
  }

  /**
   * Helper to play a sequence of harmonic notes with smooth attack and decay envelopes
   */
  private playToneSequence(
    notes: { freq: number; duration: number; delay: number; type?: OscillatorType; gain?: number }[]
  ) {
    if (!this.isSoundEnabled || this.volume <= 0) return;

    const ctx = this.initAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(this.volume, now);
    masterGain.connect(ctx.destination);

    notes.forEach(({ freq, duration, delay, type = "sine", gain = 0.3 }) => {
      const startTime = now + delay;
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      // Attack and Decay Envelope
      noteGain.gain.setValueAtTime(0.0001, startTime);
      noteGain.gain.exponentialRampToValueAtTime(gain, startTime + 0.04);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    });
  }

  /**
   * 1. Nueva Guardia Asignada o Cambio de Calendario (Melodía ascendente alegre y elegante)
   */
  public playNewShiftSound() {
    this.playToneSequence([
      { freq: 523.25, duration: 0.18, delay: 0.0, type: "triangle", gain: 0.35 }, // C5
      { freq: 659.25, duration: 0.18, delay: 0.12, type: "sine", gain: 0.38 },     // E5
      { freq: 783.99, duration: 0.22, delay: 0.24, type: "sine", gain: 0.42 },     // G5
      { freq: 1046.50, duration: 0.45, delay: 0.38, type: "sine", gain: 0.45 },    // C6
    ]);
  }

  /**
   * 2. Medicamento 5 Minutos Antes (Campanilla suave y clara de aviso preventivo)
   */
  public playMedication5MinSound() {
    this.playToneSequence([
      { freq: 880.00, duration: 0.22, delay: 0.0, type: "sine", gain: 0.4 },       // A5
      { freq: 1174.66, duration: 0.50, delay: 0.15, type: "triangle", gain: 0.45 }, // D6
      { freq: 1760.00, duration: 0.35, delay: 0.18, type: "sine", gain: 0.2 },     // A6 harmonic shimmer
    ]);
  }

  /**
   * 3. Medicamento Vencido / No Aplicado (Tono doble urgente de atención médica)
   */
  public playMedicationOverdueSound() {
    this.playToneSequence([
      { freq: 1318.51, duration: 0.14, delay: 0.0, type: "sawtooth", gain: 0.3 },  // E6
      { freq: 1046.50, duration: 0.14, delay: 0.14, type: "sine", gain: 0.4 },     // C6
      { freq: 1318.51, duration: 0.30, delay: 0.28, type: "sawtooth", gain: 0.35 },// E6
    ]);
  }

  /**
   * 4. Turno de Guardia Próximo a Iniciar (Tono de puntualidad e inicio de bitácora)
   */
  public playShiftStartingSoonSound() {
    this.playToneSequence([
      { freq: 698.46, duration: 0.20, delay: 0.0, type: "triangle", gain: 0.35 },  // F5
      { freq: 880.00, duration: 0.20, delay: 0.14, type: "sine", gain: 0.4 },      // A5
      { freq: 1046.50, duration: 0.40, delay: 0.28, type: "sine", gain: 0.45 },    // C6
    ]);
  }

  /**
   * 5. Turno de Guardia 10 Minutos Después de Vencer (Recordatorio de notas de entrega y cierre)
   */
  public playShiftEnded10MinSound() {
    this.playToneSequence([
      { freq: 783.99, duration: 0.22, delay: 0.0, type: "sine", gain: 0.4 },       // G5
      { freq: 659.25, duration: 0.22, delay: 0.15, type: "triangle", gain: 0.38 }, // E5
      { freq: 523.25, duration: 0.45, delay: 0.30, type: "sine", gain: 0.35 },     // C5
    ]);
  }

  /**
   * 6. Sonido genérico de notificación
   */
  public playGenericSound() {
    this.playToneSequence([
      { freq: 659.25, duration: 0.18, delay: 0.0, type: "sine", gain: 0.35 },
      { freq: 880.00, duration: 0.30, delay: 0.12, type: "sine", gain: 0.4 },
    ]);
  }

  /**
   * Dispatch sound based on notification type
   */
  public playByType(type: NotificationSoundType) {
    switch (type) {
      case "new_shift":
      case "shift_modified":
        this.playNewShiftSound();
        break;
      case "medication_5min":
        this.playMedication5MinSound();
        break;
      case "medication_overdue":
        this.playMedicationOverdueSound();
        break;
      case "shift_starting_soon":
        this.playShiftStartingSoonSound();
        break;
      case "shift_ended_10min":
        this.playShiftEnded10MinSound();
        break;
      default:
        this.playGenericSound();
        break;
    }
  }
}

export const audioNotificationService = new AudioNotificationService();
