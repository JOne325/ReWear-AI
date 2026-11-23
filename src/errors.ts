export function friendlyError(cause: unknown, fallback: string) {
  if (!navigator.onLine || cause instanceof TypeError) {
    return 'No internet. Your closet still works offline; try again when you are connected.'
  }
  if (cause instanceof Error && !(cause instanceof SyntaxError) && cause.message) return cause.message
  return fallback
}
