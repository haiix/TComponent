const PREFIX = '[TComponent] ';

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
    console.warn(`${PREFIX}${message}`);
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

/**
 * Throws an error with the configured prefix.
 *
 * @param message - The error message.
 * @param ErrorClass - The error class to throw (defaults to `Error`).
 */
export function throwError(
  message: string,
  ErrorClass: new (msg: string) => Error = Error,
): never {
  throw new ErrorClass(`${PREFIX}${message}`);
}

export function truncateForError(value: string, maxLength = 80): string {
  const singleLine = value.replace(/\s+/g, ' ').trim();
  return singleLine.length > maxLength
    ? `${singleLine.slice(0, maxLength)}...`
    : singleLine;
}
