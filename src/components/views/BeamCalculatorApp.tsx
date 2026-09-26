import React, { useState, useMemo } from 'react';
import { calculateFullProject } from '../../core/btp/BeamEngine';

type Standard = 'BAEL91' | 'EC2';
type CalculationMethod = 'FORFAITAIRE' | 'CAQUOT' | 'LINEAR_ELASTIC';
type ExposureClass = 'NON_PREJUDICIABLE' | 'PREJUDICIABLE' | 'TRES_PREJUDICIABLE';
type BetonSupplyMode = 'BPE' | 'Chantier';

interface BeamInputs {
  standard: Standard;
  method: CalculationMethod;
  exposure: ExposureClass;
  nbPoutres: number;     // Nombre de poutres identiques

  // Géométrie (en mètres)
  L: number;            // Portée de la travée étudiée
  L_left?: number;      // Portée travée de gauche (optionnel)
  L_right?: number;     // Portée travée de droite (optionnel)
  b: number;            // Largeur de la section
  h: number;            // Hauteur totale
  cnom: number;         // Enrobage nominal (m)

  // Matériaux (en MPa)
  fc28_fck: number;     // fc28 (BAEL) ou fck (EC2)
  fe_fyk: number;       // fe (BAEL) ou fyk (EC2)

  // Charges linaires (en kN/m)
  G: number;            // Charge permanente
  Q: number;            // Charge d'exploitation

  // Diamètre estimé des barres longitudinales
  // Armatures TENDUES (Inférieures)
  nbInf: number;
  phiInf: number;       // Diamètre (mm)

  // Armatures COMPRIMÉES / COMPRESSIONS (Supérieures)
  nbSup: number;
  phiSup: number;       // Diamètre (mm)

  // Armatures estimé des cadres
  st0: number;          // espacement initiale (m)
  phi_trans: number;    // Diamètre (mm)

  // Pertes & Coefficients
  perteBetonPct: number; // % perte béton
  perteAcierPct: number; // % chute découpe acier

  // Mode Approvisionnement Béton
  supplyMode: BetonSupplyMode

}

interface CostInputs {
  unitPriceConcrete: number;  // Prix du m3 de béton (TND/m³)
  unitPriceSteel: {[fe: number]: number};     // Prix du kg d'acier (TND/kg)
  unitPriceFormwork: number;  // Prix du m2 de coffrage (TND/m²)
  // unitPriceLabor: number;     // Main d'œuvre par m3 de béton (€/m³)
  cementDosage: number;       // Dosage en ciment (kg/m³, ex: 350)
  cementBagPrice: number;     // Prix d'un sac de ciment 50kg (TND)
  sandApparentDensity: number;   // Densité apparente du sable (t/m³, ex: 1.6)
  gravelApparentDensity: number;   // Densité apparente du gravier (t/m³, ex: 1.5)
  sandUnitPrice: number;      // Prix du m3 de sable (TND/m³)
  gravelUnitPrice: number;    // Prix du m3 de gravier (TND/m³)
  waterUnitPrice: number;     // prix du m3 d'eau de Sonede (TND/M3, ex:1.040)
  steelBars: { [diameter: number]: {[fe: number]: number} }; // Prix indicatif par diamètre de barre (TND/barre de 12m)
}

export const BeamCalculatorApp = ({ isAcademicMode }: { isAcademicMode: boolean }) => {
  // --------------------------------------------------------------------
  // ÉTAT DES DONNÉES D'ENTRÉE (STRUCTURES & MATÉRIAUX)
  // --------------------------------------------------------------------
  const [standard, setStandard] = useState<Standard>('BAEL91');
  const [method, setMethod] = useState<CalculationMethod>('FORFAITAIRE');
  const [exposure, setExposure] = useState<ExposureClass>('NON_PREJUDICIABLE');

  // nombre de poutres identiques
  const [nbPoutres, setNbPoutres] = useState<number>(1);

  // Géométrie
  const [L, setL] = useState<number>(5.0);
  const [L_left, setL_Left] = useState<number>(5.0);
  const [L_right, setL_Right] = useState<number>(5.0);
  const [b, setB] = useState<number>(0.25);
  const [h, setH] = useState<number>(0.50);
  const [cnom, setCnom] = useState<number>(0.03); // en mètres (30mm)

  // Matériaux
  const [fc28, setFc28] = useState<number>(25);
  const [fe, setFe] = useState<number>(400);

  // Charges
  const [G, setG] = useState<number>(15.0);
  const [Q, setQ] = useState<number>(10.0);

  // Armatures TENDUES (Inférieures)
  const [nbInf, setNbInf] = useState<number>(3);
  const [phiInf, setPhiInf] = useState<number>(12);

  // Armatures COMPRIMÉES / COMPRESSIONS (Supérieures)
  const [nbSup, setNbSup] = useState<number>(3);
  const [phiSup, setPhiSup] = useState<number>(10);

  // Armatures transversales (cadres)
  const [st0, setSt0] = useState<number>(0.20);  // espacement initial (m)
  const [phiTrans, setPhiTrans] = useState<number>(6); // Diamètre (mm)

  // Coefficients des pertes
  const [perteBetonPct, setPerteBetonPct] = useState<number>(5); // % perte béton
  const [perteAcierPct, setPerteAcierPct] = useState<number>(10); // % chute découpe acier

  // Mode Approvisionnement Béton
  const [supplyMode, setSupplyMode] = useState<BetonSupplyMode>('Chantier');

  // --------------------------------------------------------------------
  // ÉTAT DES DONNÉES FINANCIÈRES & CHANTIER (CARTE 3)
  // --------------------------------------------------------------------
  const [costInputs, setCostInputs] = useState<CostInputs>({
    unitPriceConcrete: 240,   // TND/m³
    unitPriceSteel: {400: 3.8, 500: 4.7},     // TND/kg
    unitPriceFormwork: 22,    // TND/m²
    // unitPriceLabor: 230,   // TND/m³
    cementDosage: 350,        // kg/m³
    cementBagPrice: 15,      // TND par sac 50kg
    sandApparentDensity: 1.6,
    gravelApparentDensity: 1.5,
    sandUnitPrice: 35,
    gravelUnitPrice: 35,
    waterUnitPrice: 1.04, // prix du m3 d'eau de Sonede (TND/M3, ex:1.040)
    steelBars: { 8: {400: 14, 500: 16.5}, 10: {400: 19, 500: 23.5}, 12: {400: 29.5, 500: 33.5}, 14:{400: 41, 500: 46.5} , 16: {400: 54, 500: 60.5} , 20: {400: 88, 500: 98.5} , 25: {400: 138, 500: 154} },
  });

  // --------------------------------------------------------------------
  // CALCULS DYNAMIQUES VIA LE MOTEUR
  // --------------------------------------------------------------------
  const beamInputs: BeamInputs = useMemo(() => ({
    standard,
    method,
    exposure,
    nbPoutres,
    L,
    L_left: method === 'CAQUOT' ? L_left : undefined,
    L_right: method === 'CAQUOT' ? L_right : undefined,
    b,
    h,
    cnom,
    fc28_fck: fc28,
    fe_fyk: fe,
    G,
    Q,
    nbInf,
    phiInf,
    nbSup,
    phiSup,
    st0,
    phi_trans: phiTrans,
    perteBetonPct,
    perteAcierPct,
    supplyMode,
  }), [standard, method, exposure, nbPoutres, L, L_left, L_right, b, h, cnom, fc28, fe, G, Q, nbInf, phiInf, nbSup, phiSup, st0, phiTrans, perteBetonPct, perteAcierPct, supplyMode ]);

  const report = useMemo(() => {
    try {
      return calculateFullProject(beamInputs, costInputs);
    } catch (e) {
      console.error("Erreur de calcul :", e);
      return null;
    }
  }, [beamInputs, costInputs]);

  const handleCostChange = (field: keyof CostInputs, value: any) => {
    setCostInputs(prev => ({ ...prev, [field]: value }));
  };

  if (!report) {
    return <div className="p-8 text-red-600 font-bold">Erreur lors de l'exécution des calculs RDM/BA.</div>;
  }

  const { structuralReport, quantities, finances } = report;
  const { forces, ulsFlexion, ulsShear, slsCheck } = structuralReport;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-1 space-y-8 bg-gray-50 text-gray-900 min-h-screen">

        <div className={`p-6 rounded-2xl border bg-white border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-sm`}>
          <div className="flex flex-col">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Norme de Calcul</label>
              <select 
              className={`p-3 border bg-white border-slate-300 rounded-xl font-bold h-12 text-base`} 
              value={standard} 
              onChange={e => setStandard(e.target.value as Standard)}>
              <option value="BAEL91">BAEL 91 (Révisé 99)</option>
              <option value="EC2">Eurocode 2 (NF EN 1992)</option>
              </select>
          </div>
          <div className="flex flex-col">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Méthode Hyperstatique</label>
              <select 
              className={`p-3 border bg-white border-slate-300 rounded-xl font-bold h-12 text-base`} 
              value={method} 
              onChange={e => setMethod(e.target.value as CalculationMethod)}>
              <option value="FORFAITAIRE">Méthode Forfaitaire</option>
              <option value="CAQUOT">Méthode de Caquot</option>
              <option value="LINEAR_ELASTIC">RDM Élastique (3 Moments)</option>
              </select>
          </div>
          <div className="flex flex-col">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Exposition / Fissuration</label>
              <select 
              className={`p-3 border bg-white border-slate-300 rounded-xl font-bold h-12 text-base`} 
              value={exposure} 
              onChange={e => setExposure(e.target.value as ExposureClass)}>
              <option value="NON_PREJUDICIABLE">Fissuration peu préjudiciable</option>
              <option value="PREJUDICIABLE">Fissuration préjudiciable</option>
              <option value="TRES_PREJUDICIABLE">Très préjudiciable</option>
              </select>
          </div>
        </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* BLOC 1 : GEOMETRIE & CHARGES */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                    <h2 className="text-xs font-black uppercase text-indigo-600 tracking-wider flex items-center gap-2">
                        <span>📐</span> 1. Géométrie & Charges
                    </h2>
                    <div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <label className="text-xs font-bold text-slate-500">Larg. b (m)</label>
                            <input type="number" step="0.01" value={b} onChange={e => setB(Number(e.target.value))} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold mt-1" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500">Haut. h (m)</label>
                            <input type="number" step="0.01" value={h} onChange={e => setH(Number(e.target.value))} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold mt-1" />
                        </div>
                      </div>
                      <div>
                            <label className="text-xs font-bold text-slate-500">Enrobage c (m)</label>
                            <input type="number" step="0.005" value={cnom} onChange={e => setCnom(Number(e.target.value))} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold mt-1" />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500">Portée L (m)</label>
                          <input type="number" step="0.1" value={L} onChange={e => setL(Number(e.target.value))} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold mt-1" />
                      </div>
                      {method === 'CAQUOT' && (
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <label className="text-xs font-bold text-slate-500">Portée gauche Lw (m)</label>
                            <input type="number" step="0.5" value={L_left} onChange={e => setL_Left(Number(e.target.value))} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold mt-1" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500">Portée droite Ld (m)</label>
                            <input type="number" step="0.5" value={L_right} onChange={e => setL_Right(Number(e.target.value))} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold mt-1" />
                        </div>
                      </div>
                      )}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <label className="text-xs font-bold text-slate-500">Charge G (kN/m)</label>
                            <input type="number" step="0.5" value={G} onChange={e => setG(Number(e.target.value))} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold mt-1" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500">Charge Q (kN/m)</label>
                            <input type="number" step="0.5" value={Q} onChange={e => setQ(Number(e.target.value))} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold mt-1" />
                        </div>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500">fc28 (MPa)</label>
                          <input type="number" value={fc28} onChange={e => setFc28(Number(e.target.value))} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold mt-1" />
                      </div>
                    </div>
                </div>

                {/* BLOC 2 : ACIER */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                    <h2 className="text-xs font-black uppercase text-amber-600 tracking-wider flex items-center gap-2">
                        <span>⚙️</span> 2. Ferraillage
                    </h2>
                    <div className="space-y-2">
                        <span className="text-xs font-black text-slate-400 uppercase">Aciers Montage/Sup.</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="grid grid-cols-1">
                              <label className="text-xs font-bold text-slate-500">Nombre</label>
                              <input type="number" placeholder="Nombre" value={nbInf} className="p-2.5 bg-slate-300 border rounded-xl font-bold text-sm" disabled={true} />
                          </div>
                          <div className="grid grid-cols-1">
                              <label className="text-xs font-bold text-slate-500">diamétre (mm)</label>
                              <select value={phiSup} onChange={e => setPhiSup(Number(e.target.value))} className="p-2.5 bg-slate-50 border rounded-xl font-bold text-sm">
                                {[8, 10, 12, 14, 16, 20, 25].map(phi => <option key={phi} value={phi}>Ø {phi}</option>)}
                              </select>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 font-bold mt-2">Section existante : <span>{(ulsFlexion.As_sup).toFixed(2)} cm²</span></p>
                    </div>
                    <div className="border-t pt-3 space-y-2">
                        <span className="text-xs font-black text-slate-400 uppercase">Aciers Tendus (Inférieurs)</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="grid grid-cols-1">
                            <label className="text-xs font-bold text-slate-500">Nombre</label>
                            <input type="number" placeholder="Nombre" value={nbInf} onChange={e => {setNbSup(Number(e.target.value)) ; setNbInf(Number(e.target.value))}} className="p-2.5 bg-slate-50 border rounded-xl font-bold text-sm" />
                          </div>
                            <div className="grid grid-cols-1">
                              <label className="text-xs font-bold text-slate-500">diamétre (mm)</label>
                              <select value={phiInf} onChange={e => setPhiInf(Number(e.target.value))} className="p-2.5 bg-slate-50 border rounded-xl font-bold text-sm">
                                {[8, 10, 12, 14, 16, 20, 25].map(phi => <option key={phi} value={phi}>Ø {phi}</option>)}
                              </select>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 font-bold mt-2">Section existante : <span className="text-blue-600">{(ulsFlexion.As_inf).toFixed(2)} cm²</span></p>
                    </div>
                    <div className="border-t pt-3 space-y-2">
                      <span className="text-xs font-black text-slate-400 uppercase">Aciers Transversales (Cadres)</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="grid grid-cols-1">
                                <label className="text-xs font-bold text-slate-500">Espacment st0</label>
                                <input type="number" step="0.05" placeholder="Nombre" value={st0} onChange={e => setSt0(Number(e.target.value))} className="p-2.5 bg-slate-50 border rounded-xl font-bold text-sm" />
                            </div>
                            <div className="grid grid-cols-1">
                                <label className="text-xs font-bold text-slate-500">diamétre (mm)</label>
                                <select value={phiTrans} onChange={e => setPhiTrans(Number(e.target.value))} className="p-2.5 bg-slate-50 border rounded-xl font-bold text-sm">
                                    {[6, 8, 10, 12, 14].map(phi => <option key={phi} value={phi}>Ø {phi}</option>)}
                                </select>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 font-bold mt-2">Section existante : <span className="text-blue-600">{(ulsShear.As_trans).toFixed(2)} cm²</span></p>
                        <p className="text-xs text-slate-500 font-bold mt-2">Ratio de ferraillage trans : <span className="text-blue-600">{(ulsShear.Ast_reel_s).toFixed(2)} cm²/m</span></p>
                    </div>
                    <div className="border-t pt-3 space-y-2 grid grid-cols-1">
                        <label className="text-xs font-bold text-slate-500">fe (MPa)</label>
                        <select value={fe} onChange={e => setFe(Number(e.target.value))} className="p-2.5 bg-slate-50 border rounded-xl font-bold text-sm">
                            {[400, 500].map(fe => <option key={fe} value={fe}>{fe}</option>)}
                        </select>
                        
                    </div>
                </div>

                {/* BLOC 3 : COMPOSANTS & PERTES */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                    <h2 className="text-xs font-black uppercase text-emerald-600 tracking-wider flex items-center gap-2">
                        <span>🏗️</span> 3. Pertes & Approvisionnement
                    </h2>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <label className="text-xs font-bold text-slate-500">Perte Béton (%)</label>
                            <input type="number" value={perteBetonPct} onChange={e => setPerteBetonPct(Number(e.target.value))} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold mt-1" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500">Chute Acier (%)</label>
                            <input type="number" value={perteAcierPct} onChange={e => setPerteAcierPct(Number(e.target.value))} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold mt-1" />
                        </div>
                    </div>
                    <div className="space-y-2 pt-2 border-t">
                        <label className="text-xs font-bold text-slate-500">Fabrication Béton</label>
                        <select 
                            value={supplyMode} 
                            onChange={e => setSupplyMode(e.target.value as BetonSupplyMode)}
                            className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm"
                        >
                            <option value="Chantier">Dosage sur Chantier</option>
                            <option value="BPE">Béton Prêt à l'Emploi</option>
                        </select>
                    </div>
                    <div className="pt-2">
                        <label className="text-xs font-bold text-slate-500">Nombre de poutres identiques</label>
                        <input type="number" value={nbPoutres} onChange={e => setNbPoutres(Number(e.target.value))} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold mt-1" />
                    </div>
                </div>

            </div>

      {isAcademicMode ? (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* CARTE 1 : SOLLICITATIONS & ANALYSE RDM */}
        <div className="bg-white p-6 rounded-2xl shadow border border-gray-200 space-y-4">
          <div className="flex-column justify-between items-center border-b pb-2">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              📊 1. SOLLICITATIONS & RDM
            </h3>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
              ELU / ELS
            </span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="bg-slate-50 p-3 rounded-lg space-y-1">
              <p className="text-xs text-slate-500 font-medium">Combination de Charges</p>
              <div className="flex justify-between font-bold text-slate-700">
                <span>pu (ELU) = {forces.pu.toFixed(2)} kN/m</span>
                <span>pser (ELS) = {forces.pser.toFixed(2)} kN/m</span>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg space-y-2">
              <p className="text-xs text-slate-500 font-medium">Moments isostatiques M0</p>
              <div className="flex justify-between">
                <span>M0,u : <strong>{forces.M0_u.toFixed(2)} kNm</strong></span>
                <span>M0,ser : <strong>{forces.M0_ser.toFixed(2)} kNm</strong></span>
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-2 bg-blue-50/50">
              <p className="text-xs font-bold text-blue-900 uppercase">Moments en Travée & Appuis</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Moment Travée (Mu) :</span>
                  <strong className="text-blue-700">{forces.Mu_span.toFixed(2)} kNm</strong>
                </div>
                <div className="flex justify-between">
                  <span>Appui Gauche (Mw,u) :</span>
                  <span>{forces.Mu_support_left.toFixed(2)} kNm</span>
                </div>
                <div className="flex justify-between">
                  <span>Appui Droit (Me,u) :</span>
                  <span>{forces.Mu_support_right.toFixed(2)} kNm</span>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 flex justify-between items-center">
              <span className="font-bold text-amber-900 text-xs">Effort Tranchant Max (Vu)</span>
              <span className="text-base font-extrabold text-amber-800">{forces.Vu_max.toFixed(2)} kN</span>
            </div>
          </div>
        </div>

        {/* CARTE 2 : DIMENSIONNEMENT BAEL / EUROCODE */}
        <div className="bg-white p-6 rounded-2xl shadow border border-gray-200 space-y-4">
          <div className="flex-column justify-between items-center border-b pb-2">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              🏗️ 2. DIMENSIONNEMENT BA
            </h3>
            <span className={`text-xs font-bold px-2 py-1 rounded ${structuralReport.globalOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {structuralReport.globalOk ? 'CONFORME' : 'ATTENTION'}
            </span>
          </div>

          <div className="space-y-3 text-sm">
            <h1 className="text-xm font-bold text-slate-800">ELU 💥:</h1>

            <div className={`${(ulsFlexion.acierEluOk && ulsFlexion.betonEluOk) ? 'bg-emerald-100/50 text-emerald-800 border-emerald-200' : 'bg-red-100/50 text-red-800 border-red-200'} p-3 rounded-lg border border-bold-200 space-y-1`}>
              <h2 className="text-xm font-bold text-slate-800">Flexion ➰:</h2>
              <p className="text-xs font-bold text-slate-900">Section de Béton (Ac)</p>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-700">Moment Ultime Réduit:</span>
                <span className="text-xm font-black text-slate-800">{ulsFlexion.mu_bu.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-700">Moment Réduit Limite:</span>
                <span className="text-xm font-black text-slate-800">0.392</span>
              </div>
              <p className={`text-xs text-center font-black ${ulsFlexion.betonEluOk ? 'text-emerald-800 border-emerald-200' : 'text-red-800 border-red-200'}`}>{ulsFlexion.mu_bu.toFixed(2)} &lt; 0.392</p>
              <div className={`text-[11px] ${ulsFlexion.betonEluOk ? 'text-emerald-800 border-emerald-200' : 'text-red-800 border-red-200'}`}>
                <span>{ulsFlexion.betonEluOk ? '✓' : '❌'} Résistance Béton ELU : {ulsFlexion.pivotChoice}</span>
              </div>
              <br />
              <p className="text-xs font-bold text-slate-900">Section d'Acier Longitudinale (As)</p>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-700">Section d'acier Éxistante:</span>
                <span className="text-xm font-black text-slate-800">{ulsFlexion.As_inf.toFixed(2)} <span className="text-xs">cm²</span></span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-700">Section d'acier Requise:</span>
                <span className="text-xm font-black text-slate-800">{structuralReport.As_min_final.toFixed(2)} <span className="text-xs">cm²</span></span>
              </div>
              <div className="text-[11px] text-slate-600 flex justify-between pt-1">
                <span>ELU: {ulsFlexion.As_ELU.toFixed(2)} cm²</span> /
                <span>ELS: {slsCheck.As_ELS.toFixed(2)} cm²</span> /
                <span>Min: {structuralReport.As_min.toFixed(2)} cm²</span>
              </div>
              <p className={`text-xs text-center font-black ${ulsFlexion.acierEluOk ? 'text-emerald-800 border-emerald-200' : 'text-red-800 border-red-200'}`}>{ulsFlexion.As_inf.toFixed(2)} &gt; {ulsFlexion.As_ELU.toFixed(2)}</p>
              <div className={`text-[11px] ${ulsFlexion.acierEluOk ? 'text-emerald-800 border-emerald-200' : 'text-red-800 border-red-200'}`}>
                <span>{ulsFlexion.acierEluOk ? '✓' : '❌'} Résistance Aciers ELU : {ulsFlexion.acierEluOk ? 'Suffisante' : 'Insuffisante (Augmenter diamètre)'}</span>
              </div>
            </div>

            <div className={`${(ulsShear.cisaillementOk && ulsShear.AcierTransOk) ? 'bg-emerald-100/50 text-emerald-800 border-emerald-200' : 'bg-red-100/50 text-red-800 border-red-200'} p-3 rounded-lg border border-bold-200 space-y-1`}>
              <h2 className="text-xm font-bold text-slate-800">Cisaillement ✂️:</h2>
              <p className="text-xs font-bold text-slate-900">Section de Béton (Ac)</p>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-700">Contrainte Tangentielle:</span>
                <span className="text-xm font-black text-slate-800">{ulsShear.tau_u.toFixed(2)} <span className="text-xs">MPa</span></span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-700">Contrainte Limite:</span>
                <span className="text-xm font-black text-slate-800">{ulsShear.tau_u_lim.toFixed(2)} <span className="text-xs">MPa</span></span>
              </div>
              <p className={`text-xs text-center font-black ${ulsShear.cisaillementOk ? 'text-emerald-800 border-emerald-200' : 'text-red-800 border-red-200'}`}>{ulsShear.tau_u.toFixed(2)} &lt; {ulsShear.tau_u_lim.toFixed(2)}</p>
              <div className={`text-[11px] ${ulsShear.cisaillementOk ? 'text-emerald-800 border-emerald-200' : 'text-red-800 border-red-200'}`}>
                <span>{ulsShear.cisaillementOk ? '✓' : '❌'} Résistance Béton ELU : {ulsShear.cisaillementOk ? 'Suffisante' : 'Insuffisante (Augmenter la section de béton)'}</span>
              </div>
              <br />
              <p className="text-xs font-bold text-slate-900">Section d'Acier Transversales (Ast)</p>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-700">Section d'acier Éxistante:</span>
                <span className="text-xm font-black text-slate-800">{ulsShear.As_trans.toFixed(2)} <span className="text-xs">cm²</span></span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-700">Ratio de Ferraillage Trans:</span>
                <span className="text-xm font-black text-slate-800">{ulsShear.Ast_reel_s.toFixed(2)} <span className="text-xs">cm²/m</span></span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-700">Ratio de Ferraillage Requis:</span>
                <span className="text-xm font-black text-slate-800">{ulsShear.Ast_over_s.toFixed(2)} <span className="text-xs">cm²/m</span></span>
              </div>
              <p className={`text-xs text-center font-black ${ulsShear.AcierTransOk ? 'text-emerald-800 border-emerald-200' : 'text-red-800 border-red-200'}`}>{ulsShear.Ast_reel_s.toFixed(2)} &gt; {ulsShear.Ast_over_s.toFixed(2)}</p>
              <div className={`text-[11px] ${ulsShear.AcierTransOk ? 'text-emerald-800 border-emerald-200' : 'text-red-800 border-red-200'}`}>
                <span>{ulsShear.AcierTransOk ? '✓' : '❌'} Résistance Aciers ELU : {ulsShear.AcierTransOk ? 'Suffisante' : 'Insuffisante (Augmenter diamètre des cadres ou ajuster les espacements)'}</span>
              </div>
            </div>

            <h1 className="text-xm font-bold text-slate-800">ELS 🧊:</h1>
            <div className={`${(slsCheck.elsStressOk) ? 'bg-emerald-100/50 text-emerald-800 border-emerald-200' : 'bg-red-100/50 text-red-800 border-red-200'} p-3 rounded-lg border border-bold-200 space-y-1`}>
              <h2 className="text-xm font-bold text-slate-800">Contraintes & Vérification ⛓️:</h2>
              <p className="text-xs font-bold text-slate-900">Contrainte de Béton:</p>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-700">Béton (σc):</span>
                <span className="text-xm font-black text-slate-800">{slsCheck.sigma_c.toFixed(2)} <span className="text-xs">MPa</span></span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-700">Béton Admissible (σc_adm):</span>
                <span className="text-xm font-black text-slate-800">{slsCheck.sigma_c_lim.toFixed(2)} <span className="text-xs">MPa</span></span>
              </div>
              <p className={`text-xs text-center font-black ${(slsCheck.sigma_c < slsCheck.sigma_c_lim) ? 'text-emerald-800 border-emerald-200' : 'text-red-800 border-red-200'}`}>{slsCheck.sigma_c.toFixed(2)} &lt; {slsCheck.sigma_c_lim.toFixed(2)}</p>
              <div className={`text-[11px] ${(slsCheck.sigma_c < slsCheck.sigma_c_lim) ? 'text-emerald-800 border-emerald-200' : 'text-red-800 border-red-200'}`}>
                <span>{(slsCheck.sigma_c < slsCheck.sigma_c_lim) ? '✓' : '❌'} Résistance Béton ELS : {(slsCheck.sigma_c < slsCheck.sigma_c_lim) ? 'Suffisante' : 'Insuffisante (Agrandir la section de béton)'}</span>
              </div>
              {exposure !== 'NON_PREJUDICIABLE' && (
              <div>
              <br />
              <p className="text-xs font-bold text-slate-900">Contrainte d'Acier:</p>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-700">Acier (σs):</span>
                <span className="text-xm font-black text-slate-800">{slsCheck.sigma_s.toFixed(2)} <span className="text-xs">MPa</span></span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-700">Acier Admissible (σs_adm):</span>
                <span className="text-xm font-black text-slate-800">{slsCheck.sigma_s_lim.toFixed(2)} <span className="text-xs">MPa</span></span>
              </div>
              <p className={`text-xs text-center font-black ${(slsCheck.sigma_s < slsCheck.sigma_s_lim) ? 'text-emerald-800 border-emerald-200' : 'text-red-800 border-red-200'}`}>{slsCheck.sigma_s.toFixed(2)} &lt; {slsCheck.sigma_s_lim.toFixed(2)}</p>
              <div className={`text-[11px] ${(slsCheck.sigma_s < slsCheck.sigma_s_lim) ? 'text-emerald-800 border-emerald-200' : 'text-red-800 border-red-200'}`}>
                <span>{(slsCheck.sigma_s < slsCheck.sigma_s_lim) ? '✓' : '❌'} Résistance Aciers ELS : {(slsCheck.sigma_s < slsCheck.sigma_s_lim) ? 'Suffisante' : 'Insuffisante (Augmenter diamètre des armatures longitudinales)'}</span>
              </div>
              </div>)}
            </div>

            <div className={`${slsCheck.flecheOk ? 'bg-emerald-100/50 text-emerald-800 border-emerald-200' : 'bg-red-100/50 text-red-800 border-red-200'} p-3 rounded-lg border border-bold-200 space-y-1`}>
              <h2 className="text-xm font-bold text-slate-800">Déformation 🏹:</h2>
              <p className="text-xs font-bold text-slate-900">Fléche maximale:</p>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-700">Fléche Maximale Calculée:</span>
                <span className="text-xm font-black text-slate-800">{slsCheck.fleche_calc.toFixed(2)} <span className="text-xs">cm</span></span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-700">Fléche Maximale Limité:</span>
                <span className="text-xm font-black text-slate-800">{slsCheck.fleche_lim.toFixed(2)} <span className="text-xs">cm</span></span>
              </div>
              <p className={`text-xs text-center font-black ${slsCheck.flecheOk ? 'text-emerald-800 border-emerald-200' : 'text-red-800 border-red-200'}`}>{slsCheck.fleche_calc.toFixed(2)} &lt; {slsCheck.fleche_lim.toFixed(2)}</p>
              <div className={`text-[11px] ${slsCheck.flecheOk ? 'text-emerald-800 border-emerald-200' : 'text-red-800 border-red-200'}`}>
                <span>{slsCheck.flecheOk ? '✓' : '❌'} Déformation ELS : {slsCheck.flecheOk ? 'Admissible' : 'Critique (Augmenter la section de béton)'}</span>
              </div>
            </div>

          </div>
        </div>

        {/* CARTE 3 : QUANTITÉS & ESTIMATION FINANCIÈRE (CONSERVÉE ET ALIMENTÉE) */}
        <div className="bg-white p-6 rounded-2xl shadow border border-gray-200 space-y-4">
          <div className="flex-column justify-between items-center border-b pb-2">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              💰 3. QUANTITÉS & BUDGET
            </h3>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
              CHANTIER
            </span>
          </div>

          <div className="space-y-3 text-sm ">

            {/* Matériaux Requis sur Terrain */}
            <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200 space-y-2 text-xs">
              <p className="font-bold text-amber-900 border-b border-amber-200 pb-1">
                📦 Approvisionnement Chantier
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>Béton : <strong>{quantities.concreteVolume.toFixed(3)} m³</strong></div>
                <div>Acier total : <strong>{quantities.totalSteelWeight.toFixed(1)} kg</strong></div>
                <div>Sacs Ciment (50kg) : <strong>{quantities.cementBagsCount} sacs</strong></div>
                <div>Barres de 12m : <strong>~{quantities.totalBars12m} barres</strong></div>
                <div>Sable (brouettes) : <strong>{quantities.sandWheelbarrows} (~{quantities.sandVolumeApparent.toFixed(2)} m³)</strong></div>
                <div>Gravier (brouettes) : <strong>{quantities.gravelWheelbarrows} (~{quantities.gravelVolumeApparent.toFixed(2)} m³)</strong></div>
              </div>
            </div>

            {/* Décomposition Financière */}
            <div className="space-y-1.5 text-xs">
              <p className="font-bold text-slate-700">Répartition des Coûts :</p>
              <div className="flex justify-between border-b pb-1">
                <span>Béton prêt à l'emploi</span>
                <strong>{finances.costConcrete.toFixed(2)} €</strong>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span>Acier HA (Façonnage & Posé)</span>
                <strong>{finances.costSteel.toFixed(2)} €</strong>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span>Coffrage</span>
                <strong>{finances.costFormwork.toFixed(2)} €</strong>
              </div>
              {/* <div className="flex justify-between border-b pb-1">
                <span>Main d'Œuvre</span>
                <strong>{finances.costLabor.toFixed(2)} €</strong>
              </div> */}
            </div>
            
             {/* Total Budget */}
            <div className="bg-slate-900 text-white p-4 rounded-xl text-center space-y-">
              <p className="text-xs text-slate-400 font-medium uppercase">Budget Total Estimé</p>
              <p className="text-3xl font-black text-emerald-400">{finances.costTotal.toFixed(2)}</p>
              <div className="flex justify-around text-[11px] text-slate-300 pt-2 border-t border-slate-800">
                <span>{finances.costPerMeter.toFixed(2)} € / m.l.</span>
                <span>{finances.costPerM3.toFixed(2)} € / m³</span>
              </div>
            </div>
            
          </div>
        </div>

      </div>

      ) : (

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold uppercase border-b pb-2">📊 Audit Ouvrage & Décomptes (Métrés)</h3>
              <div className="space-y-4 shadow-sm">
                <div className="grid grid-cols-2 gap-4">
                  {phiInf === phiSup && (
                      <div className="bg-blue-50 p-3 rounded">
                          <span className="text-xs text-blue-800 block">Barres d'acier Ø {phiInf}</span>
                          <strong className="text-xl text-blue-950">{quantities.totalBars12m} barres</strong>
                      </div>
                    )}
                    {phiInf !== phiSup && (
                      <div className="bg-blue-50 p-3 rounded">
                          <span className="text-xs text-blue-800 block">Barres d'acier Ø {phiInf}</span>
                          <strong className="text-xl text-blue-950">{quantities.totalBars12m / 2} barres</strong>
                      </div>
                    )}
                    {phiInf !== phiSup && (
                    <div className="bg-blue-50 p-3 rounded">
                        <span className="text-xs text-blue-800 block">Barres d'acier Ø {phiSup}</span>
                        <strong className="text-xl text-blue-950">{quantities.totalBars12m / 2} barres</strong>
                    </div>
                    )}
                  <div className="bg-blue-50 p-3 rounded">
                      <span className="text-xs text-blue-800 block">Nombre des cadres Ø {phiTrans}</span>
                      <strong className="text-xl text-blue-950">{quantities.totalFrames} cadres</strong>
                  </div>
                  {nbInf > 2 && (
                  <div className="bg-blue-50 p-3 rounded">
                      <span className="text-xs text-blue-800 block">Nombre des étriers Ø {phiTrans}</span>
                      <strong className="text-xl text-blue-950">{quantities.totalcalipers} étriers</strong>
                  </div>
                  )}
                </div>
              <div className='p-1 rounded font-medium text-sm text-blue-950 bg-blue-50'>
                  Masse d'acier : {quantities.totalSteelWeight.toFixed(1)} kg
              </div>
              <div className="grid grid-cols-2 gap-4">
                  {supplyMode === 'BPE' && (
                    <div className="bg-amber-50 p-3 rounded">
                      <span className="text-xs text-amber-800 block">Volume de Béton</span>
                      <strong className="text-xl text-amber-950">{quantities.concreteVolume.toFixed(3)} m³</strong>
                    </div>
                  )}
                    {supplyMode !== 'BPE' && (
                      <div className="bg-amber-50 p-3 rounded">
                        <span className="text-xs text-amber-800 block">Sacs Ciment (50kg)</span>
                        <strong className="text-xl text-amber-950">{quantities.cementBagsCount} sacs</strong>
                      </div>
                    )}
                    {supplyMode !== 'BPE' && (
                      <div className="bg-amber-50 p-3 rounded">
                        <span className="text-xs text-amber-800 block">Volume de Sable (brouettes)</span>
                        <strong className="text-xl text-amber-950">{quantities.sandWheelbarrows} (~{quantities.sandVolumeApparent.toFixed(2)} m³)</strong>
                      </div>
                    )}
                    {supplyMode !== 'BPE' && (
                      <div className="bg-amber-50 p-3 rounded">
                        <span className="text-xs text-amber-800 block">Volume de Gravier (brouettes)</span>
                        <strong className="text-xl text-amber-950">{quantities.gravelWheelbarrows} (~{quantities.gravelVolumeApparent.toFixed(2)} m³)</strong>
                      </div>
                    )}
                    {supplyMode !== 'BPE' && (
                      <div className="bg-amber-50 p-3 rounded">
                        <span className="text-xs text-amber-800 block">Volume Eau</span>
                        <strong className="text-xl text-amber-950">{quantities.waterLiters} L</strong>
                      </div>
                    )}
                </div>
                <div className='p-1 rounded font-medium text-sm text-amber-950 bg-amber-50'>
                     Volume de Béton : {quantities.concreteVolume.toFixed(3)} m³
                </div>
                <div className={`p-3 rounded font-medium text-sm ${structuralReport.globalOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                     Dimensionnement est {structuralReport.globalOk ? 'validé' : 'invalide'}
                </div>
                <div className="border-t pt-2">
                  <p className="text-xs opacity-60">Solde Financier Travaux</p>
                  <strong className="text-2xl font-black">{finances.costTotal.toFixed(3)} TND</strong>
                </div>
                <button className="w-full bg-slate-900 text-white py-2 rounded font-medium hover:bg-slate-800 transition" onClick={() => window.print()}>
                    🖨️ Générer l'Attachement Officiel
                </button>
              </div>
              
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="bg-white flex flex-col gap-3">
                  <h3 className="font-bold uppercase border-b pb-2">🏗️ Dimensionnement BA</h3>
                  <div className="bg-white flex flex-col gap-1">
                      <h6 className="text-sm text-slate-600 font-semibold">Flexion :</h6>
                      <p className="text-xs text-slate-500 font-semibold">Section Béton : {ulsFlexion.pivotChoice} {ulsFlexion.betonEluOk ? '✔️' : '❌'}</p>
                      <p className="text-xs text-slate-500 font-semibold">Section d'Acier Long : {ulsFlexion.acierEluOk ? 'Suffisante ✔️' : 'Insuffisante (Augmenter diamètre) ❌'}</p>
                  </div>
                  <div className="bg-white flex flex-col gap-1">
                      <h6 className="text-sm text-slate-600 font-semibold">Cisaillement :</h6>
                      <p className="text-xs text-slate-500 font-semibold">Section Béton : {ulsShear.cisaillementOk ? 'Suffisante ✔️' : 'Insuffisante (Augmenter la section de béton) ❌'}</p>
                      <p className="text-xs text-slate-500 font-semibold">Section d'Acier Trans : {ulsShear.AcierTransOk ? 'Suffisante ✔️' : 'Insuffisante (Augmenter diamètre des cadres ou ajuster les espacements) ❌'}</p>
                  </div>
                  <div className="bg-white flex flex-col gap-1">
                      <h6 className="text-sm text-slate-600 font-semibold">Contraintes & Vérification :</h6>
                      <p className="text-xs text-slate-500 font-semibold">Contrainte Béton : {(slsCheck.sigma_c < slsCheck.sigma_c_lim) ? 'Admissible ✔️' : 'Critique (Agrandir la section de béton) ❌'}</p>
                      <p className="text-xs text-slate-500 font-semibold">Contrainte d'Acier : {(slsCheck.sigma_s < slsCheck.sigma_s_lim) ? 'Admissible ✔️' : 'Critique (Augmenter diamètre) ❌'}</p>
                  </div>
                  <div className="bg-white flex flex-col gap-1">
                      <h6 className="text-sm text-slate-600 font-semibold">Déformation :</h6>
                      <p className="text-xs text-slate-500 font-semibold">Flèche Maximale : {slsCheck.flecheOk ? 'Admissible ✔️' : 'Critique (Augmenter la section de béton) ❌'}</p>
                  </div>
              </div>
              <div className={`p-3 rounded text-center text-sm font-bold text-white ${structuralReport.globalOk ? 'bg-emerald-500' : 'bg-red-500'}`}>
              {structuralReport.globalOk ? '✓ DIMENSIONNEMENT VALIDÉ' : '❌ ATTENTION : DIMENSIONNEMENT INVALIDE'}
              </div>
            </div>
      </div>

      )}

      {/* BLOC MODIFIABLE : PRIX UNITAIRES DE CHANTIER (AJUSTABLE PAR CLIENT/ENTREPRISE) */}
      <section className="bg-white p-6 rounded-2xl shadow border border-gray-200 space-y-4">
        <details className="group">
          <summary className="font-bold text-slate-800 text-sm cursor-pointer flex justify-between items-center">
            <span>⚙️ AJUSTER LES PRIX UNITAIRES ET RATIOS DU MARCHÉ LOCAL</span>
            <span className="text-xs text-blue-600 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-4">
            {supplyMode === 'BPE' && (
              <div className="space-y-1">
                <label className="text-slate-600 font-semibold">Prix m³ du Béton (TND)</label>
                <input 
                  type="number" value={costInputs.unitPriceConcrete} 
                  onChange={e => handleCostChange('unitPriceConcrete', parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border rounded" 
                />
              </div>
            )}
            {supplyMode === 'Chantier' && (
              <div className="space-y-1">
                <label className="text-slate-600 font-semibold">Prix sac (50kg) du Ciment (TND)</label>
                <input 
                  type="number" value={costInputs.cementBagPrice} 
                  onChange={e => handleCostChange('cementBagPrice', parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border rounded" 
                />
              </div>
            )}
            {supplyMode === 'Chantier' && (
              <div className="space-y-1">
                <label className="text-slate-600 font-semibold">Prix m³ du Sable (TND)</label>
                <input 
                  type="number" value={costInputs.sandUnitPrice} 
                  onChange={e => handleCostChange('sandUnitPrice', parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border rounded" 
                />
              </div>
            )}
            {supplyMode === 'Chantier' && (
              <div className="space-y-1">
                <label className="text-slate-600 font-semibold">Prix m³ du Gravier (TND)</label>
                <input 
                  type="number" value={costInputs.gravelUnitPrice} 
                  onChange={e => handleCostChange('gravelUnitPrice', parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border rounded" 
                />
              </div>
            )}
            {supplyMode === 'Chantier' && (
              <div className="space-y-1">
                <label className="text-slate-600 font-semibold">Prix m³ d'Eau (TND)</label>
                <input 
                  type="number" value={costInputs.waterUnitPrice} 
                  onChange={e => handleCostChange('waterUnitPrice', parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border rounded" 
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-slate-600 font-semibold">Prix barre d'Acier Ø{phiInf} (TND)</label>
              <input 
                type="number" step="0.1" value={costInputs.steelBars[phiInf][fe]} 
                onChange={e => handleCostChange('steelBars', {...costInputs.steelBars, [phiInf]: {...costInputs.steelBars[phiInf], [fe]: parseFloat(e.target.value) || 0}})}
                className="w-full p-2 border rounded" 
              />
            </div>
            {phiInf !== phiSup && (
            <div className="space-y-1">
              <label className="text-slate-600 font-semibold">Prix barre d'Acier Ø{phiSup} (TND)</label>
              <input 
                type="number" step="0.1" value={costInputs.steelBars[phiSup][fe]} 
                onChange={e => handleCostChange('steelBars', {...costInputs.steelBars, [phiSup]: {...costInputs.steelBars[phiInf], [fe]: parseFloat(e.target.value) || 0}})}
                className="w-full p-2 border rounded" 
              />
            </div>
            )}
            <div className="space-y-1">
              <label className="text-slate-600 font-semibold">Prix kg d'Acier (TND)</label>
              <input 
                type="number" step="0.1" value={costInputs.unitPriceSteel[fe]} 
                onChange={e => handleCostChange('unitPriceSteel', {...costInputs.unitPriceSteel, [fe]: parseFloat(e.target.value) || 0})}
                className="w-full p-2 border rounded" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-600 font-semibold">Prix m² du Coffrage (TND)</label>
              <input 
                type="number" value={costInputs.unitPriceFormwork} 
                onChange={e => handleCostChange('unitPriceFormwork', parseFloat(e.target.value) || 0)}
                className="w-full p-2 border rounded" 
              />
            </div>
            {/* <div className="space-y-1">
              <label className="text-slate-600 font-semibold">Main d'Œuvre (€/m³)</label>
              <input 
                type="number" value={costInputs.unitPriceLabor} 
                onChange={e => handleCostChange('unitPriceLabor', parseFloat(e.target.value) || 0)}
                className="w-full p-2 border rounded" 
              />
            </div> */}
          </div>
        </details>
      </section>

    </div>
  );
};