import forge from "node-forge";
import { Platform } from "react-native";

import { CONFIG_BASE } from "@/constants/api";
import { DefaultSpiderHttpClientProvider, Spider } from "@/lib/spider";
import type { SpiderHttpClient, SpiderInfo } from "@/lib/spider";
import { useUserBindStore } from "@/store/user-bind";

import { NativeRPCErrorType, nativeRPCError } from "../error";
import type {
  NativeRPCResponseData,
  NativeRPCService,
  NativeRPCServiceContext,
} from "../types";

export class NativeRPCSpiderService implements NativeRPCService {
  readonly name = "spider";

  private readonly spider = new Spider(DefaultSpiderHttpClientProvider);
  private client: SpiderHttpClient | null = null;

  canHandleMethod(method: string): boolean {
    return method === "run" || method === "getulpl";
  }

  async perform(
    method: string,
    params: Record<string, any> | null | undefined,
    _context: NativeRPCServiceContext,
  ): Promise<NativeRPCResponseData> {
    if (method === "run") {
      const requestParams = params ?? {};
      const spiderInfo = await this.resolveSpiderInfo(requestParams);
      const env = this.resolveEnvironment(requestParams.params);
      const newContext = Boolean(requestParams.newContext);

      if (!this.client || newContext) {
        this.client = DefaultSpiderHttpClientProvider.create(spiderInfo.engine);
      }

      const result = await this.spider.run(spiderInfo, env, this.client);
      return result;
    }

    if (method === "getulpl") {
      return this.getUlpl(params ?? {});
    }

    throw nativeRPCError(NativeRPCErrorType.MethodNotFound);
  }

  private async resolveSpiderInfo(
    params: Record<string, any>,
  ): Promise<SpiderInfo> {
    const spiderKey = this.resolveSpiderKey(params);
    if (spiderKey) {
      return this.getSpiderByKey(spiderKey);
    }

    const rawSpider = params.spiderInfo ?? params.info ?? params.spiderJson;
    if (
      !rawSpider &&
      typeof params.spider === "object" &&
      params.spider !== null
    ) {
      return this.spider.deserialize(JSON.stringify(params.spider));
    }
    if (!rawSpider) {
      throw nativeRPCError(
        NativeRPCErrorType.InvalidParams,
        "Missing spider definition",
      );
    }

    if (typeof rawSpider === "string") {
      return this.spider.deserialize(rawSpider);
    }

    return this.spider.deserialize(JSON.stringify(rawSpider));
  }

  private resolveEnvironment(raw: any): Record<string, string> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [key, String(value)]),
    );
  }

  private async getUlpl(
    params: Record<string, any>,
  ): Promise<NativeRPCResponseData> {
    const credentials = await useUserBindStore.getState().getCredentials();
    if (!credentials) {
      throw nativeRPCError(
        NativeRPCErrorType.Unauthorized,
        "No bound student credentials",
      );
    }

    this.client = DefaultSpiderHttpClientProvider.create({
      cookie: true,
      forceSSL: Boolean(params.forceSSL),
      delay: 0,
    });

    const publicKey = await this.fetchPublicKey();

    return {
      ul: encryptRSA(credentials.username, publicKey),
      pl: encryptRSA(credentials.password, publicKey),
    };
  }

  private async fetchPublicKey(): Promise<string> {
    const result = await this.spider.run(
      createPublicKeySpider(),
      {},
      this.client ??
        DefaultSpiderHttpClientProvider.create({
          cookie: true,
          forceSSL: false,
          delay: 0,
        }),
    );

    const publicKey = result.publicKey;
    if (!publicKey) {
      throw nativeRPCError(
        NativeRPCErrorType.UserDefined,
        "Missing public key in spider response",
      );
    }

    return publicKey;
  }

  private resolveSpiderKey(params: Record<string, any>): string | null {
    const rawKey = params.spiderKey ?? params.key ?? params.spider;
    if (typeof rawKey !== "string") {
      return null;
    }

    const trimmedKey = rawKey.trim();
    if (!trimmedKey) {
      return null;
    }

    if (trimmedKey.startsWith("{") || trimmedKey.startsWith("[")) {
      return null;
    }

    return trimmedKey;
  }

  private async getSpiderByKey(spiderKey: string): Promise<SpiderInfo> {
    const response = await fetch(`${CONFIG_BASE}blob/spider-${spiderKey}`, {
      method: "GET",
      headers: {
        "iwut-platform": Platform.OS,
      },
    });

    if (!response.ok) {
      throw nativeRPCError(
        NativeRPCErrorType.UserDefined,
        `failed to download spider ${spiderKey}`,
      );
    }

    return this.spider.deserialize(await response.text());
  }
}

function encryptRSA(content: string, publicKeyBase64: string): string {
  const pem = `-----BEGIN PUBLIC KEY-----\n${chunkPem(
    publicKeyBase64,
  )}\n-----END PUBLIC KEY-----`;
  const publicKey = forge.pki.publicKeyFromPem(pem);
  const encrypted = publicKey.encrypt(content, "RSAES-PKCS1-V1_5");
  return forge.util.encode64(encrypted).replace(/\r?\n/g, "");
}

function chunkPem(input: string): string {
  return input
    .replace(/\s+/g, "")
    .replace(/(.{64})/g, "$1\n")
    .trim();
}

function createPublicKeySpider(): SpiderInfo {
  return {
    name: "getPublicKey",
    version: 0,
    engine: {
      cookie: true,
      forceSSL: false,
      delay: 0,
    },
    task: [
      {
        name: "getPublicKey",
        url: "https://zhlgd.whut.edu.cn/tpass/rsa",
        success: 200,
        method: "post",
        delay: 0,
        payload: {
          type: "text",
          pattern: "",
        },
        content: {
          type: "json",
          value: [{ key: "publicKey", path: "publicKey" }],
        },
        redirect: true,
      },
    ],
    output: ["publicKey"],
  };
}
