import { Ajv } from "ajv";

export function createAjv(): Ajv {
  const ajv = new Ajv({ allErrors: true, strict: false });
  ajv.addFormat("date-time", {
    type: "string",
    validate: (value: string) => !Number.isNaN(Date.parse(value))
  });
  return ajv;
}
