import { describe, it, expect } from 'vitest';
import {
  computeSystemCompetency,
  isActiveStatus,
  effectiveStatusLabel,
} from '@/services/competency';
import type { Rank, RankCertification, SystemRankPrerequisite } from '@/types';

const NOW = '2026-01-01';
const FUTURE = '2027-01-01'; // valid
const PAST = '2025-01-01'; // expired
const SOON = '2026-02-01'; // within 3-month renewal window → needs_renewal

const ranks: Pick<Rank, 'id' | 'sort_order'>[] = [
  { id: 'A', sort_order: 0 },
  { id: 'B', sort_order: 1 },
  { id: 'D', sort_order: 2 },
];

const rc = (rank: string, expires: string): Pick<RankCertification, 'rank_id' | 'expires_at'> => ({
  rank_id: rank,
  expires_at: expires,
});

const edge = (rank: string, prereq: string): SystemRankPrerequisite => ({
  id: `${rank}->${prereq}`,
  system_id: 's',
  rank_id: rank,
  prerequisite_rank_id: prereq,
  created_at: '',
});

describe('effective competency (pure engine)', () => {
  it('no certification → every rank is none', () => {
    const { effective } = computeSystemCompetency({ ranksAsc: ranks, prereqEdges: [], now: NOW });
    expect(effective.get('A')).toBe('none');
    expect(effective.get('D')).toBe('none');
  });

  it('legacy max-rank covers all ranks below it', () => {
    const { effective } = computeSystemCompetency({
      ranksAsc: ranks,
      legacy: { max_rank_id: 'B', expires_at: FUTURE },
      prereqEdges: [],
      now: NOW,
    });
    expect(effective.get('A')).toBe('valid');
    expect(effective.get('B')).toBe('valid');
    expect(effective.get('D')).toBe('none'); // above max
  });

  it('expired legacy cert → covered ranks are expired', () => {
    const { effective } = computeSystemCompetency({
      ranksAsc: ranks,
      legacy: { max_rank_id: 'B', expires_at: PAST },
      prereqEdges: [],
      now: NOW,
    });
    expect(effective.get('A')).toBe('expired');
    expect(effective.get('B')).toBe('expired');
  });

  it('per-rank cert overrides the legacy window for that rank', () => {
    const { effective } = computeSystemCompetency({
      ranksAsc: ranks,
      legacy: { max_rank_id: 'D', expires_at: FUTURE },
      rankCerts: [rc('D', PAST)], // D specifically expired
      prereqEdges: [],
      now: NOW,
    });
    expect(effective.get('A')).toBe('valid');
    expect(effective.get('D')).toBe('expired');
  });

  it('a higher rank is inactive while its prerequisite is expired, and recovers when renewed', () => {
    // D requires B. D itself valid, but B expired → D inactive_prereq.
    const lapsed = computeSystemCompetency({
      ranksAsc: ranks,
      rankCerts: [rc('A', FUTURE), rc('B', PAST), rc('D', FUTURE)],
      prereqEdges: [edge('D', 'B'), edge('B', 'A')],
      now: NOW,
    }).effective;
    expect(lapsed.get('B')).toBe('expired');
    expect(lapsed.get('D')).toBe('inactive_prereq');

    // Renew B → D auto-recovers (no record was deleted).
    const recovered = computeSystemCompetency({
      ranksAsc: ranks,
      rankCerts: [rc('A', FUTURE), rc('B', FUTURE), rc('D', FUTURE)],
      prereqEdges: [edge('D', 'B'), edge('B', 'A')],
      now: NOW,
    }).effective;
    expect(recovered.get('B')).toBe('valid');
    expect(recovered.get('D')).toBe('valid');
  });

  it('needs_renewal still satisfies a prerequisite (it is active)', () => {
    const { effective } = computeSystemCompetency({
      ranksAsc: ranks,
      rankCerts: [rc('B', SOON), rc('D', FUTURE)],
      prereqEdges: [edge('D', 'B')],
      now: NOW,
    });
    expect(effective.get('B')).toBe('needs_renewal');
    expect(isActiveStatus(effective.get('B')!)).toBe(true);
    expect(effective.get('D')).toBe('valid');
  });

  it('a chain cascades: A expired makes B and D inactive', () => {
    const { effective } = computeSystemCompetency({
      ranksAsc: ranks,
      rankCerts: [rc('A', PAST), rc('B', FUTURE), rc('D', FUTURE)],
      prereqEdges: [edge('B', 'A'), edge('D', 'B')],
      now: NOW,
    });
    expect(effective.get('A')).toBe('expired');
    expect(effective.get('B')).toBe('inactive_prereq');
    expect(effective.get('D')).toBe('inactive_prereq');
  });

  it('labels match the spec wording', () => {
    expect(effectiveStatusLabel('valid')).toBe('מוסמך ופעיל');
    expect(effectiveStatusLabel('needs_renewal')).toBe('מוסמך — עומד לפוג');
    expect(effectiveStatusLabel('expired')).toBe('פג תוקף');
    expect(effectiveStatusLabel('inactive_prereq')).toBe('לא פעיל עקב פגות תנאי קדם');
    expect(effectiveStatusLabel('none')).toBe('לא הוסמך');
  });
});
