// apps/mobile/src/lib/validators.ts
export const isValidDate = (dateStr: string): boolean => {
    return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));
  };
  
  export const isPositiveNumber = (value: string | number): boolean => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return !isNaN(num) && num > 0;
  };
  
  export const isRequired = (value: string): boolean => {
    return value.trim().length > 0;
  };