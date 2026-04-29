#!/usr/bin/env node
import { createEcmaScriptPlugin, runNodeJs } from "@bufbuild/protoplugin";
import { ScalarType, getOption, hasOption } from "@bufbuild/protobuf";

// ── helpers ──────────────────────────────────────────────────────────

function lcFirst(s) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function serviceFileName(service) {
  return service.name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

const WELL_KNOWN = {
  "google.protobuf.Timestamp": "string",
  "google.protobuf.Struct": "Record<string, unknown>",
  "google.protobuf.Value": "unknown",
  "google.protobuf.Empty": null,
  "google.protobuf.Duration": "string",
};

function scalarTs(s) {
  switch (s) {
    case ScalarType.STRING:
      return "string";
    case ScalarType.BOOL:
      return "boolean";
    case ScalarType.BYTES:
      return "string";
    default:
      return "number";
  }
}

function fieldTypeTs(field, typeNames) {
  switch (field.fieldKind) {
    case "scalar":
      return scalarTs(field.scalar);
    case "enum":
      return typeNames.get(field.enum) ?? field.enum.name;
    case "message": {
      const wk = WELL_KNOWN[field.message.typeName];
      if (wk !== undefined) return wk ?? "void";
      return typeNames.get(field.message) ?? field.message.name;
    }
    case "list": {
      let inner;
      if (field.listKind === "scalar") inner = scalarTs(field.scalar);
      else if (field.listKind === "enum")
        inner = typeNames.get(field.enum) ?? field.enum.name;
      else {
        const wk = WELL_KNOWN[field.message.typeName];
        inner = wk !== undefined ? (wk ?? "unknown") : (typeNames.get(field.message) ?? field.message.name);
      }
      return `${inner}[]`;
    }
    case "map": {
      const k = scalarTs(field.mapKey);
      let v;
      if (field.mapKind === "scalar") v = scalarTs(field.scalar);
      else if (field.mapKind === "enum")
        v = typeNames.get(field.enum) ?? field.enum.name;
      else {
        const wk = WELL_KNOWN[field.message.typeName];
        v = wk !== undefined ? (wk ?? "unknown") : (typeNames.get(field.message) ?? field.message.name);
      }
      return `Record<${k}, ${v}>`;
    }
  }
}

function isExplicitOptional(field) {
  return String(field.presence) === "EXPLICIT" || field.presence === 1;
}

// ── collect every DescMessage + DescEnum reachable from a service ─────

function collectTypes(service) {
  const seenMsg = new Set();
  const seenEnum = new Set();
  const messages = [];
  const enums = [];

  function walkEnum(e) {
    if (seenEnum.has(e)) return;
    seenEnum.add(e);
    enums.push(e);
  }

  function walk(msg) {
    if (seenMsg.has(msg)) return;
    if (WELL_KNOWN[msg.typeName] !== undefined) return;
    seenMsg.add(msg);
    messages.push(msg);
    for (const nested of msg.nestedMessages) walk(nested);
    for (const nested of msg.nestedEnums) walkEnum(nested);
    for (const f of msg.fields) {
      if (f.fieldKind === "enum" && f.enum) walkEnum(f.enum);
      if (f.fieldKind === "message" && f.message) walk(f.message);
      if (f.fieldKind === "list" && f.listKind === "enum" && f.enum)
        walkEnum(f.enum);
      if (f.fieldKind === "list" && f.listKind === "message" && f.message)
        walk(f.message);
      if (f.fieldKind === "map" && f.mapKind === "enum" && f.enum)
        walkEnum(f.enum);
      if (f.fieldKind === "map" && f.mapKind === "message" && f.message)
        walk(f.message);
    }
  }

  for (const m of service.methods) {
    walk(m.input);
    walk(m.output);
  }
  return { messages, enums };
}

function buildTypeNames(messages, enums) {
  const counts = new Map();
  for (const m of messages) counts.set(m.name, (counts.get(m.name) ?? 0) + 1);
  for (const e of enums) counts.set(e.name, (counts.get(e.name) ?? 0) + 1);

  const names = new Map();
  for (const m of messages) {
    if (counts.get(m.name) > 1) {
      const parts = m.typeName.split(".");
      names.set(m, parts.slice(-2).join("_"));
    } else {
      names.set(m, m.name);
    }
  }
  for (const e of enums) {
    if (counts.get(e.name) > 1) {
      const parts = e.typeName.split(".");
      names.set(e, parts.slice(-2).join("_"));
    } else {
      names.set(e, e.name);
    }
  }
  return names;
}

function printEnumType(f, enumDesc, typeNames) {
  const tsName = typeNames.get(enumDesc) ?? enumDesc.name;
  const members = enumDesc.values.map((v) => `"${v.name}"`);
  f.print(`export type ${tsName} = ${members.join(" | ")};`);
  f.print();
}

function printMessageType(f, msg, typeNames) {
  const tsName = typeNames.get(msg) ?? msg.name;
  f.print(`export type ${tsName} = {`);
  for (const field of msg.fields) {
    const opt = isExplicitOptional(field) ? "?" : "";
    const tsType = fieldTypeTs(field, typeNames);
    f.print(`  ${field.jsonName}${opt}: ${tsType};`);
  }
  f.print(`};`);
  f.print();
}

// ── HTTP annotation reading ──────────────────────────────────────────

function getHttpRule(method, httpExt) {
  if (!httpExt) return null;
  if (!hasOption(method, httpExt)) return null;

  const rule = getOption(method, httpExt);
  if (!rule) return null;

  // protobuf-es v2 represents oneof as { case: "get"|"post"|..., value: "/path" }
  const pattern = rule.pattern;
  if (pattern && pattern.case && pattern.value) {
    return {
      method: pattern.case.toUpperCase(),
      path: pattern.value,
      body: rule.body ?? "",
    };
  }
  return null;
}

// ── code-gen per service ─────────────────────────────────────────────

function snakeToCamel(s) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function snakeToPascal(s) {
  const camel = snakeToCamel(s);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

function snakeToKebab(s) {
  return s.replace(/_/g, "-");
}

function screamingSnakeToPascal(s) {
  return s
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function resolveClient(service) {
  const pkg = service.file.proto.package ?? "";
  // pkg looks like "app_center.v1.app" — take the first segment as the center name
  const centerSegment = pkg.split(".")[0] ?? "api";
  return snakeToCamel(centerSegment) + "Client";
}

function generateServiceFile(schema, service, httpExt) {
  const fileName = `lib/api/gen/${serviceFileName(service)}.ts`;
  const f = schema.generateFile(fileName);
  const clientName = resolveClient(service);

  f.print(`// @generated by protoc-gen-http-client — DO NOT EDIT`);
  f.print(`import { ${clientName} } from "@/lib/api/client";`);
  f.print(`import type { ApiRequestOptions, ApiResponse } from "@/lib/api/types";`);
  f.print();

  const { messages, enums } = collectTypes(service);
  const typeNames = buildTypeNames(messages, enums);

  // ── types ──
  f.print(`// ---- Types ----`);
  f.print();
  for (const e of enums) {
    printEnumType(f, e, typeNames);
  }
  for (const msg of messages) {
    printMessageType(f, msg, typeNames);
  }

  // ── service functions ──
  f.print(`// ---- Service ----`);
  f.print();

  for (const method of service.methods) {
    const rule = getHttpRule(method, httpExt);
    if (!rule) {
      f.print(`// skipped ${method.name}: no google.api.http annotation`);
      f.print();
      continue;
    }

    const fnName = lcFirst(method.name);
    const inputIsEmpty =
      method.input.typeName === "google.protobuf.Empty" ||
      method.input.fields.length === 0;
    const inputIsStruct =
      method.input.typeName === "google.protobuf.Struct";

    const outputTsName = typeNames.get(method.output) ?? method.output.name;

    // Detect ApiResponse pattern: { code, message, traceId } with optional data
    const apiResponseData = detectApiResponseData(method.output, typeNames);

    const returnType = apiResponseData !== null
      ? (apiResponseData === "void" ? "ApiResponse" : `ApiResponse<${apiResponseData}>`)
      : outputTsName;

    // Build function signature
    const params = [];
    if (!inputIsEmpty) {
      const inputType = inputIsStruct
        ? "Record<string, unknown>"
        : (typeNames.get(method.input) ?? method.input.name);
      params.push(`request: ${inputType}`);
    }
    params.push(`options?: ApiRequestOptions`);

    f.print(`export function ${fnName}(`);
    f.print(`  ${params.join(",\n  ")},`);
    f.print(`): Promise<${returnType}> {`);

    const needsCast = apiResponseData === null;
    const castSuffix = needsCast ? ` as unknown as Promise<${returnType}>` : "";

    if (rule.method === "GET") {
      if (inputIsEmpty) {
        f.print(`  return ${clientName}.get("${rule.path}", undefined, options)${castSuffix};`);
      } else {
        f.print(
          `  return ${clientName}.get("${rule.path}", request as unknown as Record<string, unknown>, options)${castSuffix};`,
        );
      }
    } else {
      if (inputIsEmpty) {
        f.print(`  return ${clientName}.post("${rule.path}", undefined, options)${castSuffix};`);
      } else {
        f.print(`  return ${clientName}.post("${rule.path}", request, options)${castSuffix};`);
      }
    }

    f.print(`}`);
    f.print();
  }
}

function detectApiResponseData(output, typeNames) {
  if (WELL_KNOWN[output.typeName] !== undefined) return null;

  const fields = output.fields;
  const hasCode = fields.some(
    (f) => f.jsonName === "code" && f.fieldKind === "scalar" && f.scalar === ScalarType.INT32,
  );
  const hasMessage = fields.some(
    (f) => f.jsonName === "message" && f.fieldKind === "scalar" && f.scalar === ScalarType.STRING,
  );

  if (!hasCode || !hasMessage) return null;

  const dataField = fields.find((f) => f.jsonName === "data");
  if (!dataField) return "void";

  if (dataField.fieldKind === "message") {
    const wk = WELL_KNOWN[dataField.message.typeName];
    if (wk !== undefined) return wk ?? "unknown";
    return typeNames.get(dataField.message) ?? dataField.message.name;
  }
  return null;
}

function generateErrorReasonFiles(schema) {
  for (const file of schema.files) {
    if (!file.name.endsWith("v1/error_reason/error_reason")) continue;

    const centerSegment = (file.proto.package ?? "").split(".")[0];
    if (!centerSegment) continue;

    for (const enumDesc of file.enums) {
      if (enumDesc.name !== "ErrorReason") continue;

      const f = schema.generateFile(
        `lib/api/gen/${snakeToKebab(centerSegment)}-error-reason.ts`,
      );
      const typeName = `${snakeToPascal(centerSegment)}${enumDesc.name}`;
      const valueName = `${typeName}s`;

      f.print(`// @generated by protoc-gen-http-client — DO NOT EDIT`);
      f.print();
      f.print(`export const ${valueName} = {`);
      for (const value of enumDesc.values) {
        f.print(`  ${screamingSnakeToPascal(value.name)}: "${value.name}",`);
      }
      f.print(`} as const;`);
      f.print();
      f.print(`export type ${typeName} = (typeof ${valueName})[keyof typeof ${valueName}];`);
      f.print();
    }
  }
}

// ── plugin entry ─────────────────────────────────────────────────────

const plugin = createEcmaScriptPlugin({
  name: "protoc-gen-http-client",
  version: "0.1.0",
  generateTs(schema) {
    let httpExt = null;
    for (const file of schema.allFiles) {
      for (const ext of file.extensions) {
        if (ext.typeName === "google.api.http") {
          httpExt = ext;
          break;
        }
      }
      if (httpExt) break;
    }

    generateErrorReasonFiles(schema);

    for (const file of schema.files) {
      for (const service of file.services) {
        generateServiceFile(schema, service, httpExt);
      }
    }
  },
});

runNodeJs(plugin);
