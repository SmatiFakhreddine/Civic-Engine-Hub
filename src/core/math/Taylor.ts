export class Taylor {
    /**
     * Approche de Taylor au premier ordre : f(x) ≈ f(x0) + f'(x0) * (x - x0)
     */
    static linearize(f: (x: number) => number, x0: number, x: number, df: (x: number) => number): number {
        const fx0 = f(x0);
        const dfx0 = df(x0);
        return fx0 + dfx0 * (x - x0);
    }
}