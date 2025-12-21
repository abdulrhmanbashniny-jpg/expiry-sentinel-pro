export type ItemStatus = 'active' | 'expired' | 'archived';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'skipped';
export type AppRole = 'admin' | 'hr_user';

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
