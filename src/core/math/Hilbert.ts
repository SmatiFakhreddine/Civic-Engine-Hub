export class Hilbert {
    /**
     * Résout un système linéaire Ao * X = B (approximation matricielle)
     * Utile pour caler les moindres carrés des erreurs de fermeture topo ou de flexion
     */
    static solveSystem(A: number[][], b: number[]): number[] {
        const n = b.length;
        // Implémentation de l'élimination de Gauss simple pour rester autonome
        for (let i = 0; i < n; i++) {
            let maxEl = Math.abs(A[i][i]);
            let maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(A[k][i]) > maxEl) {
                    maxEl = Math.abs(A[k][i]);
                    maxRow = k;
                }
            }
            for (let k = i; k < n; k++) {
                const tmp = A[maxRow][k]; A[maxRow][k] = A[i][k]; A[i][k] = tmp;
            }
            const tmp = b[maxRow]; b[maxRow] = b[i]; b[i] = tmp;

            for (let k = i + 1; k < n; k++) {
                const c = -A[k][i] / A[i][i];
                for (let j = i; j < n; j++) {
                    if (i === j) A[k][j] = 0;
                    else A[k][j] += c * A[i][j];
                }
                b[k] += c * b[i];
            }
        }

        const x = new Array(n).fill(0);
        for (let i = n - 1; i >= 0; i--) {
            x[i] = b[i] / A[i][i];
            for (let k = i - 1; k >= 0; k--) {
                b[k] -= A[k][i] * x[i];
            }
        }
        return x;
    }
}