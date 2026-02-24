package tr.org.lider.services;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;

import javax.servlet.http.HttpServletRequest;

import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Builds structured, human-readable notification body strings.
 * <p>
 * Call-sites add trigger-specific fields via {@link #field(String, String)}.
 * {@link #build()} auto-appends common context (acting user, client IP,
 * timestamp) when available.
 * </p>
 *
 * <pre>
 * String body = new NotificationBodyBuilder()
 *         .field("Görev", "Paket Kur")
 *         .field("Hedef", "cn=test,ou=Agents")
 *         .build();
 * // Result:
 * // Görev: Paket Kur
 * // Hedef: cn=test,ou=Agents
 * // İşlemi Yapan: admin
 * // IP: 192.168.1.100
 * // Tarih: 22/02/2026 15:30:00
 * </pre>
 */
public class NotificationBodyBuilder {

    private static final String DATE_FORMAT = "dd/MM/yyyy HH:mm:ss";

    private final LinkedHashMap<String, String> fields = new LinkedHashMap<>();

    public NotificationBodyBuilder field(String label, String value) {
        if (label != null && value != null && !value.isEmpty()) {
            fields.put(label, value);
        }
        return this;
    }

    /**
     * Builds the final body string.
     * Appends acting user (from Spring Security context), client IP
     * (from current HTTP request), and current timestamp automatically.
     */
    public String build() {
        appendUser();
        appendIp();
        appendTimestamp();

        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> entry : fields.entrySet()) {
            if (sb.length() > 0) {
                sb.append("\n");
            }
            sb.append(entry.getKey()).append(": ").append(entry.getValue());
        }
        return sb.toString();
    }

    private void appendUser() {
        try {
            if (AuthenticationService.isLogged()) {
                String username = AuthenticationService.getUserName();
                if (username != null && !username.isEmpty()) {
                    fields.put("İşlemi Yapan", username);
                }
            }
        } catch (Exception ignored) {
        }
    }

    private void appendIp() {
        try {
            RequestAttributes attrs = RequestContextHolder.getRequestAttributes();
            if (attrs instanceof ServletRequestAttributes) {
                HttpServletRequest request = ((ServletRequestAttributes) attrs).getRequest();
                String ip = request.getHeader("X-Forwarded-For");
                if (ip != null && !ip.isEmpty()) {
                    ip = ip.split(",")[0].trim();
                } else {
                    ip = request.getRemoteAddr();
                }
                if (ip != null && !ip.isEmpty()) {
                    fields.put("IP", ip);
                }
            }
        } catch (Exception ignored) {
        }
    }

    private void appendTimestamp() {
        fields.put("Tarih", new SimpleDateFormat(DATE_FORMAT).format(new Date()));
    }
}
