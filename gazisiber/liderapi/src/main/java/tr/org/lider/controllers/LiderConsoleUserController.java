package tr.org.lider.controllers;

import java.util.List;

import org.apache.directory.api.ldap.model.exception.LdapException;
import org.apache.directory.api.ldap.model.message.SearchScope;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PutMapping;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import tr.org.lider.entities.OperationType;
import tr.org.lider.ldap.LDAPServiceImpl;
import tr.org.lider.ldap.LdapEntry;
import tr.org.lider.security.CustomPasswordEncoder;
import tr.org.lider.services.ConfigurationService;
import tr.org.lider.services.NotificationBodyBuilder;
import tr.org.lider.services.NotificationDispatchService;
import tr.org.lider.services.OperationLogService;

/**
 * 
 * Return lider console user profile, update profile and update password
 * @author <a href="mailto:tuncay.colak@tubitak.gov.tr">Tuncay ÇOLAK</a>
 *
 */

@RestController
@RequestMapping("/api/lider-console")
@Tag(name = "console-user", description = "Console User Rest Service")
public class LiderConsoleUserController {
	
	Logger logger = LoggerFactory.getLogger(LiderConsoleUserController.class);
	
	@Autowired
	private LDAPServiceImpl ldapService;
	
	@Autowired
	private ConfigurationService configurationService;
	
	@Autowired
	private OperationLogService operationLogService; 
	
	@Autowired
	private CustomPasswordEncoder customPasswordEncoder;

	@Autowired
	private NotificationDispatchService notificationDispatchService;
	
	@Autowired
	private CustomPasswordEncoder encoder;
	
//	LIDER_CONSOLE USER
//	return lider console profile from ldap
	
	@Operation(summary = "Gets profile info", description = "", tags = { "console-user" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Return profile info"),
			  @ApiResponse(responseCode = "417", description = "Could not get profil info. Unexpected error occured", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/profile")
	public ResponseEntity<LdapEntry>  getLiderConsoleUser(Authentication authentication) {
		String globalUserOu = configurationService.getUserLdapBaseDn();
		LdapEntry liderConsoleUser = null;
		String uid = authentication.getName();
		try {
			String filter="(&(uid="+ uid +"))";
			List<LdapEntry> usersEntrylist = ldapService.findSubEntries(globalUserOu, filter,new String[] { "*" }, SearchScope.SUBTREE);
			if(usersEntrylist.size()>0)
			liderConsoleUser = usersEntrylist.get(usersEntrylist.size()-1);
			
		} catch (LdapException e) {
			e.printStackTrace();
		}
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(liderConsoleUser);
	}
	
	/**
	 * updated password of lider console
	 * @param selectedEntry
	 * @return
	 */
	@Operation(summary = "", description = "", tags = { "console-user" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = ""),
			  @ApiResponse(responseCode = "417", description = " Unexpected error occured", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/update-password",produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<Boolean> updateLiderConsoleUserPassword(@RequestBody LdapEntry selectedEntry) {
		try {
		
			if(!"".equals(selectedEntry.getUserPassword())){
				ldapService.updateEntry(selectedEntry.getDistinguishedName(), "userPassword", "{ARGON2}" + customPasswordEncoder.encode(selectedEntry.getUserPassword()));
			}
			operationLogService.saveOperationLog(OperationType.CHANGE_PASSWORD,"Lider Arayüz kullanıcı parolası güncellendi.",null);
			notificationDispatchService.dispatch("system.lider_user.password.changed",
					"Lider Kullanıcı Parolası Değiştirildi: " + selectedEntry.getDistinguishedName(),
					new NotificationBodyBuilder()
						.field("Kullanıcı", selectedEntry.getDistinguishedName())
						.build());
			return ResponseEntity
					.status(HttpStatus.OK)
					.body(true);
		} catch (LdapException e) {
			e.printStackTrace();
			return ResponseEntity
					.status(HttpStatus.EXPECTATION_FAILED)
					.body(false);
		}
	}
	
//	updated profile of lider console
	@Operation(summary = "Update console user password", description = "", tags = { "console-user" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Updated console user password"),
			  @ApiResponse(responseCode = "417", description = "Could not update console user password. Unexpected error occured", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
//	@PostMapping(value = "/update-profile",produces = MediaType.APPLICATION_JSON_VALUE)
	//@RequestMapping(method=RequestMethod.POST, value = "/updateProfile",produces = MediaType.APPLICATION_JSON_VALUE)
	@PutMapping(value = "/update-profile",produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<LdapEntry> updateLiderConsoleUser(@RequestBody LdapEntry selectedEntry) {
		try {
			if(!"".equals(selectedEntry.getCn())){
				ldapService.updateEntry(selectedEntry.getDistinguishedName(), "cn", selectedEntry.getCn());
			}
			if(!"".equals(selectedEntry.getSn())){
				ldapService.updateEntry(selectedEntry.getDistinguishedName(), "sn", selectedEntry.getSn());
			}
			if(!"".equals(selectedEntry.getTelephoneNumber())){
				ldapService.updateEntry(selectedEntry.getDistinguishedName(), "telephoneNumber", selectedEntry.getTelephoneNumber());
			}
			if(!"".equals(selectedEntry.getMail())){
				ldapService.updateEntry(selectedEntry.getDistinguishedName(), "mail", selectedEntry.getMail());
			}
			if(!"".equals(selectedEntry.getHomePostalAddress())){
				ldapService.updateEntry(selectedEntry.getDistinguishedName(), "homePostalAddress", selectedEntry.getHomePostalAddress());
			}
			selectedEntry = ldapService.findSubEntries(selectedEntry.getDistinguishedName(), "(objectclass=*)", new String[] {"*"}, SearchScope.OBJECT).get(0);
			operationLogService.saveOperationLog(OperationType.UPDATE,"Lider Arayüz kullanıcı bilgileri güncellendi.",null);
			notificationDispatchService.dispatch("system.lider_user.updated",
					"Lider Kullanıcı Bilgileri Güncellendi: " + selectedEntry.getDistinguishedName(),
					new NotificationBodyBuilder()
						.field("Kullanıcı", selectedEntry.getDistinguishedName())
						.build());

			return ResponseEntity
					.status(HttpStatus.OK)
					.body(selectedEntry);
					
		} catch (LdapException e) {
			e.printStackTrace();
			HttpHeaders headers = new HttpHeaders();
			return ResponseEntity.
					status(HttpStatus.EXPECTATION_FAILED).
					headers(headers)
					.build();
		}
	}
	
	@Operation(summary = "Matching password", description = "", tags = { "console-user" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Passwords matched"),
			  @ApiResponse(responseCode = "417", description = "Could not match password. Unexpected error occured", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/matches-password",produces = MediaType.APPLICATION_JSON_VALUE)
	//@RequestMapping(method=RequestMethod.POST, value = "/matchesPassword",produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<Boolean> matchesLiderConsoleUserPassword(LdapEntry selectedEntry) {
		LdapEntry ldapUserEntry= getUserFromLdap(selectedEntry.getUid());
		if(!"".equals(selectedEntry.getUserPassword())){
			return ResponseEntity
					.status(HttpStatus.OK)
					.body(encoder.matches(selectedEntry.getUserPassword(), ldapUserEntry.getUserPassword()));					
		} 
		else {
			return ResponseEntity
					.status(HttpStatus.EXPECTATION_FAILED)
					.body(false);
		}
	}
	
	private LdapEntry getUserFromLdap(String userName) {
		LdapEntry ldapEntry = null;
		try {
			String filter= "(&(objectClass=pardusAccount)(objectClass=pardusLider)(uid=$1))".replace("$1", userName);
			List<LdapEntry> ldapEntries  = ldapService.findSubEntries(filter,
					new String[] { "*" }, SearchScope.SUBTREE);
			if(ldapEntries.size()>0) {
				ldapEntry=ldapEntries.get(0);
			}
		} catch (Exception e) {
			logger.error(e.getMessage());
			
		}
		return ldapEntry;
	}
}
