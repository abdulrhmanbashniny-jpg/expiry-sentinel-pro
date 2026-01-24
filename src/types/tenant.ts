// Multi-Tenant Types

export interface Tenant {
  id: string;
  name: string;
  name_en: string | null;
  code: string;
  logo_url: string | null;
  domain: string | null;
  settings: Record<string, any>;
  subscription_plan: string;
  max_users: number;
  max_items: number;
  is_active: boolean;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantSettings {
  default_language?: 'ar' | 'en';
  timezone?: string;
  date_format?: string;
  allow_self_registration?: boolean;
  require_approval?: boolean;
  custom_branding?: {
    primary_color?: string;
    secondary_color?: string;
  };
}

export interface TenantIntegration {
  id: string;
  tenant_id: string;
  integration_key: 'telegram' | 'whatsapp' | 'n8n' | 'ai';
  config: Record<string, any>;
  is_active: boolean;
  last_tested_at: string | null;
  test_result: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface TenantIntegrationConfig {
  // Telegram
  bot_token?: string;
  bot_username?: string;
  // WhatsApp
  api_base_url?: string;
  apikey?: string;
  instance_name?: string;
  // n8n
  webhook_url?: string;
  n8n_api_key?: string;
  // AI
  provider?: string;
  model?: string;
  ai_api_key?: string;
}

export interface TenantUsageStats {
  id: string;
  tenant_id: string;
  period_start: string;
  period_end: string;
  users_count: number;
  items_count: number;
  notifications_sent: number;
  ai_calls: number;
  storage_used_mb: number;
  created_at: string;
}

export const SUBSCRIPTION_PLANS = {
  basic: {
    name: 'أساسي',
    name_en: 'Basic',
    max_users: 10,
    max_items: 500,
    features: ['إدارة العناصر', 'تذكيرات البريد'],
  },
  professional: {
    name: 'احترافي',
    name_en: 'Professional',
    max_users: 50,
    max_items: 2000,
    features: ['كل مميزات الأساسي', 'WhatsApp', 'Telegram', 'تقارير'],
  },
  enterprise: {
    name: 'مؤسسات',
    name_en: 'Enterprise',
    max_users: -1, // unlimited
    max_items: -1, // unlimited
    features: ['كل المميزات', 'دعم مخصص', 'API كامل', 'تخصيص العلامة التجارية'],
  },
} as const;

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PLANS;
