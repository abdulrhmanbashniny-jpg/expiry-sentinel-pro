-- Add missing columns to user_invitations table
ALTER TABLE user_invitations 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS employee_number TEXT,
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);