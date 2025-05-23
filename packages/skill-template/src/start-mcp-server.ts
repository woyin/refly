import { SkillEngine } from './engine';
import { createAndStartReflyMcpServer, LogLevel } from './mcp';

/**
 * This script starts the Refly MCP server for testing purposes
 */
async function startMcpServer() {
  console.log('启动 Refly MCP 服务器...');

  // 创建一个简单的日志记录器
  const mockLogger = {
    error: console.error,
    log: console.log,
    warn: console.warn,
    debug: console.debug,
  };

  // 创建默认用户
  const defaultUser = {
    uid: 'test-user',
    email: 'test@example.com',
  };

  try {
    // 创建一个 SkillEngine 实例来获取 ReflyService
    const engine = new SkillEngine(mockLogger, null);

    // 检查 ReflyService 是否可用
    if (!engine.service) {
      console.error('ReflyService 不可用。请确保服务已正确初始化。');
      return;
    }

    // 创建并启动 MCP 服务器
    const server = await createAndStartReflyMcpServer(engine.service, defaultUser, {
      name: 'ReflyServiceMCP',
      version: '1.0.0',
      description: 'Refly Service MCP Server for testing',
      logLevel: LogLevel.DEBUG,
      port: 3000,
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    console.log('Refly MCP 服务器启动成功！');
    console.log('服务器运行在 http://localhost:3000/sse');
    console.log('你可以使用 MCP Inspector 进行测试：');
    console.log('npx @modelcontextprotocol/inspector http://localhost:3000/sse');

    // 保持进程运行
    process.on('SIGINT', async () => {
      console.log('正在停止服务器...');
      await server.stop();
      process.exit(0);
    });

    console.log('按 Ctrl+C 停止服务器');
  } catch (error) {
    console.error('启动 MCP 服务器失败:', error);
  }
}

// 启动服务器
startMcpServer().catch(console.error);
