// A name built at run time: the scan can't tell which variable it is.
export function flag(name: string): boolean {
  return process.env[`FEATURE_${name.toUpperCase()}`] === 'on'
}
