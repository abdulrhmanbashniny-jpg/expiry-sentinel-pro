import React from 'react';
import { Building2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDepartments, useUserDepartments } from '@/hooks/useDepartments';

interface DepartmentFilterProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

const DepartmentFilter: React.FC<DepartmentFilterProps> = ({ value, onChange }) => {
  const { departments, isLoading } = useDepartments();
  const { data: userDepartments } = useUserDepartments();

  // Filter departments based on user's scopes (unless they can view all)
  const canViewAll = userDepartments?.some((ud) => ud.can_cross_view_only);
  const filteredDepartments = canViewAll
    ? departments
    : departments.filter((d) => userDepartments?.some((ud) => ud.department_id === d.id));

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select
        value={value || 'all'}
        onValueChange={(val) => onChange(val === 'all' ? null : val)}
        disabled={isLoading}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="جميع الأقسام" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">جميع الأقسام</SelectItem>
          {filteredDepartments.map((dept) => (
            <SelectItem key={dept.id} value={dept.id}>
              {dept.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default DepartmentFilter;
