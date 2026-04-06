export type SpiderMethod = "get" | "post";

export type SpiderParserType = "regex" | "json";

export type SpiderPayloadType = "text" | "json" | "form" | "params";

export type SpiderValueType = "string" | "number" | "boolean" | "object";

export type SpiderKeyPathPair = {
  key: string;
  path: string;
};

export type SpiderKeyValuePair = {
  key: string;
  value: string;
  type: SpiderValueType;
};

export type SpiderParserInfo = {
  type: SpiderParserType;
  pattern?: string;
  value?: SpiderKeyPathPair[];
};

export type SpiderPayload = {
  type: SpiderPayloadType;
  pattern?: string;
  value?: SpiderKeyValuePair[];
  header?: SpiderKeyValuePair[];
};

export type SpiderTaskInfo = {
  name?: string;
  url: string;
  success: number;
  method: SpiderMethod;
  delay: number;
  payload?: SpiderPayload;
  content?: SpiderParserInfo;
  header?: SpiderKeyPathPair[];
  redirect: boolean;
};

export type EngineOptions = {
  cookie: boolean;
  forceSSL: boolean;
  delay: number;
};

export type SpiderInfo = {
  name?: string;
  version: number;
  environment?: string[];
  engine: EngineOptions;
  task?: SpiderTaskInfo[];
  output?: string[];
};

export type SpiderHttpClientResponse = {
  statusCode: number;
  headers: Record<string, string>;
  content: string;
};

export interface SpiderHttpClient {
  get(
    url: string,
    headers: Record<string, string>,
    success?: number,
    autoRedirect?: boolean,
  ): Promise<SpiderHttpClientResponse>;

  post(
    url: string,
    headers: Record<string, string>,
    payload: string,
    payloadType: SpiderPayloadType,
    success?: number,
    autoRedirect?: boolean,
  ): Promise<SpiderHttpClientResponse>;
}

export interface SpiderHttpClientProvider {
  create(options: EngineOptions): SpiderHttpClient;
}
