// src/components/TopoDashboard.tsx
import React, { useState, useMemo } from 'react';
import SmartInput from '../SmartInput';
import { Topography } from '../../core/btp/Topography';
import '../../styles/TopographyCharts.css';
import Plot from 'react-plotly.js';

// --- Types ---
interface PointTopo2D {
    id: string;
    angleGrad?: number;       // Angle horizontal lu à la station en gon
    distanceHoriz?: number;   // Dh en m
    lectureAxial?: number;
    coteProjet?: number;      
    x?: number;
    y?: number;
    z?: number;
}

interface DataPoint {
  id: string;
  x: number;
  y: number;
  z: number;
  angle: number;
}

interface ProfileSeries {
  name: string;               
  points: DataPoint[];        
}

interface GridData {
  gx: number[];
  gy: number[];
  gridZ: number[][];
}

// Props du composant
interface TopoDashboardProps {
  dataPoints?: DataPoint[];
  additionalProfiles?: ProfileSeries[];
  pointStationneA?: DataPoint;
  isAcademicMode?: boolean;
  resolution?: number; // résolution de la grille d'interpolation (défaut 30)
}

// --- Interpolation IDW ---
function interpolateGrid(points: DataPoint[], resolution: number = 30): GridData {
  
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const zs = points.map(p => p.z);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = (maxX - minX) * 0.1 || 10;

  const gx: number[] = [];
  const gy: number[] = [];
  for (let i = 0; i < resolution; i++) {
    gx.push(minX - pad + ((maxX - minX + 2 * pad) * i) / (resolution - 1));
  }
  for (let j = 0; j < resolution; j++) {
    gy.push(minY - pad + ((maxY - minY + 2 * pad) * j) / (resolution - 1));
  }

  const gridZ: number[][] = [];
  for (let i = 0; i < resolution; i++) {
    gridZ[i] = [];
    for (let j = 0; j < resolution; j++) {
      let sumW = 0;
      let sumWZ = 0;
      for (let k = 0; k < points.length; k++) {
        const dx = gx[i] - points[k].x;
        const dy = gy[j] - points[k].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const w = 1 / (dist + 0.001);
        sumW += w;
        sumWZ += w * points[k].z;
      }
      gridZ[i][j] = sumWZ / sumW;
    }
  }
  return { gx, gy, gridZ };
}

// ---------- Palette de couleurs pour les profils supplémentaires ----------
const PROFILE_COLORS = ['#00d2ff', '#5f27cd', '#fe4357', '#ff9ff3', '#54a0ff', '#ff6b6b'];

// --- Composant principal ---
const TopoDashboard: React.FC<TopoDashboardProps> = ({ isAcademicMode }) => {

  // ── BORDEREAU DES PRIX UNITAIRES (BPU TUNISIE) ──
  const TARIF_DEBLAI = 14.500;  // TND / m³
  const TARIF_REMBLAI = 18.200; // TND / m³
      
  const [typeCheminementSD2, setTypeCheminementSD2] = useState<'ferme' | 'ouvert_ajuste' | 'ouvert_non_ajuste'>('ferme');
  const [compensation2, setCompensation2] = useState<'distance' | 'points' | 'temps'>('temps');
  
  
  // ── ÉTATS SOUS-DIVISION 2 (PLANIMÉTRIE MULTI-PARALLÈLE) ──
  const [stX, setStX] = useState<number>(500000); 
  const [stY, setStY] = useState<number>(400000); 
  const [stZ, setStZ] = useState<number>(125.00);
  const [hauteurAppareil, setHauteurAppareil] = useState<number>(1.50);
  const [refX, setRefX] = useState<number>(500085); 
  const [refY, setRefY] = useState<number>(400120);
  const [lectB, setLectB] = useState<number>(0.000); 
  const [zFinal_sd2, setZFinal_sd2] = useState<number>(125.010);
  const [pointsSD2, setPointsSD2] = useState<PointTopo2D[]>([
      { id: 'PT1', angleGrad: 52.40, distanceHoriz: 75.00, lectureAxial: 1.420, coteProjet: 124.80 },
      { id: 'PT2', angleGrad: 165.15, distanceHoriz: 110.20, lectureAxial: 1.150, coteProjet: 125.30 },
      { id: 'PT3', angleGrad: 285.60, distanceHoriz: 64.50, lectureAxial: 1.580, coteProjet: 124.95 }
  ]);
  
  // ── HANDLERS D'AJOUT ET SUPPRESSION DES LIGNES ──
  const addRowSD2 = () => setPointsSD2([...pointsSD2, { id: `PT${pointsSD2.length + 1}`, angleGrad: 0, distanceHoriz: 0, lectureAxial: hauteurAppareil, coteProjet: stZ }]);
  const deleteRowSD2 = (item: PointTopo2D) => {
    const newPointsSD2 = pointsSD2.filter((p) => item.id !== 'PT1' ? p.id !== item.id : true);
    const newIndexedPointsSD2 = newPointsSD2.map((p, i) => { p.id = `PT${i + 1}`; return p; });
    setPointsSD2(newIndexedPointsSD2);
  };
  
    const resSD2 = Topography.computePlanimetrieParallere2(pointsSD2, { x: stX, y: stY, z: stZ }, hauteurAppareil, { x: refX, y: refY }, lectB, zFinal_sd2, typeCheminementSD2, compensation2);
    const completSD2 = pointsSD2.every(p => p.angleGrad !== undefined && p.distanceHoriz !== undefined && p.lectureAxial !== undefined && p.coteProjet !== undefined);
    const coutSD2 = completSD2 ? (resSD2.deblaiOrganique * TARIF_DEBLAI) + (resSD2.remblaiOrganique * TARIF_REMBLAI) : null;
    const graphPoints2 = resSD2.points.map((item) => {
    const point = {
        id: item.id,
        x: item.x ?? 0,
        y: item.y ?? 0,
        z: item.zComp ?? item.zBrut ?? 0,
        angle: item.angleGrad ?? 0
        }
      return point;
    });
    const coteProjet2 = resSD2.points.map((item) => ({
        id: item.id,
        x: item.x!,
        y: item.y!,
        z: item.coteProjet!,
        angle: item.angleGrad!
    }));
    const pointStationneA = { id: 'St A', x: stX, y: stY, z: stZ, angle: lectB };
      
    if (typeCheminementSD2 === 'ferme') {
        graphPoints2.splice(-1);
        coteProjet2.splice(-1);
    }; // Fermeture du tracé pour la visualisation

  const additionalProfiles: ProfileSeries[] = [{ 
    name: 'Cote Projet', 
    points: coteProjet2 
  }];

  // Génération de la grille interpolée
  const { gx, gy, gridZ } = useMemo<GridData>(
    () => interpolateGrid(graphPoints2, 30),
    [graphPoints2, 30]
  );

  const data = graphPoints2.map((p, i) => ({id: 'PT' + (i + 1), x: p.x, y: p.y, z: p.z, angle: p.angle }));
  const sortedByX = [...data].sort((a, b) => a.x - b.x);
  const sortedByAngle = [...data].sort((a, b) => a.angle - b.angle);
  const profilX = [...graphPoints2].map(p => p.x);
  const SortedXProfilX = [...sortedByX].map(p => p.x);
  const SortedAngProfilX = [...sortedByAngle].map(p => p.x);
  const profilY = [...graphPoints2].map(p => p.y);
  const SortedXProfilY = [...sortedByX].map(p => p.y);
  const SortedAngProfilY = [...sortedByAngle].map(p => p.y);
  const profilZ = [...graphPoints2].map(p => p.z);
  const SortedXProfilZ = [...sortedByX].map(p => p.z);
  const SortedAngProfilZ = [...sortedByAngle].map(p => p.z);
  const points = [...data].map(p => p.id);
  const SortedXPoints = [...sortedByX].map(p => p.id);
  const SortedAngPoints = [...sortedByAngle].map(p => p.id);

  const profileTraces = useMemo<any[]>(() => {
        const traces: any[] = [];
  
    if (graphPoints2.length > 0) {
        traces.push({
          type: 'scatter',
          mode: 'lines+markers',
          x: SortedXProfilX,
          y: SortedXProfilZ,
          text: SortedXPoints,
          line: { color: '#fcef42', width: 2.5, shape: 'spline', smoothing: 0.4 },
          marker: { size: 5, colorscale: 'Viridis' },
          name: 'Cote TN',
          hovertemplate: '%{text}<br>X: %{x:.3f}<br>Z: %{y:.3f}<extra></extra>',
        });
      }
  
    // Profils supplémentaires
      additionalProfiles.forEach((serie, idx) => {
        if (serie.points.length > 0) {
            const sorted = [...serie.points].sort((a, b) => a.x - b.x);
            const x = [...sorted].map(p => p.x);
            const z = [...sorted].map(p => p.z);
            const color = PROFILE_COLORS[idx];
            traces.push({
              type: 'scatter',
              mode: 'lines+markers',
              x: x,
              y: z,
              text: SortedXPoints,
              line: { color, width: 2.5, shape: 'spline', smoothing: 0.4 },
              marker: { size: 5 },
              name: serie.name,
              hovertemplate: `%{text}<br>X: %{x:.3f}<br>Z: %{y:.3f}<extra></extra>`,
            });
          
        }
      });
  
      return traces;
    }, [graphPoints2, additionalProfiles]);

  // Construction du wireframe 3D
  const wireframe: { x: (number | null)[]; y: (number | null)[]; z: (number | null)[] } = {
    x: [],
    y: [],
    z: [],
  };
  for (let i = 0; i < gx.length; i++) {
    for (let j = 0; j < gy.length; j++) {
      if (j < gy.length - 1) {
        wireframe.x.push(gx[i], gx[i], null);
        wireframe.y.push(gy[j], gy[j + 1], null);
        wireframe.z.push(gridZ[i][j], gridZ[i][j + 1], null);
      }
      if (i < gx.length - 1) {
        wireframe.x.push(gx[i], gx[i + 1], null);
        wireframe.y.push(gy[j], gy[j], null);
        wireframe.z.push(gridZ[i][j], gridZ[i + 1][j], null);
      }
    }
  }

  // Styles inline (vous pouvez les déplacer dans un fichier CSS)
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: '20px',
    width: '100%',
  };

  const cardStyle: React.CSSProperties = {
      background: '#020617',
      borderRadius: '12px',
      border: '1px solid rgb(30, 41, 59)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      minHeight: '480px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
    };

  const headerStyle: React.CSSProperties = {
      padding: '10px 15px',
      background: 'rgb(30, 41, 59)',
      fontWeight: 600,
      color: '#fff',
      letterSpacing: '1px',
  };

  const plotWrapperStyle: React.CSSProperties = {
      flex: 1,
      minHeight: 0,
      width: '100%',
    };

  // Thème sombre commun
  const darkLayout = {
    paper_bgcolor: '#020617',
    plot_bgcolor: '#020617',
    font: { color: '#eee' },
  };

  return (

    <div className="space-y-7">

    {/* ────────────────────────────────────────────────────────────────────── */}
    {/* 📊 SOUS-DIVISION 1 : ALTIMÉTRIE PURE & CUBATURE LINÉAIRE               */}
    {/* ────────────────────────────────────────────────────────────────────── */}

    <div className={`p-6 rounded-2xl border ${isAcademicMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} grid grid-cols-1 md:grid-cols-3 gap-6 shadow-sm`}>
      <div className="space-y-3">
          <h4 className="text-xs font-black uppercase text-blue-600 tracking-wider">Station d'Appareil active (A)</h4>
          <SmartInput label="Coordonnée X_A STT (m)" value={stX} onChange={setStX} />
          <SmartInput label="Coordonnée Y_A STT (m)" value={stY} onChange={setStY} />
          <SmartInput label="Altitude Z_A Réelle (m)" value={stZ} onChange={setStZ} />
          <SmartInput label="Hauteur de l'Appareil (m)" value={hauteurAppareil} onChange={setHauteurAppareil} />
      </div>
      <div className="space-y-3">
          <h4 className="text-xs font-black uppercase text-blue-600 tracking-wider">Axe de Référence Connu (B)</h4>
          <SmartInput label="Coordonnée X_B STT (m)" value={refX} onChange={setRefX} />
          <SmartInput label="Coordonnée Y_B STT (m)" value={refY} onChange={setRefY} />
          <SmartInput label="Lecture Azimutale sur B (grad)" value={lectB} onChange={setLectB} />
      </div>
      <div className="space-y-3">
          <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">Configuration de Clôture</h4>
          <div className="flex flex-col mb-1">
              <label className="text-xs font-black text-slate-400 uppercase mb-1">Type de Rayonnement</label>
              <select className={`p-3 border ${isAcademicMode ? 'bg-slate-900' : 'bg-white'} border-slate-300 rounded-xl font-bold text-sm h-12`} value={typeCheminementSD2} onChange={(e) => setTypeCheminementSD2(e.target.value as any)}>
                  <option value="ferme">Fermé</option>
                  <option value="ouvert_ajuste">Ouvert ajusté</option>
                  <option value="ouvert_non_ajuste">Ouvert non ajusté</option>
              </select>
          </div>
          {typeCheminementSD2 === 'ouvert_ajuste' && <SmartInput label="Z Final Théorique (m)" value={zFinal_sd2} onChange={setZFinal_sd2} />}
          {typeCheminementSD2 !== 'ouvert_non_ajuste' && (
          <>
          <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">Configuration de Clôture</h4>
          <div className="flex flex-col mb-1">
              <label className="text-xs font-black text-slate-400 uppercase mb-1">Paramétre de Compensation</label>
              <select className={`p-3 border ${isAcademicMode ? 'bg-slate-900' : 'bg-white'} border-slate-300 rounded-xl font-bold text-sm h-12`} value={compensation2} onChange={(e) => setCompensation2(e.target.value as any)}>
                  {typeCheminementSD2 === 'ouvert_ajuste' ? (
                      <>
                          <option value="distance">Distance</option>
                          <option value="points">Points</option>
                          <option value="temps">Temps</option>
                      </>
                  ) :
                      <option value="temps">Temps</option>
                  }
              </select>
          </div>
          </>
          )}
      </div>
    </div>
    {!isAcademicMode ? (
                      <div className="space-y-7">
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-black text-slate-800 text-base uppercase tracking-wider">Matrice Commune d'Implantation Spatiale</h3>
                                <button onClick={addRowSD2} className="bg-blue-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-blue-700 transition">➕ Insérer Vecteur Parallèle</button>
                            </div>
                            <table className="w-full text-left font-mono text-base border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b text-slate-500 uppercase text-xs">
                                        <th className="p-4">Point</th>
                                        <th className="p-4 bg-yellow-50/40">Angle Lu (grad)</th>
                                        <th className="p-4 bg-yellow-50/40">Dist. Horiz (m)</th>
                                        <th className="p-4 bg-blue-50/40">Lect. Ax (m)</th>
                                        <th className="p-4">Cote Projet (m)</th>
                                        <th className="p-4 text-slate-900">Calcul X (STT)</th>
                                        <th className="p-4 text-slate-900">Calcul Y (STT)</th>
                                        <th className="p-4 text-blue-600">Z Brut</th>
                                        <th className="p-4 text-emerald-600">Z Compensé</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y font-bold text-base">
                                    {resSD2.points.map((p, i) => (
                                        <tr key={p.id} className="hover:bg-slate-50/40">
                                            <td className={typeCheminementSD2 !== 'ouvert_non_ajuste' && ( i === 0 || i === resSD2.points.length - 1) ? 'p-4 text-emerald-900' : 'p-4'}>
                                                {typeCheminementSD2 === 'ferme' && i === resSD2.points.length - 1 ? 'PT1' : p.id}
                                            </td>
                                            <td className="p-2 bg-yellow-50/10"><input type="number" className={`p-2 border ${typeCheminementSD2 === 'ferme' && i === resSD2.points.length - 1 ? 'bg-slate-300' : 'bg-slate-50'} rounded-lg w-full font-black`} value={typeCheminementSD2 === 'ferme' && i === resSD2.points.length - 1 ? resSD2.points[0].angleGrad : p.angleGrad} onChange={(e) => { const updated = [...pointsSD2]; updated[i].angleGrad = e.target.value !== '' ? parseFloat(e.target.value) : undefined; setPointsSD2(updated); }} disabled={typeCheminementSD2 === 'ferme' && i === resSD2.points.length - 1} /></td>
                                            <td className="p-2 bg-yellow-50/10"><input type="number" className={`p-2 border ${typeCheminementSD2 === 'ferme' && i === resSD2.points.length - 1 ? 'bg-slate-300' : 'bg-slate-50'} rounded-lg w-full font-black`} value={typeCheminementSD2 === 'ferme' && i === resSD2.points.length - 1 ? resSD2.points[0].distanceHoriz : p.distanceHoriz} onChange={(e) => { const updated = [...pointsSD2]; updated[i].distanceHoriz = e.target.value !== '' ? parseFloat(e.target.value) : undefined; setPointsSD2(updated); }} disabled={typeCheminementSD2 === 'ferme' && i === resSD2.points.length - 1} /></td>
                                            <td className="p-2 bg-blue-50/10"><input type="number" className="p-2 border rounded-lg w-full bg-slate-50 font-black" value={p.lectureAxial ?? ''} onChange={(e) => { const updated = [...pointsSD2]; updated[i].lectureAxial = e.target.value !== '' ? parseFloat(e.target.value) : undefined; setPointsSD2(updated); }} /></td>
                                            <td className="p-2"><input type="number" className={`p-2 border ${typeCheminementSD2 === 'ferme' && i === resSD2.points.length - 1 ? 'bg-slate-300' : 'bg-slate-50'} rounded-lg w-full font-black`} value={typeCheminementSD2 === 'ferme' && i === resSD2.points.length - 1 ? resSD2.points[0].coteProjet : p.coteProjet} onChange={(e) => { const updated = [...pointsSD2]; updated[i].coteProjet = e.target.value !== '' ? parseFloat(e.target.value) : undefined; setPointsSD2(updated); }} disabled={typeCheminementSD2 === 'ferme' && i === resSD2.points.length - 1} /></td>
                                            <td className="p-2 text-slate-700 rounded-lg font-black">{typeCheminementSD2 === 'ferme' && i === resSD2.points.length - 1 ? resSD2.points[0].x?.toFixed(3) : p.x?.toFixed(3)}</td>
                                            <td className="p-2 text-slate-700 rounded-lg font-black">{typeCheminementSD2 === 'ferme' && i === resSD2.points.length - 1 ? resSD2.points[0].y?.toFixed(3) : p.y?.toFixed(3)}</td>
                                            <td className="p-4 text-blue-600">{p.zBrut ? p.zBrut.toFixed(3) : '--'}</td>
                                            <td className="p-4 text-emerald-600">{typeCheminementSD2 !== 'ouvert_non_ajuste' ? p.zComp ? p.zComp.toFixed(3) : '--' : '--'}</td>                                      
                                            <td>
                                            <button onClick={() => deleteRowSD2(p)} className="text-red-500 text-xs font-bold px-2.5 py-1.5 rounded-xl hover:bg-gray-300 py-1 px-2 rounded cursor-pointer">
                                                🗑️
                                            </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* CARTES D'AUDIT POUR LA SOUS-DIVISION 2 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <h3 className="font-black text-slate-800 text-sm uppercase border-b pb-2">📊 Métrés de Surface & Volumes</h3>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="bg-gray-100 p-3 rounded">
                                    <p className="text-xs text-bold-800 block">Surface Emprise (Gauss)</p>
                                    <strong className="text-xl text-bold-950">{resSD2.surfaceGauss.toFixed(2)} m²</strong>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-amber-50 p-3 rounded">
                                    <p className="text-xs text-amber-800 block">Volume de Déblai</p>
                                    <strong className="text-xl text-amber-950">{resSD2.deblaiOrganique.toFixed(2)} m³</strong>
                                </div>
                                <div className=" bg-blue-50 p-3 rounded">
                                    <p className="text-xs text-blue-800 block">Volume de Remblai</p>
                                    <strong className="text-xl text-blue-950">{resSD2.remblaiOrganique.toFixed(2)} m³</strong>
                                </div>
                            </div>
                            <div className="border-t pt-2">
                                <p className="text-xs opacity-60">Solde Financier Travaux</p>
                                <strong className="text-2xl font-black">{coutSD2 ? `${coutSD2.toFixed(3)} TND` : '--'}</strong>
                            </div>
                            <button className="w-full bg-slate-900 text-white py-2 rounded font-medium hover:bg-slate-800 transition cursor-pointer" onClick={() => window.print()}>
                                🖨️ Générer l'Attachement Officiel
                            </button>
                          </div>
                          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                                <div className="bg-white flex flex-col gap-3">
                                    <h3 className="font-black text-slate-800 text-sm uppercase border-b pb-2">Tolérance Altimétrique</h3>
                                    <p className="text-xs text-slate-500 font-semibold">Tolérance : <strong>{typeCheminementSD2 !== 'ouvert_non_ajuste' ? `± ${(resSD2.tolerance * 1000).toFixed(1)} mm` : 'N/A'}</strong></p>
                                    <p className="text-xs text-slate-500 font-semibold">Écart fz : <strong>{typeCheminementSD2 !== 'ouvert_non_ajuste' ? `${(resSD2.fZ * 1000).toFixed(1)} mm` : 'N/A'}</strong></p>
                                </div>
                                <div className={`w-full py-2.5 rounded text-sm font-bold text-center text-white ${typeCheminementSD2 === 'ouvert_non_ajuste' ? 'bg-slate-500' : resSD2.valide ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                    {typeCheminementSD2 === 'ouvert_non_ajuste' ? 'MODE ANTENNE' : resSD2.valide ? '✓ RÉSEAU VALIDÉ & COMPENSÉ' : '❌ CRITIQUE : REFAIRE VISÉES'}
                                </div>
                          </div>
                        </div>
                      </div>
    
                        ) : (
                        
                        <div className="space-y-7 shadow-inner">

                            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm overflow-x-auto">
                                <table className="w-full text-left font-mono text-base border-collapse">
                                    <thead>
                                        <tr className="bg-slate-900 border-b text-slate-200 uppercase text-xs tracking-wider">
                                            <th className="p-4">POINT</th>
                                            <th className="p-4">X (STT)</th>
                                            <th className="p-4">Y (STT)</th>
                                            <th className="p-4">Cote Projet (m)</th>
                                            <th className="p-4">Cote TN (m)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {graphPoints2.map((p, i) => (
                                            <tr key={i+1} className="hover:bg-slate-600/20">
                                                <td className="p-2 text-emerald-300">
                                                    {'PT' + (i + 1)}
                                                </td>
                                                <td className="p-2 text-emerald-500">{p.x.toFixed(3)}</td>
                                                <td className="p-2 text-emerald-500">{p.y.toFixed(3)}</td>
                                                <td className="p-2 text-emerald-500">{coteProjet2[i].z.toFixed(3)}</td>
                                                <td className="p-4 text-emerald-500">{p.z.toFixed(3)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="bg-slate-950 p-6 rounded-2xl border font-mono text-emerald-400 text-xs space-y-3 shadow-inner">
                                <p className="text-white font-black text-sm">// COORDONNÉES PAR VISÉE DE RÉFÉRENCE</p>
                                <p>L'orientement θᴬᴮ  = Tan⁻¹(ΔY÷ΔX) : <strong className='text-yellow-500 text-black'>{resSD2.orientementAB.toFixed(3)} grad</strong></p>
                                <p>L'orientement θᴬᴾ  = θᴬᴮ - α(P) : <strong className='text-yellow-500 text-black'>[{graphPoints2.map((p, idx) => p.angle < resSD2.orientementAB ? `θ(A${idx + 1}): ${(resSD2.orientementAB - p.angle).toFixed(3)} grad` : `θ(A${idx + 1}): ${(resSD2.orientementAB - p.angle + 400).toFixed(3)} grad`).join(' ; ')}]</strong></p>
                                <p>Abscisse X : X(P) = X(A) + Dh(AP) . Cos(θᴬᴾ) = <strong className='text-yellow-500 text-black'>[{graphPoints2.map((p) => `${p.id}: ${p.x.toFixed(3)} m `).join(' ; ')}]</strong></p>
                                <p>Ordonnée Y : Y(P) = Y(A) + Dh(AP) . Sin(θᴬᴾ) = <strong className='text-yellow-500 text-black'>[{graphPoints2.map((p) => `${p.id}: ${p.y.toFixed(3)} m `).join(' ; ')}]</strong></p>
                            </div>
                            
  {/* 1. Nuage 3D + grille filaire */} 
    <div style={gridStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>☁️ Nuage 3D avec grille</div>
        <div style={plotWrapperStyle}>
        <Plot
          data={[
            {
                type: 'scatter3d',
                mode: 'lines',
                x: wireframe.x,
                y: wireframe.y,
                z: wireframe.z,
                line: { color: 'rgba(100,180,255,0.3)', width: 0.5 },
                name: 'Grille filaire',
                showlegend: true,
                hoverinfo: 'none'
            },
            {
              type: 'scatter3d',
              mode: 'markers',
              x: profilX,
              y: profilY,
              z: profilZ,
              text: points,
              marker: {
                size: 3,
                color: profilZ,
                colorbar: { title: 'Altitude (m)',
                  titleside: 'right',
                  titlefont: { color: '#eee' },
                  tickfont: { color: '#ccc' }
                 },
                 line: { color: '#000', width: 0.5 }
              },
              name: 'Cote TN',
              showlegend: true,
              hovertemplate: '%{text}<br>X: %{x:.3f}<br>Y: %{y:.3f}<br>Z: %{z:.3f}<extra></extra>',
            },
            {
              type: 'scatter3d',
              mode: 'markers',
              x: [pointStationneA!.x],
              y: [pointStationneA!.y],
              z: [pointStationneA!.z],
              marker: {
                size: 3,
                color: "#31ec12",
                line: { color: '#000', width: 0.5 }
              },
              name: 'Point Stationné',
              showlegend: false,
              hovertemplate: 'Station A<br>X: %{x:.3f}<br>Y: %{y:.3f}<br>Z: %{z:.3f}<extra></extra>',
            },
          ]}
          layout={{
              ...darkLayout,
              title: {
              text: 'Vue 3D — Levé Topographique (Perspective interactive)',
              font: { color: '#eee', size: 14 }
              },
              scene: {
                xaxis: { title: 'X' },
                yaxis: { title: 'Y' },
                zaxis: { title: 'Z' },
                aspectmode: 'data',
                camera: { eye: { x: 1.8, y: 1.8, z: 1.2 } },
                margin: { l: 10, r: 10, t: 40, b: 10 },
                legend: { font: { color: '#ccc' } } 
              },
            }}
            useResizeHandler
            style={{ width: '100%', height: '100%' }}
            config={{ 
              responsive: true,
              displayModeBar: true,
              modeBarButtonsToRemove: ['sendDataToCloud'],
              displaylogo: false 
          }}
        />
        </div>
        <div className="legend">
            <span><strong>🔴 Points</strong> = points de levé topo</span>
            <span><strong>🟢 Point</strong> = point stationné</span>
            <span><strong>📐 Échelle</strong> respectée (aspectmode='data')</span>
            <span><strong>🖱️</strong> Rotation : clic gauche + glisser</span>
        </div>
      </div>
    </div>        

             <div className="bg-slate-950 p-6 rounded-2xl border font-mono text-emerald-400 text-xs space-y-3 shadow-inner">
                            <p className="text-white font-black text-sm">// INCERTITUDE ET COMPENSATION</p>
                            <p>Type de rayonnement : 
                                <span className='text-yellow-500 text-black'> {typeCheminementSD2 === 'ferme' ? 'FERMÉ' : typeCheminementSD2 === 'ouvert_ajuste' ? 'OUVERT AJUSTÉ' : 'OUVERT NON AJUSTÉ'}</span>
                                <span> de {resSD2.points.length} points de mire (<strong className='text-yellow-500 text-black'>{graphPoints2.map((p) => p.id).join(' ; ')} {typeCheminementSD2 === 'ferme' && ' ; PT1'}</strong>)</span>
                            </p>
                            <p>Altitude Mesurée (Z_Brut) = Lecture Arriére - Lecture Avant = <strong className='text-yellow-500 text-black'>{'[' + resSD2.points.map((p, idx) => (typeCheminementSD2 === 'ferme' && idx === resSD2.points.length - 1 ? 'PT1: ' : `PT${idx + 1}: `) + `${(p.zBrut!).toFixed(3)} m`).join(' ; ') + ']'}</strong></p>
                            <p>Tolérance d'Exécution Altimétrique = {typeCheminementSD2 !== 'ouvert_non_ajuste' ? compensation2 == 'distance' ? '0.01 +「0.02 × √(totalDistance / 1000)」= ' : '0.004 × √(nombre de visées) = ' : <span className='text-yellow-500'>OUVERT NON AJUSTÉ (Pas de tolérance)</span>} 
                                <strong className='text-yellow-500 text-black'> {typeCheminementSD2 !== 'ouvert_non_ajuste' ? (resSD2.tolerance * 1000).toFixed(1) + ' mm' : ''}</strong></p>
                            <p>Erreur de fermeture = {typeCheminementSD2 === 'ferme' ? `Z_Brut Final - Z_Connu Initial = ${resSD2.points[resSD2.points.length - 1].zBrut} m - ${resSD2.points[0].zBrut} m = ` : typeCheminementSD2 === 'ouvert_ajuste' ? `Z_Brut Final - Z_Connu Final = ${resSD2.points[resSD2.points.length - 1].zBrut} m - ${zFinal_sd2} m = ` : <span className='text-yellow-500'>OUVERT NON AJUSTÉ (Pas d'erreur de fermeture)</span>}
                                <span className='text-yellow-500 text-black'> {typeCheminementSD2 !== 'ouvert_non_ajuste' ? (resSD2.fZ * 1000).toFixed(1) + ' mm' : ''}</span></p>
                            <p>Comportement Géodésique = {typeCheminementSD2 === 'ouvert_non_ajuste' ? <span className='text-yellow-500'>OUVERT NON AJUSTÉ (Pas de comportement géodésique)</span> : (<span> Tolérance d'Exécution Altimétrique - Erreur de fermeture = <span className='text-yellow-500 text-black'>{(resSD2.tolerance * 1000).toFixed(1)} mm - {(Math.abs(resSD2.fZ * 1000).toFixed(1))} mm {resSD2.tolerance - Math.abs(resSD2.fZ) >= 0 ? '≥ 0' : '< 0'} → </span>
                                <strong className={`${resSD2.valide ? 'text-green-200' : 'text-red-500'} text-bold`}>{resSD2.valide ? 'VALIDE ✓' : 'INVALIDE ❌'}</strong></span>)}</p>
                            <p>Paramètre de compensation : <strong className='text-yellow-500 text-black'>{typeCheminementSD2 !== 'ouvert_non_ajuste' ? compensation2 === 'distance' ? 'DISTANCE' : compensation2 === 'points' ? 'POINTS' : 'TEMPS (Ordre chronologique)' : 'OUVERT NON AJUSTÉ (Pas de compensation)'}</strong></p>
                            <p>Facteur de compensation = <strong className='text-yellow-500 text-black'>{typeCheminementSD2 !== 'ouvert_non_ajuste' ? (compensation2 === 'distance' ? '(Distance horizontale / Distance de Référentiel)' : compensation2 === 'points' ? '1' : '(Numéro du point / Nombre totale des points)') : 'OUVERT NON AJUSTÉ (Pas de compensation)'}</strong></p>
                            <p>Compensation appliquée = {typeCheminementSD2 === 'ouvert_non_ajuste' ? <span className='text-yellow-500'>OUVERT NON AJUSTÉ (Pas de compensation)</span> : <span>- Erreur de fermeture × Facteur de compensation = <strong className='text-yellow-500 text-black'>{'[' + resSD2.points.map((p, idx) => (typeCheminementSD2 === 'ferme' && idx === resSD2.points.length - 1 ? 'PT1: ' : `PT${idx + 1}: `) + `${((p.zBrut! - p.zComp!) * -1000).toFixed(0)} mm`).join(' ; ') + ']'}</strong></span>}</p>
                            <p>Altitude Compensée (Z_Comp) = {typeCheminementSD2 === 'ouvert_non_ajuste' ? 'Altitude Mesurée (Z_Brut) = ' : 'Altitude Mesurée (Z_Brut) + Compensation appliquée = ' }
                                <strong className='text-yellow-500 text-black'>[{graphPoints2.map((p) => `${p.id}: ${p.z!.toFixed(3)} m`).join(' ; ')} {typeCheminementSD2 === 'ferme' && ` ; PT1: ${graphPoints2[0].z!.toFixed(3)} m`}]</strong>
                            </p>
              </div>
         

  {/* 2. Profil en long (X → Z) */}
    <div style={gridStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>📉 Profil en long</div>
        <div style={plotWrapperStyle}>
        <Plot
        data={profileTraces}
          layout={{
            ...darkLayout,
            title: {
            text: 'Profil en long — Échantillonnage des Altitudes selon X',
            font: { color: '#eee', size: 14 }
          },
          xaxis: {
            title: 'Distance X (m)',
            gridcolor: '#2a2a4a',
            color: '#ccc'
          },
          yaxis: {
            title: 'Altitude Z (m)',
            gridcolor: '#2a2a4a',
            color: '#ccc',
            // range: [Math.min(...profilZ) - 1, Math.max(...profilZ) + 1],
            margin: { l: 60, r: 30, t: 40, b: 50 },
            legend: { font: { color: '#ccc' } },
            shapes: [
                {
                    type: 'line',
                    x0: Math.min(...profilX),
                    y0: 100,
                    x1: Math.max(...profilX),
                    y1: 100,
                    line: { color: 'rgba(255,165,0,0.4)', width: 1.5, dash: 'dash' },
                    name: 'Niveau de référence 100m'
                }
            ],
            annotations: [
                {
                    x: Math.max(...profilX) - 30,
                    y: 102,
                    text: 'Réf. 100m',
                    showarrow: false,
                    font: { color: '#ffa502', size: 9 }
                }
              ]
            },
            }}
            useResizeHandler
            style={{ width: '100%', height: '100%' }}
            config={{ displayModeBar: true, displaylogo: false }}
        />
      </div>
      <div className="legend">
            <span><strong>📈 Lignes</strong> = profil altimétrique</span>
            <span><strong>📉 Zone ombrée</strong> = déblai/remblai potentiel</span>
            <span><strong>📍 Points colorés</strong> = points de levé échantillonnés</span>
      </div>
      </div>

      {/* 3. Vue en plan (X → Y) */}
      <div style={cardStyle}>
        <div style={headerStyle}>📌 Vue en plan</div>
        <div style={plotWrapperStyle}>
        <Plot
          data={[
            {
              type: 'scatter',
                mode: 'lines+markers',
                x: [...SortedAngProfilX, SortedAngProfilX[0]], // Boucle pour fermer le polygone
                y: [...SortedAngProfilY, SortedAngProfilY[0]], // Boucle pour fermer le polygone
                text: [...SortedAngPoints, SortedAngPoints[0]], // Boucle pour fermer le polygone
                line: { color: '#00d2ff', width: 1.5, smoothing: 0.4 },
                marker: {
                  size: 5,
                  color: PROFILE_COLORS,
                  colorscale: 'Viridis',
                  line: { color: '#fff', width: 0.5 }
                },
                name: 'Points de levé',
                hovertemplate: '%{text}<br>X: %{x:.3f}<br>Y: %{y:.3f}<extra></extra>',
            },
            {
              type: 'scatter',
                mode: 'markers',
                x: [pointStationneA!.x], 
                y: [pointStationneA!.y],
                text: ['Station A'],
                marker: {
                  size: 5,
                  color: '#31ec12',
                  colorscale: 'Viridis',
                  line: { color: '#fff', width: 0.5 }
                },
                name: 'Point Stationné A',
                hovertemplate: 'Station A<br>X: %{x:.3f}<br>Y: %{y:.3f}<extra></extra>',
            },
          ]}
          layout={{
            ...darkLayout,
            title: {
            text: 'Vue en plan — Coordonnées selon X et Y',
            font: { color: '#eee', size: 14 }
          },
          xaxis: {
            title: 'Abscisse X (m)',
            gridcolor: '#2a2a4a',
            color: '#ccc',
          },
          yaxis: {
            title: 'Ordonnée Y (m)',
            gridcolor: '#2a2a4a',
            color: '#ccc',
            range: [Math.min(...profilY) - 10, Math.max(...profilY) + 10],
            margin: { l: 60, r: 30, t: 40, b: 50 },
            legend: { font: { color: '#ccc' } },
            shapes: [
                {
                    type: 'line',
                    x0: Math.min(...profilX),
                    y0: Math.min(...profilY),
                    x1: Math.max(...profilX),
                    y1: Math.max(...profilY),
                    line: { color: 'rgba(255,165,0,0.4)', width: 1.5, dash: 'dash' },
                    name: 'Niveau de référence 100m'
                }
            ],
            annotations: [
                {
                    x: Math.max(...profilX) - 30,
                    y: 102,
                    text: 'Réf. 100m',
                    showarrow: false,
                    font: { color: '#ffa502', size: 9 }
                }
              ]
            },
            }}
            useResizeHandler
            style={{ width: '100%', height: '100%' }}
            config={{ displayModeBar: true, displaylogo: false }}
        />
      </div>
      <div className="legend">
            <span><strong>📈 Ligne bleue</strong> = profil planimétrique</span>
            <span><strong>📍 Points colorés</strong> = points de levé échantillonnés</span>
        </div>
      </div>
    </div>

                        <div className="bg-slate-950 p-6 rounded-2xl border font-mono text-emerald-400 text-xs space-y-2">
                            <p className="text-white font-black text-sm">// TRACÉ MATHÉMATIQUE & RÉSOLUTION DE SYSTÈMES LINÈAIRES PAR MORCEAUX</p>
                            <p>Le tracé est constitué: 
                                <span> de {graphPoints2.length} points (<strong className='text-yellow-500 text-black'>{graphPoints2.map((p) => p.id).join(' ; ')}</strong>)</span>
                            </p>
                            <p>Les coordonnées des points selon X et Y sont : 
                                <strong className='text-yellow-500 text-black'>{graphPoints2.map((p) => (<p>{p.id}: [X: {p.x.toFixed(3)} m ; Y: {p.y.toFixed(3)} m]</p>))}</strong>
                            </p>
                            <p>On divise le polygone étudié [{graphPoints2.map((item) => item.id).join(',')}] en parcelles (3 cotés) suivants : 
                                <strong className='text-yellow-500 text-black'>{sortedByAngle.length > 2 ? resSD2.trianglesIndex.map((p, i) => (<p> Parcelle N°{i + 1}: [{p.map((id) => sortedByAngle[id]?.id).join(',')}] → {resSD2.triangles[i]?.surfaceAdj ? 'percelle à ajouté' : 'parcelle à retirer'}</p>)) : ' minimum 3 Points pour une seule parcelle'} </strong>
                            </p>
                            <p>Les Surfaces des parcelles : S =「 X1 . (Y2 - Y3) + X2 . (Y3 - Y1) + X3 . (Y1 - Y2) 」= 
                                <strong className='text-yellow-500 text-black'>{sortedByAngle.length > 2 ? resSD2.trianglesIndex.map((p, i) => (<p> Parcelle N°{i + 1}: S = {resSD2.triangles[i]?.surface.toFixed(3) || 'N/A'} m² → {resSD2.triangles[i]?.surfaceAdj ? 'percelle à ajouté' : 'parcelle à retirer'}</p>)) : ' minimum 3 Points pour une seule parcelle'} </strong>
                            </p>
                            <p>L'Ecart d'altitude moyen de chaque parcelle: ΔZ =「 ( Z_TN(1) - Z_Projet(1)  +  Z_TN(2) - Z_Projet(2)  +  Z_TN(3) - Z_Projet(3) ) / 3 」= 
                                <strong className='text-yellow-500 text-black'>{sortedByAngle.length > 2 ? resSD2.trianglesIndex.map((p, i) => (<p> Parcelle N°{i + 1}: ΔZ = <strong className={`${(resSD2.triangles[i]?.deltaZMoyen < 0) ? 'text-red-500' : 'text-green-500'} text-black`}>{resSD2.triangles[i]?.deltaZMoyen.toFixed(3) || 'N/A'}</strong> m
                                    → <strong className= {`${(resSD2.triangles[i]?.deltaZMoyen < 0) ? 'text-red-500' : 'text-green-500'} text-black`}>{(resSD2.triangles[i]?.deltaZMoyen < 0) ? 'Remblai' : 'Deblai'}</strong> ({resSD2.triangles[i]?.surfaceAdj ? 'percelle à ajouté' : 'parcelle à retirer'})</p>)) : ' minimum 3 Points pour une seule parcelle'} 
                                </strong>
                            </p>
                            <p>Les Volumes Remblai/Deblai des parcelles : V =「 Surface . Ecart d'altitude moyen 」= 
                                <strong className='text-yellow-500 text-black'>{sortedByAngle.length > 2 ? resSD2.trianglesIndex.map((p, i) => (<p> Parcelle N°{i + 1}: V = <strong className={`${(resSD2.triangles[i]?.volume < 0) ? 'text-red-500' : 'text-green-500'} text-black`}>{resSD2.triangles[i]?.volume.toFixed(3) || 'N/A'}</strong> m³
                                    → <strong className= {`${(resSD2.triangles[i]?.volume < 0) ? 'text-red-500' : 'text-green-500'} text-black`}>{(resSD2.triangles[i]?.volume < 0) ? 'Remblai' : 'Deblai'}</strong> ({resSD2.triangles[i]?.surfaceAdj ? 'percelle à ajouté' : 'parcelle à retirer'}) </p>)) : ' minimum 3 Points pour une seule parcelle'} 
                                </strong>
                            </p>
                            <p>Surface totale du Polygone [{graphPoints2.map((item) => item.id).join(',')}] = <strong className='text-black text-yellow-500'>{resSD2.surfaceGauss.toFixed(3)} m²</strong></p>
                            <p>Volume totale de Deblai = <strong className='text-black text-green-500'>{resSD2.deblaiOrganique.toFixed(3)} m³</strong></p>
                            <p>Volume totale de Remblai = <strong className='text-black text-red-500'>{resSD2.remblaiOrganique.toFixed(3)} m³</strong></p>
                            <p>Volume totale de terrassement「 Vt = | Volume Deblai - Volume Remblai | 」= 
                                <strong className={`${resSD2.remblaiOrganique > resSD2.deblaiOrganique ? 'text-red-500' : 'text-green-500'} text-black`}> {Math.abs(resSD2.deblaiOrganique - resSD2.remblaiOrganique).toFixed(3)}</strong> m³
                                    → <strong className={`${resSD2.remblaiOrganique > resSD2.deblaiOrganique ? 'text-red-500' : 'text-green-500'} text-black`}> {`${resSD2.remblaiOrganique > resSD2.deblaiOrganique ? 'Remblai' : 'Deblai'}`}</strong>
                            </p>
                            <p>Tarif 1 m³ de Deblai : <strong className='text-black text-green-500'>{TARIF_DEBLAI} DT</strong></p>
                            <p>Tarif 1 m³ de Remblai : <strong className='text-black text-red-500'>{TARIF_REMBLAI} DT</strong></p>
                            <p>Solde financier Travaux = Volume de terrassement × Tarif concerné = <strong className='text-black text-yellow-500'>{resSD2.remblaiOrganique > resSD2.deblaiOrganique ? ((resSD2.remblaiOrganique - resSD2.deblaiOrganique) * TARIF_REMBLAI).toFixed(3) : ((resSD2.deblaiOrganique - resSD2.remblaiOrganique) * TARIF_DEBLAI).toFixed(3)} DT</strong></p>
                        </div>
  </div>
  )}

      
</div>

  );
};

export default TopoDashboard;