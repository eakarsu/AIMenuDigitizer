import { isDeepStrictEqual } from 'node:util';
import pool from '../db/connection';
import { validateTransition } from './menuWorkflow';

type Actor = { tenantId: string; actorId: string; role: string };
type Transition = Actor & { menuRef: string; version: number; to: string; reason: string; correlationId: string; context?: Record<string, unknown> };

export function nextRetryAt(attempt: number, nowMs: number, baseMs = 1000, capMs = 300000): string {
  if (!Number.isInteger(attempt) || attempt < 1 || !Number.isFinite(nowMs)) throw new Error('invalid retry state');
  return new Date(nowMs + Math.min(capMs, baseMs * (2 ** (attempt - 1)))).toISOString();
}

// The tenant predicate and row lock are deliberately in the same query. A caller
// cannot distinguish another tenant's menu from a missing menu.
export async function transitionMenu(input: Transition) {
  for (const field of ['tenantId','actorId','role','menuRef','to','reason','correlationId'] as const) {
    if (!input[field]) throw new Error(`${field} is required`);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const replay = await client.query(
      `SELECT to_status,menu_version,actor_id,reason,evidence FROM menu_workflow_audit WHERE tenant_id=$1 AND menu_ref=$2 AND correlation_id=$3`,
      [input.tenantId, input.menuRef, input.correlationId]
    );
    if (replay.rows[0]) { const prior=replay.rows[0]; if(prior.to_status!==input.to || Number(prior.menu_version)!==input.version || String(prior.actor_id)!==input.actorId || prior.reason!==input.reason || !isDeepStrictEqual(prior.evidence,input.context||{})) throw new Error('correlation id reused with different transition'); await client.query('COMMIT'); return { status: replay.rows[0].to_status, replayed: true }; }
    const current = await client.query(
      `SELECT status,created_by FROM menu_versions WHERE tenant_id=$1 AND menu_ref=$2 AND version=$3 FOR UPDATE`,
      [input.tenantId, input.menuRef, input.version]
    );
    if (!current.rows[0]) throw Object.assign(new Error('menu version not found'), { code: 'NOT_FOUND' });
    validateTransition(current.rows[0].status, input.to, { ...(input.context || {}), actorId: input.actorId, createdBy: current.rows[0].created_by, role: input.role });
    await client.query(
      `UPDATE menu_versions SET status=$1 WHERE tenant_id=$2 AND menu_ref=$3 AND version=$4`,
      [input.to, input.tenantId, input.menuRef, input.version]
    );
    await client.query(
      `INSERT INTO menu_workflow_audit(tenant_id,menu_ref,menu_version,from_status,to_status,actor_id,actor_role,reason,evidence,correlation_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
      [input.tenantId,input.menuRef,input.version,current.rows[0].status,input.to,input.actorId,input.role,input.reason,JSON.stringify(input.context || {}),input.correlationId]
    );
    await client.query('COMMIT');
    return { status: input.to, replayed: false };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function recordPublicationFailure(tenantId: string, publicationId: number, errorCode: string, nowMs: number) {
  if (!tenantId || !Number.isInteger(publicationId) || !errorCode) throw new Error('scoped publication failure required');
  const client=await pool.connect();
  try { await client.query('BEGIN');
    const current=await client.query('SELECT attempts FROM menu_publications WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenantId,publicationId]);
    if(!current.rows[0]) throw Object.assign(new Error('publication not found'),{code:'NOT_FOUND'});
    const attempt=Number(current.rows[0].attempts)+1;
    const result=await client.query(`UPDATE menu_publications SET status='retry',attempts=$1,last_error=$2,next_attempt_at=$3 WHERE tenant_id=$4 AND id=$5 RETURNING id,attempts,next_attempt_at`,[attempt,errorCode.slice(0,160),nextRetryAt(attempt,nowMs),tenantId,publicationId]);
    await client.query('COMMIT'); return result.rows[0];
  } catch(error){await client.query('ROLLBACK');throw error;} finally{client.release();}
}
