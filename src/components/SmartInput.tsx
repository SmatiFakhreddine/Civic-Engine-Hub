import React from 'react';

interface InputProps {
    label: string;
    value: number;
    onChange: (val: number) => void;
    suffix?: string;
}

export default function SmartInput({ label, value, onChange, suffix }: InputProps) {
    return (
        <div className="flex flex-col gap-1 w-full">
            <label className="text-xs font-bold uppercase tracking-wide opacity-75">{label}</label>
            <div className="relative">
                <input 
                    type="number" 
                    value={value} 
                    onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border rounded bg-transparent border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {suffix && <span className="absolute right-3 top-2 text-sm opacity-50">{suffix}</span>}
            </div>
        </div>
    );
}