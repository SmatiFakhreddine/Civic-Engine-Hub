interface StatOutputs {
    mean: number;
    variance: number;
    stdDev: number;
    marginError95: number;
}

export class Statistics {
    static analyze(errors: number[]): StatOutputs {
        if (errors.length === 0) return { mean: 0, variance: 0, stdDev: 0, marginError95: 0 };
        const mean = errors.reduce((a, b) => a + b, 0) / errors.length;
        const variance = errors.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / errors.length;
        const stdDev = Math.sqrt(variance);
        // Intervalle de confiance à 95% (Z = 1.96)
        const marginError95 = 1.96 * (stdDev / Math.sqrt(errors.length));
        
        return { mean, variance, stdDev, marginError95 };
    }
}