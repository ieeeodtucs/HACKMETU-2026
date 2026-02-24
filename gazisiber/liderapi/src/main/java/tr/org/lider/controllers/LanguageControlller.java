package tr.org.lider.controllers;

import org.apache.directory.api.ldap.model.exception.LdapException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import tr.org.lider.ldap.LDAPServiceImpl;
import tr.org.lider.security.User;


@RestController
@RequestMapping("/api/lider")
@Tag(name = "Language Controller", description = "Language Controller")
public class LanguageControlller {
	
	Logger logger = LoggerFactory.getLogger(SettingsController.class);

	@Autowired
	private LDAPServiceImpl ldapService;

	@Operation(summary = "", description = "", tags = { "language-controller" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = ""),
			  @ApiResponse(responseCode = "417", description = "", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/change-language")
	public Boolean changeLanguage(@RequestParam String langa1799b6ac27611eab3de0242ac130004, Model model, Authentication authentication) throws LdapException {
		User userPrincipal = (User) authentication.getPrincipal();
		ldapService.updateEntryRemoveAttribute(userPrincipal.getDn(), "preferredLanguage");
		ldapService.updateEntryAddAtribute(userPrincipal.getDn(), "preferredLanguage", langa1799b6ac27611eab3de0242ac130004);
		return true;
	}
}
