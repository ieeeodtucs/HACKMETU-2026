package tr.org.lider.messaging.listeners;

import java.text.SimpleDateFormat;
import java.util.regex.Pattern;

import org.jivesoftware.smack.SmackException.NotConnectedException;
import org.jivesoftware.smack.StanzaListener;
import org.jivesoftware.smack.filter.StanzaFilter;
import org.jivesoftware.smack.packet.Message;
import org.jivesoftware.smack.packet.Stanza;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;

import tr.org.lider.message.service.IMessagingService;
import tr.org.lider.messaging.messages.GetPoliciesMessageImpl;
import tr.org.lider.messaging.messages.IExecutePoliciesMessage;
import tr.org.lider.messaging.subscribers.IPolicySubscriber;

/**
 * Get policies listener is responsible for sending (machine and user) policies
 * to agent.
 * 
 */
@Component
public class PolicyListener implements StanzaListener, StanzaFilter {

	private static Logger logger = LoggerFactory.getLogger(PolicyListener.class);

	@Autowired
	private IMessagingService messagingService;
	
	/**
	 * Pattern used to filter messages
	 */
	private static final Pattern messagePattern = Pattern.compile(".*\\\"type\\\"\\s*:\\s*\\\"GET_POLICIES\\\".*",
			Pattern.CASE_INSENSITIVE);
	
	/**
	 * Message subscriber
	 */
	private IPolicySubscriber subscriber;
	
	public PolicyListener(IMessagingService messagingService) {
		this.messagingService = messagingService;
	}

	@Override
	public boolean accept(Stanza stanza) {
		if (stanza instanceof Message) {
			Message msg = (Message) stanza;
			// All messages from agents are type normal
			// Message body must contain one of these strings => "type":
			// "GET_POLICIES"
			if (Message.Type.normal.equals(msg.getType()) && messagePattern.matcher(msg.getBody()).matches()) {
				return true;
			}
		}
		return false;
	}

	@Override
	public void processPacket(Stanza packet) throws NotConnectedException {
		try {
			if (packet instanceof Message) {

				Message msg = (Message) packet;
				logger.info("Policy message received from => {}, body => {}", msg.getFrom(), msg.getBody());

				ObjectMapper mapper = new ObjectMapper();
				mapper.setDateFormat(new SimpleDateFormat("dd-MM-yyyy HH:mm"));

				// Construct message
				GetPoliciesMessageImpl message = mapper.readValue(msg.getBody(), GetPoliciesMessageImpl.class);
				message.setFrom(msg.getFrom());
				if (subscriber != null) {
					IExecutePoliciesMessage responseExecutePoliciesMessageList = subscriber.messageReceived(message);
					logger.debug("Notified subscriber => {}", subscriber);
					messagingService.sendMessage(new ObjectMapper().writeValueAsString(responseExecutePoliciesMessageList), msg.getFrom());
				}
			}
		} catch (Exception e) {
			logger.error(e.getMessage(), e);
		}
	}

	/**
	 * 
	 * @param subscriber
	 */
	public void setSubscriber(IPolicySubscriber subscriber) {
		this.subscriber = subscriber;
	}

}
