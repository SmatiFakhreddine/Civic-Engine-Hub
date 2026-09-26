import { Topography } from './Topography';

interface Point3D { id: string; x: number; y: number; z: number; }

export class Hydraulics {
    /**
     * Formule de Manning-Strickler pour déterminer la vitesse critique d'écoulement
     * V = K * Rh^(2/3) * S^(1/2)
     */
    static computeVelocity(p1: Point3D, p2: Point3D, K: number, Rh: number): { pente: number; vitesse: number } {
        const dist = Topography.getHorizontalDistance(p1, p2);
        if (dist === 0) return { pente: 0, vitesse: 0 };
        
        const pente = Math.abs(p2.z - p1.z) / dist;
        const vitesse = K * Math.pow(Rh, 2 / 3) * Math.sqrt(pente);
        
        return { pente, vitesse };
    }
}