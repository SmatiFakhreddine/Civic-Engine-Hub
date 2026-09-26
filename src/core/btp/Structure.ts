import { Riemann } from '../math/Riemann';

interface DataPoint { x: number; y: number; };

export class Structure {
    /**
     * Détermine le volume réel d'un élément structurel basé sur ses relevés d'exécution
     */
    static calculateRealVolume(longueur: number, profilsEpaisseur: DataPoint[]): number {
        const aireSectionMoyenne = Riemann.integrate(profilsEpaisseur);
        return aireSectionMoyenne * longueur; 
    }
}