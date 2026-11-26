import type { GameEvent } from './types';

type EventType = GameEvent['type'];
type EventPayload<K extends EventType> = Extract<GameEvent, { type: K }>['payload'];
type Listener<K extends EventType> = (payload: EventPayload<K>) => void;
type GenericListener = (payload: never) => void;

/**
 * Typed pub/sub event bus decoupled from simulation state.
 * Subscribers must never mutate simulation state (rule.md §2.9).
 */
export class EventBus {
  private listeners = new Map<EventType, Set<GenericListener>>();

  on<K extends EventType>(type: K, listener: Listener<K>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    const wrapped = listener as GenericListener;
    set.add(wrapped);
    return () => {
      set?.delete(wrapped);
    };
  }

  emit<K extends EventType>(type: K, payload: EventPayload<K>): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const listener of set) {
      (listener as Listener<K>)(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
