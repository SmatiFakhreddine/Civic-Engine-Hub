import React from 'react';

interface StatOutputs {
    mean: number;
    variance: number;
    stdDev: number;
    marginError95: number;
}

interface AcademicProps {
    stats: StatOutputs;
    matrixSolution: number[];
}

export default function AcademicView({ stats, matrixSolution }: AcademicProps) {
    return (
        <div className="grid grid-cols-1 gap-6 bg-slate-900 text-emerald-400 p-6 rounded-xl border border-slate-800 font-mono">
            <div>
                <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">🔬 Noyau Algorithmique Pas-à-Pas</h3>
                <div className="mt-4 space-y-4">
                    <div>
                        <p className="text-white underline font-semibold">// 1. Intégration Continue de Riemann (Trapèzes)</p>
                        {/* <p className="text-slate-400 text-xs">$$\int_{a}^{b} f(x)dx \approx \sum_{i=0}^{n-1} \frac{f(x_i)+f(x_{i+1})}{2} \Delta x_i$$</p> */}
                    </div>
                    <div>
                        <p className="text-white underline font-semibold">// 2. Résolution Système Linéaire (Espace de Hilbert / Moindres Carrés)</p>
                        <p className="text-slate-300">Vecteur Solution X = [ {matrixSolution.map(v => v.toFixed(4)).join(' ; ')} ]</p>
                    </div>
                </div>
            </div>

            <div className="border-t border-slate-800 pt-4">
                <h3 className="text-lg font-bold text-white mb-3">📈 Métrologie Spatiale & Distribution de Gauss</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950 p-4 rounded border border-slate-800">
                    <div><p className="text-xs text-slate-400">Moyenne (μ)</p><p className="text-lg font-bold text-yellow-400">{stats.mean.toFixed(6)}</p></div>
                    <div><p className="text-xs text-slate-400">Variance (σ²)</p><p className="text-lg font-bold text-yellow-400">{stats.variance.toFixed(6)}</p></div>
                    <div><p className="text-xs text-slate-400">Écart-Type (σ)</p><p className="text-lg font-bold text-yellow-400">{stats.stdDev.toFixed(6)}</p></div>
                    <div><p className="text-xs text-slate-400">IC (95%)</p><p className="text-lg font-bold text-white">± {(stats.marginError95 * 100).toFixed(3)} cm</p></div>
                </div>
            </div>
        </div>
    );
}