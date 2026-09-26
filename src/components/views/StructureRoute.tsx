// src/components/views/StructureRoute.tsx
import React, { useState } from 'react';
import { BeamCalculatorApp as BeamCalculator } from './BeamCalculatorApp';

export default function StructureRoute({ isAcademicMode }: { isAcademicMode: boolean }) {
    const [subDivision, setSubDivision] = useState<'sd1' | 'sd2' | 'sd3' | 'sd4' | 'sd5' | 'sd6' | 'sd7' | 'sd8'>('sd1');
    
    return (
    <div className="space-y-6">
        <div className={`flex gap-2 border-b ${isAcademicMode ? 'border-slate-800' : 'border-slate-200'} overflow-x-auto pb-2`}>
            <button onClick={() => setSubDivision('sd1')} className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition ${subDivision === 'sd1' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                1. Dalle
            </button>
            <button onClick={() => setSubDivision('sd2')} className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition ${subDivision === 'sd2' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                2. Poutre
            </button>
            <button onClick={() => setSubDivision('sd3')} className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition ${subDivision === 'sd3' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                3. Poteau
            </button>
            <button onClick={() => setSubDivision('sd4')} className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition ${subDivision === 'sd4' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                4. Chape
            </button>
            <button onClick={() => setSubDivision('sd5')} className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition ${subDivision === 'sd5' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
               5. Longrine
            </button> 
            <button onClick={() => setSubDivision('sd6')} className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition ${subDivision === 'sd6' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
               6. Semelle
            </button> 
            <button onClick={() => setSubDivision('sd7')} className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition ${subDivision === 'sd7' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
               7. Voile
            </button> 
            <button onClick={() => setSubDivision('sd8')} className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition ${subDivision === 'sd8' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
               8. Gros Beton
            </button> 
        </div>
        <div className="space-y-8 p-6 max-w-7xl mx-auto text-base">

        {subDivision === 'sd1' && (
            <BeamCalculator
                isAcademicMode={isAcademicMode} />
            )}

        </div> 
    </div>);
}