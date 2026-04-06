import { Buffer } from "buffer";
import TcpSocket from "react-native-tcp-socket";

type FetchHeaderValue = string | number | boolean;
type FetchHeadersInit =
  | Record<string, FetchHeaderValue>
  | [string, FetchHeaderValue][];

type FetchBodyInit = string | URLSearchParams | ArrayBuffer | Uint8Array;

export type FetchNoRedirectInit = {
  method?: string;
  headers?: FetchHeadersInit;
  body?: FetchBodyInit;
  timeout?: number;
  ca?: any;
  tlsCheckValidity?: boolean;
};

type ParsedResponse = {
  status: number;
  statusText: string;
  headers: [string, string][];
  body: Buffer;
};

export class FetchNoRedirectHeaders {
  private readonly headerPairs: [string, string][];
  private readonly headerMap = new Map<string, string[]>();

  constructor(entries: [string, string][]) {
    this.headerPairs = entries.map(([name, value]) => [name, value]);

    for (const [name, value] of this.headerPairs) {
      const key = name.toLowerCase();
      const current = this.headerMap.get(key);
      if (current) {
        current.push(value);
        continue;
      }

      this.headerMap.set(key, [value]);
    }
  }

  get(name: string): string | null {
    const values = this.headerMap.get(name.toLowerCase());
    return values ? values.join(", ") : null;
  }

  has(name: string): boolean {
    return this.headerMap.has(name.toLowerCase());
  }

  entries(): IterableIterator<[string, string]> {
    return this.headerPairs.values();
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.entries();
  }

  toJSON(): Record<string, string> {
    return Object.fromEntries(
      Array.from(this.headerMap.entries(), ([name, values]) => [
        name,
        values.join(", "),
      ]),
    );
  }
}

export class FetchNoRedirectResponse {
  readonly url: string;
  readonly status: number;
  readonly statusText: string;
  readonly ok: boolean;
  readonly redirected = false;
  readonly headers: FetchNoRedirectHeaders;
  readonly bodyUsed = false;

  private readonly rawBody: Buffer;

  constructor(url: string, parsed: ParsedResponse) {
    this.url = url;
    this.status = parsed.status;
    this.statusText = parsed.statusText;
    this.ok = parsed.status >= 200 && parsed.status < 300;
    this.headers = new FetchNoRedirectHeaders(parsed.headers);
    this.rawBody = parsed.body;
  }

  async text(): Promise<string> {
    return this.rawBody.toString("utf8");
  }

  async json<T = unknown>(): Promise<T> {
    return JSON.parse(await this.text()) as T;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const view = this.rawBody.subarray(
      this.rawBody.byteOffset,
      this.rawBody.byteOffset + this.rawBody.byteLength,
    );
    return view.buffer.slice(
      view.byteOffset,
      view.byteOffset + view.byteLength,
    ) as ArrayBuffer;
  }
}

export async function fetchNoRedirect(
  url: string,
  init: FetchNoRedirectInit = {},
): Promise<FetchNoRedirectResponse> {
  const parsedUrl = new URL(url);

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error(`Unsupported protocol: ${parsedUrl.protocol}`);
  }

  const requestBody = createRequestBody(init.body);
  const requestHeaders = createRequestHeaders(parsedUrl, init.headers, requestBody);
  const request = buildRequestMessage(parsedUrl, init.method, requestHeaders, requestBody);
  const responseBuffer = await sendRequest(parsedUrl, request, init);
  const response = parseHttpResponse(responseBuffer);

  return new FetchNoRedirectResponse(parsedUrl.toString(), response);
}

function createRequestHeaders(
  url: URL,
  initHeaders: FetchHeadersInit | undefined,
  body: Buffer,
): [string, string][] {
  const headers = new Map<string, { name: string; value: string }>();

  for (const [name, value] of normalizeHeaders(initHeaders)) {
    headers.set(name.toLowerCase(), { name, value });
  }

  ensureHeader(headers, "Host", url.host);
  ensureHeader(headers, "Connection", "close");
  ensureHeader(headers, "Accept-Encoding", "identity");

  if (body.length > 0) {
    ensureHeader(headers, "Content-Length", String(body.length));
  }

  return Array.from(headers.values(), ({ name, value }) => [name, value]);
}

function normalizeHeaders(
  headers: FetchHeadersInit | undefined,
): [string, string][] {
  if (!headers) {
    return [];
  }

  if (Array.isArray(headers)) {
    return headers.map(([name, value]) => [name, String(value)]);
  }

  return Object.entries(headers).map(([name, value]) => [name, String(value)]);
}

function ensureHeader(
  headers: Map<string, { name: string; value: string }>,
  name: string,
  value: string,
): void {
  const key = name.toLowerCase();
  if (!headers.has(key)) {
    headers.set(key, { name, value });
  }
}

function createRequestBody(body: FetchBodyInit | undefined): Buffer {
  if (body == null) {
    return Buffer.alloc(0);
  }

  if (typeof body === "string") {
    return Buffer.from(body, "utf8");
  }

  if (body instanceof URLSearchParams) {
    return Buffer.from(body.toString(), "utf8");
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  return Buffer.from(body);
}

function buildRequestMessage(
  url: URL,
  method: string | undefined,
  headers: [string, string][],
  body: Buffer,
): Buffer {
  const requestMethod = (method ?? "GET").toUpperCase();
  const path = `${url.pathname || "/"}${url.search}`;
  const headerText = headers
    .map(([name, value]) => `${name}: ${value}`)
    .join("\r\n");
  const requestHead = `${requestMethod} ${path} HTTP/1.1\r\n${headerText}\r\n\r\n`;

  return body.length > 0
    ? Buffer.concat([Buffer.from(requestHead, "utf8"), body])
    : Buffer.from(requestHead, "utf8");
}

function sendRequest(
  url: URL,
  request: Buffer,
  init: FetchNoRedirectInit,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const port = getPort(url);
    const host = url.hostname;
    const timeout = init.timeout ?? 10000;
    const chunks: Buffer[] = [];
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      callback();
    };

    const options = {
      host,
      port,
      connectTimeout: timeout,
      ...(url.protocol === "https:" && init.ca ? { ca: init.ca } : {}),
      ...(url.protocol === "https:" && init.tlsCheckValidity !== undefined
        ? { tlsCheckValidity: init.tlsCheckValidity }
        : {}),
    };

    const socket =
      url.protocol === "https:"
        ? TcpSocket.connectTLS(options, () => {
            socket.write(request);
          })
        : TcpSocket.createConnection(options, () => {
            socket.write(request);
          });

    socket.setTimeout(timeout);
    socket.on("data", (chunk) => {
      chunks.push(toBuffer(chunk));
    });

    socket.on("timeout", () => {
      finish(() => {
        socket.destroy();
        reject(new Error(`Request timed out after ${timeout}ms`));
      });
    });

    socket.on("error", (error) => {
      finish(() => {
        socket.destroy();
        reject(error);
      });
    });

    socket.on("close", () => {
      finish(() => {
        resolve(Buffer.concat(chunks));
      });
    });
  });
}

function getPort(url: URL): number {
  if (url.port) {
    return Number(url.port);
  }

  return url.protocol === "https:" ? 443 : 80;
}

function toBuffer(chunk: string | Buffer): Buffer {
  return Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8");
}

function parseHttpResponse(buffer: Buffer): ParsedResponse {
  const headerEnd = buffer.indexOf("\r\n\r\n");
  if (headerEnd === -1) {
    throw new Error("Invalid HTTP response: missing header terminator");
  }

  const headerText = buffer.slice(0, headerEnd).toString("latin1");
  const bodyBuffer = buffer.slice(headerEnd + 4);
  const lines = headerText.split("\r\n");
  const statusLine = lines.shift();

  if (!statusLine) {
    throw new Error("Invalid HTTP response: missing status line");
  }

  const statusMatch = statusLine.match(/^HTTP\/\d+(?:\.\d+)?\s+(\d{3})(?:\s+(.*))?$/);
  if (!statusMatch) {
    throw new Error(`Invalid HTTP status line: ${statusLine}`);
  }

  const headers = lines
    .filter((line) => line.length > 0)
    .map<[string, string]>((line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) {
        return [line.trim(), ""];
      }

      const name = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      return [name, value];
    });

  return {
    status: Number(statusMatch[1]),
    statusText: statusMatch[2] ?? "",
    headers,
    body: extractResponseBody(bodyBuffer, headers),
  };
}

function extractResponseBody(
  bodyBuffer: Buffer,
  headers: [string, string][],
): Buffer {
  const headerMap = new Map<string, string>();

  for (const [name, value] of headers) {
    headerMap.set(name.toLowerCase(), value);
  }

  const transferEncoding = headerMap.get("transfer-encoding");
  if (transferEncoding?.toLowerCase().includes("chunked")) {
    return decodeChunkedBody(bodyBuffer);
  }

  const contentLength = headerMap.get("content-length");
  if (contentLength) {
    const length = Number(contentLength);
    if (Number.isFinite(length) && length >= 0) {
      return bodyBuffer.slice(0, length);
    }
  }

  return bodyBuffer;
}

function decodeChunkedBody(bodyBuffer: Buffer): Buffer {
  const chunks: Buffer[] = [];
  let cursor = 0;

  while (cursor < bodyBuffer.length) {
    const lineEnd = bodyBuffer.indexOf("\r\n", cursor);
    if (lineEnd === -1) {
      throw new Error("Invalid chunked response: missing chunk size terminator");
    }

    const sizeText = bodyBuffer
      .slice(cursor, lineEnd)
      .toString("latin1")
      .split(";", 1)[0]
      .trim();
    const size = Number.parseInt(sizeText, 16);

    if (Number.isNaN(size)) {
      throw new Error(`Invalid chunk size: ${sizeText}`);
    }

    cursor = lineEnd + 2;

    if (size === 0) {
      return Buffer.concat(chunks);
    }

    const chunkEnd = cursor + size;
    if (chunkEnd > bodyBuffer.length) {
      throw new Error("Invalid chunked response: incomplete chunk body");
    }

    chunks.push(bodyBuffer.slice(cursor, chunkEnd));
    cursor = chunkEnd;

    if (bodyBuffer.toString("latin1", cursor, cursor + 2) !== "\r\n") {
      throw new Error("Invalid chunked response: missing chunk delimiter");
    }

    cursor += 2;
  }

  throw new Error("Invalid chunked response: missing terminating chunk");
}
