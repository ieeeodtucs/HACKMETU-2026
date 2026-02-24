package tr.org.lider.controllers;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.apache.directory.api.ldap.model.exception.LdapException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import tr.org.lider.entities.OperationType;
import tr.org.lider.entities.PolicyExceptionImpl;
import tr.org.lider.ldap.DNType;
import tr.org.lider.ldap.LDAPServiceImpl;
//import tr.org.lider.ldap.LDAPServiceImpl;
import tr.org.lider.ldap.LdapEntry;
import tr.org.lider.ldap.LdapSearchFilterAttribute;
import tr.org.lider.ldap.SearchFilterEnum;
import tr.org.lider.messaging.enums.DomainType;
import tr.org.lider.services.AdService;
import tr.org.lider.services.ConfigurationService;
import tr.org.lider.services.NotificationBodyBuilder;
import tr.org.lider.services.NotificationDispatchService;
import tr.org.lider.services.OperationLogService;
import tr.org.lider.services.PolicyExceptionService;
import tr.org.lider.services.PolicyService;

/**
 * 
 * Return the policy Exception, saved, edited and deleted policy exception
 * 
 * @author <a href="mailto:tuncay.colak@tubitak.gov.tr">Tuncay ÇOLAK</a>
 *
 */
@Secured({ "ROLE_ADMIN", "ROLE_COMPUTERS" })
@RestController
@RequestMapping("/api/policy-exception")
@Tag(name = "Policy Exception", description = "Policy Exception Rest Service")
public class PolicyExceptionController {

	Logger logger = LoggerFactory.getLogger(PolicyExceptionController.class);

	@Autowired
	private PolicyExceptionService policyExceptionService;

	@Autowired
	private PolicyService policyService;

	@Autowired
	private LDAPServiceImpl ldapService;

	@Autowired
	private ConfigurationService configurationService;

	@Autowired
	private OperationLogService operationLogService;

	@Autowired
	private AdService adService;

	@Autowired
	private ConfigurationService configService;

	@Autowired
	private NotificationDispatchService notificationDispatchService;

	// @RequestMapping(method=RequestMethod.POST ,value = "/list", produces =
	// MediaType.APPLICATION_JSON_VALUE)

	@Operation(summary = "Get policy exception list all", description = "", tags = { "policy-exception" })
	@ApiResponses(value = {
			@ApiResponse(responseCode = "200", description = "Returns policy exception list successfully"),
			@ApiResponse(responseCode = "417", description = "Could not get policy exception list. Unexpected error occurred", content = @Content(schema = @Schema(implementation = String.class))) })
	@GetMapping(value = "/list", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<List<PolicyExceptionImpl>> policyExceptionList() {
		try {
			return ResponseEntity
					.status(HttpStatus.OK)
					.body(policyExceptionService.list());

		} catch (DataAccessException e) {
			logger.error("Error list policy exception: " + e.getCause().getMessage());
			HttpHeaders headers = new HttpHeaders();
			return ResponseEntity
					.status(HttpStatus.EXPECTATION_FAILED)
					.headers(headers)
					.build();
		}
	}

	@Operation(summary = "Get policy exception list by dn", description = "", tags = { "policy-exception" })
	@ApiResponses(value = {
			@ApiResponse(responseCode = "200", description = "Returns policy exception list successfully"),
			@ApiResponse(responseCode = "417", description = "Could not get policy exception list. Unexpected error occurred", content = @Content(schema = @Schema(implementation = String.class))) })
	@GetMapping(value = "/list/dn/{dn}", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<List<PolicyExceptionImpl>> policyExceptionListByDn(@PathVariable String dn) {
		logger.info("Getting executed policies for group. DN : " + dn);
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(policyExceptionService.listByDn(dn));
	}

	@Operation(summary = "Get policy exception list by policy id", description = "", tags = { "policy-exception" })
	@ApiResponses(value = {
			@ApiResponse(responseCode = "200", description = "Returns policy exception list successfully"),
			@ApiResponse(responseCode = "417", description = "Could not get policy exception list. Unexpected error occurred", content = @Content(schema = @Schema(implementation = String.class))) })
	@GetMapping(value = "/list/policy/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<List<PolicyExceptionImpl>> policyExceptionListByPolicy(@PathVariable Long id) {
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(policyExceptionService.listByPolicy(policyService.findPolicyByID(id).getId()));
	}

	@Operation(summary = "Get policy exception list by policy id and by selected group dn", description = "", tags = {
			"policy-exception" })
	@ApiResponses(value = {
			@ApiResponse(responseCode = "200", description = "Returns policy exception list successfully"),
			@ApiResponse(responseCode = "417", description = "Could not get policy exception list. Unexpected error occurred", content = @Content(schema = @Schema(implementation = String.class))) })
	@GetMapping(value = "/list/policy/{id}/group-dn/{dn}", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<List<PolicyExceptionImpl>> policyExceptionListByPolicyByDn(@PathVariable Long id,
			@PathVariable String dn) {
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(policyExceptionService.findByPolicyAndGroupDn(policyService.findPolicyByID(id), dn));
	}

	// return saved policy
	// @RequestMapping(method=RequestMethod.POST ,value = "/add", produces =
	// MediaType.APPLICATION_JSON_VALUE)
	@Operation(summary = "Add policy exception", description = "", tags = { "policy-exception" })
	@ApiResponses(value = {
			@ApiResponse(responseCode = "200", description = "Added policy to policy exception service.Successful"),
			@ApiResponse(responseCode = "417", description = "Coul not add policy to policy exception service. Unexpected error occurred.", content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/add", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<Boolean> policyExceptionAdd(@RequestBody PolicyExceptionImpl params) {
		System.out.print(params);
		try {
			Map<String, Object> requestData = new HashMap<String, Object>();
			List<String> memberList = new ArrayList<>();
			for (int i = 0; i < params.getMembers().size(); i++) {

				DNType dnType = getLdapEntry(params.getMembers().get(i).toString()).getType();
				if (dnType.toString().equals("GROUP")) {
					List<String> dnList = null;
					if (configService.getDomainType().equals(DomainType.ACTIVE_DIRECTORY)) {
						dnList = adService.getGroupInGroups(getLdapEntry(params.getMembers().get(i).toString()));
					} else if (configService.getDomainType().equals(DomainType.LDAP)
							|| configService.getDomainType().equals(DomainType.NONE)) {
						dnList = ldapService.getGroupInGroups(getLdapEntry(params.getMembers().get(i).toString()));
					}
					for (int j = 0; j < dnList.size(); j++) {
						memberList.add(dnList.get(j));
						PolicyExceptionImpl policyExceptionImpl = new PolicyExceptionImpl();
						policyExceptionImpl.setPolicy(params.getPolicy());
						policyExceptionImpl.setDescription(params.getDescription());
						policyExceptionImpl.setLabel(params.getLabel());
						policyExceptionImpl.setDn(dnList.get(j));
						policyExceptionImpl.setDnType(DNType.GROUP);
						policyExceptionImpl.setGroupDn(params.getGroupDn());
						policyExceptionService.add(policyExceptionImpl);
					}
				} else {
					memberList.add(params.getMembers().get(i).toString());
					PolicyExceptionImpl policyExceptionImpl = new PolicyExceptionImpl();
					policyExceptionImpl.setPolicy(params.getPolicy());
					policyExceptionImpl.setDescription(params.getDescription());
					policyExceptionImpl.setLabel(params.getLabel());
					policyExceptionImpl.setDn(params.getMembers().get(i).toString());
					policyExceptionImpl.setDnType(getLdapEntry(params.getMembers().get(i).toString()).getType());
					policyExceptionImpl.setGroupDn(params.getGroupDn());
					policyExceptionService.add(policyExceptionImpl);
				}
			}
			requestData.put("memberList", memberList);
			ObjectMapper dataMapper = new ObjectMapper();
			String jsonString = null;
			try {
				jsonString = dataMapper.writeValueAsString(requestData);
			} catch (JsonProcessingException e1) {
				logger.error("Error occured while mapping request data to json. Error: " + e1.getMessage());
			}
			String log = "New policy exception has been created for " + params.getPolicy().getLabel();
			operationLogService.saveOperationLog(OperationType.CREATE, log, jsonString.getBytes(), null, null, null);
			notificationDispatchService.dispatch("policy.exception.created",
						"Politika İstisnası Oluşturuldu: " + params.getPolicy().getLabel(),
						new NotificationBodyBuilder()
							.field("Politika", params.getPolicy().getLabel())
							.build());

			return ResponseEntity
					.status(HttpStatus.OK)
					.body(true);

		} catch (DataAccessException e) {
			logger.error("Error saving policy exception: " + e.getCause().getMessage());
			HttpHeaders headers = new HttpHeaders();
			return ResponseEntity
					.status(HttpStatus.EXPECTATION_FAILED)
					.headers(headers)
					.build();
		} catch (LdapException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		return null;
	}

	// return deleted policy. Never truly delete, just mark as deleted!
	@Operation(summary = "Delete policy exception", description = "", tags = { "policy-exception" })
	@ApiResponses(value = {
			@ApiResponse(responseCode = "200", description = "Deleted policy exception. Successful"),
			@ApiResponse(responseCode = "417", description = "Could not delete policy exception. Unexpected error occurred"),
			@ApiResponse(responseCode = "404", description = "Policy exception id not found", content = @Content(schema = @Schema(implementation = String.class))) })
	@DeleteMapping(value = "/delete/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<PolicyExceptionImpl> policyExceptionDelete(@PathVariable Long id) {
		try {
			Optional<PolicyExceptionImpl> existingPolicyException = policyExceptionService.findPolicyExceptionByID(id);
			if (!policyExceptionService.findPolicyExceptionByID(id).isPresent()) {
				logger.error("Policy exception to delete {} but id not found!", id);
				HttpHeaders headers = new HttpHeaders();
				headers.add("message", "Policy exception id not found !");
				return ResponseEntity
						.status(HttpStatus.NOT_FOUND)
						.headers(headers)
						.build();
			}
			policyExceptionService.delete(id);
			String log = existingPolicyException.get().getDn() + " deleted(policy exception) from "
					+ existingPolicyException.get().getPolicy().getLabel();
			operationLogService.saveOperationLog(OperationType.DELETE, log, null, null, null, null);
			notificationDispatchService.dispatch("policy.exception.deleted",
						"Politika İstisnası Silindi: " + existingPolicyException.get().getPolicy().getLabel(),
						new NotificationBodyBuilder()
							.field("Politika", existingPolicyException.get().getPolicy().getLabel())
							.field("Silinen DN", existingPolicyException.get().getDn())
							.build());

		} catch (DataAccessException e) {
			logger.error("Error delete policy exception: " + e.getCause().getMessage());
			HttpHeaders headers = new HttpHeaders();
			return ResponseEntity
					.status(HttpStatus.EXPECTATION_FAILED)
					.headers(headers)
					.build();
		}
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(null);
	}

	// return updated policy exception
	@Operation(summary = "Update policy exception", description = "", tags = { "policy-exception" })
	@ApiResponses(value = {
			@ApiResponse(responseCode = "200", description = "Updated policy exception successfully"),
			@ApiResponse(responseCode = "417", description = "Could not update policy exception. Unexpected error occurred", content = @Content(schema = @Schema(implementation = String.class))) })
	@PutMapping(value = "/update", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<PolicyExceptionImpl> policyExceptionUpdated(@RequestBody PolicyExceptionImpl params) {
		try {
			return ResponseEntity
					.status(HttpStatus.OK)
					.body(policyExceptionService.update(params));

		} catch (DataAccessException e) {
			e.printStackTrace();
			logger.error("Error updated policy exception: " + e.getCause().getMessage());
			HttpHeaders headers = new HttpHeaders();
			return ResponseEntity
					.status(HttpStatus.EXPECTATION_FAILED)
					.headers(headers)
					.build();
		}
	}

	// @Operation(summary = "List group policies", description = "", tags = {
	// "policy-exception" })
	// @ApiResponses(value = {
	// @ApiResponse(responseCode = "200", description = "Returns group policy
	// exceptions successfully"),
	// @ApiResponse(responseCode = "417", description = "Could not get policy
	// exception group. Unexpected error occured ",
	// content = @Content(schema = @Schema(implementation = String.class))) })
	// @GetMapping(value = "/policies-for-group/dn/{dn}", produces =
	// MediaType.APPLICATION_JSON_VALUE)
	// public ResponseEntity<List<PolicyResponse>> getPolicies4Group(@PathVariable
	// String dn) {
	// logger.info("Getting executed policy exceptions for group. DN : " +dn);
	// return ResponseEntity
	// .status(HttpStatus.OK)
	// .body(policyService.getPoliciesForGroup(dn));
	// }

	private LdapEntry getLdapEntry(String dn) throws LdapException {
		List<LdapSearchFilterAttribute> filterAttributesList = new ArrayList<LdapSearchFilterAttribute>();
		List<LdapEntry> entry = null;

		if (configurationService.getDomainType().equals(DomainType.ACTIVE_DIRECTORY)) {
			filterAttributesList.add(new LdapSearchFilterAttribute("distinguishedName", dn, SearchFilterEnum.EQ));
			String baseDn = adService.getADDomainName();
			entry = adService.search(baseDn, filterAttributesList, new String[] { "*" });
		} else {
			filterAttributesList.add(new LdapSearchFilterAttribute("entryDN", dn, SearchFilterEnum.EQ));
			entry = ldapService.search(configurationService.getLdapRootDn(), filterAttributesList,
					new String[] { "*" });
		}
		return entry.get(0);
	}
}
