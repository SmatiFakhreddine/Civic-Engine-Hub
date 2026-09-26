// src/components/views/TopographyRoute.tsx
import React, { useState } from 'react';
import Altimetrie from './TopographyAlt';
import Planemetrie from './TopographyPlan';
import Relevement from './TopographyRelev';


export default function TopographyRoute({ isAcademicMode }: { isAcademicMode: boolean }) {
    const [subDivision, setSubDivision] = useState<'sd1' | 'sd2' | 'sd3'>('sd1');

    return (
    <div className="space-y-6">
        {/* BARRE DE SÉLECTION MAJEURE */}
        <div className={`flex gap-2 border-b ${isAcademicMode ? 'border-slate-800' : 'border-slate-200'} overflow-x-auto pb-2`}>
            <button onClick={() => setSubDivision('sd1')} className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition cursor-pointer ${subDivision === 'sd1' ? 'bg-blue-600 text-white' : !isAcademicMode ? 'bg-slate-100 text-slate-600' : 'bg-slate-900 text-slate-200'}`}>
                1. Altimétrie & Nivellement Pur
            </button>
            <button onClick={() => setSubDivision('sd2')} className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition cursor-pointer ${subDivision === 'sd2' ? 'bg-blue-600 text-white' : !isAcademicMode ? 'bg-slate-100 text-slate-600' : 'bg-slate-900 text-slate-200'}`}>
                2. Planimétrie & Altimétrie
            </button>
            <button onClick={() => setSubDivision('sd3')} className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition cursor-pointer ${subDivision === 'sd3' ? 'bg-blue-600 text-white' : !isAcademicMode ? 'bg-slate-100 text-slate-600' : 'bg-slate-900 text-slate-200'}`}>
                3. Relèvement Géodésique
            </button>
        </div>
        <div className="space-y-8 p-6 max-w-7xl mx-auto text-base">
            
            {/* ────────────────────────────────────────────────────────────────────── */}
            {/* 📊 SOUS-DIVISION 1 : ALTIMÉTRIE PURE & CUBATURE LINÉAIRE               */}
            {/* ────────────────────────────────────────────────────────────────────── */}
            {subDivision === 'sd1' && (
                <Altimetrie isAcademicMode={isAcademicMode} />
            )}


            {/* ────────────────────────────────────────────────────────────────────── */}
            {/* 📐 SOUS-DIVISION 2 : PLANIMÉTRIE & COORDONNÉES PAR VISÉE DE RÉFÉRENCE   */}
            {/* ────────────────────────────────────────────────────────────────────── */}
            {subDivision === 'sd2' && (
                <Planemetrie isAcademicMode={isAcademicMode} />  
            )}
            

            {/* ────────────────────────────────────────────────────────────────────── */}
            {/* 🎯 SOUS-DIVISION 3 : RELÈVEMENT GÉODÉSIQUE PUR                        */}
            {/* ────────────────────────────────────────────────────────────────────── */}
            {subDivision === 'sd3' && (
                <Relevement isAcademicMode={isAcademicMode} />
            )}

        </div>
    </div>
)}