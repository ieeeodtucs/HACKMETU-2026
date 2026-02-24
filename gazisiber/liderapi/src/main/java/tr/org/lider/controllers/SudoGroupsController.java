package tr.org.lider.controllers;

import java.util.ArrayList;
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
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import tr.org.lider.entities.OperationType;
import tr.org.lider.ldap.LDAPServiceImpl;
import tr.org.lider.ldap.LdapEntry;
import tr.org.lider.ldap.LdapSearchFilterAttribute;
import tr.org.lider.ldap.SearchFilterEnum;
import tr.org.lider.services.ConfigurationService;
import tr.org.lider.services.OperationLogService;


/**
 * Controller for sudo groups operations
 * 
 * @author <a href="mailto:hasan.kara@pardus.org.tr">Hasan Kara</a>
 * 
 */
@Secured({"ROLE_ADMIN", "ROLE_SUDO_GROUPS" })
@RestController
@RequestMapping("/api/lider/sudo-groups")
@Tag(name = "Sudo Groups", description = "Sudo Groups Rest Service")
public class SudoGroupsController {

	Logger logger = LoggerFactory.getLogger(SudoGroupsController.class);

	@Autowired
	private LDAPServiceImpl ldapService;
	
	@Autowired
	private ConfigurationService configurationService;
	
	@Autowired
	private OperationLogService operationLogService;
	
	@Operation(summary = "Gets sudo groups list", description = "", tags = { "sudo-groups" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Returns sudo group list"),
			  @ApiResponse(responseCode = "417", description = "Could not get sudo group list. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/groups", produces = MediaType.APPLICATION_JSON_VALUE)
	//@RequestMapping(value = "/getGroups")
	public ResponseEntity<List<LdapEntry>> getSudoGroups() {
		List<LdapEntry> retList = new ArrayList<LdapEntry>();
		retList.add(ldapService.getLdapSudoGroupsTree());
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(retList);
	}
	
	@Operation(summary = "Gets organizational unit detail list", description = "", tags = { "sudo-groups" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Returns ou detail"),
			  @ApiResponse(responseCode = "417", description = "Could not get organizational unit detail. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/get-ou-details", produces = MediaType.APPLICATION_JSON_VALUE)
	//@RequestMapping(value = "/getOuDetails")
	public ResponseEntity<List<LdapEntry>> getOuDetails(LdapEntry selectedEntry) {
		List<LdapEntry> subEntries = null;
		try {
			subEntries = ldapService.findSubEntries(selectedEntry.getUid(), "(objectclass=*)",
					new String[] { "*" }, SearchScope.ONELEVEL);
		} catch (LdapException e) {
			e.printStackTrace();
			HttpHeaders headers = new HttpHeaders();
    		return ResponseEntity
    				.status(HttpStatus.EXPECTATION_FAILED)
    				.headers(headers)
    				.build();
		}
		Collections.sort(subEntries);
		selectedEntry.setChildEntries(subEntries);
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(subEntries);
				
	}
	
	@Operation(summary = "Create new organizational unit", description = "", tags = { "sudo-groups" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Organizational unit created. Successfull"),
			  @ApiResponse(responseCode = "417", description = "Could not create organizational unit. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/add-ou", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<LdapEntry> addOu(@RequestBody LdapEntry selectedEntry) {
		try {
			Map<String, String[]> attributes = new HashMap<String,String[]>();
			attributes.put("objectClass", new String[] {"organizationalUnit", "top", "pardusLider"} );
			attributes.put("ou", new String[] { selectedEntry.getOu() });

			String dn="ou="+selectedEntry.getOu()+","+selectedEntry.getParentName();
			
			ldapService.addEntry(dn, attributes);
			logger.info("OU created successfully RDN ="+dn);
			
			//get full of ou details after creation
			selectedEntry = ldapService.getEntryDetail(dn);
			
			
			Map<String, Object> requestData = new HashMap<String, Object>();
			requestData.put("dn", selectedEntry.getDistinguishedName());
			ObjectMapper dataMapper = new ObjectMapper();
			String jsonString = dataMapper.writeValueAsString(requestData);
			String log = "Entry has been added to " + selectedEntry.getDistinguishedName();
			operationLogService.saveOperationLog(OperationType.CREATE, log, jsonString.getBytes(), null, null, null);
			
			return ResponseEntity
					.status(HttpStatus.OK)
					.body(selectedEntry);
					
		} catch (Exception e) {
			logger.error("Error occured while mapping request data to json. Error: " +  e.getMessage());
			HttpHeaders headers = new HttpHeaders();
    		return ResponseEntity
    				.status(HttpStatus.EXPECTATION_FAILED)
    				.headers(headers)
    				.build();
		}
	}
	
	@Operation(summary = "Delete entry by dn", description = "", tags = { "sudo-groups" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Deleted entry by dn.Successful"),
			  @ApiResponse(responseCode = "417", description = "Could not delete entry. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@DeleteMapping(value = "/entry/dn/{dn}")
	public ResponseEntity<Boolean> deleteEntry(@PathVariable String dn) {
		try {
			if(dn != configurationService.getAgentLdapBaseDn()) {
				ldapService.updateOLCAccessRulesAfterEntryDelete(dn);
				ldapService.deleteNodes(ldapService.getOuAndOuSubTreeDetail(dn));
				
				Map<String, Object> requestData = new HashMap<String, Object>();
				requestData.put("dn", dn);
				ObjectMapper dataMapper = new ObjectMapper();
				String jsonString = dataMapper.writeValueAsString(requestData);
				String log = "Entry name has been deleted " + dn;
				operationLogService.saveOperationLog(OperationType.DELETE, log, jsonString.getBytes(), null, null, null);
				
				return ResponseEntity
						.status(HttpStatus.OK)
						.body(true);
			} else {
				return ResponseEntity
						.status(HttpStatus.OK)
						.body(false);
			}
			
		} catch (Exception e) {
			logger.error("Error occured while mapping request data to json. Error: " +  e.getMessage());
			return ResponseEntity
					.status(HttpStatus.EXPECTATION_FAILED)
					.body(false);
		}
	}
	
	//@RequestMapping(method=RequestMethod.POST ,value = "/move/entry", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(summary = "Move from source  dn to destination dn", description = "", tags = { "sudo-groups" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Moved from source  dn to destination dn.Successful"),
			  @ApiResponse(responseCode = "404", description = "Could not move from source dn to destination dn. Not found", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PutMapping(value = "/move/entry/sourceDN/{sourceDN}/destinationDN/{destinationDN}", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<Boolean> moveEntry(@PathVariable String sourceDN,
			@PathVariable String destinationDN) {
		
		try {
			Map<String, Object> requestData = new HashMap<String, Object>();
			requestData.put("SourceDN",sourceDN);
			requestData.put("DestinationDN",destinationDN);
			ldapService.moveEntry(sourceDN, destinationDN);
			String log = "Entry has been moved from " + sourceDN + " to " + destinationDN ;
			operationLogService.saveOperationLog(OperationType.MOVE, log, null,null, null, null);
			logger.info(log);
			return ResponseEntity
					.status(HttpStatus.OK)
					.body(true);
			
			
		} catch (Exception e) {
			e.printStackTrace();
			logger.error("Error occured while moving entry. Error: " +  e.getMessage());
			return ResponseEntity
					.status(HttpStatus.EXPECTATION_FAILED)
					.body(false);
					
		}
		
	}
	
	
	@Operation(summary = "Rename entry", description = "", tags = { "sudo-groups" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Entry has been renamed. Successful"),
			  @ApiResponse(responseCode = "417", description = "Could not rename entry. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PutMapping(value = "/rename/entry/oldDN/{oldDN}/newName/{newName}", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<LdapEntry> renameEntry(@PathVariable String oldDN, @PathVariable String newName) {
		try {
			ldapService.renameEntry(oldDN, newName);
			String newEntryDN = newName + ",";
			LdapName dn = new LdapName(oldDN);
			for (int i = dn.size()-2; 0 <= i; i--) {
				newEntryDN += dn.get(i);
				if(i>0) {
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
			logger.error("Error occured while mapping request data to json. Error: " +  e.getMessage());
			HttpHeaders headers = new HttpHeaders();
    		return ResponseEntity
    				.status(HttpStatus.EXPECTATION_FAILED)
    				.headers(headers)
    				.build();
		}
	}
	
	@Operation(summary = "Gets ldap users list", description = "", tags = { "sudo-groups" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = ""),
			  @ApiResponse(responseCode = "417", description = "Could not get ldap users list. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/users")
	public ResponseEntity<List<LdapEntry>> getUsers() {
		List<LdapEntry> retList = new ArrayList<LdapEntry>();
		retList.add(ldapService.getLdapUserTree());
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(retList);
				
	}
	
	/**
	 * get users under sent ORGANIZATIONAL_UNIT 
	 * @param selectedEntryArr
	 * @return
	 */
	@Operation(summary = "Gets users under organizational unit", description = "", tags = { "sudo-groups" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Users moved under ou. Successful"),
			  @ApiResponse(responseCode = "417", description = "Could not move users under ou. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/get-users-under-ou")
	public ResponseEntity<List<LdapEntry>> getUsersUnderOU(HttpServletRequest request,Model model, @RequestBody LdapEntry[] selectedEntryArr) {
		List<LdapEntry> userList=new ArrayList<>();
		for (LdapEntry ldapEntry : selectedEntryArr) {
			List<LdapSearchFilterAttribute> filterAttributes = new ArrayList<LdapSearchFilterAttribute>();
			LdapSearchFilterAttribute fAttr = new LdapSearchFilterAttribute("objectClass", "pardusAccount",	SearchFilterEnum.EQ);
			filterAttributes.add(fAttr);
			try {
				List<LdapEntry> retList=ldapService.findSubEntries(ldapEntry.getDistinguishedName(), "(objectclass=pardusAccount)", new String[] { "*" }, SearchScope.SUBTREE);
				for (LdapEntry ldapEntry2 : retList) {
					boolean isExist=false;
					for (LdapEntry ldapEntryAhenk : userList) {
						if(ldapEntry2.getEntryUUID().equals(ldapEntryAhenk.getEntryUUID())) {
							isExist=true;
							break;
						}
					}
					if(!isExist) {
						userList.add(ldapEntry2);
					}
				}
			} catch (LdapException e) {
				e.printStackTrace();
				HttpHeaders headers = new HttpHeaders();
	    		return ResponseEntity
	    				.status(HttpStatus.EXPECTATION_FAILED)
	    				.headers(headers)
	    				.build();
			}
		}
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(userList);
			
	}
	
	//add new group and add selected attributes
	@Operation(summary = "Create new sudo group", description = "", tags = { "sudo-groups" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "New sudo group created. Successful"),
			  @ApiResponse(responseCode = "417", description = "Could not create sudo group. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))),
			  @ApiResponse(responseCode = "404", description = "Could not create sudo group. Not found unit", 
			    content = @Content(schema = @Schema(implementation = String.class)))})
	@PostMapping(value = "/create-sudo-group", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<LdapEntry> createSudoGroup(@RequestBody(required=false) String body) {
		
		try {
			Map<String, Object> readValue = new ObjectMapper().readValue(body, Map.class);
			
			String groupName = (String) readValue.get("groupName");
			String selectedOUDN = (String) readValue.get("selectedOUDN");
			List<String> sudoCommandList = (ArrayList<String>) readValue.get("sudoCommandList");
			List<String> sudoUserList = (ArrayList<String>) readValue.get("sudoUserList");
			List<String> sudoHostList = (ArrayList<String>) readValue.get("sudoHostList");
			
			String newGroupDN = "";
			//to return newly added entry with its details
			LdapEntry entry=null;
			Map<String, String[]> attributes = new HashMap<String,String[]>();
			attributes.put("objectClass", new String[] {"top", "sudoRole"} );
			try {
				//add sudoUser attributes 
				if(sudoUserList != null) {
					attributes.put("sudoUser", sudoUserList.toArray(new String[sudoUserList.size()]));
				}
				//add sudoHost attributes 
				if(sudoHostList != null) {
					attributes.put("sudoHost", sudoHostList.toArray(new String[sudoHostList.size()]));
				}
				//add sudoCommand attributes 
				if(sudoCommandList != null) {
					attributes.put("sudoCommand", sudoCommandList.toArray(new String[sudoCommandList.size()]));
				}
				newGroupDN = "cn=" +  groupName +","+ selectedOUDN;
				System.out.println(attributes);
				ldapService.addEntry(newGroupDN , attributes);
				entry = ldapService.getEntryDetail(newGroupDN);

				Map<String, Object> requestData = new HashMap<String, Object>();
				requestData.put("dn", entry.getDistinguishedName());
				requestData.put("sudoUser", sudoUserList);
				requestData.put("sudoHost", sudoHostList);
				requestData.put("sudoCommand", sudoCommandList);
				ObjectMapper dataMapper = new ObjectMapper();
				String jsonString = dataMapper.writeValueAsString(requestData);
				String log = entry.getDistinguishedName()+ " sudoGroup has been created";
				operationLogService.saveOperationLog(OperationType.CREATE, log, jsonString.getBytes(), null, null, null);
				
				return ResponseEntity
						.status(HttpStatus.OK)
						.body(entry);
						
			} catch (LdapException e) {
				logger.error("Error occured while adding new group.");
				HttpHeaders headers = new HttpHeaders();
	    		return ResponseEntity
	    				.status(HttpStatus.EXPECTATION_FAILED)
	    				.headers(headers)
	    				.build();
			}
		} catch (JsonMappingException e) {
			e.printStackTrace();
		} catch (JsonProcessingException e) {
			e.printStackTrace();
		}
		
		HttpHeaders headers = new HttpHeaders();
		return ResponseEntity
				.status(HttpStatus.EXPECTATION_FAILED)
				.headers(headers)
				.build();
	}
	
	//edit sudo group
	@Operation(summary = "Edit sudo group", description = "", tags = { "sudo-groups" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Edited sudo group. Successful"),
			  @ApiResponse(responseCode = "417", description = "Could not edit sudo group. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/edit-sudo-group", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<LdapEntry> editSudoGroup(@RequestBody(required=false) String body) {
		try {
			Map<String, Object> readValue = new ObjectMapper().readValue(body, Map.class);
			
			String newName = (String) readValue.get("newName");
			String selectedDN = (String) readValue.get("selectedDN");
			List<String> sudoCommandList = (ArrayList<String>) readValue.get("sudoCommandList");
			List<String> sudoUserList = (ArrayList<String>) readValue.get("sudoUserList");
			List<String> sudoHostList = (ArrayList<String>) readValue.get("sudoHostList");
			
			LdapEntry entry=null;
			ldapService.updateEntryRemoveAttribute(selectedDN, "sudoCommand");
			ldapService.updateEntryRemoveAttribute(selectedDN, "sudoHost");
			ldapService.updateEntryRemoveAttribute(selectedDN, "sudoUser");
			if(sudoHostList != null) {
				for (String value : sudoHostList) {
					ldapService.updateEntryAddAtribute(selectedDN, "sudoHost", value);
				}
			}
			if(sudoCommandList != null) {
				for (String value : sudoCommandList) {
					ldapService.updateEntryAddAtribute(selectedDN, "sudoCommand", value);
				}
			}
			if(sudoUserList != null) {
				for (String value : sudoUserList) {
					ldapService.updateEntryAddAtribute(selectedDN, "sudoUser", value);
				}
			}
			//if name has been edited edit name
			ldapService.renameEntry(selectedDN, newName);
			String newEntryDN = newName + ",";
			LdapName dn = new LdapName(selectedDN);
			for (int i = dn.size()-2; 0 <= i; i--) {
				newEntryDN += dn.get(i);
				if(i>0) {
					newEntryDN += ",";
				}
			}
			entry = ldapService.getEntryDetail(newEntryDN);
			
			Map<String, Object> requestData = new HashMap<String, Object>();
			requestData.put("dn", entry.getDistinguishedName());
			requestData.put("sudoUser", sudoUserList);
			requestData.put("sudoHost", sudoHostList);
			requestData.put("sudoCommand", sudoCommandList);
			ObjectMapper dataMapper = new ObjectMapper();
			String jsonString = dataMapper.writeValueAsString(requestData);
			String log = entry.getDistinguishedName()+ " sudoGroup has been changed";
			operationLogService.saveOperationLog(OperationType.UPDATE, log, jsonString.getBytes(), null, null, null);
			
			
			
			return ResponseEntity
					.status(HttpStatus.OK)
					.body(entry);
					
		} catch (Exception e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
			HttpHeaders headers = new HttpHeaders();
    		return ResponseEntity
    				.status(HttpStatus.EXPECTATION_FAILED)
    				.headers(headers)
    				.build();
		}
	}
	
	//delete sudoUser from sudo groups
	@Operation(summary = "Delete ldap user", description = "", tags = { "sudo-groups" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Deleted user. Succcessful"),
			  @ApiResponse(responseCode = "417", description = "Coould not delete user. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@DeleteMapping(value = "/delete/sudo/user/dn/{dn}/uid/{uid}", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<LdapEntry> deleteUserOfSudoGroup(@PathVariable String dn, @PathVariable String uid) {
		try {
			ldapService.updateEntryRemoveAttributeWithValue(dn, "sudoUser", uid);
			
			Map<String, Object> requestData = new HashMap<String, Object>();
			requestData.put("dn", dn);
			requestData.put("uid", uid);
			ObjectMapper dataMapper = new ObjectMapper();
			String jsonString = dataMapper.writeValueAsString(requestData);
			String log = "sudoUser " + uid + " has been deleted " + dn;
			operationLogService.saveOperationLog(OperationType.DELETE, log, jsonString.getBytes(), null, null, null);
			
		} catch (Exception e) {
			logger.error("Error occured while mapping request data to json. Error: " +  e.getMessage());
			HttpHeaders headers = new HttpHeaders();
    		return ResponseEntity
    				.status(HttpStatus.EXPECTATION_FAILED)
    				.headers(headers)
    				.build();
		}
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(ldapService.getEntryDetail(dn));
				
	}
	
}
