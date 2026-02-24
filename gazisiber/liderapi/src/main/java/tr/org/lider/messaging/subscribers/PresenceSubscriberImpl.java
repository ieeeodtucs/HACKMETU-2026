package tr.org.lider.messaging.subscribers;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import tr.org.lider.services.NotificationBodyBuilder;
import tr.org.lider.services.NotificationDispatchService;

@Component
public class PresenceSubscriberImpl implements IPresenceSubscriber {

	@Autowired
	private NotificationDispatchService notificationDispatchService;

	@Override
	public void onAgentOnline(String jid) {
		notificationDispatchService.dispatch("agent.online", "İstemci Çevrimiçi: " + jid,
				new NotificationBodyBuilder()
						.field("İstemci", jid)
						.build());
	}

	@Override
	public void onAgentOffline(String jid) {
		notificationDispatchService.dispatch("agent.offline", "İstemci Çevrimdışı: " + jid,
				new NotificationBodyBuilder()
						.field("İstemci", jid)
						.build());
	}

	@Override
	public void onAgentActive(String jid) {

	}

	@Override
	public void onAgentPassive(String jid) {

	}

}
