interface DataPoint { x: number; y: number; }

export class Riemann {
    /**
     * Intégration par la méthode des trapèzes (Somme de Riemann continue)
     */
    static integrate(points: DataPoint[]): number {
        if (points.length < 2) return 0;
        let area = 0;
        // Tri des points par abscisse croissante
        const sorted = [...points].sort((a, b) => a.x - b.x);
        
        for (let i = 0; i < sorted.length - 1; i++) {
            const h = sorted[i + 1].x - sorted[i].x;
            area += (sorted[i].y + sorted[i + 1].y) * h / 2;
        }
        return area;
    }
}