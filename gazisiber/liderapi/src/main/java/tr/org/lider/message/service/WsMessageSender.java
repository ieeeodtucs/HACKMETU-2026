package tr.org.lider.message.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class WsMessageSender {
	private SimpMessagingTemplate messagingTemplate;

	@Autowired
	public WsMessageSender(SimpMessagingTemplate messagingTemplate) {
		this.messagingTemplate = messagingTemplate;
	}

	public void sendMessage(String destination, Object payload) {
		messagingTemplate.convertAndSend(destination, payload);
	}
}
