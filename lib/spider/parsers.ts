import { SpiderException } from "./error";
import { fillVariables } from "./utils";
import type {
  SpiderKeyPathPair,
  SpiderKeyValuePair,
  SpiderParserType,
  SpiderPayloadType,
} from "./types";

export function parsePayload(
  type: SpiderPayloadType,
  pattern: string | undefined,
  value: SpiderKeyValuePair[],
  context: Record<string, string>,
): string {
  switch (type) {
    case "json":
      return parseJsonPayload(value, context);
    case "form":
    case "params":
      return parseUrlEncodedPayload(value, context);
    case "text":
    default:
      return parseTextPayload(pattern, context);
  }
}

export function parseContent(
  type: SpiderParserType,
  content: string,
  pattern: string | undefined,
  value: SpiderKeyPathPair[],
  context: Record<string, string>,
): void {
  switch (type) {
    case "json":
      parseJsonContent(content, value, context);
      return;
    case "regex":
    default:
      parseRegexContent(content, pattern, value, context);
  }
}

function parseJsonPayload(
  pairs: SpiderKeyValuePair[],
  context: Record<string, string>,
): string {
  const jsonObject: Record<string, any> = {};

  for (const pair of pairs) {
    const actualValue = fillVariables(pair.value, context);

    switch (pair.type) {
      case "number": {
        const numericValue = Number(actualValue);
        if (!Number.isFinite(numericValue)) {
          throw new SpiderException(
            `Can not interpret '${pair.value}' as a number`,
          );
        }
        jsonObject[pair.key] = numericValue;
        break;
      }
      case "boolean":
        jsonObject[pair.key] = /^true$/i.test(actualValue);
        break;
      case "object":
        try {
          jsonObject[pair.key] = JSON.parse(actualValue);
        } catch (error) {
          throw new SpiderException(
            `Can not interpret '${pair.value}' as a JSON object`,
            error,
          );
        }
        break;
      case "string":
      default:
        jsonObject[pair.key] = actualValue;
        break;
    }
  }

  return JSON.stringify(jsonObject);
}

function parseTextPayload(
  pattern: string | undefined,
  context: Record<string, string>,
): string {
  if (!pattern) {
    throw new SpiderException("Missing text payload pattern");
  }

  return fillVariables(pattern, context);
}

function parseUrlEncodedPayload(
  pairs: SpiderKeyValuePair[],
  context: Record<string, string>,
): string {
  return pairs
    .map((pair) => {
      const actualValue = fillVariables(pair.value, context);
      return `${pair.key}=${encodeURIComponent(actualValue)}`;
    })
    .join("&");
}

function parseJsonContent(
  content: string,
  pairs: SpiderKeyPathPair[],
  context: Record<string, string>,
): void {
  let element: any;

  try {
    element = JSON.parse(content);
  } catch (error) {
    throw new SpiderException(`Could not parse json element ${content}`, error);
  }

  for (const pair of pairs) {
    const resolved = resolveJsonPath(element, pair.path);
    context[pair.key] = stringifyJsonPathValue(resolved);
  }
}

function resolveJsonPath(element: any, path: string): any {
  let current = element;

  for (const segment of path.split(".")) {
    if (Array.isArray(current)) {
      const index = Number.parseInt(segment, 10);
      if (Number.isNaN(index)) {
        throw new SpiderException(
          `Not a valid index for JSON array near '${segment}' in '${path}'`,
        );
      }
      if (index < 0 || index >= current.length) {
        throw new SpiderException(
          `Non-exist JSON element near '${segment}' in '${path}'`,
        );
      }
      current = current[index];
      continue;
    }

    if (isRecord(current)) {
      if (!(segment in current)) {
        throw new SpiderException(
          `Non-exist JSON element near '${segment}' in '${path}'`,
        );
      }
      current = current[segment];
      continue;
    }

    throw new SpiderException(
      `Not a JSON object or array element near '${segment}' in '${path}'`,
    );
  }

  return current;
}

function stringifyJsonPathValue(value: any): string {
  if (value == null) {
    return "";
  }

  if (Array.isArray(value) || isRecord(value)) {
    return JSON.stringify(value);
  }

  return String(value);
}

function parseRegexContent(
  content: string,
  pattern: string | undefined,
  pairs: SpiderKeyPathPair[],
  context: Record<string, string>,
): void {
  if (!pattern) {
    throw new SpiderException("Missing regex pattern");
  }

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, "s");
  } catch (error) {
    throw new SpiderException(`Invalid pattern '${pattern}'`, error);
  }

  const result = regex.exec(content);
  if (!result) {
    throw new SpiderException(`Can not find pattern ${pattern} in content`);
  }

  for (const pair of pairs) {
    const index = Number.parseInt(pair.path, 10);
    if (Number.isNaN(index)) {
      throw new SpiderException(`Invalid group index '${pair.path}' for regex`);
    }

    context[pair.key] = result[index] ?? "";
  }
}

function isRecord(value: any): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
