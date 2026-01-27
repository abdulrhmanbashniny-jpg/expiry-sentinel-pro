-- =============================================
-- 1. نظام إدارة العقود الذكية (Contracts)
-- =============================================
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  title TEXT NOT NULL,
  contract_number TEXT,
  contract_type TEXT NOT NULL DEFAULT 'employment', -- employment, service, vendor, lease
  party_name TEXT NOT NULL, -- الطرف الآخر
  party_contact TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  renewal_type TEXT DEFAULT 'manual', -- auto, manual, none
  renewal_period_months INTEGER DEFAULT 12,
  value NUMERIC,
  currency TEXT DEFAULT 'SAR',
  status TEXT DEFAULT 'active', -- draft, active, expired, renewed, terminated
  department_id UUID REFERENCES public.departments(id),
  responsible_user_id UUID,
  attachment_url TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  auto_renewed_at TIMESTAMP WITH TIME ZONE,
  terminated_at TIMESTAMP WITH TIME ZONE,
  termination_reason TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- تنبيهات العقود
CREATE TABLE public.contract_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- expiry_30, expiry_14, expiry_7, renewal_reminder
  alert_date DATE NOT NULL,
  is_sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================
-- 2. نظام تذاكر الدعم (Support Tickets)
-- =============================================
CREATE TYPE public.ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'pending', 'resolved', 'closed');

CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  ticket_number TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- hr_request, complaint, inquiry, technical, other
  priority ticket_priority DEFAULT 'medium',
  status ticket_status DEFAULT 'open',
  requester_id UUID NOT NULL,
  assigned_to UUID,
  department_id UUID REFERENCES public.departments(id),
  sla_hours INTEGER DEFAULT 48,
  sla_deadline TIMESTAMP WITH TIME ZONE,
  first_response_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  satisfaction_rating INTEGER, -- 1-5
  satisfaction_comment TEXT,
  attachment_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ردود التذاكر
CREATE TABLE public.ticket_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false, -- ملاحظة داخلية
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================
-- 3. بوابة الموظف - طلبات الخدمات
-- =============================================
CREATE TYPE public.service_request_status AS ENUM ('pending', 'approved', 'rejected', 'processing', 'completed');

CREATE TABLE public.service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  request_number TEXT UNIQUE,
  request_type TEXT NOT NULL, -- vacation, certificate, letter, advance, other
  title TEXT NOT NULL,
  description TEXT,
  employee_id UUID NOT NULL,
  status service_request_status DEFAULT 'pending',
  priority ticket_priority DEFAULT 'medium',
  approver_id UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  due_date DATE,
  attachment_url TEXT,
  result_attachment_url TEXT, -- المرفق النهائي (الشهادة/الخطاب)
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================
-- 4. التوقيع الإلكتروني
-- =============================================
CREATE TYPE public.signature_status AS ENUM ('pending', 'signed', 'rejected', 'expired');

CREATE TABLE public.document_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  document_title TEXT NOT NULL,
  document_url TEXT NOT NULL,
  document_hash TEXT, -- للتحقق من السلامة
  requester_id UUID NOT NULL,
  status TEXT DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- الموقعين على المستند
CREATE TABLE public.signature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.document_signatures(id) ON DELETE CASCADE,
  signer_id UUID NOT NULL,
  signer_name TEXT,
  signer_email TEXT,
  sign_order INTEGER DEFAULT 1, -- ترتيب التوقيع
  status signature_status DEFAULT 'pending',
  signed_at TIMESTAMP WITH TIME ZONE,
  signature_data TEXT, -- بيانات التوقيع المشفرة
  ip_address TEXT,
  user_agent TEXT,
  rejection_reason TEXT,
  reminded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================
-- 5. سجل التدقيق الشامل (Audit Log)
-- =============================================
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  user_id UUID,
  user_email TEXT,
  action TEXT NOT NULL, -- create, update, delete, login, logout, export, etc.
  entity_type TEXT NOT NULL, -- item, contract, ticket, user, etc.
  entity_id UUID,
  entity_name TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================
-- 6. تحسين الذكاء الاصطناعي - تحليل المخاطر
-- =============================================
CREATE TABLE public.ai_risk_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  entity_type TEXT NOT NULL, -- item, contract, ticket
  entity_id UUID NOT NULL,
  risk_score NUMERIC NOT NULL, -- 0-100
  risk_level TEXT NOT NULL, -- low, medium, high, critical
  risk_factors JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  predicted_delay_days INTEGER,
  confidence_score NUMERIC, -- 0-100
  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================
-- Sequences للأرقام التسلسلية
-- =============================================
CREATE SEQUENCE IF NOT EXISTS contract_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS service_request_seq START 1;

-- =============================================
-- Functions لتوليد الأرقام
-- =============================================
CREATE OR REPLACE FUNCTION public.generate_contract_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.contract_number := 'CNT-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(nextval('contract_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ticket_number := 'TKT-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(nextval('ticket_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.generate_service_request_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.request_number := 'SRQ-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(nextval('service_request_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =============================================
-- Triggers
-- =============================================
CREATE TRIGGER set_contract_number
  BEFORE INSERT ON public.contracts
  FOR EACH ROW
  WHEN (NEW.contract_number IS NULL)
  EXECUTE FUNCTION public.generate_contract_number();

CREATE TRIGGER set_ticket_number
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW
  WHEN (NEW.ticket_number IS NULL)
  EXECUTE FUNCTION public.generate_ticket_number();

CREATE TRIGGER set_service_request_number
  BEFORE INSERT ON public.service_requests
  FOR EACH ROW
  WHEN (NEW.request_number IS NULL)
  EXECUTE FUNCTION public.generate_service_request_number();

-- Tenant enforcement triggers
CREATE TRIGGER enforce_tenant_contracts
  BEFORE INSERT ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tenant_on_insert();

CREATE TRIGGER prevent_tenant_change_contracts
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_tenant_id_change();

CREATE TRIGGER enforce_tenant_tickets
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tenant_on_insert();

CREATE TRIGGER prevent_tenant_change_tickets
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_tenant_id_change();

CREATE TRIGGER enforce_tenant_service_requests
  BEFORE INSERT ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tenant_on_insert();

CREATE TRIGGER prevent_tenant_change_service_requests
  BEFORE UPDATE ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_tenant_id_change();

CREATE TRIGGER enforce_tenant_signatures
  BEFORE INSERT ON public.document_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tenant_on_insert();

CREATE TRIGGER prevent_tenant_change_signatures
  BEFORE UPDATE ON public.document_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_tenant_id_change();

-- =============================================
-- RLS Policies
-- =============================================
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_risk_predictions ENABLE ROW LEVEL SECURITY;

-- Contracts RLS
CREATE POLICY "Contracts: Tenant SELECT"
  ON public.contracts FOR SELECT
  USING (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id());

CREATE POLICY "Contracts: Tenant INSERT"
  ON public.contracts FOR INSERT
  WITH CHECK (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id());

CREATE POLICY "Contracts: Tenant UPDATE"
  ON public.contracts FOR UPDATE
  USING (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id());

CREATE POLICY "Contracts: Admin DELETE"
  ON public.contracts FOR DELETE
  USING (is_admin_or_higher(auth.uid()));

-- Contract Alerts RLS
CREATE POLICY "Contract Alerts: Via contract access"
  ON public.contract_alerts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM contracts c WHERE c.id = contract_id 
    AND (is_system_admin(auth.uid()) OR c.tenant_id = get_current_tenant_id())
  ));

-- Support Tickets RLS
CREATE POLICY "Tickets: Tenant SELECT"
  ON public.support_tickets FOR SELECT
  USING (
    is_system_admin(auth.uid()) OR 
    tenant_id = get_current_tenant_id() AND (
      is_admin_or_higher(auth.uid()) OR
      requester_id = auth.uid() OR
      assigned_to = auth.uid()
    )
  );

CREATE POLICY "Tickets: Tenant INSERT"
  ON public.support_tickets FOR INSERT
  WITH CHECK (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id());

CREATE POLICY "Tickets: Tenant UPDATE"
  ON public.support_tickets FOR UPDATE
  USING (
    is_system_admin(auth.uid()) OR (
      tenant_id = get_current_tenant_id() AND (
        is_admin_or_higher(auth.uid()) OR assigned_to = auth.uid()
      )
    )
  );

-- Ticket Replies RLS
CREATE POLICY "Ticket Replies: Via ticket access"
  ON public.ticket_replies FOR ALL
  USING (EXISTS (
    SELECT 1 FROM support_tickets t WHERE t.id = ticket_id 
    AND (
      is_system_admin(auth.uid()) OR (
        t.tenant_id = get_current_tenant_id() AND (
          is_admin_or_higher(auth.uid()) OR t.requester_id = auth.uid() OR t.assigned_to = auth.uid()
        )
      )
    )
  ));

-- Service Requests RLS
CREATE POLICY "Service Requests: Tenant SELECT"
  ON public.service_requests FOR SELECT
  USING (
    is_system_admin(auth.uid()) OR (
      tenant_id = get_current_tenant_id() AND (
        is_admin_or_higher(auth.uid()) OR employee_id = auth.uid()
      )
    )
  );

CREATE POLICY "Service Requests: Employee INSERT"
  ON public.service_requests FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant_id() AND employee_id = auth.uid());

CREATE POLICY "Service Requests: Admin UPDATE"
  ON public.service_requests FOR UPDATE
  USING (
    is_system_admin(auth.uid()) OR (
      tenant_id = get_current_tenant_id() AND is_admin_or_higher(auth.uid())
    )
  );

-- Document Signatures RLS
CREATE POLICY "Signatures: Tenant SELECT"
  ON public.document_signatures FOR SELECT
  USING (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id());

CREATE POLICY "Signatures: Admin INSERT"
  ON public.document_signatures FOR INSERT
  WITH CHECK (is_admin_or_higher(auth.uid()));

CREATE POLICY "Signatures: Admin UPDATE"
  ON public.document_signatures FOR UPDATE
  USING (is_admin_or_higher(auth.uid()));

-- Signature Requests RLS
CREATE POLICY "Signature Requests: Signer or Admin"
  ON public.signature_requests FOR ALL
  USING (
    signer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM document_signatures d WHERE d.id = document_id 
      AND (is_system_admin(auth.uid()) OR d.tenant_id = get_current_tenant_id())
    )
  );

-- Audit Log RLS
CREATE POLICY "Audit Log: System Admin only"
  ON public.audit_log FOR SELECT
  USING (is_system_admin(auth.uid()));

CREATE POLICY "Audit Log: System INSERT"
  ON public.audit_log FOR INSERT
  WITH CHECK (true);

-- AI Risk Predictions RLS
CREATE POLICY "AI Predictions: Admin SELECT"
  ON public.ai_risk_predictions FOR SELECT
  USING (is_admin_or_higher(auth.uid()) AND tenant_id = get_current_tenant_id());

CREATE POLICY "AI Predictions: System INSERT"
  ON public.ai_risk_predictions FOR INSERT
  WITH CHECK (true);

-- =============================================
-- Indexes for performance
-- =============================================
CREATE INDEX idx_contracts_tenant ON public.contracts(tenant_id);
CREATE INDEX idx_contracts_status ON public.contracts(status);
CREATE INDEX idx_contracts_end_date ON public.contracts(end_date);
CREATE INDEX idx_tickets_tenant ON public.support_tickets(tenant_id);
CREATE INDEX idx_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_tickets_requester ON public.support_tickets(requester_id);
CREATE INDEX idx_service_requests_tenant ON public.service_requests(tenant_id);
CREATE INDEX idx_service_requests_employee ON public.service_requests(employee_id);
CREATE INDEX idx_audit_log_tenant ON public.audit_log(tenant_id);
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_user ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);