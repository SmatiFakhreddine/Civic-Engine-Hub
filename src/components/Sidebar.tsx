// src/components/Sidebar.tsx
import React from 'react';

interface SidebarProps {
    isAcademicMode: boolean;
    currentRoute: string;
    setCurrentRoute: (route: string) => void;
}

export default function Sidebar({ isAcademicMode, currentRoute, setCurrentRoute }: SidebarProps) {
    const navItems = [
        { id: 'topography', label: '📐 Topographie', icon: '📐' },
        // { id: 'structure', label: '🏗️ Structure', icon: '🏗️' },
        // { id: 'hydraulics', label: '💧 Hydraulique', icon: '💧' }
    ];

    const year = new Date().getFullYear();

    return (
        <aside className={`w-64 border-r p-4 flex flex-col gap-6 transition-colors duration-300 ${isAcademicMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'}`}>
            <div className="text-center font-bold py-2 border-b border-slate-700 tracking-wider">MODULES BTP</div>
            <nav className="flex flex-col gap-2">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setCurrentRoute(item.id)}
                        className={`text-left py-2.5 px-4 rounded text-sm font-medium transition-all cursor-pointer ${
                            currentRoute === item.id 
                                ? 'bg-blue-600 text-white shadow-md' 
                                : 'hover:bg-slate-500/10'
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </nav>
            <div className="mt-auto text-xs opacity-50 text-center font-mono">
            <span className='text-sm'>©</span> {year} CIVICENGINE HUB. 
            <br />
            All rights reserved.
            </div>
        </aside>
    );
}