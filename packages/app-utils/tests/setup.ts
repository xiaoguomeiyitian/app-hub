import { indexedDB } from 'fake-indexeddb';

// Provide indexedDB mock for jsdom
globalThis.indexedDB = indexedDB as any;