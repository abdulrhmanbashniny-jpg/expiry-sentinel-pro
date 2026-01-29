# API Reference

## Base URL

```
https://your-domain.com/api
```

---

## Authentication

All API requests require JWT token in Authorization header:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## Endpoints

### Reminders

#### GET /reminders

Fetch all reminders for current tenant

```javascript
const response = await fetch('/api/reminders', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
const reminders = await response.json();
```

**Response:**
```json
[
  {
    "id": "uuid",
    "item_id": "uuid",
    "days_until_due": 7,
    "status": "pending",
    "created_at": "2026-01-29T14:00:00Z"
  }
]
```

---

#### POST /reminders

Create new reminder rule

```javascript
const response = await fetch('/api/reminders', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    item_id: 'uuid',
    days_before: 7,
    channels: ['whatsapp', 'email', 'in_app']
  })
});
```

---

### Notifications

#### POST /notifications/send

Send unified notification

```javascript
const response = await fetch('/api/notifications/send', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    recipient_id: 'user-uuid',
    channels: ['whatsapp', 'email'],
    message: 'Your contract expires in 7 days',
    priority: 'high',
    metadata: {
      item_id: 'item-uuid'
    }
  })
});
```

**Response:**
```json
{
  "success": true,
  "notification_id": "uuid",
  "channels_sent": ["whatsapp", "email"],
  "timestamp": "2026-01-29T14:00:00Z"
}
```

---

#### GET /notifications

Fetch all notifications for current user

```javascript
const response = await fetch('/api/notifications', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

**Response:**
```json
[
  {
    "id": "uuid",
    "message": "Contract expires in 7 days",
    "read": false,
    "created_at": "2026-01-29T14:00:00Z"
  }
]
```

---

### Items (Documents/Contracts)

#### GET /items

Fetch all items for current tenant

```javascript
const { data: items } = await supabase
  .from('items')
  .select('*');
```

---

#### POST /items

Create new item

```javascript
const { data } = await supabase
  .from('items')
  .insert([
    {
      title: 'Employee Contract',
      expiry_date: '2026-02-15',
      category: 'contract',
      employee_id: 'uuid'
    }
  ]);
```

---

#### PUT /items/:id

Update item

```javascript
const { data } = await supabase
  .from('items')
  .update({ status: 'renewed' })
  .eq('id', 'item-uuid');
```

---

### Support Tickets

#### GET /tickets

Fetch support tickets

```javascript
const { data: tickets } = await supabase
  .from('support_tickets')
  .select('*')
  .eq('tenant_id', currentTenant);
```

---

#### POST /tickets

Create support ticket

```javascript
const { data } = await supabase
  .from('support_tickets')
  .insert([
    {
      title: 'Issue with notifications',
      description: 'Not receiving WhatsApp alerts',
      priority: 'high',
      status: 'open'
    }
  ]);
```

---

### Feature Toggles

#### GET /features

Check feature status

```javascript
const { data: features } = await supabase
  .from('feature_toggles')
  .select('*')
  .eq('tenant_id', currentTenant);
```

---

## Error Handling

All errors follow standard HTTP status codes:

| Status | Meaning | Example |
|--------|---------|----------|
| 200 | Success | Item created |
| 400 | Bad Request | Missing required field |
| 401 | Unauthorized | Invalid token |
| 403 | Forbidden | No access to tenant |
| 404 | Not Found | Item doesn't exist |
| 500 | Server Error | Database error |

**Error Response:**
```json
{
  "error": {
    "message": "Item not found",
    "code": "NOT_FOUND",
    "statusCode": 404
  }
}
```

---

## Rate Limiting

- **Free Tier:** 100 requests/minute
- **Pro Tier:** 1000 requests/minute
- **Enterprise:** Unlimited

Headers indicate remaining quota:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1643467200
```

---

## Webhooks

### Register Webhook

```javascript
await supabase
  .from('webhooks')
  .insert([{
    event: 'reminder.sent',
    url: 'https://yourapp.com/webhook',
    active: true
  }]);
```

### Events

- `reminder.sent` - Reminder sent successfully
- `item.expires` - Item expiration date reached
- `ticket.created` - New support ticket
- `evaluation.due` - Performance evaluation due

**Webhook Payload:**
```json
{
  "event": "reminder.sent",
  "timestamp": "2026-01-29T14:00:00Z",
  "data": {
    "reminder_id": "uuid",
    "item_id": "uuid",
    "channels": ["whatsapp", "email"]
  }
}
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);

// Fetch reminders
const { data } = await supabase
  .from('reminder_rules')
  .select('*');
```

### Python

```python
from supabase import create_client

supabase = create_client(url, key)
response = supabase.table('reminder_rules').select('*').execute()
```

### cURL

```bash
curl -X GET 'https://your-domain.com/api/reminders' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json'
```

---

## Best Practices

1. **Always validate responses** - Check for errors
2. **Use pagination** - For large datasets
3. **Cache when possible** - Reduce API calls
4. **Implement retry logic** - For transient failures
5. **Monitor rate limits** - Respect quotas
6. **Use webhooks** - For real-time updates
7. **Secure tokens** - Never commit to version control

---

**Last Updated:** January 29, 2026  
**API Version:** v1.0
