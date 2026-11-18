// IDs nominais (SPEC §3.1): impedem trocar NodeId por EdgeId por engano.
declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type NodeId = Brand<string, 'NodeId'>;
export type EdgeId = Brand<string, 'EdgeId'>;
export type GraphId = Brand<string, 'GraphId'>;

export const nodeId = (value: string): NodeId => value as NodeId;
export const edgeId = (value: string): EdgeId => value as EdgeId;
export const graphId = (value: string): GraphId => value as GraphId;
