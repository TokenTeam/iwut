import { SpiderException } from "./error";
import type {
  EngineOptions,
  SpiderInfo,
  SpiderKeyPathPair,
  SpiderKeyValuePair,
  SpiderMethod,
  SpiderParserInfo,
  SpiderParserType,
  SpiderPayload,
  SpiderPayloadType,
  SpiderTaskInfo,
  SpiderValueType,
} from "./types";

const DEFAULT_ENGINE_OPTIONS: EngineOptions = {
  cookie: true,
  forceSSL: false,
  delay: 0,
};

export function fillVariables(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\$\((.*?)\)/g, (_, rawName: string) => {
    const name = rawName.trim();
    return vars[name] ?? `$(${name})`;
  });
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function deserializeSpiderInfo(input: string): SpiderInfo {
  const raw = JSON.parse(input);
  const info = asRecord(raw, "spider info");

  return {
    name: asOptionalString(info.name),
    version: asNumber(info.version, 0),
    environment: asOptionalStringArray(info.environment),
    engine: parseEngineOptions(info.engine),
    task: asOptionalArray(info.task)?.map((task, index) =>
      parseTaskInfo(task, `task[${index}]`),
    ),
    output: asOptionalStringArray(info.output),
  };
}

export function serializeSpiderInfo(info: SpiderInfo): string {
  return JSON.stringify(toSerializableSpiderInfo(info), null, 2);
}

function toSerializableSpiderInfo(info: SpiderInfo): Record<string, any> {
  return compactObject({
    name: info.name,
    version: info.version,
    environment: info.environment,
    engine: compactObject({
      cookie: info.engine.cookie,
      force_ssl: info.engine.forceSSL,
      delay: info.engine.delay,
    }),
    task: info.task?.map((task) =>
      compactObject({
        name: task.name,
        url: task.url,
        success: task.success,
        method: task.method,
        delay: task.delay,
        payload: task.payload
          ? compactObject({
              type: task.payload.type,
              pattern: task.payload.pattern,
              value: task.payload.value,
              header: task.payload.header,
            })
          : undefined,
        content: task.content
          ? compactObject({
              type: task.content.type,
              pattern: task.content.pattern,
              value: task.content.value,
            })
          : undefined,
        header: task.header,
        redirect: task.redirect,
      }),
    ),
    output: info.output,
  });
}

function parseEngineOptions(raw: any): EngineOptions {
  if (raw == null) {
    return { ...DEFAULT_ENGINE_OPTIONS };
  }

  const engine = asRecord(raw, "engine");

  return {
    cookie: asBoolean(engine.cookie, DEFAULT_ENGINE_OPTIONS.cookie),
    forceSSL: asBoolean(
      firstDefined(engine.forceSSL, engine.force_ssl),
      DEFAULT_ENGINE_OPTIONS.forceSSL,
    ),
    delay: asNumber(engine.delay, DEFAULT_ENGINE_OPTIONS.delay),
  };
}

function parseTaskInfo(raw: any, label: string): SpiderTaskInfo {
  const task = asRecord(raw, label);

  return {
    name: asOptionalString(task.name),
    url: asRequiredString(task.url, `${label}.url`),
    success: asNumber(task.success, 200),
    method: parseMethod(task.method),
    delay: asNumber(task.delay, 0),
    payload: task.payload ? parsePayload(task.payload, `${label}.payload`) : undefined,
    content: task.content ? parseParser(task.content, `${label}.content`) : undefined,
    header: asOptionalArray(task.header)?.map((item, index) =>
      parseKeyPathPair(item, `${label}.header[${index}]`),
    ),
    redirect: asBoolean(task.redirect, true),
  };
}

function parsePayload(raw: any, label: string): SpiderPayload {
  const payload = asRecord(raw, label);

  return {
    type: parsePayloadType(payload.type),
    pattern: asOptionalString(firstDefined(payload.pattern, payload.patten)),
    value: asOptionalArray(payload.value)?.map((item, index) =>
      parseKeyValuePair(item, `${label}.value[${index}]`),
    ),
    header: asOptionalArray(payload.header)?.map((item, index) =>
      parseKeyValuePair(item, `${label}.header[${index}]`),
    ),
  };
}

function parseParser(raw: any, label: string): SpiderParserInfo {
  const parser = asRecord(raw, label);

  return {
    type: parseParserType(parser.type),
    pattern: asOptionalString(firstDefined(parser.pattern, parser.patten)),
    value: asOptionalArray(parser.value)?.map((item, index) =>
      parseKeyPathPair(item, `${label}.value[${index}]`),
    ),
  };
}

function parseKeyPathPair(raw: any, label: string): SpiderKeyPathPair {
  const pair = asRecord(raw, label);

  return {
    key: asRequiredString(pair.key, `${label}.key`),
    path: asRequiredString(pair.path, `${label}.path`),
  };
}

function parseKeyValuePair(raw: any, label: string): SpiderKeyValuePair {
  const pair = asRecord(raw, label);

  return {
    key: asRequiredString(pair.key, `${label}.key`),
    value: asRequiredString(pair.value, `${label}.value`),
    type: parseValueType(pair.type),
  };
}

function parseMethod(raw: any): SpiderMethod {
  const value = asOptionalString(raw)?.toLowerCase();
  return value === "post" ? "post" : "get";
}

function parseParserType(raw: any): SpiderParserType {
  const value = asRequiredString(raw, "parser.type").toLowerCase();
  if (value === "regex" || value === "json") {
    return value;
  }

  throw new SpiderException(`Unsupported parser type: ${value}`);
}

function parsePayloadType(raw: any): SpiderPayloadType {
  const value = asOptionalString(raw)?.toLowerCase() ?? "text";
  if (
    value === "text" ||
    value === "json" ||
    value === "form" ||
    value === "params"
  ) {
    return value;
  }

  throw new SpiderException(`Unsupported payload type: ${value}`);
}

function parseValueType(raw: any): SpiderValueType {
  const value = asOptionalString(raw)?.toLowerCase() ?? "string";
  if (
    value === "string" ||
    value === "number" ||
    value === "boolean" ||
    value === "object"
  ) {
    return value;
  }

  throw new SpiderException(`Unsupported value type: ${value}`);
}

function compactObject(
  object: Record<string, any>,
): Record<string, any> {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  );
}

function firstDefined<T>(...values: T[]): T | undefined {
  return values.find((value) => value !== undefined);
}

function asRecord(
  value: any,
  label: string,
): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SpiderException(`Expected ${label} to be an object`);
  }

  return value as Record<string, any>;
}

function asOptionalArray(value: any): any[] | undefined {
  if (value == null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new SpiderException("Expected value to be an array");
  }

  return value;
}

function asOptionalStringArray(value: any): string[] | undefined {
  const list = asOptionalArray(value);
  return list?.map((item) => asRequiredString(item, "string array item"));
}

function asRequiredString(value: any, label: string): string {
  if (typeof value !== "string") {
    throw new SpiderException(`Expected ${label} to be a string`);
  }

  return value;
}

function asOptionalString(value: any): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asBoolean(value: any, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: any, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return fallback;
}
