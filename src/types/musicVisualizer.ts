// src/types/musicVisualizer.ts

export interface MusicVisualizerProps {
  isActive: boolean;
  analyser?: AnalyserNode;
  audioContext?: AudioContext;
  opacity?: number;
  colorStart?: string;
  colorEnd?: string;
  height?: number;
}