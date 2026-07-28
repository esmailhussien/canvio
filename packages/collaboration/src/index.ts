export * from './yjsHelpers';

export interface UserPresence {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  cursor?: { x: number; y: number };
  selectedNodeIds?: string[];
}
