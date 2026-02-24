import { useState, useEffect, useCallback } from "react";
import {
  CaretLeft,
  CaretRight,
  ShieldCheck,
  Warning,
  Bug,
  WifiHigh,
  TerminalWindow,
  ChartLineUp,
  Database,
  Lightning,
  Users,
  Lock,
  Eye,
  Cube,
  GearSix,
  Clock,
  Rocket,
  Target,
  TrendUp,
  TrendDown,
  Crosshair,
  Brain,
  TreeStructure,
  Desktop,
  CloudArrowUp,
  Monitor,
  MagnifyingGlass,
  Folder,
  ArrowsClockwise,
  CircleWavyCheckIcon,
  Broadcast,
  Skull,
  Graph,
  Table,
  FlowArrow,
  Package,
  MapPin,
  Code,
  Globe,
  Plugs,
  FilePy,
  Timer,
  FilmStrip,
  HardDrives,
  Robot,
  CornersOut,
  CornersIn,
} from "@phosphor-icons/react";

import ArchitectureDiagram from "./diagrams/ArchitectureDiagram";
import AnomalyDiagram from "./diagrams/AnomalyDiagram";
import DataModelDiagram from "./diagrams/DataModelDiagram";
import ParticleNetwork from "./ParticleNetwork";

/* ════════════════════════════════════════════ */
/*  SLIDES                                     */
/* ════════════════════════════════════════════ */

const slides: React.FC[] = [
  /* ─── 0 : Giriş ─── */
  () => (
    <div className="pres-slide slide-hero">
      <div className="slide-hero-bg" />
      <ParticleNetwork color="255, 203, 8" particleCount={50} maxDist={150} opacity={0.4} />
      <div className="slide-hero-content">
        <div className="event-badge">
          <Rocket size={14} weight="fill" /> HackMETU 2026
        </div>
        <img src="/assets/kovan-icon.svg" alt="Kovan" className="logo-big" />
        <p className="hero-tagline">Akıllı Tehdit Tespit ve Davranış Analizi Platformu</p>
        <h1>
          <span className="accent">Uçtan Uca</span> Siber Güvenlik
          <br />
          İzle, Tespit Et, Müdahale Et
        </h1>
        <p className="subtitle">
          Tek panel. Tüm cihazlar. Anlık müdahale.
        </p>
      </div>
    </div>
  ),

  /* ─── 1 : Takım ─── */
  () => (
    <div className="pres-slide slide-dark">
      <ParticleNetwork color="255, 203, 8" particleCount={35} maxDist={130} opacity={0.25} />
      <div className="slide-header">
        <span className="slide-pill slide-pill--glass">
          <Users size={14} weight="fill" /> Ekibimiz
        </span>
        <h2>
          <span className="accent">Kovan</span> Takımı
        </h2>
      </div>
      <div className="team-grid">
        {[
          { name: "Barış Cem Bayburtlu", role: "Full-Stack / Takım Lideri", initials: "BB" },
          { name: "Batuhan Bayazıt", role: "Backend / DevOps", initials: "BB" },
          { name: "Burak Aydoğmuş", role: "Go Agent / Sistem", initials: "BA" },
          { name: "Mustafa Yusuf Onur", role: "Frontend / UX", initials: "MO" },
          { name: "Mehmet Ali Selvet", role: "ML / Anomali Modeli", initials: "MS" },
        ].map((m) => (
          <div className="team-card" key={m.name}>
            <div className="team-avatar">{m.initials}</div>
            <div className="team-name">{m.name}</div>
            <div className="team-role">{m.role}</div>
          </div>
        ))}
      </div>
    </div>
  ),

  /* ─── 2 : Karşılaşılan Sorunlar ─── */
  () => (
    <div className="pres-slide slide-dark">
      <ParticleNetwork color="255, 203, 8" particleCount={35} maxDist={130} opacity={0.2} />
      <div className="slide-header">
        <span className="slide-pill slide-pill--glass">
          <Warning size={14} weight="fill" /> Problemler
        </span>
        <h2>
          Karşılaşılan <span className="accent">Sorunlar</span>
        </h2>
      </div>
      <div className="card-grid card-grid-2">
        {[
          { icon: <Desktop size={22} weight="duotone" />, title: "Dağınık Cihaz Yönetimi", desc: "Yüzlerce uç nokta, merkezi görünürlük yok." },
          { icon: <Bug size={22} weight="duotone" />, title: "Zafiyet Takip Eksikliği", desc: "CVE'ler takip edilmiyor, açıklar tespit edilemiyor." },
          { icon: <WifiHigh size={22} weight="duotone" />, title: "Ağ Anomali Tespiti", desc: "Anormal trafik manuel tespit — geç kalınıyor." },
          { icon: <Lock size={22} weight="duotone" />, title: "Yetki & Erişim Kontrolü", desc: "Kim hangi cihaza erişebilir? Kontrol yok." },
          { icon: <GearSix size={22} weight="duotone" />, title: "Otomasyon Eksikliği", desc: "Güncelleme, tarama — hepsi manuel." },
          { icon: <Skull size={22} weight="duotone" />, title: "Tehdit Görünürlüğü", desc: "Saldırı yüzeyleri bilinmiyor, tehditler algılanamıyor." },
        ].map((p, i) => (
          <div className="problem-item" key={i}>
            <div className="problem-icon">{p.icon}</div>
            <div>
              <h4>{p.title}</h4>
              <p>{p.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  ),

  /* ─── 3 : Neden Bunlar Bir Sorun ─── */
  () => (
    <div className="pres-slide slide-light">
      <ParticleNetwork color="35, 31, 32" particleCount={30} maxDist={120} opacity={0.08} />
      <div className="slide-header">
        <span className="slide-pill slide-pill--yellow">
          <Target size={14} weight="fill" /> Etki Analizi
        </span>
        <h2>
          Neden Bunlar Bir <span className="accent">Sorun</span>?
        </h2>
      </div>
      <div className="card-grid card-grid-3">
        <div className="card-yellow">
          <div className="card-icon"><Skull size={24} weight="bold" /></div>
          <div className="stat-value">%68</div>
          <div className="stat-label">Saldırı artışı (2024-2025)</div>
          <p style={{ marginTop: 12 }}>
            Kamu kurumları hedefte.
          </p>
        </div>
        <div className="card">
          <div className="card-icon card-icon--red"><Clock size={24} weight="bold" /></div>
          <h3>Ortalama 207 Gün</h3>
          <p>Veri ihlali tespit süresi. Erken algılama kritik.</p>
        </div>
        <div className="card">
          <div className="card-icon card-icon--blue"><TrendUp size={24} weight="bold" /></div>
          <h3>$4.45M</h3>
          <p>Ortalama veri ihlali maliyeti (IBM 2024).</p>
        </div>
        <div className="card span-2">
          <div className="card-icon card-icon--amber"><ShieldCheck size={24} weight="bold" /></div>
          <h3>Pardus Ekosistemi Büyüyor</h3>
          <p>
            Güvenlik araç ekosistemi henüz olgunlaşmadı. Yerli çözüm ihtiyacı açık.
          </p>
        </div>
        <div className="card">
          <div className="card-icon card-icon--purple"><Users size={24} weight="bold" /></div>
          <h3>İnsan Hatası</h3>
          <p>Olayların %74'ü insan kaynaklı. Otomasyon şart.</p>
        </div>
      </div>
    </div>
  ),

  /* ─── 4 : Kovan Nedir ─── */
  () => (
    <div className="pres-slide slide-dark">
      <ParticleNetwork color="255, 203, 8" particleCount={35} maxDist={130} opacity={0.2} />
      <div className="slide-header">
        <span className="slide-pill slide-pill--glass">
          <Cube size={14} weight="fill" /> Platform
        </span>
        <h2>
          <span className="accent">Kovan</span> Nedir?
        </h2>
        <p className="slide-desc">
          Pardus için açık kaynak uç nokta güvenlik platformu.
        </p>
      </div>
      <div className="card-grid card-grid-3">
        {[
          { icon: <TerminalWindow size={22} weight="bold" />, title: "Uzaktan Komut", desc: "Anlık komut gönder, çıktıyı canlı izle." },
          { icon: <Bug size={22} weight="bold" />, title: "CVE Tarama", desc: "47K+ CVE ile paketleri anında tara." },
          { icon: <ChartLineUp size={22} weight="bold" />, title: "Anomali Tespiti", desc: "3 ML model, ağ trafiğini risk puanıyla skorla." },
          { icon: <WifiHigh size={22} weight="bold" />, title: "Ağ Keşfi", desc: "Cihazları keşfet, portları haritalandır." },
          { icon: <Folder size={22} weight="bold" />, title: "Dosya Yöneticisi", desc: "Uzak dosya sistemi: indir, yükle, sil." },
          { icon: <Clock size={22} weight="bold" />, title: "Zamanlanmış Görevler", desc: "Cron bazlı otomasyon, grup hedefleme." },
        ].map((c, i) => (
          <div className="card-dark" key={i}>
            <div className="card-icon">{c.icon}</div>
            <h3>{c.title}</h3>
            <p>{c.desc}</p>
          </div>
        ))}
      </div>
    </div>
  ),

  /* ─── 5 : Neden Kovan ─── */
  () => (
    <div className="pres-slide slide-light">
      <ParticleNetwork color="35, 31, 32" particleCount={30} maxDist={120} opacity={0.08} />
      <div className="slide-header">
        <span className="slide-pill slide-pill--yellow">
          <Lightning size={14} weight="fill" /> Avantajlar
        </span>
        <h2>
          Neden <span className="accent">Kovan</span> Kullanmalıyız?
        </h2>
      </div>
      <div className="two-col">
        <div className="solution-list">
          <div className="solution-item">
            <div className="solution-icon"><Cube size={22} weight="bold" /></div>
            <div>
              <h4>Tek Platform, Tüm Araçlar</h4>
              <p>Komut, zafiyet, anomali, dosya — hepsi tek panelde.</p>
            </div>
          </div>
          <div className="solution-item">
            <div className="solution-icon"><Desktop size={22} weight="bold" /></div>
            <div>
              <h4>Pardus-Odaklı</h4>
              <p>Pardus/Debian'a özel. dpkg entegrasyonu, yerli CVE taraması.</p>
            </div>
          </div>
          <div className="solution-item">
            <div className="solution-icon"><Lock size={22} weight="bold" /></div>
            <div>
              <h4>Rol Tabanlı Erişim</h4>
              <p>Agent bazlı yetkilendirme. Kim neyi görür — tam kontrol.</p>
            </div>
          </div>
        </div>
        <div className="solution-list">
          <div className="solution-item">
            <div className="solution-icon"><Brain size={22} weight="bold" /></div>
            <div>
              <h4>ML Destekli Anomali</h4>
              <p>IF + GMM + Autoencoder. %90+ AUC-ROC.</p>
            </div>
          </div>
          <div className="solution-item">
            <div className="solution-icon"><ArrowsClockwise size={22} weight="bold" /></div>
            <div>
              <h4>Otomasyon</h4>
              <p>Zamanlanmış görevler, broadcast, otomatik tarama.</p>
            </div>
          </div>
          <div className="solution-item">
            <div className="solution-icon"><Package size={22} weight="bold" /></div>
            <div>
              <h4>Hafif Agent</h4>
              <p>~5.5MB Go binary. Bağımlılık yok, cross-platform.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),

  /* ─── 6 : Ürettiğimiz Çözümler ─── */
  () => (
    <div className="pres-slide slide-dark">
      <ParticleNetwork color="255, 203, 8" particleCount={35} maxDist={130} opacity={0.2} />
      <div className="slide-header">
        <span className="slide-pill slide-pill--glass">
          <CircleWavyCheckIcon size={14} weight="fill" /> Çözümler
        </span>
        <h2>
          Ürettiğimiz <span className="accent">Çözümler</span>
        </h2>
      </div>
      <div className="card-grid card-grid-2">
        <div className="card-dark">
          <div className="card-icon"><TerminalWindow size={22} weight="bold" /></div>
          <h3>Merkezi Komut & Kontrol</h3>
          <p>WebSocket ile anlık çift yönlü iletişim. Otomatik reconnect.</p>
          <div className="feature-tags">
            <span className="feature-tag feature-tag--yellow">WebSocket</span>
            <span className="feature-tag feature-tag--green">Real-time</span>
          </div>
        </div>
        <div className="card-dark">
          <div className="card-icon"><MagnifyingGlass size={22} weight="bold" /></div>
          <h3>CVE Tarama Motoru</h3>
          <p>47K+ CVE, dpkg parse, paket-CVE eşleştirme. Fuzzy search.</p>
          <div className="feature-tags">
            <span className="feature-tag feature-tag--blue">47K+ CVE</span>
            <span className="feature-tag feature-tag--yellow">pg_trgm</span>
          </div>
        </div>
        <div className="card-dark">
          <div className="card-icon"><Brain size={22} weight="bold" /></div>
          <h3>ATTDAP Anomali Modeli</h3>
          <p>IF + AE + GMM ensemble. CICIDS2017 + UNSW-NB15. 0-100 risk skoru.</p>
          <div className="feature-tags">
            <span className="feature-tag feature-tag--green">F1=0.80</span>
            <span className="feature-tag feature-tag--blue">AUC=0.91</span>
          </div>
        </div>
        <div className="card-dark">
          <div className="card-icon"><Monitor size={22} weight="bold" /></div>
          <h3>Ekran & Tuş İzleme</h3>
          <p>Ekran yakalama + keylogger. Red team senaryoları.</p>
          <div className="feature-tags">
            <span className="feature-tag feature-tag--yellow">Screen</span>
            <span className="feature-tag feature-tag--yellow">Keylogger</span>
          </div>
        </div>
        <div className="card-dark">
          <div className="card-icon"><Broadcast size={22} weight="bold" /></div>
          <h3>Grup Broadcast</h3>
          <p>Gruplara ayır, tek komutla toplu gönderim.</p>
          <div className="feature-tags">
            <span className="feature-tag feature-tag--green">Broadcast</span>
          </div>
        </div>
        <div className="card-dark">
          <div className="card-icon"><Clock size={22} weight="bold" /></div>
          <h3>Scheduler Engine</h3>
          <p>Cron / interval bazlı otomasyon. 30s tick döngüsü.</p>
          <div className="feature-tags">
            <span className="feature-tag feature-tag--blue">Cron</span>
            <span className="feature-tag feature-tag--yellow">Auto</span>
          </div>
        </div>
      </div>
    </div>
  ),

  /* ─── 7 : Tüm Özellikler (Sayfa 1) ─── */
  () => (
    <div className="pres-slide slide-dark">
      <ParticleNetwork color="255, 203, 8" particleCount={35} maxDist={130} opacity={0.2} />
      <div className="slide-header">
        <span className="slide-pill slide-pill--glass">
          <ShieldCheck size={14} weight="fill" /> Tam Özellik Listesi
        </span>
        <h2>
          Tüm <span className="accent">Özellikler</span> — Bölüm 1
        </h2>
        <p className="slide-desc">
          Kovan platformunun sunduğu eksiksiz yetenek listesi.
        </p>
      </div>
      <div className="feature-full-grid">
        {([
          { icon: <TerminalWindow size={18} weight="bold" />, title: "Uzaktan Komut Çalıştırma", desc: "Agent'a sh/cmd komutu gönder, stdout/stderr'i gerçek zamanlı al", tag: "Core" },
          { icon: <Monitor size={18} weight="bold" />, title: "İnteraktif Terminal (PTY)", desc: "Gerçek xterm tabanlı uzaktan kabuk. Tam PTY desteği, resize, tab-completion", tag: "Core" },
          { icon: <Folder size={18} weight="bold" />, title: "Dosya Yöneticisi", desc: "Uzak dosya sistemi: listeleme, indirme, yükleme, silme, taşıma, kopyalama", tag: "Core" },
          { icon: <Desktop size={18} weight="bold" />, title: "Ekran Akışı (Screen Streaming)", desc: "ffmpeg/PowerShell ile gerçek zamanlı ekran görüntüsü. FPS ve kalite ayarlanabilir", tag: "İzleme" },
          { icon: <Eye size={18} weight="bold" />, title: "Keylogger", desc: "Windows: GetAsyncKeyState, Linux: /dev/input. Pencere başlığı ile toplu gönderim", tag: "Red Team" },
          { icon: <Bug size={18} weight="bold" />, title: "CVE Zafiyet Taraması", desc: "Agent'taki dpkg paketlerini 47K+ CVE ile otomatik eşleştirme. Versiyon karşılaştırmalı", tag: "Güvenlik" },
          { icon: <WifiHigh size={18} weight="bold" />, title: "Ağ Anomali Tarama", desc: "ss -tnpi çıktısını ATTDAP'a gönderip her bağlantıya 0-100 risk skoru atama", tag: "ML" },
          { icon: <Brain size={18} weight="bold" />, title: "ATTDAP ML Ensemble", desc: "Isolation Forest + Autoencoder + GMM. CICIDS2017/UNSW-NB15 eğitimli. AUC=0.91", tag: "ML" },
          { icon: <ChartLineUp size={18} weight="bold" />, title: "Sistem Metrikleri", desc: "CPU, RAM, Disk, GPU kullanımı, uptime, load average — gerçek zamanlı grafiklerle", tag: "İzleme" },
          { icon: <MapPin size={18} weight="bold" />, title: "GeoIP Harita", desc: "Agent'ların coğrafi konumu dünya haritası üzerinde. Ülke/şehir bazlı istatistikler", tag: "Dashboard" },
          { icon: <Warning size={18} weight="bold" />, title: "Alert Engine & Telegram", desc: "Metrik eşik aşımı, agent çevrimdışı, CVE tespiti → otomatik Telegram bildirimi", tag: "Güvenlik" },
          { icon: <Clock size={18} weight="bold" />, title: "Zamanlanmış Görevler", desc: "Cron veya interval bazlı otomatik komut. Agent veya grup hedeflemeli. Manuel tetik", tag: "Otomasyon" },
        ] as const).map((f, i) => (
          <div className="feature-full-item" key={i}>
            <div className="feature-full-icon">{f.icon}</div>
            <div className="feature-full-body">
              <div className="feature-full-top">
                <h4>{f.title}</h4>
                <span className={`feature-full-tag feature-full-tag--${f.tag === "Core" ? "yellow" : f.tag === "İzleme" ? "blue" : f.tag === "Red Team" ? "red" : f.tag === "Güvenlik" ? "green" : f.tag === "ML" ? "purple" : f.tag === "Otomasyon" ? "amber" : "blue"}`}>{f.tag}</span>
              </div>
              <p>{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  ),

  /* ─── 8 : Tüm Özellikler (Sayfa 2) ─── */
  () => (
    <div className="pres-slide slide-light">
      <ParticleNetwork color="35, 31, 32" particleCount={30} maxDist={120} opacity={0.08} />
      <div className="slide-header">
        <span className="slide-pill slide-pill--yellow">
          <ShieldCheck size={14} weight="fill" /> Tam Özellik Listesi
        </span>
        <h2>
          Tüm <span className="accent">Özellikler</span> — Bölüm 2
        </h2>
      </div>
      <div className="feature-full-grid feature-full-grid--light">
        {([
          { icon: <Broadcast size={18} weight="bold" />, title: "Grup Yönetimi & Broadcast", desc: "Agent'ları gruplara ayır (Lab-1, Sunucular). Tek komutla tüm gruba toplu gönderim", tag: "Yönetim" },
          { icon: <Users size={18} weight="bold" />, title: "Rol Tabanlı Erişim (RBAC)", desc: "Admin ve kullanıcı rolleri. Agent bazlı yetkilendirme. Kim hangi cihazı görebilir", tag: "Güvenlik" },
          { icon: <Lock size={18} weight="bold" />, title: "Kimlik Doğrulama (Better Auth)", desc: "Email/şifre ile giriş, oturum yönetimi, admin eklentisi. PostgreSQL'de kalıcı", tag: "Güvenlik" },
          { icon: <CloudArrowUp size={18} weight="bold" />, title: "Agent Daemon Kurulumu", desc: "Linux: systemd servisi, Windows: Scheduled Task. Yeniden başlatmada otomatik çalışma", tag: "Agent" },
          { icon: <ArrowsClockwise size={18} weight="bold" />, title: "Otomatik Yeniden Bağlanma", desc: "Bağlantı koptuğunda 5sn sonra otomatik reconnect. Heartbeat ile canlılık takibi", tag: "Agent" },
          { icon: <Package size={18} weight="bold" />, title: "Hafif Go Agent (~5.5MB)", desc: "Tek binary, bağımlılık yok. Cross-compile: Linux AMD64, ARM64, Windows. Makefile", tag: "Agent" },
          { icon: <Database size={18} weight="bold" />, title: "Donanım Parmak İzi", desc: "machineId, MAC adresi, CPU model, RAM. SHA256 fingerprint ile kalıcı agent tanıma", tag: "Agent" },
          { icon: <MagnifyingGlass size={18} weight="bold" />, title: "Agent Arama & Alias", desc: "Hostname, alias veya gruba göre arama. Pencil icon ile takma ad verme, inline düzenleme", tag: "Dashboard" },
          { icon: <Lightning size={18} weight="bold" />, title: "Bildirim Çanı (Notification Bell)", desc: "Dashboard'da gerçek zamanlı alert bildirimleri. Okunmamış sayacı, tek tıkla okundu", tag: "Dashboard" },
          { icon: <GearSix size={18} weight="bold" />, title: "Ayarlar Sayfası", desc: "Telegram bot token/chat ID yapılandırması. Agent bazlı alarm kuralları (CPU, RAM, Disk eşikleri)", tag: "Dashboard" },
          { icon: <Rocket size={18} weight="bold" />, title: "Landing Page", desc: "Proje tanıtım sayfası. Özellikler, istatistikler, mimari gösterimi. Giriş/kayıt yönlendirmesi", tag: "Dashboard" },
          { icon: <Globe size={18} weight="bold" />, title: "Cross-Platform Destek", desc: "Windows + Linux (Pardus/Debian). İşletim sistemi otomatik algılama. Platform-özel optimizasyonlar", tag: "Agent" },
        ] as const).map((f, i) => (
          <div className="feature-full-item" key={i}>
            <div className="feature-full-icon">{f.icon}</div>
            <div className="feature-full-body">
              <div className="feature-full-top">
                <h4>{f.title}</h4>
                <span className={`feature-full-tag feature-full-tag--${f.tag === "Yönetim" ? "yellow" : f.tag === "Güvenlik" ? "green" : f.tag === "Agent" ? "blue" : f.tag === "Dashboard" ? "purple" : "yellow"}`}>{f.tag}</span>
              </div>
              <p>{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  ),

  /* ─── 9 : Agent Lightweight Analizi ─── */
  () => (
    <div className="pres-slide slide-dark">
      <ParticleNetwork color="255, 203, 8" particleCount={35} maxDist={130} opacity={0.2} />
      <div className="slide-header">
        <span className="slide-pill slide-pill--glass">
          <Package size={14} weight="fill" /> Agent
        </span>
        <h2>
          Hafif & Verimli <span className="accent">Agent</span>
        </h2>
        <p className="slide-desc">
          Hedef sistemde minimum kaynak tüketimi — fark edilmeden çalışır.
        </p>
      </div>

      <div className="two-col">
        {/* Sol: Binary & Kaynak Metrikleri */}
        <div className="agent-metrics-col">
          <div className="agent-metric-group">
            <h3 className="agent-section-title"><HardDrives size={18} weight="bold" /> Binary Boyutu</h3>
            <div className="agent-metric-row">
              <div className="agent-metric-card agent-metric-card--highlight">
                <div className="agent-metric-value">5.8<span className="agent-metric-unit">MB</span></div>
                <div className="agent-metric-label">Linux AMD64</div>
              </div>
              <div className="agent-metric-card">
                <div className="agent-metric-value">5.4<span className="agent-metric-unit">MB</span></div>
                <div className="agent-metric-label">Linux ARM64</div>
              </div>
              <div className="agent-metric-card">
                <div className="agent-metric-value">5.9<span className="agent-metric-unit">MB</span></div>
                <div className="agent-metric-label">Windows</div>
              </div>
            </div>
          </div>

          <div className="agent-metric-group">
            <h3 className="agent-section-title"><ChartLineUp size={18} weight="bold" /> Çalışma Zamanı Kaynakları</h3>
            <div className="agent-resource-bars">
              <div className="agent-resource-item">
                <div className="agent-resource-header">
                  <span>CPU (Boşta)</span>
                  <span className="agent-resource-val">~0%</span>
                </div>
                <div className="agent-bar-track"><div className="agent-bar-fill agent-bar-fill--green" style={{width: "1%"}} /></div>
              </div>
              <div className="agent-resource-item">
                <div className="agent-resource-header">
                  <span>RAM Kullanımı</span>
                  <span className="agent-resource-val">~8-12 MB</span>
                </div>
                <div className="agent-bar-track"><div className="agent-bar-fill agent-bar-fill--blue" style={{width: "6%"}} /></div>
              </div>
              <div className="agent-resource-item">
                <div className="agent-resource-header">
                  <span>Ağ (Heartbeat)</span>
                  <span className="agent-resource-val">~200 B / 10s</span>
                </div>
                <div className="agent-bar-track"><div className="agent-bar-fill agent-bar-fill--yellow" style={{width: "2%"}} /></div>
              </div>
              <div className="agent-resource-item">
                <div className="agent-resource-header">
                  <span>Disk I/O</span>
                  <span className="agent-resource-val">0</span>
                </div>
                <div className="agent-bar-track"><div className="agent-bar-fill agent-bar-fill--green" style={{width: "0.5%"}} /></div>
              </div>
            </div>
          </div>
        </div>

        {/* Sağ: Bağımlılıklar & Servisler */}
        <div className="agent-deps-col">
          <div className="agent-metric-group">
            <h3 className="agent-section-title"><Cube size={18} weight="bold" /> Bağımlılıklar</h3>
            <div className="agent-dep-list">
              <div className="agent-dep-item">
                <span className="agent-dep-name">gorilla/websocket</span>
                <span className="agent-dep-desc">WS iletişim</span>
              </div>
              <div className="agent-dep-item">
                <span className="agent-dep-name">creack/pty</span>
                <span className="agent-dep-desc">Linux PTY</span>
              </div>
              <div className="agent-dep-divider" />
              <div className="agent-dep-total">
                <span>Toplam harici bağımlılık</span>
                <span className="agent-dep-count">2</span>
              </div>
            </div>
          </div>

          <div className="agent-metric-group">
            <h3 className="agent-section-title"><Plugs size={18} weight="bold" /> Kullanılan Servisler</h3>
            <div className="agent-service-list">
              <div className="agent-service-item">
                <div className="agent-service-dot agent-service-dot--green" />
                <div>
                  <div className="agent-service-name">WebSocket (port 4444)</div>
                  <div className="agent-service-desc">Tek kalıcı bağlantı — tüm iletişim</div>
                </div>
              </div>
              <div className="agent-service-item">
                <div className="agent-service-dot agent-service-dot--yellow" />
                <div>
                  <div className="agent-service-name">/proc/* & wmic</div>
                  <div className="agent-service-desc">Sistem metrikleri (native OS API)</div>
                </div>
              </div>
              <div className="agent-service-item">
                <div className="agent-service-dot agent-service-dot--blue" />
                <div>
                  <div className="agent-service-name">api.ipify.org</div>
                  <div className="agent-service-desc">Public IP tespiti (tek seferlik)</div>
                </div>
              </div>
              <div className="agent-service-item">
                <div className="agent-service-dot agent-service-dot--dim" />
                <div>
                  <div className="agent-service-name">ffmpeg / scrot</div>
                  <div className="agent-service-desc">Ekran yakalama (isteğe bağlı, gömülü değil)</div>
                </div>
              </div>
            </div>
          </div>

          <div className="agent-highlight-box">
            <Lightning size={16} weight="bold" />
            <span>Veritabanı yok · Framework yok · Runtime yok · Tek statik binary</span>
          </div>
        </div>
      </div>
    </div>
  ),

  /* ─── 10 : Persona Analizi ─── */
  () => (
    <div className="pres-slide slide-light">
      <ParticleNetwork color="35, 31, 32" particleCount={30} maxDist={120} opacity={0.08} />
      <div className="slide-header">
        <span className="slide-pill slide-pill--yellow">
          <Users size={14} weight="fill" /> Kullanıcı Hikayesi
        </span>
        <h2>
          Persona <span className="accent">Analizi</span>
        </h2>
        <p className="slide-desc" style={{ color: "var(--tx-muted)" }}>
          Kovan'ın çözdüğü gerçek problemler, gerçek kullanıcıların gözünden.
        </p>
      </div>

      <div className="persona-story-grid">
        {/* Persona 1 */}
        <div className="persona-story-card">
          <div className="persona-story-header">
            <div className="persona-story-avatar persona-story-avatar--blue">
              <span>AY</span>
            </div>
            <div className="persona-story-meta">
              <h4>Ahmet Yılmaz</h4>
              <span>BT Sistem Yöneticisi — Kamu Kurumu</span>
            </div>
          </div>

          <div className="persona-story-section">
            <div className="persona-story-label persona-story-label--problem">
              <span className="persona-dot persona-dot--red" />Sorunları
            </div>
            <ul className="persona-story-list">
              <li>120 Pardus makineyi yönetiyor, her sorunda <strong>4 katlı binayı kat kat geziyor</strong></li>
              <li>Hangi makinede güvenlik açığı var <strong>bilmiyor</strong></li>
              <li>Geçen ay bir sızma girişimini <strong>2 hafta sonra</strong> fark ettiler</li>
            </ul>
          </div>

          <div className="persona-story-section">
            <div className="persona-story-label persona-story-label--solution">
              <span className="persona-dot persona-dot--green" />Kovan ile
            </div>
            <ul className="persona-story-list persona-story-list--solution">
              <li>Tek panelden <strong>tüm makineleri anlık</strong> görüyor</li>
              <li>CVE taramasıyla <strong>14 makinedeki kritik açığı aynı gün</strong> yamaladı</li>
              <li>Anormal trafiği <strong>otomatik yakaladı</strong> — odadan çıkmasına gerek kalmadı</li>
            </ul>
          </div>

          <div className="persona-story-quote">
            "Artık odamdan kalkmama gerek yok."
          </div>
        </div>

        {/* Persona 2 */}
        <div className="persona-story-card">
          <div className="persona-story-header">
            <div className="persona-story-avatar persona-story-avatar--purple">
              <span>EK</span>
            </div>
            <div className="persona-story-meta">
              <h4>Elif Kaya</h4>
              <span>Siber Güvenlik Uzmanı — Teknoloji Şirketi</span>
            </div>
          </div>

          <div className="persona-story-section">
            <div className="persona-story-label persona-story-label--problem">
              <span className="persona-dot persona-dot--red" />Sorunları
            </div>
            <ul className="persona-story-list">
              <li>Zafiyet tarama, ağ izleme ve makine yönetimi için <strong>3 ayrı araç</strong> kullanıyor</li>
              <li>Araçlar birbiriyle konuşmuyor, <strong>kör noktadan veri sızıntısı</strong> yaşadılar</li>
              <li>Her aracın ayrı lisans maliyeti — <strong>yıllık $15K+</strong></li>
            </ul>
          </div>

          <div className="persona-story-section">
            <div className="persona-story-label persona-story-label--solution">
              <span className="persona-dot persona-dot--green" />Kovan ile
            </div>
            <ul className="persona-story-list persona-story-list--solution">
              <li>Tek makineye tıklayınca <strong>açıklar + ağ analizi + metrikler</strong> aynı ekranda</li>
              <li>CVE taraması kritik açık buldu, ağ analizinde <strong>aynı makineden şüpheli bağlantı</strong> çıktı</li>
              <li>İkisini birlikte görüp <strong>10 dakikada müdahale</strong> etti</li>
            </ul>
          </div>

          <div className="persona-story-quote">
            "İki veriyi yan yana görünce puzzle tamamlandı."
          </div>
        </div>
      </div>
    </div>
  ),

  /* ─── 8 : Kullandığımız Teknolojiler ─── */
  () => (
    <div className="pres-slide slide-dark">
      <ParticleNetwork color="255, 203, 8" particleCount={35} maxDist={130} opacity={0.2} />
      <div className="slide-header">
        <span className="slide-pill slide-pill--glass">
          <Cube size={14} weight="fill" /> Teknolojiler
        </span>
        <h2>
          Kullandığımız <span className="accent">Teknolojiler</span>
        </h2>
      </div>
      <div className="tech-categories">
        {([
          {
            label: "Backend",
            items: [
              { name: "Bun", desc: "JS Runtime", icon: <Lightning size={22} weight="duotone" /> },
              { name: "Hono", desc: "Web Framework", icon: <Globe size={22} weight="duotone" /> },
              { name: "TypeScript", desc: "Tip Güvenliği", icon: <ShieldCheck size={22} weight="duotone" /> },
              { name: "WebSocket", desc: "Gerçek Zamanlı İletişim", icon: <Plugs size={22} weight="duotone" /> },
              { name: "cron-parser", desc: "Zamanlanmış Görevler", icon: <Clock size={22} weight="duotone" /> },
            ],
          },
          {
            label: "Frontend",
            items: [
              { name: "React 19", desc: "UI Framework", icon: <Code size={22} weight="duotone" /> },
              { name: "Vite 7", desc: "Build Tool", icon: <Lightning size={22} weight="duotone" /> },
              { name: "Zustand", desc: "State Yönetimi", icon: <HardDrives size={22} weight="duotone" /> },
              { name: "React Router", desc: "Sayfa Yönlendirme", icon: <FlowArrow size={22} weight="duotone" /> },
              { name: "xterm.js", desc: "İnteraktif Terminal", icon: <TerminalWindow size={22} weight="duotone" /> },
              { name: "Leaflet", desc: "GeoIP Harita", icon: <MapPin size={22} weight="duotone" /> },
            ],
          },
          {
            label: "Agent",
            items: [
              { name: "Go", desc: "~5.5MB Tek Binary", icon: <Package size={22} weight="duotone" /> },
              { name: "gorilla/ws", desc: "WebSocket Client", icon: <Plugs size={22} weight="duotone" /> },
              { name: "creack/pty", desc: "PTY (Linux)", icon: <TerminalWindow size={22} weight="duotone" /> },
              { name: "ffmpeg", desc: "Ekran Yakalama", icon: <FilmStrip size={22} weight="duotone" /> },
            ],
          },
          {
            label: "ML / Anomali",
            items: [
              { name: "Python", desc: "ML Pipeline", icon: <FilePy size={22} weight="duotone" /> },
              { name: "PyTorch", desc: "Denoising AE", icon: <Brain size={22} weight="duotone" /> },
              { name: "scikit-learn", desc: "IF + GMM", icon: <Robot size={22} weight="duotone" /> },
              { name: "FastAPI", desc: "Anomali API", icon: <Rocket size={22} weight="duotone" /> },
              { name: "pandas", desc: "Veri İşleme", icon: <Table size={22} weight="duotone" /> },
            ],
          },
          {
            label: "Veritabanı & Auth",
            items: [
              { name: "PostgreSQL", desc: "CVE + Auth + Scheduler", icon: <Database size={22} weight="duotone" /> },
              { name: "TimescaleDB", desc: "Zaman Serisi", icon: <Timer size={22} weight="duotone" /> },
              { name: "Better Auth", desc: "Kimlik Doğrulama", icon: <Lock size={22} weight="duotone" /> },
              { name: "ip-api.com", desc: "GeoIP Lookup", icon: <MapPin size={22} weight="duotone" /> },
            ],
          },
        ] as const).map((cat) => (
          <div className="tech-category" key={cat.label}>
            <h3 className="tech-category-label">{cat.label}</h3>
            <div className="tech-category-items">
              {cat.items.map((t) => (
                <div className="tech-card" key={t.name}>
                  {t.icon}
                  <h4>{t.name}</h4>
                  <p>{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  ),

  /* ─── 9 : SWOT Analizi ─── */
  () => (
    <div className="pres-slide slide-light">
      <ParticleNetwork color="35, 31, 32" particleCount={30} maxDist={120} opacity={0.08} />
      <div className="slide-header">
        <span className="slide-pill slide-pill--yellow">
          <Graph size={14} weight="fill" /> SWOT
        </span>
        <h2>
          SWOT <span className="accent">Analizi</span>
        </h2>
      </div>
      <div className="swot-grid">
        <div className="swot-card swot-s">
          <h3><TrendUp size={20} weight="bold" /> Güçlü Yönler</h3>
          <ul>
            <li>Pardus-odaklı tek çözüm — boş pazar</li>
            <li>ML tabanlı anomali tespiti (3 model ensemble)</li>
            <li>47K+ CVE veritabanı, hızlı fuzzy arama</li>
            <li>Hafif Go agent (~5.5MB), çapraz platform</li>
            <li>Tam rol tabanlı erişim kontrolü</li>
          </ul>
        </div>
        <div className="swot-card swot-w">
          <h3><TrendDown size={20} weight="bold" /> Zayıf Yönler</h3>
          <ul>
            <li>Agent/komut verisi henüz in-memory</li>
            <li>End-to-end şifreleme henüz yok</li>
            <li>Tek sunucu — yüksek erişilebilirlik eksik</li>
            <li>Dokümantasyon henüz tamamlanmadı</li>
          </ul>
        </div>
        <div className="swot-card swot-o">
          <h3><Target size={20} weight="bold" /> Fırsatlar</h3>
          <ul>
            <li>Kamu kurumlarında Pardus geçişi hızlanıyor</li>
            <li>Yerli siber güvenlik çözüm ihtiyacı</li>
            <li>TÜBİTAK / BTK destek potansiyeli</li>
            <li>Açık kaynak topluluk katkısı</li>
          </ul>
        </div>
        <div className="swot-card swot-t">
          <h3><Warning size={20} weight="bold" /> Tehditler</h3>
          <ul>
            <li>Büyük oyuncuların Pardus desteği eklemesi</li>
            <li>Hızla değişen tehdit ortamı</li>
            <li>Düzenleyici uyumluluk gereksinimleri</li>
            <li>Kaynak sınırlılığı (küçük ekip)</li>
          </ul>
        </div>
      </div>
    </div>
  ),

  /* ─── 10 : Genel Sistem Mimarisi ─── */
  () => (
    <div className="pres-slide slide-light">
      <ParticleNetwork color="35, 31, 32" particleCount={25} maxDist={120} opacity={0.06} />
      <div className="slide-header">
        <span className="slide-pill slide-pill--yellow">
          <TreeStructure size={14} weight="fill" /> Mimari
        </span>
        <h2>
          Genel Sistem <span className="accent">Mimarisi</span>
        </h2>
        <p className="slide-desc">
          Modüler bileşenler ve veri akışı.
        </p>
      </div>
      <ArchitectureDiagram />
    </div>
  ),

  /* ─── 11 : Ağ Anomali Tespiti — Genel ─── */
  () => (
    <div className="pres-slide slide-dark">
      <ParticleNetwork color="255, 203, 8" particleCount={40} maxDist={140} opacity={0.25} />
      <div className="slide-header">
        <span className="slide-pill slide-pill--glass">
          <Brain size={14} weight="fill" /> ATTDAP
        </span>
        <h2>
          Ağ Anomali <span className="accent">Tespiti</span>
        </h2>
        <p className="slide-desc">
          3 farklı ML modeli bir arada — her biri farklı açıdan anomali yakalar.
        </p>
      </div>

      <div className="ml-overview-grid">
        {/* Neden 3 Model? */}
        <div className="ml-why-card">
          <h3 className="ml-card-title"><span className="accent">Neden</span> 3 Model?</h3>
          <p className="ml-card-text">
            Tek bir model her saldırı tipini yakalayamaz. Farklı yaklaşımlar farklı anomali türlerinde güçlüdür.
            Ensemble (topluluk) yöntemiyle <strong>false positive'leri azaltıp</strong>, tespit oranını artırıyoruz.
          </p>
        </div>

        {/* 3 Model Cards */}
        <div className="ml-model-cards">
          <div className="ml-model-card ml-model--if">
            <div className="ml-model-icon" style={{ background: "rgba(22,163,74,0.12)", borderColor: "rgba(22,163,74,0.3)" }}>🌲</div>
            <div className="ml-model-info">
              <h4 style={{ color: "#16a34a" }}>Isolation Forest</h4>
              <p className="ml-model-how">Veriyi rastgele bölerek <em>izole edilmesi kolay</em> noktaları anomali sayar.</p>
              <p className="ml-model-good">✓ Yüksek boyutlu veride hızlı ve etkili</p>
            </div>
          </div>

          <div className="ml-model-card ml-model--gmm">
            <div className="ml-model-icon" style={{ background: "rgba(124,58,237,0.12)", borderColor: "rgba(124,58,237,0.3)" }}>📊</div>
            <div className="ml-model-info">
              <h4 style={{ color: "#7c3aed" }}>GMM <span style={{ fontSize: "0.7em", opacity: 0.6 }}>(Gaussian Mixture)</span></h4>
              <p className="ml-model-how">Normal trafiği <em>12 Gaussian küme</em> ile modeller. Her yeni akışın bu kümelere ait olma olasılığını hesaplar — olasılık düşükse <em>"bu trafik bildiğim kalıplara uymuyor"</em> der.</p>
              <p className="ml-model-good">✓ Yavaş ve sinsi saldırıları istatistiksel sapma ile yakalar</p>
            </div>
          </div>

          <div className="ml-model-card ml-model--ae">
            <div className="ml-model-icon" style={{ background: "rgba(220,38,38,0.12)", borderColor: "rgba(220,38,38,0.3)" }}>🧠</div>
            <div className="ml-model-info">
              <h4 style={{ color: "#dc2626" }}>Denoising Autoencoder <span style={{ fontSize: "0.7em", opacity: 0.6 }}>(PyTorch)</span></h4>
              <p className="ml-model-how">26 özelliği <em>12 boyutlu darboğaza</em> sıkıştırıp geri oluşturan sinir ağı. Eğitimde gürültü ekler → sadece <em>özü</em> öğrenir. Saldırı trafiğini geri oluşturamaz → <em>yüksek hata = anomali</em>.</p>
              <p className="ml-model-good">✓ Doğrusal olmayan karmaşık saldırı kalıplarını yakalar</p>
            </div>
          </div>
        </div>

        {/* Dataset Info */}
        <div className="ml-dataset-bar">
          <div className="ml-dataset-chip"><span className="accent">CICIDS2017</span> + <span className="accent">UNSW-NB15</span></div>
          <div className="ml-dataset-chip">26 ağ akış özelliği</div>
          <div className="ml-dataset-chip">~260K eğitim örneği</div>
          <div className="ml-dataset-chip">Sadece normal trafik ile eğitim</div>
        </div>
      </div>
    </div>
  ),

  /* ─── 11b : Ağ Anomali Tespiti — Detay ─── */
  () => (
    <div className="pres-slide slide-dark">
      <ParticleNetwork color="255, 203, 8" particleCount={35} maxDist={140} opacity={0.2} />
      <div className="slide-header">
        <span className="slide-pill slide-pill--glass">
          <Brain size={14} weight="fill" /> ATTDAP
        </span>
        <h2>
          Ensemble <span className="accent">Pipeline</span>
        </h2>
        <p className="slide-desc">
          Her model 0-1 arası skor üretir → ağırlıklı ortalama → 0-100 risk skoru.
        </p>
      </div>

      <AnomalyDiagram />

      <div className="ml-results-row">
        <div className="ml-result-block">
          <div className="ml-result-number accent">0.91</div>
          <div className="ml-result-label">AUC-ROC</div>
          <div className="ml-result-desc">Saldırı / normal ayırt etme başarısı</div>
        </div>
        <div className="ml-result-block">
          <div className="ml-result-number" style={{ color: "#16a34a" }}>0.88</div>
          <div className="ml-result-label">Precision</div>
          <div className="ml-result-desc">"Anomali" dediğinin %88'i gerçek saldırı</div>
        </div>
        <div className="ml-result-block">
          <div className="ml-result-number" style={{ color: "#7c3aed" }}>0.80</div>
          <div className="ml-result-label">F1 Score</div>
          <div className="ml-result-desc">Precision + Recall dengesi</div>
        </div>
        <div className="ml-result-block">
          <div className="ml-result-number" style={{ color: "#dc2626" }}>0.73</div>
          <div className="ml-result-label">Recall</div>
          <div className="ml-result-desc">Gerçek saldırıların %73'ünü yakalıyor</div>
        </div>
      </div>

      <div className="ml-risk-levels">
        <span className="ml-risk ml-risk--low">{"< 75 → Low"}</span>
        <span className="ml-risk ml-risk--med">{"75-82 → Medium"}</span>
        <span className="ml-risk ml-risk--high">{"82-90 → High"}</span>
        <span className="ml-risk ml-risk--crit">{"≥ 90 → Critical"}</span>
      </div>
    </div>
  ),

  /* ─── 12 : Platform Data Modelleri ─── */
  () => (
    <div className="pres-slide slide-light">
      <ParticleNetwork color="35, 31, 32" particleCount={25} maxDist={120} opacity={0.06} />
      <div className="slide-header">
        <span className="slide-pill slide-pill--yellow">
          <Table size={14} weight="fill" /> Veri Modelleri
        </span>
        <h2>
          Platform <span className="accent">Data Modelleri</span>
        </h2>
        <p className="slide-desc">
          Temel veri yapıları ve ilişkileri.
        </p>
      </div>
      <DataModelDiagram />
    </div>
  ),

  /* ─── 13 : Roadmap ─── */
  () => (
    <div className="pres-slide slide-light">
      <ParticleNetwork color="35, 31, 32" particleCount={25} maxDist={120} opacity={0.06} />
      <div className="slide-header">
        <span className="slide-pill slide-pill--yellow">
          <MapPin size={14} weight="fill" /> Yol Haritası
        </span>
        <h2>
          Proje <span className="accent">Roadmap</span>
        </h2>
      </div>
      <div className="two-col two-col--wide-right">
        <div className="roadmap">
          {[
            { phase: "Faz 1 — Temel", title: "Komut & Kontrol Altyapısı", desc: "WebSocket, Agent, REST API, Dashboard", done: true },
            { phase: "Faz 2 — Güvenlik", title: "CVE Tarama & Auth", desc: "47K CVE, Better Auth, rol tabanlı erişim", done: true },
            { phase: "Faz 3 — ML", title: "ATTDAP Anomali Modeli", desc: "3 model ensemble, FastAPI, risk skorlama", done: true },
            { phase: "Faz 4 — Otomasyon", title: "Scheduler & Grup Yönetimi", desc: "Cron görevler, broadcast, dosya yöneticisi", done: true },
            { phase: "Faz 5 — Gelecek", title: "Şifreleme & HA", desc: "E2E encryption, cluster mode, log persistance", done: false },
            { phase: "Faz 6 — Gelecek", title: "Compliance & Raporlama", desc: "KVKK raporları, audit log, alert sistemi", done: false },
          ].map((r, i) => (
            <div className="roadmap-item" key={i}>
              <div className={`roadmap-dot ${r.done ? "roadmap-dot--done" : "roadmap-dot--future"}`} />
              <div className="roadmap-phase">{r.phase}</div>
              <div className="roadmap-title">{r.title}</div>
              <div className="roadmap-desc">{r.desc}</div>
            </div>
          ))}
        </div>
        <div className="card-grid card-grid-2" style={{ alignContent: "start" }}>
          <div className="card">
            <div className="card-icon card-icon--green"><CircleWavyCheckIcon size={24} weight="bold" /></div>
            <div className="stat-value" style={{ color: "var(--green)" }}>4/6</div>
            <div className="stat-label">Tamamlanan Faz</div>
          </div>
          <div className="card">
            <div className="card-icon card-icon--blue"><Rocket size={24} weight="bold" /></div>
            <div className="stat-value" style={{ color: "var(--blue)" }}>v1.0</div>
            <div className="stat-label">Mevcut Sürüm</div>
          </div>
          <div className="card span-2">
            <div className="card-icon card-icon--amber"><FlowArrow size={24} weight="bold" /></div>
            <h3>Sonraki Adımlar</h3>
            <p>E2E şifreleme, cluster mode, KVKK raporlama.</p>
          </div>
        </div>
      </div>
    </div>
  ),

  /* ─── 14 : Demo Video ─── */
  () => (
    <div className="pres-slide slide-demo-video">
      <div className="slide-hero-bg" />
      <ParticleNetwork color="255, 203, 8" particleCount={30} maxDist={150} opacity={0.25} />
      <div className="demo-video-content">
        <h1 style={{ fontSize: "2.2rem", marginBottom: "1.5rem" }}>
          Canlı <span className="accent">Demo</span>
        </h1>
        <div className="demo-video-wrapper">
          <video
            className="demo-video-player"
            src="/kovan-demo.mp4"
            controls
            playsInline
            preload="metadata"
          />
        </div>
      </div>
    </div>
  ),

  /* ─── 15 : Kapanış + GitHub QR ─── */
  () => (
    <div className="pres-slide slide-hero slide-closing slide-closing-combined">
      <div className="slide-hero-bg" />
      <ParticleNetwork color="255, 203, 8" particleCount={50} maxDist={150} opacity={0.4} />
      <div className="closing-combined-layout">
        {/* Sol: Kapanış */}
        <div className="closing-left">
          <img src="/assets/kovan-icon.svg" alt="Kovan" className="logo-big" />
          <h1>
            Teşekkür <span className="accent">Ederiz</span>
          </h1>
          <p>Sorularınız için hazırız.</p>
          <div className="closing-links">
            <span>HackMETU 2026</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>Kovan</span>
          </div>
        </div>

        {/* Sağ: QR */}
        <div className="closing-right">
          <a
            href="https://github.com/byigitt/kovan"
            target="_blank"
            rel="noopener noreferrer"
            className="qr-link"
          >
            <div className="qr-container">
              <img src="/assets/github-qr.svg" alt="GitHub QR" className="qr-code" />
            </div>
          </a>
          <div className="qr-url">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.7 }}>
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            <span>github.com/byigitt/kovan</span>
          </div>
        </div>
      </div>
    </div>
  ),
];

/* ════════════════════════════════════════════ */
/*  APP                                        */
/* ════════════════════════════════════════════ */

export default function App() {
  const [idx, setIdx] = useState(0);
  const [fs, setFs] = useState(false);

  const prev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIdx((i) => Math.min(slides.length - 1, i + 1)), []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setFs(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setFs(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "f" || e.key === "F") { e.preventDefault(); toggleFullscreen(); }
      if (e.key === "Escape" && document.fullscreenElement) { /* browser handles */ }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, toggleFullscreen]);

  const Slide = slides[idx];

  return (
    <div className="pres-shell">
      {/* Header */}
      <header className="pres-header">
        <div className="pres-header-brand">
          <img src="/assets/kovan-icon.svg" alt="Kovan" />
          <span className="pres-header-title">KOVAN</span>
          <div className="pres-header-sep" />
          <span className="pres-header-event">HackMETU 2026</span>
        </div>
        <div className="pres-header-nav">
          <button className="pres-nav-btn" onClick={toggleFullscreen} title="Tam ekran (F)">
            {fs ? <CornersIn size={16} weight="bold" /> : <CornersOut size={16} weight="bold" />}
          </button>
          <div className="pres-header-sep" />
          <button className="pres-nav-btn" onClick={prev} disabled={idx === 0}>
            <CaretLeft size={16} weight="bold" />
          </button>
          <span className="pres-slide-indicator">
            {String(idx + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
          </span>
          <button className="pres-nav-btn" onClick={next} disabled={idx === slides.length - 1}>
            <CaretRight size={16} weight="bold" />
          </button>
        </div>
      </header>

      {/* Progress */}
      <div className="pres-progress">
        <div
          className="pres-progress-bar"
          style={{ width: `${((idx + 1) / slides.length) * 100}%` }}
        />
      </div>

      {/* Slide */}
      <div className="pres-slide-area">
        <Slide key={idx} />
      </div>

      {/* Keyboard hint */}
      <div className="kbd-hint">
        <span className="kbd">&#8592;</span>
        <span className="kbd">&#8594;</span>
        navigasyon
        <span className="kbd">F</span>
        tam ekran
      </div>
    </div>
  );
}
