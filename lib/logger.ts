import { Platform } from "react-native";
import { FileLogger, LogLevel } from "react-native-file-logger";
import {
  logger as nativeLogger,
  type transportFunctionType,
} from "react-native-logs";

const pending: { level: LogLevel; message: string }[] = [];
let fileReady = false;
let fileFailed = false;

const transport: transportFunctionType<object> = ({ msg, level }) => {
  const message = msg.trim();
  const method = level.text as "debug" | "info" | "warn" | "error";
  console[method](message);
  if (Platform.OS === "web" || fileFailed) return;
  if (fileReady) {
    FileLogger.write(level.severity, message);
  } else {
    // 初始化前仅保留少量日志，避免启动期间无限堆积
    if (pending.length >= 100) pending.shift();
    pending.push({ level: level.severity, message });
  }
};

export const logger = nativeLogger.createLogger({
  severity: __DEV__ ? "debug" : "info",
  levels: {
    debug: LogLevel.Debug,
    info: LogLevel.Info,
    warn: LogLevel.Warning,
    error: LogLevel.Error,
  },
  transport,
  async: false,
  printDate: false,
  fixedExtLvlLength: false,
});

if (Platform.OS !== "web") {
  void FileLogger.configure({
    captureConsole: false,
    logLevel: __DEV__ ? LogLevel.Debug : LogLevel.Info,
    dailyRolling: true,
    maximumFileSize: 1024 * 512,
    maximumNumberOfFiles: 5,
  })
    .then(() => {
      fileReady = true;
      for (const entry of pending) {
        FileLogger.write(entry.level, entry.message);
      }
      pending.length = 0;
    })
    .catch(() => {
      fileFailed = true;
      pending.length = 0;
      console.warn("[Logger] Init failed");
    });
}
