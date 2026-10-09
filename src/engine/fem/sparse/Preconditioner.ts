export interface IPreconditioner {}
export class IdentityPreconditioner implements IPreconditioner {}
export class JacobiPreconditioner implements IPreconditioner { constructor(m: any) {} }
export class IncompleteCholeskyPreconditioner implements IPreconditioner { constructor(m: any) {} }
