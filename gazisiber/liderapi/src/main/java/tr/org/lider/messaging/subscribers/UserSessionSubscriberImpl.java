package tr.org.lider.messaging.subscribers;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.directory.api.ldap.model.exception.LdapException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import tr.org.lider.entities.AgentImpl;
import tr.org.lider.entities.AgentPropertyImpl;
import tr.org.lider.entities.AgentStatus;
import tr.org.lider.entities.SessionEvent;
import tr.org.lider.entities.UserSessionImpl;
import tr.org.lider.ldap.ILDAPService;
import tr.org.lider.ldap.LDAPServiceImpl;
import tr.org.lider.ldap.LdapEntry;
import tr.org.lider.ldap.LdapSearchFilterAttribute;
import tr.org.lider.ldap.SearchFilterEnum;
import tr.org.lider.messaging.enums.AgentMessageType;
import tr.org.lider.messaging.enums.DomainType;
import tr.org.lider.messaging.enums.SudoRoleType;
import tr.org.lider.messaging.messages.ILiderMessage;
import tr.org.lider.messaging.messages.IUserSessionMessage;
import tr.org.lider.messaging.messages.UserSessionResponseMessageImpl;
import tr.org.lider.repositories.AgentRepository;
import tr.org.lider.repositories.UserSessionRepository;
import tr.org.lider.services.AdService;
import tr.org.lider.services.ConfigurationService;
import tr.org.lider.services.NotificationBodyBuilder;
import tr.org.lider.services.NotificationDispatchService;

/**
 * <p>
 * Provides default user login/logout event handler in case no other bundle
 * provides its user session subscriber.
 * </p>
 * 
 * @see tr.org.liderahenk.lider.core.api.messaging.IUserSessionMessage
 */

@Component
public class UserSessionSubscriberImpl implements IUserSessionSubscriber {

	private static Logger logger = LoggerFactory.getLogger(UserSessionSubscriberImpl.class);

	@Autowired
	private AgentRepository agentRepository;
	
	@Autowired
	private UserSessionRepository userSessionRepository;

	@Autowired
	private ConfigurationService configurationService;

	@Autowired
	private LDAPServiceImpl ldapService;
	
	@Autowired
	private AdService adService;

	@Autowired
	private NotificationDispatchService notificationDispatchService;

	@Override
	public ILiderMessage messageReceived(IUserSessionMessage message) throws Exception {

		String uid = message.getFrom().split("@")[0];
		logger.info("User {} to agent... User Name: {} , Agent : {}", message.getType(), message.getUsername(), uid);
		// Find related agent
		List<AgentImpl> agents = agentRepository.findByJid(uid);

		if (agents != null && agents.size() > 0) {

			AgentImpl agent = agents.get(0);
			// Add new user session info
			UserSessionImpl userSession = new UserSessionImpl(null, null, message.getUsername(), message.getUserIp(),
					getSessionEvent(message.getType()), new Date());
			if (message.getType() == AgentMessageType.LOGIN
					&& (message.getIpAddresses() == null || message.getIpAddresses().isEmpty())) {
				logger.warn("Couldn't find IP addresses of the agent with JID: {}", uid);
			}

			if (message.getType() == AgentMessageType.LOGIN) {
				for (AgentPropertyImpl prop : agent.getProperties()) {
					if (prop.getPropertyName().equals("hardware.disk.total")
							&& !prop.getPropertyValue().equals("0")
							&& Integer.parseInt(prop.getPropertyValue()) != message.getDiskTotal()) {
						logger.info("Total disk size of Agent with ID {} has been changed. Updating in DB", agent.getId());
						prop.setPropertyValue(String.valueOf(message.getDiskTotal()));
					} else if (prop.getPropertyName().equals("hardware.disk.used")
							&& !prop.getPropertyValue().equals("0")
							&& Integer.parseInt(prop.getPropertyValue()) != message.getDiskUsed()) {
						logger.info("Used disk size of Agent with ID {} has been changed. Updating in DB", agent.getId());
						prop.setPropertyValue(String.valueOf(message.getDiskUsed()));
					} else if (prop.getPropertyName().equals("hardware.disk.free")
							&& !prop.getPropertyValue().equals("0")
							&& Integer.parseInt(prop.getPropertyValue()) != message.getDiskFree()) {
						logger.info("Free disk size of Agent with ID {s} has been changed. Updating in DB", agent.getId());
						prop.setPropertyValue(String.valueOf(message.getDiskFree()));
					} else if (prop.getPropertyName().equals("hardware.memory.total")
							&& !prop.getPropertyValue().equals("0")
							&& Integer.parseInt(prop.getPropertyValue()) != message.getMemory()) {
						logger.info("Memory size of Agent with ID {} has been changed. Updating in DB", agent.getId());
						prop.setPropertyValue(String.valueOf(message.getMemory()));
					} else if (message.getOsVersion() != null 
							&& prop.getPropertyName().equals("os.version") 
							&& !prop.getPropertyValue().equals(message.getOsVersion())) {
						logger.info("OS Version of Agent with ID {} has been changed. Updating in DB", agent.getId());
						prop.setPropertyValue(message.getOsVersion());
					} else if (prop.getPropertyName().equals("hardware.network.ipAddresses")
							&& prop.getPropertyValue() != message.getIpAddresses()
							&& !agent.getIpAddresses().equals(message.getIpAddresses())) {
						logger.info("IP Addresses of Agent with ID {} has been changed. Updating in DB", agent.getId());
						prop.setPropertyValue(message.getIpAddresses());
						agent.setIpAddresses(message.getIpAddresses());
					} else if (message.getHostname() != null && !agent.getHostname().equals(message.getHostname())) {
						logger.info("Hostname of Agent with ID {} has been changed. Updating in DB", agent.getId());
						agent.setHostname(message.getHostname());
					} else if (prop.getPropertyName().equals("agentVersion")
							&& prop.getPropertyValue() != message.getAgentVersion()) {
						prop.setPropertyValue(message.getAgentVersion());
					}
					else if (prop.getPropertyName().equals("hardware.disk.ssd.info")
							&& prop.getPropertyValue() != message.getHardwareDiskSsdInfo()) {
						logger.info("Ssd of Agent with ID {} has been changed. Updating in DB", agent.getId());
						prop.setPropertyValue(message.getHardwareDiskSsdInfo());
					}
					else if (prop.getPropertyName().equals("hardware.disk.hdd.info")
							&& prop.getPropertyValue() != message.getHardwareDiskHddInfo()) {
						logger.info("Hdd of Agent with ID {} has been changed. Updating in DB", agent.getId());
						prop.setPropertyValue(message.getHardwareDiskHddInfo());
					}
				}
				if (isPropertyName(uid, "agentVersion") == false) {
					if (message.getAgentVersion()!= null) {
						agent.addProperty(new AgentPropertyImpl(null, agent, "agentVersion",
								message.getAgentVersion().toString(), new Date()));
					}
				}
				if (userSession.getUsername() != null) {
					ldapService.updateEntry(agent.getDn(), "o", userSession.getUsername());
				}
				
				if (isPropertyName(uid, "hardware.disk.ssd.info") == false) {
					if (message.getHardwareDiskSsdInfo()!= null) {
						agent.addProperty(new AgentPropertyImpl(null, agent, "hardware.disk.ssd.info",
								message.getHardwareDiskSsdInfo().toString(), new Date()));
					}
				}
				if (isPropertyName(uid, "hardware.disk.hdd.info") == false) {
					if (message.getHardwareDiskHddInfo()!= null) {
						agent.addProperty(new AgentPropertyImpl(null, agent, "hardware.disk.hdd.info",
								message.getHardwareDiskHddInfo().toString(), new Date()));
					}
				}
			}
			// Merge records
			agent.setLastLoginDate(new Date());
			agent.setAgentStatus(AgentStatus.Active);
			agent = agentRepository.save(agent);
			if (userSession.getUsername() != null) {
				userSession.setAgent(agent);
				userSessionRepository.save(userSession);
			}
			if (message.getType() == AgentMessageType.LOGIN) {
				notificationDispatchService.dispatch("user.session.login",
						"Kullanıcı Oturumu Açıldı: " + message.getUsername(),
						new NotificationBodyBuilder()
								.field("Kullanıcı", message.getUsername())
								.field("İstemci", uid)
								.build());
			}
			// find user authority for sudo role
			// if user has sudo role user get sudoRole on agent
			if (message.getType() == AgentMessageType.LOGIN) {
				List<LdapEntry> role = getUserRoleGroupList(configurationService.getUserLdapRolesDn(),
						userSession.getUsername(), message.getHostname());

				if (role != null && role.size() > 0) {
					Map<String, Object> params = new HashMap<>();
					return new UserSessionResponseMessageImpl(message.getFrom(), params, userSession.getUsername(),
							new Date());
				} else {
					logger.info("Logined user not in Sudo Role Groups. User = " + userSession.getUsername());
					return null;
				}
			} else {
				logger.info("Get message type is LOGUT from agent");
				notificationDispatchService.dispatch("user.session.logout",
						"Kullanıcı Oturumu Kapandı: " + message.getUsername(),
						new NotificationBodyBuilder()
								.field("Kullanıcı", message.getUsername())
								.field("İstemci", uid)
								.build());
				return null;
			}

		} else {
			logger.warn("Couldn't find the agent with JID: {}", uid);
			return null;
		}
	}

	private List<LdapEntry> getUserRoleGroupList(String userLdapRolesDn, String userName, String hostName)
			throws LdapException {
		List<LdapEntry> userAuthDomainGroupList = null;
		List<LdapSearchFilterAttribute> filterAttt = new ArrayList<>();
		try {
			if(configurationService.getSudoRoleType().equals(SudoRoleType.LDAP)) {
				filterAttt.add(new LdapSearchFilterAttribute("sudoUser", userName, SearchFilterEnum.EQ));
				filterAttt.add(new LdapSearchFilterAttribute("sudoHost", "ALL", SearchFilterEnum.EQ));
				logger.info("Serching for username " + userName + " in OU " + userLdapRolesDn);
				userAuthDomainGroupList = ldapService.search(userLdapRolesDn, filterAttt,
						new String[] { "cn", "dn", "sudoCommand", "sudoHost", "sudoUser" });
	
				if (userAuthDomainGroupList.size() == 0) {
					filterAttt = new ArrayList<>();
					filterAttt.add(new LdapSearchFilterAttribute("sudoUser", userName, SearchFilterEnum.EQ));
					filterAttt.add(new LdapSearchFilterAttribute("sudoHost", hostName, SearchFilterEnum.EQ));
	
					userAuthDomainGroupList = ldapService.search(userLdapRolesDn, filterAttt,
							new String[] { "cn", "dn", "sudoCommand", "sudoHost", "sudoUser" });
				}
			} else if(configurationService.getSudoRoleType().equals(SudoRoleType.ACTIVE_DIRECTORY)) {
				userAuthDomainGroupList = getUserRoleGroupListForAd(findUserDnForSudoRoleType(userName));
				if (userAuthDomainGroupList.size() == 0) {
					List<LdapEntry> groups = findGroups(findUserDnForSudoRoleType(userName), DomainType.ACTIVE_DIRECTORY);
					if (groups.size() > 0) {
						for (int i = 0; i < groups.size(); i++) {
							userAuthDomainGroupList = getUserRoleGroupListForAd(groups.get(i).getDistinguishedName());
							if (userAuthDomainGroupList.size() > 0) {
								break;
							}
						}
					}
				}
			} else {
				userAuthDomainGroupList = null;
			}
		} catch (Exception e) {
			e.printStackTrace();
			userAuthDomainGroupList = null;
		}
		return userAuthDomainGroupList;
	}
	
	private List<LdapEntry> getUserRoleGroupListForAd(String entryDn) throws LdapException {
		List<LdapEntry> userAuthDomainGroupList = null;
		List<LdapSearchFilterAttribute> filterAttt = new ArrayList<>();
		
		filterAttt.add(new LdapSearchFilterAttribute("objectClass", "group", SearchFilterEnum.EQ));
		filterAttt.add(new LdapSearchFilterAttribute("sAMAccountName", "sudo", SearchFilterEnum.EQ));
		filterAttt.add(new LdapSearchFilterAttribute("member", entryDn, SearchFilterEnum.EQ));
		String baseDn = adService.getADDomainName();
		userAuthDomainGroupList = adService.search(baseDn, filterAttt, new String[] {"*"});
		return userAuthDomainGroupList;
	}

	/**
	 * 
	 * @param type
	 * @return
	 */
	private SessionEvent getSessionEvent(AgentMessageType type) {
		switch (type) {
		case LOGIN:
			return SessionEvent.LOGIN;
		case LOGOUT:
			return SessionEvent.LOGOUT;
		default:
			return null;
		}
	}

	public ILDAPService getLdapService() {
		return ldapService;
	}

	public void setLdapService(LDAPServiceImpl ldapService) {
		this.ldapService = ldapService;
	}

	public Boolean isPropertyName(String agentUid, String propertyName) {
		Boolean isExist = false;
		List<AgentImpl> agents =  agentRepository.findByJid(agentUid);
		if (agents != null && agents.size() > 0) {
			AgentImpl agent = agents.get(0);
			for (AgentPropertyImpl prop : agent.getProperties()) {
				if (prop.getPropertyName().equals(propertyName)) {
					isExist = true;
				}
			}
		}
		return isExist;
	}
	
	/**
	 * Find user DN by given UID for only sudoRoleType
	 * 
	 * @param userUid
	 * @return
	 * @throws LdapException
	 */
	private String findUserDnForSudoRoleType(String userUid) throws LdapException {
		String userDN = null;
		if(configurationService.getSudoRoleType().equals(SudoRoleType.ACTIVE_DIRECTORY)) {
			List<LdapSearchFilterAttribute> filterAttributes = new ArrayList<LdapSearchFilterAttribute>();
			filterAttributes.add(new LdapSearchFilterAttribute("sAMAccountName", userUid, SearchFilterEnum.EQ));
			List<LdapEntry> users= adService.search(adService.getADDomainName(),filterAttributes, new String[] {"*"});
			if(users.size()>0) {
				userDN = users.get(0).getDistinguishedName();
			}
		} else if (configurationService.getSudoRoleType().equals(SudoRoleType.LDAP)) {
			userDN = ldapService.getDN(configurationService.getLdapRootDn(), configurationService.getUserLdapUidAttribute(),
					userUid);
		}
		return userDN;
	}
	
	private List<LdapEntry> findGroups(String userDn, DomainType domainType) throws LdapException {
		List<LdapSearchFilterAttribute> filterAttributesList = new ArrayList<LdapSearchFilterAttribute>();
		List<LdapEntry> groups = null;
		if(domainType.equals(DomainType.ACTIVE_DIRECTORY)) {
			filterAttributesList.add(new LdapSearchFilterAttribute("objectClass", "group", SearchFilterEnum.EQ));
			filterAttributesList.add(new LdapSearchFilterAttribute("member", userDn, SearchFilterEnum.EQ));
			String baseDn = adService.getADDomainName();
			groups = adService.search(baseDn, filterAttributesList, new String[] {"*"});
		}
		else {
			filterAttributesList.add(new LdapSearchFilterAttribute("objectClass", configurationService.getGroupLdapObjectClasses(), SearchFilterEnum.EQ));
			filterAttributesList.add(new LdapSearchFilterAttribute("member", userDn, SearchFilterEnum.EQ));
			groups = ldapService.search(configurationService.getLdapRootDn(), filterAttributesList, new String[] {"*"});
		}
		return groups;
	}
}
