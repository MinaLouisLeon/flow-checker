/** Version of the `.flow-checker/*.json` file formats. Bump on breaking changes. */
export const MODEL_VERSION = 5

/** Name of the published npm package. */
export const PACKAGE_NAME = '@integr8-media/flow-checker'

/** Name of the command users run. */
export const CLI_NAME = 'flow-checker'

export const DEFAULT_PORTS = {
  dashboard: 4400,
  app: 3000,
} as const
