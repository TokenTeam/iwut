import { NativeRPCAppService } from "./services/app";
import { NativeRPCStorageService } from "./services/storage";
import { NativeRPCStudentService } from "./services/student";
import { NativeRPCSpiderService } from "./services/spider";
import type { NativeRPCService } from "./types";

export class NativeRPCServiceCenter {
  private readonly serviceMap = new Map<string, NativeRPCService>();

  constructor(services: NativeRPCService[] = defaultServices()) {
    for (const service of services) {
      this.registerService(service);
    }
  }

  registerService(service: NativeRPCService): void {
    this.serviceMap.set(service.name, service);
  }

  getService(name: string): NativeRPCService | undefined {
    return this.serviceMap.get(name);
  }
}

function defaultServices(): NativeRPCService[] {
  return [
    new NativeRPCAppService(),
    new NativeRPCStorageService(),
    new NativeRPCStudentService(),
    new NativeRPCSpiderService(),
  ];
}

export const nativeRPCServiceCenter = new NativeRPCServiceCenter();
