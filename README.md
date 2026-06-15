<div align="center">

# 掌上吾理

基于 React Native / Expo 的掌上吾理客户端

<p>
  <a href="https://github.com/TokenTeam/iwut/stargazers">
    <img alt="GitHub stars" src="https://img.shields.io/github/stars/TokenTeam/iwut?style=flat-square&logo=github">
  </a>
  <a href="https://github.com/TokenTeam/iwut/blob/main/LICENSE">
    <img alt="License" src="https://img.shields.io/github/license/TokenTeam/iwut?style=flat-square">
  </a>
  <img alt="Version" src="https://img.shields.io/github/package-json/v/TokenTeam/iwut?style=flat-square">
  <img alt="Last commit" src="https://img.shields.io/github/last-commit/TokenTeam/iwut?style=flat-square">
</p>

<p>
  <img alt="Expo" src="https://img.shields.io/badge/dynamic/json?style=flat-square&label=expo&query=%24.dependencies.expo&url=https%3A%2F%2Fraw.githubusercontent.com%2FTokenTeam%2Fiwut%2Fmain%2Fpackage.json&logo=expo&logoColor=white">
  <img alt="React Native" src="https://img.shields.io/badge/dynamic/json?style=flat-square&label=react-native&query=%24.dependencies%5B%22react-native%22%5D&url=https%3A%2F%2Fraw.githubusercontent.com%2FTokenTeam%2Fiwut%2Fmain%2Fpackage.json&logo=react&logoColor=white">
  <img alt="Bun" src="https://img.shields.io/badge/runtime-bun-black?style=flat-square&logo=bun">
</p>

</div>

## 下载

您可以访问 [官网](https://iwut.tokenteam.net) 获取最新版本。

开发者可以通过以下方式获取 Expo Dev Client：

|  平台   |                                       获取方式                                        |
| :-----: | :-----------------------------------------------------------------------------------: |
| Android | [下载最新 Dev Client APK](https://download.tokenteam.dev/iwut/latest/development.apk) |
|   iOS   |                        参考下方说明自行构建，或与开发团队联系                         |

## 开发

```bash
bun install --frozen-lockfile
cp .env.local.example .env.local
```

在有 [Expo Dev Client](https://docs.expo.dev/development/introduction/) 的情况下，运行以下命令启动 Metro 热重载：

```bash
bun start
```

或在已安装 Xcode / Android Studio 的环境下，直接构建并在模拟器或已连接的真机中运行：

```bash
bun run ios
# 使用 --device 来选择设备
bun run ios --device

bun run android
```

提交代码前，可使用以下命令进行代码检查与格式化：

```bash
bun run lint
bun run format
```

> [!TIP]
> 若对原生代码、Expo 配置插件或依赖中的原生模块进行了修改，请重新构建 Dev Client 后再启动 Metro 热重载，仅执行 `bun start` 不会让这些改动生效。

## 许可

本项目基于 GNU Affero General Public License v3.0 或后续版本授权发布。

如果您修改并通过网络向用户提供本项目的版本，应按 AGPLv3 的要求向这些用户提供对应源代码。

详情请参阅 [LICENSE](./LICENSE)。

## 活动

![Repobeats analytics image](https://repobeats.axiom.co/api/embed/1b080c2f466837eaa8bb39eace229f2f952a07f2.svg "Repobeats analytics image")
