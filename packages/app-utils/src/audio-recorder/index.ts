export interface AudioRecorderOptions {
  sampleRate?: number;
  channels?: number;
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  constructor(_ctx: AudioContext, _options: AudioRecorderOptions = {}) {
    // Options may be used in future extensions
  }

  async start(): Promise<void> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('getUserMedia not supported');
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.stream = stream;
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(stream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start();
  }

  async stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('Not started'));
        return;
      }
      this.mediaRecorder.onstop = async () => {
        const blob = new Blob(this.chunks, { type: 'audio/wav' });
        this.stream?.getTracks().forEach(t => t.stop());
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }

  async exportWav(blob: Blob): Promise<Uint8Array> {
    return new Uint8Array(await blob.arrayBuffer());
  }
}

import { encode } from 'wav-encoder';

export async function encodeWAV(samples: Float32Array, sampleRate: number = 44100, numChannels: number = 1): Promise<Uint8Array> {
  return encode({
    sampleRate,
    channelData: [samples],
    numChannels,
    bitsPerSample: 16,
  });
}
