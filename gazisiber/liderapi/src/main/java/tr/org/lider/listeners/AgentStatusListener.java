package tr.org.lider.listeners;

import java.util.Date;
import java.util.List;

import org.jivesoftware.smack.packet.Presence;
import org.jivesoftware.smack.packet.Presence.Type;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.jivesoftware.smack.packet.Stanza;
import org.jivesoftware.smack.roster.RosterListener;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import tr.org.lider.entities.AgentImpl;
import tr.org.lider.entities.AgentStatus;
import tr.org.lider.messaging.listeners.OnlineRosterListener;
import tr.org.lider.messaging.subscribers.IPresenceSubscriber;
import tr.org.lider.repositories.AgentRepository;
import tr.org.lider.services.AgentService;


@Component
public class AgentStatusListener implements IPresenceSubscriber {
	
	private Logger logger = LoggerFactory.getLogger(OnlineRosterListener.class);

	@Autowired
	private AgentService agentService;
	
	@Autowired
	private AgentRepository agentRepository;

	@Override
	public void onAgentOnline(String jid) {
		String strJid = jid.split("@")[0];
		
		List<AgentImpl> agents = agentService.findAgentByJid(strJid);
		if (!agents.isEmpty()) {
			AgentImpl agent = agents.get(0);
			agent.setEventDate(new Date());
			agent.setAgentStatus(AgentStatus.Active);
			agentRepository.save(agent);
		}
		
	}

	@Override
	public void onAgentOffline(String jid) {
		String strJid = jid.split("@")[0];
		
		List<AgentImpl> agents = agentService.findAgentByJid(strJid);
		if (!agents.isEmpty()) {
			AgentImpl agent = agents.get(0);
			agent.setEventDate(new Date());
			//agent.setAgentStatus(AgentStatus.Passive);
			agentRepository.save(agent);
		}
		
	}

	@Override
	public void onAgentActive(String jid) {
		// TODO Auto-generated method stub
		
	}

	@Override
	public void onAgentPassive(String jid) {
		// TODO Auto-generated method stub
		
	}

}
