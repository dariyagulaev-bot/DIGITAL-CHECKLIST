import { describe, expect, it } from 'vitest';
import { canApprove, canPerform, isAdmin, isApprover, isPerformer } from './rbac';
import { RoleName, type UserWithRoles } from '@/types';

function user(roles: RoleName[]): UserWithRoles {
  return {
    id: '1',
    username: 'u',
    full_name: 'u',
    password_hash: 'x',
    active: true,
    created_at: '',
    roles,
  };
}

describe('rbac', () => {
  it('recognizes each role', () => {
    expect(isPerformer(user([RoleName.PERFORMER]))).toBe(true);
    expect(isApprover(user([RoleName.APPROVER]))).toBe(true);
    expect(isAdmin(user([RoleName.ADMIN]))).toBe(true);
  });

  it('admin can both perform and approve', () => {
    const admin = user([RoleName.ADMIN]);
    expect(canPerform(admin)).toBe(true);
    expect(canApprove(admin)).toBe(true);
  });

  it('null user has no permissions', () => {
    expect(canPerform(null)).toBe(false);
    expect(canApprove(null)).toBe(false);
  });

  it('supports multiple roles on one user', () => {
    const both = user([RoleName.PERFORMER, RoleName.APPROVER]);
    expect(canPerform(both)).toBe(true);
    expect(canApprove(both)).toBe(true);
    expect(isAdmin(both)).toBe(false);
  });
});
