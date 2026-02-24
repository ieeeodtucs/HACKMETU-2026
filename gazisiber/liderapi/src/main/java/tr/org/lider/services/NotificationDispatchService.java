package tr.org.lider.services;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import tr.org.lider.models.ConfigParams;
import tr.org.lider.models.notification.NotificationChannel;
import tr.org.lider.models.notification.NotificationSettings;

/**
 * Central dispatcher for event-driven notifications.
 * <p>
 * Call {@link #dispatch(String, String, String)} when a system event occurs.
 * The service reads the current {@link NotificationSettings}, finds every
 * active
 * channel that subscribed to the given trigger ID, and sends the notification
 * through {@link AppriseNotificationService}.
 * </p>
 *
 * <pre>
 * // Example usage inside a subscriber / service:
 * notificationDispatchService.dispatch("task.completed", "Görev Tamamlandı", "Plugin: browser-history");
 * </pre>
 */
@Service
public class NotificationDispatchService {

    private static final Logger logger = LoggerFactory.getLogger(NotificationDispatchService.class);

    @Autowired
    private ConfigurationService configurationService;

    @Autowired
    private AppriseNotificationService appriseNotificationService;

    /**
     * Finds all active channels subscribed to {@code triggerId} and sends
     * {@code title} / {@code body} through each channel's services.
     *
     * @param triggerId the event ID (e.g. {@code "task.completed"})
     * @param title     short notification title
     * @param body      notification body / detail
     */
    @Async
    public void dispatch(String triggerId, String title, String body) {
        if (triggerId == null || triggerId.isEmpty()) {
            return;
        }

        try {
            ConfigParams configParams = configurationService.getConfigParams();
            if (configParams == null) {
                return;
            }

            NotificationSettings settings = configParams.getNotificationSettings();
            if (settings == null) {
                return;
            }

            List<NotificationChannel> channels = settings.getChannels();
            if (channels == null || channels.isEmpty()) {
                return;
            }

            for (NotificationChannel channel : channels) {
                if (!Boolean.TRUE.equals(channel.getIsActive())) {
                    continue;
                }
                List<String> triggerIds = channel.getTriggerIds();
                if (triggerIds == null || !triggerIds.contains(triggerId)) {
                    continue;
                }
                logger.debug("Dispatching notification for trigger '{}' to channel '{}'", triggerId, channel.getName());
                appriseNotificationService.sendToChannel(channel, title, body);
            }
        } catch (Exception e) {
            logger.error("Failed to dispatch notification for trigger '{}': {}", triggerId, e.getMessage(), e);
        }
    }
}
