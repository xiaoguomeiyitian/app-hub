declare module 'wav-encoder' {
  export interface WAVEncodeOptions {
    sampleRate: number;
    channelData: Float32Array[];
    numChannels: number;
    bitsPerSample: number;
  }
  export function encode(options: WAVEncodeOptions): Uint8Array;
}
