package tr.org.lider.services;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import tr.org.lider.entities.ConfigImpl;
import tr.org.lider.messaging.enums.DomainType;
import tr.org.lider.messaging.enums.Protocol;
import tr.org.lider.messaging.enums.SudoRoleType;
import tr.org.lider.messaging.messages.FileServerConf;
import tr.org.lider.models.ConfigParams;
import tr.org.lider.models.RegistrationTemplateType;
import tr.org.lider.models.notification.NotificationSettings;
import tr.org.lider.repositories.ConfigRepository;

/**
 * Service for getting configuration parameters from database.
 * 
 * @author <a href="mailto:hasan.kara@pardus.org.tr">Hasan Kara</a>
 * 
 */

@Service
public class ConfigurationService {

	Logger logger = LoggerFactory.getLogger(ConfigurationService.class);

	@Autowired
	ConfigRepository configRepository;

	@Autowired
	private Environment env;

	//for singleton
	private static ConfigParams configParams;

	public ConfigImpl save(ConfigImpl config) {
		//if configParams is updated delete configParams
		if(config.getName().equals("liderConfigParams")) {
			configParams = null;
		}
		return configRepository.save(config);
	}

	public ConfigParams updateConfigParams(ConfigParams cParams) {
		Optional<ConfigImpl> configImpl = findByName("liderConfigParams");
		if(configImpl.isPresent()) {
			try {
				if (cParams.getNotificationSettings() == null) {
					cParams.setNotificationSettings(new NotificationSettings());
				}
				ObjectMapper mapper = new ObjectMapper();
				String jsonString = mapper.writeValueAsString(cParams);
				configImpl.get().setValue(jsonString);
				ConfigImpl updatedConfigImpl = configRepository.save(configImpl.get());
				configParams = mapper.readValue(updatedConfigImpl.getValue(), ConfigParams.class);
				configParams.setAllowVNCConnectionWithoutPermission(getAllowVNCConnectionWithoutPermission());
				configParams.setAllowDynamicDNSUpdate(getAllowDynamicDNSUpdate());
				if (configParams.getNotificationSettings() == null) {
					configParams.setNotificationSettings(new NotificationSettings());
				}
				return configParams;
			} catch (JsonProcessingException e) {
				logger.error("Error occured while updating configuration parameters.");
				e.printStackTrace();
				return null;
			}
		} else {
			logger.error("Error occured while updating configuration parameters. liderConfigParams not found in database.");
			return null;
		}
	}
	public List<ConfigImpl> findAll() {
		return configRepository.findAll();
	}

	public Optional<ConfigImpl> findAgentByID(Long configID) {
		return configRepository.findById(configID);
	}

	public Optional<ConfigImpl> findByName(String name) {
		return configRepository.findByName(name);
	}

	public Optional<ConfigImpl> findByValue(String value) {
		return configRepository.findByValue(value);
	}

	public Optional<ConfigImpl> findByNameAndValue(String name, String value) {
		return configRepository.findByNameAndValue(name, value);
	}

	public void deleteByName(String name) {
		//if configParams is updated delete configParams
		if(name.equals("liderConfigParams")) {
			configParams = null;
		}
		configRepository.deleteByName(name);
	}
	public ConfigParams getConfigParams() {
		if (configParams == null) {
			try {
				ObjectMapper mapper = new ObjectMapper();
				if(findByName("liderConfigParams").isPresent()) {
					configParams = mapper.readValue(findByName("liderConfigParams").get().getValue(), ConfigParams.class);
					configParams.setAllowVNCConnectionWithoutPermission(getAllowVNCConnectionWithoutPermission());
					if (configParams.getNotificationSettings() == null) {
						configParams.setNotificationSettings(new NotificationSettings());
					}
					configParams.setXmppBoshAddress("http://"+configParams.getXmppHost()+":5280/bosh");
					return configParams;
				} else {
					return null;
				}
			} catch (JsonProcessingException e) {
				logger.error("Error occured while retrieving config params from db.");
				e.printStackTrace();
				return null;
			}
		} else {
			return configParams;
		}
	}
	
	public ConfigParams getConfigParamasNoPassword() {
		ConfigParams noPassword = getConfigParams();
		noPassword.setAdAdminPassword(null);
		noPassword.setLdapPassword(null);
		noPassword.setXmppPassword(null);
		noPassword.setFileServerPassword(null);
		noPassword.setMailPassword(null);
		
		return noPassword;
	}

	//if user logins to system recreate config params
	public void destroyConfigParams() {
		configParams = null;
	}
	public Boolean isConfigurationDone() {
		if(findByName("liderConfigParams").isPresent()) {
			return true;
		} else {
			return false;
		}
	}

	//config parameter get methods
	public String getLiderLocale() {
		return getConfigParams().getLiderLocale();
	}

	public String getLdapServer() {
		return getConfigParams().getLdapServer();
	}

	public String getLdapPort() {
		return getConfigParams().getLdapPort();
	}

	public String getLdapUsername() {
		return getConfigParams().getLdapUsername();
	}

	public String getLdapPassword() {
		return getConfigParams().getLdapPassword();
	}

	public String getLdapRootDn() {
		return getConfigParams().getLdapRootDn();
	}

	public Boolean getLdapUseSsl() {
		return getConfigParams().getLdapUseSsl();
	}

	public String getLdapSearchAttributes() {
		return getConfigParams().getLdapSearchAttributes();
	}

	public Boolean getLdapAllowSelfSignedCert() {
		return getConfigParams().getLdapAllowSelfSignedCert();
	}

	public String getLdapMailNotifierAttributes() {
		return getConfigParams().getLdapMailNotifierAttributes();
	}

	public String getLdapEmailAttribute() {
		return getConfigParams().getLdapEmailAttribute();
	}

	public String getAgentLdapBaseDn() {
		return getConfigParams().getAgentLdapBaseDn();
	}

	public String getAgentLdapIdAttribute() {
		return getConfigParams().getAgentLdapIdAttribute();
	}

	public String getAgentLdapJidAttribute() {
		return getConfigParams().getAgentLdapJidAttribute();
	}

	public String getAgentLdapObjectClasses() {
		return getConfigParams().getAgentLdapObjectClasses();
	}

	public String getUserLdapBaseDn() {
		return getConfigParams().getUserLdapBaseDn();
	}

	public String getUserLdapUidAttribute() {
		return getConfigParams().getUserLdapUidAttribute();
	}

	public String getUserLdapPrivilegeAttribute() {
		return getConfigParams().getUserLdapPrivilegeAttribute();
	}

	public String getUserLdapObjectClasses() {
		return getConfigParams().getUserLdapObjectClasses();
	}

	public Boolean getUserAuthorizationEnabled() {
		return getConfigParams().getUserAuthorizationEnabled();
	}

	public String getGroupLdapObjectClasses() {
		return getConfigParams().getGroupLdapObjectClasses();
	}

	public String getRoleLdapObjectClasses() {
		return getConfigParams().getRoleLdapObjectClasses();
	}

	public String getUserLdapRolesDn() {
		return getConfigParams().getUserLdapRolesDn();
	}

	public String getGroupLdapBaseDn() {
		return getConfigParams().getGroupLdapBaseDn();
	}

	public String getUserGroupLdapBaseDn() {
		return getConfigParams().getUserGroupLdapBaseDn();
	}

	public String getAhenkGroupLdapBaseDn() {
		return getConfigParams().getAhenkGroupLdapBaseDn();
	}

	public String getXmppHost() {
		return getConfigParams().getXmppHost();
	}

	public Integer getXmppPort() {
		return getConfigParams().getXmppPort();
	}

	public String getXmppUsername() {
		return getConfigParams().getXmppUsername();
	}

	public String getXmppPassword() {
		return getConfigParams().getXmppPassword();
	}

	public String getXmppResource() {
		String resourceValueStr = env.getProperty("xmpp.resource.name");
		if( resourceValueStr != null && !resourceValueStr.isEmpty()) {
			return resourceValueStr;
		}
		return getConfigParams().getXmppResource();
	}

	public String getXmppServiceName() {
		return getConfigParams().getXmppServiceName();
	}

	public int getXmppMaxRetryConnectionCount() {
		return getConfigParams().getXmppMaxRetryConnectionCount();
	}

	public int getXmppPacketReplayTimeout() {
		return getConfigParams().getXmppPacketReplayTimeout();
	}

	public Integer getXmppPingTimeout() {
		return getConfigParams().getXmppPingTimeout();
	}

	public Boolean getXmppUseSsl() {
		return getConfigParams().getXmppUseSsl();
	}

	public Boolean getXmppAllowSelfSignedCert() {
		return getConfigParams().getXmppAllowSelfSignedCert();
	}

	public Boolean getXmppUseCustomSsl() {
		return getConfigParams().getXmppUseCustomSsl();
	}

	public Integer getXmppPresencePriority() {
		String priorityValueStr = env.getProperty("xmpp.presence.priority");
		if( priorityValueStr != null && !priorityValueStr.isEmpty()) {
			return Integer.parseInt(priorityValueStr);
		}
		return getConfigParams().getXmppPresencePriority();
	}

	public Protocol getFileServerProtocol() {
		return getConfigParams().getFileServerProtocol();
	}

	public String getFileServerHost() {
		return getConfigParams().getFileServerHost();
	}

	public String getFileServerUsername() {
		return getConfigParams().getFileServerUsername();
	}

	public String getFileServerPassword() {
		return getConfigParams().getFileServerPassword();
	}

	public String getFileServerPluginPath() {
		return getConfigParams().getFileServerPluginPath();
	}

	public String getFileServerAgreementPath() {
		return getConfigParams().getFileServerAgreementPath();
	}

	public String getFileServerAgentFilePath() {
		return getConfigParams().getFileServerAgentFilePath();
	}

	public String getFileServerUrl() {
		return getConfigParams().getFileServerUrl();
	}

	public Integer getFileServerPort() {
		return getConfigParams().getFileServerPort();
	}

	public Boolean getTaskManagerCheckFutureTask() {
		return getConfigParams().getTaskManagerCheckFutureTask();
	}

	public Long getTaskManagerFutureTaskCheckPeriod() {
		return getConfigParams().getTaskManagerFutureTaskCheckPeriod();
	}

	public Boolean getAlarmCheckReport() {
		return getConfigParams().getAlarmCheckReport();
	}

	public String getMailAddress() {
		return getConfigParams().getMailAddress();
	}

	public String getMailPassword() {
		return getConfigParams().getMailPassword();
	}

	public String getMailHost() {
		return getConfigParams().getMailHost();
	}

	public Integer getMailSmtpPort() {
		return getConfigParams().getMailSmtpPort();
	}
	
	public Integer getMailPort() {
		return getConfigParams().getMailPort();
	}

	public Boolean getMailSmtpAuth() {
		return getConfigParams().getMailSmtpAuth();
	}

	public Boolean getMailSmtpStartTlsEnable() {
		return getConfigParams().getMailSmtpStartTlsEnable();
	}

	public Boolean getMailSmtpSslEnable() {
		return getConfigParams().getMailSmtpSslEnable();
	}

	public Integer getMailSmtpConnTimeout() {
		return getConfigParams().getMailSmtpConnTimeout();
	}

	public Integer getMailSmtpTimeout() {
		return getConfigParams().getMailSmtpTimeout();
	}

	public Integer getMailSmtpWriteTimeout() {
		return getConfigParams().getMailSmtpWriteTimeout();
	}

	public Boolean getMailSendOnTaskCompletion() {
		return getConfigParams().getMailSendOnTaskCompletion();
	}

	public Long getMailCheckTaskCompletionPeriod() {
		return getConfigParams().getMailCheckTaskCompletionPeriod();
	}

	public Boolean getMailSendOnPolicyCompletion() {
		return getConfigParams().getMailSendOnPolicyCompletion();
	}

	public Long getMailCheckPolicyCompletionPeriod() {
		return getConfigParams().getMailCheckPolicyCompletionPeriod();
	}

	public String getHotDeploymentPath() {
		return getConfigParams().getHotDeploymentPath();
	}

	public String getCronTaskList() {
		return getConfigParams().getCronTaskList();
	}

	public Integer getEntrySizeLimit() {
		return getConfigParams().getEntrySizeLimit();
	}

	public Integer getCronIntervalEntrySize() {
		return getConfigParams().getCronIntervalEntrySize();
	}

	public String getAdDomainName() {
		return getConfigParams().getAdDomainName();
	}

	public String getAdHostName() {
		return getConfigParams().getAdHostName();
	}

	public String getAdIpAddress() {
		return getConfigParams().getAdIpAddress();
	}

	public String getAdAdminUserName() {
		return getConfigParams().getAdAdminUserName();
	}

	public String getAdAdminUserFullDN() {
		return getConfigParams().getAdAdminUserFullDN();
	}

	public String getAdAdminPassword() {
		return getConfigParams().getAdAdminPassword();
	}

	public String getAdPort() {
		return getConfigParams().getAdPort();
	}

	public Boolean getAdUseSSL() {
		return getConfigParams().getAdUseSSL();
	}

	public Boolean getAdUseTLS() {
		return getConfigParams().getAdUseTLS();
	}

	public Boolean getAdAllowSelfSignedCert() {
		return getConfigParams().getAdAllowSelfSignedCert();
	}

	public Boolean getDisableLocalUser() {
		return getConfigParams().getDisableLocalUser();
	}

	public DomainType getDomainType() {
		if(getConfigParams().getDomainType() == null)
			return DomainType.LDAP;
		else
			return getConfigParams().getDomainType();
	}
	
	public SudoRoleType getSudoRoleType() {
		if(getConfigParams().getSudoRoleType() == null)
			return SudoRoleType.LDAP;
		else
			return getConfigParams().getSudoRoleType();
	}

	public String getAhenkRepoAddress() {
		return getConfigParams().getAhenkRepoAddress();
	}

	public String getAhenkRepoKeyAddress() {
		return getConfigParams().getAhenkRepoKeyAddress();
	}

	public Boolean getEnableDelete4Directory() {
		String enableDelete4Directory = env.getProperty("lider.enableDelete4Directory");
		if( enableDelete4Directory != null && !enableDelete4Directory.isEmpty()) {
			return Boolean.parseBoolean(enableDelete4Directory);
		}
		return false;
	}
	
	public Boolean getAllowVNCConnectionWithoutPermission() {
		String allowVNCWithoutPermissionStr = env.getProperty("allow.connection.without.permission");
		if( allowVNCWithoutPermissionStr != null && !allowVNCWithoutPermissionStr.isEmpty()) {
			return Boolean.parseBoolean(allowVNCWithoutPermissionStr);
		}
		return false;
	}
	
	public Boolean getAllowDynamicDNSUpdate() {
		String allowDynamicDNSUpdateStr = env.getProperty("dynamic.dns.update");
		if( allowDynamicDNSUpdateStr != null && !allowDynamicDNSUpdateStr.isEmpty()) {
			return Boolean.parseBoolean(allowDynamicDNSUpdateStr);
		}
		return false;
	}
	
	public RegistrationTemplateType getRegistrationTemplateType() {
		try {
			if(getConfigParams().getSelectedRegistrationType() == null)
				return RegistrationTemplateType.DEFAULT;
			else
				return getConfigParams().getSelectedRegistrationType();
		} catch (Exception e) {
			return RegistrationTemplateType.DEFAULT;
		}
	}
	
	public String getPardusRepoAddress() {
		if(getConfigParams().getPardusRepoAddress() == null || getConfigParams().getPardusRepoAddress().equals("")) {
			return "http://depo.pardus.org.tr/pardus";
		}
		return getConfigParams().getPardusRepoAddress();
	}
	
	public String getPardusRepoComponent() {
		if(getConfigParams().getPardusRepoComponent() == null || getConfigParams().getPardusRepoComponent().equals("")) {
			return "yirmibir main contrib non-free";
		}
		return getConfigParams().getPardusRepoComponent();
	}
	
	public Boolean getMachineEventStatus() {
		return getConfigParams().getMachineEventStatus();
	}


	public int getMachineEventDay() {
		return getConfigParams().getMachineEventDay();
	}

	public int getClientSize() {
		return getConfigParams().getClientSize();
	}
	
	//	public String getEmailHost() {
	//		return getConfigParams().getEmailHost();
	//	}
	//
	//	public String getEmailPort() {
	//		return getConfigParams().getEmailPort();
	//	}
	//
	//	public String getEmailUsername() {
	//		return getConfigParams().getEmailUsername();
	//	}
	//
	//	public String getEmailPassword() {
	//		return getConfigParams().getEmailPassword();
	//	}
	//
	//	public Boolean getEmailSmtpAuth() {
	//		return getConfigParams().getEmailSmtpAuth();
	//	}
	//
	//	public Boolean getEmailStarttlsEnabled() {
	//		return getConfigParams().getEmailStarttlsEnabled();
	//	}

	public Boolean isEmailConfigurationComplete() {
		if(getConfigParams().getMailHost() != null && !getConfigParams().getMailHost().equals("")
				&& getConfigParams().getMailPassword() != null && !getConfigParams().getMailPassword().equals("")
				&& getConfigParams().getMailPort() != null && !getConfigParams().getMailPort().equals("")
				&& getConfigParams().getMailAddress() != null && !getConfigParams().getMailAddress().equals("")) {
			return true;
		}
		return false;
	}
	public FileServerConf getFileServerConf(String jid) {
		Map<String, Object> params = new HashMap<String, Object>();
		switch (getConfigParams().getFileServerProtocol()) {
		case HTTP:
			params.put("url", getConfigParams().getFileServerUrl() + getConfigParams().getFileServerAgentFilePath());
			break;
		case SSH:
			params.put("host", getConfigParams().getFileServerHost());
			params.put("username", getConfigParams().getFileServerUsername());
			params.put("password", getConfigParams().getFileServerPassword());
			params.put("path", getConfigParams().getFileServerAgentFilePath().replaceFirst("\\{0\\}", jid));
			params.put("port", getConfigParams().getFileServerPort());
			break;
		default:
			// TODO TORRENT
		}
		return new FileServerConf(params, getConfigParams().getFileServerProtocol());
	}
}
