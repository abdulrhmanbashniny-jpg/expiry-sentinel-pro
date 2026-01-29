# 🔔 Expiry Sentinel Pro - HR Reminder & Performance Evaluation System

> **Production-Ready Multi-Tenant SaaS Platform for HR Document Management**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-93.1%25-blue)](https://www.typescriptlang.org/)
[![PLpgSQL](https://img.shields.io/badge/PLpgSQL-6.4%25-orange)](https://www.postgresql.org/)

---

## 📋 Overview

**Expiry Sentinel Pro** is a comprehensive multi-tenant SaaS platform designed for HR departments to manage document expiry, employee evaluations, and automated notifications. Built with modern web technologies and enterprise-grade security.

### 🎯 Key Features

- ✅ **Multi-Tenant Architecture** - Complete data isolation between companies
- ✅ **Unified Reminder System** - Smart notifications for contracts, documents, evaluations
- ✅ **Multi-Channel Notifications** - WhatsApp, Telegram, Email, In-App
- ✅ **Smart Contract Management** - Track renewals, expirations, and auto-alerts
- ✅ **Employee Portal** - Self-service requests and approvals
- ✅ **Support Ticket System** - Full ticketing with SLA tracking
- ✅ **Digital Signatures** - Sign documents electronically with legal proof
- ✅ **Comprehensive Audit Log** - Track all operations with timestamps
- ✅ **AI Risk Predictions** - Predictive analytics for document compliance
- ✅ **Feature Toggles** - Enable/disable features per tenant
- ✅ **Row-Level Security (RLS)** - Database-level data isolation

---

## 🏗️ Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Backend** | Supabase (PostgreSQL + Edge Functions) |
| **Real-time** | Supabase Realtime |
| **Storage** | Supabase Storage |
| **Auth** | Supabase Auth + RLS |
| **Deployment** | Lovable.dev |

### Database Schema

#### Core Tables
- `tenants` - Company/organization records
- `profiles` - User profiles with roles and tenant association
- `user_invitations` - Employee invitation system
- `tenant_settings` - Per-tenant configuration
- `tenant_notification_settings` - Notification channel preferences

#### HR & Documents
- `items` - Document/contract tracking
- `item_status_log` - Status change history
- `contracts` - Smart contract management
- `contract_alerts` - Automated contract reminders
- `evaluations` - Employee performance reviews
- `evaluation_cycles` - Review periods

#### Notifications & Reminders
- `reminder_rules` - Automated reminder configurations
- `in_app_notifications` - Internal notifications
- `notification_log` - Notification history

#### Support & Ticketing
- `support_tickets` - Customer support tickets
- `ticket_replies` - Ticket conversation threads
- `service_requests` - Employee service requests

#### Advanced Features
- `document_signatures` - Digital signature records
- `signature_requests` - Signature workflows
- `audit_log` - Complete system audit trail
- `ai_risk_predictions` - AI-powered risk analysis
- `feature_toggles` - Feature flag management

---

## 🚀 Getting Started

### Prerequisites

```bash
Node.js >= 18.0.0
npm >= 9.0.0
Supabase account
```

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/abdulrhmanbashniny-jpg/expiry-sentinel-pro.git
cd expiry-sentinel-pro
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Run database migrations**
```bash
npm run db:migrate
```

5. **Start development server**
```bash
npm run dev
```

---

## 🔐 Multi-Tenant System

### How It Works

| Step | Description |
|------|-------------|
| **1. Create Tenant** | System Admin creates new company from `/tenant-management` |
| **2. Invite Users** | Admin sends invite → User automatically linked to `tenant_id` |
| **3. Data Isolation** | Every query filtered by `tenant_id = get_current_tenant_id()` |
| **4. Independent Integrations** | Each tenant has separate API keys in `tenant_integrations` |
| **5. Change Protection** | Triggers prevent `tenant_id` modification after creation |

### Login Flow

**Super Admin Login:**
- Company Code: `ADMIN`
- Email: Your admin email
- Password: Your password
- Access: All tenants with tenant switcher

**Regular User Login:**
- Company Code: Your company code (e.g., `JPF`, `HOTEL`)
- Email: Your email
- Password: Your password
- Access: Only your company's data

### Security Features

✅ **Row-Level Security (RLS)**
- All sensitive tables have RLS enabled
- Policies enforce `tenant_id` filtering
- `WITH CHECK` prevents cross-tenant data insertion

✅ **Trigger-Based Protection**
- Prevents `tenant_id` changes after record creation
- Immutable tenant association

✅ **Secure Functions**
- `get_invitation_by_token()` - Safe token validation
- `activate_invitation()` - Secure account activation
- `is_feature_enabled()` - Feature flag checks

---

## 📡 Notification System

### Supported Channels

| Channel | Status | Integration |
|---------|--------|-------------|
| 📱 **WhatsApp** | ✅ Active | Twilio API |
| 💬 **Telegram** | ✅ Active | Telegram Bot API |
| 📧 **Email** | ✅ Active | Resend API |
| 🔔 **In-App** | ✅ Active | Supabase Realtime |

### Unified Notification Service

**Edge Function:** `unified-notification`

```typescript
// Usage Example
const { sendNotification } = useNotificationService();

await sendNotification({
  recipientId: 'user-uuid',
  channels: ['whatsapp', 'email', 'in_app'],
  message: 'Your contract expires in 7 days',
  priority: 'high',
  metadata: { itemId: 'item-uuid' }
});
```

### Reminder Rules

- Configure reminders per entity type (contracts, documents, evaluations)
- Set custom reminder intervals (7 days, 14 days, 30 days, etc.)
- Choose notification channels per rule
- Auto-escalation to managers

---

## 🎫 Support Ticket System

Full-featured ticketing with:
- Priority levels (Low, Medium, High, Urgent)
- SLA tracking and breach alerts
- Automatic assignment
- Thread-based conversations
- File attachments
- Status workflow (Open → In Progress → Resolved → Closed)

---

## ✍️ Digital Signature System

- Draw signatures with mouse/touch
- Attach signatures to documents
- Track signature requests and status
- Legal timestamp and proof
- Audit trail for compliance

---

## 📊 Analytics & Reports

- **Reminder Dashboard** - Unified view of all upcoming expirations
- **Compliance Reports** - Track document status per department
- **Performance Metrics** - Evaluation completion rates
- **Ticket Analytics** - Support team performance and SLA compliance
- **AI Risk Predictions** - Predictive analytics for high-risk items

---

## 🔧 Configuration

### Feature Toggles

Enable/disable features per tenant from `/settings`:

```sql
-- Example: Enable contracts feature for tenant
INSERT INTO feature_toggles (tenant_id, feature_key, enabled)
VALUES ('tenant-uuid', 'contracts', true);
```

### Notification Settings

```sql
-- Configure channels per tenant
INSERT INTO tenant_notification_settings (tenant_id, channel, enabled)
VALUES 
  ('tenant-uuid', 'whatsapp', true),
  ('tenant-uuid', 'email', true);
```

---

## 📁 Project Structure

```
expiry-sentinel-pro/
├── src/
│   ├── components/        # Reusable UI components
│   ├── hooks/            # Custom React hooks
│   │   ├── useTenantQuery.ts      # Auto tenant filtering
│   │   ├── useNotificationService.ts
│   │   └── useFeatureToggles.ts
│   ├── pages/            # Page components
│   │   ├── ReminderDashboard.tsx
│   │   ├── Contracts.tsx
│   │   ├── SupportTickets.tsx
│   │   ├── EmployeePortal.tsx
│   │   └── TenantManagement.tsx
│   ├── contexts/         # React contexts
│   │   └── TenantContext.tsx
│   └── utils/            # Utility functions
├── supabase/
│   ├── functions/        # Edge Functions
│   │   ├── unified-notification/
│   │   └── send-notification/
│   └── migrations/       # Database migrations
├── docs/                 # Documentation
│   ├── MULTI_TENANT.md   # Multi-tenant guide
│   └── API.md            # API documentation
└── README.md
```

---

## 🔒 Security Updates (January 2026)

### ✅ Resolved Issues

| # | Issue | Status | Details |
|---|-------|--------|----------|
| 1 | Account Activation Broken | ✅ Fixed | Secure functions implemented |
| 2 | Security Definer Views | ✅ Fixed | Recreated with `security_invoker = true` |
| 3 | feature_toggles public | ✅ Secured | RLS with tenant isolation |
| 4 | evaluation_data public | ✅ Fixed | Restricted to authenticated only |
| 5 | evaluation_cycles public | ✅ Fixed | Added tenant isolation |
| 6 | departments public | ✅ Fixed | Restricted to tenant scope |
| 7 | templates public | ✅ Fixed | RLS with tenant isolation |
| 8 | Telegram webhook unauth | ✅ Fixed | Secret token verification added |

---

## 📚 Documentation

- [Multi-Tenant Architecture](./docs/MULTI_TENANT.md)
- [Integration Guide](./INTEGRATIONS.md)
- [API Reference](./docs/API.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)

---

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## 📝 License

MIT License - see [LICENSE](./LICENSE) for details

---

## 👨‍💻 Author

**Abdulrhman Bashniny**
- Email: abdulrhman.bashniny@gmail.com
- GitHub: [@abdulrhmanbashniny-jpg](https://github.com/abdulrhmanbashniny-jpg)

---

## 🙏 Acknowledgments

- Built with [Lovable.dev](https://lovable.dev)
- Powered by [Supabase](https://supabase.com)
- UI Components from [shadcn/ui](https://ui.shadcn.com)

---

**Last Updated:** January 29, 2026  
**Version:** 2.0.0  
**Status:** Production Ready ✅
