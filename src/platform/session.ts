import type { Session } from '../game/core/types';

export interface SessionProvider {
  getSession(): Session;
}

class MockSessionProvider implements SessionProvider {
  private readonly session: Session = {
    userId: 'guest-local',
    displayName: 'Guest Haunt',
  };

  getSession(): Session {
    return this.session;
  }
}

const activeProvider: SessionProvider = new MockSessionProvider();

/**
 * Single authorized entry point for identity (architecture.md §9, S-11).
 * Real auth replaces MockSessionProvider here without touching game modules.
 */
export function getSession(): Session {
  return activeProvider.getSession();
}
