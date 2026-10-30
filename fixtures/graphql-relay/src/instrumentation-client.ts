// flow-checker: captures requests while you test the app. It does nothing unless the app
// was started by `flow-checker`, and nothing in production builds.
import { installClientRuntime } from '@integr8-media/flow-checker/runtime/client'

installClientRuntime(process.env.NEXT_PUBLIC_FLOW_CHECKER)
