/**
 * 项目完整性检查器
 * 
 * 用于验证项目文件结构、配置和依赖的完整性。
 * 主要功能：
 * 1. 检查必需文件是否存在
 * 2. 验证目录结构
 * 3. 检查配置文件格式
 * 4. 验证依赖项配置
 */

import { exists } from "@std/fs";
import { join } from "@std/path";

/**
 * 检查结果接口
 */
export interface CheckResult {
  /** 检查是否通过 */
  passed: boolean;
  /** 检查类型 */
  category: string;
  /** 检查项名称 */
  name: string;
  /** 详细信息 */
  message: string;
}

/**
 * 完整性检查报告
 */
export interface IntegrityReport {
  /** 总检查项数 */
  total: number;
  /** 通过的检查项数 */
  passed: number;
  /** 失败的检查项数 */
  failed: number;
  /** 所有检查结果 */
  results: CheckResult[];
  /** 是否完全通过 */
  isHealthy: boolean;
}

/**
 * 必需的文件列表
 */
const REQUIRED_FILES = [
  "deno.json",
  "deno.lock",
  "Dockerfile",
  "docker-compose.yml",
  "README.md",
  "LICENSE",
  ".gitignore",
  "src/main.ts",
  "src/app.ts",
  "src/config/manager.ts",
  "src/core/logger.ts",
  "src/core/router.ts",
  "src/core/storage.ts",
  "src/core/error-handler.ts",
  "src/core/key-manager.ts",
  "src/core/prompt-optimizer.ts",
  "src/handlers/index.ts",
  "src/handlers/chat.ts",
  "src/handlers/images.ts",
  "src/handlers/edits.ts",
  "src/handlers/blend.ts",
  "src/providers/registry.ts",
  "src/providers/base.ts",
  "web/index.html",
];

/**
 * 必需的目录列表
 */
const REQUIRED_DIRECTORIES = [
  "src",
  "src/config",
  "src/core",
  "src/handlers",
  "src/providers",
  "src/middleware",
  "src/types",
  "src/utils",
  "web",
  "web/js",
  "web/css",
  "docs/介绍",
];

/**
 * 检查文件是否存在
 */
async function checkFileExists(filePath: string): Promise<CheckResult> {
  const fullPath = join(Deno.cwd(), filePath);
  const fileExists = await exists(fullPath);
  
  return {
    passed: fileExists,
    category: "文件检查",
    name: filePath,
    message: fileExists ? "文件存在" : "文件缺失",
  };
}

/**
 * 检查目录是否存在
 */
async function checkDirectoryExists(dirPath: string): Promise<CheckResult> {
  const fullPath = join(Deno.cwd(), dirPath);
  const dirExists = await exists(fullPath, { isDirectory: true });
  
  return {
    passed: dirExists,
    category: "目录检查",
    name: dirPath,
    message: dirExists ? "目录存在" : "目录缺失",
  };
}

/**
 * 检查并验证 deno.json 配置
 */
async function checkDenoConfig(): Promise<CheckResult> {
  try {
    const denoJsonPath = join(Deno.cwd(), "deno.json");
    const content = await Deno.readTextFile(denoJsonPath);
    const config = JSON.parse(content);
    
    // 检查必需的配置项
    const hasVersion = "version" in config;
    const hasImports = "imports" in config;
    const hasTasks = "tasks" in config;
    
    if (!hasVersion || !hasImports || !hasTasks) {
      return {
        passed: false,
        category: "配置验证",
        name: "deno.json",
        message: `配置不完整: version=${hasVersion}, imports=${hasImports}, tasks=${hasTasks}`,
      };
    }
    
    // 检查必需的任务
    const tasks = config.tasks as Record<string, string>;
    const hasDevTask = "dev" in tasks;
    const hasStartTask = "start" in tasks;
    
    if (!hasDevTask || !hasStartTask) {
      return {
        passed: false,
        category: "配置验证",
        name: "deno.json tasks",
        message: `缺少必需的任务: dev=${hasDevTask}, start=${hasStartTask}`,
      };
    }
    
    return {
      passed: true,
      category: "配置验证",
      name: "deno.json",
      message: `配置有效 (version: ${config.version})`,
    };
  } catch (e) {
    return {
      passed: false,
      category: "配置验证",
      name: "deno.json",
      message: `配置解析失败: ${e}`,
    };
  }
}

/**
 * 检查并验证 package imports
 */
async function checkDependencies(): Promise<CheckResult> {
  try {
    const denoJsonPath = join(Deno.cwd(), "deno.json");
    const content = await Deno.readTextFile(denoJsonPath);
    const config = JSON.parse(content);
    
    const imports = config.imports as Record<string, string>;
    const requiredDeps = [
      "@std/encoding",
      "@std/fs",
      "@std/path",
      "@std/assert",
    ];
    
    const missingDeps: string[] = [];
    for (const dep of requiredDeps) {
      if (!(dep in imports)) {
        missingDeps.push(dep);
      }
    }
    
    if (missingDeps.length > 0) {
      return {
        passed: false,
        category: "依赖检查",
        name: "deno.json imports",
        message: `缺少依赖: ${missingDeps.join(", ")}`,
      };
    }
    
    return {
      passed: true,
      category: "依赖检查",
      name: "deno.json imports",
      message: `所有必需依赖已配置 (${Object.keys(imports).length} 个依赖)`,
    };
  } catch (e) {
    return {
      passed: false,
      category: "依赖检查",
      name: "deno.json imports",
      message: `依赖检查失败: ${e}`,
    };
  }
}

/**
 * 检查 TypeScript 源文件
 */
async function checkSourceFiles(): Promise<CheckResult> {
  try {
    const srcDir = join(Deno.cwd(), "src");
    let tsFileCount = 0;
    
    for await (const entry of Deno.readDir(srcDir)) {
      if (entry.isFile && entry.name.endsWith(".ts")) {
        tsFileCount++;
      } else if (entry.isDirectory) {
        const subDir = join(srcDir, entry.name);
        for await (const subEntry of Deno.readDir(subDir)) {
          if (subEntry.isFile && subEntry.name.endsWith(".ts")) {
            tsFileCount++;
          }
        }
      }
    }
    
    if (tsFileCount === 0) {
      return {
        passed: false,
        category: "源码检查",
        name: "TypeScript 文件",
        message: "未找到任何 TypeScript 源文件",
      };
    }
    
    return {
      passed: true,
      category: "源码检查",
      name: "TypeScript 文件",
      message: `找到 ${tsFileCount} 个 TypeScript 源文件`,
    };
  } catch (e) {
    return {
      passed: false,
      category: "源码检查",
      name: "TypeScript 文件",
      message: `源码检查失败: ${e}`,
    };
  }
}

/**
 * 检查 Web 资源文件
 */
async function checkWebAssets(): Promise<CheckResult> {
  try {
    const webDir = join(Deno.cwd(), "web");
    const indexHtml = join(webDir, "index.html");
    const jsDir = join(webDir, "js");
    const cssDir = join(webDir, "css");
    
    const hasIndex = await exists(indexHtml);
    const hasJsDir = await exists(jsDir, { isDirectory: true });
    const hasCssDir = await exists(cssDir, { isDirectory: true });
    
    if (!hasIndex) {
      return {
        passed: false,
        category: "Web资源检查",
        name: "web/index.html",
        message: "缺少主页文件",
      };
    }
    
    if (!hasJsDir || !hasCssDir) {
      return {
        passed: false,
        category: "Web资源检查",
        name: "web 目录结构",
        message: `目录不完整: js=${hasJsDir}, css=${hasCssDir}`,
      };
    }
    
    return {
      passed: true,
      category: "Web资源检查",
      name: "web 资源",
      message: "Web 资源结构完整",
    };
  } catch (e) {
    return {
      passed: false,
      category: "Web资源检查",
      name: "web 资源",
      message: `Web资源检查失败: ${e}`,
    };
  }
}

/**
 * 检查 Docker 配置
 */
async function checkDockerConfig(): Promise<CheckResult> {
  try {
    const dockerfilePath = join(Deno.cwd(), "Dockerfile");
    const composeFilePath = join(Deno.cwd(), "docker-compose.yml");
    
    const dockerfileContent = await Deno.readTextFile(dockerfilePath);
    const composeContent = await Deno.readTextFile(composeFilePath);
    
    // 检查 Dockerfile 关键配置
    const hasFrom = dockerfileContent.includes("FROM");
    const hasWorkdir = dockerfileContent.includes("WORKDIR");
    const hasExpose = dockerfileContent.includes("EXPOSE");
    const hasCmd = dockerfileContent.includes("CMD");
    
    if (!hasFrom || !hasWorkdir || !hasExpose || !hasCmd) {
      return {
        passed: false,
        category: "Docker配置检查",
        name: "Dockerfile",
        message: `配置不完整: FROM=${hasFrom}, WORKDIR=${hasWorkdir}, EXPOSE=${hasExpose}, CMD=${hasCmd}`,
      };
    }
    
    // 检查 docker-compose.yml 关键配置
    const hasServices = composeContent.includes("services:");
    const hasImgRouter = composeContent.includes("img-router");
    const hasPorts = composeContent.includes("ports:");
    const hasVolumes = composeContent.includes("volumes:");
    
    if (!hasServices || !hasImgRouter || !hasPorts || !hasVolumes) {
      return {
        passed: false,
        category: "Docker配置检查",
        name: "docker-compose.yml",
        message: `配置不完整: services=${hasServices}, img-router=${hasImgRouter}, ports=${hasPorts}, volumes=${hasVolumes}`,
      };
    }
    
    return {
      passed: true,
      category: "Docker配置检查",
      name: "Docker 配置",
      message: "Docker 配置完整且有效",
    };
  } catch (e) {
    return {
      passed: false,
      category: "Docker配置检查",
      name: "Docker 配置",
      message: `Docker配置检查失败: ${e}`,
    };
  }
}

/**
 * 执行完整性检查
 */
export async function runIntegrityCheck(): Promise<IntegrityReport> {
  const results: CheckResult[] = [];
  
  // 1. 检查必需文件
  for (const file of REQUIRED_FILES) {
    const result = await checkFileExists(file);
    results.push(result);
  }
  
  // 2. 检查必需目录
  for (const dir of REQUIRED_DIRECTORIES) {
    const result = await checkDirectoryExists(dir);
    results.push(result);
  }
  
  // 3. 检查配置文件
  results.push(await checkDenoConfig());
  results.push(await checkDependencies());
  
  // 4. 检查源码
  results.push(await checkSourceFiles());
  
  // 5. 检查 Web 资源
  results.push(await checkWebAssets());
  
  // 6. 检查 Docker 配置
  results.push(await checkDockerConfig());
  
  // 统计结果
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  
  return {
    total: results.length,
    passed,
    failed,
    results,
    isHealthy: failed === 0,
  };
}

/**
 * 格式化并打印检查报告
 */
export function printIntegrityReport(report: IntegrityReport): void {
  console.log("\n" + "=".repeat(80));
  console.log("项目完整性检查报告 | Project Integrity Check Report");
  console.log("=".repeat(80) + "\n");
  
  // 按类别分组
  const categories = new Map<string, CheckResult[]>();
  for (const result of report.results) {
    if (!categories.has(result.category)) {
      categories.set(result.category, []);
    }
    categories.get(result.category)!.push(result);
  }
  
  // 打印每个类别的结果
  for (const [category, results] of categories) {
    console.log(`\n📋 ${category}:`);
    console.log("-".repeat(80));
    
    for (const result of results) {
      const icon = result.passed ? "✅" : "❌";
      const status = result.passed ? "通过" : "失败";
      console.log(`${icon} [${status}] ${result.name}`);
      if (!result.passed) {
        console.log(`   💡 ${result.message}`);
      }
    }
  }
  
  // 打印总结
  console.log("\n" + "=".repeat(80));
  console.log("📊 检查总结 | Summary");
  console.log("=".repeat(80));
  console.log(`总检查项: ${report.total}`);
  console.log(`✅ 通过: ${report.passed}`);
  console.log(`❌ 失败: ${report.failed}`);
  console.log(`\n整体状态: ${report.isHealthy ? "✅ 健康 (Healthy)" : "⚠️  需要修复 (Needs Attention)"}`);
  console.log("=".repeat(80) + "\n");
}

/**
 * 从命令行运行检查
 */
if (import.meta.main) {
  const report = await runIntegrityCheck();
  printIntegrityReport(report);
  
  // 如果检查失败，退出码为 1
  if (!report.isHealthy) {
    Deno.exit(1);
  }
}
