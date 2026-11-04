import { Platform } from "expo";
import * as Network from "expo-network";
import TcpSocket from "react-native-tcp-socket";

export async function isNetworkAvailable(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();

    if (state.isConnected === false) {
      return false;
    }

    if (Platform.OS === "android") {
      return state.isInternetReachable === true;
    }
  } catch {
    return false;
  }

  return isTcpReachable("223.5.5.5", 53);
}

export async function isCampusNetwork(): Promise<boolean> {
  try {
    const ip = await Network.getIpAddressAsync();
    const address = ip
      .split(".")
      .reduce((value, octet) => (value << 8) | Number(octet), 0);
    const isPrivate =
      address >>> 24 === 0x0a || // 10.0.0.0/8
      address >>> 20 === 0xac1 || // 172.16.0.0/12
      address >>> 16 === 0xc0a8; // 192.168.0.0/16
    if (!isPrivate) return false;
  } catch {
    return false;
  }

  return isTcpReachable("172.30.21.100", 80);
}

function isTcpReachable(host: string, port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const timeout = 1000;
    let socket: InstanceType<typeof TcpSocket.Socket> | undefined;
    let settled = false;

    const finish = (isReachable: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      socket?.destroy();
      resolve(isReachable);
    };

    const timer = setTimeout(() => finish(false), timeout);

    try {
      socket = new TcpSocket.Socket();
      socket.once("connect", () => finish(true));
      socket.on("error", () => finish(false));
      socket.once("close", () => finish(false));
      socket.connect({
        host,
        port,
        connectTimeout: timeout,
      });
    } catch {
      finish(false);
    }
  });
}
