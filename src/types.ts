export type RiskTier = 0 | 1 | 2;

export type JsonSchema = {
  type?: string;
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  enum?: string[];
  const?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  format?: string;
  additionalProperties?: boolean;
};

export type ConstraintManifest = {
  $schema: string;
  actions_manifest_version: string;
  manifest_id: string;
  publisher: {
    id: string;
    display_name: string;
    legal_name?: string;
    primary_domain: string;
    support_email?: string;
    country?: string;
  };
  issued_at: string;
  expires_at: string;
  sequence: number;
  status: "active" | "deprecated" | "suspended" | "revoked";
  domain_verification: Record<string, unknown>;
  key_discovery: Record<string, unknown>;
  links: Record<string, unknown>;
  indexing: Record<string, unknown>;
  policies: Record<string, unknown>;
  actions: ConstraintAction[];
  signatures: Array<Record<string, string>>;
};

export type ConstraintAction = {
  id: string;
  stable_id: string;
  version: string;
  revision: number;
  status: "active" | "beta" | "deprecated" | "disabled";
  title: string;
  description: string;
  machine_description: string;
  taxonomy: {
    category: string;
    vertical: string;
  };
  risk: {
    tier: RiskTier;
    side_effect: "none" | "return_created" | "pickup_scheduled" | string;
    data_sensitivity: string;
  };
  input_schema: JsonSchema;
  output_schema: JsonSchema;
  auth: {
    required: boolean;
    scopes?: string[];
  };
  confirmation: {
    required: boolean;
    must_display?: string[];
    expires_after_seconds?: number;
  };
  reversibility: {
    reversible: boolean;
    cancel_action_id?: string;
    cancel_until_policy?: string;
  };
  execution: ConstraintExecutionBinding[];
  terms: {
    terms_url: string;
    privacy_url: string;
  };
};

export type ConstraintExecutionBinding = {
  type: "openapi";
  ref: string;
  operation_id: string;
  operation_ref?: string;
  timeout_ms: number;
  idempotency?: {
    required: boolean;
    header: string;
  };
};

export type StoredManifest = {
  digest: string;
  manifest: ConstraintManifest;
};

export type StoredAction = ConstraintAction & {
  manifest_digest: string;
  publisher_domain: string;
};

export type SearchQuery = {
  goal: string;
  constraints: {
    merchant?: string;
    risk_tiers_allowed?: RiskTier[];
    requires_reversible?: boolean;
  };
};

export type PlannedStep = {
  action_id: string;
  stable_id: string;
  manifest_digest: string;
  risk_tier: RiskTier;
  confirmation_required: boolean;
};

export type PlannedPath = {
  status: "coherent_path_found" | "no_policy_allowed_path" | "missing_required_inputs";
  path_id: string;
  coherence_score: number;
  steps: PlannedStep[];
  why_coherent: string[];
};

export type Confirmation = {
  id: string;
  action_id: string;
  manifest_digest: string;
  status: "pending" | "confirmed" | "denied";
  summary: {
    action_path: string[];
    merchant: string;
    risk_tier: RiskTier;
    data_shared: string[];
    reversible: boolean;
  };
  expires_at: string;
  decided_at?: string;
};

export type PreflightRecord = {
  id: string;
  action_id: string;
  manifest_digest: string;
  inputs: Record<string, unknown>;
  status: "ready" | "confirmation_required";
  confirmation_id?: string;
  intent_receipt_id: string;
};

export type ReceiptType = "intent" | "consent" | "execution";

export type SignedReceipt = {
  receipt_id: string;
  type: ReceiptType;
  issued_at: string;
  issuer: "urn:constraint-net:gateway:dev";
  subject: {
    execution_id?: string;
    action_id: string;
    manifest_digest: string;
  };
  hashes: {
    input_sha256?: string;
    provider_response_sha256?: string;
    policy_decision_sha256?: string;
  };
  state: Record<string, unknown>;
  previous_receipt_hash?: string;
  signature: {
    alg: "Ed25519";
    kid: "constraint-net-dev-2026-04";
    value: string;
  };
};
