import { SpiderException } from "./error";
import { DefaultSpiderHttpClientProvider } from "./http-client";
import { parseContent, parsePayload } from "./parsers";
import type {
  SpiderHttpClient,
  SpiderHttpClientProvider,
  SpiderInfo,
  SpiderPayloadType,
  SpiderTaskInfo,
} from "./types";
import {
  delay,
  deserializeSpiderInfo,
  fillVariables,
  serializeSpiderInfo,
} from "./utils";

export class Spider {
  private defaultDelay = 0;

  constructor(
    private readonly httpClientProvider: SpiderHttpClientProvider = DefaultSpiderHttpClientProvider,
  ) {}

  serialize(info: SpiderInfo): string {
    return serializeSpiderInfo(info);
  }

  deserialize(info: string): SpiderInfo {
    return deserializeSpiderInfo(info);
  }

  createClient(info: SpiderInfo): SpiderHttpClient {
    return this.httpClientProvider.create(info.engine);
  }

  async run(
    info: SpiderInfo,
    environment: Record<string, string> = {},
    client?: SpiderHttpClient,
  ): Promise<Record<string, string>> {
    this.defaultDelay = info.engine.delay;

    const missingEnvironment =
      info.environment?.filter((key) => !(key in environment)) ?? [];
    if (missingEnvironment.length > 0) {
      throw new Error(
        `Missing environment variables: ${missingEnvironment.join(", ")}`,
      );
    }

    const context: Record<string, string> = { ...environment };
    const httpClient = client ?? this.createClient(info);

    for (const [index, task] of (info.task ?? []).entries()) {
      try {
        await this.runStep(task, context, httpClient);
        const taskDelay = task.delay > 0 ? task.delay : this.defaultDelay;
        if (taskDelay > 0) {
          await delay(taskDelay);
        }
      } catch (error) {
        throw new SpiderException(
          `Failed to execute step [${task.name ?? ""}], index = ${index}`,
          error,
        );
      }
    }

    const output: Record<string, string> = {};
    for (const key of info.output ?? []) {
      if (!(key in context)) {
        throw new SpiderException(`Missing output variable: ${key}`);
      }
      output[key] = context[key];
    }

    return output;
  }

  private async runStep(
    task: SpiderTaskInfo,
    context: Record<string, string>,
    client: SpiderHttpClient,
  ): Promise<void> {
    const url = fillVariables(task.url, context);
    const payload = this.buildPayload(task, context);
    const successCode = task.success || 200;
    const requestHeaders = this.buildRequestHeaders(task, context);

    const response =
      task.method === "get"
        ? await client.get(
            appendQuery(url, payload),
            requestHeaders,
            successCode,
            task.redirect,
          )
        : await client.post(
            url,
            requestHeaders,
            payload,
            task.payload?.type ?? ("text" as SpiderPayloadType),
            successCode,
            task.redirect,
          );

    if (task.content?.value) {
      parseContent(
        task.content.type,
        response.content,
        task.content.pattern,
        task.content.value,
        context,
      );
    }

    for (const header of task.header ?? []) {
      const key = header.path.toLowerCase();
      if (!(key in response.headers)) {
        throw new SpiderException(`Missing header: ${header.path}`);
      }
      context[header.key] = response.headers[key];
    }
  }

  private buildPayload(
    task: SpiderTaskInfo,
    context: Record<string, string>,
  ): string {
    if (!task.payload?.value) {
      return "";
    }

    return parsePayload(
      task.payload.type,
      task.payload.pattern,
      task.payload.value,
      context,
    );
  }

  private buildRequestHeaders(
    task: SpiderTaskInfo,
    context: Record<string, string>,
  ): Record<string, string> {
    const headers: Record<string, string> = {};

    for (const header of task.payload?.header ?? []) {
      headers[header.key] = fillVariables(header.value, context);
    }

    return headers;
  }
}

function appendQuery(url: string, payload: string): string {
  if (!payload) {
    return url;
  }

  return `${url}${url.includes("?") ? "&" : "?"}${payload}`;
}

export async function runSpiderForResult(
  spiderJson: string,
  env: Record<string, string> = {},
): Promise<Record<string, string>> {
  const spider = new Spider();
  const spiderInfo = spider.deserialize(spiderJson);
  return spider.run(spiderInfo, env);
}
