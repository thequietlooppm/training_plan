/** Navigation state that survives the Prev/Next `replace`s of a deep-linked sheet. */
export interface DaySheetLocationState {
  deepLink?: boolean;
}

export function isDeepLinkState(state: unknown): boolean {
  return typeof state === "object" && state !== null && "deepLink" in state && state.deepLink === true;
}
