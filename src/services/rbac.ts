import { RoleName, type UserWithRoles } from '@/types';

/**
 * Role-Based Access Control helpers.
 * IMPORTANT: these checks are enforced in the business/service layer,
 * never relying solely on hidden UI buttons.
 */

export function hasRole(user: UserWithRoles | null, role: RoleName): boolean {
  return !!user && user.roles.includes(role);
}

export function isAdmin(user: UserWithRoles | null): boolean {
  return hasRole(user, RoleName.ADMIN);
}

export function isPerformer(user: UserWithRoles | null): boolean {
  return hasRole(user, RoleName.PERFORMER);
}

export function isApprover(user: UserWithRoles | null): boolean {
  return hasRole(user, RoleName.APPROVER);
}

/** Can this user open/create new inspection forms? */
export function canPerform(user: UserWithRoles | null): boolean {
  return isPerformer(user) || isAdmin(user);
}

/** Can this user act as an approver (subject to per-form self-approval checks)? */
export function canApprove(user: UserWithRoles | null): boolean {
  return isApprover(user) || isAdmin(user);
}

/** Assertion helper used inside services. Throws on failure. */
export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
