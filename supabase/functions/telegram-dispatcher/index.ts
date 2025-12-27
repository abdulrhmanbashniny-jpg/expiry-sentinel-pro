import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

// ==================== TYPES ====================
type WorkflowStatus = 'new' | 'acknowledged' | 'in_progress' | 'done_pending_supervisor' | 'returned' | 'escalated_to_manager' | 'finished';
type UserRole = 'system_admin' | 'admin' | 'supervisor' | 'hr_user' | 'employee';

interface InlineButton {
  text: string;
  callback_data: string;
}

interface UserContext {
  userId: string | null;
  telegramUserId: string;
  userName: string;
  role: UserRole;
  departmentIds: string[];
  isSupervisor: boolean;
  isDepartmentManager: boolean;
  managedDepartmentId: string | null;
}

// ==================== STATUS LABELS ====================
const STATUS_LABELS: Record<WorkflowStatus, string> = {
  'new': '🆕 جديدة',
  'acknowledged': '👀 تم الاستلام',
  'in_progress': '▶️ قيد التنفيذ',
  'done_pending_supervisor': '⏳ بانتظار اعتماد المشرف',
  'returned': '↩️ مُرجعة',
  'escalated_to_manager': '⬆️ مُصعدة للمدير',
  'finished': '✅ منتهية'
};

// ==================== STATE MACHINE ====================
const VALID_TRANSITIONS: Record<string, Record<WorkflowStatus, WorkflowStatus[]>> = {
  employee: {
    'new': ['acknowledged'],
    'acknowledged': ['in_progress'],
    'in_progress': ['done_pending_supervisor'],
    'done_pending_supervisor': [],
    'returned': ['in_progress'],
    'escalated_to_manager': [],
    'finished': []
  },
  supervisor: {
    'new': ['acknowledged'],
    'acknowledged': ['in_progress'],
    'in_progress': ['done_pending_supervisor'],
    'done_pending_supervisor': ['finished', 'returned', 'escalated_to_manager'],
    'returned': ['in_progress'],
    'escalated_to_manager': [],
    'finished': []
  },
  manager: {
    'new': ['acknowledged'],
    'acknowledged': ['in_progress'],
    'in_progress': ['done_pending_supervisor'],
    'done_pending_supervisor': ['finished', 'returned', 'escalated_to_manager'],
    'returned': ['in_progress'],
    'escalated_to_manager': ['finished', 'returned'],
    'finished': []
  },
  admin: {
    'new': ['acknowledged', 'in_progress', 'done_pending_supervisor', 'finished'],
    'acknowledged': ['in_progress', 'done_pending_supervisor', 'finished'],
    'in_progress': ['done_pending_supervisor', 'finished'],
    'done_pending_supervisor': ['finished', 'returned', 'escalated_to_manager'],
    'returned': ['in_progress', 'finished'],
    'escalated_to_manager': ['finished', 'returned'],
    'finished': ['new'] // Allow restart for admins
  }
};

// ==================== BUTTON GENERATORS ====================
function generateEmployeeButtons(itemId: string, currentStatus: WorkflowStatus): InlineButton[][] {
  const buttons: InlineButton[][] = [];
  
  if (currentStatus === 'new') {
    buttons.push([{ text: '✅ تم الاستلام', callback_data: `item:ack:${itemId}` }]);
  }
  if (currentStatus === 'new' || currentStatus === 'acknowledged') {
    buttons.push([{ text: '▶️ بدأ التنفيذ', callback_data: `item:start:${itemId}` }]);
  }
  if (currentStatus === 'in_progress') {
    buttons.push([{ text: '🏁 تم الإنجاز', callback_data: `item:done:${itemId}` }]);
  }
  if (currentStatus === 'returned') {
    buttons.push([{ text: '▶️ إعادة التنفيذ', callback_data: `item:start:${itemId}` }]);
  }
  
  buttons.push([{ text: '📄 تفاصيل', callback_data: `item:details:${itemId}` }]);
  
  return buttons;
}

function generateSupervisorButtons(itemId: string, currentStatus: WorkflowStatus): InlineButton[][] {
  const buttons: InlineButton[][] = [];
  
  if (currentStatus === 'done_pending_supervisor') {
    buttons.push([
      { text: '✅ اعتماد وإنهاء', callback_data: `item:approve:${itemId}` }
    ]);
    buttons.push([
      { text: '↩️ إرجاع للموظف', callback_data: `item:return:${itemId}` },
      { text: '⬆️ تصعيد للمدير', callback_data: `item:escalate:${itemId}` }
    ]);
  }
  
  buttons.push([{ text: '📄 تفاصيل', callback_data: `item:details:${itemId}` }]);
  buttons.push([{ text: '📜 السجل الزمني', callback_data: `item:timeline:${itemId}` }]);
  
  return buttons;
}

function generateManagerButtons(itemId: string, currentStatus: WorkflowStatus): InlineButton[][] {
  const buttons: InlineButton[][] = [];
  
  if (currentStatus === 'escalated_to_manager') {
    buttons.push([
      { text: '✅ إنهاء', callback_data: `item:manager_close:${itemId}` }
    ]);
    buttons.push([
      { text: '↩️ إرجاع للموظف', callback_data: `item:return:${itemId}` }
    ]);
  }
  
  buttons.push([{ text: '📄 تفاصيل', callback_data: `item:details:${itemId}` }]);
  buttons.push([{ text: '📜 السجل الزمني', callback_data: `item:timeline:${itemId}` }]);
  
  return buttons;
}

function generateAdminButtons(itemId: string, currentStatus: WorkflowStatus): InlineButton[][] {
  const buttons: InlineButton[][] = [];
  
  if (currentStatus !== 'finished') {
    buttons.push([{ text: '✅ إنهاء مباشر', callback_data: `item:force_close:${itemId}` }]);
  }
  if (currentStatus === 'done_pending_supervisor' || currentStatus === 'escalated_to_manager') {
    buttons.push([{ text: '↩️ إرجاع', callback_data: `item:return:${itemId}` }]);
  }
  
  buttons.push([{ text: '📄 تفاصيل', callback_data: `item:details:${itemId}` }]);
  buttons.push([{ text: '📜 السجل الزمني', callback_data: `item:timeline:${itemId}` }]);
  
  return buttons;
}

function generateButtonsForRole(
  itemId: string, 
  currentStatus: WorkflowStatus, 
  userContext: UserContext,
  itemCreatorId: string | null,
  itemDepartmentId: string | null
): InlineButton[][] {
  const role = userContext.role;
  
  // Admin/System Admin - full access
  if (role === 'system_admin' || role === 'admin') {
    return generateAdminButtons(itemId, currentStatus);
  }
  
  // Department Manager
  if (userContext.isDepartmentManager && itemDepartmentId === userContext.managedDepartmentId) {
    return generateManagerButtons(itemId, currentStatus);
  }
  
  // Supervisor - for their team members' items
  if (userContext.isSupervisor && currentStatus === 'done_pending_supervisor') {
    return generateSupervisorButtons(itemId, currentStatus);
  }
  
  // Employee - own items only
  if (itemCreatorId === userContext.userId) {
    return generateEmployeeButtons(itemId, currentStatus);
  }
  
  // Default - just details
  return [[{ text: '📄 تفاصيل', callback_data: `item:details:${itemId}` }]];
}

// ==================== STATUS TRANSITION ====================
async function transitionStatus(
  supabase: any,
  itemId: string,
  newStatus: WorkflowStatus,
  userContext: UserContext,
  reason?: string
): Promise<{ success: boolean; message: string; item?: any }> {
  // Get current item
  const { data: item, error: fetchError } = await supabase
    .from('items')
    .select('*, category:categories(name)')
    .eq('id', itemId)
    .single();
  
  if (fetchError || !item) {
    return { success: false, message: 'المعاملة غير موجودة' };
  }
  
  const currentStatus = item.workflow_status as WorkflowStatus;
  const role = userContext.role;
  
  // Determine effective role for transition rules
  let effectiveRole = 'employee';
  if (role === 'system_admin' || role === 'admin') {
    effectiveRole = 'admin';
  } else if (userContext.isDepartmentManager && item.department_id === userContext.managedDepartmentId) {
    effectiveRole = 'manager';
  } else if (userContext.isSupervisor) {
    effectiveRole = 'supervisor';
  }
  
  // Check valid transitions
  const validTransitions = VALID_TRANSITIONS[effectiveRole]?.[currentStatus] || [];
  
  if (!validTransitions.includes(newStatus)) {
    // Guard rail: can't mark done before in_progress
    if (newStatus === 'done_pending_supervisor' && currentStatus !== 'in_progress') {
      return { 
        success: false, 
        message: '⚠️ لا يمكن إنهاء المعاملة قبل بدء التنفيذ.\nيرجى الضغط على "بدأ التنفيذ" أولاً.' 
      };
    }
    return { 
      success: false, 
      message: `⛔ لا يمكن الانتقال من "${STATUS_LABELS[currentStatus]}" إلى "${STATUS_LABELS[newStatus]}"` 
    };
  }
  
  // Check if reason is required
  if ((newStatus === 'returned' || newStatus === 'escalated_to_manager') && !reason) {
    return { 
      success: false, 
      message: '⚠️ يجب إدخال سبب الإرجاع/التصعيد. أرسل السبب في رسالة جديدة.' 
    };
  }
  
  // Update item status
  const { error: updateError } = await supabase
    .from('items')
    .update({ workflow_status: newStatus })
    .eq('id', itemId);
  
  if (updateError) {
    console.error('Update error:', updateError);
    return { success: false, message: 'خطأ في تحديث الحالة' };
  }
  
  // Log status change
  await supabase.from('item_status_log').insert({
    item_id: itemId,
    old_status: currentStatus,
    new_status: newStatus,
    changed_by_user_id: userContext.userId,
    reason: reason,
    channel: 'telegram',
    metadata: { telegram_user_id: userContext.telegramUserId, user_name: userContext.userName }
  });
  
  return { 
    success: true, 
    message: `✅ تم تغيير الحالة إلى: ${STATUS_LABELS[newStatus]}`,
    item: { ...item, workflow_status: newStatus }
  };
}

// ==================== CALLBACK HANDLERS ====================
async function handleCallback(
  supabase: any,
  callbackData: string,
  userContext: UserContext
): Promise<{ reply_text: string; reply_markup?: any }> {
  const parts = callbackData.split(':');
  if (parts.length < 3 || parts[0] !== 'item') {
    return { reply_text: 'أمر غير صالح' };
  }
  
  const action = parts[1];
  const itemId = parts[2];
  const extraData = parts[3];
  
  console.log(`Callback: action=${action}, itemId=${itemId}, user=${userContext.userName}`);
  
  switch (action) {
    case 'ack': {
      const result = await transitionStatus(supabase, itemId, 'acknowledged', userContext);
      if (result.success && result.item) {
        return {
          reply_text: result.message + `\n\n📋 ${result.item.title}`,
          reply_markup: {
            inline_keyboard: generateButtonsForRole(
              itemId, 
              'acknowledged', 
              userContext, 
              result.item.created_by_user_id,
              result.item.department_id
            )
          }
        };
      }
      return { reply_text: result.message };
    }
    
    case 'start': {
      const result = await transitionStatus(supabase, itemId, 'in_progress', userContext);
      if (result.success && result.item) {
        return {
          reply_text: result.message + `\n\n📋 ${result.item.title}`,
          reply_markup: {
            inline_keyboard: generateButtonsForRole(
              itemId, 
              'in_progress', 
              userContext,
              result.item.created_by_user_id,
              result.item.department_id
            )
          }
        };
      }
      return { reply_text: result.message };
    }
    
    case 'done': {
      const result = await transitionStatus(supabase, itemId, 'done_pending_supervisor', userContext);
      if (result.success) {
        return { reply_text: result.message + '\n\nسيتم إخطار المشرف للاعتماد.' };
      }
      // If guard rail triggered, show start button
      if (result.message.includes('بدأ التنفيذ')) {
        return {
          reply_text: result.message,
          reply_markup: {
            inline_keyboard: [[{ text: '▶️ بدأ التنفيذ', callback_data: `item:start:${itemId}` }]]
          }
        };
      }
      return { reply_text: result.message };
    }
    
    case 'approve': {
      const result = await transitionStatus(supabase, itemId, 'finished', userContext);
      if (result.success && result.item) {
        // Check if recurring
        if (result.item.is_recurring) {
          return {
            reply_text: result.message + '\n\n🔄 هل تريد تكرار هذه المعاملة؟',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '7 أيام', callback_data: `item:recur:${itemId}:7` },
                  { text: '30 يوم', callback_data: `item:recur:${itemId}:30` },
                  { text: '90 يوم', callback_data: `item:recur:${itemId}:90` }
                ],
                [{ text: '❌ لا أريد التكرار', callback_data: `item:skip_recur:${itemId}` }]
              ]
            }
          };
        }
        return { reply_text: result.message };
      }
      return { reply_text: result.message };
    }
    
    case 'manager_close':
    case 'force_close': {
      const result = await transitionStatus(supabase, itemId, 'finished', userContext);
      return { reply_text: result.message };
    }
    
    case 'return': {
      // Store pending action for reason input
      return {
        reply_text: '📝 أرسل سبب الإرجاع في الرسالة التالية:',
        reply_markup: {
          inline_keyboard: [[{ text: '❌ إلغاء', callback_data: `item:cancel_action:${itemId}` }]]
        }
      };
    }
    
    case 'escalate': {
      return {
        reply_text: '📝 أرسل سبب التصعيد للمدير في الرسالة التالية:',
        reply_markup: {
          inline_keyboard: [[{ text: '❌ إلغاء', callback_data: `item:cancel_action:${itemId}` }]]
        }
      };
    }
    
    case 'recur': {
      const days = parseInt(extraData) || 30;
      const { data: item } = await supabase
        .from('items')
        .select('*')
        .eq('id', itemId)
        .single();
      
      if (!item) return { reply_text: 'المعاملة غير موجودة' };
      
      const newExpiryDate = new Date();
      newExpiryDate.setDate(newExpiryDate.getDate() + days);
      
      const { data: newItem, error } = await supabase
        .from('items')
        .insert({
          title: item.title,
          category_id: item.category_id,
          expiry_date: newExpiryDate.toISOString().split('T')[0],
          expiry_time: item.expiry_time,
          owner_department: item.owner_department,
          responsible_person: item.responsible_person,
          notes: item.notes,
          department_id: item.department_id,
          reminder_rule_id: item.reminder_rule_id,
          created_by_user_id: item.created_by_user_id,
          is_recurring: true,
          parent_item_id: itemId,
          workflow_status: 'new'
        })
        .select('ref_number')
        .single();
      
      if (error) {
        console.error('Recur error:', error);
        return { reply_text: '❌ خطأ في إنشاء المعاملة المكررة' };
      }
      
      return { 
        reply_text: `✅ تم إنشاء معاملة مكررة: ${newItem.ref_number}\n📅 تاريخ الانتهاء الجديد: ${newExpiryDate.toISOString().split('T')[0]}` 
      };
    }
    
    case 'skip_recur': {
      return { reply_text: '👍 تم إغلاق المعاملة بدون تكرار.' };
    }
    
    case 'cancel_action': {
      return { reply_text: '❌ تم إلغاء العملية.' };
    }
    
    case 'details': {
      const { data: item } = await supabase
        .from('items')
        .select('*, category:categories(name, risk_level)')
        .eq('id', itemId)
        .single();
      
      if (!item) return { reply_text: 'المعاملة غير موجودة' };
      
      const today = new Date();
      const expiryDate = new Date(item.expiry_date);
      const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      const statusLabel = STATUS_LABELS[item.workflow_status as WorkflowStatus] || item.workflow_status;
      
      const text = `📋 تفاصيل المعاملة: ${item.ref_number}
━━━━━━━━━━━━━━━━━━━━
📌 العنوان: ${item.title}
📊 الحالة: ${statusLabel}
📅 تاريخ الانتهاء: ${item.expiry_date}
⏳ المتبقي: ${daysLeft > 0 ? `${daysLeft} يوم` : daysLeft === 0 ? 'اليوم!' : `متأخر ${Math.abs(daysLeft)} يوم`}
👤 المسؤول: ${item.responsible_person || 'غير محدد'}
🏢 القسم: ${item.owner_department || 'غير محدد'}
📁 الفئة: ${item.category?.name || 'بدون فئة'}
📝 ملاحظات: ${item.notes || 'لا توجد'}`;
      
      return {
        reply_text: text,
        reply_markup: {
          inline_keyboard: generateButtonsForRole(
            itemId,
            item.workflow_status as WorkflowStatus,
            userContext,
            item.created_by_user_id,
            item.department_id
          )
        }
      };
    }
    
    case 'timeline': {
      const { data: logs } = await supabase
        .from('item_status_log')
        .select('*')
        .eq('item_id', itemId)
        .order('changed_at', { ascending: false })
        .limit(10);
      
      if (!logs?.length) return { reply_text: 'لا يوجد سجل زمني لهذه المعاملة' };
      
      const timelineText = logs.map((log: any) => {
        const d = new Date(log.changed_at);
        const date = d.toISOString().split('T')[0];
        const time = d.toTimeString().slice(0, 5);
        const oldLabel = log.old_status ? STATUS_LABELS[log.old_status as WorkflowStatus] || log.old_status : 'إنشاء';
        const newLabel = STATUS_LABELS[log.new_status as WorkflowStatus] || log.new_status;
        const channel = log.channel === 'telegram' ? '📱' : '🌐';
        const reason = log.reason ? `\n   💬 ${log.reason}` : '';
        return `${channel} ${date} ${time}\n   ${oldLabel} ➜ ${newLabel}${reason}`;
      }).join('\n\n');
      
      return {
        reply_text: `📜 السجل الزمني:\n━━━━━━━━━━━━━━━━━━━━\n${timelineText}`,
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 رجوع للتفاصيل', callback_data: `item:details:${itemId}` }]]
        }
      };
    }
    
    default:
      return { reply_text: 'أمر غير معروف' };
  }
}

// ==================== AI TOOLS & AGENT ====================
const SYSTEM_PROMPT = `أنت مساعد إداري ذكي لنظام تنبيهات انتهاء الصلاحية (Expiry Guard).
مهامك:
- مساعدة الموظفين في البحث عن المعاملات ومتابعتها
- الإجابة على الاستفسارات حول تواريخ الانتهاء
- تنفيذ العمليات حسب صلاحيات المستخدم

قواعد هامة:
1. تحدث دائماً بالعربية
2. كن مختصراً ومحترفاً
3. إذا طُلب منك عملية لا تملك صلاحيتها، اعتذر بلطف
4. عند /start أو /help، قدم نفسك واشرح الأوامر
5. استخدم الأدوات للإجابة على أسئلة المعاملات

الأدوات المتاحة لك:
- search_items: البحث عن معاملات
- get_item_details: تفاصيل معاملة محددة
- get_due_items: المعاملات القريبة من الانتهاء
- get_finished_items: المعاملات المنتهية

دور المستخدم الحالي: {USER_ROLE}
اسم المستخدم: {USER_NAME}`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_items",
      description: "البحث عن معاملات بالاسم أو الوصف أو المسؤول",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "كلمة البحث" } },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_item_details",
      description: "الحصول على تفاصيل معاملة محددة برقمها المرجعي",
      parameters: {
        type: "object",
        properties: { ref_number: { type: "string", description: "الرقم المرجعي للمعاملة" } },
        required: ["ref_number"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_due_items",
      description: "الحصول على المعاملات القريبة من الانتهاء",
      parameters: {
        type: "object",
        properties: { days: { type: "number", description: "عدد الأيام للبحث" } }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_finished_items",
      description: "الحصول على قائمة المعاملات المنتهية (finished)",
      parameters: {
        type: "object",
        properties: { limit: { type: "number", description: "عدد النتائج" } }
      }
    }
  }
];

async function executeTool(supabase: any, toolName: string, args: any, userContext: UserContext): Promise<{ text: string; items?: any[] }> {
  console.log(`Executing tool: ${toolName}`);
  
  switch (toolName) {
    case "search_items": {
      const { data, error } = await supabase
        .from('items')
        .select('id, ref_number, title, expiry_date, workflow_status, responsible_person, category:categories(name), created_by_user_id, department_id')
        .or(`title.ilike.%${args.query}%,notes.ilike.%${args.query}%,responsible_person.ilike.%${args.query}%`)
        .limit(10);
      
      if (error || !data?.length) return { text: "لم يتم العثور على نتائج" };
      
      const text = `نتائج البحث (${data.length}):\n━━━━━━━━━━━━━━━━━━━━\n` + 
        data.map((item: any) => {
          const status = STATUS_LABELS[item.workflow_status as WorkflowStatus] || item.workflow_status;
          return `📄 ${item.ref_number}: ${item.title}\n   ${status} | 📅 ${item.expiry_date}`;
        }).join('\n\n');
      
      return { text, items: data };
    }
    
    case "get_item_details": {
      const { data: item, error } = await supabase
        .from('items')
        .select('id, ref_number, title, expiry_date, workflow_status, responsible_person, owner_department, notes, category:categories(name), created_by_user_id, department_id')
        .eq('ref_number', args.ref_number)
        .single();
      
      if (error || !item) return { text: "المعاملة غير موجودة" };
      
      const today = new Date();
      const expiryDate = new Date(item.expiry_date);
      const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const status = STATUS_LABELS[item.workflow_status as WorkflowStatus] || item.workflow_status;
      
      return { 
        text: `📋 ${item.ref_number}: ${item.title}\n${status}\n📅 ${item.expiry_date} (${daysLeft > 0 ? `${daysLeft} يوم` : 'منتهية'})\n👤 ${item.responsible_person || 'غير محدد'}`,
        items: [item]
      };
    }
    
    case "get_due_items": {
      const days = args.days || 7;
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      
      const { data, error } = await supabase
        .from('items')
        .select('id, ref_number, title, expiry_date, workflow_status, responsible_person, created_by_user_id, department_id')
        .neq('workflow_status', 'finished')
        .gte('expiry_date', today)
        .lte('expiry_date', futureDate.toISOString().split('T')[0])
        .order('expiry_date', { ascending: true })
        .limit(15);
      
      if (error || !data?.length) return { text: `✅ لا توجد معاملات تنتهي خلال ${days} أيام` };
      
      const text = `⏰ المعاملات التي تنتهي خلال ${days} أيام:\n━━━━━━━━━━━━━━━━━━━━\n` +
        data.map((item: any) => {
          const status = STATUS_LABELS[item.workflow_status as WorkflowStatus] || item.workflow_status;
          return `📄 ${item.ref_number}: ${item.title}\n   ${status} | 📅 ${item.expiry_date}`;
        }).join('\n\n');
      
      return { text, items: data };
    }
    
    case "get_finished_items": {
      const limit = args.limit || 10;
      
      const { data, error } = await supabase
        .from('items')
        .select('id, ref_number, title, expiry_date, workflow_status, responsible_person, created_by_user_id, department_id')
        .eq('workflow_status', 'finished')
        .order('updated_at', { ascending: false })
        .limit(limit);
      
      if (error || !data?.length) return { text: "لا توجد معاملات منتهية" };
      
      const text = `✅ المعاملات المنتهية (${data.length}):\n━━━━━━━━━━━━━━━━━━━━\n` +
        data.map((item: any) => `📄 ${item.ref_number}: ${item.title}`).join('\n');
      
      return { text, items: data };
    }
    
    default:
      return { text: "أداة غير معروفة" };
  }
}

async function callAI(messages: any[], userRole: string, userName: string): Promise<any> {
  const systemPrompt = SYSTEM_PROMPT
    .replace('{USER_ROLE}', userRole)
    .replace('{USER_NAME}', userName);
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      tools: TOOLS,
      tool_choice: 'auto'
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI error:', response.status, errorText);
    throw new Error(`AI error: ${response.status}`);
  }
  
  return response.json();
}

// ==================== MAIN HANDLER ====================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    console.log('Request body:', JSON.stringify(body));
    
    // Auth check
    const internalKey = req.headers.get('x-internal-key');
    const expectedEnvKey = Deno.env.get('INTERNAL_FUNCTION_KEY');
    
    const { data: integration } = await supabase
      .from('integrations')
      .select('config')
      .eq('key', 'n8n')
      .maybeSingle();
    
    const cfg = (integration?.config as Record<string, any>) ?? {};
    const expectedDbKey = cfg?.internal_key || cfg?.internalkey;
    const allowedKeys = new Set([expectedEnvKey, expectedDbKey].filter(Boolean));
    
    if (!internalKey || allowedKeys.size === 0 || !allowedKeys.has(internalKey)) {
      console.error('Auth failed');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Extract fields
    const telegram_user_id = body.telegram_user_id || body.user_id || '';
    const chat_id = body.chat_id;
    const message_text = body.message_text || body.text || '';
    const callback_data = body.callback_data || '';
    
    console.log(`user_id=${telegram_user_id}, chat_id=${chat_id}, text="${message_text}", callback="${callback_data}"`);
    
    if (!chat_id) {
      return new Response(JSON.stringify({ error: 'Missing chat_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Build user context
    let userContext: UserContext = {
      userId: null,
      telegramUserId: telegram_user_id.toString(),
      userName: 'مستخدم',
      role: 'employee',
      departmentIds: [],
      isSupervisor: false,
      isDepartmentManager: false,
      managedDepartmentId: null
    };
    
    if (telegram_user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('telegram_user_id', telegram_user_id.toString())
        .maybeSingle();
      
      if (profile) {
        userContext.userId = profile.user_id;
        userContext.userName = profile.full_name || 'مستخدم';
        
        // Get role
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', profile.user_id)
          .maybeSingle();
        
        if (roleData) {
          userContext.role = roleData.role as UserRole;
        }
        
        // Check if supervisor
        const { data: teamData } = await supabase
          .from('team_members')
          .select('id')
          .eq('supervisor_id', profile.user_id)
          .limit(1);
        
        userContext.isSupervisor = (teamData?.length || 0) > 0;
        
        // Get department memberships
        const { data: deptScopes } = await supabase
          .from('user_department_scopes')
          .select('department_id')
          .eq('user_id', profile.user_id);
        
        userContext.departmentIds = deptScopes?.map((d: any) => d.department_id) || [];
        
        // Check if department manager
        const { data: managedDept } = await supabase
          .from('departments')
          .select('id')
          .eq('manager_user_id', profile.user_id)
          .maybeSingle();
        
        if (managedDept) {
          userContext.isDepartmentManager = true;
          userContext.managedDepartmentId = managedDept.id;
        }
      }
    }
    
    console.log('User context:', JSON.stringify(userContext));
    
    let reply_text = '';
    let reply_markup: any = null;
    
    // Handle callback (button press)
    if (callback_data) {
      const result = await handleCallback(supabase, callback_data, userContext);
      reply_text = result.reply_text;
      reply_markup = result.reply_markup;
    }
    // Handle text message
    else if (message_text) {
      // Get conversation history
      const { data: history } = await supabase
        .from('conversation_logs')
        .select('user_message, bot_response')
        .eq('user_identifier', telegram_user_id?.toString() || chat_id?.toString())
        .eq('platform', 'telegram')
        .order('created_at', { ascending: false })
        .limit(5);
      
      const messages: any[] = [];
      if (history) {
        for (const log of [...history].reverse()) {
          if (log.user_message) messages.push({ role: 'user', content: log.user_message });
          if (log.bot_response) messages.push({ role: 'assistant', content: log.bot_response });
        }
      }
      messages.push({ role: 'user', content: message_text });
      
      // Call AI
      let aiResponse = await callAI(messages, userContext.role, userContext.userName);
      let assistantMessage = aiResponse.choices?.[0]?.message;
      
      // Process tool calls
      let iterations = 0;
      let lastItems: any[] = [];
      
      while (assistantMessage?.tool_calls?.length && iterations < 5) {
        iterations++;
        const toolResults: any[] = [];
        
        for (const toolCall of assistantMessage.tool_calls) {
          let toolArgs = {};
          try { toolArgs = JSON.parse(toolCall.function.arguments || '{}'); } catch {}
          
          const result = await executeTool(supabase, toolCall.function.name, toolArgs, userContext);
          if (result.items) lastItems = result.items;
          
          toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result.text
          });
        }
        
        messages.push(assistantMessage);
        messages.push(...toolResults);
        
        aiResponse = await callAI(messages, userContext.role, userContext.userName);
        assistantMessage = aiResponse.choices?.[0]?.message;
      }
      
      reply_text = assistantMessage?.content || 'عذراً، حدث خطأ.';
      
      // Add inline buttons for returned items (first item only for simplicity)
      if (lastItems.length > 0) {
        const firstItem = lastItems[0];
        reply_markup = {
          inline_keyboard: generateButtonsForRole(
            firstItem.id,
            firstItem.workflow_status as WorkflowStatus,
            userContext,
            firstItem.created_by_user_id,
            firstItem.department_id
          )
        };
      }
      
      // Log conversation
      await supabase.from('conversation_logs').insert({
        user_identifier: telegram_user_id?.toString() || chat_id?.toString(),
        platform: 'telegram',
        ref_number: `TG-${Date.now()}`,
        user_message: message_text,
        bot_response: reply_text,
        metadata: { chat_id, user_context: userContext }
      });
    }
    
    if (!reply_text) {
      reply_text = 'مرحباً! كيف يمكنني مساعدتك؟';
    }
    
    const responseBody: any = { chat_id, reply_text };
    if (reply_markup) {
      responseBody.reply_markup = reply_markup;
    }
    
    console.log('Response:', JSON.stringify(responseBody).substring(0, 500));
    
    return new Response(JSON.stringify(responseBody), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      error: error?.message,
      reply_text: 'عذراً، حدث خطأ. يرجى المحاولة لاحقاً.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
