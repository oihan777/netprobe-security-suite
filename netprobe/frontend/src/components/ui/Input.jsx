import { forwardRef, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export const Input = forwardRef(({ error, success, className = '', ...p }, ref) => {
  const [focused, setFocused] = useState(false);
  const border = error ? 'border-[#c94040]/50' : success ? 'border-[#57cbde]/40' : focused ? 'border-[#57cbde]/30' : 'border-[rgba(102,192,244,0.15)]';
  return (
    <div className="relative">
      <input
        ref={ref}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`w-full bg-[rgba(102,192,244,0.08)] border ${border} rounded-lg px-3 py-2 text-sm text-white placeholder:text-[rgba(143,152,160,0.7)] focus:outline-none transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
        {...p}
      />
      {error && <AlertCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#c94040]" />}
      {success && !error && <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#66c0f4]" />}
    </div>
  );
});
Input.displayName = 'Input';
