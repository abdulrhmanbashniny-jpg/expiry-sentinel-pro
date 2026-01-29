# Deployment Guide

## Deployment Options

### Option 1: Lovable.dev (Current - Recommended)

**Status:** ✅ Production Ready

**Features:**
- Automatic deployment from GitHub
- Built-in CI/CD pipeline
- Auto-scaling infrastructure
- Custom domain support
- SSL certificates included

**Steps:**
1. Push to main branch
2. Lovable auto-deploys within 5 minutes
3. Access at: https://expiry-sentinel-pro.lovable.app

---

### Option 2: Vercel

**Steps:**

1. **Create Vercel Account**
```bash
npm i -g vercel
vercel login
```

2. **Deploy**
```bash
vercel --prod
```

3. **Set Environment Variables**
```env
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key
```

---

### Option 3: Docker + AWS/GCP

**Build Docker image:**

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "preview"]
```

**Deploy:**
```bash
docker build -t expiry-sentinel-pro .
docker run -p 3000:3000 expiry-sentinel-pro
```

---

## Environment Variables

### Required (.env)

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Optional APIs
RESEND_API_KEY=re_xxxxx
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxxx
TELEGRAM_BOT_TOKEN=xxxxx
```

### Supabase Configuration

1. **Create Project**
   - Go to supabase.com
   - Create new project
   - Note project URL and anon key

2. **Run Migrations**
```bash
supabase db push
```

3. **Enable Features**
```bash
# Enable RLS
supabase db reset
```

---

## Production Checklist

- ✅ Environment variables configured
- ✅ Database migrations applied
- ✅ RLS policies enabled
- ✅ SSL certificate configured
- ✅ Backups enabled
- ✅ Monitoring set up
- ✅ Error tracking configured
- ✅ Email service activated
- ✅ SMS service credentials added
- ✅ Telegram bot token added

---

## Monitoring

### Logs
```bash
# Supabase logs
supabase logs --filter=error

# Application logs
vercel logs expiry-sentinel-pro
```

### Alerts
- Set up error tracking (Sentry)
- Monitor database performance
- Track API response times

---

## Scaling

### Database Scaling
- Supabase handles auto-scaling
- Monitor connection limits
- Archive old logs regularly

### Application Scaling
- Lovable/Vercel handle auto-scaling
- Monitor CPU and memory usage

---

## Backup Strategy

```bash
# Supabase automatic backups (daily)
# Retention: 7 days

# Manual backup
supabase db dump > backup.sql
```

---

## Disaster Recovery

### In Case of Data Loss

1. **Check Supabase backups**
```bash
supabase backups list
```

2. **Restore from backup**
```bash
supabase db restore <backup_id>
```

3. **Verify data integrity**
```bash
supabase db
```

---

## Custom Domain

### Lovable
1. Go to Settings → Domains
2. Add your domain (e.g., expiry.yourcompany.com)
3. Point DNS CNAME to Lovable

---

## Performance Optimization

### Frontend
- Enable caching headers
- Minimize bundle size
- Use lazy loading

### Backend
- Index frequently queried columns
- Use connection pooling
- Cache API responses

---

## Security

- ✅ All traffic is HTTPS
- ✅ RLS enforced at database level
- ✅ Environment variables never exposed
- ✅ Regular security audits
- ✅ Dependabot enabled for dependencies

---

## Troubleshooting

### Deploy Fails
```bash
# Check build logs
vercel logs expiry-sentinel-pro --follow

# Rebuild
npm run build
```

### Database Connection Issues
```bash
# Verify credentials
echo $VITE_SUPABASE_URL

# Check Supabase status
# Visit https://status.supabase.com
```

### High Response Times
- Check database indexes
- Review slow queries
- Scale up Supabase plan if needed

---

**Last Updated:** January 29, 2026
