# 掌上吾理

基于 React Native 的掌上吾理客户端

![Alt](https://repobeats.axiom.co/api/embed/1b080c2f466837eaa8bb39eace229f2f952a07f2.svg "Repobeats analytics image")

## 开发

```bash
bun install --frozen-lockfile
cp .env.local.example .env.local
```

在有 [Expo Dev Client](https://docs.expo.dev/development/introduction/) 的情况下，运行以下命令启动 Metro 热重载：

```bash
bun start
```

> 您可 [点击此处](https://download.tokenteam.dev/iwut/latest/development.apk) 来下载最新的 Dev Client

或在已安装 Xcode / Android Studio 的环境下，直接构建并在模拟器或已连接的真机中运行：

```bash
bun run ios
# 使用 --device 来选择设备
bun run ios --device

bun run android
```

> [!TIP]
> 若对原生代码、Expo 配置插件或依赖中的原生模块进行了修改，请重新构建 Dev Client 后再启动 Metro 热重载，仅执行 `bun start` 不会让这些改动生效。

## 许可

本项目基于 GNU Affero General Public License v3.0 或后续版本授权发布。

如果您修改并通过网络向用户提供本项目的版本，应按 AGPLv3 的要求向这些用户提供对应源代码。

详情请参阅 [LICENSE](./LICENSE)。
