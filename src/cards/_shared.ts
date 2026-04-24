export function formatLoading(title: string): string {
  return `${title}\n\nLoading...`
}

export function formatError(title: string, error: string): string {
  return `${title}\n\n! ${error.slice(0, 80)}`
}
