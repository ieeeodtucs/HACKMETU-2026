package tr.org.lider.services;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import tr.org.lider.models.notification.NotificationChannel;
import tr.org.lider.models.notification.NotificationServiceConfig;
import tr.org.lider.models.notification.NotificationServiceTestResult;
import tr.org.lider.models.notification.NotificationTestStatus;

@Service
public class AppriseNotificationService {

    private static final Logger logger = LoggerFactory.getLogger(AppriseNotificationService.class);

    @Value("${apprise.api.url:http://localhost:8000}")
    private String appriseApiUrl;

    @Autowired
    private RestTemplate restTemplate;

    public void sendToChannel(NotificationChannel channel, String title, String body) {
        if (channel == null || !Boolean.TRUE.equals(channel.getIsActive())) {
            return;
        }

        List<String> urls = new ArrayList<>();
        for (NotificationServiceConfig service : channel.getServices()) {
            if (!Boolean.TRUE.equals(service.getEnabled())) {
                continue;
            }
            String url = buildAppriseUrl(service);
            if (url != null && !url.isEmpty()) {
                urls.add(url);
            }
        }

        if (!urls.isEmpty()) {
            doPost(title, body, urls);
        }
    }

    public NotificationServiceTestResult testService(NotificationServiceConfig service, String title, String body) {
        NotificationServiceTestResult result = new NotificationServiceTestResult();
        String testedAt = new java.util.Date().toString();

        String url = buildAppriseUrl(service);
        if (url == null || url.isEmpty()) {
            result.setStatus(NotificationTestStatus.FAILED);
            result.setMessage("Service configuration is missing or invalid");
            result.setTestedAt(testedAt);
            return result;
        }

        boolean success = doPost(title, body, Collections.singletonList(url));
        result.setStatus(success ? NotificationTestStatus.SUCCESS : NotificationTestStatus.FAILED);
        result.setMessage(success ? "Notification sent successfully" : "Failed to send notification");
        result.setTestedAt(testedAt);
        return result;
    }

    // ── URL builders ────────────────────────────────────────────────────

    String buildAppriseUrl(NotificationServiceConfig service) {
        if (service == null || service.getType() == null) {
            return null;
        }

        Map<String, Object> s = service.getSettings();
        if (s == null) {
            return null;
        }

        switch (service.getType()) {
            case APPRISE:    return str(s, "url");
            case WEBHOOK:    return str(s, "url");
            case EMAIL:      return buildEmail(s);
            case FCM:        return buildFcm(s);
            case GOOGLECHAT: return buildGoogleChat(s);
            case JIRA:       return buildJira(s);
            case MATRIX:     return buildMatrix(s);
            case MASTODON:   return buildMastodon(s);
            case MATTERMOST: return buildMattermost(s);
            case MSTEAMS:    return buildMsTeams(s);
            case NEXTCLOUDTALK: return buildNextcloudTalk(s);
            case ROCKETCHAT: return buildRocketChat(s);
            case SIGNAL:     return buildSignal(s);
            case SLACK:      return buildSlack(s);
            case SMTP2GO:    return buildSmtp2go(s);
            case TELEGRAM:   return buildTelegram(s);
            case WHATSAPP:   return buildWhatsApp(s);
            case ZULIP:      return buildZulip(s);
            case DISCORD:    return buildDiscord(s);
            default:         return null;
        }
    }

    // mailto://{user}:{pass}@{domain}?smtp={smtp}&port={port}&from={from}&to={to1},{to2}&cc={cc}&bcc={bcc}
    private String buildEmail(Map<String, Object> s) {
        String user = str(s, "user");
        String password = str(s, "password");
        String domain = str(s, "domain");
        if (user == null || password == null || domain == null) return null;

        StringBuilder url = new StringBuilder("mailtos://")
                .append(user).append(":").append(password).append("@").append(domain);

        String port = str(s, "port");
        if (port != null) url.append(":").append(port);

        List<String> params = new ArrayList<>();
        String smtp = str(s, "smtp");
        if (smtp != null) params.add("smtp=" + smtp);
        String from = str(s, "from");
        if (from != null) params.add("from=" + from);
        List<String> to = repeatList(s, "to");
        if (!to.isEmpty()) params.add("to=" + String.join(",", to));
        List<String> cc = repeatList(s, "cc");
        if (!cc.isEmpty()) params.add("cc=" + String.join(",", cc));
        List<String> bcc = repeatList(s, "bcc");
        if (!bcc.isEmpty()) params.add("bcc=" + String.join(",", bcc));

        if (!params.isEmpty()) url.append("?").append(String.join("&", params));
        return url.toString();
    }

    // fcm://{APIKey}/{Device1}/{Device2}
    private String buildFcm(Map<String, Object> s) {
        String apiKey = str(s, "apiKey");
        if (apiKey == null) return null;
        List<String> devices = repeatList(s, "devices");
        if (devices.isEmpty()) return null;
        return "fcm://" + apiKey + "/" + String.join("/", devices);
    }

    // gchat://{workspace}/{webhookKey}/{webhookToken}
    private String buildGoogleChat(Map<String, Object> s) {
        String workspace = str(s, "workspace");
        String webhookKey = str(s, "webhookKey");
        String webhookToken = str(s, "webhookToken");
        if (workspace == null || webhookKey == null || webhookToken == null) return null;
        return "gchat://" + workspace + "/" + webhookKey + "/" + webhookToken;
    }

    // jira://{apikey}  jira://{apikey}/{target1}/{target2}
    private String buildJira(Map<String, Object> s) {
        String apiKey = str(s, "apiKey");
        if (apiKey == null) return null;
        StringBuilder url = new StringBuilder("jira://").append(apiKey);
        List<String> targets = repeatList(s, "targets");
        for (String t : targets) url.append("/").append(t);
        return url.toString();
    }

    // matrix://{user}:{password}@{hostname}/#{room_alias}
    private String buildMatrix(Map<String, Object> s) {
        String user = str(s, "user");
        String password = str(s, "password");
        String hostname = str(s, "hostname");
        String roomAlias = str(s, "roomAlias");
        if (user == null || password == null || hostname == null || roomAlias == null) return null;
        String room = roomAlias.startsWith("#") || roomAlias.startsWith("!")
                ? roomAlias : "#" + roomAlias;
        return "matrix://" + user + ":" + password + "@" + hostname + "/" + room;
    }

    // mastodon://{token}@{host}/{target1}/{target2}
    private String buildMastodon(Map<String, Object> s) {
        String token = str(s, "token");
        String host = str(s, "host");
        if (token == null || host == null) return null;
        StringBuilder url = new StringBuilder("mastodons://").append(token).append("@").append(host);
        List<String> targets = repeatList(s, "targets");
        for (String t : targets) url.append("/").append(t);
        return url.toString();
    }

    // mmost://{botname}@{hostname}:{port}/{token}
    private String buildMattermost(Map<String, Object> s) {
        String hostname = str(s, "hostname");
        String token = str(s, "token");
        if (hostname == null || token == null) return null;
        StringBuilder url = new StringBuilder("mmost://");
        String botname = str(s, "botname");
        if (botname != null) url.append(botname).append("@");
        url.append(hostname);
        String port = str(s, "port");
        if (port != null) url.append(":").append(port);
        url.append("/").append(token);
        String channel = str(s, "channel");
        if (channel != null) url.append("/").append(channel);
        return url.toString();
    }

    // msteams://{team}/{tokenA}/{tokenB}/{tokenC}
    private String buildMsTeams(Map<String, Object> s) {
        String team = str(s, "team");
        String tokenA = str(s, "tokenA");
        String tokenB = str(s, "tokenB");
        String tokenC = str(s, "tokenC");
        if (team == null || tokenA == null || tokenB == null || tokenC == null) return null;
        return "msteams://" + team + "/" + tokenA + "/" + tokenB + "/" + tokenC;
    }

    // nctalk://{user}:{password}@{hostname}/{room_id}
    private String buildNextcloudTalk(Map<String, Object> s) {
        String user = str(s, "user");
        String password = str(s, "password");
        String hostname = str(s, "hostname");
        String roomId = str(s, "roomId");
        if (user == null || password == null || hostname == null || roomId == null) return null;
        StringBuilder url = new StringBuilder("nctalk://")
                .append(user).append(":").append(password).append("@").append(hostname);
        String port = str(s, "port");
        if (port != null) url.append(":").append(port);
        url.append("/").append(roomId);
        return url.toString();
    }

    // rocket://{user}:{password}@{hostname}/{target}  OR  rocket://{webhook}@{hostname}/{target}
    private String buildRocketChat(Map<String, Object> s) {
        String hostname = str(s, "hostname");
        if (hostname == null) return null;
        List<String> targets = repeatList(s, "targets");
        if (targets.isEmpty()) return null;

        StringBuilder url = new StringBuilder("rocket://");
        String webhook = str(s, "webhook");
        if (webhook != null) {
            url.append(webhook).append("@").append(hostname);
        } else {
            String user = str(s, "user");
            String password = str(s, "password");
            if (user == null || password == null) return null;
            url.append(user).append(":").append(password).append("@").append(hostname);
        }
        for (String t : targets) url.append("/").append(t);
        return url.toString();
    }

    // signal://{user}:{password}@{hostname}/{from_phone}/{target}
    private String buildSignal(Map<String, Object> s) {
        String user = str(s, "user");
        String password = str(s, "password");
        String hostname = str(s, "hostname");
        String fromPhone = str(s, "fromPhone");
        if (user == null || password == null || hostname == null || fromPhone == null) return null;
        StringBuilder url = new StringBuilder("signal://")
                .append(user).append(":").append(password).append("@").append(hostname)
                .append("/").append(fromPhone);
        List<String> targets = repeatList(s, "targets");
        for (String t : targets) url.append("/").append(t);
        return url.toString();
    }

    // slack://{tokenA}/{tokenB}/{tokenC}
    private String buildSlack(Map<String, Object> s) {
        String tokenA = str(s, "tokenA");
        String tokenB = str(s, "tokenB");
        String tokenC = str(s, "tokenC");
        if (tokenA == null || tokenB == null || tokenC == null) return null;
        return "slack://" + tokenA + "/" + tokenB + "/" + tokenC;
    }

    // smtp2go://{user}@{domain}/{apikey}/{email1}/{email2}
    private String buildSmtp2go(Map<String, Object> s) {
        String user = str(s, "user");
        String domain = str(s, "domain");
        String apiKey = str(s, "apiKey");
        if (user == null || domain == null || apiKey == null) return null;
        StringBuilder url = new StringBuilder("smtp2go://")
                .append(user).append("@").append(domain).append("/").append(apiKey);
        List<String> to = repeatList(s, "to");
        for (String email : to) url.append("/").append(email);
        return url.toString();
    }

    // tgram://{bot_token}/{chat_id1}/{chat_id2}
    private String buildTelegram(Map<String, Object> s) {
        String botToken = str(s, "botToken");
        if (botToken == null) return null;
        StringBuilder url = new StringBuilder("tgram://").append(botToken);
        List<String> chatIds = repeatList(s, "chatIds");
        for (String id : chatIds) url.append("/").append(id);
        return url.toString();
    }

    // whatsapp://{token}@{from_phone_id}/{target1}/{target2}
    private String buildWhatsApp(Map<String, Object> s) {
        String token = str(s, "token");
        String fromPhoneId = str(s, "fromPhoneId");
        if (token == null || fromPhoneId == null) return null;
        StringBuilder url = new StringBuilder("whatsapp://")
                .append(token).append("@").append(fromPhoneId);
        List<String> targets = repeatList(s, "targets");
        for (String t : targets) url.append("/").append(t);
        return url.toString();
    }

    // zulip://{botname}@{organization}/{token}/{target}
    private String buildZulip(Map<String, Object> s) {
        String botname = str(s, "botname");
        String organization = str(s, "organization");
        String token = str(s, "token");
        if (botname == null || organization == null || token == null) return null;
        StringBuilder url = new StringBuilder("zulip://")
                .append(botname).append("@").append(organization)
                .append("/").append(token);
        List<String> targets = repeatList(s, "targets");
        for (String t : targets) url.append("/").append(t);
        return url.toString();
    }

    // discord://{WebhookID}/{WebhookToken}
    private String buildDiscord(Map<String, Object> s) {
        String webhookId = str(s, "webhookId");
        String webhookToken = str(s, "webhookToken");
        if (webhookId == null || webhookToken == null) return null;
        return "discord://" + webhookId + "/" + webhookToken;
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    private String str(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val == null) return null;
        String s = val.toString().trim();
        return s.isEmpty() ? null : s;
    }

    @SuppressWarnings("unchecked")
    private List<String> repeatList(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val == null) return Collections.emptyList();
        if (val instanceof List) {
            List<String> result = new ArrayList<>();
            for (Object item : (List<Object>) val) {
                if (item != null && !item.toString().trim().isEmpty()) {
                    result.add(item.toString().trim());
                }
            }
            return result;
        }
        String s = val.toString().trim();
        if (s.isEmpty()) return Collections.emptyList();
        List<String> result = new ArrayList<>();
        for (String part : s.split(",")) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) result.add(trimmed);
        }
        return result;
    }

    // ── HTTP ────────────────────────────────────────────────────────────

    private boolean doPost(String title, String body, List<String> urls) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> payload = new HashMap<>();
            payload.put("urls", urls);
            payload.put("title", title);
            payload.put("body", body);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(
                    appriseApiUrl + "/notify/", request, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                logger.info("Apprise notification sent. Title: {}, URLs: {}", title, urls.size());
                return true;
            } else {
                logger.warn("Apprise returned status: {}", response.getStatusCode());
                return false;
            }
        } catch (Exception e) {
            logger.error("Apprise notification failed: {}", e.getMessage(), e);
            return false;
        }
    }
}
