export type ItemStatus = 'active' | 'expired' | 'archived';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'skipped';
export type AppRole = 'system_admin' | 'admin' | 'hr_user' | 'supervisor' | 'employee';
export type EscalationStatus = 'none' | 'supervisor' | 'admin';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface TeamMember {
  id: string;
  supervisor_id: string;
  employee_id: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  created_at: string;
}

export interface Recipient {
  id: string;
  name: string;
  whatsapp_number: string;
  telegram_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ReminderRule {
  id: string;
  name: string;
  days_before: number[];
  is_active: boolean;
  created_at: string;
}

export interface Item {
  id: string;
  ref_number: string | null;
  title: string;
  category_id: string | null;
  expiry_date: string;
  expiry_time: string | null;
  owner_department: string | null;
  responsible_person: string | null;
  notes: string | null;
  attachment_url: string | null;
  status: ItemStatus;
  reminder_rule_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  category?: Category;
  reminder_rule?: ReminderRule;
}

export interface ItemRecipient {
  id: string;
  item_id: string;
  recipient_id: string;
  created_at: string;
  recipient?: Recipient;
}

export interface NotificationLog {
  id: string;
  item_id: string;
  recipient_id: string;
  reminder_day: number;
  scheduled_for: string;
  sent_at: string | null;
  status: NotificationStatus;
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
  seen_at: string | null;
  seen_by_user_id: string | null;
  escalated_to_supervisor_at: string | null;
  escalated_to_admin_at: string | null;
  escalation_status: EscalationStatus;
  item?: Item;
  recipient?: Recipient;
}

export interface Setting {
  id: string;
  key: string;
  value: any;
  created_at: string;
  updated_at: string;
}

export interface Integration {
  id: string;
  key: string;
  name: string;
  config: Record<string, any>;
  is_active: boolean;
  last_tested_at: string | null;
  test_result: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface SecuritySettings {
  id: string;
  session_timeout_minutes: number;
  password_min_length: number;
  require_2fa: boolean;
  max_login_attempts: number;
  lockout_duration_minutes: number;
  updated_at: string;
  updated_by: string | null;
}

export interface LoginHistory {
  id: string;
  user_id: string;
  logged_in_at: string;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
}

// Role hierarchy helpers
export const ROLE_HIERARCHY: Record<AppRole, number> = {
  system_admin: 5,
  admin: 4,
  hr_user: 3,
  supervisor: 2,
  employee: 1,
};

export const ROLE_LABELS: Record<AppRole, string> = {
  system_admin: 'مدير النظام',
  admin: 'المدير',
  hr_user: 'موظف HR',
  supervisor: 'المشرف',
  employee: 'الموظف',
};

export function hasRoleOrHigher(userRole: AppRole | null, requiredRole: AppRole): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
