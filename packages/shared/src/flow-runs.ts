// Flow recording (M7, docs/PLAN.md 8): inferred flows checked against what users actually did.
// The tool server matches each session timeline (interactions, navigation, captured requests)
// against the inferred flows. A flow walked end to end is confirmed. A walk that goes somewhere
// the code did not predict is kept as a recorded variant.
import { z } from 'zod'

/** One step of what really happened, in order. */
export const RecordedStepSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('interaction'),
    at: z.string(),
    /** DOM event type: `submit`, `click`, ... */
    type: z.string(),
    /** Nearest React component of the target. */
    component: z.string().optional(),
    target: z.string(),
    routeId: z.string().optional(),
  }),
  z.object({
    kind: z.literal('request'),
    at: z.string(),
    captureId: z.string(),
    siteId: z.string().optional(),
    method: z.string(),
    /** Path only (no query, which can carry ids or secrets). */
    path: z.string(),
    status: z.number().optional(),
  }),
  z.object({
    kind: z.literal('navigate'),
    at: z.string(),
    how: z.enum(['load', 'push', 'replace', 'pop']),
    path: z.string(),
    routeId: z.string().optional(),
  }),
])
export type RecordedStep = z.infer<typeof RecordedStepSchema>

/** A flow seen in a session, or one you recorded by name. */
export const RecordedFlowSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** `variant`: an inferred flow that went somewhere else. `named`: you recorded it in the dashboard. */
  kind: z.enum(['variant', 'named']),
  /** The inferred flow it follows (fully or up to `divergedAt`). */
  flowId: z.string().optional(),
  /** Index in the inferred flow's steps where the recording went elsewhere. */
  divergedAt: z.number().int().optional(),
  sessionId: z.string().optional(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  steps: z.array(RecordedStepSchema),
})
export type RecordedFlow = z.infer<typeof RecordedFlowSchema>

export interface FlowRun {
  sessionId: string
  startedAt: string
  /** How many of the flow's steps happened, in order. */
  steps: number
  complete: boolean
}

/** Runtime state of one inferred flow. */
export interface FlowStatus {
  /**
   * `confirmed`: walked end to end at least once. `partial`: started but stopped early.
   * `unconfirmed`: not seen yet.
   */
  status: 'confirmed' | 'partial' | 'unconfirmed'
  /** `both` once confirmed by a recording, `inferred` until then. */
  source: 'inferred' | 'both'
  runs: number
  /** The run that got furthest (the latest one on ties). */
  best?: FlowRun
  /** Per branch (same order as `Flow.branches`): seen in a session. Unseen ones stay unconfirmed. */
  branches: boolean[]
}

/** `GET /api/flows`. */
export interface FlowsSummary {
  flows: Record<string, FlowStatus>
  recorded: RecordedFlow[]
  /** The named recording in progress, if any. */
  recording?: { id: string; name: string; startedAt: string }
  /** Page guards a captured session hit, by route id (M31). */
  guards?: Record<string, string[]>
}
