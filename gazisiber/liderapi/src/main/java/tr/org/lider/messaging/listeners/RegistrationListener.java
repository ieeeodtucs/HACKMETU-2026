/*
*
*    Copyright © 2015-2016 Tübitak ULAKBIM
*
*    This file is part of Lider Ahenk.
*
*    Lider Ahenk is free software: you can redistribute it and/or modify
*    it under the terms of the GNU General Public License as published by
*    the Free Software Foundation, either version 3 of the License, or
*    (at your option) any later version.
*
*    Lider Ahenk is distributed in the hope that it will be useful,
*    but WITHOUT ANY WARRANTY; without even the implied warranty of
*    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
*    GNU General Public License for more details.
*
*    You should have received a copy of the GNU General Public License
*    along with Lider Ahenk.  If not, see <http://www.gnu.org/licenses/>.
*/
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
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;

import tr.org.lider.message.service.IMessagingService;
import tr.org.lider.messaging.messages.ILiderMessage;
import tr.org.lider.messaging.messages.RegistrationMessageImpl;
import tr.org.lider.messaging.subscribers.DefaultRegistrationSubscriberImpl;
import tr.org.lider.messaging.subscribers.HostNameRegistrationSubscriberImpl;
import tr.org.lider.messaging.subscribers.IPAddressRegistrationSubscriberImpl;
import tr.org.lider.messaging.subscribers.IRegistrationSubscriber;
import tr.org.lider.models.RegistrationTemplateType;
import tr.org.lider.services.ConfigurationService;


/**
 * RegistrationListener is responsible for listening to agent register messages.
 * It triggers {@link IRegistrationSubscriber} instance upon incoming register
 * messages. If there is no subscriber, it falls back to the default subscriber
 * to handle registration.
 *
 */
@Component
public class RegistrationListener implements StanzaListener, StanzaFilter {

	

	private static Logger logger = LoggerFactory.getLogger(RegistrationListener.class);

	/**
	 * Pattern used to filter messages
	 */
	private static final Pattern messagePattern = Pattern
			.compile(".*\\\"type\\\"\\s*:\\s*\\\"(REGISTER|UNREGISTER)\\\".*", Pattern.CASE_INSENSITIVE);

	/**
	 * Message subscriber
	 */
	private IRegistrationSubscriber subscriber;

	private ConfigurationService configurationService;
    
	private DefaultRegistrationSubscriberImpl defaultRegistrationSubscriberImpl;
	
	private HostNameRegistrationSubscriberImpl hostnameRegistrationSubscriberImpl;
	
	private IPAddressRegistrationSubscriberImpl ipAddressRegistrationSubscriberImpl;
	
	// TODO IMPROVEMENT: separate xmpp client into two classes. one for
	// configuration/setup, other for functional methods
	private IMessagingService client;

	public RegistrationListener(IMessagingService client, 
			ConfigurationService configurationService,
			HostNameRegistrationSubscriberImpl hostnameRegistrationSubscriberImpl,
			IPAddressRegistrationSubscriberImpl ipAddressRegistrationSubscriberImpl,
			DefaultRegistrationSubscriberImpl defaultRegistrationSubscriberImpl) {
		this.client = client;
		this.configurationService = configurationService;
		this.hostnameRegistrationSubscriberImpl = hostnameRegistrationSubscriberImpl;
		this.ipAddressRegistrationSubscriberImpl = ipAddressRegistrationSubscriberImpl;
		this.defaultRegistrationSubscriberImpl = defaultRegistrationSubscriberImpl;
	}
	
	@Override
	public boolean accept(Stanza stanza) {
		if (stanza instanceof Message) {
			Message msg = (Message) stanza;
			// All messages from agents are type normal
			// Message body must contain one of these strings => "type":
			// "REGISTER" or "type": "UNREGISTER"
			if (Message.Type.normal.equals(msg.getType()) && messagePattern.matcher(msg.getBody()).matches()) {
				return true;
			}
		}
		return false;
	}

	@Override
	public void processPacket(Stanza packet) throws NotConnectedException {

		ILiderMessage responseMessage = null;
		Message msg = null;

		try {
			if (packet instanceof Message) {

				msg = (Message) packet;
				logger.info("Register message received from => {}, body => {}", msg.getFrom(), msg.getBody());

				// Construct message
				ObjectMapper mapper = new ObjectMapper();
				mapper.setDateFormat(new SimpleDateFormat("dd-MM-yyyy HH:mm"));

				RegistrationMessageImpl message = mapper.readValue(msg.getBody(), RegistrationMessageImpl.class);
				// DO NOT modify 'message.from' property here! It indicates
				// non-anonymous JID to be registered.

				try {
					if(configurationService.getRegistrationTemplateType().equals(RegistrationTemplateType.HOSTNAME)) {
						setSubscriber(hostnameRegistrationSubscriberImpl);
					} else if(configurationService.getRegistrationTemplateType().equals(RegistrationTemplateType.IP_ADDRESS)) {
						setSubscriber(ipAddressRegistrationSubscriberImpl);
					} else {
						setSubscriber(defaultRegistrationSubscriberImpl);
					}
					responseMessage = subscriber.messageReceived(message);
					logger.debug("Notified subscriber => {}", subscriber);
					// Send registration (successful/error) message
					if (responseMessage != null) {
						client.sendMessage(new ObjectMapper().writeValueAsString(responseMessage), msg.getFrom());
					}

					// Send (optional) post-registration message
					ILiderMessage postRegistrationMessage = subscriber.postRegistration();
					if (postRegistrationMessage != null) {
						client.sendMessage(postRegistrationMessage);
					}
				} catch (Exception e) {
					logger.warn(e.getMessage(), e);
					logger.warn("Falling back to default subscriber.");
//					// Fall back to default subscriber if there is no other!
//					responseMessage = subscriber.messageReceived(message);
//					if (responseMessage != null) {
//						client.sendMessage(new ObjectMapper().writeValueAsString(responseMessage), msg.getFrom());
//					}
				}
			}
		} catch (Exception e) {
			logger.error(e.getMessage(), e);
		}
	}
	
	public IRegistrationSubscriber getSubscriber() {
		return subscriber;
	}

	public void setSubscriber(IRegistrationSubscriber subscriber) {
		this.subscriber = subscriber;
	}

	

}
