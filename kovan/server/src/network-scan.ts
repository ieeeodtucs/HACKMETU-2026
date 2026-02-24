/**
 * Network Anomaly Scan
 *
 * Agent'tan gelen `ss -tnpi` çıktısını parse eder,
 * her bağlantıyı ATTDAP'ın beklediği 26 feature'a map'ler,
 * ATTDAP API'ye /batch-score ile gönderir.
 */

import { store, type NetworkScanResult, type NetworkConnection } from "./store.js";

// ATTDAP API base URL (aynı makinede veya remote)
const ATTDAP_API = process.env.ATTDAP_API || "http://localhost:8000";

// ===== ss -tnpi output parser =====
// Örnek ss -tnpi çıktısı:
// State    Recv-Q Send-Q  Local Address:Port   Peer Address:Port  Process
// ESTAB    0      0       192.168.1.5:43210    93.184.216.34:443  users:(("firefox",pid=1234,fd=45))
//          cubic wscale:7,7 rto:204 rtt:12.5/6.25 ato:40 mss:1448 pmtu:1500
//          cwnd:10 bytes_sent:15234 bytes_acked:15234 bytes_received:52341
//          segs_out:42 segs_in:38 data_segs_out:20 data_segs_in:35 send 9.26Mbps

interface ParsedConnection {
  state: string;
  local_ip: string;
  local_port: number;
  peer_ip: string;
  peer_port: number;
  process: string;
  pid: number | null;
  // ss -i istatistikleri
  bytes_sent: number;
  bytes_received: number;
  segs_out: number;
  segs_in: number;
  data_segs_out: number;
  data_segs_in: number;
  rtt: number;          // ms
  rtt_var: number;      // ms
  mss: number;
  cwnd: number;
  wscale_snd: number;
  wscale_rcv: number;
  send_rate: number;    // bytes/sec
  retrans: number;
}

function parseSsOutput(raw: string): ParsedConnection[] {
  const connections: ParsedConnection[] = [];
  const lines = raw.split("\n");

  let current: Partial<ParsedConnection> | null = null;
  let infoLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Yeni bağlantı satırı (State ile başlar veya ESTAB/SYN-SENT/... pattern)
    const connMatch = line.match(
      /^(ESTAB|SYN-SENT|SYN-RECV|FIN-WAIT-1|FIN-WAIT-2|TIME-WAIT|CLOSE-WAIT|LAST-ACK|LISTEN|CLOSING|CLOSE)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s*(.*)/
    );

    if (connMatch) {
      // Önceki bağlantıyı finalize et
      if (current) {
        connections.push(finalizeConnection(current, infoLines));
      }

      const [, state, , , localAddr, peerAddr, processStr] = connMatch;

      // Adresi parse et (IPv4 ve IPv6 desteği)
      const local = parseAddress(localAddr);
      const peer = parseAddress(peerAddr);

      // Process bilgisi: users:(("firefox",pid=1234,fd=45))
      let process = "";
      let pid: number | null = null;
      const procMatch = processStr.match(/\("([^"]+)",pid=(\d+)/);
      if (procMatch) {
        process = procMatch[1];
        pid = parseInt(procMatch[2]);
      }

      current = {
        state,
        local_ip: local.ip,
        local_port: local.port,
        peer_ip: peer.ip,
        peer_port: peer.port,
        process,
        pid,
      };
      infoLines = [];
    } else if (current && line.match(/^\s+/)) {
      // İstatistik satırı (indentli)
      infoLines.push(line.trim());
    }
  }

  // Son bağlantıyı ekle
  if (current) {
    connections.push(finalizeConnection(current, infoLines));
  }

  return connections;
}

function parseAddress(addr: string): { ip: string; port: number } {
  // IPv6: [::1]:443 veya [fe80::1%eth0]:80
  // IPv4: 192.168.1.5:443
  // IPv4-mapped IPv6: [::ffff:192.168.1.5]:443
  const ipv6Match = addr.match(/^\[(.+)\]:(\d+)$/);
  if (ipv6Match) {
    return { ip: ipv6Match[1], port: parseInt(ipv6Match[2]) };
  }
  const lastColon = addr.lastIndexOf(":");
  if (lastColon === -1) return { ip: addr, port: 0 };
  return {
    ip: addr.slice(0, lastColon),
    port: parseInt(addr.slice(lastColon + 1)) || 0,
  };
}

function finalizeConnection(partial: Partial<ParsedConnection>, infoLines: string[]): ParsedConnection {
  const info = infoLines.join(" ");

  // Parse ss -i fields
  const getNum = (key: string): number => {
    const m = info.match(new RegExp(`${key}:(\\d+\\.?\\d*)`));
    return m ? parseFloat(m[1]) : 0;
  };

  const rttMatch = info.match(/rtt:(\d+\.?\d*)\/(\d+\.?\d*)/);
  const wscaleMatch = info.match(/wscale:(\d+),(\d+)/);

  // send rate: "send 9.26Mbps" veya "send 1234bps" veya "send 1.5Kbps"
  let sendRate = 0;
  const sendMatch = info.match(/send\s+(\d+\.?\d*)(bps|Kbps|Mbps|Gbps)/);
  if (sendMatch) {
    const val = parseFloat(sendMatch[1]);
    const unit = sendMatch[2];
    switch (unit) {
      case "bps": sendRate = val / 8; break;
      case "Kbps": sendRate = (val * 1000) / 8; break;
      case "Mbps": sendRate = (val * 1_000_000) / 8; break;
      case "Gbps": sendRate = (val * 1_000_000_000) / 8; break;
    }
  }

  // retrans: "retrans:0/3" veya "retrans:2"
  let retrans = 0;
  const retransMatch = info.match(/retrans:(\d+)/);
  if (retransMatch) retrans = parseInt(retransMatch[1]);

  return {
    state: partial.state || "UNKNOWN",
    local_ip: partial.local_ip || "",
    local_port: partial.local_port || 0,
    peer_ip: partial.peer_ip || "",
    peer_port: partial.peer_port || 0,
    process: partial.process || "",
    pid: partial.pid || null,
    bytes_sent: getNum("bytes_sent"),
    bytes_received: getNum("bytes_received"),
    segs_out: getNum("segs_out"),
    segs_in: getNum("segs_in"),
    data_segs_out: getNum("data_segs_out"),
    data_segs_in: getNum("data_segs_in"),
    rtt: rttMatch ? parseFloat(rttMatch[1]) : 0,
    rtt_var: rttMatch ? parseFloat(rttMatch[2]) : 0,
    mss: getNum("mss"),
    cwnd: getNum("cwnd"),
    wscale_snd: wscaleMatch ? parseInt(wscaleMatch[1]) : 0,
    wscale_rcv: wscaleMatch ? parseInt(wscaleMatch[2]) : 0,
    send_rate: sendRate,
    retrans,
  };
}

// ===== Map ss connection → ATTDAP 26 features =====
//
// CICIDS2017/UNSW-NB15 flow verileriyle eğitilmiş modele uyumlu feature üretimi.
// Eğitim verisi 99. percentile aralıkları referans alınır.
//
function connectionToFeatures(conn: ParsedConnection): Record<string, number> {
  const bytesSent = conn.bytes_sent || 1;
  const bytesRecv = conn.bytes_received || 1;
  const segsOut = conn.segs_out || 1;
  const segsIn = conn.segs_in || 1;
  const rttSec = (conn.rtt || 50) / 1000; // ms → sec, default 50ms

  // Flow duration tahmini: (toplam segment * ortalama RTT) → microseconds
  const totalSegs = segsOut + segsIn;
  const flowDuration = totalSegs * conn.rtt * 1000;

  // Bytes per second
  const totalBytes = bytesSent + bytesRecv;
  const flowBytesPerSec = rttSec > 0 ? totalBytes / (totalSegs * rttSec) : conn.send_rate || 0;
  const flowPacketsPerSec = rttSec > 0 ? totalSegs / (totalSegs * rttSec) : 0;

  // Packet length means
  const fwdPktLenMean = segsOut > 0 ? bytesSent / segsOut : 0;
  const bwdPktLenMean = segsIn > 0 ? bytesRecv / segsIn : 0;

  // Inter-arrival time mean (microseconds)
  const fwdIatMean = segsOut > 1 ? (flowDuration / (segsOut - 1)) : flowDuration;
  const bwdIatMean = segsIn > 1 ? (flowDuration / (segsIn - 1)) : flowDuration;

  // TCP flags — CICIDS her flow'un başında SYN/ACK sayar, ss snapshot'tan tahmin ediyoruz
  // Eğitim verisinde ESTAB flow'larda bile syn=1 olur (initial handshake), 0 göndermek aşırı outlier yapar
  const synCount = conn.state === "SYN-SENT" || conn.state === "SYN-RECV" ? 2 : 1; // Her TCP flow en az 1 SYN içerir
  const rstCount = conn.retrans > 3 ? Math.min(conn.retrans, 10) : 0;
  const pshCount = conn.data_segs_out || Math.max(1, Math.floor(segsOut * 0.6)); // PSH ≈ data segment oranı
  const ackCount = totalSegs; // Neredeyse her segment ACK taşır

  // init_win_bytes — CICIDS'te 0-65535 aralığında (16-bit TCP window)
  // wscale sonrası değer değil, ham TCP header'daki window field
  const initWinFwd = Math.min(conn.mss > 0 ? conn.mss * 44 : 29200, 65535);  // Tipik Linux default: ~29200
  const initWinBwd = Math.min(conn.mss > 0 ? conn.mss * 44 : 29200, 65535);

  // Down/up ratio
  const downUpRatio = bytesSent > 0 ? bytesRecv / bytesSent : 0;

  // fwd/bwd_header_length — CICIDS'te toplam header byte (her paket ~20-32 byte TCP header)
  const fwdHeaderLen = segsOut * 32;
  const bwdHeaderLen = segsIn * 32;

  return {
    flow_duration: flowDuration,
    total_fwd_packets: segsOut,
    total_bwd_packets: segsIn,
    fwd_packet_length_mean: fwdPktLenMean,
    bwd_packet_length_mean: bwdPktLenMean,
    flow_bytes_per_sec: flowBytesPerSec,
    flow_packets_per_sec: flowPacketsPerSec,
    fwd_iat_mean: fwdIatMean,
    bwd_iat_mean: bwdIatMean,
    active_mean: flowDuration * 0.7,
    syn_flag_count: synCount,
    rst_flag_count: rstCount,
    psh_flag_count: pshCount,
    ack_flag_count: ackCount,
    fwd_header_length: fwdHeaderLen,
    bwd_header_length: bwdHeaderLen,
    avg_fwd_segment_size: fwdPktLenMean,
    avg_bwd_segment_size: bwdPktLenMean,
    bwd_packets_per_sec: rttSec > 0 ? segsIn / (totalSegs * rttSec) : 0,
    down_up_ratio: downUpRatio,
    avg_packet_size: totalSegs > 0 ? totalBytes / totalSegs : 0,
    init_win_bytes_forward: initWinFwd,
    init_win_bytes_backward: initWinBwd,
    subflow_fwd_packets: segsOut,
    subflow_fwd_bytes: bytesSent,
    subflow_bwd_packets: segsIn,
  };
}

// ===== ATTDAP API çağrısı =====
interface AttdapScore {
  if_score: number;
  ae_score: number;
  gmm_score: number;
  hybrid_score: number;
  risk_level: string;
  feature_contributions: Record<string, number>;
}

interface AttdapBatchResponse {
  scores: AttdapScore[];
  summary: {
    total_events: number;
    mean_score: number;
    max_score: number;
    min_score: number;
    risk_distribution: Record<string, number>;
  };
}

async function callAttdapBatchScore(
  events: Record<string, any>[]
): Promise<AttdapBatchResponse | null> {
  try {
    console.log(`[ATTDAP] Sending ${events.length} events to batch-score...`);
    const res = await fetch(`${ATTDAP_API}/batch-score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
    });

    if (!res.ok) {
      console.error(`[ATTDAP] API error: ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.error(`[ATTDAP] Response: ${text}`);
      return null;
    }

    return await res.json() as AttdapBatchResponse;
  } catch (err: any) {
    console.error(`[ATTDAP] Connection error: ${err.message}`);
    return null;
  }
}

// ===== Ana scan fonksiyonu =====
export async function performNetworkScan(
  agentId: string,
  ssOutput: string
): Promise<NetworkScanResult> {
  const startedAt = new Date().toISOString();

  // Scanning durumunu hemen kaydet
  store.setNetworkScan(agentId, {
    agentId,
    status: "scanning",
    startedAt,
    connections: [],
    summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, mean_score: 0, max_score: 0 },
  });

  try {
    // 1. ss çıktısını parse et
    const parsed = parseSsOutput(ssOutput);
    console.log(`[NETWORK] ${parsed.length} bağlantı parse edildi`);

    if (parsed.length === 0) {
      const result: NetworkScanResult = {
        agentId,
        status: "completed",
        startedAt,
        completedAt: new Date().toISOString(),
        connections: [],
        summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, mean_score: 0, max_score: 0 },
      };
      store.setNetworkScan(agentId, result);
      return result;
    }

    // LISTEN state olanları filtrele — sadece aktif bağlantıları analiz et
    const activeConns = parsed.filter((c) => c.state !== "LISTEN");

    // 2. Her bağlantıyı 26 feature'a dönüştür + metadata ekle
    const events = activeConns.map((conn) => {
      const features = connectionToFeatures(conn);
      return {
        ...features,
        source_ip: conn.local_ip,
        dest_ip: conn.peer_ip,
        source_port: conn.local_port,
        dest_port: conn.peer_port,
        protocol: 6, // TCP
      };
    });

    // 3. ATTDAP API'ye gönder
    let attdapResult: AttdapBatchResponse | null = null;
    if (events.length > 0) {
      attdapResult = await callAttdapBatchScore(events);
    }

    // 4. Sonuçları birleştir
    const connections: NetworkConnection[] = activeConns.map((conn, i) => {
      const score = attdapResult?.scores[i];
      return {
        source_ip: conn.local_ip,
        source_port: conn.local_port,
        dest_ip: conn.peer_ip,
        dest_port: conn.peer_port,
        state: conn.state,
        process: conn.process,
        pid: conn.pid,
        hybrid_score: score?.hybrid_score ?? 0,
        risk_level: score?.risk_level ?? "unknown",
        if_score: score?.if_score ?? 0,
        ae_score: score?.ae_score ?? 0,
        gmm_score: score?.gmm_score ?? 0,
        bytes_sent: conn.bytes_sent,
        bytes_received: conn.bytes_received,
        segs_out: conn.segs_out,
        segs_in: conn.segs_in,
        rtt: conn.rtt,
      };
    });

    // Risk dağılımı
    const riskCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const c of connections) {
      if (c.risk_level in riskCounts) {
        riskCounts[c.risk_level as keyof typeof riskCounts]++;
      }
    }

    const scores = connections.map((c) => c.hybrid_score);
    const meanScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

    // Yüksek riskten düşüğe sırala
    connections.sort((a, b) => b.hybrid_score - a.hybrid_score);

    const result: NetworkScanResult = {
      agentId,
      status: "completed",
      startedAt,
      completedAt: new Date().toISOString(),
      connections,
      summary: {
        total: connections.length,
        ...riskCounts,
        mean_score: Math.round(meanScore * 10) / 10,
        max_score: Math.round(maxScore * 10) / 10,
      },
    };

    store.setNetworkScan(agentId, result);
    return result;
  } catch (err: any) {
    const errorResult: NetworkScanResult = {
      agentId,
      status: "error",
      startedAt,
      completedAt: new Date().toISOString(),
      error: err.message || "Network scan failed",
      connections: [],
      summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, mean_score: 0, max_score: 0 },
    };
    store.setNetworkScan(agentId, errorResult);
    return errorResult;
  }
}
