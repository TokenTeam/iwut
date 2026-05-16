import { Platform } from "react-native";
import TcpSocket from "react-native-tcp-socket";
import WifiManager from "react-native-wifi-reborn";

import { t } from "@/lib/i18n";
import { reportWifiConnectivity } from "@/modules/network-reporter";

const GATEWAY = "http://172.30.21.100";

function getNasId(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const socket = TcpSocket.createConnection(
      { host: "connect.rom.miui.com", port: 80 },
      () => {
        socket.write(
          "GET /generate_204 HTTP/1.0\r\nHost: connect.rom.miui.com\r\nConnection: close\r\n\r\n",
        );
      },
    );

    let data = "";
    socket.on("data", (chunk) => {
      data += chunk.toString();
    });

    socket.on("close", () => {
      const location = data.match(/Location:\s*(.*)/i);
      if (!location) {
        resolve(null);
        return;
      }

      try {
        const url = new URL(location[1].trim());
        resolve(
          url.searchParams.get("nasId") ??
            url.pathname.split("/").pop() ??
            null,
        );
      } catch {
        resolve(null);
      }
    });

    socket.on("error", () => {
      socket.destroy();
      reject(new Error(t("wlan.errNetwork")));
    });
  });
}

export async function login(
  username: string,
  password: string,
): Promise<string | undefined> {
  if (Platform.OS === "android") {
    try {
      await WifiManager.forceWifiUsageWithOptions(true, { noInternet: true });
    } catch {
      throw new Error(t("wlan.errNotCampus"));
    }
  }

  try {
    const nasId = await getNasId();
    if (!nasId) return undefined;

    const csrf = await fetch(`${GATEWAY}/api/csrf-token`, {
      credentials: "include",
    })
      .then((response) => response.json())
      .then((data) => data.csrf_token);

    // {"authCode":"ok:radius","authMsg":"已登录成功","code":0,"dialCode":"","dialMsg":"","enableDial":true,"macOnlineCount":2,"msg":"认证成功","online":{"AddTime":"2026-01-01T10:00:00.111111111+08:00","BytesIn4":"0","BytesIn6":"0","BytesOut4":"0","BytesOut6":"0","Name":"","PacketIn4":"0","PacketIn6":"0","PacketOut4":"0","PacketOut6":"0","SessionId":"172.30.1.222-WHUT-Br012","UserIpv4":"10.82.77.1","UserIpv6":"","UserMac":"00:00:00:00:00:00","UserSourceType":"local","Username":"300000"},"token":""}
    // {"authCode":"E20002","authMsg":"账号或密码错误","code":1,"extendMsg":"","msg":"账号或密码错误","remainTime":0,"status":"","token":"","userStatus":""}
    const { code, msg } = await fetch(`${GATEWAY}/api/account/login`, {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-csrf-token": csrf,
      },
      body: new URLSearchParams({
        username,
        password,
        nasId,
        switchip: "",
        userIpv4: "",
        userMac: "",
        captcha: "",
        captchaId: "",
      }).toString(),
    })
      .then((response) => response.json())
      .then((data) => ({ code: data.code, msg: data.msg }));

    if (code !== 0) {
      throw new Error(msg);
    }

    if (Platform.OS === "android") {
      // 登录成功后通知系统重新评估 Wi-Fi 可用性
      await reportWifiConnectivity(true);
    }

    return msg;
  } finally {
    if (Platform.OS === "android") {
      await WifiManager.forceWifiUsageWithOptions(false, { noInternet: true });
    }
  }
}
