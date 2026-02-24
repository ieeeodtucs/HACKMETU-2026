package tr.org.lider.controllers;

import java.util.List;

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
import tr.org.lider.entities.PluginImpl;
import tr.org.lider.entities.ProfileImpl;
import tr.org.lider.services.PluginService;
import tr.org.lider.services.ProfileService;

/**
 * 
 * Return the profiles, saved, edited and deleted profile
 * @author <a href="mailto:tuncay.colak@tubitak.gov.tr">Tuncay ÇOLAK</a>
 *
 */

@Secured({"ROLE_ADMIN", "ROLE_COMPUTERS" })
@RestController
@RequestMapping("/api/profile")
@Tag(name = "", description = "")
public class ProfileController {

	Logger logger = LoggerFactory.getLogger(ProfileController.class);


	@Autowired
	private ProfileService profileService;

	@Autowired
	private PluginService pluginService;

	//return profile detail by plugin name and by deleted is false
	
	@Operation(summary = "Get profile list", description = "", tags = { "profile" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Returns profil list. Successful"),
			  @ApiResponse(responseCode = "417", description = "Could not get profil list. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/list", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<List<ProfileImpl>> findAgentByJIDRest(@RequestParam (value = "name") String name) {
		List<PluginImpl> plugin = pluginService.findPluginByName(name);
		Long pluginId = plugin.get(0).getId();
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(profileService.findProfileByPluginIDAndDeletedFalse(pluginId));
				
	}

	//	save profile
	@Operation(summary = "Add profile", description = "", tags = { "profile" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "The profile has been successfully saved."),
			  @ApiResponse(responseCode = "417", description = "Could not save profil. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/add", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<ProfileImpl> profileAdd(@RequestBody ProfileImpl params){
		try {
			return ResponseEntity
					.status(HttpStatus.OK)
					.body(profileService.add(params));
					
		} catch (DataAccessException e) {
			logger.error("Error saving profile: " + e.getCause().getMessage());
			HttpHeaders headers = new HttpHeaders();
    		return ResponseEntity
    				.status(HttpStatus.EXPECTATION_FAILED)
    				.headers(headers)
    				.build();
		}
	}

	//	delete profile by id (deleted value is changed to true) Never truly delete, just mark as deleted!
	@Operation(summary = "Delete profile", description = "", tags = { "profile" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Profile deleted successfully."),
			  @ApiResponse(responseCode = "417", description = "Could not delete profil. Unexpected error occurred.", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@DeleteMapping(value = "/delete/id/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<ProfileImpl> profileDelete(@PathVariable Long id){
		try {
			return ResponseEntity
					.status(HttpStatus.OK)
					.body(profileService.delete(id));
		} catch (DataAccessException e) {
			logger.error("Error delete profile: " + e.getCause().getMessage());
			HttpHeaders headers = new HttpHeaders();
    		return ResponseEntity
    				.status(HttpStatus.EXPECTATION_FAILED)
    				.headers(headers)
    				.build();
		}
	}

	//	updated profile
	@Operation(summary = "Update profile", description = "", tags = { "profile" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Profile successfully updated."),
			  @ApiResponse(responseCode = "417", description = "Could not update profile. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/update", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<ProfileImpl> profileUpdate(@RequestBody ProfileImpl profile){
		try {
			return ResponseEntity
					.status(HttpStatus.OK)
					.body(profileService.update(profile));
					
		} catch (DataAccessException e) {
			logger.error("Error updated profile: " + e.getCause().getMessage());
			HttpHeaders headers = new HttpHeaders();
    		return ResponseEntity
    				.status(HttpStatus.EXPECTATION_FAILED)
    				.headers(headers)
    				.build();
		}
	}
	
	//return profile detail by plugin name and by deleted is false
	@Operation(summary = "Get all profile list", description = "", tags = { "profile" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Returns all profil list"),
			  @ApiResponse(responseCode = "417", description = "Could not get all profil list. Unexpected error occurred", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@GetMapping(value = "/all-list", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<List<ProfileImpl>> getAllProfiles() {
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(profileService.list());
		
	}
}
