# n8n Integration Documentation

## Overview

This document provides comprehensive documentation for integrating with the Expiry Reminder System via n8n workflows.

> **📢 ملاحظة Multi-Tenant**: منذ الإصدار 3.0، النظام يدعم شركات متعددة. كل شركة لها تكاملات مستقلة في جدول `tenant_integrations`. راجع [دليل Multi-Tenant](./docs/MULTI_TENANT.md) للتفاصيل.

---

## Authentication

All endpoints require authentication using the `x-internal-key` header (for n8n workflows) or standard Supabase JWT authentication.

### Headers Required

```
Authorization: Bearer <SUPABASE_ANON_KEY>
x-internal-key: <N8N_INTERNAL_KEY>  // For n8n workflows
Content-Type: application/json
```

### Environment Variables Needed in n8n

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | `https://aazshokdhlodzaafrifh.supabase.co` |
| `SUPABASE_ANON_KEY` | Your Supabase anonymous key |
| `N8N_INTERNAL_KEY` | Shared secret key for n8n authentication |

---

## 🏢 Multi-Tenant Integration Notes

### Per-Tenant API Keys

Each tenant has its own integration settings stored in `tenant_integrations`:

```sql
SELECT config FROM tenant_integrations 
WHERE tenant_id = 'your-tenant-uuid' 
AND integration_key = 'n8n';
```

### Tenant Context in Edge Functions

Edge functions now receive `tenant_id` context and fetch the appropriate API keys:

```typescript
// Edge function example
const tenantConfig = await supabase
  .from('tenant_integrations')
  .select('config')
  .eq('tenant_id', item.tenant_id)
  .eq('integration_key', 'telegram')
  .single();

const botToken = tenantConfig.data?.config?.bot_token;
```

### Important: Data Isolation

- All API calls return only data for the authenticated user's tenant
- `tenant_id` is automatically enforced via RLS policies
- System Admin can access all tenants for administrative purposes

---

## Edge Functions Endpoints

### Base URL
```
https://aazshokdhlodzaafrifh.supabase.co/functions/v1
```

---

## 1. Get Due Items

Retrieves items that are due for reminder notifications.

### Endpoint
```
POST /get-due-items
```

### Request Body
```json
{
  "days_before": 7
}
```

### Response
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Document Title",
      "ref_number": "REF-001",
      "expiry_date": "2024-01-15",
      "expiry_time": "14:00",
      "category_id": "uuid",
      "responsible_person": "John Doe",
      "owner_department": "HR",
      "notes": "Additional notes",
      "status": "active",
      "recipients": [
        {
          "id": "uuid",
          "name": "Recipient Name",
          "whatsapp_number": "+966500000000",
          "telegram_id": "123456789"
        }
      ]
    }
  ]
}
```

### n8n HTTP Request Node Configuration
```json
{
  "method": "POST",
  "url": "={{ $env.SUPABASE_URL }}/functions/v1/get-due-items",
  "headers": {
    "Authorization": "Bearer {{ $env.SUPABASE_ANON_KEY }}",
    "x-internal-key": "={{ $env.N8N_INTERNAL_KEY }}",
    "Content-Type": "application/json"
  },
  "body": {
    "days_before": 7
  }
}
```

---

## 2. Get Item Details

Retrieves detailed information about a specific item.

### Endpoint
```
POST /get-item-details
```

### Request Body
```json
{
  "item_id": "uuid"
}
```

### Response
```json
{
  "item": {
    "id": "uuid",
    "title": "Document Title",
    "ref_number": "REF-001",
    "expiry_date": "2024-01-15",
    "expiry_time": "14:00",
    "category": {
      "id": "uuid",
      "name": "Category Name",
      "code": "CAT"
    },
    "responsible_person": "John Doe",
    "owner_department": "HR",
    "notes": "Additional notes",
    "status": "active",
    "recipients": [...]
  }
}
```

---

## 3. Search Items

Search for items by reference number or title.

### Endpoint
```
POST /search-items
```

### Request Body
```json
{
  "query": "REF-001"
}
```

### Response
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Document Title",
      "ref_number": "REF-001",
      "expiry_date": "2024-01-15",
      "status": "active"
    }
  ]
}
```

---

## 4. Get Recipient by Telegram ID

Retrieves recipient information using their Telegram ID.

### Endpoint
```
POST /get-recipient-telegram
```

### Request Body
```json
{
  "telegram_id": "123456789"
}
```

### Response
```json
{
  "recipient": {
    "id": "uuid",
    "name": "Recipient Name",
    "whatsapp_number": "+966500000000",
    "telegram_id": "123456789",
    "is_active": true
  }
}
```

---

## 5. Get Recipient by ID

Retrieves recipient information using their database ID.

### Endpoint
```
POST /get-recipient-by-id
```

### Request Body
```json
{
  "recipient_id": "uuid"
}
```

### Response
```json
{
  "recipient": {
    "id": "uuid",
    "name": "Recipient Name",
    "whatsapp_number": "+966500000000",
    "telegram_id": "123456789",
    "is_active": true
  }
}
```

---

## 6. Prepare Message

Prepares a notification message with item details.

### Endpoint
```
POST /prepare-message
```

### Request Body
```json
{
  "item_id": "uuid",
  "recipient_id": "uuid",
  "days_until_expiry": 7,
  "language": "ar"
}
```

### Response
```json
{
  "message": "📋 تذكير: المستند 'عقد العمل' (REF-001) سينتهي خلال 7 أيام...",
  "recipient": {
    "name": "Recipient Name",
    "whatsapp_number": "+966500000000",
    "telegram_id": "123456789"
  }
}
```

---

## 7. Get Message Template

Retrieves the message template for notifications.

### Endpoint
```
POST /get-message-template
```

### Request Body
```json
{
  "template_type": "reminder",
  "language": "ar"
}
```

### Response
```json
{
  "template": "📋 تذكير: {{title}} ({{ref_number}}) سينتهي خلال {{days}} أيام..."
}
```

---

## 8. Send Notification

Logs a notification in the system.

### Endpoint
```
POST /send-notification
```

### Request Body
```json
{
  "item_id": "uuid",
  "recipient_id": "uuid",
  "reminder_day": 7,
  "scheduled_for": "2024-01-08T09:00:00Z",
  "status": "sent",
  "provider_message_id": "telegram_msg_123"
}
```

### Response
```json
{
  "success": true,
  "notification_id": "uuid"
}
```

---

## 9. Send Telegram Message

Sends a message via Telegram.

### Endpoint
```
POST /send-telegram
```

### Request Body
```json
{
  "chat_id": "123456789",
  "message": "Your notification message here"
}
```

### Response
```json
{
  "success": true,
  "message_id": 12345
}
```

---

## 10. Telegram Webhook

Receives incoming Telegram messages (for bot interactions).

### Endpoint
```
POST /telegram-webhook
```

### Request Body (from Telegram)
```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 1,
    "from": {
      "id": 123456789,
      "first_name": "User",
      "username": "username"
    },
    "chat": {
      "id": 123456789,
      "type": "private"
    },
    "text": "/start"
  }
}
```

---

## 11. Test WhatsApp

Tests WhatsApp integration.

### Endpoint
```
POST /test-whatsapp
```

### Request Body
```json
{
  "phone_number": "+966500000000",
  "message": "Test message"
}
```

### Response
```json
{
  "success": true,
  "message": "Test message sent successfully"
}
```

---

## 12. Log Conversation

Logs AI chatbot conversations.

### Endpoint
```
POST /log-conversation
```

### Request Body
```json
{
  "phone": "+966500000000",
  "ref_number": "REF-001",
  "user_message": "ما هي تفاصيل هذا المستند؟",
  "ai_response": "المستند عقد العمل سينتهي في...",
  "timestamp": "2024-01-08T09:00:00Z"
}
```

### Response
```json
{
  "success": true,
  "log_id": "uuid"
}
```

---

## n8n Workflow Examples

### Daily Reminder Workflow

```
1. Schedule Trigger (Daily at 9:00 AM)
   ↓
2. HTTP Request: GET /get-due-items (days_before: 7)
   ↓
3. Loop: For each item
   ↓
4. Loop: For each recipient
   ↓
5. HTTP Request: POST /prepare-message
   ↓
6. IF: recipient.telegram_id exists
   ├─ Yes → HTTP Request: POST /send-telegram
   └─ No → HTTP Request: POST /test-whatsapp
   ↓
7. HTTP Request: POST /send-notification (log the notification)
```

### AI Chatbot Workflow (Telegram)

```
1. Webhook: Receive Telegram message
   ↓
2. HTTP Request: POST /get-recipient-telegram
   ↓
3. IF: User asking about specific document
   ├─ Yes → HTTP Request: POST /search-items
   │        ↓
   │        HTTP Request: POST /get-item-details
   └─ No → Continue
   ↓
4. AI Agent: Process query with context
   ↓
5. HTTP Request: POST /send-telegram (send response)
   ↓
6. HTTP Request: POST /log-conversation
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message description",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Missing or invalid authentication |
| `INVALID_REQUEST` | Missing required parameters |
| `NOT_FOUND` | Resource not found |
| `INTERNAL_ERROR` | Server-side error |

---

## Rate Limits

- Maximum 100 requests per minute per IP
- Maximum 1000 requests per hour per API key

---

## Security Notes

1. **Never expose** the `N8N_INTERNAL_KEY` in client-side code
2. All sensitive operations require the internal key
3. Telegram webhook should be verified using the bot token
4. WhatsApp integration requires Meta Business verification
5. **Multi-Tenant**: Each tenant's API keys are isolated in `tenant_integrations`
6. **RLS**: All data queries are automatically filtered by `tenant_id`

---

## Multi-Tenant Workflow Example

### Sending Notifications for Multiple Tenants

```
1. Cron Trigger (Daily at 7:00 AM Riyadh)
   ↓
2. For each active tenant:
   ↓
3. Fetch tenant's integration config
   ↓
4. Fetch due items for this tenant
   ↓
5. For each item → For each recipient:
   ├─ Check allow_whatsapp/allow_telegram preferences
   ├─ Use tenant's bot_token/api_key
   └─ Send notification
   ↓
6. Log to notification_log with tenant_id
```

---

## Support

For integration support, contact the system administrator or refer to the main documentation.

---

**Last Updated**: January 2026
**Version**: 3.0.0 (Multi-Tenant Ready)
