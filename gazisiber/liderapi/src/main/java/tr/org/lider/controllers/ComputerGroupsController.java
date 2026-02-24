package tr.org.lider.controllers;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.naming.ldap.LdapName;
import javax.servlet.http.HttpServletRequest;

import org.apache.directory.api.ldap.model.exception.LdapException;
import org.apache.directory.api.ldap.model.message.SearchScope;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import tr.org.lider.dto.AgentDTO;
import tr.org.lider.entities.AgentImpl;
import tr.org.lider.entities.OperationType;
import tr.org.lider.ldap.DNType;
import tr.org.lider.ldap.LDAPServiceImpl;
import tr.org.lider.ldap.LdapEntry;
import tr.org.lider.ldap.LdapSearchFilterAttribute;
import tr.org.lider.ldap.SearchFilterEnum;
import tr.org.lider.services.AgentService;
import tr.org.lider.services.ConfigurationService;
import tr.org.lider.services.NotificationBodyBuilder;
import tr.org.lider.services.OperationLogService;;

/**
 * Controller for computer groups operations
 * 
 * @author <a href="mailto:hasan.kara@pardus.org.tr">Hasan Kara</a>
 * 
 */

// @RequestMapping("/lider/computer_groups")
@RestController
@RequestMapping("/api/lider/computer-groups")
@Tag(name = "Computer Groups", description = "Computer Group Rest Service")
public class ComputerGroupsController {

	Logger logger = LoggerFactory.getLogger(ComputerGroupsController.class);

	@Autowired
	private LDAPServiceImpl ldapService;

	@Autowired
	private AgentService agentService;

	@Autowired
	private OperationLogService operationLogService;

	@Autowired
	private ConfigurationService configurationService;

	@Autowired
	private tr.org.lider.services.NotificationDispatchService notificationDispatchService;

	// gets tree of groups of names which just has agent members

	// @RequestMapping(value = "/getGroups")
	@Operation(summary = "Gets in group tree", description = "", tags = { "computer-groups" })
	@ApiResponses(value = {
			@ApiResponse(responseCode = "200", description = "Included in the computer group. Successful"),
			@ApiResponse(responseCode = "417", description = "Could not be into computer group. Unexpected error occured.", content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/groups", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<List<LdapEntry>> getAgentGroups() {
		List<LdapEntry> result = new ArrayList<LdapEntry>();
		result.add(ldapService.getLdapAgentsGroupTree());
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(result);
	}

	// @RequestMapping(value = "/getOuDetails")
	@Operation(summary = "Gets organization unit details", description = "", tags = { "computer-groups" })
	@ApiResponses(value = {
			@ApiResponse(responseCode = "200", description = "Returns organizational unit details"),
			@ApiResponse(responseCode = "417", description = "Could not be fetched ou-details. Unexpected error occured.", content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/ou-details", produces = MediaType.APPLICATION_JSON_VALUE)
	public List<LdapEntry> getOuDetails(LdapEntry selectedEntry) {
		List<LdapEntry> subEntries = null;
		try {
			subEntries = ldapService.findSubEntries(selectedEntry.getUid(), "(objectclass=*)",
					new String[] { "*" }, SearchScope.ONELEVEL);
		} catch (LdapException e) {
			e.printStackTrace();
		}
		Collections.sort(subEntries);
		selectedEntry.setChildEntries(subEntries);
		return subEntries;
	}

	@Operation(summary = "Create organizational unit", description = "", tags = { "computer-groups" })
	@ApiResponses(value = {
			@ApiResponse(responseCode = "200", description = "New organizational unit added"),
			@ApiResponse(responseCode = "417", description = "Could not create organizational unit. Unexpected error occured.", content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/add-ou", produces = { MediaType.APPLICATION_JSON_VALUE, MediaType.APPLICATION_XML_VALUE })
	public ResponseEntity<LdapEntry> addOu(@RequestBody LdapEntry selectedEntry) {
		try {
			Map<String, String[]> attributes = new HashMap<String, String[]>();
			attributes.put("objectClass", new String[] { "organizationalUnit", "top", "pardusLider" });
			attributes.put("ou", new String[] { selectedEntry.getOu() });

			String dn = "ou=" + selectedEntry.getOu() + "," + selectedEntry.getParentName();

			ldapService.addEntry(dn, attributes);
			logger.info("OU created successfully RDN =" + dn);

			// get full of ou details after creation
			selectedEntry = ldapService.getEntryDetail(dn);

			Map<String, Object> requestData = new HashMap<String, Object>();
			requestData.put("dn", selectedEntry.getDistinguishedName());
			ObjectMapper dataMapper = new ObjectMapper();
			String jsonString = null;
			try {
				jsonString = dataMapper.writeValueAsString(requestData);
			} catch (JsonProcessingException e1) {
				logger.error("Error occured while mapping request data to json. Error: " + e1.getMessage());
			}
			String log = selectedEntry.getDistinguishedName() + " group has been created";
			operationLogService.saveOperationLog(OperationType.CREATE, log, jsonString.getBytes(), null, null, null);
			notificationDispatchService.dispatch("agent.ou.created", "İstemci OU Oluşturuldu",
					new NotificationBodyBuilder()
							.field("OU", selectedEntry.getDistinguishedName())
							.build());

			return ResponseEntity
					.status(HttpStatus.OK)
					.body(selectedEntry);
		} catch (LdapException e) {
			e.printStackTrace();
			HttpHeaders headers = new HttpHeaders();
			return ResponseEntity.status(HttpStatus.EXPECTATION_FAILED).headers(headers)
					.build();
		}
	}

	@Operation(summary = "Delete entry by dn", description = "", tags = { "computer-groups" })
	@ApiResponses(value = {
			@ApiResponse(responseCode = "200", description = "Deleted entry with dn."),
			@ApiResponse(responseCode = "404", description = "Entry dn not found. ", content = @Content(schema = @Schema(implementation = String.class))) })
	@DeleteMapping(value = "/delete-entry/dn/{dn}")
	public ResponseEntity<Boolean> deleteEntry(@PathVariable String dn) {
		try {
			if (dn != configurationService.getAgentLdapBaseDn()) {
				ldapService.updateOLCAccessRulesAfterEntryDelete(dn);
				ldapService.deleteNodes(ldapService.getOuAndOuSubTreeDetail(dn));

				Map<String, Object> requestData = new HashMap<String, Object>();
				requestData.put("dn", dn);
				ObjectMapper dataMapper = new ObjectMapper();
				String jsonString = null;
				try {
					jsonString = dataMapper.writeValueAsString(requestData);
				} catch (JsonProcessingException e1) {
					logger.error("Error occured while mapping request data to json. Error: " + e1.getMessage());
				}
				String log = dn + " group has been deleted";
				operationLogService.saveOperationLog(OperationType.DELETE, log, jsonString.getBytes(), null, null,
						null);
				notificationDispatchService.dispatch("agent.ou.deleted", "İstemci OU Silindi",
						new NotificationBodyBuilder()
								.field("Silinen OU", dn)
								.build());

				return ResponseEntity
						.status(HttpStatus.OK)
						.body(true);

			} else {
				return ResponseEntity
						.status(HttpStatus.NOT_FOUND)
						.body(false);
			}

		} catch (Exception e) {
			e.printStackTrace();
			HttpHeaders headers = new HttpHeaders();
			return ResponseEntity.status(HttpStatus.EXPECTATION_FAILED).headers(headers)
					.build();
		}
	}

	@Operation(summary = "Gets computers added to ldap.", description = "", tags = { "computer-groups" })
	@ApiResponses(value = {
			@ApiResponse(responseCode = "200", description = "Computers added to ldap list."),
			@ApiResponse(responseCode = "417", description = "Computers could not be added to the ldap list. Unexpected error occured.", content = @Content(schema = @Schema(implementation = String.class))) })
	@GetMapping(value = "/computers}")
	public ResponseEntity<List<LdapEntry>> getComputers() {
		List<LdapEntry> retList = new ArrayList<LdapEntry>();
		retList.add(ldapService.getLdapComputersTree());
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(retList);
	}

	@Operation(summary = "Gets ahenks list", description = "", tags = { "computer-groups" })
	@ApiResponses(value = {
			@ApiResponse(responseCode = "200", description = "Ahenk list received."),
			@ApiResponse(responseCode = "417", description = "Could not get list ahenk.Unexpected error occured.", content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/ahenks}")
	public ResponseEntity<List<LdapEntry>> getAhenks(HttpServletRequest request, Model model,
			@RequestBody LdapEntry[] selectedEntryArr) {
		List<LdapEntry> ahenkList = new ArrayList<>();
		for (LdapEntry ldapEntry : selectedEntryArr) {
			List<LdapSearchFilterAttribute> filterAttributes = new ArrayList<LdapSearchFilterAttribute>();
			LdapSearchFilterAttribute fAttr = new LdapSearchFilterAttribute("objectClass", "pardusDevice",
					SearchFilterEnum.EQ);
			filterAttributes.add(fAttr);
			try {
				List<LdapEntry> retList = ldapService.findSubEntries(ldapEntry.getDistinguishedName(),
						"(objectclass=pardusDevice)", new String[] { "*" }, SearchScope.SUBTREE);
				for (LdapEntry ldapEntry2 : retList) {
					boolean isExist = false;
					for (LdapEntry ldapEntryAhenk : ahenkList) {
						if (ldapEntry2.getEntryUUID().equals(ldapEntryAhenk.getEntryUUID())) {
							isExist = true;
							break;
						}
					}
					if (!isExist) {
						ahenkList.add(ldapEntry2);
					}
				}
			} catch (LdapException e) {
				e.printStackTrace();
				HttpHeaders headers = new HttpHeaders();
				return ResponseEntity.status(HttpStatus.EXPECTATION_FAILED).headers(headers)
						.build();
			}
		}
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(ahenkList);
	}

	// add new group and add selected agents
	@Operation(summary = "Create new agent group", description = "", tags = { "computer-groups" })
	@ApiResponses(value = {
			@ApiResponse(responseCode = "200", description = "Created new agent group"),
			@ApiResponse(responseCode = "417", description = "Could not created new agent group. Unexpected error occured.", content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/create-new-agent-group", produces = MediaType.APPLICATION_JSON_VALUE)
	@ResponseBody
	public ResponseEntity<?> createNewAgentGroup(@RequestBody Map<String, String> params) {
		String newGroupDN = "";
		// to return newly added entry with its details
		LdapEntry entry;
		if (params.containsKey("selectedOUDN") && !params.get("selectedOUDN").equals("")) {
			newGroupDN = "cn=" + params.get("groupName") + "," + params.get("selectedOUDN");
		} else {
			newGroupDN = "cn=" + params.get("groupName") + "," + configurationService.getAhenkGroupLdapBaseDn();
		}
		ObjectMapper mapper = new ObjectMapper();
		List<LdapEntry> entries = new ArrayList<>();
		try {
			entries = Arrays.asList(mapper.readValue(params.get("checkedEntries"), LdapEntry[].class));
		} catch (JsonProcessingException e) {
			logger.error("Error occured while mapping checked entry list to object");
		}
		List<LdapEntry> agents = new ArrayList<>();
		List<LdapEntry> directories = new ArrayList<>();

		for (LdapEntry ldapEntry : entries) {
			if (ldapEntry.getType().equals(DNType.AHENK) || ldapEntry.getType().equals(DNType.GROUP)) {
				agents.add(ldapEntry);
			}
		}

		for (LdapEntry ldapEntry : entries) {
			Boolean hasParentChecked = false;
			for (LdapEntry entryTemp : entries) {
				if (ldapEntry.getType().equals(DNType.ORGANIZATIONAL_UNIT)
						&& entryTemp.getType().equals(DNType.ORGANIZATIONAL_UNIT)) {
					if (!ldapEntry.getDistinguishedName().equals(entryTemp.getDistinguishedName())
							&& ldapEntry.getDistinguishedName().contains(entryTemp.getDistinguishedName())) {
						hasParentChecked = true;
						break;
					}
				}
			}
			if (ldapEntry.getType().equals(DNType.ORGANIZATIONAL_UNIT) && !hasParentChecked) {
				directories.add(ldapEntry);
			}
		}

		List<LdapEntry> allAgents = getAhenksUnderOUs(directories, agents);
		if (allAgents.size() == 0) {
			return new ResponseEntity<String>(
					"Seçili klasörlerde istemci bulunamadı. Lütfen en az bir istemci seçiniz.",
					HttpStatus.NOT_ACCEPTABLE);
		}
		Map<String, String[]> attributes = new HashMap<String, String[]>();
		attributes.put("objectClass", new String[] { "groupOfNames", "top", "pardusLider" });
		attributes.put("liderGroupType", new String[] { "AHENK" });
		try {
			String[] allAgentDNs = allAgents.stream().map(LdapEntry::getDistinguishedName).toArray(String[]::new);
			attributes.put("member", allAgentDNs);
			ldapService.addEntry(newGroupDN, attributes);
			entry = ldapService.getEntryDetail(newGroupDN);
		} catch (LdapException e) {
			logger.error("Error occured while adding new group.");
			HttpHeaders headers = new HttpHeaders();
			return ResponseEntity.status(HttpStatus.EXPECTATION_FAILED).headers(headers)
					.build();
		}

		Map<String, Object> requestData = new HashMap<String, Object>();
		List<String> computerAdded = new ArrayList<>();

		for (LdapEntry computer : entries) {
			if (computer.getUid() != null) {
				computerAdded.add(computer.getUid());
			}
		}
		requestData.put("uid", computerAdded);
		ObjectMapper dataMapper = new ObjectMapper();
		String jsonString = null;
		try {
			jsonString = dataMapper.writeValueAsString(requestData);
		} catch (JsonProcessingException e1) {
			logger.error("Error occured while mapping request data to json. Error: " + e1.getMessage());
		}
		String log = "New computer group has been created " + entry.getDistinguishedName();
		operationLogService.saveOperationLog(OperationType.CREATE, log, jsonString.getBytes(), null, null, null);
		notificationDispatchService.dispatch("agent.group.created", "İstemci Grubu Oluşturuldu",
				new NotificationBodyBuilder()
						.field("Grup", entry.getDistinguishedName())
						.build());

		return new ResponseEntity<LdapEntry>(entry, HttpStatus.OK);
	}

	// add agents to existing group from agent info page
	@Operation(summary = "Add agent to existing group", description = "", tags = { "computer-groups" })
	@ApiResponses(value = {
			@ApiResponse(responseCode = "200", description = "Added agent to existing group"),
			@ApiResponse(responseCode = "417", description = "Could not add agent to existing group. Unexpected error occured", content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/group/existing", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<?> addAgentsToExistingGroup(@RequestBody Map<String, String> params) {
		LdapEntry entry;
		ObjectMapper mapper = new ObjectMapper();
		List<LdapEntry> entries = new ArrayList<>();
		try {
			entries = Arrays.asList(mapper.readValue(params.get("checkedEntries"), LdapEntry[].class));
		} catch (JsonProcessingException e) {
			logger.error("Error occured while mapping checked entry list to object");
		}
		List<LdapEntry> agents = new ArrayList<>();
		List<LdapEntry> directories = new ArrayList<>();
		List<String> memberDn = new ArrayList<>();
		List<String> memberOfDn = new ArrayList<>();
		for (LdapEntry ldapMember : entries) {

			if (ldapMember.getType().equals(DNType.GROUP)) {
				memberDn.addAll(Arrays.asList(ldapMember.getAttributesMultiValues().get("member")));
				memberOfDn.addAll(Arrays.asList(ldapMember.getAttributesMultiValues().get("member")));
			}
		}
		System.out.println(memberDn);

		for (LdapEntry ldapEntry : entries) {
			if (ldapEntry.getType().equals(DNType.AHENK) || ldapEntry.getType().equals(DNType.GROUP)) {
				if (ldapEntry.getType().equals(DNType.GROUP)) {
					if (ldapEntry.getAttributesMultiValues().get("member").equals(null)) {
						continue;
					} else {
						System.out.println(ldapEntry.getAttributesMultiValues().get("member"));
						// for (LdapEntry groupLdapEntry :
						// ldapEntry.getAttributesMultiValues().get("member")) {
						// if (groupLdapEntry.getDistinguishedName() ==
						// ldapEntry.getDistinguishedName()) {
						// System.err.println("AYNI GRUP");
						// break;
						// }
						// }
					}
				}
				agents.add(ldapEntry);
			}
		}

		for (LdapEntry ldapEntry : entries) {
			Boolean hasParentChecked = false;
			for (LdapEntry entryTemp : entries) {
				if (ldapEntry.getType().equals(DNType.ORGANIZATIONAL_UNIT)
						&& entryTemp.getType().equals(DNType.ORGANIZATIONAL_UNIT)) {
					if (!ldapEntry.getDistinguishedName().equals(entryTemp.getDistinguishedName())
							&& ldapEntry.getDistinguishedName().contains(entryTemp.getDistinguishedName())) {
						hasParentChecked = true;
						break;
					}
				}
			}
			if (ldapEntry.getType().equals(DNType.ORGANIZATIONAL_UNIT) && !hasParentChecked) {
				directories.add(ldapEntry);
			}
		}

		List<LdapEntry> allAgents = getAhenksUnderOUs(directories, agents);
		if (allAgents.size() == 0) {
			return new ResponseEntity<String>(
					"Seçili klasörlerde istemci bulunamadı. Lütfen en az bir istemci seçiniz.",
					HttpStatus.NOT_ACCEPTABLE);
		}
		try {
			String[] allAgentDNs = allAgents.stream().map(LdapEntry::getDistinguishedName).toArray(String[]::new);
			for (int i = 0; i < allAgentDNs.length; i++) {
				ldapService.updateEntryAddAtribute(params.get("groupDN"), "member", allAgentDNs[i]);
			}
			entry = ldapService.getEntryDetail(params.get("groupDN"));
		} catch (LdapException e) {
			logger.error("Error occured while adding new group.");
			HttpHeaders headers = new HttpHeaders();
			return ResponseEntity.status(HttpStatus.EXPECTATION_FAILED).headers(headers)
					.build();
		}

		Map<String, Object> requestData = new HashMap<String, Object>();
		List<String> computerAdded = new ArrayList<>();

		for (LdapEntry computer : entries) {
			if (computer.getUid() != null) {
				computerAdded.add(computer.getUid());
			}
		}
		requestData.put("uid", computerAdded);
		ObjectMapper dataMapper = new ObjectMapper();
		String jsonString = null;
		try {
			jsonString = dataMapper.writeValueAsString(requestData);
		} catch (JsonProcessingException e1) {
			logger.error("Error occured while mapping request data to json. Error: " + e1.getMessage());
		}
		String log = "Computers has been added to " + entry.getDistinguishedName();
		operationLogService.saveOperationLog(OperationType.UPDATE, log, jsonString.getBytes(), null, null, null);
		notificationDispatchService.dispatch("agent.group.updated", "İstemci Grubu Güncellendi",
				new NotificationBodyBuilder()
						.field("Grup", entry.getDistinguishedName())
						.build());

		return new ResponseEntity<LdapEntry>(entry, HttpStatus.OK);
	}

	// get members of group
	@Operation(summary = "Add member to group ", description = "", tags = { "computer-groups" })
	@ApiResponses(value = {
			@ApiResponse(responseCode = "200", description = "Added member to group"),
			@ApiResponse(responseCode = "417", description = "Could not add member to group. Unexpected error occured", content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/group/members", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<List<LdapEntry>> getMembersOfGroup(@RequestParam(value = "dn", required = true) String dn) {
		LdapEntry entry = ldapService.getEntryDetail(dn);
		List<LdapEntry> listOfMembers = new ArrayList<>();

		for (String memberDN : entry.getAttributesMultiValues().get("member")) {
			listOfMembers.add(ldapService.getEntryDetail(memberDN));
		}
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(listOfMembers);

	}

	// delete member from group
	@Operation(summary = "Delete member from group", description = "", tags = { "computer-groups" })
	@ApiResponses(value = {
			@ApiResponse(responseCode = "200", description = "Deleted member from group"),
			@ApiResponse(responseCode = "417", description = "Could not delete member from group. Unexpected error occured", content = @Content(schema = @Schema(implementation = String.class))) })
	@PutMapping(value = "/group/members", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<LdapEntry> deleteMembersOfGroup(
			@RequestParam(value = "dn", required = true) String dn,
			@RequestParam(value = "dnList[]", required = true) List<String> dnList) {
		// when single dn comes spring boot takes it as multiple arrays
		// so dn must be joined with comma
		// if member dn that will be added to group is
		// cn=agent1,ou=Groups,dn=liderahenk,dc=org
		// spring boot gets this param as array which has size 4
		Boolean checkedArraySizeIsOne = true;
		for (int i = 0; i < dnList.size(); i++) {
			if (dnList.get(i).contains(",")) {
				checkedArraySizeIsOne = false;
				break;
			}
		}
		if (checkedArraySizeIsOne) {
			try {
				ldapService.updateEntryRemoveAttributeWithValue(dn, "member", String.join(",", dnList));
			} catch (LdapException e) {
				e.printStackTrace();
				HttpHeaders headers = new HttpHeaders();
				return ResponseEntity.status(HttpStatus.EXPECTATION_FAILED).headers(headers)
						.build();
			}
		} else {
			for (int i = 0; i < dnList.size(); i++) {
				try {
					ldapService.updateEntryRemoveAttributeWithValue(dn, "member", dnList.get(i));
				} catch (LdapException e) {
					e.printStackTrace();
					HttpHeaders headers = new HttpHeaders();
					return ResponseEntity.status(HttpStatus.EXPECTATION_FAILED).headers(headers)
							.build();
				}
			}
		}

		Map<String, Object> requestData = new HashMap<String, Object>();
		requestData.put("dn", dn);
		requestData.put("uid", dnList.get(0));
		ObjectMapper dataMapper = new ObjectMapper();
		String jsonString = null;
		try {
			jsonString = dataMapper.writeValueAsString(requestData);
		} catch (JsonProcessingException e1) {
			logger.error("Error occured while mapping request data to json. Error: " + e1.getMessage());
		}
		String log = dnList.get(0) + " has been deleted from " + dn;
		operationLogService.saveOperationLog(OperationType.DELETE, log, jsonString.getBytes(), null, null, null);
		notificationDispatchService.dispatch("agent.group.deleted", "İstemci Grubu Silindi",
				new NotificationBodyBuilder()
						.field("Grup", dn)
						.field("Silinen Üye", dnList.get(0))
						.build());

		return ResponseEntity
				.status(HttpStatus.OK)
				.body(ldapService.getEntryDetail(dn));

	}

	@Operation(summary = "Move  entry to destination", description = "", tags = { "computer-groups" })
	@ApiResponses(value = {
			@ApiResponse(responseCode = "200", description = "Entry moved to destination."),
			@ApiResponse(responseCode = "417", description = "The entry could not be moved to the destination.Unexpected error occured", content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/move/entry", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<Boolean> moveEntry(@RequestParam(value = "sourceDN", required = true) String sourceDN,
			@RequestParam(value = "destinationDN", required = true) String destinationDN) {
		try {
			ldapService.moveEntry(sourceDN, destinationDN);

		} catch (Exception e) {
			e.printStackTrace();
			return ResponseEntity
					.status(HttpStatus.EXPECTATION_FAILED)
					.body(false);
		}

		Map<String, Object> requestData = new HashMap<String, Object>();
		requestData.put("SourceDN", sourceDN);
		requestData.put("DestinationDN", destinationDN);
		ObjectMapper dataMapper = new ObjectMapper();
		String jsonString = null;
		try {
			jsonString = dataMapper.writeValueAsString(requestData);
		} catch (JsonProcessingException e1) {
			logger.error("Error occured while mapping request data to json. Error: " + e1.getMessage());
		}
		String log = "Entry has been moved from " + sourceDN + " to " + destinationDN;
		operationLogService.saveOperationLog(OperationType.MOVE, log, jsonString.getBytes(), null, null, null);
		notificationDispatchService.dispatch("agent.group.moved", "İstemci Grubu Taşındı",
				new NotificationBodyBuilder()
						.field("Kaynak", sourceDN)
						.field("Hedef", destinationDN)
						.build());

		return ResponseEntity
				.status(HttpStatus.OK)
				.body(true);
	}

	@Operation(summary = "Entry rename", description = "", tags = { "computer-groups" })
	@ApiResponses(value = {
			@ApiResponse(responseCode = "200", description = "The entry has been renamed"),
			@ApiResponse(responseCode = "417", description = "Could not rename entry.Unexpected error occured", content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/rename/entry", produces = { MediaType.APPLICATION_JSON_VALUE,
			MediaType.APPLICATION_XML_VALUE })
	public ResponseEntity<LdapEntry> renameEntry(@RequestParam(value = "oldDN", required = true) String oldDN,
			@RequestParam(value = "newName", required = true) String newName) {
		try {
			ldapService.renameEntry(oldDN, newName);
			String newEntryDN = newName + ",";
			LdapName dn = new LdapName(oldDN);
			for (int i = dn.size() - 2; 0 <= i; i--) {
				newEntryDN += dn.get(i);
				if (i > 0) {
					newEntryDN += ",";
				}
			}
			LdapEntry selectedEntry = ldapService.getEntryDetail(newEntryDN);

			Map<String, Object> requestData = new HashMap<String, Object>();
			requestData.put("oldDN", oldDN);
			requestData.put("newDN", newName);
			ObjectMapper dataMapper = new ObjectMapper();
			String jsonString = dataMapper.writeValueAsString(requestData);
			String log = "Entry name has been changed from " + oldDN + " to " + newName;
			operationLogService.saveOperationLog(OperationType.UPDATE, log, jsonString.getBytes(), null, null, null);

			return ResponseEntity
					.status(HttpStatus.OK)
					.body(selectedEntry);

		} catch (Exception e) {
			e.printStackTrace();
			HttpHeaders headers = new HttpHeaders();
			return ResponseEntity.status(HttpStatus.EXPECTATION_FAILED).headers(headers)
					.build();
		}
	}

	public List<LdapEntry> getAhenksUnderOUs(List<LdapEntry> directories, List<LdapEntry> ahenks) {
		for (LdapEntry ldapEntry : directories) {
			try {
				List<LdapEntry> retList = ldapService.findSubEntries(ldapEntry.getDistinguishedName(),
						"(|(objectclass=pardusDevice)(objectclass=groupOfNames))", new String[] { "*" },
						SearchScope.SUBTREE);
				for (LdapEntry ldapEntry2 : retList) {
					boolean isExist = false;
					for (LdapEntry ldapEntryAhenk : ahenks) {
						if (ldapEntry2.getEntryUUID().equals(ldapEntryAhenk.getEntryUUID())) {
							isExist = true;
							break;
						}
					}
					if (!isExist) {
						ahenks.add(ldapEntry2);
					}
				}
			} catch (LdapException e) {
				e.printStackTrace();
			}
		}
		return ahenks;
	}

	@Operation(summary = "Create new agent group", description = "", tags = { "computer-groups" })
	@ApiResponses(value = {
			@ApiResponse(responseCode = "200", description = "Created new agent group"),
			@ApiResponse(responseCode = "417", description = "Could not create agent group.Unexpected error occured", content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/agent-report/create-agent-group", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<LdapEntry> findAllAgents(AgentDTO agentDTO) {
		agentDTO.setPageNumber(1);
		agentDTO.setPageSize(agentService.count().intValue());
		Page<AgentImpl> listOfAgents = agentService.findAllAgents(agentDTO);

		String newGroupDN = "";
		LdapEntry entry;
		if (agentDTO.getSelectedOUDN() == null || agentDTO.getSelectedOUDN().get().equals("")) {
			newGroupDN = "cn=" + agentDTO.getGroupName().get() + "," + configurationService.getAhenkGroupLdapBaseDn();
		} else {
			newGroupDN = "cn=" + agentDTO.getGroupName().get() + "," + agentDTO.getSelectedOUDN().get();
		}
		Map<String, String[]> attributes = new HashMap<String, String[]>();
		attributes.put("objectClass", new String[] { "groupOfNames", "top", "pardusLider" });
		attributes.put("liderGroupType", new String[] { "AHENK" });
		try {
			String selectedAgentDNList[] = new String[listOfAgents.getContent().size()];
			selectedAgentDNList = listOfAgents.getContent().stream().map(t -> t.getDn()).toArray(String[]::new);
			attributes.put("member", selectedAgentDNList);
			ldapService.addEntry(newGroupDN, attributes);
			entry = ldapService.getEntryDetail(newGroupDN);
		} catch (LdapException e) {
			logger.error("Error occured while adding new group.");
			HttpHeaders headers = new HttpHeaders();
			return ResponseEntity.status(HttpStatus.EXPECTATION_FAILED).headers(headers)
					.build();
		}

		String selectedAgentList[] = new String[listOfAgents.getContent().size()];
		selectedAgentList = listOfAgents.getContent().stream().map(t -> t.getDn()).toArray(String[]::new);
		Map<String, Object> requestData = new HashMap<String, Object>();
		requestData.put("newGroupDN", newGroupDN);
		requestData.put("agents", selectedAgentList);
		ObjectMapper dataMapper = new ObjectMapper();
		String jsonString = null;
		try {
			jsonString = dataMapper.writeValueAsString(requestData);
		} catch (JsonProcessingException e1) {
			logger.error("Error occured while mapping request data to json. Error: " + e1.getMessage());
		}
		String log = "New group has been created " + newGroupDN + " and agents has been added";
		operationLogService.saveOperationLog(OperationType.CREATE, log, jsonString.getBytes(), null, null, null);

		return ResponseEntity
				.status(HttpStatus.OK)
				.body(entry);
	}

	@Operation(summary = "Update existing group", description = "", tags = { "computer-groups" })
	@ApiResponses(value = {
			@ApiResponse(responseCode = "200", description = "Existing group updated and agents added"),
			@ApiResponse(responseCode = "404", description = "No agents found to add to group. Not Found", content = @Content(schema = @Schema(implementation = String.class))),
			@ApiResponse(responseCode = "417", description = "Error occured while adding agents to existing group. Unexpected error occured", content = @Content(schema = @Schema(implementation = String.class)))
	})
	@PostMapping(value = "/agent-report/existing/group", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<LdapEntry> addClientToExistGroup(AgentDTO agentDTO) {
		agentDTO.setPageNumber(1);
		agentDTO.setPageSize(agentService.count().intValue());
		Page<AgentImpl> listOfAgents = agentService.findAllAgents(agentDTO);
		LdapEntry entry;
		HttpHeaders headers = new HttpHeaders();
		if (listOfAgents.getContent() == null || listOfAgents.getContent().size() == 0) {
			logger.error("No agents found to add to group!");
			return ResponseEntity.status(HttpStatus.NOT_FOUND).headers(headers)
					.build();
		}
		try {
			for (AgentImpl agentImpl : listOfAgents.getContent()) {
				ldapService.updateEntryAddAtribute(agentDTO.getGroupDN().get(), "member", agentImpl.getDn());
			}
		} catch (LdapException e) {
			logger.error("Error occured while adding agents to existing group.");
			return ResponseEntity.status(HttpStatus.EXPECTATION_FAILED).headers(headers)
					.build();
		}
		entry = ldapService.getEntryDetail(agentDTO.getGroupDN().get());

		String selectedAgentList[] = new String[listOfAgents.getContent().size()];
		selectedAgentList = listOfAgents.getContent().stream().map(t -> t.getDn()).toArray(String[]::new);
		Map<String, Object> requestData = new HashMap<String, Object>();
		requestData.put("newGroupDN", entry.getDistinguishedName());
		requestData.put("agents", selectedAgentList);
		ObjectMapper dataMapper = new ObjectMapper();
		String jsonString = null;
		try {
			jsonString = dataMapper.writeValueAsString(requestData);
		} catch (JsonProcessingException e1) {
			logger.error("Error occured while mapping request data to json. Error: " + e1.getMessage());
		}
		String log = "Existing group has been updated " + entry.getDistinguishedName() + " and agents has been added";
		operationLogService.saveOperationLog(OperationType.UPDATE, log, jsonString.getBytes(), null, null, null);

		return ResponseEntity
				.status(HttpStatus.OK)
				.body(entry);
	}

	// //add agents to existing group from agent info page
	// @Operation(summary = "Add agent to existing group", description = "", tags =
	// { "computer-groups" })
	// @ApiResponses(value = {
	// @ApiResponse(responseCode = "200", description = "Added agent to existing
	// group"),
	// @ApiResponse(responseCode = "417", description = "Could not add agent to
	// existing group. Unexpected error occured",
	// content = @Content(schema = @Schema(implementation = String.class))) })
	// @PostMapping(value = "/group/existing", produces =
	// MediaType.APPLICATION_JSON_VALUE)
	// public ResponseEntity<?> addAgentsToExistingGroupp(@RequestBody Map<String,
	// String> params) {
	// LdapEntry entry;
	// ObjectMapper mapper = new ObjectMapper();
	// List<LdapEntry> entries = new ArrayList<>();
	// try {
	// entries = Arrays.asList(mapper.readValue(params.get("checkedEntries"),
	// LdapEntry[].class));
	// } catch (JsonProcessingException e) {
	// logger.error("Error occured while mapping checked entry list to object");
	// }
	// List<LdapEntry> agents = new ArrayList<>();
	// List<LdapEntry> directories = new ArrayList<>();
	//
	// for (LdapEntry ldapEntry : entries) {
	// if(ldapEntry.getType().equals(DNType.AHENK)) {
	// agents.add(ldapEntry);
	// }
	// }
	//
	// for (LdapEntry ldapEntry : entries) {
	// Boolean hasParentChecked = false;
	// for (LdapEntry entryTemp : entries) {
	// if(ldapEntry.getType().equals(DNType.ORGANIZATIONAL_UNIT) &&
	// entryTemp.getType().equals(DNType.ORGANIZATIONAL_UNIT)) {
	// if(!ldapEntry.getDistinguishedName().equals(entryTemp.getDistinguishedName())
	// &&
	// ldapEntry.getDistinguishedName().contains(entryTemp.getDistinguishedName()))
	// {
	// hasParentChecked = true;
	// break;
	// }
	// }
	// }
	// if(ldapEntry.getType().equals(DNType.ORGANIZATIONAL_UNIT) &&
	// !hasParentChecked) {
	// directories.add(ldapEntry);
	// }
	// }
	//
	// List<LdapEntry> allAgents = getAhenksUnderOUs(directories, agents);
	// if(allAgents.size() == 0) {
	// return new ResponseEntity<String>("Seçili klasörlerde istemci bulunamadı.
	// Lütfen en az bir istemci seçiniz.", HttpStatus.NOT_ACCEPTABLE);
	// }
	// try {
	// String [] allAgentDNs =
	// allAgents.stream().map(LdapEntry::getDistinguishedName).toArray(String[]::new);
	// for (int i = 0; i < allAgentDNs.length; i++) {
	// ldapService.updateEntryAddAtribute(params.get("groupDN"), "member",
	// allAgentDNs[i]);
	// }
	// entry = ldapService.getEntryDetail(params.get("groupDN"));
	// } catch (LdapException e) {
	// logger.error("Error occured while adding new group.");
	// HttpHeaders headers = new HttpHeaders();
	// return ResponseEntity.
	// status(HttpStatus.EXPECTATION_FAILED).
	// headers(headers)
	// .build();
	// }
	//
	// Map<String, Object> requestData = new HashMap<String, Object>();
	// List<String> computerAdded = new ArrayList<>();
	//
	// for (LdapEntry computer : entries) {
	// if (computer.getUid() != null) {
	// computerAdded.add(computer.getUid());
	// }
	// }
	// requestData.put("uid",computerAdded);
	// ObjectMapper dataMapper = new ObjectMapper();
	// String jsonString = null;
	// try {
	// jsonString = dataMapper.writeValueAsString(requestData);
	// } catch (JsonProcessingException e1) {
	// logger.error("Error occured while mapping request data to json. Error: " +
	// e1.getMessage());
	// }
	// String log = "Computers has been added to " + entry.getDistinguishedName();
	// operationLogService.saveOperationLog(OperationType.UPDATE, log,
	// jsonString.getBytes(), null, null, null);
	//
	// return new ResponseEntity<LdapEntry>(entry, HttpStatus.OK);
	// }
}
