import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "child_process";
import WebSocket from "ws";

const SERVER_URL = "http://localhost:4444";
const WS_URL = "ws://localhost:4444/ws/agent";

let serverProc: ChildProcess;

// ===== Helper: WebSocket bağlantısı aç ve mesaj bekle =====
function connectAgent(): Promise<{
  ws: WebSocket;
  messages: any[];
  waitForMessage: (type: string, timeout?: number) => Promise<any>;
  close: () => void;
}> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const messages: any[] = [];
    const waiters: { type: string; resolve: (msg: any) => void }[] = [];

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      messages.push(msg);
      const idx = waiters.findIndex((w) => w.type === msg.type);
      if (idx !== -1) {
        const waiter = waiters.splice(idx, 1)[0];
        waiter.resolve(msg);
      }
    });

    ws.on("open", () => {
      resolve({
        ws,
        messages,
        waitForMessage(type: string, timeout = 5000) {
          const existing = messages.find((m) => m.type === type);
          if (existing) return Promise.resolve(existing);

          return new Promise((res, rej) => {
            const timer = setTimeout(
              () => rej(new Error(`Timeout: "${type}" mesajı gelmedi`)),
              timeout
            );
            waiters.push({
              type,
              resolve: (msg) => {
                clearTimeout(timer);
                res(msg);
              },
            });
          });
        },
        close() {
          ws.close();
        },
      });
    });

    ws.on("error", () => reject(new Error("WebSocket bağlantı hatası")));
    setTimeout(() => reject(new Error("WebSocket bağlantı timeout")), 5000);
  });
}

// ===== Helper =====
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(maxRetries = 30, delay = 500): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${SERVER_URL}/api/health`);
      if (res.ok) return;
    } catch {}
    await sleep(delay);
  }
  throw new Error("Server başlatılamadı!");
}

// ===== Server Lifecycle =====
beforeAll(async () => {
  console.log("🚀 Server başlatılıyor...");
  serverProc = spawn("npx", ["tsx", "src/index.ts"], {
    cwd: new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"),
    stdio: "pipe",
    shell: true,
  });
  await waitForServer();
  console.log("✅ Server hazır!");
}, 30000);

afterAll(async () => {
  console.log("🛑 Server kapatılıyor...");
  serverProc?.kill();
  await sleep(500);
  console.log("✅ Server kapatıldı.");
});

// ========================================
// REST API TESTLERİ
// ========================================
describe("REST API", () => {
  test("GET /api/health - sağlık kontrolü", async () => {
    const res = await fetch(`${SERVER_URL}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.name).toBe("Kovan Server");
  });

  test("GET /api/agents - başlangıçta boş liste", async () => {
    const res = await fetch(`${SERVER_URL}/api/agents`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.agents)).toBe(true);
    expect(data.count).toBe(0);
  });

  test("GET /api/agents/:id - olmayan agent 404", async () => {
    const res = await fetch(`${SERVER_URL}/api/agents/nonexistent`);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  test("POST /api/command - eksik body 400", async () => {
    const res = await fetch(`${SERVER_URL}/api/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  test("POST /api/command - olmayan agent 404", async () => {
    const res = await fetch(`${SERVER_URL}/api/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: "fake", command: "ls" }),
    });
    expect(res.status).toBe(404);
  });

  test("GET /api/commands - başlangıçta boş", async () => {
    const res = await fetch(`${SERVER_URL}/api/commands`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.commands)).toBe(true);
  });
});

// ========================================
// WEBSOCKET TESTLERİ
// ========================================
describe("WebSocket Agent", () => {
  test("agent bağlanıp kayıt olabilmeli", async () => {
    const agent = await connectAgent();

    agent.ws.send(
      JSON.stringify({
        type: "register",
        data: {
          hostname: "test-pardus",
          os: "Pardus GNU/Linux 23",
          username: "testuser",
          ip: "192.168.1.100",
        },
      })
    );

    const response = await agent.waitForMessage("registered");
    expect(response.type).toBe("registered");
    expect(response.agentId).toBeDefined();
    expect(typeof response.agentId).toBe("string");

    agent.close();
    await sleep(500);
  });

  test("kayıtlı agent API'da görünmeli", async () => {
    const agent = await connectAgent();

    agent.ws.send(
      JSON.stringify({
        type: "register",
        data: {
          hostname: "pardus-api-test",
          os: "Pardus GNU/Linux 23",
          username: "apiuser",
          ip: "10.0.0.50",
        },
      })
    );

    const reg = await agent.waitForMessage("registered");
    const agentId = reg.agentId;

    const res = await fetch(`${SERVER_URL}/api/agents`);
    const data = await res.json();

    const found = data.agents.find((a: any) => a.id === agentId);
    expect(found).toBeDefined();
    expect(found.hostname).toBe("pardus-api-test");
    expect(found.username).toBe("apiuser");
    expect(found.ip).toBe("10.0.0.50");
    expect(found.isOnline).toBe(true);

    agent.close();
    await sleep(500);
  });

  test("agent detay endpointi çalışmalı", async () => {
    const agent = await connectAgent();

    agent.ws.send(
      JSON.stringify({
        type: "register",
        data: {
          hostname: "pardus-detail",
          os: "Pardus 23.1",
          username: "detailuser",
          ip: "172.16.0.1",
        },
      })
    );

    const reg = await agent.waitForMessage("registered");

    const res = await fetch(`${SERVER_URL}/api/agents/${reg.agentId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.agent.id).toBe(reg.agentId);
    expect(data.agent.hostname).toBe("pardus-detail");

    agent.close();
    await sleep(500);
  });

  test("heartbeat lastSeen güncellenmeli", async () => {
    const agent = await connectAgent();

    agent.ws.send(
      JSON.stringify({
        type: "register",
        data: {
          hostname: "pardus-heartbeat",
          os: "Pardus 23",
          username: "hbuser",
          ip: "10.0.0.99",
        },
      })
    );

    const reg = await agent.waitForMessage("registered");
    const agentId = reg.agentId;

    let res = await fetch(`${SERVER_URL}/api/agents/${agentId}`);
    let data = await res.json();
    const firstSeen = data.agent.lastSeen;

    await sleep(1100);

    agent.ws.send(JSON.stringify({ type: "heartbeat", agentId }));
    await sleep(500);

    res = await fetch(`${SERVER_URL}/api/agents/${agentId}`);
    data = await res.json();
    const updatedSeen = data.agent.lastSeen;

    expect(new Date(updatedSeen).getTime()).toBeGreaterThan(
      new Date(firstSeen).getTime()
    );

    agent.close();
    await sleep(500);
  });

  test("agent bağlantısı kapanınca offline olmalı", async () => {
    const agent = await connectAgent();

    agent.ws.send(
      JSON.stringify({
        type: "register",
        data: {
          hostname: "pardus-offline",
          os: "Pardus 23",
          username: "offuser",
          ip: "10.0.0.77",
        },
      })
    );

    const reg = await agent.waitForMessage("registered");
    const agentId = reg.agentId;

    let res = await fetch(`${SERVER_URL}/api/agents/${agentId}`);
    let data = await res.json();
    expect(data.agent.isOnline).toBe(true);

    agent.close();
    await sleep(1000);

    res = await fetch(`${SERVER_URL}/api/agents/${agentId}`);
    data = await res.json();
    expect(data.agent.isOnline).toBe(false);
  });
});

// ========================================
// KOMUT GÖNDERME VE SONUÇ TESTLERİ
// ========================================
describe("Command Execution", () => {
  test("agent'a komut gönderilip sonuç alınmalı", async () => {
    const agent = await connectAgent();

    agent.ws.send(
      JSON.stringify({
        type: "register",
        data: {
          hostname: "pardus-cmd",
          os: "Pardus 23",
          username: "cmduser",
          ip: "10.0.0.33",
        },
      })
    );

    const reg = await agent.waitForMessage("registered");
    const agentId = reg.agentId;

    const cmdRes = await fetch(`${SERVER_URL}/api/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: agentId, command: "whoami" }),
    });

    expect(cmdRes.status).toBe(200);
    const cmdData = await cmdRes.json();
    expect(cmdData.success).toBe(true);
    expect(cmdData.command.command).toBe("whoami");
    const commandId = cmdData.command.id;

    const cmdMsg = await agent.waitForMessage("command");
    expect(cmdMsg.type).toBe("command");
    expect(cmdMsg.data.command).toBe("whoami");
    expect(cmdMsg.data.commandId).toBe(commandId);

    // Agent sonuç gönder
    agent.ws.send(
      JSON.stringify({
        type: "result",
        agentId,
        data: { commandId, output: "cmduser" },
      })
    );

    await sleep(500);

    const histRes = await fetch(`${SERVER_URL}/api/agents/${agentId}/commands`);
    const histData = await histRes.json();
    const cmd = histData.commands.find((c: any) => c.id === commandId);
    expect(cmd).toBeDefined();
    expect(cmd.status).toBe("completed");
    expect(cmd.output).toBe("cmduser");
    expect(cmd.doneAt).toBeDefined();

    agent.close();
    await sleep(500);
  });

  test("hatalı komut sonucu error status olmalı", async () => {
    const agent = await connectAgent();

    agent.ws.send(
      JSON.stringify({
        type: "register",
        data: {
          hostname: "pardus-err",
          os: "Pardus 23",
          username: "erruser",
          ip: "10.0.0.44",
        },
      })
    );

    const reg = await agent.waitForMessage("registered");
    const agentId = reg.agentId;

    const cmdRes = await fetch(`${SERVER_URL}/api/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: agentId, command: "cat /nonexistent" }),
    });

    const cmdData = await cmdRes.json();
    const commandId = cmdData.command.id;

    await agent.waitForMessage("command");

    agent.ws.send(
      JSON.stringify({
        type: "result",
        agentId,
        data: {
          commandId,
          output: "",
          error: "cat: /nonexistent: No such file or directory",
        },
      })
    );

    await sleep(500);

    const histRes = await fetch(`${SERVER_URL}/api/agents/${agentId}/commands`);
    const histData = await histRes.json();
    const cmd = histData.commands.find((c: any) => c.id === commandId);
    expect(cmd.status).toBe("error");
    expect(cmd.output).toContain("No such file or directory");

    agent.close();
    await sleep(500);
  });

  test("offline agent'a komut gönderilemez", async () => {
    const agent = await connectAgent();

    agent.ws.send(
      JSON.stringify({
        type: "register",
        data: {
          hostname: "pardus-off-cmd",
          os: "Pardus 23",
          username: "offcmduser",
          ip: "10.0.0.88",
        },
      })
    );

    const reg = await agent.waitForMessage("registered");
    const agentId = reg.agentId;

    agent.close();
    await sleep(1000);

    const cmdRes = await fetch(`${SERVER_URL}/api/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: agentId, command: "ls" }),
    });

    expect(cmdRes.status).toBe(400);
    const data = await cmdRes.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("çevrimdışı");
  });

  test("birden fazla komut geçmişi tutulmalı", async () => {
    const agent = await connectAgent();

    agent.ws.send(
      JSON.stringify({
        type: "register",
        data: {
          hostname: "pardus-multi",
          os: "Pardus 23",
          username: "multiuser",
          ip: "10.0.0.55",
        },
      })
    );

    const reg = await agent.waitForMessage("registered");
    const agentId = reg.agentId;

    const commands = ["uname -a", "whoami", "pwd"];
    for (const cmd of commands) {
      const res = await fetch(`${SERVER_URL}/api/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId, command: cmd }),
      });

      const data = await res.json();
      await agent.waitForMessage("command");

      agent.ws.send(
        JSON.stringify({
          type: "result",
          agentId,
          data: {
            commandId: data.command.id,
            output: `output of ${cmd}`,
          },
        })
      );
      await sleep(300);
    }

    const histRes = await fetch(`${SERVER_URL}/api/agents/${agentId}/commands`);
    const histData = await histRes.json();
    expect(histData.count).toBe(3);
    expect(
      histData.commands.every((c: any) => c.status === "completed")
    ).toBe(true);

    agent.close();
    await sleep(500);
  });
});
