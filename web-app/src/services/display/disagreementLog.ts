/**
 * disagreementLog — records advisory/sensor state disagreements.
 *
 * Per DDD-06 §"DashboardStateAdvisory" and ADR-016 §"Self-learning loop".
 *
 * Logic:
 *   - If advised === sensor: no-op (no disagreement).
 *   - Otherwise: post to MCP hooks_intelligence_trajectory-step with
 *     kind: 'disagreement'. If MCP unavailable, log to console.info.
 *
 * Ownership: ui-coder (Sprint B Block 3 / Block 4).
 */

import type { DashboardState } from '../../types/display';

export interface DisagreementEvent {
  ts: number;
  advised: DashboardState;
  sensor: DashboardState;
  runId: string;
}

interface McpInterface {
  call(tool: string, params: Record<string, unknown>): Promise<unknown>;
}

function getMcp(): McpInterface | undefined {
  return (typeof globalThis !== 'undefined' &&
    (globalThis as Record<string, unknown>).mcp) as McpInterface | undefined;
}

/**
 * Log a state disagreement between the Reflect agent's advisory state and
 * the sensor-derived state.
 *
 * No-op when advised === sensor (no disagreement to record).
 */
export async function logDisagreement(e: DisagreementEvent): Promise<void> {
  // No disagreement — nothing to record
  if (e.advised === e.sensor) return;

  const mcp = getMcp();

  if (mcp) {
    try {
      await mcp.call('mcp__claude-flow__hooks_intelligence_trajectory-step', {
        sessionId: e.runId,
        step: 'state-disagreement',
        kind: 'disagreement',
        data: {
          ts: e.ts,
          advised: e.advised,
          sensor: e.sensor,
          runId: e.runId,
        },
      });
      return;
    } catch {
      // MCP failed — fall through to console.info
    }
  }

  // MCP unavailable — log locally so the disagreement isn't silently dropped
  console.info('[disagreementLog]', {
    kind: 'disagreement',
    ts: e.ts,
    advised: e.advised,
    sensor: e.sensor,
    runId: e.runId,
  });
}
