/**
 * 应用程序主入口文件
 *
 * 负责整个应用的初始化、启动和生命周期管理。
 * 主要职责：
 * 1. 环境初始化：加载配置、初始化日志系统。
 * 2. 状态同步：根据运行时配置同步 Provider 的启用/禁用状态。
 * 3. 信号处理：优雅处理 SIGINT/SIGTERM 信号，确保资源正确释放。
 * 4. 服务启动：启动 HTTP 服务器并监听指定端口。
 */

import { cleanupOldContainers, handleRequest } from "./app.ts";
import {
  getAppVersion,
  getRuntimeConfig,
  getSystemConfig,
  LOG_LEVEL,
  PORT,
  type RuntimeConfig,
  type SystemConfig,
} from "./config/manager.ts";
import { closeLogger, configureLogger, info, initLogger, LogLevel, warn } from "./core/logger.ts";
import { providerRegistry } from "./providers/registry.ts";
import type { ProviderName } from "./providers/base.ts";
import { runIntegrityCheck } from "./utils/integrity-checker.ts";

// ==========================================
// 1. 初始化阶段
// ==========================================

// 初始化日志系统
await initLogger();

// 运行项目完整性检查（仅在启动时进行基础检查）
// 检查命令行参数是否包含 --skip-integrity-check 来跳过检查
const skipIntegrityCheck = Deno.args.includes("--skip-integrity-check");
if (!skipIntegrityCheck) {
  try {
    const integrityReport = await runIntegrityCheck();
    if (!integrityReport.isHealthy) {
      warn("Integrity", `项目完整性检查发现 ${integrityReport.failed} 个问题`);
      warn("Integrity", "使用 'deno task check' 查看详细报告");
      warn("Integrity", "若要跳过此检查，请添加 --skip-integrity-check 参数");
    } else {
      info("Integrity", "✅ 项目完整性检查通过");
    }
  } catch (e) {
    warn("Integrity", `完整性检查失败: ${e}`);
  }
}

// 同步 Provider 启用状态
// 根据运行时配置 (runtime.json) 初始化 ProviderRegistry 中的 Provider 状态
const runtimeConfig: RuntimeConfig = getRuntimeConfig();
if (runtimeConfig.providers) {
  for (const [name, config] of Object.entries(runtimeConfig.providers)) {
    // 显式类型收窄，确保 config 是对象且包含 enabled 属性
    if (config && typeof config === "object" && "enabled" in config) {
      if (config.enabled) {
        providerRegistry.enable(name as ProviderName);
      } else {
        providerRegistry.disable(name as ProviderName);
      }
    }
  }
}

// 根据环境变量或配置设置日志级别
const logLevel = LOG_LEVEL?.toUpperCase();
if (logLevel && logLevel in LogLevel) {
  configureLogger({ level: LogLevel[logLevel as keyof typeof LogLevel] });
}

const systemConfig: SystemConfig = getSystemConfig();

if (Deno.build.os !== "windows") {
  try {
    await cleanupOldContainers();
  } catch (e) {
    void e;
  }
}

// ==========================================
// 2. 启动信息输出
// ==========================================

// 读取版本号并输出启动 Banner 信息
const version = getAppVersion();
info("Startup", `🚀 服务启动端口 ${PORT}`);
if (systemConfig.globalAccessKey) {
  info("Startup", "🔒 已启用统一访问密钥保护");
}
info("Startup", `📦 版本: ${version}`);
const providerSummary = providerRegistry.getRegistrationSummary();
info("Startup", `🔧 ${providerSummary}`);
info("Startup", "📡 端点: /v1/chat/completions, /v1/images/generations, /v1/images/edits");
info("Startup", `📁 日志目录: ./data/logs`);

// ==========================================
// 3. 信号处理 (优雅退出)
// ==========================================

/**
 * 处理 SIGINT 信号 (通常由 Ctrl+C 触发)
 *
 * 记录日志并关闭日志文件句柄，然后退出进程。
 */
Deno.addSignalListener("SIGINT", async () => {
  info("Startup", "收到 SIGINT, 关闭服务...");
  await closeLogger();
  Deno.exit(0);
});

// Windows 不支持 SIGTERM，仅在非 Windows 系统上监听
// 感谢 @johnnyee 在 PR #3 中提出的修复方案
if (Deno.build.os !== "windows") {
  /**
   * 处理 SIGTERM 信号 (通常由 kill 命令或容器编排系统触发)
   */
  Deno.addSignalListener("SIGTERM", async () => {
    info("Startup", "收到 SIGTERM, 关闭服务...");
    await closeLogger();
    Deno.exit(0);
  });
}

// ==========================================
// 4. 启动服务器
// ==========================================

// 启动 HTTP 服务器，使用 handleRequest 处理所有请求
Deno.serve({ port: PORT }, handleRequest);
