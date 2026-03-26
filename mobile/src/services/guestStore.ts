/**
 * Tiny in-memory store that bridges the AuthStack → AppStack gap for guests.
 * GuestSetupScreen writes here before calling continueAsGuest().
 * OccupationIntentScreen / UserProfileScreen read from here to pre-fill fields.
 */

export interface GuestBasicInfo {
  name: string;
  age: string;
  country: string;
}

let pending: GuestBasicInfo | null = null;

export const guestStore = {
  set(info: GuestBasicInfo) { pending = info; },
  get(): GuestBasicInfo | null { return pending; },
  clear() { pending = null; },
};
