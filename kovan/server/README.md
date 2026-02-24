# Sunucu (Server)

Kovan sisteminin merkezi sunucusudur. Tüm agent bağlantıları, komut iletimi, kimlik doğrulama ve veri işlemleri bu katmanda gerçekleşir.

## Teknolojiler

- **Çalışma Zamanı:** Bun
- **HTTP Çerçevesi:** Hono
- **WebSocket:** ws (Bun uyumlu)
- **Veritabanı:** PostgreSQL (pg modülü)
- **Kimlik Doğrulama:** better-auth (e-posta/şifre + admin eklentisi)
- **Test:** Vitest

## Temel Sorumluluklar

- Agent kaydı, kalp atışı takibi ve çevrimiçi/çevrimdışı durum yönetimi
- REST API üzerinden komut gönderme ve sonuç alma
- WebSocket üzerinden agent ile çift yönlü iletişim
- CVE veritabanı üzerinde arama, detay ve zafiyet taraması
- Kullanıcı kimlik doğrulama ve oturum yönetimi
- Agent bazlı erişim izinleri (admin tam yetki, normal kullanıcı sınırlı)
- Agent grupları ve toplu komut gönderimi (broadcast)
- Zamanlanmış görev yönetimi (scheduler)
- Uyarı motoru (alert engine)
- Keylogger veri toplama ve saklama
- Üretim derlemesinde ön yüz statik dosyalarını sunma

## API Yapısı

Tüm API uç noktaları `/api/` ön eki altında sunulur. Başlıca gruplar:

- `/api/health` — Sağlık kontrolü (kimlik doğrulama gerektirmez)
- `/api/agents` — Agent CRUD işlemleri
- `/api/command`, `/api/commands` — Komut gönderme ve geçmiş
- `/api/cves` — CVE arama, detay ve tarama (kimlik doğrulama gerektirmez)
- `/api/permissions` — Kullanıcı-agent erişim izinleri (yalnızca admin)
- `/api/groups` — Grup yönetimi ve toplu komut
- `/api/auth/*` — Kimlik doğrulama rotaları (better-auth tarafından yönetilir)
- `/api/agents/:id/keylog` — Keylogger yönetimi ve veri erişimi
- `/api/alerts` — Uyarı tanımlama ve sorgulama
- `/api/schedules` — Zamanlanmış görev yönetimi

## Veritabanı Şema Dosyaları

`scripts/` klasöründe SQL dosyaları bulunur. Veritabanı ilk kurulumunda bunların sırayla çalıştırılması gerekir:

1. `init-db.sql` — CVE tabloları ve indeksler
2. `init-auth.sql` — Kimlik doğrulama tabloları
3. `init-permissions.sql` — Kullanıcı-agent izin tablosu
4. `init-agents.sql` — Agent veritabanı tabloları
5. `init-alerts.sql` — Uyarı tabloları
6. `init-scheduler.sql` — Zamanlanmış görev tabloları
7. `add-agent-groups.sql` — Agent grup alanı (migrasyon)
8. `seed-admin.ts` — Varsayılan admin kullanıcısını oluşturur

## Kurulum ve Çalıştırma

```bash
cd server
pnpm install

# Veritabanı kurulumu (PostgreSQL çalışıyor olmalı)
psql -U postgres -d kovan -f scripts/init-db.sql
psql -U postgres -d kovan -f scripts/init-auth.sql
psql -U postgres -d kovan -f scripts/init-permissions.sql
pnpm run db:seed

# Geliştirme modunda başlatma
pnpm run dev

# CVE verilerini içe aktarma
pnpm run db:import
```

Sunucu varsayılan olarak `4444` portunda başlar.

## Testler

```bash
cd server
bun test
```

Testler sunucuyu alt süreç olarak başlatır, API ve WebSocket senaryolarını doğrular, sonra kapatır.

## Bellekte Tutulan Veriler

Agent bağlantı bilgileri, aktif WebSocket bağlantıları ve keylogger verileri bellekte saklanır. Sunucu yeniden başlatıldığında bu veriler sıfırlanır. CVE verileri, kullanıcı hesapları ve izinler PostgreSQL'de kalıcı olarak tutulur.
