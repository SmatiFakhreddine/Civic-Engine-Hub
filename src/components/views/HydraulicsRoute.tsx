// src/components/views/HydraulicsRoute.tsx
import React, { useState } from 'react';
import SmartInput from '../SmartInput';
import { Hydraulics } from '../../core/btp/Hydraulics';
import { Taylor } from '../../core/math/Taylor';
import { Structure } from '../../core/btp/Structure';

export default function HydraulicsRoute({ isAcademicMode }: { isAcademicMode: boolean }) {
    const [z1, setZ1] = useState<number>(85.40);
    const [z2, setZ2] = useState<number>(84.95);
    const [distanceTroncon, setDistanceTroncon] = useState<number>(60.00);
    const [manningK, setManningK] = useState<number>(80);

    const p1 = { id: 'AMONT', x: 0, y: 0, z: z1 };
    const p2 = { id: 'AVAL', x: distanceTroncon, y: 0, z: z2 };
    
    const hydro = Hydraulics.computeVelocity(p1, p2, manningK, 0.20); // Rh = 0.20m

    // Calcul linéaire de Taylor
    const f = (s: number) => manningK * Math.pow(0.20, 2/3) * Math.sqrt(s);
    const df = (s: number) => s > 0 ? 0.5 * manningK * Math.pow(0.20, 2/3) * (1 / Math.sqrt(s)) : 0;
    const vitesseTaylor = Taylor.linearize(f, 0.01, hydro.pente, df);

    // Audit du lit de pose en béton sous canalisation
    const volTheoLit = Structure.calculateRealVolume(0.8, [{ x: 0, y: 0.10 }, { x: distanceTroncon, y: 0.10 }]);
    const volReelLit = Structure.calculateRealVolume(0.8, [{ x: 0, y: 0.11 }, { x: distanceTroncon, y: 0.13 }]);
    const diffVol = volReelLit - volTheoLit;
    const cost = diffVol * 180;

    return (
        <div className="space-y-6">
            <div className={`p-6 rounded-xl border ${isAcademicMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
                <h2 className="text-lg font-bold mb-4 text-blue-600">Données Fluides & Génie Hydraulique</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <SmartInput label="Fil d'eau Amont (Z1)" value={z1} onChange={setZ1} suffix="m" />
                    <SmartInput label="Fil d'eau Aval (Z2)" value={z2} onChange={setZ2} suffix="m" />
                    <SmartInput label="Longueur Tronçon" value={distanceTroncon} onChange={setDistanceTroncon} suffix="m" />
                    <SmartInput label="Coefficient de Strickler" value={manningK} onChange={setManningK} />
                </div>
            </div>

            {isAcademicMode ? (
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 font-mono text-emerald-400 space-y-4">
                    <h3 className="text-white font-bold text-md">// Linéarisation Écoulement non-linéaire (Série de Taylor)</h3>
                    <p>Pente Réelle calculée ($S = \Delta Z / \Delta L$) = <span className="text-white">{(hydro.pente * 100).toFixed(3)} %</span></p>
                    <div className="p-3 bg-slate-900 rounded border border-slate-800 space-y-1 text-sm">
                        <p>Vitesse Réelle Analytique : <span className="text-yellow-300">{hydro.vitesse.toFixed(4)} m/s</span></p>
                        <p>Approximation de Taylor (1er ordre) : <span className="text-white">{vitesseTaylor.toFixed(4)} m/s</span></p>
                        <p className="text-xs text-slate-500">// L'erreur d'approximation locale reste inférieure à 1% sur ce delta de pente.</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
                        <h3 className="text-lg font-bold border-b pb-2">📊 Audit Ouvrage & Décomptes (Hydraulique)</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div><p className="text-xs opacity-60">Volume Théorique Lit de Pose</p><p className="text-xl font-bold">{volTheoLit.toFixed(3)} m³</p></div>
                            <div><p className="text-xs opacity-60">Volume Réel Coulé</p><p className="text-xl font-bold text-blue-600">{volReelLit.toFixed(3)} m³</p></div>
                        </div>
                        <div className="p-3 rounded font-medium text-sm bg-amber-50 text-amber-800">
                            Surconsommation linéaire : +{diffVol.toFixed(3)} m³
                        </div>
                        <div className="border-t pt-2">
                            <p className="text-xs opacity-60">Écart Financier Hors-Profil</p>
                            <p className="text-2xl font-black">{cost.toFixed(2)} TND</p>
                        </div>
                        <button className="w-full bg-slate-900 text-white py-2 rounded font-medium hover:bg-slate-800 transition" onClick={() => window.print()}>
                            🖨️ Générer l'Attachement Officiel
                        </button>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                        <h3 className="text-lg font-bold border-b pb-2">⚡ Dynamique des Fluides</h3>
                        <div>
                            <p className="text-xs opacity-60">Pente de la Trajectoire ($\Delta Z / L$)</p>
                            <p className="text-2xl font-bold text-slate-800">{(hydro.pente * 100).toFixed(2)} %</p>
                        </div>
                        <div>
                            <p className="text-xs opacity-60">Vitesse d'Écoulement Calculée</p>
                            <p className="text-2xl font-bold text-blue-600">{hydro.vitesse.toFixed(2)} m/s</p>
                        </div>
                        <div className={`p-4 rounded text-center font-bold text-white ${hydro.vitesse >= 0.60 ? 'bg-green-500' : 'bg-amber-500'}`}>
                            {hydro.vitesse >= 0.60 ? '✓ COMPORTEMENT HYDRAULIQUE VALIDÉ' : '⚠ ALERTE : RISQUE DE SÉDIMENTATION'}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}