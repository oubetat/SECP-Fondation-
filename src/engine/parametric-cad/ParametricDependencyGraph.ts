export type ParametricNodeType = 'PARAMETER' | 'FEATURE' | 'GEOMETRY' | 'TOPOLOGY' | 'SKETCH' | 'CONSTRAINT';
export type ParametricDependencyType = 'DRIVES' | 'REFERENCES' | 'PRODUCES' | 'CONSUMES' | 'CONSTRAINS' | 'DERIVES_FROM';

export interface ParametricNode {
    id: string;
    type: ParametricNodeType;
    name?: string;
    sourceId?: string;
    metadata?: Record<string, unknown>;
}

export interface ParametricEdge {
    id: string;
    from: string;
    to: string;
    type: ParametricDependencyType;
    metadata?: Record<string, unknown>;
}

export interface ParametricDependencyGraphSnapshot {
    version: string;
    nodes: ParametricNode[];
    edges: ParametricEdge[];
    roots: string[];
    leaves: string[];
}

export interface ParametricGraphValidationError {
    type: 'DUPLICATE_NODE' | 'DUPLICATE_EDGE' | 'MISSING_NODE' | 'SELF_DEPENDENCY' | 'CYCLE' | 'INVALID_NODE' | 'INVALID_EDGE';
    message: string;
    nodeId?: string;
    edgeId?: string;
}

export interface ParametricGraphValidationWarning {
    type: string;
    message: string;
}

export interface ParametricGraphValidationResult {
    valid: boolean;
    errors: ParametricGraphValidationError[];
    warnings: ParametricGraphValidationWarning[];
    nodeCount: number;
    edgeCount: number;
    cycleCount: number;
}

export class ParametricDependencyGraph {
    private nodes: Map<string, ParametricNode> = new Map();
    private edges: Map<string, ParametricEdge> = new Map();
    private outEdges: Map<string, ParametricEdge[]> = new Map();
    private inEdges: Map<string, ParametricEdge[]> = new Map();

    public clear(): void {
        this.nodes.clear();
        this.edges.clear();
        this.outEdges.clear();
        this.inEdges.clear();
    }

    public addNode(node: ParametricNode): void {
        if (this.nodes.has(node.id)) {
            // Requirement A: The graph must reject duplicate node IDs.
            throw new Error(`Node with ID ${node.id} already exists`);
        }
        this.nodes.set(node.id, { ...node });
        this.outEdges.set(node.id, []);
        this.inEdges.set(node.id, []);
    }

    public removeNode(nodeId: string): void {
        const outE = this.outEdges.get(nodeId) || [];
        for (const edge of outE) {
            this.edges.delete(edge.id);
            const inE = this.inEdges.get(edge.to);
            if (inE) {
                this.inEdges.set(edge.to, inE.filter(e => e.id !== edge.id));
            }
        }
        
        const inE = this.inEdges.get(nodeId) || [];
        for (const edge of inE) {
            this.edges.delete(edge.id);
            const oE = this.outEdges.get(edge.from);
            if (oE) {
                this.outEdges.set(edge.from, oE.filter(e => e.id !== edge.id));
            }
        }
        
        this.outEdges.delete(nodeId);
        this.inEdges.delete(nodeId);
        this.nodes.delete(nodeId);
    }

    public addDependency(fromId: string, toId: string, type: ParametricDependencyType, metadata?: Record<string, unknown>): string {
        const edgeId = `${fromId}::${toId}::${type}`;
        if (this.edges.has(edgeId)) {
            return edgeId; // Idempotent or reject, spec says "rejected or treated idempotently"
        }
        const edge: ParametricEdge = { id: edgeId, from: fromId, to: toId, type, metadata };
        this.edges.set(edgeId, edge);
        
        if (!this.outEdges.has(fromId)) this.outEdges.set(fromId, []);
        this.outEdges.get(fromId)!.push(edge);
        
        if (!this.inEdges.has(toId)) this.inEdges.set(toId, []);
        this.inEdges.get(toId)!.push(edge);
        
        return edgeId;
    }

    public removeDependency(edgeId: string): void {
        const edge = this.edges.get(edgeId);
        if (!edge) return;
        this.edges.delete(edgeId);
        
        const outE = this.outEdges.get(edge.from);
        if (outE) {
            this.outEdges.set(edge.from, outE.filter(e => e.id !== edgeId));
        }
        const inE = this.inEdges.get(edge.to);
        if (inE) {
            this.inEdges.set(edge.to, inE.filter(e => e.id !== edgeId));
        }
    }

    public hasNode(nodeId: string): boolean {
        return this.nodes.has(nodeId);
    }

    public hasDependency(fromId: string, toId: string, type?: ParametricDependencyType): boolean {
        if (type) {
            return this.edges.has(`${fromId}::${toId}::${type}`);
        }
        const outE = this.outEdges.get(fromId);
        return outE ? outE.some(e => e.to === toId) : false;
    }

    public getNode(nodeId: string): ParametricNode | undefined {
        return this.nodes.get(nodeId);
    }

    public getDependencies(nodeId: string): ParametricNode[] {
        // Nodes this node depends ON (incoming edges represent "this node is dependent on..."? Wait. 
        // A -> B means A drives B? 
        // The spec uses "upstream" vs "downstream".
        // Let's look at getParents/getChildren.
        const inE = this.inEdges.get(nodeId) || [];
        return inE.map(e => this.nodes.get(e.from)).filter((n): n is ParametricNode => n !== undefined);
    }

    public getDependents(nodeId: string): ParametricNode[] {
        const outE = this.outEdges.get(nodeId) || [];
        return outE.map(e => this.nodes.get(e.to)).filter((n): n is ParametricNode => n !== undefined);
    }

    public getParents(nodeId: string): ParametricNode[] {
        return this.getDependencies(nodeId);
    }

    public getChildren(nodeId: string): ParametricNode[] {
        return this.getDependents(nodeId);
    }

    public getRoots(): string[] {
        const roots: string[] = [];
        for (const [nodeId, inE] of this.inEdges.entries()) {
            if (inE.length === 0) {
                roots.push(nodeId);
            }
        }
        return roots.sort();
    }

    public getLeaves(): string[] {
        const leaves: string[] = [];
        for (const [nodeId, outE] of this.outEdges.entries()) {
            if (outE.length === 0) {
                leaves.push(nodeId);
            }
        }
        return leaves.sort();
    }

    public topologicalOrder(): string[] {
        // Detect cycle
        if (this.detectCycles().length > 0) {
            throw new Error('Graph contains cycles. Topological sort is only allowed for acyclic graphs.');
        }

        const inDegree = new Map<string, number>();
        for (const nodeId of this.nodes.keys()) {
            const inE = this.inEdges.get(nodeId) || [];
            // Only count edges from valid nodes
            const validInE = inE.filter(e => this.nodes.has(e.from));
            inDegree.set(nodeId, validInE.length);
        }

        const ready: string[] = [];
        for (const [nodeId, deg] of inDegree.entries()) {
            if (deg === 0) {
                ready.push(nodeId);
            }
        }

        // Deterministic ordering based on node ID
        ready.sort();

        const order: string[] = [];
        while (ready.length > 0) {
            const curr = ready.shift()!;
            order.push(curr);

            const outE = this.outEdges.get(curr) || [];
            const newlyReady: string[] = [];
            for (const edge of outE) {
                if (!this.nodes.has(edge.to)) continue;
                const d = inDegree.get(edge.to)! - 1;
                inDegree.set(edge.to, d);
                if (d === 0) {
                    newlyReady.push(edge.to);
                }
            }
            if (newlyReady.length > 0) {
                newlyReady.sort();
                for (const r of newlyReady) ready.push(r);
                ready.sort(); // keep it fully sorted based on ID
            }
        }
        return order;
    }

    public detectCycles(): string[][] {
        const visited = new Map<string, 'WHITE' | 'GRAY' | 'BLACK'>();
        for (const nodeId of this.nodes.keys()) {
            visited.set(nodeId, 'WHITE');
        }

        const cycles: string[][] = [];
        const path: string[] = [];

        const dfs = (curr: string) => {
            visited.set(curr, 'GRAY');
            path.push(curr);

            const outE = this.outEdges.get(curr) || [];
            for (const edge of outE) {
                if (!this.nodes.has(edge.to)) continue;
                const color = visited.get(edge.to);
                if (color === 'GRAY') {
                    // Cycle found
                    const cycleStart = path.indexOf(edge.to);
                    cycles.push([...path.slice(cycleStart), edge.to]);
                } else if (color === 'WHITE') {
                    dfs(edge.to);
                }
            }

            path.pop();
            visited.set(curr, 'BLACK');
        };

        for (const nodeId of this.nodes.keys()) {
            if (visited.get(nodeId) === 'WHITE') {
                dfs(nodeId);
            }
        }
        return cycles;
    }

    public validate(): ParametricGraphValidationResult {
        const errors: ParametricGraphValidationError[] = [];
        const warnings: ParametricGraphValidationWarning[] = [];

        for (const [edgeId, edge] of this.edges.entries()) {
            if (!this.nodes.has(edge.from)) {
                errors.push({ type: 'MISSING_NODE', message: `Edge from non-existent node ${edge.from}`, edgeId });
            }
            if (!this.nodes.has(edge.to)) {
                errors.push({ type: 'MISSING_NODE', message: `Edge to non-existent node ${edge.to}`, edgeId });
            }
            if (edge.from === edge.to) {
                errors.push({ type: 'SELF_DEPENDENCY', message: `Self dependency on node ${edge.from}`, nodeId: edge.from, edgeId });
            }
        }

        const cycles = this.detectCycles();
        for (const cycle of cycles) {
            errors.push({ type: 'CYCLE', message: `Cycle detected: ${cycle.join(' -> ')}` });
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            nodeCount: this.nodes.size,
            edgeCount: this.edges.size,
            cycleCount: cycles.length
        };
    }

    public snapshot(): ParametricDependencyGraphSnapshot {
        const sortedNodes = Array.from(this.nodes.values()).sort((a, b) => a.id.localeCompare(b.id));
        const sortedEdges = Array.from(this.edges.values()).sort((a, b) => {
            if (a.from !== b.from) return a.from.localeCompare(b.from);
            if (a.to !== b.to) return a.to.localeCompare(b.to);
            if (a.type !== b.type) return a.type.localeCompare(b.type);
            return a.id.localeCompare(b.id);
        });

        return {
            version: '1.0', // deterministic version
            nodes: sortedNodes.map(n => ({ ...n })),
            edges: sortedEdges.map(e => ({ ...e })),
            roots: this.getRoots(),
            leaves: this.getLeaves()
        };
    }

    public getTransitiveDependencies(nodeId: string): string[] {
        const visited = new Set<string>();
        const queue = [nodeId];
        visited.add(nodeId); // Don't include self in output, but prevent cycle

        const result: string[] = [];

        while (queue.length > 0) {
            const curr = queue.shift()!;
            const inE = this.inEdges.get(curr) || [];
            for (const edge of inE) {
                if (!visited.has(edge.from)) {
                    visited.add(edge.from);
                    if (this.nodes.has(edge.from)) {
                        result.push(edge.from);
                        queue.push(edge.from);
                    }
                }
            }
        }
        return result.sort();
    }

    public getTransitiveDependents(nodeId: string): string[] {
        const visited = new Set<string>();
        const queue = [nodeId];
        visited.add(nodeId);

        const result: string[] = [];

        while (queue.length > 0) {
            const curr = queue.shift()!;
            const outE = this.outEdges.get(curr) || [];
            for (const edge of outE) {
                if (!visited.has(edge.to)) {
                    visited.add(edge.to);
                    if (this.nodes.has(edge.to)) {
                        result.push(edge.to);
                        queue.push(edge.to);
                    }
                }
            }
        }
        return result.sort();
    }

    public getImpactSet(nodeId: string): string[] {
        return this.getTransitiveDependents(nodeId);
    }

    public getParameterImpact(parameterId: string): string[] {
        const impactSet = this.getImpactSet(parameterId);
        return impactSet.filter(id => {
            const type = this.nodes.get(id)?.type;
            return type === 'FEATURE' || type === 'GEOMETRY' || type === 'TOPOLOGY';
        }).sort();
    }
}
