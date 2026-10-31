// Key constants (M24): a string enum, an `as const` object and a plain string, read as static
// segments wherever they are imported.
export enum QueryKey {
  Settings = 'settings',
}

export const SCOPES = { users: 'users' } as const

export const STATS = 'stats'
