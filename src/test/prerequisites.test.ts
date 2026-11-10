import { describe, it, expect, beforeEach } from 'vitest';
import {
  addPrerequisite,
  removePrerequisite,
  setPrerequisites,
  listPrerequisites,
  prerequisiteRankIds,
  transitivePrerequisites,
  buildPrereqGraph,
  wouldCreateCycle,
  PREREQ_CYCLE_ERROR,
  PREREQ_SELF_ERROR,
} from '@/services/prerequisites';
import { resetDb } from '@/test/helpers';
import type { SystemRankPrerequisite } from '@/types';

const SYS = 'sys-1';
const A = 'rank-a';
const B = 'rank-b';
const D = 'rank-d';
const actor = { id: 'admin', full_name: 'מנהל' };

const edge = (rank: string, prereq: string): SystemRankPrerequisite => ({
  id: `${rank}->${prereq}`,
  system_id: SYS,
  rank_id: rank,
  prerequisite_rank_id: prereq,
  created_at: '',
});

describe('prerequisite graph (pure)', () => {
  it('detects a direct cycle', () => {
    const g = buildPrereqGraph([edge(B, A)]); // B requires A
    // Adding A requires B would close A↔B.
    expect(wouldCreateCycle(g, A, B)).toBe(true);
    // A new unrelated edge is fine.
    expect(wouldCreateCycle(g, D, A)).toBe(false);
  });

  it('detects a transitive cycle (A→B→D→A)', () => {
    const g = buildPrereqGraph([edge(B, A), edge(D, B)]); // B req A, D req B
    // Adding A requires D would create A→D→B→A.
    expect(wouldCreateCycle(g, A, D)).toBe(true);
  });

  it('rejects self edges', () => {
    const g = buildPrereqGraph([]);
    expect(wouldCreateCycle(g, A, A)).toBe(true);
  });
});

describe('prerequisites service (persisted, cycle-safe)', () => {
  beforeEach(resetDb);

  it('adds and lists prerequisites for a system', async () => {
    await addPrerequisite(SYS, B, A, actor);
    await addPrerequisite(SYS, D, B, actor);
    expect((await listPrerequisites(SYS)).length).toBe(2);
    expect(await prerequisiteRankIds(SYS, D)).toEqual([B]);
  });

  it('is idempotent on a duplicate add', async () => {
    await addPrerequisite(SYS, B, A, actor);
    await addPrerequisite(SYS, B, A, actor);
    expect((await listPrerequisites(SYS)).length).toBe(1);
  });

  it('rejects a self-prerequisite', async () => {
    await expect(addPrerequisite(SYS, A, A, actor)).rejects.toThrow(PREREQ_SELF_ERROR);
  });

  it('rejects an edge that would create a cycle', async () => {
    await addPrerequisite(SYS, B, A, actor); // B requires A
    await addPrerequisite(SYS, D, B, actor); // D requires B
    // A requires D would close the loop.
    await expect(addPrerequisite(SYS, A, D, actor)).rejects.toThrow(PREREQ_CYCLE_ERROR);
  });

  it('computes transitive prerequisites', async () => {
    await addPrerequisite(SYS, B, A, actor);
    await addPrerequisite(SYS, D, B, actor);
    const t = await transitivePrerequisites(SYS, D);
    expect(t.has(A)).toBe(true);
    expect(t.has(B)).toBe(true);
    expect(t.has(D)).toBe(false);
  });

  it('setPrerequisites replaces the whole set and validates acyclicity', async () => {
    await setPrerequisites(SYS, D, [A, B], actor);
    expect(new Set(await prerequisiteRankIds(SYS, D))).toEqual(new Set([A, B]));
    await setPrerequisites(SYS, D, [A], actor);
    expect(await prerequisiteRankIds(SYS, D)).toEqual([A]);
    // Make B require D, then D requiring B must be rejected.
    await setPrerequisites(SYS, B, [D], actor);
    await expect(setPrerequisites(SYS, D, [B], actor)).rejects.toThrow(PREREQ_CYCLE_ERROR);
  });

  it('removePrerequisite deletes the edge', async () => {
    await addPrerequisite(SYS, B, A, actor);
    await removePrerequisite(SYS, B, A, actor);
    expect(await prerequisiteRankIds(SYS, B)).toEqual([]);
  });
});
