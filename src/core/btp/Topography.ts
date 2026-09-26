// src/core/btp/Topography.ts

interface PointTopo1D {
    id: string;
    lectureArriere: number;
    lectureAvant: number;
    distance: number;
    coteProjet: number;
    zBrut?: number;
    zComp?: number;
}

interface PointTopo2D {
    id: string;
    angleGrad?: number;       // Angle horizontal lu à la station en gon
    distanceHoriz?: number;   // Dh en m
    lectureAxial?: number;     
    coteProjet?: number;      
    x?: number;
    y?: number;
    zBrut?: number;
    zComp?: number;
}

export class Topography {
    static gradToRad(grad: number): number { return (grad * Math.PI) / 200; }
    static radToGrad(rad: number): number { return (rad * 200) / Math.PI; }

    /**
     * Calcule l'orientement de référence entre deux points connus A et B (Norme STT)
     */
    static computeOrientementReference(A: {x: number, y: number}, B: {x: number, y: number}): number {
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        let rad = Math.atan2(dy, dx); // En topo STT, X est au cosinus, Y au sinus
        if (rad < 0) rad += 2 * Math.PI;
        return this.radToGrad(rad);
    }

    /**
     * SOUS-DIVISION 1 : Altimétrie Pure & Compensation
     */
    static computeAltimetriePure(
        points: PointTopo1D[], 
        zDepart: number, 
        zArriveeConnu?: number,
        modeCompensation: 'distance' | 'points' = 'distance',
    ) {
        let currentZ = zDepart;
        let totalDistance = 0;

        const calcules = points.map((p, idx) => {
            totalDistance += p.distance;
            if (idx === 0) return { ...p, zBrut: zDepart, zComp: zDepart };
            const prev = points[idx - 1];
            const denivelee = prev.lectureArriere - p.lectureAvant;
            currentZ += denivelee;
            return { ...p, zBrut: currentZ };
        });

        let erreurFermeture = 0;
        let valide = true;
        const tolerance = modeCompensation === 'distance' ? 0.01 + 0.02 * Math.sqrt(totalDistance / 1000) : 0.004 * Math.sqrt(calcules.length || 1); // Norme STT Tunisie

        if (zArriveeConnu !== undefined && calcules.length > 0) {
            const zFinalBrut = calcules[calcules.length - 1].zBrut || 0;
            erreurFermeture = zFinalBrut - zArriveeConnu;
            if (Math.abs(erreurFermeture) > tolerance) valide = false;

            let distCumulee = 0;
            calcules.forEach((p, idx) => {
                if (idx === 0) return;
                distCumulee += p.distance;
                const facteur = modeCompensation === 'distance' ? (distCumulee / totalDistance) : (idx / (calcules.length - 1));
                p.zComp = (p.zBrut || 0) - (erreurFermeture * facteur);
            });
        } else {
            calcules.forEach(p => p.zComp = p.zBrut);
        }
        return { points: calcules, erreurFermeture, valide, tolerance };
    }

    /**
     * Calcule les coefficients linéaires [a, b] et [c, d] pour les morceaux
     */
    static getSegmentCoefficients(x1: number, y1: number, x2: number, y2: number) {
        const dx = x2 - x1;
        if (dx === 0) return { pente: 0, intercept: y1 };
        const pente = (y2 - y1) / dx;
        const intercept = y1 - pente * x1;
        return { pente, intercept };
    }

    /**
     * SOUS-DIVISION 1 & 2 : Intégrale de Riemann & f(x) = 0
     */
    static calculateCubature1D(points: PointTopo1D[], largeurFouille: number) {
        let deblai = 0;
        let remblai = 0;
        const intersections: number[] = [];
        const coefficientsIntermediaires: any[] = [];
        let xCumule = 0;

        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const dx = p2.distance;

            const zTN1 = p1.zComp ?? p1.zBrut ?? 0;
            const zTN2 = p2.zComp ?? p2.zBrut ?? 0;

            const f1 = zTN1 - p1.coteProjet;
            const f2 = zTN2 - p2.coteProjet;

            const coefTN = this.getSegmentCoefficients(xCumule, zTN1, xCumule + dx, zTN2);
            const coefProj = this.getSegmentCoefficients(xCumule, p1.coteProjet, xCumule + dx, p2.coteProjet);
            
            coefficientsIntermediaires.push({
                segment: `${p1.id} -> ${p2.id}`,
                a_TN: coefTN.pente, b_TN: coefTN.intercept,
                c_Proj: coefProj.pente, d_Proj: coefProj.intercept,
                point_init: p1.id, point_fin: p2.id,
                f_init: f1, f_fin: f2
            });

            if (f1 * f2 < 0) {
                const xLocal = (Math.abs(f1) * dx) / (Math.abs(f1) + Math.abs(f2));
                intersections.push(xCumule + xLocal);
            };

            const hMoyenne = (f1 + f2) / 2;
            const surfaceTroncon = hMoyenne * dx;

            if (hMoyenne > 0) deblai += surfaceTroncon * largeurFouille;
            else remblai += Math.abs(surfaceTroncon) * largeurFouille;

            xCumule += dx;
        }

        return { deblai, remblai, intersections, coefficientsIntermediaires };
    }

    static calculateCubature2D(points: PointTopo1D[], largeurFouille: number) {
        let deblai = 0;
        let remblai = 0;
        const intersections: { id: string, x: number }[] = [];
        const totalPoints: { id: string, x: number; z: number }[] = [{ id: 'PT1', x: 0, z: 0 }]; // Inclure le point de départ
        const coefficientsIntermediaires: any[] = [];
        let xCumule = 0; 

        for (let i = 0; i < points.length - 1 ; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const dx = p2.distance;

            const zTN1 = p1.zComp ?? p1.zBrut ?? 0;
            const zTN2 = p2.zComp ?? p2.zBrut ?? 0;

            const f1 = zTN1 - p1.coteProjet;
            const f2 = zTN2 - p2.coteProjet;

            if (f1 * f2 < 0) {
                const xLocal = (Math.abs(f1) * dx) / (Math.abs(f1) + Math.abs(f2));
                const id = `int_${p1.id}/${p2.id}`;
                intersections.push({ id: id , x: xCumule + xLocal });
                totalPoints.push({ id: id, x: xCumule + xLocal, z: 0 }); // Ajouter le point d'intersection à la liste des points totaux
            };
            totalPoints.push({ id: p2.id, x: xCumule + dx, z: f2 }); // Ajouter le point final du segment à la liste des points totaux
            xCumule += dx;
        };

        for (let i = 0; i < totalPoints.length - 1; i++) {
        const p1 = totalPoints[i];
        const p2 = totalPoints[i + 1];
        const dx = p2.x - p1.x;
        const coef = this.getSegmentCoefficients(p1.x, p1.z, p2.x, p2.z);

            coefficientsIntermediaires.push({
                segment: `${p1.id} -> ${p2.id}`,
                a: coef.pente, b: coef.intercept,
                point_init: p1.id, point_fin: p2.id,
                x_init: p1.x, x_fin: p2.x,
                f_init: p1.z, f_fin: p2.z
            });

            const hMoyenne = (p1.z + p2.z) / 2;
            const surfaceTroncon = hMoyenne * dx;

            if (hMoyenne > 0) deblai += surfaceTroncon * largeurFouille;
            else remblai += Math.abs(surfaceTroncon) * largeurFouille;

        };

        return { deblai, remblai, intersections, coefficientsIntermediaires };
    }

    /**
     * SOUS-DIVISION 2 : Traitement Parallèle Visée Réf A->B
     */
    static computePlanimetrieParallere(
        points: PointTopo2D[], 
        stationA: { x: number; y: number; z: number }, 
        hauteurAppareil: number,
        vireB: { x: number; y: number },
        lectureAzimutaleBGrad: number,
        zFinalConnu?: number,
        typeCheminement: 'ferme' | 'ouvert_ajuste' | 'ouvert_non_ajuste' = 'ferme',
        modeCompensation: 'distance' | 'points' | 'temps' = 'distance'
    ) {
        // Détermination de l'orientement initial de référence STT
        const orientementAB = this.computeOrientementReference(stationA, vireB);
        // Constante de l'appareil (V0)
        const v0 = (orientementAB - lectureAzimutaleBGrad + 400) % 400;

        // let zActuel = stationA.z;
        let surfaceGauss = 0;
        let deblaiOrganique = 0;
        let remblaiOrganique = 0;

        let result = points.map((p) => {
            const res: PointTopo2D = { ...p };
            if (p.angleGrad !== undefined && p.distanceHoriz !== undefined) {
                // Orientement du rayon = V0 + Lecture azimutale
                const thetaGrad = (v0 + p.angleGrad) % 400;
                const thetaRad = this.gradToRad(thetaGrad);
                res.x = stationA.x + p.distanceHoriz * Math.cos(thetaRad);
                res.y = stationA.y + p.distanceHoriz * Math.sin(thetaRad);
            }
            return res;
        });

        // Chaîne de Nivellement Intégrée (Plan de visée basé sur PT1)
        let refDistance = typeCheminement === 'ferme' ? (result[0]?.distanceHoriz || 0) : (result.slice(-1)[0]?.distanceHoriz || 0);
        let fZ = 0;
        let tolerance = modeCompensation === 'distance' ? 0.01 + 0.02 * Math.sqrt(refDistance / 1000) : 0.004 * Math.sqrt(result.length || 1); // Basé sur la distance ou le nombre de visées / ordre chornologique
        let valide = true;

        if (result.length > 0) {
        const zInitial = stationA.z; // Altitude de départ fixée par la station
        let zFirstItem : number | undefined;
        // Calcul des Z Bruts via le plan de visée continu
        result = result.map((p, idx) => {
            if (idx === 0) {
                zFirstItem = zInitial + hauteurAppareil - p.lectureAxial!; 
                return { ...p, zBrut: zFirstItem, zComp: zFirstItem }; 
            }
            const zBrut = zInitial + hauteurAppareil - p.lectureAxial!; // Plan de visée continu basé sur la première lecture axiale 
            return { ...p, zBrut };
        });
        
        const zRefTheorique = typeCheminement === 'ferme' ? zFirstItem : typeCheminement === 'ouvert_ajuste' ? zFinalConnu : undefined;
        const zRefCalculer = result[result.length - 1].zBrut;

        if (typeCheminement !== 'ouvert_non_ajuste') {
                fZ = zRefCalculer! - zRefTheorique!; 
                valide = Math.abs(fZ) <= tolerance;

                // if (valide) {
                    result.forEach((p, idx) => {
                        if (idx === 0) return; // Pas de compensation pour le point de départ
                        const facteur = modeCompensation === 'distance' ? (p.distanceHoriz! / refDistance) : modeCompensation === 'points' ? 1 : (idx / (result.length - 1));
                        const correction = -(fZ * facteur);
                        p.zComp = (p.zBrut || 0) + correction;
                    });
                // } else {
                //     result.forEach(p => p.zComp = p.zBrut);
                // }
            } else {
                // Mode Antenne : Aucune compensation appliquée
                result = result.map(p => ({ ...p, zComp: p.zBrut }));
            }
        }
        
        const validsX = result.filter(p => p.x !== undefined && p.y !== undefined);
        const aTousChampsCotes = result.every(p => p.zBrut !== undefined && p.coteProjet !== undefined);

        if (validsX.length > 2 && zFinalConnu !== undefined && aTousChampsCotes) {
            let somme = 0;
            const n = validsX.length;
            for (let i = 0; i < n; i++) {
                const current = validsX[i];
                const next = validsX[(i + 1) % n];
                somme += (current.x! * next.y!) - (next.x! * current.y!);
            }
            surfaceGauss = Math.abs(somme) / 2;

            let deltaZMoyen = 0;
            result.forEach(p => { deltaZMoyen += ((p.zComp! || p.zBrut!) - p.coteProjet!); });
            const deltaZ = deltaZMoyen / result.length;

            if (deltaZ > 0) deblaiOrganique = surfaceGauss * deltaZ;
            else remblaiOrganique = surfaceGauss * Math.abs(deltaZ);
        }

        return { 
            points: result,
            orientementAB,
            v0,
            surfaceGauss, 
            deblaiOrganique, 
            remblaiOrganique,
            fZ: fZ,
            tolerance,
            valide
         };
    }

    static computePlanimetrieParallere2(
        points: PointTopo2D[], 
        stationA: { x: number; y: number; z: number }, 
        hauteurAppareil: number,
        vireB: { x: number; y: number },
        lectureAzimutaleBGrad: number,
        zFinalConnu?: number,
        typeCheminement: 'ferme' | 'ouvert_ajuste' | 'ouvert_non_ajuste' = 'ferme',
        modeCompensation: 'distance' | 'points' | 'temps' = 'distance'
    ) {
        // Détermination de l'orientement initial de référence STT
        const orientementAB = this.computeOrientementReference(stationA, vireB);
        // Constante de l'appareil (V0)
        const v0 = (orientementAB - lectureAzimutaleBGrad + 400) % 400;

        // let zActuel = stationA.z;
        let surfaceGauss = 0;
        let deblaiOrganique = 0;
        let remblaiOrganique = 0;
        
        let result = points.map((p) => {
            const res: PointTopo2D = { ...p };
            if (p.angleGrad !== undefined && p.distanceHoriz !== undefined) {
                // Orientement du rayon = V0 + Lecture azimutale
                const thetaGrad = (v0 + p.angleGrad) % 400;
                const thetaRad = this.gradToRad(thetaGrad);
                res.x = stationA.x + p.distanceHoriz * Math.cos(thetaRad);
                res.y = stationA.y + p.distanceHoriz * Math.sin(thetaRad);
            }
            return res;
        });

        // Chaîne de Nivellement Intégrée (Plan de visée basé sur PT1)
        let refDistance = typeCheminement === 'ferme' ? (result[0]?.distanceHoriz || 0) : (result.slice(-1)[0]?.distanceHoriz || 0);
        let fZ = 0;
        let tolerance = modeCompensation === 'distance' ? 0.01 + 0.02 * Math.sqrt(refDistance / 1000) : 0.004 * Math.sqrt(result.length || 1); // Basé sur la distance ou le nombre de visées / ordre chornologique
        let valide = true;

        if (result.length > 0) {
        const zInitial = stationA.z; // Altitude de départ fixée par la station
        let zFirstItem : number | undefined;
        // Calcul des Z Bruts via le plan de visée continu
        result = result.map((p, idx) => {
            if (idx === 0) {
                zFirstItem = zInitial + hauteurAppareil - p.lectureAxial!; 
                return { ...p, zBrut: zFirstItem, zComp: zFirstItem }; 
            }
            const zBrut = zInitial + hauteurAppareil - p.lectureAxial!; // Plan de visée continu basé sur la première lecture axiale 
            return { ...p, zBrut };
        });
        
        const zRefTheorique = typeCheminement === 'ferme' ? zFirstItem : typeCheminement === 'ouvert_ajuste' ? zFinalConnu : undefined;
        const zRefCalculer = result[result.length - 1].zBrut;

        if (typeCheminement !== 'ouvert_non_ajuste') {
                fZ = zRefCalculer! - zRefTheorique!; 
                valide = Math.abs(fZ) <= tolerance;

                // if (valide) {
                    result.forEach((p, idx) => {
                        if (idx === 0) return; // Pas de compensation pour le point de départ
                        const facteur = modeCompensation === 'distance' ? (p.distanceHoriz! / refDistance) : modeCompensation === 'points' ? 1 : (idx / (result.length - 1));
                        const correction = -(fZ * facteur);
                        p.zComp = (p.zBrut || 0) + correction;
                    });
                // } else {
                //     result.forEach(p => p.zComp = p.zBrut);
                // }
            } else {
                // Mode Antenne : Aucune compensation appliquée
                result = result.map(p => ({ ...p, zComp: p.zBrut }));
            }
        }
        
        const validsX = result.filter(p => p.x !== undefined && p.y !== undefined);
        typeCheminement === 'ferme' && validsX.splice(0, -1); // Retirer le dernier point pour un cheminement fermé
        validsX.sort((a, b) => a.angleGrad! - b.angleGrad!);
        const aTousChampsCotes = result.every(p => p.zBrut !== undefined && p.coteProjet !== undefined);

        const trianglesIndex = [];
        const triangles: {id: number, surface: number, surfaceAdj: boolean, deltaZMoyen: number, volume: number}[] = [];
        if (validsX.length > 2 && zFinalConnu !== undefined && aTousChampsCotes) {
            const n = validsX.length;
            for (let i = 1; i < n - 1; i++) {
              trianglesIndex.push([0, i, i + 1]);
            };

            trianglesIndex.forEach((triangle, idx) => {
                let somme = 0;
                let deltaZMoyen = 0;
                let surfaceAdj = true;
                triangle.forEach((pointIndex, i) => {
                    const current = validsX[pointIndex];
                    const next = i !== triangle.length -1 ? validsX[triangle[i + 1]] : validsX[0];
                    somme += (current.x! * next.y!) - (next.x! * current.y!);
                    deltaZMoyen += ((current.zComp! || current.zBrut!) - current.coteProjet!);
                });

                let angle1_0 = Math.atan2((validsX[triangle[1]].y! - validsX[triangle[0]].y!), (validsX[triangle[1]].x! - validsX[triangle[0]].x!));
                let angle2_0 = Math.atan2((validsX[triangle[2]].y! - validsX[triangle[0]].y!), (validsX[triangle[2]].x! - validsX[triangle[0]].x!));
                angle1_0 = angle1_0 < 0 ? angle1_0 + 2 * Math.PI : angle1_0;
                angle2_0 = angle2_0 < 0 ? angle2_0 + 2 * Math.PI : angle2_0;
                surfaceAdj = angle2_0 > angle1_0 ;
                
                const surface = Math.abs(somme) / 2;
                const deltaZ = deltaZMoyen / 3;
                const volume = surface * deltaZ;
                triangles.push({
                    id: idx + 1, 
                    surface: surface, 
                    surfaceAdj: surfaceAdj, 
                    deltaZMoyen: deltaZ, 
                    volume: volume 
                });
                surfaceGauss += surfaceAdj ? surface : - surface;
                if (volume > 0) deblaiOrganique += surfaceAdj ? volume : - volume;
                else remblaiOrganique += surfaceAdj ? Math.abs(volume) : - Math.abs(volume);
            });
        };

        return { 
            points: result,
            orientementAB,
            v0,
            trianglesIndex,
            triangles,
            surfaceGauss, 
            deblaiOrganique, 
            remblaiOrganique,
            fZ: fZ,
            tolerance,
            valide
         };
    }

    /**
     * SOUS-DIVISION 3 : Relèvement Rigoureux (Pothenot Intermédiaire)
     */
    static computeRelevementPure(
        A: {x:number, y:number},
        B: {x:number, y:number},
        C: {x:number, y:number},
        alphaGrad: number,
        betaGrad: number,
        relType: 'delambre' | 'tienstra' ) {

        const gammaGrad = 400 - (alphaGrad + betaGrad);
        const radAlpha = this.gradToRad(alphaGrad);
        const radBeta = this.gradToRad(betaGrad);
        const radGamma = this.gradToRad(gammaGrad);
        const cotAlpha = 1 / Math.tan(radAlpha);
        const cotBeta = 1 / Math.tan(radBeta);
        const cotGamma = 1 / Math.tan(radGamma);
        // 4 points de réference et le Moindre carré


        // Formule de Delambre + équation analytique
        const N_AS = ((C.y - A.y) * cotAlpha + (B.y - A.y) * cotGamma + (B.x - C.x)) ;
        const D_AS = ((C.x - A.x) * cotAlpha + (B.x - A.x) * cotGamma - (B.y - C.y)) ;
        const tanAS = N_AS / D_AS ;
        let orientAS = Math.atan2(N_AS, D_AS) < 0 ? Math.atan2(N_AS, D_AS) + 2 * Math.PI : Math.atan2(N_AS, D_AS);
        orientAS = this.radToGrad(orientAS);

        const N_BS = ((C.y - B.y) * cotAlpha + (A.y - B.y) * cotBeta + (C.x - A.x)) ;
        const D_BS = ((C.x - B.x) * cotAlpha + (A.x - B.x) * cotBeta - (C.y - A.y)) ;
        const tanBS = N_BS / D_BS ;
        let orientBS = Math.atan2(N_BS, D_BS) < 0 ? Math.atan2(N_BS, D_BS) + 2 * Math.PI : Math.atan2(N_BS, D_BS);
        orientBS = this.radToGrad(orientBS);
        
        const N_CS = ((B.y - C.y) * cotGamma + (A.y - C.y) * cotBeta + (A.x - B.x)) ;
        const D_CS = ((B.x - C.x) * cotGamma + (A.x - C.x) * cotBeta - (A.y - B.y)) ;
        const tanCS = N_CS / D_CS ;
        let orientCS = Math.atan2(N_CS, D_CS) < 0 ? Math.atan2(N_CS, D_CS) + 2 * Math.PI : Math.atan2(N_CS, D_CS);
        orientCS = this.radToGrad(orientCS);

        const yS1 = A.y + ( (((B.x - A.x) * tanBS - (B.y - A.y)) / (tanBS - tanAS)) * tanAS );
        const xS1 = A.x + ( ((B.x - A.x) * tanBS - (B.y - A.y)) / (tanBS - tanAS) );
        
        const xS2 = B.x + ( ((C.x - B.x) * tanCS - (C.y - B.y)) / (tanCS - tanBS) );
        const yS2 = B.y + ( (((C.x - B.x) * tanCS - (C.y - B.y)) / (tanCS - tanBS)) * tanBS );

        const xS = (xS1 + xS2) / 2;
        const yS = (yS1 + yS2) / 2;

        // Point intermediare + coefficient de correction
        const xP_AB = (A.x * cotAlpha + C.x * cotBeta + (C.y - A.y)) / (cotAlpha + cotBeta);
        const yP_AB = (A.y * cotAlpha + C.y * cotBeta - (C.x - A.x)) / (cotAlpha + cotBeta);
        const k1 = ((A.x - B.x) * (A.x - xP_AB) + (A.y - B.y) * (A.y - yP_AB)) / ((B.x - xP_AB)**2 + (B.y - yP_AB)**2);
        const xS01 = A.x + k1 * (xP_AB - B.x);
        const yS01 = A.y + k1 * (yP_AB - B.y);

        const xP_BC = (A.x * cotGamma + B.x * cotBeta + (B.y - A.y)) / (cotGamma + cotBeta);
        const yP_BC = (A.y * cotGamma + B.y * cotBeta - (B.x - A.x)) / (cotGamma + cotBeta);
        const k2 = ((B.x - C.x) * (B.x - xP_BC) + (B.y - C.y) * (B.y - yP_BC)) / ((C.x - xP_BC)**2 + (C.y - yP_BC)**2);
        const xS02 = B.x + k2 * (xP_BC - C.x);
        const yS02 = B.y + k2 * (yP_BC - C.y);

        // Snellius-Pothenot + calcul des distances et des angles
        const orientAB = this.computeOrientementReference(A, B);
        const orientBA = this.computeOrientementReference(B, A);
        const AB = Math.hypot(B.x - A.x, B.y - A.y);
        const orientBC = this.computeOrientementReference(B, C);
        const orientCB = this.computeOrientementReference(C, B);
        const BC = Math.hypot(C.x - B.x, C.y - B.y);
        const orientCA = this.computeOrientementReference(C, A);
        const orientAC = this.computeOrientementReference(A, C);
        const CA = Math.hypot(A.x - C.x, A.y - C.y);

        const sommetA = Math.abs(orientAC - orientAB); 
        const sommetB = Math.abs(orientBA - orientBC); 
        const sommetC = Math.abs(orientCB - orientCA); 

        let cond = true;
        cond = (orientAB > orientAS && orientAB > orientAC) || (orientAB < orientAS && orientAB < orientAC);
        const xy = 400 - ((cond ? sommetB : 400 - sommetB) + alphaGrad + betaGrad);
        const K = (Math.sin(this.gradToRad(sommetA)) * Math.sin(radAlpha) / Math.sin(this.gradToRad(sommetC)) * Math.sin(radBeta));
        const angleSAB = (xy / 2) + this.radToGrad(Math.atan((K - 1) / (K + 1) * Math.tan(this.gradToRad(xy / 2))));
        const angleSCB = xy - angleSAB;
        const angleSBA = 200 - (alphaGrad + angleSAB);
        const angleSBC = 200 - (betaGrad + angleSCB);
        const OrientAS = (orientAB > orientAS) ? (orientAB - angleSAB) % 400 : (orientAB + angleSAB) % 400;
        const OrientBS = (orientBA > orientBS) ? (orientBA - angleSBA) % 400 : (orientBA + angleSBA) % 400;
        const OrientCS = (orientCB > orientCS) ? (orientBC - angleSBC) % 400 : (orientCB + angleSCB) % 400;

        const SA = AB / Math.sin(radAlpha) * Math.sin(this.gradToRad(angleSBA));
        const SB = AB / Math.sin(radAlpha) * Math.sin(this.gradToRad(angleSAB));
        const SC = BC / Math.sin(radBeta) * Math.sin(this.gradToRad(angleSBC));

        const xS_1 = A.x + (SA * Math.cos(this.gradToRad(orientAS)));
        const yS_1 = A.y + (SA * Math.sin(this.gradToRad(orientAS)));
        const xS_2 = B.x + (SB * Math.cos(this.gradToRad(orientBS)));
        const yS_2 = B.y + (SB * Math.sin(this.gradToRad(orientBS)));
        const xS_3 = C.x + (SC * Math.cos(this.gradToRad(orientCS)));
        const yS_3 = C.y + (SC * Math.sin(this.gradToRad(orientCS)));

        // barycentrique directe de Tienstra
        const cotA = 1 / Math.tan(this.gradToRad(sommetA));
        const cotB = 1 / Math.tan(this.gradToRad(sommetB));
        const cotC = 1 / Math.tan(this.gradToRad(sommetC));

        const KA = 1 / (cotA - cotBeta);
        const KB = 1 / (cotB - cotGamma);
        const KC = 1 / (cotC - cotAlpha);
        
        const xST = (KA * A.x + KB * B.x + KC * C.x) / (KA + KB + KC);
        const yST = (KA * A.y + KB * B.y + KC * C.y) / (KA + KB + KC);

        const S = {x: xST, y: yST};
        const orientSA = this.computeOrientementReference(S, A);
        const orientSB = this.computeOrientementReference(S, B);
        const orientSC = this.computeOrientementReference(S, C);

        const AlphaCalc = Math.abs(orientSB - orientSA);
        const BetaCalc = Math.abs(orientSC - orientSB);
        const GammaCalc = AlphaCalc + BetaCalc;

        const XS = relType === 'delambre' ? xS : xST;
        const YS = relType === 'delambre' ? yS : yST;
        
        const erreurCartésienne = Math.hypot((xS1 - xS2), (yS1 - yS2));
        const erreurAngulaire = Math.hypot((AlphaCalc - alphaGrad), (BetaCalc - betaGrad));
        const erreurFermeturePoint = relType === 'delambre' ? erreurCartésienne : erreurAngulaire;

        return { 
            x: XS, y: YS, 
            erreurFermeturePoint, 
            // barycentrique directe de Tienstra
            cotA, cotB, cotC, 
            KA, KB, KC, S, 
            orientSA, orientSB, orientSC, 
            AlphaCalc, BetaCalc, GammaCalc,
            erreurAngulaire,
            // Formule de Delambre + équation analytique
            cotAlpha, cotBeta, cotGamma, 
            tanAS, tanBS, tanCS,
            xS1, yS1, xS2, yS2, xS, yS,
            erreurCartésienne,
            // Snellius-Pothenot + calcul des distances et des angles
            orientAB, orientBA, orientBC, orientCB, orientCA, orientAC, 
            orientAS, OrientAS, orientBS, OrientBS, orientCS, OrientCS,
            AB, BC, CA,
            sommetA, sommetB, sommetC,
            K, xy, angleSBA, angleSBC, angleSAB, angleSCB,
            SA, SB, SC, 
            xS_1, yS_1, xS_2, yS_2, xS_3, yS_3
        };
    }
}