export const actionsManifestSchema = {
  type: "object",
  required: [
    "$schema",
    "actions_manifest_version",
    "manifest_id",
    "publisher",
    "issued_at",
    "expires_at",
    "sequence",
    "status",
    "domain_verification",
    "key_discovery",
    "links",
    "indexing",
    "policies",
    "actions",
    "signatures"
  ],
  additionalProperties: true,
  properties: {
    $schema: { type: "string" },
    actions_manifest_version: { type: "string", const: "0.1" },
    manifest_id: { type: "string" },
    publisher: {
      type: "object",
      required: ["id", "display_name", "primary_domain"],
      additionalProperties: true,
      properties: {
        id: { type: "string" },
        display_name: { type: "string" },
        primary_domain: { type: "string" }
      }
    },
    issued_at: { type: "string" },
    expires_at: { type: "string" },
    sequence: { type: "number" },
    status: { type: "string" },
    domain_verification: { type: "object" },
    key_discovery: { type: "object" },
    links: { type: "object" },
    indexing: { type: "object" },
    policies: { type: "object" },
    signatures: { type: "array", minItems: 1 },
    actions: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: [
          "id",
          "stable_id",
          "version",
          "revision",
          "status",
          "title",
          "description",
          "machine_description",
          "taxonomy",
          "risk",
          "input_schema",
          "output_schema",
          "auth",
          "confirmation",
          "reversibility",
          "execution",
          "terms"
        ],
        additionalProperties: true,
        properties: {
          id: { type: "string" },
          stable_id: { type: "string" },
          version: { type: "string" },
          revision: { type: "number" },
          status: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          machine_description: { type: "string" },
          taxonomy: {
            type: "object",
            required: ["category", "vertical"],
            properties: {
              category: { type: "string" },
              vertical: { type: "string" }
            }
          },
          risk: {
            type: "object",
            required: ["tier", "side_effect", "data_sensitivity"],
            properties: {
              tier: { type: "number", enum: [0, 1, 2] },
              side_effect: { type: "string" },
              data_sensitivity: { type: "string" }
            }
          },
          input_schema: { type: "object" },
          output_schema: { type: "object" },
          auth: {
            type: "object",
            required: ["required"],
            properties: {
              required: { type: "boolean" }
            }
          },
          confirmation: {
            type: "object",
            required: ["required"],
            properties: {
              required: { type: "boolean" }
            }
          },
          reversibility: {
            type: "object",
            required: ["reversible"],
            properties: {
              reversible: { type: "boolean" }
            }
          },
          execution: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["type", "ref", "operation_id", "timeout_ms"],
              properties: {
                type: { type: "string", const: "openapi" },
                ref: { type: "string" },
                operation_id: { type: "string" },
                timeout_ms: { type: "number" }
              }
            }
          },
          terms: {
            type: "object",
            required: ["terms_url", "privacy_url"],
            properties: {
              terms_url: { type: "string" },
              privacy_url: { type: "string" }
            }
          }
        }
      }
    }
  }
} as const;
