const warnedTypes = new Set<string>();

/**
 * Logs a warning to the console only once per given type.
 * Useful for preventing console spam when components are rendered in loops.
 *
 * @param type - A unique string identifier for the warning type.
 * @param message - The warning message to display.
 */
export function warnOnce(type: string, message: string): void {
  if (!warnedTypes.has(type)) {
    /* eslint-disable no-console */
    console.warn(`[TComponent] ${message}`);
    /* eslint-enable no-console */
    warnedTypes.add(type);
  }
}

/**
 * Clears the warning history. Primarily used for testing purposes.
 */
export function resetWarnings(): void {
  warnedTypes.clear();
}
