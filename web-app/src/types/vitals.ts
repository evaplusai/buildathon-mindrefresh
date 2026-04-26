export interface VitalsFrame {
  ts: number;
  breathBpm?: number;
  hrBpm?: number;
  presence: boolean;
  motionBandPower: number;
  source: 'live' | 'recorded';
}

export type Unsubscribe = () => void;

export interface SensingAPI {
  subscribe(cb: (v: VitalsFrame) => void): Unsubscribe;
  start(opts?: { source?: 'live' | 'recorded' }): void;
  stop(): void;
}
