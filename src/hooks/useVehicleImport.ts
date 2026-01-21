import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { convertDate } from '@/utils/hijriConverter';
import * as XLSX from 'xlsx';

// Column mapping for TAMM_CAR_IMPORT template (Arabic to internal keys)
const COLUMN_MAPPING: Record<string, string> = {
  'العنوان': 'title',
  'رقم اللوحة': 'plate_number',
  'نوع التسجيل': 'registration_type',
  'الفرع': 'branch',
  'الماركة': 'brand',
  'الطراز': 'model',
  'سنة الصنع': 'manufacture_year',
  'الرقم التسلسلي': 'serial_number',
  'رقم الهيكل': 'chassis_number',
  'اللون الأساسي': 'primary_color',
  'وضع المركبة': 'vehicle_status',
  'تاريخ الملكية': 'ownership_date',
  'تاريخ انتهاء رخصة السير': 'license_expiry',
  'تاريخ انتهاء الفحص': 'inspection_expiry',
  'تاريخ انتهاء التامين': 'insurance_expiry',
  'نوع التاريخ': 'date_type',
  'حالة العنصر': 'item_status',
  'responsible_phone': 'responsible_phone',
  'اسم قاعدة التذكير': 'reminder_rule_name',
  'المستلمون': 'recipients',
  'خانة الملاحظات': 'notes',
  'القسم المالك': 'owner_department',
  'الفئة': 'category_name',
};

// Reminder types for vehicle items
const REMINDER_TYPES = [
  { key: 'license_expiry', label: 'رخصة السير', dateField: 'license_expiry' },
  { key: 'inspection_expiry', label: 'الفحص', dateField: 'inspection_expiry' },
  { key: 'insurance_expiry', label: 'التأمين', dateField: 'insurance_expiry' },
];

export interface VehicleImportRow {
  title: string;
  plate_number: string;
  registration_type?: string;
  branch?: string;
  brand?: string;
  model?: string;
  manufacture_year?: string;
  serial_number: string;
  chassis_number?: string;
  primary_color?: string;
  vehicle_status?: string;
  ownership_date?: string;
  license_expiry?: string;
  inspection_expiry?: string;
  insurance_expiry?: string;
  date_type: 'هجري' | 'ميلادي';
  item_status: 'نشط' | 'موقوف';
  responsible_phone?: string;
  reminder_rule_name?: string;
  recipients?: string;
  notes?: string;
  owner_department?: string;
  category_name?: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string; data?: unknown }>;
  imported: Array<{ serial_number: string; items_created: number }>;
}

export const useVehicleImport = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [previewData, setPreviewData] = useState<VehicleImportRow[] | null>(null);

  // Parse Excel/CSV file
  const parseFile = async (file: File): Promise<VehicleImportRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { raw: false });
          
          // Map Arabic column names to internal keys
          const mappedData = jsonData.map((row) => {
            const mapped: Record<string, unknown> = {};
            Object.entries(row).forEach(([key, value]) => {
              const cleanKey = key.trim();
              const internalKey = COLUMN_MAPPING[cleanKey] || cleanKey;
              mapped[internalKey] = value;
            });
            return mapped as unknown as VehicleImportRow;
          });
          
          resolve(mappedData);
        } catch (error) {
          reject(new Error('خطأ في قراءة الملف: ' + (error as Error).message));
        }
      };
      
      reader.onerror = () => reject(new Error('فشل في قراءة الملف'));
      reader.readAsArrayBuffer(file);
    });
  };

  // Import vehicles mutation
  const importVehicles = useMutation({
    mutationFn: async ({ 
      fileName, 
      vehicles, 
      departmentId 
    }: { 
      fileName: string; 
      vehicles: VehicleImportRow[];
      departmentId: string;
    }): Promise<ImportResult> => {
      if (!user) throw new Error('يجب تسجيل الدخول');
      if (!departmentId) throw new Error('يجب تحديد القسم');

      const results: ImportResult = {
        success: 0,
        failed: 0,
        errors: [],
        imported: [],
      };

      // Fetch reminder rules for lookup
      const { data: reminderRules } = await supabase
        .from('reminder_rules')
        .select('id, name')
        .eq('is_active', true);
      
      // Fetch recipients for lookup
      const { data: existingRecipients } = await supabase
        .from('recipients')
        .select('id, whatsapp_number, name');
      
      // Fetch categories for lookup
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name, department_id');

      for (let i = 0; i < vehicles.length; i++) {
        const vehicle = vehicles[i];
        const rowNumber = i + 2; // +2 for header row and 1-based index
        
        try {
          // Validate required fields
          if (!vehicle.serial_number) {
            results.errors.push({ row: rowNumber, error: 'الرقم التسلسلي مطلوب', data: vehicle });
            results.failed++;
            continue;
          }

          // Check for duplicate serial number
          const { data: existingItem } = await supabase
            .from('items')
            .select('id')
            .eq('dynamic_fields->>serial_number', vehicle.serial_number)
            .maybeSingle();
          
          if (existingItem) {
            results.errors.push({ row: rowNumber, error: 'الرقم التسلسلي موجود مسبقاً', data: vehicle });
            results.failed++;
            continue;
          }

          // Find reminder rule
          let reminderRuleId: string | null = null;
          if (vehicle.reminder_rule_name && reminderRules) {
            const rule = reminderRules.find(r => 
              r.name.toLowerCase().trim() === vehicle.reminder_rule_name?.toLowerCase().trim()
            );
            if (!rule) {
              results.errors.push({ 
                row: rowNumber, 
                error: `قاعدة التذكير "${vehicle.reminder_rule_name}" غير موجودة`, 
                data: vehicle 
              });
              results.failed++;
              continue;
            }
            reminderRuleId = rule.id;
          }

          // Find or validate category
          let categoryId: string | null = null;
          if (vehicle.category_name && categories) {
            const category = categories.find(c => 
              c.name.toLowerCase().trim() === vehicle.category_name?.toLowerCase().trim() &&
              (!c.department_id || c.department_id === departmentId)
            );
            if (category) {
              categoryId = category.id;
            }
          }

          // Parse recipients
          const recipientIds: string[] = [];
          if (vehicle.recipients && existingRecipients) {
            const phoneNumbers = vehicle.recipients.split(',').map(p => p.trim()).filter(Boolean);
            for (const phone of phoneNumbers) {
              const recipient = existingRecipients.find(r => r.whatsapp_number === phone);
              if (recipient) {
                recipientIds.push(recipient.id);
              } else {
                // Create new recipient
                const { data: newRecipient, error: recipientError } = await supabase
                  .from('recipients')
                  .insert({
                    name: phone,
                    whatsapp_number: phone,
                    is_active: true,
                  })
                  .select('id')
                  .single();
                
                if (!recipientError && newRecipient) {
                  recipientIds.push(newRecipient.id);
                  existingRecipients.push({ id: newRecipient.id, whatsapp_number: phone, name: phone });
                }
              }
            }
          }

          // Find responsible person
          let responsiblePerson = '';
          if (vehicle.responsible_phone) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, phone')
              .eq('phone', vehicle.responsible_phone)
              .maybeSingle();
            
            if (profile) {
              responsiblePerson = profile.full_name || vehicle.responsible_phone;
            } else {
              // Log warning but continue
              console.warn(`Row ${rowNumber}: Responsible phone ${vehicle.responsible_phone} not found in profiles`);
              responsiblePerson = vehicle.responsible_phone;
            }
          }

          // Build dynamic fields for vehicle data
          const dynamicFields = {
            plate_number: vehicle.plate_number,
            registration_type: vehicle.registration_type,
            branch: vehicle.branch,
            brand: vehicle.brand,
            model: vehicle.model,
            manufacture_year: vehicle.manufacture_year,
            serial_number: vehicle.serial_number,
            chassis_number: vehicle.chassis_number,
            primary_color: vehicle.primary_color,
            vehicle_status: vehicle.vehicle_status,
            ownership_date: vehicle.ownership_date,
            vehicle_type: 'TAMM_CAR',
          };

          // Determine item status
          const itemStatus = vehicle.item_status === 'موقوف' ? 'archived' : 'active';

          // Create items for each reminder type (license, inspection, insurance)
          let itemsCreated = 0;

          for (const reminderType of REMINDER_TYPES) {
            const dateValue = vehicle[reminderType.dateField as keyof VehicleImportRow] as string | undefined;
            
            if (!dateValue) continue; // Skip if no date provided

            // Convert date
            const convertedDate = convertDate(dateValue, vehicle.date_type);
            if (!convertedDate) {
              results.errors.push({ 
                row: rowNumber, 
                error: `تاريخ ${reminderType.label} غير صالح: ${dateValue}`, 
                data: vehicle 
              });
              continue;
            }

            // Create item
            const itemTitle = `${vehicle.title || vehicle.plate_number} - ${reminderType.label}`;
            
            const { data: newItem, error: itemError } = await supabase
              .from('items')
              .insert({
                title: itemTitle,
                category_id: categoryId,
                expiry_date: convertedDate,
                expiry_time: '07:00', // Fixed 7 AM Saudi time
                department_id: departmentId,
                owner_department: vehicle.owner_department,
                responsible_person: responsiblePerson,
                notes: vehicle.notes,
                reminder_rule_id: reminderRuleId,
                status: itemStatus,
                created_by_user_id: user.id,
                dynamic_fields: {
                  ...dynamicFields,
                  reminder_type: reminderType.key,
                  reminder_label: reminderType.label,
                },
              })
              .select('id')
              .single();

            if (itemError) {
              results.errors.push({ 
                row: rowNumber, 
                error: `خطأ في إنشاء عنصر ${reminderType.label}: ${itemError.message}`, 
                data: vehicle 
              });
              continue;
            }

            // Link recipients
            if (newItem && recipientIds.length > 0) {
              const recipientLinks = recipientIds.map(rid => ({
                item_id: newItem.id,
                recipient_id: rid,
              }));

              await supabase.from('item_recipients').insert(recipientLinks);
            }

            itemsCreated++;
          }

          if (itemsCreated > 0) {
            results.success++;
            results.imported.push({ 
              serial_number: vehicle.serial_number, 
              items_created: itemsCreated 
            });
          } else {
            results.errors.push({ 
              row: rowNumber, 
              error: 'لم يتم إنشاء أي عناصر - تأكد من وجود تواريخ صالحة', 
              data: vehicle 
            });
            results.failed++;
          }

        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
          results.errors.push({ row: rowNumber, error: errorMessage, data: vehicle });
          results.failed++;
        }
      }

      // Log import attempt
      const sanitizedErrors = results.errors.slice(0, 50).map(e => ({
        row: e.row,
        error: e.error,
      }));

      await supabase.from('automation_runs').insert([{
        job_type: 'vehicle_import',
        status: results.failed === 0 ? 'completed' : 'completed_with_errors',
        items_processed: vehicles.length,
        items_success: results.success,
        items_failed: results.failed,
        metadata: {
          file_name: fileName,
          imported_by: user.id,
          template: 'TAMM_CAR_IMPORT',
        },
        results: {
          errors: sanitizedErrors,
          imported_count: results.imported.length,
        },
      }]);

      return results;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast({
        title: 'تم الاستيراد',
        description: `تم استيراد ${data.success} مركبة بنجاح${data.failed > 0 ? ` (${data.failed} فشلت)` : ''}`,
      });
    },
    onError: (error) => {
      toast({
        title: 'خطأ في الاستيراد',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Download template
  const downloadTemplate = () => {
    const headers = Object.keys(COLUMN_MAPPING);
    const example = [
      'سيارة كامري 2024',
      'أ ب ج 1234',
      'خاص',
      'الرياض',
      'تويوتا',
      'كامري',
      '2024',
      'SN001',
      'VIN123456789',
      'أبيض',
      'نشط',
      '1445/06/15',
      '1446/01/15',
      '1446/03/20',
      '1446/06/01',
      'هجري',
      'نشط',
      '966555123456',
      'Qa',
      '966555123456,966555789012',
      'ملاحظات المركبة',
      'إدارة المركبات',
      'سيارات',
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    
    // Set column widths
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    
    XLSX.writeFile(wb, 'TAMM_CAR_IMPORT_Template.xlsx');
  };

  return {
    parseFile,
    importVehicles,
    downloadTemplate,
    previewData,
    setPreviewData,
    isImporting: importVehicles.isPending,
  };
};
