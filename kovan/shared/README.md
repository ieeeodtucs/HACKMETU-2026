# Paylaşılan Tipler (Shared)

Sunucu ve ön yüz arasında ortaklaşa kullanılan TypeScript tip tanımlarını barındırır.

## Amaç

Sunucu ve ön yüz projelerinin aynı veri yapılarını kullanmasını garanti altına alır. Bir alanda yapılan değişiklik derleme zamanında diğer tarafta da fark edilir ve tutarsızlıkların önüne geçilir.

## İçerik

`src/index.ts` dosyasında tanımlı başlıca tipler:

- **Agent** — Agent kimlik bilgileri (id, hostname, alias, os, ip, username, group, isOnline, lastSeen)
- **Command** — Gönderilen komut ve sonucu (commandId, agentId, command, output, error, timestamp)
- **WSMessage** — WebSocket mesaj zarfı (type + payload)
- **RegisterData** — Agent kayıt verisi (hostname, os, username, ip)
- **CommandData** — Sunucudan agente gönderilen komut verisi (commandId, command)
- **ResultData** — Agentten sunucuya dönen sonuç verisi (commandId, output, error)

## Kullanım

Sunucu ve ön yüz projelerinde bu paket doğrudan içe aktarılarak kullanılır:

```typescript
import type { Agent, Command, WSMessage } from "../../shared/src";
```

## Bakım Notu

Bu dosyada yapılacak her değişiklik hem sunucu hem ön yüz tarafını etkiler. Yeni bir alan eklerken veya mevcut bir alanı değiştirirken her iki tarafın da güncellendiğinden emin olun.
