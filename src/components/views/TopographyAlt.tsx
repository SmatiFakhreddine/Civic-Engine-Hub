// src/components/TopoDashboard.tsx
import React, { useMemo, useState } from 'react';
import SmartInput from '../SmartInput';
import { Topography } from '../../core/btp/Topography';
import '../../styles/TopographyCharts.css';
import Plot from 'react-plotly.js';

// --- Types ---
interface PointTopo1D {
    id: string;
    lectureArriere: number;
    lectureAvant: number;
    distance: number;
    coteProjet: number;
    zBrut?: number;
    zComp?: number;
}

interface DataPoint {
  id: string,
  x: number;
  y: number;
  z: number;
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
  isAcademicMode? : boolean;
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

  const TARIF_DEBLAI = 14.500;  // TND / m³
  const TARIF_REMBLAI = 18.200; // TND / m³

  const [typeCheminementSD1, setTypeCheminementSD1] = useState<'ferme' | 'ouvert_ajuste' | 'ouvert_non_ajuste'>('ferme');
  const [compensation1, setCompensation1] = useState<'distance' | 'points'>('distance');
  
  
  // ── ÉTATS SOUS-DIVISION 1 (NIVELLEMENT PUR) ──
  const [z0_sd1, setZ0_sd1] = useState<number>(100.00);
  const [zFinal_sd1, setZFinal_sd1] = useState<number>(100.015);
  const [largeurFouille, setLargeurFouille] = useState<number>(4.00);
  const [pointsSD1, setPointsSD1] = useState<PointTopo1D[]>([
    { id: 'PT1', lectureArriere: 1.620, lectureAvant: 0.000, distance: 0, coteProjet: 100.00 },
    { id: 'PT2', lectureArriere: 1.150, lectureAvant: 1.510, distance: 45, coteProjet: 99.75 },
    { id: 'PT3', lectureArriere: 0.000, lectureAvant: 1.235, distance: 55, coteProjet: 100.015 }
  ]);
  
  // ── HANDLERS D'AJOUT ET SUPPRESSION DES LIGNES ──
  const addRowSD1 = () => setPointsSD1([...pointsSD1, { id: `PT${pointsSD1.length + 1}`, lectureArriere: 0, lectureAvant: 0, distance: 20, coteProjet: z0_sd1 }]);
  const deleteRowSD1 = (item: PointTopo1D) => {
    const newPointsSD1 = pointsSD1.filter((p) => item.id !== 'PT1' ? p.id !== item.id : true);
    const newIndexedPointsSD1 = newPointsSD1.map((p, i) => { p.id = `PT${i + 1}`; return p; });
    setPointsSD1(newIndexedPointsSD1);
  };
  
  // ── EXÉCUTION DU MOTEUR DE CALCULS ──
  const resSD1 = Topography.computeAltimetriePure(pointsSD1, z0_sd1, typeCheminementSD1 === 'ferme' ? z0_sd1 : typeCheminementSD1 === 'ouvert_ajuste' ? zFinal_sd1 : undefined, compensation1);
  const cubaturesSD1 = Topography.calculateCubature1D(resSD1.points, largeurFouille);
  const cubaturesSD11 = Topography.calculateCubature2D(resSD1.points, largeurFouille);
  const coutSD1 = (cubaturesSD1.deblai * TARIF_DEBLAI) + (cubaturesSD1.remblai * TARIF_REMBLAI);
  let dis = 0;
  const graphPoints1 = resSD1.points.map((item) => {
      dis += item.distance
      const point = {
      id: item.id,
      x: dis,
      y: largeurFouille,
      z: item.zComp ? item.zComp : item.zBrut
      }
      return point;
  });
  const coteProjet1 = resSD1.points.map((item, idx) => ({
      id: item.id,
      x: graphPoints1[idx].x,
      y: largeurFouille,
      z: item.coteProjet
  }));
  if (typeCheminementSD1 === 'ferme') {
      graphPoints1[graphPoints1.length - 1].id = graphPoints1[0].id;
      coteProjet1[coteProjet1.length - 1].id = coteProjet1[0].id;
      coteProjet1[coteProjet1.length - 1].z = coteProjet1[0].z;
  }; 
  const additionalProfiles: ProfileSeries[] = [{ 
      name: 'Cote Projet', 
      points: coteProjet1 
  }];

  // Génération de la grille interpolée
  const { gx, gy, gridZ } = useMemo<GridData>(
    () => interpolateGrid(graphPoints1, 30),
    [graphPoints1, 30]
  );

  const profilX = [...graphPoints1].map(p => p.x);
  const profilY = [...graphPoints1].map(p => p.y);
  const profilZ = [...graphPoints1].map(p => p.z);
  const points = [...graphPoints1].map((p) => p.id);

  const profileTraces = useMemo<any[]>(() => {
      const traces: any[] = [];

  if (graphPoints1.length > 0) {
      traces.push({
        type: 'scatter',
        mode: 'lines+markers',
        x: profilX,
        y: profilZ,
        text: points,
        line: { color: '#fcef42', width: 2.5, shape: 'spline', smoothing: 0.4 },
        marker: { size: 5, colorscale: 'Viridis' },
        name: 'Cote TN',
        hovertemplate: '%{text}<br>D: %{x:.3f}<br>Z: %{y:.3f}<extra></extra>',
      });
    }

  // Profils supplémentaires
    additionalProfiles.forEach((serie, idx) => {
      if (serie.points.length > 0) {
          const x = [...serie.points].map(p => p.x);
          const z = [...serie.points].map(p => p.z);
          const color = PROFILE_COLORS[idx];
          traces.push({
            type: 'scatter',
            mode: 'lines+markers',
            x: x,
            y: z,
            text: points,
            line: { color, width: 2.5, shape: 'spline', smoothing: 0.4 },
            marker: { size: 5 },
            name: serie.name,
            hovertemplate: `%{text}<br>D: %{x:.3f}<br>Z: %{y:.3f}<extra></extra>`,
          });
        
      }
    });

    return traces;
  }, [graphPoints1, additionalProfiles]);

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
  };

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
              
                    <div className={`p-6 rounded-2xl border ${isAcademicMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} grid grid-cols-1 md:grid-cols-4 gap-6 shadow-sm`}>
                        <div className="h-14">
                          <SmartInput label="Altitude Départ Z0 (m)" value={z0_sd1} onChange={setZ0_sd1} />
                        </div>
                        <div className="h-14">
                            <SmartInput label="Largeur du Lit de Pose W (m)" value={largeurFouille} onChange={setLargeurFouille} />
                        </div>
                        <div className="flex flex-col">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Configuration Cheminement</label>
                            <select className={`p-3 border ${isAcademicMode ? 'bg-slate-900' : 'bg-white'} border-slate-300 rounded-xl font-bold h-12 text-base`} value={typeCheminementSD1} onChange={(e) => setTypeCheminementSD1(e.target.value as any)}>
                              <option value="ferme">Boucle Fermée</option>
                              <option value="ouvert_ajuste">Ouvert Ajusté</option>
                              <option value="ouvert_non_ajuste">Ouvert Non Ajusté</option>
                            </select>
                        </div>
                          {typeCheminementSD1 === 'ouvert_ajuste' && (
                            <div className="h-14">
                              <SmartInput label="Altitude d'Arrivée Répère (m)" value={zFinal_sd1} onChange={setZFinal_sd1} />
                            </div>
                          )}
                          {typeCheminementSD1 !== 'ouvert_non_ajuste' && (
                            <div className="flex flex-col mb-1">
                              <label className="text-xs font-black text-slate-500 uppercase mb-1">Paramétre de Compensation</label>
                              <select className={`p-3 border ${isAcademicMode ? 'bg-slate-900' : 'bg-white'} border-slate-300 rounded-xl font-bold text-sm h-12`} value={compensation1} onChange={(e) => setCompensation1(e.target.value as any)}>
                              { <>
                                <option value="distance">Distance</option>
                                <option value="points">Points</option>
                                </> }
                              </select>
                            </div>
                          )}
                    </div>

                    {!isAcademicMode ? (
                    <div className="space-y-7">
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-black text-slate-800 text-base uppercase tracking-wider">Carnet d'Altimétrie par Tronçon</h3>
                            <button onClick={addRowSD1} className="bg-blue-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-blue-700 transition cursor-pointer">➕ Ajouter un Point de Mire</button>
                        </div>
                        <table className="w-full text-left font-mono text-base border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b text-slate-500 uppercase text-xs tracking-wider">
                                    <th className="p-4">POINT</th>
                                    <th className="p-4">Lect. Arrière (m)</th>
                                    <th className="p-4">Lect. Avant (m)</th>
                                    <th className="p-4">Distance (m)</th>
                                    <th className="p-4">Cote Projet (m)</th>
                                    <th className="p-4 text-blue-600">Z Brut</th>
                                    <th className="p-4 text-emerald-600">Z Compensé</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y font-bold">
                                {resSD1.points.map((p, i) => (
                                    <tr key={p.id} className="hover:bg-slate-50/40">
                                        <td className={typeCheminementSD1 !== 'ouvert_non_ajuste' && ( i === 0 || i === resSD1.points.length - 1) ? 'p-4 text-emerald-900' : 'p-4'}>
                                            {typeCheminementSD1 === 'ferme' && i === resSD1.points.length - 1 ? 'PT1' : p.id}
                                        </td>
                                        <td className="p-2"><input type="number" step="0.001" className={`p-2.5 border rounded-lg w-full ${i === resSD1.points.length - 1 ? 'bg-slate-300' : 'bg-slate-50'} text-base font-black`} value={p.lectureArriere} onChange={(e) => { const updated = [...pointsSD1]; updated[i].lectureArriere = parseFloat(e.target.value) || 0; setPointsSD1(updated); }} disabled={i===resSD1.points.length - 1} /></td>
                                        <td className="p-2"><input type="number" step="0.001" className={`p-2.5 border rounded-lg w-full ${i === 0 ? 'bg-slate-300' : 'bg-slate-50'} text-base font-black`} value={p.lectureAvant} onChange={(e) => { const updated = [...pointsSD1]; updated[i].lectureAvant = parseFloat(e.target.value) || 0; setPointsSD1(updated); }} disabled={i===0} /></td>
                                        <td className="p-2"><input type="number" className='p-2.5 border rounded-lg w-full bg-slate-50 text-base font-black' value={p.distance} onChange={(e) => { const updated = [...pointsSD1]; updated[i].distance = parseFloat(e.target.value) || 0; setPointsSD1(updated); }} disabled={i===0} /></td>
                                        <td className="p-2"><input type="number" step="0.01" className={`p-2.5 border rounded-lg w-full ${(typeCheminementSD1 === 'ferme' && i === resSD1.points.length - 1) ? 'bg-slate-300' : 'bg-slate-50'} text-base font-black`} value={typeCheminementSD1 === 'ferme' && i === resSD1.points.length - 1 ? resSD1.points[0].coteProjet : p.coteProjet} onChange={(e) => { const updated = [...pointsSD1]; updated[i].coteProjet = parseFloat(e.target.value) || 0; setPointsSD1(updated); }} disabled={typeCheminementSD1 === 'ferme' && i===resSD1.points.length - 1} /></td>
                                        <td className="p-4 text-blue-600">{p.zBrut?.toFixed(3)}</td>
                                        <td className="p-4 text-emerald-600">{typeCheminementSD1 !== 'ouvert_non_ajuste' ? p.zComp?.toFixed(3) : '--'}</td>
                                        <td>
                                            <button onClick={() => deleteRowSD1(p)} className="text-red-500 text-xs font-bold px-2.5 py-1.5 rounded-xl hover:bg-gray-300 py-1 px-2 rounded cursor-pointer">
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                      </div>
                        
                        {/* CARTES D'AUDIT POUR LA SOUS-DIVISION 1 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                                <h3 className="font-bold uppercase border-b pb-2">📊 Audit Ouvrage & Décomptes (Métrés)</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-amber-50 p-3 rounded">
                                        <span className="text-xs text-amber-800 block">Volume Total Déblai</span>
                                        <strong className="text-xl text-amber-950">{cubaturesSD1.deblai.toFixed(2)} m³</strong>
                                    </div>
                                    <div className="bg-blue-50 p-3 rounded">
                                        <span className="text-xs text-blue-800 block">Volume Total Remblai</span>
                                        <strong className="text-xl text-blue-950">{cubaturesSD1.remblai.toFixed(2)} m³</strong>
                                    </div>
                                </div>
                                    <div className={`p-3 rounded font-medium text-sm ${typeCheminementSD1 == 'ouvert_non_ajuste'? 'bg-slate-50 text-slate-700' : !resSD1.valide ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                        Erreur de fermeture : {typeCheminementSD1 !== 'ouvert_non_ajuste' ? `${(resSD1.erreurFermeture * 1000).toFixed(1)} mm` : 'N/A'}
                                    </div>
                                    <div className="border-t pt-2">
                                        <p className="text-xs opacity-60">Solde Financier Travaux</p>
                                        <strong className="text-2xl font-black">{coutSD1.toFixed(3)} TND</strong>
                                    </div>
                                    <button className="w-full bg-slate-900 text-white py-2 rounded font-medium hover:bg-slate-800 transition cursor-pointer" onClick={() => window.print()}>
                                        🖨️ Générer l'Attachement Officiel
                                    </button>
                            </div>

                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                                <div className="bg-white flex flex-col gap-3">
                                    <h3 className="font-black text-slate-800 text-sm uppercase border-b pb-2">Tolérance d'Exécution Altimétrique</h3>
                                    <p className="text-xs text-slate-500 font-semibold">Seuil Tolérance : <strong>{typeCheminementSD1 !== 'ouvert_non_ajuste' ? `± ${(resSD1.tolerance * 1000).toFixed(1)} mm` : 'N/A'}</strong></p>
                                    <p className="text-xs text-slate-500 font-semibold">Erreur Fermeture : <strong>{typeCheminementSD1 !== 'ouvert_non_ajuste' ? `${(resSD1.erreurFermeture * 1000).toFixed(1)} mm` : 'N/A'}</strong></p>
                                </div>
                                <div className={`p-3 rounded text-center text-sm font-bold text-white ${typeCheminementSD1 === 'ouvert_non_ajuste' ? 'bg-slate-500' : resSD1.valide ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                {typeCheminementSD1 === 'ouvert_non_ajuste' ? 'CHEMINEMENT EN ANTENNE (NON COMPENSÉ)' : resSD1.valide ? '✓ COMPORTEMENT GÉODÉSIQUE VALIDÉ' : '❌ HORS TOLÉRANCE : REFAIRE LE CHEMINEMENT'}
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
                                        <th className="p-4">Distance Cumulée (m)</th>
                                        <th className="p-4">Cote Projet (m)</th>
                                        <th className="p-4">Cote TN (m)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {graphPoints1.map((p, i) => (
                                        <tr key={i+1} className="hover:bg-slate-600/20">
                                            <td className="p-2 text-emerald-300">
                                                {p.id}
                                            </td>
                                            <td className="p-2 text-emerald-500">{p.x.toFixed(3)}</td>
                                            <td className="p-2 text-emerald-500">{coteProjet1[i].z.toFixed(3)}</td>
                                            <td className="p-4 text-emerald-500">{p.z.toFixed(3)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={gridStyle}>

                          {/* 1. Nuage 3D + grille filaire */}
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
                                    hovertemplate: '%{text}<br>D: %{x:.3f}<br>Z: %{z:.3f}<extra></extra>',
                                  },
                                ]}
                                layout={{
                                  ...darkLayout,
                                  title: {
                                  text: 'Vue 3D — Levé Topographique (Perspective interactive)',
                                  font: { color: '#eee', size: 14 }
                                  },

                                  scene: {
                                    xaxis: { title: 'D' },
                                    yaxis: { title: 'Y' },
                                    zaxis: { title: 'Z' },
                                    aspectmode: 'data',
                                    camera: { eye: { x: 1.8, y: -1.8, z: 1.2 } },
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
                                <span><strong>🔵 Surface</strong> = interpolation du MNT</span>
                                <span><strong>📐 Échelle</strong> respectée (aspectmode='data')</span>
                                <span><strong>🖱️</strong> Rotation : clic gauche + glisser</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-950 p-6 rounded-2xl border font-mono text-emerald-400 text-xs space-y-3 shadow-inner">
                            <p className="text-white font-black text-sm">// INCERTITUDE ET COMPENSATION</p>
                            <p>Type de cheminement : 
                                <span className='text-yellow-500 text-black'> {typeCheminementSD1 === 'ferme' ? 'FERMÉ' : typeCheminementSD1 === 'ouvert_ajuste' ? 'OUVERT AJUSTÉ' : 'OUVERT NON AJUSTÉ'}</span>
                                <span> de {graphPoints1.length} points de mire (<strong className='text-yellow-500 text-black'>{graphPoints1.map((p) => p.id).join(' → ')}</strong>)</span>
                            </p>
                            <p>Altitude Mesurée (Z_Brut) = Lecture Arriére - Lecture Avant = <strong className='text-yellow-500 text-black'>{'[' + resSD1.points.map((p, idx) => (typeCheminementSD1 === 'ferme' && idx === resSD1.points.length - 1 ? 'PT1: ' : `PT${idx + 1}: `) + `${(p.zBrut).toFixed(3)} m`).join(' ; ') + ']'}</strong></p>
                            <p>Tolérance d'Exécution Altimétrique = {typeCheminementSD1 !== 'ouvert_non_ajuste' ? compensation1 === 'distance' ? '0.01 +「0.02 × √(totalDistance / 1000)」= ' : '0.004 × √(nombre de visées) = ' : <span className='text-yellow-500'>OUVERT NON AJUSTÉ (Pas de tolérance)</span>} 
                                <strong className='text-yellow-500 text-black'> {typeCheminementSD1 !== 'ouvert_non_ajuste' ? (resSD1.tolerance * 1000).toFixed(1) + ' mm' : ''}</strong></p>
                            <p>Erreur de fermeture = {typeCheminementSD1 === 'ferme' ? `Z_Brut Final - Z_Connu Initial = ${resSD1.points[resSD1.points.length - 1].zBrut} m - ${z0_sd1} m = ` : typeCheminementSD1 === 'ouvert_ajuste' ? `Z_Brut Final - Z_Connu Final = ${resSD1.points[resSD1.points.length - 1].zBrut} m - ${zFinal_sd1} m = ` : <span className='text-yellow-500'>OUVERT NON AJUSTÉ (Pas d'erreur de fermeture)</span>}
                                <span className='text-yellow-500 text-black'> {typeCheminementSD1 !== 'ouvert_non_ajuste' ? (resSD1.erreurFermeture * 1000).toFixed(1) + ' mm' : ''}</span></p>
                            <p>Comportement Géodésique = {typeCheminementSD1 === 'ouvert_non_ajuste' ? <span className='text-yellow-500'>OUVERT NON AJUSTÉ (Pas de comportement géodésique)</span> : (<span> Tolérance d'Exécution Altimétrique - Erreur de fermeture = <span className='text-yellow-500 text-black'>{(resSD1.tolerance * 1000).toFixed(1)} mm - {(Math.abs(resSD1.erreurFermeture * 1000).toFixed(1))} mm {resSD1.tolerance - Math.abs(resSD1.erreurFermeture) >= 0 ? '≥ 0' : '< 0'} → </span>
                                <strong className={`${resSD1.valide ? 'text-green-200' : 'text-red-500'} text-bold`}>{resSD1.valide ? 'VALIDE ✓' : 'INVALIDE ❌'}</strong></span>)}</p>
                            <p>Paramètre de compensation : <strong className='text-yellow-500 text-black'>{typeCheminementSD1 !== 'ouvert_non_ajuste' ? compensation1 === 'distance' ? 'DISTANCE' : 'POINTS' : 'OUVERT NON AJUSTÉ (Pas de compensation)'}</strong></p>
                            <p>Facteur de compensation = <strong className='text-yellow-500 text-black'>{typeCheminementSD1 !== 'ouvert_non_ajuste' ? (compensation1 === 'distance' ? '(Distance cumulée / Distance Totale)' : '(Numéro du point / Nombre totale des points)') : 'OUVERT NON AJUSTÉ (Pas de compensation)'}</strong></p>
                            <p>Compensation appliquée = {typeCheminementSD1 === 'ouvert_non_ajuste' ? <span className='text-yellow-500'>OUVERT NON AJUSTÉ (Pas de compensation)</span> : <span>- Erreur de fermeture × Facteur de compensation  = <strong className='text-yellow-500 text-black'>{'[' + resSD1.points.map((p, idx) => (typeCheminementSD1 === 'ferme' && idx === resSD1.points.length - 1 ? 'PT1: ' : `PT${idx + 1}: `) + `${((p.zBrut - p.zComp!) * -1000).toFixed(0)} mm`).join(' ; ') + ']'}</strong></span>}</p>
                            <p>Altitude Compensée (Z_Comp) = {typeCheminementSD1 === 'ouvert_non_ajuste' ? 'Altitude Mesurée (Z_Brut) = ' : 'Altitude Mesurée (Z_Brut) + Compensation appliquée = ' }
                                <strong className='text-yellow-500 text-black'>[{graphPoints1.map((p) => `${p.id}: ${p.z!.toFixed(3)} m`).join(' ; ')}]</strong>
                            </p>
                        </div>

                        <div style={gridStyle}>

                          {/* 2. Profil en long (X → Z) */}
                          <div style={cardStyle}>
                            <div style={headerStyle}>📉 Profil en long</div>
                            <div style={plotWrapperStyle}>
                              <Plot
                              data={profileTraces}
                                layout={{
                                  ...darkLayout,
                                  title: {
                                text: 'Profil en long — Échantillonnage des Altitudes selon la Distance cumulée',
                                font: { color: '#eee', size: 14 }
                            },
                            xaxis: {
                                title: 'Distance D (m)',
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
                                <span><strong>📈 Ligne</strong> = profil altimétrique</span>
                                <span><strong>📉 Zone ombrée</strong> = déblai/remblai potentiel</span>
                                <span><strong>📍 Points colorés</strong> = points de levé échantillonnés</span>
                            </div>
                          </div>

                        </div>


                        <div className="bg-slate-950 p-6 rounded-2xl border font-mono text-emerald-400 text-xs space-y-3 shadow-inner">
                            <p className="text-white font-black text-sm">// TRACÉ MATHÉMATIQUE & RÉSOLUTION DE SYSTÈMES LINÈAIRES PAR MORCEAUX</p>
                            <p>Le cheminement est constitué: 
                                <span> de {graphPoints1.length} points de mire (<strong className='text-yellow-500 text-black'>{graphPoints1.map((p) => p.id).join(' → ')}</strong>)</span>
                            </p>
                            <p>L'abscisse des points de mire sont : 
                                <strong className='text-yellow-500 text-black'> [{graphPoints1.map((p) => p.x + ' m').join(' ; ')}]</strong>
                            </p>
                            <p>les fonctions différences「 f(x) = f(CoteTN) - f(CoteProjet) 」sont : 
                                <strong className='text-yellow-500 text-black'>{cubaturesSD11.coefficientsIntermediaires.map((p) => (<p>[{p.segment}] : f(x) = {p.a.toFixed(4)} . x + {p.b.toFixed(3)} avec 
                                    f({(p.x_init).toFixed(3)}) = <strong className={`${p.f_init < 0 ? 'text-red-500' : p.f_init > 0 ? 'text-green-500' : 'text-yellow-500'} text-black`}>{p.f_init.toFixed(3)}</strong> ; 
                                    f({(p.x_fin).toFixed(3)}) = <strong className={`${p.f_fin < 0 ? 'text-red-500' : p.f_fin > 0 ? 'text-green-500' : 'text-yellow-500'} text-black`}>{p.f_fin.toFixed(3)}</strong> ; </p>))}
                                </strong>
                            </p>
                            <p>Points d'intersection exacts calculés sur l'ensemble du tracé (f(x) = 0) : <strong className='text-yellow-500 text-black'>[ {cubaturesSD11.intersections.length > 0 ? cubaturesSD11.intersections.map(item => `${item.id} : ${item.x.toFixed(3)} m`).join(' ; ') : 'Aucun point de passage'} ]</strong></p>
                            <p>les Surfaces Remblai/Deblai「 S = Distance(ab) . ( f(a) + f(b) ) / 2 」: 
                                <strong className='text-yellow-500 text-black'>{cubaturesSD11.coefficientsIntermediaires.map((p) => (<p>[{p.segment}] : S = <strong className= {`${(p.f_init < 0 || p.f_fin < 0) ? 'text-red-500' : 'text-green-500'} text-black`}>{(Math.abs((p.x_fin - p.x_init) * (p.f_init + p.f_fin) / 2).toFixed(3))}</strong> m²
                                    → <strong className= {`${(p.f_init < 0 || p.f_fin < 0) ? 'text-red-500' : 'text-green-500'} text-black`}>{`${(p.f_init < 0 || p.f_fin < 0) ? 'Remblai' : 'Deblai'}`}</strong></p>))}
                                </strong>
                            </p>
                            <p>les Volumes Remblai/Deblai「 V = Surface . Largeur de fouille 」: 
                                <strong className='text-yellow-500 text-black'>{cubaturesSD11.coefficientsIntermediaires.map((p) => (<p>[{p.segment}] : V = <strong className= {`${(p.f_init < 0 || p.f_fin < 0) ? 'text-red-500' : 'text-green-500'} text-black`}>{(Math.abs((p.x_fin - p.x_init) * (p.f_init + p.f_fin) / 2 * largeurFouille).toFixed(3))}</strong> m³
                                    → <strong className= {`${(p.f_init < 0 || p.f_fin < 0) ? 'text-red-500' : 'text-green-500'} text-black`}>{`${(p.f_init < 0 || p.f_fin < 0) ? 'Remblai' : 'Deblai'}`}</strong></p>))}
                                </strong>
                            </p>
                            <p>Volume totale de Deblai = <strong className='text-black text-green-500'>{cubaturesSD11.deblai.toFixed(3)} m³</strong></p>
                            <p>Volume totale de Remblai = <strong className='text-black text-red-500'>{cubaturesSD11.remblai.toFixed(3)} m³</strong></p>
                            <p>Volume totale de terrassement「 Vt = | Volume Deblai - Volume Remblai | 」= 
                                <strong className= {`${cubaturesSD11.remblai > cubaturesSD11.deblai ? 'text-red-500' : 'text-green-500'} text-black`}> {Math.abs(cubaturesSD11.deblai - cubaturesSD11.remblai).toFixed(3)}</strong> m³
                                    → <strong className= {`${cubaturesSD11.remblai > cubaturesSD11.deblai ? 'text-red-500' : 'text-green-500'} text-black`}> {`${cubaturesSD11.remblai > cubaturesSD11.deblai ? 'Remblai' : 'Deblai'}`}</strong>
                            </p>
                            <p>Tarif 1 m³ de Deblai : <strong className='text-black text-green-500'>{TARIF_DEBLAI} DT</strong></p>
                            <p>Tarif 1 m³ de Remblai : <strong className='text-black text-red-500'>{TARIF_REMBLAI} DT</strong></p>
                            <p>Solde financier Travaux = Volume de terrassement × Tarif concerné = <strong className='text-black text-yellow-500'>{cubaturesSD11.remblai > cubaturesSD11.deblai ? ((cubaturesSD11.remblai - cubaturesSD11.deblai) * TARIF_REMBLAI).toFixed(3) : ((cubaturesSD11.deblai - cubaturesSD11.remblai) * TARIF_DEBLAI).toFixed(3)} DT</strong></p>
                        </div>
                        
                    </div>)}
                </div>
            
)}

export default TopoDashboard;