package tr.org.lider.controllers;

import java.io.UnsupportedEncodingException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.servlet.http.HttpServletRequest;

import org.apache.directory.api.ldap.model.exception.LdapException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import tr.org.lider.entities.PluginTask;
import tr.org.lider.ldap.DNType;
import tr.org.lider.ldap.LDAPServiceImpl;
import tr.org.lider.ldap.LdapEntry;
import tr.org.lider.ldap.LdapSearchFilterAttribute;
import tr.org.lider.ldap.SearchFilterEnum;
import tr.org.lider.services.AgentService;
import tr.org.lider.services.ConfigurationService;
import tr.org.lider.services.TaskService;
import tr.org.lider.utils.IRestResponse;

/**
 * this controller for ldap-login management as OpenLDAP or AD 
 * @author <a href="mailto:tuncay.colak@tubitak.gov.tr">Tuncay ÇOLAK</a>
 *
 */

@Secured({"ROLE_ADMIN", "ROLE_COMPUTERS" })
@RestController
@RequestMapping("/api/ldap-login")
@Tag(name = "ldap-login-service", description = "Ldap Login Rest Service")
public class LdapLoginController {
	
	Logger logger = LoggerFactory.getLogger(LdapLoginController.class);
	
	@Autowired
	ConfigurationService configurationService;
	
	@Autowired
	AgentService agentService;
	
	@Autowired
	private LDAPServiceImpl ldapService;
	
	@Autowired
	public TaskService taskService;
	
//	get directory server(Active Directory and OpenLDAP) configurations method for ldap-login task
	@Operation(summary = "Gets Active directory or OpenLDAO directory server", description = "", tags = { "ldap-login-service" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Returns AD or LDAP for  directory server"),
			  @ApiResponse(responseCode = "417",description = "Could not get AD or LDAP for directory server. Unexpected error occured",
		  		 content = @Content(schema = @Schema(implementation = String.class))) })
	@GetMapping(value = "/configurations", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<HashMap<String, Object>>  getConfigParams() {
		HashMap<String, Object> configMap = new HashMap<String, Object>();
		configMap.put("ldapRootDn", configurationService.getLdapRootDn());
		configMap.put("ldapServer", configurationService.getLdapServer());
		configMap.put("adDomainName", configurationService.getAdDomainName());
		configMap.put("adIpAddress", configurationService.getAdIpAddress());
		configMap.put("adHostName", configurationService.getAdHostName());
		configMap.put("adAdminUserName", configurationService.getAdAdminUserName());
		configMap.put("disableLocalUser", configurationService.getDisableLocalUser());
		configMap.put("allowDynamicDNSUpdate", configurationService.getAllowDynamicDNSUpdate());
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(configMap);
				
	}
	
	//updated user directory domain method by agent dn as null, AD or OpenLDAP
	@Operation(summary = "Update change user directory domain ", description = "", tags = { "ldap-login-service" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Directory domain settings have changed"),
			  @ApiResponse(responseCode = "417",description = "Could not change directory domain settings. Unexpected error occured",
		  		 content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/update-directory-domain", produces = MediaType.APPLICATION_JSON_VALUE)
	public 	ResponseEntity<Boolean> changeUserDirectoryDomain(@RequestParam (value = "userDirectoryDomain", required=false) String userDirectoryDomain,
			@RequestParam (value="dn", required=false) String dn){
		try {
			List<LdapSearchFilterAttribute> filterAttributes = new ArrayList<LdapSearchFilterAttribute>();
			filterAttributes.add(new LdapSearchFilterAttribute("entryDN", dn, SearchFilterEnum.EQ));
			List<LdapEntry> selectedEntry = ldapService.search(configurationService.getLdapRootDn(),filterAttributes, new String[] {"*"});
			if (selectedEntry.get(0).getType().equals(DNType.AHENK)) {
				agentService.updateUserDirectoryAgentByJid(selectedEntry.get(0).getUid(), userDirectoryDomain);
			}
			if (selectedEntry.get(0).getType().equals(DNType.GROUP)) {
				String[] members= selectedEntry.get(0).getAttributesMultiValues().get("member");
				for (int i = 0; i < members.length; i++) {
					String memberDn = members[i];
					agentService.updateUserDirectoryAgentByDn(memberDn, userDirectoryDomain);
				}
			}
		} catch (LdapException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
			return ResponseEntity
					.status(HttpStatus.EXPECTATION_FAILED)
					.body(false);
					
		}
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(true);
				
	}
	
//	This method is only for ldap-login plugin
	@Operation(summary = "Returns ldap-login plugin", description = "", tags = { "ldap-login-service" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = ""),
			  @ApiResponse(responseCode = "417",description = "Could not retrieve ldap-login plugin. Unexpected error occured",
		  		 content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/task/execute")
	public ResponseEntity<IRestResponse>  executeTask(@RequestBody PluginTask requestBody, HttpServletRequest request)
			throws UnsupportedEncodingException {
		if (requestBody.getPlugin().getName().equals("ldap-login")) {
			if (requestBody.getCommandId().equals("EXECUTE_AD_LOGIN")) {
				Map<String, Object> parameterMap = requestBody.getParameterMap();
				parameterMap.put("ad_username", configurationService.getAdAdminUserName());
				parameterMap.put("admin_password", configurationService.getAdAdminPassword());
				parameterMap.put("ad_port", configurationService.getAdPort());
				requestBody.setParameterMap(parameterMap);
			}
			IRestResponse restResponse = taskService.execute(requestBody);
			logger.debug("Completed processing request for ldap-login");
			return ResponseEntity
					.status(HttpStatus.OK)
					.body(restResponse);
					
		} else {
			HttpHeaders headers = new HttpHeaders();
			return ResponseEntity.
					status(HttpStatus.EXPECTATION_FAILED).
					headers(headers)
					.build();
		}
	}
}
