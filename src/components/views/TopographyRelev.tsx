// src/components/TopoDashboard.tsx
import React, { useState, useMemo } from 'react';
import SmartInput from '../SmartInput';
import { Topography } from '../../core/btp/Topography';
import '../../styles/TopographyCharts.css';
import Plot from 'react-plotly.js';

// --- Types ---
interface DataPoint {
  x: number;
  y: number;
  z: number;
}

interface GridData {
  gx: number[];
  gy: number[];
  gridZ: number[][];
}

// --- Composant principal ---
interface TopoDashboardProps { isAcademicMode?: boolean }

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

// --- Composant principal ---
const TopoDashboard: React.FC<TopoDashboardProps> = ({ isAcademicMode }) => {

  // ── ÉTATS SOUS-DIVISION 3 (RELÈVEMENT GÉODÉSIQUE DYNAMIQUE) ──
      const [xA, setXA] = useState<number>(600100); const [yA, setYA] = useState<number>(300100);
      const [xB, setXB] = useState<number>(600280); const [yB, setYB] = useState<number>(300350);
      const [xC, setXC] = useState<number>(600500); const [yC, setYC] = useState<number>(300120);
      const [alpha, setAlpha] = useState<number>(58.45); const [beta, setBeta] = useState<number>(82.15);
      const [relType, setRelType] = useState<'delambre' | 'tienstra'>('delambre');
  
      const resSD3 = Topography.computeRelevementPure({ x: xA, y: yA }, { x: xB, y: yB }, { x: xC, y: yC }, alpha, beta, relType);
      const graphPoints3 = [{ x: xA, y: yA, z: 0 }, { x: xB, y: yB, z: 0 }, { x: xC, y: yC, z: 0 }];
      const pointStationneS = {x: resSD3.x, y: resSD3.y, z: 0};

  // Génération de la grille interpolée
  const { gx, gy, gridZ } = useMemo<GridData>(
    () => interpolateGrid(graphPoints3, 30),
    [graphPoints3, 30]
  );

  const profilX = [...graphPoints3].map(p => p.x);
  const profilY = [...graphPoints3].map(p => p.y);
  const profilZ = [...graphPoints3].map(p => p.z);
  const alphabet = ['A', 'B', 'C'];
  const points = [...graphPoints3].map((p, idx) => `Réf ${alphabet[idx]}`);

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

      <div className={`p-6 rounded-2xl border ${isAcademicMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} grid grid-cols-1 md:grid-cols-3 gap-6 shadow-sm`}>
        <div className={`p-4 ${isAcademicMode ? 'bg-slate-900' : 'bg-white'} rounded-xl space-y-2`}>
            <h4 className="font-black text-xs text-slate-500 uppercase">Point Référentiel A</h4>
            <SmartInput label="Coordonnée X_A (m)" value={xA} onChange={setXA} />
            <SmartInput label="Coordonnée Y_A (m)" value={yA} onChange={setYA} />
        </div>
        <div className={`p-4 ${isAcademicMode ? 'bg-slate-900' : 'bg-white'} rounded-xl space-y-2`}>
            <h4 className="font-black text-xs text-slate-500 uppercase">Point Référentiel B</h4>
            <SmartInput label="Coordonnée X_B (m)" value={xB} onChange={setXB} />
            <SmartInput label="Coordonnée Y_B (m)" value={yB} onChange={setYB} />
        </div>
        <div className={`p-4 ${isAcademicMode ? 'bg-slate-900' : 'bg-white'} rounded-xl space-y-2`}>
            <h4 className="font-black text-xs text-slate-500 uppercase">Point Référentiel C</h4>
            <SmartInput label="Coordonnée X_C (m)" value={xC} onChange={setXC} />
            <SmartInput label="Coordonnée Y_C (m)" value={yC} onChange={setYC} />
        </div>
      </div>

      <div className={`p-6 rounded-2xl border ${isAcademicMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} grid grid-cols-1 md:grid-cols-3 gap-6 shadow-sm`}>
        <SmartInput label="Alpha 'AŜB' (grad)" value={alpha} onChange={setAlpha} />
        <SmartInput label="Béta 'BŜC' (grad)" value={beta} onChange={setBeta} />
        <div className="flex flex-col mb-1">
            <label className="text-xs font-black text-slate-400 uppercase mb-1">Méthode de relévement</label>
            <select className={`p-3 border ${isAcademicMode ? 'bg-slate-900' : 'bg-white'} border-slate-300 rounded-xl font-bold text-sm h-12'`} value={relType} onChange={(e) => setRelType(e.target.value as any)}>
                { <>
                        <option value="delambre">Delambre</option>
                        <option value="tienstra">Tienstra</option>
                    </> }
            </select>
        </div>
      </div>

      {!isAcademicMode ? (

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-black text-slate-800 text-sm uppercase border-b pb-2">📊 Audit Ouvrage (Station S)</h3>
              <div className="grid md:grid-cols-1 gap-4">
                  <p className="text-xs font-bold text-slate-400 block">Coordonnées Station Calculées</p>
                  <div className="grid grid-cols-1 gap-4">
                      <div className="bg-gray-100 p-3 rounded">
                          <p className="text-xs text-bold-800 block">X (Abscisse)</p>
                          <strong className="text-xl text-slate-950">{resSD3.x.toFixed(3)} m</strong>
                      </div>
                      <div className="bg-gray-100 p-3 rounded">
                          <p className="text-xs text-bold-800 block">Y (Ordonnée)</p>
                          <strong className="text-xl text-slate-950">{resSD3.y.toFixed(3)} m</strong>
                      </div>
                  </div>
                  <button onClick={() => window.print()} className="w-full bg-slate-900 text-white py-2 rounded font-medium hover:bg-slate-800 transition cursor-pointer">
                  🖨️ Imprimer les coordonnées du point
                  </button>
              </div>
          </div>
                                                
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                      <h3 className="font-black text-slate-800 text-sm uppercase border-b pb-2">Tolérance d'Écart {relType === 'delambre' ? 'du Point' : `d'angle`} </h3>
                      <p className="text-xs text-slate-500 font-semibold mt-1">Vecteur d'erreur {relType === 'delambre' ? 'inter-chemin (AB / BC)' : (<span>angulaire (angle<sup>mesuré</sup> / angle<sup>calculé</sup>)</span>) } : <strong>{(resSD3.erreurFermeturePoint).toFixed(3)} {relType === 'delambre' ? 'm' : 'grad'}</strong></p>
                  </div>
              <div className="w-full py-2.5 rounded text-sm font-bold text-center text-white bg-emerald-500">
                  ✓ {relType === 'delambre' ? `FORMULE DE DELAMBRE ET EQUATIONS D'INTERSECTION` : 'METHODE BARYCENTRIQUE DIRECTE DE TIENSTRA'}
              </div>
          </div>

        </div>
                                              
    ) : (

      <div className="space-y-7">
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm overflow-x-auto">
            <table className="w-full text-left font-mono text-base border-collapse">
                <thead>
                    <tr className="bg-slate-900 border-b text-slate-200 uppercase text-xs tracking-wider">
                        <th className="p-4">POINT</th>
                        <th className="p-4">X (STT)</th>
                        <th className="p-4">Y (STT)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr className="hover:bg-slate-600/20">
                        <td className="p-2 text-emerald-300">S</td>
                        <td className="p-2 text-emerald-500">{pointStationneS.x.toFixed(3)}</td>
                        <td className="p-4 text-emerald-500">{pointStationneS.y.toFixed(3)}</td>
                    </tr>
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
                color: "#e2e2e2",
                colorbar: { title: 'Altitude (m)',
                  titleside: 'right',
                  titlefont: { color: '#eee' },
                  tickfont: { color: '#ccc' }
                 },
                 line: { color: '#000', width: 0.5 }
              },
              name: 'Points Référentiels',
              showlegend: true,
              hovertemplate: '%{text}<br>X: %{x:.3f}<br>Y: %{y:.3f}<extra></extra>',
            },
            {
              type: 'scatter3d',
              mode: 'markers',
              x: [pointStationneS!.x],
              y: [pointStationneS!.y],
              z: [pointStationneS!.z],
              marker: {
                size: 3,
                color: "#fe4357",
                line: { color: '#000', width: 0.5 }
              },
              name: 'Point Stationné S',
              showlegend: true,
              hovertemplate: 'Station S<br>X: %{x:.3f}<br>Y: %{y:.3f}<extra></extra>',
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
            <span><strong>⚪ Points</strong> = points Référentiels</span>
            <span><strong>🔴 Point</strong> = point stationné</span>
            <span><strong>📐 Échelle</strong> respectée (aspectmode='data')</span>
            <span><strong>🖱️</strong> Rotation : clic gauche + glisser</span>
        </div>
      </div>
    </div>
    
    <div className="space-y-7">
          {relType ===  'delambre' ? (
            <div className="bg-slate-950 p-6 rounded-2xl border font-mono text-emerald-400 text-xs space-y-3 shadow-inner">                                             
              <p>cot(α(<strong className='text-yellow-500 text-black'>AŜB</strong>)) = <strong className='text-yellow-500 text-black'>{resSD3.cotAlpha.toFixed(3)}</strong></p>
              <p>cot(β(<strong className='text-yellow-500 text-black'>BŜC</strong>)) = <strong className='text-yellow-500 text-black'>{resSD3.cotBeta.toFixed(3)}</strong></p>
              <p>cot(γ(<strong className='text-yellow-500 text-black'>AŜC</strong>)) = <strong className='text-yellow-500 text-black'>{resSD3.cotGamma.toFixed(3)}</strong></p>
            </div>

            ) : ( 

            <div className="bg-slate-950 p-6 rounded-2xl border font-mono text-emerald-400 text-xs space-y-3 shadow-inner">
              <p>cot(α(<strong className='text-yellow-500 text-black'>AŜB</strong>)) = <strong className='text-yellow-500 text-black'>{resSD3.cotAlpha.toFixed(3)}</strong></p>
              <p>cot(β(<strong className='text-yellow-500 text-black'>BŜC</strong>)) = <strong className='text-yellow-500 text-black'>{resSD3.cotBeta.toFixed(3)}</strong></p>
              <p>cot(γ(<strong className='text-yellow-500 text-black'>AŜC</strong>)) = <strong className='text-yellow-500 text-black'>{resSD3.cotGamma.toFixed(3)}</strong></p>
              <p>L'orientement <strong className='text-yellow-500 text-black'>θ<sup>AB</sup></strong>  = Tan⁻¹(ΔY÷ΔX) = <strong className='text-yellow-500 text-black'>{resSD3.orientAB.toFixed(3)} grad</strong></p>
              <p>L'orientement <strong className='text-yellow-500 text-black'>θ<sup>BA</sup></strong>  = θ<sup>AB</sup> ± 200 = <strong className='text-yellow-500 text-black'>{resSD3.orientBA.toFixed(3)} grad</strong></p>
              <p>L'orientement <strong className='text-yellow-500 text-black'>θ<sup>BC</sup></strong>  = Tan⁻¹(ΔY÷ΔX) = <strong className='text-yellow-500 text-black'>{resSD3.orientBC.toFixed(3)} grad</strong></p>
              <p>L'orientement <strong className='text-yellow-500 text-black'>θ<sup>CB</sup></strong>  = θ<sup>BC</sup> ± 200 = <strong className='text-yellow-500 text-black'>{resSD3.orientCB.toFixed(3)} grad</strong></p>
              <p>L'orientement <strong className='text-yellow-500 text-black'>θ<sup>AC</sup></strong>  = Tan⁻¹(ΔY÷ΔX) = <strong className='text-yellow-500 text-black'>{resSD3.orientAC.toFixed(3)} grad</strong></p>
              <p>L'orientement <strong className='text-yellow-500 text-black'>θ<sup>CA</sup></strong>  = θ<sup>AC</sup> ± 200 = <strong className='text-yellow-500 text-black'>{resSD3.orientCA.toFixed(3)} grad</strong></p>
            </div>
          )}
    </div>

    {/* 2. Vue en plan (X → Y) */}
    <div style={cardStyle}>
       
      <div style={cardStyle}>
        <div style={headerStyle}>📌 Vue en plan</div>
        <div style={plotWrapperStyle}>
        <Plot
          data={[
            {
              type: 'scatter',
                mode: 'lines+markers',
                x: [...profilX, profilX[0]], // Boucle pour fermer le polygone
                y: [...profilY, profilY[0]], // Boucle pour fermer le polygone
                text: [...points, points[0]], // Boucle pour fermer le polygone
                line: { width: 1.5, smoothing: 0.4 },
                marker: {
                  size: 5,
                  color: '#e2e2e2',
                  colorscale: 'Viridis',
                  line: { color: '#fff', width: 0.5 }
                },
                name: 'Points Référentiels',
                hovertemplate: '%{text}<br>X: %{x:.1f}<br>Y: %{y:.3f}<extra></extra>',
            },
            {
              type: 'scatter',
                mode: 'markers',
                x: [pointStationneS!.x], 
                y: [pointStationneS!.y],
                text: ['Station S'],
                marker: {
                  size: 5,
                  color: '#fe4357',
                  colorscale: 'Viridis',
                  line: { color: '#fff', width: 0.5 }
                },
                name: 'Point Stationné S',
                hovertemplate: 'Station S<br>X: %{x:.3f}<br>Y: %{y:.3f}<extra></extra>',
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
            color: '#ccc'
          },
          yaxis: {
            title: 'Ordonnée Y (m)',
            gridcolor: '#2a2a4a',
            color: '#ccc',
            // range: [Math.min(...profilY) - 10, Math.max(...profilY) + 10],
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
              <span><strong>⚪ Points Blancs</strong> = points Référentiels</span>
              <span><strong>📍 Point Rouge</strong> = point Stationné</span>
        </div>
      </div>
      
    </div>
    

    <div className='space-7'>
  {relType ===  'delambre' ? (
                                                                   
      <div className="bg-slate-950 p-6 rounded-2xl border font-mono text-emerald-400 text-xs space-y-3 shadow-inner">
        <p className="text-white font-black text-sm">// FORMULE DE DELAMBRE ET FORMULE ANALYTIQUE D'INTERSECTION</p>
        <p>Formule de Delambre : </p>
        <p><strong className='text-yellow-500 text-black'>tan(θ<sup>AS</sup>)</strong> =「(YC - YA).cot(α) + (YB - YA).cot(γ) + (XB - XC)」÷「(XC - XA).cot(α) + (XB - XA).cot(γ) - (YB - YC)」= <strong className='text-yellow-500 text-black'>{resSD3.tanAS.toFixed(3)}</strong></p>
        <p><strong className='text-yellow-500 text-black'>tan(θ<sup>BS</sup>)</strong> =「(YC - YB).cot(α) + (YA - YB).cot(β) + (XC - XA)」÷「(XC - XB).cot(α) + (XA - XB).cot(β) - (YC - YA)」= <strong className='text-yellow-500 text-black'>{resSD3.tanBS.toFixed(3)}</strong></p>
        <p><strong className='text-yellow-500 text-black'>tan(θ<sup>CS</sup>)</strong> =「(YB - YC).cot(γ) + (YA - YC).cot(β) + (XA - XB)」÷「(XB - XC).cot(γ) + (XA - XC).cot(β) - (YA - YB)」= <strong className='text-yellow-500 text-black'>{resSD3.tanCS.toFixed(3)}</strong></p>
        <p>Coordonnées du point stationné S (XS, YS) par formules analytiques d'intersection : </p>
            <p> <strong className='text-yellow-500 text-black'>XS1</strong> = XA +「 ( (XB - XA) . tan(θ<sup>BS</sup>) - (YB - YA) ) ÷ ( tan(θ<sup>BS</sup>) - tan(θ<sup>AS</sup>) ) 」= <strong className='text-yellow-500 text-black'>{resSD3.xS1.toFixed(3)} m</strong></p>
            <p> <strong className='text-yellow-500 text-black'>YS1</strong> = YA +「 ( (XB - XA) . tan(θ<sup>BS</sup>) - (YB - YA) ) ÷ ( tan(θ<sup>BS</sup>) - tan(θ<sup>AS</sup>) ) 」. tan(θ<sup>AS</sup>) = <strong className='text-yellow-500 text-black'>{resSD3.yS1.toFixed(3)} m</strong></p>
            <p> <strong className='text-yellow-500 text-black'>XS2</strong> = XB +「 ( (XC - XB) . tan(θ<sup>CS</sup>) - (YC - YB) ) ÷ ( tan(θ<sup>CS</sup>) - tan(θ<sup>BS</sup>)  ) 」= <strong className='text-yellow-500 text-black'>{resSD3.xS2.toFixed(3)} m</strong></p>
            <p> <strong className='text-yellow-500 text-black'>YS2</strong> = YB +「 ( (XC - XB) . tan(θ<sup>CS</sup>) - (YC - YB) ) ÷ ( tan(θ<sup>CS</sup>) - tan(θ<sup>BS</sup>) ) 」. tan(θ<sup>BS</sup>) = <strong className='text-yellow-500 text-black'>{resSD3.yS2.toFixed(3)} m</strong></p>
            <p> <strong className='text-yellow-500 text-black'>XS</strong> =「 XS1 + XS2 」÷ 2 = <strong className='text-yellow-500 text-black'>{resSD3.xS.toFixed(3)} m</strong></p>
            <p> <strong className='text-yellow-500 text-black'>YS</strong> =「 YS1 + YS2 」÷ 2 = <strong className='text-yellow-500 text-black'>{resSD3.yS.toFixed(3)} m</strong></p>
        <p>Erreur de fermeture = √「 (XS1 - XS2)² + (YS1 - YS2)² 」= <strong className='text-yellow-500 text-black'>{resSD3.erreurCartésienne.toFixed(3)} m</strong></p>
      </div>

  ) : (
                                                                      
      <div className="bg-slate-950 p-6 rounded-2xl border font-mono text-emerald-400 text-xs space-y-3 shadow-inner">
        <p className="text-white font-black text-sm">// METHODE BARYCENTRIQUE DIRECTE DE TIENSTRA</p>
        <p>Angle au Sommet Â (<strong className='text-yellow-500 text-black'>CÂB</strong>) = | θ<sup>AC</sup> - θ<sup>AB</sup> | = <strong className='text-yellow-500 text-black'>{resSD3.sommetA.toFixed(3)} grad</strong></p>
        <p>Angle au Sommet B̂ (<strong className='text-yellow-500 text-black'>AB̂C</strong>) = | θ<sup>BA</sup> - θ<sup>BC</sup> | = <strong className='text-yellow-500 text-black'>{resSD3.sommetB.toFixed(3)} grad</strong></p>
        <p>Angle au Sommet Ĉ (<strong className='text-yellow-500 text-black'>AĈB</strong>) = | θ<sup>CB</sup> - θ<sup>CA</sup> | = <strong className='text-yellow-500 text-black'>{resSD3.sommetC.toFixed(3)} grad</strong></p>
        <p>cot(<strong className='text-yellow-500 text-black'>Â</strong>) = <strong className='text-yellow-500 text-black'>{resSD3.cotA.toFixed(3)}</strong></p>
        <p>cot(<strong className='text-yellow-500 text-black'>B̂</strong>) = <strong className='text-yellow-500 text-black'>{resSD3.cotB.toFixed(3)}</strong></p>
        <p>cot(<strong className='text-yellow-500 text-black'>Ĉ</strong>) = <strong className='text-yellow-500 text-black'>{resSD3.cotC.toFixed(3)}</strong></p>
        <p><strong className='text-yellow-500 text-black'>KA</strong> = 1 ÷「 cot(Â) - cot(β) 」= <strong className='text-yellow-500 text-black'>{resSD3.KA.toFixed(3)}</strong></p>
        <p><strong className='text-yellow-500 text-black'>KB</strong> = 1 ÷「 cot(B̂) - cot(γ) 」= <strong className='text-yellow-500 text-black'>{resSD3.KB.toFixed(3)}</strong></p>
        <p><strong className='text-yellow-500 text-black'>KC</strong> = 1 ÷「 cot(Ĉ) - cot(α) 」= <strong className='text-yellow-500 text-black'>{resSD3.KC.toFixed(3)}</strong></p>
        <p><strong className='text-yellow-500 text-black'>XS</strong> =「 KA . XA + KB . XB + KC . XC 」÷「 KA + KB + KC 」= <strong className='text-yellow-500 text-black'>{resSD3.S.x.toFixed(3)} m</strong></p>
        <p><strong className='text-yellow-500 text-black'>YS</strong> =「 KA . YA + KB . YB + KC . YC 」÷「 KA + KB + KC 」= <strong className='text-yellow-500 text-black'>{resSD3.S.y.toFixed(3)} m</strong></p>
        <p>L'orientement <strong className='text-yellow-500 text-black'>θ<sup>SA</sup></strong>  = Tan⁻¹(ΔY÷ΔX) = <strong className='text-yellow-500 text-black'>{resSD3.orientSA.toFixed(3)} grad</strong></p>
        <p>L'orientement <strong className='text-yellow-500 text-black'>θ<sup>SB</sup></strong>  = Tan⁻¹(ΔY÷ΔX) = <strong className='text-yellow-500 text-black'>{resSD3.orientCB.toFixed(3)} grad</strong></p>
        <p>L'orientement <strong className='text-yellow-500 text-black'>θ<sup>SC</sup></strong>  = Tan⁻¹(ΔY÷ΔX) = <strong className='text-yellow-500 text-black'>{resSD3.orientSC.toFixed(3)} grad</strong></p>
        <p><strong className='text-yellow-500 text-black'>α<sup>calculé</sup></strong> = | θ<sup>SB</sup> - θ<sup>SA</sup> | = <strong className='text-yellow-500 text-black'>{resSD3.AlphaCalc.toFixed(3)} grad</strong></p>
        <p><strong className='text-yellow-500 text-black'>β<sup>calculé</sup></strong> = | θ<sup>SC</sup> - θ<sup>SB</sup> | = <strong className='text-yellow-500 text-black'>{resSD3.BetaCalc.toFixed(3)} grad</strong></p>
        <p><strong className='text-yellow-500 text-black'>γ<sup>calculé</sup></strong> = α<sup>calculé</sup> + β<sup>calculé</sup> = <strong className='text-yellow-500 text-black'>{resSD3.GammaCalc.toFixed(3)} grad</strong></p>
        <p>Erreur de fermeture angulaire = √「 (α<sup>calculé</sup> - α<sup>mesuré</sup>)² + (β<sup>calculé</sup> - β<sup>mesuré</sup>)² 」= <strong className='text-yellow-500 text-black'>{resSD3.erreurAngulaire.toFixed(3)} grad</strong></p>
      </div>
      )}
    </div>
  </div>
  
  )}

</div>)}

export default TopoDashboard;