import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface NativeAudioStatus {
  ready: boolean;
  playing: boolean;
  positionMs: number;
  durationMs?: number;
}

export interface NativeAudioPlugin {
  setTrack(options: {
    url: string;
    title?: string;
    artist?: string;
    artwork?: string;
    positionMs?: number;
  }): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(options: { positionMs: number }): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<NativeAudioStatus>;
  addListener(eventName: 'ended', listener: () => void): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'stateChange',
    listener: (state: { playing: boolean }) => void,
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

const webFallback = {
  async setTrack() {},
  async play() {},
  async pause() {},
  async seek() {},
  async stop() {},
  async getStatus(): Promise<NativeAudioStatus> {
    return { ready: false, playing: false, positionMs: 0 };
  },
  async addListener() {
    return { remove: async () => {} } as PluginListenerHandle;
  },
  async removeAllListeners() {},
};

/** Native (Media3) player used for background audio on Android. */
export const NativeAudio = registerPlugin<NativeAudioPlugin>('NativeAudio', {
  web: () => webFallback,
});
