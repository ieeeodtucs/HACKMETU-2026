import { useNavigate } from "react-router";
import {
  ShieldCheckIcon,
  TerminalWindowIcon,
  WifiHighIcon,
  BugIcon,
  ChartLineUpIcon,
  ArrowUpRightIcon,
  CloudArrowUpIcon,
  DesktopIcon,
  DatabaseIcon,
  DownloadSimpleIcon,
  PackageIcon,
  GearSixIcon,
  LockIcon,
  MonitorIcon,
  CubeIcon,
  EyeIcon,
  RocketIcon,
} from "@phosphor-icons/react";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      {/* ── Nav ── */}
      <nav className="landing-nav">
        <div className="landing-nav-brand">
          <img src="/assets/kovan-icon.svg" alt="" width="36" height="36" />
          <span>KOVAN</span>
        </div>
        <div className="landing-nav-links">
          <a href="#features" className="landing-nav-link">Özellikler</a>
          <a href="#stats" className="landing-nav-link">İstatistikler</a>
          <a href="#architecture" className="landing-nav-link">Mimari</a>
          <button className="landing-nav-link" onClick={() => navigate("/login")}>
            Giriş
          </button>
          <button className="landing-nav-cta" onClick={() => navigate("/register")}>
            Hemen Başla
            <DownloadSimpleIcon size={16} weight="bold" />
          </button>
        </div>
      </nav>

      {/* ── Hero (Dark) ── */}
      <section className="landing-hero">
        <div className="landing-hero-bg" />
        <div className="landing-hero-content">
          <h1>
            Siber Güvenlikte{" "}
            <span className="accent">Özgürleşin</span>
            <br />
            Kovan ile Geleceğe Adım Atın
          </h1>
          <p className="landing-hero-sub">
            Ağ cihazlarınızı tek panelden yönetin, güvenlik açıklarını tarayın,
            anomali tespiti yapın ve tehditlere anında müdahale&nbsp;edin.
          </p>
          <button className="landing-btn-outline" onClick={() => navigate("/register")}>
            Paneli İnceleyin
            <ArrowUpRightIcon size={16} weight="bold" />
          </button>
        </div>
      </section>

      {/* ── Bento Stats (White bg) ── */}
      <section className="landing-bento" id="stats">
        <div className="landing-bento-header">
          <span className="landing-pill"><ShieldCheckIcon size={16} weight="fill" /> Güvenlik Verileri</span>
          <h2>
            <span className="accent">Kovan</span> ile ağınızı koruyun,<br />
            Güvenliğin gücünü hissedin!
          </h2>
        </div>

        <div className="landing-bento-grid">
          <div className="landing-bento-card landing-bento-card--yellow">
            <div className="landing-bento-icon"><PackageIcon size={28} weight="bold" /></div>
            <h3>47K+</h3>
            <p>CVE Kayıt Veritabanı</p>
          </div>

          <div className="landing-bento-card landing-bento-card--dark">
            <div className="landing-bento-icon landing-bento-icon--ring">
              <DownloadSimpleIcon size={28} weight="bold" />
            </div>
            <h3>93%</h3>
            <p>Anomali Tespit Doğruluğu</p>
          </div>

          <div className="landing-bento-card landing-bento-card--wide">
            <div className="landing-bento-icon"><ChartLineUpIcon size={28} weight="bold" /></div>
            <span className="landing-bento-detail">Detaylı Bilgi &gt;</span>
            <p className="landing-bento-text">
              Kovan <span className="accent">yüksek performanslı,</span> hızlı ve güvenilir bir güvenlik deneyimi sunar.
            </p>
          </div>

          <div className="landing-bento-card">
            <div className="landing-bento-icon"><GearSixIcon size={28} weight="bold" /></div>
            <h3>&lt;2s</h3>
            <p>Tarama Süresi</p>
          </div>

          <div className="landing-bento-card landing-bento-card--dark landing-bento-card--wide-mid">
            <div className="landing-bento-icon landing-bento-icon--yellow">
              <ShieldCheckIcon size={28} weight="bold" />
            </div>
            <span className="landing-bento-detail" style={{ color: "rgba(255,255,255,0.5)" }}>
              Detaylı Bilgi &gt;
            </span>
            <h3 className="landing-bento-headline">
              Kovan yaygın tehditleri otomatik tespit eder,<br />
              güvenilir bir çözümdür.
            </h3>
          </div>

          <div className="landing-bento-card landing-bento-card--accent">
            <div className="landing-bento-icon"><MonitorIcon size={28} weight="bold" /></div>
            <h3>7/24</h3>
            <p>Aktif İzleme</p>
          </div>
        </div>
      </section>

      {/* ── Features (White bg) ── */}
      <section className="landing-features" id="features">
        <span className="landing-pill"><EyeIcon size={16} weight="fill" /> Takipte Kalın</span>
        <h2>
          <span className="accent">Kovan</span>'da neler var?
        </h2>
        <p className="landing-features-sub">
          Güvenlik platformumuzun sunduğu kapsamlı araç setini keşfedin.
        </p>

        <div className="landing-features-grid">
          <div className="landing-feature-card">
            <div className="landing-feature-img">
              <TerminalWindowIcon size={40} weight="duotone" />
            </div>
            <h3>Uzaktan Komut Yönetimi</h3>
            <p>Bağlı cihazlara terminal üzerinden anlık komut gönderin, çıktıları gerçek zamanlı izleyin.</p>
            <span className="landing-feature-tag">Komut</span>
          </div>

          <div className="landing-feature-card">
            <div className="landing-feature-img">
              <BugIcon size={40} weight="duotone" />
            </div>
            <h3>CVE Zafiyet Taraması</h3>
            <p>47.000+ CVE kaydı ile kurulu paketleri karşılaştırın, kritik güvenlik açıklarını tespit edin.</p>
            <span className="landing-feature-tag">Tarama</span>
          </div>

          <div className="landing-feature-card">
            <div className="landing-feature-img">
              <ChartLineUpIcon size={40} weight="duotone" />
            </div>
            <h3>ATTDAP Anomali Tespiti</h3>
            <p>ML tabanlı 3 model ile ağ trafiğini analiz edin, şüpheli aktiviteleri risk puanıyla değerlendirin.</p>
            <span className="landing-feature-tag">ML</span>
          </div>

          <div className="landing-feature-card">
            <div className="landing-feature-img">
              <WifiHighIcon size={40} weight="duotone" />
            </div>
            <h3>Ağ Keşfi &amp; Tarama</h3>
            <p>Yerel ağdaki cihazları otomatik keşfedin, açık portları ve servisleri haritalayın.</p>
            <span className="landing-feature-tag">Ağ</span>
          </div>
        </div>

        <button className="landing-btn-outline landing-btn-outline--dark" onClick={() => navigate("/register")}>
          Tümünü Görüntüle
          <ArrowUpRightIcon size={16} weight="bold" />
        </button>
      </section>

      {/* ── Products / Architecture (Dark gold bg) ── */}
      <section className="landing-products" id="architecture">
        <span className="landing-pill landing-pill--glass"><CubeIcon size={16} weight="fill" /> Projeleri Keşfedin</span>
        <h2>Güçlü ve Esnek Mimari</h2>
        <p className="landing-products-sub">
          Kovan, modüler bileşenleriyle esnek bir güvenlik altyapısı sunar.
        </p>

        <div className="landing-products-grid">
          <div className="landing-product-card">
            <DesktopIcon size={36} weight="duotone" />
            <h4>Agent</h4>
            <p>Go tabanlı, çapraz platform agent. Hedef cihazda çalışır, komutları yürütür.</p>
          </div>
          <div className="landing-product-card">
            <CloudArrowUpIcon size={36} weight="duotone" />
            <h4>Sunucu</h4>
            <p>Bun + Hono ile REST API &amp; WebSocket. Tek port üzerinden tüm iletişim.</p>
          </div>
          <div className="landing-product-card">
            <DatabaseIcon size={36} weight="duotone" />
            <h4>CVE Veritabanı</h4>
            <p>PostgreSQL üzerinde 47K+ CVE kaydı, hızlı fuzzy arama ve paket eşleştirme.</p>
          </div>
          <div className="landing-product-card">
            <ChartLineUpIcon size={36} weight="duotone" />
            <h4>ATTDAP</h4>
            <p>Isolation Forest + Autoencoder + GMM ensemble. F1=0.80, AUC-ROC=0.91.</p>
          </div>
          <div className="landing-product-card">
            <LockIcon size={36} weight="duotone" />
            <h4>Kimlik Yönetimi</h4>
            <p>Better Auth ile rol tabanlı erişim. Admin ve kullanıcı yetkilendirme.</p>
          </div>
        </div>
      </section>

      {/* ── CTA (White bg) ── */}
      <section className="landing-cta">
        <span className="landing-pill"><RocketIcon size={16} weight="fill" /> Hızlı Başvuru</span>
        <h2>Kovan Dünyasına Adım Atın!</h2>
        <p>
          Kovan'ın sunduğu güvenli deneyimi keşfetmek için hemen kaydolun.
        </p>
        <div className="landing-cta-actions">
          <button className="landing-btn-solid" onClick={() => navigate("/register")}>
            Ücretsiz Hesap Oluştur
            <ArrowUpRightIcon size={16} weight="bold" />
          </button>
          <button className="landing-btn-outline landing-btn-outline--dark" onClick={() => navigate("/login")}>
            Giriş Yap
            <ArrowUpRightIcon size={16} weight="bold" />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-footer-top">
          <div className="landing-footer-col">
            <h5>Platform</h5>
            <a href="#features">Özellikler</a>
            <a href="#stats">İstatistikler</a>
            <a href="#architecture">Mimari</a>
          </div>
          <div className="landing-footer-col">
            <h5>Kaynaklar</h5>
            <a href="#">Dokümantasyon</a>
            <a href="#">CVE Veritabanı</a>
            <a href="#">ATTDAP API</a>
          </div>
          <div className="landing-footer-col">
            <h5>İletişim</h5>
            <a href="#">GitHub</a>
            <a href="#">HackMETU 2026</a>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <div className="landing-footer-brand">
            <img src="/assets/kovan-icon.svg" alt="" width="20" height="20" />
            <span>Kovan — Pardus Güvenlik Platformu</span>
          </div>
          <span>© 2026 HackMETU</span>
        </div>
      </footer>
    </div>
  );
}
