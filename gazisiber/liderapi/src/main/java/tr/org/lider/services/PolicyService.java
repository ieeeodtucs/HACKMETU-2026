package tr.org.lider.services;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import javax.naming.ldap.LdapName;

import org.apache.directory.api.ldap.model.exception.LdapException;
import org.apache.directory.api.ldap.model.message.SearchScope;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.JsonGenerationException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import tr.org.lider.entities.CommandExecutionImpl;
import tr.org.lider.entities.CommandImpl;
import tr.org.lider.entities.OperationType;
import tr.org.lider.entities.PolicyImpl;
import tr.org.lider.ldap.ILDAPService;
import tr.org.lider.ldap.LDAPServiceImpl;
import tr.org.lider.ldap.LdapEntry;
import tr.org.lider.ldap.OLCAccessRule;
import tr.org.lider.messaging.enums.DomainType;
import tr.org.lider.models.PolicyExecutionRequestImpl;
import tr.org.lider.models.PolicyResponse;
import tr.org.lider.repositories.PolicyRepository;

/**
 * Service for getting policy parameters from database and added, updated and
 * deleted policy to database.
 * 
 * @author <a href="mailto:tuncay.colak@tubitak.gov.tr">Tuncay ÇOLAK</a>
 * 
 */

@Service
public class PolicyService {
	Logger logger = LoggerFactory.getLogger(PolicyService.class);

	@Autowired
	private PolicyRepository policyRepository;

	@Autowired
	private CommandService commandService;

	@Autowired
	private LDAPServiceImpl ldapServiceImpl;

	@Autowired
	@Qualifier("ldapImpl")
	private ILDAPService ldapService;

	@Autowired
	@Qualifier("AdImpl")
	private AdService adService;

	@Autowired
	private OperationLogService operationLogService;

	@Autowired
	private ConfigurationService configService;

	@Autowired
	private NotificationDispatchService notificationDispatchService;

	public void executePolicy(PolicyExecutionRequestImpl request) {
		logger.debug("Finding Policy by requested policyId.");
		PolicyImpl policy = findPolicyByID(request.getId());
		logger.debug("Creating ICommand object.");
		// CommandImpl command = createCommanEntity(request, policy);
		/*
		 * target entry must be group..
		 * all policies send only group entry.
		 */

		List<LdapEntry> ldapEntryGroups = new ArrayList<>();
		List<LdapEntry> targetEntries = getTargetList(request.getDnList());
		LdapEntry ldapEntry = targetEntries.get(0);
		if (configService.getDomainType().equals(DomainType.ACTIVE_DIRECTORY)) {
			List<String> dnList = adService.getGroupInGroups(ldapEntry);
			ldapEntryGroups = adService.getLdapDnStringToEntry(dnList);
		} else if (configService.getDomainType().equals(DomainType.LDAP)
				|| configService.getDomainType().equals(DomainType.NONE)) {
			List<String> dnList = ldapServiceImpl.getGroupInGroups(ldapEntry);
			ldapEntryGroups = ldapServiceImpl.getLdapDnStringToEntry(dnList);
		}
		for (LdapEntry targetEntry : ldapEntryGroups) {
			List<CommandImpl> existCommand = commandService.findByPolicyAndByDn(policy.getId(),
					targetEntry.getDistinguishedName());
			if (existCommand.isEmpty() || existCommand.get(0).isDeleted() == true) {
				String logMessage = "[ " + targetEntry.getDistinguishedName() + " ] kullanıcı grubuna [ "
						+ policy.getLabel() + " ] politikası uygulandı.";
				operationLogService.saveOperationLog(OperationType.EXECUTE_POLICY, logMessage,
						policy.getLabel().getBytes(), null, policy.getId(), null);
			notificationDispatchService.dispatch("policy.applied", "Politika Uygulandı: " + policy.getLabel(),
							new NotificationBodyBuilder()
								.field("Politika", policy.getLabel())
								.field("Hedef Grup", targetEntry.getDistinguishedName())
								.build());
				List<String> dnListTemp = new ArrayList<String>();
				dnListTemp.add(targetEntry.getDistinguishedName());
				CommandImpl command = createCommanEntity(request, policy, dnListTemp);
				String uid = targetEntry.get(configService.getAgentLdapIdAttribute()); // group uid is cn value.
				CommandExecutionImpl commandExecutionImpl = new CommandExecutionImpl(null, (CommandImpl) command, uid,
						targetEntry.getType(), targetEntry.getDistinguishedName(),
						new Date(), null, false, false);
				command.addCommandExecution(commandExecutionImpl);
				if (command != null)
					commandService.addCommand(command);
			}
		}
	}

	private CommandImpl createCommanEntity(PolicyExecutionRequestImpl request, PolicyImpl policy,
			List<String> dnLists) {
		CommandImpl command = null;
		try {
			command = new CommandImpl(null, policy, null, dnLists, request.getDnType(), null, findCommandOwnerJid(),
					request.getActivationDate(),
					request.getExpirationDate(), new Date(), null, false, false);
		} catch (JsonGenerationException e) {
			e.printStackTrace();
		} catch (JsonMappingException e) {
			e.printStackTrace();
		} catch (IOException e) {
			e.printStackTrace();
		}
		return command;
	}

	public List<PolicyImpl> list() {
		Boolean deleted = false;
		return policyRepository.findAllByDeleted(deleted);
	}

	public List<PolicyImpl> activePolicies() {
		Boolean active = true;
		Boolean deleted = false;
		return policyRepository.findAllByActiveAndDeleted(active, deleted);
	}

	public PolicyImpl add(PolicyImpl policy) {
		policy.setCommandOwnerUid(null);
		PolicyImpl existPolicy = policyRepository.save(policy);
		existPolicy.setPolicyVersion(existPolicy.getId() + "-" + 1);
		String logMessage = "[ " + existPolicy.getLabel() + " ] politikası oluşturuldu.";
		operationLogService.saveOperationLog(OperationType.CREATE, logMessage, existPolicy.getLabel().getBytes(), null,
				existPolicy.getId(), null);
		return policyRepository.save(existPolicy);
	}

	public PolicyImpl delete(Long id) {
		PolicyImpl existingPolicy = policyRepository.findOne(id);
		existingPolicy.setDeleted(true);
		existingPolicy.setModifyDate(new Date());
		String logMessage = "[ " + existingPolicy.getLabel() + " ] politikası silindi.";
		operationLogService.saveOperationLog(OperationType.DELETE, logMessage, existingPolicy.getLabel().getBytes(),
				null, existingPolicy.getId(), null);
		return policyRepository.save(existingPolicy);
	}

	public PolicyImpl update(PolicyImpl policy) {
		PolicyImpl existPolicy = policyRepository.findOne(policy.getId());
		existPolicy.setLabel(policy.getLabel());
		existPolicy.setActive(policy.isActive());
		existPolicy.setDescription(policy.getDescription());
		existPolicy.setProfiles(policy.getProfiles());
		String oldVersion = existPolicy.getPolicyVersion().split("-")[1];
		Integer newVersion = new Integer(oldVersion) + 1;
		existPolicy.setPolicyVersion(policy.getId() + "-" + newVersion);
		existPolicy.setModifyDate(new Date());
		String logMessage = "[ " + existPolicy.getLabel() + " ] politikası güncellendi.";
		operationLogService.saveOperationLog(OperationType.UPDATE, logMessage, existPolicy.getLabel().getBytes(), null,
				existPolicy.getId(), null);
		return policyRepository.save(existPolicy);
	}

	public PolicyImpl active(PolicyImpl policy) {
		PolicyImpl existPolicy = policyRepository.findOne(policy.getId());
		existPolicy.setActive(true);
		existPolicy.setModifyDate(new Date());
		String logMessage = "[ " + existPolicy.getLabel() + " ] politikası aktif edildi.";
		operationLogService.saveOperationLog(OperationType.UPDATE, logMessage, existPolicy.getLabel().getBytes(), null,
				existPolicy.getId(), null);
		return policyRepository.save(existPolicy);
	}

	public PolicyImpl passive(PolicyImpl policy) {
		PolicyImpl existPolicy = policyRepository.findOne(policy.getId());
		existPolicy.setActive(false);
		existPolicy.setModifyDate(new Date());
		String logMessage = "[ " + existPolicy.getLabel() + " ] politikası pasif edildi.";
		operationLogService.saveOperationLog(OperationType.UPDATE, logMessage, existPolicy.getLabel().getBytes(), null,
				existPolicy.getId(), null);
		return policyRepository.save(existPolicy);
	}

	public PolicyImpl findPolicyByID(Long id) {
		return policyRepository.findOne(id);
	}

	public PolicyImpl updateVersion(PolicyImpl policy) {
		String oldVersion = policy.getPolicyVersion().split("-")[1];
		Integer newVersion = new Integer(oldVersion) + 1;
		policy.setPolicyVersion(policy.getId() + "-" + newVersion);
		policy.setModifyDate(new Date());
		return policyRepository.save(policy);
	}

	private List<LdapEntry> getTargetList(List<String> selectedDns) {
		List<LdapEntry> targetEntries = new ArrayList<>();
		for (String dn : selectedDns) {
			try {
				List<LdapEntry> member = null;
				if (configService.getDomainType().equals(DomainType.ACTIVE_DIRECTORY)) {
					member = adService.findSubEntries(dn, "(objectclass=*)", new String[] { "*" }, SearchScope.OBJECT);
				} else if (configService.getDomainType().equals(DomainType.LDAP)
						|| configService.getDomainType().equals(DomainType.NONE)) {
					member = ldapService.findSubEntries(dn, "(objectclass=*)", new String[] { "*" },
							SearchScope.OBJECT);
				}
				if (member != null && member.size() > 0) {
					targetEntries.add(member.get(0));
				}
			} catch (LdapException e) {
				e.printStackTrace();
			}
		}
		return targetEntries;
	}

	private String findCommandOwnerJid() {
		if (AuthenticationService.isLogged()) {
			logger.info(" task owner jid : " + AuthenticationService.getUser().getName());
			return AuthenticationService.getUser().getName();
		}
		return null;
	}

	public List<PolicyResponse> getPoliciesForGroup(String dn) {
		List<Object[]> results = policyRepository.findPoliciesByGroupDn(dn);
		List<PolicyResponse> resp = new ArrayList<PolicyResponse>();
		for (Object[] objects : results) {
			PolicyResponse policyResponse = new PolicyResponse();
			policyResponse.setPolicyImpl((PolicyImpl) objects[0]);
			policyResponse.setCommandExecutionImpl((CommandExecutionImpl) objects[1]);
			policyResponse.setCommandImpl((CommandImpl) objects[2]);
			resp.add(policyResponse);
		}
		return resp;
	}

	public CommandImpl unassignmentPolicyDeletedMember(List<String> dn, String sourceDn) {
		String dnStringTemp = String.join(",", dn);
		List<String> dnList = new ArrayList<>();
		dnList.add(dnStringTemp);
		List<CommandImpl> existingPolicies = new ArrayList<CommandImpl>();

		if (configService.getDomainType().equals(DomainType.ACTIVE_DIRECTORY)) {
			List<LdapEntry> deletedEntryDn = new ArrayList<>();
			deletedEntryDn = adService.getLdapDnStringToEntry(dnList);
			LdapEntry deletedEntry = deletedEntryDn.get(0);
			List<String> parentDnList = new ArrayList<>();
			parentDnList = adService.getParentsDnOfLdapEntry(deletedEntry);
			List<LdapEntry> ldapEntryParentsDn = new ArrayList<>();
			ldapEntryParentsDn = adService.getLdapDnStringToEntry(parentDnList);
			existingPolicies = commandService.findAllPolicyByDn(deletedEntry.getDistinguishedName());

			for (CommandImpl targetPolicy : existingPolicies) {
				targetPolicy.setDeleted(true);
			}
			for (LdapEntry parentsDn : ldapEntryParentsDn) {
				if (parentsDn.getDistinguishedName().equals(sourceDn)) {
					continue;
				} else {
					List<CommandImpl> parentPolicies = new ArrayList<>();
					parentPolicies = commandService.findAllPolicyByDn(parentsDn.getDistinguishedName());
					for (CommandImpl targetParentPolicy : parentPolicies) {
						for (CommandImpl targetPolicy : existingPolicies) {
							if (targetParentPolicy.getPolicy().getId() == targetPolicy.getPolicy().getId()) {
								targetPolicy.setDeleted(false);
								commandService.updateCommand(targetPolicy);
							}
						}
					}
				}
			}
		} else if (configService.getDomainType().equals(DomainType.LDAP)
				|| configService.getDomainType().equals(DomainType.NONE)) {
			List<LdapEntry> deletedEntryDn = new ArrayList<>();
			deletedEntryDn = ldapServiceImpl.getLdapDnStringToEntry(dnList);
			LdapEntry deletedEntry = deletedEntryDn.get(0);
			List<String> parentDnList = new ArrayList<>();
			parentDnList = ldapServiceImpl.getParentsDnOfLdapEntry(deletedEntry);
			List<LdapEntry> ldapEntryParentsDn = new ArrayList<>();
			ldapEntryParentsDn = ldapServiceImpl.getLdapDnStringToEntry(parentDnList);
			existingPolicies = commandService.findAllPolicyByDn(deletedEntry.getDistinguishedName());

			for (CommandImpl targetPolicy : existingPolicies) {
				targetPolicy.setDeleted(true);
			}
			for (LdapEntry parentsDn : ldapEntryParentsDn) {
				if (parentsDn.getDistinguishedName().equals(sourceDn)) {
					continue;
				} else {
					List<CommandImpl> parentPolicies = new ArrayList<>();
					parentPolicies = commandService.findAllPolicyByDn(parentsDn.getDistinguishedName());
					for (CommandImpl targetParentPolicy : parentPolicies) {
						for (CommandImpl targetPolicy : existingPolicies) {
							if (targetParentPolicy.getPolicy().getId() == targetPolicy.getPolicy().getId()) {
								targetPolicy.setDeleted(false);
								commandService.updateCommand(targetPolicy);
							}
						}
					}
				}
			}
		}
		return commandService.updateCommand(existingPolicies.get(0));
	}

	public CommandImpl unassignmentCommandForUserPolicy(CommandImpl comImpl) {
		CommandImpl existCommand = commandService.getCommand(comImpl.getId());
		List<String> headDn = new ArrayList<>();
		headDn.add(existCommand.getCommandExecutions().get(0).getDn());
		List<LdapEntry> ldapHeadNode = new ArrayList<>();
		List<LdapEntry> ldapEntryGroups = new ArrayList<>();

		if (configService.getDomainType().equals(DomainType.ACTIVE_DIRECTORY)) {
			ldapHeadNode.addAll(adService.getLdapDnStringToEntry(headDn));
			List<String> groupsUnderEntry = adService.getGroupInGroups(ldapHeadNode.get(0));
			ldapEntryGroups = adService.getLdapDnStringToEntry(groupsUnderEntry);
			for (LdapEntry targetEnrty : ldapEntryGroups) {
				List<CommandImpl> existCommand2 = commandService.findByPolicyAndByDn(existCommand.getPolicy().getId(),
						targetEnrty.getDistinguishedName());
				if (existCommand2.isEmpty())
					continue;
				if (existCommand2.get(0).isDeleted() == false) {
					existCommand2.get(0).setDeleted(true);
					String logMessage = "[ " + existCommand2.get(0).getDnList().get(0) + " ] kullanıcı grubunun [ "
							+ existCommand.getPolicy().getLabel() + " ] politikası kaldırıldı.";
					operationLogService.saveOperationLog(OperationType.UNASSIGMENT_POLICY, logMessage,
							existCommand.getPolicy().getLabel().getBytes(), null, existCommand.getPolicy().getId(),
							null);
				notificationDispatchService.dispatch("policy.unassigned",
							"Politika Kaldırıldı: " + existCommand.getPolicy().getLabel(),
							new NotificationBodyBuilder()
								.field("Politika", existCommand.getPolicy().getLabel())
								.field("Hedef Grup", existCommand2.get(0).getDnList().get(0))
								.build());
					commandService.updateCommand(existCommand2.get(0));
				}
			}
		} else if (configService.getDomainType().equals(DomainType.LDAP)
				|| configService.getDomainType().equals(DomainType.NONE)) {
			ldapHeadNode.addAll(ldapServiceImpl.getLdapDnStringToEntry(headDn));
			List<String> groupsUnderEntry = ldapServiceImpl.getGroupInGroups(ldapHeadNode.get(0));
			ldapEntryGroups = ldapServiceImpl.getLdapDnStringToEntry(groupsUnderEntry);
			for (LdapEntry targetEnrty : ldapEntryGroups) {
				List<CommandImpl> existCommand2 = commandService.findByPolicyAndByDn(existCommand.getPolicy().getId(),
						targetEnrty.getDistinguishedName());
				if (existCommand2.isEmpty())
					continue;
				if (existCommand2.get(0).isDeleted() == false) {
					existCommand2.get(0).setDeleted(true);
					String logMessage = "[ " + existCommand2.get(0).getDnList().get(0) + " ] kullanıcı grubunun [ "
							+ existCommand.getPolicy().getLabel() + " ] politikası kaldırıldı.";
					operationLogService.saveOperationLog(OperationType.UNASSIGMENT_POLICY, logMessage,
							existCommand.getPolicy().getLabel().getBytes(), null, existCommand.getPolicy().getId(),
							null);
				notificationDispatchService.dispatch("policy.unassigned",
							"Politika Kaldırıldı: " + existCommand.getPolicy().getLabel(),
							new NotificationBodyBuilder()
								.field("Politika", existCommand.getPolicy().getLabel())
								.field("Hedef Grup", existCommand2.get(0).getDnList().get(0))
								.build());
					commandService.updateCommand(existCommand2.get(0));
				}
			}
		}
		return commandService.updateCommand(existCommand);
	}
}