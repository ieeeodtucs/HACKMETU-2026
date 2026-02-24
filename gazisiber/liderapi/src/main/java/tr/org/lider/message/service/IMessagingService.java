package tr.org.lider.message.service;

import java.io.IOException;

import org.jivesoftware.smack.SmackException.NotConnectedException;

import com.fasterxml.jackson.core.JsonGenerationException;
import com.fasterxml.jackson.databind.JsonMappingException;

import tr.org.lider.messaging.messages.ILiderMessage;

/**
 * Main interface for messaging service</b>.
 * 
 * @author <a href="mailto:hasan.kara@pardus.org.tr">Hasan Kara</a>
 * 
 */
public interface IMessagingService {
	
	void init() throws Exception;
	
	void messageReceived(ILiderMessage message);
	
	void sendMessage(ILiderMessage message) throws NotConnectedException, JsonGenerationException, JsonMappingException, IOException;
	
	//for xmpp
	void sendMessage(String message, String jid) throws NotConnectedException;
	
	//for xmpp
	void sendChatMessage(String message, String jid) throws NotConnectedException;
	
	boolean isRecipientOnline(String jid);
	
	String getFullJid(String jid);
	
	void addClientToRoster(String jid);
	
	void disconnect();
	
}
