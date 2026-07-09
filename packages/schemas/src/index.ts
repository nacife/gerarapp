export * from './interactions/envelope';
export * from './interactions/quiz';
export * from './interactions/flashcard';
export * from './interactions/cloze';
export * from './interactions/dragdrop';
export * from './interactions/timeline';
export * from './interactions/hotspot';
export * from './interactions/scenario';
export * from './interactions/audio';
export * from './interactions/mindmap';
export * from './interactions/registry';
export * from './interactions/fixtures';
export * from './interactions/grading';
export * from './content-map';
export * from './manifest';
export * from './inpi-metadata';
export * from './webhooks';
// crypto re-exportado apenas para Node.js. NÃO importe no browser.
// API/worker server-side: import { ... } from '@eduforge/schemas/crypto'
export * from './crypto';
