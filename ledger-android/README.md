# 简账 Android APK

把 `../ledger` 的记账页面打进一个 Android WebView APK。

## 特点

- 不需要服务器，打开就能记账
- 页面和资源都打包在 APK 内，断网可用
- 数据存在 WebView 的 `localStorage`，按 App 独立保存
- 支持导出 JSON 备份到手机「下载」
- 支持从文件导入 JSON 备份
- 最低 Android 10（API 29）
- 使用 HTTPS 虚拟源 `appassets.androidplatform.net` 加载本地资源，保证 localStorage 稳定

## 构建

需要：

- JDK（`javac`、`keytool` 在 PATH 中）
- Android SDK：`%USERPROFILE%\android-sdk`
  - `build-tools`（脚本自动选最新）
  - `platforms/android-34`（或更新）
- Python（用于把 `classes.dex` 写进 APK）

在 `ledger-android` 目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\build-apk.ps1 -VersionName "1.0" -VersionCode 1
```

输出：

```text
dist\jianzhang-1.0.apk
```

`keystore\debug.keystore` 是调试签名，第一次构建自动生成；后续升级要保留它，否则不能覆盖安装。正式发布请换成自己的 release keystore。

## 安装

把 APK 发到安卓手机，点开安装；需要允许「安装未知来源应用」。

首次打开如果系统提示网络权限，允许即可（WebView 需要 INTERNET 权限；实际页面资源全部来自本地）。

## 数据说明

APK 内的数据在 App 的 WebView 存储里，不在网页浏览器里。卸载 App 或清除 App 数据会丢失账目，记得用「导出」备份到下载目录。

## 目录

```text
ledger-android/
  AndroidManifest.xml
  build-apk.ps1
  java/com/wuzhongdui/ledger/MainActivity.java
  res/                        图标、主题、字符串
  keystore/debug.keystore     首次构建生成
  dist/jianzhang-1.0.apk      构建产物
```
