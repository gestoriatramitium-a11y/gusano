import type { FoodKind } from "../core/game";

interface TonePreset {
  readonly frequency: number;
  readonly secondFrequency: number;
  readonly type: OscillatorType;
}

const FOOD_TONES: Readonly<Record<FoodKind, TonePreset>> = {
  "legendary-potato": {
    frequency: 260,
    secondFrequency: 330,
    type: "triangle",
  },
  "flying-pizza": { frequency: 420, secondFrequency: 620, type: "sine" },
  "lost-robot": { frequency: 190, secondFrequency: 240, type: "square" },
  "angry-emoji": { frequency: 150, secondFrequency: 110, type: "sawtooth" },
  "sad-sock": { frequency: 310, secondFrequency: 260, type: "triangle" },
  "duck-king": { frequency: 560, secondFrequency: 740, type: "sine" },
  "cringe-energy": { frequency: 760, secondFrequency: 980, type: "square" },
  "influencer-avocado": {
    frequency: 480,
    secondFrequency: 580,
    type: "triangle",
  },
  "infinite-coffee": { frequency: 900, secondFrequency: 1200, type: "square" },
  "super-meme": { frequency: 1040, secondFrequency: 1560, type: "sawtooth" },
};

export class SynthAudio {
  private context: AudioContext | null = null;
  private muted = false;

  async unlock(): Promise<void> {
    if (this.muted) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === "suspended") await this.context.resume();
    } catch {
      this.context = null;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!muted) void this.unlock();
  }

  isMuted(): boolean {
    return this.muted;
  }

  playFood(kind: FoodKind): void {
    const preset = FOOD_TONES[kind];
    if (!preset) return;
    this.playTone(preset.frequency, 0.09, preset.type, 0);
    this.playTone(preset.secondFrequency, 0.12, preset.type, 0.075);
  }

  playEvolution(): void {
    [440, 554, 659, 880].forEach((frequency, index) => {
      this.playTone(frequency, 0.2, "triangle", index * 0.09, 0.045);
    });
  }

  playGameOver(): void {
    [240, 190, 140].forEach((frequency, index) => {
      this.playTone(frequency, 0.22, "sawtooth", index * 0.13, 0.025);
    });
  }

  playElimination(): void {
    [520, 310, 170].forEach((frequency, index) => {
      this.playTone(frequency, 0.13, "square", index * 0.045, 0.022);
    });
  }

  close(): void {
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") void context.close();
  }

  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    delay: number,
    volume = 0.035,
  ): void {
    if (this.muted || !this.context || this.context.state !== "running") return;

    const startAt = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(60, frequency * 0.86),
      startAt + duration,
    );
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
  }
}
