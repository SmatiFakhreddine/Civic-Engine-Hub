import React from 'react';

interface ExecutorProps {
    data: {
        volTheo: number; volReal: number; diffVol: number; cost: number;
        pente: number; vitesse: number; status: string;
    };
}

export default function ExecutorView({ data }: ExecutorProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
                <h3 className="text-lg font-bold border-b pb-2">📊 Audit Ouvrage & Décomptes</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-xs opacity-60">Volume Théorique</p><p className="text-xl font-bold">{data.volTheo.toFixed(3)} m³</p></div>
                    <div><p className="text-xs opacity-60">Volume Réel Levé</p><p className="text-xl font-bold text-blue-600">{data.volReal.toFixed(3)} m³</p></div>
                </div>
                <div className={`p-3 rounded font-medium text-sm ${data.diffVol > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                    Écart de matière : {data.diffVol > 0 ? `+${data.diffVol.toFixed(3)}` : data.diffVol.toFixed(3)} m³ 
                    ({((data.diffVol / data.volTheo) * 100).toFixed(2)}%)
                </div>
                <div className="border-t pt-2">
                    <p className="text-xs opacity-60">Impact Financier (Attachement)</p>
                    <p className="text-2xl font-black">{data.cost.toFixed(2)} TND</p>
                </div>
                <button className="w-full bg-slate-900 text-white py-2 rounded font-medium hover:bg-slate-800 transition" onClick={() => window.print()}>
                    🖨️ Générer l'Attachement Officiel
                </button>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
                <h3 className="text-lg font-bold border-b pb-2">⚡ Statut de Conformité Hydraulique</h3>
                <div><p className="text-xs opacity-60">Pente de la Trajectoire</p><p className="text-xl font-bold">{(data.pente * 100).toFixed(2)} %</p></div>
                <div><p className="text-xs opacity-60">Vitesse d'Écoulement Calculée</p><p className="text-xl font-bold">{data.vitesse.toFixed(2)} m/s</p></div>
                <div className={`mt-auto p-4 rounded text-center font-bold tracking-wide ${data.status === 'CONFORME' ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'}`}>
                    {data.status === 'CONFORME' ? '✓ PROJET CONFORME AUX NORMES' : '⚠ ALERTE : HORS TOLÉRANCE'}
                </div>
            </div>
        </div>
    );
}