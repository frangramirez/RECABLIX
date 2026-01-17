/**
 * Tipos relacionados con subscripciones y límites de usuarios por studio
 */

/**
 * Roles disponibles para miembros de studio
 */
export type StudioMemberRole = 'owner' | 'admin' | 'collaborator' | 'client';

/**
 * Límites de usuarios por rol en un studio
 * null = ilimitado
 */
export interface SubscriptionLimits {
  max_admins: number | null;
  max_collaborators: number | null;
  max_clients: number | null;
}

/**
 * Uso actual de usuarios por rol en un studio
 */
export interface SubscriptionUsage {
  admins: number;
  collaborators: number;
  clients: number;
}

/**
 * Respuesta de la API de límites de subscripción
 */
export interface SubscriptionLimitsResponse {
  limits: SubscriptionLimits;
  usage: SubscriptionUsage;
}

/**
 * Request para actualizar límites de subscripción (solo superadmin)
 */
export interface UpdateSubscriptionLimitsRequest {
  studio_id: string;
  limits: SubscriptionLimits;
}

/**
 * Request para invitar usuario
 */
export interface InviteUserRequest {
  email: string;
  studio_id?: string;
  role?: StudioMemberRole;
}

/**
 * Respuesta de invitación de usuario
 */
export interface InviteUserResponse {
  success: boolean;
  user_id?: string;
  user_created?: boolean;
  invitation_sent?: boolean;
  studio_member_created?: boolean;
  message?: string;
  error?: string;
  /** Link de invitación de backup (por si el email no llega) */
  invitation_link?: string;
}

/**
 * Error cuando se alcanza el límite de subscripción
 */
export class SubscriptionLimitError extends Error {
  constructor(
    public role: StudioMemberRole,
    public current: number,
    public max: number
  ) {
    super(`Límite alcanzado para rol ${role}: ${current}/${max}`);
    this.name = 'SubscriptionLimitError';
  }
}
