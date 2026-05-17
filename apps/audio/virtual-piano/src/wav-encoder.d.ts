declare module 'wav-encoder' {
  export async function encode(options: {
    sampleRate: number;
    channelData: Float32Array[];
    numChannels: number;
    bitsPerSample: number;
  }): Promise<Uint8Array>;
}
