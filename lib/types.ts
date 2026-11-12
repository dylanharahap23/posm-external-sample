export interface SourceRef { file?: string; row?: number; sheet?: string; [key: string]: unknown }
export interface Coordinates { latitude?: number | null; longitude?: number | null }
export interface Store extends Coordinates, Record<string, unknown> { id: string; storeId: string; name: string; region?: string; channel?: string; address?: string; source?: SourceRef }
export interface Project extends Record<string, unknown> { id: string; storeId: string; name: string; type?: string; status: string; rawStatus?: string; requestDate?: string | null; brand: string; source?: SourceRef; stages?: Record<string, unknown>; remarks?: string }
export interface CanonicalData { stores: Store[]; projects: Project[]; allocations?: Allocation[]; quality?: unknown; imports?: unknown[] }
export interface Allocation extends Record<string, unknown> { id: string; stage: string; brand: string; region: string | null; area: string | null; channel: string | null; tier: string | null; store_name: string; store_id: string | null; items: Record<string, unknown>; status_survey: string | null; source: SourceRef }
export interface AllocationStoreLink { id: string; allocationId: string; storeId: string; method: string; confidence: number | null; verificationStatus: 'pending' | 'verified' | 'rejected'; actor: string; at: string }
export interface AllocationProjectLink { id: string; allocationId: string; projectId: string; actor: string; at: string }
export interface ReconciliationEvent { id: string; allocationId: string; actor: string; at: string; action: string; before: unknown; after: unknown }
export interface Candidate extends Coordinates { id: string; region?: string; estimatedCost: number | null; factors: Record<string, number | null>; provenance?: string }
