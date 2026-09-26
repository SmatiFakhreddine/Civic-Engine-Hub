// src/App.tsx
import React, { useState } from 'react';
import logo from './assets/logo.png';
import Sidebar from './components/Sidebar';
import TopographyRoute from './components/views/TopographyRoute';
import StructureRoute from './components/views/StructureRoute';
import HydraulicsRoute from './components/views/HydraulicsRoute';

export default function App() {
    const [isAcademicMode, setIsAcademicMode] = useState<boolean>(false);
    const [currentRoute, setCurrentRoute] = useState<string>('topography'); // Route par défaut

    // Fonction de rendu dynamique du routeur
    const renderRoute = () => {
        switch (currentRoute) {
            case 'topography':
                return <TopographyRoute isAcademicMode={isAcademicMode} />;
            case 'structure':
                return <StructureRoute isAcademicMode={isAcademicMode} />;
            case 'hydraulics':
                return <HydraulicsRoute isAcademicMode={isAcademicMode} />;
            default:
                return <TopographyRoute isAcademicMode={isAcademicMode} />;
        }
    };

    return (
        <div className={`flex min-h-screen ${isAcademicMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
            <Sidebar 
                isAcademicMode={isAcademicMode} 
                currentRoute={currentRoute} 
                setCurrentRoute={setCurrentRoute} 
            />
            
            <div className="flex-1 flex flex-col">
                <header className={`h-16 border-b flex items-center justify-between px-6 ${isAcademicMode ? 'bg-slate-950 text-slate-100 shadow-sm border-slate-900' : 'bg-slate-50 text-slate-900 shadow-sm border-slate-200'}`}>
                    <div className='flex items-center gap-3'>
                        <img src={logo} alt="Site Logo" width="40" />
                        <span className="font-bold tracking-wider text-xl dark:text-white">
                        CIVIC<span className="text-blue-600">ENGINE</span> HUB
                        </span>
                    </div>
                    <div className={`flex items-center gap-3 ${isAcademicMode ? 'bg-slate-900' : 'bg-slate-100'} px-4 py-2 rounded-full`}>
                        <span className={`text-xs font-semibold ${isAcademicMode ? 'text-slate-100' : 'text-slate-900'}`}>Mode Académique (Théorie)</span>
                        <input 
                            type="checkbox" 
                            className="w-4 h-4 accent-blue-600 cursor-pointer"
                            checked={isAcademicMode}
                            onChange={(e) => setIsAcademicMode(e.target.checked)}
                        />
                    </div>
                </header>
                
                <main className="p-6 flex-1 overflow-y-auto">
                    {renderRoute()}
                </main>
            </div>
        </div>
    );
}