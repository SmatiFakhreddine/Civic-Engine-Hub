/**
 * MOTEUR DE CALCUL DE STRUCTURE : POUTRES EN BÉTON ARMÉ (BAEL 91 & EUROCODE 2)
 * Et extension d'estimation quantitative et financière
 */

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

  // Armatures transversales (cadres)
  st0: number;          // espacement initiale (m)
  phi_trans: number;    // Diamètre (mm)

  // Pertes & Coefficients
  perteBetonPct: number; // % perte béton
  perteAcierPct: number; // % chute découpe acier

  // Mode Approvisionnement Béton
  supplyMode: BetonSupplyMode

}

interface InternalForcesResult {
  pu: number;                // kN/m
  pser: number;              // kN/m
  M0_u: number;              // kNm
  M0_ser: number;            // kNm
  Mu_span: number;           // kNm
  Mu_support_left: number;   // kNm
  Mu_support_right: number;  // kNm
  Mser_span: number;         // kNm
  Mser_support_left: number; // kNm
  Mser_support_right: number;// kNm
  Vu_max: number;            // kN
}

interface ULSFlexionResult {
  d: number;                // m
  fcd: number;              // MPa
  fyd: number;              // MPa
  mu_bu: number;
  pivotChoice: string;      // Indication du pivot utilisé pour le calcul
  betonEluOk: boolean;
  alpha: number;
  z: number;                // m
  As_ELU: number;           // cm²
  As_inf: number;           // cm² (section acier tendu réelle)
  As_sup: number;           // cm² (setion acier comprimé réelle)
  acierEluOk: boolean;          
}

interface ULSShearResult {
  Ved: number;              // kN
  tau_u: number;            // MPa
  tau_u_lim: number;        // MPa
  cisaillementOk: boolean;
  As_trans: number;         // cm² (setion acier transversale réelle)
  Ast_reel_s: number;       // cm²/m (espacement réel des cadres)
  Ast_over_s: number;       // cm²/m (espacement théorique des cadres)
  AcierTransOk: boolean;
}

interface SLSResult {
  sigma_c_lim: number;      // MPa
  sigma_s_lim: number;      // MPa
  y0: number;               // m
  I0: number;               // m^4
  sigma_c: number;          // MPa
  sigma_s: number;          // MPa
  As_ELS: number;           // cm²
  elsStressOk: boolean;
  fleche_calc: number;      // cm
  fleche_lim: number;      // cm
  flecheOk: boolean;
}

interface CalculationReport {
  inputs: BeamInputs;
  forces: InternalForcesResult;
  ulsFlexion: ULSFlexionResult;
  ulsShear: ULSShearResult;
  slsCheck: SLSResult;
  nonFragile: boolean;
  As_min: number;           // cm²      
  As_min_final: number;         // cm²
  globalOk: boolean;
}

// ----------------------------------------------------------------------
// CODE DU MOTEUR CONSERVÉ ET INTACT
// ----------------------------------------------------------------------

export class ConcreteBeamEngine {
  private inputs: BeamInputs;

  constructor(inputs: BeamInputs) {
    this.inputs = inputs;
  }

  /**
     * Calcule la section d'acier réelle (cm²)
     */
    public static calcSectionAcierCm2(nb: number, phiMm: number): number {
        const phiCm = phiMm / 10;
        return nb * (Math.PI * Math.pow(phiCm, 2)) / 4;
    }

  /**
   * MODULE 1 : Traitement des hypothèses et propriétés des matériaux
   */
  private getMaterialProperties() {
    const isEC2 = this.inputs.standard === 'EC2';

    // Résistance de calcul du béton (fcd / fbu)
    const gamma_c = 1.5;
    const fcd = isEC2
      ? (1.0 * this.inputs.fc28_fck) / gamma_c
      : (0.85 * this.inputs.fc28_fck) / gamma_c;

    // Résistance de calcul de l'acier (fyd)
    const gamma_s = 1.15;
    const fyd = this.inputs.fe_fyk / gamma_s;

    // Hauteur utile d
    const d = this.inputs.h - this.inputs.cnom - (this.inputs.phi_trans / 1000) - (this.inputs.phiInf / 2000);

    // Contrainte de traction du béton
    const fctm = this.inputs.fc28_fck <= 50 
      ? 0.3 * Math.pow(this.inputs.fc28_fck, 2 / 3) 
      : 2.12 * Math.log(1 + (this.inputs.fc28_fck / 10));

    return { fcd, fyd, d, fctm };
  }

  /**
   * MODULE 2 : Calcul des sollicitations hyperstatiques (M et V)
   */
  public computeInternalForces(): InternalForcesResult {
    const { G, Q, L, L_left = L, L_right = L, method } = this.inputs;

    const pu = 1.35 * G + 1.5 * Q;
    const pser = G + Q;

    const M0_u = (pu * Math.pow(L, 2)) / 8;
    const M0_ser = (pser * Math.pow(L, 2)) / 8;

    let Mw_u = 0, Me_u = 0, Mt_u = 0;
    let Mw_ser = 0, Me_ser = 0, Mt_ser = 0;

    if (method === 'FORFAITAIRE') {
      const alpha = Q / (G + Q);
      const coeff_appui = 0.4; // Valeur usuelle pour appui intermédiaire de rive
      
      Mw_u = coeff_appui * M0_u;
      Me_u = coeff_appui * M0_u;
      Mw_ser = coeff_appui * M0_ser;
      Me_ser = coeff_appui * M0_ser;

      const condition1 = 1.05 * M0_u;
      const condition2 = (1 + 0.3 * alpha) * M0_u;
      const M_mini = Math.max(condition1, condition2);
      
      Mt_u = Math.max(M_mini - (Mw_u + Me_u) / 2, 0.6 * M0_u);
      Mt_ser = Math.max((M_mini - (Mw_ser + Me_ser) / 2) * (pser / pu), 0.6 * M0_ser);

    } else if (method === 'CAQUOT') {
      const Lw_prime = 0.8 * L_left;
      const Le_prime = 0.8 * L_right;
      const L_prime = 0.8 * L;

      // Moment sur appui gauche (chargement dissymétrique défavorable)
      Mw_u = (pu * Math.pow(Lw_prime, 3) + pu * Math.pow(L_prime, 3)) / (8 * (Lw_prime + L_prime));
      Me_u = (pu * Math.pow(L_prime, 3) + pu * Math.pow(Le_prime, 3)) / (8 * (L_prime + Le_prime));

      Mw_ser = (pser * Math.pow(Lw_prime, 3) + pser * Math.pow(L_prime, 3)) / (8 * (Lw_prime + L_prime));
      Me_ser = (pser * Math.pow(L_prime, 3) + pser * Math.pow(Le_prime, 3)) / (8 * (L_prime + Le_prime));

      Mt_u = Math.max(M0_u - (Mw_u + Me_u) / 2, 0.4 * M0_u);
      Mt_ser = Math.max(M0_ser - (Mw_ser + Me_ser) / 2, 0.4 * M0_ser);

    } else { // LINEAR_ELASTIC (RDM - Équation des 3 moments simplifiée)
      Mw_u = 0.5 * M0_u;
      Me_u = 0.5 * M0_u;
      Mw_ser = 0.5 * M0_ser;
      Me_ser = 0.5 * M0_ser;

      Mt_u = M0_u - (Mw_u + Me_u) / 2;
      Mt_ser = M0_ser - (Mw_ser + Me_ser) / 2;
    }

    // Effort tranchant maximal aux appuis
    const Vu_max = (pu * L) / 2 + Math.abs(Mw_u - Me_u) / L;

    return {
      pu, pser, M0_u, M0_ser,
      Mu_span: Mt_u,
      Mu_support_left: Mw_u,
      Mu_support_right: Me_u,
      Mser_span: Mt_ser,
      Mser_support_left: Mw_ser,
      Mser_support_right: Me_ser,
      Vu_max
    };
  }

  /**
   * MODULE 3 : Dimensionnement à l'ELU (Flexion et Cisaillement)
   */
  public computeULS(forces: InternalForcesResult): { flexion: ULSFlexionResult; shear: ULSShearResult } {
    const { fcd, fyd, d } = this.getMaterialProperties();
    const { b } = this.inputs;

    // Sections d'acier réelles long fournies
    const As_inf = ConcreteBeamEngine.calcSectionAcierCm2(this.inputs.nbInf, this.inputs.phiInf); // cm²
    const As_sup = ConcreteBeamEngine.calcSectionAcierCm2(this.inputs.nbSup, this.inputs.phiSup); // cm²

    // A. Flexion Simple (Travée)
    const Mu = forces.Mu_span * 1e-3; // Conversion kNm -> MNm
    const mu_bu = Mu / (b * Math.pow(d, 2) * fcd);

    let pivotChoice = `Pivot A / B (Section Béton suffisante, Pas d'aciers comprimés)`;
    let betonEluOk = true;
    if (mu_bu > 0.392) {
        betonEluOk = false; // Nécessite aciers comprimés lourds ou redimensionnement
        pivotChoice = 'Pivot B Dépassé (Béton comprimé excessif, Nécessite aciers comprimés lourds ou augmenter la section de béton)';
    };

    const alpha = 1.25 * (1 - Math.sqrt(Math.max(0, 1 - 2 * mu_bu)));
    const z = d * (1 - 0.4 * alpha);

    // Section d'acier en cm² (1 MN/m / (MPa * m) = m² -> * 1e4 -> cm²)
    const As_ELU = (Mu / (z * fyd)) * 1e4;
    const acierEluOk = As_inf >= As_ELU;

    // B. Effort Tranchant (Bielle & Armatures transversales)
    const Ved = forces.Vu_max * 1e-3; // kN -> MN
    const tau_u = Ved / (b * d); // MPa

    const tau_u_lim = this.inputs.standard === 'EC2' 
      ? 0.24 * (1 - this.inputs.fc28_fck / 250) * fcd 
      : Math.min(0.20 * (this.inputs.fc28_fck / 1.5), 5.0);

    const cisaillementOk = tau_u <= tau_u_lim;

    // Sections d'acier réelles trans fournies
    const As_trans = ConcreteBeamEngine.calcSectionAcierCm2(1, this.inputs.phi_trans); // cm²

    // Calcul du ratio de ferraillage transversale: Ast/s (cm²/m)
    const Ast_over_s = (tau_u / (0.9 * (this.inputs.fe_fyk / 1.15))) * b * 1e4;
    const Ast_reel_s = As_trans / this.inputs.st0 ; // cm²/m
    const AcierTransOk = Ast_reel_s >= Ast_over_s; 

    return {
      flexion: { d, fcd, fyd, mu_bu, pivotChoice, betonEluOk, alpha, z, As_ELU, As_inf, As_sup, acierEluOk },
      shear: { Ved: forces.Vu_max, tau_u, tau_u_lim, cisaillementOk, As_trans, Ast_reel_s, Ast_over_s, AcierTransOk }
    };
  }

  /**
   * MODULE 4 : Vérifications et ajustements à l'ELS
   */
  public computeSLS(forces: InternalForcesResult, As_ELU: number): SLSResult {
    const { d } = this.getMaterialProperties();
    const { b, fc28_fck, fe_fyk, exposure } = this.inputs;
    const uls = this.computeULS(forces);

    // Limites de contraintes
    const sigma_c_lim = 0.6 * fc28_fck;
    let sigma_s_lim = fe_fyk;

    if (exposure === 'PREJUDICIABLE') {
      sigma_s_lim = Math.min((2 / 3) * fe_fyk, 250);
    } else if (exposure === 'TRES_PREJUDICIABLE') {
      sigma_s_lim = Math.min(0.5 * fe_fyk, 200);
    }

    // Verification de section réelle en ELS
    // Calcul de la section d'acier tendu réelle (cm²)
    const As_m2 = uls.flexion.As_inf * 1e-4;

    // Position de l'axe neutre (équation du 2nd degré: 0.5*b*y1^2 + n*As*y1 - n*As*d = 0)
    const A_quad = 0.5 * b;
    const B_quad = 15 * As_m2;
    const C_quad = -15 * As_m2 * d;
    const y0 = (-B_quad + Math.sqrt(Math.pow(B_quad, 2) - 4 * A_quad * C_quad)) / (2 * A_quad);

    // Moment d'inertie de la section fissurée
    const I0 = (b * Math.pow(y0, 3)) / 3 + 15 * As_m2 * Math.pow(d - y0, 2);
    const Mser = forces.Mser_span * 1e-3; // kNm -> MNm
    const sigma_c = (Mser / I0) * y0;
    const sigma_s = 15 * (Mser / I0) * (d - y0);

    const elsStressOk = exposure === 'NON_PREJUDICIABLE' ? (sigma_c <= sigma_c_lim) : (sigma_c <= sigma_c_lim) && (sigma_s <= sigma_s_lim);

    
    // Calculer la section d'acier minimale en ELS
    let As = As_ELU; // Section acier en ELU (cm²)
    const n = 15; // Coefficient d'équivalence
    let y1 = 0, I1 = 0, sigma_s1 = 0;

    // Résolution itérative si la contrainte de l'acier excède la limite
    for (let iter = 0; iter < 20; iter++) {
      const As1_m2 = As * 1e-4;

      const B1_quad = n * As1_m2;
      const C1_quad = -n * As1_m2 * d;

      y1 = (-B1_quad + Math.sqrt(Math.pow(B1_quad, 2) - 4 * A_quad * C1_quad)) / (2 * A_quad);

      // Moment d'inertie de la section fissurée
      I1 = (b * Math.pow(y1, 3)) / 3 + n * As1_m2 * Math.pow(d - y1, 2);

      sigma_s1 = n * (Mser / I1) * (d - y1);

      if (exposure === 'NON_PREJUDICIABLE' || sigma_s1 <= sigma_s_lim) {
        break;
      }

      // Augmentation progressive d'acier pour brider la contrainte de traction
      As *= (sigma_s1 / sigma_s_lim);
    }

    // Flèche admissible
        const L = this.inputs.L * 100; // (cm)
        const fleche_lim = L / 500; // L/500 (cm)
        // Estimation de la flèche élastique avec inertie fissurée
        const E = 11000 * Math.cbrt(this.inputs.fc28_fck); // MPa
        const fleche_calc = (5 / 384) * ((forces.pser / 10) * Math.pow(L, 4)) / (E * (I0 * 1e8)); // (cm)
        const flecheOk = fleche_calc <= fleche_lim;

    return {
      sigma_c_lim,
      sigma_s_lim,
      y0,
      I0,
      sigma_c,
      sigma_s,
      As_ELS: As,
      elsStressOk,
      fleche_calc,
      fleche_lim,
      flecheOk
    };
  }

  /**
   * MODULE 5 : Synthèse et condition de non-fragilité
   */
  public runFullCalculation(): CalculationReport {
    const { fctm, d } = this.getMaterialProperties();
    const { b, fe_fyk, standard } = this.inputs;

    const forces = this.computeInternalForces();
    const uls = this.computeULS(forces);
    const sls = this.computeSLS(forces, uls.flexion.As_ELU);

    // Section minimale (Condition de non-fragilité)
    const As_min = standard === 'EC2'
      ? Math.max(0.26 * (fctm / fe_fyk) * b * d * 1e4, 0.0013 * b * d * 1e4)
      : 0.23 * b * d * (fctm / fe_fyk) * 1e4;

    const nonFragile = uls.flexion.As_inf >= As_min;

    // Section finale retenue
    const As_min_final = Math.max(uls.flexion.As_ELU, sls.As_ELS, As_min);

    return {
      inputs: this.inputs,
      forces,
      ulsFlexion: uls.flexion,
      ulsShear: uls.shear,
      slsCheck: sls,
      nonFragile,
      As_min,
      As_min_final,
      globalOk: (uls.flexion.betonEluOk && uls.flexion.acierEluOk && uls.shear.cisaillementOk && uls.shear.AcierTransOk) && (sls.elsStressOk && sls.flecheOk)
    };
  }
}

// ----------------------------------------------------------------------
// EXTENSION : CARTE 3 - CALCUL QUANTITATIF ET ESTIMATION DE COÛT
// ----------------------------------------------------------------------

interface CostInputs {
  unitPriceConcrete: number;  // Prix du m3 de béton (TND/m³)
  unitPriceSteel: {[fe: number]: number};     // Prix du kg d'acier (TND/kg)
  unitPriceFormwork: number;  // Prix du m2 de coffrage (TND/m²)
  // unitPriceLabor: number;     // Main d'œuvre par m3 de béton (€/m³)
  cementDosage: number;       // Dosage en ciment (kg/m³, ex: 350)
  cementBagPrice: number;     // Prix d'un sac de ciment 50kg (TND)
  sandApparentDensity: number;// Densité apparente du sable (t/m³, ex: 1.4)
  gravelApparentDensity: number;// Densité apparente du gravier (t/m³, ex: 1.5)
  sandUnitPrice: number;      // Prix du m3 de sable (TND/m³)
  gravelUnitPrice: number;    // Prix du m3 de gravier (TND/m³)
  waterUnitPrice: number;     // prix du m3 d'eau de Sonede (TND/M3, ex:1.040)
  steelBars: { [diameter: number]: {[fe: number] : number} }; // Prix indicatif par diamètre de barre (TND/barre de 12m)
}

interface QuantitiesResult {
  concreteVolume: number;    // m³
  formworkArea: number;      // m²
  supLongitudinalSteelWeight: number; // kg
  infLongitudinalSteelWeight: number; // kg
  transversalSteelWeight: number;  // kg
  totalSteelWeight: number;  // kg
  steelRatioPerM3: number;   // kg/m³
  
  // Composants chantier
  cementBagsCount: number;   // Sacs de 50kg
  sandVolumeApparent: number; // m³
  sandWheelbarrows: number;  // Nombre de brouettes (~60L)
  gravelVolumeApparent: number; // m³
  gravelWheelbarrows: number;// Nombre de brouettes (~60L)
  waterLiters: number;       // Litres d'eau
  totalBars12m: number;      // Nombre indicatif de barres de 12m
  totalFrames : number;      // Nombre indicatif de cadres
  totalcalipers : number;    // Nombre indicatif des étriers
}

interface FinancialResult {
  costConcrete: number;
  costSteel: number;
  costFormwork: number;
  // costLabor: number;
  costTotal: number;
  costPerMeter: number;
  costPerM3: number;
}

interface FullProjectReport {
  structuralReport: CalculationReport;
  quantities: QuantitiesResult;
  finances: FinancialResult;
}

/**
 * Moteur d'interconnexion : Génère le rapport complet (Calcul RDM/BA + Carte 3 Quantités & Coûts)
 */
export function calculateFullProject(inputs: BeamInputs, costInputs: CostInputs): FullProjectReport {
  const engine = new ConcreteBeamEngine(inputs);
  const structuralReport = engine.runFullCalculation();

  const { L, b, h } = inputs;
  
  // 1. Géométrie de base
  const concreteVolume = b * h * L; // m³
  const formworkArea = (b + 2 * h) * L; // m² (largeur + 2 retombées)

  // 2. Armatures d'acier
  // Poids longitudinal = Section(cm²) * 1e-4 (m²) * 7850 kg/m³ * (Nombre des armatures totale) L * Majorations (ancrages + recouvrements ~1.15)
  const supLongitudinalSteelWeight = (structuralReport.ulsFlexion.As_sup * 1e-4) * 7850 * inputs.nbPoutres * L * 1.15;
  const infLongitudinalSteelWeight = (structuralReport.ulsFlexion.As_inf * 1e-4) * 7850 * inputs.nbPoutres * L * 1.15;
  const steelPartPerBar = Math.floor(12 / (L * 1.15));
  const infBars = Math.ceil((inputs.nbPoutres * inputs.nbInf) / steelPartPerBar);
  const supBars = Math.ceil((inputs.nbPoutres * inputs.nbSup) / steelPartPerBar);
  const totalBars = (inputs.phiInf === inputs.phiSup) ? Math.ceil((inputs.nbPoutres * (inputs.nbInf + inputs.nbSup)) / steelPartPerBar) 
  : infBars + supBars;
  
  // Poids transversal = Ast/s (cm²/m) * 1e-4 * 7850 * (Périmètre étrier/cadre * Nombre total des étrier/cadre) * Majorations (ancrages + recouvrements ~1.15)
  const totalFrames = Math.ceil(L / inputs.st0) * inputs.nbPoutres;
  const totalcalipers = inputs.nbInf > 2 ? (Math.ceil(L / inputs.st0) * (inputs.nbInf - 2)) * inputs.nbPoutres : 0 ;
  const perimeterStirrupFrame = 2 * (b - 2 * inputs.cnom) + 2 * (h - 2 * inputs.cnom);
  const perimeterStirrupCaliper = inputs.nbInf > 2 ? 2 * (h - 2 * inputs.cnom) * (inputs.nbInf - 2) : 0;
  const transversalSteelWeight = (structuralReport.ulsShear.As_trans * 1e-4) * 7850 * ((perimeterStirrupFrame * totalFrames) + (perimeterStirrupCaliper * totalcalipers)) * 1.15;

  const totalSteelWeight = infLongitudinalSteelWeight + supLongitudinalSteelWeight + transversalSteelWeight;
  const steelRatioPerM3 = concreteVolume > 0 ? totalSteelWeight / concreteVolume : 0;

  // Barres de 12m indicatives
  // const sectionPerBar = (Math.PI * Math.pow(inputs.phiInf / 20, 2)); // cm² par barre
  // const estimatedBarsCount = Math.ceil(structuralReport.ulsFlexion.As_inf / Math.max(sectionPerBar, 0.1));
  // const totalBars12m = Math.ceil((estimatedBarsCount * L * 1.15) / 12);

  // 3. Matériaux détaillés (Chantier)
  const totalCementKg = concreteVolume * costInputs.cementDosage;
  const cementBagsCount = Math.ceil(totalCementKg / 50);

  // Ratios de formulation usuels par m3 de béton :
  // 0.4 m3 sable / m3 béton, 0.8 m3 gravier / m3 béton, 175L eau / m3
  const sandVolumeApparent = concreteVolume * 0.4;
  const gravelVolumeApparent = concreteVolume * 0.8;
  const sandWheelbarrows = Math.ceil((sandVolumeApparent * 1000) / 60); // Brouette de 60L
  const gravelWheelbarrows = Math.ceil((gravelVolumeApparent * 1000) / 60); // Brouette de 60L
  const waterLiters = Math.round(concreteVolume * 175);

  // 4. Calculs financiers
  const costSand = sandVolumeApparent * costInputs.sandUnitPrice;
  const costGravel = gravelVolumeApparent * costInputs.gravelUnitPrice;
  const costCiment = cementBagsCount * costInputs.cementBagPrice;
  const costWater = (waterLiters / 1000) * costInputs.waterUnitPrice;
  const costSteelBars = inputs.phiInf === inputs.phiSup ? totalBars * costInputs.steelBars[inputs.phiInf][inputs.fe_fyk] : (infBars * costInputs.steelBars[inputs.phiInf][inputs.fe_fyk]) + (supBars * costInputs.steelBars[inputs.phiSup][inputs.fe_fyk]);
  const costConcrete = inputs.supplyMode === 'BPE' ? concreteVolume * (1 + inputs.perteBetonPct / 100) * costInputs.unitPriceConcrete
  : (costSand + costGravel + costCiment + costWater) * (1 + inputs.perteBetonPct / 100);
  const costSteel = transversalSteelWeight * (1 + inputs.perteAcierPct / 100) * costInputs.unitPriceSteel[inputs.fe_fyk] + costSteelBars;
  const costFormwork = formworkArea * costInputs.unitPriceFormwork;
  // const costLabor = concreteVolume * costInputs.unitPriceLabor;

  // const costTotal = costConcrete + costSteel + costFormwork + costLabor;
  const costTotal = costConcrete + costSteel + costFormwork;
  const costPerMeter = L > 0 ? costTotal / L : 0;
  const costPerM3 = concreteVolume > 0 ? costTotal / concreteVolume : 0;

  return {
    structuralReport,
    quantities: {
      concreteVolume,
      formworkArea,
      supLongitudinalSteelWeight,
      infLongitudinalSteelWeight,
      transversalSteelWeight,
      totalSteelWeight,
      steelRatioPerM3,
      cementBagsCount,
      sandVolumeApparent,
      sandWheelbarrows,
      gravelVolumeApparent,
      gravelWheelbarrows,
      waterLiters,
      totalBars12m : totalBars,
      totalFrames,
      totalcalipers
    },
    finances: {
      costConcrete,
      costSteel,
      costFormwork,
      // costLabor,
      costTotal,
      costPerMeter,
      costPerM3
    }
  };
}