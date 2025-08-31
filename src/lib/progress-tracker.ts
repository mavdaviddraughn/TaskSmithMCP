/**
 * ProgressTracker - Progress indicators and status tracking for long-running scripts
 * Part of Run Output Management (T130-T143)
 * 
 * Features:
 * - Multiple spinner animations
 * - Progress bars with customizable styles
 * - Status indicators and phase tracking
 * - Time estimation and ETA calculation
 * - Custom progress patterns and milestones
 */

import { EventEmitter } from 'events';

export interface ProgressConfiguration {
  type: 'spinner' | 'bar' | 'dots' | 'custom';
  refreshRate: number;
  showElapsed: boolean;
  showETA: boolean;
  showPercentage: boolean;
  width: number;
  spinner?: SpinnerConfig;
  bar?: ProgressBarConfig;
}

export interface SpinnerConfig {
  frames: string[];
  interval: number;
  color?: 'red' | 'green' | 'blue' | 'yellow' | 'cyan' | 'magenta';
}

export interface ProgressBarConfig {
  complete: string;
  incomplete: string;
  head?: string;
  format: string;
  clear: boolean;
}

export interface ProgressState {
  current: number;
  total: number;
  percentage: number;
  elapsed: number;
  eta?: number;
  rate?: number;
  phase?: string;
  message?: string;
}

export interface Milestone {
  name: string;
  value: number;
  timestamp?: Date;
  completed: boolean;
}

/**
 * Predefined spinner configurations
 */
export const SPINNERS = {
  dots: { frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'], interval: 80 },
  line: { frames: ['-', '\\', '|', '/'], interval: 130 },
  arrow: { frames: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'], interval: 120 },
  bounce: { frames: ['⠁', '⠂', '⠄', '⠂'], interval: 120 },
  clock: { frames: ['🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛'], interval: 100 },
  moon: { frames: ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'], interval: 80 },
  runner: { frames: ['🏃    ', ' 🏃   ', '  🏃  ', '   🏃 ', '    🏃'], interval: 140 },
  pulsate: { frames: ['●', '●', '●', '●', '●', '◉', '○'], interval: 130 }
};

/**
 * Progress tracking for long-running operations with visual indicators
 */
export class ProgressTracker extends EventEmitter {
  private config: ProgressConfiguration;
  private state: ProgressState;
  private milestones: Milestone[] = [];
  private startTime: Date;
  private lastUpdateTime: Date;
  private timer?: NodeJS.Timeout;
  private frameIndex: number = 0;
  private isActive: boolean = false;
  private completedMilestones: Set<string> = new Set();

  constructor(config: Partial<ProgressConfiguration> = {}) {
    super();

    this.config = {
      type: config.type ?? 'spinner',
      refreshRate: config.refreshRate ?? 100,
      showElapsed: config.showElapsed ?? true,
      showETA: config.showETA ?? true,
      showPercentage: config.showPercentage ?? true,
      width: config.width ?? 40,
      spinner: config.spinner ?? SPINNERS.dots,
      bar: config.bar ?? {
        complete: '█',
        incomplete: '░',
        head: '▓',
        format: '[{bar}] {percentage}% | ETA: {eta}s | Elapsed: {elapsed}s',
        clear: false
      }
    };

    this.startTime = new Date();
    this.lastUpdateTime = this.startTime;
    
    this.state = {
      current: 0,
      total: 100,
      percentage: 0,
      elapsed: 0
    };
  }

  /**
   * Start progress tracking
   */
  start(total: number = 100, message?: string): void {
    this.state.total = total;
    this.state.current = 0;
    this.state.message = message;
    this.startTime = new Date();
    this.lastUpdateTime = this.startTime;
    this.isActive = true;
    this.frameIndex = 0;

    this.startTimer();
    this.emit('started', { total, message });
  }

  /**
   * Update progress
   */
  update(current: number, message?: string): void {
    if (!this.isActive) return;

    const previousCurrent = this.state.current;
    this.state.current = Math.min(current, this.state.total);
    this.state.percentage = (this.state.current / this.state.total) * 100;
    this.state.message = message ?? this.state.message;

    const now = new Date();
    this.state.elapsed = Math.floor((now.getTime() - this.startTime.getTime()) / 1000);

    // Calculate ETA and rate
    if (this.state.current > 0 && this.state.current !== previousCurrent) {
      const progress = this.state.current / this.state.total;
      const elapsedMs = now.getTime() - this.startTime.getTime();
      this.state.rate = this.state.current / (elapsedMs / 1000);
      
      if (progress > 0) {
        const remainingWork = this.state.total - this.state.current;
        this.state.eta = Math.ceil(remainingWork / this.state.rate!);
      }
    }

    this.lastUpdateTime = now;
    this.checkMilestones();
    this.emit('progress', { ...this.state });
  }

  /**
   * Increment progress by specified amount
   */
  increment(amount: number = 1, message?: string): void {
    this.update(this.state.current + amount, message);
  }

  /**
   * Set current phase of operation
   */
  setPhase(phase: string, message?: string): void {
    this.state.phase = phase;
    if (message) {
      this.state.message = message;
    }
    this.emit('phase-changed', { phase, message });
  }

  /**
   * Add milestone markers
   */
  addMilestone(name: string, value: number): void {
    this.milestones.push({
      name,
      value,
      completed: false
    });
    
    // Sort milestones by value
    this.milestones.sort((a, b) => a.value - b.value);
  }

  /**
   * Add multiple milestones at once
   */
  addMilestones(milestones: { name: string; value: number }[]): void {
    milestones.forEach(m => this.addMilestone(m.name, m.value));
  }

  /**
   * Complete progress tracking
   */
  complete(message?: string): void {
    if (!this.isActive) return;

    this.state.current = this.state.total;
    this.state.percentage = 100;
    this.state.message = message ?? 'Complete';
    
    const now = new Date();
    this.state.elapsed = Math.floor((now.getTime() - this.startTime.getTime()) / 1000);
    this.state.eta = 0;

    this.isActive = false;
    this.stopTimer();

    this.emit('completed', { ...this.state });
  }

  /**
   * Stop progress tracking
   */
  stop(message?: string): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.stopTimer();
    this.state.message = message ?? 'Stopped';

    this.emit('stopped', { ...this.state });
  }

  /**
   * Get current progress state
   */
  getState(): ProgressState {
    return { ...this.state };
  }

  /**
   * Get completed milestones
   */
  getCompletedMilestones(): Milestone[] {
    return this.milestones.filter(m => m.completed);
  }

  /**
   * Get next upcoming milestone
   */
  getNextMilestone(): Milestone | undefined {
    return this.milestones.find(m => !m.completed && m.value > this.state.current);
  }

  /**
   * Render current progress as string
   */
  render(): string {
    if (!this.isActive) {
      return this.state.message ?? 'Inactive';
    }

    switch (this.config.type) {
      case 'spinner':
        return this.renderSpinner();
      case 'bar':
        return this.renderProgressBar();
      case 'dots':
        return this.renderDots();
      default:
        return this.renderSpinner();
    }
  }

  /**
   * Get elapsed time in seconds
   */
  getElapsed(): number {
    if (!this.isActive) return this.state.elapsed;
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  /**
   * Check if tracking is active
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Reset progress tracker
   */
  reset(): void {
    this.stop();
    this.state = {
      current: 0,
      total: 100,
      percentage: 0,
      elapsed: 0
    };
    this.milestones = [];
    this.completedMilestones.clear();
    this.frameIndex = 0;
  }

  private startTimer(): void {
    if (this.timer) return;

    this.timer = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.getFrameCount();
      this.emit('tick', this.render());
    }, this.config.refreshRate);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private renderSpinner(): string {
    const spinner = this.config.spinner!;
    const frame = spinner.frames[this.frameIndex % spinner.frames.length];
    
    let output = frame;
    
    if (this.state.message) {
      output += ` ${this.state.message}`;
    }

    if (this.state.phase) {
      output += ` [${this.state.phase}]`;
    }

    if (this.config.showPercentage && this.state.total > 0) {
      output += ` ${this.state.percentage.toFixed(1)}%`;
    }

    if (this.config.showElapsed) {
      output += ` (${this.formatTime(this.getElapsed())})`;
    }

    if (this.config.showETA && this.state.eta) {
      output += ` ETA: ${this.formatTime(this.state.eta)}`;
    }

    return output;
  }

  private renderProgressBar(): string {
    const { bar } = this.config;
    const completed = Math.floor((this.state.percentage / 100) * this.config.width);
    const remaining = this.config.width - completed;

    let barString = '';
    barString += bar!.complete.repeat(completed);
    
    if (bar!.head && completed < this.config.width) {
      barString += bar!.head;
      barString += bar!.incomplete.repeat(Math.max(0, remaining - 1));
    } else {
      barString += bar!.incomplete.repeat(remaining);
    }

    return bar!.format
      .replace('{bar}', barString)
      .replace('{percentage}', this.state.percentage.toFixed(1))
      .replace('{current}', this.state.current.toString())
      .replace('{total}', this.state.total.toString())
      .replace('{elapsed}', this.formatTime(this.getElapsed()))
      .replace('{eta}', this.state.eta ? this.formatTime(this.state.eta) : 'N/A')
      .replace('{rate}', this.state.rate ? this.state.rate.toFixed(2) : 'N/A')
      .replace('{message}', this.state.message ?? '')
      .replace('{phase}', this.state.phase ?? '');
  }

  private renderDots(): string {
    const dots = '.'.repeat((this.frameIndex % 4) + 1);
    let output = `Processing${dots}`;
    
    if (this.state.message) {
      output += ` ${this.state.message}`;
    }

    return output;
  }

  private getFrameCount(): number {
    switch (this.config.type) {
      case 'spinner':
        return this.config.spinner!.frames.length;
      case 'dots':
        return 4;
      default:
        return 1;
    }
  }

  private checkMilestones(): void {
    this.milestones.forEach(milestone => {
      if (!milestone.completed && this.state.current >= milestone.value) {
        milestone.completed = true;
        milestone.timestamp = new Date();
        this.completedMilestones.add(milestone.name);
        this.emit('milestone-reached', milestone);
      }
    });
  }

  private formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}m ${secs}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${mins}m`;
    }
  }
}